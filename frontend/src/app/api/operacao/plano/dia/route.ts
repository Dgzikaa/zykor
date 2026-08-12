import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { recalcularDia } from '@/lib/operacao/calculo';
import { parametrosVigentes } from '@/lib/operacao/parametros';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ops = (c: ReturnType<typeof sb>) => (c as any).schema('operations');

/** Campos de texto do dia que a tela edita direto. */
const TEXTO = [
  'programacao_musical', 'programacao_esportiva', 'entrada', 'promocao',
  'plano_chao', 'pilula_treinamento', 'observacoes', 'data_especial',
] as const;

// =====================================================
// PATCH /api/operacao/plano/dia
// body: { data, turno, ...campos }  — cria o dia se não existir.
//
// Qualquer alteração que mexa na cadeia (faturamento, ticket/giro do dia, override de
// público ou pico) dispara o RECÁLCULO do dia inteiro: total_calculado de cada função é
// regravado. O manual nunca é apagado — ele continua ganhando na leitura, e a célula fica
// amarela justamente pra mostrar "tem automático por trás disso".
// =====================================================
export async function PATCH(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const data = String(body.data || '');
  const turno = ['unico', 'dia', 'noite'].includes(body.turno) ? body.turno : 'unico';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ error: 'Informe data (AAAA-MM-DD)' }, { status: 400 });
  }

  const c = sb();

  const patch: Record<string, unknown> = { atualizado_por: user.auth_id, atualizado_em: new Date().toISOString() };
  for (const campo of TEXTO) if (campo in body) patch[campo] = body[campo] || null;
  for (const campo of ['faturamento_previsto', 'publico_manual', 'pico_manual', 'ticket_medio_manual', 'giro_manual']) {
    if (campo in body) {
      const v = body[campo];
      patch[campo] = v === null || v === '' ? null : Number(v);
    }
  }

  // upsert do dia (cria quando o time está planejando uma data que ainda não existe)
  const { data: dia, error: eDia } = await ops(c).from('operacao_dia')
    .upsert({ bar_id: user.bar_id, data, turno, ...patch }, { onConflict: 'bar_id,data,turno' })
    .select('*').single();
  if (eDia) return NextResponse.json({ error: eDia.message }, { status: 500 });

  const parametros = await parametrosVigentes(c, user.bar_id, data);
  if (!parametros) {
    return NextResponse.json({ dia, aviso: 'Sem parâmetros vigentes nesta data — nada foi recalculado.' });
  }

  // Funções ativas + o que já existe gravado para este dia
  const [{ data: funcoes }, { data: existentes }] = await Promise.all([
    ops(c).from('operacao_funcao').select('id').eq('bar_id', user.bar_id).eq('ativo', true),
    ops(c).from('operacao_dia_funcao').select('*').eq('operacao_dia_id', dia.id),
  ]);
  const porFuncao = new Map((existentes || []).map((l: any) => [l.funcao_id, l]));

  const calc = recalcularDia({
    dataISO: data,
    faturamento: dia.faturamento_previsto === null ? null : Number(dia.faturamento_previsto),
    ticketManual: dia.ticket_medio_manual === null ? null : Number(dia.ticket_medio_manual),
    giroManual: dia.giro_manual === null ? null : Number(dia.giro_manual),
    publicoManual: dia.publico_manual === null ? null : Number(dia.publico_manual),
    picoManual: dia.pico_manual === null ? null : Number(dia.pico_manual),
    funcoes: (funcoes || []).map((f: any) => {
      const l: any = porFuncao.get(f.id);
      return {
        funcao_id: f.id,
        total_manual: l?.total_manual ?? null,
        fixos_escala: l?.fixos_escala ?? 0,
        fixos_manual: l?.fixos_manual ?? null,
      };
    }),
    parametros,
  });

  // grava público/pico calculados + o total_calculado de cada função
  await ops(c).from('operacao_dia').update({
    publico_calculado: calc.publico_calculado,
    pico_calculado: calc.pico_calculado,
  }).eq('id', dia.id);

  const linhas = calc.funcoes.map(l => ({
    operacao_dia_id: dia.id,
    funcao_id: l.funcao_id,
    total_calculado: l.total_calculado,
    // preserva o que já existia — o upsert não pode zerar override nem fixo da escala
    total_manual: (porFuncao.get(l.funcao_id) as any)?.total_manual ?? null,
    fixos_escala: (porFuncao.get(l.funcao_id) as any)?.fixos_escala ?? 0,
    fixos_manual: (porFuncao.get(l.funcao_id) as any)?.fixos_manual ?? null,
    atualizado_em: new Date().toISOString(),
  }));
  if (linhas.length) {
    const { error } = await ops(c).from('operacao_dia_funcao')
      .upsert(linhas, { onConflict: 'operacao_dia_id,funcao_id' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ dia: { ...dia, ...calc }, custo_dia: calc.custo_dia });
}
