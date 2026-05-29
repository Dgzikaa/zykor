import type { Metadata } from 'next';
import { getAdminClient } from '@/lib/supabase-admin';

export const metadata: Metadata = {
  title: 'Status de Exclusão de Dados · Zykor',
  description: 'Consulte o status de uma solicitação de exclusão de dados.',
};

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ code?: string }>;
}

async function buscarStatus(code: string) {
  if (!code || !/^[a-f0-9]{32}$/.test(code)) return null;
  const supabase = await getAdminClient();
  const { data } = await (supabase as any)
    .schema('integrations')
    .from('instagram_data_deletion_requests')
    .select('confirmation_code, status, recebido_em, concluido_em, erro_msg')
    .eq('confirmation_code', code)
    .maybeSingle();
  return data;
}

function rotuloStatus(s: string): { texto: string; cor: string } {
  switch (s) {
    case 'concluido':
      return { texto: 'Concluído', cor: 'text-emerald-600' };
    case 'em_processamento':
      return { texto: 'Em processamento', cor: 'text-amber-600' };
    case 'erro':
      return { texto: 'Erro', cor: 'text-red-600' };
    default:
      return { texto: 'Recebido', cor: 'text-gray-600' };
  }
}

export default async function DataDeletionStatusPage({ searchParams }: PageProps) {
  const { code } = await searchParams;
  const reg = code ? await buscarStatus(code) : null;

  return (
    <main className="max-w-2xl mx-auto px-6 py-12 text-gray-800 dark:text-gray-200">
      <h1 className="text-2xl font-bold mb-2">Status da Exclusão de Dados</h1>
      <p className="text-sm text-gray-500 mb-8">
        Esta página exibe o status de uma solicitação de exclusão de dados feita
        via Instagram/Meta. O código de confirmação foi gerado quando você
        revogou o acesso do app Zykor.
      </p>

      {!code && (
        <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-6">
          <p className="text-sm">
            Informe o código de confirmação na URL, por exemplo:
            <code className="block mt-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
              /integracoes/instagram/data-deletion-status?code=SEU_CODIGO
            </code>
          </p>
        </div>
      )}

      {code && !reg && (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-900/20 p-6">
          <p className="text-sm">
            Nenhuma solicitação encontrada para o código informado. Verifique se
            o código foi copiado corretamente.
          </p>
        </div>
      )}

      {reg && (
        <div className="rounded-lg border border-gray-300 dark:border-gray-700 p-6 space-y-4">
          <div>
            <span className="text-xs uppercase text-gray-500">Código</span>
            <p className="font-mono text-sm break-all">{reg.confirmation_code}</p>
          </div>
          <div>
            <span className="text-xs uppercase text-gray-500">Status</span>
            <p className={`text-lg font-semibold ${rotuloStatus(reg.status).cor}`}>
              {rotuloStatus(reg.status).texto}
            </p>
          </div>
          <div>
            <span className="text-xs uppercase text-gray-500">Recebido em</span>
            <p className="text-sm">
              {new Date(reg.recebido_em).toLocaleString('pt-BR')}
            </p>
          </div>
          {reg.concluido_em && (
            <div>
              <span className="text-xs uppercase text-gray-500">Concluído em</span>
              <p className="text-sm">
                {new Date(reg.concluido_em).toLocaleString('pt-BR')}
              </p>
            </div>
          )}
          {reg.erro_msg && (
            <div>
              <span className="text-xs uppercase text-gray-500">Mensagem de erro</span>
              <p className="text-sm text-red-600">{reg.erro_msg}</p>
            </div>
          )}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500">
            Para mais informações, consulte nossa{' '}
            <a href="/politica-privacidade" className="underline">
              Política de Privacidade
            </a>{' '}
            ou entre em contato com{' '}
            <a href="mailto:rodrigo@grupomenosemais.com.br" className="underline">
              rodrigo@grupomenosemais.com.br
            </a>.
          </div>
        </div>
      )}
    </main>
  );
}
