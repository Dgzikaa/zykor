# Financeiro

> Itens financeiros que não são da auditoria do CA (essa está em
> [auditoria-conta-azul.md](auditoria-conta-azul.md)).

---

## BP no Zykor — ✅ FEITO
Business Plan já construído (parqueado em Ferramentas). Serve de referência de "estilo BP" (o
mais fácil = dificuldade 5).

## Lançamento Fatura do Cartão / Boleto / Pix Avulso
**Tipo:** Ferramenta · **Dificuldade: ~3** (Pix Avulso ~5, quase pronto)

Automatizar a criação de contas a pagar a partir de fatura de cartão, boleto, ou pix avulso.
- **Pix Avulso:** já existe no fluxo de `/agendamento` (PIX Inter → Conta Azul). Quase pronto.
- **Boleto / Fatura:** parser + criar conta a pagar, usando o motor CA que já temos. Pagamento BB
  em lote já está planejado.

## Provisões
**Tipo:** Gestão · **Dificuldade: ~3**
🔗 Planilha: `https://docs.google.com/spreadsheets/d/1K2oFJT-nxzTP7d_FGugzmlgASRWCjV7T` (gid 572065553)

Tela pra inputar a folha que a contabilidade manda + histórico (cada mês, cada funcionário:
salário, provisão, 13º, adiantamento, férias) + painel de saldo provisionado. Hoje é manual: abre o
PDF da contabilidade, vê o valor, coloca, e calcula os 27%.

- **🔗 Sinergia forte:**
  - Chave = funcionário → liga ao **Cadastro de Funcionário** (ver [rh.md](rh.md)).
  - É o **mesmo PDF** da **Conferência de Folha** → o LLM que lê o contracheque alimenta as
    Provisões automaticamente. Provisões + Conferência de Folha = uma fonte só.

## Conciliação de Caixa e NF vs Stone
**Tipo:** Gestão · **Dificuldade: ~3** (depende de juntar as 3 fontes)
🔗 Planilha: `https://docs.google.com/spreadsheets/d/1q9L8rm6Ul_DFCKBY6fG-ebJCFOCEqEkL` (gid 420323958)

De-para entre: vendas no ContaHub × recebimento na Stone × NF emitida por CNPJ.
- **Detecta diferença:** ex. crédito ContaHub 7.541,38 vs ajuste manual 197,82 vs entrada 7.469,81
  → diferença → checar garçom passando por fora ou não lançado no CA.
- **Detecta CNPJ errado no dia** (risco de bitributação — impostos diferentes por CNPJ). Regra de
  qual CNPJ usar por dia da semana:
  - **Ordinário:** CNPJ1 "Ordinário Bar e Música LTDA" = qua/sex/sáb/dom · CNPJ2 "Ordibar" = seg/ter/qui
  - **Deboche:** CNPJ2 "DSCBR" = dom/ter/qua · CNPJ1 "Descubra" = demais dias
- **Alertas:** emitiu menos do que deveria; emitiu em CNPJ que não era o do dia.
- **Reusa:** PoC da Stone (já cifrada por bar). Falta: juntar ContaHub + Stone + NF (relatório de NF
  do ContaHub — sócio vai passar) + a regra de CNPJ + os alertas.
- *Se tivéssemos a API da Stone, parte disso seria automática.*
