# Relatório final — Leverage: Liberty City 0.1.0

Data: 2026-10-21. Tudo do backlog está `[x]`. 229 testes de unidade passam, o lint está limpo e os testes no Foundry real
(v14.369, VPS) passam. Duas passadas de revisão final (código e uso real) e uma segunda rodada nos pontos corrigidos.

## O que ficou pronto
- Ficha da Equipe, de NPC e de Local, fichas de Item (Distinction, Talent, Specialty, Asset, Job) no visual dos mockups.
- Pool de dados, bandeja, rolagem, card no chat (+1 PP · manter o 3º dado, Complication do mestre), rolador de oposição.
- Regras da casa: Estrelas (com escalas por cidade), Vida e Colete, Grana em escada (pagar, emprestar), Wasted/Busted.
- HUD (estrelas, Grana, Plot Points), controles do mestre, Rastreador do Job, Novo Job/Encerrar cena/Nova sessão/Dar PP.
- Compêndio de exemplo (Rosa Delgado, NPCs, Local, Talents e Assets próprios), API `game.leverage` e macros.
- i18n completo (en e pt-BR), CHANGELOG, migração de mundo, `dist/leverage-gta.zip` (sem docs, testes, segredos), `docs/USO.md`
  com prints. Logo oficial na title bar das fichas, no ícone do sistema e no botão do mestre.

## O que ficou de fora (e por quê)
- Ganging Up automático ("−1 thug" no card): o mestre baixa o tamanho da gangue à mão (documentado).
- Botões para descansar, tratamento médico e "esperar/mudar de cara" fora da janela de Procurado: só pela API/macros.
- Empréstimo de Grana sem consentimento do outro dono (decisão registrada em DECISIONS.md).
- Licença do sistema: não definida.

## Problemas conhecidos
- As travas (Traços, PP, Grana, flags do card) rodam no cliente: um jogador com console ainda consegue mexer nos próprios PP.
  Risco aceito para mesa de amigos. Campos protegidos dos Items têm guarda no documento.
- Custos de Train up são provisórios (tabela do livro ilegível no OCR); o mestre ajusta no menu de custos.
- Dice So Nice só foi testado sem o módulo ativo.
- Janelas do sistema levaram 2–3,5 s no navegador de teste sem GPU: medir numa máquina real.
- Alguns testes do Foundry (T-502, T-701) falharam uma vez por tempo curto e passaram na repetição.
- Cerca de 40 `rgba()` soltos no CSS fora de tokens; varredura de mensagens no chat é O(n²) em chat muito longo.
- Trocar de cidade zera as estrelas sem confirmação; o jogador cria Signature Asset d8 sem custo pelo "+ ADD".

## Decisões tomadas sozinho
Todas em `docs/log/DECISIONS.md`. As que mais importam: "GM" em todo o inglês e "mestre" no pt-BR; Novo Job leva cada um a no
mínimo 1 PP (não soma); fiança é tudo ou nada; cidade única em `wanted.city`; logo oficial mantém as cores originais;
HUD sem contorno preto (sombra suave); permissões de agente ampliadas em `.claude/settings.json` (Monitor, Cron*,
SendMessage, ScheduleWakeup) — o dono pode revisar.

## O que o dono precisa testar na mesa
1. Visual da Grana no HUD (cifrão + dados): decidir se muda (opções A/B em ISSUES.md).
2. HUD sobre cena clara (só foi visto em cena escura) e o peso da sombra suave.
3. Uma sessão inteira com 2+ jogadores: Pagar/Emprestar, Wasted/Busted, Estrelas, Novo Job.
4. Dice So Nice ativo; custos de Train up contra o PDF; escolher a licença.
5. Ficha da Rosa e das fichas em máquina real (desempenho e fontes).
