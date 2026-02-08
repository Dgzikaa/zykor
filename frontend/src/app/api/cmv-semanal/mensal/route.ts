import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

// Interface para dados CMV semanal
interface CMVSemanal {
  id: string;
  bar_id: number;
  ano: number;
  semana: number;
  data_inicio: string;
  data_fim: string;
  vendas_brutas: number;
  vendas_liquidas: number;
  faturamento_cmvivel: number;
  estoque_inicial: number;
  compras_periodo: number;
  estoque_final: number;
  consumo_socios: number;
  consumo_beneficios: number;
  consumo_adm: number;
  consumo_rh: number;
  consumo_artista: number;
  outros_ajustes: number;
  ajuste_bonificacoes: number;
  bonificacao_contrato_anual: number;
  bonificacao_cashback_mensal: number;
  cmv_real: number;
  cmv_limpo_percentual: number;
  cmv_teorico_percentual: number;
  gap: number;
  estoque_final_cozinha: number;
  estoque_final_bebidas: number;
  estoque_final_drinks: number;
  estoque_inicial_cozinha: number;
  estoque_inicial_bebidas: number;
  estoque_inicial_drinks: number;
  compras_custo_comida: number;
  compras_custo_bebidas: number;
  compras_custo_drinks: number;
  compras_custo_outros: number;
  total_consumo_socios: number;
  mesa_beneficios_cliente: number;
  mesa_banda_dj: number;
  chegadeira: number;
  mesa_adm_casa: number;
  mesa_rh: number;
}

// Obter número da semana ISO e o ano ISO
function getWeekAndYear(date: Date): { semana: number; ano: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const ano = d.getUTCFullYear();
  return { semana, ano };
}

// Calcular semanas com proporção de dias no mês
function calcularSemanasComProporcao(mes: number, ano: number): { semana: number; anoISO: number; proporcao: number; diasNoMes: number }[] {
  const primeiroDia = new Date(ano, mes - 1, 1);
  const ultimoDia = new Date(ano, mes, 0);
  
  // Contar dias de cada semana que pertencem ao mês
  const contagemDias = new Map<string, { semana: number; anoISO: number; diasNoMes: number }>();
  
  for (let d = new Date(primeiroDia); d <= ultimoDia; d.setDate(d.getDate() + 1)) {
    const { semana, ano: anoISO } = getWeekAndYear(new Date(d));
    const key = `${anoISO}-${semana}`;
    
    if (!contagemDias.has(key)) {
      contagemDias.set(key, { semana, anoISO, diasNoMes: 0 });
    }
    contagemDias.get(key)!.diasNoMes++;
  }
  
  // Calcular proporção (diasNoMes / 7)
  return Array.from(contagemDias.values()).map(s => ({
    ...s,
    proporcao: s.diasNoMes / 7
  }));
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    
    // Obter parâmetros
    const { searchParams } = new URL(request.url);
    const mes = parseInt(searchParams.get('mes') || (new Date().getMonth() + 1).toString());
    const ano = parseInt(searchParams.get('ano') || new Date().getFullYear().toString());
    
    // Obter bar_id da query string
    const barIdParam = searchParams.get('bar_id');
    const barId = barIdParam ? parseInt(barIdParam) : 3;

    // Datas do mês
    const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    // Calcular semanas com proporção de dias no mês
    const semanasComProporcao = calcularSemanasComProporcao(mes, ano);
    
    // Agrupar semanas por ano para consulta
    const semanasPorAno: Record<number, number[]> = {};
    for (const s of semanasComProporcao) {
      if (!semanasPorAno[s.anoISO]) semanasPorAno[s.anoISO] = [];
      if (!semanasPorAno[s.anoISO].includes(s.semana)) {
        semanasPorAno[s.anoISO].push(s.semana);
      }
    }

    // Buscar dados CMV de todas as semanas envolvidas
    const cmvPromises = Object.entries(semanasPorAno).map(([anoISO, semanas]) =>
      supabase
        .from('cmv_semanal')
        .select('*')
        .eq('bar_id', barId)
        .eq('ano', parseInt(anoISO))
        .in('semana', semanas)
    );

    const cmvResults = await Promise.all(cmvPromises);
    const cmvData = cmvResults.flatMap(r => r.data || []) as CMVSemanal[];

    // Criar mapa de dados por semana
    const cmvMap = new Map<string, CMVSemanal>();
    for (const c of cmvData) {
      cmvMap.set(`${c.ano}-${c.semana}`, c);
    }

    // Buscar estoque final do mês anterior como fallback para estoque inicial
    let estoqueFinalMesAnterior: CMVSemanal | null = null;
    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const anoMesAnterior = mes === 1 ? ano - 1 : ano;
    
    // Calcular as semanas ISO do mês anterior
    const semanasDoMesAnterior = calcularSemanasComProporcao(mesAnterior, anoMesAnterior);
    
    // Ordenar semanas do mês anterior em ordem decrescente (última semana primeiro)
    const semanasAnterioresOrdenadas = [...semanasDoMesAnterior].sort((a, b) => {
      if (b.anoISO !== a.anoISO) return b.anoISO - a.anoISO;
      return b.semana - a.semana;
    });
    
    // Buscar dados do mês anterior usando ano e semana (mesma lógica usada para o mês atual)
    const semanasPorAnoAnterior: Record<number, number[]> = {};
    for (const s of semanasAnterioresOrdenadas) {
      if (!semanasPorAnoAnterior[s.anoISO]) semanasPorAnoAnterior[s.anoISO] = [];
      if (!semanasPorAnoAnterior[s.anoISO].includes(s.semana)) {
        semanasPorAnoAnterior[s.anoISO].push(s.semana);
      }
    }
    
    const cmvPromisesAnterior = Object.entries(semanasPorAnoAnterior).map(([anoISO, semanas]) =>
      supabase
        .from('cmv_semanal')
        .select('*')
        .eq('bar_id', barId)
        .eq('ano', parseInt(anoISO))
        .in('semana', semanas)
    );
    
    const cmvResultsAnterior = await Promise.all(cmvPromisesAnterior);
    const cmvDataAnterior = cmvResultsAnterior.flatMap(r => r.data || []) as CMVSemanal[];
    
    // Criar mapa de dados do mês anterior
    const cmvMapAnterior = new Map<string, CMVSemanal>();
    for (const c of cmvDataAnterior) {
      cmvMapAnterior.set(`${c.ano}-${c.semana}`, c);
    }
    
    // Procurar estoque_final > 0 na última semana do mês anterior, depois nas anteriores
    for (const s of semanasAnterioresOrdenadas) {
      const dados = cmvMapAnterior.get(`${s.anoISO}-${s.semana}`);
      if (dados && parseFloat(String(dados.estoque_final)) > 0) {
        estoqueFinalMesAnterior = dados;
        break;
      }
    }

    // Agregar dados CMV com proporção
    const dadosMensais = agregarCMVProportional(semanasComProporcao, cmvMap, estoqueFinalMesAnterior);

    // Adicionar metadados
    const resultado = {
      ...dadosMensais,
      mes,
      ano,
      bar_id: barId,
      numero_semana: mes, // Para manter compatibilidade com o frontend
      data_inicio: dataInicio,
      data_fim: dataFim,
      id: `${ano}-${mes}`, // ID virtual para o mês
    };

    return NextResponse.json({
      success: true,
      mes: resultado,
      periodo: { dataInicio, dataFim },
      semanasIncluidas: semanasComProporcao.map(s => `${s.anoISO}-S${s.semana} (${Math.round(s.proporcao * 100)}%)`),
      parametros: { mes, ano, barId }
    });

  } catch (error) {
    console.error('Erro na API de CMV mensal:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Agregar dados CMV com proporção
function agregarCMVProportional(
  semanasComProporcao: { semana: number; anoISO: number; proporcao: number }[],
  cmvMap: Map<string, CMVSemanal>,
  estoqueFinalMesAnterior: CMVSemanal | null = null
): Record<string, number | null> {
  // Funções para somar com proporção
  const somaProportional = (campo: keyof CMVSemanal): number => {
    let soma = 0;
    for (const s of semanasComProporcao) {
      const dados = cmvMap.get(`${s.anoISO}-${s.semana}`);
      if (dados && dados[campo] !== null && dados[campo] !== undefined) {
        soma += (parseFloat(String(dados[campo])) || 0) * s.proporcao;
      }
    }
    return soma;
  };

  const mediaProportional = (campo: keyof CMVSemanal): number => {
    let soma = 0;
    let pesoTotal = 0;
    for (const s of semanasComProporcao) {
      const dados = cmvMap.get(`${s.anoISO}-${s.semana}`);
      if (dados && dados[campo] !== null && dados[campo] !== undefined) {
        soma += (parseFloat(String(dados[campo])) || 0) * s.proporcao;
        pesoTotal += s.proporcao;
      }
    }
    return pesoTotal > 0 ? soma / pesoTotal : 0;
  };

  // Para estoque inicial: usar o primeiro valor do mês (semana mais antiga com dados)
  // Se o valor for 0 ou null, usar estoque final do mês anterior como fallback
  const primeiroEstoque = (campoInicial: keyof CMVSemanal, campoFinalAnterior: keyof CMVSemanal): number | null => {
    // Ordenar semanas por ano e semana (crescente)
    const semanasOrdenadas = [...semanasComProporcao].sort((a, b) => {
      if (a.anoISO !== b.anoISO) return a.anoISO - b.anoISO;
      return a.semana - b.semana;
    });
    
    // Tentar encontrar um valor > 0 nas semanas do mês
    for (const s of semanasOrdenadas) {
      const dados = cmvMap.get(`${s.anoISO}-${s.semana}`);
      if (dados && dados[campoInicial] !== null && dados[campoInicial] !== undefined) {
        const valor = parseFloat(String(dados[campoInicial])) || 0;
        if (valor > 0) {
          return valor;
        }
      }
    }
    
    // Fallback: usar estoque final do mês anterior
    if (estoqueFinalMesAnterior && estoqueFinalMesAnterior[campoFinalAnterior] !== null) {
      const valorFallback = parseFloat(String(estoqueFinalMesAnterior[campoFinalAnterior])) || 0;
      if (valorFallback > 0) {
        return valorFallback;
      }
    }
    
    return null;
  };

  // Para estoque final: usar o último valor do mês (semana mais recente com dados > 0)
  // Se não encontrar, usa o estoque inicial do mesmo mês como fallback (estoque não mudou)
  const ultimoEstoque = (campoFinal: keyof CMVSemanal, campoInicialCorrespondente: keyof CMVSemanal): number | null => {
    // Ordenar semanas por ano e semana (decrescente)
    const semanasOrdenadas = [...semanasComProporcao].sort((a, b) => {
      if (b.anoISO !== a.anoISO) return b.anoISO - a.anoISO;
      return b.semana - a.semana;
    });
    
    // Tentar encontrar um valor > 0 nas semanas do mês (estoque final)
    for (const s of semanasOrdenadas) {
      const dados = cmvMap.get(`${s.anoISO}-${s.semana}`);
      if (dados && dados[campoFinal] !== null && dados[campoFinal] !== undefined) {
        const valor = parseFloat(String(dados[campoFinal])) || 0;
        if (valor > 0) {
          return valor;
        }
      }
    }
    
    // Fallback 1: Se não encontrou estoque_final > 0, tentar estoque_inicial da última semana
    for (const s of semanasOrdenadas) {
      const dados = cmvMap.get(`${s.anoISO}-${s.semana}`);
      if (dados && dados[campoInicialCorrespondente] !== null && dados[campoInicialCorrespondente] !== undefined) {
        const valor = parseFloat(String(dados[campoInicialCorrespondente])) || 0;
        if (valor > 0) {
          return valor;
        }
      }
    }
    
    // Fallback 2: usar estoque final do mês anterior se disponível
    if (estoqueFinalMesAnterior) {
      const valorFallback = parseFloat(String(estoqueFinalMesAnterior[campoFinal])) || 0;
      if (valorFallback > 0) {
        return valorFallback;
      }
    }
    
    // Se nenhum valor > 0 foi encontrado, retornar o primeiro valor encontrado (mesmo que 0)
    for (const s of semanasOrdenadas) {
      const dados = cmvMap.get(`${s.anoISO}-${s.semana}`);
      if (dados && dados[campoFinal] !== null && dados[campoFinal] !== undefined) {
        return parseFloat(String(dados[campoFinal])) || 0;
      }
    }
    
    return null;
  };

  return {
    // Vendas (soma proporcional)
    vendas_brutas: somaProportional('vendas_brutas'),
    vendas_liquidas: somaProportional('vendas_liquidas'),
    faturamento_cmvivel: somaProportional('faturamento_cmvivel'),
    
    // Estoque Inicial (primeiro do mês, com fallback para estoque final do mês anterior)
    estoque_inicial: primeiroEstoque('estoque_inicial', 'estoque_final'),
    estoque_inicial_cozinha: primeiroEstoque('estoque_inicial_cozinha', 'estoque_final_cozinha'),
    estoque_inicial_bebidas: primeiroEstoque('estoque_inicial_bebidas', 'estoque_final_bebidas'),
    estoque_inicial_drinks: primeiroEstoque('estoque_inicial_drinks', 'estoque_final_drinks'),
    
    // Compras (soma proporcional)
    compras_periodo: somaProportional('compras_periodo'),
    compras_custo_comida: somaProportional('compras_custo_comida'),
    compras_custo_bebidas: somaProportional('compras_custo_bebidas'),
    compras_custo_drinks: somaProportional('compras_custo_drinks'),
    compras_custo_outros: somaProportional('compras_custo_outros'),
    
    // Estoque Final (último do mês, com fallbacks)
    estoque_final: ultimoEstoque('estoque_final', 'estoque_inicial'),
    estoque_final_cozinha: ultimoEstoque('estoque_final_cozinha', 'estoque_inicial_cozinha'),
    estoque_final_bebidas: ultimoEstoque('estoque_final_bebidas', 'estoque_inicial_bebidas'),
    estoque_final_drinks: ultimoEstoque('estoque_final_drinks', 'estoque_inicial_drinks'),
    
    // Consumações (soma proporcional)
    consumo_socios: somaProportional('consumo_socios'),
    consumo_beneficios: somaProportional('consumo_beneficios'),
    consumo_adm: somaProportional('consumo_adm'),
    consumo_rh: somaProportional('consumo_rh'),
    consumo_artista: somaProportional('consumo_artista'),
    outros_ajustes: somaProportional('outros_ajustes'),
    total_consumo_socios: somaProportional('total_consumo_socios'),
    mesa_beneficios_cliente: somaProportional('mesa_beneficios_cliente'),
    mesa_banda_dj: somaProportional('mesa_banda_dj'),
    chegadeira: somaProportional('chegadeira'),
    mesa_adm_casa: somaProportional('mesa_adm_casa'),
    mesa_rh: somaProportional('mesa_rh'),
    
    // Bonificações (soma proporcional)
    ajuste_bonificacoes: somaProportional('ajuste_bonificacoes'),
    bonificacao_contrato_anual: somaProportional('bonificacao_contrato_anual'),
    bonificacao_cashback_mensal: somaProportional('bonificacao_cashback_mensal'),
    
    // CMV Real (soma proporcional)
    cmv_real: somaProportional('cmv_real'),
    
    // Percentuais (média ponderada)
    cmv_limpo_percentual: mediaProportional('cmv_limpo_percentual'),
    cmv_teorico_percentual: mediaProportional('cmv_teorico_percentual'),
    gap: mediaProportional('gap'),
  };
}
