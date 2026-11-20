# Firebase y hosting gratuito

Altoke usa **Firebase Authentication** para iniciar sesión, y se aloja en
**Vercel (plan Hobby, gratis)**. Ambos servicios tienen un nivel gratuito
suficiente para uso personal.

## Qué es gratis y qué no

| Servicio | Plan | Uso en Altoke | Límite relevante |
|---|---|---|---|
| Firebase Authentication | Spark (gratis) | Registro, inicio de sesión, enlace mágico, cambio de contraseña | Autenticación por correo y contraseña sin coste; el correo de enlace mágico lo envía Firebase |
| Firebase Firestore | Spark (gratis) | Pendiente: la base de datos migra en la siguiente fase | 1 GiB, 50 000 lecturas y 20 000 escrituras al día |
| Vercel | Hobby (gratis) | Aloja la aplicación Next.js | Uso no comercial |
| Supabase | Free | Almacenamiento de archivos y tiempo real del mural (y la base, por ahora) | 1 GB de almacenamiento; el proyecto se pausa tras una semana sin uso |

Firebase Storage y Firebase Hosting con SSR exigen el plan Blaze (con tarjeta),
así que no se usan: los archivos siguen en Supabase Storage y la aplicación
va en Vercel.

## 1. Crear el proyecto de Firebase (manual, una vez)

1. Entra en [console.firebase.google.com](https://console.firebase.google.com) y crea un proyecto (plan Spark, sin tarjeta).
2. **Authentication > Sign-in method**: activa **Correo electrónico/contraseña**. Para el enlace mágico, activa también **Vínculo de correo electrónico (inicio de sesión sin contraseña)**.
3. **Authentication > Settings > Authorized domains**: añade `localhost` (ya viene) y el dominio de Vercel (por ejemplo `altoke-one.vercel.app`).
4. **Configuración del proyecto > General > Tus apps**: crea una app web. Copia `apiKey`, `authDomain`, `projectId` y `appId` a las variables `NEXT_PUBLIC_FIREBASE_*`. Son públicas: no son secretos.
5. **Configuración del proyecto > Cuentas de servicio**: genera una clave privada (JSON). Es un **secreto**: guárdalo solo en las variables del servidor (`FIREBASE_SERVICE_ACCOUNT_JSON`). Nunca lo subas al repositorio.

## 2. Variables en Vercel (manual)

En el proyecto de Vercel, **Settings > Environment Variables**, añade las de
`.env.example` (sección Firebase). `FIREBASE_SERVICE_ACCOUNT_JSON` debe marcarse
como secreta. Vuelve a desplegar después de cambiarlas.

## 3. Desarrollo local con el emulador (sin cuenta)

```bash
npm run emulators            # Auth y Firestore locales en 127.0.0.1:9099 y :8080
```

En `.env.local` define:

```
NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL="http://127.0.0.1:9099"
FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
FIREBASE_PROJECT_ID="altoke-local"
```

Las pruebas corren contra el emulador con `npm run test:emulators`
(que levanta el emulador, ejecuta `vitest` y lo cierra).

## 4. Cómo funciona la sesión

- El navegador inicia sesión con el SDK de Firebase y obtiene un **ID token**.
- Lo envía a `POST /api/auth/session`, que lo verifica y crea una **cookie de
  sesión** de Firebase (`altoke_session`, httpOnly, 5 días).
- Cada petición verifica esa cookie en el servidor con `firebase-admin`
  (`lib/auth.ts`). El middleware solo comprueba que la cookie exista.
- `DELETE /api/auth/session` borra la cookie al cerrar sesión.

## 5. Invitaciones

Firebase no envía correos de invitación en el plan gratuito. Altoke genera un
enlace (`/invite/<token>`) que se comparte por cualquier medio. Quien lo abre
se registra o entra con su correo y acepta la invitación.

## Pendiente

La base de datos sigue en Postgres. La migración a Firestore (111 archivos que
usan Prisma) se hace por dominios, detrás de las mismas pruebas.
