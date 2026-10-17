# 10 — Backlog

Marque `[x]` quando a tarefa passou na revisão e foi commitada, `[~]` em andamento, `[!]` bloqueada (explicar em
`ISSUES.md`). **Dep** = tarefas que precisam estar `[x]` antes. **Par** = grupo que pode rodar em paralelo (os
arquivos não se cruzam). Cada tarefa de código passa por `tester` + `reviewer` (Opus) antes do `[x]`.

---

## Fase 0 — Preparação

- [x] **T-001 Repositório e ferramentas.** `git init`, commit inicial do pacote. `package.json` com scripts `lint`,
  `test` (node --test tests/unit), `test:foundry` (Playwright), `deploy` (`tools/release.mjs --dev` + `tools/deploy.mjs`), `release`.
  ESLint (config plana, regras recomendadas + `no-unused-vars`). Playwright como devDependency (instale só o Chromium).
  *Pronto:* `npm run lint` e `npm test` rodam (mesmo sem testes ainda).
- [x] **T-002 Pesquisa da v14 e do dnd5e.** `researcher` produz `docs/research/foundry-v14-essentials.md` (manifesto,
  DataModel, ActorSheetV2/ItemSheetV2 + HandlebarsApplicationMixin, registro de fichas, settings e menus, controles de
  cena, hooks de chat, CSS layers, sockets, o que mudou da v13 para a v14) e `docs/research/dnd5e-patterns.md`
  (estrutura, `getRollData`, macros arrastáveis, migração, packs). *Par:* T-003.
- [x] **T-003 Pesquisa complementar.** `researcher`: `docs/research/other-systems.md` (pf2e, Lancer, cortexprime:
  só o que for útil para Pool de dados, HUD e cards) e `docs/research/dice-so-nice.md`. *Par:* T-002.
- [x] **T-004 Ambiente de teste.** `tester`: `tests/foundry/smoke.mjs` lê `.env`, abre o Foundry, entra no mundo com
  o usuário de teste, espera `game.ready`, coleta erros do console, tira print. `npm run deploy` funcionando
  (veja `docs/13`). Se o `.env` não existir, registre em `ISSUES.md` e siga sem testes no Foundry.
  *Dep:* T-001. *Pronto:* um print do mundo carregado em `tests/foundry/screenshots/T-004-world.png`.

## Fase 1 — Esqueleto e dados

- [x] **T-101 Manifesto e entrada.** `system.json` completo (documentTypes, primaryTokenAttribute `life`, idiomas,
  estilos, fontes empacotadas), `leverage-gta.mjs` com init/setup/ready, `module/config.mjs` (dados, cores, formas,
  traços, tipos, escalas e preços padrão), logger. *Dep:* T-002.
- [x] **T-102 Campos e modelos de Actor.** `module/data/fields.mjs` (DieField), `data/actor/crew.mjs`, `npc.mjs`,
  `location.mjs` conforme `docs/05`, com `prepareDerivedData` (Vida máx., Roles primária/secundária, dados de Grana).
  *Dep:* T-101. *Par:* T-103.
- [x] **T-103 Modelos de Item.** `data/item/distinction.mjs`, `talent.mjs`, `specialty.mjs`, `asset.mjs`, `job.mjs`.
  *Dep:* T-101. *Par:* T-102 (um builder por 2–3 tipos).
- [x] **T-104 Documents.** `documents/actor.mjs` (getRollData, helpers: `addPlotPoints`, `money.*`, limite de 3
  Distinctions, sugestão d8/d6 de Signature Asset), `documents/item.mjs`. *Dep:* T-102, T-103.
- [x] **T-105 Lógica pura + testes.** `dice/die.mjs`, `dice/pool-roll.mjs` (mantidos, 1s, PP extras),
  `rules/money.mjs` (degraus ↔ dados, preços, pagar, emprestar), `rules/stars.mjs`, `rules/combat.mjs`, com testes
  em `tests/unit/` cobrindo casos de borda. *Dep:* T-101. *Par:* T-102, T-103.
- [x] **T-106 Configurações.** `module/settings.mjs` com todas as chaves de `docs/09` (menus podem ser stubs aqui).
  *Dep:* T-101.
- [x] **R-F1 Revisão de fase** (`integration-reviewer`).

## Fase 2 — Componentes visuais base

- [x] **T-201 Fontes e tokens.** `fonts/` (Anton, Barlow Condensed, Special Elite + licenças OFL), `styles/tokens.css`,
  `styles/base.css` com as classes de `docs/04` (painel, cabeçalho de painel, linha plana/acesa, chip, papel, X,
  scroll). *Dep:* T-101.
- [x] **T-202 Componente de dado.** `applications/components/die.mjs` + helper `{{lvDie}}` + CSS: formas, cores,
  estados (`value`, `muted`, `deep`, `kept`, `one`, `money`), número dentro, tamanhos 28/32/36/38/50. Página de
  teste visual (`tests/foundry/die-gallery`) com todos os estados, comparada a `docs/03`. *Dep:* T-201.
- [x] **R-F2 Revisão de fase.**

## Fase 3 — Ficha da Equipe

- [x] **T-301 Estrutura da ficha.** `applications/actor/base-actor-sheet.mjs` e `crew-sheet.mjs` com PARTS, tamanhos,
  barra de título com selo da trava, registro da ficha. Templates vazios por parte. *Dep:* T-104, T-202.
- [x] **T-302 Cabeçalho.** Mugshot (parede + régua + imagem ancorada embaixo, FilePicker), nome, apelido, Vida e
  Colete (popover), Booking Card com digital (SVG em `assets/`). *Dep:* T-301. *Par:* T-303, T-304, T-305.
- [x] **T-303 Attributes e Roles.** Escadas de dados, mudança de valor respeitando a trava, tooltips, Role em branco.
  *Dep:* T-301. *Par:* T-302, T-304, T-305.
- [x] **T-304 Distinctions, Talents, Specialties.** Linhas planas, d8/d4, cards de Talent que abrem o item, grade de
  Specialties, "+ ADD" no cabeçalho, X, estados vazios, trava. *Dep:* T-301. *Par:* T-302, T-303, T-305.
- [x] **T-305 Assets e pasta.** Lista de Assets com etiquetas e diálogo de criação (Signature / Job 2 PP / Scene 1 PP),
  pasta BACKGROUND/JOBS com memória da orelha, linhas de Job (SPENT, `$`, callback, X), TRAIN UP (diálogo com custos),
  + LOG. *Dep:* T-301. *Par:* T-302, T-303, T-304.
- [x] **T-306 Arrastar e soltar.** Itens para a ficha, reordenar, Jobs entre fichas, criar macro arrastando Traço.
  *Dep:* T-304, T-305.
- [ ] **T-307 Fidelidade visual da ficha.** `tester` tira prints nos três estados (BACKGROUND, JOBS, destravada) com
  dados iguais aos do mockup; `reviewer` compara com os PNGs; correções até passar. *Dep:* T-302…T-306.
- [ ] **R-F3 Revisão de fase.**

## Fase 4 — Itens

- [x] **T-401 Ficha de item base** (`item-sheet.mjs`, mesma linguagem do `talent-item-window.png`) e PARTS por tipo:
  Distinction, Talent (Role, custo FREE/1 PP, Activation, Effect, dado opcional), Specialty, Asset (dado, duração,
  nota, arma), Job (rendimento total e parte, callback, gasto, notas). Botão de apagar no rodapé. Ícones padrão por
  tipo em `assets/`. *Dep:* T-103, T-202. *Par:* um builder por 2–3 tipos.
- [ ] **R-F4 Revisão de fase.**

## Fase 5 — Pool, rolagem e chat

- [x] **T-501 DicePool e bandeja.** Estado do cliente, regras de obrigatórios/opcionais, chips, + DIE, ROLL, contador,
  borda acesa nas linhas da ficha. *Dep:* T-303, T-304, T-305.
- [ ] **T-502 Rolagem e card.** `pool-roll` integrado ao `Roll` do Foundry, card de chat igual ao mockup, flags,
  d4 de Distinction dá PP, Grana desce degrau. *Dep:* T-501, T-105.
- [ ] **T-503 Ações do card.** "+1 PP · KEEP 3RD DIE", "GM · COMPLICATION" (com Rastreador do Job), permissões via
  socket. A Complication é gravada direto na configuração `activeJob` (a interface do Rastreador vem na T-703).
  *Dep:* T-502.
- [ ] **T-504 Rolador de oposição** e card do mestre (2d6, polícia pelas estrelas, gangue, NPC, local,
  complicações). *Dep:* T-502.
- [ ] **T-505 API e macros.** `game.leverage.*`, `docs/macros.md` com exemplos testados. *Dep:* T-502.
- [ ] **T-506 Dice So Nice** (opcional, só se simples). *Dep:* T-502.
- [ ] **R-F5 Revisão de fase.**

## Fase 6 — Regras da casa

- [ ] **T-601 Vida e Colete.** Barra do token, popover, regras de recuperação, liga/desliga. *Dep:* T-302.
- [ ] **T-602 Dano e Wasted/Busted.** "APPLY DAMAGE" no card de oposição, cobertura, colete, mensagens WASTED/BUSTED
  estilizadas, perda de Assets de arma de cena, pagamento. *Dep:* T-504, T-601.
- [ ] **T-603 Grana.** Escada, pagar com a tabela de preços, emprestar (socket via mestre), Grana na Pool, Jobs com
  rendimento. *Dep:* T-105, T-502.
- [ ] **T-604 Estrelas.** Configuração `wanted`, escalas por cidade (app de edição), Pool da polícia no rolador.
  *Dep:* T-504.
- [ ] **R-F6 Revisão de fase.**

## Fase 7 — HUD e ferramentas do mestre

- [ ] **T-701 HUD.** Posição presa à barra lateral, estrelas (só mestre clica), Grana (clique esquerdo/direito),
  Plot Points, minimizar, esconder partes, estado vazio. Prints comparados a `hud-*.png`. *Dep:* T-603, T-604.
- [ ] **T-702 Controles do mestre.** Grupo "Leverage" com todas as ferramentas de `docs/09`. *Dep:* T-106.
- [ ] **T-703 Rastreador do Job.** Job ativo, Complications, Traços de cena, visão da Equipe. *Dep:* T-702.
- [ ] **T-704 Encerrar cena / Novo Job / Encerrar Job / Nova sessão / Dar PP.** *Dep:* T-703, T-305.
- [ ] **T-705 Apps de configuração** (escalas de cidade, preços, custos de evolução). *Dep:* T-106.
- [ ] **R-F7 Revisão de fase.**

## Fase 8 — NPC e Local

- [ ] **T-801 Ficha de NPC** (tiers, Traços, gangue, arma, polícia, ROLL AS OPPOSITION). *Dep:* T-504.
  *Par:* T-802.
- [ ] **T-802 Ficha de Local.** *Dep:* T-301. *Par:* T-801.
- [ ] **R-F8 Revisão de fase.**

## Fase 9 — Acabamento

- [ ] **T-901 i18n completo** (`scribe`): nenhuma string fixa; pt-BR revisado. *Dep:* tudo acima.
- [ ] **T-902 Compêndio de exemplo** com a Rosa Delgado do mockup, NPCs (gangue de rua, polícia de choque), um Local,
  Talents e Assets de exemplo **próprios** (não copiados do livro). *Dep:* T-401, T-801.
- [ ] **T-903 Migração e versão 0.1.0**, `CHANGELOG.md`, `tools/release.mjs` gera `dist/leverage-gta.zip` sem
  `docs/`, `reference/`, `tests/`, `scripts/`, `.claude/`. *Dep:* tudo acima.
- [ ] **T-904 Documentação de uso** `docs/USO.md` em pt-BR para o mestre e os jogadores (com prints). *Dep:* T-903.
- [ ] **R-F9 Revisão de fase.**

## Revisão final

- [ ] **R-FINAL.** `integration-reviewer` faz duas passadas: (1) código e arquitetura completos; (2) uso real no
  Foundry, clicando em tudo como mestre e como jogador (prints). Builders corrigem. Segunda rodada do revisor só nos
  pontos corrigidos. Escreva `docs/log/FINAL-REPORT.md`: o que ficou pronto, o que ficou de fora e por quê, problemas
  conhecidos, decisões tomadas sozinho, o que o dono precisa testar na mesa. Depois: `DONE` em `STATUS.md`.
