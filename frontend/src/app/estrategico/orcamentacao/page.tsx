import { getBarIdServer } from '@/lib/auth-server';
import OrcamentacaoClient from './components/OrcamentacaoClient';
import { getOrcamentacaoCompleta } from './services/orcamentacao-service';
import { createClient } from '@supabase/supabase-js';
import { BarSyncCheck } from '@/components/BarSyncCheck';
import { Card } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export const revalidate = 120; // Cache por 2 minutos (alinhado com a API antiga)

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
            Escolha um bar no seletor acima para visualizar a orçamentação.
          </p>
        </Card>
      </div>
    );
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Visao anual completa: Jan a Dez do ano corrente (12 meses sempre).
  // Garante que tudo eh do ano atual (sem cross-year).
  const hoje = new Date();
  const anoInicio = hoje.getFullYear();
  const mesInicio = 1;
  const quantidade = 12;

  const initialData = await getOrcamentacaoCompleta(supabase, barId, anoInicio, mesInicio, quantidade);

  return (
    <div className="flex flex-col min-h-screen">
      <BarSyncCheck />
      <OrcamentacaoClient initialData={initialData} barId={barId} />
    </div>
  );
}
