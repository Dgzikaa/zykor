/**
 * Silver layer — tabelas tipadas resultantes do processamento de bronze.
 *
 * Leitura: telas admin/debug e telas de edição de campos manuais.
 * Escrita: apenas campos manuais (`operations.*`) via rotas /api próprias.
 *
 * Regras de campos manuais: ver `docs/regras-negocio.md` §10.
 */
import { getAdminClient } from '@/lib/supabase-admin';

export async function silver() {
  const client = await getAdminClient();
  return client.schema('silver' as never);
}

/**
 * Silver para dados `public.*` (historicamente convivem aqui enquanto
 * a reorganização de schema não termina). Ex.: `contahub_analitico`,
 * `contahub_pagamentos`.
 */
export async function silverPublic() {
  const client = await getAdminClient();
  return client;
}

/**
 * Schema `operations` — tabelas editáveis manualmente (eventos_base, config_*).
 */
export async function operations() {
  const client = await getAdminClient();
  return client.schema('operations' as never);
}
