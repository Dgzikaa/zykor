/**
 * Bronze layer — raw data ingested from external APIs.
 *
 * READ-ONLY do frontend. Nunca escrever aqui — ingestão é responsabilidade
 * das edge functions `bronze-*` em `backend/supabase/functions/`.
 *
 * Usar apenas em telas administrativas de debug/auditoria.
 */
import { getAdminClient } from '@/lib/supabase-admin';

export async function bronze() {
  const client = await getAdminClient();
  // Schema `bronze` é reservado; tabelas raw como `contahub_raw_data`
  // também vivem em `public` por razões históricas.
  return client.schema('bronze' as never);
}

export async function bronzePublic() {
  // Para tabelas raw que ainda estão em `public` (contahub_raw_data, etc.)
  const client = await getAdminClient();
  return client;
}
