IN PROGRESS: Fase 10, onda 1 (PAUSADA a pedido do dono, 2026-10-21)

Feito e NÃO commitado (sem tester/reviewer ainda): L-01..L-05 (Lugar escolhe a Cena: campo `scene`, seletor na ficha,
module/scene-location.mjs, hooks no entry), T-1101 (PP de todos os jogadores + "Mesa" no HUD do mestre, setting
`tablePlotPoints`, CSS em styles/hud.css), i18n mesclado (tools/merge-i18n.mjs). 252 testes verdes.
Em aberto: T-1100 (builder atualizando tests/foundry; lint ainda acusa 'actor' em T-401.mjs linhas 189/194),
depois tester + reviewer de L-01..L-05 e T-1101, L-06, J-01.., Cortex Prime.
Ao retomar: git status/diff, conferir o resultado do T-1100, seguir o ciclo do docs/11.

T-1100 terminou (ainda sem commit/revisão): os 8 scripts usam `sheetUnlocked`/`playersCanUnlock`; 7 passam no Foundry de teste.
T-505 falha por outro motivo: rollPool com `scene:<id>` do Job ativo ("Referência de Pool desconhecida"); precisa de tarefa à parte
(provável efeito de os Traços de cena terem saído do Job, ou código não deployado). Existe um stash antigo (stash@{0}, T-904), não tocado.

Retomado 21:12 (reset do dono às 23h10). Tester rodando em L-01..L-05 e T-1101; depois reviewer, commit, L-06.
