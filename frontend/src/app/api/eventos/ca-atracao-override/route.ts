import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const h = request.headers.get('x-selected-bar-id');
  const q = new URL(request.url).searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

// recalcula o c_art do artista no evento = soma dos overrides do CA apontados pra ele
async function recomputarCArt(ops: any, barId: number, eventoId: number, artistaId: number) {
  const { data: ovs } = await ops
    .from('ca_atracao_override')
    .select('valor')
    .eq('bar_id', barId)
    .eq('evento_id', eventoId)
    .eq('artista_id', artistaId);
  const rows = ovs || [];
  const soma = rows.reduce((s: number, o: any) => s + (Number(o.valor) || 0), 0);
  // sem override sobrando -> volta pra null (retoma o cálculo automático / fallback do evento)
  await ops
    .from('evento_artistas')
    .update({ c_art: rows.length ? soma : null, updated_at: new Date().toISOString() })
    .eq('bar_id', barId)
    .eq('evento_id', eventoId)
    .eq('artista_id', artistaId);
}

// POST — "corrigir dia": aponta um lançamento de atração do CA (contaazul_id) pro
// evento/artista certo, taggeia o artista se preciso e grava o cachê (evento_artistas.c_art).
// body: { contaazul_id, evento_id, data_evento, artista_id?, artista_nome?, valor, pessoa_nome?, descricao?, data_competencia? }
export async function POST(request: NextRequest) {
  const barId = getBarId(request);
  const body = await request.json().catch(() => ({}));
  const contaazulId = String(body.contaazul_id || '').trim();
  const eventoId = Number(body.evento_id) || null;
  const dataEvento = String(body.data_evento || '').slice(0, 10);
  let artistaId = Number(body.artista_id) || null;
  const artistaNome = String(body.artista_nome || '').trim();
  const valor = Number(body.valor) || 0;

  if (!barId || !contaazulId || !eventoId || !dataEvento || (!artistaId && !artistaNome)) {
    return NextResponse.json(
      { success: false, error: 'bar_id, contaazul_id, evento_id, data_evento e artista são obrigatórios' },
      { status: 400 },
    );
  }

  const ops = (supabase as any).schema('operations');

  // resolve o artista no cadastro (cria se veio nome livre)
  let nomeCanon = artistaNome;
  if (artistaId) {
    const { data: a } = await ops.from('bar_artistas').select('nome').eq('id', artistaId).maybeSingle();
    if (a?.nome) nomeCanon = a.nome;
  } else {
    const { data: ja } = await ops.from('bar_artistas').select('id, nome').eq('bar_id', barId).eq('nome', artistaNome).maybeSingle();
    if (ja) { artistaId = ja.id; nomeCanon = ja.nome; }
    else {
      const tipo = /\bdj\b/i.test(artistaNome) ? 'dj' : 'banda';
      const { data: novo } = await ops.from('bar_artistas').insert({ bar_id: barId, nome: artistaNome, tipo }).select('id, nome').single();
      artistaId = novo?.id ?? null;
      nomeCanon = novo?.nome ?? artistaNome;
    }
  }
  if (!artistaId) return NextResponse.json({ success: false, error: 'não foi possível resolver o artista' }, { status: 500 });

  // garante o artista taggeado no evento alvo
  const { data: jaTag } = await ops
    .from('evento_artistas')
    .select('id')
    .eq('evento_id', eventoId)
    .eq('artista_id', artistaId)
    .maybeSingle();
  if (!jaTag) {
    const { data: mx } = await ops
      .from('evento_artistas')
      .select('ordem')
      .eq('evento_id', eventoId)
      .order('ordem', { ascending: false })
      .limit(1)
      .maybeSingle();
    const ordem = (mx?.ordem || 0) + 1;
    await ops.from('evento_artistas').insert({
      evento_id: eventoId, bar_id: barId, artista_id: artistaId, artista_nome: nomeCanon, ordem,
    });
  }

  // upsert do override (chave = bar + contaazul_id)
  await ops.from('ca_atracao_override').delete().eq('bar_id', barId).eq('contaazul_id', contaazulId);
  const { error: insErr } = await ops.from('ca_atracao_override').insert({
    bar_id: barId,
    contaazul_id: contaazulId,
    evento_id: eventoId,
    data_evento: dataEvento,
    artista_id: artistaId,
    valor,
    pessoa_nome: body.pessoa_nome ? String(body.pessoa_nome) : null,
    descricao: body.descricao ? String(body.descricao) : null,
    data_competencia: body.data_competencia ? String(body.data_competencia).slice(0, 10) : null,
  });
  if (insErr) return NextResponse.json({ success: false, error: insErr.message }, { status: 500 });

  await recomputarCArt(ops, barId, eventoId, artistaId);
  return NextResponse.json({ success: true, artista_id: artistaId, artista_nome: nomeCanon });
}

// DELETE ?contaazul_id= — desfaz a correção e recalcula o cachê
export async function DELETE(request: NextRequest) {
  const barId = getBarId(request);
  const contaazulId = String(new URL(request.url).searchParams.get('contaazul_id') || '').trim();
  if (!barId || !contaazulId) {
    return NextResponse.json({ success: false, error: 'bar_id e contaazul_id obrigatórios' }, { status: 400 });
  }
  const ops = (supabase as any).schema('operations');
  const { data: ov } = await ops
    .from('ca_atracao_override')
    .select('evento_id, artista_id')
    .eq('bar_id', barId)
    .eq('contaazul_id', contaazulId)
    .maybeSingle();
  await ops.from('ca_atracao_override').delete().eq('bar_id', barId).eq('contaazul_id', contaazulId);
  if (ov) await recomputarCArt(ops, barId, ov.evento_id, ov.artista_id);
  return NextResponse.json({ success: true });
}
