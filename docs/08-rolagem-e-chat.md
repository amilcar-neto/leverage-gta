# 08 — Pool, rolagem, card no chat e automações

Alvo visual do card: `reference/mockups/png/roll-chat-card.png`. Bandeja: rodapé dos PNGs da ficha.

## Montando a Pool (bandeja da ficha)

- A Pool é estado **do cliente**, ligado à ficha aberta (`DicePool`). Não é salva no ator.
- Entra na Pool clicando em: nome de Attribute, nome de Role, d8 ou d4 de Distinction, nome de Specialty, dado ou
  nome de Asset, dado de Talent, maior dado de Grana (pelo **+ DADO**, item GRANA, se a regra estiver ligada).
- **Obrigatórios:** exatamente **1 Attribute e 1 Role** (chips sólidos). Escolher outro Attribute troca o anterior.
- **Opcionais:** chips tracejados. No máximo **uma Distinction** por rolagem. Specialty só faz sentido com a Role
  dela; se a Role na Pool for outra, avise com um tooltip no chip (não bloqueie: o mestre pode permitir).
- **+ DIE:** menu com d4…d12 avulsos e com os Traços de cena/local/complicações visíveis do Job ativo
  (`docs/09`), para quem recebeu um dado de outro jogador ou do cenário.
- Clicar num chip da bandeja tira ele da Pool (Distinction: alterna d8 → d4 → fora).
- **ROLL** fica desabilitado (com tooltip) até haver Attribute e Role. Atalho: Enter com a ficha focada.
- O contador acompanha: "N dice" mais a dica "choose 2 + effect" (modo `prime`) ou "N dice · keep 2" (modo `classic`).
- Depois de rolar, a Pool limpa (configuração de cliente para manter, padrão: limpar).

## Ao rolar

Dois modos, pela configuração `rules.rollMode` (mundo). Decisões em `docs/log/DECISIONS.md` ("Cortex Prime"); a matemática
pura está em `module/dice/prime-math.mjs`.

**Modo `prime` (Cortex Prime)**

1. Avalie cada dado com a classe `Roll` do Foundry (um termo por dado, para o Dice So Nice e para o histórico).
2. Hitches: dados que tiraram **1** não contam, não entram no total e não podem ser o dado de efeito.
3. O card entra no chat **inativo** (`status: "pending"`): sem total, sem dados marcados, sem efeito. Quem rolou recebe a
   janela **Escolher dados** (uma por mensagem; não há escolha automática inicial).
4. O jogador escolhe **2 dados** para o total (quaisquer dois, não só os maiores) e **1 dado** para o efeito, e lança no
   card. Só então ele vale (`status: "resolved"`). Dado extra no total custa **1 PP** cada e **não** pode ser o efeito.
   Atalhos na janela: **Máx. total** (2 maiores; o maior que sobrar é o efeito) e **Máx. efeito** (maior dado, por faces,
   vira efeito; os 2 maiores do resto no total). Eles só preenchem a escolha; o jogador confirma.
5. Sem dado sobrando, o efeito é **d4**. Pool de 1 dado: o total é o dado. Só hitches: **botch**, total 0.
6. Fechar a janela sem confirmar **não** resolve nada: o card segue inativo e tem o botão **Escolher dados** enquanto estiver
   pendente, para quem pode resolvê-lo (o jogador dono da personagem; o Mestre só em card de NPC, de oposição ou de
   personagem sem jogador dono), em qualquer card pendente, não só no mais recente. Quem confirma só vê a janela fechar
   depois que o Mestre aceitou; se ele recusar, o aviso aparece e a janela continua aberta. Um card nunca fica resolvido
   sem os PP e a Grana: o card é gravado primeiro e, se a ficha falhar, volta a pendente.
7. Se entrou **Distinction d4**: o personagem ganha 1 PP (registrado no card). Se entrou **Grana**: desce 1 degrau.
8. Sucesso heroico (`rules.heroicSuccess`): superar a dificuldade por 5 ou mais sobe o efeito 1 passo a cada 5.

**Modo `classic` (rede de segurança):** rolagem imediata e resolvida (`status: "resolved"`), os dois maiores entre os que
não são 1 (um só: total = ele; nenhum: 0), sem dado de efeito. Mesmas regras de PP (+1 dado) e Grana.

Em ambos, crie a mensagem de chat com o card e as `flags` de `docs/05`.

## O card

- **Topo preto:** retrato pequeno (mugshot), nome em Anton com contorno, `flavor` (descrição da ação) em cinza.
- **Chips dos Traços:** nome + tamanho do dado na cor do dado.
- **Dados:** o mesmo componente da ficha (`renderDie`), 50 px, **com o resultado dentro**:
  - Total: cor cheia, borda acesa branca, legenda "TOTAL" (modo `classic`: "KEPT"); efeito: legenda "EFFECT"; pago com PP:
    "TOTAL +PP".
  - Hitches: borda vermelha, opacidade 0,75, legenda "HITCH" (modo `classic`: "1 · OUT").
  - Os outros: opacidade 0,45, legenda com o tamanho ("d8").
  - Ordem: a mesma da Pool (Attribute, Role, depois os opcionais).
- **Pendente (modo `prime`):** card inativo, dados sem marcação, sem TOTAL, botão **Escolher dados** (só o dono).
- **Resumido (resolvido, padrão):** só o decidido: os 2 dados do total, a soma e o dado de efeito (dX). **Expandido** (clique no
  card): a rolagem inteira, com todos os dados, hitches e dados pagos com PP.
- **Aviso de hitches** (caixa tracejada vermelha) enquanto houver hitches não resolvidos; **BOTCH** quando todos os dados são 1.
- **Botões:**
  - **"Escolher dados"**: reabre a janela (só o dono, enquanto o card estiver pendente).
  - **"+1 PP · KEEP 3RD DIE"** (modo `classic`; só o dono, enquanto tiver PP e houver dado não mantido que não seja 1): gasta
    1 PP, marca o próximo maior como mantido, atualiza total e card. Pode repetir. No modo `prime` o PP é gasto na janela.
  - **"GM · COMPLICATION"** (só o mestre, por 1 não resolvido): abre um mini-diálogo (nome da Complication, nova ou
    subir uma existente do Job ativo), cria/sobe no Rastreador do Job e **dá 1 PP** ao jogador. Marca o 1 como
    resolvido. No card **prime** este botão não existe: vale o de baixo.
  - **"Mestre · Ativar hitches"** (card prime resolvido, só o mestre, enquanto houver hitch não resolvido; não existe no
    card pendente): um diálogo age em **todos** os hitches abertos de uma vez (n = quantos). (a) **nova Complication** d6
    subida n-1 passos, 1 PP ao jogador; (b) **subir uma existente** n passos (qualquer uma, até d12: o que passa do d12 é "fora da cena"), 1 PP; (c) **n
    Complications separadas** (d6, sem subir), 1 PP cada. O card marca os hitches como resolvidos (`complicationsResolved`) e guarda `hitchPP` e `hitchesActivated`
    (a faixa de hitches esmaece e ganha "· ativado"), numa só escrita; o PP vai só ao jogador de uma Crew (o mestre nunca
    tira; ator que não é Crew não ganha PP). A escrita roda no Mestre que processa, numa só tarefa da fila do socket.
    **BOTCH** (todos 1, total 0): faixa vermelha cheia; **uma** Complication grátis, subida um passo por hitch além do
    primeiro (livro): só as opções (a) e (b), **sem PP**. Passo além do d12 = personagem **fora da cena**: só um aviso no card (`outOfScene`) e uma
    notificação ao mestre; Wasted/Busted continuam manuais (docs/02).
- O card é atualizado editando a própria mensagem (o dono e o mestre têm permissão; use socket se o jogador não
  puder atualizar a mensagem diretamente).
- **Mockup:** o `roll-chat-card.png` cobre o card clássico. Pendente, resumido, expandido e a janela não têm PNG: derivam do
  mesmo estilo e ganham prints de referência na T-1016.

## Oposição (rolagem do mestre)

- **Rolador de oposição** (controle do mestre): escolha rápida de dados (d4…d12, com contadores), atalhos:
  "2d6 (nenhuma oposição)", "Polícia (estrelas atuais)", "Gangue: N × dX", "NPC selecionado", Traços do Local e
  Complicações do Job ativo. Gera o mesmo card, com cabeçalho "FIXER" e cor de destaque vermelha discreta.
- **Dificuldade:** presets 2d4 (Very Easy), 2d6 (Easy), 2d8 (Challenging), 2d10 (Hard), 2d12 (Very Hard) em
  `LEVERAGE.difficulties`. A oposição do Fixer é **automática** por padrão (`rules.oppositionChoice = "auto"`: 2 maiores,
  sem janela); `"choose"` abre a janela para o mestre. Empate no total é do Fixer. Hitches do Fixer são Opportunities.
  O Rolador tem a linha DIFICULDADE (Muito fácil 2d4 ... Muito difícil 2d12); os dados dela somam aos Traços/fontes
  escolhidos. Fácil (2d6) é o padrão e não soma nada: é a oposição "nenhuma" que já vale quando nada é escolhido.
  O card do Fixer guarda `total`, `effectDie` (maior dado sobrando, d4 se nada sobra), `hitches` e `opportunities`
  (= hitches, `opportunitiesUsed: 0`) em `flags.leverage-gta.roll`; hitches nunca entram no total. Gastar Opportunities: ver abaixo.
  `rules.oppositionChoice = "choose"` ainda resolve automático (ver ISSUES).
- Opcional: card de **disputa** (`versus` em `docs/05`) que liga a rolagem do jogador a um card do Fixer por `messageId`, mostra
  a margem, quem venceu e o sucesso heroico (+5 = +1 passo de efeito).
- **Versus (T-1011), sempre opcional:** com um card do Fixer resolvido mais antigo (mesma cena), a janela Escolher dados
  mostra o botão "vs último do Mestre (total N)", desligado; ao confirmar com ele ligado o Mestre grava `versus` (relê o
  card: o `messageId` precisa ainda ser o oferecido). Ordem inversa: o Rolador de oposição mostra "vs último de X
  (total N)" (desligado); ao rolar, o Mestre grava `versus` na rolagem do jogador (resolvida e sem ligação). `margin` =
  jogador - dificuldade; empate = falha; heroico só com `rules.heroicSuccess`. O card mostra a faixa SUCESSO / FALHA /
  HERÓICO (+N passos) com o efeito final. O resultado de "taken out" fica narrativo.
- **Efeito em ações (T-1012):** card resolvido que venceu (ou sem `versus`): o jogador vê "Criar Asset dX" (Asset de cena
  com o dado do efeito final, sem PP, nome obrigatório) e o Mestre "Complication dX" (grava em Complications da mesa).
  Card do Fixer: "Complication = efeito dX" para a primeira rolagem de jogador que perdeu contra ele (desce 1 passo se o
  efeito do perdedor for >= ao do Fixer; d4 que desce não vira nada). Escrita pelo Mestre (`effectAction`), relendo o card.

- **Opportunities (T-1010):** o card do Fixer mostra a faixa "N oportunidades" enquanto sobra alguma (`opportunities - opportunitiesUsed`).
  O dono de um personagem vê "Usar oportunidade (1 PP)" (desativado sem PP). O diálogo é um `<select>` com dois grupos: **descer** uma
  Complication da mesa (d4 some) ou **subir** um Asset de cena/Job do personagem (até d12; guarda `system.boost`, que dura até
  "Encerrar cena", "Encerrar Job" ou "Nova sessão"). **Regra da casa:** 1 PP por uso (o livro cobra 1 PP por Complication afetada).
  Só o card de oposição mais recente da cena vale; "Encerrar cena" expira os que sobraram (`opportunitiesExpired`). O Mestre só aceita
  card postado por um Mestre e usa o personagem do próprio solicitante. Cada uso gasta 1 PP, soma `opportunitiesUsed`, grava `opportunityLog` e é uma escrita pelo Mestre
  (`requestAsGM("useOpportunity")`, `packetQueue`, desfaz se falhar). Lógica em `dice/opportunity.mjs`.

## Tiroteio (regra da casa "Vida")

- No card de oposição contra um personagem, se a oposição venceu, o mestre tem o botão **"APPLY DAMAGE"**: calcula
  margem + dado da arma do NPC (rola o dado da arma), pergunta cobertura (sim/não), aplica metade e depois o colete,
  e atualiza Vida/Colete. Se a Vida zerar: mensagem **WASTED** ou **BUSTED** (NPC com `police`) estilizada como no
  GTA, com os passos da regra (pagar d4 / fiança d6 ou resgate, +1 PP, perder Assets de arma de cena — com
  confirmação).
- **Ganging Up:** quem vence contra uma gangue derruba um capanga (dois com +5); o mestre diminui o tamanho da gangue
  na ficha do NPC (`gang.size`). O sistema não automatiza isso: o card do jogador não mostra "−1 thug".

## Integrações

- **Dice So Nice** (se o módulo estiver ativo): registre as cores por tamanho de dado (d4 vermelho … d12 roxo) e
  verde-dinheiro para Grana. Sem o módulo, nada muda.
- **Macros:** `game.leverage.rollPool(...)` com as refs de `docs/04`. Arrastar um Attribute/Role/Asset da ficha
  para a barra de macros cria uma macro que monta a Pool com aquele Traço (estilo dnd5e).
