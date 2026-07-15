export type PedidoTipo = 'reembolso' | 'fornecedor' | 'avulso' | 'adiantamento' | 'freela' | 'cartao';

export type PedidoStatus =
  | 'rascunho'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'agendando'
  | 'aguardando_socio'
  | 'agendado'
  | 'pago'
  | 'reprovado'
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
  precisa_comprovante?: boolean | null;
  pix_copia_cola?: string | null;
  linha_digitavel?: string | null;
  categoria_id?: string | null;
  categoria_nome?: string | null;
  categoria_sugerida_id?: string | null;
  categoria_sugerida_nome?: string | null;
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

export interface Competencia {
  id: string;
  pedido_id: string;
  data_competencia: string;
  valor: number;
  descricao?: string | null;
  categoria_id?: string | null;
  categoria_nome?: string | null;
  contaazul_lancamento_id?: string | null;
  ordem: number;
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
  freela: 'Freela',
  cartao: 'Cartão',
};

export const STATUS_LABEL: Record<PedidoStatus, string> = {
  rascunho: 'Rascunho',
  aguardando_aprovacao: 'Aguardando aprovação',
  aprovado: 'Aprovado',
  agendando: 'Agendando…',
  aguardando_socio: 'Aguardando aprovação sócio',
  agendado: 'Agendado',
  pago: 'Pago',
  reprovado: 'Recusado pelo sócio',
  erro_ca: 'Erro Conta Azul',
  erro_inter: 'Erro Inter',
  rejeitado: 'Rejeitado',
  cancelado: 'Cancelado',
};

export const STATUS_COLOR: Record<PedidoStatus, string> = {
  rascunho: 'bg-gray-500/15 text-gray-600',
  aguardando_aprovacao: 'bg-amber-500/15 text-amber-600',
  aprovado: 'bg-blue-500/15 text-blue-600',
  agendando: 'bg-indigo-500/15 text-indigo-600 animate-pulse',
  // Subido ao Inter, esperando o OK do sócio no app — LARANJA (diferencia do resto).
  aguardando_socio: 'bg-orange-500/15 text-orange-600',
  agendado: 'bg-indigo-500/15 text-indigo-600',
  pago: 'bg-green-500/15 text-green-600',
  reprovado: 'bg-red-500/15 text-red-600',
  erro_ca: 'bg-red-500/15 text-red-600',
  erro_inter: 'bg-red-500/15 text-red-600',
  rejeitado: 'bg-red-500/15 text-red-600',
  cancelado: 'bg-gray-500/15 text-gray-500',
};

/**
 * Label do status, DINÂMICO pra 'agendado' (sócio já aprovou no Inter, aguarda a data):
 * mostra "Agendado p/ DD/MM" quando o vencimento é FUTURO; "Agendado" caso contrário. O
 * estado ANTERIOR (subido, esperando o sócio) é o status próprio `aguardando_socio` (laranja).
 * O webhook do Inter promove aguardando_socio → agendado (sócio ok) → pago (efetivado) sozinho.
 * Os demais status seguem o STATUS_LABEL fixo.
 */
export function statusLabel(p: { status: string; data_vencimento?: string | null }): string {
  if (p.status === 'agendado') {
    const venc = p.data_vencimento || '';
    const hoje = new Date().toISOString().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(venc) && venc > hoje) {
      const [, m, d] = venc.split('-');
      return `Agendado p/ ${d}/${m}`;
    }
    return 'Agendado';
  }
  return STATUS_LABEL[p.status as PedidoStatus] ?? p.status;
}

export const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
