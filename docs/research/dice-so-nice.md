# Dice So Nice (DSN): cores por dado, animação e resultados forçados

## 1. Pergunta
Como registrar cores/dados customizados no Dice So Nice e como disparar a animação de uma rolagem (inclusive com
resultados já decididos) na v14?

## 2. Resposta
Fonte: repositório oficial `https://gitlab.com/riccisi/foundryvtt-dice-so-nice` (clonado em `.cache/research/dsn`).
Docs em `docs/src/content/docs/api/*.md`, publicadas em `https://riccisi.gitlab.io/foundryvtt-dice-so-nice/api/`.

- **Compatibilidade:** `module/module.json` = DSN 6.4.4, `minimum: 14`, `verified: 14.368`.
- **Opcional:** use `game.dice3d?.` e `Hooks.once("diceSoNiceReady", ...)` (só dispara com o DSN ativo). Não declare o
  DSN como dependência no `system.json`.
- **Registrar cores:** `dice3d.addColorset({name, description, category, foreground, background, outline, edge,
  texture, material, font})` dentro de `diceSoNiceReady` (`api/customization.md`, "Adding a custom colorset").
  `material`: plastic, metal, glass, wood, chrome, stone, velvet, resin, frosted, pristine, iridescent.
  `outline`/`edge` aceitam `'none'`. Campos omitidos seguem a config do jogador; preencha todos para travar o visual.
  Para virar o padrão de jogadores novos: `dice3d.addRole({id:'basic', defaults:{global:{colorset:'x'}}},
  {package:'leverage'})` (quem já salvou config mantém a sua).
- **Cor de UM dado numa rolagem (o que a Pool precisa)**, `api/customization.md` "Changing the appearance of dice in a
  Roll":
  1. flavor: `1d8[leverage-d8]`
  2. `roll.dice[i].options.appearance = { colorset: 'leverage-d8' }` (ou campos soltos: foreground, background,
     outline, edge, texture, material, font, system). O do termo vence o de `Roll.options`.
  3. papel: `term.options.dsnRole = 'cash'` + `dice3d.addRole(...)` (`api/roles.md`). Mais pesado; deixa o mestre
     reajustar. Para nós, a opção 2 basta: 1 termo `Die` por dado da Pool.
- **Disparar a animação:**
  - Normal: `ChatMessage.create({ rolls:[roll], ... })` ou `roll.toMessage()`. O DSN intercepta a mensagem, esconde o
    card e o mostra quando os dados param. **Não precisa chamar a API.**
  - Sem mensagem: `await game.dice3d.animateRoll(roll, messageData, {messageMode})` (`api/roll.md`); vai a todos os
    clientes que podem ver; resolve ao fim.
  - Baixo nível: `game.dice3d.showForRoll(roll, user, synchronize, whisper, blind, chatMessageID, speaker, opts)`.
    `synchronize=true` é obrigatório para os outros jogadores verem. `whisper=null` = todos.
  - Sem `Roll`: `game.dice3d.show({throws:[{dice:[{type:'d8', result:5, resultLabel:5, vectors:[], options:{}}]}]},
    user, synchronize)`. O resultado é dado por você: a forma mais direta de "resultado forçado".
- **Resultado forçado com `Roll`:** o DSN nunca decide o número; faz os dados pousarem em `term.results`
  (`api/interactive-throws.md`: só mostra o resultado que o Foundry já produziu). Forçar = entregar um `Roll` já
  avaliado com os `results` escolhidos (avaliar e sobrescrever `die.results[0].result`, ou `Roll.fromData` com termos
  `evaluated: true`). Padrão comum, mas **não está na doc do DSN: teste no Foundry real** (T de rolagem).
- **Pular animação:** `flags["dice-so-nice"].skip = true` na mensagem (seguro em multiplayer);
  `die.results[0].hidden = true` esconde um dado só.
- **Evitar spoiler em outra mensagem:** o DSN esconde só mensagens com `rolls`. Ligue mensagens auxiliares com
  `flags["dice-so-nice"].linkedTo = <id da principal>` (crie a principal antes), ou envolva o trecho em elemento com
  `data-message-id="<id>"` (`api/companion-messages.md`, `api/roll.md`).
- **Hooks:** `diceSoNiceReady(dice3d)`, `diceSoNiceInit(dice3d)`, `diceSoNiceRollStart(messageId, context)`,
  `diceSoNiceRollComplete(messageId, companionIds)` (só rolagens vindas de chat),
  `diceSoNiceMessagePreProcess(messageId, interception)` (`interception.willTrigger3DRoll = false` suprime).
- **Dado de Grana:** sem forma nova; use um d4..d12 com colorset verde-dinheiro (`leverage-cash`). Faces próprias só
  com `CONFIG.Dice.terms[...]` + `addDicePreset` (`api/terms.md`); desnecessário aqui.
- **Exemplo real (Cortex Prime, mesma regra "2 maiores, 1 não conta"):**
  `https://github.com/Secular12/cortexprime/blob/main/module/scripts/rollDice.js` avalia `d8+d6+...` e chama
  `game.dice3d.showForRoll(r, game.user, true)` à mão porque a mensagem dele não leva `rolls`. Nós levamos.

## 3. Esboço (nomes do projeto)
```js
// module/dice/dice-so-nice.mjs
import { LEVERAGE } from "../config.mjs"; // LEVERAGE.diceColors = { d4:{bg,fg}, ..., cash:{bg,fg} }

export function registerDiceSoNice() {
  Hooks.once("diceSoNiceReady", (dice3d) => {
    for (const [key, c] of Object.entries(LEVERAGE.diceColors)) {
      dice3d.addColorset({
        name: `leverage-${key}`, description: `Leverage ${key}`, category: "Leverage: Liberty City",
        foreground: c.fg, background: c.bg, outline: "black", edge: c.bg, material: "plastic",
      });
    }
  });
}

/** Um termo Die por dado da Pool; a cor vem do tamanho (ou "cash"). */
export async function evaluatePool(pool /* [{faces, kind}] */) {
  const roll = await new Roll(pool.map((d) => `1d${d.faces}`).join(" + ")).evaluate();
  roll.dice.forEach((die, i) => {
    const key = pool[i].kind === "cash" ? "cash" : `d${die.faces}`;
    die.options.appearance = { colorset: `leverage-${key}` };
  });
  return roll; // depois: ChatMessage.create({ rolls: [roll], flags: { leverage: {...} } })
}
```
A ordem dos dados no card = ordem dos termos (um termo por dado), como pede `docs/08`.

## 4. Gotchas e versões
- Defina `options.appearance` depois de `evaluate()` e antes de criar a mensagem. `Roll#toJSON` guarda as `options`
  dos termos, então a cor sobrevive à serialização (confirmar no teste).
- `roll.dice` só contém `Die`; os `+` são `OperatorTerm` e não entram.
- O 1 "fora" anima como 1 normal; "1 · OUT" é do card (CSS), não do DSN.
- `message.update({flags})` sem adicionar `rolls` não re-anima (bom para KEEP 3RD DIE). Se um update adicionar rolls,
  o DSN esconde `.dice-roll`; ajuste com `dice3d.setMessageUpdateHideSelector(".leverage-die")` em `diceSoNiceInit`.
- A API de `addColorset` mudou na 4.0 (`default` virou `preferred`); o formato acima vale para 6.x.
- Testar sem o DSN (nada quebra), com ele (cores certas, 1 termo por dado) e com 2 clientes (B vê a animação de A).
- Wiki antiga no GitLab (`/-/wikis/API/...`) devolve 404; use o site `riccisi.gitlab.io` ou o repositório.
