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

function avisar(req, tipo, texto) {
  req.session.mensaje = { tipo, texto };
}

function requiereSesion(req, res, next) {
  if (!req.session.usuario) return res.redirect('/login');
  next();
}

app.get('/', (req, res) => {
  if (!req.session.usuario) return res.redirect('/registro');
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


module.exports = { app, requiereSesion, avisar };
