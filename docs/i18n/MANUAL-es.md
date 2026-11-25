# Manual de Breeze

**Leer en otro idioma**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · Español (esta página) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · [Português (Brasil)](MANUAL-pt-BR.md) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze es un mensajero cifrado sin número de teléfono y sin registro.
El contenido de una conversación solo lo pueden leer quien la envía y quien la recibe. Ni siquiera el servidor que la transporta en el camino puede leerlo.
Todas las funciones son gratuitas y no hay anuncios.

Este manual es una guía para quienes empiezan a usarlo.

---

## 1. Cómo empezar

### Obtener la aplicación

Elige en la [página de descargas](https://github.com/shizukutanaka/Breeze/releases/latest) el archivo que corresponde a tu máquina.

- Windows: el que tiene un nombre que termina en `-win-x64.exe` (también los hay para máquinas ARM)
- Mac: el que tiene un nombre que termina en `-mac.dmg`
- Linux: `.AppImage` (se puede ejecutar tal cual) o `.deb`
- Para usarlo en el navegador, se usa lo instalado en tu propio servidor (los pasos de instalación están en el documento aparte «Guía de instalación en tu propio servidor»). La instalación estándar usa Cloudflare, así que se requiere una cuenta de Cloudflare

Cada archivo incluye un valor de comprobación (SHA256SUMS.txt). Si te preocupa, puedes comprobar que el valor del archivo que descargaste coincide.

> **Sobre la página de prueba**: se ofrece una página de prueba para comprobar cómo funciona (https://breeze-469.pages.dev/). Lo que está alojado allí es el mismo software, pero la página de prueba puede cambiar o detenerse sin aviso. Para un uso real, usa lo instalado en tu propio servidor, por favor. Lo instalado en tu propio servidor no se ve afectado si la página de prueba se detiene.

### Configuración inicial

1. Abre la aplicación.
2. Pulsa «Empezar con un ID aleatorio». Con eso ya está todo listo. Sin registro y sin número de teléfono.

- Si introduces «Tu nombre (nombre visible)» en el campo encima del botón, empiezas con ese nombre. También puedes pulsar el botón con el campo vacío. Puedes cambiar el nombre visible más tarde, en la sección de perfil de los ajustes.
- También hay una forma de crear una identidad con un nombre y un ID de Breeze que eliges tú mismo. En ese caso, se emite una frase de recuperación y se muestra en la pantalla. La frase de recuperación son las palabras que te permiten recuperar esa identidad en otro dispositivo. Apúntala en papel o en un lugar seguro.
- Si quieres recuperar una identidad que creaste antes, abre «Restaurar una cuenta existente» y aparecerán los métodos de recuperación (restaurar desde un archivo de copia de seguridad, recuperar con una frase de recuperación, restaurar con cuenta + contraseña).
- Cuando termina la creación, aparece una tarjeta que te guía para proteger tu clave con una frase de contraseña (no desaparece al cabo de un tiempo). Para una identidad importante, sigue la guía y añade la protección.

En ese momento se crea una «clave» dentro de tu dispositivo. Esa es tu identidad misma.
**En el servidor no hay una lista de cuentas.** Tu identidad existe solo dentro de tu dispositivo.
Este punto será importante en el capítulo de la copia de seguridad (9).

### Sobre la antigua «identidad desechable»

La «identidad desechable» — una identidad sin ningún medio de recuperación — ya no existe. Con las formas actuales de crear una identidad, toda identidad puede protegerse con una copia de seguridad.

---

## 2. Conectar con la otra persona

Pulsa el botón «Añadir amigo» en la pantalla de contactos y aparecerán tres opciones.

- **Añadir un contacto**: introduce el ID de la otra persona, o lee un código QR.
- **Invitar a un amigo**: copia el enlace de invitación y envíalo por tu medio de contacto habitual (correo, etc.). Cuando la otra persona abra el enlace e introduzca su nombre, podréis hablar tal cual.
- **Crear un grupo**: basta con introducir un nombre de grupo para crearlo (capítulo 4).

Tu propio ID se muestra en su forma completa cuando abres tu propio perfil, y puedes copiarlo tal cual. Puedes entregar el ID completo, no solo el ID corto.

Si la otra persona también tiene la aplicación abierta, os conectáis directamente y podéis hablar.

---

## 3. Conversaciones

- Basta con escribir un mensaje y enviarlo. También se pueden enviar fotos, pegatinas e información de ubicación.
- Abre el «+» junto al campo de entrada y aparecerán juntos los archivos adjuntos, los mensajes de voz, la entrada de voz, la información de ubicación, las pegatinas, el ajuste de «no hace falta responder» y más.
- **Envío de archivos**: hasta 50MB en las conversaciones individuales. En los grupos es menor, unos 50KB.
- Los archivos de formatos peligrosos, como los ejecutables, se bloquean automáticamente.
- Cuando la otra persona no tiene la aplicación abierta, el mensaje queda, cifrado tal cual, en un «buzón» y se entrega cuando la abra. El servidor que transporta el buzón no puede leer el contenido. Una carta que no se entrega se elimina automáticamente en un **máximo de 7 días**.
- El historial de conversaciones se puede exportar a un archivo e importar.

### Cómo leer la pantalla

- **Estado de envío**: se puede saber por la marca junto a un mensaje. ✓ significa enviado, un ✓ dentro de un círculo significa que se ha depositado en el buzón, ✓✓ significa que llegó a la otra persona, leído es una marca azul y el fallo es una marca roja. Se distinguen por la forma además de por el color.
- **La lista de contactos**: la hora de la última conversación se muestra como la hora para hoy, «Ayer» para ayer, mes/día para este año y año/mes/día para cualquier fecha anterior. Los contactos con mensajes que no has leído tienen el nombre y la hora destacados.
- **Nombres para los contactos**: abre «Información del contacto» (en el menú contextual de un contacto, o en el menú «⋮» de la conversación) y podrás poner tu propio nombre para ese contacto (un apodo). Los apodos se guardan solo en este dispositivo y nunca se envían al contacto ni al servidor de retransmisión. Cuando pones un apodo, el nombre que el contacto se puso a sí mismo también se muestra junto a él en un color atenuado. Puedes desactivar ese segundo nombre con «Mostrar también el nombre que cada contacto se puso a sí mismo» en la sección «Privacidad» de los ajustes.
- **Tu propia tarjeta**: en la parte superior de la lista está tu tarjeta de perfil; púlsala para abrir tu perfil. Se desplaza junto con la lista.
- **Pestañas inferiores en un teléfono**: con el ancho de un teléfono, en la parte inferior de la pantalla aparecen las pestañas «Contactos» y «Ajustes».
- **La cabecera de la conversación**: desde el icono de búsqueda puedes buscar dentro de la conversación. Desde el menú «⋮» puedes comprobar el número de seguridad, silenciar las notificaciones, fijar, crear una encuesta y más.

### Comandos

Escribe `/` en el campo de entrada y aparecerán sugerencias de comandos. Escribe `/help` para ver la lista de comandos que puedes usar (71 tipos).
Algunas operaciones, como los ajustes y la vinculación de dispositivos, se hacen desde los comandos.

---

## 4. Grupos

- En un grupo caben hasta **1.000 personas**.
- Para crearlo, basta con introducir un nombre de grupo en «Crear un grupo», dentro de «Añadir amigo» (también puedes crearlo con el comando `/newgroup`). Las invitaciones se hacen desde el «enlace de invitación al grupo». Quien reciba el enlace puede unirse introduciendo su nombre.
- En los grupos también se pueden enviar archivos, pero el límite es menor, unos 50KB. Los mensajes de voz todavía no se pueden enviar en los grupos.
- Si hay un miembro que usa una versión antigua de la aplicación, en ese grupo no se puede usar el nuevo método más seguro (grupo v5) y aparece un aviso en la pantalla. Se activa cuando todos actualicen a la última versión.

---

## 5. Llamadas

- Se pueden hacer llamadas de voz y videollamadas individuales. También hay llamadas en grupo (hasta 8 personas).
- **Código de confirmación de llamada**: en la pantalla de la llamada se muestra un código de confirmación. Leedlo entre ambos y comprobad que coincide en las dos pantallas. Si no coincide, es posible que alguien esté escuchando en el camino. En ese caso, cuelga la llamada.
- Es posible que una llamada en grupo no pueda iniciarse si la aplicación de todos no es la última versión.

---

## 6. Varios dispositivos y cuentas

- Para usar la misma identidad en varios dispositivos, vincula los dispositivos entre sí con el comando `/link`.
- Se pueden crear varias cuentas y usarlas por separado (por ejemplo, trabajo y personal). Tanto el número de dispositivos como el de cuentas es gratuito e ilimitado.
- **Cómo crear una cuenta**: pulsa el botón «+» junto a las pestañas de cuentas, en la parte superior de la lista de contactos. Introduce un nombre y elige un emoji de icono, y se creará una cuenta nueva y se cambiará a ella automáticamente.
- **Cambiar de cuenta**: las pestañas de cuentas se muestran siempre en la parte superior de la lista de contactos. Pulsa una para cambiar (en un ordenador también puedes cambiar con Ctrl+1–9). Mantén pulsada una pestaña para cambiarle el nombre, cambiar su icono o eliminarla.
- Los contactos y las claves están separados por cada cuenta. Intercambia los contactos de nuevo en cada cuenta.
- El idioma se elige automáticamente entre 51 idiomas, incluido el inglés, según el idioma de tu dispositivo.

---

## 7. Ajustes para mantener la seguridad

Los ajustes se abren como su propia pantalla. En un teléfono, ábrelos desde la pestaña «Ajustes» en la parte inferior de la pantalla; en un ordenador, desde el botón de engranaje de la pantalla (también puedes abrirlos con el comando `/settings`). Usa la acción de volver para regresar a la pantalla en la que estabas.

- **Bloqueo automático**: hay un ajuste para bloquear automáticamente al cambiar de pestaña.
- **Frase de contraseña de la clave**: puedes proteger la clave dentro de tu dispositivo envolviéndola con una frase de contraseña. Se te pedirá introducirla al abrir la aplicación.
- **Mostrar también el nombre que cada contacto se puso a sí mismo**: en la sección «Privacidad». Para un contacto al que le has puesto un apodo, puedes elegir si su propio nombre se muestra junto a él (capítulo 3).
- **Bloqueo de contactos**: puedes bloquear a un contacto molesto. Los mensajes de un contacto bloqueado no te llegarán.

---

## 8. Batería y emergencias (modos de energía)

En el ajuste «Modo de energía» puedes elegir cómo se usa la batería.

- **Automático (nivel de batería)**: cambia automáticamente según la batería que quede.
- **Normal**: como siempre.
- **Ahorro de energía**: espacia las comprobaciones de recepción hasta un máximo de una vez cada 60 segundos y detiene la señal de presencia.
- **Emergencia (para desastres)**: espacia las comprobaciones de recepción hasta un máximo de una vez cada 10 minutos. Úsalo en un desastre u otro momento en el que no puedas recargar.

Lo que gasta la batería no es la cantidad de comunicación, sino el número de veces que se despierta la radio. Por eso el lado que envía no se espacia; solo el que escucha. El envío sigue saliendo de inmediato, como siempre. Cuando empiezas a cargar, vuelve automáticamente un paso hacia el lado más ligero.

En los dispositivos que no pueden leer el nivel de batería automáticamente (como un navegador de iPhone), «Automático» se comporta como Normal, y una elección manual funciona tal como se eligió.

---

## 9. Copia de seguridad y recuperación (el capítulo más importante)

La identidad de Breeze es solo la clave dentro de tu dispositivo. En el servidor no hay una lista de cuentas, y quienes lo han creado tampoco tienen tu clave.
**Si pierdes tu dispositivo, también pierdes tu identidad.** Para una identidad importante, crea siempre una copia de seguridad.

La copia de seguridad y la recuperación se hacen desde la sección «Copia de seguridad y restauración» de los ajustes (los botones son «Crear copia», «Restaurar copia» y «📂 Restaurar desde archivo»). La primera vez que añades un contacto, aparece una sola vez una tarjeta que te insta a hacer una copia de seguridad.

### Copia de seguridad automática

El ajuste «Copia de seguridad automática» está activado desde el principio. Cuando tus datos cambian, una copia cifrada se envía automáticamente al servidor de retransmisión que alojas.

- No envía con cada cambio: espera 30 segundos tras el último cambio y lo envía todo junto. Los intentos se espacian al menos 15 minutos.
- Mientras estás sin conexión, no se envía nada; los cambios se guardan y se envían cuando vuelve la conexión y cuando abres la aplicación.
- Para el envío automático, necesitas introducir la frase de contraseña de la copia una vez en ese dispositivo (cuando hace falta, aparece un botón «Introducir frase de contraseña» en la sección de ajustes). **La frase de contraseña no se guarda.** Solo se recuerda mientras la aplicación está abierta, y desaparece cuando la cierras. Para una identidad de recuperación sencilla, justo después de introducir la frase de contraseña al registrarte o actualizarla, el envío funciona tal cual.
- Si el servidor de retransmisión no admite guardar copias, la copia automática no funciona. Eso se muestra en la sección de ajustes.
- El estado (cuándo fue el último envío correcto, si hay cambios esperando, si un envío falló) se muestra en la sección de ajustes.

### Cómo crear una copia de seguridad (manual)

1. Desde «Copia de seguridad y recuperación» en los ajustes, elige «Crear copia».
2. Establece una frase de contraseña para la copia (6 caracteres o más).
3. Elige dónde guardarla.
   - **Guardar en un archivo**: conserva el archivo de la copia en tus manos (recomendado).
   - **Guardar en un servidor de retransmisión**: solo se puede usar cuando el operador de ese retransmisor lo tiene activado. En el retransmisor predeterminado no se puede usar. Tiene un plazo de conservación, así que recupérala antes de que venza.

El contenido de la copia de seguridad está cifrado. El servidor del destino solo maneja texto cifrado.

### Cómo recuperarla

En un dispositivo nuevo, restaura usando el archivo de la copia (o la copia del servidor de retransmisión) y la frase de contraseña que estableciste.

Si acabas de recuperar tu identidad con una frase de recuperación y hay una copia de esa identidad en el servidor de retransmisión, se encuentra automáticamente y se te pregunta con «Copia encontrada». Si la restauras, los datos de este dispositivo se sustituyen por el contenido de la copia.

### Pasar a un dispositivo nuevo

Pulsa el botón «Pasar a un dispositivo nuevo» en la sección «Copia de seguridad y restauración» de los ajustes y se mostrarán los pasos.

1. En tu dispositivo actual, guarda una copia en el servidor de retransmisión (copia de seguridad automática, o «Crear copia»).
2. En el dispositivo nuevo, elige un método de restauración en la primera pantalla e introduce tu frase de recuperación (o tu nombre de cuenta y tu contraseña).
3. Cuando tu identidad esté de vuelta, la copia del servidor se encuentra automáticamente y se te ofrece restaurarla.

No hacen falta cables ni pasar archivos.

### Notas

- **Si olvidas la frase de contraseña, la recuperación es imposible.** Quienes lo han creado tampoco pueden arreglarlo. Apunta la frase de contraseña en otro lugar.
- Introducir la frase de contraseña para la copia automática es necesario en cada dispositivo. En un dispositivo nuevo, introdúcela una vez más.
- Rehace manualmente la copia de seguridad cuando aumenten tus identidades o cuando cambies de dispositivo.

---

## 10. El buzón y la idea de los costes

- Las cartas para cuando la otra persona está sin conexión quedan, cifradas tal cual, en el «buzón» del servidor de retransmisión (máximo 7 días).
- El retransmisor tiene límites para evitar abusos (la cantidad y la frecuencia que se pueden depositar). Cuando se alcanza el límite, durante ese periodo no se pueden depositar cartas nuevas, pero **las cartas ya entregadas nunca desaparecen**. En la pantalla se muestran el motivo y el tiempo de espera.
- Si lo alojas en tu propio servidor, los límites los decides tú.

Alcance de los registros que quedan en el lado del servidor (todos se eliminan automáticamente y el contenido no se puede leer):

| Cosa | Periodo que permanece |
|---|---|
| Cartas sin entregar | Máximo 7 días |
| Señales de conexión | 5 minutos |
| Registros de direcciones y dispositivos | 90 días |
| Información de grupos y suscripciones a notificaciones | 30 días |

---

## 11. Cómo actualizar (versión de escritorio)

1. Cuando hay una versión nueva, aparece un aviso en la pantalla.
2. Al pulsar «Descargar», va a buscar la versión nueva (no se instala automáticamente).
3. Cuando termina la descarga, pulsa «Instalar» y reinicia.

Si algo falla durante la actualización (por ejemplo, la comprobación del archivo no coincide), **la actualización se detiene y el motivo se muestra en la pantalla**. No se puede volver a una versión antigua.

---

## 12. Cuando algo va mal

| Síntoma | Qué comprobar |
|---|---|
| No se puede enviar un mensaje | Comprueba que el reloj de tu dispositivo no esté desajustado. Si el reloj está desajustado, el envío falla. |
| No llega a la otra persona | Espera en el buzón hasta que la otra persona abra la aplicación (máximo 7 días). |
| No se puede enviar un archivo | Comprueba que no superes el límite de tamaño (50MB en individual, unos 50KB en grupos) y que no esté bloqueado como formato peligroso. |
| Los códigos de confirmación de la llamada no coinciden | Cuelga la llamada y vuelve a llamar. No continúes mientras no coincidan. |
| Olvidaste la frase de contraseña | La recuperación es imposible. Crea una identidad nueva y vuelve a avisar a tus contactos. |
| Perdiste tu dispositivo | Si tienes una copia de seguridad, puedes recuperar en un dispositivo nuevo. Si no, será una identidad nueva. |
| La página de prueba no se abre | La página de prueba puede detenerse sin aviso. Usa lo instalado en tu propio servidor, por favor. |

Las notificaciones de errores van a la [página de Issues](https://github.com/shizukutanaka/Breeze/issues), por favor.

---

## 13. Las promesas de Breeze

- No mostramos anuncios. Ni dentro de la aplicación ni en ningún sitio.
- No rastreamos. Nada de análisis de uso, mecanismos de publicidad ni venta de datos.
- Quienes lo han creado no tienen los datos de los usuarios. En el lado del servidor no existe ni siquiera una lista de cuentas.
- Las conversaciones se cifran entre dispositivos. El servidor solo maneja sobres que no puede leer.

La comparación detallada con otros mensajeros está escrita en la «página de comparación» del repositorio, incluidos los puntos en los que Breeze sale perdiendo (el número de usuarios, no haber recibido una auditoría externa, etc.).

---

*Este manual refleja el estado de Breeze a fecha de 2026-11-25.*
