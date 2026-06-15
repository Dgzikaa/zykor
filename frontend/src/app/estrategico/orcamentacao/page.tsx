import { getBarIdServer } from '@/lib/auth-server';
import OrcamentacaoClient from './components/OrcamentacaoClient';
import { getOrcamentacaoCompleta } from './services/orcamentacao-service';
import { createClient } from '@supabase/supabase-js';
import { BarSyncCheck } from '@/components/BarSyncCheck';
import { Card } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { fetchBpData } from '../bp/lib/fetch-bp-data';
import { versaoMaisRecente } from '../bp/lib/versao';

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
  const mesAtual = hoje.getMonth() + 1;
  const quantidade = 12;

  // BP: versao padrao = a mais recente cadastrada (cai pra Mai26 se nao houver).
  const { data: versoesRows } = await supabase
    .from('bp_linha')
    .select('versao, ano')
    .eq('bar_id', barId)
    .eq('ativo', true);
  const versoesUnicas = Array.from(
    new Set(((versoesRows || []) as { versao: string; ano: number }[]).map(v => `${v.ano}|${v.versao}`))
  ).map(s => { const [a, v] = s.split('|'); return { ano: Number(a), versao: v }; });
  const recente = versaoMaisRecente(versoesUnicas);
  const bpVersao = recente?.versao ?? 'Mai26';
  const bpAno = recente?.ano ?? anoInicio;

  const [initialData, bp] = await Promise.all([
    getOrcamentacaoCompleta(supabase, barId, anoInicio, mesInicio, quantidade),
    fetchBpData(supabase, barId, bpAno, bpVersao, mesAtual).catch(() => null),
  ]);

  const bpData = bp
    ? { ...bp, anoAtual: bpAno, versaoAtual: bpVersao, mesAnalise: mesAtual }
    : undefined;

  return (
    <div className="flex flex-col min-h-screen">
      <BarSyncCheck />
      <OrcamentacaoClient initialData={initialData} barId={barId} bpData={bpData} />
    </div>
  );
}
