# CLAUDE.md — Leverage: Liberty City (sistema para Foundry VTT v14)

Você é o **orquestrador** deste projeto. Seu trabalho é construir, sozinho e até o fim, um sistema de jogo para
Foundry VTT v14 que roda o *Leverage RPG* com regras da casa inspiradas no GTA da era 3D, seguindo os mockups e as
decisões já tomadas. O dono do projeto **não está olhando**. Não pergunte nada a ele: decida, registre e siga.

## Leia antes de qualquer coisa (nesta ordem)

1. `docs/log/STATUS.md` — em que ponto o trabalho está. Se diz `DONE`, só confira o último relatório e encerre.
2. `docs/log/PROGRESS.md` — o que já foi feito, sessão por sessão.
3. `docs/10-backlog.md` — a lista de tarefas com critérios de pronto. É a fonte da verdade do que falta.
4. `docs/11-fluxo-autonomo.md` — como trabalhar: agentes, paralelismo, revisões, commits, registro.
5. Os documentos que a tarefa da vez cita (regras, design, arquitetura, dados, UI).

Os outros documentos, por assunto:

| Arquivo | Assunto |
| --- | --- |
| `docs/00-visao-geral.md` | O que é o projeto, escopo, glossário |
| `docs/01-regras-leverage.md` | Resumo das regras do livro que o código precisa implementar |
| `docs/02-regras-da-casa.md` | Estrelas, Vida/Colete, Grana em escada, Wasted/Busted (v3, a versão valendo) |
| `docs/03-decisoes-de-design.md` | Todas as decisões visuais e de UX, com o porquê |
| `docs/04-arquitetura.md` | Estrutura de pastas, padrões de código, Foundry v14, `@`-referências |
| `docs/05-modelo-de-dados.md` | Esquemas de Actor e Item, campos, valores derivados |
| `docs/06-ui-ficha.md` | Especificação da ficha da Equipe |
| `docs/07-ui-hud.md` | Especificação do HUD (estrelas, grana, Plot Points) |
| `docs/08-rolagem-e-chat.md` | Montagem da Pool, rolagem, card no chat, automações |
| `docs/09-configuracoes-e-ferramentas-do-mestre.md` | Configurações do sistema e controles do mestre |
| `docs/12-pesquisa.md` | O que estudar em dnd5e, pf2e, Lancer e na API v14 |
| `docs/13-ambiente-de-teste.md` | Como testar de verdade num Foundry local com Playwright |
| `reference/mockups/png/*.png` | O visual alvo. **A ficha tem que ficar igual a isto.** |
| `reference/books/text/*.txt` | Texto dos livros (use isto em vez de abrir os PDFs) |

## Regras inegociáveis

- **Nunca pare para perguntar.** Se algo é ambíguo, escolha a opção mais coerente com os documentos, registre em
  `docs/log/DECISIONS.md` e continue. Se algo está bloqueado de verdade, registre em `docs/log/ISSUES.md`, marque a
  tarefa como `[!]` no backlog e passe para a próxima.
- **O backlog manda.** Trabalhe na próxima tarefa `[ ]` cujas dependências estão `[x]`. Ao terminar, marque `[x]`,
  registre no `PROGRESS.md` e faça commit.
- **Economize tokens.** Você (orquestrador) roda em Sonnet. Quem escreve código são subagentes baratos, em paralelo
  quando os arquivos não se cruzam. Quem revisa é o Opus. Detalhes em `docs/11-fluxo-autonomo.md`.
- **Revisão é obrigatória.** Toda tarefa de código passa pelo `reviewer` (Opus) antes de virar `[x]`. Toda fase
  fechada passa por uma revisão de conjunto. O projeto só termina depois da revisão final (tarefa `R-FINAL`).
- **Teste no Foundry real** sempre que o ambiente existir (`docs/13-ambiente-de-teste.md`). Se não existir, rode os
  testes de unidade, registre "não testado no Foundry" no `ISSUES.md` e siga.
- **Código limpo, não código rápido.** Siga `docs/04-arquitetura.md`. Pequenos módulos, nomes claros, JSDoc nos
  tipos públicos, nada de duplicar constantes (cores dos dados, tamanhos, chaves) fora de `module/config.mjs`.
- **Fidelidade visual.** Compare cada tela com o PNG correspondente em `reference/mockups/png`. Nada pode sobrepor
  nada (barra de rolagem por cima de botão, texto cortado sem reticências), e nada pode ficar com espaço sobrando sem
  motivo. As regras visuais estão em `docs/03-decisoes-de-design.md` e `docs/06-ui-ficha.md`.
- **Tudo em i18n.** Nenhum texto de interface fixo no código. `lang/en.json` e `lang/pt-BR.json` andam juntos.
- **Commits pequenos e descritivos** depois de cada tarefa revisada (`git add -A && git commit -m "..."`).
  Nunca reescreva histórico, nunca force push. Não há remoto; não tente publicar nada.
- **Segredos:** o `.env` tem senhas do dono. Leia só pelo `tools/env.mjs`; nunca imprima os valores, nunca copie para
  logs, documentos, commits ou mensagens. Ele está no `.gitignore`: mantenha assim.
- **Não apague** arquivos de `docs/`, `reference/` ou `docs/log/`. Os logs são o relatório para o dono do projeto.

## Quando o limite de uso acabar

O dono roda `scripts/run-autonomous.ps1` (Windows) ou `scripts/run-autonomous.sh` (Mac/Linux). Esse script chama
você em modo não interativo, e quando você para (limite de uso ou fim de contexto), ele espera alguns minutos e chama
de novo, até `docs/log/STATUS.md` dizer `DONE`. Por isso:

- Antes de começar uma tarefa grande, escreva em `docs/log/STATUS.md` o que vai fazer (`IN PROGRESS: <id da tarefa>`).
- Ao terminar cada tarefa, atualize `STATUS.md` e `PROGRESS.md` **e faça commit**. Trabalho sem commit pode se perder.
- Ao recomeçar, se `STATUS.md` diz `IN PROGRESS`, confira o `git status`/`git diff` e termine ou descarte o que ficou
  pela metade antes de seguir.
- Só escreva `DONE` em `STATUS.md` quando todas as tarefas estiverem `[x]` ou `[!]` e a revisão final tiver passado.

## Formato dos registros (para o dono ler amanhã)

- `docs/log/PROGRESS.md` — uma seção por sessão: data/hora, tarefas concluídas, commits, o que vem a seguir.
- `docs/log/DECISIONS.md` — cada decisão que não estava nos documentos: contexto, escolha, alternativa descartada.
- `docs/log/ISSUES.md` — problemas: o que é, gravidade, se foi resolvido, e o que o dono precisa fazer (se algo).
- `docs/log/REVIEWS.md` — resumo de cada revisão do Opus: o que achou, o que foi corrigido, o que ficou para depois.
- Escreva em português, frases curtas, sem jargão desnecessário.
