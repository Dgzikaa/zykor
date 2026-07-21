import { getAdminClient } from '@/lib/supabase-admin';

/** Normaliza modulos (array OU objeto {chave:true}) para array de strings. */
function normalizeModulos(m: unknown): string[] {
  if (Array.isArray(m)) return m.filter((s): s is string => typeof s === 'string');
  if (m && typeof m === 'object') {
    return Object.entries(m as Record<string, unknown>).filter(([, v]) => v === true).map(([k]) => k);
  }
  return [];
}

/**
 * Módulos EFETIVOS de um usuário para o JWT (RBAC por perfil).
 *
 * Regra (idêntica à do `authenticateUser`, que é a autoridade no servidor): o PERFIL é a
 * fonte da verdade. Se o usuário tem `perfil_id`, a permissão efetiva vem de
 * `usuarios_perfil.modulos` — inclusive pra quem é `role=admin` (o admin de verdade está no
 * perfil "Admin", cujos módulos contêm 'todos'; quem é admin legado mas está num perfil
 * comum fica restrito ao perfil — é o "tudo via perfil").
 *
 * Este helper alinha o JWT (login/refresh) ao que o `authenticateUser` já faz ao ler o DB,
 * pra o token não carregar os módulos crus do usuário (que o servidor ignoraria de qualquer jeito).
 *
 * Salvaguardas (nunca trancar ninguém indevidamente):
 *  - Sem `perfil_id` → usa os módulos próprios do usuário (retrocompat).
 *  - Perfil vazio/ausente ou erro de leitura → cai nos módulos próprios (não quebra o login).
 *
 * Os perfis foram semeados com a UNIÃO dos módulos dos membros (backup em
 * public.usuarios_perfil_backup_20260721) — o corte inicial é zero-breakage; a granularização
 * fina é feita depois editando cada perfil.
 */
export async function resolveEffectiveModulos(user: {
  role?: string | null;
  perfil_id?: string | null;
  modulos_permitidos?: unknown;
}): Promise<string[]> {
  const own = normalizeModulos(user?.modulos_permitidos);

  // Sem perfil → mantém os módulos próprios (retrocompat).
  if (!user?.perfil_id) return own;

  try {
    const supabase = await getAdminClient();
    const { data } = await supabase
      .from('usuarios_perfil')
      .select('modulos')
      .eq('id', user.perfil_id)
      .maybeSingle();
    const perfilMods = normalizeModulos((data as { modulos?: unknown } | null)?.modulos);
    // Perfil vazio/ausente não tranca o usuário: cai nos próprios módulos.
    return perfilMods.length ? perfilMods : own;
  } catch {
    return own; // qualquer erro de leitura: não quebra o login
  }
}
