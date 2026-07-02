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

// normaliza p/ casamento: minúsculas, sem acento, sem espaço extra
function norm(s: string): string {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
const STOPWORDS = new Set(['de', 'da', 'do', 'e', 'no', 'na', 'o', 'a', 'os', 'as', 'di', 'du', 'dos', 'das']);
// tokens relevantes do nome do artista (ignora conectores; mantém números)
function tokensSignificativos(nome: string): string[] {
  return norm(nome).split(/\s+/).filter((t) => t && !STOPWORDS.has(t) && (t.length >= 2 || /\d/.test(t)));
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
    // "hoje" no fuso de Brasília (UTC-3) — só taggeamos o passado (evento < hoje)
    const hojeBR = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // meses disponíveis (só passados)
    const { data: datas } = await supabase
      .from('eventos_base')
      .select('data_evento')
      .eq('bar_id', barId)
      .lt('data_evento', hojeBR)
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

    // eventos do mês (só passados: >= início do mês, <= fim do mês, e < hoje)
    const { data: eventosRaw, error: evErr } = await supabase
      .from('eventos_base')
      .select('id, data_evento, dia_semana, nome, real_r, cl_real, artista')
      .eq('bar_id', barId)
      .gte('data_evento', inicio)
      .lte('data_evento', fim)
      .lt('data_evento', hojeBR)
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

    // overrides "corrigir dia": remaneja um lançamento do CA (contaazul_id) pro evento certo,
    // resolvendo o descasamento data-de-pagamento (competência) x dia-do-show.
    const { data: overridesRaw } = await ops
      .from('ca_atracao_override')
      .select('contaazul_id, data_evento, artista_id, data_competencia')
      .eq('bar_id', barId);
    const overrideByCid = new Map<string, { data_evento: string; artista_id: number }>();
    for (const o of overridesRaw || []) {
      overrideByCid.set(String(o.contaazul_id), { data_evento: String(o.data_evento).slice(0, 10), artista_id: o.artista_id });
    }
    // janela do RPC: além do mês, inclui a competência de pagamentos cujo show (alvo) cai no mês
    let rpcIni = inicio, rpcFim = fim;
    for (const o of overridesRaw || []) {
      const alvo = String(o.data_evento).slice(0, 10);
      const comp = o.data_competencia ? String(o.data_competencia).slice(0, 10) : null;
      if (comp && alvo >= inicio && alvo <= fim) {
        if (comp < rpcIni) rpcIni = comp;
        if (comp > rpcFim) rpcFim = comp;
      }
    }

    // custo de atração do Conta Azul (cachê). Bucketiza pelo dia efetivo do show:
    // override quando existe, senão a competência do pagamento.
    const { data: caRaw } = await ops.rpc('fn_ca_atracao_lancamentos', {
      p_bar_id: barId,
      p_ini: rpcIni,
      p_fim: rpcFim,
    });
    type CaLinha = { contaazul_id: string; pessoa: string; desc: string; valor: number; data_competencia: string; forcedArtista: number | null };
    const caPorData = new Map<string, CaLinha[]>();
    for (const l of caRaw || []) {
      const cid = String(l.contaazul_id);
      const comp = String(l.data_competencia).slice(0, 10);
      const ov = overrideByCid.get(cid);
      const dia = ov ? ov.data_evento : comp;
      const arr = caPorData.get(dia) || [];
      arr.push({
        contaazul_id: cid,
        pessoa: l.pessoa_nome || '',
        desc: l.descricao || '',
        valor: Number(l.valor) || 0,
        data_competencia: comp,
        forcedArtista: ov ? ov.artista_id : null,
      });
      caPorData.set(dia, arr);
    }

    // de-para favorecido do CA -> artista (manual, persistente)
    const { data: deparaRaw } = await ops
      .from('artista_ca_pessoa')
      .select('ca_pessoa_nome, artista_id')
      .eq('bar_id', barId);
    const deparaByPessoa = new Map<string, number>((deparaRaw || []).map((d: any) => [norm(d.ca_pessoa_nome), d.artista_id]));

    const eventos = (eventosRaw || []).map((e: any) => {
      const faturamento = parseFloat(e.real_r) || 0;
      const artistasAtuais: any[] = (tagsPorEvento.get(e.id) || []).map((a: any) => ({ ...a, cachet: 0, principal: false }));

      // casa os lançamentos do CA do dia com os artistas taggeados:
      // 1) de-para favorecido->artista (manual); 2) match por tokens (acento-insensível)
      const caDia = caPorData.get(String(e.data_evento).slice(0, 10)) || [];
      const custo_atracao_total = caDia.reduce((s, l) => s + l.valor, 0);
      let ca_maior: { nome: string; valor: number } | null = null;
      const ca_lancamentos = caDia.map((l) => {
        if (!ca_maior || l.valor > ca_maior.valor) {
          const m = /banda\s+(.+)$/i.exec(l.desc);
          ca_maior = { nome: (m ? m[1] : l.pessoa || l.desc).trim(), valor: l.valor };
        }
        let matched: any = null;
        // 1) correção manual "corrigir dia" (override força o artista)
        if (l.forcedArtista != null) matched = artistasAtuais.find((a) => a.artista_id === l.forcedArtista) || null;
        // 2) de-para favorecido -> artista
        if (!matched) {
          const viaDepara = deparaByPessoa.get(norm(l.pessoa));
          if (viaDepara != null) matched = artistasAtuais.find((a) => a.artista_id === viaDepara) || null;
        }
        // 3) match por tokens (acento-insensível)
        if (!matched) {
          const hay = norm(`${l.desc} ${l.pessoa}`);
          let bestLen = 0;
          for (const a of artistasAtuais) {
            const toks = tokensSignificativos(a.artista_nome);
            if (toks.length && toks.every((t) => hay.includes(t))) {
              const len = norm(a.artista_nome).length;
              if (len > bestLen) { matched = a; bestLen = len; }
            }
          }
        }
        if (matched) matched.cachet += l.valor;
        return {
          contaazul_id: l.contaazul_id,
          pessoa: l.pessoa,
          descricao: l.desc,
          valor: l.valor,
          data_competencia: l.data_competencia,
          artista_id: matched?.artista_id ?? null,
          artista_nome: matched?.artista_nome ?? null,
        };
      });

      // principal = artista taggeado com maior cachê
      let principal: any = null;
      for (const a of artistasAtuais) if (a.cachet > 0 && (!principal || a.cachet > principal.cachet)) principal = a;
      if (principal) principal.principal = true;
      const principal_cachet = principal?.cachet ?? null;
      const pct_principal = principal_cachet != null && faturamento > 0 ? principal_cachet / faturamento : null;
      const retorno = principal_cachet != null && principal_cachet > 0 ? faturamento / principal_cachet : null;

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
        faturamento,
        publico: e.cl_real || 0,
        ticket: (e.cl_real || 0) > 0 ? faturamento / e.cl_real : null,
        artista_texto: e.artista || '',
        artistas: artistasAtuais,
        sugestao,
        // custo de atração (Conta Azul)
        custo_atracao_total,
        principal_nome: principal?.artista_nome ?? null,
        principal_cachet,
        pct_principal,
        retorno,
        ca_maior, // maior cachê do dia no CA (ajuda a validar quando nada casou)
        ca_lancamentos, // todas as linhas de atração do CA no dia (p/ atribuição manual)
      };
    });

    // eventos candidatos p/ "corrigir dia": inclui ~2 meses anteriores, já que o pagamento
    // atrasa em relação ao show (o show alvo pode estar no mês anterior ao do pagamento).
    const corrigirIni = new Date(ano, mm - 3, 1).toISOString().slice(0, 10);
    const { data: evCorrigirRaw } = await supabase
      .from('eventos_base')
      .select('id, data_evento, nome')
      .eq('bar_id', barId)
      .gte('data_evento', corrigirIni)
      .lte('data_evento', fim)
      .lt('data_evento', hojeBR)
      .order('data_evento', { ascending: false });
    const eventosCorrigir = (evCorrigirRaw || []).map((e: any) => ({
      id: e.id, data_evento: e.data_evento, nome: e.nome || '',
    }));

    return NextResponse.json({ success: true, meses, mes, eventos, eventosCorrigir, cadastro: cadastro || [] });
  } catch (error: any) {
    console.error('Erro no tagging de eventos:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Erro' }, { status: 500 });
  }
}
