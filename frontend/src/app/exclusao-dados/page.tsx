import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Exclusão de Dados · Zykor',
  description: 'Como solicitar a exclusão dos seus dados do Zykor.',
};

export default function ExclusaoDadosPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-200">
      <h1 className="text-3xl font-bold mb-2">Solicitação de Exclusão de Dados</h1>
      <p className="text-sm text-gray-500 mb-8">Última atualização: 11 de maio de 2026</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold mb-2">Sobre esta página</h2>
          <p>
            O <strong>Zykor</strong> é uma plataforma interna de gestão dos bares Ordinário Bar e
            Música e Deboche! Bar (Grupo Menos e Mais). Como a plataforma é restrita à
            administração interna dos bares, não armazenamos dados pessoais de clientes
            finais — apenas dados operacionais e métricas agregadas autorizadas pelos
            administradores dos negócios.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Como solicitar exclusão</h2>
          <p>
            Se você é um <strong>administrador</strong> que conectou contas (Instagram, Facebook,
            Conta Azul, etc) ao Zykor e quer remover esses dados, siga o procedimento abaixo.
          </p>

          <h3 className="text-base font-semibold mt-4 mb-2">Opção 1 — Desconexão direta pela plataforma</h3>
          <p>
            Acesse <strong>Configurações &raquo; Integrações</strong> dentro do Zykor, encontre a
            integração desejada e clique em <em>&quot;Desconectar&quot;</em>. A partir desse momento,
            paramos imediatamente de receber novos dados daquela conta.
          </p>

          <h3 className="text-base font-semibold mt-4 mb-2">Opção 2 — Solicitação por e-mail</h3>
          <p>
            Para exclusão completa do histórico já armazenado, envie um e-mail para{' '}
            <a href="mailto:rodrigo@grupomenosemais.com.br" className="text-blue-600 underline">
              rodrigo@grupomenosemais.com.br
            </a>{' '}
            informando:
          </p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Seu nome completo</li>
            <li>E-mail ou identificador da conta conectada (ex: nome do Instagram Business)</li>
            <li>Qual integração / quais dados deseja excluir</li>
            <li>Motivo da solicitação (opcional)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Prazo de processamento</h2>
          <p>
            Processamos solicitações de exclusão em até <strong>30 dias corridos</strong>. Você
            receberá confirmação por e-mail quando a exclusão for concluída. Backups são
            descartados em até <strong>90 dias</strong> após a exclusão lógica, em conformidade
            com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/18).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">O que será excluído</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Tokens de acesso e credenciais OAuth armazenados</li>
            <li>Dados pessoais identificáveis vinculados à conta solicitante</li>
            <li>Histórico de reviews capturados associados à conta (caso aplicável)</li>
            <li>Logs de acesso e auditoria contendo o identificador da conta</li>
          </ul>
          <p className="mt-2 text-xs text-gray-500">
            Dados operacionais agregados e anonimizados (faturamento, vendas, indicadores
            estatísticos) podem ser preservados para fins contábeis e fiscais conforme
            obrigatoriedade legal.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2">Contato e dúvidas</h2>
          <p>
            <strong>E-mail:</strong>{' '}
            <a href="mailto:rodrigo@grupomenosemais.com.br" className="text-blue-600 underline">
              rodrigo@grupomenosemais.com.br
            </a>
            <br />
            <strong>Política de Privacidade completa:</strong>{' '}
            <a href="/politica-privacidade" className="text-blue-600 underline">
              zykor.com.br/politica-privacidade
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
