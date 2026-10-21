# 06 — Ficha da Equipe (ator `crew`)

Alvo visual: `reference/mockups/png/sheet-background-tab.png`, `sheet-jobs-tab.png`,
`sheet-unlocked-gm-allows-edits.png`. O HTML estático equivalente está em `reference/mockups/html/` (abra no
navegador e use o inspetor para medir). As decisões estão em `docs/03-decisoes-de-design.md`.

## Janela

- Tamanho padrão **1180 × 950**, redimensionável; mínimo 1100 × 900. As colunas têm largura fixa (376 / 400 / 316,
  gap 16, margem 24); o espaço extra de altura vai para as listas que rolam.
- Cabeçalho da janela do Foundry estilizado como a barra preta do mockup (título em maiúsculas, selo da trava,
  botões). Use os controles nativos da ApplicationV2; não recrie a janela.

## Partes (`static PARTS`)

| Parte | Conteúdo | Interações |
| --- | --- | --- |
| `header` | Mugshot, nome, apelido, Vida, Colete, Booking Card | Clique no mugshot: escolher imagem (FilePicker). Nome, apelido, campos do Booking Card: editáveis inline. Vida/Colete: clique abre um popover pequeno com − / + / valor e, no Colete, o tipo (Leve 4, Comum 6, Pesado 10) |
| `attributes` | 6 linhas: nome + escada de 5 dados | Clique no dado: muda o valor (se destravado). Clique no nome: põe/tira da Pool. Tooltip: descrição |
| `roles` | 5 linhas iguais | Igual. Role em branco: nenhum dado cheio, nome em cinza, não entra na Pool |
| `distinctions` | Até 3; nome, d8, d4 "+1 PP", X; nota numa linha | d8/d4 põe na Pool naquele modo (clicar no mesmo de novo tira). Nome/nota: abre o item. Contador "n / 3" |
| `talents` | Cards: nome, etiqueta de custo (1 PP), etiqueta de Role, "WHEN …", X | Card abre o item. Talent com `die` tem um dado clicável que vai para a Pool |
| `specialties` | Grade 2 colunas: nome, etiqueta de Role, X | Nome: Pool (soma d6). Etiqueta: trocar Role (menu). Hint no cabeçalho: "+d6 with its Role" |
| `assets` | Lista: nome, etiqueta SIGNATURE/JOB/SCENE + nota, dado, X | Dado ou nome: Pool. Duplo clique / ícone: abrir item. "+ ADD" abre um diálogo curto: nome, duração (Signature / Job 2 PP / Scene 1 PP) e confirma o gasto de PP |
| `folder` | Orelhas BACKGROUND e JOBS | Ver abaixo |
| `tray` | POOL, chips, + DIE, ROLL | Ver `docs/08` |

## Pasta

- **BACKGROUND:** editor rico (ProseMirror) do campo `background`, com botão EDIT; leitura em Special Elite.
- **JOBS:** cabeçalho "N JOBS · M UNSPENT", **TRAIN UP** (abre o diálogo de evolução com os custos), **+ LOG**
  (cria item `job` e abre). Linhas: nome (abre o item), SPENT (carimbo, se gasto), `+N` em verde-dinheiro (parte do
  personagem), caixa de **callback** (alterna `callbackUsed`; ao marcar, o personagem ganha o benefício de 1 PP gasto
  — implemente como "1 PP temporário só para esta rolagem" ou simplesmente avise no chat; registre a escolha), X.
- A orelha aberta é lembrada por ator e usuário.

## Regras visuais que o revisor vai cobrar

- **Linhas planas em repouso**; borda acesa branca **só** quando na Pool (`docs/03`).
- **Nada sobrepõe nada.** Barra de rolagem com espaço reservado e folga; X, dados e etiquetas nunca sob a barra.
- **Sem espaço morto:** as listas preenchem a altura disponível da coluna; quando cabem, não mostram barra.
- Texto que não cabe: reticências + `title`/tooltip com o texto inteiro.
- Os dados da escada têm 32 px; os da bandeja 36 px; mesma geometria e cores de `docs/03`.
- Estados vazios com frase curta em `--lv-muted` (ex.: "No talents yet. Unlock the sheet to add one.").
- **Trava (selo-botão):** cada ficha tem a sua trava (flag `sheetUnlocked`, padrão travada). O selo na barra de título
  é um **botão**: o dono clica para travar/destravar a própria ficha, livremente (o mestre também pode clicar).
  Se o mestre desliga `playersCanUnlock`, toda ficha fica travada à força e o selo do jogador fica **desabilitado**
  (só o visual com cadeado, sem frase). Tooltips do selo são curtos ("Travada. Clique para destravar."). Travada e
  usuário não-mestre: escondem-se "+ ADD" e X de Distinctions, Talents e
  Specialties, e a escada de dados não muda valor (cursor padrão, tooltip explica). Selo-botão na barra de título.

## Permissões

- Observador (limited/observer) vê a ficha sem nenhum controle de edição nem a bandeja.
- Dono edita tudo que a trava permite. Mestre edita tudo sempre.

## Fichas de NPC e Local

Mesma linguagem visual, mais simples (não há mockup; siga a ficha da Equipe):
- **NPC:** identidade própria, sem mugshot (a parede de mugshot é só da Crew). Cabeçalho com **crachá** (foto, ou
  silhueta do tier quando não há foto; faixa com o tier ou POLICE), nome, tier, POLICE (escudo), Vida e Colete
  rotulados. Faixa de cor do tier (extra cinza, foil laranja, mark vermelho, agent roxo; polícia azul). Logo abaixo
  do cabeçalho, a barra com **ROLAR COMO OPOSIÇÃO** e o tamanho da Pool. Corpo: Traços, Arma, **Capangas**
  (tamanho × dado), Notas; Attributes/Roles só para Foil/Agent. Sem textos de ajuda: só rótulos, ícones e controles.
- **Local:** **banner** da imagem do lugar (ou parede de grade de mapa com ícone), etiqueta LOCAL, nome sobre o
  banner e cidade (ícone + seleção). Corpo: Traços, **NPCs** ligados (só o mestre; arrastar da barra lateral, clicar
  abre a ficha, X desliga) e Notas.
