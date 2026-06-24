import { getBarIdServer } from '@/lib/auth-server';
import { BarSyncCheck } from '@/components/BarSyncCheck';
import { Card } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { BpManual } from './BpManual';

export const revalidate = 0;

// BP (Business Plan) = orçamentação 100% manual por mês. O que se preenche aqui vira
// a coluna "planejado" da Orçamentação (mesmo campo: meta.orcamento_planilha.valor_planejado).
export default async function Page() {
  const barId = await getBarIdServer();
  if (!barId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <Card className="bg-white dark:bg-gray-800 p-8 text-center max-w-md">
          <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Selecione um Bar</h2>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <BarSyncCheck />
      <div className="flex-1 overflow-auto p-4">
        <BpManual barId={barId} />
      </div>
    </div>
  );
}
