import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// ONDA 2C: Buscar configuração de operação do banco
// SEM FALLBACK: Se banco não retornar, retornar erro
// =====================================================
interface BarConfig {
  bar_id: number;
  opera_segunda: boolean;
  opera_terca: boolean;
  opera_quarta: boolean;
  opera_quinta: boolean;
  opera_sexta: boolean;
  opera_sabado: boolean;
  opera_domingo: boolean;
}

let cachedBaresConfig: Record<number, BarConfig> = {};
let cachedBaresAtivos: number[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

async function getBaresAtivos(): Promise<number[] | null> {
  const agora = Date.now();
  
  if (cachedBaresAtivos && (agora - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedBaresAtivos;
  }
  
  const { data, error } = await supabase
    .from('bares')
    .select('id')
    .eq('ativo', true)
    .order('id');
  
  if (error || !data || data.length === 0) {
    console.error('❌ [ERRO CONFIG] Nenhum bar ativo encontrado na tabela bares.');
    return null;
  }
  
  cachedBaresAtivos = data.map(b => b.id);
  cacheTimestamp = agora;
  return cachedBaresAtivos;
}

async function getBarConfig(barId: number): Promise<BarConfig | null> {
  const agora = Date.now();
  
  if (cachedBaresConfig[barId] && (agora - cacheTimestamp) < CACHE_TTL_MS) {
    return cachedBaresConfig[barId];
  }
  
  const { data, error } = await supabase
    .from('bares_config')
    .select('bar_id, opera_segunda, opera_terca, opera_quarta, opera_quinta, opera_sexta, opera_sabado, opera_domingo')
    .eq('bar_id', barId)
    .single();
  
  if (error || !data) {
    console.error(`❌ [ERRO CONFIG] Configuração não encontrada para bar ${barId}. Configure bares_config.`);
    return null;
  }
  
  cachedBaresConfig[barId] = data;
  cacheTimestamp = agora;
  return data;
}

// Verifica se o bar funciona no dia da semana especificado
// diaSemana: 0=Domingo, 1=Segunda, 2=Terça, 3=Quarta, 4=Quinta, 5=Sexta, 6=Sábado
// Retorna null se config não encontrada (erro de config)
async function barFuncionaNoDia(barId: number, diaSemana: number): Promise<boolean | null> {
  const config = await getBarConfig(barId);
  if (!config) return null;
  
  switch (diaSemana) {
    case 0: return config.opera_domingo;
    case 1: return config.opera_segunda;
    case 2: return config.opera_terca;
    case 3: return config.opera_quarta;
    case 4: return config.opera_quinta;
    case 5: return config.opera_sexta;
    case 6: return config.opera_sabado;
    default: return true;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Usar data de ontem (dados do dia anterior às 20h)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const targetDate = yesterday.toISOString().split('T')[0];
    const diaSemana = yesterday.getUTCDay(); // 0=Domingo, 1=Segunda, etc.

    // ONDA 2C: Buscar bares ativos do banco - erro se não configurado
    const baresAtivos = await getBaresAtivos();
    if (!baresAtivos) {
      return NextResponse.json({
        success: false,
        error: 'Configuração ausente: nenhum bar ativo encontrado na tabela bares.',
        timestamp: new Date().toISOString(),
        cron_job: true
      }, { status: 500 });
    }
    
    const resultados: Array<{ bar_id: number; success: boolean; error?: string; result?: any; skipped?: boolean }> = [];
    
    for (const barId of baresAtivos) {
      // ONDA 2C: Verificar se o bar funciona nesse dia (via bares_config)
      const funciona = await barFuncionaNoDia(barId, diaSemana);
      if (funciona === null) {
        console.error(`❌ [ERRO CONFIG] Config não encontrada para bar ${barId}. Configure bares_config.`);
        resultados.push({ bar_id: barId, success: false, error: `Configuração ausente para bar ${barId}` });
        continue;
      }
      if (!funciona) {
        resultados.push({ bar_id: barId, success: true, skipped: true, result: { message: 'Bar fechado neste dia da semana' } });
        continue;
      }

      try {
        const response = await fetch('https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-stockout-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            data_date: targetDate,
            bar_id: barId
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Erro bar_id=${barId}: ${errorText}`);
          resultados.push({ bar_id: barId, success: false, error: errorText });
          continue;
        }
        
        const result = await response.json();
        resultados.push({ bar_id: barId, success: true, result });
      } catch (err) {
        console.error(`❌ Erro bar_id=${barId}:`, err);
        resultados.push({ bar_id: barId, success: false, error: err instanceof Error ? err.message : 'Erro' });
      }
    }
    
    const totalSucesso = resultados.filter(r => r.success).length;

    return NextResponse.json({
      success: totalSucesso > 0,
      message: `Sincronização de stockout executada para ${totalSucesso}/${baresAtivos.length} bares`,
      resultados,
      timestamp: new Date().toISOString(),
      cron_job: true
    });
    
  } catch (error) {
    console.error('❌ Erro na sincronização de stockout:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString(),
      cron_job: true
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data_date, bar_id, force } = body;
    
    // Se não especificado, usar data de ontem
    const targetDate = data_date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Calcular dia da semana da data alvo
    const [ano, mes, dia] = targetDate.split('-').map(Number);
    const dataAlvo = new Date(Date.UTC(ano, mes - 1, dia, 12, 0, 0));
    const diaSemana = dataAlvo.getUTCDay();
    
    // ONDA 2C: Se especificar bar_id, usar apenas esse; senão buscar todos do banco - erro se não configurado
    const baresAtivos = await getBaresAtivos();
    if (!baresAtivos && !bar_id) {
      return NextResponse.json({
        success: false,
        error: 'Configuração ausente: nenhum bar ativo encontrado na tabela bares.',
        timestamp: new Date().toISOString(),
        cron_job: false
      }, { status: 500 });
    }
    const baresParaSincronizar = bar_id ? [bar_id] : baresAtivos!;

    const resultados: Array<{ bar_id: number; success: boolean; error?: string; result?: any; skipped?: boolean }> = [];
    
    for (const barIdItem of baresParaSincronizar) {
      // ONDA 2C: Verificar se o bar funciona nesse dia (via bares_config, exceto se force=true)
      const funciona = await barFuncionaNoDia(barIdItem, diaSemana);
      if (funciona === null) {
        console.error(`❌ [ERRO CONFIG] Config não encontrada para bar ${barIdItem}. Configure bares_config.`);
        resultados.push({ bar_id: barIdItem, success: false, error: `Configuração ausente para bar ${barIdItem}` });
        continue;
      }
      if (!force && !funciona) {
        resultados.push({ bar_id: barIdItem, success: true, skipped: true, result: { message: 'Bar fechado neste dia da semana' } });
        continue;
      }
      
      try {
        const response = await fetch('https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/contahub-stockout-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            data_date: targetDate,
            bar_id: barIdItem
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          resultados.push({ bar_id: barIdItem, success: false, error: errorText });
          continue;
        }
        
        const result = await response.json();
        resultados.push({ bar_id: barIdItem, success: true, result });
      } catch (err) {
        resultados.push({ bar_id: barIdItem, success: false, error: err instanceof Error ? err.message : 'Erro' });
      }
    }
    
    return NextResponse.json({
      success: resultados.some(r => r.success),
      message: `Sincronização de stockout executada para data: ${targetDate}`,
      resultados,
      timestamp: new Date().toISOString(),
      cron_job: false
    });
    
  } catch (error) {
    console.error('❌ Erro na sincronização manual de stockout:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString(),
      cron_job: false
    }, { status: 500 });
  }
}
