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
