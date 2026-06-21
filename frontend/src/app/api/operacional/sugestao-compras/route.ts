import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

/**
 * GET /api/operacional/sugestao-compras?area=bar&dias=7
 * Sugestão de compras: estoque atual (última contagem) + consumo/dia (histórico) × dias − estoque.
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const area = sp.get('area') || 'bar';
  const dias = Math.min(Math.max(Number(sp.get('dias')) || 7, 1), 60);

  const { data, error } = await (sb() as any).schema('operations').rpc('sugestao_compras', {
    p_bar_id: user.bar_id, p_tipo_local: area, p_cobertura_dias: dias,
  });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const itens = (data || []).map((r: any) => ({
    nome: r.nome, categoria: r.categoria, fornecedor: r.fornecedor || 'Sem fornecedor',
    embalagem: r.embalagem, unidade: r.unidade, custo: Number(r.custo) || 0,
    estoque_atual: Number(r.estoque_atual) || 0, ultima_contagem: r.ultima_contagem,
    consumo_dia: Number(r.consumo_dia) || 0, necessidade: Number(r.necessidade) || 0,
    sugestao_comprar: Number(r.sugestao_comprar) || 0, valor_estimado: Number(r.valor_estimado) || 0,
  }));
  return NextResponse.json({ success: true, area, dias, itens });
}
