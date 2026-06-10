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

export interface Pedido {
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
  aprovado_por_nome?: string | null;
  aprovado_em?: string | null;
  rejeitado_por_nome?: string | null;
  motivo_rejeicao?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comentario {
  id: string;
  pedido_id: string;
  autor_id?: string | null;
  autor_nome?: string | null;
  mensagem: string;
  tipo: 'comentario' | 'sistema';
  created_at: string;
}

export interface Anexo {
  id: string;
  pedido_id: string;
  nome_original?: string | null;
  tipo_arquivo?: string | null;
  tamanho_bytes?: number | null;
  url_publica?: string | null;
  created_at: string;
}

export interface HistoricoItem {
  id: string;
  campo?: string | null;
  valor_anterior?: string | null;
  valor_novo?: string | null;
  autor_nome?: string | null;
  created_at: string;
}

export const TIPO_LABEL: Record<PedidoTipo, string> = {
  reembolso: 'Reembolso',
  fornecedor: 'Fornecedor',
  avulso: 'Avulso',
  adiantamento: 'Adiantamento/Vale',
};

export const STATUS_LABEL: Record<PedidoStatus, string> = {
  rascunho: 'Rascunho',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  agendado: 'Agendado',
  pago: 'Pago',
  erro_ca: 'Erro Conta Azul',
  erro_inter: 'Erro Inter',
  rejeitado: 'Rejeitado',
  cancelado: 'Cancelado',
};

export const STATUS_COLOR: Record<PedidoStatus, string> = {
  rascunho: 'bg-gray-500/15 text-gray-600',
  aguardando_aprovacao: 'bg-amber-500/15 text-amber-600',
  aprovado: 'bg-blue-500/15 text-blue-600',
  agendado: 'bg-indigo-500/15 text-indigo-600',
  pago: 'bg-green-500/15 text-green-600',
  erro_ca: 'bg-red-500/15 text-red-600',
  erro_inter: 'bg-red-500/15 text-red-600',
  rejeitado: 'bg-red-500/15 text-red-600',
  cancelado: 'bg-gray-500/15 text-gray-500',
};

export const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
