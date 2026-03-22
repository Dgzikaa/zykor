import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET - Listar segmentos salvos
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    
    const barId = searchParams.get('bar_id') || '3';
    
    const { data, error } = await supabase
      .from('crm_segmentacao')
      .select('*')
      .eq('bar_id', barId)
      .order('created_at', { ascending: false });
    
    if (error) {
      // Se a tabela não existir, retornar array vazio em vez de erro
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({
          success: true,
          data: {
            segmentos: [],
            total: 0
          }
        });
      }
      
      console.error('❌ Erro ao buscar segmentos:', error);
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
    
  } catch (error: any) {
    console.error('❌ Erro ao listar segmentos:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro ao listar segmentos' },
      { status: 500 }
    );
  }
}
