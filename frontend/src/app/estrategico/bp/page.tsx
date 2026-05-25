import { getBarIdServer } from '@/lib/auth-server';
import { createClient } from '@supabase/supabase-js';
import { BarSyncCheck } from '@/components/BarSyncCheck';
import { BpClient } from './BpClient';
import type { BpLinha, BpIndicador } from './types';

export const revalidate = 3600;

export default async function BpPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const barId = await getBarIdServer();
  if (!barId) return <BarSyncCheck />;

  const params = await searchParams;
  const ano = Number(params.ano) || new Date().getFullYear();
  const versao = (params.versao as string) || 'Mai26';

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [linhasResult, indicadoresResult, versoesResult] = await Promise.all([
    supabase
      .from('bp_linha')
      .select('*')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('versao', versao)
      .eq('ativo', true)
      .order('ordem', { ascending: true }),
    supabase
      .from('bp_indicador')
      .select('*')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('versao', versao)
      .eq('ativo', true),
    supabase
      .from('bp_linha')
      .select('versao, ano')
      .eq('bar_id', barId)
      .eq('ativo', true),
  ]);

  const linhas = (linhasResult.data || []) as BpLinha[];
  const indicadores = (indicadoresResult.data || []) as BpIndicador[];
  const versoes = Array.from(
    new Set(((versoesResult.data || []) as { versao: string; ano: number }[]).map(v => `${v.ano}|${v.versao}`))
  ).map(s => {
    const [a, v] = s.split('|');
    return { ano: Number(a), versao: v };
  });

  return (
    <BpClient
      linhas={linhas}
      indicadores={indicadores}
      versoes={versoes}
      anoAtual={ano}
      versaoAtual={versao}
      barId={barId}
    />
  );
}
