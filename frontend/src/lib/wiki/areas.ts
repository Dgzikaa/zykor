/**
 * Áreas da Wiki do Zykor — espelham as seções do menu lateral (`lib/navigation/menu.ts`),
 * com uma seção extra "Começando" pro guia de uso da própria plataforma.
 *
 * Dados puros (sem React). A ordem aqui define a ordem no índice e na sidebar da wiki.
 * Cada artigo (frontmatter `area:`) referencia uma dessas `slug`.
 */
export interface WikiArea {
  slug: string;
  label: string;
  /** Nome do ícone lucide-react (string) — a UI mapeia para o componente. */
  icon: string;
  /** Frase curta que descreve a área no índice. */
  descricao: string;
}

export const WIKI_AREAS: WikiArea[] = [
  { slug: 'comecando', label: 'Começando', icon: 'Compass', descricao: 'Como a plataforma funciona, conceitos e primeiros passos.' },
  { slug: 'estrategico', label: 'Estratégico', icon: 'Target', descricao: 'Visão geral, desempenho, planejamento e orçamentação.' },
  { slug: 'receitas', label: 'Receitas', icon: 'Coins', descricao: 'Dashboards de receita, clientes, eventos, artistas e comunicação.' },
  { slug: 'rh', label: 'RH', icon: 'Users', descricao: 'Funcionários, escala, freelas, ponto, recrutamento e custo de MO.' },
  { slug: 'relatorios-financeiros', label: 'Relatórios Financeiros', icon: 'FileText', descricao: 'DRE, DFC, Balanço e Business Plan.' },
  { slug: 'ferramentas-financeiro', label: 'Ferramentas Financeiro', icon: 'Wallet', descricao: 'Agendamentos, pagamentos, conciliação e integração Conta Azul.' },
  { slug: 'comercial', label: 'Comercial', icon: 'Briefcase', descricao: 'Central comercial e ações de venda.' },
  { slug: 'producao-cmv', label: 'Produção · CMV', icon: 'Package', descricao: 'CMV, desvios, insumos, fichas técnicas, compras e produção.' },
  { slug: 'ferramentas', label: 'Ferramentas', icon: 'Wrench', descricao: 'Análises avançadas e diagnósticos operacionais.' },
  { slug: 'configuracoes', label: 'Configurações', icon: 'Settings', descricao: 'Bares, integrações, usuários, permissões e monitoramento.' },
];

export const WIKI_AREA_BY_SLUG: Record<string, WikiArea> = Object.fromEntries(
  WIKI_AREAS.map((a) => [a.slug, a])
);
