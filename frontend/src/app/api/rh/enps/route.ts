import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** POST (PÚBLICO/anônimo) -> registra um pulso de eNPS. Body: { bar_id, nota(0-10), comentario? } */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const barId = Number(body.bar_id);
  const nota = Number(body.nota);
  if (!barId) return NextResponse.json({ success: false, error: 'bar inválido' }, { status: 400 });
  if (!(nota >= 0 && nota <= 10)) return NextResponse.json({ success: false, error: 'nota deve ser de 0 a 10' }, { status: 400 });

  const supabase = await getAdminClient();
  const { error } = await (supabase as any).schema('hr').from('enps_respostas')
    .insert({ bar_id: barId, nota, comentario: (body.comentario || '').toString().slice(0, 500) || null });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** GET (autenticado) -> resultado do eNPS (últimos 90 dias). */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const desde = new Date(); desde.setDate(desde.getDate() - 90);
  const supabase = await getAdminClient();
  const { data, error } = await (supabase as any).schema('hr').from('enps_respostas')
    .select('nota, comentario, criado_em').eq('bar_id', user.bar_id)
    .gte('criado_em', desde.toISOString()).order('criado_em', { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const rows = data || [];
  const n = rows.length;
  const prom = rows.filter((r: any) => r.nota >= 9).length;
  const detr = rows.filter((r: any) => r.nota <= 6).length;
  const neutros = n - prom - detr;
  const enps = n > 0 ? Math.round(((prom - detr) / n) * 100) : null;
  const comentarios = rows.filter((r: any) => r.comentario).slice(0, 15).map((r: any) => ({ nota: r.nota, comentario: r.comentario, data: r.criado_em }));

  return NextResponse.json({ success: true, total: n, promotores: prom, neutros, detratores: detr, enps, comentarios });
}
