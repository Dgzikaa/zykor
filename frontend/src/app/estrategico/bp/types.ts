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
  tipo: 'receita' | 'despesa' | 'contrato' | 'percentual_calc';
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
