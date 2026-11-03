# Rodar o agente autônomo

Passo a passo para preparar o PC e o servidor Foundry e deixar o Claude Code construindo o sistema sozinho, tarefa por tarefa.

## Preparação (uns 15–20 minutos, uma vez só)

### 1. Programas no PC

1. **Node.js LTS** (nodejs.org), **Git** (git-scm.com) e **VS Code**.
2. **Claude Code**. No PowerShell: `irm https://claude.ai/install.ps1 | iex` (ou `npm install -g @anthropic-ai/claude-code`).
3. Rode `claude` uma vez, faça login, saia com `/exit`. Depois `claude update`.

### 2. Projeto

1. Clone o repositório. Coloque os livros que você possui em `reference/books/` (não versionado).
2. Abra a pasta no VS Code. No terminal do VS Code:
   ```powershell
   npm install -D playwright
   npx playwright install chromium
   ```

### 3. SSH sem digitar senha (a senha da chave fica só no seu PC)

Num PowerShell **como administrador**:
```powershell
Get-Service ssh-agent | Set-Service -StartupType Automatic
Start-Service ssh-agent
```
Num PowerShell normal:
```powershell
ssh-add C:\caminho\da\sua\chave.key          # digita a senha da chave uma vez
ssh -o BatchMode=yes -i C:\caminho\da\sua\chave.key usuario@ip-do-vps "echo ok"   # tem que responder "ok" sem pedir nada
```
No VPS, a pasta do sistema precisa ser gravável pelo seu usuário SSH. Se o Foundry roda com outro usuário, faça uma
vez (no VPS): `sudo mkdir -p <Data>/systems/leverage-gta && sudo chown <seu-usuario> <Data>/systems/leverage-gta`.

### 4. `.env`

Copie `.env.example` para `.env` e preencha: endereço do Foundry, mundo, usuário **Claude** e senha, dados do SSH e a
pasta do sistema no VPS. A senha de administrador do Foundry é opcional (serve para o agente relançar o mundo quando
o `system.json` mudar). **O `.env` nunca vai para o git e não sai do seu PC.**

### 5. Primeiro envio e o mundo de teste

```powershell
node tools/release.mjs --dev
node tools/deploy.mjs
```
No Foundry (navegador): volte para a tela de configuração → o sistema **Leverage: Liberty City** aparece →
crie o mundo `leverage-dev` com ele → lance o mundo → em **Configurar Jogadores**, crie o usuário **Claude**
(papel **Gamemaster**, com senha) e, se quiser, um **Tester** (Player). Deixe o mundo lançado. Não entre como
"Claude" você mesmo (o agente usa esse usuário).

Teste:
```powershell
node tests/foundry/smoke.mjs        # deve terminar com "FOUNDRY: pass"
```

### 6. Energia

Windows: Configurações → Sistema → Energia → **Suspender: nunca** (na tomada). Notebook: fechar a tampa → "nada".
O script também pede ao Windows para não suspender enquanto roda.

### 7. Começar

No terminal do VS Code, na pasta do projeto:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\run-autonomous.ps1
```
(Mac/Linux: `bash scripts/run-autonomous.sh`.) Deixe o VS Code aberto. Nos primeiros minutos,
`docs/log/STATUS.md` deve mudar para `IN PROGRESS: T-001`. Pode sair.

## Acompanhando o trabalho

Leia nesta ordem: `docs/log/STATUS.md` → `docs/log/FINAL-REPORT.md` (se existir) → `docs/log/PROGRESS.md` →
`docs/log/ISSUES.md` (o que precisa de você) → `docs/log/DECISIONS.md` → prints em `tests/foundry/screenshots/`.
`docs/log/runner.log` mostra cada sessão e cada espera.

## Se algo travar

| Sintoma no `runner.log` | O que fazer |
| --- | --- |
| `'claude' command not found` | Instale o Claude Code (passo 1) e abra um terminal novo |
| Pede login / "not logged in" | Rode `claude`, faça `/login`, saia e rode o script de novo |
| Bypass de permissões desativado pela organização | No script, troque `--dangerously-skip-permissions` por `--permission-mode acceptEdits --allowedTools "Bash" "Read" "Edit" "Write" "WebFetch" "WebSearch"` |
| Sessões de poucos segundos sem parar por horas | Limite de uso; é normal. Ele volta sozinho |
| `Deploy failed at: ssh …` | A chave saiu do `ssh-agent` (PC reiniciou?): rode `ssh-add` de novo. O trabalho continua sem testes no Foundry |
| Quer pausar | `Ctrl+C` no terminal. Para continuar, rode o script de novo |

Para gastar menos limite, troque `model: opus` por `model: sonnet` em `.claude/agents/reviewer.md` (a revisão fica
menos rigorosa). Para trabalhar junto com ele em vez de deixar sozinho, abra o painel do Claude no VS Code e digite
`/work` (nesse modo ele não recomeça sozinho depois do limite).
