import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// =====================================================
// GET /api/home/metas — metas do período vigente do bar, pra home.
//
// Sem guard de módulo de propósito: é a tela inicial, visível a qualquer usuário
// autenticado, igual ao mural. São metas do bar, não dado sensível de custo individual.
// =====================================================
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ meta: null });

  const hoje = new Date().toISOString().slice(0, 10);
  const c = sb();
  const ops = (c as any).schema('operations');

  const { data: meta } = await ops.from('meta_periodo')
    .select('id, periodo_label, titulo, data_inicio, data_fim')
    .eq('bar_id', user.bar_id).eq('ativo', true)
    .lte('data_inicio', hoje).gte('data_fim', hoje)
    .order('data_inicio', { ascending: false })
    .limit(1).maybeSingle();

  if (!meta) return NextResponse.json({ meta: null });

  const { data: itens } = await ops.from('meta_periodo_item')
    .select('label, valor, formato, metrica_chave, observacao')
    .eq('meta_id', meta.id).order('ordem');

  return NextResponse.json({
    meta: {
      ...meta,
      itens: (itens || []).map((i: any) => ({ ...i, valor: Number(i.valor) })),
    },
  });
}
