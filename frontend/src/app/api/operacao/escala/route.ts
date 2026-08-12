import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { paginate } from '@/lib/supabase/paginate';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ops = (c: ReturnType<typeof sb>) => (c as any).schema('operations');

/** Só o sábado é partido em DIA/NOITE no plano; a regra é a mesma do backfill. */
const turnoDe = (dataISO: string, entra: string | null) => {
  if (!entra) return 'unico';
  const [a, m, d] = dataISO.split('-').map(Number);
  const sabado = new Date(Date.UTC(a, m - 1, d)).getUTCDay() === 6;
  if (!sabado) return 'unico';
  return Number(entra.slice(0, 2)) < 14 ? 'dia' : 'noite';
};

// =====================================================
// GET /api/operacao/escala?de=&ate=
// Grade da escala no período: uma linha por pessoa/função, com os dias dentro.
// =====================================================
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const url = new URL(request.url);
  const de = url.searchParams.get('de');
  const ate = url.searchParams.get('ate');
  if (!de || !ate) return NextResponse.json({ error: 'Informe de e ate (AAAA-MM-DD)' }, { status: 400 });

  const c = sb();
  const [{ data: funcoes }, linhas] = await Promise.all([
    ops(c).from('operacao_funcao').select('*').eq('bar_id', user.bar_id).eq('ativo', true).order('ordem'),
    // um mês inteiro × ~49 pessoas passa de 1000 linhas — paginar (Supabase corta em silêncio)
    paginate<any>(() => ops(c).from('escala_dia')
      .select('*').eq('bar_id', user.bar_id).gte('data', de).lte('data', ate)
      .order('funcao_id').order('slot').order('data')),
  ]);

  // agrupa por pessoa (função + slot é a identidade enquanto não houver funcionario_id)
  const pessoas = new Map<string, any>();
  linhas.forEach((l: any) => {
    const k = `${l.funcao_id}|${l.slot}`;
    if (!pessoas.has(k)) {
      pessoas.set(k, { chave: k, funcao_id: l.funcao_id, slot: l.slot, nome: l.pessoa_nome, funcionario_id: l.funcionario_id, dias: {} });
    }
    const p = pessoas.get(k)!;
    p.nome = l.pessoa_nome; // o nome mais recente vence (renomeou no meio do período)
    p.dias[l.data] = {
      id: l.id, entra: l.entra, sai: l.sai, horas: l.horas === null ? null : Number(l.horas),
      marcador: l.marcador, turno: l.turno,
    };
  });

  const ordem = new Map<string, number>((funcoes || []).map((f: any, i: number) => [String(f.id), i]));
  const lista = [...pessoas.values()].sort((a, b) =>
    (ordem.get(a.funcao_id) ?? 99) - (ordem.get(b.funcao_id) ?? 99) || a.slot - b.slot);

  return NextResponse.json({ funcoes: funcoes || [], pessoas: lista });
}

// =====================================================
// PATCH /api/operacao/escala
// body: { data, funcao_id, slot, pessoa_nome?, entra?, sai?, horas?, marcador? }
//
// Uma célula da grade. Manda entra/sai vazios + marcador pra registrar FOLGA/FÉRIAS;
// manda tudo null pra apagar o dia da pessoa.
// =====================================================
export async function PATCH(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const data = String(body.data || '');
  const funcaoId = String(body.funcao_id || '');
  const slot = Number(body.slot);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !funcaoId || !Number.isFinite(slot)) {
    return NextResponse.json({ error: 'Informe data, funcao_id e slot' }, { status: 400 });
  }

  const c = sb();
  const { data: funcao } = await ops(c).from('operacao_funcao').select('id')
    .eq('bar_id', user.bar_id).eq('id', funcaoId).maybeSingle();
  if (!funcao) return NextResponse.json({ error: 'Função não encontrada neste bar' }, { status: 404 });

  // apagar o dia da pessoa
  if (body.apagar) {
    const { error } = await ops(c).from('escala_dia').delete()
      .eq('bar_id', user.bar_id).eq('data', data).eq('funcao_id', funcaoId).eq('slot', slot);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await recontarFixos(c, user.bar_id, data);
    return NextResponse.json({ apagado: true });
  }

  const entra = body.entra || null;
  const sai = body.sai || null;
  const linha = {
    bar_id: user.bar_id,
    data,
    funcao_id: funcaoId,
    slot,
    pessoa_nome: String(body.pessoa_nome || '').trim() || 'SEM NOME',
    entra,
    sai,
    horas: body.horas === null || body.horas === '' || body.horas === undefined ? null : Number(body.horas),
    marcador: entra ? null : (body.marcador || null),
    turno: turnoDe(data, entra),
    origem: 'zykor',
    atualizado_em: new Date().toISOString(),
  };

  const { data: salvo, error } = await ops(c).from('escala_dia')
    .upsert(linha, { onConflict: 'bar_id,data,funcao_id,slot' }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // a escala é a fonte do FIXOS do plano operacional — mexeu aqui, recontar lá
  await recontarFixos(c, user.bar_id, data);

  return NextResponse.json({ linha: salvo });
}

/**
 * Recalcula fixos_escala das linhas do plano naquela data. É o que mantém as duas telas
 * coerentes: mudou a escala, o custo projetado do dia muda junto, sem ninguém redigitar.
 */
async function recontarFixos(c: ReturnType<typeof sb>, barId: number, data: string) {
  const { data: dias } = await ops(c).from('operacao_dia').select('id, turno')
    .eq('bar_id', barId).eq('data', data);
  if (!dias?.length) return;

  const { data: escala } = await ops(c).from('escala_dia')
    .select('funcao_id, turno').eq('bar_id', barId).eq('data', data).not('entra', 'is', null);

  for (const d of dias as any[]) {
    const conta = new Map<string, number>();
    (escala || []).forEach((e: any) => {
      if (d.turno !== 'unico' && e.turno !== d.turno) return;
      conta.set(e.funcao_id, (conta.get(e.funcao_id) || 0) + 1);
    });
    const { data: linhas } = await ops(c).from('operacao_dia_funcao')
      .select('funcao_id').eq('operacao_dia_id', d.id);
    for (const l of (linhas || []) as any[]) {
      await ops(c).from('operacao_dia_funcao')
        .update({ fixos_escala: conta.get(l.funcao_id) || 0, atualizado_em: new Date().toISOString() })
        .eq('operacao_dia_id', d.id).eq('funcao_id', l.funcao_id);
    }
  }
}
