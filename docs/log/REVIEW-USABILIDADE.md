# Revisão de usabilidade: narrador novato e jogador novato

Data: 2026-10-21. Foundry real (VPS), deploy novo, usuários Gamemaster, Jogadora Rosa e Jogador Marco, mundo "O Cofre do Moretti".
Prints: `tests/foundry/screenshots/rev-*.png`, `rev2-*`, `rev3-*`, `rev4-*`. Scripts: `tests/foundry/review-usability*.mjs`.

## Testes automáticos

- Unidade: 240 passam. Lint (`npx eslint .`): limpo.
- Scripts novos, todos passam: `scene-panel`, `sheet-lock-party`, `pool-builder`, `npc-location-sheets`, `minimize-pool-menu`, `hud-layer`, `playtest-fixes`.
- Console: limpo (nenhum erro do sistema nas três sessões).
- Faixa da cena, medida no navegador: chips de 32 px de altura, botão do lápis 32×32, setinha 28×32. Estado vazio: só a setinha e o lápis. Print `rev3-01-strip-crop.png`.
- Scripts antigos que ainda gravam `traitsLocked` (desatualizados, só apontados): `phase1`, `sheet-states`, `sheet-structure`, `T-303`, `T-307-lock`, `T-401`, `T-505`, `T-702`.
- Limpeza: o mundo ficou como estava (a ficha da Rosa foi destravada e travada de novo; a Grana do grupo no HUD voltou a desligada). Ficaram só 3 mensagens de rolagem da Sol no chat.

## Por tela

### HUD (mestre e jogador)
- Bom: estrelas com o dado de cada nível, grande, no canto. O jogador vê o dado verde de Grana e o número amarelo de Plot Points. Fica abaixo das janelas.
- Confunde: o jogador novato não sabe o que é o pentágono verde "10", o disco amarelo apagado e o "2". Não há rótulo, só tooltip. O "−" branco solto à esquerda parece um botão de fechar.
- Confunde: o mestre sem token selecionado vê só as estrelas. Não sabe que os PP e a Grana dele aparecem ao selecionar um token.
- Estética: com a barra lateral aberta, o HUD sobe e anda para a esquerda, e os dados de Grana/PP encostam nos avisos. Sem sobreposição real.

### Faixa da cena
- Bom: compacta, ao lado do seletor, chips legíveis, 32 px. Clicar num chip abre o Rastreador (mestre). O estado vazio quase some: só a setinha e o lápis.
- Confunde: o chip mostra só o dado (8, 6) e o nome. O novato não sabe que o verde é Traço e o vermelho é Complication, a não ser pela cor.
- Falta: o objetivo do Job só aparece quando existe Job ativo. Sem Job ativo (o caso do mundo agora), nada diz isso ao mestre.
- Falta: os Traços do Local da cena não aparecem na faixa. O mestre precisa copiá-los à mão para a cena.

### Controles do mestre
- Bom: nomes claros no tooltip; ordem lógica (travar, procurado, rolador, rastreador, encerrar cena, novo Job, encerrar Job, nova sessão, dar PP).
- Confunde: o grupo Leverage é o último ícone da coluna esquerda, uma logo pequena entre 10 ferramentas do Foundry. Ao abrir o mundo, as ferramentas do sistema não estão visíveis. É preciso saber clicar nele.
- Confunde: nove botões só com ícone. O tooltip é a única pista (aceitável pela regra do dono, mas lento para achar).
- "Encerrar cena" pede confirmação (Sim/Não). "Encerrar Job" pede nome e partes. Bom e seguro.

### Rastreador do Job
- Bom: tudo numa janela (nome, objetivo, Complications, Traços de cena, Equipe com Vida, Colete, Grana, PP com − e +).
- Confunde: sem Job ativo mostra campos vazios sem botão de iniciar. O novato digita o nome e não sabe se começou o Job. Novo Job é outra ferramenta.
- Confunde: a Grana da Equipe é um dado minúsculo no meio do − e +, sem número. O d4 de 1 degrau quase não se vê.
- Falta: não há NPC nem Local aqui. O mestre não liga NPC, Local e Job.

### Ficha Crew (todas as abas)
- Bom: fiel ao mockup. Sem sobreposição, textos longos com reticências. A trava é um selo clicável ("TRAVADA" / "EDIÇÃO LIGADA"). Abas Background e Jobs funcionam; o lápis do Background é discreto.
- Confunde (jogador novato): "5 JOBS · 4 LIVRES" não explica "livres". A coluna CALLBACK tem caixas sem rótulo claro. "TRAIN UP" e "+ JOB" são jargão.
- Confunde: mistura de idiomas. Rótulos em inglês (ATTRIBUTES, ASSETS, SIGNATURE) e botões em português (ADICIONAR, TRAVADA). É decisão do projeto, mas o novato estranha.
- Regra do dono violada (textos explicativos): veja "Textos explicativos que ainda existem" abaixo.
- Estética: espaço vazio embaixo de Assets (quando há poucos) e no papel do Background. Sem corte.
- Destravada: aparecem "×" em todos os Traços e botões + ADICIONAR. Claro. O "×" fica pequeno e perto do texto.

### Janela Montar Pool
- Bom: abas por tipo com contagem, busca, chips com dado e nome. Fácil de achar o que falta. Abre ao lado da ficha.
- Confunde: cinco chips "DADO EXTRA" iguais, só o ícone diferencia. A janela cobre parte da ficha (cabeçalho e Assets), então o jogador perde de vista o que clicou.
- Pequeno: LIMPAR, PRONTO e ROLAR são pequenos e apagados no rodapé; ROLAR parece desligado.
- Fluxo sem janela (clicar Attribute e Role e ROLAR) é melhor: 3 cliques.

### Rolagem e card
- Bom: card claro, 1 em vermelho, "MESTRE · COMPLICATION" com aviso. Total grande. O mestre vê o mesmo card.
- Confunde: "2 maiores mantidos 6 + 4" é jargão para quem nunca jogou; o total grande resolve.
- Com a barra lateral fechada, o card some. O jogador novato não sabe abri-la (problema do Foundry, já anotado).

### Ficha NPC
- Bom: crachá com cor do tier, polícia em azul, "ROLAR COMO OPOSIÇÃO" no topo, que abre o Rolador já com Capangas, Traços e Arma carregados (7 dados). Funciona muito bem.
- Confunde: NPC tipo Extra mostra VIDA 16 e COLETE ao lado de CAPANGAS. O livro diz que inimigos são dados. O mestre fica na dúvida se mexe na Vida ou nos Capangas.
- Confunde: o interruptor POLÍCIA ligado e desligado se diferencia só por borda tracejada e cor. Pouco evidente.
- Confunde: Tenente Calder mostra a seção CAPANGAS com 0, que não serve para ele. ARMA sem dado fica toda apagada.
- Estética: bom. O título da janela some atrás do aviso de hardware (só no navegador de teste).

### Ficha Local
- Bom: banner, cidade, Traços com escada, lista de NPCs, Notas.
- Confunde: "NPCs 0 / Nenhum NPC" mesmo com Vinnie e os Capangas na cena. Nada liga NPC ao Local automaticamente. O botão de adicionar NPC é só um ícone pequeno.
- Falta: não há Job ligado ao Local.
- Jogador não abre Local nem NPC (permissão): o aviso "Você não tem permissão..." é do Foundry. Está certo para o mestre, mas o mestre precisa saber que a informação só chega pela faixa da cena.

### Rolador de oposição e Aplicar dano
- Bom pela ficha do NPC (veja acima). Pelo botão do mestre, o rolador abre vazio e CAPANGAS vem 3 × d6 mesmo com o NPC de 4 × d8 na cena.
- APLICAR DANO abre empilhado sobre o rolador e sobre a ficha do NPC (três janelas). Atacante e arma começam em "Sem". A margem vem preenchida pela última rolagem de Pool, mesmo que seja de outra cena.
- Bom: alvo, cobertura e polícia numa só janela.

### Wasted/Busted, Nível de procurado, Dar PP
- Nível de procurado: janela completa e clara, botões de ação por regra. Bom. "COMPRAR SILÊNCIO" desligado em Liberty City sem explicar (certo pela regra do dono).
- Dar PP: lista com PP atual. Rápido.

### Encerrar cena / Encerrar Job / Novo Job
- Encerrar cena: confirmação direta. Bom.
- Encerrar Job: nomes cabem em uma linha, "Dividido: 0 de 0" ajuda. O novato não sabe o que pôr em "Rendimento total (degraus)".
- Novo Job: nome e objetivo vazios, texto explicativo no meio.

### Trava de edição
- Bom: o selo é botão, estados claros, com ícone de cadeado. O mestre desliga em massa pelo primeiro botão do grupo Leverage.
- Confunde: o ícone do mestre mostra "cadeado aberto" quando os jogadores PODEM destravar. O sentido parece o contrário do esperado (aberto = liberou).

### Grana do grupo (HUD do mestre)
- Funciona: lista "GRANA DO GRUPO · 2" com cada personagem. Desligada por padrão; precisa ligar nas configurações de cliente, onde o novato não vai achar.
- Estética: os dados de 28 px ficam pequenos; com a faixa dos jogadores do HUD embaixo dos avisos, a lista fica meio cortada (no navegador de teste).

## Textos explicativos que ainda existem (regra do dono: nenhum)

- Ficha Crew, subtítulos de painel: "clique para abrir" (Talents), "+d6 com a sua Role" (Specialties).
- Bandeja da Pool: "Escolha um Traço para montar a Pool." e "0 dados · mantém 2".
- Tooltips de Attributes e Roles com frases ("Equilíbrio, reflexos e velocidade.", "Computadores, eletrônica e vigilância..."), do selo ("Travada para o jogador. Clique para destravar."), de Asset novo ("Novo Asset: Signature (permanente), Job (2 PP) ou Scene (1 PP)") e dos Jobs (Train up, Registrar).
- Diálogos do mestre: Novo Job ("Inicia o Job, limpa as Complications antigas e dá Plot Points...", lista de nomes), Nível de procurado ("Aplique depois de passar na jogada."), Aplicar dano ("Margem preenchida pela rolagem de Pool acima..."), Rolador ("Nada escolhido: rola os dados de nenhuma oposição").
- Configurações: todas têm "Hint" longo.

## Bugs

Nenhum bug novo que quebre o uso. Os pontos abaixo são falhas de comportamento ou de acabamento.

1. **Ferramentas do mestre escondidas ao entrar (baixa).** Passos: entrar como mestre. As ferramentas do sistema só aparecem depois de clicar na logo do grupo Leverage, última da coluna. Esperado: o mestre achar sem procurar.
2. **Aplicar dano herda a margem da última Pool (média).** Passos: jogador rola; mestre rola oposição de um NPC; APLICAR DANO. A margem vem de uma rolagem antiga. Esperado: usar a oposição do card.
3. **Rolador de oposição pelo botão do mestre ignora o NPC da cena (baixa, já sugerido).** CAPANGAS começa em 3 × d6 com um NPC de 4 × d8 na cena.
4. **Ficha Local mostra "Nenhum NPC" com NPCs no mesmo cenário (baixa).** Não há ligação automática nem atalho pela cena.
5. **Textos explicativos permanecem (média, regra do dono).** Lista acima.
6. **Aviso de hardware cobre o título das janelas (ambiente de teste, não é do sistema).**

## Melhorias, em ordem de prioridade (foco no narrador)

### P1
1. Deixar o grupo Leverage visível ao entrar (por exemplo, abrir ativo por padrão para o mestre) ou pôr um botão "Mestre" no HUD que abra as ferramentas.
2. Painel do mestre (uma janela só) com: Job ativo e objetivo, cena atual, NPCs e Locais da cena (clicar abre a ficha), estrelas, Complications e Traços. Hoje o mestre abre 4 janelas diferentes para achar isso.
3. Ligar NPC e Local à cena: arrastar o token já preenche "NPCs" do Local, e o Rolador de oposição lista os NPCs da cena como atalhos.
4. Rastreador do Job sem Job ativo: botão claro "Iniciar Job" (ou mostrar só Novo Job). Hoje o mestre digita e não sabe se valeu.
5. Remover os textos explicativos restantes (lista acima), conforme a regra do dono. Manter só rótulos curtos.

### P2
6. Aplicar dano: já vir com o atacante e a arma do NPC que rolou a oposição, e a margem da oposição daquele card.
7. NPC Extra/gangue: esconder VIDA e COLETE quando só interessa Capangas; esconder CAPANGAS quando é 0 (Foil, Mark).
8. HUD: rótulos mínimos (ícone de moeda e de PP em vez de formas soltas) e o "−" ligado ao número que muda.
9. Montar Pool: abrir em posição que não cubra a ficha, e dar nome aos "DADO EXTRA" (d4, d6...). Botões do rodapé maiores.
10. Grana do grupo: botão no HUD do mestre para ligar, em vez de só nas configurações.
11. Jobs na ficha: trocar "LIVRES" por um rótulo curto e dar nome à coluna Callback sem texto de ajuda.
12. Faixa da cena: mostrar os Traços do Local da cena (opcional, ligado pelo mestre).

### P3
13. Ícone do cadeado do mestre com sentido invertido (aberto = jogadores livres).
14. Tamanho do dado de Grana (1 degrau) no Rastreador.
15. Interruptor POLÍCIA com estado mais visível.
16. Janelas empilhadas (ficha NPC + rolador + dano): reposicionar em cascata.
17. Retratos nos tokens e fichas (o mundo de teste está todo com boneco padrão).
