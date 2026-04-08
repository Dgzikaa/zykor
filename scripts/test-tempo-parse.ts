// Teste rápido para verificar se o parsing de tempo está funcionando

const item = {
  "ano": "2026",
  "t0-lancamento": "2026-04-01T16:09:53-0300",
  "t1-prodini": null,
  "t2-prodfim": null,
  "t3-entrega": "2026-04-01T16:59:54-0300",
  "t0-t3": 3001
};

console.log('Item original:', item);
console.log('t0-lancamento:', item['t0-lancamento']);
console.log('t3-entrega:', item['t3-entrega']);

// Simular o que o processador faz
const t0Lancamento = item['t0-lancamento'] || null;
const t3Entrega = item['t3-entrega'] || null;

console.log('\nApós extração:');
console.log('t0Lancamento:', t0Lancamento);
console.log('t3Entrega:', t3Entrega);

// Calcular diferença em minutos
const calcularDiferencaMinutos = (inicio: string | null, fim: string | null): number => {
  if (!inicio || !fim) return 0;
  try {
    const dataInicio = new Date(inicio.replace(' ', 'T'));
    const dataFim = new Date(fim.replace(' ', 'T'));
    if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) return 0;
    return Math.round((dataFim.getTime() - dataInicio.getTime()) / 60000);
  } catch {
    return 0;
  }
};

const t0_t3_calculado = calcularDiferencaMinutos(t0Lancamento, t3Entrega);
console.log('\nt0_t3 do ContaHub:', item['t0-t3']);
console.log('t0_t3 calculado:', t0_t3_calculado, 'minutos');
console.log('Diferença:', item['t0-t3'] - t0_t3_calculado, 'minutos');
