import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();

    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');

    // 2. VOLUME DE REGISTROS - ContaHub Analítico
    const { count: countAnalitico } = await supabase
      .from('contahub_analitico')
      .select('*', { count: 'exact', head: true });

    // 3. VOLUME - Eventos Base
    const { count: countEventos } = await supabase
      .from('eventos_base')
      .select('*', { count: 'exact', head: true });

    // 4. VOLUME - CMV Semanal
    const { count: countCmv } = await supabase
      .from('cmv_semanal')
      .select('*', { count: 'exact', head: true });

    // 5. VOLUME - Desempenho Semanal
    const { count: countDesempenho } = await supabase
      .from('desempenho_semanal')
      .select('*', { count: 'exact', head: true });

    // 6. COBERTURA - Eventos por bar
    const { data: eventosPorBar } = await supabase
      .from('eventos_base')
      .select('bar_id, data_evento, bars(name)')
      .order('data_evento', { ascending: true });

    // 7. CMV IMPOSSÍVEIS
    const { data: cmvImpossiveis } = await supabase
      .from('cmv_semanal')
      .select('id, bar_id, ano, semana, data_inicio, cmv_percentual')
      .or('cmv_percentual.gt.100,cmv_percentual.lt.0')
      .order('data_inicio', { ascending: false })
      .limit(50);

    // 8. ESTOQUE NEGATIVO - Produtos
    const { data: estoqueNegativoProdutos } = await supabase
      .from('contagem_estoque_produtos')
      .select('id, categoria, descricao, estoque_total, estoque_flutuante, estoque_fechado, data_contagem')
      .or('estoque_total.lt.0,estoque_flutuante.lt.0,estoque_fechado.lt.0')
      .order('data_contagem', { ascending: false })
      .limit(50);

    // 9. ESTOQUE NEGATIVO - Insumos
    const { data: estoqueNegativoInsumos } = await supabase
      .from('contagem_estoque_insumos')
      .select('id, categoria, descricao, estoque_total, estoque_flutuante, estoque_fechado, data_contagem')
      .or('estoque_total.lt.0,estoque_flutuante.lt.0,estoque_fechado.lt.0')
      .order('data_contagem', { ascending: false })
      .limit(50);

    // 10. VALORES NULOS - Faturamento NULL mas tem público
    const { data: eventosSemFaturamento } = await supabase
      .from('eventos_base')
      .select('id, bar_id, data_evento, nome, real_r, cl_real')
      .is('real_r', null)
      .not('cl_real', 'is', null)
      .gt('cl_real', 0)
      .order('data_evento', { ascending: false })
      .limit(50);

    // 11. VALORES NULOS - Faturamento mas sem público
    const { data: eventosSemPublico } = await supabase
      .from('eventos_base')
      .select('id, bar_id, data_evento, nome, real_r, cl_real')
      .not('real_r', 'is', null)
      .gt('real_r', 0)
      .or('cl_real.is.null,cl_real.eq.0')
      .order('data_evento', { ascending: false })
      .limit(50);

    // 12. DUPLICAÇÕES - Buscar todos eventos e processar
    const { data: todosEventos } = await supabase
      .from('eventos_base')
      .select('id, bar_id, data_evento, nome')
      .order('data_evento', { ascending: false });

    const duplicacoes: any[] = [];
    const mapaEventos = new Map<string, any[]>();
    
    (todosEventos || []).forEach((evento: any) => {
      const chave = `${evento.bar_id}-${evento.data_evento}`;
      if (!mapaEventos.has(chave)) {
        mapaEventos.set(chave, []);
      }
      mapaEventos.get(chave)!.push(evento);
    });

    mapaEventos.forEach((eventos, chave) => {
      if (eventos.length > 1) {
        duplicacoes.push({
          bar_id: eventos[0].bar_id,
          data_evento: eventos[0].data_evento,
          quantidade_duplicados: eventos.length,
          ids_duplicados: eventos.map(e => e.id).join(', '),
          nomes: eventos.map(e => e.nome).join(' | ')
        });
      }
    });

    // 13. GAPS TEMPORAIS - Buscar eventos dos últimos 90 dias
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 90);
    
    const { data: eventosRecentes } = await supabase
      .from('eventos_base')
      .select('data_evento')
      .eq('bar_id', barId)
      .gte('data_evento', dataInicio.toISOString().split('T')[0])
      .order('data_evento', { ascending: true });

    const datasComEventos = new Set((eventosRecentes || []).map((e: any) => e.data_evento));
    const gapsTemporais: any[] = [];
    
    for (let i = 0; i <= 90; i++) {
      const data = new Date();
      data.setDate(data.getDate() - i);
      const dataStr = data.toISOString().split('T')[0];
      const diaSemana = data.getDay();
      
      if (!datasComEventos.has(dataStr) && (diaSemana === 5 || diaSemana === 6)) {
        const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
        gapsTemporais.push({
          data: dataStr,
          dia_semana: dias[diaSemana],
          status: 'CRÍTICO - Fim de semana sem dados'
        });
      }
    }

    // 14. CALCULAR SCORE DE SAÚDE
    const qtdCmvImpossiveis = (cmvImpossiveis || []).length;
    const qtdEstoqueNegativo = ((estoqueNegativoProdutos || []).length + (estoqueNegativoInsumos || []).length);
    const qtdValoresNulos = ((eventosSemFaturamento || []).length + (eventosSemPublico || []).length);
    const qtdDuplicacoes = duplicacoes.length;
    const qtdGaps = gapsTemporais.length;

    const pontosDesconto = (
      qtdCmvImpossiveis * 10 +
      qtdEstoqueNegativo * 5 +
      qtdValoresNulos * 3 +
      qtdDuplicacoes * 2 +
      qtdGaps * 1
    );

    const scoreData = {
      cmv_impossiveis: qtdCmvImpossiveis,
      estoque_negativo: qtdEstoqueNegativo,
      valores_nulos: qtdValoresNulos,
      duplicacoes: qtdDuplicacoes,
      gaps_temporais: qtdGaps,
      pontos_desconto: pontosDesconto,
      score_saude: Math.max(0, 100 - pontosDesconto)
    };

    // 10. TOP 10 PROBLEMAS
    const { data: top10Problemas, error: erroTop10 } = await supabase.rpc('execute_raw_sql', {
      sql_query: `
        WITH problemas_ranked AS (
            SELECT 
                'CMV Impossível (>100% ou <0%)' as problema,
                (SELECT COUNT(*) FROM cmv_semanal WHERE cmv_percentual > 100 OR cmv_percentual < 0) +
                (SELECT COUNT(*) FROM cmv_manual WHERE cmv_percentual > 100 OR cmv_percentual < 0) as quantidade,
                'CRÍTICO' as severidade,
                10 as peso
            
            UNION ALL
            
            SELECT 
                'Estoque Negativo' as problema,
                (SELECT COUNT(*) FROM contagem_estoque_produtos 
                 WHERE estoque_total < 0 OR estoque_flutuante < 0 OR estoque_fechado < 0) +
                (SELECT COUNT(*) FROM contagem_estoque_insumos 
                 WHERE estoque_total < 0 OR estoque_flutuante < 0 OR estoque_fechado < 0) as quantidade,
                'ALTO' as severidade,
                5 as peso
            
            UNION ALL
            
            SELECT 
                'Eventos sem Faturamento mas com Público' as problema,
                (SELECT COUNT(*) FROM eventos_base 
                 WHERE real_r IS NULL AND cl_real IS NOT NULL AND cl_real > 0) as quantidade,
                'MÉDIO' as severidade,
                3 as peso
            
            UNION ALL
            
            SELECT 
                'Eventos com Faturamento mas sem Público' as problema,
                (SELECT COUNT(*) FROM eventos_base 
                 WHERE real_r IS NOT NULL AND real_r > 0 AND (cl_real IS NULL OR cl_real = 0)) as quantidade,
                'MÉDIO' as severidade,
                3 as peso
            
            UNION ALL
            
            SELECT 
                'Eventos Duplicados' as problema,
                (SELECT COUNT(*) FROM (
                    SELECT bar_id, data_evento FROM eventos_base 
                    GROUP BY bar_id, data_evento HAVING COUNT(*) > 1
                ) dups) as quantidade,
                'MÉDIO' as severidade,
                2 as peso
            
            UNION ALL
            
            SELECT 
                'Vendas sem Produto Identificado' as problema,
                (SELECT COUNT(*) FROM contahub_analitico 
                 WHERE (prd_desc IS NULL OR prd_desc = '') AND valorfinal > 0) as quantidade,
                'MÉDIO' as severidade,
                3 as peso
        )
        SELECT 
            problema,
            quantidade,
            severidade,
            peso,
            quantidade * peso as score_impacto,
            ROW_NUMBER() OVER (ORDER BY quantidade * peso DESC) as ranking
        FROM problemas_ranked
        WHERE quantidade > 0
        ORDER BY score_impacto DESC
        LIMIT 10;
      `
    });

    // 16. CALCULAR COBERTURA POR BAR
    const coberturaBares: any[] = [];
    const eventosPorBarMap = new Map<number, any[]>();
    
    (eventosPorBar || []).forEach((evento: any) => {
      if (!eventosPorBarMap.has(evento.bar_id)) {
        eventosPorBarMap.set(evento.bar_id, []);
      }
      eventosPorBarMap.get(evento.bar_id)!.push(evento);
    });

    eventosPorBarMap.forEach((eventos, barIdNum) => {
      const datas = eventos.map(e => e.data_evento).sort();
      if (datas.length > 0) {
        const primeiraData = new Date(datas[0]);
        const ultimaData = new Date(datas[datas.length - 1]);
        const diasEsperados = Math.floor((ultimaData.getTime() - primeiraData.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const diasComDados = new Set(datas).size;
        const taxaCobertura = (diasComDados / diasEsperados) * 100;
        
        coberturaBares.push({
          bar_id: barIdNum,
          nome_bar: eventos[0].bars?.name || `Bar ${barIdNum}`,
          primeira_data: datas[0],
          ultima_data: datas[datas.length - 1],
          dias_esperados: diasEsperados,
          dias_com_dados: diasComDados,
          taxa_cobertura_pct: Math.round(taxaCobertura * 100) / 100
        });
      }
    });

    coberturaBares.sort((a, b) => a.taxa_cobertura_pct - b.taxa_cobertura_pct);

    return NextResponse.json({
      success: true,
      auditoria: {
        volume_tabelas: {
          contahub_analitico: countAnalitico || 0,
          eventos_base: countEventos || 0,
          cmv_semanal: countCmv || 0,
          desempenho_semanal: countDesempenho || 0,
        },
        cobertura_bares: coberturaBares,
        cmv_impossiveis: (cmvImpossiveis || []) as any[],
        estoque_negativo: {
          produtos: (estoqueNegativoProdutos || []) as any[],
          insumos: (estoqueNegativoInsumos || []) as any[],
        },
        valores_nulos: {
          eventos_sem_faturamento: (eventosSemFaturamento || []) as any[],
          eventos_sem_publico: (eventosSemPublico || []) as any[],
        },
        duplicacoes: duplicacoes,
        gaps_temporais: gapsTemporais.slice(0, 30),
        score_saude: scoreData,
        top_10_problemas: top10Problemas,
      }
    });

  } catch (error: any) {
    console.error('Erro na auditoria completa:', error);
    return NextResponse.json(
      { error: 'Erro ao executar auditoria completa', details: error.message },
      { status: 500 }
    );
  }
}
