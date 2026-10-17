# Macros e a API `game.leverage`

Tudo que a ficha e as ferramentas do Mestre fazem também pode ser feito por macro. A API fica em `game.leverage`
(criada no hook `setup`, antes de qualquer macro rodar). O código está em `module/api.mjs`, com JSDoc.

Todos os exemplos abaixo são do tipo **Script** (macro de script do Foundry). Eles são executados de verdade por
`tests/foundry/T-505.mjs` num Foundry local, como Mestre e como jogador, e os efeitos são conferidos. Se você mudar um
exemplo, rode `npm run deploy` e `node tests/foundry/T-505.mjs`.

> Convenção: `"Nome da Personagem"` é o nome de uma personagem da Equipe do seu mundo. Troque pelo nome real.
> Também dá usar `game.user.character` ou `canvas.tokens.controlled[0]?.actor`.

## Regras gerais

- Erros de uso (Pool inválida, valor fora da faixa, cidade que não existe) **não lançam exceção**: mostram um aviso na
  tela, como a bandeja da ficha, e a função devolve `null` ou `false`.
- O **Mestre** pode tudo. Um **jogador** pode rolar, ganhar/gastar Grana e Plot Points **das personagens que ele
  possui**. Estrelas, trava de Traços, Jobs, oposição e personagens de outros jogadores são só do Mestre (aviso e
  `false`). `money.transfer` entre personagens de donos diferentes passa pelo Mestre via socket.
- Onde a função pede uma personagem (`actor`) vale o documento, o UUID ou o id.
- O hook `leverage.ready` dispara quando a API está pronta, recebendo o próprio objeto.

| Grupo | Funções |
| --- | --- |
| Rolagem | `rollPool({ actor, refs, flavor })` |
| Oposição (Mestre) | `opposition({ dice, label })`, `openOppositionRoller()` |
| Grana | `money.get/add/pay/set/transfer` |
| Estrelas | `stars.get/city/cities/state/set/raise/lower/clear` (alterar é só do Mestre) |
| Plot Points | `plotPoints.get/add/spend/give` |
| Trava de Traços (Mestre) | `traits.lock/unlock/isLocked` |
| Job (Mestre) | `job.get/new/end/newSession/endScene`, `jobTracker.open()` |

## Rolagem

`rollPool` monta a Pool sem abrir a ficha, valida como a bandeja (1 Attribute e 1 Role com dado, no máximo 1
Distinction), rola com o mesmo núcleo e cria o mesmo card no chat. O dado de Grana gasta 1 degrau e uma Distinction
como d4 dá 1 Plot Point, exatamente como na ficha.

Referências aceitas:

| Referência | Dado |
| --- | --- |
| `attributes.agility` | o Attribute da personagem (`agility`, `alertness`, `intelligence`, `strength`, `vitality`, `willpower`) |
| `roles.thief` | o Role da personagem (`grifter`, `hacker`, `hitter`, `mastermind`, `thief`) |
| `item:<id>` | Specialty, Asset ou Talent com dado |
| `item:<id>:d8` / `item:<id>:d4` | Distinction usada a favor (d8) ou contra (d4) |
| `money` | o maior dado da Grana (regra da casa) |
| `d6` ou `6` | dado avulso (pode repetir) |

<!-- teste: ambos id=roll -->
```js
const actor = game.actors.getName("Nome da Personagem");
await game.leverage.rollPool({
  actor,
  refs: ["attributes.agility", "roles.thief", "d6"],
  flavor: "Arromba o cofre"
});
```

### Macro por referência de Traço

Arrastar um Attribute, Role, Specialty, Asset, Talent ou Distinction da ficha para a barra de atalhos cria um macro
assim (o UUID é o da personagem):

<!-- teste: ambos id=roll-ref -->
```js
const actor = game.actors.getName("Nome da Personagem");
game.leverage.rollPool({ actor, refs: ["attributes.agility"] });
```

Isso falha de propósito, com aviso, porque falta o Role. Para um macro que sempre rola uma combinação, junte as
referências, inclusive Itens da personagem:

<!-- teste: ambos id=roll-items -->
```js
const actor = game.actors.getName("Nome da Personagem");
const specialty = actor.items.find((i) => i.type === "specialty");
const distinction = actor.items.find((i) => i.type === "distinction");
await game.leverage.rollPool({
  actor,
  refs: ["attributes.agility", "roles.thief", `item:${specialty.id}`, `item:${distinction.id}:d4`],
  flavor: "Com a Specialty, atrapalhado pela Distinction"
});
```

### Rolar com Grana

<!-- teste: ambos id=roll-money -->
```js
const actor = game.actors.getName("Nome da Personagem");
await game.leverage.rollPool({ actor, refs: ["attributes.alertness", "roles.grifter", "money"], flavor: "Suborno" });
```

## Oposição (Mestre)

`opposition` rola a Pool do Mestre e cria o card "FIXER". Sem dados (`dice` vazio), rola 2d6 ("sem oposição").
`openOppositionRoller()` abre o montador visual.

<!-- teste: gm id=opposition -->
```js
await game.leverage.opposition({ dice: [10, 6], label: "Guardas na porta" });
```

<!-- teste: gm id=opposition-open -->
```js
await game.leverage.openOppositionRoller();
```

## Grana

Grana é guardada em degraus da escada (0 a 25; um d12 cheio vale 5). `pay` aceita degraus ou uma lista de dados (`[12, 6]`, convertida
pela escada) e não gasta nada se faltar. `add` devolve quantos degraus couberam.

<!-- teste: ambos id=money -->
```js
const actor = game.actors.getName("Nome da Personagem");
const { money } = game.leverage;
await money.set(actor, 4);
await money.add(actor, 2);                    // 6
const paid = await money.pay(actor, [8, 6]);  // { ok, steps, shortBy }
console.log(paid, money.get(actor));          // money.get -> { steps, dice }
await money.pay(actor, 1);                    // um degrau
```

Emprestar Grana a outra personagem (o que não passar do que o emprestador tem nem do teto do recebedor):

<!-- teste: ambos id=money-transfer -->
```js
const from = game.actors.getName("Nome da Personagem");
const to = game.actors.getName("Nome de Outra Personagem");
await game.leverage.money.transfer(from, to, 1);
```

## Estrelas de procurado (Mestre)

`stars.set(nivel, cidade)` grava a configuração `wanted`. O nível é um inteiro de 0 a 5 e a cidade precisa existir
em `stars.cities()`. Sem cidade, mantém a atual. Todo mundo pode ler.

<!-- teste: gm id=stars -->
```js
const { stars } = game.leverage;
await stars.set(3, "liberty");
await stars.lower();          // 2
await stars.raise(2);         // 4
console.log(stars.get(), stars.city(), stars.state());   // state -> { city, level, pool: [dados da polícia] }
await stars.clear();          // 0
```

Um jogador que tentar alterar recebe um aviso e `false`:

<!-- teste: jogador id=stars-player -->
```js
const ok = await game.leverage.stars.set(3);   // false
console.log(ok, game.leverage.stars.get());
```

## Plot Points

`add` e `spend` valem para o Mestre (qualquer personagem) e para o jogador (as suas). `give` é a ferramenta do Mestre
que também avisa no chat (sem lista, dá a todos da Equipe).

<!-- teste: ambos id=plot-points -->
```js
const actor = game.actors.getName("Nome da Personagem");
const { plotPoints } = game.leverage;
await plotPoints.add(actor, 2);
const have = plotPoints.get(actor);
const spent = await plotPoints.spend(actor, 1);   // false (com aviso) se não houver Plot Points
console.log(have, spent, plotPoints.get(actor));
```

<!-- teste: gm id=plot-points-give -->
```js
const actor = game.actors.getName("Nome da Personagem");
await game.leverage.plotPoints.give([actor], 1);
```

## Trava de Traços (Mestre)

<!-- teste: gm id=lock -->
```js
const { traits } = game.leverage;
await traits.lock();
console.log(traits.isLocked());   // true
await traits.unlock();
console.log(traits.isLocked());   // false
```

## Job, cena e sessão (Mestre)

`job.new(nome)` abre o Job (cada personagem recebe os Plot Points iniciais). `job.end({ name, total, shares })` paga a
Equipe: `shares` é um objeto id da personagem para degraus, e sem ele o total é dividido por igual. `job.endScene()`
remove os Assets de cena (passe `{ confirm: true }` para perguntar antes). `job.newSession()` devolve o Callback dos
Jobs. `jobTracker.open()` abre o Rastreador, quando existir.

<!-- teste: gm id=job-new -->
```js
await game.leverage.job.new("Assalto ao banco");
console.log(game.leverage.job.get());   // { name, complications, sceneTraits }
```

<!-- teste: gm id=job-end -->
```js
await game.leverage.job.end({ name: "Assalto ao banco", total: 6 });
```

<!-- teste: gm id=scene-session -->
```js
await game.leverage.job.endScene();
await game.leverage.job.newSession();
```

## Hook `leverage.ready`

Útil para módulos que estendem o sistema:

<!-- teste: gm id=hook -->
```js
Hooks.once("leverage.ready", (api) => console.log("API pronta", Object.keys(api)));
```
