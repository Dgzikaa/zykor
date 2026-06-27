import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/**
 * GET ?bar_id&codigo=i0XXX → movimento da contagem que gerou o "giro" do insumo.
 * O sinal "vende sem ficha" vem da contagem caindo (consumo), não de uma venda mapeada —
 * aqui mostramos exatamente os dias/quedas + produtos candidatos a ligar a ficha (por nome).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const codigo = String(sp.get('codigo') || '').trim();
  if (!barId || !codigo) return NextResponse.json({ success: false, error: 'bar_id e codigo obrigatórios' }, { status: 400 });
  const supabase = await getAdminClient();
  const dias = Math.max(7, Math.min(120, Number(sp.get('dias')) || 60));
  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

  // contagem do insumo no período (silver guarda o código em maiúsculo)
  const { data: rows, error } = await (supabase as any).schema('silver').from('estoque_contagem')
    .select('data_contagem, estoque_final, unidade_medida')
    .eq('bar_id', barId).eq('insumo_codigo', codigo.toUpperCase())
    .gte('data_contagem', desde).order('data_contagem', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  let prev: number | null = null;
  let consumo_total = 0;
  const movimentos = (rows || []).map((r: any) => {
    const est = Number(r.estoque_final || 0);
    const delta = prev == null ? null : Math.round((est - prev) * 1000) / 1000;
    if (delta != null && delta < 0) consumo_total += -delta;
    prev = est;
    return { data: r.data_contagem, estoque: est, delta, unidade: r.unidade_medida };
  });

  // produtos do cardápio com nome parecido (candidatos a ligar a ficha que está faltando)
  const nomeBusca = (sp.get('nome') || '').trim();
  let candidatos: any[] = [];
  if (nomeBusca) {
    const termo = nomeBusca.split(/\s+/).slice(0, 2).join(' ');
    const { data: prods } = await supabase.from('produto_cardapio')
      .select('codigo, nome, ativo').eq('bar_id', barId).ilike('nome', `%${termo}%`).limit(8);
    candidatos = prods || [];
  }

  return NextResponse.json({
    success: true,
    codigo,
    consumo_total: Math.round(consumo_total * 1000) / 1000,
    movimentos,
    candidatos,
  });
}
