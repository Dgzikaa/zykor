import { SupabaseClient } from '@supabase/supabase-js';
import {
  ContahubStockoutMixRow,
  DadosSemana,
  DesempenhoSemanalDbRow,
  EventoBaseDiarioRow,
  MarketingSemanalRow,
  SemanaProporcaoMes,
} from '../types';

export async function getMeses(
  supabase: SupabaseClient,
  barId: number,
  anoInicio: number,
  mesInicio: number,
  anoFim: number,
  mesFim: number
): Promise<DadosSemana[]> {
  
  // NOVO: Buscar direto de gold.desempenho com granularidade='mensal'
  // Gold já tem mensalidade pré-calculada (elimina ~200 linhas de agregação JS)
  const { data: mesesGold, error } = await supabase
    .schema('gold' as never)
    .from('desempenho')
    .select('*')
    .eq('bar_id', barId)
    .eq('granularidade', 'mensal')
    .gte('periodo', `${anoInicio}-${String(mesInicio).padStart(2, '0')}`)
    .lte('periodo', `${anoFim}-${String(mesFim).padStart(2, '0')}`)
    .order('periodo', { ascending: true });

  if (error) {
    console.error('❌ Erro em gold.desempenho (mensal):', {
      message: error.message,
      code: error.code,
      barId,
    });
    throw new Error(`Erro ao carregar desempenho mensal: ${error.message}`);
  }

  if (!mesesGold || mesesGold.length === 0) {
    return [];
  }

  // Mapeamento gold.desempenho -> nomes esperados pelo front
  // Espelha o mapeamento que desempenho-service.ts (semanal) faz
  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && !isNaN(v)) return v;
    if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? null : n; }
    return null;
  };

  return mesesGold.map((g: any) => {
    const tempoDrinks = toNum(g.tempo_drinks);
    const tempoCozinha = toNum(g.tempo_cozinha);
    const faturamentoTotal = toNum(g.faturamento_total) ?? 0;
    const descontoTotal = toNum(g.desconto_total) ?? 0;

    return {
      ...g,
      numero_semana: parseInt(g.periodo.split('-')[1]),
      atualizado_em: g.calculado_em,
      atualizado_por_nome: 'Sistema ETL',

      // Tempos: gold em SEGUNDOS -> front em MINUTOS. Filtra clamp 9999 (outliers).
      tempo_saida_bar: tempoDrinks !== null && tempoDrinks < 9999 ? Math.round(tempoDrinks / 60 * 100) / 100 : null,
      tempo_saida_cozinha: tempoCozinha !== null && tempoCozinha < 9999 ? Math.round(tempoCozinha / 60 * 100) / 100 : null,

      // Atrasos: rename gold -> front
      atrasinhos_bar: toNum(g.atrasinho_drinks),
      atrasos_bar: toNum(g.atrasao_drinks),
      atrasos_bar_perc: toNum(g.atrasos_drinks_perc),
      atrasinhos_cozinha: toNum(g.atrasinho_cozinha),
      atrasos_cozinha: toNum(g.atrasao_cozinha),
      atrasos_cozinha_perc: toNum(g.atrasos_comida_perc),

      // Descontos: gold tem desconto_total/desconto_percentual; front espera descontos_valor/descontos_perc
      descontos_valor: descontoTotal,
      descontos_perc: faturamentoTotal > 0 ? (descontoTotal / faturamentoTotal) * 100 : 0,

      // Cancelamentos: gold cancelamentos_total -> front cancelamentos
      cancelamentos: toNum(g.cancelamentos_total) ?? toNum(g.cancelamentos),
    };
  }) as DadosSemana[];
}

// REMOVIDO: getDadosMensais e helpers de agregação JS
// Gold já tem granularidade mensal pré-calculada
