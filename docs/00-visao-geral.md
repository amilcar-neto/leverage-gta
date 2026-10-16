# 00 — Visão geral

## O que é

Um sistema de jogo para **Foundry VTT v14** que roda o ***Leverage: The Roleplaying Game*** (Margaret Weis
Productions, motor Cortex Plus) com uma camada de **regras da casa** e uma **estética de GTA da era 3D**, mais
especificamente Liberty City do GTA III: HUD com contorno preto, ficha policial, dados coloridos.

- **id do sistema:** `leverage-gta` (pode mudar antes da primeira versão pública; se mudar, troque em todo lugar)
- **Título:** `Leverage: Liberty City`
- **Idiomas:** inglês (padrão) e português do Brasil
- **Compatibilidade:** Foundry v14 (mínimo 14, verificado na build estável mais recente que o desenvolvedor tiver)

## Escopo da versão 1

1. **Ficha da Equipe** (ator `crew`) igual ao mockup `reference/mockups/png/sheet-*.png`.
2. **Itens** para tudo que se adiciona e remove: Distinction, Talent, Specialty, Asset (Signature/Job/Scene) e Job.
   Cada item abre na própria janela, pode ser arrastado para a ficha, criado na ficha e apagado na ficha.
3. **Montagem da Pool e rolagem** com card no chat igual a `roll-chat-card.png`: dados com a forma e a cor certas e o
   resultado dentro, os dois maiores destacados, os 1s marcados.
4. **Plot Points** com toda a automação do livro (ganhar com d4 de Distinction, com Complicação, com Giving In;
   gastar para manter mais dados, ativar Talent, criar Asset).
5. **Regras da casa** (cada uma liga/desliga nas configurações): Estrelas de procurado, Vida e Colete, Grana em escada.
6. **HUD** no canto superior direito, preso à barra lateral: estrelas, grana, Plot Points.
7. **Ferramentas do mestre** na barra de controles da esquerda e **configurações do sistema** na engrenagem.
8. Fichas simples de **NPC** (Extra, Foil, Mark, Agent) e de **Local** (Location), para o mestre rolar oposição.
9. Tradução completa en + pt-BR, sem texto fixo no código.

## Fora do escopo (por enquanto)

- Regras extras do Cortex Prime além das já adotadas (Life Points e Resources viraram Vida e Grana).
- Compêndios grandes com conteúdo do livro (o livro é protegido; só exemplos próprios).
- Integrações com módulos de terceiros, exceto as opcionais citadas (Dice So Nice, se for simples).

## Glossário

| Termo | Significado |
| --- | --- |
| Crew / Equipe | Os personagens dos jogadores |
| Fixer | O mestre (GM) |
| Trait / Traço | Qualquer coisa com dado: Attribute, Role, Distinction, Specialty, Asset, Complication |
| Attribute | Agility, Alertness, Intelligence, Strength, Vitality, Willpower (d4–d12) |
| Role | Grifter, Hacker, Hitter, Mastermind, Thief (d4–d12, pode estar em branco) |
| Distinction | Frase que descreve o personagem; entra como d8 (ajuda) ou d4 (+1 Plot Point) |
| Specialty | Perícia estreita ligada a uma Role; soma d6 quando se usa aquela Role |
| Talent | Truque especial ligado a uma Role (ou Open), com Activation e Effect; alguns custam 1 PP |
| Asset | Coisa a favor: Signature (permanente), Job (2 PP, dura o golpe), Scene (1 PP, dura a cena) |
| Complication | Problema criado pelo mestre a partir dos 1s; é um dado na mão do mestre |
| Plot Point (PP) | Moeda do jogador |
| Pool | Os dados que vão ser rolados juntos |
| Stakes | O resultado a ser superado numa disputa |
| Job | Um golpe completo. Na ficha, a aba JOBS é o "Record" do livro |
| Stars / Estrelas | Nível de procurado da Equipe numa cidade (regra da casa) |
| Grana | Dinheiro em escada de dados (regra da casa) |
| Wasted / Busted | O que acontece quando a Vida zera (regra da casa) |

## Mapa dos documentos

Veja a tabela em `CLAUDE.md`. Em caso de conflito entre documentos, a ordem de prioridade é:
`02-regras-da-casa` > `01-regras-leverage` para regras; `03-decisoes-de-design` > mockups > `06/07/08` para visual;
`05-modelo-de-dados` > `04-arquitetura` para nomes de campos. Registre o conflito em `docs/log/DECISIONS.md`.
