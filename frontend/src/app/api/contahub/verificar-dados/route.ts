/**
 * API para verificar dados do ContaHub no banco
 * MIGRADO: usa domain tables (vendas_item) em vez de staging
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

async function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not found');
  }
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || '2026-03-01';
    const barId = parseInt(searchParams.get('bar_id') || '3');

    const supabase = await getAdminClient();

    // 1. Verificar bronze_contahub_raw_data
    const { data: rawDataRaw, error: rawError } = await supabase
      .schema('bronze')
      .from('bronze_contahub_raw_data')
      .select('id, created_at, record_count')
      .eq('bar_id', barId)
      .eq('data_date', date)
      .order('created_at', { ascending: false })
      .limit(1);
    
    const rawData = rawDataRaw?.map((r: any) => ({
      id: r.id,
      data_coleta: r.created_at,
      total_registros: r.record_count
    }));

    // 2. Verificar vendas_item (domain table) - MIGRADO de bronze_contahub_vendas_analitico
    const { data: vendasData, error: vendasError } = await supabase
      .from('vendas_item')
      .select('id')
      .eq('bar_id', barId)
      .eq('data_venda', date);

    // 3. Verificar eventos_base
    const { data: eventoData, error: eventoError } = await supabase
      .from('eventos_base')
      .select('id, data_evento, real_r, cl_real, contahub_synced')
      .eq('bar_id', barId)
      .eq('data_evento', date)
      .single();

    // 4. Verificar última coleta bem-sucedida
    const { data: ultimaColetaRaw } = await supabase
      .schema('bronze')
      .from('bronze_contahub_raw_data')
      .select('data_date, created_at, record_count')
      .eq('bar_id', barId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    const ultimaColeta = ultimaColetaRaw?.map((r: any) => ({
      data_date: r.data_date,
      data_coleta: r.created_at,
      total_registros: r.record_count
    }));

    const resultado = {
      data_verificada: date,
      bar_id: barId,
      status: {
        contahub_raw: {
          existe: rawData && rawData.length > 0,
          total_coletas: rawData?.length || 0,
          ultima_coleta: rawData?.[0]?.data_coleta || null,
          total_registros: rawData?.[0]?.total_registros || 0,
          error: rawError?.message,
        },
        vendas_item: {
          existe: vendasData && vendasData.length > 0,
          total_registros: vendasData?.length || 0,
          error: vendasError?.message,
        },
        eventos_base: {
          existe: !!eventoData,
          faturamento: eventoData?.real_r || 0,
          publico: eventoData?.cl_real || 0,
          contahub_synced: eventoData?.contahub_synced || false,
          error: eventoError?.message,
        },
      },
      ultimas_coletas: ultimaColeta || [],
      diagnostico: '',
    };

    // Diagnóstico
    if (!rawData || rawData.length === 0) {
      resultado.diagnostico = '❌ CRÍTICO: Dados não foram coletados do ContaHub. Cron não rodou ou falhou.';
    } else if (!vendasData || vendasData.length === 0) {
      resultado.diagnostico = '⚠️ ATENÇÃO: Dados coletados mas não processados. Verificar contahub-processor.';
    } else if (!eventoData?.contahub_synced) {
      resultado.diagnostico = '⚠️ ATENÇÃO: Dados processados mas eventos_base não atualizado. Verificar update_eventos_base.';
    } else {
      resultado.diagnostico = '✅ OK: Dados completos e sincronizados.';
    }

    return NextResponse.json({
      success: true,
      ...resultado,
    });
  } catch (error: any) {
    console.error('❌ Erro ao verificar dados:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}