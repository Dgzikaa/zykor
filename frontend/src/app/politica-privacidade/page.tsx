import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidade · Zykor',
  description: 'Política de privacidade do Zykor — plataforma de gestão de bares.',
};

export default function PoliticaPrivacidadePage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-200">
      <h1 className="text-3xl font-bold mb-2">Política de Privacidade</h1>
      <p className="text-sm text-gray-500 mb-8">Última atualização: 11 de maio de 2026</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold mb-2">1. Quem somos</h2>
          <p>
            O <strong>Zykor</strong> é uma plataforma interna de gestão operacional e financeira dos
            bares Ordinário Bar e Música e Deboche! Bar, ambos do Grupo Menos e Mais (CNPJ
            sob administração de Rodrigo Garbacheski). Esta política descreve como tratamos
            informações ao usar a plataforma e as integrações conectadas (Meta/Instagram,
            Conta Azul, ContaHub, GetIn, Sympla, Yuzer, Umbler, entre outras).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">2. Dados que coletamos</h2>
          <p>
            O Zykor coleta dados estritamente necessários para operação dos bares:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>
              <strong>Dados operacionais</strong>: vendas, produtos, reservas, pagamentos,
              estoque, ordens de serviço e indicadores operacionais.
            </li>
            <li>
              <strong>Dados de redes sociais</strong>: ao conectar uma conta Instagram Business,
              capturamos métricas públicas e analíticas (alcance, impressões, engajamento,
              demografia agregada, posts e stories) referentes apenas às contas que o
              próprio administrador autorizar.
            </li>
            <li>
              <strong>Dados de marketing</strong>: investimento e desempenho de campanhas Meta
              Ads das contas que o administrador conectar.
            </li>
            <li>
              <strong>Dados de avaliações públicas</strong>: reviews públicas do Google Maps dos
              bares (via Apify), processadas para análise de satisfação.
            </li>
            <li>
              <strong>Dados de uso</strong>: e-mail, identificador único e logs de acesso dos
              usuários da plataforma para autenticação e auditoria.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">3. Como usamos os dados</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Exibir dashboards e relatórios operacionais aos administradores autorizados.</li>
            <li>
              Calcular indicadores agregados (faturamento, custos, ticket médio, sentimento
              dos clientes).
            </li>
            <li>
              Gerar insights estratégicos automatizados via inteligência artificial (modelos
              da Anthropic e OpenAI), sem compartilhar dados com terceiros para fins
              comerciais.
            </li>
            <li>
              Disparar alertas operacionais via Discord para a equipe interna dos bares.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">4. Compartilhamento</h2>
          <p>
            O Zykor <strong>não vende, aluga ou compartilha</strong> dados com terceiros para fins
            comerciais. Os dados são utilizados exclusivamente pela administração interna
            dos bares. Os seguintes prestadores de serviço processam dados em nosso nome,
            sob acordos de confidencialidade:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><strong>Supabase</strong> — banco de dados e autenticação</li>
            <li><strong>Vercel</strong> — hospedagem do frontend</li>
            <li><strong>Anthropic / OpenAI</strong> — análise via inteligência artificial</li>
            <li><strong>Sentry</strong> — monitoramento de erros</li>
            <li><strong>Apify</strong> — coleta de reviews públicos do Google Maps</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">5. Conexões com Meta (Instagram e Facebook)</h2>
          <p>
            Quando um administrador conecta uma conta Instagram Business e/ou uma página do
            Facebook ao Zykor, solicitamos as seguintes permissões da plataforma Meta:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li><code>instagram_basic</code> — informações básicas do perfil</li>
            <li><code>instagram_manage_insights</code> — métricas analíticas dos posts e stories</li>
            <li><code>pages_show_list</code> — listar páginas Facebook administradas</li>
            <li><code>pages_read_engagement</code> — leitura de engajamento das páginas</li>
            <li><code>business_management</code> — gestão de ativos do Business Manager</li>
            <li><code>ads_read</code> — leitura de métricas de campanhas (apenas se autorizado)</li>
          </ul>
          <p className="mt-2">
            Esses dados são armazenados de forma segura e podem ser desconectados a qualquer
            momento pelo próprio administrador, na tela de Configurações &raquo; Integrações da
            plataforma. Ao desconectar, paramos imediatamente de receber novos dados, embora
            o histórico já coletado seja preservado para análises retrospectivas.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">6. Segurança</h2>
          <p>
            Aplicamos práticas padrão de mercado para proteção de dados: criptografia em
            trânsito (HTTPS) e em repouso, Row Level Security no banco de dados, segregação
            de credenciais por bar, rotação periódica de tokens e auditoria de acesso.
            Credenciais sensíveis (tokens, chaves de API) nunca são expostas ao frontend.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">7. Retenção e exclusão</h2>
          <p>
            Dados operacionais são retidos enquanto a parceria entre a empresa e o bar
            estiver vigente. Backups são mantidos por até 90 dias após a exclusão lógica.
            Logs de auditoria por até 12 meses.
          </p>
          <p className="mt-2">
            Para solicitar exclusão de dados pessoais ou desconexão de integrações, escreva
            para o e-mail abaixo.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">8. Direitos do titular dos dados (LGPD)</h2>
          <p>
            Em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/18), os titulares
            podem solicitar a qualquer momento: confirmação de tratamento, acesso aos dados,
            correção, anonimização, portabilidade, eliminação e revogação de consentimento.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">9. Alterações nesta política</h2>
          <p>
            Esta política pode ser atualizada a qualquer momento. A data da última revisão
            consta no topo desta página. Mudanças relevantes serão comunicadas aos
            administradores conectados.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">10. Contato</h2>
          <p>
            Dúvidas, solicitações ou exercício de direitos previstos na LGPD:{' '}
            <a href="mailto:rodrigo@grupomenosemais.com.br" className="text-blue-600 underline">
              rodrigo@grupomenosemais.com.br
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
