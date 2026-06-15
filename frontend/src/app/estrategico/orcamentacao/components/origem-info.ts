// Metadados de PROVENIÊNCIA das linhas da Orçamentação.
//
// Cada linha da tela (indicador agregado, header de categoria ou subcategoria)
// tem 3 colunas: Planejado | Projetado | Realizado. Este arquivo descreve, pra
// cada linha, DE ONDE vem cada coluna (fonte, tabela e campo do banco) e QUAL
// cálculo é feito. Consumido pelo <OrigemTooltip /> no mouseover do nome da linha.
//
// Fonte de verdade do que renderiza: services/orcamentacao-service.ts
// (getOrcamentacaoCompleta). Manter este arquivo alinhado com aquele.

export interface OrigemCampo {
  fonte: string;          // ex: 'Conta Azul', 'Planilha', 'ContaHub + Sympla + Yuzer'
  tabela?: string;        // tabela/coluna do banco
  campo?: string;         // campo + agregação
  obs?: string;           // observação curta
}

export interface OrigemLinha {
  titulo: string;
  descricao?: string;     // o que a linha representa
  planejado?: OrigemCampo;
  projetado?: OrigemCampo;
  realizado?: OrigemCampo;
  calculo?: string;       // fórmula (linhas derivadas / indicadores)
}

// Subcategorias cujo REALIZADO é digitado na tela (bolinha azul), não vem do CA.
export const SUBCATEGORIAS_MANUAIS = new Set<string>([
  'MKT Disparos', 'MKT Programa de Pontos', 'MKT Beneficios', 'Produção Mensal Fixo',
]);

// --- Blocos genéricos reutilizados ---

const PLANEJADO_PADRAO: OrigemCampo = {
  fonte: 'Planilha (planejamento anual)',
  tabela: 'meta.orcamento_planilha',
  campo: 'valor_planejado',
  obs: 'Fixo no ano. Filtro: bar_id + ano + mês + categoria.',
};

const PROJETADO_PADRAO: OrigemCampo = {
  fonte: 'Planilha (input manual na tela)',
  tabela: 'meta.orcamento_planilha',
  campo: 'valor_projetado',
  obs: 'Revisado a cada semana. Editável clicando na célula azul.',
};

const REALIZADO_CA: OrigemCampo = {
  fonte: 'Conta Azul (automático)',
  tabela: 'gold.orcamento_realizado_mensal ← bronze.bronze_contaazul_lancamentos',
  campo: 'net = Σ valor_bruto por data_competencia',
  obs: 'Categoria do CA mapeada p/ esta linha (de-para por nome). + ajustes de financial.dre_manual.',
};

const REALIZADO_MANUAL: OrigemCampo = {
  fonte: 'Manual (digitado na tela)',
  tabela: 'meta.orcamento_planilha + financial.dre_manual',
  campo: 'valor_realizado_manual',
  obs: 'Sócio preenche fora do Conta Azul. Editável clicando na célula.',
};

// --- Overrides por nome de linha (indicadores, headers, casos especiais) ---

const ESPECIAIS: Record<string, OrigemLinha> = {
  // ===== Indicadores agregados (topo) =====
  'Real Fixo': {
    titulo: 'Real Fixo',
    descricao: 'Despesas fixas (não-variáveis) do mês.',
    calculo:
      'Σ dos blocos Mão-de-Obra + Comerciais + Administrativas + Operacionais + Ocupação. NÃO inclui Custos Variáveis, CMV nem Receita.',
    planejado: PLANEJADO_PADRAO,
    projetado: PROJETADO_PADRAO,
    realizado: REALIZADO_CA,
  },
  'Faturamento Meta': {
    titulo: 'Faturamento Meta',
    descricao: 'A única linha de receita da Orçamentação (o detalhe por meio de recebimento fica na DRE).',
    planejado: {
      fonte: 'Planilha',
      tabela: 'meta.orcamento_planilha',
      campo: "valor_planejado (categoria 'FATURAMENTO META')",
    },
    projetado: {
      fonte: 'Planejamento Comercial (Empilhamento M1)',
      tabela: 'eventos_base',
      campo: 'Σ m1_r dos eventos do mês',
      obs: 'Apenas eventos ativos (ativo = true).',
    },
    realizado: {
      fonte: 'Mês fechado: Conta Azul · Mês corrente: ContaHub (tempo real)',
      tabela: 'gold.orcamento_realizado_mensal (CA) · operations.eventos_base.real_r (mês corrente)',
      campo: 'Σ net do bloco Receita (CA) ou Σ real_r (mês corrente)',
      obs: 'No mês em andamento usa o ContaHub porque o cartão de crédito só entra no Conta Azul na liquidação (atrasado), subreportando a receita. Meses fechados seguem o Conta Azul (oficial).',
    },
  },
  '% CONTRIB': {
    titulo: '% Contribuição (Margem de Contribuição)',
    descricao: 'Quanto sobra de cada R$ vendido após os custos variáveis.',
    calculo:
      'MC = 1 − (Custos Variáveis % + CMV %). Os dois % editáveis nas linhas de Variáveis e CMV.',
  },
  BreakEven: {
    titulo: 'BreakEven (Ponto de Equilíbrio)',
    descricao: 'Faturamento necessário pra cobrir as despesas fixas.',
    calculo: 'BreakEven = Real Fixo ÷ % Contribuição (Margem de Contribuição).',
  },
  'Lucro Líquido': {
    titulo: 'Lucro Líquido',
    descricao: 'Resultado do mês na Orçamentação.',
    calculo:
      'Faturamento + Não Operacionais − Custos Variáveis − CMV − Real Fixo. Cada componente segue a fonte da sua linha.',
  },
  Margem: {
    titulo: 'Margem',
    descricao: 'Rentabilidade do mês.',
    calculo: 'Margem = Lucro Líquido ÷ Faturamento × 100.',
  },

  // ===== Blocos % (Variáveis / CMV) =====
  'Custos Variáveis': {
    titulo: 'Custos Variáveis (IMPOSTO / Tx Maq / Comissão)',
    descricao: 'Custos que crescem junto com a venda. Na Orçamentação entra só como %.',
    calculo: 'R$ = % × Faturamento. Compõe a Margem de Contribuição.',
    planejado: {
      fonte: 'Planilha (% editável na tela)',
      tabela: 'meta.orcamento_planilha',
      campo: "valor_planejado (categoria 'Custos Variáveis', em %)",
    },
    projetado: {
      fonte: 'Planilha (% editável na tela)',
      tabela: 'meta.orcamento_planilha',
      campo: "valor_projetado (categoria 'Custos Variáveis', em %)",
    },
    realizado: {
      fonte: 'DRE (Conta Azul)',
      tabela: 'gold.orcamento_realizado_mensal (bloco Custos Variáveis)',
      campo: 'Σ net (IMPOSTO + Comissão + Tx Maq) ÷ Faturamento realizado',
      obs: 'O % realizado vem da DRE.',
    },
  },
  'Custo insumos (CMV)': {
    titulo: 'CMV',
    descricao: 'Custo dos insumos vendidos. Na Orçamentação entra só como %.',
    calculo: 'R$ = % × Faturamento. Compõe a Margem de Contribuição.',
    planejado: {
      fonte: 'Planilha (% editável na tela)',
      tabela: 'meta.orcamento_planilha',
      campo: "valor_planejado (categoria 'Custo insumos (CMV)', em %)",
    },
    projetado: {
      fonte: 'Planilha (% editável na tela)',
      tabela: 'meta.orcamento_planilha',
      campo: "valor_projetado (categoria 'Custo insumos (CMV)', em %)",
    },
    realizado: {
      fonte: 'DRE (Conta Azul)',
      tabela: 'gold.orcamento_realizado_mensal (bloco Custo insumos (CMV))',
      campo: 'Σ net (Custo Drinks/Bebidas/Comida/Outros) ÷ Faturamento realizado',
      obs: 'O % realizado vem da DRE.',
    },
  },

  // ===== Linhas com fonte especial =====
  'CUSTO-EMPRESA FUNCIONÁRIOS': {
    titulo: 'Custo-Empresa Funcionários',
    descricao: 'Custo total do funcionário CLT.',
    calculo: 'Realizado = SALÁRIO + ALIMENTAÇÃO + PROVISÃO TRABALHISTA + VALE TRANSPORTE (somados do Conta Azul).',
    planejado: PLANEJADO_PADRAO,
    projetado: PROJETADO_PADRAO,
    realizado: {
      ...REALIZADO_CA,
      campo: 'Σ net das 4 categorias CA agregadas',
    },
  },
  'Não Operacionais': {
    titulo: 'Não Operacionais',
    descricao: 'Receita que não vem da operação do bar (não entra no BreakEven). Só Contratos.',
    calculo: 'Contratos (cashback/bonificações Ambev).',
    planejado: PLANEJADO_PADRAO,
    projetado: PROJETADO_PADRAO,
    realizado: REALIZADO_MANUAL,
  },
  Contratos: {
    titulo: 'Contratos',
    descricao: 'Cashback/bonificações Ambev e contratos anuais. Vem da aba DRE Manual.',
    planejado: PLANEJADO_PADRAO,
    projetado: PROJETADO_PADRAO,
    realizado: REALIZADO_MANUAL,
  },
};

// Retorna a proveniência de uma linha. `nome` = nome da subcategoria, header de
// categoria ou indicador. Cai num padrão genérico (planilha + Conta Azul) quando
// não há override específico.
export function getOrigem(nome: string): OrigemLinha {
  const especial = ESPECIAIS[nome];
  if (especial) return especial;

  const isManual = SUBCATEGORIAS_MANUAIS.has(nome);
  return {
    titulo: nome,
    planejado: PLANEJADO_PADRAO,
    projetado: PROJETADO_PADRAO,
    realizado: isManual ? REALIZADO_MANUAL : REALIZADO_CA,
  };
}
