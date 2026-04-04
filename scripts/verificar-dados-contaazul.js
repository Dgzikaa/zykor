/**
 * Script para verificar dados sincronizados do Conta Azul
 * 
 * Uso: node scripts/verificar-dados-contaazul.js [bar_id]
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function verificarDados(barId) {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`\n📊 Verificando dados do Conta Azul para bar_id=${barId}\n`);
  console.log('━'.repeat(60));

  // 1. Categorias
  const { data: categorias, error: errCat } = await supabase
    .from('contaazul_categorias')
    .select('*')
    .eq('bar_id', barId);

  console.log(`\n📁 Categorias: ${categorias?.length || 0}`);
  if (categorias && categorias.length > 0) {
    console.log('   Exemplos:');
    categorias.slice(0, 5).forEach(cat => {
      console.log(`   - ${cat.nome} (${cat.tipo || 'N/A'})`);
    });
  }

  // 2. Centros de Custo
  const { data: centros, error: errCentros } = await supabase
    .from('contaazul_centros_custo')
    .select('*')
    .eq('bar_id', barId);

  console.log(`\n🏢 Centros de Custo: ${centros?.length || 0}`);
  if (centros && centros.length > 0) {
    console.log('   Exemplos:');
    centros.slice(0, 5).forEach(centro => {
      console.log(`   - ${centro.nome} (${centro.codigo || 'sem código'})`);
    });
  }

  // 3. Pessoas (Fornecedores)
  const { data: pessoas, error: errPessoas } = await supabase
    .from('contaazul_pessoas')
    .select('*')
    .eq('bar_id', barId);

  console.log(`\n👥 Fornecedores: ${pessoas?.length || 0}`);
  if (pessoas && pessoas.length > 0) {
    console.log('   Exemplos:');
    pessoas.slice(0, 5).forEach(pessoa => {
      console.log(`   - ${pessoa.nome} (${pessoa.documento || 'sem doc'})`);
    });
  }

  // 4. Contas Financeiras
  const { data: contas, error: errContas } = await supabase
    .from('contaazul_contas_financeiras')
    .select('*')
    .eq('bar_id', barId);

  console.log(`\n💳 Contas Financeiras: ${contas?.length || 0}`);
  if (contas && contas.length > 0) {
    console.log('   Exemplos:');
    contas.forEach(conta => {
      console.log(`   - ${conta.nome} (${conta.tipo || 'N/A'}) ${conta.conta_padrao ? '⭐ Padrão' : ''}`);
    });
  }

  // 5. Lançamentos
  const { data: lancamentos, error: errLanc } = await supabase
    .from('contaazul_lancamentos')
    .select('*')
    .eq('bar_id', barId);

  console.log(`\n💰 Lançamentos: ${lancamentos?.length || 0}`);
  
  if (lancamentos && lancamentos.length > 0) {
    // Estatísticas
    const receitas = lancamentos.filter(l => l.tipo === 'RECEITA');
    const despesas = lancamentos.filter(l => l.tipo === 'DESPESA');
    
    const totalReceitas = receitas.reduce((sum, l) => sum + parseFloat(l.valor_bruto || 0), 0);
    const totalDespesas = despesas.reduce((sum, l) => sum + parseFloat(l.valor_bruto || 0), 0);

    console.log(`\n   📈 Receitas: ${receitas.length} (R$ ${totalReceitas.toFixed(2)})`);
    console.log(`   📉 Despesas: ${despesas.length} (R$ ${totalDespesas.toFixed(2)})`);
    console.log(`   💵 Saldo: R$ ${(totalReceitas - totalDespesas).toFixed(2)}`);

    // Status
    const porStatus = lancamentos.reduce((acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});

    console.log('\n   📊 Por Status:');
    Object.entries(porStatus).forEach(([status, count]) => {
      console.log(`      ${status}: ${count}`);
    });

    // Últimos lançamentos
    console.log('\n   📝 Últimos 5 lançamentos:');
    lancamentos
      .sort((a, b) => new Date(b.data_vencimento) - new Date(a.data_vencimento))
      .slice(0, 5)
      .forEach(lanc => {
        const valor = parseFloat(lanc.valor_bruto || 0).toFixed(2);
        const tipo = lanc.tipo === 'RECEITA' ? '💚' : '❤️';
        console.log(`      ${tipo} ${lanc.data_vencimento} - ${lanc.descricao?.substring(0, 40)} - R$ ${valor}`);
      });
  }

  // 6. Logs de Sincronização
  const { data: logs, error: errLogs } = await supabase
    .from('contaazul_logs_sincronizacao')
    .select('*')
    .eq('bar_id', barId)
    .order('data_inicio', { ascending: false })
    .limit(5);

  console.log(`\n📋 Últimas Sincronizações: ${logs?.length || 0}`);
  if (logs && logs.length > 0) {
    logs.forEach(log => {
      const status = log.status === 'success' ? '✅' : '❌';
      const duracao = log.duracao_segundos ? `${log.duracao_segundos}s` : 'N/A';
      console.log(`   ${status} ${log.data_inicio} - ${log.tipo_sincronizacao} (${duracao}) - ${log.total_registros || 0} registros`);
    });
  }

  console.log('\n' + '━'.repeat(60));
}

async function main() {
  const barId = process.argv[2] ? parseInt(process.argv[2]) : null;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Erro: Variáveis de ambiente não encontradas');
    process.exit(1);
  }

  if (barId) {
    await verificarDados(barId);
  } else {
    console.log('🔍 Verificando ambos os bares...');
    await verificarDados(3); // Ordinário
    await verificarDados(4); // Deboche
  }

  console.log('\n✅ Verificação concluída!');
}

main().catch(error => {
  console.error('❌ Erro:', error);
  process.exit(1);
});
