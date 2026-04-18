/**
 * Repository de Usuarios.
 *
 * Encapsula acesso a auth_custom.usuarios e auth_custom.usuarios_bares.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { RepositoryError } from '@/lib/errors';
import type { Usuario } from '@/lib/domain/usuario.types';

export class UsuariosRepository {
  constructor(private client: SupabaseClient) {}

  async findByEmail(email: string): Promise<Usuario | null> {
    const { data, error } = await this.client
      .schema('auth_custom')
      .from('usuarios')
      .select('*')
      .eq('email', email)
      .eq('ativo', true)
      .maybeSingle();
    if (error) throw new RepositoryError('usuarios.findByEmail', error);
    return (data as Usuario | null) ?? null;
  }

  async findByAuthId(authId: string): Promise<Usuario | null> {
    const { data, error } = await this.client
      .schema('auth_custom')
      .from('usuarios')
      .select('*')
      .eq('auth_id', authId)
      .eq('ativo', true)
      .maybeSingle();
    if (error) throw new RepositoryError('usuarios.findByAuthId', error);
    return (data as Usuario | null) ?? null;
  }

  async findById(id: number): Promise<Usuario | null> {
    const { data, error } = await this.client
      .schema('auth_custom')
      .from('usuarios')
      .select('*')
      .eq('id', id)
      .eq('ativo', true)
      .maybeSingle();
    if (error) throw new RepositoryError('usuarios.findById', error);
    return (data as Usuario | null) ?? null;
  }

  /** Atualiza auth_id de um usuario (usado no login para vincular). */
  async updateAuthId(email: string, authId: string): Promise<void> {
    const { error } = await this.client
      .schema('auth_custom')
      .from('usuarios')
      .update({ auth_id: authId })
      .eq('email', email);
    if (error) throw new RepositoryError('usuarios.updateAuthId', error);
  }

  /** Lista IDs dos bares vinculados a um usuario. */
  async listarBarIdsDoUsuario(authId: string): Promise<number[]> {
    const { data, error } = await this.client
      .schema('auth_custom')
      .from('usuarios_bares')
      .select('bar_id')
      .eq('usuario_id', authId);
    if (error) throw new RepositoryError('usuarios.listarBarIdsDoUsuario', error);
    return ((data ?? []) as Array<{ bar_id: number }>).map((r) => r.bar_id);
  }

  /** Verifica se usuario tem acesso a um bar especifico. */
  async temAcessoAoBar(authId: string, barId: number): Promise<boolean> {
    const { data, error } = await this.client
      .schema('auth_custom')
      .from('usuarios_bares')
      .select('bar_id')
      .eq('usuario_id', authId)
      .eq('bar_id', barId)
      .maybeSingle();
    if (error) throw new RepositoryError('usuarios.temAcessoAoBar', error);
    return data !== null;
  }
}
