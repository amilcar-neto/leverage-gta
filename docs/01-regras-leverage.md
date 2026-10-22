# 01 — Regras do Leverage que o sistema implementa

Resumo para quem programa. A fonte é o livro: `reference/books/text/leverage.txt` (texto extraído por OCR, use
`grep`). As referências `L:<linha>` apontam para esse arquivo. Quando este resumo e o livro discordarem, o livro vale
e você registra a diferença em `docs/log/DECISIONS.md`. As **regras da casa** (`02-regras-da-casa.md`) mudam
algumas destas regras; onde mudam, está avisado.

## Dados e traços

- Dados de **d4 a d12**. Um "Traço" é qualquer coisa com um dado. (L:596–640)
- **Attributes** (6): Agility, Alertness, Intelligence, Strength, Vitality, Willpower. Na criação vão de d4 a d10,
  escolhendo um dos arranjos (L:1460–1530):
  - **Focused:** d10, d10, d8, d8, d6, d6
  - **Versatile:** d10, d8, d8, d8, d8, d6

  A evolução pode subir um Attribute; a ficha permite até **d12**.
- **Roles** (5): Grifter, Hacker, Hitter, Mastermind, Thief. Primária d10, secundária d8 (L:789–800). As três
  restantes ficam **em branco** até a Recruitment Job, onde viram d6, d4 e d4 (L:2415–2425). A ficha precisa aceitar
  Role em branco (valor nulo) e não deixa rolar uma Role em branco.
- **Distinctions** (3): frases. Ao rolar, o jogador escolhe: **d8** se ajuda, ou **d4** se atrapalha, e então ganha
  **1 Plot Point**. A terceira pode ficar em branco até o fim do primeiro Job. (L:540, L:2440–2460)
- **Specialties:** perícias estreitas, cada uma ligada a **uma Role**. Somam **+d6** à Pool quando o jogador usa
  aquela Role para aquele tipo de coisa. Começa com duas; pode comprar mais. (L:510–520, L:1434–1470)
- **Talents:** truques ligados à Role primária (ou "Open"), com **Activation** e **Effect**; alguns custam 1 PP para
  ativar, e o efeito dura a Ação. (L:1660–1700)
- **Signature Assets:** permanentes do personagem. O primeiro é **d8** e os seguintes **d6**; entre Jobs dá para
  trocar qual é o d8, mas o que deixou de ser d8 não volta a ser. (L:2540–2570)

## A rolagem

1. A Pool tem obrigatoriamente **1 Attribute + 1 Role**. Opcionalmente: Specialty (d6, da mesma Role), uma
   Distinction (d8 ou d4), Assets que se aplicam, efeitos de Talent, dados entregues por outros.
2. Rola tudo. **Livro: soma os dois maiores.** Dado que tirou **1** não conta (é separado); se todos tiram 1, o resultado é
   **0**. (L:610–620) **No sistema (Cortex Prime, `rules.rollMode = prime`):** o jogador escolhe **quaisquer 2 dados** para o
   total e **1 dado de efeito** (só o tamanho importa; sem dado sobrando, d4). Hitch não se escolhe nem vira efeito; tudo 1
   é **botch**. Os "dois maiores" ficam só como atalho e como modo `classic` (`docs/08`).
3. Cada 1 permite ao Fixer criar uma **Complication** (d6; mais 1s sobem para d8, d10…). Quando ele usa, **entrega 1
   Plot Point** ao jogador. É opção do Fixer, não automático. (L:625–640, L:680–690, L:3262–3300)
4. Quando o Fixer rola 1, é uma **Opportunity** para os jogadores (alguns Talents usam isso).
5. **Depois da rolagem**, o jogador pode gastar **1 PP para somar mais um dado** dos que rolou (3 dados somados, 4
   com 2 PP…), limitado aos dados rolados e aos PP que tem. (L:660–668) No modo `prime` qualquer dado livre serve e o dado pago
   não pode ser o de efeito.

## Oposição e disputa

- O Fixer rola **pelo menos dois dados**: um pela dificuldade e um pelo oponente ou situação. Falta um Traço → usa
  **d6**. Sem oposição nenhuma → **2d6**. (L:3120–3130)
- **Ação básica:** o Fixer define as stakes rolando; o jogador precisa fazer **mais** (empate é do Fixer). (L:3365–3372)
- **Disputa:** os lados se alternam "subindo as apostas"; quem não consegue superar o último resultado perde e é
  **Taken Down**; quem venceu decide o que acontece. Superar por **5 ou mais** é **Extraordinary Success** e encerra a
  disputa. (L:620–636)
- **Give In:** antes de rolar, um lado pode desistir: perde a disputa nos próprios termos, sai com uma Complication
  d6 (ex.: Bloodied d6, até o fim da próxima cena, escolhida pelo Fixer) e **ganha 1 PP**. (L:3545–3560)
- **Ganging Up:** cada capanga a mais soma **um dado** à Pool do lado dele (do tamanho do melhor Traço que usaria);
  continua somando só os dois maiores. Cada vez que alguém supera um grupo, **derruba um** dado extra; com
  Extraordinary Success, **dois**. Quando sobra um oponente, não se derruba mais nada. (L:3530–3575)

## Plot Points

- Cada jogador começa o Job com **1 PP**. (L:652)
- **Gastar:** somar mais dados depois da rolagem; ativar Talent; criar **Asset de cena (1 PP, d6)** ou **Asset de
  Job (2 PP, d6)**. Todo Asset precisa de nome; não existe Asset genérico. (L:655–680, L:3225–3245)
- **Ganhar:** Distinction usada como d4; Complication criada a partir de um 1 seu; Give In; quando o Fixer gasta PP
  contra você, ele te passa um PP (que só pode ser usado depois da Ação atual); fim de Job.
- O Fixer não tem reserva própria: os PP gastos vão para o meio da mesa.

## Record (aba JOBS) e evolução

- Cada Job concluído vai para o **Record** do personagem. (L:2475–2485)
- **Callback:** o jogador cita um Job do Record e ganha o efeito de **um Plot Point gasto**. **Uma vez por Job por
  sessão**; marcar os usados. (L:2486–2500)
- **Training Up:** "gastar" Jobs entre golpes para: Signature Asset, Specialty nova, Talent novo, subir um Attribute,
  subir uma Role. Job gasto continua no Record mas **não serve mais para callback**. (L:2500–2560)
  - Os custos estão numa tabela que saiu ilegível no OCR (L:2500–2512). **Abra o PDF** (`reference/books/`, capítulo
    3, seção "Training Up") e copie os custos para `module/config.mjs` e para este documento. Até lá, use valores
    configuráveis com padrão 1 / 1 / 1 / 2 / 2 e registre a pendência em `ISSUES.md`.
- **Advance:** com permissão do Fixer, comprar "a crédito" estando 1 Job abaixo do custo.
- **Trocar Distinction:** avisando o Fixer antes do Job. (L:2566–2590)

## Criação de personagem (o mínimo que a ficha precisa suportar)

1. Background (texto livre). 2. Role primária d10. 3. Role secundária d8. 4. Attributes por arranjo. 5. Uma
Distinction. 6. Recruitment Job: as Roles restantes (d6, d4, d4), Distinctions 2 e 3, duas Specialties, dois Talents
(pelo menos metade dos Talents na Role primária). Muita coisa pode ficar **em branco** e ser declarada durante o jogo
com um flashback (L:2380–2400): a ficha deve tratar campos vazios com elegância (estado vazio, não erro).

## Personagens do mestre

- **Extras:** um ou dois Traços. **Foils** e **Agents:** fichas quase completas; **Marks:** o alvo do golpe. (L:5784+)
- Locais e cenas podem ter Traços próprios (ex.: ON FIRE d8, DARK CORNERS d8) que entram na Pool de quem se
  beneficia deles.
