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
| `gang.size` | Integer ≥ 0 | Capangas extras (Ganging Up): cada um soma um dado |
| `gang.die` | DieField nullable | Tamanho de cada capanga |
| `weapon.die` | DieField nullable | Dado de dano da arma (regra da casa: d6 pistola, d8 escopeta/rifle) |
| `police` | Boolean | Se derrubar alguém, é **Busted** em vez de Wasted |
| `notes` | HTML | |

## Actor `location`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `traits` | Array de `{ name, die }` | DARK CORNERS d8, ON FIRE d8… |
| `city` | String | id de cidade das escalas de estrelas (opcional) |
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
- `activeJob`: `{ name, complications: [{ id, name, die }] }`
- `traitsLocked`: Boolean

## Mensagem de chat de rolagem — `flags.leverage-gta.roll`

```js
{
  actorUuid, flavor,
  entries: [{ ref, label, faces, result, kept, one }],   // na ordem em que aparecem
  keptCount: 2, total, ppSpent: 0,
  distinctionPP: 0,          // PP ganhos por d4 de Distinction nesta rolagem
  complicationsResolved: [], // índices de 1s já transformados em Complication pelo mestre
  money: false               // se um dado de Grana entrou (desconta 1 degrau ao rolar)
}
```

## Migração

Inclua `module/migration.mjs` desde a primeira versão com `systemMigrationVersion` (configuração escondida), mesmo
vazio: o dnd5e mostra o padrão. Toda mudança de esquema depois da 1.0 passa por migração.
