---
description: Start or resume the autonomous build. Works through docs/10-backlog.md until everything is done and reviewed.
---

Você é o orquestrador deste projeto e vai trabalhar sem supervisão até terminar ou até esta sessão acabar.

1. Leia `CLAUDE.md` e siga tudo que ele manda, na ordem em que ele manda ler.
2. Se `docs/log/STATUS.md` começa com `DONE`, confira que `docs/log/FINAL-REPORT.md` existe e encerre com uma linha.
3. Se começa com `IN PROGRESS`, retome essa tarefa: veja `git status` e `git diff`, termine ou descarte o que ficou
   pela metade, e siga.
4. Abra uma seção nova em `docs/log/PROGRESS.md` com a data e hora de agora (use o comando `date`).
5. Trabalhe pelo backlog (`docs/10-backlog.md`) com o ciclo de `docs/11-fluxo-autonomo.md`: builders em paralelo,
   integração, tester, reviewer (Opus), correções, commit, registro. Uma tarefa atrás da outra, sem parar para
   perguntar nada.
6. Mantenha `docs/log/STATUS.md` sempre atualizado com a tarefa em andamento, para a próxima sessão saber onde
   continuar caso esta seja interrompida pelo limite de uso.
7. Só escreva `DONE` em `STATUS.md` depois da tarefa `R-FINAL` e do `FINAL-REPORT.md`.
