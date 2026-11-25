# Breeze Messenger

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](../../LICENSE)

**Ler em outro idioma**: [日本語](../../README.md) · [English](README-en.md) · [中文（简体）](README-zh-CN.md) · [中文（繁體）](README-zh-TW.md) · [Español](README-es.md) · [Français](README-fr.md) · [Deutsch](README-de.md) · [Italiano](README-it.md) · Português (Brasil) (esta página) · [Русский](README-ru.md) · [Українська](README-uk.md) · [Polski](README-pl.md) · [Nederlands](README-nl.md) · [Svenska](README-sv.md) · [Norsk](README-nb.md) · [Dansk](README-da.md) · [Suomi](README-fi.md) · [Čeština](README-cs.md) · [Magyar](README-hu.md) · [Română](README-ro.md) · [Ελληνικά](README-el.md) · [Türkçe](README-tr.md) · [العربية](README-ar.md) · [فارسی](README-fa.md) · [עברית](README-he.md) · [हिन्दी](README-hi.md) · [বাংলা](README-bn.md) · [اردو](README-ur.md) · [ਪੰਜਾਬੀ](README-pa.md) · [தமிழ்](README-ta.md) · [తెలుగు](README-te.md) · [മലയാളം](README-ml.md) · [Bahasa Indonesia](README-id.md) · [Bahasa Melayu](README-ms.md) · [Tiếng Việt](README-vi.md) · [ไทย](README-th.md) · [မြန်မာ](README-my.md) · [ខ្មែរ](README-km.md) · [한국어](README-ko.md) · [Filipino](README-tl.md) · [Kiswahili](README-sw.md) · [Hausa](README-ha.md) · [Yorùbá](README-yo.md) · [Igbo](README-ig.md) · [አማርኛ](README-am.md) · [ქართული](README-ka.md) · [Azərbaycan](README-az.md) · [Қазақша](README-kk.md) · [Oʻzbek](README-uz.md) · [Српски](README-sr.md) · [Hrvatski](README-hr.md)

**Um mensageiro criptografado que não pede número de telefone nem cadastro.**
O conteúdo das conversas só pode ser lido por quem envia e por quem recebe. Nem o servidor que as transporta consegue ler.
Todos os recursos são gratuitos e não há anúncios.

Isto não é uma página da web, e sim um software para instalar e usar (Windows / Mac / Linux / Android / iPhone / navegador).

![Captura de tela do Breeze Messenger — a janela principal logo após criar uma identidade](../images/screenshot.png)

## Para usar, você o hospeda no seu próprio servidor

O Breeze não tem “servidor da empresa”. **Para usá-lo, você mesmo prepara um lugar (servidor) e instala o Breeze nele. Esse é o modo oficial de uso.**

- A instalação padrão usa a Cloudflare, portanto **é necessária uma conta da Cloudflare**. O procedimento está no [guia de instalação](SELF_HOSTING-pt-BR.md) (versões em outros idiomas podem ser escolhidas no início do guia).
- Baixe os aplicativos (Windows / Mac / Linux / Android / iPhone) na [página de downloads](https://github.com/shizukutanaka/Breeze/releases/latest) e conecte-os ao seu próprio servidor.
- **Sobre a instalação de demonstração (aviso honesto)**: há uma demonstração para testes (https://breeze-469.pages.dev/). É o mesmo software, mas para uso real, utilize o seu próprio servidor. A demonstração pode mudar ou ser interrompida sem aviso. O que você instalou no seu servidor não é afetado pela interrupção da demonstração.

Para detalhes de uso, veja o [manual](MANUAL-pt-BR.md) (versões em outros idiomas podem ser escolhidas no início do manual).

## Como usar (3 passos)

1. Abra o Breeze instalado no seu próprio servidor (ou no endereço que quem instalou informou) e toque em “Começar com um ID aleatório” (você pode digitar um nome, se quiser). Só isso e está pronto (sem cadastro e sem número de telefone). Nesse momento, uma “chave” é criada dentro do seu dispositivo, e ela é a sua identidade.
2. Passe seu ID ou código QR para a pessoa com quem quer conversar.
3. Se a outra pessoa também estiver com o aplicativo aberto, vocês se conectam diretamente e conversam. Se ela não estiver com o aplicativo aberto, a mensagem fica guardada, ainda criptografada, em uma “caixa de espera” e é entregue quando ela abrir o aplicativo. O servidor que transporta a caixa de espera não consegue ler o conteúdo. Cartas que não forem entregues são apagadas automaticamente em no máximo 7 dias.

## Promessas (o que não fazemos)

- **Não exibimos anúncios.** Nem no aplicativo, nem em nenhum lugar.
- **Não rastreamos.** Nada de análise de uso, mecanismos de publicidade ou venda de dados.
- **Quem criou não fica com os dados dos usuários.** No servidor, nem sequer existe uma lista de contas. A identidade é apenas a chave dentro do seu dispositivo.
- **As conversas são criptografadas entre os dispositivos.** O servidor só lida com envelopes que não consegue ler.

Escrevemos também o alcance, com honestidade. Para fazer a entrega, o servidor guarda itens por pouco tempo (envelopes não entregues por no máximo 7 dias, sinais de conexão por 5 minutos, registros de endereços e dispositivos por 90 dias, informações de grupos e inscrições de notificações por 30 dias. Tudo é apagado automaticamente, e o conteúdo não pode ser lido). O backup na nuvem vem desativado no início. Se você hospedar no seu próprio servidor, essa guarda também fica sob o seu controle.

## O que ele faz

- Conversas individuais e em grupo (até 1.000 pessoas)
- Chamadas de voz e de vídeo (chamadas em grupo com até 8 pessoas)
- Histórico de chamadas (mantido apenas neste dispositivo: apenas a outra pessoa, a direção, a hora e a duração da chamada — nada do que foi dito. Nunca enviado a um servidor ou à outra pessoa)
- Envio de arquivos (até 50 MB em conversas individuais. Em grupos também é possível, mas o limite de tamanho é menor)
- Uso em vários dispositivos e com várias contas (por exemplo, trabalho e pessoal. Tanto o número de dispositivos quanto o de contas é gratuito e ilimitado)
- Backup automático (quando algo muda, um backup criptografado é salvo automaticamente no seu próprio servidor. Em um novo dispositivo, depois que você recuperar sua identidade, um backup é encontrado automaticamente e oferecido a você. As configurações também orientam você na mudança para um novo dispositivo)
- Um nome escolhido por você para cada contato (você pode renomear cada contato, guardado apenas neste dispositivo. Você também pode escolher se o nome que cada contato definiu para si será exibido)
- 51 idiomas (inglês mais 50 arquivos de idioma), selecionados automaticamente de acordo com o idioma do seu dispositivo
- Perfil com foto, figurinhas e compartilhamento de localização
- Comandos como `/help` (71 tipos)
- Modos de energia de acordo com a sua bateria (automático / normal / economia de energia / emergência). À medida que a bateria diminui, as verificações de entrega são espaçadas para a bateria durar mais. Uma proteção para desastres e outras situações em que você não pode recarregar
- Abas inferiores em um telefone (Conversas / Chamadas / Contatos / Meu cartão / Configurações. Quais abas são exibidas pode ser escolhido nas configurações)
- Telas fáceis de ler (atenção ao contraste das cores, ao tamanho do texto e à operação apenas com o teclado)

## Diferenças para outros mensageiros

| | Breeze | Muitos mensageiros |
|---|--------|--------|
| Cadastro | Não é necessário (a identidade é a chave no dispositivo) | Exige número de telefone |
| Servidor | Não consegue ler o conteúdo | Pressupõe confiança na empresa operadora |
| Hospedar no próprio servidor | É o pressuposto (é algo para hospedar e usar) | Não é possível |
| Código-fonte | Tudo aberto (licença MIT) | Muitas vezes fechado |
| Onde ficam os dados | No seu dispositivo | Nos servidores da empresa operadora |

A comparação detalhada com Signal e LINE está na [página de comparação (em inglês)](../COMPARISON.md). Cada afirmação do Breeze vem acompanhada de um “método de verificação”, e os pontos em que o Breeze perde (número de usuários, não ter passado por auditoria externa etc.) também estão escritos sem esconder.

## Custo de hospedar no seu próprio servidor

O Breeze roda dentro do plano gratuito da Cloudflare. Não é preciso cartão de crédito.

| Item | No plano gratuito | No plano pago |
|-----------|-----------|-------------|
| Espaço de hospedagem | Cloudflare Pages (grátis) | — |
| Processamento | Até 100 mil por dia | Até 10 milhões por mês |
| Armazenamento | Leitura de até 100 mil/dia e escrita de até 1 mil/dia | Leitura de 10 milhões/mês e escrita de 1 milhão/mês |
| Retransmissão de chamadas | Grátis até 20 GB | 0,05 dólar por GB |
| Domínio próprio | Não é necessário (vem com um endereço gratuito) | 10 dólares por ano |
| **Total** | **0 dólar por mês** (com uso leve, até cerca de 20–40 pessoas) | **A partir de 5 dólares por mês** (com uso leve, escala de cerca de 100 pessoas. Na escala de 1.000 pessoas, de 34 a 222 dólares por mês, dependendo do uso) |

Como o custo cresce em grande escala e “por que um único operador não precisa arcar com o custo de todos” estão em [custos e sustentabilidade (em inglês)](../SUSTAINABILITY.md), e os cálculos originais estão no [modelo de custos (em inglês)](../COST_MODEL.md).

A instalação começa com este único comando (detalhes no [guia de instalação](SELF_HOSTING-pt-BR.md)).

```bash
wrangler pages deploy . --project-name=breeze
```

## Detalhes técnicos (para desenvolvedores)

### Métodos de criptografia

| Função | Método |
|-------|-----------|
| Troca de chaves | X25519 (reserva: P-256) |
| Assinatura | Ed25519 (reserva: HMAC-SHA256) |
| Criptografia | AES-256-GCM |
| Derivação de chaves | HKDF-SHA256 |
| Renovação das chaves da conversa | Double Ratchet (o mesmo método do Signal) |
| Chaves de grupo | Sender Key |
| Ocultar o remetente do relay | Sealed Sender |

A especificação oficial está em [SPEC.md](../../SPEC.md), e o destino dos relatos de vulnerabilidades e a política estão em [SECURITY.md](../../SECURITY.md).

### Testes e verificações de qualidade

```bash
npm ci            # 開発用の道具を入れる
npm test          # テストを実行する
./validate.sh     # 品質チェック（構文・安全性・言語・方式の準拠など7分野）
./build.sh zip    # 配布用ZIPを作る
```

### Como participar do desenvolvimento

O modo de trabalho e as regras estão em [CONTRIBUTING.md](../../CONTRIBUTING.md).
Relatos de problemas vão para a [página de Issues](https://github.com/shizukutanaka/Breeze/issues). O código de conduta é [CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md).

## English

Breeze is an end-to-end encrypted messenger with no phone number, no registration, and no ads — every feature is free. There is no company server: to use Breeze, you host it on your own server and connect the apps to it. Your identity is a key pair on your device; relays handle only sealed envelopes they cannot read. Full text in English: [README-en.md](README-en.md). The full, sourced comparison against Signal and LINE — including where Breeze loses — is in [docs/COMPARISON.md](../COMPARISON.md).

## Licença

MIT — conforme [LICENSE](../../LICENSE), você pode usar, modificar e distribuir livremente.
