# 12 — Pesquisa: onde aprender cada coisa

O `researcher` usa esta lista. Cada resposta vira uma nota curta em `docs/research/<assunto>.md` (veja o formato em
`.claude/agents/researcher.md`). Pesquise **sob demanda**: só o que a próxima tarefa precisa.

## Fontes primárias

| Fonte | Para quê |
| --- | --- |
| API oficial do Foundry **v14** (`https://foundryvtt.com/api/v14/` — confirme o endereço) | Assinaturas exatas, nomes de namespaces, hooks |
| Notas de versão da v14 (`https://foundryvtt.com/releases/`) | O que mudou desde a v13 (ApplicationV2, CSS layers, controles de cena, chat) |
| Base de conhecimento do Foundry: "System Development", "Data Models", "ApplicationV2" | Conceitos e exemplos oficiais |
| `foundryvtt/dnd5e` (GitHub) | **Modelo principal** de organização. Use a branch/tag cujo `system.json` declara compatibilidade com v14 |

## O que extrair do dnd5e

- Árvore de pastas `module/` (data, documents, applications, dice, canvas, utils) e o arquivo de entrada.
- Como define `TypeDataModel` com `defineSchema`, `prepareBaseData`/`prepareDerivedData` e campos customizados.
- `Actor#getRollData` e como as `@`-referências viram fórmulas; macros criadas por arrastar da ficha.
- Fichas em ApplicationV2: `PARTS`, `TABS`, `actions`, `_prepareContext`, `_preparePartContext`, drag & drop,
  re-render parcial, registro da ficha.
- Configurações com menus (`registerMenu`) e apps de configuração.
- CSS: como organizam camadas (`@layer`), variáveis e escopo.
- Migração (`migration.mjs`, `systemMigrationVersion`).
- Packs: fonte em JSON/YAML e build com `@foundryvtt/foundryvtt-cli`.

## Outros sistemas (só o que servir)

| Repositório | Olhar |
| --- | --- |
| `foundryvtt/pf2e` | Organização de um projeto enorme, HUDs e elementos fora de janela, testes |
| `massif-press/foundryvtt-lancer` | Cards de chat ricos e consistentes, UI temática |
| `cortexprime` (Secular12, pacote "Cortex Prime" no site do Foundry) | Como outro sistema de Pool de dados monta, rola e mostra dados |
| Dice So Nice (`foundry-vtt-community` ou o repositório oficial do módulo) | API de cores por tipo de dado |

## Perguntas já sabidas para responder cedo (T-002/T-003)

1. Manifesto v14: campos obrigatórios, `documentTypes`, `compatibility`, como declarar fontes e `flags`.
2. Caminho atual de `DocumentSheetConfig.registerSheet` e de `ActorSheetV2`/`ItemSheetV2` na v14.
3. Formato do hook dos controles de cena (`getSceneControlButtons`) na v14 e como fazer toggle e botão.
4. Hook para ligar listeners no HTML das mensagens de chat na v14 (`renderChatMessageHTML` na v13?).
5. Onde inserir um elemento de HUD fixo na interface da v14 e como medir a largura da barra lateral.
6. CSS layer recomendada para sistemas na v14.
7. Socket de sistema: nome do canal e boas práticas (só o mestre aplica).
8. ProseMirror/`HTMLField` em ApplicationV2 (campo Background e notas).
