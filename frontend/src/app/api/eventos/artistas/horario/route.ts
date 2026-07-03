import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

// aceita 90, "90", "1h30", "1:30", "1h" -> minutos
function parseDur(v: any): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return Math.round(v) || null;
  const s = String(v).trim().toLowerCase();
  let m = /^(\d+)\s*h\s*(\d+)?$/.exec(s);
  if (m) return parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
  m = /^(\d+):(\d+)$/.exec(s);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}
// 'HH:MM' | 'HH:MM:SS' | '' -> valor pro tipo time (ou null)
function parseTime(v: any): string | null {
  const s = String(v ?? '').trim();
  return /^\d{1,2}:\d{2}(:\d{2})?$/.test(s) ? s : null;
}

// POST — grava horário início/fim e duração combinada de UM artista no evento.
// body: { evento_id, artista_id, horario_inicio?, horario_fim?, duracao_combinada_min? }
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;

  const barId = getBarId(request);
  const body = await request.json().catch(() => ({}));
  const eventoId = Number(body.evento_id) || null;
  const artistaId = Number(body.artista_id) || null;
  if (!barId || !eventoId || !artistaId) {
    return NextResponse.json({ success: false, error: 'bar_id, evento_id e artista_id obrigatórios' }, { status: 400 });
  }

  const patch: any = {};
  if ('horario_inicio' in body) patch.horario_inicio = parseTime(body.horario_inicio);
  if ('horario_fim' in body) patch.horario_fim = parseTime(body.horario_fim);
  if ('duracao_combinada_min' in body) patch.duracao_combinada_min = parseDur(body.duracao_combinada_min);
  if (!Object.keys(patch).length) return NextResponse.json({ success: false, error: 'nada pra atualizar' }, { status: 400 });

  const { error } = await (supabase as any).schema('operations')
    .from('evento_artistas')
    .update(patch)
    .eq('bar_id', barId)
    .eq('evento_id', eventoId)
    .eq('artista_id', artistaId);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, duracao_combinada_min: patch.duracao_combinada_min });
}
