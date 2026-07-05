/**
 * Catálogo de eventos de notificação do Zykor.
 *
 * Fonte única da verdade sobre "o que pode notificar você". Usado por:
 *  - UI (Central de Notificações → aba Regras): renderiza a matriz evento × canal.
 *  - Dispatcher (server): valida `event_key`, aplica severidade/categoria/url padrão.
 *
 * É TypeScript puro (sem imports server-only) pra rodar nos dois lados.
 *
 * Pra adicionar um evento novo: acrescente uma entrada aqui e chame
 * `dispatchNotification({ eventKey: '<key>', ... })` de onde o fato acontece.
 */

export type Canal = 'in_app' | 'push' | 'whatsapp';
export type Severidade = 'info' | 'sucesso' | 'alerta' | 'critico';
export type CategoriaEvento =
  | 'operacional'
  | 'financeiro'
  | 'eventos'
  | 'estoque'
  | 'nps'
  | 'sistema';

export interface NotificationEvent {
  /** chave estável — gravada em system.notificacoes.event_key e nas regras */
  key: string;
  /** rótulo curto pra UI */
  label: string;
  /** o que dispara este evento (mostrado como ajuda na tela de regras) */
  descricao: string;
  categoria: CategoriaEvento;
  /** severidade default (a UI/cor usa; o dispatcher pode sobrescrever) */
  severidadePadrao: Severidade;
  /** canais que fazem sentido pra este evento (a UI só oferece esses) */
  canaisSuportados: Canal[];
  /** caminho padrão pra abrir ao clicar (o dispatcher pode sobrescrever com id) */
  urlPadrao?: string;
}

export const CATEGORIAS: Record<CategoriaEvento, { label: string; emoji: string }> = {
  operacional: { label: 'Operacional', emoji: '🛠️' },
  financeiro: { label: 'Financeiro', emoji: '💰' },
  eventos: { label: 'Eventos & Metas', emoji: '🎯' },
  estoque: { label: 'Estoque & Compras', emoji: '📦' },
  nps: { label: 'NPS & Clientes', emoji: '⭐' },
  sistema: { label: 'Sistema', emoji: '⚙️' },
};

export const CANAIS: Record<Canal, { label: string; emoji: string; disponivel: boolean }> = {
  in_app: { label: 'No Zykor', emoji: '🔔', disponivel: true },
  push: { label: 'Push (celular)', emoji: '📱', disponivel: true },
  // WhatsApp entra quando o Umbler Talk estiver configurado (canal oficial).
  whatsapp: { label: 'WhatsApp', emoji: '💬', disponivel: false },
};

/**
 * Registro dos eventos. A ordem aqui é a ordem de exibição na tela de regras.
 */
export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  // ---- Operacional ----
  {
    key: 'producao_criada',
    label: 'Controle de produção criado',
    descricao: 'Quando um novo controle de produção é aberto, avisa o responsável.',
    categoria: 'operacional',
    severidadePadrao: 'info',
    canaisSuportados: ['in_app', 'push', 'whatsapp'],
    urlPadrao: '/operacional/producoes',
  },
  {
    key: 'checklist_vencido',
    label: 'Checklist vencido',
    descricao: 'Checklist obrigatório passou do horário sem ser concluído.',
    categoria: 'operacional',
    severidadePadrao: 'alerta',
    canaisSuportados: ['in_app', 'push', 'whatsapp'],
    urlPadrao: '/operacional/checklists',
  },
  {
    key: 'checklist_concluido',
    label: 'Checklist concluído',
    descricao: 'Um checklist foi finalizado pela equipe.',
    categoria: 'operacional',
    severidadePadrao: 'sucesso',
    canaisSuportados: ['in_app', 'push'],
    urlPadrao: '/operacional/checklists',
  },

  // ---- Financeiro ----
  {
    key: 'pendencia_financeira',
    label: 'Pendência financeira',
    descricao: 'Lançamento pendente/atrasado que precisa de atenção.',
    categoria: 'financeiro',
    severidadePadrao: 'alerta',
    canaisSuportados: ['in_app', 'push', 'whatsapp'],
    urlPadrao: '/financeiro/pendencias',
  },
  {
    key: 'pedido_pagamento_novo',
    label: 'Novo pedido de pagamento',
    descricao: 'Um novo pedido de pagamento foi lançado e aguarda aprovação.',
    categoria: 'financeiro',
    severidadePadrao: 'info',
    canaisSuportados: ['in_app', 'push', 'whatsapp'],
    urlPadrao: '/financeiro/pedidos-pagamento',
  },
  {
    key: 'caixa_apertado',
    label: 'Caixa apertado',
    descricao: 'Projeção de fluxo de caixa negativa nos próximos dias.',
    categoria: 'financeiro',
    severidadePadrao: 'critico',
    canaisSuportados: ['in_app', 'push', 'whatsapp'],
    urlPadrao: '/financeiro/dfc',
  },
  {
    key: 'conciliacao_pendente',
    label: 'Conciliação pendente',
    descricao: 'Movimentos sem conciliação fiscal/bancária acumulados.',
    categoria: 'financeiro',
    severidadePadrao: 'alerta',
    canaisSuportados: ['in_app', 'push'],
    urlPadrao: '/financeiro/conciliacao',
  },

  // ---- Eventos & Metas ----
  {
    key: 'meta_batida',
    label: 'Meta batida',
    descricao: 'A meta semanal/mensal do bar foi atingida.',
    categoria: 'eventos',
    severidadePadrao: 'sucesso',
    canaisSuportados: ['in_app', 'push', 'whatsapp'],
    urlPadrao: '/estrategico/desempenho',
  },

  // ---- Estoque & Compras ----
  {
    key: 'estoque_falta',
    label: 'Item em falta',
    descricao: 'Insumo de curva A abaixo do mínimo / stockout detectado.',
    categoria: 'estoque',
    severidadePadrao: 'alerta',
    canaisSuportados: ['in_app', 'push', 'whatsapp'],
    urlPadrao: '/operacional/estoque',
  },

  // ---- NPS & Clientes ----
  {
    key: 'nps_baixo',
    label: 'NPS baixo',
    descricao: 'Nota de NPS/avaliação abaixo do limite no período.',
    categoria: 'nps',
    severidadePadrao: 'alerta',
    canaisSuportados: ['in_app', 'push', 'whatsapp'],
    urlPadrao: '/estrategico/nps',
  },

  // ---- Sistema ----
  {
    key: 'sistema_alerta',
    label: 'Alerta do sistema',
    descricao: 'Falha de pipeline, sync ou integridade de dados.',
    categoria: 'sistema',
    severidadePadrao: 'critico',
    canaisSuportados: ['in_app', 'push'],
    urlPadrao: '/configuracoes/saude-dos-dados',
  },
  {
    key: 'aviso_manual',
    label: 'Aviso manual (broadcast)',
    descricao: 'Recado enviado manualmente por um admin para a equipe (ex: reunião, comunicado).',
    categoria: 'sistema',
    severidadePadrao: 'info',
    canaisSuportados: ['in_app', 'push', 'whatsapp'],
  },
];

/** Eventos que NÃO aparecem na matriz de regras (roteamento próprio). */
export const EVENTOS_OCULTOS_NA_MATRIZ = new Set<string>(['aviso_manual']);

const EVENTS_BY_KEY = new Map(NOTIFICATION_EVENTS.map((e) => [e.key, e]));

export function getEvent(key: string): NotificationEvent | undefined {
  return EVENTS_BY_KEY.get(key);
}

export function isValidEventKey(key: string): key is string {
  return EVENTS_BY_KEY.has(key);
}

/** Eventos agrupados por categoria, na ordem do catálogo — pra render da matriz. */
export function eventsByCategoria(): Array<{
  categoria: CategoriaEvento;
  label: string;
  emoji: string;
  eventos: NotificationEvent[];
}> {
  const ordem: CategoriaEvento[] = [
    'operacional',
    'financeiro',
    'eventos',
    'estoque',
    'nps',
    'sistema',
  ];
  return ordem
    .map((categoria) => ({
      categoria,
      label: CATEGORIAS[categoria].label,
      emoji: CATEGORIAS[categoria].emoji,
      eventos: NOTIFICATION_EVENTS.filter(
        (e) => e.categoria === categoria && !EVENTOS_OCULTOS_NA_MATRIZ.has(e.key)
      ),
    }))
    .filter((g) => g.eventos.length > 0);
}
