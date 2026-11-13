// Conexión a PostgreSQL. La URL viene de la variable de entorno DATABASE_URL
// (nunca se escribe en el código: el repositorio es público).
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres@localhost:5432/ecoruta';
const esLocal = /localhost|127\.0\.0\.1/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: esLocal ? false : { rejectUnauthorized: false },
});

// Crea las tablas si no existen. Los datos viven en PostgreSQL, no en disco,
// así que sobreviven a los reinicios del servidor.
async function iniciarBaseDeDatos() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('conductor', 'pasajero')),
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS viajes (
      id SERIAL PRIMARY KEY,
      conductor_id INTEGER NOT NULL REFERENCES usuarios(id),
      zona TEXT NOT NULL,
      fecha DATE NOT NULL,
      hora_salida TIME NOT NULL,
      hora_llegada TIME NOT NULL,
      cupos INTEGER NOT NULL CHECK (cupos BETWEEN 1 AND 4),
      cupos_libres INTEGER NOT NULL CHECK (cupos_libres >= 0),
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reservas (
      id SERIAL PRIMARY KEY,
      viaje_id INTEGER NOT NULL REFERENCES viajes(id) ON DELETE CASCADE,
      pasajero_id INTEGER NOT NULL REFERENCES usuarios(id),
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (viaje_id, pasajero_id)
    );
  `);
  await sembrarUsuariosDePrueba();
}

// Usuarios de prueba con datos ficticios (para la revisión del docente).
const USUARIOS_DE_PRUEBA = [
  { nombre: 'Carla Conductora', email: 'conductor@ecoruta.test', password: 'Conductor123', rol: 'conductor' },
  { nombre: 'Pedro Pasajero', email: 'pasajero@ecoruta.test', password: 'Pasajero123', rol: 'pasajero' },
  { nombre: 'Rosa Pasajera', email: 'pasajero2@ecoruta.test', password: 'Pasajero123', rol: 'pasajero' },
];

async function sembrarUsuariosDePrueba() {
  for (const u of USUARIOS_DE_PRUEBA) {
    const hash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING`,
      [u.nombre, u.email, hash, u.rol]
    );
  }
}

module.exports = { pool, iniciarBaseDeDatos, USUARIOS_DE_PRUEBA };
