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

### `job`
| Campo | Tipo | Notas |
| --- | --- | --- |
| `payout.total` | Integer ≥ 0 | Degraus que o Job rendeu à Equipe |
| `payout.share` | Integer ≥ 0 | Degraus que este personagem recebeu (coluna `$`) |
| `callbackUsed` | Boolean | Callback usado nesta sessão (o mestre zera em "Nova sessão") |
| `spent` | Boolean | Gasto em evolução: não pode mais callback; aparece riscado com SPENT |
| `sort` | (do Foundry) | ordem na lista |
| `notes` | HTML | Cliente, alvo, resumo |

## Configurações de mundo com dados (detalhes em `docs/09`)

- `wanted`: `{ city: "liberty", level: 0..5 }`
- `cityScales`: `[{ id, name, levels: [[8,6],[10,6],[12,6],[12,12],[12,12,8]] }, …]` (padrão: as três cidades)
- `prices`: `[{ id, label, dice: [6] }, …]` (padrão: tabela de `docs/02`)
- `activeJob`: `{ name, goal }`. O Job é só nome e objetivo (vira Item numa fase seguinte).
- `globalTraits` e `complications`: `[{ id, name, die }]` cada um, estado da mesa independente do Job e da Cena (começam em d6). Acesso só por `module/table-state.mjs`. Os Traços de uma cena vêm do Lugar (`system.scene` + `system.traits`), não de flag. Migração 0.1.1: `activeJob.complications` -> `complications`, `activeJob.sceneTraits` -> `globalTraits`; os flags de Traços da Cena foram descartados.
- `playersCanUnlock`: Boolean (padrão `true`). A trava de cada ficha fica no flag do ator `flags.leverage-gta.sheetUnlocked` (ausente = travada).

## Flags de mensagens de chat (`flags.leverage-gta.*`)

### `roll`: card de rolagem (Pool do jogador ou oposição do Mestre)

```js
{
  actorUuid, actorName, actorImg,   // vazios no card de oposição (cabeçalho "FIXER")
  flavor,                           // descrição da ação (subtítulo)
  entries: [{ ref, label, kind, faces, result, kept, one }],   // na ordem em que aparecem
  // kind: "attribute" | "role" | "specialty" | "asset" | "talent" | "distinction" | "money" | "scene" | "die"
  //       | "opposition" (dados do card do Mestre)
  keptCount: 2, total, ppSpent: 0,
  distinctionPP: 0,          // PP ganhos por d4 de Distinction nesta rolagem
  complicationsResolved: [], // índices de 1s já transformados em Complication pelo mestre
  money: false,              // se um dado de Grana entrou (desconta 1 degrau ao rolar)

  // só no card de oposição:
  opposition: true,
  source: "manual+police+gang+picked",  // atalhos usados, separados por "+"; "none" = sem oposição; "macro" = API
  damage: { /* DamageRecord */ }        // gravado depois de APLICAR DANO (dano.mjs)
}
```

Regras do card: só a rolagem **mais recente** da personagem no chat pode manter outro dado ("+1 PP"), e só o jogador
dono (o Mestre não conta como dono). Os Plot Points e a Grana da rolagem só são aplicados depois que a mensagem existe.
Não existe campo `versus`: o dano liga o card de oposição à rolagem anterior mais próxima de uma personagem.

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
