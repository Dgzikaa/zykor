import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/**
 * Calibração trimestral (Comportamento × Performance).
 *
 * Preenchimento manual — a fonte é o slide dos cards da calibração, não há
 * planilha para sincronizar. Um registro por funcionário/ano/trimestre; salvar
 * de novo o mesmo período CORRIGE o que já existia (upsert) em vez de duplicar,
 * que é como a calibração acontece na prática: o comitê revisa e ajusta.
 */

/**
 * Escala de 5 níveis, como no card real (docs/avaliação.jpg).
 *
 * O dono tinha falado em 4 (insatisfatório/abaixo/atende/destaque), mas o card da Ana Clara traz
 * ACIMA DAS EXPECTATIVAS nos dois eixos — sem esse nível a calibração dela não seria representável.
 * Confirmado com ele antes de trocar.
 */
export const NIVEIS = [
  { id: 'insatisfatorio', label: 'Insatisfatório' },
  { id: 'abaixo', label: 'Abaixo da expectativa' },
  { id: 'atende', label: 'Atende a expectativa' },
  { id: 'acima', label: 'Acima das expectativas' },
  { id: 'destaque', label: 'Destaque' },
] as const;

const IDS_NIVEL = NIVEIS.map((n) => n.id) as readonly string[];
const nivelValido = (v: any) => v == null || v === '' || IDS_NIVEL.includes(v);

async function checaFuncionario(supabase: any, id: number, barId: number) {
  const { data } = await supabase.schema('hr').from('funcionarios')
    .select('id, cargo_id').eq('id', id).eq('bar_id', barId).maybeSingle();
  return data || null;
}

/** GET -> calibrações do funcionário, da mais recente para a mais antiga. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const supabase = await getAdminClient();
  const func = await checaFuncionario(supabase, Number(id), user.bar_id);
  if (!func) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  const { data: calibs, error } = await hr('calibracoes')
    .select('*').eq('funcionario_id', Number(id))
    .order('ano', { ascending: false }).order('trimestre', { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const ids = (calibs || []).map((c: any) => c.id);
  const [fitRes, atrRes, valoresRes, atributosRes] = await Promise.all([
    ids.length ? hr('calibracao_fit').select('*').in('calibracao_id', ids) : Promise.resolve({ data: [] }),
    ids.length ? hr('calibracao_atributo').select('*').in('calibracao_id', ids) : Promise.resolve({ data: [] }),
    hr('fit_cultural_valores').select('id, nome, ordem').eq('bar_id', user.bar_id).eq('ativo', true).order('ordem'),
    // atributos do CARGO da pessoa: o que se cobra de um barback não é o que se cobra de um garçom
    func.cargo_id
      ? hr('cargo_atributos').select('id, nome, ordem').eq('cargo_id', func.cargo_id).eq('ativo', true).order('ordem')
      : Promise.resolve({ data: [] }),
  ]);

  const fitPor = new Map<string, any[]>();
  for (const f of fitRes.data || []) {
    if (!fitPor.has(f.calibracao_id)) fitPor.set(f.calibracao_id, []);
    fitPor.get(f.calibracao_id)!.push(f);
  }
  const atrPor = new Map<string, any[]>();
  for (const a of atrRes.data || []) {
    if (!atrPor.has(a.calibracao_id)) atrPor.set(a.calibracao_id, []);
    atrPor.get(a.calibracao_id)!.push(a);
  }

  return NextResponse.json({
    success: true,
    calibracoes: (calibs || []).map((c: any) => ({
      ...c,
      fit: fitPor.get(c.id) || [],
      atributos: atrPor.get(c.id) || [],
    })),
    niveis: NIVEIS,
    valores_fit: valoresRes.data || [],
    atributos_cargo: atributosRes.data || [],
  });
}

/** POST -> cria ou corrige a calibração do período. Body: { ano, trimestre, comportamento?, performance?, observacao? } */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const ano = Number(body.ano);
  const trimestre = Number(body.trimestre);
  if (!ano || ano < 2000 || ano > 2100) {
    return NextResponse.json({ success: false, error: 'Ano inválido' }, { status: 400 });
  }
  if (![1, 2, 3, 4].includes(trimestre)) {
    return NextResponse.json({ success: false, error: 'Trimestre deve ser 1, 2, 3 ou 4' }, { status: 400 });
  }
  const campos = [body.comportamento, body.performance, body.auto_comportamento, body.auto_performance];
  if (campos.some((v) => !nivelValido(v))) {
    return NextResponse.json({ success: false, error: `Nível inválido. Use: ${IDS_NIVEL.join(', ')}` }, { status: 400 });
  }
  if (!body.comportamento && !body.performance) {
    return NextResponse.json({ success: false, error: 'Informe ao menos Comportamento ou Performance' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const func = await checaFuncionario(supabase, Number(id), user.bar_id);
  if (!func) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  const { data, error } = await hr('calibracoes').upsert({
    bar_id: user.bar_id,
    funcionario_id: Number(id),
    ano,
    trimestre,
    comportamento: body.comportamento || null,
    performance: body.performance || null,
    auto_comportamento: body.auto_comportamento || null,
    auto_performance: body.auto_performance || null,
    texto_comportamental: body.texto_comportamental?.trim() || null,
    texto_performance: body.texto_performance?.trim() || null,
    // o card mostra 3, mas quem decide quantas são é o comitê
    missoes: Array.isArray(body.missoes) ? body.missoes.map((m: any) => String(m).trim()).filter(Boolean) : [],
    nps_entrega: body.nps_entrega != null && body.nps_entrega !== '' ? Number(body.nps_entrega) : null,
    observacao: body.observacao?.trim() || null,
    registrado_por: user.nome || user.email || null,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'funcionario_id,ano,trimestre' }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Fit e atributos são listas: apaga e regrava, porque salvar de novo o mesmo trimestre CORRIGE a
  // calibração (é como o comitê trabalha) — manter o que veio antes deixaria resto de uma revisão
  // anterior misturado com a atual.
  if (Array.isArray(body.fit)) {
    await hr('calibracao_fit').delete().eq('calibracao_id', data.id);
    const linhas = body.fit
      .filter((f: any) => f?.valor_id && ['+', '+/-', '-'].includes(f.nota))
      .map((f: any) => ({ calibracao_id: data.id, valor_id: Number(f.valor_id), nota: f.nota }));
    if (linhas.length) await hr('calibracao_fit').insert(linhas);
  }
  if (Array.isArray(body.atributos)) {
    await hr('calibracao_atributo').delete().eq('calibracao_id', data.id);
    const linhas = body.atributos
      .filter((a: any) => a?.atributo_id && IDS_NIVEL.includes(a.nivel))
      .map((a: any) => ({ calibracao_id: data.id, atributo_id: Number(a.atributo_id), nivel: a.nivel }));
    if (linhas.length) await hr('calibracao_atributo').insert(linhas);
  }

  return NextResponse.json({ success: true, calibracao: data }, { status: 201 });
}

/** DELETE ?calibracao_id= */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const calibracaoId = new URL(request.url).searchParams.get('calibracao_id');
  if (!calibracaoId) return NextResponse.json({ success: false, error: 'calibracao_id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  if (!(await checaFuncionario(supabase, Number(id), user.bar_id))) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }

  const { error } = await (supabase as any).schema('hr').from('calibracoes')
    .delete().eq('id', calibracaoId).eq('funcionario_id', Number(id));
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
