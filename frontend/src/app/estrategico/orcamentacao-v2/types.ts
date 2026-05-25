export interface OrcamentoMapItem {
  id: number;
  bar_id: number;
  ordem: number;
  bloco: string;
  linha: string;
  tipo: 'receita' | 'despesa' | 'contrato' | 'percentual_calc';
  eh_percentual: boolean;
  contaazul_categorias: string[];
  observacao: string | null;
}

export interface OrcamentoLinhaResultado {
  bloco: string;
  linha: string;
  ordem: number;
  tipo: string;
  eh_percentual: boolean;
  bp_valor: number | null;
  bp_percentual: number | null;
  realizado: number;
  projetado: number;
  variacao_abs: number;
  variacao_pct: number;
  lancamentos_count: number;
  observacao: string | null;
  contaazul_categorias: string[];
}

export interface OrcamentoMes {
  ano: number;
  mes: number;
  label: string;
  is_atual: boolean;
  is_futuro: boolean;
  blocos: OrcamentoBlocoResultado[];
  totais: {
    receita_bp: number;
    receita_realizado: number;
    receita_projetado: number;
    despesa_bp: number;
    despesa_realizado: number;
    despesa_projetado: number;
    ebitda_bp: number;
    ebitda_realizado: number;
    ebitda_projetado: number;
    margem_bp: number;
    margem_realizado: number;
    margem_projetado: number;
  };
  orfaos: LancamentoOrfao[];
}

export interface OrcamentoBlocoResultado {
  bloco: string;
  linhas: OrcamentoLinhaResultado[];
  subtotal_bp: number;
  subtotal_realizado: number;
  subtotal_projetado: number;
}

export interface LancamentoOrfao {
  categoria_nome: string;
  count: number;
  valor_total: number;
  exemplos: { descricao: string; valor: number; data: string }[];
}

export interface LancamentoDetalhe {
  contaazul_id: string;
  data_competencia: string;
  data_pagamento: string | null;
  categoria_nome: string;
  descricao: string;
  valor: number;
  status: string;
  pessoa_nome: string | null;
}
