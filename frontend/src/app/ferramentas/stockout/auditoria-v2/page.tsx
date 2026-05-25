import { getBarIdServer } from '@/lib/auth-server';
import { createClient } from '@supabase/supabase-js';
import { BarSyncCheck } from '@/components/BarSyncCheck';
import { AuditoriaV2Client } from './AuditoriaV2Client';

export const dynamic = 'force-dynamic';

interface ExecLog {
  id: number;
  bar_id: number;
  data_consulta: string;
  executado_em: string;
  triggered_by: string;
  status: string;
  bronze_linhas: number | null;
  silver_linhas: number | null;
  incluidos: number | null;
  excluidos: number | null;
  percentual_stockout: number | null;
  tempo_total_ms: number | null;
  versao_regras: string | null;
  erro_msg: string | null;
}

export default async function AuditoriaV2Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const barId = await getBarIdServer();
  if (!barId) return <BarSyncCheck />;

  const params = await searchParams;
  const dataParam = (params.data as string) || new Date().toISOString().substring(0, 10);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [historicoResult, produtosResult] = await Promise.all([
    supabase
      .from('stockout_execucao_log')
      .select('*')
      .eq('bar_id', barId)
      .order('executado_em', { ascending: false })
      .limit(30),
    supabase
      .from('silver_contahub_operacional_stockout_processado' as never)
      .select('*')
      .eq('bar_id', barId)
      .eq('data_consulta', dataParam)
      .order('loc_desc', { ascending: true })
      .order('prd_desc', { ascending: true }),
  ]);

  const historico = (historicoResult.data || []) as ExecLog[];
  const produtos = (produtosResult.data || []) as Array<{
    raw_id: number;
    prd: string;
    prd_desc: string;
    prd_venda: string;
    prd_ativo: string;
    prd_precovenda: number;
    prd_estoque: number;
    loc_desc: string;
    categoria_mix: string;
    categoria_local: string;
    incluido: boolean;
    motivo_exclusao: string | null;
    regra_aplicada: string | null;
    versao_regras: string;
    processado_em: string;
  }>;

  return (
    <AuditoriaV2Client
      historico={historico}
      produtos={produtos}
      barId={barId}
      dataSelecionada={dataParam}
    />
  );
}
