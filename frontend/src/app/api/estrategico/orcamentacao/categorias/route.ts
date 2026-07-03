import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/estrategico/orcamentacao/categorias?bar_id=4&ano=2025
 * Lista as categorias do Conta Azul (por bar/ano) com o mapeamento atual da
 * Orçamentação (bloco, tipo, ignorar). Categorias sem bloco_dre = não mapeadas.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const barId = Number(sp.get('bar_id'));
    if (!barId) return NextResponse.json({ error: 'bar_id obrigatorio' }, { status: 400 });
    const ano = Number(sp.get('ano')) || new Date().getFullYear();

    const supabase = await getAdminClient();
    const { data, error } = await (supabase as any).rpc('get_categorias_orcamentacao', {
      p_bar_id: barId,
      p_ano: ano,
    });
    if (error) throw error;

    return NextResponse.json({ categorias: data ?? [], ano });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

/**
 * POST /api/estrategico/orcamentacao/categorias
 * Body: { bar_id, ano, categoria_ca, categoria_zykor?, bloco_dre?, tipo_zykor?, ignorar? }
 * Faz upsert no de-para e re-processa silver+gold do ano (reflete na hora).
 */
export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, req); if (nega) return nega;
  try {
    const body = await req.json();
    const barId = Number(body?.bar_id);
    const ano = Number(body?.ano) || new Date().getFullYear();
    const categoriaCa = String(body?.categoria_ca || '').trim();
    if (!barId || !categoriaCa) {
      return NextResponse.json({ error: 'bar_id e categoria_ca obrigatorios' }, { status: 400 });
    }

    const supabase = await getAdminClient();
    const { error } = await (supabase as any).rpc('salvar_categoria_orcamentacao', {
      p_bar_id: barId,
      p_ano: ano,
      p_categoria_ca: categoriaCa,
      p_categoria_zykor: body?.categoria_zykor ? String(body.categoria_zykor).trim() : null,
      p_bloco_dre: body?.bloco_dre ? String(body.bloco_dre).trim() : null,
      p_tipo_zykor: body?.tipo_zykor ? String(body.tipo_zykor).trim() : null,
      p_ignorar: Boolean(body?.ignorar),
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
