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
  'CONTRATOS',
  'Receitas Financeiras',
  'Outras Receitas',
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
    descricao: 'Meta de faturamento do mês (referência do Empilhamento M1).',
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
      fonte: 'ContaHub + Sympla + Yuzer',
      tabela: 'eventos_base',
      campo: 'Σ real_r dos eventos do mês',
      obs: 'real_r consolidado por calculate_evento_metrics.',
    },
  },
  '% CONTRIB': {
    titulo: '% Contribuição (Margem de Contribuição)',
    descricao: 'Quanto sobra de cada R$ vendido após os custos variáveis.',
    calculo:
      'MC = 1 − (Custos Variáveis + CMV) ÷ Receita Operacional. Receita Op = bloco "Receita" (Stone/Pix/Dinheiro/Eventos/Outras). Não inclui Não Operacionais.',
  },
  BreakEven: {
    titulo: 'BreakEven (Ponto de Equilíbrio)',
    descricao: 'Faturamento necessário pra cobrir as despesas fixas.',
    calculo: 'BreakEven = Real Fixo ÷ % Contribuição (Margem de Contribuição).',
  },
  EBITDA: {
    titulo: 'EBITDA',
    descricao: 'Resultado operacional do mês.',
    calculo:
      'Receita Operacional + Não Operacionais − todas as despesas (variáveis + CMV + fixas). Cada componente segue a fonte da sua linha.',
  },
  Margem: {
    titulo: 'Margem EBITDA',
    descricao: 'Rentabilidade operacional.',
    calculo: 'Margem = EBITDA ÷ Receita Operacional × 100.',
  },

  // ===== Headers de categoria (linha colapsada mostra a soma) =====
  Receita: {
    titulo: 'Receita',
    descricao: 'Receita operacional bruta por meio de recebimento.',
    calculo: 'Planejado/Realizado = soma das subcategorias. Projetado = Empilhamento M1 (no nível do bloco).',
    planejado: PLANEJADO_PADRAO,
    projetado: {
      fonte: 'Planejamento Comercial (Empilhamento M1)',
      tabela: 'eventos_base',
      campo: 'Σ m1_r dos eventos do mês',
      obs: 'No nível do bloco (não por meio de recebimento). Mesma fonte do Faturamento Meta.',
    },
    realizado: REALIZADO_CA,
  },
  'Custos Variáveis': {
    titulo: 'Custos Variáveis',
    descricao: 'Custos que crescem junto com a venda.',
    calculo: 'Projetado em % da Receita projetada (M1): R$ = % × M1. Planejado/Realizado = soma das subcategorias.',
    planejado: PLANEJADO_PADRAO,
    projetado: {
      fonte: 'Planilha (% input manual na tela)',
      tabela: 'meta.orcamento_planilha',
      campo: "valor_projetado (categoria 'Custos Variáveis', em %)",
      obs: 'Valor em R$ = % × Receita projetada (M1). Compõe a Margem de Contribuição.',
    },
    realizado: REALIZADO_CA,
  },
  'Custo insumos (CMV)': {
    titulo: 'Custo de Mercadoria Vendida (CMV)',
    descricao: 'Custo dos insumos vendidos.',
    calculo: 'Projetado em % da Receita projetada (M1): R$ = % × M1. Planejado/Realizado = soma das subcategorias.',
    planejado: PLANEJADO_PADRAO,
    projetado: {
      fonte: 'Planilha (% input manual na tela)',
      tabela: 'meta.orcamento_planilha',
      campo: "valor_projetado (categoria 'Custo insumos (CMV)', em %)",
      obs: 'Valor em R$ = % × Receita projetada (M1). Compõe a Margem de Contribuição.',
    },
    realizado: {
      ...REALIZADO_CA,
      obs: 'Lançamentos de custo no CA. Referência cruzada: financial.cmv_semanal.',
    },
  },
  'Não Operacionais': {
    titulo: 'Não Operacionais',
    descricao: 'Receitas que não vêm da operação do bar (não entram no BreakEven).',
    calculo: 'Soma de Receitas Financeiras + Contratos.',
    planejado: PLANEJADO_PADRAO,
    projetado: PROJETADO_PADRAO,
    realizado: REALIZADO_MANUAL,
  },

  // ===== Subcategorias com fonte especial =====
  'Receita de Eventos': {
    titulo: 'Receita de Eventos',
    descricao: 'Receita registrada no Conta Azul como evento.',
    planejado: PLANEJADO_PADRAO,
    projetado: PROJETADO_PADRAO,
    realizado: {
      ...REALIZADO_CA,
      obs: "Categoria CA 'Receita de Eventos'. O faturamento real dos eventos (ContaHub) está em 'Faturamento Meta'.",
    },
  },
  CONTRATOS: {
    titulo: 'Contratos',
    descricao: 'Cashback/bonificações Ambev e contratos anuais.',
    planejado: PLANEJADO_PADRAO,
    projetado: PROJETADO_PADRAO,
    realizado: {
      ...REALIZADO_MANUAL,
      obs: 'Cashback Ambev calculado pelo sócio fora do CA. + lançamentos de cashback em financial.dre_manual.',
    },
  },
  'Receitas Financeiras': {
    titulo: 'Receitas Financeiras',
    descricao: 'Rendimentos e juros recebidos.',
    planejado: PLANEJADO_PADRAO,
    projetado: PROJETADO_PADRAO,
    realizado: REALIZADO_MANUAL,
  },
  'Outras Receitas': {
    titulo: 'Outras Receitas',
    descricao: 'Ajustes de receita não registrados no CA.',
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
