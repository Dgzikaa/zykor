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

export const CONCEITOS = ['Insatisfatório', 'Parcial', 'Atende -', 'Atende +', 'Acima', 'Destaque'] as const;

async function checaFuncionario(supabase: any, id: number, barId: number) {
  const { data } = await supabase.schema('hr').from('funcionarios')
    .select('id').eq('id', id).eq('bar_id', barId).maybeSingle();
  return !!data;
}

const conceitoValido = (v: any) => v == null || v === '' || (CONCEITOS as readonly string[]).includes(v);

/** GET -> calibrações do funcionário, da mais recente para a mais antiga. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const supabase = await getAdminClient();
  if (!(await checaFuncionario(supabase, Number(id), user.bar_id))) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }

  const { data, error } = await (supabase as any).schema('hr').from('calibracoes')
    .select('*').eq('funcionario_id', Number(id))
    .order('ano', { ascending: false }).order('trimestre', { ascending: false });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, calibracoes: data || [], conceitos: CONCEITOS });
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
  if (!conceitoValido(body.comportamento) || !conceitoValido(body.performance)) {
    return NextResponse.json({ success: false, error: `Conceito inválido. Use: ${CONCEITOS.join(', ')}` }, { status: 400 });
  }
  if (!body.comportamento && !body.performance) {
    return NextResponse.json({ success: false, error: 'Informe ao menos Comportamento ou Performance' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  if (!(await checaFuncionario(supabase, Number(id), user.bar_id))) {
    return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });
  }

  const { data, error } = await (supabase as any).schema('hr').from('calibracoes').upsert({
    bar_id: user.bar_id,
    funcionario_id: Number(id),
    ano,
    trimestre,
    comportamento: body.comportamento || null,
    performance: body.performance || null,
    observacao: body.observacao?.trim() || null,
    registrado_por: user.nome || user.email || null,
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'funcionario_id,ano,trimestre' }).select().single();

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
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
