import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ========================================
// 🔄 SINCRONIZAÇÃO MANUAL NPS E FELICIDADE
// ========================================
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Iniciando sincronização manual...');

    // Chamar função consolidada google-sheets-sync para ambas as actions
    const [npsResponse, felicidadeResponse] = await Promise.all([
      // Sincronizar NPS via google-sheets-sync
      fetch(`${SUPABASE_URL}/functions/v1/google-sheets-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'nps' }),
      }),
      // Sincronizar Pesquisa da Felicidade via google-sheets-sync
      fetch(`${SUPABASE_URL}/functions/v1/google-sheets-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'pesquisa-felicidade' }),
      }),
    ]);

    const npsData = await npsResponse.json();
    const felicidadeData = await felicidadeResponse.json();

    console.log('📊 Resultado NPS:', npsData);
    console.log('😊 Resultado Felicidade:', felicidadeData);

    // Verificar se ambas tiveram sucesso
    const npsSuccess = npsResponse.ok && npsData.success;
    const felicidadeSuccess = felicidadeResponse.ok && felicidadeData.success;

    if (!npsSuccess && !felicidadeSuccess) {
      return NextResponse.json(
        {
          success: false,
          error: 'Falha ao sincronizar ambas as pesquisas',
          details: {
            nps: npsData.error || 'Erro desconhecido',
            felicidade: felicidadeData.error || 'Erro desconhecido',
          },
        },
        { status: 500 }
      );
    }

    // Montar mensagem de sucesso
    const messages: string[] = [];
    if (npsSuccess) {
      messages.push(
        `✅ NPS: ${npsData.inserted || 0} registros sincronizados`
      );
    } else {
      messages.push(`⚠️ NPS: ${npsData.error || 'Falha na sincronização'}`);
    }

    if (felicidadeSuccess) {
      messages.push(
        `✅ Felicidade: ${felicidadeData.inserted || 0} registros sincronizados`
      );
    } else {
      messages.push(
        `⚠️ Felicidade: ${felicidadeData.error || 'Falha na sincronização'}`
      );
    }

    return NextResponse.json({
      success: npsSuccess || felicidadeSuccess,
      data: {
        message: messages.join('\n'),
        nps: {
          success: npsSuccess,
          total: npsData.total || 0,
          inserted: npsData.inserted || 0,
        },
        felicidade: {
          success: felicidadeSuccess,
          total: felicidadeData.total || 0,
          inserted: felicidadeData.inserted || 0,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ Erro na sincronização manual:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao sincronizar dados',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
