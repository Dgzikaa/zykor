import { PlanejamentoClient } from './components/PlanejamentoClient';
import { getPlanejamentoComercial } from './services/planejamento-service';
import { createClient } from '@supabase/supabase-js';
import { getBarIdServer } from '@/lib/auth-server';
import { BarSyncCheck } from '@/components/BarSyncCheck'; // Assuming this exists based on visao-geral

// Cache por 1 minuto (igual ao route.ts original)
export const revalidate = 60;

export default async function PlanejamentoComercialPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const barId = await getBarIdServer();
  
  if (!barId) {
    return <BarSyncCheck />;
  }

  const searchParamsValue = await searchParams;
  const mesParam = searchParamsValue.mes;
  const anoParam = searchParamsValue.ano;

  const now = new Date();
  const mes = mesParam ? parseInt(Array.isArray(mesParam) ? mesParam[0] : mesParam) : now.getMonth() + 1;
  const ano = anoParam ? parseInt(Array.isArray(anoParam) ? anoParam[0] : anoParam) : now.getFullYear();

  // Validar entradas
  const mesValido = isNaN(mes) || mes < 1 || mes > 12 ? now.getMonth() + 1 : mes;
  const anoValido = isNaN(ano) || ano < 2020 || ano > 2030 ? now.getFullYear() : ano;

  // Instanciar Supabase com Service Role para garantir acesso
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const dados = await getPlanejamentoComercial(supabase, barId, mesValido, anoValido);

  return (
    <PlanejamentoClient 
      initialData={dados} 
      serverMes={mesValido} 
      serverAno={anoValido} 
    />
  );
}
