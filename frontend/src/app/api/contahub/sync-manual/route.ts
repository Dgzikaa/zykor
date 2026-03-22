import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// BLOCO 2D: Buscar bares ativos do banco
// SEM FALLBACK: Se banco não retornar, retornar erro
// =====================================================
async function getBaresAtivos(): Promise<number[] | null> {
  const { data, error } = await supabase
    .from('bares')
    .select('id')
    .eq('ativo', true)
    .order('id');
  
  if (error || !data || data.length === 0) {
    console.error('❌ [ERRO CONFIG] Nenhum bar ativo encontrado na tabela bares.');
    return null;
  }
  
  const bares = data.map(b => b.id);
  return bares;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data_date, bar_id } = body;

    // Se não especificar data, usar ontem
    const targetDate = data_date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // BLOCO 2D: Se especificar bar_id, usar apenas esse; senão buscar todos do banco - erro se não configurado
    const baresAtivos = await getBaresAtivos();
    if (!baresAtivos && !bar_id) {
      return NextResponse.json({
        success: false,
        error: 'Configuração ausente: nenhum bar ativo encontrado na tabela bares.',
        timestamp: new Date().toISOString()
      }, { status: 500 });
    }
    const baresParaSincronizar = bar_id ? [bar_id] : baresAtivos!;

    const resultados: Array<{ bar_id: number; success: boolean; error?: string; result?: any }> = [];

    for (const barIdItem of baresParaSincronizar) {
      try {
        // Usar nova função consolidada contahub-sync com action=sync
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/contahub-sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          },
          body: JSON.stringify({
            action: 'sync',
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
      message: `Sincronização ContaHub executada para data: ${targetDate}`,
      resultados,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro na sincronização ContaHub:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Endpoint para sincronização manual do ContaHub',
    usage: 'POST com {"data_date": "2025-08-21"} ou sem body para usar ontem'
  });
}
