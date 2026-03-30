import { PlanejamentoClient } from './components/PlanejamentoClient';
import { getPlanejamentoComercial } from './services/planejamento-service';
import { createClient } from '@supabase/supabase-js';
import { getBarIdServer } from '@/lib/auth-server';
import { BarSyncCheck } from '@/components/BarSyncCheck';

export const dynamic = 'force-dynamic'; // Depende de cookie (bar_id), não pode cachear

export default async function PlanejamentoComercialPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const barId = await getBarIdServer();

  // Sem bar_id: cookie ainda não sincronizado no servidor.
  // BarSyncCheck (client-side) vai setar o cookie e chamar router.refresh()
  // automaticamente assim que o BarContext carregar.
  // Exibimos uma tela de loading explícita para evitar tela em branco.
  if (!barId) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <BarSyncCheck />
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[hsl(var(--primary))] mx-auto mb-4" />
          <p className="text-[hsl(var(--muted-foreground))] text-sm">
            Sincronizando estabelecimento...
          </p>
          <p className="text-[hsl(var(--muted-foreground))] text-xs mt-1">
            A página será recarregada automaticamente.
          </p>
        </div>
      </div>
    );
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
