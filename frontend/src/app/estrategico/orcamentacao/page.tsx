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

  // Calcular intervalo de meses: 5 meses anteriores + mês atual + 1 mês posterior = 7 meses
  const hoje = new Date();
  let mesInicio = hoje.getMonth() + 1 - 5;
  let anoInicio = hoje.getFullYear();
  
  if (mesInicio <= 0) {
    mesInicio += 12;
    anoInicio -= 1;
  }

  const initialData = await getOrcamentacaoCompleta(supabase, barId, anoInicio, mesInicio, 7);

  return (
    <div className="flex flex-col min-h-screen">
      <BarSyncCheck />
      <OrcamentacaoClient initialData={initialData} barId={barId} />
    </div>
  );
}
