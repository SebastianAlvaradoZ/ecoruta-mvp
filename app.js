// Aplicación Express de EcoRuta (separada de server.js para poder probarla).
const path = require('path');
const express = require('express');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const bcrypt = require('bcryptjs');
const { pool } = require('./db');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); // Render atiende detrás de un proxy HTTPS
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Las sesiones se guardan en PostgreSQL para que no se pierdan al reiniciar.
app.use(session({
  store: new PgSession({ pool, createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'solo-para-desarrollo-local',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7, sameSite: 'lax', secure: 'auto' },
}));

// Deja al usuario actual y los mensajes disponibles en todas las vistas.
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  res.locals.mensaje = req.session.mensaje || null;
  delete req.session.mensaje;
  next();
});

// Zonas de Arequipa desde donde salen los estudiantes (de las entrevistas y el formulario).
const ZONAS = [
  'Cayma', 'Cerro Colorado', 'Cercado', 'Hunter', 'José Luis Bustamante y Rivero',
  'Mariano Melgar', 'Miraflores', 'Paucarpata', 'Sachaca', 'Socabaya', 'Tiabaya', 'Yanahuara',
];

// Fecha de hoy en hora de Perú (el servidor puede estar en otra zona horaria).
function hoyEnLima() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

function avisar(req, tipo, texto) {
  req.session.mensaje = { tipo, texto };
}

function requiereSesion(req, res, next) {
  if (!req.session.usuario) return res.redirect('/login');
  next();
}

app.get('/', (req, res) => {
  if (!req.session.usuario) return res.redirect('/login');
  res.render('inicio');
});

// ---------- H-01: registro con rol ----------
app.get('/registro', (req, res) => {
  res.render('registro', { error: null, datos: {} });
});

app.post('/registro', async (req, res) => {
  const nombre = (req.body.nombre || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const rol = req.body.rol;
  const datos = { nombre, email, rol };

  if (!nombre || !email || !password || !['conductor', 'pasajero'].includes(rol)) {
    return res.status(400).render('registro', { error: 'Completa todos los campos y elige un rol.', datos });
  }
  if (password.length < 6) {
    return res.status(400).render('registro', { error: 'La contraseña debe tener al menos 6 caracteres.', datos });
  }

  const existe = await pool.query('SELECT 1 FROM usuarios WHERE email = $1', [email]);
  if (existe.rowCount > 0) {
    return res.status(409).render('registro', { error: 'Este correo ya está registrado', datos });
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, rol',
    [nombre, email, hash, rol]
  );
  req.session.usuario = rows[0];
  avisar(req, 'ok', `¡Bienvenido/a, ${rows[0].nombre}! Tu cuenta de ${rol} fue creada.`);
  res.redirect('/');
});


// ---------- H-02: iniciar y cerrar sesión ----------
app.get('/login', (req, res) => {
  if (req.session.usuario) return res.redirect('/');
  res.render('login', { error: null, email: '' });
});

app.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
  const u = rows[0];
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    return res.status(401).render('login', { error: 'Correo o contraseña incorrectos', email });
  }
  req.session.usuario = { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol };
  res.redirect('/');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ---------- H-03: el conductor publica un viaje ----------
function soloConductor(req, res, next) {
  if (req.session.usuario.rol !== 'conductor') {
    avisar(req, 'error', 'Solo los conductores pueden publicar viajes.');
    return res.redirect('/');
  }
  next();
}

app.get('/viajes/nuevo', requiereSesion, soloConductor, (req, res) => {
  res.render('nuevo-viaje', { error: null, datos: { fecha: hoyEnLima() }, zonas: ZONAS });
});

app.post('/viajes', requiereSesion, soloConductor, async (req, res) => {
  const { zona, fecha, hora_salida, hora_llegada } = req.body;
  const cupos = Number(req.body.cupos);
  const datos = { zona, fecha, hora_salida, hora_llegada, cupos: req.body.cupos };
  const fallar = (error) => res.status(400).render('nuevo-viaje', { error, datos, zonas: ZONAS });

  if (!ZONAS.includes(zona) || !fecha || !hora_salida || !hora_llegada) {
    return fallar('Completa la zona, la fecha y las dos horas.');
  }
  if (fecha < hoyEnLima()) return fallar('La fecha del viaje no puede estar en el pasado.');
  if (hora_llegada <= hora_salida) return fallar('La hora de llegada debe ser posterior a la hora de salida.');
  if (!Number.isInteger(cupos) || cupos < 1 || cupos > 4) return fallar('Los cupos deben estar entre 1 y 4.');

  await pool.query(
    `INSERT INTO viajes (conductor_id, zona, fecha, hora_salida, hora_llegada, cupos, cupos_libres)
     VALUES ($1, $2, $3, $4, $5, $6, $6)`,
    [req.session.usuario.id, zona, fecha, hora_salida, hora_llegada, cupos]
  );
  avisar(req, 'ok', 'Viaje publicado. Tus compañeros de ' + zona + ' ya pueden verlo.');
  res.redirect('/viajes');
});

// ---------- H-04: lista de viajes próximos ----------
// ---------- H-05: filtro por zona y por hora a la que necesito llegar ----------
app.get('/viajes', requiereSesion, async (req, res) => {
  const zona = ZONAS.includes(req.query.zona) ? req.query.zona : '';
  const llegarAntes = /^\d{2}:\d{2}$/.test(req.query.llegar || '') ? req.query.llegar : '';

  const condiciones = ['v.fecha >= $1'];
  const valores = [hoyEnLima()];
  if (zona) { valores.push(zona); condiciones.push(`v.zona = $${valores.length}`); }
  if (llegarAntes) { valores.push(llegarAntes); condiciones.push(`v.hora_llegada <= $${valores.length}`); }

  const { rows: viajes } = await pool.query(
    `SELECT v.*, to_char(v.hora_salida, 'HH24:MI') AS salida, to_char(v.hora_llegada, 'HH24:MI') AS llegada,
            to_char(v.fecha, 'DD/MM/YYYY') AS fecha_texto, u.nombre AS conductor
       FROM viajes v JOIN usuarios u ON u.id = v.conductor_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY v.fecha, v.hora_llegada`,
    valores
  );
  res.render('viajes', { viajes, zonas: ZONAS, filtro: { zona, llegar: llegarAntes } });
});

module.exports = { app, requiereSesion, avisar };
