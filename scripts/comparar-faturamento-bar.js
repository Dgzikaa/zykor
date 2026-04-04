/**
 * Compara faturamento_bar dos eventos com vr_produtos do contahub
 */

const eventosBar = {
  "2026-03-16": 7383.91,
  "2026-03-17": 14823.91,
  "2026-03-18": 36541.99,
  "2026-03-19": 9471.79,
  "2026-03-20": 72735.47,
  "2026-03-21": 119889.45,
  "2026-03-22": 57174.91,
};

const contahubProdutos = {
  "2026-03-16": 6610.11,
  "2026-03-17": 12821.46,
  "2026-03-18": 32736.13,
  "2026-03-19": 8478.72,
  "2026-03-20": 65518.10,
  "2026-03-21": 108136.50,
  "2026-03-22": 51478.80,
};

const contahubAnalitico = {
  "2026-03-16": 6610.11,
  "2026-03-17": 12821.46,
  "2026-03-18": 32736.13,
  "2026-03-19": 8478.72,
  "2026-03-20": 65518.10,
  "2026-03-21": 108163.40, // Note: ligeiramente diferente
  "2026-03-22": 51478.80,
};

console.log('📊 COMPARANDO FATURAMENTO DE PRODUTOS\n');

let totalEventosBar = 0;
let totalContahubProdutos = 0;
let totalContahubAnalitico = 0;

Object.keys(eventosBar).forEach(data => {
  const bar = eventosBar[data];
  const produtos = contahubProdutos[data];
  const analitico = contahubAnalitico[data];
  
  totalEventosBar += bar;
  totalContahubProdutos += produtos;
  totalContahubAnalitico += analitico;
  
  const diff = bar - produtos;
  const diffPerc = (diff / bar * 100);
  
  console.log(`${data}:`);
  console.log(`  eventos.faturamento_bar: R$ ${bar.toFixed(2)}`);
  console.log(`  contahub.vr_produtos: R$ ${produtos.toFixed(2)}`);
  console.log(`  Diferença: R$ ${diff.toFixed(2)} (${diffPerc.toFixed(2)}%)`);
  console.log('');
});

console.log('📊 TOTAIS:\n');
console.log(`eventos.faturamento_bar: R$ ${totalEventosBar.toFixed(2)}`);
console.log(`contahub.vr_produtos: R$ ${totalContahubProdutos.toFixed(2)}`);
console.log(`contahub.analitico (valorfinal): R$ ${totalContahubAnalitico.toFixed(2)}`);
console.log(`Diferença: R$ ${(totalEventosBar - totalContahubProdutos).toFixed(2)}`);
console.log(`% Diferença: ${((totalEventosBar - totalContahubProdutos) / totalEventosBar * 100).toFixed(2)}%`);

console.log('\n💡 CONCLUSÃO:');
console.log(`   faturamento_bar tem ~${((totalEventosBar - totalContahubProdutos) / totalEventosBar * 100).toFixed(0)}% a mais que contahub`);
console.log('   Isso pode ser:');
console.log('   1. Gorjeta de garçom (incluída no bar mas não nos produtos)');
console.log('   2. Taxa de serviço');
console.log('   3. Ajustes manuais');
console.log('');
console.log('   Para o mix bater com a planilha, devemos usar:');
console.log('   - Numerador: soma dos produtos por categoria (de contahub_analitico)');
console.log('   - Denominador: soma total de produtos (de contahub_analitico)');
