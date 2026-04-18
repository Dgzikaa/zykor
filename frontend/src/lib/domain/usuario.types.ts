/**
 * Type "Usuario" do dominio (auth_custom.usuarios).
 */

export type Usuario = {
  id: number;
  auth_id: string;
  email: string;
  nome: string;
  role: 'admin' | 'financeiro' | 'funcionario';
  setor?: string | null;
  modulos_permitidos: string[] | Record<string, boolean> | null;
  ativo: boolean;
  senha_redefinida?: boolean | null;
  telefone?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

/**
 * Normaliza modulos_permitidos para array de strings.
 */
export function normalizarModulos(
  raw: Usuario['modulos_permitidos']
): string[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    return Object.keys(raw).filter((k) => (raw as Record<string, boolean>)[k]);
  }
  return [];
}
