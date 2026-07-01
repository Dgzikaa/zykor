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
 * Usa get_consumos_9_detalhes_custo_semana (categoria=null → todas): cada lançamento com o
 * CUSTO REAL — se o produto tem ficha técnica, custo = custo_ficha proporcional ao desconto;
 * senão, desconto × fator (0,35). Paginado via p_limit/p_offset (imune ao cap de 1000 do PostgREST).
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

    // Paginação em SQL via p_limit/p_offset (cada página ≤1000 → nunca bate no cap do PostgREST).
    // A função já ordena de forma determinística, então o offset é estável.
    const PAGE = 1000;
    const rows: any[] = [];
    for (let off = 0; ; off += PAGE) {
      const { data, error } = await (supabase as any).rpc('get_consumos_9_detalhes_custo_semana', {
        input_bar_id: barId,
        input_data_inicio: dataInicio,
        input_data_fim: dataFim,
        input_categoria: null,
        p_fator: fator,
        p_limit: PAGE,
        p_offset: off,
      });
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }
      const chunk = (data as any[]) || [];
      rows.push(...chunk);
      if (chunk.length < PAGE) break;
      if (off >= 200000) break; // trava de segurança
    }

    const linhas = rows.map((r) => ({
      categoria: String(r.categoria),
      data: r.data,
      mesa: r.mesa || null,
      motivo: r.motivo || null,
      produto: r.prd_desc || null,
      qtd: Number(r.qtd) || 0,
      valor_bruto: Number(r.valor_desconto) || 0,
      custo: Number(r.custo_real) || 0, // custo real (ficha) ou desconto×fator quando sem ficha
      tem_ficha: !!r.tem_ficha,
    }));

    // resumo por categoria (bruto, custo, linhas, com_ficha)
    const map = new Map<string, { categoria: string; linhas: number; com_ficha: number; bruto: number; custo: number }>();
    for (const l of linhas) {
      const a = map.get(l.categoria) || { categoria: l.categoria, linhas: 0, com_ficha: 0, bruto: 0, custo: 0 };
      a.linhas += 1;
      if (l.tem_ficha) a.com_ficha += 1;
      a.bruto += l.valor_bruto;
      a.custo += l.custo;
      map.set(l.categoria, a);
    }
    const resumo = Array.from(map.values())
      .map((r) => ({ ...r, bruto: Math.round(r.bruto * 100) / 100, custo: Math.round(r.custo * 100) / 100 }))
      .sort((a, b) => b.bruto - a.bruto);

    return NextResponse.json({
      success: true,
      fator,
      data_inicio: dataInicio,
      data_fim: dataFim,
      total_bruto: Math.round(linhas.reduce((s, l) => s + l.valor_bruto, 0) * 100) / 100,
      total_custo: Math.round(linhas.reduce((s, l) => s + l.custo, 0) * 100) / 100,
      com_ficha: linhas.filter((l) => l.tem_ficha).length,
      resumo,
      linhas,
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro interno' }, { status: 500 });
  }
}
