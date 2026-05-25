import { getBarIdServer } from '@/lib/auth-server';
import OrcamentacaoClient from './components/OrcamentacaoClient';
import { getOrcamentacaoCompleta } from './services/orcamentacao-service';
import { createClient } from '@supabase/supabase-js';
import { BarSyncCheck } from '@/components/BarSyncCheck';
import { Card } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { fetchBpData } from '../bp/lib/fetch-bp-data';

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

  // Comecar em Janeiro do ano corrente, mostrar ate mes atual + 2 (visao planejamento)
  const hoje = new Date();
  const anoInicio = hoje.getFullYear();
  const mesInicio = 1;
  const mesAtual = hoje.getMonth() + 1;
  const quantidade = Math.min(12, Math.max(6, mesAtual + 2));

  // BP: carregar em paralelo, mes corrente e versao padrao
  const bpVersao = 'Mai26';
  const [initialData, bp] = await Promise.all([
    getOrcamentacaoCompleta(supabase, barId, anoInicio, mesInicio, quantidade),
    fetchBpData(supabase, barId, anoInicio, bpVersao, mesAtual).catch(() => null),
  ]);

  const bpData = bp
    ? { ...bp, anoAtual: anoInicio, versaoAtual: bpVersao, mesAnalise: mesAtual }
    : undefined;

  return (
    <div className="flex flex-col min-h-screen">
      <BarSyncCheck />
      <OrcamentacaoClient initialData={initialData} barId={barId} bpData={bpData} />
    </div>
  );
}
