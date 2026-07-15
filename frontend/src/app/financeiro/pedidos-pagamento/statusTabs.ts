import type { Pedido } from './types';

export type TabKey = 'solicitado' | 'aprovado' | 'finalizado' | 'recusado' | 'todos' | 'consolidado';

// Fluxo real (ciclo do Inter):
//  - "Solicitado" = espera a APROVAÇÃO do financeiro.
//  - "Aprovado" = aprovado (financeiro ainda vai SUBIR) + subido/aguardando o OK do sócio no
//    app do Inter (`aguardando_socio`, laranja) + erros de agendamento (retry). Ou seja, tudo
//    que AINDA depende de alguém do financeiro/sócio agir.
//  - "Finalizado" = o sócio já aprovou no Inter → sai da alçada do financeiro: `agendado`
//    (aguarda a data), `pago` (efetivado) e `reprovado` (sócio recusou — registro).
//  - "Consolidado" NÃO é filtro de status: é a visão diária (renderizada à parte); junta o
//    que está em andamento + finalizado.
export const TAB_STATUS: Record<TabKey, (s: string) => boolean> = {
  solicitado: (s) => s === 'aguardando_aprovacao',
  aprovado: (s) => ['aprovado', 'agendando', 'aguardando_socio', 'erro_ca', 'erro_inter'].includes(s),
  finalizado: (s) => ['agendado', 'pago', 'reprovado'].includes(s),
  recusado: (s) => s === 'rejeitado' || s === 'cancelado',
  todos: () => true,
  consolidado: (s) => ['aprovado', 'agendando', 'aguardando_socio', 'agendado', 'pago', 'reprovado', 'erro_ca', 'erro_inter'].includes(s),
};

// Boleto NÃO tem tipo próprio: é um pedido de fornecedor com linha digitável (ou, quando a
// linha não foi lida, descrição começando com "Boleto"). Usado p/ separar boletos do PIX.
export const isBoleto = (p: Pedido): boolean =>
  p.tipo === 'fornecedor' && (!!p.linha_digitavel || /^boleto\b/i.test((p.descricao || '').trim()));
