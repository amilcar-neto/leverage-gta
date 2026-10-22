# Leverage: Liberty City — guia de uso

Guia rápido para o mestre (o **Fixer**) e para os jogadores. O sistema roda o *Leverage RPG* (Cortex Plus) no
Foundry VTT v14 e acrescenta três regras da casa inspiradas no GTA da era 3D: **Estrelas**, **Vida e Colete** e
**Grana em escada**. Cada regra da casa liga e desliga nas configurações; com as três desligadas, o jogo é o Leverage
puro. Os nomes do livro (Distinction, Talent, Asset, Complication, Plot Point, Job) ficam em inglês, como no sistema.

Sumário: [Instalação](#1-instalação) · [Começando](#2-começando-o-mundo-e-a-equipe) · [Rolar a Pool](#3-rolar-a-pool) ·
[Plot Points](#4-plot-points) · [Estrelas](#5-estrelas-de-procurado) · [Vida e Colete](#6-vida-e-colete) ·
[Grana](#7-grana) · [Wasted e Busted](#8-wasted-e-busted) · [Jobs](#9-jobs-e-rastreador) · [HUD](#10-o-hud) ·
[Ferramentas do mestre](#11-ferramentas-do-mestre) · [Compêndio](#12-compêndio-de-exemplo) ·
[Configurações](#13-configurações) · [Macros](#14-macros) · [Problemas comuns](#15-problemas-comuns)

---

## 1. Instalação

O sistema ainda não tem endereço de manifesto publicado. Instale pelo zip:

1. Gere ou baixe `leverage-gta.zip` (no repositório: `npm run release` cria `dist/leverage-gta.zip`).
2. No computador que roda o Foundry, abra a pasta de dados (`Data/systems/`) e crie uma pasta `leverage-gta`.
3. Extraia o zip **dentro** dela: o arquivo `system.json` tem que ficar direto em `Data/systems/leverage-gta/`.
4. Reinicie o Foundry, ou volte à tela de configuração. O sistema aparece em **Game Systems** como
   *Leverage: Liberty City*.

Quando houver um endereço de manifesto, vale o caminho normal: **Game Systems → Install System → Manifest URL**.

Requisitos: Foundry **v14**. O sistema vem em inglês e português do Brasil (o Foundry usa o idioma de cada usuário).
O módulo *Dice So Nice*, se estiver ativo, ganha dados nas cores do sistema; sem ele, nada muda. (A integração
ainda não foi testada com o módulo ativo.)

## 2. Começando: o mundo e a Equipe

**Mestre**

1. Em **Worlds**, crie um mundo escolhendo o sistema *Leverage: Liberty City* e entre nele.
2. Em **Actors**, crie um ator do tipo **Crew** (a Equipe, os personagens dos jogadores). Os outros tipos são **NPC**
   (Extra, Foil, Mark, Agent) e **Location** (Local, com Traços e uma cidade). A cidade do Local é só
   informativa. O campo **Cena** do Local liga os Traços dele à Cena escolhida: enquanto ela é vista, os Traços aparecem no painel de cena, na Pool e no Rolador de oposição. A cidade atual da mesa é uma só (a do Nível de procurado): ela vale para as estrelas do HUD e para o
   atalho *Polícia* do Rolador de oposição.
3. Dê a cada jogador a posse (**Owner**) do seu personagem e, em **Configure Players**, escolha o personagem de cada
   usuário. O HUD usa esse personagem.
4. Atalho: importe a **Rosa Delgado** do compêndio (seção 12) e use como modelo.

**Ficha da Equipe**

![Ficha da Equipe](img/ficha-equipe.png)

- **Cabeçalho:** retrato (clique para trocar), nome, apelido, **Vida** (coração) e **Colete** (escudo). Clique num
  deles para ajustar com − e +; no Colete escolha o tipo (Leve 4, Comum 6, Pesado 10). À direita, o **Booking Card**.
- **Attributes** (6) e **Roles** (5): cada linha é uma escada de d4 a d12. Uma Role pode ficar em branco, e uma Role em
  branco não entra na Pool.
- **Distinctions** (até 3), **Talents**, **Specialties** e **Assets** com o botão **+ Adicionar**. Cada item abre na
  própria janela ao clicar.
- **Background** (texto livre) e **Jobs** (o histórico de golpes) numa pasta com duas orelhas.
- **Trava da ficha:** a ficha começa travada (Attributes, Roles, Distinctions, Talents e Specialties não mudam). O selo
  na barra do título é um botão: o dono clica para destravar e travar a própria ficha. Se o mestre desligar "Jogadores
  podem destravar suas fichas", o selo fica desabilitado e a ficha, travada. Quem tem só permissão de observador vê a ficha sem controles.

## 3. Rolar a Pool

A bandeja **POOL** fica no rodapé da ficha.

1. Clique no nome de **um Attribute** e de **uma Role** (obrigatórios; escolher outro troca o anterior). Sem os dois, o
   botão ROLAR fica desligado.
2. Se quiser, some: uma **Distinction** (no máximo uma; o d8 ajuda, o d4 atrapalha e dá +1 Plot Point), uma
   **Specialty** (+d6, vale com a Role dela), **Assets** e **Talents** com dado, e dados avulsos pelo **+ DADO** (d4 a d12, a **Grana**, se a regra
   estiver ligada, e os Traços da cena ativa).
3. Clique em um chip para tirá-lo da Pool. **ROLAR** (ou Enter, com a ficha em foco) rola tudo.

### Rolagem Cortex Prime (modo padrão)

**Regra:** a Pool rola inteira, e **você escolhe** os dados. Dois deles somam o **total**; um terceiro dá o **efeito**
(só o tamanho dele conta, de d4 a d12; se não sobrou dado, o efeito é d4). Dado que tirou **1** é um **hitch**: não
pode ser escolhido. Se todos tirarem 1, é um **botch** e o total é 0.

1. **Monte a Pool** na bandeja e aperte **ROLAR**.
2. O card sai **pendente**: os dados aparecem, mas nada vale ainda (nem Plot Points, nem Grana, nem dano). A janela
   **Escolher dados** abre para quem rolou. Se fechá-la, o botão **Escolher dados** do card a abre de novo.
3. Na janela, clique nos dados para pôr no total, no efeito ou deixar de fora. O total aparece ao vivo.
   Os atalhos **Máx. total** e **Máx. efeito** só preenchem a escolha; você confirma.
4. Cada dado a mais no total custa **1 PP** (nunca pode ser o dado de efeito). Os dados pagos aparecem marcados.
5. **Lançar no card** confirma. O card passa a **resumido**: só os 2 dados do total, a soma e o dado de efeito.
   Clique nele para **expandir** e ver a rolagem inteira, com os hitches e os dados pagos.

Fica tudo no card do chat:

![Card de rolagem](img/card-rolagem.png)

**Hitches.** Enquanto houver hitch sem resolver, o card avisa. O mestre usa **Ativar hitches** para criar ou subir
uma Complication da mesa; cada Complication ativada **dá 1 PP** ao jogador. É escolha do mestre.

**Oportunidades.** Quando o mestre rola um 1, é uma oportunidade para os jogadores. O jogador gasta **1 PP** para
descer uma Complication, subir um Asset ou criar um bônus que dura a cena. Só vale no card mais recente da cena.

**Disputa (versus).** O mestre pode ligar um card ao outro. A margem é o seu total menos o dele; maior que zero é
sucesso. Com **margem de 5 ou mais** o sucesso é **heroico** e o efeito sobe 1 passo a cada 5 de margem (configurável).
Empate é do mestre. Comparar os efeitos só informa: quem decide o que acontece é a mesa.

**Efeito.** O dado de efeito mede o tamanho do que a ação consegue. Em ações com efeito, ele pode virar um Asset ou uma
Complication na cena, ou um passo numa Complication existente. O **dano** não usa o dado de efeito: continua sendo a
margem mais o dado da arma.

**Modo clássico.** O mestre pode voltar à regra anterior em **Configurações > Leverage > Modo de rolagem = Clássico**:
a rolagem resolve na hora, soma os dois maiores e não há dado de efeito. O botão **+1 PP · Manter o 3º dado** do card
só existe nesse modo.

- Dados do total têm borda acesa; os **1** aparecem em vermelho; os demais ficam apagados.
- Dado de **Grana** na Pool faz a Grana descer 1 degrau, e Distinction d4 dá +1 PP; o card avisa de ambos.

**Rolagem do mestre (oposição):** botão **Rolador de oposição** nas ferramentas do mestre. Escolha dados avulsos ou
atalhos (nenhuma oposição = 2d6, Polícia pelas estrelas atuais, Gangue N × dX, um NPC, Traços do Local e Complications
do Job) e role. O card sai com o cabeçalho **MESTRE**.

**Contra um jogador:** o jogador precisa fazer **mais** que o mestre; empate é do mestre. Passar por 5 ou mais é
sucesso extraordinário. O sistema mostra os totais, mas quem decide o resultado é a mesa.

## 4. Plot Points

- Cada jogador começa um Job com **1 PP** (configurável): **Novo Job** leva cada um a *pelo menos* esse número. Quem
  tem mais Plot Points guarda os seus; nada é somado por cima.
- **Ganha:** Distinction d4 na rolagem; Complication criada pelo mestre a partir de um 1 seu; ao desistir (Give In, manual: o mestre cria a Complication
  e usa **Dar Plot Point**);
  ao ser Wasted ou Busted; PP dados pelo mestre (**Dar Plot Point**).
- **Gasta:** somar mais um dado ao total (na janela Escolher dados; no modo clássico, pelo botão do card); criar um **Asset de cena** (1 PP) ou de **Job**
  (2 PP) pelo botão **+ Adicionar** da lista de Assets, que mostra o custo e pede confirmação; ativar Talents que
  custam 1 PP (o sistema não desconta sozinho: tire o PP à mão pelo − do HUD).
- **Atenção, mestre:** o jogador cria um **Signature Asset** (d8 o primeiro, d6 os seguintes) pelo **+ Adicionar** **sem
  custo de PP**; o preço dele são Jobs gastos no Train up, e isso não é cobrado nesse botão (decisão registrada).
  Se a mesa quiser cobrar, vigie ou apague o Asset. O jogador nunca escolhe o dado: o diálogo só mostra o que ele recebe.
- No HUD, o − gasta 1 PP manualmente e o clique direito no número também. Só o mestre soma pelo HUD.

## 5. Estrelas de procurado

As estrelas (0 a 5) medem o quanto a polícia está atrás da Equipe **numa cidade**. São do grupo e **só o mestre
mexe**: clique nas estrelas do HUD (a estrela N define o nível N; clicar na do nível atual baixa um) ou use
**Nível de procurado** nas ferramentas do mestre, que também escolhe a cidade. Cada mudança é anunciada no chat.
Trocar de cidade zera as estrelas (a Equipe saiu de lá) e também aparece no chat.
**Não há confirmação:** um clique errado na cidade apaga o nível; para voltar, ponha o nível de novo na mesma janela.
  As estrelas são ações só do mestre: o sistema recusa qualquer outro usuário e não há socket para elas.

- **Sobem** (1 por vez): ser visto cometendo crime, tiro em público, ferir ou matar policial, ataque grande ou fuga de
  prisão. Falhar numa fuga não sobe estrela.
- **Dado da polícia:** quando a polícia atrapalha, o mestre rola a **Pool da estrela atual** (atalho *Polícia* no Rolador
  de oposição). Cada estrela do HUD mostra o dado principal e o tooltip mostra a Pool inteira.
- **Cidades:** Carcer City, Las Venturas e Liberty City, cada uma com a sua Pool por estrela e as suas regras para
  baixar o nível (esperar fora de vista, mudar de cara, comprar silêncio, última saída). Tudo editável em
  **Escalas das cidades** (seção 13). Em Liberty City, por exemplo, comprar silêncio não funciona.
- As estrelas **não zeram sozinhas**, mas trocar a cidade atual na janela **Nível de procurado** (ou com
  `stars.set(nivel, cidade)`) zera o nível e posta uma linha de ESTRELAS no chat (se já havia estrelas).
- A janela **Nível de procurado** tem os botões de ação, todos seguindo as regras da cidade atual: **subir**
  (com motivo), **esperar** (por cena ou entre sessões), **disfarce** (só roupa ou carro e roupa), **silêncio**
  (paga dados de Grana do personagem escolhido) e **última saída** (pede confirmação). Os mesmos atalhos existem na API
  (seção 14: `stars.wait`, `stars.disguise`, `stars.buySilence`, `stars.lastResort`).

## 6. Vida e Colete

- **Vida máxima = 10 + o dado de Vitality** (d8 dá 18). O número base é configurável.
- **Colete:** pontos que absorvem dano antes da Vida (Leve 4, Comum 6, Pesado 10). Com 0, acabou.
- **Inimigos não têm barra: são dados.** Cada capanga é um dado (4 capangas d8 = 4d8; o mestre soma os dois maiores).
- **Rodada de tiroteio:** o jogador rola contra os dados da gangue. Se passa, o mestre derruba um capanga (dois se
  passar por 5 ou mais) diminuindo o tamanho da gangue na ficha do NPC: o sistema não faz isso sozinho. Se perde ou
  empata, leva dano = **quanto perdeu por + o dado da arma** do inimigo.
- **Aplicar dano:** no card de oposição do mestre, o botão **APLICAR DANO** escolhe o alvo, rola o dado da arma, pergunta
  pela **cobertura** (divide o dano pela metade, arredondando para baixo), tira primeiro do **Colete** e depois da
  **Vida**. Está em `docs/02-regras-da-casa.md` e vale só em luta de verdade; discussões e golpes seguem o livro.
- **Desistir** antes de rolar (Give In): a pessoa sai com uma Complication leve (*Bloodied d6*) e ganha 1 PP. É
  manual: o mestre cria a Complication na faixa da cena e usa **Dar Plot Point**.
- **Recuperar:** cena de descanso devolve metade da Vida máxima, um dia entre golpes devolve tudo, tratamento médico
  custa d4 de Grana e devolve tudo. No diálogo **Pagar**, **Hospital** paga e devolve toda a Vida, e os itens de
  **colete** pagam e colocam o colete novo, cheio. Cena de descanso e dia entre golpes (`restScene()`, `restDay()` no
  personagem) não têm botão no diálogo: use macro ou ajuste a Vida e o Colete direto na ficha ou no Rastreador.
- A Vida é a barra principal do token e o Colete é a secundária.

## 7. Grana

O dinheiro é um número de **degraus** (0 a 25) mostrado como dados verdes: d4 = 1 degrau, d6 = 2, d8 = 3, d10 = 4,
d12 = 5. Um d12 cheio vale 5 degraus e o maior dado fica à direita (7 degraus = d6 · d12). Todo personagem começa com
2 degraus (d6).

- **Preços são dados:** d4 = 1, d6 = 2, d8 = 3, d10 = 4, d12 = 5; combinações somam. Pagar desce os degraus. Faltou
  Grana, não compra (ou pede emprestado).
- **Pagar:** clique no `$` do HUD. Abre a tabela de preços (hospital, fiança, coletes, aluguéis, imóveis, Signature
  Asset…) ou um preço livre em dados. Coisa barata (táxi, lanche) é grátis para quem tem qualquer dinheiro.
- **Emprestar:** clique direito no `$`; escolha quem recebe e quantos degraus.
- **Na Pool:** o maior dado de Grana entra como qualquer outro, e depois da rolagem a Grana **desce 1 degrau**, passando
  ou não. Só um dado de Grana por rolagem.
- **Ganhar:** o pagamento de um Job (**Encerrar Job**, seção 9) e o ajuste do mestre no Rastreador. Uma referência da
  regra: golpe pequeno 4 degraus, médio 8, grande 12, divididos pela Equipe; um bico na cidade rende +1.
- O mestre pode editar a tabela de preços em **Tabela de preços** (seção 13).

## 8. Wasted e Busted

Quando o **dano leva a Vida a 0**, o sistema posta um card no chat com os passos (o mestre confirma no diálogo). O card
sai pelo **APLICAR DANO** ou por `combat.applyDamage`/`combat.down`; baixar a Vida à mão com o − da ficha não
dispara nada:

![WASTED](img/wasted.png)

- **WASTED** (derrubado por quem não é polícia): acorda no hospital, paga **d4 de Grana** (1 degrau), volta com a Vida
  cheia, **ganha 1 PP** e perde os Assets de arma de **cena**.

![BUSTED](img/busted.png)

- **BUSTED** (derrubado pela polícia): é preso e fica fora até sair, volta com a Vida cheia, **ganha 1 PP** e perde os
  Assets de arma de cena. A saída é a **fiança** (d6 de Grana, no fim da cena) ou o **resgate** (a Equipe tira a pessoa
  numa cena; é fuga de prisão e sobe 1 estrela). Em Liberty City a fiança não funciona, então só o resgate vale. O
  botão **Resgatado** do card faz o resgate.
- Morte só acontece se a mesa decidir.

## 9. Jobs e Rastreador

Um **Job** é um golpe completo.

- O Job é um **Item** do diretório de Itens (tipo Job). Ele tem estado **Planejado**, **Ativo** ou **Concluído**, objetivo, notas
  e pagamento total. Só um fica ativo por vez. Um Job **Planejado** fica escondido dos jogadores na interface (diretório e ficha; o Foundry ainda entrega o dado ao navegador, então não é segredo forte); ao **iniciar** ele
  passa a ser visível a todos (nome, objetivo e notas: não escreva segredos ali) e continua visível depois de concluído. Voltar um Job a Planejado
  o esconde de novo. Crie os Jobs planejados no diretório e inicie-os pelo botão **Iniciar** do Rastreador. Novo Job e Iniciar pedem confirmação
  quando já há um Job ativo (ele volta a Planejado).
- **Novo Job** (ferramentas do mestre): cria o Job, o torna o ativo (o anterior volta a Planejado), limpa as Complications antigas e dá os Plot
  Points iniciais aos personagens que têm jogador.
- **Rastreador do Job:** abre a janela com o Job ativo (clique no nome para abrir a ficha), o objetivo, as **Complications** (nome e dado; subir, descer,
  remover) e a **Equipe** (Vida, Colete, Grana e Plot Points de cada um, com − e +).

![Rastreador do Job](img/rastreador.png)

- **Encerrar cena:** apaga os Assets de cena da Equipe (com confirmação) e limpa os Traits globais.

### Faixa da cena

Logo abaixo do seletor de cenas fica uma faixa com os **Traits globais** (borda verde-água), os **Traços dos Locais da
cena vista** (com o ícone de pino e o nome do Local) e as **Complications** (borda vermelha). Traits globais e
Complications valem em qualquer cena até o mestre removê-los. Todos veem; só o mestre edita. O mestre usa o **+**
verde-água para criar um Trait e o **+** vermelho para criar uma Complication, clica no dado para trocá-lo (d4 a d12) e
no **X** para remover. O lápis abre o Rastreador. Os Traços de um Local se editam na ficha do Local. A setinha à
esquerda recolhe a faixa.
- **Encerrar Job:** pede o nome, o rendimento total em degraus e a parte de cada um. O Job fica no diretório como Concluído, com o total pago e a parte de cada personagem (lista na ficha do Job), e cada
  ficha ganha o Job no histórico (ligado a ele), soma a Grana, apaga os Assets de Job e limpa as Complications.
- **Nova sessão:** devolve o **Callback** de todos os Jobs.
- **Aba JOBS da ficha:** lista cada Job concluído com a parte do personagem. Marque o **Callback** para citar um Job
  (só marca e anuncia no chat; vale como um Plot Point gasto na rolagem, uma vez por Job por sessão, e a mesa aplica
  o efeito). **Train up** gasta Jobs sem uso para ganhar
  Signature Asset, Specialty, Talent (1 Job cada) ou um degrau de Attribute ou Role (2 Jobs cada); os custos são
  editáveis. Job gasto continua no histórico, mas não serve mais para Callback. **+ Registrar** cria um Job à mão.

## 10. O HUD

![HUD](img/hud.png)

Fica no canto superior direito, ao lado da barra lateral.

- **Estrelas:** cinco estrelas, cada uma com o dado principal da cidade. Só o mestre clica.
- **Grana:** o `$` e os dados verdes. Clique para pagar; clique direito para emprestar.
- **Plot Points:** a ficha amarela com o número, mais o − (e o + para o mestre).
- Mostra o personagem do usuário. O mestre vê a Grana e os PP do token selecionado; sem personagem, aparecem apagados.
- **Shift + clique** no `$` minimiza o HUD (só as estrelas); para restaurar, passe o mouse sobre o HUD minimizado e
  clique no botão que aparece. Cada jogador pode esconder estrelas, Grana ou Plot Points
  nas configurações de cliente. Estrelas e Grana somem quando a regra da casa está desligada.
- Na imagem acima, o mestre está sem token selecionado: aparecem só as estrelas.

## 11. Ferramentas do mestre

Na barra de controles à esquerda, o grupo **Leverage** (só o mestre vê):

| Ferramenta | O que faz |
| --- | --- |
| Jogadores podem destravar fichas | Desligado = todas as fichas travadas à força; avisa no chat |
| Nível de procurado | Define estrelas e cidade |
| Rolador de oposição | Rolagens do mestre (seção 3) |
| Rastreador do Job | A janela da seção 9 |
| Encerrar cena | Apaga Assets de cena (confirma) |
| Novo Job | Inicia um Job |
| Encerrar Job | Registra o Job, paga a Equipe |
| Nova sessão | Devolve os Callbacks |
| Dar Plot Point | Escolhe quem recebe 1 PP |

## 12. Compêndio de exemplo

Em **Compendium Packs** há quatro pacotes: **Equipe de exemplo**, **NPCs**, **Locais** e **Talents e Assets**.

- A **Rosa Delgado** (Equipe) é uma personagem completa para olhar e copiar: Thief d10 como Role primária, três
  Distinctions, três Talents, Specialties, cinco Assets, nove Jobs (três já gastos), Background e Booking Card.
  Importe com o botão direito ou arrastando para a lista de atores.
- Os cinco NPCs (gangue de rua, esquadrão de choque, tenente Ines Calder, Silas Kane e Victor Brandt), o Local e os
  Talents e Assets são exemplos próprios para copiar e editar. O conteúdo do livro não vem no sistema.

## 13. Configurações

Engrenagem → **Configure Settings** → **System Settings** → *Leverage: Liberty City*.

**Do mundo (só o mestre):**

| Configuração | O que faz | Padrão |
| --- | --- | --- |
| Estrelas de procurado | Liga as estrelas (HUD, dado da polícia) | ligada |
| Vida e Colete | Liga Vida, Colete e dano | ligada |
| Grana em escada | Liga a Grana (HUD, bandeja, preços, hospital e fiança) | ligada |
| Vida base | Vida máxima = isto + Vitality | 10 |
| Grana inicial | Degraus de novos personagens | 2 |
| Plot Points por Job | PP de cada um em Novo Job | 1 |
| Jogadores podem destravar suas fichas | Desligado: fichas travadas à força | ligada |
| Escalas das cidades | Menu: cidades e Pool de cada estrela | |
| Tabela de preços | Menu: preços em dados | |
| Custos de treinamento | Menu: Jobs que cada Train up custa | |

**Do cliente (cada usuário):** mostrar Estrelas, Grana e Plot Points no HUD; (mestre) mostrar a Grana dos jogadores no HUD, desligado por padrão; manter a Pool depois de rolar (padrão: a
Pool limpa); log de depuração no console.

## 14. Macros

Tudo o que as ferramentas e a ficha fazem também está em `game.leverage`. Veja **[docs/macros.md](macros.md)**: rolar
uma Pool por macro, Grana, estrelas, Plot Points, Jobs, dano. Arrastar um Attribute, Role, Specialty, Asset ou Talent da
ficha para a barra de atalhos cria uma macro que põe aquele Traço na Pool.

## 15. Problemas comuns

- **O HUD não aparece ou está vazio.** Confira as configurações de cliente (partes escondidas) e se as regras da casa
  estão ligadas. Sem personagem atribuído, a Grana e os Plot Points aparecem apagados com o aviso "Nenhum personagem
  atribuído".
- **O jogador não consegue mudar os Traços.** A ficha está travada: o jogador clica no selo da barra do título.
  Se o selo está desabilitado, o mestre desligou "Jogadores podem destravar suas fichas".
- **ROLAR está desligado.** Falta um Attribute ou uma Role, ou a Role escolhida está em branco.
- **O botão +1 PP não aparece (modo clássico).** Sem Plot Points ele fica apagado; some se não resta dado para manter
  (os 1 não valem), se o card não é o mais recente do personagem ou se quem olha é o mestre.
- **Grana insuficiente.** Faltam degraus; o diálogo informa quantos. Empreste de outro personagem ou ajuste a Grana.
- **Não consigo mexer nas estrelas.** Só o mestre. Se estiverem escondidas, a regra Estrelas está desligada.
- **Mudei o `system.json` ou instalei uma versão nova e nada mudou.** Volte à tela de configuração e lance o mundo de
  novo. Mudanças só em CSS, templates e idiomas bastam com F5.
- **Uma macro avisa e não faz nada.** Os erros de uso viram um aviso na tela. Confira o nome do personagem e se a ação é
  só do mestre.
- **Texto em inglês na interface.** Troque o idioma do Foundry para *Português (Brasil)* em Configure Settings.
