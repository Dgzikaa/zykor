# Central de Qualidade / Auditoria do Conta Azul

> Vários itens da planilha são, na verdade, **um produto só**. Motor compartilhado:
> **ler o histórico do bronze + detectar desvio**. O LLM entra só de tempero (ler PDF, explicar
> a anomalia em linguagem natural) — o motor é regra + estatística.
>
> **Risco transversal de TODOS:** falso positivo. O difícil não é detectar; é **calibrar pra não
> virar barulho** (ex.: ver "Avisos de retroativo" abaixo).

Cobre: atrasos · conciliação pendente · retroativos · lançamentos faltantes · valor anômalo · categoria errada.
Tudo lendo `bronze_contaazul_lancamentos` (+ `bronze_contaazul_baixas`), que já sincronizamos.

---

## Avisos: Lançamento Vencido / Conciliação Pendente / Lançamento Retroativo
**Tipo:** Ferramenta · **Dificuldade: ~4 (dias)**

Avisar automaticamente quando: conta a pagar em aberto e vencida; lançamento sem conciliação;
lançamento cadastrado com competência retroativa.

- **Por que é baixo:** dados já no bronze (`data_vencimento`, `conciliado`, `data_criacao_ca`,
  `excluido_em`) + já existe `vigia_lancamentos_atrasados` + Discord/Web Push prontos.
- **Falta:** uma RPC que liste os 3 casos + ligar no dispatcher.
- ⚠️ **WhatsApp tem risco de ban** no número de negócio → usar **Discord** ou número dedicado com template.

## Painel de gestão de atrasos / vencimentos / conciliações por conta
**Tipo:** Ferramenta · **Dificuldade: ~3 (~1 semana)**

Tipo "no Ordinário, a conta financeira X tem N itens pra conciliar / está em dia".
- **Reusa:** a conciliação por baixa (`id_reconciliacao`) que já fizemos no DFC sabe o que está
  conciliado vs pendente, por conta financeira.
- **Falta:** RPCs de agregação por `conta_financeira` × status + uma página.

## Calendário de Retroativos
**Tipo:** Ferramenta · **Dificuldade: ~4**

Calendário onde cada dia mostra quantos lançamentos **retroativos** foram cadastrados naquele dia
("dia 22 teve 4 retroativos"). Agrupa por `data_criacao_ca` (data de cadastro no CA).

- **GOTCHA crítico (descoberto na análise):** a definição importa MUITO. "Competência em mês
  anterior" gera **ruído** — ex.: dia 01/06 teve 651 itens, mas eram contas de fim de maio
  lançadas ~5 dias depois = **fechamento normal de mês**, não back-date problemático.
- **Definição certa = gap em dias:** competência mais de N dias antes do cadastro. **N (15/30/45/60)
  é decisão do sócio** — define o painel inteiro.
- Campos disponíveis: `bronze_contaazul_lancamentos.data_criacao_ca` (timestamptz) e `data_competencia`.

## IA Pente Fino (erros/faltas nos lançamentos)
**Tipo:** Ferramenta · **Dificuldade: ~3 (e cresce)**

Achar: lançamento que esqueceram de fazer, duplicado, valor fora do padrão, data estranha. Ex.:
"todo dia tem custo de atração e nesse dia não tem". Central de análise da IA do CA.

- **A maior parte NÃO é LLM — é regra + estatística sobre o histórico:**
  - *Faltante recorrente:* fornecedor/categoria apareceu nos últimos meses e sumiu nesse.
  - *Duplicado:* mesmo valor+fornecedor+data próximos (fuzzy match).
  - *Valor anômalo:* "últimos 3 meses ~R$X, esse mês R$Y" (desvio % / z-score por série).
- LLM entra só pra explicar a anomalia ou casar descrições parecidas.

## IA Categorização Automática
**Tipo:** Ferramenta · **Dificuldade: ~3**

"Locação de bistrô é sempre Locação; lançaram com outra categoria → IA aponta." Não deixar coisa mal cadastrada.

- Monta o padrão: por fornecedor (+ palavras da descrição) → categoria dominante histórica.
- *Erro de categoria:* lançamento com categoria ≠ o padrão do fornecedor → sinaliza.
- *Sugestão:* na hora de cadastrar, já propõe a categoria certa.
- Já temos infra de classificador no projeto (mix/por-linha).

---

**Nota de sinergia:** vários itens do **Checklist** financeiro (conciliação, conferir vencidos,
atualizar DRE) são exatamente o que essa auditoria automatiza → no futuro o Zykor pode auto-marcar
ou cruzar ("você marcou conciliação OK, mas o painel mostra 5 pendentes").
