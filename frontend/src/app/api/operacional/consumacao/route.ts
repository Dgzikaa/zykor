import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { getFatorCmv } from '@/lib/config/getFatorCmv';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createServiceRoleClient();

/**
 * Controle de Consumação — análise linha a linha das consumações (descontos/cortesias),
 * classificadas nas 9 categorias padronizadas + Outros (mesma fonte da Gestão CMV).
 *
 * GET ?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
 * Usa o RPC get_consumos_9_detalhes_semana (categoria=null → todas), que devolve cada
 * lançamento (data, mesa, motivo, produto, qtd, valor bruto). O custo efetivo = bruto × fator.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const dataInicio = sp.get('data_inicio');
  const dataFim = sp.get('data_fim');
  if (!dataInicio || !dataFim) {
    return NextResponse.json({ success: false, error: 'data_inicio e data_fim são obrigatórios' }, { status: 400 });
  }

  const barId = Number(user.bar_id);

  try {
    const fator = await getFatorCmv(supabase, barId);

    // PostgREST corta o .rpc() em 1000 linhas (cap padrão) — paginar com .range() até esgotar.
    // Ordenação determinística (todas as colunas) pra não perder/duplicar linha entre páginas.
    const PAGE = 1000;
    const rows: any[] = [];
    for (let off = 0; ; off += PAGE) {
      const { data, error } = await (supabase as any)
        .rpc('get_consumos_9_detalhes_semana', {
          input_bar_id: barId,
          input_data_inicio: dataInicio,
          input_data_fim: dataFim,
          input_categoria: null,
        })
        .order('valor_desconto', { ascending: false })
        .order('data', { ascending: true })
        .order('mesa', { ascending: true })
        .order('motivo', { ascending: true })
        .order('prd_desc', { ascending: true })
        .order('qtd', { ascending: true })
        .order('categoria', { ascending: true })
        .range(off, off + PAGE - 1);
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      const chunk = (data as any[]) || [];
      rows.push(...chunk);
      if (chunk.length < PAGE) break;
      if (off >= 200000) break; // trava de segurança (não deve chegar perto)
    }

    const linhas = rows.map((r) => {
      const bruto = Number(r.valor_desconto) || 0;
      return {
        categoria: String(r.categoria),
        data: r.data,
        mesa: r.mesa || null,
        motivo: r.motivo || null,
        produto: r.prd_desc || null,
        qtd: Number(r.qtd) || 0,
        valor_bruto: Math.round(bruto * 100) / 100,
        valor_cmv: Math.round(bruto * fator * 100) / 100,
      };
    });

    // resumo por categoria (bruto, cmv, linhas)
    const map = new Map<string, { categoria: string; linhas: number; bruto: number; cmv: number }>();
    for (const l of linhas) {
      const a = map.get(l.categoria) || { categoria: l.categoria, linhas: 0, bruto: 0, cmv: 0 };
      a.linhas += 1;
      a.bruto += l.valor_bruto;
      a.cmv += l.valor_cmv;
      map.set(l.categoria, a);
    }
    const resumo = Array.from(map.values())
      .map((r) => ({ ...r, bruto: Math.round(r.bruto * 100) / 100, cmv: Math.round(r.cmv * 100) / 100 }))
      .sort((a, b) => b.bruto - a.bruto);

    return NextResponse.json({
      success: true,
      fator,
      data_inicio: dataInicio,
      data_fim: dataFim,
      total_bruto: Math.round(linhas.reduce((s, l) => s + l.valor_bruto, 0) * 100) / 100,
      total_cmv: Math.round(linhas.reduce((s, l) => s + l.valor_cmv, 0) * 100) / 100,
      resumo,
      linhas,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro interno' }, { status: 500 });
  }
}
