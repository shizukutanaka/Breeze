# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**Leer en otro idioma**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · Español (esta página) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · [Português (Brasil)](README-pt-BR.md) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Un mensajero cifrado: sin número de teléfono y sin registro.**
El contenido de una conversación solo lo pueden leer quien la envía y quien la recibe. Ni siquiera el servidor que la transporta en el camino puede leerlo.
Todas las funciones son gratuitas y no hay anuncios.

Esto no es una página web, es un software que se instala y se usa (Windows / Mac / Linux / Android / iPhone / navegador).

![Captura de pantalla de Breeze Messenger: la ventana principal justo después de crear una identidad](../images/screenshot.png)

## Para usarlo, lo alojas en tu propio servidor

Breeze no tiene «servidor de una empresa operadora». **Para usarlo, tú mismo preparas un lugar donde ejecutarlo (un servidor) y colocas Breeze allí. Esa es la forma oficial de usarlo.**

- Para el alojamiento basta el nivel gratuito. Funciona dentro del nivel gratuito de Cloudflare y no hace falta tarjeta de crédito. Los pasos están en la [guía de instalación en tu propio servidor](SELF_HOSTING-es.md) (puedes elegir otros idiomas desde el principio de la guía).
- Las aplicaciones (Windows / Mac / Linux / Android / iPhone) se obtienen en la [página de descargas](https://github.com/shizukutanaka/Breeze/releases/latest) y se usan conectadas a tu propio servidor.
- **Sobre la instalación de muestra (un aviso honesto)**: hay una muestra para comprobar el funcionamiento (https://breeze-469.pages.dev/). Lo que hay alojado es el mismo software, pero para un uso real utiliza tu propio servidor, por favor. La muestra puede cambiar o detenerse sin aviso. Lo que hayas instalado en tu propio servidor no se ve afectado si la muestra se detiene.

Para un uso detallado, consulta el [manual](MANUAL-es.md) (puedes elegir otros idiomas desde el principio del manual).

## Cómo se usa (3 pasos)

1. Abre el Breeze que alojaste en tu propio servidor (o la dirección que te haya indicado la persona que lo alojó) e introduce tu nombre. Con eso ya está todo listo (sin registro y sin número de teléfono). En ese momento se crea una «clave» dentro de tu dispositivo, y esa clave se convierte en tu identidad.
2. Entrega tu ID o tu código QR a la persona con la que quieres hablar.
3. Si la otra persona también tiene la aplicación abierta, os conectáis directamente y podéis hablar. Cuando no la tiene abierta, el mensaje queda, cifrado tal cual, en un «buzón» y se entrega cuando abra la aplicación. El servidor que transporta el buzón no puede leer el contenido. Una carta que no se entrega se elimina automáticamente en un máximo de 7 días.

## Promesas (lo que no haremos)

- **No mostramos anuncios.** Ni dentro de la aplicación ni en ningún sitio.
- **No rastreamos.** Nada de análisis de uso, mecanismos de publicidad ni venta de datos.
- **Quienes lo han creado no tienen los datos de los usuarios.** En el lado del servidor no existe ni siquiera una lista de cuentas. Tu identidad es solo la clave que está dentro de tu dispositivo.
- **Las conversaciones se cifran entre dispositivos.** El servidor solo maneja sobres que no puede leer.

También escribimos el alcance con honestidad. Para poder entregar los mensajes, el servidor guarda cosas durante un tiempo breve (sobres sin entregar durante un máximo de 7 días, señales de conexión durante 5 minutos, registros de direcciones y dispositivos durante 90 días, información de grupos y suscripciones a notificaciones durante 30 días. Todo se elimina automáticamente y el contenido no se puede leer). La copia de seguridad en la nube está desactivada al principio. Si lo alojas en tu propio servidor, también ese almacenamiento temporal queda bajo tu control.

## Un diseño para que usarlo con fines delictivos no salga rentable

Breeze está hecho para que quien lo use mal tenga que asumir costes y esfuerzo. No decimos que «haga imposible el delito». Es un diseño para que «no salga rentable».

- **No hay una base gratuita de la que aprovecharse.** Como no existe un servidor central gratuito, quien quiera usarlo mal tampoco tiene más remedio que preparar un alojamiento con una cuenta a su propio nombre y a su propio coste.
- **Enviar tiene un coste.** Cada envío exige un pequeño cálculo (prueba de trabajo) y hay límites de volumen establecidos. Enviar spam en masa no sale rentable.
- **Se pueden hacer denuncias que no se pueden negar.** Quien recibe puede denunciar la propia entrega recibida como prueba. Quien envió no puede escudarse en «yo no lo envié».
- **La facultad de detenerlo la tiene quien lo aloja.** Lo que ocurra en tu propio servidor lo puedes detener tú mismo. No necesitas el permiso de nadie.

## Lo que puede hacer

- Conversaciones individuales y conversaciones en grupo (hasta 1.000 personas)
- Llamadas de voz y videollamadas
- Envío de archivos (hasta 50MB en conversaciones individuales. En los grupos también se pueden enviar, pero el límite de tamaño es menor)
- Uso con varios dispositivos y varias cuentas (por ejemplo, trabajo y personal. Tanto el número de dispositivos como el de cuentas es gratuito e ilimitado)
- Se elige automáticamente entre 8 idiomas (inglés, japonés, coreano, chino (Taiwán), español, tailandés, indonesio y portugués)
- Perfiles con foto, pegatinas y compartir la ubicación
- Operaciones por comandos, como `/help` (más de 60 tipos)

## Diferencias con otros mensajeros

| | Breeze | Muchos mensajeros |
|---|--------|--------|
| Registro | No hace falta (la identidad es la clave dentro de tu dispositivo) | Hace falta un número de teléfono |
| Servidor | No puede leer el contenido | Se basa en confiar en la empresa operadora |
| Alojarlo en tu propio servidor | Es la premisa (es algo que se aloja y se usa) | No se puede |
| Publicación del interior | Todo es público (licencia MIT) | A menudo no es público |
| Dónde están los datos | Dentro de tu dispositivo | En los servidores de la empresa operadora |

La comparación detallada con Signal y LINE está en la [página de comparación (en inglés)](../COMPARISON.md). Cada afirmación de Breeze lleva adjunta una «forma de comprobarla», y también se escriben sin ocultar los puntos en los que Breeze sale perdiendo (el número de usuarios, no haber recibido una auditoría externa, etc.).

## El coste de alojarlo en tu propio servidor

Breeze funciona dentro del nivel gratuito de Cloudflare. No hace falta tarjeta de crédito.

| Concepto | Nivel gratuito | Si es de pago |
|-----------|-----------|-------------|
| Alojamiento | Cloudflare Pages (gratis) | — |
| Procesamiento | Hasta 100.000 veces al día | Hasta 10 millones de veces al mes |
| Almacenamiento | Al día, hasta 100.000 lecturas y 1.000 escrituras | Al mes, 10 millones de lecturas y 1 millón de escrituras |
| Retransmisión de llamadas | Gratis hasta 20GB | 0,05 dólares por 1GB |
| Dominio propio | No hace falta (incluye una dirección gratuita) | 10 dólares al año |
| **Total** | **0 dólares al mes** (hasta unas 20–40 personas con un uso ligero) | **Desde 5 dólares al mes** (unas 100 personas con un uso ligero. A una escala de 1.000 personas, entre 34 y 222 dólares al mes según el uso) |

Cómo crecen los costes a gran escala y «por qué un solo operador no tiene que cargar con el coste de todos» están en [la reflexión sobre costes y sostenibilidad (en inglés)](../SUSTAINABILITY.md); los cálculos en los que se basa están en el [modelo de costes (en inglés)](../COST_MODEL.md).

La instalación empieza con este único comando (los detalles están en la [guía de instalación en tu propio servidor](SELF_HOSTING-es.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Detalles técnicos (para desarrolladores)

### Métodos de cifrado

| Función | Método |
|-------|-----------|
| Intercambio de claves | X25519 (reserva: P-256) |
| Firma | Ed25519 (reserva: HMAC-SHA256) |
| Cifrado | AES-256-GCM |
| Derivación de claves | HKDF-SHA256 |
| Actualización de las claves de conversación | Double Ratchet (el mismo método que Signal) |
| Claves de grupo | Sender Key |
| Ocultar el remitente al retransmisor | Sealed Sender |

El documento oficial del diseño es la [especificación, SPEC.md](../../SPEC.md); el destino para informar de debilidades y la política están en [SECURITY.md](../../SECURITY.md).

### Pruebas y comprobaciones de calidad

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Participar en el desarrollo

La forma de trabajar y las normas están en [CONTRIBUTING.md](../../CONTRIBUTING.md).
Los informes de errores van a la [página de Issues](https://github.com/shizukutanaka/Breeze/issues). El código de conducta es [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server (Cloudflare's free tier is enough) and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [../COMPARISON.md](../COMPARISON.md).

## Licencia

MIT: como se indica en [LICENSE](../../LICENSE), puedes usarlo, corregirlo y distribuirlo libremente.
