import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const barId = Number(sp.get('bar_id'));
    const ano = sp.get('ano') ? Number(sp.get('ano')) : undefined;
    const mes = sp.get('mes') ? Number(sp.get('mes')) : undefined;
    const categoria = sp.get('categoria') || undefined;
    const limit = Number(sp.get('limit') || 200);

    if (!barId) {
      return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    // Fonte 1: meta.orcamento_planilha_log (edicoes de planejado/projetado/realizado_manual)
    let planilhaQuery = (supabase.schema('meta' as never) as never as ReturnType<typeof supabase.schema>)
      .from('orcamento_planilha_log')
      .select('*')
      .eq('bar_id', barId)
      .order('alterado_em', { ascending: false })
      .limit(limit);

    if (ano) planilhaQuery = planilhaQuery.eq('ano', ano);
    if (mes) planilhaQuery = planilhaQuery.eq('mes', mes);
    if (categoria) planilhaQuery = planilhaQuery.eq('categoria_nome', categoria);

    // Fonte 2: financial.dre_manual (lancamentos manuais somados ao gold)
    let manualQuery = (supabase.schema('financial' as never) as never as ReturnType<typeof supabase.schema>)
      .from('dre_manual')
      .select('id, data_competencia, descricao, valor, categoria, usuario_criacao, criado_em, atualizado_em')
      .eq('bar_id', barId)
      .order('criado_em', { ascending: false })
      .limit(limit);

    if (categoria) manualQuery = manualQuery.eq('categoria', categoria);

    const [planilhaResult, manualResult] = await Promise.all([planilhaQuery, manualQuery]);

    if (planilhaResult.error) {
      console.error('[orcamentacao/historico] planilha', planilhaResult.error);
      return NextResponse.json({ success: false, error: planilhaResult.error.message }, { status: 500 });
    }
    if (manualResult.error) {
      console.error('[orcamentacao/historico] dre_manual', manualResult.error);
      // dre_manual error nao bloqueia - retorna so a planilha
    }

    // Normalizar entries da planilha (origem='planilha')
    const planilhaEntries = (planilhaResult.data || []).map((row: Record<string, unknown>) => ({
      ...row,
      origem: 'planilha' as const,
    }));

    // Normalizar entries do dre_manual em formato LogEntry (origem='dre_manual')
    const manualEntries = (manualResult.data || []).map((m: Record<string, unknown>) => {
      const dc = String(m.data_competencia);
      const [a, mes] = dc.split('-');
      return {
        id: -Number(m.id), // negativo pra nao colidir com planilha_log
        bar_id: barId,
        ano: Number(a),
        mes: Number(mes),
        categoria_nome: String(m.categoria || ''),
        acao: 'insert' as const,
        campo: 'dre_manual',
        valor_antes: null,
        valor_depois: Number(m.valor) || 0,
        alterado_por: String(m.usuario_criacao || ''),
        alterado_em: String(m.atualizado_em || m.criado_em),
        descricao: m.descricao ? String(m.descricao) : null,
        data_competencia: dc,
        origem: 'dre_manual' as const,
      };
    }).filter(e => {
      if (ano && e.ano !== ano) return false;
      if (mes && e.mes !== mes) return false;
      return true;
    });

    const merged = [...planilhaEntries, ...manualEntries]
      .sort((x, y) => new Date(y.alterado_em as string).getTime() - new Date(x.alterado_em as string).getTime())
      .slice(0, limit);

    return NextResponse.json({ success: true, data: merged, total: merged.length });
  } catch (err) {
    console.error('[orcamentacao/historico] exceção', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
