import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

// IDs dos bares que devem ser sincronizados
const BARES_ATIVOS = [3, 4]; // 3 = Ordinário Bar, 4 = Deboche Bar

export async function GET(request: NextRequest) {
  try {
    console.log('🔄 Executando sincronização diária automática do ContaHub para TODOS os bares...');

    // Usar ontem como data padrão (para cron diário)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const targetDate = yesterday.toISOString().split('T')[0];

    console.log(`📅 Data alvo: ${targetDate}`);

    const resultados: Array<{ bar_id: number; success: boolean; error?: string; result?: any }> = [];

    // Sincronizar cada bar
    for (const barId of BARES_ATIVOS) {
      console.log(`\n🍺 Sincronizando bar_id=${barId}...`);
      
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
            bar_id: barId
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Erro bar_id=${barId}: ${errorText}`);
          resultados.push({ bar_id: barId, success: false, error: errorText });
          continue;
        }

        const result = await response.json();
        console.log(`✅ bar_id=${barId}: ${result.summary?.total_records_collected || 0} registros coletados`);
        resultados.push({ bar_id: barId, success: true, result });
      } catch (err) {
        console.error(`❌ Erro bar_id=${barId}:`, err);
        resultados.push({ bar_id: barId, success: false, error: err instanceof Error ? err.message : 'Erro' });
      }
    }

    const totalSucesso = resultados.filter(r => r.success).length;
    console.log(`\n🎉 Sincronização diária concluída: ${totalSucesso}/${BARES_ATIVOS.length} bares sincronizados`);

    return NextResponse.json({
      success: totalSucesso > 0,
      message: `Sincronização diária ContaHub executada para ${totalSucesso}/${BARES_ATIVOS.length} bares`,
      resultados,
      timestamp: new Date().toISOString(),
      cron_job: true
    });

  } catch (error) {
    console.error('❌ Erro na sincronização diária ContaHub:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString(),
      cron_job: true
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Executando sincronização manual do ContaHub via POST...');

    const body = await request.json();
    const { data_date, bar_id } = body;

    // Se não especificar data, usar ontem
    const targetDate = data_date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    // Se não especificar bar_id, sincronizar todos
    const baresParaSincronizar = bar_id ? [bar_id] : BARES_ATIVOS;

    console.log(`📅 Data alvo: ${targetDate}`);
    console.log(`🍺 Bares: ${baresParaSincronizar.join(', ')}`);

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
        console.log(`✅ bar_id=${barIdItem}: ${result.summary?.total_records_collected || 0} registros`);
        resultados.push({ bar_id: barIdItem, success: true, result });
      } catch (err) {
        resultados.push({ bar_id: barIdItem, success: false, error: err instanceof Error ? err.message : 'Erro' });
      }
    }

    return NextResponse.json({
      success: resultados.some(r => r.success),
      message: `Sincronização ContaHub executada para data: ${targetDate}`,
      resultados,
      timestamp: new Date().toISOString(),
      cron_job: false
    });

  } catch (error) {
    console.error('❌ Erro na sincronização ContaHub:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString(),
      cron_job: false
    }, { status: 500 });
  }
}
