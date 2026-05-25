import { getBarIdServer } from '@/lib/auth-server';
import { createClient } from '@supabase/supabase-js';
import { BarSyncCheck } from '@/components/BarSyncCheck';
import { OrcamentacaoV2Client } from './OrcamentacaoV2Client';
import { getOrcamentacaoPeriodo } from './services/orcamentacao-v2-service';

export const revalidate = 120;

export default async function OrcamentacaoV2Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const barId = await getBarIdServer();
  if (!barId) return <BarSyncCheck />;

  const params = await searchParams;
  const versaoBp = (params.versao as string) || 'Mai26';

  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();
  // 5 meses anteriores + atual + 1 futuro = 7 meses
  const dataInicio = new Date(anoAtual, mesAtual - 6, 1);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const meses = await getOrcamentacaoPeriodo(
    supabase,
    barId,
    dataInicio.getFullYear(),
    dataInicio.getMonth() + 1,
    7,
    versaoBp
  );

  return <OrcamentacaoV2Client meses={meses} barId={barId} versaoBp={versaoBp} />;
}
