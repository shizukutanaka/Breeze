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
- Para usarlo en el navegador, se usa lo instalado en tu propio servidor (los pasos de instalación están en el documento aparte «Guía de instalación en tu propio servidor»)

Cada archivo incluye un valor de comprobación (SHA256SUMS.txt). Si te preocupa, puedes comprobar que el valor del archivo que descargaste coincide.

> **Sobre la página de prueba**: la página de prueba que estaba publicada (breeze.pages.dev) está actualmente detenida (al abrirla aparece un 404). Hasta que se restablezca, usa la versión de la aplicación, por favor. Lo instalado en tu propio servidor no se ve afectado por esta detención.

### Configuración inicial

1. Abre la aplicación.
2. Introduce tu nombre. Con eso ya está todo listo. Sin registro y sin número de teléfono.

En ese momento se crea una «clave» dentro de tu dispositivo. Esa es tu identidad misma.
**En el servidor no hay una lista de cuentas.** Tu identidad existe solo dentro de tu dispositivo.
Este punto será importante en el capítulo de la copia de seguridad (8).

### Sobre la «identidad desechable»

Si al crearla eliges «identidad desechable», obtendrás una identidad sin ningún medio de recuperación.
Si pierdes ese dispositivo, lo restableces o borras los datos del navegador, esa identidad no volverá nunca.
También se indica en la pantalla. No la elijas para una identidad que vayas a usar durante mucho tiempo.

---

## 2. Conectar con la otra persona

Hay tres formas de conectar con la persona con la que quieres hablar.

- **Entregar el ID**: comunica tu ID a la otra persona y haz que lo introduzca.
- **Código QR**: muestra el código QR de invitación y haz que la otra persona lo lea.
- **Enlace de invitación**: copia el mensaje de invitación desde «Invitar a un amigo» y envíalo por tu medio de contacto habitual (correo, etc.). Cuando la otra persona abra el enlace e introduzca su nombre, podréis hablar tal cual.

Si la otra persona también tiene la aplicación abierta, os conectáis directamente y podéis hablar.

---

## 3. Conversaciones

- Basta con escribir un mensaje y enviarlo. También se pueden enviar fotos, pegatinas e información de ubicación.
- **Envío de archivos**: hasta 50MB en las conversaciones individuales. En los grupos es menor, unos 50KB.
- Los archivos de formatos peligrosos, como los ejecutables, se bloquean automáticamente.
- Cuando la otra persona no tiene la aplicación abierta, el mensaje queda, cifrado tal cual, en un «buzón» y se entrega cuando la abra. El servidor que transporta el buzón no puede leer el contenido. Una carta que no se entrega se elimina automáticamente en un **máximo de 7 días**.
- El historial de conversaciones se puede exportar a un archivo e importar.

### Comandos

Si escribes `/help` en el campo de entrada, aparece la lista de comandos que puedes usar (más de 60 tipos).
Algunas operaciones, como los ajustes y la vinculación de dispositivos, se hacen desde los comandos.

---

## 4. Grupos

- En un grupo caben hasta **1.000 personas**.
- Para crearlo, basta con introducir un nombre de grupo. Las invitaciones se hacen desde el «enlace de invitación al grupo». Quien reciba el enlace puede unirse introduciendo su nombre.
- En los grupos también se pueden enviar archivos, pero el límite es menor, unos 50KB. Los mensajes de voz todavía no se pueden enviar en los grupos.
- Si hay un miembro que usa una versión antigua de la aplicación, en ese grupo no se puede usar el nuevo método más seguro (grupo v5) y aparece un aviso en la pantalla. Se activa cuando todos actualicen a la última versión.

---

## 5. Llamadas

- Se pueden hacer llamadas de voz y videollamadas individuales. También hay llamadas en grupo.
- **Código de confirmación de llamada**: en la pantalla de la llamada se muestra un código de confirmación. Leedlo entre ambos y comprobad que coincide en las dos pantallas. Si no coincide, es posible que alguien esté escuchando en el camino. En ese caso, cuelga la llamada.
- Es posible que una llamada en grupo no pueda iniciarse si la aplicación de todos no es la última versión.

---

## 6. Varios dispositivos y cuentas

- Para usar la misma identidad en varios dispositivos, vincula los dispositivos entre sí con el comando `/link`.
- Se pueden crear varias cuentas y usarlas por separado (por ejemplo, trabajo y personal). Tanto el número de dispositivos como el de cuentas es gratuito e ilimitado.
- **Cómo crear una cuenta**: abre Ajustes y toca el botón «Añadir cuenta» en la sección «Cuenta». Introduce un nombre y elige un emoji como icono, y se creará la nueva cuenta y se cambiará automáticamente a ella.
- **Cómo cambiar de cuenta**: cuando tienes dos o más cuentas, aparecen pestañas de cuenta en la parte superior de la lista de contactos. Toca una pestaña para cambiar (en un ordenador, también puedes usar Ctrl+1–9). Mantén pulsada una pestaña para cambiarle el nombre, cambiar su icono o eliminarla.
- Cada cuenta tiene sus propios contactos y claves. Intercambia los contactos por separado para cada cuenta.
- El idioma se elige automáticamente entre 8: inglés, japonés, coreano, chino (Taiwán), español, tailandés, indonesio y portugués (Brasil).

---

## 7. Ajustes para mantener la seguridad

- **Bloqueo automático**: hay un ajuste para bloquear automáticamente al cambiar de pestaña.
- **Frase de contraseña de la clave**: puedes proteger la clave dentro de tu dispositivo envolviéndola con una frase de contraseña. Se te pedirá introducirla al abrir la aplicación.
- **Bloqueo de contactos**: puedes bloquear a un contacto molesto. Los mensajes de un contacto bloqueado no te llegarán.

---

## 8. Copia de seguridad y recuperación (el capítulo más importante)

La identidad de Breeze es solo la clave dentro de tu dispositivo. En el servidor no hay una lista de cuentas, y quienes lo han creado tampoco tienen tu clave.
**Si pierdes tu dispositivo, también pierdes tu identidad.** Para una identidad importante, crea siempre una copia de seguridad.

### Cómo crear una copia de seguridad

1. Elige «Crear copia de seguridad».
2. Establece una frase de contraseña para la copia (6 caracteres o más).
3. Elige dónde guardarla.
   - **Guardar en un archivo**: conserva el archivo de la copia en tus manos (recomendado).
   - **Guardar en un servidor de retransmisión**: solo se puede usar cuando el operador de ese retransmisor lo tiene activado. En el retransmisor predeterminado no se puede usar. Tiene un plazo de conservación, así que recupérala antes de que venza.

El contenido de la copia de seguridad está cifrado. El servidor del destino solo maneja texto cifrado.

### Cómo recuperarla

En un dispositivo nuevo, restaura usando el archivo de la copia (o la copia del servidor de retransmisión) y la frase de contraseña que estableciste.

### Notas

- **Si olvidas la frase de contraseña, la recuperación es imposible.** Quienes lo han creado tampoco pueden arreglarlo. Apunta la frase de contraseña en otro lugar.
- **La identidad desechable no vuelve, ni con copia de seguridad ni con recuperación.**
- Rehace la copia de seguridad cuando aumenten tus identidades o cuando cambies de dispositivo.

---

## 9. El buzón y la idea de los costes

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

## 10. Cómo actualizar (versión de escritorio)

1. Cuando hay una versión nueva, aparece un aviso en la pantalla.
2. Al pulsar «Descargar», va a buscar la versión nueva (no se instala automáticamente).
3. Cuando termina la descarga, pulsa «Instalar» y reinicia.

Si algo falla durante la actualización (por ejemplo, la comprobación del archivo no coincide), **la actualización se detiene y el motivo se muestra en la pantalla**. No se puede volver a una versión antigua.

---

## 11. Cuando algo va mal

| Síntoma | Qué comprobar |
|---|---|
| No se puede enviar un mensaje | Comprueba que el reloj de tu dispositivo no esté desajustado. Si el reloj está desajustado, el envío falla. |
| No llega a la otra persona | Espera en el buzón hasta que la otra persona abra la aplicación (máximo 7 días). |
| No se puede enviar un archivo | Comprueba que no superes el límite de tamaño (50MB en individual, unos 50KB en grupos) y que no esté bloqueado como formato peligroso. |
| Los códigos de confirmación de la llamada no coinciden | Cuelga la llamada y vuelve a llamar. No continúes mientras no coincidan. |
| Olvidaste la frase de contraseña | La recuperación es imposible. Crea una identidad nueva y vuelve a avisar a tus contactos. |
| Perdiste tu dispositivo | Si tienes una copia de seguridad, puedes recuperar en un dispositivo nuevo. Si no, será una identidad nueva. |
| La página de prueba no se abre (404) | Actualmente está detenida. Usa la versión de la aplicación, por favor. |

Las notificaciones de errores van a la [página de Issues](https://github.com/shizukutanaka/Breeze/issues), por favor.

---

## 12. Las promesas de Breeze

- No mostramos anuncios. Ni dentro de la aplicación ni en ningún sitio.
- No rastreamos. Nada de análisis de uso, mecanismos de publicidad ni venta de datos.
- Quienes lo han creado no tienen los datos de los usuarios. En el lado del servidor no existe ni siquiera una lista de cuentas.
- Las conversaciones se cifran entre dispositivos. El servidor solo maneja sobres que no puede leer.

La comparación detallada con otros mensajeros está escrita en la «página de comparación» del repositorio, incluidos los puntos en los que Breeze sale perdiendo (el número de usuarios, no haber recibido una auditoría externa, etc.).

---

*Este manual corresponde al contenido en el momento de Breeze v3.8.0.*
