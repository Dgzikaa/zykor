import { getBarIdServer } from '@/lib/auth-server';
import { IndicadoresClient } from './components/IndicadoresClient';
import { createClient } from '@supabase/supabase-js';
import * as IndicadoresService from './services/indicadores-service';
import { BarSyncCheck } from '@/components/BarSyncCheck';

// Cache por 5 minutos
export const revalidate = 300;

// Helper para datas do trimestre
function getTrimestreDates(trimestre: number, year?: number) {
  const anoAtual = year || new Date().getFullYear();
  const quarters = {
    1: { start: `${anoAtual}-01-01`, end: `${anoAtual}-03-31` }, 
    2: { start: `${anoAtual}-04-01`, end: `${anoAtual}-06-30` }, 
    3: { start: `${anoAtual}-07-01`, end: `${anoAtual}-09-30` }, 
    4: { start: `${anoAtual}-10-01`, end: `${anoAtual}-12-31` }  
  };
  return quarters[trimestre as keyof typeof quarters] || quarters[1];
}

// Helper para mês de retenção
const getMesRetencao = (trimestre: number) => {
  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();
  const ultimoMesTrimestre: Record<number, number> = { 1: 3, 2: 6, 3: 9, 4: 12 };
  const primeiroMesTrimestre: Record<number, number> = { 1: 1, 2: 4, 3: 7, 4: 10 };
  const primeiro = primeiroMesTrimestre[trimestre] || 1;
  const ultimo = ultimoMesTrimestre[trimestre] || 3;
  
  let mesParaUsar = ultimo;
  if (mesAtual >= primeiro && mesAtual <= ultimo) {
    mesParaUsar = (now.getDate() <= 10 && mesAtual > primeiro) ? mesAtual - 1 : mesAtual;
  } else if (mesAtual > ultimo) {
    mesParaUsar = ultimo;
  }
  return `${anoAtual}-${mesParaUsar.toString().padStart(2, '0')}`;
};

// Metas dinâmicas (copiado de route.ts)
const getMetasTrimestre = (trimestre: number) => {
  const metas = {
    1: { clientesAtivos: 5100, clientesTotais: 30000, retencao: 40, retencaoReal: 5, cmvLimpo: 34, cmo: 20, artistica: 20 },
    2: { clientesAtivos: 5500, clientesTotais: 35000, retencao: 40, retencaoReal: 5, cmvLimpo: 34, cmo: 20, artistica: 19 },
    3: { clientesAtivos: 6000, clientesTotais: 38000, retencao: 40, retencaoReal: 5, cmvLimpo: 34, cmo: 20, artistica: 19 },
    4: { clientesAtivos: 6500, clientesTotais: 40000, retencao: 40, retencaoReal: 5, cmvLimpo: 34, cmo: 20, artistica: 19 }
  };
  return metas[trimestre as keyof typeof metas] || metas[1];
};

export default async function VisaoGeralEstrategica({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const barId = await getBarIdServer();
  const searchParamsValue = await searchParams;
  
  // Detectar trimestre atual se não informado
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const defaultQuarter = currentMonth <= 3 ? 1 : currentMonth <= 6 ? 2 : currentMonth <= 9 ? 3 : 4;
  
  const trimestreAtual = Number(searchParamsValue.trimestre) || defaultQuarter;
  const anoAtual = new Date().getFullYear();

  if (!barId) {
    return <BarSyncCheck />;
  }

  // Instanciar Supabase (Service Role para acesso a RPCs)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Executar buscas em paralelo
  const mesRetencao = getMesRetencao(trimestreAtual);
  
  const [anualResult, trimestralResult, retencaoResult, retencaoRealResult, cmvLimpoResult] = await Promise.all([
    // 1. Dados Anuais
    supabase.rpc('calcular_visao_geral_anual', { p_bar_id: barId, p_ano: anoAtual }),
    
    // 2. Dados Trimestrais
    supabase.rpc('calcular_visao_geral_trimestral', { p_bar_id: barId, p_trimestre: trimestreAtual, p_ano: anoAtual }),
    
    // 3. Retenção
    IndicadoresService.calcularRetencao(supabase, barId, mesRetencao, trimestreAtual),
    
    // 4. Retenção Real
    IndicadoresService.calcularRetencaoReal(supabase, barId, trimestreAtual),
    
    // 5. CMV Limpo Manual
    (async () => {
      const trimestresDatas: Record<number, { inicio: string; fim: string }> = {
        2: { inicio: `${anoAtual}-04-01`, fim: `${anoAtual}-06-30` },
        3: { inicio: `${anoAtual}-07-01`, fim: `${anoAtual}-09-30` },
        4: { inicio: `${anoAtual}-10-01`, fim: `${anoAtual}-12-31` }
      };
      
      const periodoAtual = trimestresDatas[trimestreAtual] || trimestresDatas[4];
      
      const { data: cmvData } = await supabase
        .from('cmv_manual')
        .select('cmv_percentual')
        .eq('bar_id', barId)
        .eq('periodo_tipo', 'trimestral')
        .eq('periodo_inicio', periodoAtual.inicio)
        .single();
      
      // CMV Anterior para variação
      const trimestreAnterior = trimestreAtual === 2 ? 4 : trimestreAtual - 1;
      const anoAnterior = trimestreAtual === 2 ? anoAtual - 1 : anoAtual;
      const periodoAnterior = {
        2: { inicio: `${anoAnterior}-04-01`, fim: `${anoAnterior}-06-30` },
        3: { inicio: `${anoAnterior}-07-01`, fim: `${anoAnterior}-09-30` },
        4: { inicio: `${anoAnterior}-10-01`, fim: `${anoAnterior}-12-31` }
      }[trimestreAnterior] || { inicio: `${anoAnterior}-10-01`, fim: `${anoAnterior}-12-31` };
      
      const { data: cmvAnterior } = await supabase
        .from('cmv_manual')
        .select('cmv_percentual')
        .eq('bar_id', barId)
        .eq('periodo_tipo', 'trimestral')
        .eq('periodo_inicio', periodoAnterior.inicio)
        .single();
      
      const valorAtual = cmvData?.cmv_percentual || 0;
      const valorAnterior = cmvAnterior?.cmv_percentual || 0;
      const variacao = valorAnterior > 0 ? ((valorAtual - valorAnterior) / valorAnterior) * 100 : 0;
      
      const metas = getMetasTrimestre(trimestreAtual);
      return { valor: valorAtual, meta: metas.cmvLimpo, variacao };
    })()
  ]);

  // Processar Resultados Anuais
  let indicadoresAnuais: {
    faturamento: { valor: number; meta: number; detalhes?: Record<string, number> };
    pessoas: { valor: number; meta: number; detalhes?: Record<string, number> };
    reputacao: { valor: number; meta: number };
    ebitda: { valor: number; meta: number };
  } | null = null;
  if (!anualResult.error && anualResult.data && anualResult.data.length > 0) {
    const dados = anualResult.data[0];
    indicadoresAnuais = {
      faturamento: {
        valor: Number(dados.faturamento_total),
        meta: 18000000, 
        detalhes: {
          contahub: Number(dados.faturamento_contahub),
          yuzer: Number(dados.faturamento_yuzer),
          sympla: Number(dados.faturamento_sympla)
        }
      },
      pessoas: {
        valor: dados.pessoas_total,
        meta: 78000,
        detalhes: {
          contahub: dados.pessoas_contahub,
          yuzer: dados.pessoas_yuzer,
          sympla: dados.pessoas_sympla
        }
      },
      reputacao: {
        valor: Number(dados.reputacao_media),
        meta: 4.9
      },
      ebitda: {
        valor: 0, // calculado futuramente
        meta: 1800000
      }
    };
  }

  // Processar Resultados Trimestrais
  let indicadoresTrimestrais: {
    clientesAtivos: { valor: number; meta: number; variacao?: number };
    clientesTotais: { valor: number; meta: number; variacao?: number };
    retencao: { valor: number; meta: number; variacao?: number };
    retencaoReal: { valor: number; meta: number; variacao?: number };
    cmvLimpo: { valor: number; meta: number; variacao?: number };
    cmo: { valor: number; meta: number; variacao?: number };
    artistica: { valor: number; meta: number; variacao?: number };
  } | null = null;
  if (!trimestralResult.error && trimestralResult.data && trimestralResult.data.length > 0) {
    const dados = trimestralResult.data[0];
    const metas = getMetasTrimestre(trimestreAtual);
    
    indicadoresTrimestrais = {
      clientesAtivos: {
        valor: dados.clientes_ativos,
        meta: metas.clientesAtivos,
        variacao: Number(dados.variacao_clientes_ativos)
      },
      clientesTotais: {
        valor: dados.clientes_totais,
        meta: metas.clientesTotais,
        variacao: Number(dados.variacao_clientes_totais)
      },
      retencao: {
        ...retencaoResult,
        meta: metas.retencao
      },
      retencaoReal: {
        ...retencaoRealResult,
        meta: metas.retencaoReal
      },
      cmvLimpo: cmvLimpoResult,
      cmo: {
        valor: Number(dados.cmo_percentual),
        meta: metas.cmo,
        variacao: Number(dados.variacao_cmo)
      },
      artistica: {
        valor: Number(dados.artistica_percentual),
        meta: metas.artistica,
        variacao: Number(dados.variacao_artistica)
      }
    };
  }

  return (
    <IndicadoresClient 
      indicadoresAnuais={indicadoresAnuais}
      indicadoresTrimestrais={indicadoresTrimestrais}
      trimestreAtual={trimestreAtual}
    />
  );
}
