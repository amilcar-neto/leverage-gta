# Revisões (Opus)

Um resumo por revisão: tarefa ou fase, veredito, defeitos encontrados, o que foi corrigido, o que ficou para depois.

## R-F1 — Fase 1 (T-101..T-106) — revisão de conjunto (Opus)
- Veredito: precisa de correções. 2 bloqueios, 10 "deveria", vários detalhes.
- Bloqueios: (1) trava de Traços e limite de 3 Distinctions usavam hooks `_pre*DescendantDocuments`, que não cancelam nada na v14 → movidos para `LeverageItem#_pre*`. (2) configurações `lifeBase` e `moneyStart` eram registradas mas ninguém as lia → ligadas ao modelo.
- Deveria: constantes duplicadas fora de `config.mjs`, regras de estrelas presas ao id da cidade, preços de Wasted/Busted fixos, stubs com classe raiz errada, `deriveRoleRanks` sem teste, formato de preço da Grana.
- Em correção (2 builders). Ficam como riscos: trava só no cliente (aceito pela mesa); chaves de setting com ponto a confirmar no Foundry real; menus de GM ainda são stubs até a T-705.
- R-F1 fechada: bloqueios corrigidos (trava/limite agora em `LeverageItem#_pre*` e `createEmbeddedDocuments`; `lifeBase`/`moneyStart` lidas), constantes movidas para `config.mjs`. Tester confirmou no Foundry real (jogador de teste: limite de 3 Distinctions e trava funcionam; GM passa).

## R-F2 — Fase 2 (T-201, T-202) — revisão de conjunto (Opus)
- Veredito: pronto, com ressalvas. Nada bloqueia a Fase 3. Formas, cores e estados batem com os mockups.
- Deveria (em correção): estado `dropped` do card; cores dos dados em 3 lugares (hue agora derivado + teste de sincronia CSS×config); `renderDie` como `<button>` para escadas; `.lv-chip` igual à bandeja do mockup; linha acesa mais forte.
- Ficou para a T-301: conferir no Foundry real que a layer `system` vence as do núcleo (`getComputedStyle`).
- Riscos: variáveis de cor só existem dentro de `.leverage-gta` (card de chat, HUD e diálogos precisam da classe na raiz); estados combinados `kept`+`money` sem visual definido.

## R-F3 + T-307 — Fase 3 (ficha da Equipe) — revisão de conjunto e visual (Opus)
- Veredito: precisa de correções. Visual já está próximo do mockup; faltam pílulas de etiqueta (amarelas), título de painel (Anton 21 branco), etiquetas JOB/SCENE, alturas de linha, apelido em Special Elite, X únicos, sombras/gaps, ícone da janela.
- Bloqueios de código: CSS duplicado entre crew.css/header.css/assets.css/ladders.css/lists.css/tray.css (ordem de @import decidia qual valia); selo da trava com dois significados e código copiado entre ficha e item; confirmação de apagar fora do docs/03 (só Jobs e Signature Assets); edição do BACKGROUND podia se perder em re-render.
- Deveria: listeners únicos centralizados em `_onFirstRender`/`_onClose`; menus flutuantes copiados; nomes de actions fora do docs/04 (decisão: manter nomes atuais e registrar; assert de colisão em parts/_module.mjs); escape/t/readSetting duplicados; aria-pressed e foco por teclado; `data-die` em vez de ler texto; teste da trava como jogador.
- Correção em duas ondas: (A) CSS + visual (em andamento), (B) JS (depois).

## R-F4 + R-F5 — Fichas de Item, Pool, rolagem e chat (Opus)
- Veredito: precisa de correções. 2 bloqueios, ~13 "deveria".
- Bloqueios: (1) "+1 PP · KEEP 3RD DIE" via socket pode gastar 2 PP e manter 1 dado em duplo clique (sem trava no lado do mestre). (2) id do solicitante vem dentro do pacote do socket (não autenticado): Grana (`moneyTransfer`) e estrelas podem ser forjadas por console.
- Deveria: card vaza rolagem cega; botão KEEP desatualizado e sem aviso; mestre vê "+1 PP"; `scene:<id>` não aceito em rollPool; fonte `police` composta não reconhecida em damage.mjs; dado de Grana no chat em 24px (inexistente); docs/05 desatualizado (flags); constantes duplicadas (`mystery-man`, SYSTEM_ID×systemId, 2d6); CSS do card repetindo sombra e vermelhos soltos; cabeçalho do Foundry escondido por inteiro; rolador de oposição sem trava de duplo clique; i18n (plural, "keep 2" fixo); jogador contorna regras no AssetSheet/JobSheet.
- Visual do card: chip de Grana com a cor do d12 (deve ser verde-dinheiro), `D10` em maiúsculas no chip, explicação do total quebrando em 2 linhas, 5+ dados quebram mal. Visual do item: barra de título e selo diferentes do mockup; Asset com ~60px de espaço morto.
- Correção em duas frentes (JS/regras e CSS/visual) em andamento.

## R-F6 + R-F7 + R-F8 — Regras da casa, HUD/ferramentas do mestre, NPC/Local (Opus)
- Veredito: precisa de correções. 3 bloqueios, ~15 "deveria".
- Bloqueios: (1) jogador zerava estrelas sozinho e de graça (`giveIn` em PLAYER_ACTIONS), contra docs/02 (última saída depende da cidade); (2) comprar silêncio sem a jogada contra a Pool da polícia; (3) condições de corrida (empréstimo de Grana e suborno) por handlers de socket em paralelo → fila serial + reler estado.
- Deveria: estrela do Busted sobe na prisão em vez do resgate; Wasted/Busted com pouca Grana não segue docs/02; 3 caminhos para mudar estrelas (só 2 anunciam no chat); jogador cria PP para si no HUD/API; docs/07 desatualizado (cliques da Grana); campo `city` do Local sem efeito; selo da trava aparece em NPC/Local; moldura de janela copiada 4× em CSS; NPC×Local com editores de Traço diferentes; ações de mestre em massa sobre todos os crew do mundo e sem confirmação (Novo Job); regras da casa desligadas não desligam tudo (endJob, Rastreador); listeners do HUD sem remoção; helpers duplicados (`t`, `setting`, `readJob`, `wanted`); tamanhos de dado e cores fora de config/tokens.
- Visual: 4 estilos de botão; Local fora da linguagem da Equipe; Rastreador com +/− colados; print do estado vazio do HUD não é o estado vazio.
- Correção em duas frentes: (A) regras/JS agora; (B) CSS/UI depois que a correção visual anterior (R-F4 B) terminar.

## Correções de R-F4..R-F8 + T-902 — rodadas 2 e 3 (Opus)
- 2ª rodada: sem bloqueios (colunas de 5+ dados e chaves de i18n dos pacotes resolvidos e medidos no Foundry real). 5 itens menores: cor do BUSTED, moldura/botões dos diálogos, flavor duplicado no chat, docs/07 desatualizado, fins de linha. Todos corrigidos.
- Ficaram para o dono: visual da Grana no HUD (ISSUES.md); HUD só testado sobre cena escura.

## T-901 + T-903 — i18n, versão 0.1.0, changelog e release zip (Opus)
- Veredito: precisa de pequenas correções. Achou "Fixer" misturado nos textos de interface em inglês, migração de mundo que podia derrubar o `ready`, Mensagem de Plot Points sem plural e itens do release.
- Corrigido: textos em inglês usam "GM" (DECISIONS.md), `migrateWorld` captura erro e só grava a versão ao fim de cada passo, plural em `LEVERAGE.GM.Chat.plotPoints`, lista do release.
- Ficou para depois: licença do sistema (ISSUES.md).

## T-904 — Guia de uso (docs/USO.md e prints) (Opus)
- Veredito: precisa de correções (R-F9). Ver a entrada abaixo.

## R-F9 — Fase 9 (documentação, release) — revisão de conjunto (Opus)
- Veredito: precisa de correções. 2 bloqueios, ~10 "deveria", alguns nits.
- Bloqueios: (1) `docs/USO.md` e `docs/macros.md` citavam `stars.giveIn`, que virou `stars.lastResort(actor, { way, confirmed })`, e diziam que o dono podia chamar estrelas por socket (estrelas são só do mestre); o teste T-505 não falhava com a função inexistente. (2) Os prints de `docs/img` eram de uma cópia velha do sistema ("CENA/LIVRE/COMPLICAÇÕES").
- Deveria: Complications fora do + DADO; janela Nível de procurado descrita como "só API"; card WASTED/BUSTED só sai por APLICAR DANO ou pela API; Give In é manual (`giveIn()` de `rules/combat.mjs` é código morto); botão +1 PP apagado sem PP e só no card mais recente; cidade do Local; Novo Job somava PP em vez de seguir o livro; CHANGELOG com termos fora do livro e itens faltando; "FIXER" na interface em inglês; texto de `apiNotReady`; logs.
- Corrigido: todos acima (decisão sobre PP do Novo Job em DECISIONS.md), T-505 agora confere cada função documentada e o erro do exemplo, prints refeitos num Foundry com o sistema atual. Nits: HUD minimizado, Dice So Nice não testado, Talents de 1 PP descontados à mão, Callback só marca, "Train up" igual em todo texto, README aponta para o guia.


## R-FINAL passada 1 — código e arquitetura (Opus)
- Veredito: precisa de correções. Base saudável (testes, lint, i18n, socket autenticado, fila serial de estrelas).
- Bloqueios: (1) Pagar não vestia colete nem curava; popover dava colete de graça. (2) Jogador escolhia o dado de um Asset. (3) Oposição com um dado só rolava um dado.
- Deveria: fiança parcial; cidade com duas fontes e sem zerar estrelas; campos protegidos dos Items só na ficha; arrastar copiava Job/Asset sem custo; Ganging Up prometido e não feito (agora é manual e documentado); `job.end` sem validação; hooks e helpers duplicados; código morto; CSS repetido; acessibilidade (Asset, PP do HUD).
- Corrigido em 2 frentes (regras/API/mestre e fichas/itens/HUD/CSS) + chaves de i18n. 225 testes verdes.
- Fica: botões −/+ do popover de Vida/Colete mudam o colete sem cobrar o jogador; barra do token (API do núcleo não confirmada na v14); varredura de mensagens no chat O(n²); ~40 rgba() soltos; empréstimo sem consentimento (decisão registrada).

## R-FINAL passada 2 — uso real no Foundry, mestre e jogador (Opus, 2026-10-21)
- Veredito: precisa de pequenas correções. Nenhum bloqueio. Testado no VPS com o código do commit b3f8c85 (deploy refeito no meio do teste), Foundry 14.369, pt-BR, 1920×1080. Nenhum erro do sistema no console (mestre e jogador).
- Funciona: ficha da Equipe igual ao mockup (layout, escadas, painéis, pasta JOBS); Pool, rolagem e card; +1 PP · MANTER O 3º DADO com duplo clique gasta 1 PP e mantém 1 dado só; mestre não vê o botão; Rolador de oposição; Nível de procurado (janela, HUD e anúncio no chat); Rastreador; Novo Job (PP mínimo 1, sem somar); Encerrar cena (confirma e apaga Assets de cena); configurações sem chave crua; menus de escalas/preços/treino; fichas do compêndio. Como jogador: Traços travados barram escada, `actor.update`, renomear/apagar/criar Item e a ficha do Item fica só leitura; estrelas barradas no HUD, na API e no setting; PP positivo barrado na API e sem botão +; pagar e emprestar (via mestre) funcionam; Asset de cena cobra 1 PP.
- Deveria: (1) o HUD (Grana e PP) fica por baixo da ficha quando o chat lateral está aberto: z-index 40 contra 101, a ficha padrão cobre o `$` e o −; o jogador não paga nem gasta PP sem mover a ficha (`RFINAL-pl-hud-under-sheet.png`). (2) `docs/08` (linha 9) e `docs/USO.md` §3 falam de "botão `$` na bandeja", que não existe: a Grana entra pelo + DADO (`RFINAL-gm-adddie-menu.png`). (3) `relaunchWorld` de `tests/foundry/lib.mjs` não passa pelo diálogo de migração do Foundry (versão nova do sistema) nem pelo de backup e falha após 90 s; o mundo de teste ainda estava em 0.0.1.
- Depois: plurais "1 Plot Points", "personagem(ns)", "Asset(s)"; cabeçalho "9 JOBS · 6 SEM …" cortado em pt-BR; nome do Local cortado com espaço sobrando; chip "GRANA GRANA"; rádios do Train up com pouco contraste; janelas do sistema levam de 2 a 3,5 s para abrir no navegador de teste sem GPU (Configurações do núcleo: 1,2 s), medir numa máquina real; o dono da ficha muda os PP pelo console (risco aceito, trava no cliente); `docs/05` sem Vida/Colete do NPC; `docs/03` ainda diz "+1/−1 degrau" no clique da Grana do HUD; o mundo de teste tem restos de testes antigos (Job ativo "[TEST] Job", mensagens "[TEST] MONEY A", ator "1"), que foram deixados como estavam.
- Limpeza: atores, usuário e mensagens `[TEST]` criados neste teste foram apagados; estrelas, Job ativo e trava voltaram ao estado inicial. Prints: `tests/foundry/screenshots/RFINAL-gm-*.png` e `RFINAL-pl-*.png`.

## R-FINAL passada 3 — conferência das correções b3f8c85 + b092ca1 no Foundry (Opus, 2026-10-21)
- Veredito: **passou**. Nenhum bloqueio. Deploy do HEAD b092ca1, Foundry 14.369, pt-BR, 1920×1080, mestre + jogador `[TEST]` em dois navegadores. 29/29 checagens passaram; nenhum erro do sistema no console. 227 testes de unidade verdes.
- Confirmado: Pagar > Hospital enche a Vida e cobra d4; Pagar > Colete leve põe o colete cheio; "+" do Colete no popover cobra o preço (sem Grana: recusa e avisa); trocar o tipo de colete cobra; jogador não vê o campo Dado no "Novo Asset" e recebe d6 (−1 PP); oposição com 1 dado vira d8+d6; fiança tudo-ou-nada (Grana 1: nada pago, card com "Resgatado"; Grana 8: d6 pago); trocar a cidade no diálogo de Procurado zera as estrelas com linha no chat; jogador pelo console não muda dado/duração do Asset, nem `spent`/`share` do Job; Train up do jogador gasta Jobs; arrastar Job de ficha alheia é barrado com aviso; arrastar Asset alheio cobra PP e usa d6; HUD por cima da ficha (todos os botões clicáveis) e por baixo de um DialogV2 real; menus de contexto do núcleo são popover (camada de topo), ficam acima de tudo; "9 JOBS · 6 LIVRES" cabe; nome longo do Local cai para 26px sem corte; chip "CARTEIRA / GRANA"; rádios visíveis; "1 Plot Point", "1 personagem", "3 Assets"; barras do token somem com Vida desligada e voltam ao religar (`_canViewMode` existe na v14); logo no botão do grupo Leverage.
- Deveria: (1) o HUD volta a ficar por baixo das janelas numa sessão longa: o núcleo soma 1 em `ApplicationV2._maxZ` a cada troca de janela da frente e nunca zera; passou de 500 (≈400 trocas), a ficha cobre o HUD de novo (provado forçando `_maxZ`). Corrigir: ao trazer janela para frente (ou em `pointerdown` captura) pôr o HUD em `max(500, _maxZ + 1)`, mantendo a regra do diálogo. (2) Restam "(s)" em textos que aparecem no chat: card de BUSTED/WASTED ("0 degrau(s) de Grana pago(s)"), Novo Job e Nova sessão no chat, dar PP ("Plot Point(s)" nos dois ramos one/other), `shareDidNotFit`, estrelas ("cena(s)", "estrela(s)", "degrau(s)"); e "faltam 1 degraus" em `Money.Pay.short`. Usar `tn` com one/other.
- Nit: `normalizeDice` tem a linha `if (list.length === 1) list.push(...)` duplicada (opposition.mjs:164-165). `stars.set(n, outraCidade)` com estrelas em 0 posta "de 0 para 0 A Equipe saiu para…" (linha inútil). Card de fiança não paga diz "Fiança: d6 (0 degrau(s)…pago(s))" — melhor "Fiança: d6 (não paga)". Com a ficha no canto, o HUD cobre o botão ⋮ do cabeçalho da ficha e as estrelas ficam sobre o Booking Card (troca aceitável, mas feio). Pagar > Hospital com Vida cheia (ou colete igual e cheio) cobra mesmo assim. Diálogo "Novo Asset" do jogador não diz qual dado ele vai receber. Local vazio: "Adicione com + ADD." mas o botão diz "+ ADICIONAR". Dica do "+ Job" promete "rendimento e a divisão", mas o jogador não pode editar a parte (campo protegido).
- Risco: trocar a cidade no diálogo zera estrelas sem confirmação (um clique errado apaga o nível; dá para repor à mão). Jogador ainda cria Signature Asset (d8) de graça pelo "+ ADD" (decisão registrada; vale avisar o mestre no USO).
- Limpeza: atores, usuários, token e mensagens `[TEST] RV2/RV3` apagados; estrelas (Liberty, 0), Job ativo e trava voltaram ao estado inicial. Prints só no scratchpad desta revisão (nada novo no repositório).

## 2026-10-21 — Fase 10, onda 1 (L-01..L-05, T-1101, T-1100)
- **Lugar por Cena:** 1 bloqueia (ids de Traço por posição: Pool/rolador apontavam para o Traço errado ao reordenar) e 7 deveria.
  Corrigido: id estável por nome, `currentSceneTraits()` único (inclui macro `rollPool`), hooks filtrados, Lugar não nasce
  OBSERVER (vazava Notas do mestre; DECISIONS). Ficou: Traços por flag (Cena ativa) x de Lugar (Cena vista) até a L-06.
- **PP no HUD:** 0 bloqueia, 9 deveria (clique duplo perdia passo, camada invertida, re-render demais, aria-label sem nome,
  glifos, rolagem, CSS duplicado). Tudo corrigido; Grana do grupo e PP/Mesa compartilham classes e largura (240px).
- Tester (2ª passada): tudo passou no Foundry real. Falha conhecida: T-505 (`scene:<id>` do Job); some com a L-06.
- Sobra pequena: `locationSources` em `module/dice/opposition.mjs` ficou sem uso (só testado).

## 2026-10-22 — L-06 (Traits e Complications globais)
- 0 bloqueia, 4 deveria: Complication do card do 1 fora da fila de escrita; re-render apagava texto digitado e roubava foco;
  migração 0.1.1 só testada em unidade; controles do mestre quebravam em duas linhas. Todos corrigidos; novo teste de migração
  no Foundry (L6-migration.mjs, passa 2x, `activeJob` fica só com name/goal). Nits feitos (chaves órfãs, API `game.leverage.table.*`).
- Ficou: Rolador de oposição não oferece Traits globais (só Complications); print docs/img/rastreador.png desatualizado (ISSUES).
- playtest-play/finale falham (botões do HUD não achados + crash do navegador): inconclusivo, registrado.

## 2026-10-22 — Job como Item de mundo (J-01..J-07, J-10, R-FJ)
- 2 bloqueiam: docs/05 corrompido (arquivo colado no meio da tabela) e divisão do pagamento por Crew esquecida (agora
  `payout.crew` no Job de mundo, lista na ficha). 5 deveria: Jobs planejados vazavam trama (agora NONE até iniciar; no v14 o
  NONE esconde só da interface, registrado), drag do Job para a ficha, T-702 (clique ignorado sem Cena vista: era do teste),
  `demoteOthers` sem catch, confirmação/duplo clique em Novo Job. Bug real achado no teste: `startJobDialog` nunca iniciava.
- Passam no Foundry real: J-flow, J-migration, T-703, phase1, T-702. Ficou: scene-panel.mjs (seletor v14 obsoleto).
