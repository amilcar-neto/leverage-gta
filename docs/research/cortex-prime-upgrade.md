# Atualizar a rolagem para o Cortex Prime (escolher 2 dados + dado de efeito)

## 1. Pergunta

O dono quer trocar a mecânica "soma os 2 maiores" (Cortex Plus / Leverage clássico) pela do **Cortex Prime**: o
jogador escolhe **quaisquer 2 resultados** para o total e **1 dado de efeito**; hitches e oportunidades passam a ser
ativos; Plot Points e Complications seguem o Prime. A identidade do Leverage (Roles, Attributes, Distinctions, Jobs
como XP, Assets, Talents) fica. Como desenhar a janela, o que muda em `module/dice`, no card, na oposição, nos
hitches/oportunidades/PP, como migrar, e quanto trabalho dá?

## 2. Resposta curta (recomendação)

- **Fluxo recomendado: "rola primeiro, escolhe depois, com card já no chat".** ROLL posta o card imediatamente com uma
  escolha automática (os 2 maiores + maior dado restante como efeito, `status: "pending"`) e abre na máquina de quem
  rolou a janela **Escolher dados** (`ApplicationV2`, uma por mensagem). Confirmar grava a escolha na própria mensagem
  (`status: "resolved"`). Fechar sem confirmar deixa a escolha automática valer e o card ganha o botão **Escolher
  dados** (só o dono, só a rolagem mais recente dele, como já é hoje com o "+1 PP"). Assim a animação do Dice So Nice
  roda uma vez, o histórico do chat tem a ordem certa e nada fica travado esperando um jogador.
- **Núcleo puro novo** `module/dice/prime-math.mjs` (sem Foundry, testado em node) substitui `evaluatePool` /
  `keepNextDie`. `pool-roll.mjs` e `card-actions.mjs` ficam, mas a regra "2 maiores" vira só a **escolha automática
  inicial** e o modo "clássico".
- **Aditivo nos dados.** Os campos atuais de `flags.leverage-gta.roll` (`entries[].kept`, `.one`, `keptCount`, `total`,
  `ppSpent`, `complicationsResolved`) continuam existindo com o mesmo significado; só se **acrescentam** campos
  (`v: 2`, `status`, `entries[].effect`, `effectDie`, `hitches`, `botch`, `opportunities`, `versus`). Cards antigos
  continuam legíveis e **nenhuma mensagem nem ator precisa ser reescrito**. A migração é uma nova versão (0.2.0), uma
  configuração e textos de Talents.
- **Configuração** `rules.rollMode`: `"prime"` (padrão) ou `"classic"` (comportamento da 0.1.0: automático, sem dado de
  efeito). É a rede de segurança para o dono voltar atrás e para a mesa de teste existente.
- Estimativa: **17 tarefas**, ~5-7 sessões autônomas (lista na seção 8).

## 3. Regras do Cortex Prime que importam

Fonte: `reference/books/text/cortex-prime.txt` (texto em colunas e embaralhado; as linhas citadas são do arquivo).

| Regra | Texto do livro | Linhas |
| --- | --- | --- |
| Rolar | "choose two results to add together for your total, and a third die to use as the effect die". Com 1 dado, total = o dado. Sem 3º dado, efeito = **d4**. | 819-827 |
| Escolha livre | "free to choose any two dice... You don't need to choose the two highest"; o GM pode optar por sempre pegar os 2 maiores (moderar oposição). | 770-781 |
| Hitch | 1 não conta, **não pode ser dado de efeito**. O GM pode ativá-lo. 1 do GM = **opportunity**. Tudo 1 = **botch**. | 803-837 |
| Dado de efeito | Escolhido **depois** de tirar os dados do total. Só o **tamanho** importa, não o resultado. Dados comprados com PP para o total **não** podem ser efeito. Sem dado sobrando = d4. | 1030-1037 |
| Mais efeito | Subir/descer efeito por SFX; passou de d12 = nocaute/vitória ou 2º dado de efeito; 1 PP compra um 2º dado de efeito (dos que sobraram). | 1061-1081 |
| Teste | GM rola a oposição (2 dados de dificuldade do mesmo tamanho + traços/cenário), soma 2, anuncia. Jogador precisa **superar** (empate = falha). | 873-917 |
| Dificuldade | Muito fácil 2d4 / Fácil 2d6 / Desafiador 2d8 / Difícil 2d10 / Muito difícil 2d12 (o "2d8 = challenging" está em 798-799; a tabela completa é do livro). | 879-905 |
| Disputa (contest) | Quem inicia rola primeiro e fixa a dificuldade; o oponente rola para superar. Pode **Give In** (ganha 1 PP, só se já rolou uma vez; não inicia outra disputa contra o mesmo oponente de imediato). Quem perde recebe Complication ou, em cena de alto risco, sai da cena. | 923-965, 1597-1604 |
| Sucesso heroico | Superar por **5+**: o dado de efeito **sobe 1 passo a cada 5** pontos de margem. | 995-1010 |
| Efeito na oposição | Teste: só indica o alcance. Disputa: compara efeito vencedor x efeito do perdedor; alto risco: efeito maior = perdedor sai da cena (a menos que gaste 1 PP); senão ele recebe Complication = efeito do vencedor (**desce 1 passo** se o efeito dele for igual ou maior). | 1083-1114, 1061-1080 |
| Efeito automático | Sem rolagem, efeito = maior dado da oposição (teste) ou da Pool de quem iniciou (disputa). | 1082-1098 |
| Criar Complication | Hitch: o GM **pode** criar d6; dá **1 PP** (da "pile"). Hitches extras na mesma rolagem **sobem** o dado sem custo extra (ou várias, 1 PP cada). Botch: Complication grátis, sobe 1 por hitch além do 1º, **sem PP**. | 2124-2150, 1549-1581 |
| Subir existente | O GM pode subir uma Complication existente em vez de criar. Acima de d12 = personagem fora da cena (1 PP para agir com 1 dado só). | 2153-2180 |
| Opportunity | 1 no dado do GM: **qualquer jogador gasta 1 PP** para **descer** uma Complication (d4 some) ou **subir** um Asset (máx. d12, até o fim da cena). Vários 1s = vários passos; paga 1 PP por Complication afetada. | 2181-2205, 1583-1588 |
| Complication como consequência | Em vez de sair, gasta 1 PP e pega Complication = efeito do oponente (d6 se não veio de dado). | 2207-2216 |
| PP: ganhar | Hitch ativado; **Hinder** (Distinction d4 / Complication d4 na Pool); Give In; roleplay. PP vindo de dado **só pode ser gasto depois** da rolagem resolvida. | 1534-1551 |
| PP: gastar | Mais dados no total, Asset temporário (d6, 1 PP cena / 2 PP resto da sessão), ativar SFX/oportunidade, 2º dado de efeito, ficar na cena. | 1556-1604 |
| Reserva | Prime tem "bank" (limitado) e "pile" (ilimitada) do GM. O Leverage já tem só o equivalente da pile ("o Fixer não tem reserva"). | 1515-1528 |

Diferença-chave para o Leverage atual: o Leverage clássico (L:610-640, L:660) **já** usa 1 = hitch (sem contar), 1 PP
= mais um dado no total, Complication d6 que sobe com mais 1s e dá 1 PP, Give In, Opportunity e +5 como Extraordinary
Success. O Prime muda **como se escolhem os dados** (livre, mais efeito), acrescenta o dado de efeito e torna
Opportunities e botch regras explícitas.

## 4. O que existe lá fora

### 4.1 Sistema Foundry `cortexprime` (Secular12)

Clone em `.cache/research/cortexprime` (v0.2.16, `compatibility.verified: 13.342`, ainda `FormApplication`/`Dialog`/jQuery;
**não copiar o código, só o fluxo**).

- `module/scripts/rollDice.js`: monta a fórmula `d8+d6+...` com `getRollFormula`, avalia com **uma** `Roll`, separa
  `hitches` (resultado 1) de `results`, ordena e passa para `dicePicker`.
- Escolha **automática** em duas variantes: `getDiceByTotal` (marca o total primeiro, depois o efeito) e
  `getDiceByEffect` (efeito primeiro: maior número de faces, resolve empate pelo menor resultado; depois total com o
  resto). Total = os 2 maiores resultados; empate de resultado resolvido por **menos faces** (guarda o dado maior para
  o efeito). Sem dado sobrando, efeito = d4 fixo.
- `dicePicker` (l.~160-330): `Dialog` com os dados clicáveis (`.selectable`, `.chosen`, `.effect`), botões
  "add to total", "add to effect", "reset selection", total ao vivo, fecha devolvendo uma Promise com
  `{dice[], total, effectDice[]}`. Fechar a janela sem confirmar devolve a escolha sem seleção.
- A Pool vive numa flag do usuário (`UserDicePool.js`). Diferente de nós (estado do cliente, `docs/08`).
- Lição: o conjunto "total / efeito / livre / hitch" com **cliques que alternam estado** e total ao vivo é suficiente.
  O ponto fraco dele é bloquear o fluxo numa Promise de diálogo modal (sem card até confirmar).

### 4.2 L5R 5e (FFG) para Foundry

Repositório oficial: **GitLab** `https://gitlab.com/teaml5r/l5r5e` (não GitHub). Clone em
`.cache/research/l5r5e`. `system/system.json`: `compatibility` minimum/verified/maximum = **14**. Arquivos em
`system/scripts/dice/`: `dice-picker-dialog.js` (900 linhas, monta a Pool **antes**), `roll-n-keep-dialog.js` (840,
escolhe **depois**), `roll.js` (`RollL5r5e extends Roll`), `templates/dice/roll-n-keep-dialog.html`.

O que o diálogo "Roll & Keep" faz (e vale como inspiração):

- **É aberto a partir do card**, não da ficha: botão no card -> `RollnKeepDialog.onChatAction` ->
  `new RollnKeepDialog(messageId).render(true)`; o `id` da janela contém o id da mensagem
  (`l5r5e-roll-n-keep-dialog-${messageId}`) e clicar de novo fecha. Só o dono edita (`isOwner`); os outros veem em
  leitura (`options.editable`). **Copiar:** janela por mensagem, id estável, leitura para os demais.
- **Passos com histórico**: `object.dicesList[passo][dado] = {type, face, choice}` com `choice` em
  `keep | discard | reroll | swap | null`. Cada confirmação cria o próximo passo (rerrolagens). Desfazer volta um passo
  (`_undoLastStepChoices`). **Para nós:** a escolha é um passo só; o histórico não é necessário, mas "Reiniciar" =
  voltar para a escolha automática.
- **Arrastar e soltar** os dados para caixas "Manter / Descartar / Rerrolar" (`DragDrop` em `.dice.draggable` ->
  `.dropbox`). **Para nós:** dois alvos (TOTAL, EFEITO) funcionam, mas **clique** é mais simples, acessível e já é o
  padrão do projeto; recomendo clique (com arrastar como extra, se sobrar tempo).
- **Contagem de manter** (`_getKeepCount`, `_checkKeepCount`) valida quantos podem ser mantidos antes de liberar o
  botão. **Para nós:** as mesmas travas (máx. 2 no total + dados comprados; 1 efeito; hitch não seleciona).
- Estado da rolagem vive **dentro do objeto `Roll`** (`roll.l5r5e`, serializado em `toJSON`/`fromData`), e cada
  confirmação **recria a `Roll` e apaga a mensagem antiga, postando outra** (`_toChatMessage`, `sockets.deleteChatMessage`).
  **Não copiar:** perde a ordem do chat, repete a animação e precisa de socket só para isso. Nós **editamos as flags da
  mesma mensagem**, como o card atual já faz.
- Atualização entre clientes: `refresh()` via socket re-renderiza a janela aberta. **Copiar:** ao editar a mensagem,
  re-renderizar janelas abertas daquela mensagem no hook `updateChatMessage`.
- Usa `FormApplication` + jQuery (API v1) mesmo declarando v14. **Não copiar:** usar `ApplicationV2` +
  `HandlebarsApplicationMixin` (`docs/research/foundry-v14-essentials.md`).

## 5. Proposta de desenho

### 5.1 Fluxo da nova janela

1. **Montar a Pool** (bandeja e `pool-builder`): **sem mudança**. O contador "N dice · keep 2" vira "N dice" + dica
   "choose 2 + effect" (chave i18n nova).
2. **ROLL:** `rollPoolFor` avalia uma `Roll` (um termo por dado, DSN igual), calcula `autoSelection()` e posta o card
   com `status: "pending"`. Em seguida (`await game.dice3d?.waitFor3DAnimationByMessageID(message.id)`, API do DSN,
   ver `docs/research/dice-so-nice.md`) abre a janela **Escolher dados** só no cliente de quem rolou.
3. **Janela Escolher dados** (`ResolveDiceApp`, uma por mensagem):
   - Fileira de dados grandes (o `renderDie` já usado no card, 64 px) com estados **TOTAL** (borda branca), **EFEITO**
     (verde, como o livro), **LIVRE** (cinza) e **HITCH** (vermelho, não clicável).
   - Clique em dado livre: vai para o total se houver vaga (2), senão para o efeito (1); clique em dado já marcado
     solta. Clique em livre quando total e efeito estão cheios: oferece **"+1 PP: somar ao total"** (dado fica "pago",
     não pode virar efeito). Clique com botão direito ou botão **EFEITO** força o dado para o efeito.
   - Atalhos: **Máx. total** (2 maiores; empate -> dado com menos faces; efeito = maior sobrando) e **Máx. efeito**
     (maior dado vira efeito, 2 maiores do resto no total). Mostram a escolha, não confirmam.
   - Rodapé ao vivo: **TOTAL**, **EFEITO dX** (d4 padrão em itálico quando não sobrou dado), PP disponíveis/gastos,
     e, se existir dificuldade (seção 5.5), "supera por N / falha por N" e passos de sucesso heroico.
   - **Confirmar:** valida, grava `selection` + `status: "resolved"` na mensagem (via `executeAsGM` se o jogador não
     puder editar, igual `keepDie`), desconta os PP (e dá os PP de Distinction d4), fecha. **Cancelar/fechar:** nada
     é gasto; vale a escolha automática.
4. **Resultado no card:** TOTAL, bloco EFEITO dX, legendas dos dados (TOTAL / EFEITO / dX / HITCH), faixa de hitches
   e botões (seção 5.3). O botão "Escolher dados" reabre a janela enquanto for a rolagem mais recente do dono.

Alternativas descartadas: (a) **diálogo modal antes do card** (modelo do `cortexprime`): o mestre e a mesa não veem
nada até confirmar, DSN espera, risco de travar a mesa; (b) **só automático + botão no card** (sem janela): não dá
bom espaço para PP/efeito; (c) **apagar e repostar a mensagem** (modelo L5R): quebra ordem e repete animação.

### 5.2 O que muda em `module/dice`

| Arquivo | Mudança |
| --- | --- |
| `prime-math.mjs` (**novo**, puro) | `classify(results)` -> `{hitches, eligible}`; `autoSelection(results, {prefer:"total"\|"effect"})`; `applyPick(state, index, slot)` e `validate(state, {ppAvailable})`; `summarize(entries, selection)` -> `{total, effectFaces, ppSpent, botch}` (efeito d4 quando nada sobra); `heroicSteps(margin)` = `floor(margin/5)`; `compare(playerTotal, difficulty)`; `stepEffect(faces, steps)` com `stepUp` de `die.mjs`. |
| `pool-roll.mjs` | `evaluatePool` fica para o modo `classic` e para `autoSelection` (reuso da ordenação `byValueDesc`). `keep` deixa de ser constante de regra. |
| `roll-core.mjs` | `buildRollData` passa a produzir `v: 2` e usa `autoSelection`; mantém `kept`, `keptCount`, `total`, `ppSpent`, `distinctionPP`, `complicationsResolved`. Novos: `status`, `effectDie`, `hitches`, `botch`. `one` continua (= hitch). |
| `card-actions.mjs` | `keepNextDie`/`nextSpareIndex` só no modo `classic`. Novas: `applySelection(data, selection)`, `activateHitches(data)`, `useOpportunity(data)`. `applyComplication` ganha `steps` (hitches extras sobem o dado). |
| `roll-handler.mjs` | Posta o card pendente e dispara `openResolver`. PP de hitch/Distinction passam a respeitar "só gasta depois" (5.4). |
| `opposition.mjs` | Presets de dificuldade 2dX; mesma resolução automática; hitches do Fixer viram `opportunities`. |
| `applications/dialogs/resolve-dice.mjs` (**novo**) | A janela. |
| `applications/chat/roll-card.mjs`, `roll-card.hbs`, `card-handlers.mjs` | Bloco EFEITO, legendas, botões novos, socket. |
| `config.mjs` | `LEVERAGE.keepDefault` (2) vira `LEVERAGE.prime = { totalDice: 2, defaultEffectDie: 4, heroicStep: 5, ... }` e `rollModes`. Nenhuma constante fora dele. |

Esboço do núcleo (nomes do projeto):

```js
// module/dice/prime-math.mjs  (puro)
import { LEVERAGE } from "../config.mjs";
import { stepUp } from "./die.mjs";

/** @param {{index:number,size:number,value:number}[]} results */
export function autoSelection(results, { prefer = "total", paid = 0 } = {}) {
  const ok = results.filter((r) => r.value !== 1);
  const byTotal = (a, b) => b.value - a.value || a.size - b.size || a.index - b.index; // empate: guarda o dado maior
  if (prefer === "effect" && ok.length > 2) {
    const effect = [...ok].sort((a, b) => b.size - a.size || a.value - b.value)[0];
    const total = ok.filter((r) => r !== effect).sort(byTotal).slice(0, LEVERAGE.prime.totalDice + paid);
    return { total: total.map((r) => r.index), effect: [effect.index] };
  }
  const total = [...ok].sort(byTotal).slice(0, LEVERAGE.prime.totalDice + paid);
  const left = ok.filter((r) => !total.includes(r)).sort((a, b) => b.size - a.size);
  return { total: total.map((r) => r.index), effect: left[0] ? [left[0].index] : [] };
}

export function summarize(entries, sel) {
  const total = sel.total.reduce((s, i) => s + entries[i].result, 0);
  const effectFaces = sel.effect.length ? Math.max(...sel.effect.map((i) => entries[i].faces)) : LEVERAGE.prime.defaultEffectDie;
  const hitches = entries.filter((e) => e.result === 1).length;
  return { total, effectFaces, hitches, botch: hitches > 0 && hitches === entries.length };
}

export const heroicSteps = (margin) => (margin >= LEVERAGE.prime.heroicStep ? Math.floor(margin / LEVERAGE.prime.heroicStep) : 0);
export const stepEffect = (faces, steps) => Array.from({ length: steps }).reduce(stepUp, faces);
```

Flags v2 (aditivo sobre `docs/05`):

```js
roll: {
  v: 2, status: "pending" | "resolved",
  entries: [{ ref, label, kind, faces, result, kept, one, effect: false, paid: false }], // kept = está no total
  total, effectDie: 8,            // tamanho; 4 se nada sobrou
  keptCount, ppSpent, distinctionPP,
  hitches: 1, botch: false, complicationsResolved: [],   // mesmos índices de antes
  opportunities: 0, opportunitiesUsed: 0,                // só no card do Fixer
  versus: { messageId, difficulty, margin, outcome: "success"|"fail"|"heroic", effectDie }  // opcional
}
```

Janela (esqueleto, só a forma):

```js
// module/applications/dialogs/resolve-dice.mjs
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
export class ResolveDiceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["leverage-gta", "lv-resolve"], window: { title: "LEVERAGE.Resolve.title" }, position: { width: 520 },
    actions: { toggle: ResolveDiceApp.#toggle, autoTotal: ..., autoEffect: ..., confirm: ..., reset: ... }
  };
  static PARTS = { body: { template: `systems/${SYSTEM_ID}/templates/dialogs/resolve-dice.hbs` } };
  get id() { return `lv-resolve-${this.message.id}`; }      // padrão L5R: um por mensagem
  #state;                                                   // {total:[], effect:[], paid:[]} rascunho local
  // _prepareContext: monta estados com renderDie; chama prime-math para total/efeito ao vivo
}
// hook updateChatMessage -> se a janela dessa mensagem está aberta, re-renderiza (ou fecha se resolved por outro)
```

### 5.3 Card de chat

Mantém o topo preto, chips e a fileira de dados (`docs/08`). Muda:

- **Legendas:** `TOTAL` (branco), `EFFECT` (verde), `d8` (opaco), `HITCH` (vermelho, antigo "1 · OUT"). Dado pago
  com PP: `TOTAL +PP`.
- **TOTAL** continua grande; ao lado, **EFEITO dX** com o dado pequeno (chave de card nova). Em modo `classic` o
  bloco de efeito some.
- **Estado pendente:** selo "escolha automática, aguardando o jogador" + botão **Escolher dados**.
- **Faixa de hitches** (substitui a caixa tracejada atual): "N hitches" (e **BOTCH** quando todos); botão mestre
  **ATIVAR HITCHES** (5.6).
- **Faixa de resultado** quando houver `versus`: SUCESSO / FALHA / HERÓICO (+N passos), com o efeito final.
- Botões de saída (só após `resolved` e sucesso): **Criar Asset dX** e **Complication dX no oponente** (5.7).
- **Sem mockup:** não existe PNG para este card novo. A regra de fidelidade (`CLAUDE.md`) não tem alvo; decisão a
  registrar em `DECISIONS.md`: derivar da linguagem do `roll-chat-card.png` atual e gerar o novo print como referência
  (T-1016). Não inventar outro estilo.

### 5.4 Plot Points no novo fluxo

- **Início do Job:** 1 PP (igual). **Ganha:** hitch ativado, Distinction d4, Give In (só se já rolou na disputa),
  fim de Job (igual).
- **Gasta:** +1 dado no total (agora **qualquer** dado livre, não só o "próximo maior"), Asset de cena (1 PP, d6) /
  de Job (2 PP, d6), Talent, **2º dado de efeito** (novo, 1 PP, dado livre), **usar Opportunity** (novo, 1 PP).
  Manter a regra do Leverage de Assets (nome obrigatório).
- **PP de dado só depois de resolver** (Prime l.1540-1547; o Leverage já diz isso para o PP dado pelo Fixer):
  `rollPoolFor` hoje aplica o PP da Distinction logo após postar. Recomendação: guardar `ppAtRoll` no card e limitar os
  gastos da janela a `ppAtRoll`; o PP novo só entra no saldo ao confirmar/fechar. Evita "tirar d4, ganhar o PP e
  comprar o 3º dado".
- **Confirmação grava tudo junto** (descontar PP + escolha na mesma atualização), para fechar a janela não perder PP.
- O Fixer **não ganha reserva** (decisão atual do projeto equivale à "pile" do Prime). Não implementar "bank".

### 5.5 Oposição e disputa

- **Rolador de oposição:** manter fontes (2d6, polícia por estrelas, gangue, NPC, Local, Job). Acrescentar a linha
  **Dificuldade**: Muito fácil 2d4, Fácil 2d6 (= "nenhuma oposição" de hoje), Desafiador 2d8, Difícil 2d10, Muito
  difícil 2d12 (livro l.879-905), somando aos traços escolhidos. Valores em `LEVERAGE.difficulties`.
- **Resolução do Fixer:** automática por padrão (2 maiores = dificuldade; efeito = maior sobrando), com a opção
  `rules.oppositionChoice = "auto" | "choose"` (o livro permite os dois, l.777-781). No modo `choose` abre a mesma
  janela para o mestre. Hitches do Fixer = `opportunities` (5.6).
- **Teste (GM rola primeiro):** como hoje. Empate = Fixer, igual ao livro.
- **Disputa (jogador inicia):** novo e opcional. Quando existe um card do Fixer **mais recente** da cena e ele foi
  rolado depois, a janela mostra "vs último do Fixer (total N)" e grava `versus`. Com a ordem invertida (jogador
  rolou antes), o rolador de oposição lê o total do jogador como dificuldade. O `docs/05` dizia "não existe campo
  versus": passa a existir, sempre opcional, por `messageId` (sem ligação automática por proximidade).
- **Resultado:** `margin = jogador - dificuldade`; `> 0` sucesso, `>= 5` heroico (`heroicSteps`). Efeito final =
  `stepEffect(effect, steps)`. Em disputa, comparar efeitos (livro l.1099-1114) só informa; o resultado (taken out)
  fica narrativo, para não competir com Vida/Colete/Wasted/Busted.
- **Dano (casa):** manter `margem + dado da arma`. Opção futura (decidir no T-1013): para PCs atacando, usar o dado de
  efeito no lugar da arma. Não mexer agora.
- **Ganging Up:** os dados extras continuam entrando na Pool; a derrubada continua manual. "Extraordinary Success =
  2 capangas" passa a ser **margem >= 5** (igual).
- **Give In:** igual, mais a nota do Prime (só vale se já rolou na disputa); continua manual.

### 5.6 Hitches e Opportunities

**Hitches do jogador** (`hitches` = quantos 1; a lista de índices continua em `complicationsResolved`):

- Um botão do mestre **ATIVAR HITCHES** abre um diálogo (reaproveitar `complication-dialog.mjs`) que age em todos os
  hitches ainda não resolvidos de uma vez: **nova Complication d6** subida `n-1` passos (1 PP para o jogador), **subir
  uma existente** `n` passos, ou **N Complications separadas** (1 PP cada). Hoje cada 1 é resolvido um a um; o Prime
  junta e cobra um PP.
- **Botch** (todos os dados são 1): faixa vermelha BOTCH; o mestre pode criar uma Complication grátis (sem PP),
  subida um passo por hitch além do primeiro (l.1558-1561). Total = 0, como hoje.
- Complication acima de d12 = fora da cena (Wasted/Busted casam aqui; o texto da casa já cobre, só citar no
  `docs/02`).

**Opportunities** (hoje **não existe** no código; `docs/01` l.37 só cita):

- Hitch no card do Fixer vira `opportunities = N`. O card mostra "N oportunidades" e, para quem é dono de uma
  personagem com PP, o botão **Usar oportunidade (1 PP)**.
- Diálogo escolhe: **descer** uma Complication do Job ativo (`activeJob.complications`, d4 some) ou **subir** um
  Asset de cena/Job do jogador (máx. d12, até o fim da cena: guardar `boost` temporário e limpar em "Encerrar cena").
  Cada uso gasta 1 PP e incrementa `opportunitiesUsed`.
- Escrita em `activeJob` e na ficha de outro usuário passa pelo `executeAsGM` que já existe (`socket.mjs`).

### 5.7 Efeito -> ações (o que o dado de efeito faz de útil)

Todos opcionais e só em `status: "resolved"`:

- **Criar Asset dX** (sucesso): abre o diálogo de Asset já existente (`create-asset-dialog.mjs`) com o dado
  pré-preenchido e **sem custo de PP**, escopo cena. Livro l.1039-1055.
- **Complication dX no oponente / em cena**: grava em `activeJob.complications` (ou no NPC).
- Em derrota: **Complication = efeito do vencedor** (desce 1 passo se o efeito do perdedor for >= ao dele) -> botão
  do mestre no card do Fixer. Opcional.

## 6. Migração sem quebrar dados

1. **Mensagens de chat:** nada a reescrever. `rollOf(message)` ganha `normalizeRoll(data)`: sem `v` -> `v: 1`,
   `status: "resolved"`, `effect: false` em todos, `effectDie: null` (o card **oculta** o bloco de efeito),
   `hitches = entries.filter(one).length`. Cards antigos continuam funcionando e `damage.mjs` (que lê `total`) não
   percebe.
2. **Atores e itens:** sem mudança de esquema. Distinctions, Specialties, Assets, Talents, Roles, Attributes,
   Jobs/Record, Grana, Vida, Colete, estrelas: todos intactos.
3. **Configurações novas** (registrar em `settings.mjs`, escopo `world`): `rules.rollMode` ("prime"), 
   `rules.oppositionChoice` ("auto"), `rules.heroicSuccess` (true). Sem valor salvo, o padrão vale.
4. **`migration.mjs`:** adicionar `{ version: "0.2.0", run }` que só (a) não faz nada com dados e (b) grava uma
   notificação ao mestre ("regras de rolagem do Cortex Prime ativas; `rules.rollMode = classic` volta ao anterior").
   `system.json` -> `0.2.0`, `CHANGELOG.md`.
5. **Talents/compêndio:** auditar textos que mencionem "manter/keep"/"dois maiores" (compêndio de exemplo T-902).
6. **API/macros:** `game.leverage.rollPool(...)` mantém a assinatura; passa a devolver a mensagem (hoje já faz) e o
   resultado automático. Documentar `await game.leverage.resolve(message, {total:[…], effect:[…]})` em `docs/macros.md`.
7. **Testes:** os existentes (`dice.test.mjs`, `pool.test.mjs`, `roll-handler.test.mjs`, `card-actions.test.mjs`)
   continuam válidos no modo `classic`; os do modo `prime` são novos.

## 7. O que do Leverage ainda vale e o que sai

**Fica (identidade):** Attributes (d4-d12, arranjos Focused/Versatile), Roles (primária d10, secundária d8, resto em
branco e depois d6/d4/d4), Distinctions (d8 ajuda; d4 atrapalha e dá 1 PP), Specialties (+d6 da Role), Talents
(Activation/Effect, 1 PP), Signature Assets (d8/d6), Assets de cena (1 PP d6) e de Job (2 PP d6), **Jobs como XP**
(Record, Callback uma vez por Job por sessão, Training Up, Advance), Plot Points (1 no início), Complication d6 que
sobe, Give In, Ganging Up, personagens do mestre (Extras/Foils/Agents/Marks), Traços de cena. Toda a **regra da casa
GTA** (Estrelas, Vida/Colete, Grana em escada, Wasted/Busted) e a bandeja de Pool.

**Muda de significado:** "soma os dois maiores" vira **escolha livre** (automático só como sugestão); "1 PP = 3º maior
dado" vira "1 PP = qualquer dado livre no total"; cada "1" resolvido sozinho vira **ativar hitches juntos**;
"Extraordinary Success +5 encerra a disputa" vira **sucesso heroico: +1 passo de efeito por 5**; Opportunity passa de
menção a mecânica.

**Sai / novo:** botão "+1 PP · KEEP 3RD DIE" (substituído por Escolher dados; fica no modo `classic`);
`LEVERAGE.keepDefault` como regra; texto "keep 2" na UI. **Novo:** dado de efeito, botch, Opportunity ativa, sucesso
heroico, dificuldade 2dX, 2º dado de efeito por PP, janela de escolha, `versus`.

**Não adotar do Prime:** SFX como sistema (Talents já cobrem), Stress, "bank" do GM, Doom Pool, relationships.

## 8. Backlog proposto (para `docs/10-backlog.md`, "Fase 10 — Cortex Prime")

Tamanhos: S = < 1h de agente, M = 1-3h, L = mais. Sem mockup novo (ver 5.3).

- [ ] **T-1001 Decisões e documentos (S).** Registrar em `DECISIONS.md` (modo prime/classic, janela pós-rolagem com card
  pendente, ausência de mockup, `versus` opcional); atualizar `docs/01`, `docs/05` (flags v2) e `docs/08`.
- [ ] **T-1002 Núcleo `prime-math.mjs` + testes (M).** `autoSelection`, `applyPick`, `validate`, `summarize`,
  `heroicSteps`, `stepEffect`, `compare`. *Dep:* T-1001.
- [ ] **T-1003 Roll data v2 e `normalizeRoll` (M).** `buildRollData` v2, leitura de cards antigos, `config.mjs`
  (`LEVERAGE.prime`, `rollModes`, `difficulties`). *Dep:* T-1002.
- [ ] **T-1004 Configurações (S).** `rules.rollMode`, `rules.oppositionChoice`, `rules.heroicSuccess` + i18n (en/pt-BR).
- [ ] **T-1005 Janela `ResolveDiceApp` (L).** ApplicationV2, estados TOTAL/EFEITO/LIVRE/HITCH, atalhos, rodapé ao vivo,
  CSS no estilo do card. *Dep:* T-1003.
- [ ] **T-1006 Integração rolagem -> card pendente -> janela (M).** `rollPoolFor`, espera do DSN, confirmar via
  `executeAsGM`, PP no confirmar, `updateChatMessage` re-renderiza janelas. *Dep:* T-1005, T-1004.
- [ ] **T-1007 Card v2 (M).** Bloco EFEITO, legendas, selo pendente, botão Escolher dados, modo `classic` preservado.
  *Dep:* T-1003.
- [ ] **T-1008 Hitches e botch (M).** Diálogo único de ativação, passos, PP, faixa BOTCH. *Dep:* T-1007.
- [ ] **T-1009 Oposição v2 (M).** Presets 2dX, resolução do Fixer (auto/choose), contagem de `opportunities`.
  *Dep:* T-1003.
- [ ] **T-1010 Opportunities (L).** Botão e diálogo (descer Complication / subir Asset), boost de cena, socket.
  *Dep:* T-1009, T-1008.
- [ ] **T-1011 `versus` e resultado (M).** Ligar ao último card do Fixer, margem, sucesso/falha/heroico, efeito final.
  *Dep:* T-1006, T-1009.
- [ ] **T-1012 Efeito em ações (M).** Criar Asset dX sem PP, Complication dX. *Dep:* T-1011.
- [ ] **T-1013 Dano e saída de cena (S).** Decidir efeito x dado da arma; "gastar 1 PP e pegar Complication" antes de
  Wasted/Busted (opcional). *Dep:* T-1012.
- [ ] **T-1014 API e macros (S).** `game.leverage.resolve`, `docs/macros.md`, Pool por macro no novo fluxo.
- [ ] **T-1015 Migração 0.2.0 (S).** `system.json`, `migration.mjs`, `CHANGELOG.md`, auditoria de Talents do compêndio,
  `docs/USO.md`.
- [ ] **T-1016 Testes no Foundry e prints (M).** Playwright: rolar, escolher, confirmar, fechar sem confirmar, hitches,
  oportunidade, `versus`; salvar prints de referência do card novo.
- [ ] **R-F10 Revisão de fase (Opus).** *Dep:* tudo acima.
- [ ] **R-FINAL-2** Revisão final de conjunto.

Ordem de menor risco: T-1001..T-1004 (sem UI) -> T-1005..T-1007 (o fluxo central, já utilizável) -> T-1008..T-1011
(regras) -> T-1012..T-1016. Paralelizáveis: T-1004 com T-1002; T-1008 com T-1009.

## 9. Cuidados e notas de versão

- **Efeito é só tamanho** (livro l.1035): o card mostra "d8", não o resultado do dado. Dado pago com PP **não** pode ser
  efeito e hitch também não (l.1031-1037); `validate` precisa recusar os dois.
- **Empate no total:** a regra é "superar"; empate = falha (l.877-878). Manter "empate é do Fixer".
- **Pool de 1 dado:** total = o dado, efeito d4. **Pool só com 1s:** botch, total 0.
- **Tie-break da escolha automática:** guardar o dado de **mais faces** para o efeito (modelo `cortexprime`); só
  importa quando os resultados empatam.
- **Concorrência:** duas ações no mesmo card (jogador confirmando e mestre ativando hitch) editam a mesma mensagem.
  Reaproveitar o `busy` do `card-handlers.mjs` e **ler flags frescas depois de cada `await`**, como já se faz.
- **Permissões:** jogador edita a própria mensagem; se não puder, `executeAsGM`. Só o dono (não o mestre) confirma a
  escolha; o mestre pode "Escolher dados" de NPC/oposição.
- **DSN:** a animação acontece no `roll.toMessage`; a janela só abre quando termina, para não revelar os números antes
  (`waitFor3DAnimationByMessageID`, documentado em `.cache/research/dsn/docs/.../interactive-throws.md`). Sem o módulo,
  abre direto.
- **Versão:** L5R5e declara v14 (`system.json` 14/14/14) mas usa `FormApplication`; o `cortexprime` só foi verificado
  na 13.342. Nenhum dos dois serve de código; só os fluxos. O desenho acima usa só `ApplicationV2`,
  `HandlebarsApplicationMixin`, `ChatMessage#update`, `updateChatMessage`, que já estão em uso neste projeto.
- **Licença do texto:** o livro Cortex Prime está em `reference/books/text`; não copiar trechos para o repositório do
  sistema, só as regras em linguagem própria (como acima).
- **Dúvida deixada em aberto:** "Leverage Companion/2ª edição em Cortex Prime" não foi encontrada na web; usei só o
  Cortex Prime Game Handbook local e o Leverage clássico local. Se existir livro oficial do Leverage em Prime, comparar
  antes de T-1001.

## 10. Fontes

- `reference/books/text/cortex-prime.txt` (linhas citadas na seção 3) e `reference/books/text/leverage.txt`.
- `.cache/research/cortexprime/module/scripts/rollDice.js`, `module/applications/UserDicePool.js` (Secular12/cortexprime).
- `.cache/research/l5r5e/system/scripts/dice/roll-n-keep-dialog.js`, `dice-picker-dialog.js`, `roll.js`,
  `templates/dice/roll-n-keep-dialog.html` (`https://gitlab.com/teaml5r/l5r5e`).
- Código atual: `module/dice/{pool-roll,roll-core,roll-handler,card-actions,opposition}.mjs`,
  `module/applications/chat/{roll-card,card-handlers,complication-dialog}.mjs`, `docs/05` (flags), `docs/08`.
- Dice So Nice: `docs/research/dice-so-nice.md`.
