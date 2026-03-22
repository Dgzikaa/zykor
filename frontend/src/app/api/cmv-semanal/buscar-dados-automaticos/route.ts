import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { filtrarDiasAbertos } from '@/lib/helpers/calendario-helper';
import { getFatorCmv } from '@/lib/config/getFatorCmv';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * API para buscar dados automáticos para CMV Semanal
 * 
 * Busca:
 * 1. Consumo dos sócios (x-corbal, etc)
 * 2. Compras do NIBO por categoria
 * 3. Faturamento CMVível do ContaHub (vr_repique)
 * 4. Estoques por tipo_local (cozinha, salão, drinks)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bar_id, data_inicio, data_fim, criterio_data } = body;
    // criterio_data: 'competencia' (default) ou 'criacao' - alinha com planilha
    const usarDataCriacao = criterio_data === 'criacao';

    if (!bar_id || !data_inicio || !data_fim) {
      return NextResponse.json(
        { error: 'Dados inválidos: bar_id, data_inicio e data_fim são obrigatórios' },
        { status: 400 }
      );
    }

    const resultado = {
      // 4 Categorias de consumos: Sócios, Funcionários, Clientes, Artistas
      total_consumo_socios: 0,      // Sócios
      mesa_adm_casa: 0,             // Funcionários (inclui RH)
      mesa_beneficios_cliente: 0,   // Clientes (inclui chegadeira)
      mesa_banda_dj: 0,             // Artistas

      // Compras do NIBO
      compras_custo_comida: 0,
      compras_custo_bebidas: 0,
      compras_custo_outros: 0,
      compras_custo_drinks: 0,

      // Faturamento
      faturamento_cmvivel: 0,
      vendas_brutas: 0,
      vendas_liquidas: 0,

      // Estoques CONSOLIDADOS (para CMV)
      estoque_inicial: 0,
      estoque_final: 0,
      
      // Estoques detalhados por categoria
      estoque_inicial_cozinha: 0,
      estoque_inicial_bebidas: 0,
      estoque_inicial_drinks: 0,
      estoque_final_cozinha: 0,
      estoque_final_bebidas: 0,
      estoque_final_drinks: 0,

      // CMA - Custo de Alimentação de Funcionários
      estoque_inicial_funcionarios: 0,
      compras_alimentacao: 0,
      estoque_final_funcionarios: 0,
      cma_total: 0,
    };

    // 1-2. BUSCAR TODAS AS CONSUMAÇÕES E CLASSIFICAR COM PRIORIDADE
    // 🔧 IMPORTANTE: Cada registro só pode entrar em UMA categoria (evita duplicidade)
    // ORDEM DE PRIORIDADE: Sócios > Artistas > Funcionários > Clientes
    try {
      // Padrões por categoria (ordem de prioridade)
      const PADROES_SOCIOS = ['sócio', 'socio', 'x-socio', 'x-sócio', 'gonza', 'corbal', 'diogo', 'cadu', 'augusto', 'rodrigo', 'digao', 'vinicius', 'vini', 'bueno', 'kaizen', 'caisen', 'joão pedro', 'joao pedro', 'jp', '3v', 'cantucci'];
      const PADROES_ARTISTAS = ['musico', 'músicos', 'dj', 'banda', 'artista', 'breno', 'benza', 'stz', 'zelia', 'tia', 'samba', 'sambadona', 'doze', 'boca', 'boka', 'pé', 'chão', 'segunda', 'resenha', 'pagode', 'roda', 'reconvexa', 'rodie', 'roudier', 'roudi', 'som', 'técnico', 'tecnico', 'pv', 'paulo victor', 'prod'];
      const PADROES_FUNCIONARIOS = ['funcionários', 'funcionario', 'financeiro', 'fin', 'mkt', 'marketing', 'slu', 'adm', 'administrativo', 'prêmio', 'confra', 'rh', 'recursos humanos'];
      const PADROES_CLIENTES = ['aniver', 'anivers', 'aniversário', 'aniversario', 'aniversariante', 'niver', 'voucher', 'benefício', 'beneficio', 'mesa mágica', 'mágica', 'influencer', 'influ', 'influencia', 'influência', 'club', 'clube', 'midia', 'mídia', 'social', 'insta', 'digital', 'cliente', 'ambev', 'chegadeira', 'chegador'];

      // Função para verificar se motivo contém algum padrão
      const matchPattern = (motivo: string, patterns: string[]): boolean => {
        const m = motivo.toLowerCase();
        return patterns.some(p => m.includes(p.toLowerCase()));
      };

      // Classificar registro com prioridade (só entra em 1 categoria)
      const classificarRegistro = (motivo: string): 'socios' | 'artistas' | 'funcionarios' | 'clientes' | null => {
        if (!motivo) return null;
        if (matchPattern(motivo, PADROES_SOCIOS)) return 'socios';
        if (matchPattern(motivo, PADROES_ARTISTAS)) return 'artistas';
        if (matchPattern(motivo, PADROES_FUNCIONARIOS)) return 'funcionarios';
        if (matchPattern(motivo, PADROES_CLIENTES)) return 'clientes';
        return null;
      };

      // Buscar TODOS os registros com motivo preenchido
      const { data: todosBrutos, error: errorTodos } = await supabase
        .from('visitas')
        .select('valor_desconto, valor_produtos, data_visita, motivo_desconto')
        .eq('bar_id', bar_id)
        .gte('data_visita', data_inicio)
        .lte('data_visita', data_fim)
        .not('motivo_desconto', 'is', null);

      if (!errorTodos && todosBrutos) {
        // ⚡ FILTRAR DIAS FECHADOS
        const todosRegistros = await filtrarDiasAbertos(todosBrutos, 'data_visita', bar_id);
        
        // Classificar e somar cada registro (cada um só entra em 1 categoria)
        const totais = { socios: 0, artistas: 0, funcionarios: 0, clientes: 0 };

        for (const item of todosRegistros as any[]) {
          const categoria = classificarRegistro(item.motivo_desconto || '');
          if (categoria) {
            const valor = (parseFloat(item.valor_desconto) || 0) + (parseFloat(item.valor_produtos) || 0);
            totais[categoria] += valor;
          }
        }

        resultado.total_consumo_socios = totais.socios;
        resultado.mesa_banda_dj = totais.artistas;
        resultado.mesa_adm_casa = totais.funcionarios;
        resultado.mesa_beneficios_cliente = totais.clientes;
      }
    } catch (err) {
      console.error('Erro ao buscar consumações:', err);
    }

    // 3. BUSCAR FATURAMENTO CMVível (mesmo cálculo do Desempenho - exclui Conta Assinada)
    // 🔧 CORRIGIDO: Usar faturamento_pagamentos excluindo Conta Assinada (consumo sócios)
    // Fórmula: faturamento_cmvivel = SUM(valor_liquido) WHERE meio != 'Conta Assinada'
    try {
      // 3.1 Buscar faturamento (excluindo Conta Assinada - igual ao Desempenho)
      const { data: pagamentosBrutos, error: errorPagamentos } = await supabase
        .from('faturamento_pagamentos')
        .select('valor_liquido, valor_bruto, data_pagamento, meio')
        .eq('bar_id', bar_id)
        .gte('data_pagamento', data_inicio)
        .lte('data_pagamento', data_fim)
        .neq('meio', 'Conta Assinada');

      if (!errorPagamentos && pagamentosBrutos) {
        // ⚡ FILTRAR DIAS FECHADOS
        const pagamentos = await filtrarDiasAbertos(pagamentosBrutos, 'data_pagamento', bar_id);
        
        // Faturamento Bruto = SUM(valor_bruto) - igual à tabela Desempenho (sem Conta Assinada)
        resultado.vendas_brutas = pagamentos.reduce((sum, item: any) => 
          sum + (parseFloat(item.valor_bruto) || 0), 0
        );

        // Faturamento Líquido = SUM(valor_liquido) - igual à tabela Desempenho
        resultado.vendas_liquidas = pagamentos.reduce((sum, item: any) => 
          sum + (parseFloat(item.valor_liquido) || 0), 0
        );
      }

      // 3.2 Buscar dados adicionais de visitas para couvert e repique
      const { data: periodoData, error: errorPeriodo } = await supabase
        .from('visitas')
        .select('valor_repique, valor_couvert, data_visita')
        .eq('bar_id', bar_id)
        .gte('data_visita', data_inicio)
        .lte('data_visita', data_fim);

      if (!errorPeriodo && periodoData) {
        const periodo = await filtrarDiasAbertos(periodoData, 'data_visita', bar_id);

        // Total de comissão (valor_repique)
        const totalComissao = periodo.reduce((sum, item: any) => 
          sum + (parseFloat(item.valor_repique) || 0), 0
        );

        // 🔧 FATURAMENTO CMVível = Vendas Líquidas - Comissão (vr_repique)
        resultado.faturamento_cmvivel = resultado.vendas_liquidas - totalComissao;
      }
    } catch (err) {
      console.error('Erro ao buscar faturamento:', err);
    }

    // 4. BUSCAR COMPRAS DO NIBO (exatamente como na planilha - alinhado com Edge Function)
    // criterio_data: 'competencia' = data_competencia (padrão) | 'criacao' = criado_em
    try {
      const dataInicioFull = data_inicio + (usarDataCriacao ? 'T00:00:00' : '');
      const dataFimFull = data_fim + (usarDataCriacao ? 'T23:59:59' : '');
      const queryBuilder = supabase
        .from('nibo_agendamentos')
        .select('categoria_nome, valor')
        .eq('bar_id', bar_id)
        .eq('tipo', 'Debit');
      const { data: comprasNibo, error: errorCompras } = usarDataCriacao
        ? await queryBuilder.gte('criado_em', dataInicioFull).lte('criado_em', dataFimFull)
        : await queryBuilder.gte('data_competencia', data_inicio).lte('data_competencia', data_fim);

      if (!errorCompras && comprasNibo) {
        // 🔧 CORRIGIDO: Usar comparação case-insensitive para categorias
        
        // BEBIDAS + TABACARIA = "Custo Bebidas" + "Custo Outros" (case-insensitive)
        resultado.compras_custo_bebidas = comprasNibo
          .filter(item => {
            const cat = (item.categoria_nome || '').toLowerCase();
            return cat === 'custo bebidas' || cat === 'custo outros';
          })
          .reduce((sum, item) => sum + Math.abs(parseFloat(item.valor) || 0), 0);

        // COZINHA = "CUSTO COMIDA" ou "Custo Comida" (case-insensitive)
        resultado.compras_custo_comida = comprasNibo
          .filter(item => {
            const cat = (item.categoria_nome || '').toLowerCase();
            return cat === 'custo comida';
          })
          .reduce((sum, item) => sum + Math.abs(parseFloat(item.valor) || 0), 0);

        // DRINKS = "Custo Drinks" (case-insensitive)
        resultado.compras_custo_drinks = comprasNibo
          .filter(item => {
            const cat = (item.categoria_nome || '').toLowerCase();
            return cat === 'custo drinks';
          })
          .reduce((sum, item) => sum + Math.abs(parseFloat(item.valor) || 0), 0);

        // OUTROS = Zero (Materiais de Limpeza e Operação NÃO entram no CMV)
        resultado.compras_custo_outros = 0;
      }
    } catch (err) {
      console.error('Erro ao buscar compras do NIBO:', err);
    }

    // 5. BUSCAR ESTOQUES FINAL
    // 🔧 CORRIGIDO: A planilha usa a contagem da SEGUNDA-FEIRA de cada semana
    // Estoque Inicial = Contagem da segunda-feira (data_inicio)
    // Estoque Final = Contagem da segunda-feira seguinte (data_inicio da próxima semana)
    try {
      // Calcular a segunda-feira seguinte ao fim do período
      // Se data_fim é domingo (23/11), a próxima segunda é 24/11
      const dataFimDate = new Date(data_fim + 'T12:00:00Z');
      const diaSemana = dataFimDate.getUTCDay(); // 0 = domingo, 1 = segunda, etc.
      
      // Calcular próxima segunda-feira
      let diasParaSegunda = 1; // Por padrão, dia seguinte
      if (diaSemana === 0) { // Se é domingo
        diasParaSegunda = 1; // Segunda é amanhã
      } else if (diaSemana === 6) { // Se é sábado
        diasParaSegunda = 2; // Segunda é depois de amanhã
      } else {
        diasParaSegunda = (8 - diaSemana) % 7; // Próxima segunda
        if (diasParaSegunda === 0) diasParaSegunda = 7;
      }
      
      dataFimDate.setUTCDate(dataFimDate.getUTCDate() + diasParaSegunda);
      const dataSegundaFinal = dataFimDate.toISOString().split('T')[0];

      let dataContagemFinal: string | null = null;
      
      // Primeiro, tentar buscar contagem exata da segunda-feira
      const { data: contagemExata, error: errorExata } = await supabase
        .from('contagem_estoque_insumos')
        .select('data_contagem, estoque_final')
        .eq('bar_id', bar_id)
        .eq('data_contagem', dataSegundaFinal)
        .gt('estoque_final', 0)
        .limit(1);
      
      if (!errorExata && contagemExata && contagemExata.length > 0) {
        dataContagemFinal = dataSegundaFinal;
      } else {
        // Fallback: buscar contagem mais próxima (até 3 dias depois)
        const { data: contagensProximas, error: errorProximas } = await supabase
          .from('contagem_estoque_insumos')
          .select('data_contagem, estoque_final')
          .eq('bar_id', bar_id)
          .gte('data_contagem', dataSegundaFinal)
          .gt('estoque_final', 0)
          .order('data_contagem', { ascending: true })
          .limit(1);
        
        if (!errorProximas && contagensProximas && contagensProximas.length > 0) {
          dataContagemFinal = contagensProximas[0].data_contagem;
        }
      }
      
      // Criar objeto compatível com código existente
      const ultimaContagemObj = dataContagemFinal ? { data_contagem: dataContagemFinal } : null;

      if (ultimaContagemObj) {
        const dataContagem = ultimaContagemObj.data_contagem;

        // Buscar todos os insumos com suas categorias
        const { data: insumos, error: errorInsumos } = await supabase
          .from('insumos')
          .select('id, tipo_local, categoria')
          .eq('bar_id', bar_id);

        if (!errorInsumos && insumos) {
          // 🔧 CORRIGIDO: Buscar contagens COM custo_unitario (preço CONGELADO da contagem)
          // Inclui insumo_codigo para identificar PRODUÇÃO (B) = pd*
          const { data: contagens, error: errorContagens } = await supabase
            .from('contagem_estoque_insumos')
            .select('insumo_id, insumo_codigo, estoque_final, custo_unitario')
            .eq('bar_id', bar_id)
            .eq('data_contagem', dataContagem);

          if (!errorContagens && contagens) {
            // Criar map de insumos para facilitar lookup (só categorias)
            const insumosMap = new Map(insumos.map(i => [i.id, i]));

            // 🔧 CORRIGIDO: Categorias baseadas nos dados REAIS do banco (01/12/2025)
            
            // Categorias de COZINHA (comida) - tipo_local = 'cozinha'
            // Incluem: PROTEÍNA, MERCADO (C), ARMAZÉM (C), PEIXE, HORTIFRUTI (C), PÃES, etc.
            const categoriasCozinha = [
              'cozinha',           // 280 insumos genéricos
              'ARMAZÉM (C)', 
              'HORTIFRUTI (C)', 
              'MERCADO (C)', 
              'Mercado (S)',
              'PÃES', 
              'PEIXE', 
              'PROTEÍNA', 
              'tempero', 
              'hortifruti', 
              'líquido'
            ];
            
            // Categorias de DRINKS - tipo_local = 'cozinha' mas são para drinks
            // DESTILADOS é a maior categoria (~R$42k)
            const categoriasDrinks = [
              'ARMAZÉM B', 
              'DESTILADOS',        // Principal! R$42k
              'DESTILADOS LOG', 
              'HORTIFRUTI B', 
              'IMPÉRIO', 
              'MERCADO B', 
              'POLPAS',
              'OUTROS'
            ];
            
            // Categorias de BEBIDAS (bar) - tipo_local = 'bar'
            // Retornáveis, Vinhos, Long Neck, etc.
            const categoriasBebidas = [
              'Retornáveis',
              'retornáveis',
              'Vinhos',
              'Long Neck',
              'Não-alcóolicos',    // No bar
              'Lata',
              'Artesanal',
              'polpa',
              'fruta'
            ];
            
            // Excluir funcionários (não entra no CMV)
            const categoriasExcluir = ['HORTIFRUTI (F)', 'MERCADO (F)', 'PROTEÍNA (F)'];

            contagens.forEach((contagem: any) => {
              const insumo = insumosMap.get(contagem.insumo_id);
              if (!insumo || categoriasExcluir.includes(insumo.categoria)) return;

              // 🔧 USAR custo_unitario DA CONTAGEM (preço congelado no momento)
              const valor = contagem.estoque_final * (contagem.custo_unitario || 0);
              
              // 🔧 PRODUÇÃO: códigos pd* são DRINKS (PRODUÇÃO B), pc* são COZINHA (PRODUÇÃO C)
              const codigo = contagem.insumo_codigo || '';
              const isProdDrinks = codigo.startsWith('pd');  // PRODUÇÃO (B) = Drinks
              const isProdCozinha = codigo.startsWith('pc'); // PRODUÇÃO (C) = Cozinha

              // BEBIDAS - tipo_local = 'bar'
              if (insumo.tipo_local === 'bar') {
                resultado.estoque_final_bebidas += valor;
              }
              // PRODUÇÃO (B) = Drinks (códigos pd*)
              else if (isProdDrinks) {
                resultado.estoque_final_drinks += valor;
              }
              // PRODUÇÃO (C) = Cozinha (códigos pc*)
              else if (isProdCozinha) {
                resultado.estoque_final_cozinha += valor;
              }
              // DRINKS - tipo_local = 'cozinha' mas categorias de drinks
              else if (insumo.tipo_local === 'cozinha' && categoriasDrinks.includes(insumo.categoria)) {
                resultado.estoque_final_drinks += valor;
              }
              // COZINHA (comida) - tipo_local = 'cozinha' e categorias de comida
              else if (insumo.tipo_local === 'cozinha' && categoriasCozinha.includes(insumo.categoria)) {
                resultado.estoque_final_cozinha += valor;
              }
              // Não-alcóolicos do tipo cozinha vai para drinks
              else if (insumo.tipo_local === 'cozinha' && insumo.categoria === 'Não-alcóolicos') {
                resultado.estoque_final_drinks += valor;
              }
            });
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar estoques:', err);
    }

    // 6. BUSCAR ESTOQUE INICIAL (contagem da segunda-feira = data_inicio)
    // 🔧 CORRIGIDO: Estoque inicial é a contagem do PRÓPRIO dia de início (segunda-feira)
    try {
      // Usar diretamente a data_inicio (que deve ser a segunda-feira)
      const dataContagem = data_inicio;

      // Buscar insumos
      const { data: insumos } = await supabase
        .from('insumos')
        .select('id, tipo_local, categoria')
        .eq('bar_id', bar_id);

      if (insumos) {
        const insumosMap = new Map(insumos.map((i: any) => [i.id, i]));

        // 🔧 CORRIGIDO: Buscar contagens COM custo_unitario e insumo_codigo
        const { data: contagensIniciais } = await supabase
          .from('contagem_estoque_insumos')
          .select('insumo_id, insumo_codigo, estoque_final, custo_unitario')
          .eq('bar_id', bar_id)
          .eq('data_contagem', dataContagem);

        if (contagensIniciais && contagensIniciais.length > 0) {
          const categoriasCozinha = ['cozinha', 'ARMAZÉM (C)', 'HORTIFRUTI (C)', 'MERCADO (C)', 'Mercado (S)', 'PÃES', 'PEIXE', 'PROTEÍNA', 'tempero', 'hortifruti', 'líquido'];
          const categoriasDrinks = ['ARMAZÉM B', 'DESTILADOS', 'DESTILADOS LOG', 'HORTIFRUTI B', 'IMPÉRIO', 'MERCADO B', 'POLPAS', 'OUTROS'];
          const categoriasExcluir = ['HORTIFRUTI (F)', 'MERCADO (F)', 'PROTEÍNA (F)'];

          contagensIniciais.forEach((contagem: any) => {
            const insumo = insumosMap.get(contagem.insumo_id);
            if (!insumo || categoriasExcluir.includes(insumo.categoria)) return;

            // 🔧 USAR custo_unitario DA CONTAGEM (preço congelado no momento)
            const valor = contagem.estoque_final * (contagem.custo_unitario || 0);
            
            // 🔧 PRODUÇÃO: códigos pd* são DRINKS, pc* são COZINHA
            const codigo = contagem.insumo_codigo || '';
            const isProdDrinks = codigo.startsWith('pd');
            const isProdCozinha = codigo.startsWith('pc');

            if (insumo.tipo_local === 'bar') {
              resultado.estoque_inicial_bebidas += valor;
            } else if (isProdDrinks) {
              resultado.estoque_inicial_drinks += valor;
            } else if (isProdCozinha) {
              resultado.estoque_inicial_cozinha += valor;
            } else if (insumo.tipo_local === 'cozinha' && categoriasDrinks.includes(insumo.categoria)) {
              resultado.estoque_inicial_drinks += valor;
            } else if (insumo.tipo_local === 'cozinha' && categoriasCozinha.includes(insumo.categoria)) {
              resultado.estoque_inicial_cozinha += valor;
            } else if (insumo.tipo_local === 'cozinha' && insumo.categoria === 'Não-alcóolicos') {
              resultado.estoque_inicial_drinks += valor;
            }
          });
        }
      }
    } catch (err) {
      console.error('Erro ao buscar estoque inicial:', err);
    }

    // 7. BUSCAR DADOS CMA (Custo de Alimentação de Funcionários)
    try {
      const categoriasFuncionarios = ['HORTIFRUTI (F)', 'MERCADO (F)', 'PROTEÍNA (F)'];

      // 7.1. Estoque Inicial de Funcionários
      const dataContagemInicial = data_inicio;
      const { data: insumosFunc } = await supabase
        .from('insumos')
        .select('id, categoria')
        .eq('bar_id', bar_id)
        .in('categoria', categoriasFuncionarios);

      if (insumosFunc && insumosFunc.length > 0) {
        const insumosFuncMap = new Map(insumosFunc.map((i: any) => [i.id, i]));

        const { data: contagensIniciaisFunc } = await supabase
          .from('contagem_estoque_insumos')
          .select('insumo_id, estoque_final, custo_unitario')
          .eq('bar_id', bar_id)
          .eq('data_contagem', dataContagemInicial);

        if (contagensIniciaisFunc && contagensIniciaisFunc.length > 0) {
          contagensIniciaisFunc.forEach((contagem: any) => {
            const insumo = insumosFuncMap.get(contagem.insumo_id);
            if (!insumo) return;
            const valor = contagem.estoque_final * (contagem.custo_unitario || 0);
            resultado.estoque_inicial_funcionarios += valor;
          });
        }

        // 7.2. Estoque Final de Funcionários
        const dataFimDate = new Date(data_fim + 'T12:00:00Z');
        const diaSemana = dataFimDate.getUTCDay();
        let diasParaSegunda = diaSemana === 0 ? 1 : diaSemana === 6 ? 2 : (8 - diaSemana) % 7 || 7;
        dataFimDate.setUTCDate(dataFimDate.getUTCDate() + diasParaSegunda);
        const dataSegundaFinal = dataFimDate.toISOString().split('T')[0];

        const { data: contagemFinalFunc } = await supabase
          .from('contagem_estoque_insumos')
          .select('data_contagem, estoque_final')
          .eq('bar_id', bar_id)
          .eq('data_contagem', dataSegundaFinal)
          .gt('estoque_final', 0)
          .limit(1);

        const dataContagemFinal = contagemFinalFunc && contagemFinalFunc.length > 0 
          ? dataSegundaFinal 
          : null;

        if (dataContagemFinal) {
          const { data: contagensFinaisFunc } = await supabase
            .from('contagem_estoque_insumos')
            .select('insumo_id, estoque_final, custo_unitario')
            .eq('bar_id', bar_id)
            .eq('data_contagem', dataContagemFinal);

          if (contagensFinaisFunc && contagensFinaisFunc.length > 0) {
            contagensFinaisFunc.forEach((contagem: any) => {
              const insumo = insumosFuncMap.get(contagem.insumo_id);
              if (!insumo) return;
              const valor = contagem.estoque_final * (contagem.custo_unitario || 0);
              resultado.estoque_final_funcionarios += valor;
            });
          }
        }
      }

      // 7.3. Compras de Alimentação (categoria "Alimentação" do NIBO)
      const dataInicioFull = data_inicio + (usarDataCriacao ? 'T00:00:00' : '');
      const dataFimFull = data_fim + (usarDataCriacao ? 'T23:59:59' : '');
      
      const queryBuilder = supabase
        .from('nibo_agendamentos')
        .select('categoria_nome, valor')
        .eq('bar_id', bar_id)
        .eq('tipo', 'Debit');

      const { data: comprasAlimentacao } = usarDataCriacao
        ? await queryBuilder.gte('criado_em', dataInicioFull).lte('criado_em', dataFimFull)
        : await queryBuilder.gte('data_competencia', data_inicio).lte('data_competencia', data_fim);

      if (comprasAlimentacao) {
        resultado.compras_alimentacao = comprasAlimentacao
          .filter(item => {
            const cat = (item.categoria_nome || '').toLowerCase();
            return cat === 'alimentação' || cat === 'alimentacao';
          })
          .reduce((sum, item) => sum + Math.abs(parseFloat(item.valor) || 0), 0);
      }

      // 7.4. Calcular CMA Total
      resultado.cma_total = resultado.estoque_inicial_funcionarios + 
                            resultado.compras_alimentacao - 
                            resultado.estoque_final_funcionarios;

    } catch (err) {
      console.error('Erro ao buscar dados CMA:', err);
    }

    // 8. CONSOLIDAR TOTAIS
    // Estoque
    resultado.estoque_inicial = resultado.estoque_inicial_cozinha + resultado.estoque_inicial_bebidas + resultado.estoque_inicial_drinks;
    resultado.estoque_final = resultado.estoque_final_cozinha + resultado.estoque_final_bebidas + resultado.estoque_final_drinks;

    // Compras total
    const compras_periodo = resultado.compras_custo_comida + resultado.compras_custo_bebidas + resultado.compras_custo_drinks;

    // 9. CALCULAR CONSUMOS COM FATOR DO BANCO (Onda 2A)
    // 🔧 4 CATEGORIAS de consumação (todas × fator):
    // - Sócios: total_consumo_socios × fator
    // - Funcionários: mesa_adm_casa × fator (inclui RH)
    // - Clientes: mesa_beneficios_cliente × fator (inclui chegadeira)
    // - Artistas: mesa_banda_dj × fator
    const fatorCmv = await getFatorCmv(supabase, bar_id);
    const consumo_socios_calculado = resultado.total_consumo_socios * fatorCmv;
    const consumo_adm_calculado = resultado.mesa_adm_casa * fatorCmv;
    const consumo_artista_calculado = resultado.mesa_banda_dj * fatorCmv;
    const consumo_beneficios_calculado = resultado.mesa_beneficios_cliente * fatorCmv;

    // Retornar com campos mapeados para o frontend
    // 4 categorias: Sócios, Funcionários, Clientes, Artistas
    const dadosParaFrontend = {
      ...resultado,
      compras_periodo,
      // Valores calculados com multiplicador 0.35
      consumo_socios: consumo_socios_calculado,
      consumo_beneficios: consumo_beneficios_calculado,
      consumo_adm: consumo_adm_calculado,
      consumo_artista: consumo_artista_calculado,
    };

    return NextResponse.json({
      success: true,
      data: dadosParaFrontend,
      message: 'Dados automáticos carregados com sucesso'
    });

  } catch (error) {
    console.error('Erro interno:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: (error as Error).message },
      { status: 500 }
    );
  }
}

