# Activar Google para gestionar las reseñas con una cuenta

El código está preparado. `googleEnabled` permanece en `false` hasta configurar Google y el SQL; así el formulario actual sigue disponible mientras haces la configuración.

## 1. Crear el acceso de Google

1. Entra en https://console.cloud.google.com/ con tu cuenta y crea o selecciona un proyecto, por ejemplo `Neizan Photo 26`.
2. Abre **Google Auth Platform** y configura el nombre de la aplicación y los correos de contacto. Elige audiencia **External** para que puedan entrar tus clientes.
3. En **Clients → Create client**, selecciona **Web application**.
4. En **Authorized JavaScript origins**, añade `https://neizanphoto26.github.io`.
5. En **Authorized redirect URIs**, añade `https://ovfjrmwivvlwylnaakwl.supabase.co/auth/v1/callback`.
6. Guarda el **Client ID** y el **Client secret**. El secret se introduce únicamente en Supabase, nunca en esta carpeta, GitHub ni el chat.
7. Si el proyecto está en **Testing**, añade tu correo como usuario de prueba. Para que entren todos los clientes, cambia la audiencia a **In production** en Google cuando esté listo. Solicita solo los permisos básicos de inicio de sesión.

## 2. Activar Google en Supabase

1. Abre tu proyecto → **Authentication → Sign In / Providers → Google**.
2. Activa Google, pega el **Client ID** y **Client secret**, y guarda.
3. En **Authentication → URL Configuration**, establece **Site URL** en `https://neizanphoto26.github.io`.
4. En **Redirect URLs**, añade `https://neizanphoto26.github.io/Resenas.html`.
5. Para probar con Live Server, añade también la dirección exacta que uses, por ejemplo `http://127.0.0.1:5500/Resenas.html`. El acceso OAuth no funciona desde `file://`.

## 3. Actualizar la base de datos

En **SQL Editor** ejecuta, por orden, si todavía faltan:

1. `supabase/review-photos-and-delete.sql`.
2. `supabase/review-edit.sql`.
3. `supabase/review-google.sql`.

El último archivo conserva las reseñas existentes y añade su propietario mediante Supabase Auth. Publicar una reseña nueva requiere autenticación en el servidor. Leer reseñas sigue siendo público. El identificador de la cuenta y los códigos privados no se exponen en la lectura pública.

## 4. Activar el botón en la web

En `reviews-config.js`, cambia `googleEnabled: false` por `googleEnabled: true` y publica el archivo actualizado. También deben estar publicados `review-auth.js` y `vendor/supabase-2.117.3.js`.

Después, recarga la web con Ctrl + F5 y pulsa **Continuar con Google**. Publica una reseña nueva. Comprueba en otro navegador, iniciando sesión con la misma cuenta, que aparecen los botones de editar y eliminar. Con otra cuenta esos botones no deben aparecer.

El navegador conserva la sesión, pero puedes cerrar sesión y volver a entrar otro día: la propiedad reside en la base de datos, no en una pestaña. La renovación automática de la sesión no borra el texto que estés editando.

## Reseñas anteriores sin cuenta

Al iniciar sesión se intentan vincular las reseñas cuyos códigos privados conserve ese navegador. Si se perdió el código o la reseña se escribió desde otro origen (`file://`, Live Server, web publicada o incógnito), no se puede demostrar automáticamente quién la escribió. No se identifica al propietario solo por su nombre. Puedes retirar esas reseñas desde Supabase; si necesitas asignar una antigua, revisa su autor y vincula la fila a su ID de usuario desde el panel privado, sin cambiar los permisos públicos.

## Formulario de reserva

Vuelve a enviar directamente por POST a `https://formspree.io/f/xyzrnpar`, con la redirección de Formspree. El correo destinatario y la dirección de retorno se gestionan en el panel de Formspree. Si no llega el correo, revisa allí que el formulario siga activo, el destinatario esté confirmado y las notificaciones estén habilitadas. No se han enviado reservas de prueba automáticamente.

Documentación oficial: https://supabase.com/docs/guides/auth/social-login/auth-google y https://supabase.com/docs/guides/auth/redirect-urls.
