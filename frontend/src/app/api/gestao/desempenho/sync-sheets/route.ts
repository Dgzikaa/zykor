import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { planilha_url, substituir_existentes } = await request.json();
    const barIdHeader = request.headers.get('x-selected-bar-id');
    const barId = barIdHeader ? parseInt(barIdHeader, 10) : null;

    if (!barId) {
      return NextResponse.json(
        { success: false, error: 'Bar não selecionado' },
        { status: 400 }
      );
    }

    // Por enquanto, vamos simular a sincronização
    // Em produção, aqui seria feita a integração com Google Sheets API
    
    const resultados = {
      dados_importados: 0,
      dados_atualizados: 0,
      total_processados: 0,
      erros: 0
    };

    // Simulação de dados importados
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    // Buscar dados existentes para simular atualização
    const { data: existingData } = await supabase
      .from('desempenho_semanal')
      .select('id')
      .eq('bar_id', barId);

    resultados.total_processados = 10; // Simulação
    resultados.dados_atualizados = existingData?.length || 0;
    resultados.dados_importados = Math.max(0, 10 - (existingData?.length || 0));

    return NextResponse.json({ 
      success: true,
      resultados,
      message: 'Sincronização simulada com sucesso. Implementação completa em desenvolvimento.'
    });

  } catch (error) {
    console.error('Erro na sincronização:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao sincronizar com planilha' },
      { status: 500 }
    );
  }
}
