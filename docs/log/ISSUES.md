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
