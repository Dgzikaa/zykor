import { NextResponse } from 'next/server';
import type { AuthenticatedUser } from '@/middleware/auth';
import { userCan, type PermAction } from './resolver';
import { getModuleIdForPath } from './modules';

/**
 * Guard de permissão por AÇÃO (ver/editar/inserir/excluir), server-side. Chamado nas rotas de
 * escrita DEPOIS do authenticateUser. Segurança real (não dá pra burlar pelo front).
 *
 * Regra das rotas COMPARTILHADAS: libera se o usuário puder a ação em PELO MENOS UM dos módulos
 * que a rota serve (passe os `paths` das telas que usam a rota). Assim nunca trava outra tela —
 * quem tem direito legítimo passa; quem é só-ver em tudo é bloqueado. Admin passa sempre.
 *
 * Retorna um NextResponse 403 quando NEGADO, ou null quando permitido:
 *   const nega = negarSeNaoPode(user, ['/operacional/fichas-tecnicas'], 'editar');
 *   if (nega) return nega;
 */
export function negarSeNaoPode(
  user: AuthenticatedUser | null,
  paths: string[],
  action: PermAction,
): NextResponse | null {
  if (!user) return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 });
  if ((user.role as string) === 'admin') return null; // admin faz tudo

  const moduleIds = paths.map(getModuleIdForPath).filter((x): x is string => !!x);
  if (moduleIds.length === 0) return null; // rota não mapeada → não bloqueia (fail-open só p/ não-mapeadas)

  const pode = moduleIds.some(id => userCan(user.modulos_permitidos, id, action));
  if (!pode) {
    return NextResponse.json(
      { success: false, error: `Você não tem permissão para ${action} nesta área.`, code: 'PERMISSION_DENIED' },
      { status: 403 },
    );
  }
  return null;
}

// método HTTP → ação CRUD
const METODO_ACAO: Record<string, PermAction> = { POST: 'inserir', PUT: 'editar', PATCH: 'editar', DELETE: 'excluir' };

/**
 * MAPA CENTRAL rota de API → páginas (do menu) que a servem. O guard confere a permissão do(s)
 * módulo(s) dessas páginas. Rota compartilhada = várias páginas (libera se puder em qualquer uma).
 * Prefixo mais específico vence (ordena por comprimento). Rota não mapeada = não bloqueia (fail-open,
 * expandir o mapa por lote). Manter aqui é o "único lugar" — nada de permissão espalhada.
 */
const ROTA_MODULOS: Array<{ prefix: string; paths: string[] }> = [
  // --- Operacional ---
  // --- Configurações ---
  // Credenciais de integração, disparo de WhatsApp/Discord e reset de senha admin: tudo isso
  // é operação de configuração e estava sem exigir módulo (qualquer logado alcançava).
  // O reset de senha admin em especial troca a senha de outro usuário — vale a trava explícita
  // aqui além da que o middleware já faz.
  { prefix: '/api/configuracoes/usuarios', paths: ['/configuracoes/usuarios'] },
  // Chamada tanto por /configuracoes/permissoes (fora do menu) quanto por
  // /configuracoes/usuarios (no menu) — é a segunda que dá o módulo.
  { prefix: '/api/configuracoes/permissoes', paths: ['/configuracoes/usuarios'] },
  { prefix: '/api/configuracoes/credenciais', paths: ['/configuracoes/administracao/integracoes'] },
  { prefix: '/api/configuracoes/whatsapp', paths: ['/configuracoes/administracao/integracoes'] },
  { prefix: '/api/configuracoes/discord', paths: ['/configuracoes/administracao/integracoes'] },
  { prefix: '/api/configuracoes/edge-functions', paths: ['/configuracoes/administracao/integracoes'] },
  // --- Relatórios Financeiros (DRE editável) ---
  // A DRE manual/simples escreve linha de DRE — sem isto, qualquer usuário autenticado
  // gravava, porque a rota não estava no mapa (guard é fail-open pra não-mapeada).
  { prefix: '/api/financeiro/dre-manual', paths: ['/financeiro/dre'] },
  { prefix: '/api/financeiro/dre-simples', paths: ['/financeiro/dre'] },
  // --- Operacional ---
  { prefix: '/api/operacional/producoes/ficha', paths: ['/operacional/fichas-tecnicas'] },
  { prefix: '/api/operacional/fichas/grupo', paths: ['/operacional/fichas-tecnicas'] },
  { prefix: '/api/operacional/fichas/insumo-uso', paths: ['/operacional/fichas-tecnicas'] },
  { prefix: '/api/operacional/produtos', paths: ['/operacional/fichas-tecnicas'] },
  { prefix: '/api/operacional/producoes/execucao', paths: ['/operacional/producoes'] },
  { prefix: '/api/operacional/producoes/alimentacao', paths: ['/operacional/producoes'] },
  // /api/operacional/pessoas-responsaveis é admin-only (checa role na própria rota) — fora do mapa de propósito
  { prefix: '/api/operacional/producoes', paths: ['/operacional/fichas-tecnicas', '/operacional/producoes'] },
  { prefix: '/api/operacional/insumos', paths: ['/operacional/insumos'] },
  { prefix: '/api/operacional/desvios', paths: ['/operacional/desvios'] },
  { prefix: '/api/operacional/desperdicio', paths: ['/operacional/desperdicio'] },
  { prefix: '/api/operacional/cmv-teorico', paths: ['/operacional/cmv-teorico'] },
  { prefix: '/api/operacional/plano-producao', paths: ['/operacional/plano-producao'] },
  { prefix: '/api/operacional/plano-compras', paths: ['/operacional/plano-compras'] },
  // Contagem de estoque: a tela é a de Estoque (/operacional/contagem não está no menu, então
  // não tem módulo próprio — o módulo que governa contagem é o de Estoque).
  { prefix: '/api/operacional/contagem', paths: ['/operacional/estoque-historico'] },
  { prefix: '/api/operacional/insumo-falta', paths: ['/operacional/plano-compras'] },
  { prefix: '/api/operacional/consumacao', paths: ['/operacional/consumacao'] },
  { prefix: '/api/operacional/estoque-cadastro', paths: ['/operacional/estoque-historico'] },
  { prefix: '/api/operacional/estoque-historico', paths: ['/operacional/estoque-historico'] },
  { prefix: '/api/operacional/freelas', paths: ['/operacional/freelas'] },
  // --- Operação ---
  // Estavam FORA do mapa (fail-open): qualquer usuário autenticado escrevia na escala. Entrou
  // junto com a visão Dia (/api/operacao/escala/dia), que grava check-in e, no caso de falta ou
  // atestado, cria OCORRÊNCIA no dossiê da pessoa — isso não pode ficar sem dono.
  // O prefixo cobre /escala, /escala/pessoa, /escala/dia e /escala/vinculo.
  { prefix: '/api/operacao/escala', paths: ['/operacao/escala'] },
  { prefix: '/api/operacao/plano', paths: ['/operacao/plano'] },
  { prefix: '/api/operacao/parametros', paths: ['/operacao/plano'] },
  // Simulação de CMO: a tela /ferramentas/simulacao-cmo está fora do menu, mas é a mesma
  // ferramenta do CMO — o dono definiu que quem tem acesso a Ferramentas simula.
  { prefix: '/api/operacional/cmo-simulacao', paths: ['/ferramentas/cmo'] },
  // --- RH ---
  { prefix: '/api/rh/funcionarios', paths: ['/rh/funcionarios'] },
  { prefix: '/api/rh/solicitacoes', paths: ['/rh/funcionarios'] },
  { prefix: '/api/rh/escala', paths: ['/rh/escala'] },
  { prefix: '/api/rh/freelas', paths: ['/rh/freelas'] },
  { prefix: '/api/rh/ponto', paths: ['/rh/ponto'] },
  { prefix: '/api/rh/vagas', paths: ['/rh/recrutamento'] },
  // CMO fixo: é a folha do mês, dado salarial da casa toda. Sem isto a rota ficava fail-open e
  // qualquer usuário logado lia o salário de todo mundo.
  { prefix: '/api/rh/cmo-fixo', paths: ['/rh/custo-mo'] },
  { prefix: '/api/rh/pesquisa-felicidade', paths: ['/rh/pesquisas'] },
  { prefix: '/api/rh/provisoes', paths: ['/ferramentas'] },
  // --- Analítico --- (/api/analitico/clientes/filtros-avancados é POST de LEITURA → fora do mapa)
  { prefix: '/api/campanhas-clube', paths: ['/analitico/clientes'] },
  { prefix: '/api/crm/lista-quente', paths: ['/analitico/clientes'] },
  // --- CRM / Umbler --- (hub /ferramentas/crm, módulo ferramentas_crm)
  // Os disparos mandam WhatsApp de verdade pra cliente: sem isto qualquer usuário logado
  // conseguia disparar campanha, win-back ou NPS pela API.
  { prefix: '/api/crm/campanhas', paths: ['/ferramentas/crm'] },
  { prefix: '/api/umbler/config', paths: ['/ferramentas/crm'] },
  { prefix: '/api/umbler/disparo-segmento', paths: ['/ferramentas/crm'] },
  { prefix: '/api/umbler/disparo-winback', paths: ['/ferramentas/crm'] },
  { prefix: '/api/umbler/nps-disparo', paths: ['/ferramentas/crm'] },
  { prefix: '/api/umbler/send', paths: ['/ferramentas/crm'] },
  // COMPARTILHADA: quem tagueia artistas em Atrações E quem edita "quem tocou"/horários no
  // modal do Planejamento Comercial usam a MESMA rota. Libera por qualquer um dos módulos —
  // senão quem só tem estrategico_planejamento (edita título/plano) tomava 403 ao salvar os
  // artistas, com o título já gravado (rota /[id] é sem guard).
  { prefix: '/api/eventos/artistas', paths: ['/analitico/atracoes', '/estrategico/planejamento-comercial'] },
  { prefix: '/api/eventos/artista-ca-pessoa', paths: ['/analitico/atracoes'] },
  { prefix: '/api/eventos/ca-atracao-override', paths: ['/analitico/atracoes'] },
  // --- Marketing / NPS / Comercial ---
  { prefix: '/api/instagram', paths: ['/marketing/instagram'] },
  { prefix: '/api/ferramentas/nps', paths: ['/operacional/nps'] },
  { prefix: '/api/concorrencia', paths: ['/comercial'] },
  // --- Estratégico ---
  { prefix: '/api/estrategico/desempenho-v2', paths: ['/estrategico/desempenho'] },
  { prefix: '/api/estrategico/desempenho', paths: ['/estrategico/desempenho'] },
  { prefix: '/api/estrategico/marketing-mensal', paths: ['/estrategico/desempenho'] },
  { prefix: '/api/estrategico/orcamentacao', paths: ['/estrategico/orcamentacao'] },
  { prefix: '/api/estrategico/bp', paths: ['/estrategico/orcamentacao'] },
  { prefix: '/api/gestao/desempenho', paths: ['/estrategico/desempenho'] },
  { prefix: '/api/cmv', paths: ['/estrategico/visao-geral'] },
  // --- Ferramentas (CMV semanal) ---
  { prefix: '/api/cmv-semanal', paths: ['/ferramentas/cmv-semanal/tabela'] },
  // --- Financeiro (dados; rotas de PAGAMENTO ficam fora por ora, revisar com o dono) ---
  { prefix: '/api/financeiro/balanco', paths: ['/financeiro/balanco'] },
  { prefix: '/api/financeiro/categorias', paths: ['/financeiro/dre'] },
  { prefix: '/api/financeiro/dfc', paths: ['/financeiro/dfc'] },
  { prefix: '/api/financeiro/beneficiarios', paths: ['/financeiro/beneficiarios', '/financeiro/pedidos-pagamento'] },
  // --- Financeiro PAGAMENTO (mapear a tela dona; libera quem tem o módulo do pagamento) ---
  { prefix: '/api/financeiro/pedidos-pagamento', paths: ['/financeiro/pedidos-pagamento'] },
  { prefix: '/api/financeiro/freelas', paths: ['/financeiro/pedidos-pagamento'] },
  { prefix: '/api/financeiro/boleto', paths: ['/financeiro/pedidos-pagamento'] },
  { prefix: '/api/financeiro/cartao', paths: ['/financeiro/pedidos-pagamento'] },
  { prefix: '/api/financeiro/inter/pix', paths: ['/financeiro/agendamentos'] },
  // Disparo manual de sync do CA: a tela dona é a de Integrações, não a de pagamentos.
  { prefix: '/api/financeiro/contaazul/sync', paths: ['/configuracoes/administracao/integracoes'] },
  { prefix: '/api/financeiro/contaazul/baixa', paths: ['/financeiro/agendamentos'] },
  { prefix: '/api/financeiro/contaazul/match-fornecedores', paths: ['/financeiro/agendamentos'] },
  { prefix: '/api/financeiro/agendamentos', paths: ['/financeiro/agendamentos'] },
  { prefix: '/api/financeiro/stone/contas-a-receber-diario', paths: ['/financeiro/stone-recebiveis'] },
  // --- Eventos (escrevem eventos_base) ---
  // COMPARTILHADA: Planejamento Comercial monta/edita o evento, Análise de Eventos corrige
  // valores reais. Libera por qualquer um dos dois — travar só no planejamento quebraria
  // quem trabalha pela tela de eventos. /api/ferramentas/calendario/eventos entra aqui
  // apesar do nome: o que ela grava é eventos_base, igual às outras.
  { prefix: '/api/eventos', paths: ['/estrategico/planejamento-comercial', '/analitico/eventos'] },
  { prefix: '/api/gestao/eventos', paths: ['/estrategico/planejamento-comercial', '/analitico/eventos'] },
  { prefix: '/api/ferramentas/calendario/eventos', paths: ['/estrategico/planejamento-comercial', '/analitico/eventos'] },
  { prefix: '/api/planejamento/recalcular', paths: ['/estrategico/planejamento-comercial'] },
  { prefix: '/api/organizador', paths: ['/estrategico/planejamento-comercial'] },
  { prefix: '/api/custos-diluidos', paths: ['/estrategico/orcamentacao'] },
  // --- Stockout / mix / atrações (telas do menu) ---
  { prefix: '/api/analitico/stockout', paths: ['/ferramentas/stockout'] },
  { prefix: '/api/analitico/stockout-historico', paths: ['/ferramentas/stockout'] },
  { prefix: '/api/contahub/stockout', paths: ['/ferramentas/stockout'] },
  { prefix: '/api/grupos-classificacao', paths: ['/ferramentas/consumos-classificacao'] },
  { prefix: '/api/artistas', paths: ['/analitico/atracoes'] },
  // COMPARTILHADAS com Ferramentas › Artistas & Labels: a aba Cachês mora lá (negociação do
  // artista + confirmar o pagamento). Sem estas duas linhas o prefixo curto acima mandaria, e
  // quem cuida da programação sem acesso a /analitico/atracoes tomaria 403 no próprio botão.
  { prefix: '/api/artistas/caches', paths: ['/ferramentas/artistas', '/analitico/atracoes'] },
  { prefix: '/api/eventos/artistas/ficha', paths: ['/ferramentas/artistas', '/analitico/atracoes'] },
  { prefix: '/api/analitico/clientes/perfil-consumo', paths: ['/ferramentas/crm'] },
  // --- Análises avançadas / IA (Ferramentas › Análises Avançadas) ---
  { prefix: '/api/agente', paths: ['/ferramentas/analises'] },
  { prefix: '/api/integridade', paths: ['/ferramentas/analises'] },
  { prefix: '/api/previsao', paths: ['/ferramentas/analises'] },
  { prefix: '/api/relatorio-executivo', paths: ['/ferramentas/analises'] },
  { prefix: '/api/relatorio', paths: ['/ferramentas/analises'] },
  { prefix: '/api/assistente', paths: ['/assistente-zykor'] },
  { prefix: '/api/assistant', paths: ['/assistente-zykor'] },
  // --- Receitas / comunicação ---
  { prefix: '/api/receitas/comunicacao', paths: ['/receitas/comunicacao'] },
  { prefix: '/api/receitas', paths: ['/receitas'] },
  // --- Operacional / RH / financeiro que faltavam ---
  { prefix: '/api/ferramentas/insumos', paths: ['/operacional/insumos'] },
  { prefix: '/api/operacoes/producoes', paths: ['/operacional/producoes'] },
  { prefix: '/api/fichas-tecnicas', paths: ['/operacional/fichas-tecnicas'] },
  { prefix: '/api/fluxo-caixa', paths: ['/financeiro/fluxo-caixa'] },
  { prefix: '/api/rh/enps', paths: ['/rh/funcionarios'] },
  // --- Configurações: gestão de OUTRO usuário (perfil próprio é self-service, fica fora) ---
  // ATENÇÃO: prefixo largo de propósito (o pathname real traz o id, não '[id]', então não dá
  // pra mapear a rota dinâmica). O que protege /api/usuarios/perfil e /trocar-senha é o guard
  // ser OPT-IN: elas não chamam negarPorRota, porque são self-service (todo usuário edita o
  // próprio perfil e a própria senha). NÃO adicionar negarPorRota nelas.
  { prefix: '/api/usuarios', paths: ['/configuracoes/usuarios'] },
  { prefix: '/api/integracoes/instagram', paths: ['/configuracoes/administracao/integracoes'] },
  // Vincular ficha do Google e desconectar mexem em qual bar recebe as métricas do Meu Negócio —
  // mesma tela dona do Instagram, mesma exigência de módulo. Sem esta linha o guard passaria
  // batido (fail-open) e qualquer usuário logado conseguiria desconectar pela API.
  { prefix: '/api/integracoes/google', paths: ['/configuracoes/administracao/integracoes'] },
  { prefix: '/api/alertas-inteligentes', paths: ['/configuracoes/administracao/integracoes'] },
];

/**
 * Guard por rota (usa o MAPA + o método HTTP). Chamar nas rotas de escrita DEPOIS do
 * authenticateUser: `const nega = negarPorRota(user, request); if (nega) return nega;`
 * GET/HEAD e rotas não mapeadas passam (leitura + fail-open).
 */
export function negarPorRota(user: AuthenticatedUser | null, request: Request): NextResponse | null {
  const action = METODO_ACAO[request.method];
  if (!action) return null; // não é escrita
  const pathname = new URL(request.url).pathname;
  const match = ROTA_MODULOS
    .filter(m => pathname === m.prefix || pathname.startsWith(m.prefix + '/') || pathname.startsWith(m.prefix + '?'))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  if (!match) return null; // rota não mapeada → não bloqueia (expandir o mapa)
  return negarSeNaoPode(user, match.paths, action);
}
