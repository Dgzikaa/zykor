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

  // Gold mensal retorna todos os campos necessários
  return mesesGold.map(g => ({
    ...g,
    numero_semana: parseInt(g.periodo.split('-')[1]), // Extrair mês do periodo
    atualizado_em: g.calculado_em,
    atualizado_por_nome: 'Sistema ETL',
  })) as DadosSemana[];
}

// REMOVIDO: getDadosMensais e helpers de agregação JS
// Gold já tem granularidade mensal pré-calculada
