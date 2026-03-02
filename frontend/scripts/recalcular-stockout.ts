/**
 * Script para recalcular dados históricos de stockout
 * Remove produtos que não devem estar no stockout (baldes, happy hour, etc)
 * 
 * Uso: cd frontend && npx tsx scripts/recalcular-stockout.ts [bar_id]
 * Exemplo: cd frontend && npx tsx scripts/recalcular-stockout.ts 3
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas!');
  console.error('Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão definidas em .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function recalcularStockout(barId: number) {
  console.log(`\n🔄 Iniciando recálculo de stockout para bar_id: ${barId}\n`);

  try {
    // 1. Deletar produtos que não devem estar no stockout
    const termosExcluidos = ['happy hour', 'happyhour', 'happy-hour', 'balde', 'baldes'];
    const locaisExcluidos = ['Baldes', 'Pegue e Pague', 'Venda Volante'];
    const gruposExcluidos = ['Baldes', 'Happy Hour', 'Dose Dupla', 'Insumos', 'Pegue e Pague', 'Uso Interno'];
    
    let totalDeletados = 0;
    
    // Deletar por nome do produto
    for (const termo of termosExcluidos) {
      console.log(`🔍 Buscando produtos com termo: "${termo}"...`);
      
      const { data: deletados, error } = await supabase
        .from('contahub_stockout')
        .delete()
        .eq('bar_id', barId)
        .ilike('prd_desc', `%${termo}%`)
        .select('id');

      if (error) {
        console.error(`❌ Erro ao deletar produtos com termo "${termo}":`, error);
      } else {
        const count = deletados?.length || 0;
        totalDeletados += count;
        console.log(`✅ Deletados ${count} produtos com termo "${termo}"`);
      }
    }
    
    // Deletar por local de produção
    for (const local of locaisExcluidos) {
      console.log(`🔍 Buscando produtos do local: "${local}"...`);
      
      const { data: deletados, error } = await supabase
        .from('contahub_stockout')
        .delete()
        .eq('bar_id', barId)
        .eq('loc_desc', local)
        .select('id');

      if (error) {
        console.error(`❌ Erro ao deletar produtos do local "${local}":`, error);
      } else {
        const count = deletados?.length || 0;
        totalDeletados += count;
        console.log(`✅ Deletados ${count} produtos do local "${local}"`);
      }
    }
    
    // Deletar por grupo
    for (const grupo of gruposExcluidos) {
      console.log(`🔍 Buscando produtos do grupo: "${grupo}"...`);
      
      const { data: deletados, error } = await supabase
        .from('contahub_stockout')
        .delete()
        .eq('bar_id', barId)
        .filter('raw_data->>grp_desc', 'eq', grupo)
        .select('id');

      if (error) {
        console.error(`❌ Erro ao deletar produtos do grupo "${grupo}":`, error);
      } else {
        const count = deletados?.length || 0;
        totalDeletados += count;
        console.log(`✅ Deletados ${count} produtos do grupo "${grupo}"`);
      }
    }

    console.log(`\n📊 Total de produtos deletados: ${totalDeletados}\n`);

    // 2. Buscar todas as datas únicas que temos dados
    console.log('📅 Buscando datas únicas...');
    const { data: datas, error: datasError } = await supabase
      .from('contahub_stockout')
      .select('data_consulta')
      .eq('bar_id', barId)
      .order('data_consulta', { ascending: false });

    if (datasError) {
      throw new Error(`Erro ao buscar datas: ${datasError.message}`);
    }

    const datasUnicas = [...new Set(datas?.map(d => d.data_consulta) || [])];
    console.log(`✅ Encontradas ${datasUnicas.length} datas únicas\n`);

    // 3. Para cada data, mostrar as estatísticas recalculadas
    console.log('📊 Estatísticas recalculadas (10 mais recentes):\n');
    
    for (const data of datasUnicas.slice(0, 10)) {
      // Buscar produtos da data
      const { data: produtos, error: produtosError } = await supabase
        .from('contahub_stockout')
        .select('*')
        .eq('bar_id', barId)
        .eq('data_consulta', data);

      if (produtosError) {
        console.error(`❌ Erro ao buscar produtos de ${data}:`, produtosError);
        continue;
      }

      // Calcular estatísticas
      const total = produtos?.length || 0;
      const ativos = produtos?.filter(p => p.prd_venda === 'S' && (p.prd_estoque || 0) > 0).length || 0;
      const inativos = total - ativos;
      const percStockout = total > 0 ? ((inativos / total) * 100).toFixed(2) : '0.00';

      console.log(`  ${data}: ${total} produtos | ${ativos} ativos | ${inativos} inativos | ${percStockout}% stockout`);
    }

    console.log(`\n✅ Recálculo concluído com sucesso!\n`);
    console.log(`📊 Resumo:`);
    console.log(`   - Bar ID: ${barId}`);
    console.log(`   - Produtos deletados: ${totalDeletados}`);
    console.log(`   - Datas recalculadas: ${datasUnicas.length}`);
    console.log(`   - Termos excluídos: ${termosExcluidos.join(', ')}`);
    console.log(`   - Locais excluídos: ${locaisExcluidos.join(', ')}`);
    console.log(`   - Grupos excluídos: ${gruposExcluidos.join(', ')}\n`);

  } catch (error) {
    console.error('\n❌ Erro no recálculo:', error);
    process.exit(1);
  }
}

// Executar
const barId = parseInt(process.argv[2] || '3'); // Default: Ordinário (bar_id = 3)

console.log('╔════════════════════════════════════════════════╗');
console.log('║   RECÁLCULO DE DADOS DE STOCKOUT - ZYKOR      ║');
console.log('╚════════════════════════════════════════════════╝');

recalcularStockout(barId)
  .then(() => {
    console.log('✨ Processo finalizado!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
