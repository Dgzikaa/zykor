import type { AuthenticatedUser } from '@/middleware/auth';

/**
 * Gravação do check-in do dia — uma pessoa, um dia.
 *
 * Um caminho só: a visão Dia da Escala da Operação (/api/operacao/escala/dia), que salva em
 * lote quando o líder aperta Salvar. A aba Check-ins do RH — que gravava o MESMO registro com
 * um POST por clique, sobre a escala do Tangerino — foi removida em 19/08/2026. A regra da
 * ocorrência fica aqui, e não dentro da rota, pra não voltar a existir duas cópias dela.
 */
export const STATUS_CHECKIN = ['ok', 'ok_atraso', 'escala_errada', 'falta', 'atestado'] as const;
export type StatusCheckin = (typeof STATUS_CHECKIN)[number];

/**
 * Status que viram ocorrência no dossiê. Os outros não geram nada.
 * 'atestado' é ausência JUSTIFICADA — ocorrência de atestado, nunca de falta.
 */
const TIPO_OCORRENCIA: Partial<Record<StatusCheckin, { tipo: string; descricao: string }>> = {
  falta: { tipo: 'falta', descricao: 'Falta registrada no check-in do dia' },
  atestado: { tipo: 'atestado', descricao: 'Atestado registrado no check-in do dia' },
};

export type ResultadoCheckin = { ok: true; checkin: any } | { ok: false; erro: string; status: number };

export async function salvarCheckin(
  supabase: any,
  user: AuthenticatedUser,
  entrada: { funcionario_id: number; data: string; status: string; observacao?: string | null },
): Promise<ResultadoCheckin> {
  const hr = (t: string) => supabase.schema('hr').from(t);
  const funcionarioId = Number(entrada.funcionario_id);
  const data = String(entrada.data || '').slice(0, 10);
  const status = String(entrada.status || '') as StatusCheckin;

  if (!funcionarioId) return { ok: false, erro: 'funcionario_id obrigatório', status: 400 };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { ok: false, erro: 'data inválida (AAAA-MM-DD)', status: 400 };
  if (!STATUS_CHECKIN.includes(status)) return { ok: false, erro: `status inválido: ${status}`, status: 400 };

  const { data: pessoa } = await hr('funcionarios')
    .select('id, nome').eq('id', funcionarioId).eq('bar_id', user.bar_id).maybeSingle();
  if (!pessoa) return { ok: false, erro: 'Funcionário não encontrado neste bar', status: 404 };

  const { data: atual } = await hr('checkin')
    .select('id, status, ocorrencia_id').eq('funcionario_id', funcionarioId).eq('data', data).maybeSingle();

  let ocorrenciaId: string | null = atual?.ocorrencia_id ?? null;
  const alvo = TIPO_OCORRENCIA[status];

  // Trocou pra um status que não gera ocorrência (ou gera OUTRA): a que ESTE check-in criou sai.
  // Sem comparar o status, marcar falta e corrigir pra atestado deixava a FALTA no histórico.
  if (atual?.ocorrencia_id && (!alvo || atual.status !== status)) {
    await hr('funcionario_ocorrencias').delete().eq('id', atual.ocorrencia_id);
    ocorrenciaId = null;
  }

  if (alvo && !ocorrenciaId) {
    const { data: oc } = await hr('funcionario_ocorrencias').insert({
      funcionario_id: funcionarioId,
      bar_id: user.bar_id,
      tipo: alvo.tipo,
      data_inicio: data,
      descricao: entrada.observacao || alvo.descricao,
      colaborador_nome: pessoa.nome,
      aplicado_por: user.email || 'app',
    }).select('id').single();
    ocorrenciaId = oc?.id ?? null;
  }

  const { data: reg, error } = await hr('checkin').upsert({
    bar_id: user.bar_id,
    funcionario_id: funcionarioId,
    data,
    status,
    observacao: entrada.observacao || null,
    ocorrencia_id: ocorrenciaId,
    registrado_por: user.email || 'app',
    atualizado_em: new Date().toISOString(),
  }, { onConflict: 'funcionario_id,data' }).select().single();

  if (error) return { ok: false, erro: error.message, status: 500 };
  return { ok: true, checkin: reg };
}
