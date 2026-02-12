import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ========================================
// 🔄 SINCRONIZAÇÃO MANUAL NPS E FELICIDADE
// ========================================
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { data_inicio, data_fim } = body;
    const opts = (data_inicio && data_fim) ? { data_inicio, data_fim } : {};
    console.log('🔄 Iniciando sincronização manual...', Object.keys(opts).length ? `(retroativo: ${data_inicio} a ${data_fim})` : '');

    const [npsResponse, felicidadeResponse] = await Promise.all([
      fetch(`${SUPABASE_URL}/functions/v1/google-sheets-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'nps', ...opts }),
      }),
      fetch(`${SUPABASE_URL}/functions/v1/google-sheets-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'pesquisa-felicidade', ...opts }),
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
