import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/**
 * Banco de horas (ata de 13/08/2026).
 *
 * Saldo = abertura (o número que o RH já media) + (trabalhado − previsto) depois da data-base +
 * lançamentos manuais. A conta vive em hr.fn_banco_horas.
 *
 * Nota de leitura: `dias_considerados` só conta dia com marcação de ponto E escala prevista. Falta
 * (escala sem ponto) não vira -8h aqui — ela é ocorrência, e descontar do banco puniria duas vezes.
 */

/** GET ?ate=YYYY-MM-DD -> saldo de todo mundo do bar. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const ate = new URL(request.url).searchParams.get('ate') || null;
  const supabase = await getAdminClient();

  const { data, error } = await (supabase as any).schema('hr')
    .rpc('fn_banco_horas', { p_bar: user.bar_id, p_ate: ate });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const linhas = (data || []) as any[];
  const total = linhas.reduce((s, l) => s + (Number(l.saldo_min) || 0), 0);
  return NextResponse.json({
    success: true,
    banco: linhas,
    resumo: {
      pessoas: linhas.length,
      devendo: linhas.filter((l) => Number(l.saldo_min) < 0).length,
      credito: linhas.filter((l) => Number(l.saldo_min) > 0).length,
      saldo_total_min: total,
      sem_abertura: linhas.filter((l) => !l.data_base).length,
    },
  });
}

/**
 * POST -> lançamento manual no banco.
 * body: { funcionario_id, data, minutos, tipo: 'uso'|'pagamento'|'ajuste', descricao? }
 *
 * `minutos` negativo consome o banco — é o caso do "registrado como status = banco de horas" da ata
 * (a pessoa folga e o saldo desce). Fica como lançamento próprio, e não como um status no ponto,
 * porque o ponto é sincronizado do Tangerino e seria sobrescrito no próximo sync.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const funcionarioId = Number(body.funcionario_id);
  const minutos = Number(body.minutos);
  const tipo = String(body.tipo || '');
  const data = String(body.data || '').slice(0, 10);

  if (!funcionarioId) return NextResponse.json({ success: false, error: 'funcionario_id obrigatório' }, { status: 400 });
  if (!Number.isFinite(minutos) || minutos === 0) return NextResponse.json({ success: false, error: 'Informe os minutos (negativo consome o banco)' }, { status: 400 });
  if (!['uso', 'pagamento', 'ajuste'].includes(tipo)) return NextResponse.json({ success: false, error: 'tipo inválido' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ success: false, error: 'data inválida' }, { status: 400 });

  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  const { data: pessoa } = await hr('funcionarios').select('id').eq('id', funcionarioId).eq('bar_id', user.bar_id).maybeSingle();
  if (!pessoa) return NextResponse.json({ success: false, error: 'Funcionário não encontrado neste bar' }, { status: 404 });

  const { data: mov, error } = await hr('banco_horas_mov').insert({
    bar_id: user.bar_id, funcionario_id: funcionarioId, data,
    minutos: Math.round(minutos), tipo, descricao: body.descricao || null,
    registrado_por: user.email || 'app',
  }).select().single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, movimento: mov });
}
