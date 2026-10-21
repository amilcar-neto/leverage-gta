# Playtest: "O Cofre do Moretti"

Data: 2026-10-21. Mesa de verdade no Foundry do VPS: um mestre e dois jogadores em navegadores separados (Playwright).
Código testado: o deploy novo (HUD abaixo das janelas, minimizar por duplo clique, menu "+ dado" completo, painel de cena).
Unidade: 235 testes passam. Lint: limpo. Console do sistema: limpo, exceto o erro do bug 1 abaixo.
Prints: `tests/foundry/screenshots/playtest-*.png` (os do card começam com `playtest-card-`).
Scripts: `tests/foundry/playtest-setup.mjs`, `playtest-play.mjs`, `playtest-finale.mjs`, `playtest-end.mjs`, `playtest-extra.mjs`.

## O que ficou no mundo

- Usuários Player: **Jogadora Rosa** (sem senha) e **Jogador Marco** (sem senha).
- Fichas Crew completas, ligadas como personagem de cada um: **Marisol "Sol" Quintero** (Grifter d10, a cara da equipe) e **Marco "Bruto" Silva** (Hitter d10, força e volante). Cada uma tem 3 Distinctions, 3 Talents, 3 Specialties, 4 Assets, 4 Jobs no histórico, Booking Card e Background.
- Cena **Armazém do Porto Velho** com tokens: Sol, Bruto, Vinnie Moretti (chefe), Capangas do Moretti (4 × d8), Patrulha da Polícia (3 × d8), o Local.
- NPCs: Vinnie Moretti (Mark), Capangas, Tenente Ines Calder (Foil, polícia), Patrulha da Polícia. Local com 4 Traits.
- Job ativo **O Cofre do Moretti** com 2 Complications, 2 Traços de cena, estrelas em 1 (Liberty City) e 2 Plot Points para cada jogador. O mundo está no começo do golpe, pronto para jogar.
- Na sessão jogada, o Job foi encerrado e já está no histórico das duas fichas ("O Cofre do Moretti", 4 degraus cada). Os itens perdidos (revólver, pé de cabra, Assets de Job) foram devolvidos.

## O que foi jogado (e os prints)

| Etapa | Print |
| --- | --- |
| Mesa no começo (mestre, Rosa, Marco), painel de cena e HUD | `playtest-01..03` |
| Ficha da Sol aberta; minimizar por duplo clique; ficha por cima do HUD | `playtest-04..06` |
| Sol monta a Pool com cliques e "+ dado" (Alertness, Grifter, Distinction, Specialty, Talent com dado, Asset) | `playtest-21`, `22` (menu) |
| Sol rola; mestre rola Gangue pelo Rolador de oposição | `playtest-23..25` |
| Bruto rola com Grana na Pool (a Grana desce 1 degrau) | `playtest-26`, `27` |
| Mestre rola Polícia (1 estrela) | `playtest-28` |
| Bruto falha, mestre aplica dano (diálogo e card) | `playtest-29`, `30`, `playtest-card-gm-damage-applied` |
| Mestre sobe estrelas pelo HUD; jogador vê | `playtest-31`, `32` |
| Janela Nível de procurado | `playtest-33` |
| Bruto paga Grana (colete leve) | `playtest-34..36` |
| Sol mantém o 4º dado por 1 PP | `playtest-card-sol-kept-third` |
| Bruto gasta PP pelo HUD; Distinction d4 dá +1 PP | `playtest-37` |
| Dar Plot Point (ferramenta) | `playtest-38`, `81` |
| Rolagem com 1; mestre cria Complication pelo card | `playtest-39`, `54`, `55`, `playtest-card-sol-roll-with-ones` |
| Rastreador: subir e remover Complication; jogador vê no painel | `playtest-40..42` |
| Sol cria Asset de cena (1 PP) | `playtest-52`, `53` |
| BUSTED, depois Resgatado (sobe estrela) | `playtest-56`, `57`, `playtest-card-busted-card` |
| WASTED | `playtest-58`, `playtest-card-wasted-card` |
| Estrelas descem ("esperar") | `playtest-59` |
| Encerrar cena (confirmação) e painel depois | `playtest-60..63` |
| Encerrar Job (diálogo), aba JOBS, painel final | `playtest-71..75` |
| Ficha de NPC minimizada; mesa final; Callback | `playtest-76..78`, `82` |

## O que já está bom

- A ficha da Equipe está bonita e fiel ao mockup. Nada sobrepõe nada, os textos longos viram reticências.
- A Pool por cliques é rápida. O "+ DADO" agora traz tudo: dados avulsos, Grana, Traços de cena, Assets, Specialties, Distinctions, Attributes e Roles, sem repetir o que já está na Pool.
- O card de rolagem é claro: dados mantidos, 1 em vermelho, aviso do 1 e botão "+1 PP · manter o 4º dado". A soma refaz certo ao manter o dado extra (16 virou 23).
- Grana na Pool desce 1 degrau; Distinction d4 dá +1 PP. Os dois avisam no card.
- Complication pelo card do 1: dá 1 PP ao jogador e vai para o Job. Dá para subir uma existente na mesma janela.
- APLICAR DANO: o colete come primeiro, depois a Vida; o card mostra o resumo. WASTED e BUSTED trazem os passos; "Resgatado" sobe a estrela.
- HUD fica **abaixo** das janelas (testado com a ficha por cima dele) e a estrela, a Grana e os PP de cada jogador são os do personagem dele.
- Painel de cena: os jogadores veem Traços de cena, Complications, e Traits dos NPCs e do Local. Atualiza ao vivo quando o mestre mexe no Rastreador e esvazia depois de Encerrar cena.
- Minimizar por duplo clique funciona em ficha da Equipe, NPC, Local e Item (a janela encolhe para 36 px; volta ao tamanho original).
- Encerrar Job paga a Grana, cria o Job no histórico, apaga os Assets de Job. Encerrar cena pede confirmação e limpa Assets de cena e Traços de cena.

## Bugs

### 1. Asset com nome em branco dá erro e fica sem resposta (média)
- Passos: ficha de um jogador, **+ Adicionar** em Assets, deixar **Nome** vazio, clicar **CRIAR**.
- Esperado: o diálogo avisa ou não fecha. Visto: fecha sem avisar e o console mostra `DataModelValidationError: [LeverageItem] ... name: may not be undefined` (`assets.mjs`, `createAssetPaying`). Nenhum PP se perde (o custo volta), mas a pessoa não recebe resposta.
- Causa provável: o callback do diálogo devolve `null` para nome vazio e o `DialogV2.prompt` troca `null` pela ação (`"ok"`); o `if (!choice) return` deixa passar. Print: `playtest-51-sol-asset-blank-name-bug.png`.

### 2. Ficha da Equipe minimizada perde o nome (média)
- Passos: duplo clique no título de uma ficha Crew.
- Visto: a barra mostra só o ícone, o selo "EDIÇÃO LIGADA" e o X. O nome do personagem some. Com duas fichas minimizadas não dá para saber qual é qual. A ficha de NPC mostra o nome cortado ("CAPANGAS DO..."), o que é aceitável.
- Print: `playtest-05-rosa-sheet-minimized.png`, `playtest-77-gm-npc-minimized.png`.
- Ideia: esconder o selo quando minimizada, ou cortar o selo e deixar o nome.

### 3. Encerrar Job: nomes sobrepostos às caixas (baixa)
- Passos: ferramenta **Encerrar Job** com um personagem de nome longo (ex.: `Marco "Bruto" Silva`).
- Visto: o rótulo da parte de cada um fica numa coluna estreita e quebra em 3 linhas por cima do campo numérico ("Marco / "B / Silva"). Print: `playtest-71-gm-end-job-filled.png`.
- Ideia: rótulo em cima do campo, ou largura maior para o nome.

### 4. Plural em "1 maiores mantidos" (baixa)
- O card de rolagem diz "1 maiores mantidos" quando só um dado vale (por exemplo quando só um dado não tirou 1). Falta o singular em `LEVERAGE.Roll.explain` (`lang/pt-BR.json` e `en.json`).

## Ruim, confuso ou que pode melhorar

- **Job não tem objetivo.** O Job só tem nome. Para o "objetivo" tive de pôr tudo no nome ("O Cofre do Moretti: pegar o livro-caixa..."), que depois vira o nome do Job no histórico e fica cortado na ficha. Sugestão: campo opcional "Objetivo" no Rastreador, mostrado no painel de cena.
- **Rolador de oposição não conhece o NPC da cena.** O atalho Gangue começa em 3 × d6 mesmo com "Capangas do Moretti" (4 × d8) na cena. Só aparece "Usar gangue do NPC" com o token selecionado. Sugestão: se a cena tem um só NPC com gangue, já sugerir.
- **APLICAR DANO começa em "Sem atacante / Sem arma".** Se o mestre só confirmar, o dano é só a margem (3 no meu teste). Sugestão: lembrar da arma, ou destacar o campo quando for 0.
- **Comprar colete leve rebaixa o colete.** O Bruto tinha colete comum (6) e pagou "Colete leve (d4)": ficou com colete leve 4/4. O diálogo não avisa que está trocando por um pior.
- **O painel de cena mostra para os jogadores os Traits do chefe** (Paranoid, Friends in the Precinct). Pode ser o que o mestre quer, mas é fácil de esquecer. O token escondido já vira "oculto"; talvez valha um aviso na configuração `scenePanel.showActorTraits`.
- **Sidebar fechada esconde o chat.** Com a barra lateral recolhida, os cards só aparecem como avisos temporários. O jogador pode perder o botão "+1 PP". O card mais recente deveria avisar quando há ação pendente. (Isto é do Foundry, mas pesa no jogo.)
- **A Trava de Traços estava desligada** no mundo (o selo mostra "EDIÇÃO LIGADA" nas fichas). O padrão do sistema é ligada. Não sei quem desligou; confira antes de jogar com jogadores de verdade.
- **Aviso "sem aceleração de hardware"** cobre o cabeçalho das fichas nos prints. É do navegador de teste, não do sistema.
- Fichas e tokens sem retrato ("Sem foto", boneco padrão). O mundo ficaria melhor com imagens.
- O Rastreador mostra a Grana do personagem com um dado minúsculo quando sobra 1 degrau (d4 muito pequeno). Legível, mas fraco.

## Dados de contexto

- No mundo já existiam atores de antes: `1` (Crew), `Personagem de Apoio` (NPC) e `hospital` (Local). Não mexi neles.
- Contas dos jogadores sem senha: coloque uma se for abrir para outras pessoas.
