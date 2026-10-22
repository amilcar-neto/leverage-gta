# 05 — Modelo de dados

Campos com `foundry.data.fields`. "Dado" = `DieField`: inteiro em `[4, 6, 8, 10, 12]`, opcionalmente `nullable`.
Valores marcados *derivado* são calculados em `prepareDerivedData` e **não** são salvos.

## Actor `crew` (Equipe)

| Campo | Tipo | Padrão | Notas |
| --- | --- | --- | --- |
| `alias` | String | `""` | Apelido ("La Zorra") |
| `attributes.{agility,alertness,intelligence,strength,vitality,willpower}.die` | DieField | `6` | d4–d12 |
| `roles.{grifter,hacker,hitter,mastermind,thief}.die` | DieField nullable | `null` | Em branco permitido |
| `roles.*.primary` / `secondary` | *derivado* | | Maior Role = primária; segunda maior = secundária (empate: ordem fixa) |
| `life.value` | Integer ≥ 0 | = max | Regra da casa "Vida" |
| `life.max` | *derivado* | | `lifeBase` (config, 10) + `attributes.vitality.die` |
| `vest.value` | Integer ≥ 0 | `0` | |
| `vest.max` | Integer ≥ 0 | `0` | Definido ao comprar (4/6/10) |
| `vest.kind` | String | `"none"` | `none` · `light` · `standard` · `heavy` |
| `plotPoints.value` | Integer ≥ 0 | `1` | |
| `money.steps` | Integer 0–25 | `2` (config) | Regra da casa "Grana" |
| `money.dice` | *derivado* | | Lista de tamanhos para exibir, menor à esquerda (ver `rules/money.mjs`) |
| `booking.{number,height,weight,age,eyes,hair,build,marks}` | String | `""` | Booking Card |
| `background` | HTML | `""` | Pasta → BACKGROUND |

Itens permitidos: `distinction` (máx. 3), `talent`, `specialty`, `asset`, `job`.

## Actor `npc` (pessoas do mestre)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `tier` | String | `extra` · `foil` · `mark` · `agent` |
| `traits` | Array de `{ name: String, die: DieField }` | Extras usam só isto |
| `attributes`, `roles` | iguais ao `crew`, todos nullable | Foils/Agents podem ter ficha completa |
| `gang.size` | Integer ≥ 0 | **Capangas** (na ficha: "Capangas" / "Henchmen"; Ganging Up do livro): cada um soma um dado. O campo continua `gang` |
| `gang.die` | DieField nullable | Tamanho do dado de cada capanga |
| `life.value`, `life.max` | Integer ≥ 0 | `life.max` deriva da Vitality quando o NPC tem uma; senão vale o salvo (mestre define) |
| `vest.kind`, `vest.value`, `vest.max` | String · Integer | iguais ao `crew`; `vest.max` vem do tipo |
| `weapon.die` | DieField nullable | Dado de dano da arma (regra da casa: d6 pistola, d8 escopeta/rifle) |
| `police` | Boolean | Se derrubar alguém, é **Busted** em vez de Wasted |
| `notes` | HTML | |

## Actor `location`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `traits` | Array de `{ name, die }` | DARK CORNERS d8, ON FIRE d8… |
| `city` | String | id de cidade das escalas de estrelas (opcional) |
| `npcs` | Array de String | UUIDs de NPCs ligados ao local (só o mestre vê; arrastar da barra lateral para a ficha) |
| `scene` | String (UUID de Cena) | `DocumentUUIDField` tipo Scene, vazio por padrão. Quando essa Cena está sendo vista, os Traços do Local entram no painel de cena, na Pool e no Rolador de oposição (união, sem repetir, com os Locais que têm token na Cena). Não nasce OBSERVER: os jogadores leem os Traços por `game.actors`; abrir a ficha exige dar permissão ao Local. O id de cada Traço na Pool é `<idDoLocal>-<slug do nome>-<n>` (n = ordem entre nomes iguais), estável ao reordenar |
| `notes` | HTML | |

## Items

### `distinction`
| Campo | Tipo | Notas |
| --- | --- | --- |
| `note` | String | Quando ajuda / quando atrapalha (uma frase; aparece numa linha com tooltip) |
| `description` | HTML | Texto longo opcional |

### `talent`
| Campo | Tipo | Notas |
| --- | --- | --- |
| `role` | String | chave de Role ou `open` |
| `cost` | Integer | `0` (grátis) ou `1` (1 PP para ativar) |
| `activation` | String | "When…" (uma linha no card da ficha) |
| `effect` | HTML | |
| `die` | DieField nullable | Se o efeito soma um dado à Pool (opcional) |

### `specialty`
| Campo | Tipo | Notas |
| --- | --- | --- |
| `role` | String | chave de Role |
| `description` | HTML | opcional |

Ao entrar na Pool soma **d6** (`CONFIG.LEVERAGE.specialtyDie`).

### `asset`
| Campo | Tipo | Notas |
| --- | --- | --- |
| `die` | DieField | Signature: 1º d8, depois d6 (sugestão automática ao criar); Job/Scene: d6 |
| `duration` | String | `signature` · `job` · `scene` |
| `note` | String | uma linha |
| `weapon` | Boolean | Arma: perde-se no Wasted/Busted se `duration = scene` |
| `purchased` | Boolean | Comprado com Grana (para relatórios) |
| `boost` | Integer 0..4 | Passos temporários para cima por Opportunity (até d12, "Encerrar cena" zera). Dado rolado = `die` subido `boost` vezes (`effectiveDie`) |

### `job`
Um tipo só, dois papéis. O Item **de mundo** (diretório de Itens, `game.items`, sem dono Ator) é o **Job do mestre**; o Item **embutido** na ficha de um Crew é o **Record** daquele Job (copiado ao encerrar). `status` só vale no Job de mundo; o Record o ignora.

| Campo | Tipo | Notas |
| --- | --- | --- |
| `status` | `planned · active · done` | Só no Job de mundo. Um `active` por vez (iniciar um põe os outros em `planned`). Record antigo recebe `planned` e ignora |
| `goal` | String | Objetivo, uma linha (no Job de mundo e no Record) |
| `payout.total` | Integer ≥ 0 | Degraus que o Job rendeu à Equipe (gravado ao encerrar) |
| `payout.share` | Integer ≥ 0 | Só no Record: degraus que este personagem recebeu (coluna `$`) |
| `payout.crew` | Array de `{ actorUuid, name, share }` | Só no Job de mundo: a parte de cada Crew, gravada ao encerrar. Vazio antes de encerrar |
| `callbackUsed` | Boolean | Só no Record. Callback usado nesta sessão (o mestre zera em "Nova sessão") |
| `spent` | Boolean | Só no Record. Gasto em evolução: não pode mais callback; aparece riscado com SPENT |
| `sort` | (do Foundry) | ordem na lista |
| `notes` | HTML | Cliente, alvo, resumo |

O Record guarda a ligação ao Job de mundo em `flags.leverage-gta.jobUuid`. O Job de mundo `planned` nasce com `ownership.default = NONE` (a trama futura não vaza aos jogadores). Iniciar (`active`) sobe para OBSERVER (sem isso o Item nem chega ao cliente do jogador); encerrar mantém OBSERVER; voltar a `planned` volta a NONE. Quando visíveis, nome, objetivo, notas e pagamento são lidos por todos, então o Job **não guarda segredos**; só o mestre edita. O Job **não** guarda Complications nem Traits (são da mesa, `module/table-state.mjs`).

## Configurações de mundo com dados (detalhes em `docs/09`)

- `wanted`: `{ city: "liberty", level: 0..5 }`
- `cityScales`: `[{ id, name, levels: [[8,6],[10,6],[12,6],[12,12],[12,12,8]] }, …]` (padrão: as três cidades)
- `prices`: `[{ id, label, dice: [6] }, …]` (padrão: tabela de `docs/02`)
- `activeJob`: **aposentado** na 0.1.2 (o Job ativo é o Item de mundo `job` com `status: active`). O setting continua registrado só para a migração 0.1.2 ler e zerar; nada mais o lê.
- `globalTraits` e `complications`: `[{ id, name, die }]` cada um, estado da mesa independente do Job e da Cena (começam em d6). Acesso só por `module/table-state.mjs`. Os Traços de uma cena vêm do Lugar (`system.scene` + `system.traits`), não de flag. Migração 0.1.1: `activeJob.complications` -> `complications`, `activeJob.sceneTraits` -> `globalTraits`; os flags de Traços da Cena foram descartados.
- `rules.rollMode` (`"classic"` por enquanto, `"prime"` depois da T-1006), `rules.oppositionChoice` (`"auto"` ou `"choose"`, padrão `auto`), `rules.heroicSuccess` (Boolean, padrão `true`): rolagem Cortex Prime (docs/08).
- `playersCanUnlock`: Boolean (padrão `true`). A trava de cada ficha fica no flag do ator `flags.leverage-gta.sheetUnlocked` (ausente = travada).

## Flags de mensagens de chat (`flags.leverage-gta.*`)

### `roll`: card de rolagem (Pool do jogador ou oposição do Mestre)

```js
{
  v: 2,                             // versão dos dados; ausente = card antigo (normalizeRoll lê como v 1)
  status: "pending" | "resolved",   // pending: card inativo, sem total; resolved: vale (v1 sempre resolved)
  actorUuid, actorName, actorImg,   // vazios no card de oposição (cabeçalho "FIXER")
  flavor,                           // descrição da ação (subtítulo)
  entries: [{ ref, label, kind, faces, result, kept, one, effect, paid }],   // na ordem em que aparecem
  // kept = está no total; one = hitch (tirou 1); effect = é o dado de efeito; paid = comprado com PP (está no total)
  // kind: "attribute" | "role" | "specialty" | "asset" | "talent" | "distinction" | "money" | "scene" | "die"
  //       | "opposition" (dados do card do Mestre)
  selection: { total: [0, 1], effect: [2] } | null,  // índices escolhidos; null enquanto pending
  keptCount: 2, total,              // total é null enquanto pending
  effectDie: 8 | null,              // tamanho do dado de efeito (4 se nada sobrou); null em pending e em cards classic/v1
  hitches: 1, botch: false,         // quantos 1; botch = todos os dados são 1 (total 0)
  ppSpent: 0,
  distinctionPP: 0,          // PP ganhos por d4 de Distinction nesta rolagem
  complicationsResolved: [], // índices de 1s já transformados em Complication pelo mestre
  money: false,              // se um dado de Grana entrou (desconta 1 degrau ao rolar)

  // só no card de oposição:
  opposition: true,
  source: "manual+police+gang+picked",  // atalhos usados, separados por "+"; "none" = sem oposição; "macro" = API
  opportunities: 0, opportunitiesUsed: 0,  // hitches do Fixer (uso na tarefa T-1010)
  damage: { /* DamageRecord */ },       // gravado depois de APLICAR DANO (dano.mjs)

  // opcional, só em Pool de jogador resolvida contra um card do Fixer:
  versus: { messageId, difficulty, margin, outcome: "success" | "fail" | "heroic", effectDie }
}
```

Os campos de antes (`kept`, `one`, `keptCount`, `total`, `ppSpent`, `distinctionPP`, `complicationsResolved`) mantêm o
significado; os novos só se somam. `normalizeRoll(data)` (`module/dice/roll-core.mjs`) lê qualquer versão: card antigo vira
`v: 1`, `status: "resolved"`, `effect/paid: false`, `effectDie: null`, `hitches` contados dos 1s e `selection` dos `kept`.
Modo `classic` (`rules.rollMode`): `v: 2`, resolvido na hora, `selection.effect` vazio e `effectDie: null`.

Regras do card: um card `pending` não vale nada (sem total, sem PP gasto, sem dano) até o dono confirmar a escolha na janela
"Escolher dados" (2 dados no total, 1 de efeito, dados pagos com PP à parte; hitch nunca é escolhido; dado pago nunca é
efeito). Só a rolagem **mais recente** da personagem no chat pode gastar PP em mais um dado, e só o jogador dono (o Mestre
não conta como dono). Os Plot Points e a Grana da rolagem só são aplicados depois que a mensagem existe. O `versus` liga
cards só por `messageId` explícito; sem ele, o dano liga o card de oposição à rolagem anterior mais próxima de uma personagem.

`DamageRecord` (uma rodada de dano): `targetUuid, targetName, margin, weaponDie, weaponRoll, raw, cover, damage,
absorbed, lifeLost, life, vest, lifeMax, down, kind` (`"wasted"`, `"busted"` ou `null`).

### `damage`: linha de dano

Na mensagem de texto da rodada de dano: o mesmo `DamageRecord`.

### `down`: card WASTED / BUSTED

`{ kind: "wasted" | "busted", name }`: só marca o card (o conteúdo é HTML pronto).

## Flag de Macro `flags.leverage-gta.traitMacro`

`true` nas macros de script criadas ao arrastar um Traço da ficha para a barra de atalhos (`pool.add(actor, ref)`). Serve
para reconhecer e reaproveitar a macro em vez de criar outra igual.

## Campos de Item só do Mestre

Depois que o Item existe, o jogador **não** muda: no Asset, `die` e `duration`; no Job, `payout.share` e `spent`.
A lista está em `LEVERAGE.protectedItemFields`; as fichas de Item mostram esses campos desabilitados quando
`canEditProtected` é falso e descartam o campo se um formulário adulterado o enviar.

## Migração

Inclua `module/migration.mjs` desde a primeira versão com `systemMigrationVersion` (configuração escondida), mesmo
vazio: o dnd5e mostra o padrão. Toda mudança de esquema depois da 1.0 passa por migração.
