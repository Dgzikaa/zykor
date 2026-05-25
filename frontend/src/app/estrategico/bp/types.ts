export type DiaSemana = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom';

export type PorDiaSemana = Record<DiaSemana, number>;

export interface BpLinha {
  id: number;
  bar_id: number;
  ano: number;
  versao: string;
  bloco: string;
  linha: string;
  ordem: number;
  tipo: 'receita' | 'despesa' | 'contrato' | 'percentual_calc' | 'metrica_op';
  valor_mensal: number | null;
  percentual_receita: number | null;
  por_dia_semana: PorDiaSemana | null;
  observacao: string | null;
  ativo: boolean;
}

export interface BpIndicador {
  id: number;
  bar_id: number;
  ano: number;
  versao: string;
  indicador: string;
  valor: number | null;
  unidade: string | null;
  observacao: string | null;
}

// Realizado agregado por dia da semana (DOW) a partir de eventos_base
export interface AnaliseSemanalDow {
  dia: DiaSemana;
  eventos_count: number;
  pessoas_real: number;
  pessoas_plan: number;
  tb_real: number; // tkt medio bar
  tb_plan: number;
  te_real: number; // tkt medio entrada
  te_plan: number;
  fat_bar_real: number;
  fat_bar_plan: number;
  fat_entrada_real: number;
  fat_entrada_plan: number;
  fat_total_real: number;
  fat_total_plan: number;
  cache_real: number; // c_art + c_prod
  cache_plan: number; // Programacao Artistica do BP
  pct_cache_real: number; // cache / fat_total
  pct_cache_plan: number;
}

export interface AnaliseSemanal {
  ano: number;
  mes: number;
  label: string;
  por_dia: AnaliseSemanalDow[];
  totais: {
    eventos_count: number;
    pessoas_real: number;
    pessoas_plan: number;
    fat_bar_real: number;
    fat_bar_plan: number;
    fat_entrada_real: number;
    fat_entrada_plan: number;
    fat_total_real: number;
    fat_total_plan: number;
    cache_real: number;
    cache_plan: number;
  };
}
