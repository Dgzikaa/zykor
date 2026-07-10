import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { fail, success } from '@/lib/http/responses';
import { getAdminClient } from '@/lib/supabase-admin';
import { repos } from '@/lib/repositories';
import { isSuporte, SUPPORT_EMAIL, CATEGORIA_KEYS, PRIORIDADE_KEYS, catLabel } from '@/lib/chamados';

export const dynamic = 'force-dynamic';

const LIST_COLS =
  'id, aberto_por, aberto_por_nome, email, bar_id, categoria, assunto, rota, status, prioridade, nao_lido_suporte, nao_lido_solicitante, ultima_msg_previa, ultima_msg_em, criado_em, atualizado_em';

const NovoSchema = z.object({
  categoria: z.enum(CATEGORIA_KEYS as [string, ...string[]]).default('outro'),
  assunto: z.string().trim().min(3, 'Descreva o assunto').max(160),
  descricao: z.string().trim().min(3, 'Explique o problema').max(4000),
  rota: z.string().max(300).optional(),
  prioridade: z.enum(PRIORIDADE_KEYS as [string, ...string[]]).default('normal'),
});

const previa = (t: string) => (t.length > 140 ? `${t.slice(0, 140)}…` : t);

// POST — qualquer usuário autenticado abre um chamado (a descrição vira a 1ª mensagem).
export const POST = withAuth(async ({ user, request }) => {
  const parsed = NovoSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return fail('Chamado inválido', 400, parsed.error.issues);
  const b = parsed.data;

  const supabase = await getAdminClient();
  const { data: chamado, error } = await supabase
    .schema('system')
    .from('chamados')
    .insert({
      aberto_por: user.auth_id,
      aberto_por_nome: user.nome ?? null,
      email: user.email ?? null,
      bar_id: user.bar_id ?? null,
      categoria: b.categoria,
      assunto: b.assunto,
      rota: b.rota ?? null,
      prioridade: b.prioridade,
      ultima_msg_previa: previa(b.descricao),
      nao_lido_suporte: !isSuporte(user.email), // se o próprio suporte abriu, não marca novidade
    })
    .select('id')
    .single();
  if (error) return fail(error.message, 500);

  const { error: eMsg } = await supabase
    .schema('system')
    .from('chamado_mensagens')
    .insert({
      chamado_id: chamado.id,
      autor_id: user.auth_id,
      autor_nome: user.nome ?? null,
      autor_tipo: isSuporte(user.email) ? 'suporte' : 'solicitante',
      mensagem: b.descricao,
    });
  if (eMsg) {
    await supabase.schema('system').from('chamados').delete().eq('id', chamado.id);
    return fail(eMsg.message, 500);
  }

  // Notifica o suporte no sino (a não ser que ele mesmo tenha aberto).
  if (!isSuporte(user.email)) {
    try {
      const { usuarios } = await repos();
      const sup = await usuarios.findByEmail(SUPPORT_EMAIL);
      if (sup?.auth_id) {
        const { dispatchNotification } = await import('@/lib/notifications/dispatch');
        await dispatchNotification({
          barId: user.bar_id ?? 0,
          eventKey: 'chamado_novo',
          titulo: '🎫 Novo chamado',
          mensagem: `${user.nome || user.email || 'Alguém'} abriu: ${catLabel(b.categoria)} — ${b.assunto}`,
          url: `/chamados?id=${chamado.id}`,
          severidade: 'alerta',
          destinatarios: { authIds: [sup.auth_id] },
          canais: ['in_app'],
          dados: { chamado_id: chamado.id },
        });
      }
    } catch (e) {
      console.error('[chamados] dispatch chamado_novo falhou:', e);
    }
  }

  return success({ id: chamado.id }, { status: 201 });
});

// GET — fila (suporte vê tudo; usuário vê só os próprios). ?status= filtra; ?resumo=1 só contadores.
export const GET = withAuth(async ({ user, request }) => {
  const sp = new URL(request.url).searchParams;
  const suporte = isSuporte(user.email);
  const supabase = await getAdminClient();

  // Contadores p/ o badge do ícone (independente de bar).
  if (sp.get('resumo') === '1') {
    let q = supabase.schema('system').from('chamados').select('id', { count: 'exact', head: true });
    q = suporte ? q.eq('nao_lido_suporte', true) : q.eq('aberto_por', user.auth_id).eq('nao_lido_solicitante', true);
    const { count } = await q;
    return success({ nao_lidos: count ?? 0 });
  }

  let q = supabase.schema('system').from('chamados').select(LIST_COLS).order('ultima_msg_em', { ascending: false }).limit(300);
  if (!suporte) q = q.eq('aberto_por', user.auth_id);
  const status = sp.get('status');
  if (status) q = q.eq('status', status);
  const barId = sp.get('bar_id');
  if (suporte && barId) q = q.eq('bar_id', Number(barId));

  const { data, error } = await q;
  if (error) return fail(error.message, 500);

  const chamados = (data ?? []).map((c: any) => ({
    ...c,
    nao_lido: suporte ? c.nao_lido_suporte : c.nao_lido_solicitante,
  }));
  const naoLidos = chamados.filter((c: any) => c.nao_lido).length;

  return success({ chamados, nao_lidos: naoLidos, suporte });
});
