# Jobs e Locais: onde guardar, o que ligar

Duas dúvidas do dono ("não sei, temos que refletir"): (A) onde o Job ativo deve morar; (B) o que é a "ficha de um lugar".
Esta nota descreve o estado de hoje, compara as saídas e fecha com **uma** recomendação para cada e uma lista de tarefas.
Nenhum código foi alterado. Leitura feita em `module/world-state.mjs`, `module/settings.mjs`,
`module/applications/gm/job-*.mjs`, `scene-panel/*`, `actor/location-sheet.mjs`, `actor/parts/assets.mjs`, `drag.mjs`,
`module/data/item/job.mjs`, `module/data/actor/location.mjs`, `system.json` e `docs/00, 01, 02, 03, 05, 09`.

---

## Parte A. Jobs

### A.1 Como é hoje (fatos)

**O Job ativo é uma configuração de mundo, não um documento.**

- `module/settings.mjs:79`: `hiddenWorld("activeJob", ObjectField, emptyJob(), notify("activeJobChanged"))`. É um
  `game.settings` escopo `world`, `config: false` (escondido). Não aparece em nenhum diretório da barra lateral; só dá
  para ver pelo Rastreador do Job, pelo painel de cena ou pelo console. Isso é o "não sei onde fica armazenado" do dono.
- Forma: `{ name, goal, complications: [{id,name,die}], sceneTraits: [{id,name,die}] }` (`job-actions.mjs:18`,
  `job-tracker-logic.mjs`). Sem esquema do Foundry (ObjectField aceita qualquer coisa); a normalização é feita à mão em
  `normalizeJob`.
- Só existe **um**. Não há Job "planejado", "pausado" ou lista de Jobs do mestre.
- Leitura/escrita espalhadas (nada passa por um único ponto):
  - leituras diretas de `readSetting("activeJob")`: `scene-panel.mjs:67`, `parts/tray.mjs:34`,
    `opposition-roller.mjs:127` e `:166`; via `readJob()` (`job-actions.mjs:120`): tracker, `card-handlers.mjs`, `api.mjs:196`.
  - escritas `game.settings.set(SYSTEM_ID, "activeJob", …)`: `job-actions.mjs` (`endScene` :220, `newJob` :238,
    `endJob` :315), `job-tracker.mjs:109` (`#save`), `card-handlers.mjs:133` (Complication pelo card do 1).
- Todas as telas reagem ao hook próprio `leverage.activeJobChanged` (`LEVERAGE.hooks.activeJobChanged`), disparado pelo
  `onChange` do setting.
- Só o mestre escreve (`requireGM`); todo mundo lê (o setting de mundo vai para todos os clientes, por isso os jogadores
  veem Complications e Traços de cena no painel).

**O histórico é só a cópia por personagem.**

- `endJob` (`job-actions.mjs:293`) cria, em cada Crew *jogado* (`crewActors()` = Crew que algum jogador possui),
  um Item `job` com `{ name, goal, payout: {total, share} }` (`jobItemData`), soma a Grana (`actor.money.add(share)`),
  apaga os Assets de duração `job` e **zera o setting** (`emptyJob()`).
- Consequência: no fim do Job, as **Complications, os Traços de cena e qualquer ligação desaparecem**. O mestre fica sem
  registro do que aconteceu; o que sobra é uma linha no chat ("endJob") e N cópias nas fichas. Se um personagem for
  apagado ou ainda não existia, o Job some dele. Crew não jogado (pronto, sem dono) não recebe nada.
- O Item `job` (`module/data/item/job.mjs`) é o **Record** do livro: `goal`, `payout.{total,share}`, `callbackUsed`,
  `spent`, `notes`. Os três campos de estado são **por personagem**:
  - **Callback** (`callbackUsed`): marcado pelo jogador na aba JOBS; `newSession` zera em todos os Crew
    (`job-actions.mjs:185`, `usedCallbackIds`).
  - **Training Up / avanço** (`spent`): `train-up-dialog.mjs` + `parts/assets.mjs:181` contam
    `actor.itemTypes.job` não gastos e `pickJobsToSpend` marca os N primeiros (por `sort`) como `spent`. Job gasto
    continua no Record, sem callback (docs/01 L:2500–2560). O campo `payout.share` e `spent` são "só do mestre"
    (`LEVERAGE.protectedItemFields`).
  - **Pagamento** (`payout.share`): coluna `$` da aba JOBS.
- Arrastar Job entre fichas: mover se o usuário é dono dos dois atores, senão copiar (jogador não-mestre é recusado)
  (`drag.mjs:47,61`). Compêndios: `system.json` tem packs `crew-exemplo`, `npcs`, `locais`, `talents-assets`; **não há
  pack de Jobs**.
- `docs/09` e `docs/05` documentam `activeJob` como "escondido; usado pelo Rastreador".

**O Job hoje não reúne NPCs, lugares nem cenas.** O painel de cena mostra NPCs e Locais porque há **tokens** deles na
cena *vista* (`scene-panel.mjs:24 sceneTokens()`, `scene-panel-logic.mjs groupSceneActors`), não porque o Job os cite.
A única ligação Job→resto é `Complications`/`sceneTraits` e o `goal`. Portanto a dúvida do dono ("o Job reunir NPCs,
lugares etc.") é uma ideia nova, não um recuo.

Também vale esclarecer: os **Traços de cena não estão atrelados à Cena do Foundry**. Eles pertencem à "cena narrativa"
do livro e vivem no Job; "Encerrar cena" (`jobAfterScene`) os apaga. Trocar de Cena do Foundry não os muda. As
**Complications são globais do Job** (valem em qualquer cena até o Job acabar).

### A.2 Fatos do Foundry v14 que pesam na escolha

(Fontes: API v14 em `foundryvtt.com/api/v14/classes/foundry.documents.BaseScene.html` e `…BaseJournalEntry.html`.)

- `JournalEntry` e `Scene` **não têm `type` nem `system`** no esquema v14 (só `flags`, `ownership`, `folder`, `pages`/
  `levels`…). Só `Actor`, `Item`, `JournalEntryPage` e alguns outros aceitam subtipos com `TypeDataModel`.
  Logo, um Job como Journal ou Scene teria dados estruturados só em `flags` (sem esquema) ou em páginas de Journal com
  subtipo próprio (`documentTypes.JournalEntryPage` no `system.json`).
- Itens de mundo aparecem no diretório de Itens, têm pastas, `ownership`, UUID estável (`Item.<id>`), podem ser
  arrastados para fichas e para textos (`@UUID[Item.<id>]{nome}`), e podem estar num **compêndio** (pack `Item`) como
  modelo de golpe reutilizável. Compêndios e UUIDs de compêndio (`Compendium.leverage-gta.jobs.Item.<id>`) resolvem com
  `fromUuid` (assíncrono); `fromUuidSync` só resolve documentos já carregados (mundo).
- Permissão: documento de mundo com `ownership.default = NONE` **não chega** ao cliente de quem não tem ao menos
  LIMITED (a verificar no Foundry real, ver Gotchas). Hoje o setting chega a todos; um Item precisa de
  `ownership.default = OBSERVER` para o painel de cena funcionar para jogadores.
- `foundry.data.fields.DocumentUUIDField` (opções `type`, `embedded`) e `SetField`/`ArrayField` dão ligações
  validadas por UUID a Atores, Cenas e Itens.
- Hooks `createItem/updateItem/deleteItem` disparam em quem tem o documento; filtramos por `type`.

### A.3 Alternativas

| | **A1. Manter o setting** | **A2. Job como Item de mundo (novo tipo) + status** | **A3. Job como JournalEntry** |
| --- | --- | --- | --- |
| Onde fica | oculto (setting) | diretório de Itens, com pastas, busca e ícone | diretório de Journals |
| Esquema validado | não (ObjectField + `normalizeJob`) | sim (`TypeDataModel`) | não (flags) ou página com subtipo (ficha própria de página: caro) |
| Vários Jobs (planejados, concluídos) | não | sim, com `status` | sim |
| Histórico do mestre | nenhum | todo Job fica, com Complications, pagamento e ligações | idem |
| Compêndio de golpes prontos | não | sim (pack `Item`) | sim, mas sem dados estruturados |
| Ligações por UUID (NPC, Local, Cena) | não | `DocumentUUIDField`, abre com clique | `@UUID` em texto livre; o código não consegue ler |
| Permissão | tudo público | `ownership` do Item (jogador OBSERVER) | `ownership` do Journal |
| Código a mudar | nada | encapsular leitura/escrita (4 leituras, 5 escritas), nova ficha, migração | idem, mais página customizada |
| Risco | continua "escondido" | médio, bem delimitado | alto (sem esquema) |
| Casa com o dono | não (é a queixa) | sim ("Job como Item") | não |

**Por que não é um Item só** (a armadilha): o Item `job` de hoje é o **Record por personagem** e carrega estado que é
*individual* (`callbackUsed`, `spent`, `payout.share`). Um Item de mundo único não consegue guardar "quem gastou o quê".
O avanço do Leverage (Training Up, Callback) tem de continuar contando os Itens `job` **embutidos** na ficha. Então
são dois papéis: o **dossiê do Job** (mundo, do mestre) e o **Record** (por personagem). Podem ser o mesmo tipo com
ramos por `item.isEmbedded` ou dois tipos. Pesos:

- **Mesmo tipo `job`:** zero migração do Record e uma só palavra na interface; mas o modelo de dados carrega campos
  mortos em cada contexto (Complications num Record, `callbackUsed` num dossiê), e arrastar um dossiê para uma Crew viraria
  um Record por acidente (precisa de regra no `drag.mjs`).
- **Dois tipos (`job` = Record, como hoje; novo `heist` = dossiê):** esquemas limpos; `crew` continua aceitando só `job`,
  então o dossiê é recusado pela lista de tipos permitidos sem código novo; nenhuma migração dos Records existentes
  (compêndio `crew-exemplo`, testes, `protectedItemFields`, i18n da aba JOBS intactos). Custo: um tipo a mais no `system.json`
  e dois rótulos na interface ("Job" para o dossiê, "Job" no Record; ver decisão abaixo).

### A.4 Recomendação (A)

**A2 com dois tipos: criar o Item de mundo `heist` (rótulo "Job" no diretório) e manter `job` como Record por
personagem.** O status ativo fica **no próprio Item** (`system.status`), não em ponteiro escondido, para que "onde está o
Job ativo" tenha resposta visual no diretório. Detalhes:

1. **Esquema `heist`** (`module/data/item/heist.mjs`):
   `status` (`planned` | `active` | `done`), `goal`, `notes` (HTML, público), `gmNotes` (HTML, só renderizado para o mestre),
   `complications[{id,name,die}]`, `sceneTraits[{id,name,die}]`, `payout.total`, `crew[{actorUuid, share}]` (preenchido no
   fim), e ligações `npcs`, `places`, `scenes` (cada uma `SetField(DocumentUUIDField)`).
2. **Um ativo por vez.** `startJob(item)` põe os outros `active` de volta em `planned` (GM). Quem lê usa
   `game.items.find(i => i.type === "heist" && i.system.status === "active")`. Se houver dois (edição manual), usa o primeiro
   por `sort` e avisa no console.
3. **Camada de adaptação.** `readJob()` passa a devolver o mesmo formato de hoje (`{name, goal, complications, sceneTraits}`)
   lido do Item, e uma `saveJob(partial)` nova faz o `item.update`. Primeiro refatore os 4 pontos que leem o setting direto
   e as 5 escritas para usar essas duas funções **sem trocar o armazenamento**; depois troque o armazenamento. O hook
   `leverage.activeJobChanged` continua existindo, agora disparado por `createItem/updateItem/deleteItem` de `heist`,
   então Rastreador, painel, bandeja e rolador não mudam.
4. **Encerrar Job** passa a: pôr `status = done`, gravar `payout.total` e `crew[]`, **manter** Complications e Traços no
   Item (histórico), criar o Record `job` em cada Crew como hoje, mas com ligação de volta `flags.leverage-gta.heistUuid`
   (ou campo `source` `DocumentUUIDField` no `job`), e escrever no chat `@UUID[Item.x]{nome}`.
5. **Sem Job ativo:** o Rastreador mostra "Nenhum Job ativo" com botões "Novo Job" e "Iniciar um planejado". Complications e
   Traços de cena exigem um Job ativo (hoje funcionam "soltos"; a migração cria um Job para o que existir).
6. **Permissões:** o dossiê nasce com `ownership.default = OBSERVER` (jogadores leem, só o mestre edita; Complications são
   públicas hoje de qualquer modo). **Nada realmente secreto** em campos do Item (ele é enviado ao cliente); o que precisa
   ser secreto fica em Journal do mestre ou em `gmNotes` apenas escondido da tela (não é segurança).
7. **Compêndio:** novo pack `jobs` (tipo Item) com 1 ou 2 golpes de exemplo (`status: planned`). Ao importar, UUIDs de
   NPC/Local que apontam para compêndios continuam válidos.
8. **XP/avanço:** inalterado. Training Up e Callback continuam sobre `actor.itemTypes.job` (Records). Dossiê nunca conta
   como "Job gasto" nem entra na Pool. Benefício: ao ver o dossiê concluído, o mestre enxerga quem recebeu quanto (hoje só
   olhando ficha por ficha).
9. **O Job reúne NPCs e lugares?** Sim, mas **só como dossiê** (links clicáveis, sem regra). Não substitui o painel de cena
   (que continua derivado dos tokens e dos Locais ligados à Cena, ver B). É a parte mais opcional; se o dono não gostar,
   o esquema sobrevive sem ela (as tarefas J-08 e J-09 são independentes).

**Decisão de nomes** (a registrar em `docs/log/DECISIONS.md` ao executar): tipo `heist` (interno), rótulo pt-BR "Job"
no diretório e "Registro de Job" na documentação; o Record continua "Job" na aba JOBS. Alternativa descartada: renomear o
tipo atual (migração grande sem ganho).

### A.5 Esboço (adaptado aos nomes do projeto)

```js
// module/data/item/heist.mjs
const { StringField, HTMLField, NumberField, SchemaField, ArrayField, SetField, DocumentUUIDField } = foundry.data.fields;
const entry = () => new SchemaField({ id: new StringField({ required: true }), name: new StringField({ required: true, blank: true }), die: new NumberField({ required: true, integer: true, initial: 6 }) });
export class HeistData extends foundry.abstract.TypeDataModel {
  static LOCALIZATION_PREFIXES = ["LEVERAGE.Item.heist"];
  static defineSchema() {
    return {
      status: new StringField({ required: true, initial: "planned", choices: ["planned", "active", "done"] }),
      goal: new StringField({ required: true, blank: true, initial: "" }),
      notes: new HTMLField({ required: true, blank: true, initial: "" }),
      complications: new ArrayField(entry()), sceneTraits: new ArrayField(entry()),
      payout: new SchemaField({ total: new NumberField({ required: true, integer: true, min: 0, initial: 0 }) }),
      npcs: new SetField(new DocumentUUIDField({ type: "Actor" })),
      places: new SetField(new DocumentUUIDField({ type: "Actor" })),
      scenes: new SetField(new DocumentUUIDField({ type: "Scene" }))
    };
  }
}

// module/applications/gm/job-store.mjs (novo; unico ponto que conhece o armazenamento)
export const activeHeist = () => game.items.find((i) => i.type === "heist" && i.system.status === "active") ?? null;
export const readJob = () => normalizeJob(activeHeist()?.toObject().system ?? emptyJob()); // mesmo formato de hoje
export async function saveJob(job) { const h = activeHeist(); if (h) await h.update({ "system.complications": job.complications, "system.sceneTraits": job.sceneTraits, "system.goal": job.goal, name: job.name }); }
```

### A.6 Migração (versão 0.2.0 em `MIGRATIONS`, `module/migration.mjs`)

Se o setting `activeJob` tem nome, Complications ou Traços: criar um `heist` `active` com esses dados (nome vazio vira
"Job sem nome" via i18n), depois zerar o setting. Manter o setting registrado (sem uso) por uma versão. Não tentar
reconstruir dossiês `done` a partir dos Records (nomes repetidos; sem como saber qual Record pertence a qual golpe).
Mundos novos (`stored` vazio) não migram: já nascem sem Job ativo.

### A.7 Gotchas (A)

- **Visibilidade para jogadores** é o maior risco: se o Item não chegar ao cliente do jogador, o painel de cena e o menu da
  Pool (Traços de cena) quebram para ele. Testar com o usuário jogador no Foundry real (`docs/13`) antes de marcar pronto.
- **Escritas**: `ArrayField` é regravado inteiro a cada `update` (igual ao setting hoje); com um mestre, sem corrida real.
  A Complication pelo card do 1 já roda só no cliente do mestre (`card-handlers.mjs:127`).
- **Jogador não cria Item de mundo** (permissão padrão): bom, só o mestre cria dossiês.
- **UUID quebrado** (NPC apagado): mostrar a linha riscada com "removido", nunca lançar erro.
- **UUID de compêndio** exige `await fromUuid`; o painel síncrono deve mostrar só o que já está resolvido.
- `readSetting("activeJob")` e a API pública `game.leverage.*` (`api.mjs:449`) precisam continuar devolvendo o mesmo
  formato, para macros do mestre não quebrarem.

---

## Parte B. Lugares

### B.1 Como é hoje (fatos)

- `Actor` tipo `location` (`module/data/actor/location.mjs`): `traits[{name,die}]`, `city` (só informativo; a cidade
  atual é `wanted.city`, DECISIONS), `notes`. Ficha própria (`location-sheet.mjs`), pack `locais`, exemplo no playtest.
- **Como um Local "entra em jogo":** é preciso um **token** dele na Cena vista. O painel de cena (`sceneTokens()`) lista
  Traços de NPCs e Locais cujos tokens estão na Cena vista; o rolador de oposição (`opposition-roller.mjs sceneLocations()`)
  usa o Local selecionado ou os que têm token na Cena atual (DECISIONS L:69: "Não existe flag de 'local da cena'").
- **Traços de cena** (`activeJob.sceneTraits`) e **Complications** (`activeJob.complications`) **não** moram na Cena
  do Foundry nem no Local. Complications valem para o Job inteiro; Traços de cena valem até "Encerrar cena".
- Cena do Foundry: o projeto não grava nada nela.

### B.2 Fatos do Foundry v14 que pesam

- `Scene` não tem `system` nem tipos no v14 (ver A.2): qualquer dado do sistema na Cena é `flags.leverage-gta.*` sem
  esquema, e editar exige injetar uma aba/campo na `SceneConfig` (hook de render da config; frágil entre versões, ainda
  mais na v14 por causa dos Scene Levels, que reformularam essa janela) ou um app próprio.
- A v14 trouxe **Scene Levels** (vários níveis/andares numa Cena). Isso favorece "1 Cena = 1 lugar com andares", mas não
  muda o fato de não haver `system` na Cena.
- Uma Cena pode ser aberta por UUID, ligada em texto (`@UUID[Scene.x]`), ter `journal` (nota ligada) e ficar em
  compêndio, mas compêndio de Cenas é pesado (imagens) e é raro para um sistema leve.
- Tokens de Ator `location` só servem como "marcador" para Traços; não têm vida/colete úteis (o `primaryTokenAttribute`
  é `life`, que o Local não tem).

### B.3 Alternativas

| Peso | **B1. Manter Actor `location` (token)** | **B2. A Cena é a ficha do lugar** | **B3. Actor `location` + ligação a Cenas por flag (híbrido)** |
| --- | --- | --- | --- |
| Traços do lugar entram sozinhos ao trocar de Cena | não (precisa token) | sim | sim (pela flag da Cena vista); token continua funcionando |
| Traços de cena (narrativos, até Encerrar cena) | no Job | no Job (ou flag da Cena) | no Job |
| Complications globais | no Job | no Job | no Job |
| Mapas e tokens | independentes do Local | o mapa *é* o lugar | 1 Local pode ter vários mapas; 1 mapa aponta para 1 Local |
| Reutilizar o mesmo lugar em várias Cenas | sim (mesmo Ator) | não (copiar flags) | sim |
| Cena sem mapa (teatro da mente) | token em outra Cena | exige Cena em branco por lugar | Cena em branco é só 1 Cena |
| Esquema validado / ficha pronta | sim (já feita e revisada) | não (flags + injetar na `SceneConfig`) | sim (reusa a ficha) |
| Compêndio `locais` | existe | perde (Cenas pesadas) | mantém |
| UX do mestre | token "poluindo" o mapa | uma coisa só, mas config da Cena virou formulário | arrasta a Cena para a ficha do Local (ou botão "Criar mapa") |
| Migração | nenhuma | grande (Locais→Cenas, tokens soltos, pack, ficha, testes) | pequena (nenhum dado muda; só nasce a flag) |
| Risco v14 | baixo | alto (SceneConfig/Levels) | baixo (flag + `canvasReady`) |

O que o dono provavelmente sente é o primeiro item: "tenho que pôr um token do lugar no mapa para o painel mostrar os
Traços". Isso se resolve sem mudar o que é o Local.

### B.4 Recomendação (B)

**B3: manter o Actor `location` como a ficha do lugar e ligá-lo a Cenas por uma flag na Cena
(`flags.leverage-gta.location = <UUID do Local>`).** A Cena vista passa a informar o Local ao painel de cena e ao rolador,
sem token. Detalhes:

1. **Fonte única da ligação: a Cena.** O lado reverso (Local → Cenas) é calculado
   (`game.scenes.filter(s => s.getFlag(SYSTEM_ID, "location") === actor.uuid)`), para não haver duas verdades.
2. **Local da Cena vista** = flag da Cena vista, mais os tokens `location` de hoje (união sem repetir). Token continua
   válido para quem já usa (nenhuma regressão).
3. **Como ligar** (mestre): (a) na ficha do Local, seção "Cenas": arrastar uma Cena para lá (grava a flag nela) e botão
   "Criar mapa" que cria uma Cena vazia com o nome do Local e a flag; (b) opcional: item no menu de contexto do diretório de
   Cenas. **Não** mexer na `SceneConfig`.
4. **Traços de cena continuam no Job** e são limpos por "Encerrar cena" (regra do livro: duram a cena narrativa). **Não**
   prender à Cena do Foundry: uma cena narrativa troca de mapa e um mapa abriga várias cenas narrativas. Se mais tarde o dono
   quiser Traços *duráveis do lugar*, o lugar para isso já existe: os Traços do próprio Local.
5. **Complications ficam globais** (no Job, ver A). O Local não tem Complications.
6. **Permissão:** o Local precisa de `ownership.default = OBSERVER` para o jogador resolver o UUID e ler os Traços (os
   tokens já exigem isso hoje para o painel; confirmar no Foundry real).

Por que não B2: sem `system` na Cena, o "Local como Cena" troca uma ficha validada por flags soltas, exige mexer numa
janela que a v14 reformulou, perde o compêndio de Locais e a reutilização do mesmo lugar em vários mapas, e obriga migração
de dados e de testes sem resolver nada que a flag não resolva.

### B.5 Esboço

```js
// module/world-state.mjs  (ou module/scene-location.mjs, sem importar apps)
export const sceneLocationUuid = (scene) => scene?.getFlag(SYSTEM_ID, "location") ?? null;
/** Locais da Cena vista: o ligado por flag mais os dos tokens, sem repetir. */
export function viewedLocations() {
  const scene = canvas?.scene ?? game.scenes?.viewed;
  const linked = [fromUuidSync(sceneLocationUuid(scene) ?? "")].filter((a) => a?.type === "location");
  const tokens = (scene?.tokens ?? []).map((t) => t.actor).filter((a) => a?.type === "location");
  return [...new Map([...linked, ...tokens].map((a) => [a.id, a])).values()];
}
// scene-panel.mjs: acrescentar as linhas dos linked como "tokens" sinteticos; opposition-roller.mjs sceneLocations() usa viewedLocations().
```

### B.6 Gotchas (B)

- `fromUuidSync` só resolve Local do **mundo**; se alguém apontar a flag para um Local de compêndio, resolver com
  `await fromUuid` ou impedir na UI (arrastar de compêndio importa antes).
- Hooks de atualização: o painel já escuta `updateScene` e `canvasReady`; a flag vive em `updateScene`, então atualiza
  sozinho.
- A flag em Cena é gravada pelo mestre (jogador não edita Cena).
- Cidade: continua `wanted.city`; `policeCity` já aceita a lista de Locais, então passar `viewedLocations()` mantém o
  comportamento (`opposition.mjs:84`).
- Apagar o Local deixa a flag órfã: ignorar sem erro; opcional `deleteActor` limpa as flags.

---

## Lista de tarefas (formato `docs/10-backlog.md`)

Sugestão: nova **Fase 10 — Jobs como Itens e Locais ligados a Cenas**. Cada tarefa de código passa por `tester` +
`reviewer` antes do `[x]`. Pela ordem de dependência; as marcadas *Par* podem ir em paralelo.

### Parte A. Job como Item de mundo

- [ ] **J-01 Camada de armazenamento do Job.** Criar `module/applications/gm/job-store.mjs` com `readJob()`/`saveJob()`
  (hoje sobre o setting `activeJob`), trocar as 4 leituras diretas (`scene-panel.mjs:67`, `tray.mjs:34`,
  `opposition-roller.mjs:127,166`) e as 5 escritas (`job-actions.mjs` x3, `job-tracker.mjs:109`, `card-handlers.mjs:133`) para
  usar só ela. *Pronto:* nenhum `readSetting("activeJob")`/`settings.set(…"activeJob"…)` fora do `job-store.mjs`; testes
  de unidade e T-702/T-703 passam sem mudança de comportamento. *Dep:* nenhuma.
- [ ] **J-02 Tipo `heist` (modelo de dados).** `module/data/item/heist.mjs`, registro em `CONFIG.Item.dataModels`,
  `system.json` (`documentTypes.Item.heist`, `htmlFields`), ícone e i18n (`LEVERAGE.Item.heist`, en e pt-BR), atualizar
  `docs/04` e `docs/05`. *Pronto:* criar um Item `heist` pelo diretório sem erro; teste de esquema. *Dep:* nenhuma.
  *Par:* J-01.
- [ ] **J-03 Ficha do Job (Item `heist`).** Ficha `ItemSheetV2` com nome, status (select), objetivo, notas, lista de
  Complications e de Traços de cena (reaproveitar a lógica de `job-tracker-logic.mjs`), pagamento. Segue
  `docs/03` e usa `die.mjs` para os dados. *Pronto:* abre, edita e salva; só o mestre edita; print comparado com o estilo
  das outras fichas. *Dep:* J-02.
- [ ] **J-04 Trocar o armazenamento para o Item.** `job-store.mjs` lê/grava o `heist` ativo
  (`status: "active"`), dispara `leverage.activeJobChanged` em `create/update/deleteItem` de `heist`; `newJob` cria o Item e
  ativa (demovendo o anterior para `planned`); `ownership.default = OBSERVER` ao criar. *Pronto:* Rastreador, painel de
  cena, bandeja, rolador e Complication pelo card funcionam como antes; **testado com usuário jogador** (vê o painel e
  os Traços de cena na Pool). *Dep:* J-01, J-02.
- [ ] **J-05 Migração 0.2.0.** Entrada em `MIGRATIONS`: setting `activeJob` não vazio vira `heist` ativo; zera o setting.
  Teste de unidade (`pendingMigrations`) e teste no Foundry com um mundo antigo. *Dep:* J-04.
- [ ] **J-06 Encerrar Job guarda o histórico.** `endJob`: `status = done`, `payout.total`, `crew[]` (UUID + parte), mantém
  Complications e Traços; o Record `job` de cada ficha recebe a ligação ao `heist` (campo `source` ou flag); chat com
  `@UUID`. Records, Callback e Training Up inalterados. *Pronto:* teste de unidade de `endJob` e T-704 ajustados; o
  dossiê `done` aparece no diretório com os dados. *Dep:* J-04.
- [ ] **J-07 Rastreador com lista de Jobs.** Cabeçalho do Rastreador com o Job ativo (abre a ficha), botões "Novo Job" e
  "Iniciar" (planejados), estado "Nenhum Job ativo". Complications/Traços exigem Job ativo. *Dep:* J-04. *Par:* J-06.
- [ ] **J-08 Ligações do Job (opcional).** Campos `npcs`, `places`, `scenes` (UUID) na ficha do Job: arrastar para
  adicionar, linha com imagem e nome, clique abre, UUID quebrado aparece riscado, X remove. *Dep:* J-03.
- [ ] **J-09 Pack `jobs` com golpes de exemplo (opcional).** `packs/_source/jobs`, entrada no `system.json`, 1–2 golpes
  `planned` próprios (não copiados do livro) ligando NPCs e Local do compêndio de exemplo. *Dep:* J-08.
- [ ] **J-10 Documentação.** Atualizar `docs/05`, `docs/09`, `docs/USO.md`, `DECISIONS.md` (dois tipos, status no Item,
  nomes) e `CHANGELOG.md`. *Dep:* J-06, J-07.
- [ ] **R-FJ Revisão da fase.** `reviewer` passa o conjunto, com teste no Foundry como mestre e jogador.

### Parte B. Locais ligados a Cenas

- [ ] **L-01 Leitor dos Locais da Cena vista.** `viewedLocations()` (flag da Cena + tokens) em módulo puro/testável;
  teste de unidade com Cenas falsas. *Dep:* nenhuma.
- [ ] **L-02 Painel de cena e rolador usam `viewedLocations()`.** `scene-panel.mjs` (linhas sintéticas dos Locais ligados)
  e `opposition-roller.mjs sceneLocations()`; `policeCity` recebe a mesma lista. *Pronto:* Cena com flag e **sem token** mostra
  os Traços do Local no painel (mestre e jogador) e no rolador. *Dep:* L-01.
- [ ] **L-03 Seção "Cenas" na ficha do Local.** Arrastar Cena grava a flag; lista de Cenas ligadas (calculada) com
  abrir e desligar; botão "Criar mapa" (Cena vazia com o nome do Local e a flag). Textos em i18n. *Dep:* L-01.
- [ ] **L-04 Permissão do Local.** `ownership.default = OBSERVER` na criação de Atores `location` (e confirmar nos do pack);
  teste no Foundry com jogador. *Dep:* L-02. *Par:* L-03.
- [ ] **L-05 Documentação.** `docs/05` (flag da Cena), `docs/06` (seção Cenas do Local), `docs/09`, `USO.md`,
  `DECISIONS.md` (por que não a Cena como ficha). *Dep:* L-03.
- [ ] **R-FL Revisão da fase.**

---

## Resumo da decisão

- **A:** Job como Item de mundo de tipo novo `heist` (status `planned/active/done` no próprio Item, um ativo por vez), com
  Complications e Traços de cena dentro dele. O `job` atual continua como Record por personagem (Callback, Training Up e
  pagamento não mudam). Ligações a NPCs/Locais/Cenas são um dossiê opcional por UUID.
- **B:** manter o Ator `location` e ligá-lo às Cenas por `flags.leverage-gta.location` na Cena; token continua valendo.
  Traços de cena seguem no Job; Complications seguem globais.

## Pendências a verificar no Foundry real (não confirmadas por docs)

- Se Item/Ator de mundo com `ownership.default = NONE` realmente não chega ao cliente do jogador (afeta A.4-6 e B.4-6;
  a conduta segura é `OBSERVER` de qualquer forma).
- `Scene.hasTypeData` e `JournalEntry.hasTypeData` em runtime (`Scene.hasTypeData`); a API v14 não lista `type`/`system`
  nos esquemas, o que sustenta a recomendação, mas vale um `console.log` rápido.
- Nome atual do hook do menu de contexto do diretório de Cenas na v14 (só para o opcional de B.4-3b).
