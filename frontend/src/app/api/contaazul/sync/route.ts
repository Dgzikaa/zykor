import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/contaazul/sync
 * Sincroniza dados do Conta Azul
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const barId = body.bar_id || 3;
    const syncMode = body.sync_mode || 'daily_incremental';
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Configuração Supabase ausente' }, { status: 500 });
    }

    console.log(`🔄 Sincronizando Conta Azul - Bar ${barId} - Mode: ${syncMode}`);

    const response = await fetch(`${supabaseUrl}/functions/v1/contaazul-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        bar_id: barId,
        sync_mode: syncMode
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Erro no contaazul-sync:', result);
      return NextResponse.json(
        { error: result.error || 'Erro ao sincronizar Conta Azul' },
        { status: response.status }
      );
    }

    console.log('✅ Conta Azul sincronizado:', result);

    return NextResponse.json({
      success: true,
      message: result.message || 'Conta Azul sincronizado com sucesso',
      stats: result.stats
    });
    
  } catch (error: any) {
    console.error('❌ Erro no sync:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
