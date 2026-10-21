# Changelog

Todas as mudanças importantes deste sistema ficam neste arquivo.
O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o projeto usa
[versionamento semântico](https://semver.org/lang/pt-BR/).

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
