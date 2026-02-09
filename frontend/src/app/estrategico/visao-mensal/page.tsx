import { getBarIdServer } from '@/lib/auth-server';
import { createClient } from '@supabase/supabase-js';
import { getIndicadoresMensais } from './services/visao-mensal-service';
import { ComparativoMensalNovo } from '@/components/visao-geral/ComparativoMensalNovo';
import { BarSyncCheck } from '@/components/BarSyncCheck';
import PageHeader from '@/components/layouts/PageHeader';
import { Card } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export const revalidate = 3600; // Cache por 1 hora

export default async function VisaoMensalPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const barId = await getBarIdServer();
  const params = await searchParams;
  const mesParam = typeof params.mes === 'string' ? params.mes : undefined;

  if (!barId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="bg-white dark:bg-gray-800 p-8 text-center max-w-md">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Selecione um Bar
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Escolha um bar no seletor acima para visualizar o comparativo mensal.
          </p>
        </Card>
      </div>
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const initialData = await getIndicadoresMensais(supabase, barId, mesParam);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <BarSyncCheck />
      <div className="w-full px-4 py-6 space-y-6">
        <PageHeader 
          title="📅 Visão Mensal" 
          description="Acompanhamento consolidado dos últimos 4 meses"
        />
        
        {/* Componente Principal com dados do servidor */}
        <ComparativoMensalNovo initialData={initialData} barId={barId} />

        {/* Seção de Dicas */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            💡 Como Interpretar os Dados
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
                <div>
                  <span className="font-semibold text-gray-900 dark:text-white">Tendência Positiva:</span>
                  <p className="text-gray-600 dark:text-gray-400">Setas verdes indicam crescimento vs mês anterior. Bom sinal para faturamento e clientes.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0"></div>
                <div>
                  <span className="font-semibold text-gray-900 dark:text-white">Tendência Negativa:</span>
                  <p className="text-gray-600 dark:text-gray-400">Setas vermelhas indicam queda vs mês anterior. Fique atento ao CMO e custos artísticos.</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                <div>
                  <span className="font-semibold text-gray-900 dark:text-white">Mês Atual:</span>
                  <p className="text-gray-600 dark:text-gray-400">Destacado com borda azul e fundo diferenciado para facilitar a leitura.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-gray-400 rounded-full mt-1.5 flex-shrink-0"></div>
                <div>
                  <span className="font-semibold text-gray-900 dark:text-white">Indicador Parcial:</span>
                  <p className="text-gray-600 dark:text-gray-400">O mês atual ainda possui dados parciais até que o fechamento ocorra.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}