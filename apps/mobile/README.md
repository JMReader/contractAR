# App de O4 — presentación móvil

Copia integrada de la app React Native/Expo original de `o4-app-rn`, con login, acuerdos, chat/formulario, saldo y ficha.

```sh
pnpm --filter mobile exec tsc --noEmit
pnpm --filter mobile exec eslint src
EXPO_PUBLIC_PRESENTATION=true EXPO_PUBLIC_API_URL='' pnpm --filter mobile run web:export
pnpm --filter mobile run web:serve
```

Con `EXPO_PUBLIC_PRESENTATION=true`, las pantallas existentes consumen un adaptador local: login, acuerdos, carga/rechazo de pagos, depósito, propuesta, disputa y cierre simulados. Los datos persisten en el navegador. El enlace comparte una copia del acuerdo: después de avanzar hay que compartir el enlace actualizado. IA/Kleros son selecciones de presentación, sin ejecución externa. El panel de roles permite recorrer ambas partes y el árbitro en un teléfono.

Sin esa variable se conserva el cliente API original y `EXPO_PUBLIC_API_URL` configura el servidor. La landing O3 no se modifica.
