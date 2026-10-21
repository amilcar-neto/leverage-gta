# Problemas e pendências

Formato: `## <id> — <título>` · **Gravidade** (bloqueia / importante / menor) · **Situação** (aberto / resolvido) ·
**Detalhe** · **O que o dono precisa fazer** (se algo).

## I-001 — Licença da fonte Pricedown
- **Gravidade:** menor · **Situação:** aberto
- **Detalhe:** a Pricedown (fonte do GTA III) é da Typodermic; não foi confirmado se a licença permite embutir num
  sistema distribuído. Usando Anton (OFL) na variável `--lv-font-display`.
- **Dono:** se quiser a Pricedown, confira a licença em typodermicfonts.com e coloque o arquivo em `fonts/`.

## I-002 — Custos de evolução ilegíveis no OCR
- **Gravidade:** importante · **Situação:** aberto
- **Detalhe:** a tabela "Training Up" do livro saiu ilegível no texto extraído (leverage.txt, linhas ~2500–2512).
- **Ação do agente:** abrir o PDF em `reference/books/` e copiar os custos; se não conseguir, usar valores
  configuráveis e manter esta pendência aberta.

## I-003 — API da v14 não verificada no design
- **Gravidade:** importante · **Situação:** aberto
- **Detalhe:** os documentos citam caminhos de API da v13. Confirmar tudo na v14 (tarefa T-002) antes de codar.

## 2026-10-16 — Smoke test: usuário Gamemaster ocupado (resolvido: dono deslogou; smoke passou)
- Deploy via `npm run deploy` funciona (OpenSSH do Windows + chown foundry).
- O login do Playwright falha porque a opção `Gamemaster` fica desabilitada enquanto o dono está logado nele.
- Dono precisa: criar um usuário `Claude` (Mestre do Jogo, sem senha) no mundo e avisar; depois trocar `FOUNDRY_USER=Claude` no `.env`.
- Até lá: seguir com testes de unidade e revisão de código; repetir o smoke ao fim de cada fase.

## I-005 - Custos de Training Up sao provisorios (T-305)
- **Gravidade:** media - **Situacao:** aberto (ligado a I-002)
- **Detalhe:** o dialogo TRAIN UP le `trainingCosts` (padrao em `LEVERAGE.defaultTrainingCosts`: Signature Asset 1, Specialty 1, Talent 1, Attribute 2, Role 2). So o Signature Asset esta confirmado no livro. O dialogo so gasta os Jobs (marca `spent`, os mais antigos primeiro) e avisa no chat; o item novo (Specialty, Talent...) e criado depois na ficha, destravada. Attribute/Role: ajustar o dado a mao.
- **Dono:** conferir a tabela no PDF e ajustar o menu de custos.

## 2026-10-17 - Campos protegidos dos Items so na ficha (R-F4/R-F5)
- Gravidade baixa. `die`/`duration` do Asset e `payout.share`/`spent` do Job so sao protegidos nas fichas (acoes e formulario). Um jogador que chame `item.update` pelo console ainda consegue mudar esses campos. Correcao possivel: guarda em `preUpdateItem` usando `LEVERAGE.protectedItemFields`. Nao resolvido (arquivo `documents/item.mjs` fora do escopo desta parte).

## T-506 - Dice So Nice nao testado com o modulo ativo
- Gravidade: baixa. O modulo `dice-so-nice` esta instalado no servidor, mas nao ativo no mundo de teste.
- Testado: sem o modulo nada quebra, cada termo Die leva `options.appearance` e isso sobrevive a serializacao (T-506).
- Nao testado: registro real dos colorsets e cores na animacao. O dono pode ativar o modulo no mundo e rodar `node tests/foundry/T-506.mjs` (ele confere os 6 colorsets).
- Nao feito: esconder o card ate a animacao acabar via `linkedTo`. Nao e preciso: o card ja leva `rolls`, e o Dice So Nice o esconde sozinho.

## T-902 - Pontos visuais vistos na ficha da Rosa (para o builder de UI)
- Gravidade baixa. No print `T-902-rosa.png`: (1) o aviso do navegador "sem aceleração de hardware" cobre o cabeçalho (é do ambiente de teste, não do sistema); (2) títulos de seção em inglês (ATTRIBUTES, DISTINCTIONS...) misturados com textos em pt-BR ("ADICIONAR", "clique para abrir", "Edição ligada") quando o Foundry está em pt-BR: conferir se é intencional; (3) o texto do Background mostra rótulos como "RAISED:" em inglês, que é o conteúdo de exemplo. Não alterado (CSS/templates fora do escopo).

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
