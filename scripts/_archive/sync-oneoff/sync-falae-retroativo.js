/**
 * Script para sincronizar respostas do Falaê retroativamente
 * 
 * Uso:
 * node scripts/sync-falae-retroativo.js
 * 
 * Ou especificar período:
 * node scripts/sync-falae-retroativo.js 30
 */

const SUPABASE_URL = 'https://uqtgsvujwcbymjmvkjhy.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxdGdzdnVqd2NieW1qbXZramh5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTMxMTE2NiwiZXhwIjoyMDY2ODg3MTY2fQ.cGdHBTSYbNv_qgm6K94DjGXDW46DtiSL3c5428c0WQ0';

const BAR_ID = 4; // Deboche
const DAYS_BACK = parseInt(process.argv[2]) || 90; // Padrão: 90 dias

async function syncFalaeRetroativo() {
  console.log('🔄 Sincronizando respostas do Falaê retroativamente...');
  console.log(`📅 Período: últimos ${DAYS_BACK} dias`);
  console.log(`🏪 Bar ID: ${BAR_ID} (Deboche)\n`);
  
  try {
    const response = await fetch(`https://zykor.vercel.app/api/falae/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        bar_id: BAR_ID,
        days_back: DAYS_BACK,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    console.log('✅ Sincronização concluída!\n');
    console.log('📊 Resultados:');
    console.log(`  - Respostas encontradas: ${result.respostas?.encontradas || 0}`);
    console.log(`  - Respostas inseridas/atualizadas: ${result.respostas?.inseridas_atualizadas || 0}`);
    console.log(`  - NPS Score do período: ${result.nps_periodo || 'N/A'}`);
    console.log(`  - Dias atualizados (nps_falae_diario): ${result.nps_diario?.dias_atualizados || 0}`);
    console.log(`  - Registros atualizados (nps_falae_diario_pesquisa): ${result.nps_diario_pesquisa?.rows_affected || 0}`);
    
    if (result.detalhes && result.detalhes.length > 0) {
      console.log('\n📋 Detalhes por tipo de pesquisa:');
      result.detalhes.forEach(d => {
        if (!d.erro) {
          console.log(`  - ${d.is_enps ? 'eNPS' : 'NPS'}: ${d.paginas} páginas, ${d.total_reportado || '?'} respostas`);
        }
      });
    }
    
    console.log(`\n⏰ Sincronizado em: ${result.synced_at}`);
    
  } catch (error) {
    console.error('\n❌ Erro ao sincronizar:', error.message);
    process.exit(1);
  }
}

syncFalaeRetroativo();
