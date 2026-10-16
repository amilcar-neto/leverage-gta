# 13 — Ambiente de teste (Foundry real)

O Claude roda no PC do dono. O Foundry roda no **VPS** do dono, acessível pelo navegador. O agente:

1. **Envia** o sistema para o VPS (`npm run deploy` → `tools/deploy.mjs`).
2. **Abre** o site com Playwright (Chromium automático), entra no mundo com o usuário de teste.
3. **Recarrega** a página (F5) para pegar o código novo, abre a ficha/HUD/chat, clica, tira prints, lê o console.

## Configuração (`.env`, nunca vai para o git)

Copie `.env.example` para `.env` e preencha. Se alguma variável faltar, o agente pula o que depende dela e registra
em `docs/log/ISSUES.md`.

| Variável | Exemplo | Para quê |
| --- | --- | --- |
| `FOUNDRY_URL` | `https://foundry.meusite.com` | Endereço do Foundry |
| `FOUNDRY_WORLD` | `leverage-dev` | id do mundo de teste |
| `FOUNDRY_USER` | `Claude` | Usuário de teste, papel **Gamemaster** |
| `FOUNDRY_PASSWORD` | `…` | Senha desse usuário |
| `FOUNDRY_PLAYER_USER` / `FOUNDRY_PLAYER_PASSWORD` | `Tester` / `…` | (opcional) usuário Player para testar permissões |
| `FOUNDRY_ADMIN_PASSWORD` | `…` | (opcional) para relançar o mundo quando `system.json` mudar |
| `VPS_SSH` | `usuario@1.2.3.4` | Destino SSH |
| `VPS_SSH_PORT` | `22` | Porta |
| `VPS_SSH_KEY` | `C:\Users\voce\.ssh\vps.key` | Caminho da chave (a senha da chave fica no ssh-agent, não aqui) |
| `VPS_SYSTEM_DIR` | `/home/foundry/foundrydata/Data/systems/leverage-gta` | Pasta do sistema no VPS |

## Deploy

- `tools/release.mjs --dev` monta `dist/leverage-gta/` só com o que o Foundry precisa (sem `docs/`, `reference/`,
  `tests/`, `scripts/`, `.claude/`, `node_modules/`).
- `tools/deploy.mjs` empacota `dist/leverage-gta` com `tar`, envia com `scp`, e no VPS substitui o conteúdo da pasta
  do sistema (recusa qualquer destino que não termine em `/systems/leverage-gta`). Usa `BatchMode`, então nunca fica
  esperando senha: a chave precisa estar carregada no `ssh-agent`. Funciona no Windows 10+ (tem `tar`, `scp` e `ssh`)
  sem instalar nada.
- Depois do deploy: **código JS/CSS/templates** → basta recarregar a página. **`system.json`** (tipos novos,
  idiomas, estilos novos) → é preciso **relançar o mundo** (voltar à tela de configuração e lançar de novo), o que
  pede `FOUNDRY_ADMIN_PASSWORD`. Sem ela, registre em `ISSUES.md` "relançar o mundo" e continue testando o resto.

## Testes com Playwright

- `tests/foundry/smoke.mjs`: login, espera `game.ready`, falha se houver erro do sistema no console, print do mundo.
- Para cada tela: um script em `tests/foundry/` que abre o que precisa (via `page.evaluate` chamando a API do Foundry,
  ex.: `game.actors.getName("Rosa Delgado").sheet.render(true)`), executa os cliques dos critérios de pronto e salva
  prints em `tests/foundry/screenshots/<tarefa>-<nome>.png`.
- Crie os dados de teste pela API dentro do próprio teste (e apague depois) ou importe o compêndio de exemplo.
  Prefixe tudo com `[TEST]` para não misturar com o que o dono criar.
- Viewport 1920×1080. Escala de interface 100%.
- Erros de outros módulos: liste separado, não falhe por eles.

## Sem VPS disponível (alternativa)

Se o deploy ou o login falharem, o agente tenta uma vez de novo, registra o problema e **continua com testes de
unidade e revisão de código**. Ao fim de cada fase, ele tenta de novo; se voltar a funcionar, roda os testes visuais
atrasados.
