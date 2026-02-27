import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos (Vercel Pro)

/**
 * AGENTE DE EXPLORAÇÃO DIÁRIA
 * 
 * Executa automaticamente todos os dias às 6h da manhã:
 * 1. Auditoria rápida de saúde dos dados
 * 2. Análise de faturamento do dia anterior
 * 3. Detecção de anomalias (CMV alto, estoque baixo, etc)
 * 4. Geração de relatório diário
 * 5. Envio de alertas se necessário
 */

interface RelatorioSaude {
  score: number;
  problemas: string[];
  alertas: string[];
}

interface MetricasDiarias {
  faturamento: number;
  publico: number;
  ticket_medio: number;
  cmv_percentual: number;
}

export async function GET(request: NextRequest) {
  const inicio = Date.now();
  const supabase = createServiceRoleClient();
  
  try {
    console.log('🤖 Agente Diário iniciado:', new Date().toISOString());

    // Verificar autenticação (apenas cron jobs ou admin)
    const { searchParams } = new URL(request.url);
    const cronSecret = searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET || 'zykor-cron-secret-2026';
    
    if (cronSecret !== expectedSecret) {
      return NextResponse.json({ 
        error: 'Não autorizado',
        hint: 'Use ?secret=SEU_SECRET na URL'
      }, { status: 401 });
    }

    const barId = parseInt(searchParams.get('bar_id') || '3');
    const dataOntem = new Date();
    dataOntem.setDate(dataOntem.getDate() - 1);
    const dataOntemStr = dataOntem.toISOString().split('T')[0];

    // ========================================
    // 1. AUDITORIA RÁPIDA DE SAÚDE
    // ========================================
    console.log('📊 Executando auditoria de saúde...');
    
    const saudeResult = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/auditoria/completa?bar_id=${barId}`);
    const saudeData = await saudeResult.json();
    
    const saude: RelatorioSaude = {
      score: saudeData.auditoria?.score_saude?.score_saude || 0,
      problemas: [],
      alertas: []
    };

    // Verificar problemas críticos
    if (saudeData.auditoria?.cmv_impossiveis?.length > 0) {
      saude.problemas.push(`${saudeData.auditoria.cmv_impossiveis.length} CMVs impossíveis`);
    }
    if (saudeData.auditoria?.valores_nulos?.eventos_sem_publico?.length > 0) {
      saude.problemas.push(`${saudeData.auditoria.valores_nulos.eventos_sem_publico.length} eventos sem público`);
    }

    // ========================================
    // 2. MÉTRICAS DO DIA ANTERIOR
    // ========================================
    console.log('📈 Analisando métricas do dia anterior...');
    
    const { data: eventoOntem } = await supabase
      .from('eventos_base')
      .select('real_r, cl_real')
      .eq('bar_id', barId)
      .eq('data_evento', dataOntemStr)
      .single();

    const metricas: MetricasDiarias = {
      faturamento: eventoOntem?.real_r || 0,
      publico: eventoOntem?.cl_real || 0,
      ticket_medio: eventoOntem?.real_r && eventoOntem?.cl_real 
        ? eventoOntem.real_r / eventoOntem.cl_real 
        : 0,
      cmv_percentual: 0 // Será calculado quando semana fechar
    };

    // ========================================
    // 3. DETECÇÃO DE ANOMALIAS
    // ========================================
    console.log('🚨 Detectando anomalias...');
    
    // Buscar média dos últimos 30 dias
    const { data: ultimos30Dias } = await supabase
      .from('eventos_base')
      .select('real_r, cl_real')
      .eq('bar_id', barId)
      .gte('data_evento', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .not('real_r', 'is', null);

    const mediaFaturamento = (ultimos30Dias || []).reduce((acc, e) => acc + (e.real_r || 0), 0) / (ultimos30Dias?.length || 1);
    const mediaPublico = (ultimos30Dias || []).reduce((acc, e) => acc + (e.cl_real || 0), 0) / (ultimos30Dias?.length || 1);

    // Alertas de anomalias
    if (metricas.faturamento < mediaFaturamento * 0.5) {
      saude.alertas.push(`⚠️ Faturamento 50% abaixo da média (R$ ${metricas.faturamento.toFixed(2)} vs R$ ${mediaFaturamento.toFixed(2)})`);
    }
    if (metricas.faturamento > mediaFaturamento * 2) {
      saude.alertas.push(`🎉 Faturamento 2x acima da média! (R$ ${metricas.faturamento.toFixed(2)} vs R$ ${mediaFaturamento.toFixed(2)})`);
    }
    if (metricas.publico === 0 && metricas.faturamento > 0) {
      saude.alertas.push(`⚠️ Público não registrado mas faturamento de R$ ${metricas.faturamento.toFixed(2)}`);
    }

    // Verificar CMV da semana atual
    const { data: cmvSemanaAtual } = await supabase
      .from('cmv_semanal')
      .select('cmv_percentual')
      .eq('bar_id', barId)
      .gte('data_inicio', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('data_inicio', { ascending: false })
      .limit(1)
      .single();

    if (cmvSemanaAtual && cmvSemanaAtual.cmv_percentual > 50) {
      saude.alertas.push(`🚨 CMV CRÍTICO: ${cmvSemanaAtual.cmv_percentual.toFixed(2)}% (meta: <35%)`);
    } else if (cmvSemanaAtual && cmvSemanaAtual.cmv_percentual > 40) {
      saude.alertas.push(`⚠️ CMV Alto: ${cmvSemanaAtual.cmv_percentual.toFixed(2)}% (meta: <35%)`);
    }

    // ========================================
    // 4. SALVAR RELATÓRIO DIÁRIO
    // ========================================
    console.log('💾 Salvando relatório diário...');
    
    const { error: erroSalvar } = await supabase
      .from('relatorios_diarios')
      .insert({
        bar_id: barId,
        data_referencia: dataOntemStr,
        score_saude: saude.score,
        faturamento: metricas.faturamento,
        publico: metricas.publico,
        ticket_medio: metricas.ticket_medio,
        problemas: saude.problemas,
        alertas: saude.alertas,
        tempo_execucao_ms: Date.now() - inicio,
        executado_em: new Date().toISOString()
      });

    if (erroSalvar) {
      console.error('Erro ao salvar relatório:', erroSalvar);
    }

    // ========================================
    // 5. ENVIAR NOTIFICAÇÕES SE NECESSÁRIO
    // ========================================
    if (saude.alertas.length > 0) {
      console.log('📧 Enviando notificações...');
      
      // Enviar para Discord (se configurado)
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/configuracoes/edge-functions/discord-notification/route`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '🤖 Relatório Diário - Zykor',
            description: `**Data:** ${dataOntemStr}\n**Score de Saúde:** ${saude.score}%\n\n**Alertas:**\n${saude.alertas.join('\n')}`,
            color: saude.alertas.some(a => a.includes('🚨')) ? 'red' : 'yellow'
          })
        });
      } catch (error) {
        console.error('Erro ao enviar notificação Discord:', error);
      }
    }

    // ========================================
    // RESPOSTA FINAL
    // ========================================
    const tempoTotal = Date.now() - inicio;
    console.log(`✅ Agente Diário concluído em ${tempoTotal}ms`);

    return NextResponse.json({
      success: true,
      executado_em: new Date().toISOString(),
      tempo_execucao_ms: tempoTotal,
      data_analisada: dataOntemStr,
      saude: saude,
      metricas: metricas,
      comparacao: {
        faturamento_vs_media: metricas.faturamento / mediaFaturamento,
        publico_vs_media: metricas.publico / mediaPublico
      }
    });

  } catch (error: any) {
    console.error('❌ Erro no Agente Diário:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message,
        tempo_execucao_ms: Date.now() - inicio
      },
      { status: 500 }
    );
  }
}
