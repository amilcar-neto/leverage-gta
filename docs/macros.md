# Macros e a API `game.leverage`

Tudo que a ficha e as ferramentas do Mestre fazem também pode ser feito por macro. A API fica em `game.leverage`
(criada no hook `setup`, antes de qualquer macro rodar). O código está em `module/api.mjs`, com JSDoc.

Todos os exemplos abaixo são do tipo **Script** (macro de script do Foundry). Eles são executados de verdade por
`tests/foundry/T-505.mjs` num Foundry real, como Mestre e como jogador, e os efeitos são conferidos. Esse Foundry fica
no servidor de testes (o VPS, veja `docs/13-ambiente-de-teste.md`): se você mudar um exemplo, rode `npm run deploy` e
`node tests/foundry/T-505.mjs`.

> Convenção: `"Nome da Personagem"` é o nome de uma personagem da Equipe do seu mundo. Troque pelo nome real.
> Também dá usar `game.user.character` ou `canvas.tokens.controlled[0]?.actor`.

## Regras gerais

- Erros de uso (Pool inválida, valor fora da faixa, cidade que não existe) **não lançam exceção**: mostram um aviso na
  tela, como a bandeja da ficha, e a função devolve `null` ou `false`.
- O **Mestre** pode tudo. Um **jogador** pode rolar, ganhar/gastar Grana e Plot Points **das personagens que ele
  possui**. Estrelas, trava de Traços, Jobs, oposição e personagens de outros jogadores são só do Mestre (aviso e
  `false`). `money.transfer` entre personagens de donos diferentes passa pelo Mestre via socket.
- Onde a função pede uma personagem (`actor`) vale o documento, o UUID ou o id.
- `plotPoints.add` e `money.set` são livres para o dono da personagem: o dono já pode editar os próprios valores na
  ficha, então a API não cria uma barreira que a ficha não tem (decisão registrada em `docs/log/DECISIONS.md`).
- O hook `leverage.ready` dispara quando a API está pronta, recebendo o próprio objeto.

| Grupo | Funções |
| --- | --- |
| Rolagem | `rollPool({ actor, refs, flavor })`, `pool.add(actor, ref)` |
| Oposição (Mestre) | `opposition({ dice, label })`, `openOppositionRoller()` |
| Grana | `money.get/add/pay/set/transfer`, `money.payDialog(actor)`, `money.lendDialog(actor)` |
| Estrelas | leitura: `stars.get/city/cities/state`. Alterar é só do Mestre: `stars.set/raise/lower/clear`, `stars.wait/disguise`. Dono ou Mestre: `stars.buySilence(actor)`, `stars.giveIn(actor)` |
| Plot Points | `plotPoints.get/add/spend/give` |
| Trava de Traços (Mestre) | `traits.lock/unlock/isLocked` |
| Job (Mestre) | `job.get/new/end/newSession/endScene`, `jobTracker.open()` |
| Combate (Mestre) | `combat.applyDamage({ target, margin, weaponDie, cover, byPolice })`, `combat.down(actor, { byPolice })` |

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
| `scene:<id>` | Traço de cena do Job ativo (`game.leverage.job.get().sceneTraits`) |
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
que chama `pool.add(actor, ref)`: abre a ficha da personagem (se estiver fechada) e põe o Traço na Pool da ficha, com as
mesmas regras da bandeja (um novo Attribute, Role ou Distinction troca o anterior). Só o dono ou o Mestre pode. Devolve
`false` (com aviso) se a referência não significa nada para a personagem. O UUID é o da personagem:

<!-- teste: ambos id=roll-ref -->
```js
const actor = game.actors.getName("Nome da Personagem");
await game.leverage.pool.add(actor, "attributes.agility");
```

Nada é rolado: o jogador completa a Pool na ficha e aperta ROLL. Para um macro que sempre rola uma combinação, use
`rollPool` e junte as referências, inclusive Itens da personagem:

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

`opposition` rola a Pool do Mestre e cria o card "FIXER". Sem dados (`dice` vazio), rola os dados de "sem oposição" (2d6, `LEVERAGE.defaultOppositionDice`).
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

Os atalhos de ação das estrelas (todos postam uma linha no chat "ESTRELAS: de N para M, motivo"):

<!-- teste: gm id=stars-actions -->
```js
const { stars } = game.leverage;
const actor = game.actors.getName("Nome da Personagem");
await stars.set(3, "liberty");
await stars.wait(1);                   // esperar fora de vista (grátis)
await stars.disguise("simple");        // disfarce que deu certo; "both" = carro e roupa
await stars.buySilence(actor);         // paga dados de Grana da personagem (dono ou Mestre)
await stars.giveIn(actor);             // última saída: estrelas vão a 0 (dono ou Mestre)
```

Um jogador que chama `buySilence` ou `giveIn` para a própria personagem passa pelo Mestre via socket; o Mestre
confere, pelo id do usuário que o servidor garante, que ele é dono da personagem.

## Combate (Mestre)

`combat.applyDamage` aplica uma rodada de dano (margem + dado da arma, cobertura divide, depois colete, depois Vida) e
posta a linha no chat. Se a Vida chega a 0, segue para `combat.down`, que cobra hospital ou fiança e posta o card
WASTED ou BUSTED. Ambos são só do Mestre e param quando a regra da casa de Vida está desligada.

<!-- teste: gm id=combat -->
```js
const actor = game.actors.getName("Nome da Personagem");
await game.leverage.combat.applyDamage({ target: actor, margin: 2, weaponDie: 8, cover: false, confirm: false });
await game.leverage.combat.down(actor, { byPolice: true, confirm: false });
```

## Diálogos de Grana

`money.payDialog(actor)` abre o diálogo de pagamento (tabela de preços ou preço livre em dados) e `money.lendDialog(actor)`
o de empréstimo. Servem para botões de macro; quem decide a quantia é a pessoa na janela.

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
Jobs. `jobTracker.open()` abre o Rastreador.

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
