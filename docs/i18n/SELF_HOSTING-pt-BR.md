# Guia de Auto-hospedagem

**Ler em outro idioma**: [English](../SELF_HOSTING.md) · [English](SELF_HOSTING-en.md) · [中文（简体）](SELF_HOSTING-zh-CN.md) · [中文（繁體）](SELF_HOSTING-zh-TW.md) · [Español](SELF_HOSTING-es.md) · [Français](SELF_HOSTING-fr.md) · [Deutsch](SELF_HOSTING-de.md) · [Italiano](SELF_HOSTING-it.md) · Português (Brasil) (esta página) · [Русский](SELF_HOSTING-ru.md) · [Українська](SELF_HOSTING-uk.md) · [Polski](SELF_HOSTING-pl.md) · [Nederlands](SELF_HOSTING-nl.md) · [Svenska](SELF_HOSTING-sv.md) · [Norsk](SELF_HOSTING-nb.md) · [Dansk](SELF_HOSTING-da.md) · [Suomi](SELF_HOSTING-fi.md) · [Čeština](SELF_HOSTING-cs.md) · [Magyar](SELF_HOSTING-hu.md) · [Română](SELF_HOSTING-ro.md) · [Ελληνικά](SELF_HOSTING-el.md) · [Türkçe](SELF_HOSTING-tr.md) · [العربية](SELF_HOSTING-ar.md) · [فارسی](SELF_HOSTING-fa.md) · [עברית](SELF_HOSTING-he.md) · [हिन्दी](SELF_HOSTING-hi.md) · [বাংলা](SELF_HOSTING-bn.md) · [اردو](SELF_HOSTING-ur.md) · [ਪੰਜਾਬੀ](SELF_HOSTING-pa.md) · [தமிழ்](SELF_HOSTING-ta.md) · [తెలుగు](SELF_HOSTING-te.md) · [മലയാളം](SELF_HOSTING-ml.md) · [Bahasa Indonesia](SELF_HOSTING-id.md) · [Bahasa Melayu](SELF_HOSTING-ms.md) · [Tiếng Việt](SELF_HOSTING-vi.md) · [ไทย](SELF_HOSTING-th.md) · [မြန်မာ](SELF_HOSTING-my.md) · [ខ្មែរ](SELF_HOSTING-km.md) · [한국어](SELF_HOSTING-ko.md) · [Filipino](SELF_HOSTING-tl.md) · [Kiswahili](SELF_HOSTING-sw.md) · [Hausa](SELF_HOSTING-ha.md) · [Yorùbá](SELF_HOSTING-yo.md) · [Igbo](SELF_HOSTING-ig.md) · [አማርኛ](SELF_HOSTING-am.md) · [ქართული](SELF_HOSTING-ka.md) · [Azərbaycan](SELF_HOSTING-az.md) · [Қазақша](SELF_HOSTING-kk.md) · [Oʻzbek](SELF_HOSTING-uz.md) · [Српски](SELF_HOSTING-sr.md) · [Hrvatski](SELF_HOSTING-hr.md)


> **Antes de começar: a instalação padrão precisa de uma conta da Cloudflare.**
> A instalação padrão deste guia — a implantação na Cloudflare
> descrita abaixo — roda na Cloudflare, portanto tenha uma
> conta da Cloudflare pronta antes de começar. Se você não
> quiser usar a Cloudflare, as instalações com Docker e com
> Node puro deste guia não precisam de uma conta da Cloudflare.

Há duas maneiras de executar um relay do Breeze:

1. **Auto-hospedado (Node + Docker)** — o relay na sua própria máquina ou
   VPS: um contêiner, um volume de dados, cadastro fechado por
   padrão. Comece por aqui se o relay for para você e suas pessoas.
2. **Cloudflare** — a implantação no estilo oficial no plano gratuito
   da Cloudflare (o relay que o próprio Breeze executa). Comece por lá
   se quiser um relay público sem servidor para manter.

Ambos executam exatamente o mesmo código de tratamento; um relay é uma
caixa de correio burra e intercambiável de qualquer maneira, e todos os
clientes funcionam com todos os relays.

## Auto-hospedado com Docker

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

O relay atende HTTP simples na porta 8787 dentro do contêiner.
**Termine o TLS em um proxy reverso à frente dele** (Caddy, nginx,
Traefik, um Cloudflare Tunnel, …): os navegadores só usarão um relay
por HTTPS/WSS. Ao fazer isso, defina `TRUST_PROXY: "true"` em
`docker-compose.yml` para que a limitação de taxa use o endereço real
do cliente — e nunca defina isso sem esse proxy, porque o cabeçalho
em que ele confia pode ser forjado por qualquer um que consiga alcançar
a entrada diretamente.

Execute exatamente **um** contêiner sobre o volume de dados: o
limitador de taxa fica em memória por processo e as operações de cada
caixa de correio são serializadas dentro desse processo, de modo que
uma segunda réplica não manteria nenhuma dessas duas propriedades.
Escale dando uma máquina maior ao único processo.

### Cadastro: fechado por padrão

Um relay auto-hospedado no qual qualquer pessoa na internet pudesse se
cadastrar recriaria a economia de spam/abuso que os limites do relay
oficial existem para controlar, por isso **a embalagem Docker é
distribuída fechada**: o arquivo compose passa um
`REGISTRATION_ALLOWLIST` (possivelmente vazio) e somente os IDs do
Breeze nele podem *criar contas* (um primeiro envio de prekey). Fechar
o cadastro nunca afeta quem já está hospedado no relay — envios,
depósitos, rendezvous e polls dessas pessoas não são controlados — e
abrir o cadastro é uma escolha explícita, nunca o padrão.

- **Seu ID do Breeze** é o identificador de 12 caracteres no seu link
  de convite (os primeiros 12 caracteres do valor `pub` dele). Peça o
  de cada pessoa que você convidar da mesma maneira — o ID é um
  identificador público que os contatos já trocam, não um segredo.
- **Admita pessoas** listando os IDs delas: defina
  `BREEZE_ALLOWLIST=id1,id2,…` no seu shell ou em um arquivo `.env` ao
  lado de `docker-compose.yml`, e depois `docker compose up -d` de novo.
- **Comece agora, admita depois**: sem `BREEZE_ALLOWLIST` definido, o
  relay roda fechado para todos — o registro de inicialização diz isso
  — e ninguém pode se cadastrar até você adicionar IDs.
- **Relay aberto** (qualquer um pode se cadastrar): descomente
  `REGISTRATION_OPEN: "1"` em `docker-compose.yml`. Se fizer isso, a
  economia do abuso é sua.

### Cota de uso: desligue-a no seu próprio relay

O worker é distribuído com uma **cota de uso justo** ativada: por
caixa de correio, no máximo 10.000 depósitos/dia e 200.000/mês (um
depósito é um ciclo completo de entrega — veja `docs/COST_MODEL.md`
§10 para a política e os números). Esse enquadramento existe para o
*relay padrão compartilhado*, que é executado como uma entrada gratuita
cujos custos variáveis o operador, de outra forma, arcaria por todos.
**Em um relay que você executa para si e para suas pessoas, o
enquadramento não faz sentido — desative-o**:

```bash
USAGE_QUOTA_ENABLED=false
```

Defina-o onde quer que o seu relay leia o ambiente (o shell ou o
`.env` ao lado de `docker-compose.yml`, o ambiente do processo Node,
ou os segredos do Cloudflare Pages). Existem dois botões vizinhos se
você executa um relay comunitário e *quer* um enquadramento:
`USAGE_QUOTA_DAILY` e `USAGE_QUOTA_MONTHLY` reajustam os limites.
Observações que importam:

- A cota só é aplicada quando as caixas de correio vivem em Durable
  Objects (`MAILBOX_BACKEND=do`, o padrão neste host); no backend KV
  ela é um no-op documentado.
- Ao ultrapassar o limite, os remetentes recebem um
  `429 USAGE_QUOTA_EXCEEDED` explícito (com a janela e seu limite) em
  vez de um descarte silencioso — a mensagem permanece na caixa de
  saída do remetente, e o destinatário continua alcançável por P2P e
  por qualquer outro relay doméstico.

### Identidade do relay

Na primeira inicialização, o relay gera uma chave de identidade
Ed25519 persistente *dentro do volume de dados* e imprime sua
impressão digital no registro:

```
relay identity: NEW key generated — fingerprint 3F2A 9C41 …
```

A impressão digital identifica o *seu* relay: entregue-a aos seus
usuários por fora (pessoalmente, por outro canal) para que eles possam
reconhecer o relay que receberam como aquele que você executa. A mesma
impressão digital é impressa em todas as inicializações; se ela mudar
algum dia, o volume de dados foi substituído — investigue antes de
dizer aos usuários para confiar na nova.

Os clientes verificam e fixam essa chave automaticamente (etapa 2,
passo 4): no primeiro contato, um cliente desafia o relay a assinar
com a chave (`/api/relay/attest`), armazena a chave verificada junto à
conta e a reverifica em todas as sessões posteriores. A impressão
digital que o cliente mostra (em `/security`, e no aviso na primeira
fixação) é derivada da mesma chave — compare-a com a linha do registro
de inicialização acima. Se a chave mudar algum dia, os clientes
**param de falar com o relay** e avisam o usuário; eles nunca refixam
silenciosamente. Trate uma mudança de impressão digital como um evento
ruptivo: não há um botão “confiar na nova chave” dentro do aplicativo
no passo 4, então, após uma perda genuína do volume, seus usuários
precisam limpar os dados armazenados do aplicativo para a conta deles
e refixar no primeiro contato — anuncie a nova impressão digital por
fora antes, ou eles não conseguirão distinguir a sua nova chave da de
um atacante.

### Backup e restauração

**O volume de dados é todo o estado do relay**: um arquivo SQLite
contendo o diretório, as caixas de correio e a chave de identidade do
relay. Não há mais nada para fazer backup.

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

### Atualização

```bash
git pull origin main
docker compose up -d --build
```

O estado vive no volume, não na imagem, então atualizar nunca toca
nos dados dos seus usuários.

## Auto-hospedado com Node puro (sem Docker)

```bash
node server/index.js   # Node ≥ 24, no npm dependencies to install
```

A configuração é somente por variáveis de ambiente — `server/README.md`
lista todas. Duas diferenças em relação ao caminho Docker:

- O **arquivo de dados** por padrão é `./breeze-relay.db` (substitua
  com `BREEZE_DB_PATH`); é o mesmo estado em arquivo único, identidade
  do relay incluída. Faça backup dele da mesma maneira: pare, copie,
  reinicie.
- **O cadastro é aberto, a menos que você o feche**: o padrão fechado
  é uma propriedade da embalagem Docker. Para fechar uma entrada pura,
  defina `REGISTRATION_ALLOWLIST=id1,id2` (ou um valor vazio para
  fechado para todos); `REGISTRATION_OPEN=1` reabre explicitamente.

## Implantação na Cloudflare

### Implantação mínima (US$ 0/mês, 5 minutos)

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

**É isso.** Todos os recursos funcionam, exceto notificações push.
Observe que o cadastro em uma implantação na Cloudflare é **aberto**,
a menos que você mesmo defina `REGISTRATION_ALLOWLIST` (veja
`.env.example`); a embalagem fechada por padrão é o caminho Docker
acima.

### O que funciona por US$ 0

| Recurso | Status | Observações |
|---------|--------|-------|
| Chat criptografado de ponta a ponta | ✓ | Double Ratchet completo |
| Mensagens P2P | ✓ | WebRTC DataChannel |
| Chamadas de voz/vídeo | ✓ | WebRTC + STUN gratuito |
| Relay TURN | ✓ | Open Relay (20 GB/mês grátis) |
| Grupos (1.000 membros) | ✓ | Sender Key O(1) |
| Transferência de arquivos | ✓ | Até 50 MB via P2P |
| 51 idiomas | ✓ | Inglês incorporado + 50 arquivos de locale completos, detectados automaticamente |
| Offline/PWA | ✓ | Service Worker |
| Notificações push | ✗ | Precisa de chaves VAPID |

Cobrança multi-conta (Lite/Plus/Pro) não está disponível — veja a
seção “Removed: multi-account billing” de [SECURITY.md](../../SECURITY.md).
Todas as contas ganham subcontas locais ilimitadas de graça, sem
nenhum bloqueio por plano.

### Limites do plano gratuito

| Recurso | Plano gratuito | Uso por usuário ativo |
|----------|-----------|----------------------|
| Requisições ao Worker | 100.000/dia | ~500/dia (polling + sinalização) |
| Leituras de KV | 100.000/dia | ~200/dia |
| Escritas de KV | 1.000/dia | ~350/dia (otimizado) |
| Armazenamento KV | 1 GB | ~10 KB/usuário |
| Ativos estáticos | Ilimitado | ~894 KB (HTML único) |

**Suporta ~3 usuários ativos simultâneos no plano gratuito.**

### Adicionando recursos opcionais

#### Notificações push (grátis)

```bash
# Generate VAPID keys
npx web-push generate-vapid-keys

# Set secrets
wrangler pages secret put VAPID_PUBLIC_KEY
wrangler pages secret put VAPID_PRIVATE_KEY
```

#### Servidor TURN (para redes restritivas)

TURN é como chamadas e conexões somente via relay (que ocultam o IP)
atravessam NATs restritivos. Qual TURN o seu relay distribui é escolha
**sua**, como operador — o Worker tenta, nesta ordem:

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

**Verifique o que você realmente configurou:** `GET /api/health`
informa o modo efetivo como `turnProvider` (`cloudflare` | `custom` |
`static` | `openrelay` | `none`). O booleano `turn` mais antigo reflete
apenas `TURN_URL`, então ele lê `false` para a Opção A recomendada —
use `turnProvider`. Os clientes mostram o mesmo provedor em
`/security`, de modo que um usuário no fallback Open Relay pode ver
que um terceiro retransmite a mídia das chamadas dele (somente
metadados — a mídia em si é criptografada com DTLS-SRTP).

#### Endurecimento de autenticação e o caminho relay simples

Os envios de prekey agora preservam a propriedade de assinatura
separadamente em `prekey-owner:<userId>` **sem TTL**. A propriedade de
bundles existentes migra preguiçosamente no próximo envio, antes que
uma substituição seja aceita. Novos bundles Ed25519 também estabelecem
esse registro. Mantenha esses registros ao podar bundles de prekey
expirados: esperar a expiração do bundle não deve permitir um novo
proprietário. A rotação exige um envio assinado pelo proprietário
anterior, vinculando a nova chave no resumo de envio existente. O
`/account/delete` autenticado apaga ambos os registros e pode se
autenticar contra o proprietário mesmo após a expiração do bundle.
Não há redefinição por perda da chave do proprietário.

Para contas com esse registro, envios e polls de mensagens/sealed,
ACKs sealed e provas de WebSocket da caixa de correio devem usar o
proprietário durável. **Requisições sem assinatura são rejeitadas
mesmo com `PREKEY_REQUIRE_AUTH=false` ou `QUEUE_REQUIRE_AUTH=false`.**
Essas flags mantêm seus padrões e sua semântica legada existentes
para contas sem proprietário; a aceitação explícita `false` de
requisições de envio/fila sem assinatura registra um aviso de
depreciação sem conteúdo. Outras flags de autenticação não mudam.
WebSockets de caixa de correio ainda exigem assinaturas para todos.

O cliente espera a inicialização da assinatura antes da atividade na
fila, incluindo inicialização de conta que retorna, promoção de líder
e reconexão. A espera compartilhada é limitada a cinco segundos.
Runtimes sem suporte continuam sem assinatura imediatamente; IDB/travamento
de chave travados continuam sem assinatura após o limite, e depois
assinam quando estiverem prontos. Isso mantém o loop de poll vivo,
**não** é um desvio: contas com proprietário não podem receber do
relay até que sua chave de assinatura esteja utilizável. Implante os
ativos do cliente atualizados junto com o Worker para evitar a antiga
corrida de inicialização.

A migração não pode recuperar a propriedade de um bundle que expirou
**antes** de seu proprietário ser preservado. O primeiro cadastro
continua sendo TOFU. Os registros de propriedade usam o backend KV
existente: consistência eventual e escritas concorrentes não se tornam
linearizáveis com esta mudança. As provas mantêm a janela de frescor
de cinco minutos existente e o vínculo operação/payload; repetições
idênticas dentro da janela não são um protocolo de nonce único.

Escritas de presença e emissão de credenciais TURN já exigem uma conta
*registrada* (bundle de prekey presente) por padrão, e todos os
clientes se registram automaticamente. Heartbeats de presença
adicionalmente carregam uma prova de propriedade Ed25519 (o beat
assina os campos que armazena), que o Worker verifica sempre que uma é
apresentada — `PRESENCE_SIGN_REQUIRE_AUTH=true` torna essa prova
obrigatória. As demais flags de assinatura Ed25519 continuam opt-in;
`wrangler.toml` documenta cada uma e o porquê (clientes em runtimes
sem WebCrypto Ed25519 não conseguem assinar de forma alguma).

O relay simples legado (`/api/msg/send`, `/api/msg/poll`) está
depreciado: suas respostas carregam um cabeçalho `Deprecation: true`,
e o caminho sealed é a rota padrão para todos os clientes atuais.
Depois de confirmar que nenhum cliente ativo ainda precisa do
fallback, desative-o de vez:

```bash
wrangler pages secret put PLAIN_PATH_DISABLED   # set to: true
```

#### Domínio personalizado

```bash
# In Cloudflare Dashboard:
# Pages > breeze > Custom domains > Add
# Point your domain's DNS to Cloudflare
```

### Escalando além do plano gratuito

Quando você ultrapassar o plano gratuito (plano Workers Paid de
US$ 5/mês):

| Recurso | Plano pago |
|----------|-----------|
| Requisições ao Worker | 10 milhões/mês |
| Escritas de KV | 1 milhão/mês |
| Armazenamento KV | 1 GB incluído |
| Tempo de CPU | 30 segundos/requisição |

Isso suporta **milhares de usuários simultâneos**.

### Atualização

```bash
git pull origin main
wrangler pages deploy . --project-name=breeze
```

Sem etapa de build. Sem dependências para instalar. Basta implantar.
