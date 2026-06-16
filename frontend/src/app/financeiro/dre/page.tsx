import { getBarIdServer } from '@/lib/auth-server';
import { BarSyncCheck } from '@/components/BarSyncCheck';
import { Card } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { DreComparativo } from './DreComparativo';

export const revalidate = 120;

// DRE agora é página própria em Financeiro (saiu da aba da Orçamentação).
// O DreTab é client e busca seus próprios dados (financial.dre_excel).
export default async function Page() {
  const barId = await getBarIdServer();

  if (!barId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="bg-white dark:bg-gray-800 p-8 text-center max-w-md">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Selecione um Bar
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Escolha um bar no seletor acima para visualizar a DRE.
          </p>
        </Card>
      </div>
    );
  }

  const anoAtual = new Date().getFullYear();

  return (
    <div className="flex flex-col min-h-screen">
      <BarSyncCheck />
      <div className="flex-1 overflow-auto p-4">
        <DreComparativo barId={barId} anoAtual={anoAtual} />
      </div>
    </div>
  );
}
