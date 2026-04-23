/**
 * Calcula o mix usando contahub_analitico com mapeamento
 */

const dados = {
  "Pegue e Pague": 121837.43,
  "Baldes": 36618.71,
  "Cozinha 2": 26369.73,
  "Montados": 22669.15,
  "Shot e Dose": 9091.18,
  "Cozinha 1": 6221.66,
  "Batidos": 3383.62,
  "Bar": 3344.07,
  "Preshh": 1631.08,
  "Mexido": 1459.43,
  "Chopp": 1307.01,
  "Venda Volante": 399.20,
};

const mapeamento = {
  bebidas: ["Chopp", "Baldes", "Pegue e Pague", "PP", "Venda Volante", "Bar"],
  drinks: ["Preshh", "Montados", "Mexido", "Drinks", "Drinks Autorais", "Shot e Dose", "Batidos"],
  comidas: ["Cozinha", "Cozinha 1", "Cozinha 2"],
};

let totalBebidas = 0;
let totalDrinks = 0;
let totalComidas = 0;
let totalGeral = 0;

Object.entries(dados).forEach(([local, valor]) => {
  totalGeral += valor;
  
  if (mapeamento.bebidas.includes(local)) {
    totalBebidas += valor;
  } else if (mapeamento.drinks.includes(local)) {
    totalDrinks += valor;
  } else if (mapeamento.comidas.includes(local)) {
    totalComidas += valor;
  }
});

const percBebidas = (totalBebidas / totalGeral) * 100;
const percDrinks = (totalDrinks / totalGeral) * 100;
const percComidas = (totalComidas / totalGeral) * 100;

console.log('🧮 MIX USANDO CONTAHUB_ANALITICO\n');
console.log(`Total Geral: R$ ${totalGeral.toFixed(2)}`);
console.log(`Total Bebidas: R$ ${totalBebidas.toFixed(2)}`);
console.log(`Total Drinks: R$ ${totalDrinks.toFixed(2)}`);
console.log(`Total Comidas: R$ ${totalComidas.toFixed(2)}`);
console.log('');
console.log(`% Bebidas: ${percBebidas.toFixed(4)}%`);
console.log(`% Drinks: ${percDrinks.toFixed(4)}%`);
console.log(`% Comidas: ${percComidas.toFixed(4)}%`);
console.log('');
console.log(`Diferença vs 67.7%: ${Math.abs(percBebidas - 67.7).toFixed(4)}%`);
console.log('');

if (Math.abs(percBebidas - 67.7) < 0.01) {
  console.log('✅ BATE COM A PLANILHA!');
} else {
  console.log('❌ NÃO BATE COM A PLANILHA');
  console.log('');
  console.log('💡 contahub_analitico só tem R$ 234k de R$ 410k (57%)');
  console.log('   Faltam R$ 176k de dados!');
}
