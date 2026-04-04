/**
 * Testa qual é o cálculo correto do mix
 */

// Dados da semana 12
const eventos = [
  { data: "2026-03-16", real_r: 8583.91, faturamento_bar: 7383.91, percent_b: 40.38 },
  { data: "2026-03-17", real_r: 18348.91, faturamento_bar: 14823.91, percent_b: 45.36 },
  { data: "2026-03-18", real_r: 46641.99, faturamento_bar: 36541.99, percent_b: 66.79 },
  { data: "2026-03-19", real_r: 12021.79, faturamento_bar: 9471.79, percent_b: 52.79 },
  { data: "2026-03-20", real_r: 95535.47, faturamento_bar: 72735.47, percent_b: 77.26 },
  { data: "2026-03-21", real_r: 161704.45, faturamento_bar: 119889.45, percent_b: 69.19 },
  { data: "2026-03-22", real_r: 67899.91, faturamento_bar: 57174.91, percent_b: 64.53 },
];

console.log('🧮 TESTANDO CÁLCULOS DE MIX\n');

// Método 1: Usando real_r (atual do sistema)
let somaRealR = 0;
let contribRealR = 0;

eventos.forEach(e => {
  somaRealR += e.real_r;
  contribRealR += e.real_r * e.percent_b / 100;
});

const mixRealR = (contribRealR / somaRealR) * 100;

// Método 2: Usando faturamento_bar (sem couvert)
let somaBar = 0;
let contribBar = 0;

eventos.forEach(e => {
  somaBar += e.faturamento_bar;
  contribBar += e.faturamento_bar * e.percent_b / 100;
});

const mixBar = (contribBar / somaBar) * 100;

// Método 3: Usando contahub_analitico direto
const totalContahub = 285806.72;
const bebidasContahub = 193499.99;
const mixContahub = (bebidasContahub / totalContahub) * 100;

console.log('1️⃣ Mix usando real_r (com couvert):');
console.log(`   Total: R$ ${somaRealR.toFixed(2)}`);
console.log(`   Mix: ${mixRealR.toFixed(4)}%`);
console.log(`   Diferença vs 67.7%: ${Math.abs(mixRealR - 67.7).toFixed(4)}%\n`);

console.log('2️⃣ Mix usando faturamento_bar (sem couvert):');
console.log(`   Total: R$ ${somaBar.toFixed(2)}`);
console.log(`   Mix: ${mixBar.toFixed(4)}%`);
console.log(`   Diferença vs 67.7%: ${Math.abs(mixBar - 67.7).toFixed(4)}%\n`);

console.log('3️⃣ Mix usando contahub_analitico direto:');
console.log(`   Total: R$ ${totalContahub.toFixed(2)}`);
console.log(`   Mix: ${mixContahub.toFixed(4)}%`);
console.log(`   Diferença vs 67.7%: ${Math.abs(mixContahub - 67.7).toFixed(4)}%\n`);

console.log('🎯 CONCLUSÃO:\n');

if (Math.abs(mixBar - 67.7) < 0.01) {
  console.log('   ✅ Usar faturamento_bar (sem couvert) bate com planilha!');
} else if (Math.abs(mixContahub - 67.7) < 0.01) {
  console.log('   ✅ Usar contahub_analitico direto bate com planilha!');
} else {
  console.log('   ⚠️  Nenhum método bate exatamente.');
  console.log(`   Mais próximo: ${Math.abs(mixBar - 67.7) < Math.abs(mixContahub - 67.7) ? 'faturamento_bar' : 'contahub_analitico'}`);
  console.log('');
  console.log('   A diferença pode vir de:');
  console.log('   - faturamento_bar ainda inclui gorjeta de garçom');
  console.log('   - contahub_analitico não tem todos os produtos');
  console.log('   - Os % (percent_b) foram calculados sobre real_r, não sobre produtos');
}
