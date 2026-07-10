import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { fail, success } from '@/lib/http/responses';
import { getAdminClient } from '@/lib/supabase-admin';
import { repos } from '@/lib/repositories';
import { isSuporte, SUPPORT_EMAIL } from '@/lib/chamados';

export const dynamic = 'force-dynamic';

const MsgSchema = z.object({ mensagem: z.string().trim().min(1, 'Escreva a mensagem').max(4000) });
const previa = (t: string) => (t.length > 140 ? `${t.slice(0, 140)}…` : t);

// POST — adiciona mensagem na thread. Dono ou suporte. Notifica a OUTRA parte no sino.
export const POST = withAuth(async ({ user, request }, ctx) => {
  const { id } = await ctx!.params;
  const parsed = MsgSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return fail('Mensagem inválida', 400, parsed.error.issues);
  const texto = parsed.data.mensagem;

  const supabase = await getAdminClient();
  const suporte = isSuporte(user.email);
  const { data: chamado } = await supabase
    .schema('system').from('chamados')
    .select('id, bar_id, aberto_por, aberto_por_nome, assunto, status').eq('id', id).maybeSingle();
  if (!chamado) return fail('Chamado não encontrado', 404);
  if (!suporte && chamado.aberto_por !== user.auth_id) return fail('Sem acesso a este chamado', 403);

  const { error: eMsg } = await supabase.schema('system').from('chamado_mensagens').insert({
    chamado_id: id,
    autor_id: user.auth_id,
    autor_nome: user.nome ?? null,
    autor_tipo: suporte ? 'suporte' : 'solicitante',
    mensagem: texto,
  });
  if (eMsg) return fail(eMsg.message, 500);

  // atualiza o cabeçalho: prévia, novidade p/ o outro lado, e avança o status quando fizer sentido
  const patch: Record<string, unknown> = {
    ultima_msg_previa: previa(texto),
    ultima_msg_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  };
  if (suporte) {
    patch.nao_lido_solicitante = true;
    patch.nao_lido_suporte = false;
    if (chamado.status === 'aberto') patch.status = 'em_andamento';
  } else {
    patch.nao_lido_suporte = true;
    patch.nao_lido_solicitante = false;
    if (chamado.status === 'aguardando') patch.status = 'em_andamento';
  }
  await supabase.schema('system').from('chamados').update(patch).eq('id', id);

  // notifica a outra parte no sino
  try {
    const { dispatchNotification } = await import('@/lib/notifications/dispatch');
    if (suporte) {
      await dispatchNotification({
        barId: chamado.bar_id ?? 0,
        eventKey: 'chamado_resposta',
        titulo: '🎫 Resposta no seu chamado',
        mensagem: `"${chamado.assunto}": ${previa(texto)}`,
        url: `/chamados?id=${chamado.id}`,
        severidade: 'info',
        destinatarios: { authIds: [chamado.aberto_por] },
        canais: ['in_app'],
        dados: { chamado_id: chamado.id },
      });
    } else {
      const { usuarios } = await repos();
      const sup = await usuarios.findByEmail(SUPPORT_EMAIL);
      if (sup?.auth_id) {
        await dispatchNotification({
          barId: user.bar_id ?? 0,
          eventKey: 'chamado_resposta',
          titulo: '🎫 Resposta em chamado',
          mensagem: `${chamado.aberto_por_nome || 'Solicitante'} respondeu "${chamado.assunto}": ${previa(texto)}`,
          url: `/chamados?id=${chamado.id}`,
          severidade: 'alerta',
          destinatarios: { authIds: [sup.auth_id] },
          canais: ['in_app'],
          dados: { chamado_id: chamado.id },
        });
      }
    }
  } catch (e) {
    console.error('[chamados] dispatch chamado_resposta falhou:', e);
  }

  return success({ ok: true }, { status: 201 });
});
