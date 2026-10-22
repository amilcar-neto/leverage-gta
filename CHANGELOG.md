# Changelog

Todas as mudanças importantes deste sistema ficam neste arquivo.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa
[versionamento semântico](https://semver.org/lang/pt-BR/).

## [0.2.0] - 2026-10-22

### Adicionado
- **Rolagem Cortex Prime** (padrão, configuração `rules.rollMode`): a Pool rola inteira e o jogador escolhe 2 dados para o
  total e 1 para o efeito, na janela **Escolher dados** (atalhos Máx. total e Máx. efeito). Cada dado a mais no total custa
  1 PP. Sem dado sobrando, o efeito é d4.
- Card de chat novo: **pendente** (antes da escolha), **resumido** (dados do total, soma e efeito) e **expandido** (rolagem
  inteira, com hitches e dados pagos). Um clique alterna.
- **Hitches e botch:** o dado que tira 1 não é escolhido; o mestre usa **Ativar hitches** para criar ou subir Complications
  (cada uma dá 1 PP). Todos os dados em 1 é botch, com total 0.
- **Oportunidades** do Fixer (1 do mestre): descer Complication, subir Asset ou criar bônus de cena, por 1 PP, só no card
  mais recente da cena.
- **Disputa (versus)** opcional entre dois cards, com sucesso, falha e **sucesso heroico** (+1 passo no efeito a cada 5 de
  margem, `rules.heroicSuccess`), e **efeito em ações**.
- Oposição do Fixer automática (dois maiores) ou escolhida em janela (`rules.oppositionChoice`).
- API: `game.leverage.resolve(message, { total, effect, paid })`; `rollPool` mantém a assinatura (no modo prime o card volta
  pendente). Exemplos em `docs/macros.md`.
- Lugar por Cena: a Cena escolhe seu Local, e os Traços do Local valem na cena.
- Job como Item de mundo (Planejado, Ativo, Concluído), ficha própria e Rastreador.
- Traits e Complications globais da mesa, controlados na faixa da cena do mestre.
- Plot Points de todos os jogadores e do narrador no HUD.

### Mudado
- O **dano não mudou**: continua margem mais o dado da arma. O dado de efeito não entra no dano; Vida, Colete, Wasted e Busted
  seguem iguais.
- Textos do compêndio de exemplo (Smooth Talker, Wheelman's Nerve) ajustados ao novo fluxo de escolha dos dados.

### Migração
- 0.2.0: nenhum dado é alterado. O mestre recebe um aviso uma vez; para voltar às regras anteriores, ponha **Modo de
  rolagem = Clássico** (rolagem imediata, dois maiores, sem dado de efeito). Cards antigos continuam funcionando.

## [0.1.2] - 2026-10-22

### Mudado
- O Job ativo deixa de ser uma configuração escondida e passa a ser um Item de mundo do tipo Job, com estado
  Planejado, Ativo ou Concluído, objetivo, notas e pagamento total. Um só fica ativo por vez; todos os jogadores o veem.
- Rastreador: o nome do Job abre a ficha; botões Novo Job e Iniciar (lista dos planejados); estado "Nenhum Job ativo".
- Encerrar Job mantém o Job no diretório como Concluído (com o total pago), liga o Job de cada ficha a ele e cita o Job
  no chat com um link.

### Migração
- 0.1.2: o Job ativo guardado na configuração `activeJob` vira um Item Job ativo. Pode rodar duas vezes.

## [0.1.1] - 2026-10-21

### Mudado
- Traits e Complications passam a ser estado global da mesa: o mestre cria, troca o dado e remove direto na faixa da
  cena; valem em qualquer cena e independem do Job. Os Traços específicos de uma cena vêm do Lugar.
- O Job guarda só nome e objetivo. Encerrar cena limpa os Traits globais; Novo Job e Encerrar Job limpam as Complications.
- A faixa da cena marca os Traços de Lugar (ícone de pino e nome do Local).

### Removido
- Traços por Cena guardados em flag (decisão do dono). Mundos antigos: a migração 0.1.1 move as Complications e os
  Traços de cena do Job para a mesa e apaga o flag.

## [0.1.0] - 2026-10-21

Primeira versão jogável, para Foundry VTT v14.

### Adicionado
- Ficha da Equipe (Crew), de NPC e de Local (Location), com Traços, Distinctions, Talents, Specialties e Assets.
- Montagem da Pool de dados, rolagem Cortex Plus e card no chat com os resultados e os Plot Points.
- Regras da casa inspiradas em GTA: estrelas de procurado, Vida e Colete, grana em escada, Wasted e Busted.
- HUD com estrelas, grana e Plot Points.
- Ficha de Job (histórico, Callback e Train up) e Rastreador do Job (Complications, Traços de cena e a Equipe).
- API `game.leverage` e macros (rolar uma Pool, Grana, estrelas, Plot Points, Jobs, dano); arrastar um Attribute, Role,
  Specialty, Asset ou Talent da ficha para a barra de atalhos cria uma macro. Veja `docs/macros.md`.
- Integração com o módulo Dice So Nice (dados nas cores do sistema; ainda não testada com o módulo ativo).
- Configurações do sistema e ferramentas do mestre.
- Compêndios de exemplo: Equipe, NPCs, Locais, Talents e Assets.
- Idiomas: inglês e português do Brasil.
- Rotina de migração de mundo (`systemMigrationVersion`) pronta para versões futuras.
- Script `npm run release` que gera `dist/leverage-gta.zip` apenas com os arquivos do sistema.
- Guia de uso em `docs/USO.md`.
