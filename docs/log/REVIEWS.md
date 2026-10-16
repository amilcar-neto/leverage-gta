# Revisões (Opus)

Um resumo por revisão: tarefa ou fase, veredito, defeitos encontrados, o que foi corrigido, o que ficou para depois.

## R-F1 — Fase 1 (T-101..T-106) — revisão de conjunto (Opus)
- Veredito: precisa de correções. 2 bloqueios, 10 "deveria", vários detalhes.
- Bloqueios: (1) trava de Traços e limite de 3 Distinctions usavam hooks `_pre*DescendantDocuments`, que não cancelam nada na v14 → movidos para `LeverageItem#_pre*`. (2) configurações `lifeBase` e `moneyStart` eram registradas mas ninguém as lia → ligadas ao modelo.
- Deveria: constantes duplicadas fora de `config.mjs`, regras de estrelas presas ao id da cidade, preços de Wasted/Busted fixos, stubs com classe raiz errada, `deriveRoleRanks` sem teste, formato de preço da Grana.
- Em correção (2 builders). Ficam como riscos: trava só no cliente (aceito pela mesa); chaves de setting com ponto a confirmar no Foundry real; menus de GM ainda são stubs até a T-705.
- R-F1 fechada: bloqueios corrigidos (trava/limite agora em `LeverageItem#_pre*` e `createEmbeddedDocuments`; `lifeBase`/`moneyStart` lidas), constantes movidas para `config.mjs`. Tester confirmou no Foundry real (jogador de teste: limite de 3 Distinctions e trava funcionam; GM passa).
