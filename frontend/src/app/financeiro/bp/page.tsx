import { getBarIdServer } from '@/lib/auth-server';
import { createClient } from '@supabase/supabase-js';
import { BarSyncCheck } from '@/components/BarSyncCheck';
import { Card } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { BpComparativo } from './BpComparativo';
import { versaoOrdinal } from '../../estrategico/bp/lib/versao';

export const revalidate = 300;

// BP em Financeiro = comparativo lado a lado (versão antiga à esquerda, atual à
// direita), cada painel com seu seletor + ocultar. A edição/criação de BP segue
// na tela completa /estrategico/bp.
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data } = await supabase.from('bp_linha').select('versao, ano').eq('bar_id', barId).eq('ativo', true);
  const versoes = Array.from(new Set(((data || []) as { versao: string; ano: number }[]).map(v => `${v.ano}|${v.versao}`)))
    .map(s => { const [a, v] = s.split('|'); return { ano: Number(a), versao: v }; })
    .sort((a, b) => versaoOrdinal(a.versao, a.ano) - versaoOrdinal(b.versao, b.ano)); // crescente (antigo -> novo)

  if (versoes.length === 0) {
    return <div className="p-8 text-center text-gray-500"><BarSyncCheck />Nenhum BP cadastrado ainda.</div>;
  }

  const defaultDir = versoes[versoes.length - 1];               // mais recente (direita)
  const defaultEsq = versoes.length > 1 ? versoes[0] : defaultDir; // mais antigo (esquerda)

  return (
    <div className="flex flex-col min-h-screen">
      <BarSyncCheck />
      <div className="flex-1 overflow-auto p-4">
        <BpComparativo barId={barId} versoes={versoes} defaultEsq={defaultEsq} defaultDir={defaultDir} />
      </div>
    </div>
  );
}
