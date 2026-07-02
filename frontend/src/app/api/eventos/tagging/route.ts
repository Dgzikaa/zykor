import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
const supabase = createServiceRoleClient();

function getBarId(request: NextRequest): number | null {
  const { searchParams } = new URL(request.url);
  const h = request.headers.get('x-selected-bar-id');
  const q = searchParams.get('bar_id');
  return parseInt(String(h || q || ''), 10) || null;
}

function cleanName(s: string): string {
  return s
    .replace(/^\s*e\s+/i, '')
    .replace(/[.,;]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Parser de artista a partir do texto livre (campo antigo eventos_base.artista
 * ou nome do evento). Quebra combos "X e Dj Y", "A, Dj B, C" em entradas
 * estruturadas {nome, tipo}. É só SUGESTÃO — o usuário confirma na tela.
 */
function parseArtistas(texto: string | null, tipoPorNome: Map<string, string>): Array<{ nome: string; tipo: string }> {
  if (!texto) return [];
  let t = String(texto).trim();
  if (!t) return [];
  // ruído comum
  t = t.replace(/\bcom artista de fora\b/gi, '').replace(/\+/g, ',').replace(/\s{2,}/g, ' ').trim();

  const out: Array<{ nome: string; tipo: string }> = [];
  const push = (raw: string, forcarDj = false) => {
    const nome = cleanName(raw);
    if (!nome) return;
    const lower = nome.toLowerCase();
    const tipo = tipoPorNome.get(lower) || (forcarDj || /\bdj\b/i.test(nome) ? 'dj' : 'banda');
    // se veio como "Dj X", limpa o prefixo
    const nomeLimpo = forcarDj ? nome.replace(/^dj\s+/i, '').trim() : nome;
    const finalNome = /^dj\s+/i.test(nome) ? nome.replace(/^dj\s+/i, '').trim() : nomeLimpo;
    out.push({ nome: finalNome || nome, tipo });
  };

  for (const chunk of t.split(',').map((s) => s.trim()).filter(Boolean)) {
    // separa "A e Dj B" -> A (banda) | Dj B (dj)
    const partes = chunk.split(/\s+e\s+(?=dj\s)/i);
    for (const p of partes) {
      const seg = p.trim();
      if (!seg) continue;
      const djMatch = /^dj\s+(.+)/i.exec(seg);
      if (djMatch) {
        push(djMatch[1], true);
      } else {
        // "A e B" (duas atrações) — divide só se não for parte de nome próprio óbvio
        const dois = seg.split(/\s+e\s+/i).map((s) => s.trim()).filter(Boolean);
        for (const nome of dois) push(nome);
      }
    }
  }

  // dedupe por nome
  const seen = new Set<string>();
  return out.filter((a) => {
    const k = a.nome.toLowerCase();
    if (!a.nome || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function GET(request: NextRequest) {
  try {
    const barId = getBarId(request);
    if (!barId) return NextResponse.json({ success: false, error: 'bar_id é obrigatório' }, { status: 400 });
    const { searchParams } = new URL(request.url);
    const mesParam = searchParams.get('mes'); // YYYY-MM

    // meses disponíveis (a partir das datas de evento do bar)
    const { data: datas } = await supabase
      .from('eventos_base')
      .select('data_evento')
      .eq('bar_id', barId)
      .order('data_evento', { ascending: false })
      .limit(2000);
    const mesesSet = new Set<string>();
    for (const d of datas || []) {
      const s = String((d as any).data_evento).slice(0, 7);
      if (s) mesesSet.add(s);
    }
    const meses = Array.from(mesesSet).sort().reverse();
    const mes = mesParam && mesesSet.has(mesParam) ? mesParam : meses[0];
    if (!mes) return NextResponse.json({ success: true, meses: [], mes: null, eventos: [], cadastro: [] });

    const inicio = `${mes}-01`;
    const [ano, mm] = mes.split('-').map((x) => parseInt(x, 10));
    const fim = new Date(ano, mm, 0).toISOString().split('T')[0]; // último dia do mês

    // cadastro do bar (para tipo/autocomplete)
    const ops = (supabase as any).schema('operations');
    const { data: cadastro } = await ops
      .from('bar_artistas')
      .select('id, nome, tipo')
      .eq('bar_id', barId)
      .eq('ativo', true)
      .order('nome', { ascending: true });
    const tipoPorNome = new Map<string, string>((cadastro || []).map((a: any) => [String(a.nome).toLowerCase(), a.tipo]));
    const tipoPorId = new Map<number, string>((cadastro || []).map((a: any) => [a.id, a.tipo]));

    // eventos do mês
    const { data: eventosRaw, error: evErr } = await supabase
      .from('eventos_base')
      .select('id, data_evento, dia_semana, nome, real_r, cl_real, artista')
      .eq('bar_id', barId)
      .gte('data_evento', inicio)
      .lte('data_evento', fim)
      .order('data_evento', { ascending: false });
    if (evErr) throw evErr;

    const eventoIds = (eventosRaw || []).map((e: any) => e.id);

    // tags atuais
    const { data: linksRaw } = await ops
      .from('evento_artistas')
      .select('evento_id, artista_id, artista_nome, ordem')
      .in('evento_id', eventoIds.length ? eventoIds : [-1])
      .order('ordem', { ascending: true });
    const tagsPorEvento = new Map<number, any[]>();
    for (const l of linksRaw || []) {
      const arr = tagsPorEvento.get(l.evento_id) || [];
      arr.push({
        artista_id: l.artista_id,
        artista_nome: l.artista_nome,
        tipo: (l.artista_id && tipoPorId.get(l.artista_id)) || tipoPorNome.get(String(l.artista_nome).toLowerCase()) || 'banda',
      });
      tagsPorEvento.set(l.evento_id, arr);
    }

    const eventos = (eventosRaw || []).map((e: any) => {
      const artistasAtuais = tagsPorEvento.get(e.id) || [];
      // sugestão só quando ainda não há tags; prioriza o campo antigo, senão o nome do evento
      let sugestao: Array<{ nome: string; tipo: string }> = [];
      if (artistasAtuais.length === 0) {
        const doCampo = parseArtistas(e.artista, tipoPorNome);
        if (doCampo.length) sugestao = doCampo;
        else {
          const nome = String(e.nome || '');
          const aposHifen = nome.includes(' - ') ? nome.split(' - ').slice(1).join(' - ') : '';
          sugestao = parseArtistas(aposHifen, tipoPorNome);
        }
      }
      return {
        id: e.id,
        data_evento: e.data_evento,
        dia_semana: e.dia_semana || '',
        nome: e.nome || '',
        faturamento: parseFloat(e.real_r) || 0,
        publico: e.cl_real || 0,
        artista_texto: e.artista || '',
        artistas: artistasAtuais,
        sugestao,
      };
    });

    return NextResponse.json({ success: true, meses, mes, eventos, cadastro: cadastro || [] });
  } catch (error: any) {
    console.error('Erro no tagging de eventos:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro' }, { status: 500 });
  }
}
