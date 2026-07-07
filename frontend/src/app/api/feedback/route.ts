import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { fail, success } from '@/lib/http/responses';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const COLS =
  'id, usuario_id, usuario_nome, email, bar_id, rota, mensagem, user_agent, status, resposta, criada_em, atualizada_em';

const NovoSchema = z.object({
  mensagem: z.string().trim().min(3, 'Escreva um feedback').max(4000),
  rota: z.string().max(300).optional(),
  user_agent: z.string().max(500).optional(),
});

// POST — qualquer usuário autenticado envia feedback da tela em que está
export const POST = withAuth(async ({ user, request }) => {
  const body = NovoSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return fail('Feedback inválido', 400, body.error.issues);

  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .schema('system')
    .from('feedbacks')
    .insert({
      usuario_id: user.auth_id,
      usuario_nome: user.nome ?? null,
      email: user.email ?? null,
      bar_id: user.bar_id ?? null,
      rota: body.data.rota ?? null,
      mensagem: body.data.mensagem,
      user_agent: body.data.user_agent ?? null,
    })
    .select('id')
    .single();
  if (error) return fail(error.message, 500);

  // Avisa os admins do bar (best-effort — nunca quebra o envio do feedback).
  try {
    const { dispatchNotification } = await import('@/lib/notifications/dispatch');
    await dispatchNotification({
      barId: user.bar_id ?? 0,
      eventKey: 'feedback_novo',
      titulo: 'Novo feedback',
      mensagem: `${user.nome || user.email || 'Alguém'} enviou um feedback${
        body.data.rota ? ` em ${body.data.rota}` : ''
      }.`,
      url: '/configuracoes/feedbacks',
      severidade: 'info',
      destinatarios: { roles: ['admin'] },
      canais: ['in_app'],
      dados: { feedback_id: data?.id },
    });
  } catch (e) {
    console.error('[feedback] dispatch feedback_novo falhou:', e);
  }

  return success({ id: data?.id }, { status: 201 });
});

// GET — lista feedbacks (admin). ?status=novo|lido|resolvido|descartado
export const GET = withAuth(async ({ user, request }) => {
  if (user.role !== 'admin') return fail('Apenas admin', 403);
  const status = new URL(request.url).searchParams.get('status') || undefined;
  const supabase = await getAdminClient();
  let q = supabase.schema('system').from('feedbacks').select(COLS).order('criada_em', {
    ascending: false,
  });
  if (status) q = q.eq('status', status);
  const { data, error } = await q.limit(200);
  if (error) return fail(error.message, 500);
  return success({ feedbacks: data ?? [] });
});

// PATCH — atualiza status/resposta de um feedback (admin). ?id=
export const PATCH = withAuth(async ({ user, request }) => {
  if (user.role !== 'admin') return fail('Apenas admin', 403);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return fail('id obrigatório', 400);
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = { atualizada_em: new Date().toISOString() };
  if (typeof body.status === 'string') patch.status = body.status;
  if (typeof body.resposta === 'string') patch.resposta = body.resposta;
  const supabase = await getAdminClient();
  const { error } = await supabase.schema('system').from('feedbacks').update(patch).eq('id', id);
  if (error) return fail(error.message, 500);
  return success({ ok: true });
});
