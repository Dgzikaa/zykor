import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { hasPermission } from '@/lib/auth/get-user';
import { fail, success } from '@/lib/http/responses';
import { getAdminClient } from '@/lib/supabase-admin';
import { getSignal } from '@/lib/notifications/signals';
import { avaliarCondicoesDoBar } from '@/lib/notifications/condition-engine';

export const dynamic = 'force-dynamic';

const COLS =
  'id, bar_id, signal_key, operador, limite, alvo_id, alvo_label, titulo, severidade, canais, target_roles, target_user_ids, cooldown_horas, ativo, criada_em, atualizada_em';

const CondicaoSchema = z.object({
  signal_key: z.string().min(1),
  operador: z.enum(['lt', 'lte', 'gt', 'gte', 'eq']).default('lt'),
  limite: z.number().nullable().optional(),
  alvo_id: z.string().nullable().optional(),
  alvo_label: z.string().nullable().optional(),
  titulo: z.string().max(120).nullable().optional(),
  severidade: z.enum(['info', 'sucesso', 'alerta', 'critico']).default('alerta'),
  canais: z.array(z.enum(['in_app', 'push', 'whatsapp'])).min(1).default(['in_app']),
  target_roles: z.array(z.string()).default([]),
  target_user_ids: z.array(z.string()).default([]),
  cooldown_horas: z.number().int().min(1).max(720).default(12),
  ativo: z.boolean().default(true),
});


// GET — lista as condições do bar (admin)
export const GET = withAuth(async ({ user }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  if (!hasPermission(user, 'configuracoes')) return fail('Sem permissão', 403);
  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .schema('system')
    .from('alert_conditions')
    .select(COLS)
    .eq('bar_id', user.bar_id)
    .order('criada_em', { ascending: false });
  if (error) return fail(error.message, 500);
  return success({ condicoes: data ?? [] });
});

// POST — cria condição, OU ?action=testar&id=... avalia uma condição agora (dry-run)
export const POST = withAuth(async ({ user, request }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  if (!hasPermission(user, 'configuracoes')) return fail('Sem permissão', 403);

  const url = new URL(request.url);
  if (url.searchParams.get('action') === 'testar') {
    const id = url.searchParams.get('id') || undefined;
    const res = await avaliarCondicoesDoBar(user.bar_id, {
      soCondId: id,
      ignorarCooldown: true,
      teste: true,
    });
    return success({ teste: res });
  }

  const body = await request.json().catch(() => ({}));
  const p = CondicaoSchema.safeParse(body);
  if (!p.success) return fail('Dados invalidos', 400, p.error.issues);
  if (!getSignal(p.data.signal_key)) return fail('Sinal desconhecido', 400);

  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .schema('system')
    .from('alert_conditions')
    .insert({ ...p.data, bar_id: user.bar_id, criada_por: user.email ?? user.auth_id })
    .select(COLS)
    .single();
  if (error) return fail(error.message, 500);
  return success({ condicao: data });
});

// PUT — atualiza uma condição (?id=...)
export const PUT = withAuth(async ({ user, request }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  if (!hasPermission(user, 'configuracoes')) return fail('Sem permissão', 403);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return fail('id obrigatorio', 400);

  const body = await request.json().catch(() => ({}));
  const p = CondicaoSchema.partial().safeParse(body);
  if (!p.success) return fail('Dados invalidos', 400, p.error.issues);

  const supabase = await getAdminClient();
  const { data, error } = await supabase
    .schema('system')
    .from('alert_conditions')
    .update({ ...p.data, atualizada_em: new Date().toISOString() })
    .eq('id', id)
    .eq('bar_id', user.bar_id)
    .select(COLS)
    .single();
  if (error) return fail(error.message, 500);
  return success({ condicao: data });
});

// DELETE — remove uma condição (?id=...)
export const DELETE = withAuth(async ({ user, request }) => {
  if (!user.bar_id) return fail('Bar nao selecionado', 400);
  if (!hasPermission(user, 'configuracoes')) return fail('Sem permissão', 403);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return fail('id obrigatorio', 400);
  const supabase = await getAdminClient();
  const { error } = await supabase
    .schema('system')
    .from('alert_conditions')
    .delete()
    .eq('id', id)
    .eq('bar_id', user.bar_id);
  if (error) return fail(error.message, 500);
  return success({ ok: true });
});
