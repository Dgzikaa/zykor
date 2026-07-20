/**
 * Service: lista os bares ativos vinculados a um usuario,
 * enriquecidos com permissoes do usuario.
 */
import { repos } from '@/lib/repositories';
import { NotFoundError } from '@/lib/errors';
import { normalizarModulos, type Usuario } from '@/lib/domain/usuario.types';

export type BarComPermissoes = {
  id: number;
  nome: string;
  modulos_permitidos: string[];
  role: string;
  setor?: string | null;
  logo_url?: string | null;
  // Whitelist de ROTAS visíveis neste bar (config.modulos_visiveis). Vazio/ausente = mostra tudo.
  // Diferente de modulos_permitidos (permissão do USUÁRIO): isto é do BAR e vale pra todos, inclusive admin.
  modulos_visiveis: string[];
};

export type ListarBaresOutput = {
  bars: BarComPermissoes[];
  userData: Usuario;
};

export async function listarBaresDoUsuario(email: string): Promise<ListarBaresOutput> {
  const { usuarios, bares } = await repos();

  const usuario = await usuarios.findByEmail(email);
  if (!usuario) {
    throw new NotFoundError('Usuario', email);
  }

  const barIds = await usuarios.listarBarIdsDoUsuario(usuario.auth_id);
  if (barIds.length === 0) {
    throw new NotFoundError('Acesso a bares', `usuario ${usuario.email}`);
  }

  const baresAtivos = await bares.findActiveByIds(barIds);
  if (baresAtivos.length === 0) {
    throw new NotFoundError('Bares ativos', `usuario ${usuario.email}`);
  }

  const modulos = normalizarModulos(usuario.modulos_permitidos);

  return {
    bars: baresAtivos.map((b) => ({
      id: b.id,
      nome: b.nome,
      modulos_permitidos: modulos,
      role: usuario.role ?? 'funcionario',
      setor: usuario.setor,
      logo_url: (b.config?.logo_url as string) ?? null,
      modulos_visiveis: Array.isArray(b.config?.modulos_visiveis)
        ? (b.config!.modulos_visiveis as string[])
        : [],
    })),
    userData: usuario,
  };
}
