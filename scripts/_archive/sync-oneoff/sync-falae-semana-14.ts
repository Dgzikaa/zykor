/**
 * Script para sincronizar dados do Falaê da semana 14 (30.03 - 05.04/2026)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'frontend', '.env.local') });

const VERCEL_URL = 'https://zykor.com.br';

async function syncFalaeSemana14(barId: number) {
  console.log(`\n🔄 Sincronizando Falaê para bar_id ${barId}...`);
  console.log(`   Período: Semana 14 (30.03 - 05.04/2026)\n`);

  // Calcular dias desde 30.03.2026
  const dataInicio = new Date('2026-03-30');
  const hoje = new Date();
  const diffTime = Math.abs(hoje.getTime() - dataInicio.getTime());
  const daysBack = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  console.log(`   Buscando últimos ${daysBack} dias para cobrir a semana 14...\n`);

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
  console.log('🚀 Iniciando sincronização manual do Falaê - Semana 14...\n');
  console.log(`📍 URL: ${VERCEL_URL}\n`);

  // Sincronizar para ambos os bars
  const bars = [
    { id: 4, nome: 'Deboche Bar' },
    { id: 3, nome: 'Ordinário Bar' },
  ];

  for (const bar of bars) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📍 Sincronizando ${bar.nome} (ID: ${bar.id})`);
    console.log('='.repeat(60));

    const result = await syncFalaeSemana14(bar.id);

    if (!result.success) {
      console.log(`\n❌ Falha na sincronização do ${bar.nome}`);
    }
  }

  console.log('\n🎉 Sincronização concluída!');
}

main();
