import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Classificação de locais para cálculo do Mix de Vendas
const LOCAIS_BEBIDAS = ['Chopp', 'Baldes', 'Pegue e Pague', 'PP', 'Venda Volante', 'Bar'];
const LOCAIS_COMIDAS = ['Cozinha', 'Cozinha 1', 'Cozinha 2'];
const LOCAIS_DRINKS = ['Preshh', 'Drinks', 'Drinks Autorais', 'Mexido', 'Shot e Dose', 'Batidos', 'Montados'];

// Classificação específica por bar
const LOCAIS_DRINKS_DEBOCHE = [...LOCAIS_DRINKS, 'Salao']; // Deboche (bar_id 4): Salao é Drinks

/**
 * Recalcula o Mix de Vendas (percent_b, percent_d, percent_c) para eventos
 * baseado nos dados atuais do contahub_analitico
 */
async function calcularMixVendasEvento(barId: number, dataEvento: string): Promise<{
  percent_b: number;
  percent_d: number;
  percent_c: number;
  total_valorfinal: number;
  registros_analisados: number;
} | null> {
  // Buscar dados do contahub_analitico para esta data
  const { data: contahubData, error } = await supabase
    .from('contahub_analitico')
    .select('valorfinal, loc_desc')
    .eq('bar_id', barId)
    .eq('trn_dtgerencial', dataEvento)
    .gt('valorfinal', 0);

  if (error || !contahubData || contahubData.length === 0) {
    return null;
  }

  // Selecionar classificação de drinks baseado no bar
  const locaisDrinks = barId === 4 ? LOCAIS_DRINKS_DEBOCHE : LOCAIS_DRINKS;

  let valor_bebidas = 0;
  let valor_comidas = 0;
  let valor_drinks = 0;
  let valor_outros = 0;
  let total_valorfinal = 0;

  contahubData.forEach(item => {
    const valor = item.valorfinal || 0;
    const loc = item.loc_desc || '';
    total_valorfinal += valor;

    if (LOCAIS_BEBIDAS.includes(loc)) {
      valor_bebidas += valor;
    } else if (LOCAIS_COMIDAS.includes(loc)) {
      valor_comidas += valor;
    } else if (locaisDrinks.includes(loc)) {
      valor_drinks += valor;
    } else {
      valor_outros += valor;
    }
  });

  // Calcular percentuais (Bebidas inclui "outros" como antes)
  let percent_b = 0;
  let percent_c = 0;
  let percent_d = 0;

  if (total_valorfinal > 0) {
    percent_b = ((valor_bebidas + valor_outros) / total_valorfinal) * 100;
    percent_c = (valor_comidas / total_valorfinal) * 100;
    percent_d = (valor_drinks / total_valorfinal) * 100;
  }

  return {
    percent_b: parseFloat(percent_b.toFixed(2)),
    percent_d: parseFloat(percent_d.toFixed(2)),
    percent_c: parseFloat(percent_c.toFixed(2)),
    total_valorfinal: parseFloat(total_valorfinal.toFixed(2)),
    registros_analisados: contahubData.length
  };
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Iniciando recálculo retroativo do Mix de Vendas...');

    // Autenticação
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      bar_id = user.bar_id,
      data_inicio, // YYYY-MM-DD
      data_fim,    // YYYY-MM-DD
      dry_run = false // Se true, apenas simula sem atualizar
    } = body;

    if (!data_inicio || !data_fim) {
      return NextResponse.json({ 
        error: 'data_inicio e data_fim são obrigatórios (formato YYYY-MM-DD)' 
      }, { status: 400 });
    }

    console.log(`📅 Período: ${data_inicio} até ${data_fim}`);
    console.log(`🏠 Bar ID: ${bar_id}`);
    console.log(`🔍 Modo: ${dry_run ? 'DRY RUN (simulação)' : 'PRODUÇÃO (atualizando)'}`);

    // Buscar todos os eventos no período
    const { data: eventos, error: eventosError } = await supabase
      .from('eventos_base')
      .select('id, data_evento, percent_b, percent_d, percent_c, real_r')
      .eq('bar_id', bar_id)
      .gte('data_evento', data_inicio)
      .lte('data_evento', data_fim)
      .order('data_evento', { ascending: true });

    if (eventosError) {
      console.error('❌ Erro ao buscar eventos:', eventosError);
      return NextResponse.json({ error: eventosError.message }, { status: 500 });
    }

    console.log(`📊 Encontrados ${eventos?.length || 0} eventos no período`);

    const resultados = {
      total_eventos: eventos?.length || 0,
      atualizados: 0,
      sem_dados_contahub: 0,
      erros: 0,
      detalhes: [] as any[]
    };

    for (const evento of eventos || []) {
      try {
        const novosMix = await calcularMixVendasEvento(bar_id, evento.data_evento);

        if (!novosMix) {
          resultados.sem_dados_contahub++;
          resultados.detalhes.push({
            data: evento.data_evento,
            status: 'sem_dados',
            mensagem: 'Sem dados no contahub_analitico'
          });
          continue;
        }

        const detalhe = {
          data: evento.data_evento,
          antes: {
            percent_b: parseFloat(evento.percent_b || '0'),
            percent_d: parseFloat(evento.percent_d || '0'),
            percent_c: parseFloat(evento.percent_c || '0')
          },
          depois: {
            percent_b: novosMix.percent_b,
            percent_d: novosMix.percent_d,
            percent_c: novosMix.percent_c
          },
          diferenca: {
            percent_b: parseFloat((novosMix.percent_b - parseFloat(evento.percent_b || '0')).toFixed(2)),
            percent_d: parseFloat((novosMix.percent_d - parseFloat(evento.percent_d || '0')).toFixed(2)),
            percent_c: parseFloat((novosMix.percent_c - parseFloat(evento.percent_c || '0')).toFixed(2))
          },
          registros_analisados: novosMix.registros_analisados,
          total_valorfinal: novosMix.total_valorfinal,
          status: 'ok'
        };

        if (!dry_run) {
          const { error: updateError } = await supabase
            .from('eventos_base')
            .update({
              percent_b: novosMix.percent_b,
              percent_d: novosMix.percent_d,
              percent_c: novosMix.percent_c,
              atualizado_em: new Date().toISOString()
            })
            .eq('id', evento.id);

          if (updateError) {
            console.error(`❌ Erro ao atualizar evento ${evento.data_evento}:`, updateError);
            detalhe.status = 'erro';
            resultados.erros++;
          } else {
            detalhe.status = 'atualizado';
            resultados.atualizados++;
          }
        } else {
          detalhe.status = 'simulado';
          resultados.atualizados++;
        }

        resultados.detalhes.push(detalhe);

      } catch (err) {
        console.error(`❌ Erro no evento ${evento.data_evento}:`, err);
        resultados.erros++;
        resultados.detalhes.push({
          data: evento.data_evento,
          status: 'erro',
          mensagem: err instanceof Error ? err.message : String(err)
        });
      }
    }

    console.log(`✅ Recálculo concluído: ${resultados.atualizados} atualizados, ${resultados.sem_dados_contahub} sem dados, ${resultados.erros} erros`);

    return NextResponse.json({
      success: true,
      message: dry_run 
        ? 'Simulação concluída - nenhum dado foi alterado'
        : 'Recálculo retroativo concluído',
      resultados
    });

  } catch (error) {
    console.error('❌ Erro geral:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: 'Recálculo Retroativo do Mix de Vendas',
    metodo: 'POST',
    descricao: 'Recalcula percent_b, percent_d, percent_c para eventos passados usando dados do contahub_analitico',
    parametros: {
      bar_id: 'ID do bar (opcional, usa o do usuário autenticado)',
      data_inicio: 'Data inicial no formato YYYY-MM-DD (obrigatório)',
      data_fim: 'Data final no formato YYYY-MM-DD (obrigatório)',
      dry_run: 'Se true, apenas simula sem atualizar (padrão: false)'
    },
    classificacao_locais: {
      bebidas: LOCAIS_BEBIDAS,
      comidas: LOCAIS_COMIDAS,
      drinks: LOCAIS_DRINKS
    },
    exemplo: {
      data_inicio: '2025-01-01',
      data_fim: '2025-09-30',
      dry_run: true
    }
  });
}
