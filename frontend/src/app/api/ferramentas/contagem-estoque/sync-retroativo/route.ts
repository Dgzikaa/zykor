import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseFunctionUrl } from '@/lib/supabase-functions-url';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutos

/**
 * 📊 API ROUTE - SINCRONIZAÇÃO RETROATIVA DE CONTAGEM
 * 
 * Chama a Edge Function para importar histórico completo de contagens
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { cronSecret, data_inicio, data_fim } = body;
    
    // Validar cronSecret
    if (cronSecret !== 'manual_retroativo' && cronSecret !== 'admin_trigger') {
      return NextResponse.json({
        success: false,
        error: 'Acesso não autorizado'
      }, { status: 401 });
    }
    
    // Validar datas
    if (!data_inicio || !data_fim) {
      return NextResponse.json({
        success: false,
        error: 'data_inicio e data_fim são obrigatórios'
      }, { status: 400 });
    }

    // Chamar Edge Function com SERVICE_ROLE_KEY
    const response = await fetch(
      getSupabaseFunctionUrl('sync-contagem-retroativo'),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ 
          cronSecret: 'manual_retroativo',
          data_inicio,
          data_fim
        })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge Function error: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();

    return NextResponse.json({
      success: true,
      message: `Sincronização retroativa executada: ${data_inicio} a ${data_fim}`,
      result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Erro na sincronização retroativa:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

