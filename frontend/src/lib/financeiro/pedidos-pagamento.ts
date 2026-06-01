/**
 * Helpers compartilhados do módulo "Pedidos de Pagamento".
 *
 * Tabelas vivem no schema `financial` (já exposto no PostgREST, igual pix_enviados).
 * Acesso sempre via service-role + .schema('financial').
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedUser } from '@/middleware/auth';
import { userHasModule } from '@/lib/permissions/resolver';

export type PedidoTipo = 'reembolso' | 'fornecedor' | 'avulso' | 'adiantamento';

export type PedidoStatus =
  | 'rascunho'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'agendado'
  | 'pago'
  | 'erro_ca'
  | 'erro_inter'
  | 'rejeitado'
  | 'cancelado';

export const TIPOS_VALIDOS: PedidoTipo[] = ['reembolso', 'fornecedor', 'avulso', 'adiantamento'];

/** Status em que o solicitante ainda pode editar/cancelar o próprio pedido. */
export const STATUS_EDITAVEL_SOLICITANTE: PedidoStatus[] = ['rascunho', 'aguardando_aprovacao'];

/** Status que permitem (re)processar a aprovação (novo ou retry após falha parcial). */
export const STATUS_APROVAVEL: PedidoStatus[] = ['aguardando_aprovacao', 'erro_ca', 'erro_inter'];

export interface PedidoPagamento {
  id: string;
  numero?: string | null;
  bar_id: number;
  tipo: PedidoTipo;
  status: PedidoStatus;
  solicitante_id?: string | null;
  solicitante_nome?: string | null;
  descricao: string;
  valor: number;
  data_competencia?: string | null;
  data_vencimento: string;
  beneficiario_nome?: string | null;
  chave_pix?: string | null;
  tipo_chave?: string | null;
  cpf_cnpj?: string | null;
  observacao?: string | null;
  categoria_id?: string | null;
  categoria_nome?: string | null;
  centro_custo_id?: string | null;
  centro_custo_nome?: string | null;
  contaazul_pessoa_id?: string | null;
  conta_financeira_id?: string | null;
  inter_credencial_id?: number | null;
  contaazul_lancamento_id?: string | null;
  inter_codigo_solicitacao?: string | null;
  erro_mensagem?: string | null;
  aprovado_por_id?: string | null;
  aprovado_por_nome?: string | null;
  aprovado_em?: string | null;
  rejeitado_por_id?: string | null;
  rejeitado_por_nome?: string | null;
  rejeitado_em?: string | null;
  motivo_rejeicao?: string | null;
  pago_em?: string | null;
  criado_por?: string | null;
  atualizado_por?: string | null;
  created_at: string;
  updated_at: string;
}

/** Cliente apontado pro schema financial. */
export function fin(supabase: SupabaseClient) {
  return supabase.schema('financial' as any) as any;
}

/**
 * Pode aprovar/rejeitar/editar pedidos de outras pessoas?
 * Financeiro/admin por role, ou quem tem o módulo financeiro/agendamento.
 * Segue o resolver único (sem .includes cru em modulos_permitidos).
 */
export function podeAprovar(user: AuthenticatedUser): boolean {
  if (user.role === 'admin' || user.role === 'financeiro') return true;
  return userHasModule(user.modulos_permitidos, 'ferramentas_agendamento');
}

/** Registra uma linha de auditoria de mudança de campo/status. */
export async function registrarHistorico(
  supabase: SupabaseClient,
  params: {
    pedido_id: string;
    bar_id: number;
    autor: AuthenticatedUser;
    campo: string;
    valor_anterior?: unknown;
    valor_novo?: unknown;
  }
): Promise<void> {
  const toText = (v: unknown) =>
    v === null || v === undefined ? null : typeof v === 'string' ? v : JSON.stringify(v);
  await fin(supabase)
    .from('pedidos_pagamento_historico')
    .insert({
      pedido_id: params.pedido_id,
      bar_id: params.bar_id,
      autor_id: params.autor.auth_id,
      autor_nome: params.autor.nome,
      campo: params.campo,
      valor_anterior: toText(params.valor_anterior),
      valor_novo: toText(params.valor_novo),
    });
}

/** Comentário automático do sistema (transições importantes na thread). */
export async function comentarioSistema(
  supabase: SupabaseClient,
  params: { pedido_id: string; bar_id: number; mensagem: string }
): Promise<void> {
  await fin(supabase)
    .from('pedidos_pagamento_comentarios')
    .insert({
      pedido_id: params.pedido_id,
      bar_id: params.bar_id,
      autor_id: null,
      autor_nome: 'Sistema',
      mensagem: params.mensagem,
      tipo: 'sistema',
    });
}

/** Formata valor numérico em BRL pra mensagens. */
export function formatBRL(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}
