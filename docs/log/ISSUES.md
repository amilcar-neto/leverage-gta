# Problemas e pendências

Formato: `## <id> — <título>` · **Gravidade** (bloqueia / importante / menor) · **Situação** (aberto / resolvido) ·
**Detalhe** · **O que o dono precisa fazer** (se algo).

## I-001 — Licença da fonte Pricedown
- **Gravidade:** menor · **Situação:** aberto
- **Detalhe:** a Pricedown (fonte do GTA III) é da Typodermic; não foi confirmado se a licença permite embutir num
  sistema distribuído. Usando Anton (OFL) na variável `--lv-font-display`.
- **Dono:** se quiser a Pricedown, confira a licença em typodermicfonts.com e coloque o arquivo em `fonts/`.

## I-002 — Custos de evolução (Train up) ilegíveis no OCR (inclui o antigo I-005)
- **Gravidade:** média · **Situação:** aberto (provisório)
- **Detalhe:** a tabela "Training Up" do livro saiu ilegível no texto extraído (leverage.txt, linhas ~2500–2512). Só o
  custo do Signature Asset está confirmado. Por isso o diálogo TRAIN UP lê `trainingCosts` (padrão em
  `LEVERAGE.defaultTrainingCosts`: Signature Asset 1, Specialty 1, Talent 1, Attribute 2, Role 2) e o menu **Custos de
  treinamento** deixa o mestre ajustar. O diálogo só gasta os Jobs (marca `spent`, os mais antigos primeiro) e avisa no
  chat; o item novo (Specialty, Talent...) é criado depois na ficha, destravada. Attribute/Role: ajustar o dado à mão.
- **Dono:** conferir a tabela no PDF e ajustar o menu de custos.

## I-003 — API da v14 não verificada no design
- **Gravidade:** importante · **Situação:** fechado
- **Detalhe:** a verificação da API da v14 foi feita na T-002 (`docs/research/`) e os caminhos usados no código foram
  testados no Foundry real em cada tarefa.

## 2026-10-16 — Smoke test: usuário Gamemaster ocupado (resolvido: dono deslogou; smoke passou)
- Deploy via `npm run deploy` funciona (OpenSSH do Windows + chown foundry).
- O login do Playwright falha porque a opção `Gamemaster` fica desabilitada enquanto o dono está logado nele.
- Dono precisa: criar um usuário `Claude` (Mestre do Jogo, sem senha) no mundo e avisar; depois trocar `FOUNDRY_USER=Claude` no `.env`.
- Até lá: seguir com testes de unidade e revisão de código; repetir o smoke ao fim de cada fase.

## 2026-10-17 - Campos protegidos dos Items so na ficha (R-F4/R-F5) — RESOLVIDO na R-FINAL (guarda em LeverageItem#_preUpdate)
- Gravidade baixa. `die`/`duration` do Asset e `payout.share`/`spent` do Job so sao protegidos nas fichas (acoes e formulario). Um jogador que chame `item.update` pelo console ainda consegue mudar esses campos. Correcao possivel: guarda em `preUpdateItem` usando `LEVERAGE.protectedItemFields`. Nao resolvido (arquivo `documents/item.mjs` fora do escopo desta parte).

## T-506 - Dice So Nice nao testado com o modulo ativo
- Gravidade: baixa. O modulo `dice-so-nice` esta instalado no servidor, mas nao ativo no mundo de teste.
- Testado: sem o modulo nada quebra, cada termo Die leva `options.appearance` e isso sobrevive a serializacao (T-506).
- Nao testado: registro real dos colorsets e cores na animacao. O dono pode ativar o modulo no mundo e rodar `node tests/foundry/T-506.mjs` (ele confere os 6 colorsets).
- Nao feito: esconder o card ate a animacao acabar via `linkedTo`. Nao e preciso: o card ja leva `rolls`, e o Dice So Nice o esconde sozinho.

## T-902 - Pontos visuais vistos na ficha da Rosa (para o builder de UI)
- Gravidade baixa. No print `T-902-rosa.png`: (1) o aviso do navegador "sem aceleração de hardware" cobre o cabeçalho (é do ambiente de teste, não do sistema); (2) títulos de seção em inglês (ATTRIBUTES, DISTINCTIONS...) misturados com textos em pt-BR: **resolvido**, é intencional (nomes do livro ficam em inglês, como diz o guia de uso); (3) o texto do Background mostra rótulos como "RAISED:" em inglês, que é o conteúdo de exemplo. Não alterado (CSS/templates fora do escopo).

## Onda B (CSS/UI) de R-F4..R-F8: conferência no Foundry real
- Conferido com screenshots no Foundry do VPS (ficha da Equipe, NPC, Local, itens Talent/Asset, cards de rolagem com Grana e 7 dados, Rastreador, Rolador de oposição). Sem erros no console.
- Não conferido: janelas de configuração (cidades, preços, treino), diálogos de Grana, card WASTED/BUSTED e o HUD vazio (só tokens trocados, sem mudança de layout).
- O selo da trava em NPC/Local está escondido por CSS (`window.css`). O certo é não montar o selo nessas fichas (JS em `base-actor-sheet.mjs`). Gravidade baixa. **Resolvido:** o selo não é mais montado em JS nessas fichas.

## Visual da Grana no HUD (decisão do dono pendente)
- O dono acha feio (cifrão + dados de formatos diferentes). Não mexer até o dono rever o sistema pronto.
- Opção A: só o dado mais alto, grande, com `$` pequeno e indicador de degraus. Opção B: todos os dados menores, sem `$` e sem contorno preto.

## Licença do sistema não definida
- **Gravidade:** menor · **Situação:** aberto
- **Detalhe:** não existe `LICENSE` nem decisão de licença nos logs. O release deixou de listar `LICENSE` e `README-SYSTEM.md` (não existem). O `system.json` pode precisar de um campo `license` quando houver uma.
- **O que o dono precisa fazer:** escolher uma licença (ex.: MIT) e adicionar `LICENSE` na raiz e em `SHIP` de `tools/release.mjs`.

## Playtest 2026-10-21 - bugs achados (detalhes e prints em `docs/log/PLAYTEST.md`)
- **Média, aberto:** Asset com Nome em branco no `+ Adicionar` fecha o diálogo sem aviso e gera `DataModelValidationError` no console. O `DialogV2.prompt` troca o `null` do callback por `"ok"` e o `if (!choice) return` de `assets.mjs` deixa passar. Passos: ficha de jogador, + Adicionar, nome vazio, CRIAR.
- **Média, aberto:** a ficha da Equipe minimizada (duplo clique) não mostra o nome do personagem, só o selo de trava e o X. Print `playtest-05-rosa-sheet-minimized.png`.
- **Baixa, aberto:** em Encerrar Job, o nome longo do personagem quebra em 3 linhas por cima do campo numérico. Print `playtest-71-gm-end-job-filled.png`.
- **Baixa, aberto:** card de rolagem diz "1 maiores mantidos" (falta singular em `LEVERAGE.Roll.explain`).
- Melhorias (sem gravidade): campo "Objetivo" no Job, gangue do NPC da cena como sugestão no Rolador de oposição, arma preenchida no APLICAR DANO, aviso ao trocar de colete por um pior. Ver PLAYTEST.md.
- O mundo de teste está com a Trava de Traços desligada; o dono deve conferir antes de jogar.

## Playtest 2026-10-21 - bugs corrigidos
- Os 4 bugs (Asset em branco, nome na ficha minimizada, Encerrar Job, plural de "maior mantido") foram corrigidos e conferidos no Foundry real com `tests/foundry/playtest-fixes.mjs`. O campo Objetivo do Job foi implementado.

## Playtest 2026-10-21 - sugestoes (nao feitas)
- Rolador de oposicao: se a cena tem um so NPC com gangue, sugerir o dado dele em vez de 3 x d6.
- APLICAR DANO comeca em "Sem atacante / Sem arma": lembrar a arma ou destacar o campo quando o dano e so a margem.
- Comprar colete leve quando ja se tem um melhor: avisar que rebaixa.
- Aviso na configuracao `scenePanel.showActorTraits`: os Traits de NPC ficam visiveis aos jogadores por padrao.
- Barra lateral fechada esconde o chat: avisar quando ha acao pendente no card.
- Mundo de teste com Trava de Tracos desligada: o dono confere antes de jogar de verdade.
- Retratos para fichas e tokens; dado de 1 degrau da Grana no Rastreador muito pequeno.
