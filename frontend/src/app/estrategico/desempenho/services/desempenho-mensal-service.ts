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

  // LEFT JOIN meta.desempenho_semanal para campos manuais (se houver)
  // Mensal usa periodo (ex: "2026-04") mas meta usa ano+mes
  const metaQuery = supabase
    .schema('meta' as never)
    .from('desempenho_semanal')
    .select(`
      bar_id, ano, numero_semana,
      observacoes, alertas_dados, nota_felicidade_equipe,
      meta_semanal, atingimento, atualizado_em, atualizado_por_nome
    `)
    .eq('bar_id', barId)
    .gte('ano', anoInicio)
    .lte('ano', anoFim);

  const { data: metaManuais } = await metaQuery;

  // Merge campos manuais (agregados por mês se múltiplas semanas)
  const metaPorMes = new Map<string, any>();
  (metaManuais || []).forEach(m => {
    const periodo = `${m.ano}-${String(Math.ceil(m.numero_semana / 4.33)).padStart(2, '0')}`;
    if (!metaPorMes.has(periodo)) {
      metaPorMes.set(periodo, m);
    }
  });

  return mesesGold.map(g => ({
    ...g,
    numero_semana: parseInt(g.periodo.split('-')[1]), // Extrair mês do periodo para compatibilidade
    observacoes: metaPorMes.get(g.periodo)?.observacoes ?? null,
    alertas_dados: metaPorMes.get(g.periodo)?.alertas_dados ?? null,
    nota_felicidade_equipe: metaPorMes.get(g.periodo)?.nota_felicidade_equipe ?? null,
    meta_semanal: metaPorMes.get(g.periodo)?.meta_semanal ?? null,
    atingimento: metaPorMes.get(g.periodo)?.atingimento ?? null,
    atualizado_em: metaPorMes.get(g.periodo)?.atualizado_em ?? g.calculado_em,
    atualizado_por_nome: metaPorMes.get(g.periodo)?.atualizado_por_nome ?? 'Sistema ETL',
  })) as DadosSemana[];
}

// REMOVIDO: getDadosMensais e helpers de agregação JS
// Gold já tem granularidade mensal pré-calculada
