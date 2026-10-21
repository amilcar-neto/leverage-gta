# 03 — Decisões de design (visual e UX)

Tudo que foi decidido com o dono do projeto antes do código, com o porquê. Os mockups em
`reference/mockups/png/` mostram o resultado; quando o mockup e este texto discordarem, **este texto vale**.

## Direção geral

- **Estética:** GTA III (Liberty City). Fundo azul-petróleo escuro em degradê, bordas pretas grossas, sombras duras
  deslocadas (sem desfoque), textos de destaque com **contorno preto** (estilo HUD do jogo), uma trama de meio-tom
  bem leve por cima de tudo, papéis de "ficha policial" em bege para o que é documento.
- **Uma página só.** A ficha não tem abas de navegação (Notes/Config foram removidas por inúteis). A única troca de
  conteúdo é a pasta de papel BACKGROUND / JOBS dentro da coluna direita.
- **Premium e sem confusão.** Cada coisa tem um lugar, um jeito de interagir e um estado visual. Nada sobrepõe nada.
  Nada fica com espaço morto. Texto longo vira reticências com tooltip.

## Paleta (tokens)

| Token | Valor | Uso |
| --- | --- | --- |
| `--lv-bg-a` → `--lv-bg-b` | `#27363f` → `#0b1012` | Degradê de fundo (165°) |
| `--lv-panel` | `rgba(10,16,18,.92)` | Fundo dos painéis |
| `--lv-header` | `#d8c24a` | Faixa amarela dos títulos de painel |
| `--lv-accent-2` | `#7fc2b4` | Rótulos secundários (ex.: "WHEN"), etiqueta JOB |
| `--lv-ink` | `#e9f0ed` | Texto principal |
| `--lv-muted` | `#9fb2ad` | Texto secundário |
| `--lv-paper` / `--lv-paper-ink` | `#d8d5c6` / `#1a2123` | Papéis (Booking Card, pasta) |
| `--lv-select` | `#f2efe4` | Borda acesa de seleção (branco quente) |
| `--lv-stamp` | `#b3202a` | Carimbos (SPENT, CONFIDENTIAL) |
| `--lv-life` / `--lv-vest` | `#ff6f8e` / `#c9d1d4` | Coração da Vida / escudo do Colete |
| `--lv-money` / `--lv-money-die` | `#4fa346` / `#2f7a34` | `$` e dados de Grana (verde-dinheiro, **diferente** do verde do d8) |
| `--lv-star-on` / `--lv-star-off` | `#ffcf1f` / `#3b3313` | Estrelas |
| `--lv-pp` | `#d8c24a` | Ficha de Plot Point |
| `--lv-roll` | `#66d96b` | Botão ROLL |

## Tipografia

- **Títulos, números, nomes grandes:** `Anton` (Google Fonts), com o contorno preto `.hud`. A referência real é a
  **Pricedown** (fonte do GTA III), mas a licença para embutir num sistema distribuído não foi confirmada. Deixe a fonte
  de destaque numa variável CSS (`--lv-font-display`) para trocar fácil; registre em `ISSUES.md` que a Pricedown
  depende de licença.
- **Interface:** `Barlow Condensed` 500/600/700.
- **Papéis (documento):** `Special Elite` (máquina de escrever).
- A **Titan One** (arredondada) foi usada no começo e **descartada**: não tem nada a ver com GTA III.
- As fontes devem ser **empacotadas no sistema** (`fonts/`, licença OFL) em vez de carregadas do Google em tempo de
  execução, para funcionar offline.

## Dados (o coração visual)

- **Cada tamanho tem uma cor fixa**, em todo lugar (ficha, bandeja, card de chat, HUD):
  d4 `#ee5a5a` · d6 `#f2a03d` · d8 `#4fbf6b` · d10 `#4ba3f5` · d12 `#b07cf0`.
  Exceção única: os dados de **Grana**, sempre verde-dinheiro.
- **Formas** (polígonos em viewBox 100×100): d4 triângulo, d6 quadrado, d8 losango, d10 pentágono "pipa", d12
  hexágono. Coordenadas em `reference/mockups/source/Main.dc.html` (constante `GEOM`).
- **O número fica dentro do dado**, em HTML por cima do SVG (texto dentro do SVG não renderizou bem), centralizado
  com deslocamentos por forma.
- **Escada de Attribute/Role:** os cinco dados lado a lado; o valor atual é o dado "pintado".
  - **Selecionado (o valor):** cor cheia, opacidade total, número escuro. Sem brilho, sem borda branca, sem relevo.
  - **Não selecionado:** a **mesma cor**, mais escura e menos saturada (`hsl(h, 38%, 42%)`), opacidade ~0,55, número
    num tom claro da própria cor. A cor nunca some: o jogador aprende o código pela cor.
  - Dentro de uma linha que está **na Pool**, os não selecionados caem para ~0,28, para o dado que vai rolar saltar.
- Distinction mostra **um d8 e um d4 pequenos** (com número), com "+1 PP" ao lado do d4.

## Estados das linhas e da seleção (Pool)

- **Em repouso, a linha é plana:** sem fundo de card, sem borda; só uma linha fina embaixo separando os itens.
- **Na Pool:** a borda aparece **acesa em branco quente** (`--lv-select`), com um brilho curto, e um fundo muito leve.
  É a seleção que "revela" que aquilo é um card. Sem película colorida por cima (atrapalhava a leitura).
- O mesmo estilo de "na Pool" vale para **tudo**: Attribute, Role, Specialty, Distinction, Asset, Talent que soma dado.
- Na bandeja, os chips usam o mesmo branco: **sólido** para os obrigatórios (Attribute e Role), **tracejado** para os
  opcionais.
- Hover em itens clicáveis mostra uma borda tênue (o card "quase" aparece).

## Layout da ficha (1180 × 950)

Altura escolhida para caber num monitor 1920×1080 sem rolar (≈950 px úteis no navegador). A janela pode ser
redimensionada; as listas internas rolam, a ficha não.

1. **Barra de título** (32): nome, selo da trava ("TRAITS LOCKED" / "EDITING ON"), SHEET, TOKEN, fechar.
2. **Cabeçalho** (164):
   - **Mugshot** em retrato ~4:5, parede bege com régua de altura (6', 5'6, 5'). **Sem silhueta e sem texto embaixo.**
     Uma imagem PNG com fundo transparente fica **na frente da parede**, ancorada embaixo. Sem imagem: "NO PHOTO".
   - **Nome** grande em Anton com contorno; **apelido** em Special Elite; **Vida** (coração rosa + número + "/máx")
     e **Colete** (escudo cinza + número + "/máx").
   - **Booking Card** (papel inclinado 1,2°): altura, peso, idade, olhos, cabelo, porte, marcas, **digital do polegar
     direito**, número de ficha. É a "Physical Description" da ficha do livro.
   - Removidos de propósito: as pílulas PRIMARY/SECONDARY (o d10/d8 já dizem isso), o texto "RAP SHEET ·
     CREWMEMBER" (cada tipo de ficha terá cara própria), o "DELGADO, R." embaixo do mugshot.
3. **Corpo em 3 colunas** (376 / 400 / 316, gap 16):
   - **Esquerda:** ATTRIBUTES (6) e ROLES (5). Listas fixas, sem adicionar/apagar. Sem ícones.
     A descrição de cada um ("Deals in trust"…) fica no **tooltip**.
   - **Meio:** DISTINCTIONS (3, nota numa linha com tooltip), TALENTS (cards compactos: nome, Role, custo, uma linha
     "WHEN…"; clique abre o item), SPECIALTIES (grade de 2 colunas: nome, Role, X).
   - **Direita:** ASSETS (todos juntos, etiqueta SIGNATURE / JOB / SCENE, dado, X) e a **pasta** com as orelhas
     **BACKGROUND** (primeira, abre por padrão) e **JOBS** (o "Record" do livro).
4. **Bandeja da Pool** (76): POOL + contagem, chips dos dados escolhidos, "+ DIE", ROLL.

## Itens, criação e remoção

- Tudo que não é Attribute nem Role é **Item** do Foundry: Distinction, Talent, Specialty, Asset, Job.
- Clicar no nome **abre a janela do item** (veja `talent-item-window.png`); não expande dentro da ficha.
- Itens podem ser **arrastados** do diretório/compêndio para a ficha e entre fichas.
- **"+ ADD"** fica no cabeçalho amarelo de cada painel (economiza uma linha por painel). Nos Jobs, "+ LOG" ao lado de
  "TRAIN UP".
- **X de apagar** discreto em cada linha, fica vermelho no hover; pede confirmação só para Jobs e Signature Assets.
- **Rolagem interna:** cada lista tem área fixa; quando passa do que cabe, aparece barra de rolagem **com espaço já
  reservado** (`scrollbar-gutter: stable`) e folga à direita, para nunca cobrir o X nem o dado.
- Os ícones de Role foram **descartados**: ícone só em Roles ficava desigual com Attributes, e conceitos abstratos
  colidem (Mastermind e Willpower viram os dois "cérebro").

## Trava do mestre

- O mestre liga/desliga a trava nos controles da esquerda. **Travada:** ninguém (exceto o mestre) adiciona, remove ou
  muda o dado de Attributes, Roles, Distinctions, Talents e Specialties. Somem os "+ ADD" e os X desses painéis.
- **Sempre livres:** Assets, Jobs (+ LOG), Vida, Colete, Grana, nome, foto, apelido, Booking Card, Background.

## Pasta BACKGROUND / JOBS

- Orelhas de arquivo. A ficha lembra a última orelha aberta por personagem (padrão: BACKGROUND).
- **BACKGROUND:** texto livre (editor rico), botão EDIT. Tarjas pretas de "censura" são só enfeite do mockup.
- **JOBS:** "N JOBS · M UNSPENT", TRAIN UP, + LOG; colunas JOB / $ / CALLBACK / X. Job gasto em evolução fica
  riscado com carimbo **SPENT** e sem caixa de callback. O "$" é quanto aquele Job rendeu para o personagem.
- Nenhum outro lugar usa a palavra "Record" (evita "olha seu record" com duas respostas).

## HUD

- Canto **superior direito**, à esquerda da barra lateral do Foundry, **sempre a 16 px dela**; recolheu a barra, o
  HUD acompanha. Não é arrastável. Ordem de cima para baixo: **estrelas**, **Grana**, **Plot Points**, alinhados à
  direita como no GTA III.
- **Estrelas:** 5 grandes, amarelas quando ativas, escuras porém visíveis quando não; cada uma com o dado dela dentro.
  Só o mestre clica.
- **Grana:** `$` verde + dados verde-dinheiro (maior à direita). Clique esquerdo abre **Pagar**, direito abre **Emprestar** (dono ou
  mestre). Sem dinheiro: `$` e um dado tracejado "0". Sempre visível.
- **Plot Points:** ficha de cassino amarela + número, botões − e +. Sempre visível, mesmo com 0.
- **Ficaram fora do HUD de propósito:** Vida e Colete (moram na ficha e no token), assets temporários (moram na
  ficha; ir ao HUD no meio da montagem da Pool era ruim), arma.

## Card de rolagem no chat

Veja `roll-chat-card.png` e `docs/08-rolagem-e-chat.md`. Mesmos dados, mesmas cores, com o resultado dentro; os dois
mantidos com borda acesa e "KEPT"; os 1s com borda vermelha e "1 · OUT"; total grande; aviso de Complication;
botões "+1 PP · KEEP 3RD DIE" e "GM · COMPLICATION".

## Nomes

- **Booking Card** (cabeçalho) e **Jobs** (pasta). "Priors" em vez de "Record" dentro do Background.
- Textos de interface em inglês por padrão, com tradução pt-BR completa; nomes de regra do livro ficam em inglês nas
  duas línguas (Plot Points, Distinction, Talent…).

## Coisas rejeitadas (não reintroduza)

Abas NOTES/CONFIG · sol no cabeçalho · barras de progresso nos Attributes · ordens diferentes (DADO–NOME vs
NOME–DADO) · dados "acesos" com brilho e borda branca · seleção como película colorida · cards com borda em repouso ·
pílulas PRIMARY/SECONDARY · ícones de Role/Specialty · "deals in" visível · Vida de 0 a 100 · Grana como número em `$`
· HUD em cima da barra de macros · slot de arma no HUD · Titan One.
