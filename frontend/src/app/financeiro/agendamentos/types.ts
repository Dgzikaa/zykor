export interface PagamentoAgendamento {
  id: string;
  cpf_cnpj: string;
  nome_beneficiario: string;
  chave_pix: string;
  valor: string;
  descricao: string;
  data_pagamento: string;
  data_competencia: string;
  categoria_id: string;
  categoria_nome?: string;
  centro_custo_id: string;
  centro_custo_nome?: string;
  codigo_solic?: string;
  status:
    | 'pendente'
    | 'agendado'
    | 'aguardando_aprovacao'
    | 'aprovado'
    | 'erro'
    | 'erro_inter'
    | 'erro_ca';
  stakeholder_id?: string;
  agendamento_id?: string;
  inter_aprovacao_id?: string;
  /** UUID do lancamento criado no Conta Azul (DESPESA / conta a pagar) */
  contaazul_lancamento_id?: string;
  /** UUID do fornecedor (pessoa) no Conta Azul — vem do match na importação */
  contaazul_pessoa_id?: string;
  /** Mensagem do erro CA, exibida quando status='erro_ca' */
  erro_mensagem?: string;
  bar_id?: number;
  bar_nome?: string;
  criado_por_id?: string;
  criado_por_nome?: string;
  atualizado_por_id?: string;
  atualizado_por_nome?: string;
  created_at: string;
  updated_at: string;
}

export interface Stakeholder {
  id: string;
  name: string;
  document: string;
  email?: string;
  phone?: string;
  type: 'fornecedor' | 'socio' | 'funcionario';
  pixKey?: string; // Adicionado para verificar a chave PIX
}

export interface InterCredencial {
  id: number;
  nome: string;
  cnpj?: string | null;
  conta_corrente?: string | null;
}

export interface FolhaPreviewItem {
  nome: string;
  pix: string;
  cargo: string;
  total: number;
}
