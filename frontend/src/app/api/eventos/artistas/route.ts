import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  return parseInt(String(h || ''), 10) || null;
}

// resolve a linha editável de eventos_base por (bar, data_evento)
async function resolverEventoId(barId: number, dataEvento: string): Promise<number | null> {
  const { data } = await supabase
    .from('eventos_base')
    .select('id')
    .eq('bar_id', barId)
    .eq('data_evento', dataEvento)
    .maybeSingle();
  return data?.id ?? null;
}

// GET ?data_evento= — lista os artistas do evento (operations.evento_artistas)
export async function GET(request: NextRequest) {
  const barId = getBarId(request);
  const dataEvento = new URL(request.url).searchParams.get('data_evento');
  if (!barId || !dataEvento) return NextResponse.json({ success: false, error: 'bar_id e data_evento obrigatórios' }, { status: 400 });

  const eventoId = await resolverEventoId(barId, dataEvento);
  if (!eventoId) return NextResponse.json({ success: true, artistas: [] });

  const { data, error } = await (supabase as any)
    .schema('operations')
    .from('evento_artistas')
    .select('id, artista_id, artista_nome, ordem, horario_inicio, horario_fim, c_art, observacoes')
    .eq('evento_id', eventoId)
    .order('ordem', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, artistas: data || [] });
}

// PUT — substitui o conjunto de artistas do evento (replace-all).
// body: { data_evento, artistas: [{ artista_id?, artista_nome, horario_inicio?, horario_fim?, c_art?, observacoes? }] }
export async function PUT(request: NextRequest) {
  const barId = getBarId(request);
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });

  let body: any = {};
  try {
    const raw = await request.json();
    body = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch { body = {}; }

  const dataEvento = body.data_evento;
  const artistas = Array.isArray(body.artistas) ? body.artistas : [];
  if (!dataEvento) return NextResponse.json({ success: false, error: 'data_evento obrigatório' }, { status: 400 });

  const eventoId = await resolverEventoId(barId, dataEvento);
  if (!eventoId) return NextResponse.json({ success: false, error: 'Evento não encontrado (salve o planejamento primeiro)' }, { status: 404 });

  const ops = (supabase as any).schema('operations');

  // monta as linhas, resolvendo/gravando o artista no cadastro (bar_artistas) quando digitado livre
  const linhas: any[] = [];
  let ordem = 1;
  for (const a of artistas) {
    const nome = String(a.artista_nome || '').trim();
    if (!nome) continue;
    let artistaId: number | null = Number(a.artista_id) || null;
    if (!artistaId) {
      const { data: ja } = await ops.from('bar_artistas').select('id').eq('bar_id', barId).eq('nome', nome).maybeSingle();
      if (ja) artistaId = ja.id;
      else {
        const { data: novo } = await ops.from('bar_artistas').insert({ bar_id: barId, nome, tipo: 'banda' }).select('id').single();
        artistaId = novo?.id ?? null;
      }
    }
    const hi = String(a.horario_inicio || '').trim();
    const hf = String(a.horario_fim || '').trim();
    const custo = a.c_art != null && a.c_art !== '' ? Number(a.c_art) : null;
    linhas.push({
      evento_id: eventoId,
      bar_id: barId,
      artista_id: artistaId,
      artista_nome: nome,
      ordem: ordem++,
      horario_inicio: hi || null,
      horario_fim: hf || null,
      c_art: custo != null && !isNaN(custo) ? custo : null,
      observacoes: a.observacoes ? String(a.observacoes) : null,
    });
  }

  // replace-all: apaga o conjunto atual e regrava
  const { error: delErr } = await ops.from('evento_artistas').delete().eq('evento_id', eventoId);
  if (delErr) return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
  if (linhas.length) {
    const { error: insErr } = await ops.from('evento_artistas').insert(linhas);
    if (insErr) return NextResponse.json({ success: false, error: insErr.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, count: linhas.length });
}
