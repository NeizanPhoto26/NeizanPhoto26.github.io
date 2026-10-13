# Activar las reseñas de Neizan Photo 26

La web ya incluye estrellas, nombre, comentario, tres reseñas recientes en la portada y una página para consultar todas y publicación inmediata. Son reseñas propias de la web: no están conectadas a Google ni verifican la identidad de quien escribe. No se pide crear una cuenta.

La portada muestra las **tres últimas reseñas**. `Resenas.html` muestra todas con tarjetas grandes y carga de nueve en nueve mediante «Ver más reseñas». El botón «Eliminar mi reseña» solo aparece si el navegador conserva el código de la reseña. Incluye `Resenas.html` al publicar los cambios en GitHub Pages.

## Si ya tienes el proyecto conectado

Para que la propiedad de las reseñas siga a una cuenta de Google y funcione otro día o desde otro dispositivo, sigue `GOOGLE-RESEÑAS.md`. Hace falta activar Google en Supabase y ejecutar `supabase/review-google.sql`. La integración está preparada pero el proveedor no se puede activar con la clave pública de la web.

### Edición de reseñas

Ejecuta `supabase/review-edit.sql` completo en SQL Editor después de la actualización de fotos. El botón «Editar mi reseña» aparece junto al de eliminación solo para el navegador que conserva el código privado. Permite cambiar nombre, valoración, comentario y fotos. Las fotos nuevas se añaden a las actuales y cada foto tiene su botón «Quitar foto». El máximo es tres fotos en total; superar el límite muestra un aviso y conserva las fotos existentes. La función valida el código del autor en el servidor y mantiene el estado de visibilidad que haya establecido el administrador.

`site-ui.js` debe publicarse junto a los otros archivos: añade el menú compartido y los avisos de éxito. El aviso de reserva solo aparece cuando Formspree confirma el envío. No confirma una fecha reservada.

### Actualización: fotos y botón directo de eliminación

Ejecuta **todo `supabase/review-photos-and-delete.sql`** en SQL Editor. Es suficiente para activar la versión actual en el proyecto ya creado, incluso si no ejecutaste la migración anterior de enlaces privados. Luego recarga la web con **Ctrl + F5**.

El cliente verá «Eliminar mi reseña» en su tarjeta, sin copiar enlaces. Debe usar el mismo navegador y conservar sus datos locales. Sin cuenta no es posible reconocerlo automáticamente en otro dispositivo; si pierde los datos locales, puede pedirte la retirada. Las reseñas antiguas sin código de propiedad se gestionan desde Supabase.

Las reseñas permiten hasta tres fotos JPG, PNG o WebP de 15 MB cada una. El navegador las convierte a JPEG con un máximo de 960 píxeles y aproximadamente 120 KB por foto. Se guardan en la misma base de datos, como datos JPEG, sin crear buckets. La lista descarga solo el número de fotos; las imágenes se consultan al pulsar «Ver fotos». Al borrar la reseña se borran sus fotos. Las fotos cuentan contra el límite gratuito de la base de datos: revisa el uso en Supabase si crece el volumen.

Comprueba con una reseña nueva: enviar texto y una foto, abrir «Ver fotos», ampliar la imagen, pulsar «Eliminar mi reseña» y confirmar. La tarjeta y la valoración deben actualizarse. Desde una ventana de incógnito, otro visitante debe poder leerla pero no ver su botón de eliminación.

Las instrucciones antiguas sobre copiar un enlace ya no son necesarias para los clientes.

Para activar los enlaces privados de eliminación, ejecuta **todo `supabase/review-owner-links.sql`** en SQL Editor. Recarga la web con Ctrl + F5. Este archivo conserva las reseñas existentes. Para una instalación nueva, `supabase/reviews.sql` ya incluye esa actualización al final.

El nuevo envío utiliza la función `submit_review` y la eliminación `delete_own_review`. Los visitantes no tienen permiso directo de INSERT, UPDATE ni DELETE en la tabla. El código privado se genera en el navegador y la base de datos solo guarda su hash SHA-256, sin permisos de lectura pública sobre ese campo.

Después de publicar una reseña nueva, guarda su enlace privado. En el mismo navegador aparece «Eliminar mi reseña»; desde otro navegador usa el enlace. El enlace abre una confirmación: no borra nada automáticamente. Las reseñas antiguas no tienen enlace; se gestionan desde Supabase. Hasta ejecutar esta migración, el nuevo formulario no podrá enviar reseñas.

Ejecuta el archivo supabase/publish-reviews-immediately.sql en SQL Editor y recarga la web. Esto publica inmediatamente las reseñas nuevas, sin cambiar las antiguas ni las ocultadas. Puedes retirarlas desde Table Editor poniendo approved en false.

## 1. Crear la base de datos gratuita

1. Entra en https://supabase.com y crea una cuenta.
2. Crea una organización en el plan **Free** y un **New project**, por ejemplo `neizanphoto-reviews`.
3. Elige una región de la Unión Europea disponible y una contraseña fuerte para la base de datos. Guarda la contraseña en tu gestor de contraseñas, nunca en esta carpeta.
4. Espera a que termine la creación del proyecto.

El plan gratuito tiene límites y los proyectos gratuitos pueden pausarse por inactividad. Consulta las condiciones actuales en https://supabase.com/pricing. No hace falta subir fotos ni vídeos a Supabase: esta base de datos guarda solo reseñas.

## 2. Crear la tabla y sus permisos

1. En el proyecto, abre **SQL Editor** y una consulta nueva.
2. Copia todo el contenido de `supabase/reviews.sql` de esta carpeta.
3. Pulsa **Run**. El archivo crea la tabla `reviews` y los permisos.

Los visitantes envían nombre, estrellas, comentario y consentimiento mediante una función. La publicación inicial y la fecha las asigna la base de datos. Solo pueden leer las reseñas visibles; solo pueden borrar una reseña mediante su código privado. No pueden editar ni cambiar la visibilidad. No desactives **RLS** ni añadas políticas que permitan leer todas las filas.

## 3. Conectar tu web

1. En Supabase, abre **Connect** para obtener la **Project URL**. También puedes encontrarla en la configuración **Data API**.
2. En **Settings → API Keys**, copia la clave **publishable**, que empieza por `sb_publishable_`.
3. Abre `reviews-config.js` y rellena los dos valores:

```js
window.REVIEWS_CONFIG = Object.freeze({
    supabaseUrl: 'https://TU-PROYECTO.supabase.co',
    publishableKey: 'sb_publishable_TU_CLAVE_PUBLICA'
});
```

Estos dos datos son públicos y se pueden incluir en GitHub Pages. **Nunca uses una clave `sb_secret_`, `service_role`, la contraseña de la base de datos ni un token personal.** Los permisos del SQL protegen los datos, no el secreto de la clave pública.

4. Publica los archivos de la web como haces normalmente en GitHub Pages. Incluye `reviews.js` y `reviews-config.js` junto a `index.html` y `Style.css`. `reviews.sql` es para ejecutar en Supabase, no desde el navegador.
5. Recarga la web. Hasta configurar los valores, el formulario aparece desactivado y muestra que todavía no está disponible.

## 4. Retirar o eliminar reseñas

1. Abre **Table Editor → reviews** en Supabase.
2. Las nuevas reseñas aparecen con `approved = true` y se muestran inmediatamente.
3. Para volver a mostrar una reseña ocultada, cambia **approved** a **true** y guarda.
4. Para ocultarla, vuelve a **false**. Para retirar sus datos, elimina la fila.

No hay contraseña de administrador en la web. Gestionas las reseñas desde tu cuenta privada de Supabase. Revisa tanto las opiniones positivas como las negativas con los mismos criterios; rechaza spam, datos personales de terceros y mensajes que no correspondan a una experiencia real.

## 5. Comprobar antes de anunciarlo

1. Envía una reseña de prueba desde la web. Debe confirmar la publicación y mostrar la reseña sin recargar.
2. Comprueba en Supabase que `approved` es **true**.
3. Recarga la web en otra pestaña: ya debe aparecer.
4. Comprueba la tarjeta y la media.
5. Ocúltala de nuevo y comprueba que desaparece. Elimina la prueba al terminar.
6. Comprueba el formulario en el móvil y con el teclado: puedes elegir las estrellas con las flechas.
7. Envía otra prueba y copia su enlace privado. Ábrelo en una ventana de incógnito: la reseña debe seguir visible hasta que pulses «Eliminar mi reseña». Confirma y comprueba que desaparece y se actualiza la media.
8. Comprueba que otra reseña sigue intacta y que el público no puede leer `delete_token_hash`. El archivo `supabase/test-review-owner-links.sql` permite comprobar los permisos y la eliminación sin dejar datos, ya que termina con ROLLBACK.

La web incluye validación, un campo señuelo para bots simples y moderación. Esto **no es un límite de solicitudes del servidor**: alguien que use directamente la API pública podría mandar spam público. Si ocurre, será necesario canalizar los envíos mediante una Edge Function con CAPTCHA y límites de solicitudes; no basta con añadir un CAPTCHA visual al formulario. No se cargan scripts externos ni un SDK de Supabase para esta integración.

## Si algo falla

- **No se activa el botón:** comprueba la URL `https://…supabase.co` y que la clave empieza por `sb_publishable_`.
- **No guarda:** ejecuta el SQL completo y verifica la clave pública. No desactives RLS para solucionarlo.
- **No aparece la reseña:** comprueba que `approved` está en **true** y recarga.
- **Proyecto pausado:** abre Supabase y restaura el proyecto.

Documentación: https://supabase.com/docs/guides/getting-started/api-keys y https://supabase.com/docs/guides/database/postgres/row-level-security.
