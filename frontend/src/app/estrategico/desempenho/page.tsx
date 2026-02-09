import { getBarIdServer } from '@/lib/auth-server';
import { DesempenhoClient } from './components/DesempenhoClient';
import { createClient } from '@supabase/supabase-js';
import { getSemanas } from './services/desempenho-service';
import { getMeses } from './services/desempenho-mensal-service';
import { BarSyncCheck } from '@/components/BarSyncCheck';
import { DadosSemana } from './types';

export const revalidate = 60; // 1 minuto cache

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

  if (visao === 'mensal') {
    // Lógica Mensal: Março 2025 até o mês atual (conforme original)
    // Se estivermos antes de Março 2025, ajustar?
    // Vou usar Março 2025 como hardcode inicial conforme regra de negócio aparente
    const anoInicio = 2025;
    const mesInicio = 3;
    const hoje = new Date();
    const mesFim = hoje.getMonth() + 1;
    const anoFim = hoje.getFullYear();

    initialData = await getMeses(supabase, barId, anoInicio, mesInicio, anoFim, mesFim);
    
    // Para visão mensal, semanaAtual = mês atual
    semanaAtual = mesFim;
    anoAtual = anoFim;
  } else {
    // Lógica Semanal
    const ano = params.ano ? parseInt(params.ano as string) : undefined;
    const result = await getSemanas(supabase, barId, ano);
    initialData = result.semanas;
    semanaAtual = result.semanaAtual;
    anoAtual = result.anoAtual;
  }

  return (
    <DesempenhoClient
      initialData={initialData}
      semanaAtual={semanaAtual}
      anoAtual={anoAtual}
      visao={visao}
      barId={barId}
    />
  );
}
