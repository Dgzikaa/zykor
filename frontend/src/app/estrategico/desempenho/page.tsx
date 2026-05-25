import { getBarIdServer } from '@/lib/auth-server';
import { DesempenhoClient } from './components/DesempenhoClient';
import { createClient } from '@supabase/supabase-js';
import { getSemanas } from './services/desempenho-service';
import { getMeses } from './services/desempenho-mensal-service';
import { BarSyncCheck } from '@/components/BarSyncCheck';
import { DadosSemana } from './types';

export const dynamic = 'force-dynamic'; // Depende de cookie (bar_id), não pode cachear

export default async function DesempenhoPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const barId = await getBarIdServer();
  const params = await searchParams;
  const visao = params.visao === 'mensal' ? 'mensal' : 'semanal';

  if (!barId) {
    return <BarSyncCheck />;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  let initialData: DadosSemana[] = [];
  let semanaAtual = 0;
  let anoAtual = new Date().getFullYear();

  // Paralelizar fetch de integracoes com fetch principal (semanas/meses).
  // Antes era sequencial: ~150ms + ~800ms. Agora corre junto.
  const integPromise = supabase
    .schema('operations' as never)
    .from('vw_bar_tem_integracao')
    .select('getin_api, getin_modo')
    .eq('bar_id', barId)
    .single();

  let integResult: Awaited<typeof integPromise>;
  if (visao === 'mensal') {
    const anoInicio = 2025;
    const mesInicio = 3;
    const hoje = new Date();
    const mesFim = hoje.getMonth() + 1;
    const anoFim = hoje.getFullYear();

    const [dados, integ] = await Promise.all([
      getMeses(supabase, barId, anoInicio, mesInicio, anoFim, mesFim),
      integPromise,
    ]);
    initialData = dados;
    semanaAtual = mesFim;
    anoAtual = anoFim;
    integResult = integ;
  } else {
    const ano = params.ano ? parseInt(params.ano as string) : undefined;
    const [result, integ] = await Promise.all([
      getSemanas(supabase, barId, ano),
      integPromise,
    ]);
    initialData = result.semanas;
    semanaAtual = result.semanaAtual;
    anoAtual = result.anoAtual;
    integResult = integ;
  }

  const integConfig = integResult.data as { getin_api: boolean | null; getin_modo: string | null } | null;
  const integracoes = {
    getin_api: integConfig?.getin_api ?? true,
    getin_modo: integConfig?.getin_modo ?? null,
  };

  return (
    <DesempenhoClient
      initialData={initialData}
      semanaAtual={semanaAtual}
      anoAtual={anoAtual}
      visao={visao}
      barId={barId}
      integracoes={integracoes}
    />
  );
}
