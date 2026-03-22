import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface StatusDia {
  aberto: boolean;
  motivo: string;
  fonte: 'manual' | 'movimento' | 'padrao';
}

interface BarOperacao {
  opera_segunda: boolean;
  opera_terca: boolean;
  opera_quarta: boolean;
  opera_quinta: boolean;
  opera_sexta: boolean;
  opera_sabado: boolean;
  opera_domingo: boolean;
}

let cachedOperacao: Record<number, BarOperacao> = {};
let operacaoCacheTimestamp: Record<number, number> = {};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

async function getBarOperacao(barId: number): Promise<BarOperacao | null> {
  const agora = Date.now();
  
  if (cachedOperacao[barId] && (agora - (operacaoCacheTimestamp[barId] || 0)) < CACHE_DURATION) {
    return cachedOperacao[barId];
  }
  
  const { data, error } = await supabase
    .from('bares_config')
    .select('opera_segunda, opera_terca, opera_quarta, opera_quinta, opera_sexta, opera_sabado, opera_domingo')
    .eq('bar_id', barId)
    .single();
  
  if (error || !data) {
    console.error(`❌ [ERRO CONFIG] Dias de operação não encontrados para bar ${barId}. Configure bares_config.`);
    return null;
  }
  
  cachedOperacao[barId] = data;
  operacaoCacheTimestamp[barId] = agora;
  return data;
}

function barOperaNoDia(operacao: BarOperacao, diaSemana: number): boolean {
  switch (diaSemana) {
    case 0: return operacao.opera_domingo;
    case 1: return operacao.opera_segunda;
    case 2: return operacao.opera_terca;
    case 3: return operacao.opera_quarta;
    case 4: return operacao.opera_quinta;
    case 5: return operacao.opera_sexta;
    case 6: return operacao.opera_sabado;
    default: return true;
  }
}

interface CacheEntry {
  data: StatusDia;
  timestamp: number;
}

const statusCache = new Map<string, CacheEntry>();

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of statusCache.entries()) {
      if (now - entry.timestamp > CACHE_DURATION) {
        statusCache.delete(key);
      }
    }
  }, 60 * 1000);
}

export function limparCacheCalendario() {
  statusCache.clear();
  console.log('🗑️ Cache do calendário limpo');
}

export async function verificarBarAberto(
  data: string,
  barId: number
): Promise<StatusDia> {
  try {
    const cacheKey = `${data}-${barId}`;
    const cached = statusCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }

    const { data: registro, error: errorRegistro } = await supabase
      .from('calendario_operacional')
      .select('status, motivo')
      .eq('data', data)
      .eq('bar_id', barId)
      .maybeSingle();

    if (errorRegistro) {
      console.error('⚠️ Erro ao verificar calendário:', errorRegistro);
    }

    if (registro) {
      console.log(`📊 Calendário manual: ${data} = ${registro.status}`);
      const resultado = {
        aberto: registro.status === 'aberto',
        motivo: registro.motivo || `Definido manualmente como ${registro.status}`,
        fonte: 'manual' as const
      };
      
      statusCache.set(cacheKey, { data: resultado, timestamp: Date.now() });
      return resultado;
    }

    const [ano, mes, dia] = data.split('-').map(Number);
    const dataVerificacao = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
    const diaSemana = dataVerificacao.getUTCDay();
    const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const operacaoBar = await getBarOperacao(barId);
    if (!operacaoBar) {
      console.error(`❌ [calendario] Assumindo fechado por falta de config para bar ${barId}`);
      return {
        aberto: false,
        motivo: 'Erro ao verificar configuração do bar',
        fonte: 'padrao'
      };
    }
    const barOpera = barOperaNoDia(operacaoBar, diaSemana);
    
    if (!barOpera) {
      console.log(`🚫 Bar ${barId} fechado: ${data} (${diasSemana[diaSemana]})`);
      const resultado = {
        aberto: false,
        motivo: `${diasSemana[diaSemana]} (bar não opera)`,
        fonte: 'padrao' as const
      };
      statusCache.set(cacheKey, { data: resultado, timestamp: Date.now() });
      return resultado;
    }

    // MIGRADO: vendas_item (domain table) em vez de contahub_analitico
    if (dataVerificacao < hoje) {
      const { data: movimento, error: errorMovimento } = await supabase
        .from('vendas_item')
        .select('valor')
        .eq('data_venda', data)
        .eq('bar_id', barId);

      if (errorMovimento) {
        console.error('⚠️ Erro ao verificar movimento:', errorMovimento);
      }

      if (movimento && movimento.length > 0) {
        const valorVendas = movimento.reduce((sum: number, item: any) => sum + parseFloat(item.valor || '0'), 0);
        const temMovimento = valorVendas > 0;
        
        console.log(`💰 Movimento detectado: ${data} = R$ ${valorVendas.toFixed(2)} (${movimento.length} transações)`);
        
        const resultado = {
          aberto: temMovimento,
          motivo: temMovimento 
            ? `Movimento detectado (R$ ${valorVendas.toFixed(2)})` 
            : 'Sem movimento registrado',
          fonte: 'movimento' as const
        };
        
        statusCache.set(cacheKey, { data: resultado, timestamp: Date.now() });
        return resultado;
      }
    }

    const resultado: StatusDia = {
      aberto: true,
      motivo: `${diasSemana[diaSemana]} (dia normal de funcionamento)`,
      fonte: 'padrao'
    };

    statusCache.set(cacheKey, { data: resultado, timestamp: Date.now() });
    return resultado;

  } catch (error) {
    console.error('❌ Erro ao verificar se bar está aberto:', error);
    
    return {
      aberto: false,
      motivo: 'Erro ao verificar status do dia',
      fonte: 'padrao'
    };
  }
}

export async function verificarMultiplasDatas(
  datas: string[],
  barId: number
): Promise<Map<string, StatusDia>> {
  const resultado = new Map<string, StatusDia>();

  if (datas.length === 0) {
    return resultado;
  }

  try {
    const { data: registros, error: errorRegistros } = await supabase
      .from('calendario_operacional')
      .select('data, status, motivo')
      .eq('bar_id', barId)
      .in('data', datas);

    if (errorRegistros) {
      console.error('⚠️ Erro ao buscar registros:', errorRegistros);
    }

    const registrosMap = new Map(
      (registros || []).map(r => [r.data, r])
    );

    // MIGRADO: vendas_item (domain table) em vez de contahub_analitico
    const { data: movimentacoes, error: errorMovimentacoes } = await supabase
      .from('vendas_item')
      .select('data_venda, valor')
      .eq('bar_id', barId)
      .in('data_venda', datas);

    if (errorMovimentacoes) {
      console.error('⚠️ Erro ao buscar movimentações:', errorMovimentacoes);
    }

    const movimentacoesMap = new Map<string, number>();
    (movimentacoes || []).forEach((m: any) => {
      const data = m.data_venda;
      const valorAtual = movimentacoesMap.get(data) || 0;
      movimentacoesMap.set(data, valorAtual + parseFloat(m.valor || '0'));
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    for (const data of datas) {
      const registro = registrosMap.get(data);
      if (registro) {
        resultado.set(data, {
          aberto: registro.status === 'aberto',
          motivo: registro.motivo || `Definido como ${registro.status}`,
          fonte: 'manual'
        });
        continue;
      }

      const [ano, mes, dia] = data.split('-').map(Number);
      const dataVerificacao = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
      const diaSemana = dataVerificacao.getUTCDay();

      const operacaoBar = await getBarOperacao(barId);
      if (!operacaoBar) {
        console.error(`❌ [calendario] Assumindo fechado por falta de config para bar ${barId}`);
        resultado.set(data, {
          aberto: false,
          motivo: 'Erro ao verificar configuração do bar',
          fonte: 'padrao'
        });
        continue;
      }
      const barOpera = barOperaNoDia(operacaoBar, diaSemana);
      
      if (!barOpera) {
        const diasSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        resultado.set(data, {
          aberto: false,
          motivo: `${diasSemana[diaSemana]} (bar não opera)`,
          fonte: 'padrao'
        });
        continue;
      }

      if (dataVerificacao < hoje) {
        const movimento = movimentacoesMap.get(data) || 0;
        const temMovimento = movimento > 0;

        resultado.set(data, {
          aberto: temMovimento,
          motivo: temMovimento ? 'Movimento detectado' : 'Sem movimento',
          fonte: 'movimento'
        });
        continue;
      }

      resultado.set(data, {
        aberto: true,
        motivo: 'Dia normal de funcionamento',
        fonte: 'padrao'
      });
    }

    return resultado;

  } catch (error) {
    console.error('❌ Erro ao verificar múltiplas datas:', error);
    return resultado;
  }
}

export async function filtrarDiasAbertos<T extends Record<string, any>>(
  dados: T[],
  campoData: keyof T = 'data' as keyof T,
  barId: number
): Promise<T[]> {
  if (!dados || dados.length === 0) {
    return [];
  }

  try {
    const datasUnicas = [...new Set(
      dados
        .map(item => item[campoData] as string)
        .filter(data => data)
    )];

    if (datasUnicas.length === 0) {
      console.warn('⚠️ Nenhuma data válida encontrada para filtrar');
      return dados;
    }

    const statusDias = await verificarMultiplasDatas(datasUnicas, barId);

    const dadosFiltrados = dados.filter(item => {
      const data = item[campoData] as string;
      if (!data) return false;

      const status = statusDias.get(data);
      
      if (!status) return true;
      
      return status.aberto !== false;
    });

    const removidos = dados.length - dadosFiltrados.length;
    if (removidos > 0) {
      console.log(`📅 Filtro de dias: ${dados.length} → ${dadosFiltrados.length} (${removidos} dias fechados removidos)`);
    }

    return dadosFiltrados;

  } catch (error) {
    console.error('❌ Erro ao filtrar dias abertos:', error);
    return dados;
  }
}