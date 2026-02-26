/**
 * Biblioteca de cálculos de folha de pagamento
 * Baseado na planilha "Cálculo Salários ORDINÁRIO"
 */

export interface DadosFuncionario {
  nome: string;
  tipo_contratacao: 'CLT' | 'PJ';
  area: string;
  vale_transporte: number;
  salario_bruto: number;
  adicional: number;
  adicional_aviso_previo: number;
  dias_trabalhados: number;
}

export interface ResultadoCalculo {
  // Valores de entrada
  salario_bruto: number;
  vale_transporte: number;
  adicional: number;
  adicional_aviso_previo: number;
  dias_trabalhados: number;
  
  // Cálculos CLT
  salario_liquido: number;
  adicionais_total: number;
  aviso_previo: number;
  fgts: number;
  inss_empresa: number;
  produtividade: number;
  
  // Custo total
  custo_empresa: number;
  custo_total: number;
  custo_semanal: number;
  
  // Detalhamento
  detalhamento: {
    salario_base: number;
    vale_transporte: number;
    adicional_noturno: number;
    adicional_aviso: number;
    fgts_8: number;
    inss_patronal: number;
    produtividade_bonus: number;
    total_mes: number;
    proporcao_semana: number;
  };
}

/**
 * Calcula o custo total de um funcionário
 */
export function calcularCustoFuncionario(dados: DadosFuncionario): ResultadoCalculo {
  const { tipo_contratacao, salario_bruto, vale_transporte, adicional, adicional_aviso_previo, dias_trabalhados } = dados;
  
  // Proporção da semana (7 dias de 30)
  const proporcaoSemana = dias_trabalhados / 30;
  
  if (tipo_contratacao === 'PJ') {
    // PJ: Custo direto sem encargos
    const custoTotal = salario_bruto;
    const custoSemanal = custoTotal * proporcaoSemana;
    
    return {
      salario_bruto,
      vale_transporte: 0,
      adicional: 0,
      adicional_aviso_previo: 0,
      dias_trabalhados,
      salario_liquido: salario_bruto,
      adicionais_total: 0,
      aviso_previo: 0,
      fgts: 0,
      inss_empresa: 0,
      produtividade: 0,
      custo_empresa: custoTotal,
      custo_total: custoTotal,
      custo_semanal: custoSemanal,
      detalhamento: {
        salario_base: salario_bruto,
        vale_transporte: 0,
        adicional_noturno: 0,
        adicional_aviso: 0,
        fgts_8: 0,
        inss_patronal: 0,
        produtividade_bonus: 0,
        total_mes: custoTotal,
        proporcao_semana: proporcaoSemana,
      },
    };
  }
  
  // CLT: Cálculo completo com encargos
  
  // 1. Salário Líquido = Salário Bruto (sem descontos nessa simulação simplificada)
  const salarioLiquido = salario_bruto;
  
  // 2. Adicionais
  const adicionaisTotal = adicional;
  
  // 3. Aviso Prévio
  const avisoPrevio = adicional_aviso_previo;
  
  // 4. FGTS (8% sobre salário bruto)
  const fgts = salario_bruto * 0.08;
  
  // 5. INSS Patronal (20% sobre salário bruto - simplificado)
  const inssEmpresa = salario_bruto * 0.20;
  
  // 6. Produtividade (assumindo R$ 5,00 fixo conforme planilha)
  const produtividade = 5.00;
  
  // 7. Custo Empresa (soma de todos os encargos)
  const custoEmpresa = salario_bruto + vale_transporte + adicionaisTotal + avisoPrevio + fgts + inssEmpresa + produtividade;
  
  // 8. Custo Total = Custo Empresa
  const custoTotal = custoEmpresa;
  
  // 9. Custo Semanal (proporcional aos dias trabalhados)
  const custoSemanal = custoTotal * proporcaoSemana;
  
  return {
    salario_bruto,
    vale_transporte,
    adicional,
    adicional_aviso_previo,
    dias_trabalhados,
    salario_liquido: salarioLiquido,
    adicionais_total: adicionaisTotal,
    aviso_previo: avisoPrevio,
    fgts,
    inss_empresa: inssEmpresa,
    produtividade,
    custo_empresa: custoEmpresa,
    custo_total: custoTotal,
    custo_semanal: custoSemanal,
    detalhamento: {
      salario_base: salario_bruto,
      vale_transporte,
      adicional_noturno: adicional,
      adicional_aviso: avisoPrevio,
      fgts_8: fgts,
      inss_patronal: inssEmpresa,
      produtividade_bonus: produtividade,
      total_mes: custoTotal,
      proporcao_semana: proporcaoSemana,
    },
  };
}

/**
 * Calcula o custo total de uma lista de funcionários
 */
export function calcularCustoTotalFolha(funcionarios: DadosFuncionario[]): {
  custoTotal: number;
  custoSemanal: number;
  detalhePorFuncionario: Array<DadosFuncionario & ResultadoCalculo>;
} {
  const resultados = funcionarios.map(func => ({
    ...func,
    ...calcularCustoFuncionario(func),
  }));
  
  const custoTotal = resultados.reduce((sum, r) => sum + r.custo_total, 0);
  const custoSemanal = resultados.reduce((sum, r) => sum + r.custo_semanal, 0);
  
  return {
    custoTotal,
    custoSemanal,
    detalhePorFuncionario: resultados,
  };
}

/**
 * Calcula Pro Labore proporcional da semana
 */
export function calcularProLaboreSemanal(proLaboreMensal: number, diasTrabalhados: number = 7): number {
  return (proLaboreMensal / 30) * diasTrabalhados;
}

/**
 * Calcula CMO Total
 */
export function calcularCMOTotal(params: {
  freelas: number;
  fixosTotal: number;
  cmaAlimentacao: number;
  proLaboreSemanal: number;
}): number {
  return params.freelas + params.fixosTotal + params.cmaAlimentacao + params.proLaboreSemanal;
}
