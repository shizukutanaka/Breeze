# Manual do Breeze

**Ler em outro idioma**: [日本語](../MANUAL-ja.md) · [English](MANUAL-en.md) · [中文（简体）](MANUAL-zh-CN.md) · [中文（繁體）](MANUAL-zh-TW.md) · [Español](MANUAL-es.md) · [Français](MANUAL-fr.md) · [Deutsch](MANUAL-de.md) · [Italiano](MANUAL-it.md) · Português (Brasil) (esta página) · [Русский](MANUAL-ru.md) · [Українська](MANUAL-uk.md) · [Polski](MANUAL-pl.md) · [Nederlands](MANUAL-nl.md) · [Svenska](MANUAL-sv.md) · [Norsk](MANUAL-nb.md) · [Dansk](MANUAL-da.md) · [Suomi](MANUAL-fi.md) · [Čeština](MANUAL-cs.md) · [Magyar](MANUAL-hu.md) · [Română](MANUAL-ro.md) · [Ελληνικά](MANUAL-el.md) · [Türkçe](MANUAL-tr.md) · [العربية](MANUAL-ar.md) · [فارسی](MANUAL-fa.md) · [עברית](MANUAL-he.md) · [हिन्दी](MANUAL-hi.md) · [বাংলা](MANUAL-bn.md) · [اردو](MANUAL-ur.md) · [ਪੰਜਾਬੀ](MANUAL-pa.md) · [தமிழ்](MANUAL-ta.md) · [తెలుగు](MANUAL-te.md) · [മലയാളം](MANUAL-ml.md) · [Bahasa Indonesia](MANUAL-id.md) · [Bahasa Melayu](MANUAL-ms.md) · [Tiếng Việt](MANUAL-vi.md) · [ไทย](MANUAL-th.md) · [မြန်မာ](MANUAL-my.md) · [ខ្មែរ](MANUAL-km.md) · [한국어](MANUAL-ko.md) · [Filipino](MANUAL-tl.md) · [Kiswahili](MANUAL-sw.md) · [Hausa](MANUAL-ha.md) · [Yorùbá](MANUAL-yo.md) · [Igbo](MANUAL-ig.md) · [አማርኛ](MANUAL-am.md) · [ქართული](MANUAL-ka.md) · [Azərbaycan](MANUAL-az.md) · [Қазақша](MANUAL-kk.md) · [Oʻzbek](MANUAL-uz.md) · [Српски](MANUAL-sr.md) · [Hrvatski](MANUAL-hr.md)


Breeze é um mensageiro criptografado que não pede número de telefone nem cadastro.
O conteúdo das conversas só pode ser lido por quem envia e por quem recebe. Nem o servidor que as transporta consegue ler.
Todos os recursos são gratuitos e não há anúncios.

Este manual é um guia para quem está começando.

---

## 1. Como começar

### Como obter

Escolha na [página de downloads](https://github.com/shizukutanaka/Breeze/releases/latest) o arquivo adequado à sua máquina.

- Windows: o que termina com `-win-x64.exe` (também há para máquinas ARM)
- Mac: o que termina com `-mac.dmg`
- Linux: `.AppImage` (pode ser executado diretamente) ou `.deb`
- Para usar no navegador, use a versão instalada no seu próprio servidor (o procedimento de instalação está em outro documento, o “guia de instalação”)

Cada arquivo acompanha valores de verificação (SHA256SUMS.txt). Quem quiser pode conferir se os valores do arquivo baixado coincidem.

> **Sobre a página de amostra**: uma amostra para verificar como funciona (https://breeze-469.pages.dev/) é oferecida. O que está lá é o mesmo software, mas a amostra pode mudar ou parar sem aviso. Para uso real, use a versão instalada no seu próprio servidor. A versão no seu próprio servidor não é afetada se a amostra parar.

### Configuração inicial

1. Abra o aplicativo.
2. Digite seu nome e toque em “Criar conta”. Só isso e está pronto. Sem cadastro e sem número de telefone.

- Se você quiser trazer de volta uma identidade que criou antes, abra “Restaurar uma conta existente” e os métodos de recuperação (um arquivo de backup, uma frase de recuperação e assim por diante) aparecem.
- Quando a criação termina, aparece um cartão orientando você a proteger sua chave com uma frase secreta (ele não desaparece depois de um tempo). Para uma identidade importante, siga a orientação e adicione a proteção.

Nesse momento, uma “chave” é criada dentro do seu dispositivo. Ela é a sua própria identidade.
**Não há lista de contas no servidor.** Sua identidade existe apenas dentro do seu dispositivo.
Esse ponto se torna importante no capítulo sobre backup (9).

### Sobre a “identidade descartável”

Se ao criar você escolher “identidade descartável”, será uma identidade sem nenhum meio de recuperação.
Se você perder esse dispositivo, restaurá-lo ou apagar os dados do navegador, essa identidade nunca mais voltará.
Isso também é exibido na tela. Não escolha para uma identidade que pretende usar por muito tempo.

---

## 2. Conectar-se com alguém

Toque no botão “Adicionar amigo” na tela de contatos e três opções aparecem.

- **Adicionar um contato**: digite o ID da outra pessoa ou leia um código QR.
- **Convidar um amigo**: copie o link de convite e envie pelo seu meio de contato habitual (e-mail etc.). Quando a outra pessoa abrir o link e digitar o nome, vocês já podem conversar.
- **Criar um grupo**: basta digitar o nome do grupo para criar um (capítulo 4).

Seu próprio ID é exibido por completo quando você abre o seu perfil, e você pode copiá-lo como está. Passe o ID completo, não apenas o ID curto.

Se a outra pessoa também estiver com o aplicativo aberto, vocês se conectam diretamente e conversam.

---

## 3. Conversas

- Basta digitar a mensagem e enviar. Também é possível enviar fotos, figurinhas e localização.
- Abra o “+” ao lado do campo de entrada e anexos de arquivos, mensagens de voz, entrada por voz, localização, figurinhas, a configuração “não precisa responder” e muito mais aparecem juntos.
- **Envio de arquivos**: em conversas individuais, até 50 MB. Em grupos, o limite é menor, cerca de 50 KB.
- Arquivos em formatos perigosos, como executáveis, são bloqueados automaticamente.
- Se a outra pessoa não estiver com o aplicativo aberto, a mensagem fica guardada, ainda criptografada, na “caixa de espera” e é entregue quando ela abrir o aplicativo. O servidor que transporta a caixa de espera não consegue ler o conteúdo. Cartas que não forem entregues são apagadas automaticamente em **no máximo 7 dias**.
- O histórico de conversas pode ser exportado para um arquivo e importado.

### Lendo a tela

- **Status de envio**: dá para saber pela marca ao lado da mensagem. ✓ significa enviado, um ✓ dentro de um círculo significa que foi depositado na caixa de espera, ✓✓ significa que chegou à outra pessoa, lido é uma marca azul e falha é uma marca vermelha. Eles se distinguem pela forma, além da cor.
- **A lista de contatos**: o horário da última conversa aparece como horário para hoje, “Ontem” para ontem, mês/dia para este ano e ano/mês/dia para antes disso. Contatos com mensagens não lidas têm nome e horário destacados.
- **Seu próprio cartão**: no topo da lista fica o cartão do seu perfil; toque nele para abrir o seu perfil. Ele rola junto com a lista.
- **Abas inferiores no celular**: em telas com largura de celular, as abas “Contatos” e “Configurações” aparecem na parte inferior da tela.
- **O cabeçalho da conversa**: pelo ícone de busca você pode pesquisar dentro da conversa. Pelo menu “⋮” você pode verificar o número de segurança, silenciar notificações, fixar, criar uma enquete e muito mais.

### Comandos

Digite `/` no campo de entrada e sugestões de comandos aparecem. Digite `/help` para ver a lista de comandos disponíveis (71 tipos).
Algumas operações, como configurações e vínculo de dispositivos, são feitas por comandos.

---

## 4. Grupos

- Os grupos comportam até **1.000 pessoas**.
- Para criar, basta digitar o nome do grupo em “Criar um grupo”, dentro de “Adicionar amigo” (também é possível criar com o comando `/newgroup`). O convite é feito pelo “link de convite do grupo”. Quem receber o link pode participar digitando o nome.
- Também é possível enviar arquivos em grupos, mas o limite é menor, cerca de 50 KB. Mensagens de voz ainda não podem ser enviadas em grupos.
- Se houver membros usando uma versão antiga do aplicativo, o novo método mais seguro (grupo v5) não poderá ser usado nesse grupo, e um aviso aparecerá na tela. Ele é ativado quando todos estiverem na versão mais recente.

---

## 5. Chamadas

- É possível fazer chamadas de voz e de vídeo individuais. Também há chamadas em grupo (até 8 pessoas).
- **Código de confirmação da chamada**: a tela da chamada exibe um código de confirmação. Leiam o código um para o outro e confirmem se ele coincide nas duas telas. Se não coincidir, pode ser que alguém esteja escutando no meio do caminho. Nesse caso, encerre a chamada.
- As chamadas em grupo podem não começar se os aplicativos de todos não estiverem na versão mais recente.

---

## 6. Vários dispositivos e contas

- Para usar a mesma identidade em vários dispositivos, vincule os dispositivos com o comando `/link`.
- É possível criar várias contas e usá-las separadamente (trabalho e pessoal, por exemplo). Tanto o número de dispositivos quanto o de contas é gratuito e ilimitado.
- **Como criar uma conta**: toque no botão “+” ao lado das abas de contas, bem no topo da lista de contatos. Digite um nome e escolha um emoji de ícone, e uma nova conta é criada e selecionada automaticamente.
- **Trocar de conta**: as abas de contas são sempre exibidas bem no topo da lista de contatos. Toque em uma para trocar (em um computador, também é possível trocar com Ctrl+1–9). Toque e segure uma aba para renomeá-la, mudar seu ícone ou excluí-la.
- O idioma é selecionado automaticamente entre 51 idiomas, incluindo o inglês, de acordo com o idioma do seu dispositivo.

---

## 7. Configurações para manter a segurança

As configurações abrem como uma tela própria. No celular, abra-as pela aba “Configurações”, na parte inferior da tela; no computador, pelo botão de engrenagem na tela (também é possível abri-las com o comando `/settings`). Use a ação de voltar para retornar à tela em que você estava.

- **Bloqueio automático**: há uma configuração para bloquear automaticamente ao trocar de aba.
- **Frase secreta da chave**: você pode proteger a chave dentro do dispositivo com uma frase secreta. Ela será pedida ao abrir o aplicativo.
- **Bloqueio de pessoas**: é possível bloquear pessoas incômodas. Mensagens de pessoas bloqueadas não chegam.

---

## 8. Bateria e emergências (modos de energia)

Na configuração “Modo de energia”, você pode escolher como a bateria é usada.

- **Automático (nível da bateria)**: muda automaticamente de acordo com a carga restante da bateria.
- **Normal**: funcionamento de sempre.
- **Economia de energia**: espaça as verificações de entrega para no máximo uma vez a cada 60 segundos e interrompe o sinal de presença.
- **Emergência (para desastres)**: espaça as verificações de entrega para no máximo uma vez a cada 10 minutos. Use em um desastre ou em outra situação em que você não possa recarregar.

O que consome a bateria não é a quantidade de comunicação, mas o número de vezes que o rádio acorda. Por isso, o lado que envia não é espaçado; apenas o lado que escuta. O envio continua saindo na hora, como sempre. Quando você começa a carregar, ele volta automaticamente um passo em direção ao lado mais leve.

Em dispositivos que não conseguem ler o nível da bateria automaticamente (como um iPhone no navegador), “Automático” se comporta como Normal, e uma escolha manual funciona como escolhida.

---

## 9. Backup e recuperação (o capítulo mais importante)

A identidade do Breeze é apenas a chave dentro do seu dispositivo. Não há lista de contas no servidor, e quem criou também não tem a sua chave.
**Se você perder o dispositivo, perde também a identidade.** Para identidades importantes, crie sempre um backup.

Backup e recuperação são feitos na seção “Backup e recuperação” das configurações (há três botões: “Fazer backup na nuvem”, “Restaurar” e “Restaurar de um arquivo”). Na primeira vez que você adiciona um contato, um cartão incentivando você a criar um backup aparece uma única vez.

### Como fazer o backup

1. Em “Backup e recuperação”, nas configurações, escolha criar um backup.
2. Defina uma frase secreta para o backup (6 caracteres ou mais).
3. Escolha onde salvar.
   - **Salvar em arquivo**: guarde o arquivo de backup com você (recomendado).
   - **Salvar no servidor de relay**: só pode ser usado se o operador daquele relay tiver ativado. Não pode ser usado no relay padrão. Há um prazo de guarda; recupere dentro do prazo.

O conteúdo do backup está criptografado. O servidor onde ele fica guardado só lida com o texto cifrado.

### Como recuperar

Em um novo dispositivo, restaure usando o arquivo de backup (ou o backup no servidor de relay) e a frase secreta que você definiu.

### Atenção

- **Se você esquecer a frase secreta, não será possível restaurar.** Nem quem criou consegue corrigir isso. Anote a frase secreta em outro lugar.
- **Identidades descartáveis não voltam, nem por backup nem por recuperação.**
- Refaça o backup quando adicionar identidades ou trocar de dispositivo.

---

## 10. A caixa de espera e a ideia de custos

- As cartas para quando a outra pessoa está offline ficam guardadas, ainda criptografadas, na “caixa de espera” do servidor de relay (no máximo 7 dias).
- O relay tem limites para evitar abusos (quantidade e frequência do que pode ser depositado). Ao atingir o limite, durante esse período não será possível depositar novas cartas, mas **as cartas já entregues nunca desaparecem**. A tela mostra o motivo e o tempo de espera.
- Os limites podem ser definidos por você mesmo quando você hospeda no seu próprio servidor.

Alcance dos registros que permanecem no servidor (todos são apagados automaticamente e o conteúdo não pode ser lido):

| Item | Período de permanência |
|---|---|
| Cartas não entregues | No máximo 7 dias |
| Sinais de conexão | 5 minutos |
| Registros de endereços e dispositivos | 90 dias |
| Informações de grupos e inscrições de notificações | 30 dias |

---

## 11. Como atualizar (versão para desktop)

1. Quando há uma nova versão, um aviso aparece na tela.
2. Ao tocar em “Baixar”, ele vai buscar a nova versão (não instala automaticamente).
3. Quando o download terminar, toque em “Instalar” e reinicie.

Se algo falhar durante a atualização (os valores de verificação não coincidem etc.), **a atualização é interrompida e o motivo é exibido na tela**. Não é possível voltar para uma versão antiga.

---

## 12. Quando algo der errado

| Sintoma | O que verificar |
|---|---|
| Não consigo enviar mensagens | Verifique se o relógio do dispositivo não está adiantado ou atrasado. Com o relógio errado, o envio falha. |
| Não chega para a outra pessoa | Até a outra pessoa abrir o aplicativo, a mensagem espera na caixa de espera (no máximo 7 dias). |
| Não consigo enviar arquivos | Verifique se você não ultrapassou o limite de tamanho (50 MB individual, cerca de 50 KB em grupos) e se o arquivo não foi bloqueado como formato perigoso. |
| O código de confirmação da chamada não coincide | Encerre a chamada e ligue de novo. Não continue sem coincidir. |
| Esqueci a frase secreta | Não é possível restaurar. Crie uma nova identidade e avise seus contatos novamente. |
| Perdi o dispositivo | Se houver backup, você pode recuperar em um novo dispositivo. Se não houver, será uma nova identidade. |
| A página de amostra não abre | A amostra pode parar sem aviso. Use a versão instalada no seu próprio servidor. |

Relatos de problemas: [página de Issues](https://github.com/shizukutanaka/Breeze/issues).

---

## 13. As promessas do Breeze

- Não exibimos anúncios. Nem no aplicativo, nem em nenhum lugar.
- Não rastreamos. Nada de análise de uso, mecanismos de publicidade ou venda de dados.
- Quem criou não fica com os dados dos usuários. No servidor, nem sequer existe uma lista de contas.
- As conversas são criptografadas entre os dispositivos. O servidor só lida com envelopes que não consegue ler.

A comparação detalhada com outros mensageiros está escrita na “página de comparação” do repositório, incluindo os pontos em que o Breeze perde (número de usuários, não ter passado por auditoria externa etc.).

---

*Este manual reflete o estado do Breeze em 2026-11-25.*
