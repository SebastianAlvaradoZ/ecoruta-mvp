// Punto de entrada: prepara la base de datos y levanta el servidor.
const { app } = require('./app');
const { iniciarBaseDeDatos } = require('./db');

// El puerto lo asigna la plataforma (Render usa la variable PORT).
const PORT = process.env.PORT || 3000;

iniciarBaseDeDatos()
  .then(() => {
    app.listen(PORT, () => console.log(`EcoRuta escuchando en el puerto ${PORT}`));
  })
  .catch((err) => {
    console.error('No se pudo conectar a la base de datos:', err.message);
    process.exit(1);
  });
