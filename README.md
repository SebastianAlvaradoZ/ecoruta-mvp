# EcoRuta — MVP

EcoRuta ayuda a estudiantes de Tecsup que viven en la misma zona a **viajar juntos y llegar a tiempo a clase**.

Un conductor publica un viaje con su zona de salida, hora de salida, hora estimada de llegada y cupos. Un pasajero busca viajes por zona y por la hora a la que necesita llegar, y reserva un cupo. El conductor ve exactamente quién va, sin el caos de coordinar por WhatsApp.

> Producto construido para la Evaluación de Recuperación — Caso EcoRuta (Construcción y Pruebas de Software, Tecsup 2026-2). Contiene **solo datos ficticios**.

## Propósito

En las entrevistas de Product Discovery, el dolor principal de los estudiantes fue el **tiempo**: no saber si llegarán a tiempo, esperar combis que no pasan y hacer trasbordos de noche. El outcome que persigue el producto es:

> Reducir en al menos 15 minutos el tiempo de traslado puerta a puerta de los estudiantes de Tecsup y aumentar el porcentaje que llega a tiempo a su primera clase.

## Funcionalidades del MVP

| Historia | Funcionalidad |
|---|---|
| H-01 | Registro con rol (conductor o pasajero) |
| H-02 | Iniciar y cerrar sesión |
| H-03 | El conductor publica un viaje (zona, fecha, hora de salida, hora de llegada, cupos) |
| H-04 | Lista de viajes próximos |
| H-05 | Filtro por zona y por hora a la que necesito llegar |
| H-06 | Reservar un cupo (sin reservas dobles) |
| H-07 | Un viaje lleno se marca como "Lleno" y no acepta más reservas |
| H-08 | El conductor ve la lista de pasajeros de su viaje |
| H-09 | Mis reservas y cancelar una reserva (libera el cupo) |

Fuera del MVP (en el backlog): H-10 cancelar viaje del conductor, H-11 perfil con carrera, H-12 calificaciones, H-13 aviso de retraso. Mapa en tiempo real, pagos integrados y reconocimiento facial fueron postergados o descartados con evidencia.

## Usuarios de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Conductor | conductor@ecoruta.test | Conductor123 |
| Pasajero | pasajero@ecoruta.test | Pasajero123 |
| Pasajero 2 | pasajero2@ecoruta.test | Pasajero123 |

Se crean automáticamente al iniciar la aplicación.

## Tecnologías

- Node.js 18+ y Express 5
- Vistas EJS (HTML generado en el servidor, sin instalar nada en el navegador)
- PostgreSQL (Neon) para los datos y las sesiones: **los datos se conservan aunque el servidor se reinicie**
- Despliegue en Render (HTTPS)

## Cómo ejecutarlo en tu computadora

Requisitos: Node.js 18 o superior y una base de datos PostgreSQL (local o en Neon).

```bash
git clone https://github.com/SebastianAlvaradoZ/ecoruta-mvp.git
cd ecoruta-mvp
npm install
```

Define las variables de entorno y arranca:

```bash
# Linux / macOS
export DATABASE_URL="postgresql://usuario:clave@host/base?sslmode=require"
export SESSION_SECRET="una-frase-larga-y-secreta"
npm start
```

```powershell
# Windows (PowerShell)
$env:DATABASE_URL="postgresql://usuario:clave@host/base?sslmode=require"
$env:SESSION_SECRET="una-frase-larga-y-secreta"
npm start
```

Abre http://localhost:3000. Las tablas se crean solas al arrancar.

## Variables de entorno

| Variable | Para qué sirve |
|---|---|
| `DATABASE_URL` | Cadena de conexión de PostgreSQL (Neon). **Nunca se sube al repositorio.** |
| `SESSION_SECRET` | Clave para firmar las sesiones. |
| `PORT` | Puerto (Render lo asigna solo). |

## Despliegue (Render + Neon)

1. En Neon, crea un proyecto y copia el *connection string*.
2. En Render: **New → Web Service** → conecta este repositorio.
3. Build command: `npm install` · Start command: `npm start`.
4. En **Environment** agrega `DATABASE_URL`, `SESSION_SECRET` y `NODE_VERSION=20`.
5. Publica. Render entrega una URL `https://...onrender.com`.

> En el plan gratuito, Render suspende el servicio tras 15 minutos sin tráfico: la primera visita puede tardar cerca de un minuto en responder.
