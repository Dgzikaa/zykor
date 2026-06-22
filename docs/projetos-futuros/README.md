# Projetos Futuros — Roadmap Zykor

> Base de conhecimento consolidada da reunião de planejamento (jun/2026). Captura tudo que
> discutimos sobre o que ainda queremos construir no Zykor — descrição, esforço, o que já
> existe, dependências e links das planilhas de origem.
>
> **Status: PLANEJAMENTO.** Nada aqui está aprovado pra desenvolver. Cada item será analisado
> e priorizado antes de virar código.

Fonte original: planilha `docs/projetosfuturos.png` (prints em `docs/`).

---

## Como ler

**Tipo** (coluna da planilha):
- **Ferramenta** — algo a criar do zero no Zykor.
- **Gestão** — já existe em planilha/PDF; queremos trazer pra dentro do Zykor.

**Escala de Dificuldade (1–5)** — definida pelo sócio, é por *tempo de entrega*:
| Nota | Significado |
|------|-------------|
| **1** | Meses (mais difícil/longo) |
| 2 | Semanas+ |
| 3 | ~1 semana |
| 4 | ~dias |
| **5** | Em 1 dia ("estilo BP", mais fácil) |

---

## Índice por área

| Doc | Área | Itens-chave |
|-----|------|-------------|
| [auditoria-conta-azul.md](auditoria-conta-azul.md) | Financeiro / IA | Avisos (vencido, conciliação, retroativo), painel de atrasos, calendário de retroativos, IA pente fino, IA categorização |
| [financeiro.md](financeiro.md) | Financeiro | Lançamento fatura/boleto/pix, Provisões, Conciliação Stone/NF, BP (feito) |
| [cmv-producao-compras.md](cmv-producao-compras.md) | CMV / Produção | Fichas Técnicas (keystone), CMV Teórico, Desvios, Planej. Produção, Planej. Compras |
| [rh.md](rh.md) | RH | Cadastro de Funcionário (keystone), Pesquisas, Avaliação/Calibração, Ponto, Universidade, Conferência de Folha |
| [operacao.md](operacao.md) | Operação | Plano Operacional, Controle de Freelas, Escala da Equipe, Checklist, Cardápio Digital, Dashboard TV ao vivo |
| [receita-gestao.md](receita-gestao.md) | Receita/Mkt / Gestão | CRM + Disparos, Previsão de Demanda, Trello/Notion, Painel por Setor |

---

## Temas transversais (valem pra vários itens)

### 1. "Central de Qualidade / Auditoria do Conta Azul"
Vários itens não são projetos soltos — são **um produto só** (motor compartilhado: ler o histórico do
bronze + detectar desvio; LLM só de tempero pra ler PDF/explicar). Cobre: atrasos, conciliação
pendente, retroativos, lançamentos faltantes, valores anômalos, categoria errada. Detalhe em
[auditoria-conta-azul.md](auditoria-conta-azul.md). **Risco transversal: falso positivo / calibragem.**

### 2. Princípio "Planejado × Realizado"
O sócio quer ver planejado vs realizado + análises de desvio em **todo módulo de planejamento**
(previsão, plano operacional, produção, compras, metas/OKR, avaliação, escala). **Não é um item —
é requisito de design.**
- **Regra de ouro:** todo plano nasce com um **snapshot imutável no momento da decisão** (já
  usamos snapshot em saldo mensal/desempenho), pra a comparação ser honesta depois.
- O "realizado" é quase sempre dado que já ingerimos (ContaHub/CMO/contagem/vendas) → comparar é barato.
- Já existe num lugar: Desempenho semanal compara M1 planejado × realizado (% atingimento).
- **Valor:** vira ciclo de aprendizado (planejo→executo→meço desvio→ajusto) e **é como os modelos
  (forecast/dimensionamento/produção) aprendem e ficam mais certeiros.**

---

## Keystones e ordem de ataque sugerida

A maior alavanca é construir primeiro os itens que **destravam vários outros** (cada um baratea o próximo):

1. **Cadastro de Funcionário** (pedra angular do RH) → destrava Folha, Provisões, Avaliação,
   Ponto, Escala, Freelas, e automatiza a "Equipe" no Desempenho semanal.
2. **Ficha Técnica** → destrava CMV Teórico, Desvios, Planej. Produção e Compras.
3. **Motor de Forms** → serve Pesquisas de RH **e** Checklist (mesma base).
4. **Previsão de Demanda** (já meio caminho com o painel de artistas) → alimenta o Plano
   Operacional → Escala/CMO.
5. **Auditoria do CA** → reusa muito do que já fizemos (baixas, DFC, beneficiários).

### Já FEITO (ou quase)
- ✅ **BP no Zykor** (parqueado em Ferramentas)
- ✅ **Contagem de Estoque** (`/operacional/contagem`)
- ✅ **Sugestão de Compras** (protótipo do Planej. de Compras)
- ✅ **Painel de Artistas / Atrações** (base do preditor de demanda)
- 🟡 **Pix Avulso** (já no fluxo de /agendamento)
- 🟡 **Motor de pagamento/agendamento, Beneficiários, CMV semanal/mensal, NPS** — fundações reutilizáveis
