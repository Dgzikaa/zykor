import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/cmv-semanal/sync-retroativo
 * Dispara atualização retroativa de várias semanas do CMV
 * 
 * Body: { bar_id: number, semanas: number } 
 * semanas = quantas semanas para trás processar (ex: 60 = últimas 60 semanas)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const barId = body.bar_id || 3;
    const totalSemanas = body.semanas || 60; // Padrão: últimas 60 semanas (~1 ano)
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuração Supabase ausente' }, { status: 500 });
    }
    
    console.log(`🔄 Iniciando sync retroativo CMV: ${totalSemanas} semanas, bar_id=${barId}`);
    
    const resultados: any[] = [];
    const erros: any[] = [];
    
    // Processar cada semana (de trás para frente)
    // offsetSemanas: 0 = semana atual, -1 = semana passada, -2 = 2 semanas atrás, etc.
    for (let i = 0; i < totalSemanas; i++) {
      const offsetSemanas = -i; // 0, -1, -2, -3...
      
      try {
        console.log(`📅 Processando offset ${offsetSemanas} (${i + 1}/${totalSemanas})`);
        
        const response = await fetch(`${supabaseUrl}/functions/v1/cmv-semanal-auto`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`
          },
          body: JSON.stringify({
            bar_id: barId,
            offsetSemanas: offsetSemanas
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          resultados.push({
            offset: offsetSemanas,
            ano: result.ano,
            semana: result.semana,
            periodo: result.periodo,
            success: true
          });
          console.log(`✅ Semana ${result.semana}/${result.ano} OK`);
        } else {
          erros.push({
            offset: offsetSemanas,
            error: result.error
          });
          console.error(`❌ Offset ${offsetSemanas}: ${result.error}`);
        }
        
        // Pequeno delay para não sobrecarregar
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (err: any) {
        erros.push({
          offset: offsetSemanas,
          error: err.message
        });
        console.error(`❌ Offset ${offsetSemanas}: ${err.message}`);
      }
    }
    
    console.log(`\n🎉 Sync retroativo finalizado: ${resultados.length} OK, ${erros.length} erros`);
    
    return NextResponse.json({
      success: true,
      message: `Sync retroativo: ${resultados.length}/${totalSemanas} semanas processadas`,
      bar_id: barId,
      total_semanas: totalSemanas,
      sucessos: resultados.length,
      erros: erros.length,
      resultados,
      erros_detalhes: erros
    });
    
  } catch (error: any) {
    console.error('❌ Erro no sync retroativo:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}

// GET - Retorna informações sobre o endpoint
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/cmv-semanal/sync-retroativo',
    method: 'POST',
    description: 'Sincroniza CMV de várias semanas retroativamente',
    body: {
      bar_id: 'ID do bar (padrão: 3)',
      semanas: 'Quantas semanas para trás processar (padrão: 60)'
    },
    exemplo: {
      bar_id: 3,
      semanas: 60
    }
  });
}
