import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { paginate } from '@/lib/supabase/paginate';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const supabase = createServiceRoleClient();

// Segmentos válidos da matview crm.cliente_rfm.
const SEGMENTOS_VALIDOS = ['Campeões', 'Leais', 'Em risco', 'Promissores', 'Novos', 'Hibernando', 'Perdidos'];

interface RfmRow {
  cliente_nome: string | null;
  cliente_fone_norm: string;
  segmento: string;
  frequencia: number;
  monetario: number;
  ticket_medio: number;
  recencia_dias: number;
  ultima_visita: string;
}

/**
 * GET /api/analitico/clientes/win-back?bar_id=3[&segmentos=Em risco,Hibernando][&valor_min=0][&recencia_min=0][&recencia_max=][&limit=100]
 * Win-back: clientes em risco/dormentes (RFM) com valor, para campanha de reativação.
 * Fonte: crm.cliente_rfm (matview, refresh diário).
 *
 * Retorna:
 *   resumo:  [{ segmento, clientes, valor_total, recencia_media }] (agregado, todos que passam nos filtros)
 *   clientes: [ até `limit` rows ordenadas por monetario desc ]
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    // bar_id via query (convenção da rota rfm); fallback pro header multi-tenant.
    const barId = Number(sp.get('bar_id') || req.headers.get('x-selected-bar-id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatório' }, { status: 400 });

    const segmentos = (sp.get('segmentos') || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => SEGMENTOS_VALIDOS.includes(s));
    const valorMin = Number(sp.get('valor_min')) || 0;
    const recenciaMin = Number(sp.get('recencia_min')) || 0;
    const recenciaMaxRaw = sp.get('recencia_max');
    const recenciaMax = recenciaMaxRaw != null && recenciaMaxRaw !== '' ? Number(recenciaMaxRaw) : null;
    const limit = Math.min(Number(sp.get('limit')) || 100, 500);

    // Filtro base reutilizado no resumo e na lista.
    const baseFilter = (q: any) => {
      let out = q
        .eq('bar_id', barId)
        .gte('monetario', valorMin)
        .gte('recencia_dias', recenciaMin)
        .not('cliente_fone_norm', 'is', null);
      if (segmentos.length) out = out.in('segmento', segmentos);
      if (recenciaMax != null) out = out.lte('recencia_dias', recenciaMax);
      return out;
    };

    // Todas as linhas que passam nos filtros (paginado) — base do resumo agregado.
    const todos = await paginate<RfmRow>(
      () =>
        baseFilter(
          (supabase as any)
            .schema('crm')
            .from('cliente_rfm')
            .select('cliente_nome, cliente_fone_norm, segmento, frequencia, monetario, ticket_medio, recencia_dias, ultima_visita'),
        ).order('monetario', { ascending: false }),
      { label: 'crm.cliente_rfm (win-back)' },
    );

    // Resumo por segmento
    const acc: Record<string, { clientes: number; valor_total: number; recencia_soma: number }> = {};
    for (const r of todos) {
      const seg = r.segmento || 'Sem segmento';
      if (!acc[seg]) acc[seg] = { clientes: 0, valor_total: 0, recencia_soma: 0 };
      acc[seg].clientes += 1;
      acc[seg].valor_total += Number(r.monetario || 0);
      acc[seg].recencia_soma += Number(r.recencia_dias || 0);
    }
    const resumo = Object.entries(acc)
      .map(([segmento, v]) => ({
        segmento,
        clientes: v.clientes,
        valor_total: v.valor_total,
        recencia_media: v.clientes ? Math.round(v.recencia_soma / v.clientes) : 0,
      }))
      .sort((a, b) => b.valor_total - a.valor_total);

    // Lista de preview: top `limit` por valor (já ordenado desc).
    const clientes = todos.slice(0, limit);

    return NextResponse.json({
      success: true,
      resumo,
      clientes,
      total: todos.length,
    });
  } catch (e: any) {
    console.error('[analitico/clientes/win-back] erro:', e);
    return NextResponse.json({ error: e?.message || 'Erro interno' }, { status: 500 });
  }
}
