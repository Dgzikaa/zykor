import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import {
  DIMENSOES, TIPOS_PESQUISA, aplicarNomeDoBar, scoreDimensao, segundaDaSemana, sortearRodada,
} from '@/lib/rh/pesquisa-felicidade';

export const dynamic = 'force-dynamic';

/**
 * Rodadas das pesquisas de RH — o lado de quem organiza.
 *
 * GET  ?tipo=  lista as rodadas daquele tipo, com o resultado apurado de cada uma.
 * POST         cria a rodada e devolve o link público pra mandar no WhatsApp.
 *
 * O link é a única credencial da rodada, então o token é aleatório de 24 bytes — não é id
 * sequencial nem data, que qualquer um adivinharia e usaria pra inflar a pesquisa dos outros.
 */

const TOKEN_BYTES = 24;
const TIPOS = Object.keys(TIPOS_PESQUISA);

/** Primeiro dia do mês — referência das pesquisas MENSAIS (marca empregadora e feedback). */
function primeiroDoMes(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
const referenciaPadrao = (tipo: string) => (tipo === 'felicidade' ? segundaDaSemana() : primeiroDoMes());

/**
 * Apura o resultado de cada rodada. A conta muda por tipo:
 *  - felicidade        : por dimensão, % favorável − % desfavorável (a conta da planilha);
 *  - marca empregadora : eNPS clássico, % promotor (9-10) − % detrator (0-6);
 *  - feedback          : % de "sim", e a quebra por líder — que é o motivo da pesquisa existir.
 */
async function apurar(supabase: any, rodadas: any[]) {
  const porRodada = new Map<string, any>();
  if (!rodadas.length) return porRodada;
  const ids = rodadas.map((r) => r.id);
  const tipoDe = new Map<string, string>(rodadas.map((r) => [r.id, r.tipo]));

  const { data: respostas } = await (supabase as any).schema('hr')
    .from('pesquisa_resposta')
    .select('rodada_id, respostas, area_id, comentario, nota, sim, funcionario_id, lider_id')
    .in('rodada_id', ids);

  const lideresIds = new Set<number>();
  for (const r of (respostas || []) as any[]) if (r.lider_id) lideresIds.add(r.lider_id);
  const nomeLider = new Map<number, string>();
  if (lideresIds.size) {
    const { data: nomes } = await (supabase as any).schema('hr').from('funcionarios')
      .select('id, nome').in('id', [...lideresIds]);
    for (const n of (nomes || []) as any[]) nomeLider.set(n.id, n.nome);
  }

  for (const id of ids) porRodada.set(id, { n: 0, scores: {}, geral: null, comentarios: [] as string[] });
  const brutos = new Map<string, any[]>();
  for (const r of (respostas || []) as any[]) {
    const acc = porRodada.get(r.rodada_id);
    if (!acc) continue;
    acc.n++;
    if (r.comentario) acc.comentarios.push(r.comentario);
    const lista = brutos.get(r.rodada_id) ?? [];
    lista.push(r);
    brutos.set(r.rodada_id, lista);
  }

  for (const [id, acc] of porRodada) {
    const linhas = brutos.get(id) || [];
    const tipo = tipoDe.get(id);

    if (tipo === 'marca_empregadora') {
      const notas = linhas.map((l) => Number(l.nota)).filter((n) => n >= 0 && n <= 10);
      if (notas.length) {
        const prom = notas.filter((n) => n >= 9).length;
        const det = notas.filter((n) => n <= 6).length;
        acc.geral = Math.round(((prom - det) / notas.length) * 1000) / 10;
        acc.media = Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10;
        acc.promotores = prom; acc.neutros = notas.length - prom - det; acc.detratores = det;
      }
      continue;
    }

    if (tipo === 'feedback') {
      const sims = linhas.filter((l) => l.sim === true).length;
      const total = linhas.filter((l) => typeof l.sim === 'boolean').length;
      acc.sim = sims; acc.nao = total - sims;
      acc.geral = total ? Math.round((sims / total) * 1000) / 10 : null;
      // Quebra por líder: "o time do fulano não recebeu feedback" é a informação acionável.
      const porLider = new Map<string, { nome: string; sim: number; nao: number }>();
      for (const l of linhas) {
        const chave = String(l.lider_id ?? 'sem');
        const atual = porLider.get(chave)
          ?? { nome: l.lider_id ? (nomeLider.get(l.lider_id) || `#${l.lider_id}`) : 'Sem líder no organograma', sim: 0, nao: 0 };
        if (l.sim === true) atual.sim++; else if (l.sim === false) atual.nao++;
        porLider.set(chave, atual);
      }
      acc.por_lider = [...porLider.values()].sort((a, b) => (b.sim + b.nao) - (a.sim + a.nao));
      continue;
    }

    const porDim: Record<string, number[]> = {};
    for (const l of linhas) {
      for (const d of DIMENSOES) {
        const nota = Number((l.respostas || {})[d.chave]);
        if (nota >= 1 && nota <= 5) (porDim[d.chave] ||= []).push(nota);
      }
    }
    const scores: Record<string, number | null> = {};
    for (const d of DIMENSOES) scores[d.chave] = scoreDimensao(porDim[d.chave] || []);
    const validos = Object.values(scores).filter((v): v is number => v != null);
    acc.scores = scores;
    acc.geral = validos.length ? Math.round((validos.reduce((s, v) => s + v, 0) / validos.length) * 10) / 10 : null;
  }
  return porRodada;
}

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const tipo = String(new URL(request.url).searchParams.get('tipo') || 'felicidade');
  if (!TIPOS.includes(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });

  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  const { data: rodadas, error } = await hr('pesquisa_rodada')
    .select('id, token, referencia, aberta, tipo, criada_em, criada_por, fechada_em, sugestoes_equipe, plano_acao, analise_por, analise_em')
    .eq('bar_id', user.bar_id).eq('tipo', tipo)
    .order('referencia', { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lista = (rodadas || []) as any[];
  const [{ data: perguntas }, resultados] = await Promise.all([
    lista.length && tipo === 'felicidade'
      ? hr('pesquisa_rodada_pergunta').select('rodada_id, dimensao, ordem, texto').in('rodada_id', lista.map((r) => r.id))
      : Promise.resolve({ data: [] }),
    apurar(supabase, lista),
  ]);

  const perguntasPor = new Map<string, any[]>();
  for (const p of (perguntas || []) as any[]) {
    const daRodada = perguntasPor.get(p.rodada_id) ?? [];
    daRodada.push(p);
    perguntasPor.set(p.rodada_id, daRodada);
  }

  return NextResponse.json({
    success: true,
    tipo,
    rodadas: lista.map((r) => ({
      ...r,
      perguntas: (perguntasPor.get(r.id) || []).sort((a, b) => a.ordem - b.ordem),
      resultado: resultados.get(r.id) || { n: 0, scores: {}, geral: null, comentarios: [] },
    })),
  });
}

/**
 * POST — cria a rodada.
 * body: { tipo?, referencia? }
 *     | { acao: 'fechar'|'reabrir', rodada_id }
 *     | { acao: 'analise', rodada_id, sugestoes_equipe?, plano_acao? }
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  // A leitura da rodada: o RH compila as principais sugestões e registra o plano de ação que
  // combinou com a liderança. Fica gravado na rodada pra ser revisitado na pesquisa seguinte
  // ("o que pediram no mês passado, o que prometemos, rodou?").
  if (body.acao === 'analise') {
    const texto = (v: any) => {
      const t = typeof v === 'string' ? v.trim() : '';
      return t ? t.slice(0, 8000) : null;
    };
    const { error } = await hr('pesquisa_rodada')
      .update({
        sugestoes_equipe: texto(body.sugestoes_equipe),
        plano_acao: texto(body.plano_acao),
        analise_por: user.nome || user.email || null,
        analise_em: new Date().toISOString(),
      })
      .eq('id', String(body.rodada_id)).eq('bar_id', user.bar_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.acao === 'fechar' || body.acao === 'reabrir') {
    const { error } = await hr('pesquisa_rodada')
      .update({ aberta: body.acao === 'reabrir', fechada_em: body.acao === 'fechar' ? new Date().toISOString() : null })
      .eq('id', String(body.rodada_id)).eq('bar_id', user.bar_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const tipo = String(body.tipo || 'felicidade');
  if (!TIPOS.includes(tipo)) return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });

  const referencia = /^\d{4}-\d{2}-\d{2}$/.test(String(body.referencia || ''))
    ? String(body.referencia) : referenciaPadrao(tipo);

  // Uma rodada por período e por tipo: duas abertas ao mesmo tempo dividiriam as respostas em
  // dois links e o número do período sairia pela metade nos dois.
  const { data: existente } = await hr('pesquisa_rodada')
    .select('id').eq('bar_id', user.bar_id).eq('tipo', tipo).eq('referencia', referencia).maybeSingle();
  if (existente) {
    return NextResponse.json(
      { error: 'Já existe uma pesquisa deste tipo neste período. Use o link dela.', rodada_id: existente.id },
      { status: 409 },
    );
  }

  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const { data: rodada, error } = await hr('pesquisa_rodada').insert({
    bar_id: user.bar_id, token, referencia, tipo, aberta: true,
    criada_por: user.nome || user.email || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Marca empregadora e feedback têm pergunta FIXA (vive no código, não no banco) — só a
  // felicidade sorteia.
  if (tipo !== 'felicidade') return NextResponse.json({ success: true, rodada });

  const [{ data: bar }, { data: banco }, { data: recentes }] = await Promise.all([
    (supabase as any).schema('operations').from('bares').select('nome').eq('id', user.bar_id).maybeSingle(),
    hr('pesquisa_pergunta').select('id, dimensao, texto')
      .or(`bar_id.is.null,bar_id.eq.${user.bar_id}`).eq('ativa', true),
    hr('pesquisa_rodada').select('id').eq('bar_id', user.bar_id).eq('tipo', 'felicidade')
      .order('referencia', { ascending: false }).limit(8),
  ]);

  let usadas = new Set<number>();
  if (recentes?.length) {
    const { data: usadasRows } = await hr('pesquisa_rodada_pergunta')
      .select('pergunta_id').in('rodada_id', (recentes as any[]).map((r) => r.id));
    usadas = new Set(((usadasRows || []) as any[]).map((u) => u.pergunta_id).filter(Boolean));
  }

  const sorteadas = sortearRodada((banco || []) as any[], usadas);
  if (sorteadas.length < DIMENSOES.length) {
    await hr('pesquisa_rodada').delete().eq('id', rodada.id);
    return NextResponse.json({ error: 'O banco não tem pergunta ativa para todas as 5 dimensões.' }, { status: 400 });
  }

  const nomeBar = (bar as any)?.nome || '';
  const linhas = sorteadas.map((s, i) => ({
    rodada_id: rodada.id, dimensao: s.dimensao, ordem: i + 1,
    pergunta_id: s.pergunta_id, texto: aplicarNomeDoBar(s.texto, nomeBar),
  }));
  const { error: errP } = await hr('pesquisa_rodada_pergunta').insert(linhas);
  if (errP) {
    // rodada sem pergunta é um link quebrado esperando alguém abrir
    await hr('pesquisa_rodada').delete().eq('id', rodada.id);
    return NextResponse.json({ error: errP.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, rodada: { ...rodada, perguntas: linhas } });
}
