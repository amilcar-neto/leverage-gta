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

