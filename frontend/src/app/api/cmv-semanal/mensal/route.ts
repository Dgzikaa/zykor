import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { getAdminClient } from '@/lib/supabase-admin';
import { getFatorCmv, safeDivideCmv } from '@/lib/config/getFatorCmv';
import { tbl } from '@/lib/supabase/table-schemas';
import { paginate } from '@/lib/supabase/paginate';

// Cache por 2 minutos para dados mensais de CMV
export const revalidate = 120;

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
  // CMA - Custo de Alimentação de Funcionários
  estoque_inicial_funcionarios: number;
  compras_alimentacao: number;
  estoque_final_funcionarios: number;
  cma_total: number;
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

/**
 * Faturamento do CMV mensal no MÊS CORRENTE vai do dia 01 até o ÚLTIMO DOMINGO
 * fechado (semanas completas Seg–Dom), espelhando o fechamento semanal do CMV.
 * O estoque/contagem da planilha também fecha por semana (domingo), então o
 * "casamento" da visão mensal é com o domingo, não com marcos fixos.
 * Ex.: hoje=qua 17/06 -> último domingo=14/06 -> exibe 01–14 (sem 15/16/17).
 *
 * Quando o mês deixa de ser corrente, esta função retorna null e a visão usa o
 * mês inteiro (01..último dia) — o faturamento "trava".
 *
 * Retorna null também quando ainda não fechou nenhuma semana dentro do mês
 * (o último domingo caiu antes do dia 01) — sem dados consolidados pra mostrar.
 *
 * Datas calculadas no fuso America/Sao_Paulo pra o "hoje"/dia-da-semana baterem
 * com a operação (servidor roda em UTC).
 */
function getDataFimUltimoDomingoCorrente(mes: number, ano: number): string | null {
  // "Hoje" no fuso de São Paulo (YYYY-MM-DD), pra não escorregar de dia perto da meia-noite.
  const spStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const [anoSP, mesSP, diaSP] = spStr.split('-').map(Number);
  if (ano !== anoSP || mes !== mesSP) return null;

  // Último domingo ESTRITAMENTE antes de hoje (semana Seg–Dom completa).
  // getDay(): 0=Dom..6=Sáb. Se hoje é domingo, volta pro domingo anterior.
  const hoje = new Date(anoSP, mesSP - 1, diaSP, 12, 0, 0);
  const diaSemana = hoje.getDay();
  const ultimoDomingo = new Date(hoje);
  ultimoDomingo.setDate(hoje.getDate() - (diaSemana === 0 ? 7 : diaSemana));

  // Se o último domingo caiu fora do mês corrente, ainda não há semana fechada.
  if (ultimoDomingo.getMonth() + 1 !== mes || ultimoDomingo.getFullYear() !== ano) {
    return null;
  }

  const y = ultimoDomingo.getFullYear();
  const m = String(ultimoDomingo.getMonth() + 1).padStart(2, '0');
  const d = String(ultimoDomingo.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
    const dataFimMesCheio = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
    // Mês corrente: faturamento/compras/consumos vão do dia 01 até o ÚLTIMO
    // DOMINGO fechado (semanas completas). Mês fechado: usa o mês inteiro.
    const dataFimDomingo = getDataFimUltimoDomingoCorrente(mes, ano);
    const dataFim = dataFimDomingo || dataFimMesCheio;
    const ehMesCorrenteRecorte = dataFimDomingo !== null;

    // Breakdown das categorias para a visão mensal vindo do CONTA AZUL — MESMA fonte do
    // total (categorias [Consumação] X, já em custo, classificação manual = base da DRE).
    // Sem "outros": o de-para do CA cobre as categorias. Casa com a soma do total.
    let consumacoes9Mensal: Record<string, number> | null = null;
    try {
      const { data: caCons } = await (supabase as any)
        .schema('bronze')
        .from('bronze_contaazul_lancamentos')
        .select('categoria_nome, tipo, valor_bruto, valor_pago')
        .eq('bar_id', barId)
        .is('excluido_em', null)
        .gte('data_competencia', dataInicio)
        .lte('data_competencia', dataFim)
        .ilike('categoria_nome', '[Consuma%');
      if (Array.isArray(caCons) && caCons.length > 0) {
        const mapCat = (nome: string): string | null => {
          const c = (nome || '').toLowerCase();
          if (c.includes('ajuste')) return null; // contra-lançamento agregado, não é categoria
          if (c.includes('sócio') || c.includes('socio')) return 'socios';
          if (c.includes('artista')) return 'artistas';
          if (c.includes('operaç') || c.includes('operac')) return 'funcionarios_operacao';
          if (c.includes('escritó') || c.includes('escrito')) return 'funcionarios_escritorio';
          if (c.includes('aniversár') || c.includes('aniversar')) return 'aniversario';
          if (c.includes('influencer')) return 'influencer';
          if (c.includes('pontos')) return 'programa_pontos';
          if (c.includes('cliente')) return 'beneficio_cliente';
          return 'outros';
        };
        const acc: Record<string, number> = {};
        for (const r of caCons as any[]) {
          const k = mapCat(r.categoria_nome);
          if (!k) continue;
          const pago = parseFloat(r.valor_pago) || 0;
          const bruto = parseFloat(r.valor_bruto) || 0;
          const v = (pago > 0 ? pago : bruto) * (String(r.tipo) === 'RECEITA' ? -1 : 1);
          acc[k] = (acc[k] || 0) + v;
        }
        consumacoes9Mensal = {};
        for (const [k, v] of Object.entries(acc)) consumacoes9Mensal[k] = Math.round(v * 100) / 100;
      }
    } catch (e) {
      console.warn('consumação por categoria (mensal, Conta Azul) falhou:', e);
    }

    // Buscar dados diretamente da tabela cmv_mensal (alimentada por sync-cmv-mensal + agregar_cmv_mensal_auto)
    // Usado pra todos os meses, inclusive o corrente — fallback proporcional só roda se cmv_mensal não tem dados.
    const mesAtual = new Date().getMonth() + 1;
    const anoAtual = new Date().getFullYear();
    const isMesAtual = (ano === anoAtual && mes === mesAtual);

    // CMV teórico AUTOMÁTICO do mês. Mês atual/futuro: automático manda.
    // Passado: o manual tem prioridade; sem manual, usa o automático (antes o passado ficava em branco/0).
    // Usa fn_cmv_teorico_periodo e filtra "sem ficha" pra ficar 100% igual ao /operacional/cmv-teorico
    // (a matview gold.cmv_teorico_dia inclui produtos sem ficha com custo 0, o que dilui o CMV).
    const mesAtualOuFuturo = ano > anoAtual || (ano === anoAtual && mes >= mesAtual);
    let cmvTeoricoAuto: number | null = null;
    {
      const { data: rows } = await (supabase as any).schema('gold')
        .rpc('fn_cmv_teorico_periodo', { p_bar_id: barId, p_ini: dataInicio, p_fim: dataFim });
      let c = 0, f = 0;
      for (const r of (rows || []) as any[]) {
        if (Number(r.itens_ficha || 0) <= 0) continue;
        c += Number(r.custo_total) || 0;
        f += Number(r.faturamento) || 0;
      }
      cmvTeoricoAuto = f > 0 ? Number((c / f * 100).toFixed(2)) : null;
    }

    const { data: cmvMensal, error: errMensal } = await tbl(supabase, 'cmv_mensal')
      .select('*')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('mes', mes)
      .single();

    // Se tiver dados na tabela cmv_mensal, usar diretamente
    if (cmvMensal && !errMensal) {
      // Buscar fator CMV do banco (centralizado)
      const fatorCmv = await getFatorCmv(supabase, barId);

      // atual/futuro: automático manda. passado: manual tem prioridade; sem manual, usa o automático.
      const manualMes = cmvMensal.cmv_teorico_percentual_manual;
      const temManualMes = manualMes !== null && manualMes !== undefined && String(manualMes) !== '' && Number(manualMes) > 0;
      const usaAutoMes = cmvTeoricoAuto != null && (mesAtualOuFuturo || !temManualMes);
      
      // Calcular semanas para informação
      const semanasComProporcao = calcularSemanasComProporcao(mes, ano);
      const primeiroDiaMes = new Date(ano, mes - 1, 1);
      const { semana: semanaInicial, ano: anoInicial } = getWeekAndYear(primeiroDiaMes);
      const primeiroDiaMesSeguinte = new Date(ano, mes, 1);
      const { semana: semanaFinal, ano: anoFinal } = getWeekAndYear(primeiroDiaMesSeguinte);

      // Mês em andamento: estoque_final ainda não foi preenchido pela planilha (próximo snapshot é 01 do mês seguinte).
      // Sem est_fim, o cmv_real fica inflado (= est_ini + compras). Zera os calculados pra evitar exibir lixo.
      const estFimZero = parseFloat(String(cmvMensal.estoque_final || 0)) === 0
        && parseFloat(String(cmvMensal.estoque_inicial || 0)) > 0;
      const cmvRealEfetivo = estFimZero ? 0 : parseFloat(String(cmvMensal.cmv_real || 0));
      const cmvLimpoPctEfetivo = estFimZero ? 0 : parseFloat(String(cmvMensal.cmv_limpo_percentual || 0));
      const cmvRealPctEfetivo = estFimZero ? 0 : parseFloat(String(cmvMensal.cmv_real_percentual || 0));

      // Mapear campos da tabela cmv_mensal para o formato esperado (Onda 2A: usa fator do banco)
      const dadosMensais = {
        vendas_brutas: parseFloat(String(cmvMensal.faturamento_total || 0)),
        vendas_liquidas: parseFloat(String(cmvMensal.faturamento_cmvivel || 0)),
        faturamento_cmvivel: parseFloat(String(cmvMensal.faturamento_cmvivel || 0)),
        estoque_inicial: parseFloat(String(cmvMensal.estoque_inicial || 0)),
        estoque_inicial_cozinha: 0,
        estoque_inicial_bebidas: 0,
        estoque_inicial_drinks: 0,
        compras_periodo: parseFloat(String(cmvMensal.compras || 0)),
        compras_custo_comida: 0,
        compras_custo_bebidas: 0,
        compras_custo_drinks: 0,
        compras_custo_outros: 0,
        estoque_final: parseFloat(String(cmvMensal.estoque_final || 0)),
        estoque_final_cozinha: 0,
        estoque_final_bebidas: 0,
        estoque_final_drinks: 0,
        total_consumo_socios: safeDivideCmv(parseFloat(String(cmvMensal.consumo_socios || 0)), fatorCmv),
        mesa_beneficios_cliente: safeDivideCmv(parseFloat(String(cmvMensal.consumo_beneficios || 0)), fatorCmv),
        mesa_banda_dj: safeDivideCmv(parseFloat(String(cmvMensal.consumo_artista || 0)), fatorCmv),
        mesa_adm_casa: safeDivideCmv(parseFloat(String(cmvMensal.consumo_rh_operacao || 0)) + parseFloat(String(cmvMensal.consumo_rh_escritorio || 0)), fatorCmv),
        consumo_socios: parseFloat(String(cmvMensal.consumo_socios || 0)),
        consumo_beneficios: parseFloat(String(cmvMensal.consumo_beneficios || 0)),
        consumo_rh: parseFloat(String(cmvMensal.consumo_rh_operacao || 0)) + parseFloat(String(cmvMensal.consumo_rh_escritorio || 0)),
        consumo_artista: parseFloat(String(cmvMensal.consumo_artista || 0)),
        outros_ajustes: parseFloat(String(cmvMensal.outros_ajustes || 0)),
        ajuste_bonificacoes: parseFloat(String(cmvMensal.ajuste_bonificacoes || 0)),
        bonificacao_contrato_anual: parseFloat(String(cmvMensal.bonificacao_contrato_anual || 0)),
        bonificacao_cashback_mensal: parseFloat(String(cmvMensal.bonificacao_cashback_mensal || 0)),
        // Campo único de bonificações (fallback p/ soma dos legados não migrados)
        bonificacoes: cmvMensal.bonificacoes !== null && cmvMensal.bonificacoes !== undefined
          ? parseFloat(String(cmvMensal.bonificacoes))
          : (parseFloat(String(cmvMensal.bonificacao_contrato_anual || 0)) + parseFloat(String(cmvMensal.bonificacao_cashback_mensal || 0))),
        cmv_real: cmvRealEfetivo,
        cmv_limpo_percentual: cmvLimpoPctEfetivo,
        cmv_teorico_percentual: usaAutoMes ? cmvTeoricoAuto : parseFloat(String(cmvMensal.cmv_teorico_percentual || 0)),
        cmv_teorico_auto: usaAutoMes,
        cmv_teorico_percentual_manual: cmvMensal.cmv_teorico_percentual_manual !== null && cmvMensal.cmv_teorico_percentual_manual !== undefined
          ? parseFloat(String(cmvMensal.cmv_teorico_percentual_manual))
          : null,
        gap: parseFloat(String(cmvMensal.gap || 0)),
        estoque_inicial_funcionarios: parseFloat(String(cmvMensal.estoque_inicial_funcionarios || 0)),
        compras_alimentacao: parseFloat(String(cmvMensal.compras_alimentacao || 0)),
        estoque_final_funcionarios: parseFloat(String(cmvMensal.estoque_final_funcionarios || 0)),
        cma_total: parseFloat(String(cmvMensal.cma_total || 0)),
        // Componentes do Faturamento Limpo (breakdown do tooltip) — preenchidos abaixo.
        comissao: 0,
        couvert_atracoes: 0,
        ingressos_yuzer: 0,
        ingressos_sympla: 0,
      };

      // Recorte por semana fechada (apenas mes corrente): refazer faturamento e
      // compras dinamicamente cortando ate `dataFim` (ultimo domingo fechado).
      // Estoque vem do snapshot semanal via cmv_mensal (planilha fecha no domingo).
      //
      // Fonte de verdade espelha gold.cmv (ETL semanal):
      //   - bruto/liquido vem de gold.planejamento (faturamento_total_consolidado, faturamento_couvert)
      //   - liquido = bruto - couvert - comissao
      //   - compras = SUM(valor_bruto) WHERE categoria_nome ILIKE '%custo%' (inclui Outros,
      //     case-insensitive — bar_categorias_custo tem case-mismatch e nao mapeia cmv_outros)
      // Componentes que decompõem Bruto → Limpo (breakdown do tooltip do Fat. Limpo).
      // Sempre calculados p/ [dataInicio, dataFim] (mês fechado = mês cheio; corrente =
      // até o último domingo). Bilheteria (Yuzer + Sympla) e couvert saem do limpo por
      // não serem venda de produto — espelha agregar_cmv_mensal_auto / cmv-semanal-auto.
      const { data: planej } = await (supabase
        .schema('gold' as any) as any)
        .from('planejamento')
        .select('faturamento_total_consolidado, sympla_liquido, faturamento_entrada_yuzer')
        .eq('bar_id', barId)
        .gte('data_evento', dataInicio)
        .lte('data_evento', dataFim);
      const ingressosYuzer = (planej || []).reduce(
        (s: number, r: any) => s + (parseFloat(r.faturamento_entrada_yuzer) || 0), 0
      );
      const ingressosSympla = (planej || []).reduce(
        (s: number, r: any) => s + (parseFloat(r.sympla_liquido) || 0), 0
      );
      const { data: comCouvert } = await (supabase as any)
        .rpc('get_comissao_couvert_periodo', {
          p_bar_id: barId,
          p_data_inicio: dataInicio,
          p_data_fim: dataFim,
        });
      const rpcRow = Array.isArray(comCouvert) ? comCouvert[0] : comCouvert;
      const gorjetaTotal = parseFloat(String(rpcRow?.comissao || 0));
      const couvertTotal = parseFloat(String(rpcRow?.couvert || 0));

      dadosMensais.comissao = gorjetaTotal;
      dadosMensais.couvert_atracoes = couvertTotal;
      dadosMensais.ingressos_yuzer = ingressosYuzer;
      dadosMensais.ingressos_sympla = ingressosSympla;

      // Mês corrente: refaz faturamento cortando até o último domingo fechado.
      if (ehMesCorrenteRecorte) {
        const fatBruto = (planej || []).reduce(
          (s: number, r: any) => s + (parseFloat(r.faturamento_total_consolidado) || 0), 0
        );
        const fatLiquido = fatBruto - couvertTotal - gorjetaTotal - ingressosYuzer - ingressosSympla;
        dadosMensais.vendas_brutas = fatBruto;
        dadosMensais.vendas_liquidas = fatLiquido;
        dadosMensais.faturamento_cmvivel = fatLiquido;
      }

      // Compras detalhadas (sub-totais por categoria) — SEMPRE rodar, tanto
      // pra mes fechado quanto corrente. Sem isso, o drill-down "Compras" da
      // visao mensal mostra Custo Comida/Bebidas/Drinks/Outros zerados nos
      // meses fechados (cmv_mensal so guarda o agregado total `compras`).
      // Para mes corrente, dataFim ja eh o ultimo marco fechado (recorta certo).
      // Para meses fechados, dataFim eh o ultimo dia do mes.
      // PAGINADO: meses pesados podem passar de 1000 lancamentos.
      // Regra (confirmada pelo socio comparando com CA):
      //   - DESPESA: usa valor_efetivo (pago>0?pago:bruto)
      //   - RECEITA: subtrai (devolucoes/PIX recebido reduzem o custo)
      // Validado Ord/Abr/26: Bebidas+Outros NET = 292.788,62 bate exato com CA.
      const lanc = await paginate<any>(
        () => (supabase as any)
          .schema('bronze' as any)
          .from('bronze_contaazul_lancamentos')
          .select('valor_bruto, valor_pago, categoria_nome, tipo')
          .eq('bar_id', barId)
          .in('tipo', ['DESPESA','RECEITA'])
          .is('excluido_em', null)
          .or('categoria_nome.ilike.%custo%,categoria_nome.ilike.%alimenta%')
          .gte('data_competencia', dataInicio)
          .lte('data_competencia', dataFim)
          .order('data_competencia'),
        { label: 'cmv-semanal/mensal:lanc' },
      );
      const valEfetivo = (r: any) => {
        const pago = parseFloat(r.valor_pago) || 0;
        return pago > 0 ? pago : (parseFloat(r.valor_bruto) || 0);
      };
      const somaPor = (filtro: RegExp) =>
        lanc.filter((r: any) => filtro.test(r.categoria_nome || ''))
          .reduce((s: number, r: any) => {
            const valor = valEfetivo(r);
            return s + (r.tipo === 'RECEITA' ? -valor : valor);
          }, 0);
      dadosMensais.compras_custo_comida = somaPor(/comida/i);
      // "Custo Outros" agrupado em Bebidas: CA n separa, esse balde so tem
      // material de limpeza/operacao residual e o socio quer ver junto.
      dadosMensais.compras_custo_bebidas = somaPor(/bebida/i) + somaPor(/outro/i);
      dadosMensais.compras_custo_drinks = somaPor(/drink/i);
      dadosMensais.compras_custo_outros = 0;

      if (ehMesCorrenteRecorte) {
        // Mes corrente: total e CMA tambem precisam ser recortados ate dataFim
        // (cmv_mensal guarda o mes inteiro, mas aqui queremos so ate o marco)
        dadosMensais.compras_periodo = lanc
          .filter((r: any) => /custo/i.test(r.categoria_nome || ''))
          .reduce((s: number, r: any) => {
            const valor = valEfetivo(r);
            return s + (r.tipo === 'RECEITA' ? -valor : valor);
          }, 0);
        dadosMensais.compras_alimentacao = somaPor(/alimenta/i);
        dadosMensais.cma_total = (dadosMensais.estoque_inicial_funcionarios || 0)
          + dadosMensais.compras_alimentacao
          - (dadosMensais.estoque_final_funcionarios || 0);
      }

      const resultado = {
        ...dadosMensais,
        consumacoes_9: consumacoes9Mensal,
        mes,
        ano,
        bar_id: barId,
        numero_semana: mes,
        data_inicio: dataInicio,
        data_fim: dataFim,
        recorte_marco: ehMesCorrenteRecorte ? dataFim : null,
        id: `${ano}-${mes}`,
      };

      return NextResponse.json({
        success: true,
        mes: resultado,
        periodo: { dataInicio, dataFim },
        semanasIncluidas: semanasComProporcao.map(s => `${s.anoISO}-S${s.semana} (${Math.round(s.proporcao * 100)}%)`),
        fonte: 'cmv_mensal',
        estoqueInfo: {
          inicial: {
            data: `${String(mes).padStart(2, '0')}/01/${ano}`,
            semana: `${anoInicial}-S${semanaInicial}`,
            valores: {
              total: dadosMensais.estoque_inicial,
              cozinha: 0,
              bebidas: 0,
              drinks: 0
            }
          },
          final: {
            data: `01/${String(mes + 1).padStart(2, '0')}/${mes === 12 ? ano + 1 : ano}`,
            semana: `${anoFinal}-S${semanaFinal}`,
            valores: {
              total: dadosMensais.estoque_final,
              cozinha: 0,
              bebidas: 0,
              drinks: 0
            }
          }
        },
        parametros: { mes, ano, barId }
      });
    }

    // FALLBACK: Se não tiver dados na cmv_mensal, usar a lógica antiga de agregação das semanas
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
      tbl(supabase, 'cmv_semanal')
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
      tbl(supabase, 'cmv_semanal')
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

    // Calcular semanas para estoque inicial e final
    const primeiroDiaMes = new Date(ano, mes - 1, 1);
    const { semana: semanaInicial, ano: anoInicial } = getWeekAndYear(primeiroDiaMes);
    
    const primeiroDiaMesSeguinte = new Date(ano, mes, 1);
    const { semana: semanaFinal, ano: anoFinal } = getWeekAndYear(primeiroDiaMesSeguinte);

    // Agregar dados CMV com proporção
    const dadosMensais = agregarCMVProportional(semanasComProporcao, cmvMap, estoqueFinalMesAnterior, ano, mes);

    // Teórico: o MANUAL (cmv_teorico_percentual_manual) tem prioridade — a coluna sem sufixo é
    // populada pelo ETL com o CMV Limpo, então não serve como fonte do input do sócio.
    // Sem manual, usa o AUTOMÁTICO (gold.cmv_teorico_dia), inclusive no passado.
    {
      const m = cmvMensal && !errMensal ? cmvMensal.cmv_teorico_percentual_manual : null;
      const cmvTeoricoManual = m !== null && m !== undefined ? parseFloat(String(m)) : null;
      if (cmvTeoricoManual !== null && Number.isFinite(cmvTeoricoManual) && cmvTeoricoManual > 0) {
        dadosMensais.cmv_teorico_percentual = cmvTeoricoManual;
      } else if (cmvTeoricoAuto != null) {
        dadosMensais.cmv_teorico_percentual = cmvTeoricoAuto;
      }
    }

    // Adicionar metadados
    const resultado = {
      ...dadosMensais,
      consumacoes_9: consumacoes9Mensal,
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
      estoqueInfo: {
        inicial: {
          data: `${String(mes).padStart(2, '0')}/01/${ano}`,
          semana: `${anoInicial}-S${semanaInicial}`,
          valores: {
            total: dadosMensais.estoque_inicial,
            cozinha: dadosMensais.estoque_inicial_cozinha,
            bebidas: dadosMensais.estoque_inicial_bebidas,
            drinks: dadosMensais.estoque_inicial_drinks
          }
        },
        final: {
          data: `01/${String(mes + 1).padStart(2, '0')}/${mes === 12 ? ano + 1 : ano}`,
          semana: `${anoFinal}-S${semanaFinal}`,
          valores: {
            total: dadosMensais.estoque_final,
            cozinha: dadosMensais.estoque_final_cozinha,
            bebidas: dadosMensais.estoque_final_bebidas,
            drinks: dadosMensais.estoque_final_drinks
          }
        }
      },
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
  estoqueFinalMesAnterior: CMVSemanal | null = null,
  ano: number,
  mes: number
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

  // CORRIGIDO: Para visão mensal igual à planilha Digão
  // Estoque Inicial do Mês = Estoque do dia 01 do mês (ex: 01/01, 01/02, 01/03)
  // Estoque Final do Mês = Estoque do dia 01 do mês seguinte (ex: 01/02, 01/03, 01/04)
  
  // Ordenar semanas uma vez (para reutilizar)
  const semanasOrdenadas = [...semanasComProporcao].sort((a, b) => {
    if (a.anoISO !== b.anoISO) return a.anoISO - b.anoISO;
    return a.semana - b.semana;
  });
  
  // Determinar a semana que contém o dia 01 do mês atual (para estoque inicial)
  const primeiroDiaMes = new Date(ano, mes - 1, 1);
  const { semana: semanaInicial, ano: anoInicial } = getWeekAndYear(primeiroDiaMes);
  
  // Determinar a semana que contém o dia 01 do mês seguinte (para estoque final)
  const primeiroDiaMesSeguinte = new Date(ano, mes, 1);
  const { semana: semanaFinal, ano: anoFinal } = getWeekAndYear(primeiroDiaMesSeguinte);

  // Estoque Inicial: da semana que contém o dia 01 do mês
  const primeiroEstoque = (campoInicial: keyof CMVSemanal, campoFinalAnterior: keyof CMVSemanal): number | null => {
    // Buscar estoque inicial da semana que contém o dia 01 do mês
    const dados = cmvMap.get(`${anoInicial}-${semanaInicial}`);
    if (dados && dados[campoInicial] !== null && dados[campoInicial] !== undefined) {
      const valor = parseFloat(String(dados[campoInicial])) || 0;
      if (valor > 0) {
        return valor;
      }
    }
    
    // Fallback: usar estoque final do mês anterior se o estoque inicial for 0
    if (estoqueFinalMesAnterior && estoqueFinalMesAnterior[campoFinalAnterior] !== null) {
      const valorFallback = parseFloat(String(estoqueFinalMesAnterior[campoFinalAnterior])) || 0;
      if (valorFallback > 0) {
        return valorFallback;
      }
    }
    
    // Retornar 0 se não encontrar nada
    return 0;
  };

  // Estoque Final: da semana que contém o dia 01 do mês seguinte
  // O estoque final do mês é o estoque inicial da primeira semana do mês seguinte
  const ultimoEstoque = (campoInicial: keyof CMVSemanal, campoFinal: keyof CMVSemanal): number | null => {
    // Buscar estoque inicial da semana que contém o dia 01 do mês seguinte
    const dados = cmvMap.get(`${anoFinal}-${semanaFinal}`);
    if (dados && dados[campoInicial] !== null && dados[campoInicial] !== undefined) {
      const valor = parseFloat(String(dados[campoInicial])) || 0;
      if (valor > 0) {
        return valor;
      }
    }
    
    // Fallback 1: tentar estoque_final da última semana do mês atual
    const ultimaSemana = semanasOrdenadas[semanasOrdenadas.length - 1];
    if (ultimaSemana) {
      const dadosUltimaSemana = cmvMap.get(`${ultimaSemana.anoISO}-${ultimaSemana.semana}`);
      if (dadosUltimaSemana && dadosUltimaSemana[campoFinal] !== null && dadosUltimaSemana[campoFinal] !== undefined) {
        const valorFinal = parseFloat(String(dadosUltimaSemana[campoFinal])) || 0;
        if (valorFinal > 0) {
          return valorFinal;
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
    
    // Retornar 0 se não encontrar nada
    return 0;
  };

  return {
    // Vendas (soma proporcional)
    vendas_brutas: somaProportional('vendas_brutas'),
    vendas_liquidas: somaProportional('vendas_liquidas'),
    faturamento_cmvivel: somaProportional('faturamento_cmvivel'),
    
    // Estoque Inicial (dia 01 do mês, com fallback para estoque final do mês anterior)
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
    
    // Estoque Final (dia 01 do mês seguinte = estoque_inicial da semana do mês seguinte)
    estoque_final: ultimoEstoque('estoque_inicial', 'estoque_final'),
    estoque_final_cozinha: ultimoEstoque('estoque_inicial_cozinha', 'estoque_final_cozinha'),
    estoque_final_bebidas: ultimoEstoque('estoque_inicial_bebidas', 'estoque_final_bebidas'),
    estoque_final_drinks: ultimoEstoque('estoque_inicial_drinks', 'estoque_final_drinks'),
    
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
    
    // CMA - Custo de Alimentação de Funcionários
    estoque_inicial_funcionarios: primeiroEstoque('estoque_inicial_funcionarios', 'estoque_final_funcionarios'),
    compras_alimentacao: somaProportional('compras_alimentacao'),
    estoque_final_funcionarios: ultimoEstoque('estoque_inicial_funcionarios', 'estoque_final_funcionarios'),
    cma_total: somaProportional('cma_total'),
    
    // Percentuais (média ponderada)
    cmv_limpo_percentual: mediaProportional('cmv_limpo_percentual'),
    cmv_teorico_percentual: mediaProportional('cmv_teorico_percentual'),
    gap: mediaProportional('gap'),
  };
}

/**
 * PUT - Salva campos manuais (cmv_teorico_percentual, etc) em
 * financial.cmv_mensal via upsert (bar_id, ano, mes).
 *
 * Body: { bar_id, ano, mes, [campo]: valor }
 *
 * Bug anterior: o salvarMetrica do front chamava /api/cmv-semanal com
 * id fictício "${ano}-${mes}" — update silenciosamente não bate em row
 * nenhuma da cmv_semanal. Sócio relatou "não tá salvando".
 */
export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  try {
    const supabase = await getAdminClient();
    const body = await request.json();
    const { bar_id, ano, mes, ...campos } = body;

    if (!bar_id || !ano || !mes) {
      return NextResponse.json(
        { error: 'bar_id, ano e mes são obrigatórios' },
        { status: 400 }
      );
    }

    const camposPermitidos = [
      'cmv_teorico_percentual', 'cmv_teorico_percentual_manual',
      'consumo_socios', 'consumo_beneficios', 'consumo_artista',
      'consumo_rh_operacao', 'consumo_rh_escritorio',
      'outros_ajustes', 'ajuste_bonificacoes',
      'bonificacao_contrato_anual', 'bonificacao_cashback_mensal', 'bonificacoes',
      'estoque_inicial', 'estoque_final', 'compras',
      'estoque_inicial_funcionarios', 'estoque_final_funcionarios', 'compras_alimentacao',
    ];

    const upsertData: any = {
      bar_id,
      ano,
      mes,
      data_inicio: `${ano}-${String(mes).padStart(2, '0')}-01`,
      data_fim: `${ano}-${String(mes).padStart(2, '0')}-${String(new Date(ano, mes, 0).getDate()).padStart(2, '0')}`,
      fonte: 'manual',
      updated_at: new Date().toISOString(),
    };

    for (const campo of camposPermitidos) {
      if (campos[campo] !== undefined) {
        upsertData[campo] = campos[campo];
      }
    }

    const { data, error } = await tbl(supabase, 'cmv_mensal')
      .upsert(upsertData, { onConflict: 'bar_id,ano,mes' })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar CMV mensal:', error);
      return NextResponse.json(
        { error: 'Erro ao salvar CMV mensal', details: error.message },
        { status: 500 }
      );
    }

    // Recalcular cmv_real/percentuais com o valor manual recém-salvo.
    // O agregador preserva estoque/bonificações manuais (fonte='manual') e recomputa
    // compras (bronze/competência) + consumos. Sem isso, a edição manual não refletiria
    // no CMV R$ até o próximo "Atualizar".
    try {
      await (supabase as any).rpc('agregar_cmv_mensal_auto', {
        p_bar_id: bar_id, p_ano: ano, p_mes: mes,
      });
    } catch (aggErr) {
      console.warn('agregar_cmv_mensal_auto após PUT mensal falhou:', aggErr);
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'CMV mensal atualizado com sucesso'
    });
  } catch (error) {
    console.error('Erro interno PUT cmv-semanal/mensal:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
