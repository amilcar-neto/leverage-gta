# 02 — Regras da casa: Estrelas, Vida e Grana (v3)

Esta é a versão que vale. Ela substitui a v1 e a v2 (o histórico está no fim). Cada uma das três regras **liga e
desliga** nas configurações do sistema; com as três desligadas, o sistema é o Leverage puro.

| Regra | O que é | Onde aparece | Quem mexe |
| --- | --- | --- | --- |
| **Estrelas** | O quanto a Equipe está procurada numa cidade | HUD (topo direito), para todos | Só o mestre |
| **Vida e Colete** | Pontos de cada personagem | Ficha (cabeçalho) e barra do token | Dono do personagem e mestre |
| **Grana** | Dinheiro de cada personagem, em escada de dados | HUD (topo direito) e ficha | Dono do personagem e mestre |

## Os dados em 30 segundos

- **d4, d6, d8, d10, d12.** Não existe d20.
- **Uma jogada:** junta os dados que se aplicam, rola, e o jogador escolhe **2 dados** para o total e **1 para o efeito** (modo `prime`, padrão; no modo `classic` soma os **dois maiores**). Dado que tira 1 (hitch) não conta.
- **Dano:** continua `margem + dado da arma`. O dado de efeito **não** entra no dano (Vida, Colete, Wasted e Busted não mudam).
- **Oposição:** o mestre rola os dele e soma os dois maiores; sem oposição, **2d6**; falta um Traço, usa **d6**.
- **Passar:** fazer **mais** que o mestre (empate é do mestre). Passar por 5 ou mais é sucesso extraordinário.

---

## Estrelas de procurado

**As estrelas medem o quanto a polícia está atrás da Equipe numa cidade.** Vão de 0 a 5, são do grupo e só o mestre
mexe (clicando nas estrelas do HUD ou pelo controle do mestre). Zeram quando a Equipe sai da cidade: trocar a cidade
atual (a única, `wanted.city`; o campo de cidade do Local é só informativo) é uma ação de estrelas que zera o nível.

### O que faz subir (1 estrela cada, até 5)

- Ser visto cometendo um crime.
- Tiro em público.
- Ferir ou matar um policial.
- Ataque grande ou fuga de prisão (inclui resgatar alguém que levou **Busted**).

Falhar numa fuga **não** sobe estrela; só mantém a polícia na cola.

### O dado da polícia

Quando a polícia atrapalha (perseguição, bloqueio, revista), o mestre rola a **Pool da estrela atual** e soma os dois
maiores. Cada cidade tem sua escala, editável nas configurações. Cada estrela do HUD mostra o dado principal dela.

| Estrelas | Carcer City | Las Venturas | Liberty City |
| --- | --- | --- | --- |
| 1 | d4 + d6 | d6 + d6 | d8 + d6 |
| 2 | d6 + d6 | d8 + d6 | d10 + d6 |
| 3 | d8 + d6 | d10 + d6 | d12 + d6 |
| 4 | d10 + d6 | d12 + d6 | d12 + d12 |
| 5 | d12 + d6 | d12 + d12 | d12 + d12 + d8 |

Chance de um personagem comum (Attribute d8 + Role d10) passar (simulação, conferida duas vezes):

|  | Carcer City | Las Venturas | Liberty City |
| --- | --- | --- | --- |
| 1 estrela | 78% | 70% | 62% |
| 3 estrelas | 62% | 54% | 47% |
| 5 estrelas | 47% | 30% | 19% |

### Perseguição

- A polícia está **na cola** ou a Equipe está **fora de vista**.
- Despistar: passou → fora de vista. Falhou → continua na cola e paga um preço (carro batido, alguém ferido, um
  problema novo). As estrelas não mudam por isso.

### Como baixar estrelas

Mudar de cara e comprar silêncio são **uma jogada rápida contra o dado da polícia**; esperar fora de vista é grátis.

|  | Carcer City | Las Venturas | Liberty City |
| --- | --- | --- | --- |
| **Esperar fora de vista** | −1 por cena | −1 a cada 2 cenas | −1 só entre sessões |
| **Mudar de cara** (carro, roupa, visual) | **Zera** | −1 (−2 trocando carro e roupa) | −1, e só se ninguém tiver retrato falado |
| **Comprar silêncio** | −2 por **d6** de Grana | −2 por **d10** de Grana | **Não funciona** |
| **Última saída** | Qualquer uma acima | Mudar de cara + comprar silêncio | Entregar um **bode expiatório** (mini-golpe; zera) |

Liberty City é assim porque a polícia responde a quem manda na cidade (no Ato 3, Donald Love): dinheiro não compra e
o retrato falado circula rápido. Isso é decisão de campanha, não canon dos jogos.

---

## Vida e Colete

**Cada personagem tem Vida. Os inimigos não têm barra: eles são dados.** Ninguém morre de um tiro só, mas ninguém
aguenta uma chuva deles. Vem do *Life Points* do Cortex Prime e do *Ganging Up* do Leverage.

### Quanto

- **Vida máxima = 10 + o tamanho do dado de Vitality** (d8 → 18). Faixa: 14 (d4) a 22 (d12).
- **Colete:** pontos que levam o dano antes da Vida. Cada colete tem um valor:

| Colete | Pontos | Preço |
| --- | --- | --- |
| Leve | 4 | d4 |
| Comum | 6 | d6 |
| Pesado | 10 | d8 |

Quando o colete chega a 0, ele acabou; é preciso comprar outro.

### Visual

Coração rosa com o número da Vida e escudo cinza com o número do Colete, no cabeçalho da ficha (veja
`reference/mockups/png/sheet-*.png`). Números pequenos, sem escala de 0 a 100. A Vida também é a barra principal do
token (`primaryTokenAttribute`).

### Quando vale

Em luta onde alguém pode se ferir de verdade (tiroteio, briga armada), **as rodadas e a Vida substituem o Taken Down
do livro**. Discussões, perseguições e golpes seguem o livro. O mestre avisa qual das duas está valendo.

### Inimigos são dados

- Cada capanga é **um dado**: 4 capangas d8 = 4d8, somando os dois maiores.
- Chefe ou elite é um dado só, maior; contra um inimigo só, o mestre completa com um d6.
- Jogador passa → **derruba 1 capanga** (2 se passar por 5 ou mais). Contra um inimigo só, passar por 5 ou mais o
  derruba de vez.

### A rodada

1. O jogador rola (Attribute + Role + a arma, se tiver um Asset de arma) contra os dados da gangue.
2. **Passou:** derruba capangas.
3. **Perdeu ou empatou:** dano = **quanto perdeu por** + **o dado da arma deles** (d6 pistola, d8 escopeta ou rifle).
4. **Cobertura** divide o dano pela metade (arredonda para baixo). **Depois**, o colete absorve o que sobrou.
5. Antes de rolar a próxima rodada, o jogador pode **desistir** (Give In do livro): sai com uma Complication leve
   (*Bloodied d6*) e **ganha 1 PP**. Não é Wasted nem Busted.

### Quando a Vida zera

- **Complication acima de d12** (Cortex Prime, hitches ativados): o personagem sai da cena; o card só avisa, e Wasted/Busted seguem manuais.
- **Wasted** (qualquer um que não seja a polícia): acorda no hospital, perde os Assets de arma daquela cena, paga
  **d4 de Grana** (1 degrau), volta com a Vida cheia e **ganha 1 PP**. O hospital é o único preço que aceita
  pagamento parcial: o que faltar vira dívida no card.
- **Busted** (a polícia): é preso, perde os Assets de arma daquela cena e fica fora até sair:
  - **Fiança:** **d6 de Grana** (2 degraus), no fim da cena. Não funciona em Liberty City. É tudo ou nada: sem os
    degraus todos, não paga nada e o personagem espera o resgate.
  - **Resgate:** a Equipe tira ele numa cena; é fuga de prisão, sobe 1 estrela.

  Sai com a Vida cheia e **ganha 1 PP**.
- Morte só se a mesa decidir.

### Recuperar

- **Cena de descanso:** metade da Vida máxima (arredonda para baixo).
- **Um dia entre golpes:** tudo.
- **Tratamento médico:** **d4 de Grana** devolve tudo na hora.

### Teste (Vida 18, jogada d8 + d10 + arma d8, gangue de 4)

| Inimigo | Campo aberto | Com cobertura | Cobertura + colete comum |
| --- | --- | --- | --- |
| Gangue de rua (4 × d6, pistolas d6) | 5% | 0% | 0% |
| Gangue armada (4 × d8, armas d8) | 42% | 14% | 6% |
| Polícia de choque (4 × d10, armas d8) | 80% | 57% | 44% |

---

## Grana (escada de dados)

### A ideia

O dinheiro de cada personagem é **um número de degraus** (0 a 25). Na tela ele aparece como dados verdes de
dinheiro, do jeito que os dígitos crescem no GTA:

| Degraus | Aparece como | Degraus | Aparece como |
| --- | --- | --- | --- |
| 0 | `$` vazio (quebrado) | 6 | d4 · d12 |
| 1 | d4 | 7 | d6 · d12 |
| 2 | d6 | 10 | d12 · d12 |
| 3 | d8 | 12 | d6 · d12 · d12 |
| 4 | d10 | 25 | d12 · d12 · d12 · d12 · d12 |
| 5 | d12 | | |

Regra de exibição: cada **d12 cheio vale 5 degraus**; o dado da esquerda guarda o resto (d4 = 1, d6 = 2, d8 = 3,
d10 = 4). **O maior dado fica sempre à direita**; um dado novo nasce à esquerda. Máximo de 5 dados.

### Preço em dados

Tudo que custa dinheiro custa **um dado ou uma combinação**, e o preço vira degraus: **d4 = 1, d6 = 2, d8 = 3,
d10 = 4, d12 = 5**; combinações somam (d12 + d6 = 7).

- **Pagar:** desce os degraus do preço. Se o personagem tinha exatamente aquele dado, ele **some inteiro**
  (tinha um d8, comprou algo de d8 → zerou aquele dado).
- **Não tem degraus suficientes:** não compra, ou pede emprestado.
- **Coisa barata** (táxi, lanche, munição comum): **grátis** se o personagem tem qualquer dinheiro.

### Dinheiro numa rolagem

Quando o dinheiro importa na jogada (suborno, negociação, comprar informação): o **maior dado** de Grana entra na
Pool como qualquer outro dado (disputa os dois maiores). Depois da rolagem, **passando ou não**, o personagem desce
**1 degrau**: o dinheiro foi entregue. Só um dado de Grana por rolagem.

### Ganhar e emprestar

- **Pagamento de Job:** o mestre define quantos degraus o golpe rende para a Equipe (referência: pequeno 4,
  médio 8, grande 12) e a Equipe divide. Cada Job da aba JOBS guarda o total e a parte de cada um.
- **Bico na cidade:** uma cena rápida rende **+1 degrau**.
- **Emprestar:** passar degraus para outro personagem (os dois donos precisam concordar; o mestre pode fazer direto).
- **No começo:** todo personagem começa com **2 degraus** (d6).

### Tabela de preços de referência

O mestre pode editar tudo nas configurações. Valores iniciais:

| Coisa | Preço |
| --- | --- |
| Hospital (Wasted) / tratamento médico | d4 |
| Fiança (Busted) | d6 |
| Colete leve / comum / pesado | d4 / d6 / d8 |
| Arma comum (vira Asset de cena d6) | grátis com dinheiro, ou d4 se for difícil de achar |
| Aluguel por mês: casa pobre / média / de rico | d4 / d6–d8 / d12 |
| Comprar imóvel: pobre / médio / de milionário | d6 / d10 / d12 + d6 |
| Carro próprio, garagem, esconderijo (vira **Signature Asset**) | d8 a d12 + d4, conforme o item; ou **1 Job** |
| Silêncio da polícia | veja a tabela das Estrelas |

### Plot Points continuam como no livro

Asset de cena (1 PP) e de Job (2 PP) seguem pagos com Plot Points. **O Plot Point é o improviso** ("tinha uma porta
destrancada"); **a Grana é a coisa de verdade** (o carro que você comprou).

---

## Cola da mesa

**Mestre:** estrelas sobem por crime visto, tiro em público, policial ferido, ataque grande ou fuga de prisão; a
polícia rola a Pool da estrela atual; tiroteio usa rodadas e Vida; dano = quanto perdeu por + dado da arma; empate
é derrota; Complication no 1 é opção sua e dá 1 PP.

**Jogadores:** Vida = 10 + Vitality; cobertura corta pela metade, depois o colete; Wasted = hospital d4, +1 PP;
Busted = fiança d6 ou resgate, +1 PP; desistir antes de rolar = Bloodied d6, +1 PP; Grana em degraus, maior dado
entra na Pool e desce 1 degrau; preços em dados.

## O que precisa ser testado na mesa

- [ ] Se "zerar" em Carcer City não fica fácil demais.
- [ ] Se 10 + Vitality é um bom tamanho de Vida.
- [ ] Se cobertura pela metade deixa o tiroteio longo ou curto demais.
- [ ] Se 2 degraus iniciais e +1 por bico estão bons; se os preços de referência fazem sentido.
- [ ] Se Busted sem fiança em Liberty City deixa o personagem fora tempo demais.

## Histórico

- **v1:** Vida = Vitality + Willpower; Grana em dados gastos individualmente; arma e Plot Points num HUD em cima da
  barra de macros.
- **v2:** combate explícito, Vida = 10 + Vitality, dado de Grana entra na Pool, Wasted/Busted, correções.
- **v3 (esta):** Grana vira escada de degraus com preços em dados; Vida e Colete ficam na ficha (não no HUD), com
  coletes de 4/6/10; HUD só com estrelas, Grana e Plot Points no topo direito.
