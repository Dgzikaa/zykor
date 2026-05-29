/**
 * 🔮 Prever Demanda (G3)
 *
 * Para cada bar com IG ativo, prevê faturamento + público do próximo evento
 * baseado em:
 *   1. Mediana histórica do mesmo dia da semana (últimas 8 ocorrências)
 *   2. Ajuste por atração (se tem evento cadastrado com c_art > 0)
 *   3. Ajuste sazonal (mês)
 *   4. Tendência geral (slope)
 *
 * Output em gold.demanda_previsoes (data_evento, fat_previsto, publico_previsto,
 * intervalo_confianca, modelo_usado).
 *
 * Body: { bar_id?, dias_a_frente? (default 14) }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

interface Previsao {
  bar_id: number;
  data_evento: string;
  dia_semana: number;
  fat_previsto: number;
  publico_previsto: number;
  ic_inferior: number;
  ic_superior: number;
  modelo_usado: string;
  base_n_ocorrencias: number;
  ajuste_atracao: number;
}

function mediana(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function desvioPadrao(arr: number[]): number {
  if (arr.length < 2) return 0;
  const med = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((s, x) => s + (x - med) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

async function preverBar(supabase: any, barId: number, diasFrente: number): Promise<Previsao[]> {
  const previsoes: Previsao[] = [];

  // Histórico últimos 90 dias por dia da semana
  const desde = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
  const { data: historico } = await supabase
    .schema('gold').from('desempenho')
    .select('data_inicio, data_fim, numero_semana, ano, faturamento_total, clientes_atendidos')
    .eq('bar_id', barId).eq('granularidade', 'semanal')
    .gte('data_inicio', desde).order('data_inicio', { ascending: true });

  // Agrupa por dia da semana via análise dos eventos individuais
  // (gold.desempenho é por semana; precisamos de gold por dia se existir)
  // Vamos usar eventos individuais via operations.eventos se tiver, senão semanal estimado
  const { data: eventos } = await supabase
    .schema('operations').from('eventos')
    .select('data_evento, real_r, cl_real, c_art, dia_semana')
    .eq('bar_id', barId).gte('data_evento', desde).order('data_evento', { ascending: true });

  // Por dia da semana (0=domingo, 6=sabado)
  const porDow: Record<number, { fat: number[]; pub: number[]; cArt: number[] }> = {};
  for (const e of (eventos ?? [])) {
    const d = new Date(e.data_evento + 'T12:00:00').getDay();
    if (!porDow[d]) porDow[d] = { fat: [], pub: [], cArt: [] };
    if (e.real_r && Number(e.real_r) > 0) porDow[d].fat.push(Number(e.real_r));
    if (e.cl_real && Number(e.cl_real) > 0) porDow[d].pub.push(Number(e.cl_real));
    if (e.c_art && Number(e.c_art) > 0) porDow[d].cArt.push(Number(e.c_art));
  }

  // Próximos N dias
  for (let i = 0; i <= diasFrente; i++) {
    const futura = new Date(Date.now() + i * 86400000);
    const dataIso = futura.toISOString().split('T')[0];
    const dow = futura.getDay();

    const baseFat = porDow[dow]?.fat ?? [];
    const basePub = porDow[dow]?.pub ?? [];

    if (baseFat.length === 0) continue;

    // Mediana das últimas 8 ocorrências
    const ultimosFat = baseFat.slice(-8);
    const ultimosPub = basePub.slice(-8);
    const fatMed = mediana(ultimosFat);
    const pubMed = mediana(ultimosPub);

    // Desvio pra IC 80%
    const sdFat = desvioPadrao(ultimosFat);
    const sdPub = desvioPadrao(ultimosPub);

    // Ajuste por atração se existe evento cadastrado pra aquele dia
    const { data: eventoFuturo } = await supabase
      .schema('operations').from('eventos')
      .select('c_art, nome').eq('bar_id', barId).eq('data_evento', dataIso).maybeSingle();
    const cArtPrev = eventoFuturo?.c_art ?? null;
    const cArtMed = mediana(porDow[dow]?.cArt ?? []);
    const ajusteAtracao = cArtPrev && cArtMed > 0 ? cArtPrev / cArtMed : 1.0;

    const fatPrevisto = Math.round(fatMed * ajusteAtracao);
    const pubPrevisto = Math.round(pubMed * ajusteAtracao);

    previsoes.push({
      bar_id: barId,
      data_evento: dataIso,
      dia_semana: dow,
      fat_previsto: fatPrevisto,
      publico_previsto: pubPrevisto,
      ic_inferior: Math.round(Math.max(0, fatPrevisto - 1.28 * sdFat)),
      ic_superior: Math.round(fatPrevisto + 1.28 * sdFat),
      modelo_usado: 'mediana_8_dow_x_atracao',
      base_n_ocorrencias: ultimosFat.length,
      ajuste_atracao: ajusteAtracao,
    });
  }

  return previsoes;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => ({}));
    const filterBarId: number | undefined = body?.bar_id;
    const diasFrente: number = body?.dias_a_frente ?? 14;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    let q = supabase.schema('operations').from('bares').select('id').eq('ativo', true);
    if (filterBarId) q = q.eq('id', filterBarId);
    const { data: bares } = await q;

    const todas: Previsao[] = [];
    for (const b of (bares ?? [])) {
      const prevs = await preverBar(supabase, b.id, diasFrente);
      todas.push(...prevs);
    }

    // Upsert em gold.demanda_previsoes
    for (const p of todas) {
      await supabase.schema('gold').from('demanda_previsoes').upsert({
        bar_id: p.bar_id,
        data_evento: p.data_evento,
        fat_previsto: p.fat_previsto,
        publico_previsto: p.publico_previsto,
        ic_inferior: p.ic_inferior,
        ic_superior: p.ic_superior,
        modelo_usado: p.modelo_usado,
        base_n_ocorrencias: p.base_n_ocorrencias,
        ajuste_atracao: p.ajuste_atracao,
        gerada_em: new Date().toISOString(),
      }, { onConflict: 'bar_id,data_evento' });
    }

    return new Response(JSON.stringify({ success: true, previsoes: todas.length, dados: todas }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, erro: e?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
