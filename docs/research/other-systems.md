# Outros sistemas: pf2e, Lancer, Cortex Prime (só o que serve para Pool, HUD e cards)

## 1. Pergunta
O que de pf2e, Lancer e Cortex Prime vale copiar para a Pool de dados, o HUD fixo e os cards de chat do Leverage
na Foundry v14?

## 2. Resposta
Repositórios clonados em `.cache/research/{pf2e,lancer,cortexprime}`.

| Sistema | Declara | Uso |
| --- | --- | --- |
| pf2e `https://github.com/foundryvtt/pf2e` | `system.pf2e.json`: minimum 14.361, verified 14.369 | Referência v14 confiável |
| Lancer `https://github.com/Eranziel/foundryvtt-lancer` | `src/system.json`: 13 (min/verified/max) | Ideias; confirmar na v14 |
| Cortex Prime `https://github.com/Secular12/cortexprime` | 0.2.16, verified 13.342, ainda `FormApplication` | Só regras/fluxo da Pool |

### Cortex Prime: Pool de dados (o mais parecido com o Leverage)
- Mesma regra "2 maiores contam, 1 é hitch": `module/scripts/rollDice.js` (`getRollFormula`, `getRollResults`,
  `markResultTotals`). Monta `d8+d6+...`, avalia, separa 1s dos demais, ordena por valor e depois por faces.
  **Copiar a ideia:** função pura `[{faces,result}] -> {kept, ones, others, total}` sem Foundry, testável
  (`module/dice/pool-math.mjs`).
- A Pool dele vive em flag do usuário (`applications/UserDicePool.js`). Nós decidimos estado de cliente
  (`docs/08`): **não copiar**.
- Preset de dado de Plot Point (`cortexPrimeHooks.js`): irrelevante, nosso PP não rola.
- Chama `showForRoll(..., true)` à mão; nós levamos `rolls` na mensagem (ver `dice-so-nice.md`).

### pf2e: card de chat e HUD fora de janela
- **Card:** a subclasse sobrescreve `ChatMessage#renderHTML` (não usa o hook): `src/module/chat-message/document.ts`
  ~l.203-290. Chama `super.renderHTML`, injeta retrato no `header.message-header` e liga listeners com
  `ChatCards.listen(this, html)`. Em `listeners/cards.ts`: **delegação por `data-action`**
  (`button[data-action]`), anti-duplo-clique de 500 ms e checagem `actor.isOwner` antes de agir.
  **Copiar:** `LeverageChatMessage` em `CONFIG.ChatMessage.documentClass`, `data-action="keepThird|complication"`,
  checagem de dono/mestre no handler.
- Dados do card em `flags.pf2e` tipadas (`chat-message/data.ts`). Nós: `flags.leverage` (docs/05).
- **HUD sem janela:** `src/module/apps/effects-panel.ts` é `ApplicationV2` com
  `DEFAULT_OPTIONS = { id, tag:"article", window:{ frame:false, positioned:false }, actions:{...} }` e
  `PARTS.main = { template, root:true }`. Em `src/scripts/hooks/init.ts` (~l.52) insere um
  `<template id="pf2e-effects-panel">` logo após `#ui-top` como âncora de render. Re-render com
  `fu.debounce(this.render.bind(this), 100)`. Cliques: `actions.handleClick = { handler, buttons:[0,2] }`
  (esquerdo/direito).
  **Copiar para o HUD (estrelas, grana, PP):** o mesmo molde `frame:false`, âncora no `#interface` da v14, re-render
  debounced em `updateActor`/`updateUser`/mudança de Job.

### Lancer: card por template e HUD deslizante
- `src/module/flows/_render.ts`: `renderTemplateStep` renderiza `.hbs` com
  `foundry.applications.handlebars.renderTemplate`, junta **todos os `Roll` do card em um só `rolls[]`** (para o DSN
  animar junto) e faz `ChatMessage.create({ rolls, speaker, content, flags:{lancer} })`. **Copiar:** um
  `renderCard(data)` central, sem HTML por concatenação.
- Listeners em `Hooks.on("renderChatMessageHTML", (cm, el))` (`src/lancer.ts` ~l.524): `el` é `HTMLElement`. Lancer
  ainda embrulha em `$`; **use DOM puro**.
- HUD: `apps/slidinghud/index.ts` monta (Svelte) em `document.body`; `sidebar-width.ts` lê `#sidebar.offsetWidth`
  200 ms **depois** de `Hooks.on("collapseSidebar")`, esperando a transição. **Copiar:** esperar a transição antes de
  medir. Confirmar na v14 se `#sidebar` e `collapseSidebar` seguem iguais.
- Socket: `src/module/socket.ts` roteia por `msg.action` num único canal; bom padrão para "só o mestre aplica".

## 3. Esboço
```js
// module/documents/chat-message.mjs
export class LeverageChatMessage extends ChatMessage {
  /** @override */
  async renderHTML(options) {
    const html = await super.renderHTML(options);
    if (!this.isContentVisible || this.getFlag("leverage", "kind") !== "pool-roll") return html;
    for (const btn of html.querySelectorAll("button[data-action]")) {
      btn.addEventListener("click", (ev) => LeverageChatMessage.#onAction(this, ev, btn));
    }
    return html;
  }
  static async #onAction(message, event, btn) {
    const action = btn.dataset.action; // "keepThird" | "complication"
    if (action === "keepThird" && !message.isOwner) return;
    if (action === "complication" && !game.user.isGM) return;
    // atualizar flags (ou socket para o mestre) e re-renderizar
  }
}
// no init: CONFIG.ChatMessage.documentClass = LeverageChatMessage;

// module/applications/hud.mjs
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
export class LeverageHud extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = { id: "leverage-hud", tag: "aside", window: { frame: false, positioned: false } };
  static PARTS = { main: { template: "systems/leverage/templates/hud/hud.hbs", root: true } };
  refresh = foundry.utils.debounce(this.render.bind(this), 100);
}
```

## 4. Gotchas
- pf2e usa TypeScript, Vite e aliases (`@module/...`): copie o padrão, não os caminhos.
- Com `renderHTML` sobrescrito, `renderChatMessageHTML` ainda dispara; escolha um só lugar para os listeners
  (preferência: `renderHTML` da subclasse, como pf2e).
- Testar `isContentVisible` falso (mensagem sussurrada/cega) e jogador sem permissão.
- Jogador não-dono não pode `message.update`: use socket para o mestre (docs/08).
- Lancer e Cortex Prime não são v14: confirmar cada API em `https://foundryvtt.com/api/v14/` antes de copiar.
- Anchor do HUD (`#ui-top`, `#interface`) e `collapseSidebar` na v14 ainda precisam de nota própria (pergunta 5 de
  `docs/12-pesquisa.md`).
