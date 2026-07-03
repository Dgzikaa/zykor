import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function sb() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET /api/campanhas-clube?bar_id=3 — lista campanhas + execucoes recentes */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const barId = searchParams.get('bar_id');

    const s = sb();
    let qc = s.schema('crm').from('campanhas').select('*').order('id');
    if (barId) qc = qc.eq('bar_id', parseInt(barId, 10));
    const { data: campanhas } = await qc;

    let qe = s.schema('crm').from('campanhas_execucoes')
      .select('*').order('criado_em', { ascending: false }).limit(200);
    if (barId) qe = qe.eq('bar_id', parseInt(barId, 10));
    const { data: execucoes } = await qe;

    return NextResponse.json({ campanhas: campanhas ?? [], execucoes: execucoes ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

/** POST { acao: 'executar', campanha_id? } — dispara edge fn */
export async function POST(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, req); if (nega) return nega;
  try {
    const body = await req.json();
    if (body?.acao === 'executar') {
      const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/executar-campanhas-clube`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ campanha_id: body?.campanha_id }),
      });
      const j = await r.json();
      return NextResponse.json(j, { status: r.ok ? 200 : 502 });
    }
    return NextResponse.json({ error: 'acao invalida' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

/** PATCH { execucao_id, status, notas? } — equipe marca como concluida/descartada */
export async function PATCH(req: NextRequest) {
  const user = await authenticateUser(req);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, req); if (nega) return nega;
  try {
    const body = await req.json();
    if (!body?.execucao_id || !body?.status) {
      return NextResponse.json({ error: 'execucao_id+status obrigatorios' }, { status: 400 });
    }
    const s = sb();
    const { error } = await s.schema('crm').from('campanhas_execucoes')
      .update({ status: body.status, notas: body.notas ?? null, atualizado_em: new Date().toISOString() })
      .eq('id', body.execucao_id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
