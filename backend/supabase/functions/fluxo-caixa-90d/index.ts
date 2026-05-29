/**
 * 💰 Fluxo de Caixa Preditivo 90d (H4)
 *
 * Pra cada bar ativo, projeta 90 dias à frente:
 *
 *   Receita:
 *     - dia que tem em gold.demanda_previsoes → usa fat_previsto
 *     - dia que falta → usa mediana DOW dos últimos 90d em gold.desempenho diário
 *
 *   Custos:
 *     - CMV: % médio (cmv_global_real) das últimas 8 semanas
 *     - CMO: orcamentacao mensal / dias do mês
 *     - Fixos+Outros: outras categorias da orcamentacao /dias do mês
 *
 *   Cenários:
 *     - pessimista: receita * 0.80, custos * 1.05
 *     - base:       receita * 1.00, custos * 1.00
 *     - otimista:   receita * 1.15, custos * 0.97
 *
 * Body: { bar_id? }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const HORIZON_DAYS = 90;

interface CenarioMult { receita: number; custo: number; }
const CENARIOS: Record<string, CenarioMult> = {
  pessimista: { receita: 0.80, custo: 1.05 },
  base:       { receita: 1.00, custo: 1.00 },
  otimista:   { receita: 1.15, custo: 0.97 },
};

function diasNoMes(ano: number, mes: number): number {
  return new Date(ano, mes, 0).getDate();
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => ({}));
    const filterBarId: number | undefined = body?.bar_id;

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let q = supabase.schema('operations').from('bares').select('id, nome').eq('ativo', true);
    if (filterBarId) q = q.eq('id', filterBarId);
    const { data: bares } = await q;

    const hoje = new Date();
    const inicio = new Date(hoje.getTime() + 86400000); // amanhã
    const fim = new Date(hoje.getTime() + (HORIZON_DAYS + 1) * 86400000);

    const resultados: any[] = [];

    for (const bar of (bares ?? [])) {
      // 1) Previsão de demanda já existente
      const { data: previsoes } = await supabase
        .schema('gold').from('demanda_previsoes')
        .select('data_evento, fat_previsto')
        .eq('bar_id', bar.id)
        .gte('data_evento', inicio.toISOString().split('T')[0])
        .lte('data_evento', fim.toISOString().split('T')[0]);
      const previMap = new Map<string, number>(
        (previsoes ?? []).map((p: any) => [p.data_evento, Number(p.fat_previsto) || 0])
      );

      // 2) Mediana DOW últimos 90d (fallback)
      const desde90 = new Date(hoje.getTime() - 90 * 86400000).toISOString().split('T')[0];
      const { data: histDiario } = await supabase
        .schema('gold').from('desempenho')
        .select('data_inicio, faturamento_total')
        .eq('bar_id', bar.id).eq('granularidade', 'diaria')
        .gte('data_inicio', desde90)
        .order('data_inicio');
      const porDOW: Record<number, number[]> = {};
      for (const r of (histDiario ?? [])) {
        const dt = new Date(r.data_inicio);
        const dow = dt.getDay();
        porDOW[dow] ??= [];
        porDOW[dow].push(Number(r.faturamento_total) || 0);
      }
      const medianaDOW: Record<number, number> = {};
      for (const [dow, vs] of Object.entries(porDOW)) medianaDOW[+dow] = median(vs);

      // 3) CMV % médio últimas 8 semanas
      const { data: cmvHist } = await supabase
        .schema('gold').from('desempenho')
        .select('cmv_global_real')
        .eq('bar_id', bar.id).eq('granularidade', 'semanal')
        .order('data_fim', { ascending: false }).limit(8);
      const cmvPctsVal = (cmvHist ?? [])
        .map((r: any) => Number(r.cmv_global_real))
        .filter((v: number) => v > 0 && v < 1);
      const cmvPct = cmvPctsVal.length ? cmvPctsVal.reduce((s: number, v: number) => s + v, 0) / cmvPctsVal.length : 0.32;

      // 4) Orcamentação por mês (CMO + Fixos + Outros)
      const meses = new Set<string>();
      for (let i = 0; i <= HORIZON_DAYS; i++) {
        const d = new Date(hoje.getTime() + i * 86400000);
        meses.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
      }
      const orcamPorMes: Record<string, { cmo: number; fixos: number; outros: number; dias: number }> = {};
      for (const mk of meses) {
        const [ano, mes] = mk.split('-').map(Number);
        const dias = diasNoMes(ano, mes);
        const { data: orc } = await supabase.schema('financial').from('orcamentacao')
          .select('categoria_nome, valor_planejado, valor_projetado, tipo')
          .eq('bar_id', bar.id).eq('ano', ano).eq('mes', mes);

        let cmo = 0, fixos = 0, outros = 0;
        for (const o of (orc ?? [])) {
          const valor = Number(o.valor_planejado ?? o.valor_projetado) || 0;
          const cat = (o.categoria_nome || '').toLowerCase();
          if (cat.includes('mao') || cat.includes('mão') || cat.includes('cmo') || cat.includes('pessoal')) cmo += valor;
          else if (cat.includes('aluguel') || cat.includes('agua') || cat.includes('luz') || cat.includes('internet') || cat.includes('fixo')) fixos += valor;
          else if (o.tipo && o.tipo.toLowerCase() !== 'receita') outros += valor;
        }
        orcamPorMes[mk] = { cmo, fixos, outros, dias };
      }

      // 5) Gera projecao por dia x cenario
      const linhas: any[] = [];
      let receitaUsadaSomaPrev = 0, receitaUsadaSomaMediana = 0;

      for (let i = 1; i <= HORIZON_DAYS; i++) {
        const d = new Date(hoje.getTime() + i * 86400000);
        const dateStr = d.toISOString().split('T')[0];
        const dow = d.getDay();
        const mk = `${d.getFullYear()}-${d.getMonth() + 1}`;
        const orc = orcamPorMes[mk] || { cmo: 0, fixos: 0, outros: 0, dias: 30 };

        const receitaBase = previMap.get(dateStr) ?? medianaDOW[dow] ?? 0;
        if (previMap.has(dateStr)) receitaUsadaSomaPrev += receitaBase;
        else receitaUsadaSomaMediana += receitaBase;

        const cmoDiario = orc.cmo / orc.dias;
        const fixosDiario = orc.fixos / orc.dias;
        const outrosDiario = orc.outros / orc.dias;

        for (const [nome, m] of Object.entries(CENARIOS)) {
          const receita = receitaBase * m.receita;
          const cmv = receita * cmvPct * m.custo;
          const cmo = cmoDiario * m.custo;
          const fixos = fixosDiario * m.custo;
          const outros = outrosDiario * m.custo;
          linhas.push({
            bar_id: bar.id, data_referencia: dateStr, cenario: nome,
            receita_prevista: Number(receita.toFixed(2)),
            cmv_previsto: Number(cmv.toFixed(2)),
            cmo_previsto: Number(cmo.toFixed(2)),
            fixos_previstos: Number(fixos.toFixed(2)),
            outros_previstos: Number(outros.toFixed(2)),
            metodologia: {
              fonte_receita: previMap.has(dateStr) ? 'demanda_previsoes' : 'mediana_dow',
              cmv_pct: cmvPct,
              cenario_mults: m,
            },
          });
        }
      }

      // Limpa projeções antigas pra esse bar e periodo
      await supabase.schema('financial').from('fluxo_caixa_previsto')
        .delete()
        .eq('bar_id', bar.id)
        .gte('data_referencia', inicio.toISOString().split('T')[0])
        .lte('data_referencia', fim.toISOString().split('T')[0]);

      // Insere em batches
      const BATCH = 200;
      for (let i = 0; i < linhas.length; i += BATCH) {
        const slice = linhas.slice(i, i + BATCH);
        const { error } = await supabase.schema('financial').from('fluxo_caixa_previsto').insert(slice);
        if (error) throw new Error(`insert batch ${i}: ${error.message}`);
      }

      resultados.push({
        bar_id: bar.id, nome: bar.nome,
        dias: HORIZON_DAYS, cenarios: Object.keys(CENARIOS).length,
        cmv_pct_medio: Number((cmvPct * 100).toFixed(2)),
        receita_total_prevista: Number((receitaUsadaSomaPrev + receitaUsadaSomaMediana).toFixed(2)),
        cobertura_previsoes_dias: previMap.size,
      });
    }

    return new Response(JSON.stringify({ success: true, horizon_dias: HORIZON_DAYS, resultados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, erro: e?.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
