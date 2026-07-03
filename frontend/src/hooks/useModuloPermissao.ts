'use client';

import { usePermissions } from './usePermissions';
import { getModuleIdForPath } from '@/lib/permissions/modules';

/**
 * Permissão de UM módulo, pronta pra UI. Recebe o path da página (ex.: '/operacional/insumos')
 * OU o id canônico do módulo. Espelha o guard do backend (userCan) — mas lembre: esconder botão
 * é só UX; a trava real é o guard na rota (negarPorRota → 403). Admin recebe tudo true.
 *
 *   const { soLeitura, podeInserir, podeEditar, podeExcluir } = useModuloPermissao('/operacional/insumos');
 *   <button disabled={!podeInserir}>Novo</button>
 *   {soLeitura && <BadgeSomenteLeitura />}
 */
export function useModuloPermissao(pathOrModuleId: string) {
  const { can } = usePermissions();
  const moduloId = pathOrModuleId.startsWith('/')
    ? getModuleIdForPath(pathOrModuleId) || ''
    : pathOrModuleId;

  const podeVer = can(moduloId, 'ver');
  const podeEditar = can(moduloId, 'editar');
  const podeInserir = can(moduloId, 'inserir');
  const podeExcluir = can(moduloId, 'excluir');
  // vê mas não pode nenhuma escrita = somente leitura
  const soLeitura = podeVer && !podeEditar && !podeInserir && !podeExcluir;

  return { moduloId, podeVer, podeEditar, podeInserir, podeExcluir, soLeitura };
}
