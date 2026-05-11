import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/**
 * GET /api/ferramentas/insights/cac-roas?bar_id=N&ano=2026
 *
 * CAC (custo de aquisição) e ROAS (retorno sobre marketing) MENSAL.
 *   - clientes_novos: cliente_fone_norm com primeira visita no mês
 *   - fat_novos: soma valor_pagamentos das visitas DOS clientes novos no mês
 *   - mkt: soma gold.desempenho.m_valor_investido das semanas que tocam o mês
 *   - CAC = mkt / clientes_novos
 *   - ROAS = fat_novos / mkt
 *
 * Atribuição: clientes novos do mês são atribuídos ao gasto do mesmo mês
 * (atribuição simples — não considera lag).
 */
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const barId = Number(sp.get('bar_id'));
    const ano = Number(sp.get('ano') ?? new Date().getFullYear());

    if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });

    const dataInicio = `${ano}-01-01`;
    const dataFim = `${ano}-12-31`;

    // 1) Marketing investido (de gold.desempenho semanal) — agrupar por mês
    const { data: desempenho } = await supabase
      .schema('gold' as never)
      .from('desempenho')
      .select('ano, numero_semana, data_inicio, m_valor_investido')
      .eq('bar_id', barId)
      .eq('ano', ano);

    const mktPorMes: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) mktPorMes[m] = 0;
    for (const r of desempenho ?? []) {
      const mes = Number(((r as any).data_inicio || '').split('-')[1]) || 1;
      mktPorMes[mes] += Number((r as any).m_valor_investido) || 0;
    }

    // 2) Buscar TODAS as visitas do ano
    const { data: visitas, error: errV } = await supabase
      .schema('silver' as never)
      .from('cliente_visitas')
      .select('cliente_fone_norm, data_visita, valor_pagamentos')
      .eq('bar_id', barId)
      .gte('data_visita', dataInicio)
      .lte('data_visita', dataFim)
      .not('cliente_fone_norm', 'is', null);

    if (errV) return NextResponse.json({ error: errV.message }, { status: 500 });

    type V = { cliente_fone_norm: string; data_visita: string; valor_pagamentos: number };
    const visitasArr = (visitas ?? []) as V[];

    // 3) Primeira visita HISTÓRICA de cada cliente (precisa olhar antes do ano também)
    const fonesUnicos = Array.from(new Set(visitasArr.map(v => v.cliente_fone_norm).filter(Boolean)));
    const primeiraGlobal = new Map<string, string>();

    if (fonesUnicos.length > 0) {
      const TAM = 1000;
      for (let i = 0; i < fonesUnicos.length; i += TAM) {
        const lote = fonesUnicos.slice(i, i + TAM);
        const { data: antes } = await supabase
          .schema('silver' as never)
          .from('cliente_visitas')
          .select('cliente_fone_norm, data_visita')
          .eq('bar_id', barId)
          .lt('data_visita', dataInicio)
          .in('cliente_fone_norm', lote);
        for (const v of antes ?? []) {
          const f = (v as any).cliente_fone_norm;
          const d = (v as any).data_visita;
          const atual = primeiraGlobal.get(f);
          if (!atual || d < atual) primeiraGlobal.set(f, d);
        }
      }
    }

    // Para clientes sem registro antes do ano, primeira global é a primeira do ano
    for (const v of visitasArr) {
      const f = v.cliente_fone_norm;
      if (!primeiraGlobal.has(f)) {
        const atual = primeiraGlobal.get(f);
        if (!atual || v.data_visita < atual) primeiraGlobal.set(f, v.data_visita);
      }
    }

    // 4) Para cada mês, identificar clientes NOVOS (primeira visita global = mês X do ano)
    const novosPorMes: Record<number, Set<string>> = {};
    const fatNovosPorMes: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) {
      novosPorMes[m] = new Set();
      fatNovosPorMes[m] = 0;
    }

    for (const [fone, primeira] of primeiraGlobal.entries()) {
      const [pAno, pMes] = primeira.split('-').map(Number);
      if (pAno === ano && pMes >= 1 && pMes <= 12) {
        novosPorMes[pMes].add(fone);
      }
    }

    // 5) Faturamento dos clientes novos NO MÊS em que foram conquistados
    for (const v of visitasArr) {
      const f = v.cliente_fone_norm;
      const [vAno, vMes] = v.data_visita.split('-').map(Number);
      if (vAno !== ano) continue;
      if (novosPorMes[vMes]?.has(f)) {
        fatNovosPorMes[vMes] += Number(v.valor_pagamentos) || 0;
      }
    }

    const NOMES_MES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    interface MesItem {
      mes: number; nome: string; mkt_investido: number; clientes_novos: number;
      fat_clientes_novos: number; cac: number; roas: number;
    }
    const meses: MesItem[] = [];
    let mktTotal = 0, novosTotal = 0, fatTotal = 0;

    for (let m = 1; m <= 12; m++) {
      const mkt = mktPorMes[m] || 0;
      const novos = novosPorMes[m].size;
      const fatNovos = fatNovosPorMes[m] || 0;
      meses.push({
        mes: m,
        nome: NOMES_MES[m - 1],
        mkt_investido: mkt,
        clientes_novos: novos,
        fat_clientes_novos: fatNovos,
        cac: novos > 0 ? mkt / novos : 0,
        roas: mkt > 0 ? fatNovos / mkt : 0,
      });
      mktTotal += mkt;
      novosTotal += novos;
      fatTotal += fatNovos;
    }

    return NextResponse.json({
      success: true,
      ano,
      resumo: {
        mkt_total: mktTotal,
        clientes_novos_total: novosTotal,
        fat_clientes_novos_total: fatTotal,
        cac_medio: novosTotal > 0 ? mktTotal / novosTotal : 0,
        roas_medio: mktTotal > 0 ? fatTotal / mktTotal : 0,
      },
      meses,
    });
  } catch (err: any) {
    console.error('[cac-roas] exceção', err);
    return NextResponse.json({ error: err?.message || 'Erro' }, { status: 500 });
  }
}
