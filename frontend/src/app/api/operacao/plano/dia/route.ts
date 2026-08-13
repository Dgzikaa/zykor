import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { recalcularDias } from '@/lib/operacao/recalcular';

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
  // faturamento_previsto é coluna GERADA (coalesce(manual, m1)) — quem a tela edita é o manual
  for (const campo of ['faturamento_manual', 'publico_manual', 'pico_manual', 'ticket_medio_manual', 'giro_manual']) {
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

  // o recálculo é compartilhado com a sincronização do M1 — uma cadeia só, dois gatilhos
  const { sem_parametro } = await recalcularDias(c, user.bar_id, [dia]);
  if (sem_parametro.length) {
    return NextResponse.json({ dia, aviso: 'Sem parâmetros vigentes nesta data — nada foi recalculado.' });
  }

  const { data: atualizado } = await ops(c).from('operacao_dia').select('*').eq('id', dia.id).single();
  const { data: linhas } = await ops(c).from('v_operacao_dia_funcao').select('custo')
    .eq('operacao_dia_id', dia.id);

  return NextResponse.json({
    dia: atualizado || dia,
    custo_dia: (linhas || []).reduce((s: number, l: any) => s + Number(l.custo || 0), 0),
  });
}
