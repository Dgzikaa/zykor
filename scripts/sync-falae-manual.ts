/**
 * Script para sincronizar manualmente dados do Falaê
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') });

const VERCEL_URL = 'https://zykor.com.br';

async function syncFalae(barId: number, daysBack: number = 14) {
  console.log(`\n🔄 Sincronizando Falaê para bar_id ${barId}...`);
  console.log(`   Período: últimos ${daysBack} dias\n`);

  try {
    const response = await fetch(`${VERCEL_URL}/api/falae/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bar_id: barId,
        days_back: daysBack,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Erro na sincronização:', data);
      return { success: false, error: data };
    }

    console.log('✅ Sincronização concluída!\n');
    console.log('📊 Resultados:');
    console.log(`   Bar ID: ${data.bar_id}`);
    console.log(`   Período: ${data.periodo?.inicio} até ${data.periodo?.fim}`);
    console.log(`   Respostas encontradas: ${data.respostas?.encontradas || 0}`);
    console.log(`   Respostas inseridas/atualizadas: ${data.respostas?.inseridas_atualizadas || 0}`);
    console.log(`   NPS do período: ${data.nps_periodo ?? 'N/A'}`);
    console.log(`   Dias atualizados (nps_falae_diario): ${data.nps_diario?.dias_atualizados || 0}`);
    console.log(`   Registros atualizados (nps_falae_diario_pesquisa): ${data.nps_diario_pesquisa?.rows_affected || 0}`);

    return { success: true, data };
  } catch (error) {
    console.error('❌ Erro ao sincronizar:', error);
    return { success: false, error };
  }
}

async function main() {
  console.log('🚀 Iniciando sincronização manual do Falaê...\n');
  console.log(`📍 URL: ${VERCEL_URL}\n`);

  const barId = 3;
  const daysBack = 14;

  const result = await syncFalae(barId, daysBack);

  if (result.success) {
    console.log('\n🎉 Sincronização concluída com sucesso!');
    process.exit(0);
  } else {
    console.log('\n❌ Falha na sincronização');
    process.exit(1);
  }
}

main();
