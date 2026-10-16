# Decisões

Decisões que não estavam nos documentos, tomadas durante a construção. Formato:
`## <data> — <assunto>` · **Contexto** · **Escolha** · **Alternativa descartada** · **Tarefa**

## 2026-10-16 — Decisões tomadas antes do código (na conversa de design)
- **id do sistema:** `leverage-gta`, título "Leverage: Liberty City". Trocar antes da primeira versão pública se o dono quiser.
- **Fonte de destaque:** Anton (OFL) no lugar da Pricedown até a licença da Pricedown ser confirmada.
- **Vida e Colete** em pontos pequenos (10 + Vitality; coletes 4/6/10), visual de GTA (coração e escudo com número).
- **Grana** em escada de degraus exibida como dados verde-dinheiro; preços em dados.
- **HUD** só com estrelas, Grana e Plot Points, no canto superior direito, preso à barra lateral.
- **Testes** no Foundry do VPS do dono via deploy por SSH; o Claude roda no PC do dono.

- **signatureAsset em DEFAULT_PRICES:** preco base d8; o d4 extra depende do item e nao entra na tabela (T-101, correcao da revisao).
- **Fontes:** entram por @font-face em T-201, nao pelo manifesto.
- **CONFIG.LEVERAGE:** objeto raiz e padroes aninhados ficam congelados de proposito; extensoes (ex. outros modulos) devem usar hooks/settings, nao mutar a configuracao.
- **system.json:** compatibility.verified = "14" (build exato nao confirmado); secondaryTokenAttribute "vest" adicionado.
