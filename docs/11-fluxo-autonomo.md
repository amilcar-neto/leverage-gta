# 11 — Fluxo de trabalho autônomo

Como o orquestrador trabalha sozinho, gasta pouco, faz várias coisas ao mesmo tempo e mantém a qualidade.

## Os papéis

| Agente | Modelo | Arquivo | Para quê |
| --- | --- | --- | --- |
| **Orquestrador** (sessão principal) | `sonnet` | `CLAUDE.md` | Lê o backlog, divide o trabalho, dispara os outros agentes, integra, faz commit, escreve os logs |
| `researcher` | `sonnet` | `.claude/agents/researcher.md` | Lê repositórios e a API do Foundry e devolve notas curtas em `docs/research/` |
| `builder` | `sonnet` | `.claude/agents/builder.md` | Escreve código de **um** pedaço bem delimitado (um tipo de item, uma aplicação, um template) |
| `scribe` | `haiku` | `.claude/agents/scribe.md` | Trabalho mecânico: chaves de i18n, tradução pt-BR, JSDoc, arquivos de exemplo, formatação de logs |
| `tester` | `sonnet` | `.claude/agents/tester.md` | Roda testes de unidade e o teste no Foundry com Playwright, devolve erros e prints |
| `reviewer` | `opus` | `.claude/agents/reviewer.md` | Revisa um pedaço (código + print contra o mockup) e devolve uma lista objetiva de defeitos |
| `integration-reviewer` | `opus` | `.claude/agents/integration-reviewer.md` | Revisa o conjunto no fim de cada fase e no fim do projeto |

O orquestrador **não escreve código grande ele mesmo**. Ele pode fazer ajustes pequenos de integração (registrar um
tipo no `config.mjs`, uma linha no arquivo de entrada), mas o grosso vai para os `builder`s.

## O ciclo de uma tarefa

```
backlog → (researcher, se a tarefa pede) → builder(s) em paralelo → orquestrador integra
       → tester → reviewer (Opus) → builder corrige o que o reviewer listou → tester de novo
       → commit → PROGRESS.md → próxima tarefa
```

1. **Escolher.** Pegue as tarefas `[ ]` cujas dependências estão `[x]`. Se várias estão livres e mexem em arquivos
   diferentes, faça-as **juntas** (veja Paralelismo).
2. **Preparar o pacote de contexto.** Para cada `builder`, escreva um pedido curto e completo: o id da tarefa, os
   critérios de pronto copiados do backlog, os arquivos que ele **pode** criar/editar (lista fechada), os arquivos que
   ele deve ler (só os necessários: o trecho certo de `docs/05`, `docs/06`, o PNG do mockup), e o padrão de código a
   seguir (um arquivo existente parecido). Pedidos vagos geram retrabalho caro.
3. **Construir.** Dispare os `builder`s. Cada um devolve: arquivos alterados, o que ficou de fora, dúvidas que decidiu.
4. **Integrar.** O orquestrador faz as ligações nos arquivos compartilhados (veja abaixo) e roda `npm run lint` e
   `npm test`.
5. **Testar.** `tester` sobe o Foundry de teste (se existir), abre a tela, tira prints, coleta erros do console.
6. **Revisar.** `reviewer` recebe: o diff da tarefa, os critérios de pronto, os prints e o PNG do mockup. Devolve
   defeitos classificados em `bloqueia`, `deveria` e `detalhe`.
7. **Corrigir.** Tudo que é `bloqueia` e `deveria` volta para um `builder` (o mesmo pedido + a lista do revisor).
   No máximo **2 voltas**; se ainda sobrar `bloqueia`, registre em `ISSUES.md`, marque `[!]` e siga.
8. **Fechar.** Commit, `[x]` no backlog, linha no `PROGRESS.md`, resumo da revisão em `REVIEWS.md`.

## Paralelismo (o jeito de gastar pouco e andar rápido)

- Rode vários `builder`s **na mesma mensagem** (várias chamadas do Agent tool juntas) quando as tarefas não editam o
  mesmo arquivo. Exemplo bom: um faz o item `job`, outro o item `asset`, outro o item `talent`, cada um em sua pasta.
- **Arquivos compartilhados são do orquestrador.** `leverage-gta.mjs`, `module/config.mjs`, `system.json`,
  `lang/*.json`, `styles/leverage-gta.css` (o índice dos estilos) e `templates/` de partes comuns. Os `builder`s
  **não editam** esses arquivos; eles devolvem no relatório "adicione X ao config", "registre Y no entry", "chaves de
  i18n novas: {...}". O orquestrador aplica tudo de uma vez depois que os paralelos terminam.
- Cada `builder` recebe uma lista fechada de arquivos que pode tocar. Se precisar de outro, ele diz no relatório em
  vez de editar.
- Um `scribe` (Haiku) junta as chaves de i18n novas e escreve as traduções pt-BR em lote, uma vez por fase.
- Não rode mais de **4 builders ao mesmo tempo**: acima disso a integração fica cara e os conflitos aparecem.
- O `reviewer` pode revisar vários pedaços em paralelo também: um `reviewer` por pedaço, na mesma mensagem.

## Revisões do Opus

- **Por tarefa** (`reviewer`): correção, aderência aos documentos, legibilidade do código, e — se tem tela — o print
  contra o mockup. Checklist em `.claude/agents/reviewer.md`.
- **Por fase** (`integration-reviewer`): no fim de cada fase do backlog (tarefas `R-Fx`). Olha o conjunto: padrões
  repetidos que deveriam ser um só, nomes inconsistentes, CSS duplicado, telas que não conversam entre si, regras que
  ficaram diferentes do `docs/02` e `docs/01`.
- **Final** (`R-FINAL`): revisão completa do sistema, em duas passadas (código e experiência de uso no Foundry),
  seguida de correções e de um relatório em `docs/log/FINAL-REPORT.md`.

## Economia de tokens

- Leia só o que a tarefa precisa. Os documentos são divididos por assunto justamente para isso.
- Use `reference/books/text/*.txt` com `grep` em vez de abrir os PDFs.
- Use os PNGs dos mockups (imagem) e não os `.dc.html` (são enormes e com placeholders).
- Prefira editar a reescrever arquivos inteiros.
- Resumos de agentes devem ser curtos: arquivos, decisões, pendências. Nada de colar código no relatório.
- Quando o contexto do orquestrador ficar grande, atualize os logs, faça commit e continue: o script reinicia a
  sessão quando ela termina, e tudo que importa está nos arquivos.

## Commits

- Um commit por tarefa fechada (ou por grupo paralelo fechado), mensagem `T-<id>: <o que mudou>`.
- Antes do commit: `npm run lint` e `npm test` sem erro.
- Se o `git` não estiver inicializado, rode `git init` na primeira sessão e faça o commit inicial do pacote.

## Quando parar

- Todas as tarefas `[x]` ou `[!]`, `R-FINAL` concluída, `FINAL-REPORT.md` escrito: escreva `DONE` em `STATUS.md`.
- Nunca escreva `DONE` só porque o contexto está acabando: nesse caso salve o estado e deixe o script reiniciar.
