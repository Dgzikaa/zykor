import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// GET - Listar segmentos salvos
export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id') || '3';
    
    const { data, error } = await supabase
      .from('crm_segmentacao')
      .select('*')
      .eq('bar_id', barId)
      .order('created_at', { ascending: false });
    
    if (error) {
      // Tabela não existe - retornar vazio (feature ainda não usada)
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          data: { segmentos: [], total: 0 }
        });
      }
      
      console.error('Erro ao buscar segmentos:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar segmentos: ' + error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        segmentos: data || [],
        total: data?.length || 0
      }
    });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao listar segmentos';
    console.error('Erro ao listar segmentos:', message);
    
    // Se for erro de configuração (service key não configurada), retornar vazio
    if (message.includes('SERVICE_ROLE_KEY') || message.includes('não está configurada')) {
      return NextResponse.json({
        success: true,
        data: { segmentos: [], total: 0 }
      });
    }
    
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
