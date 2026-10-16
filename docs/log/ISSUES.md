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

## 2026-10-16 — Smoke test: usuário Gamemaster ocupado (aberto, aguardando dono)
- Deploy via `npm run deploy` funciona (OpenSSH do Windows + chown foundry).
- O login do Playwright falha porque a opção `Gamemaster` fica desabilitada enquanto o dono está logado nele.
- Dono precisa: criar um usuário `Claude` (Mestre do Jogo, sem senha) no mundo e avisar; depois trocar `FOUNDRY_USER=Claude` no `.env`.
- Até lá: seguir com testes de unidade e revisão de código; repetir o smoke ao fim de cada fase.
