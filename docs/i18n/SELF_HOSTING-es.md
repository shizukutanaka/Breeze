# Guía de instalación en tu propio servidor

**Leer en otro idioma**: [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · Español (esta página) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · [Português (Brasil)](SELF_HOSTING-pt-BR.md) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)

> **Antes de empezar: la instalación estándar necesita una cuenta de Cloudflare.**
> La instalación estándar de esta guía — el despliegue en Cloudflare
> que sigue — funciona en Cloudflare, así que ten lista una cuenta
> de Cloudflare antes de empezar. Si no quieres usar Cloudflare,
> las instalaciones con Docker y con Node directamente de esta guía no necesitan
> una cuenta de Cloudflare.

Hay dos formas de ejecutar un retransmisor de Breeze:

1. **Autoalojado (Node + Docker)**: el retransmisor en tu propia máquina o
   VPS: un contenedor, un volumen de datos, registro cerrado por
   defecto. Empieza aquí si el retransmisor es para ti y tu gente.
2. **Cloudflare**: el despliegue estilo oficial en el nivel gratuito
   de Cloudflare (el retransmisor que el propio Breeze ejecuta). Empieza ahí si quieres
   un retransmisor público sin un servidor que mantener.

Ambos ejecutan exactamente el mismo código de gestión; un retransmisor es un buzón
tonto e intercambiable en cualquier caso, y cada cliente funciona con
cada retransmisor.

## Autoalojado con Docker

```bash
# 1. Get the code
git clone https://github.com/shizukutanaka/Breeze.git && cd Breeze

# 2. Start it, with your own Breeze ID admitted (see "Registration"
#    below for how to find it — you can also start closed-to-everyone
#    and add IDs later)
BREEZE_ALLOWLIST=<your Breeze ID> docker compose up -d

# 3. Watch the first-boot log — it prints your relay identity
#    fingerprint; write it down (see "Relay identity")
docker compose logs breeze
```

El retransmisor sirve HTTP sin cifrar en el puerto 8787 dentro del contenedor.
**Termina TLS en un proxy inverso delante de él** (Caddy, nginx,
Traefik, un Cloudflare Tunnel, …): los navegadores solo usarán un retransmisor
por HTTPS/WSS. Cuando lo hagas, establece `TRUST_PROXY: "true"` en
`docker-compose.yml` para que la limitación de velocidad se base en la dirección real del
cliente, y nunca lo establezcas sin un proxy así, porque la cabecera
en la que confía puede falsificarla cualquiera que pueda llegar directamente a la entrada.

Ejecuta exactamente **un** contenedor sobre el volumen de datos: el limitador
de velocidad está en memoria por proceso y las operaciones de cada buzón están
serializadas dentro de ese proceso, así que una segunda réplica no mantendría
ninguna de las dos propiedades. Escala dándole al único proceso una máquina más grande.

### Registro: cerrado por defecto

Un retransmisor autoalojado en el que cualquiera en internet pudiera registrarse
recrearía la economía de spam/abuso que los límites del retransmisor oficial
existen para controlar, así que **el paquete de Docker se entrega cerrado**: el
archivo compose pasa un `REGISTRATION_ALLOWLIST` (posiblemente vacío) y
solo los ID de Breeze que figuren en él pueden *crear cuentas* (una primera subida de
prekey). Cerrar el registro nunca afecta a las personas ya alojadas en
el retransmisor: sus subidas, depósitos, encuentros y consultas no
están restringidos, y abrir el registro es una elección explícita, nunca el
valor por defecto.

- **Tu ID de Breeze** es el identificador de 12 caracteres de tu enlace de invitación
  (los primeros 12 caracteres de su valor `pub`). Pide a cada persona
  que invites el suyo de la misma manera: el ID es un identificador público
  que los contactos ya intercambian, no un secreto.
- **Admite personas** enumerando sus ID: establece
  `BREEZE_ALLOWLIST=id1,id2,…` en tu shell o en un archivo `.env` junto a
  `docker-compose.yml`, y luego `docker compose up -d` otra vez.
- **Empieza ahora, admite después**: sin `BREEZE_ALLOWLIST` establecido, el
  retransmisor funciona cerrado para todos — el registro de arranque lo dice — y nadie
  puede registrarse hasta que añadas ID.
- **Retransmisor abierto** (cualquiera puede registrarse): descomenta
  `REGISTRATION_OPEN: "1"` en `docker-compose.yml`. Si lo haces, la economía del abuso es tuya.

### Cuota de uso: desactívala en tu propio retransmisor

El worker se entrega con una **cuota de uso justo** activada: por
buzón, como máximo 10.000 depósitos/día y 200.000/mes (un depósito es
un ciclo completo de entrega; consulta `docs/COST_MODEL.md` §10 para la
política y las cifras). Ese marco existe para el *retransmisor predeterminado compartido*,
que se opera como una entrada gratuita cuyos costes variables el
operador cargaría en caso contrario por todos. **En un retransmisor que ejecutas
para ti y tu gente, el marco no tiene sentido: desactívalo**:

```bash
USAGE_QUOTA_ENABLED=false
```

Establécelo donde tu retransmisor lea su entorno (el shell o
`.env` junto a `docker-compose.yml`, el entorno del proceso de Node,
o los secretos de Cloudflare Pages). Existen dos mandos vecinos si
operas un retransmisor comunitario y *sí* quieres un marco:
`USAGE_QUOTA_DAILY` y `USAGE_QUOTA_MONTHLY` reajustan los límites.
Notas que importan:

- La cuota solo se aplica cuando los buzones viven en Durable
  Objects (`MAILBOX_BACKEND=do`, el valor por defecto en este host); en el
  backend KV es un no-op documentado.
- Superado el límite, los remitentes reciben un `429 USAGE_QUOTA_EXCEEDED` explícito
  (con la ventana y su límite) en lugar de una caída silenciosa: el
  mensaje permanece en la bandeja de salida del remitente, y el destinatario sigue
  siendo alcanzable por P2P y a través de cualquier otro retransmisor de origen.

### Identidad del retransmisor

En el primer arranque, el retransmisor genera una clave de identidad Ed25519 persistente
*dentro del volumen de datos* e imprime su huella en el registro:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

La huella identifica a *tu* retransmisor: entrégala a tus usuarios
por fuera de banda (en persona, por otro canal) para que puedan reconocer
el retransmisor que se les entregó como el que tú operas. La misma huella
se imprime en cada arranque; si alguna vez cambia, el volumen de datos fue
reemplazado: investiga antes de decir a los usuarios que confíen en la nueva.

Los clientes verifican y fijan esta clave automáticamente (etapa 2, paso 4): en el
primer contacto, un cliente desafía al retransmisor a firmar con la clave
(`/api/relay/attest`), almacena la clave verificada con la cuenta, y
la vuelve a verificar en cada sesión posterior. La huella que muestra el cliente
(en `/security`, y en el aviso en la primera fijación) se deriva de
la misma clave: compárala con la línea del registro de arranque anterior. Si la clave
cambia alguna vez, los clientes **dejan de hablar con el retransmisor** y avisan al
usuario; nunca vuelven a fijarla en silencio. Trata un cambio de huella como un
evento rupturista: no hay un botón en la aplicación de «confiar en la nueva clave» en el
paso 4, así que, tras una pérdida real del volumen, tus usuarios deben borrar los
datos almacenados de la aplicación para su cuenta y volver a fijarla en el primer contacto:
anuncia la nueva huella por fuera de banda primero, o no podrán distinguir
tu nueva clave de la de un atacante.

### Copia de seguridad y restauración

**El volumen de datos es todo el estado del retransmisor**: un archivo SQLite
que contiene el directorio, los buzones y la clave de identidad del retransmisor.
No hay nada más que respaldar.

```bash
# Back up: copy the database out of the (stopped) container
docker compose stop
docker cp "$(docker compose ps -aq breeze)":/data/breeze-relay.db ./breeze-relay-backup.db
docker compose start

# Restore: copy the backup back in as /data/breeze-relay.db before
# starting, and the relay serves identically — same fingerprint.
docker compose stop
docker cp ./breeze-relay-backup.db "$(docker compose ps -aq breeze)":/data/breeze-relay.db
docker compose start
```

### Actualización

```bash
git pull origin main
docker compose up -d --build
```

El estado vive en el volumen, no en la imagen, así que actualizar nunca toca
los datos de tus usuarios.

## Autoalojado con Node básico (sin Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

La configuración es solo mediante variables de entorno: `server/README.md`
las enumera todas. Dos diferencias respecto a la ruta de Docker:

- El **archivo de datos** por defecto es `./breeze-relay.db` (se puede cambiar con
  `BREEZE_DB_PATH`); es el mismo estado en un único archivo, identidad del retransmisor
  incluida. Respáldalo de la misma manera: parar, copiar, reiniciar.
- **El registro está abierto a menos que lo cierres**: el valor cerrado por defecto
  es una propiedad del paquete de Docker. Para cerrar una entrada básica, establece
  `REGISTRATION_ALLOWLIST=id1,id2` (o un valor vacío para
  cerrado para todos); `REGISTRATION_OPEN=1` lo reabre explícitamente.

## Despliegue en Cloudflare

### Despliegue mínimo (0 $/mes, 5 minutos)

```bash
# 1. Install Wrangler CLI
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Deploy
wrangler pages deploy . --project-name=breeze

# 4. Create a KV namespace and declare it in wrangler.toml
wrangler kv:namespace create KV
# Copy the new namespace's ID and put it in wrangler.toml, replacing the
# id in the [[kv_namespaces]] section (binding = "KV"). Pages takes its
# bindings from wrangler.toml; a binding set only in the Dashboard is
# NOT applied while a wrangler.toml exists.
# Then deploy again so the binding takes effect:
wrangler pages deploy . --project-name=breeze

# 5. Visit your deployment's URL (https://<your-project>.pages.dev)
```

**Eso es todo.** Todas las funciones funcionan excepto las notificaciones push. Ten en cuenta
que el registro en un despliegue de Cloudflare está **abierto** a menos que
establezcas `REGISTRATION_ALLOWLIST` tú mismo (consulta `.env.example`); el
empaquetado cerrado por defecto es la ruta de Docker anterior.

### Qué funciona por 0 $

| Función | Estado | Notas |
|---------|--------|-------|
| Chat cifrado E2E | ✓ | Double Ratchet completo |
| Mensajería P2P | ✓ | WebRTC DataChannel |
| Llamadas de voz/vídeo | ✓ | WebRTC + STUN gratuito |
| Retransmisor TURN | ✓ | Open Relay (20GB/mes gratis) |
| Grupos (1.000 miembros) | ✓ | Sender Key O(1) |
| Transferencia de archivos | ✓ | Hasta 50MB por P2P |
| 51 idiomas | ✓ | Inglés integrado + 50 archivos de configuración regional completos, detección automática |
| Sin conexión/PWA | ✓ | Service Worker |
| Notificaciones push | ✗ | Necesita claves VAPID |

La facturación multicuenta (Lite/Plus/Pro) no está disponible: consulta la sección
«Removed: multi-account billing» de [SECURITY.md](../../SECURITY.md). Cada cuenta obtiene
subcuentas locales ilimitadas de forma gratuita y sin control por planes.

### Límites del nivel gratuito

| Recurso | Nivel gratuito | Uso por usuario activo |
|----------|-----------|----------------------|
| Solicitudes al Worker | 100.000/día | ~500/día (consultas + señalización) |
| Lecturas KV | 100.000/día | ~200/día |
| Escrituras KV | 1.000/día | ~350/día (optimizado) |
| Almacenamiento KV | 1 GB | ~10 KB/usuario |
| Recursos estáticos | Ilimitado | ~894 KB (un único HTML) |

**Admite ~3 usuarios activos simultáneos en el nivel gratuito.**

### Añadir funciones opcionales

#### Notificaciones push (gratis)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### Servidor TURN (para redes restrictivas)

TURN es la forma en que las llamadas y las conexiones solo por retransmisor (que ocultan la IP) cruzan
los NAT restrictivos. Qué TURN entrega tu retransmisor es **tu** elección como
operador: el Worker prueba, en orden:

```bash
# Option A: Cloudflare Calls ($0.05/GB, global anycast)
wrangler pages secret put TURN_KEY_ID
wrangler pages secret put TURN_KEY_API_TOKEN

# Option B: your own coturn (HMAC time-limited credentials — the Worker
# mints a 24h username/credential per registered user from the secret)
#   coturn: use-auth-secret, static-auth-secret=<same secret>
wrangler pages secret put TURN_URL      # turn:your-server:3478
wrangler pages secret put TURN_SECRET

# Option C: static credentials (metered.ca, Twilio, …)
wrangler pages secret put TURN_URL
wrangler pages secret put TURN_USERNAME
wrangler pages secret put TURN_CREDENTIAL

# Option D: No config → free Open Relay (20GB/month). This is a third
# party's PUBLIC quota, shared with every unconfigured relay — fine for
# a first run, not a foundation. Opt out explicitly and callers get
# STUN only (some restrictive-NAT calls will then fail, visibly):
wrangler pages secret put TURN_OPENRELAY_FALLBACK   # set to: false
```

**Verifica lo que realmente configuraste:** `GET /api/health` informa del
modo efectivo como `turnProvider` (`cloudflare` | `custom` | `static` |
`openrelay` | `none`). El booleano `turn` más antiguo solo refleja
`TURN_URL`, así que indica `false` para la opción A recomendada: usa
`turnProvider`. Los clientes muestran el mismo proveedor en `/security`, así que un
usuario en el respaldo de Open Relay puede ver que un tercero retransmite el
medio de su llamada (solo metadatos: el medio en sí está cifrado con DTLS-SRTP).

#### Endurecimiento de la autenticación y la ruta de retransmisión simple

Las subidas de prekey ahora preservan la propiedad de la firma por separado en
`prekey-owner:<userId>` **sin TTL**. La propiedad de los paquetes existentes migra de forma perezosa
en la siguiente subida, antes de que se acepte un reemplazo. Los paquetes Ed25519 nuevos también
establecen ese registro. Conserva estos registros al podar los paquetes de prekey caducados:
esperar a la caducidad del paquete no debe permitir un nuevo propietario. La rotación requiere una
subida firmada por el propietario anterior, que vincula la nueva clave en el resumen de subida existente. El `/account/delete` autenticado borra ambos registros y puede autenticarse
contra el propietario incluso después de la caducidad del paquete. No hay restablecimiento por clave de propietario perdida.

Para las cuentas con este registro, la subida y la consulta de mensajes/sellados, el ACK sellado y
las pruebas WebSocket del buzón deben usar el propietario duradero. **Las solicitudes sin firmar se
rechazan incluso con `PREKEY_REQUIRE_AUTH=false` o `QUEUE_REQUIRE_AUTH=false`.**
Esas banderas conservan sus valores por defecto y su semántica heredada para las cuentas
sin propietario; la aceptación explícita con `false` de solicitudes de subida/cola sin firmar
registra una advertencia de obsolescencia sin contenido. Las demás banderas de autenticación no cambian.
Los WebSocket del buzón siguen requiriendo firmas para todos.

El cliente espera la inicialización de la firma antes de la actividad de cola, incluido el
arranque de cuentas que regresan, la promoción a líder y la reconexión. La espera compartida está
acotada a cinco segundos. Los entornos no compatibles continúan sin firmar de inmediato;
un IDB/desenvolvimiento de clave atascado continúa sin firmar tras el límite, y luego firma cuando está listo.
Esto mantiene vivo el bucle de consultas, **no** es un rodeo: las cuentas respaldadas por propietario no pueden
recibir del retransmisor hasta que su clave de firma sea utilizable. Despliega los recursos del cliente actualizados
junto con el Worker para evitar la antigua carrera de arranque.

La migración no puede recuperar la propiedad de un paquete que caducó **antes** de que su
propietario fuera preservado. El primer registro sigue siendo TOFU. Los registros de propiedad usan el
backend KV existente: la consistencia eventual y las escrituras concurrentes no se hacen
linealizables con este cambio. Las pruebas conservan la ventana de frescura de cinco minutos existente
y la vinculación operación/carga útil; los reintentos idénticos dentro de la ventana no son un
protocolo de nonce de un solo uso.

Las escrituras de presencia y la emisión de credenciales TURN ya requieren una cuenta *registrada*
(paquete de prekey presente) por defecto, y cada cliente se registra
automáticamente. Los latidos de presencia llevan además una prueba de propiedad Ed25519
(el latido firma los campos que almacena), que el Worker verifica
siempre que se presente una: `PRESENCE_SIGN_REQUIRE_AUTH=true` hace que esa
prueba sea obligatoria. Las demás banderas de firma Ed25519 siguen siendo optativas;
`wrangler.toml` documenta cada una y el porqué (los clientes en entornos sin
WebCrypto Ed25519 no pueden firmar en absoluto).

El retransmisor simple heredado (`/api/msg/send`, `/api/msg/poll`) está obsoleto: sus
respuestas llevan una cabecera `Deprecation: true`, y la ruta sellada es la
ruta por defecto para cada cliente actual. Una vez que hayas confirmado que ningún cliente en vivo
sigue necesitando el respaldo, desactívalo por completo:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Dominio personalizado

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Escalar más allá del nivel gratuito

Cuando superes el nivel gratuito (plan Workers Paid de 5 $/mes):

| Recurso | Plan de pago |
|----------|-----------|
| Solicitudes al Worker | 10 millones/mes |
| Escrituras KV | 1 millón/mes |
| Almacenamiento KV | 1 GB incluido |
| Tiempo de CPU | 30 segundos/solicitud |

Esto admite **miles de usuarios simultáneos**.

### Actualización

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Sin paso de compilación. Sin dependencias que instalar. Solo desplegar.
