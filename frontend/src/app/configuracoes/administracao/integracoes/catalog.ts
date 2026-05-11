/**
 * Catálogo central de integrações do Zykor.
 *
 * Source-of-truth: a UI e o endpoint da página de integrações leem daqui
 * pra saber onde achar credenciais, sync logs, volumes, e como agrupar
 * por categoria.
 */

export type Categoria =
  | 'pdv'
  | 'financeiro'
  | 'reservas'
  | 'eventos'
  | 'marketing'
  | 'comunicacao'
  | 'reviews'
  | 'ia'
  | 'infra';

export type StatusCredencial = 'ok' | 'ausente' | 'expirando' | 'expirado' | 'desativada';
export type StatusGeral = 'conectada' | 'parcial' | 'desconectada' | 'nao_configurada';

export interface FonteAuth {
  /** api_credentials: lê linha onde sistema=X e bar_id=N. Aceita aliases. */
  tipo: 'api_credentials' | 'tabela' | 'env_global' | 'oauth_table';
  sistema?: string[]; // aliases pra api_credentials.sistema
  schema?: string;
  tabela?: string;
  colunaBar?: string; // default 'bar_id'
  envs?: string[]; // pra env_global, nomes das vars esperadas
}

export interface FonteSync {
  schema: string;
  tabela: string;
  colunaTempo: string;
  colunaBar?: string; // default 'bar_id'
  colunaStatus?: string;
}

export interface AcaoIntegracao {
  id: string;
  label: string;
  tipo:
    | 'instagram_connect'
    | 'instagram_disconnect'
    | 'ver_logs'
    | 'sincronizar_manual'
    | 'editar_credencial'
    | 'externa'; // link externo
  url?: string;
}

export interface IntegracaoCatalogo {
  id: string;
  nome: string;
  descricao: string;
  categoria: Categoria;
  /** Inicial(is) usadas como "logo" estilizado. Ex: "CH" pra ContaHub */
  logoLabel: string;
  /** Cor da marca em hex — fundo do logo */
  logoCor: string;
  /** Cor de acento (badges, hover) — sigla tailwind tipo 'orange-500' */
  acento: string;
  /** Se true, integração é global (não tem variação por bar) */
  global?: boolean;
  fontesAuth: FonteAuth[];
  /** Última sync pode vir de várias fontes — pega o MAX */
  fontesSync?: FonteSync[];
  /** Tabela bronze pra contar volume nos últimos 7d (opcional) */
  volumeTabela?: {
    schema: string;
    tabela: string;
    colunaTempo: string;
    colunaBar?: string;
  };
  /** Nomes de cron jobs que afetam essa integração */
  crons?: string[];
  acoes?: AcaoIntegracao[];
}

export const CATALOGO_INTEGRACOES: IntegracaoCatalogo[] = [
  // ─── PDV ─────────────────────────────────────────────────────────────
  {
    id: 'contahub',
    nome: 'ContaHub',
    descricao: 'PDV — vendas, produtos, pagamentos, cancelamentos',
    categoria: 'pdv',
    logoLabel: 'CH',
    logoCor: '#F97316',
    acento: 'orange-500',
    fontesAuth: [
      { tipo: 'env_global', envs: ['CONTAHUB_EMAIL', 'CONTAHUB_PASSWORD', 'CONTAHUB_BASE_URL'] },
      { tipo: 'api_credentials', sistema: ['contahub'] },
    ],
    fontesSync: [
      { schema: 'system', tabela: 'sync_logs_contahub', colunaTempo: 'created_at', colunaStatus: 'status' },
    ],
    volumeTabela: { schema: 'bronze', tabela: 'bronze_contahub_raw_data', colunaTempo: 'criado_em' },
    crons: ['contahub-orquestrador'],
  },

  // ─── FINANCEIRO ──────────────────────────────────────────────────────
  {
    id: 'contaazul',
    nome: 'Conta Azul',
    descricao: 'ERP financeiro — lançamentos, categorias, centros de custo',
    categoria: 'financeiro',
    logoLabel: 'CA',
    logoCor: '#0066B3',
    acento: 'blue-600',
    fontesAuth: [{ tipo: 'api_credentials', sistema: ['conta_azul', 'contaazul'] }],
    fontesSync: [
      { schema: 'bronze', tabela: 'bronze_contaazul_sync_log', colunaTempo: 'data_inicio', colunaStatus: 'status' },
      { schema: 'integrations', tabela: 'contaazul_logs_sincronizacao', colunaTempo: 'data_inicio', colunaStatus: 'status' },
    ],
    volumeTabela: { schema: 'bronze', tabela: 'bronze_contaazul_lancamentos', colunaTempo: 'data_competencia' },
    crons: ['contaazul-sync'],
  },
  {
    id: 'nibo',
    nome: 'NIBO',
    descricao: 'Contas a pagar/receber — DRE alternativo (legado)',
    categoria: 'financeiro',
    logoLabel: 'NB',
    logoCor: '#7C3AED',
    acento: 'violet-600',
    fontesAuth: [
      { tipo: 'env_global', envs: ['NIBO_API_TOKEN', 'NIBO_ORGANIZATION_ID'] },
      { tipo: 'api_credentials', sistema: ['nibo'] },
    ],
    crons: ['nibo-sync'],
  },
  {
    id: 'inter',
    nome: 'Banco Inter',
    descricao: 'Extratos e movimentações bancárias',
    categoria: 'financeiro',
    logoLabel: 'IN',
    logoCor: '#FF7A00',
    acento: 'orange-600',
    fontesAuth: [{ tipo: 'api_credentials', sistema: ['inter', 'banco_inter'] }],
  },

  // ─── RESERVAS / EVENTOS ──────────────────────────────────────────────
  {
    id: 'getin',
    nome: 'GetIn',
    descricao: 'Reservas — fila de espera, comparecimento, no-show',
    categoria: 'reservas',
    logoLabel: 'GI',
    logoCor: '#10B981',
    acento: 'emerald-500',
    fontesAuth: [{ tipo: 'api_credentials', sistema: ['getin'] }],
    fontesSync: [{ schema: 'integrations', tabela: 'getin_sync_logs', colunaTempo: 'created_at', colunaStatus: 'status', colunaBar: '' }],
    volumeTabela: { schema: 'bronze', tabela: 'bronze_getin_reservations', colunaTempo: 'criado_em' },
    crons: ['getin-sync-continuous'],
  },
  {
    id: 'sympla',
    nome: 'Sympla',
    descricao: 'Ingressos online — eventos, pedidos, participantes',
    categoria: 'eventos',
    logoLabel: 'SY',
    logoCor: '#FF7A00',
    acento: 'orange-500',
    fontesAuth: [
      { tipo: 'env_global', envs: ['SYMPLA_API_TOKEN'] },
      { tipo: 'api_credentials', sistema: ['sympla'] },
    ],
    fontesSync: [{ schema: 'bronze', tabela: 'bronze_sympla_sync_log', colunaTempo: 'executado_em', colunaStatus: 'status' }],
    volumeTabela: { schema: 'bronze', tabela: 'bronze_sympla_participantes', colunaTempo: 'criado_em' },
    crons: ['sympla-sync'],
  },
  {
    id: 'yuzer',
    nome: 'Yuzer',
    descricao: 'Bilheteria física — venda em portaria, pagamentos no evento',
    categoria: 'eventos',
    logoLabel: 'YZ',
    logoCor: '#EC4899',
    acento: 'pink-500',
    fontesAuth: [{ tipo: 'api_credentials', sistema: ['yuzer'] }],
    fontesSync: [{ schema: 'bronze', tabela: 'bronze_yuzer_sync_log', colunaTempo: 'executed_at', colunaStatus: 'status' }],
    volumeTabela: { schema: 'bronze', tabela: 'bronze_yuzer_eventos', colunaTempo: 'criado_em' },
    crons: ['yuzer-sync'],
  },

  // ─── MARKETING / SOCIAL ──────────────────────────────────────────────
  {
    id: 'instagram',
    nome: 'Instagram',
    descricao: 'Posts, stories, reels e insights de cada bar (OAuth Business)',
    categoria: 'marketing',
    logoLabel: 'IG',
    logoCor: '#E1306C',
    acento: 'pink-600',
    fontesAuth: [{ tipo: 'oauth_table', schema: 'integrations', tabela: 'instagram_contas' }],
    fontesSync: [{ schema: 'integrations', tabela: 'instagram_sync_logs', colunaTempo: 'iniciado_em', colunaStatus: 'status' }],
    crons: ['instagram-sync-stories', 'instagram-sync-posts', 'instagram-sync-account', 'instagram-sync-insights-posts'],
  },
  {
    id: 'meta_ads',
    nome: 'Meta Ads',
    descricao: 'Anúncios Facebook/Instagram — investimento, alcance, CTR',
    categoria: 'marketing',
    logoLabel: 'FB',
    logoCor: '#1877F2',
    acento: 'blue-600',
    global: true,
    fontesAuth: [
      {
        tipo: 'env_global',
        envs: ['META_APP_ID', 'META_APP_SECRET', 'META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_INSTAGRAM_ID'],
      },
    ],
  },

  // ─── REVIEWS ────────────────────────────────────────────────────────
  {
    id: 'google_reviews',
    nome: 'Google Reviews',
    descricao: 'Reviews do Google Maps (via Apify) — sentimento e respostas',
    categoria: 'reviews',
    logoLabel: 'GR',
    logoCor: '#4285F4',
    acento: 'blue-500',
    global: true,
    fontesAuth: [{ tipo: 'env_global', envs: ['APIFY_API_TOKEN'] }],
    volumeTabela: { schema: 'bronze', tabela: 'bronze_google_reviews', colunaTempo: 'data_review' },
    crons: ['apify-google-reviews-scraper'],
  },

  // ─── COMUNICAÇÃO ────────────────────────────────────────────────────
  {
    id: 'umbler',
    nome: 'Umbler Talk',
    descricao: 'Atendimento via WhatsApp — conversas, mensagens, webhooks',
    categoria: 'comunicacao',
    logoLabel: 'UM',
    logoCor: '#16A34A',
    acento: 'green-600',
    fontesAuth: [{ tipo: 'tabela', schema: 'integrations', tabela: 'umbler_config' }],
    volumeTabela: { schema: 'integrations', tabela: 'umbler_mensagens', colunaTempo: 'created_at' },
  },
  {
    id: 'falae',
    nome: 'Falaê',
    descricao: 'Pesquisa NPS — respostas e satisfação dos clientes',
    categoria: 'comunicacao',
    logoLabel: 'FL',
    logoCor: '#A855F7',
    acento: 'purple-500',
    fontesAuth: [
      { tipo: 'tabela', schema: 'integrations', tabela: 'falae_config' },
      { tipo: 'api_credentials', sistema: ['falae'] },
    ],
    volumeTabela: { schema: 'bronze', tabela: 'bronze_falae_respostas', colunaTempo: 'criado_em' },
  },
  {
    id: 'discord',
    nome: 'Discord',
    descricao: 'Notificações operacionais — alertas, erros, eventos críticos',
    categoria: 'comunicacao',
    logoLabel: 'DC',
    logoCor: '#5865F2',
    acento: 'indigo-500',
    global: true,
    fontesAuth: [
      {
        tipo: 'env_global',
        envs: [
          'DISCORD_CONTAHUB_WEBHOOK',
          'DISCORD_NIBO_WEBHOOK',
          'DISCORD_EVENTOS_WEBHOOK',
          'DISCORD_MARKETING_WEBHOOK',
          'DISCORD_CHECKLIST_WEBHOOK',
          'DISCORD_SECURITY_WEBHOOK',
        ],
      },
    ],
  },

  // ─── GOOGLE OAUTH (Sheets) ──────────────────────────────────────────
  {
    id: 'google_sheets',
    nome: 'Google Sheets',
    descricao: 'Planilhas (metas manuais, controle de eventos)',
    categoria: 'comunicacao',
    logoLabel: 'GS',
    logoCor: '#0F9D58',
    acento: 'green-600',
    fontesAuth: [
      { tipo: 'oauth_table', schema: 'integrations', tabela: 'google_oauth_tokens' },
      { tipo: 'env_global', envs: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_SERVICE_ACCOUNT_KEY', 'GOOGLE_SHEETS_API_KEY'] },
    ],
  },

  // ─── IA ─────────────────────────────────────────────────────────────
  {
    id: 'anthropic',
    nome: 'Anthropic Claude',
    descricao: 'IA — análise de reviews, agente estratégico, insights',
    categoria: 'ia',
    logoLabel: 'AN',
    logoCor: '#D97757',
    acento: 'amber-600',
    global: true,
    fontesAuth: [{ tipo: 'env_global', envs: ['ANTHROPIC_API_KEY'] }],
  },
  {
    id: 'openai',
    nome: 'OpenAI',
    descricao: 'IA backup — embeddings, fallback de classificação',
    categoria: 'ia',
    logoLabel: 'OA',
    logoCor: '#10A37F',
    acento: 'emerald-600',
    global: true,
    fontesAuth: [{ tipo: 'env_global', envs: ['OPENAI_API_KEY'] }],
  },
  {
    id: 'gemini',
    nome: 'Google Gemini',
    descricao: 'IA — uso pontual em jobs experimentais',
    categoria: 'ia',
    logoLabel: 'GE',
    logoCor: '#1A73E8',
    acento: 'blue-500',
    global: true,
    fontesAuth: [{ tipo: 'env_global', envs: ['GEMINI_API_KEY'] }],
  },

  // ─── INFRA ───────────────────────────────────────────────────────────
  {
    id: 'supabase',
    nome: 'Supabase',
    descricao: 'Banco PostgreSQL + Edge Functions + Storage + Auth',
    categoria: 'infra',
    logoLabel: 'SB',
    logoCor: '#3ECF8E',
    acento: 'emerald-500',
    global: true,
    fontesAuth: [
      {
        tipo: 'env_global',
        envs: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
      },
    ],
  },
  {
    id: 'vercel',
    nome: 'Vercel',
    descricao: 'Deploy Next.js + Edge Network + Crons',
    categoria: 'infra',
    logoLabel: 'VC',
    logoCor: '#000000',
    acento: 'gray-900',
    global: true,
    fontesAuth: [{ tipo: 'env_global', envs: ['VERCEL_URL', 'NEXT_PUBLIC_SITE_URL'] }],
  },
  {
    id: 'sentry',
    nome: 'Sentry',
    descricao: 'Monitoramento de erros (frontend + edge functions)',
    categoria: 'infra',
    logoLabel: 'SE',
    logoCor: '#362D59',
    acento: 'purple-700',
    global: true,
    fontesAuth: [{ tipo: 'env_global', envs: ['NEXT_PUBLIC_SENTRY_DSN', 'SENTRY_DSN'] }],
  },
];

export const CATEGORIA_INFO: Record<Categoria, { nome: string; descricao: string; cor: string }> = {
  pdv: { nome: 'PDV', descricao: 'Ponto de venda — fonte primária de receita', cor: 'orange' },
  financeiro: { nome: 'Financeiro', descricao: 'ERPs, bancos, contas a pagar/receber', cor: 'blue' },
  reservas: { nome: 'Reservas', descricao: 'Reservas online e fila', cor: 'emerald' },
  eventos: { nome: 'Eventos', descricao: 'Bilheteria online e física', cor: 'pink' },
  marketing: { nome: 'Marketing & Social', descricao: 'Redes sociais e Ads', cor: 'rose' },
  reviews: { nome: 'Reviews', descricao: 'Avaliações de clientes', cor: 'amber' },
  comunicacao: { nome: 'Comunicação', descricao: 'WhatsApp, NPS, notificações', cor: 'green' },
  ia: { nome: 'IA & Modelos', descricao: 'LLMs e embeddings', cor: 'amber' },
  infra: { nome: 'Infraestrutura', descricao: 'Hospedagem, banco, observabilidade', cor: 'slate' },
};

export const ORDEM_CATEGORIAS: Categoria[] = [
  'pdv',
  'financeiro',
  'reservas',
  'eventos',
  'marketing',
  'reviews',
  'comunicacao',
  'ia',
  'infra',
];
