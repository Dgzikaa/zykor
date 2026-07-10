import type { Pedido } from './types';

export type TabKey = 'solicitado' | 'aprovado' | 'recusado' | 'todos';

// Fluxo 2 etapas: "Solicitado" = só o que espera APROVAÇÃO. "Aprovado" agrupa
// aprovado/agendado/pago + os erros de AGENDAMENTO (erro_ca/erro_inter) — que acontecem
// depois da aprovação e precisam de "Agendar" de novo.
export const TAB_STATUS: Record<TabKey, (s: string) => boolean> = {
  solicitado: (s) => s === 'aguardando_aprovacao',
  aprovado: (s) => ['aprovado', 'agendado', 'pago', 'erro_ca', 'erro_inter'].includes(s),
  recusado: (s) => s === 'rejeitado' || s === 'cancelado',
  todos: () => true,
};

// Boleto NÃO tem tipo próprio: é um pedido de fornecedor com linha digitável (ou, quando a
// linha não foi lida, descrição começando com "Boleto"). Usado p/ separar boletos do PIX.
export const isBoleto = (p: Pedido): boolean =>
  p.tipo === 'fornecedor' && (!!p.linha_digitavel || /^boleto\b/i.test((p.descricao || '').trim()));
