/**
 * Factory de repositories.
 *
 * Use `repos()` em services. Por padrao usa o cliente admin (service_role,
 * bypassa RLS — ideal para code de servidor).
 *
 * @example
 *   const { eventos, bares } = await repos();
 *   const data = await eventos.listarDoMes(barId, mes, ano);
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '@/lib/supabase-admin';

import { EventosRepository } from './eventos.repo';
import { BaresRepository } from './bares.repo';
import { UsuariosRepository } from './usuarios.repo';
import { NotificacoesRepository } from './notificacoes.repo';

export type Repos = {
  eventos: EventosRepository;
  bares: BaresRepository;
  usuarios: UsuariosRepository;
  notificacoes: NotificacoesRepository;
};

/**
 * Cria os repositories usando o cliente admin (service_role).
 * Use em todas as rotas API e services do servidor.
 */
export async function repos(): Promise<Repos> {
  const client = await getAdminClient();
  return reposFromClient(client);
}

/**
 * Cria os repositories a partir de um cliente Supabase ja existente.
 * Util para testes (mocks) ou cenarios onde voce precisa controlar o cliente.
 */
export function reposFromClient(client: SupabaseClient): Repos {
  return {
    eventos: new EventosRepository(client),
    bares: new BaresRepository(client),
    usuarios: new UsuariosRepository(client),
    notificacoes: new NotificacoesRepository(client),
  };
}

// Re-exports para conveniencia
export { EventosRepository } from './eventos.repo';
export { BaresRepository } from './bares.repo';
export { UsuariosRepository } from './usuarios.repo';
export { NotificacoesRepository } from './notificacoes.repo';
