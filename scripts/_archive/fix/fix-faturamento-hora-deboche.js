/**
 * Script para corrigir dados de faturamento por hora do Deboche
 * 
 * Problema: Tabela faturamento_hora tem dados incorretos (tudo na hora 0)
 * Solução: Sincronizar de contahub_fatporhora para faturamento_hora
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixFaturamentoHora() {
  console.log('🔧 Iniciando correção de faturamento por hora do Deboche...\n');

  const barId = 4; // Deboche
  const dataInicio = '2026-01-01';
  const dataFim = '2026-12-31';

  try {
    // 1. Buscar dados corretos de contahub_fatporhora
    console.log('📊 Buscando dados de contahub_fatporhora...');
    const { data: dadosContaHub, error: errorContaHub } = await supabase
      .from('contahub_fatporhora')
      .select('vd_dtgerencial, hora, valor')
      .eq('bar_id', barId)
      .gte('vd_dtgerencial', dataInicio)
      .lte('vd_dtgerencial', dataFim)
      .order('vd_dtgerencial', { ascending: true })
      .order('hora', { ascending: true });

    if (errorContaHub) {
      console.error('❌ Erro ao buscar dados:', errorContaHub);
      return;
    }

    console.log(`✅ Encontrados ${dadosContaHub.length} registros em contahub_fatporhora\n`);

    // 2. Deletar dados incorretos de faturamento_hora
    console.log('🗑️  Deletando dados incorretos de faturamento_hora...');
    const { error: errorDelete } = await supabase
      .from('faturamento_hora')
      .delete()
      .eq('bar_id', barId)
      .gte('data_venda', dataInicio)
      .lte('data_venda', dataFim);

    if (errorDelete) {
      console.error('❌ Erro ao deletar:', errorDelete);
      return;
    }

    console.log('✅ Dados antigos deletados\n');

    // 3. Inserir dados corretos em faturamento_hora
    console.log('📥 Inserindo dados corretos em faturamento_hora...');
    
    // Agrupar por data_venda e hora
    const dadosAgrupados = {};
    for (const row of dadosContaHub) {
      const key = `${row.vd_dtgerencial}-${row.hora}`;
      if (!dadosAgrupados[key]) {
        dadosAgrupados[key] = {
          bar_id: barId,
          data_venda: row.vd_dtgerencial,
          hora: String(row.hora),
          valor: 0,
          quantidade: 0
        };
      }
      dadosAgrupados[key].valor += parseFloat(row.valor || 0);
      dadosAgrupados[key].quantidade += 1;
    }

    const dadosParaInserir = Object.values(dadosAgrupados);
    console.log(`📊 Total de registros agrupados: ${dadosParaInserir.length}`);

    // Inserir em lotes de 1000
    const batchSize = 1000;
    for (let i = 0; i < dadosParaInserir.length; i += batchSize) {
      const batch = dadosParaInserir.slice(i, i + batchSize);
      const { error: errorInsert } = await supabase
        .from('faturamento_hora')
        .insert(batch);

      if (errorInsert) {
        console.error(`❌ Erro ao inserir lote ${Math.floor(i / batchSize) + 1}:`, errorInsert);
        return;
      }

      console.log(`✅ Lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(dadosParaInserir.length / batchSize)} inserido`);
    }

    console.log('\n🎉 Correção concluída com sucesso!');
    console.log(`📊 Total de registros inseridos: ${dadosParaInserir.length}`);

    // 4. Verificar resultado
    console.log('\n🔍 Verificando resultado...');
    const { data: verificacao, error: errorVerif } = await supabase
      .from('faturamento_hora')
      .select('data_venda, hora, valor')
      .eq('bar_id', barId)
      .gte('data_venda', '2026-03-30')
      .lte('data_venda', '2026-04-05')
      .order('data_venda', { ascending: true })
      .order('hora', { ascending: true });

    if (!errorVerif && verificacao) {
      console.log('\n📊 Amostra dos dados corrigidos (semana 14):');
      verificacao.slice(0, 20).forEach(row => {
        console.log(`  ${row.data_venda} ${String(row.hora).padStart(2, '0')}h: R$ ${parseFloat(row.valor).toFixed(2)}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

fixFaturamentoHora();
