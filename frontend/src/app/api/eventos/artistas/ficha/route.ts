import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();
const CAMPOS = 'id, nome, tipo, tipo_acordo, cachet_combinado, percentual_sociedade, duracao_combinada_min, horario_padrao, contato, anotacoes';

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}
function parseDur(v: any): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Math.round(v) || null;
  const s = String(v).trim().toLowerCase();
  let m = /^(\d+)\s*h\s*(\d+)?$/.exec(s); if (m) return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
  m = /^(\d+):(\d+)$/.exec(s); if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const n = parseInt(s, 10); return isNaN(n) ? null : n;
}
const parseTime = (v: any) => { const s = String(v ?? '').trim(); return /^\d{1,2}:\d{2}(:\d{2})?$/.test(s) ? s : null; };
const parseNum = (v: any) => { if (v == null || v === '') return null; const n = Number(String(v).replace(',', '.')); return isNaN(n) ? null : n; };

// GET ?artista_id — ficha do artista
export async function GET(request: NextRequest) {
  const barId = getBarId(request);
  const artistaId = Number(new URL(request.url).searchParams.get('artista_id')) || null;
  if (!barId || !artistaId) return NextResponse.json({ success: false, error: 'bar_id e artista_id obrigatórios' }, { status: 400 });
  const { data, error } = await (supabase as any).schema('operations')
    .from('bar_artistas').select(CAMPOS).eq('bar_id', barId).eq('id', artistaId).maybeSingle();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, ficha: data || null });
}

// PUT — atualiza a ficha. body: { artista_id, tipo_acordo?, cachet_combinado?, percentual_sociedade?,
//        duracao_combinada_min?, horario_padrao?, contato?, anotacoes? }
export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  const barId = getBarId(request);
  const body = await request.json().catch(() => ({}));
  const artistaId = Number(body.artista_id) || null;
  if (!barId || !artistaId) return NextResponse.json({ success: false, error: 'bar_id e artista_id obrigatórios' }, { status: 400 });

  const patch: any = {};
  if ('tipo_acordo' in body) patch.tipo_acordo = String(body.tipo_acordo || '').trim() || null;
  if ('cachet_combinado' in body) patch.cachet_combinado = parseNum(body.cachet_combinado);
  if ('percentual_sociedade' in body) patch.percentual_sociedade = parseNum(body.percentual_sociedade);
  if ('duracao_combinada_min' in body) patch.duracao_combinada_min = parseDur(body.duracao_combinada_min);
  if ('horario_padrao' in body) patch.horario_padrao = parseTime(body.horario_padrao);
  if ('contato' in body) patch.contato = String(body.contato || '').trim() || null;
  if ('anotacoes' in body) patch.anotacoes = String(body.anotacoes || '') || null;
  if (!Object.keys(patch).length) return NextResponse.json({ success: false, error: 'nada pra atualizar' }, { status: 400 });

  const { error } = await (supabase as any).schema('operations')
    .from('bar_artistas').update(patch).eq('bar_id', barId).eq('id', artistaId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
