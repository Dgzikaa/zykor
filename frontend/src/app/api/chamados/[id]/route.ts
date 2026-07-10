import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { fail, success } from '@/lib/http/responses';
import { getAdminClient } from '@/lib/supabase-admin';
import { isSuporte, STATUS_KEYS, PRIORIDADE_KEYS, statusLabel } from '@/lib/chamados';

export const dynamic = 'force-dynamic';

const DET_COLS =
  'id, aberto_por, aberto_por_nome, email, bar_id, categoria, assunto, rota, status, prioridade, nao_lido_suporte, nao_lido_solicitante, criado_em, atualizado_em, ultima_msg_em';

// GET — detalhe + thread. Dono ou suporte. Abrir zera a "novidade" do lado que abriu.
export const GET = withAuth(async ({ user }, ctx) => {
  const { id } = await ctx!.params;
  const supabase = await getAdminClient();
  const suporte = isSuporte(user.email);

  const { data: chamado, error } = await supabase.schema('system').from('chamados').select(DET_COLS).eq('id', id).maybeSingle();
  if (error) return fail(error.message, 500);
  if (!chamado) return fail('Chamado não encontrado', 404);
  if (!suporte && chamado.aberto_por !== user.auth_id) return fail('Sem acesso a este chamado', 403);

  const { data: mensagens, error: eMsg } = await supabase
    .schema('system').from('chamado_mensagens')
    .select('id, autor_id, autor_nome, autor_tipo, mensagem, criado_em')
    .eq('chamado_id', id).order('criado_em', { ascending: true });
  if (eMsg) return fail(eMsg.message, 500);

  // limpa a novidade do lado que está lendo
  const patch = suporte ? { nao_lido_suporte: false } : { nao_lido_solicitante: false };
  const flag = suporte ? chamado.nao_lido_suporte : chamado.nao_lido_solicitante;
  if (flag) await supabase.schema('system').from('chamados').update(patch).eq('id', id);

  return success({ chamado: { ...chamado, nao_lido: false }, mensagens: mensagens ?? [], suporte });
});

const PatchSchema = z.object({
  status: z.enum(STATUS_KEYS as [string, ...string[]]).optional(),
  prioridade: z.enum(PRIORIDADE_KEYS as [string, ...string[]]).optional(),
});

// PATCH — muda status/prioridade (só suporte). Notifica o solicitante no sino.
export const PATCH = withAuth(async ({ user, request }, ctx) => {
  if (!isSuporte(user.email)) return fail('Apenas o suporte pode alterar o chamado', 403);
  const { id } = await ctx!.params;
  const parsed = PatchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return fail('Dados inválidos', 400, parsed.error.issues);
  if (!parsed.data.status && !parsed.data.prioridade) return fail('Nada para alterar', 400);

  const supabase = await getAdminClient();
  const { data: chamado } = await supabase.schema('system').from('chamados').select('id, bar_id, aberto_por, assunto').eq('id', id).maybeSingle();
  if (!chamado) return fail('Chamado não encontrado', 404);

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  if (parsed.data.status) { patch.status = parsed.data.status; patch.nao_lido_solicitante = true; }
  if (parsed.data.prioridade) patch.prioridade = parsed.data.prioridade;

  const { error } = await supabase.schema('system').from('chamados').update(patch).eq('id', id);
  if (error) return fail(error.message, 500);

  // avisa o solicitante que o status mudou
  if (parsed.data.status) {
    try {
      const { dispatchNotification } = await import('@/lib/notifications/dispatch');
      await dispatchNotification({
        barId: chamado.bar_id ?? 0,
        eventKey: 'chamado_atualizado',
        titulo: '🎫 Seu chamado foi atualizado',
        mensagem: `"${chamado.assunto}" agora está: ${statusLabel(parsed.data.status)}.`,
        url: `/chamados?id=${chamado.id}`,
        severidade: 'info',
        destinatarios: { authIds: [chamado.aberto_por] },
        canais: ['in_app'],
        dados: { chamado_id: chamado.id },
      });
    } catch (e) {
      console.error('[chamados] dispatch chamado_atualizado falhou:', e);
    }
  }

  return success({ ok: true });
});
