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

  /**
   * Resolve os auth_ids dos usuarios ATIVOS de um bar com um dos cargos dados.
   * Usado pelo dispatcher de notificacoes p/ transformar `target_roles` em destinatarios.
   */
  async listarAuthIdsPorBarERoles(barId: number, roles: string[]): Promise<string[]> {
    if (!roles.length) return [];

    // 1) auth_ids vinculados ao bar
    const { data: vinculos, error: eV } = await this.client
      .schema('auth_custom')
      .from('usuarios_bares')
      .select('usuario_id')
      .eq('bar_id', barId);
    if (eV) throw new RepositoryError('usuarios.listarAuthIdsPorBarERoles.vinculos', eV);

    const authIdsDoBar = ((vinculos ?? []) as Array<{ usuario_id: string }>)
      .map((r) => r.usuario_id)
      .filter(Boolean);
    if (!authIdsDoBar.length) return [];

    // 2) filtra por cargo + ativo
    const { data: users, error: eU } = await this.client
      .schema('auth_custom')
      .from('usuarios')
      .select('auth_id')
      .in('auth_id', authIdsDoBar)
      .in('role', roles)
      .eq('ativo', true);
    if (eU) throw new RepositoryError('usuarios.listarAuthIdsPorBarERoles.users', eU);

    return ((users ?? []) as Array<{ auth_id: string | null }>)
      .map((u) => u.auth_id)
      .filter((id): id is string => !!id);
  }

  /**
   * Lista usuarios ATIVOS de um bar (auth_id, nome, email, role) —
   * pra montar o seletor de "usuarios especificos" na tela de regras.
   */
  async listarDoBar(
    barId: number
  ): Promise<Array<{ auth_id: string; nome: string | null; email: string; role: string }>> {
    const { data: vinculos, error: eV } = await this.client
      .schema('auth_custom')
      .from('usuarios_bares')
      .select('usuario_id')
      .eq('bar_id', barId);
    if (eV) throw new RepositoryError('usuarios.listarDoBar.vinculos', eV);

    const authIds = ((vinculos ?? []) as Array<{ usuario_id: string }>)
      .map((r) => r.usuario_id)
      .filter(Boolean);
    if (!authIds.length) return [];

    const { data: users, error: eU } = await this.client
      .schema('auth_custom')
      .from('usuarios')
      .select('auth_id, nome, email, role')
      .in('auth_id', authIds)
      .eq('ativo', true)
      .order('nome', { ascending: true });
    if (eU) throw new RepositoryError('usuarios.listarDoBar.users', eU);

    return ((users ?? []) as Array<{
      auth_id: string | null;
      nome: string | null;
      email: string;
      role: string;
    }>)
      .filter((u) => !!u.auth_id)
      .map((u) => ({ auth_id: u.auth_id as string, nome: u.nome, email: u.email, role: u.role }));
  }
}
