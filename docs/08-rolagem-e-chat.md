# 08 — Pool, rolagem, card no chat e automações

Alvo visual do card: `reference/mockups/png/roll-chat-card.png`. Bandeja: rodapé dos PNGs da ficha.

## Montando a Pool (bandeja da ficha)

- A Pool é estado **do cliente**, ligado à ficha aberta (`DicePool`). Não é salva no ator.
- Entra na Pool clicando em: nome de Attribute, nome de Role, d8 ou d4 de Distinction, nome de Specialty, dado ou
  nome de Asset, dado de Talent, maior dado de Grana (pelo **+ DADO**, item GRANA, se a regra estiver ligada).
- **Obrigatórios:** exatamente **1 Attribute e 1 Role** (chips sólidos). Escolher outro Attribute troca o anterior.
- **Opcionais:** chips tracejados. No máximo **uma Distinction** por rolagem. Specialty só faz sentido com a Role
  dela; se a Role na Pool for outra, avise com um tooltip no chip (não bloqueie: o mestre pode permitir).
- **+ DIE:** menu com d4…d12 avulsos e com os Traços de cena/local/complicações visíveis do Job ativo
  (`docs/09`), para quem recebeu um dado de outro jogador ou do cenário.
- Clicar num chip da bandeja tira ele da Pool (Distinction: alterna d8 → d4 → fora).
- **ROLL** fica desabilitado (com tooltip) até haver Attribute e Role. Atalho: Enter com a ficha focada.
- O contador "N dice · keep 2" acompanha.
- Depois de rolar, a Pool limpa (configuração de cliente para manter, padrão: limpar).

## Ao rolar

1. Avalie cada dado com a classe `Roll` do Foundry (um termo por dado, para o Dice So Nice e para o histórico).
2. Separe os **1s**: não contam.
3. **Mantidos:** os dois maiores entre os que não são 1. Se só sobrar um, total = ele; se nenhum, total = 0.
4. Se entrou **Distinction d4**: o personagem **ganha 1 PP** na hora (registrado no card).
5. Se entrou **Grana**: o personagem **desce 1 degrau** (registrado no card).
6. Crie a mensagem de chat com o card e as `flags` de `docs/05`.

## O card

- **Topo preto:** retrato pequeno (mugshot), nome em Anton com contorno, `flavor` (descrição da ação) em cinza.
- **Chips dos Traços:** nome + tamanho do dado na cor do dado.
- **Dados:** o mesmo componente da ficha (`renderDie`), 50 px, **com o resultado dentro**:
  - Mantidos: cor cheia, borda acesa branca, legenda "KEPT".
  - 1s: borda vermelha, opacidade 0,75, legenda "1 · OUT".
  - Os outros: opacidade 0,45, legenda com o tamanho ("d8").
  - Ordem: a mesma da Pool (Attribute, Role, depois os opcionais).
- **TOTAL** grande + explicação curta ("2 highest kept · 9 + 6").
- **Aviso de 1s** (caixa tracejada vermelha) quando houver 1s ainda não resolvidos.
- **Botões:**
  - **"+1 PP · KEEP 3RD DIE"** (só o dono, enquanto tiver PP e houver dado não mantido que não seja 1): gasta 1 PP,
    marca o próximo maior como mantido, atualiza total e card. Pode repetir.
  - **"GM · COMPLICATION"** (só o mestre, por 1 não resolvido): abre um mini-diálogo (nome da Complication, nova ou
    subir uma existente do Job ativo), cria/sobe no Rastreador do Job e **dá 1 PP** ao jogador. Marca o 1 como
    resolvido.
- O card é atualizado editando a própria mensagem (o dono e o mestre têm permissão; use socket se o jogador não
  puder atualizar a mensagem diretamente).

## Oposição (rolagem do mestre)

- **Rolador de oposição** (controle do mestre): escolha rápida de dados (d4…d12, com contadores), atalhos:
  "2d6 (nenhuma oposição)", "Polícia (estrelas atuais)", "Gangue: N × dX", "NPC selecionado", Traços do Local e
  Complicações do Job ativo. Gera o mesmo card, com cabeçalho "FIXER" e cor de destaque vermelha discreta.
- Opcional: card de **disputa** que liga a rolagem do jogador à do mestre e mostra quem venceu e se foi
  Extraordinary Success (+5). Registre a escolha.

## Tiroteio (regra da casa "Vida")

- No card de oposição contra um personagem, se a oposição venceu, o mestre tem o botão **"APPLY DAMAGE"**: calcula
  margem + dado da arma do NPC (rola o dado da arma), pergunta cobertura (sim/não), aplica metade e depois o colete,
  e atualiza Vida/Colete. Se a Vida zerar: mensagem **WASTED** ou **BUSTED** (NPC com `police`) estilizada como no
  GTA, com os passos da regra (pagar d4 / fiança d6 ou resgate, +1 PP, perder Assets de arma de cena — com
  confirmação).
- **Ganging Up:** quem vence contra uma gangue derruba um capanga (dois com +5); o mestre diminui o tamanho da gangue
  na ficha do NPC (`gang.size`). O sistema não automatiza isso: o card do jogador não mostra "−1 thug".

## Integrações

- **Dice So Nice** (se o módulo estiver ativo): registre as cores por tamanho de dado (d4 vermelho … d12 roxo) e
  verde-dinheiro para Grana. Sem o módulo, nada muda.
- **Macros:** `game.leverage.rollPool(...)` com as refs de `docs/04`. Arrastar um Attribute/Role/Asset da ficha
  para a barra de macros cria uma macro que monta a Pool com aquele Traço (estilo dnd5e).
