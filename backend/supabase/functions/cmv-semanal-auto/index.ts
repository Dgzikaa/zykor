/**
 * 📊 CMV Semanal Automático
 * 
 * Processa automaticamente o CMV semanal integrando dados de:
 * - desempenho_semanal (faturamento_total como faturamento bruto)
 * - NIBO (Compras por categoria)
 * 
 * Cria automaticamente semanas que existem no desempenho_semanal mas não no cmv_semanal.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { heartbeatStart, heartbeatEnd, heartbeatError } from '../_shared/heartbeat.ts';
import { requireAuth } from '../_shared/auth-guard.ts';
import { getCorsHeaders } from '../_shared/cors.ts';



interface CMVRequest {
  bar_id?: number;
  ano?: number;
  semana?: number;
  todas_semanas?: boolean;
}

function getWeekDateRange(year: number, week: number): { start: string; end: string } {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { start: fmt(start), end: fmt(end) };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders }

  // Validar autenticação (JWT ou CRON_SECRET)
  const authError = requireAuth(req);
  if (authError) return authError;);
  }

  // 💓 Heartbeat: variáveis no escopo externo para acesso no catch
  let heartbeatId: number | null = null;
  let startTime: number = Date.now();

  try {
    const body: CMVRequest = await req.json().catch(() => ({}));
    const { bar_id, ano, semana, todas_semanas = false } = body;

    console.log('📊 CMV Semanal Automático - Iniciando processamento', {
      bar_id,
      ano,
      semana,
      todas_semanas
    });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 💓 Heartbeat: registrar início da execução com advisory lock
    const hbResult = await heartbeatStart(
      supabase, 
      'cmv-semanal-auto', 
      bar_id || null, 
      todas_semanas ? 'todas' : 'recalculo', 
      'pgcron',
      true, // useLock
      30    // timeout 30 minutos
    );
    heartbeatId = hbResult.heartbeatId;
    startTime = hbResult.startTime;
    
    // Se não conseguiu o lock, abortar execução
    if (!hbResult.lockAcquired) {
      console.log('🔒 CMV Semanal já em execução, abortando');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'CMV Semanal já em execução',
          lock_acquired: false 
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Buscar bares ativos do banco (com fallback)
    let baresAtivos: number[] = [3, 4]; // Fallback
    if (!bar_id) {
      const { data: baresData } = await supabase
        .from('bares')
        .select('id')
        .eq('ativo', true)
        .order('id');
      
      if (baresData && baresData.length > 0) {
        baresAtivos = baresData.map((b: { id: number }) => b.id);
        console.log(`📋 [BARES] Usando bares do banco: ${baresAtivos.join(', ')}`);
      } else {
        console.log(`⚠️ [BARES] Usando fallback: ${baresAtivos.join(', ')}`);
      }
    }

    const bares = bar_id ? [bar_id] : baresAtivos;
    const anoAtual = ano || new Date().getFullYear();
    
    let semanasProcessadas = 0;
    let semanasCriadas = 0;
    const resultados: any[] = [];
    
    const fatorConsumoCache = new Map<number, number>();
    
    async function getFatorConsumo(barId: number): Promise<number> {
      if (fatorConsumoCache.has(barId)) {
        return fatorConsumoCache.get(barId)!;
      }
      
      const { data, error } = await supabase
        .from('bar_regras_negocio')
        .select('cmv_fator_consumo')
        .eq('bar_id', barId)
        .single();
      
      if (error || !data?.cmv_fator_consumo) {
        throw new Error(`Config ausente: bar_regras_negocio.cmv_fator_consumo para bar_id=${barId}`);
      }
      
      const fator = parseFloat(String(data.cmv_fator_consumo));
      fatorConsumoCache.set(barId, fator);
      return fator;
    }

    for (const barId of bares) {
      const barStartTime = Date.now();
      console.log(`\n🍺 Processando bar_id: ${barId}`);

      // 1. Buscar todas as semanas do desempenho_semanal
      console.log(`⏱️ [${Date.now() - barStartTime}ms] Iniciando busca de semanas...`);
      // Inclui faturamento_entrada e comissao para calcular faturamento líquido
      let queryDesempenho = supabase
        .from('desempenho_semanal')
        .select('numero_semana, ano, data_inicio, data_fim, faturamento_total, faturamento_entrada, comissao')
        .eq('bar_id', barId)
        .eq('ano', anoAtual)
        .order('numero_semana', { ascending: true });

      if (semana && !todas_semanas) {
        queryDesempenho = queryDesempenho.eq('numero_semana', semana);
      }

      const { data: semanasDesempenho, error: errDesempenho } = await queryDesempenho;
      console.log(`⏱️ [${Date.now() - barStartTime}ms] Semanas desempenho buscadas`);

      if (errDesempenho) {
        console.error('Erro ao buscar desempenho_semanal:', errDesempenho);
        continue;
      }

      console.log(`📅 Encontradas ${semanasDesempenho?.length || 0} semanas no desempenho_semanal`);

      // 2. Buscar semanas existentes no cmv_semanal COM dados de estoque e consumos
      // Inclui todos os campos que podem vir da planilha para não sobrescrever
      let queryCmv = supabase
        .from('cmv_semanal')
        .select(`
          semana, 
          estoque_inicial, estoque_inicial_cozinha, estoque_inicial_bebidas, estoque_inicial_drinks,
          estoque_final, estoque_final_cozinha, estoque_final_bebidas, estoque_final_drinks,
          estoque_inicial_funcionarios, estoque_final_funcionarios,
          total_consumo_socios, mesa_beneficios_cliente, mesa_banda_dj, consumo_rh,
          consumo_socios, consumo_beneficios, consumo_artista, outros_ajustes,
          cmv_teorico_percentual, bonificacao_contrato_anual, cmv_real
        `)
        .eq('bar_id', barId)
        .eq('ano', anoAtual)
        .order('semana', { ascending: true });

      // Se for semana específica, buscar apenas ela e a anterior (para propagação)
      if (semana && !todas_semanas) {
        queryCmv = queryCmv.gte('semana', semana - 1).lte('semana', semana);
      }

      const { data: semanasCmv } = await queryCmv;
      console.log(`⏱️ [${Date.now() - barStartTime}ms] Semanas CMV buscadas (${semanasCmv?.length || 0} registros)`);

      const semanasExistentes = new Set(semanasCmv?.map(s => s.semana) || []);
      
      // Mapear dados existentes por semana para não sobrescrever valores da planilha
      const dadosPorSemana = new Map<number, any>();
      semanasCmv?.forEach(s => {
        dadosPorSemana.set(s.semana, {
          estoque_inicial: parseFloat(String(s.estoque_inicial)) || 0,
          estoque_inicial_cozinha: parseFloat(String(s.estoque_inicial_cozinha)) || 0,
          estoque_inicial_bebidas: parseFloat(String(s.estoque_inicial_bebidas)) || 0,
          estoque_inicial_drinks: parseFloat(String(s.estoque_inicial_drinks)) || 0,
          estoque_final: parseFloat(String(s.estoque_final)) || 0,
          estoque_final_cozinha: parseFloat(String(s.estoque_final_cozinha)) || 0,
          estoque_final_bebidas: parseFloat(String(s.estoque_final_bebidas)) || 0,
          estoque_final_drinks: parseFloat(String(s.estoque_final_drinks)) || 0,
          total_consumo_socios: parseFloat(String(s.total_consumo_socios)) || 0,
          mesa_beneficios_cliente: parseFloat(String(s.mesa_beneficios_cliente)) || 0,
          mesa_banda_dj: parseFloat(String(s.mesa_banda_dj)) || 0,
          consumo_rh: parseFloat(String(s.consumo_rh)) || 0,
          consumo_socios: parseFloat(String((s as any).consumo_socios)) || 0,
          consumo_beneficios: parseFloat(String((s as any).consumo_beneficios)) || 0,
          consumo_artista: parseFloat(String((s as any).consumo_artista)) || 0,
          outros_ajustes: parseFloat(String((s as any).outros_ajustes)) || 0,
          cmv_teorico_percentual: parseFloat(String(s.cmv_teorico_percentual)) || 0,
          bonificacao_contrato_anual: parseFloat(String(s.bonificacao_contrato_anual)) || 0,
          cmv_real: (s as any).cmv_real ? parseFloat(String((s as any).cmv_real)) : null,
        });
      });
      
      // Mapear estoque final por semana para propagar como estoque inicial
      const estoqueFinalPorSemana = new Map<number, {
        estoque_final: number;
        estoque_final_cozinha: number;
        estoque_final_bebidas: number;
        estoque_final_drinks: number;
        estoque_final_funcionarios: number;
      }>();
      
      semanasCmv?.forEach(s => {
        estoqueFinalPorSemana.set(s.semana, {
          estoque_final: parseFloat(String(s.estoque_final)) || 0,
          estoque_final_cozinha: parseFloat(String(s.estoque_final_cozinha)) || 0,
          estoque_final_bebidas: parseFloat(String(s.estoque_final_bebidas)) || 0,
          estoque_final_drinks: parseFloat(String(s.estoque_final_drinks)) || 0,
          estoque_final_funcionarios: parseFloat(String(s.estoque_final_funcionarios)) || 0,
        });
      });

      // 3. Processar cada semana
      for (const sem of semanasDesempenho || []) {
        const semanaStartTime = Date.now();
        const numeroSemana = sem.numero_semana;
        const faturamentoBruto = sem.faturamento_total || 0;
        const comissao = (sem as any).comissao || 0;
        console.log(`\n⏱️ [${Date.now() - barStartTime}ms] Processando semana ${numeroSemana}...`);
        const faturamentoCouvert = (sem as any).faturamento_entrada || 0;
        // Faturamento Limpo = Faturamento Total - Comissão - Faturamento Couvert
        // NOTA: "Faturamento Couvert" da planilha = faturamento_entrada (não couvert_atracoes)
        const faturamentoLimpo = faturamentoBruto - comissao - faturamentoCouvert;
        
        // Calcular datas da semana se não existirem
        let dataInicio = sem.data_inicio;
        let dataFim = sem.data_fim;
        
        if (!dataInicio || !dataFim) {
          const { start, end } = getWeekDateRange(anoAtual, numeroSemana);
          dataInicio = start;
          dataFim = end;
        }

        // Criar semana se não existir
        if (!semanasExistentes.has(numeroSemana)) {
          console.log(`➕ Criando CMV para semana ${numeroSemana}...`);
          
          const { error: insertError } = await supabase
            .from('cmv_semanal')
            .insert({
              bar_id: barId,
              ano: anoAtual,
              semana: numeroSemana,
              data_inicio: dataInicio,
              data_fim: dataFim,
              vendas_brutas: faturamentoBruto,
              faturamento_bruto: faturamentoBruto,
              status: 'rascunho',
              responsavel: 'Sistema Automático',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (insertError) {
            console.error(`Erro ao criar CMV semana ${numeroSemana}:`, insertError);
            continue;
          }
          
          semanasCriadas++;
          semanasExistentes.add(numeroSemana);
        }

        console.log(`⏱️ [${Date.now() - semanaStartTime}ms] Buscando compras NIBO...`);
        // 4. Buscar compras do NIBO para esta semana (usando data_competencia)
        // CMV - Categorias de custo de mercadoria:
        // - Ordinário: CUSTO COMIDA, Custo Bebidas, Custo Drinks
        // - Deboche: CUSTO COMIDAS, CUSTO BEBIDAS, CUSTO DRINKS
        // CMA - Alimentação (separado):
        // - Ordinário: ALIMENTAÇÃO
        // - Deboche: Alimentação
        const { data: compras } = await supabase
          .from('nibo_agendamentos')
          .select('valor, categoria_nome, tipo')
          .eq('bar_id', barId)
          .gte('data_competencia', dataInicio)
          .lte('data_competencia', dataFim)
          .or('categoria_nome.ilike.%custo comida%,categoria_nome.ilike.%custo bebida%,categoria_nome.ilike.%custo drink%,categoria_nome.ilike.alimenta%');

        const comprasPorCategoria = {
          cozinha: 0,    // CUSTO COMIDA / CUSTO COMIDAS
          bebidas: 0,    // Custo Bebidas / CUSTO BEBIDAS
          drinks: 0,     // Custo Drinks / CUSTO DRINKS
          alimentacao: 0 // ALIMENTAÇÃO (CMA - separado do CMV)
        };

        // Calcular: despesas são positivas, receitas (devoluções/créditos) são negativas
        compras?.forEach(c => {
          const valorBruto = parseFloat(String(c.valor)) || 0;
          const tipo = (c.tipo || '').toLowerCase();
          const cat = (c.categoria_nome || '').toLowerCase();
          
          // Se for receita (crédito/devolução), subtrai; se for despesa, soma
          const valor = tipo === 'receita' ? -valorBruto : valorBruto;
          
          if (cat.includes('custo comida')) comprasPorCategoria.cozinha += valor;
          else if (cat.includes('custo bebida')) comprasPorCategoria.bebidas += valor;
          else if (cat.includes('custo drink')) comprasPorCategoria.drinks += valor;
          else if (cat.includes('alimenta')) comprasPorCategoria.alimentacao += valor;
        });

        // CMV Total = cozinha + bebidas + drinks (NÃO inclui alimentação)
        const comprasCmvTotal = comprasPorCategoria.cozinha + comprasPorCategoria.bebidas + comprasPorCategoria.drinks;
        console.log(`⏱️ [${Date.now() - semanaStartTime}ms] Compras processadas: R$ ${comprasCmvTotal.toFixed(2)}`);

        // 4.2. Buscar CONSUMAÇÕES (4 categorias) - valores BRUTOS (sem multiplicador)
        // TODO(rodrigo/2026-04): Reabilitar busca de consumações do contahub_analitico
        // Contexto: Desabilitado temporariamente por timeout. Usar valores da planilha CMV enquanto isso.
        // Issue: Investigar performance da RPC get_consumos_classificados_semana
        let consumacoes = {
          total_consumo_socios: 0,
          mesa_adm_casa: 0,
          mesa_beneficios_cliente: 0,
          mesa_banda_dj: 0
        };
        /*
        try {
          const PADROES_SOCIOS = ['sócios', 'socios', 'socio', 'sócio', 'x-socio', 'x-sócio', 'x-soc', 'gonza', 'corbal', 'diogo', 'diego', 'cadu', 'augusto', 'rodrigo', 'digao', 'vinicius', 'vini', 'bueno', 'kaizen', 'caisen', 'joão pedro', 'joao pedro', 'jp', '3v', 'cantucci', 'moai', 'luan', 'viny'];
          const PADROES_CLIENTES = ['aniver', 'anivers', 'aniversário', 'aniversario', 'aniversariante', 'niver', 'voucher', 'benefício', 'beneficio', 'mesa mágica', 'mágica', 'influencer', 'influ', 'influencia', 'influência', 'club', 'clube', 'midia', 'mídia', 'social', 'insta', 'digital', 'cliente', 'ambev', 'promoção', 'chegadeira', 'nct'];
          const PADROES_ARTISTAS = ['musico', 'músicos', 'dj', 'banda', 'artista', 'breno', 'benza', 'stz', 'zelia', 'tia', 'samba', 'sambadona', 'doze', 'boca', 'boka', 'pé', 'chão', 'pe no', 'segunda', 'resenha', 'pagode', 'roda', 'reconvexa', 'rodie', 'roudier', 'roudi', 'som', 'técnico', 'tecnico', 'pv', 'paulo victor', 'prod', 'elas', 'bonsai', 'afrika', 'caju', 'negrita'];
          const PADROES_FUNCIONARIOS = ['funcionários', 'funcionario', 'rh', 'financeiro', 'fin', 'mkt', 'marketing', 'slu', 'adm', 'administrativo', 'prêmio', 'confra', 'wendel', 'natalia', 'nato', 'x dudu', 'kauan', 'ana bia', 'teixeira', 'jhonny', 'andreia', 'lucia', 'phelipe', 'isabel', 'dakota', 'thais', 'edna', 'richard', 'gustavo', 'aladim', 'duarte', 'renan', 'henrique', 'deivid', 'vivi', 'rafa', 'adriana'];

          const matchPattern = (texto: string, patterns: string[]): boolean => {
            const t = texto.toLowerCase();
            return patterns.some(p => t.includes(p.toLowerCase()));
          };

          const classificarRegistro = (vdMesadesc: string, motivo: string): 'socios' | 'artistas' | 'funcionarios' | 'clientes' | null => {
            const textoCompleto = `${vdMesadesc} ${motivo}`.toLowerCase();
            
            // Verificar CLIENTES primeiro (aniversário tem prioridade sobre nomes de sócios)
            if (matchPattern(textoCompleto, PADROES_CLIENTES)) return 'clientes';
            if (matchPattern(textoCompleto, PADROES_ARTISTAS)) return 'artistas';
            if (matchPattern(textoCompleto, PADROES_FUNCIONARIOS)) return 'funcionarios';
            if (matchPattern(textoCompleto, PADROES_SOCIOS)) return 'socios';
            return null;
          };

          // Buscar consumos já classificados via SQL (função get_consumos_classificados_semana)
          // Filtrar apenas valorfinal = 0 (consumos especiais onde o desconto = preço de venda)
          try {
            const { data: consumosClassificados, error: consumosError } = await supabase.rpc('get_consumos_classificados_semana', {
              input_bar_id: barId,
              input_data_inicio: dataInicio,
              input_data_fim: dataFim
            });

            if (consumosError) {
              console.error('  ⚠️ Erro ao buscar consumos classificados:', consumosError);
            } else if (consumosClassificados && consumosClassificados.length > 0) {
              const totais = { socios: 0, artistas: 0, funcionarios: 0, clientes: 0 };
              
              for (const item of consumosClassificados) {
                const cat = item.categoria as 'socios' | 'artistas' | 'funcionarios' | 'clientes';
                const valor = parseFloat(String(item.total)) || 0;
                if (totais[cat] !== undefined) {
                  totais[cat] = valor;
                }
              }
              
              consumacoes.total_consumo_socios = totais.socios;
              consumacoes.mesa_banda_dj = totais.artistas;
              consumacoes.mesa_adm_casa = totais.funcionarios;
              consumacoes.mesa_beneficios_cliente = totais.clientes;
              console.log(`  👥 Consumações: Sócios R$ ${totais.socios.toFixed(2)}, Artistas R$ ${totais.artistas.toFixed(2)}, Funcionários R$ ${totais.funcionarios.toFixed(2)}, Clientes R$ ${totais.clientes.toFixed(2)}`);
            }
          } catch (rpcErr) {
            console.error('  ⚠️ Erro ao chamar RPC get_consumos_classificados_semana:', rpcErr);
          }
        } catch (err) {
          console.error('  ⚠️ Erro ao buscar consumações:', err);
        }
        */
        console.log('  ⚠️ Busca de consumos de contahub_analitico DESABILITADA (usar valores da planilha)');
        console.log(`⏱️ [${Date.now() - semanaStartTime}ms] Consumos processados`);

        // 4.3. Cálculo de estoque final da contagem
        // TODO(rodrigo/2026-04): Reabilitar cálculo de estoque final da planilha de contagem
        // Contexto: Atualmente usa apenas estoque final da planilha CMV. Código de contagem comentado abaixo.
        // Issue: Decidir se planilha de contagem deve ser fonte primária ou secundária
        let estoqueFinalDetalhado = {
          estoque_final_cozinha: 0,
          estoque_final_bebidas: 0,
          estoque_final_drinks: 0
        };
        /*
        try {
          // Calcular a segunda-feira seguinte ao fim do período
          const dataFimDate = new Date(dataFim + 'T12:00:00Z');
          const diaSemana = dataFimDate.getUTCDay();
          let diasParaSegunda = diaSemana === 0 ? 1 : diaSemana === 6 ? 2 : (8 - diaSemana) % 7 || 7;
          dataFimDate.setUTCDate(dataFimDate.getUTCDate() + diasParaSegunda);
          const dataSegundaFinal = dataFimDate.toISOString().split('T')[0];

          // Buscar contagem exata ou mais próxima
          let dataContagemFinal: string | null = null;
          const { data: contagemExata } = await supabase
            .from('contagem_estoque_insumos')
            .select('data_contagem, estoque_final')
            .eq('bar_id', barId)
            .eq('data_contagem', dataSegundaFinal)
            .limit(1);

          if (contagemExata && contagemExata.length > 0) {
            dataContagemFinal = dataSegundaFinal;
            console.log(`  📦 Usando contagem exata (segunda-feira): ${dataContagemFinal}`);
          } else {
            console.log(`  ⚠️ Nenhuma contagem na segunda-feira ${dataSegundaFinal}, buscando alternativas...`);
            // Tentar buscar contagem futura (até 7 dias depois)
            const { data: contagensProximas } = await supabase
              .from('contagem_estoque_insumos')
              .select('data_contagem, estoque_final')
              .eq('bar_id', barId)
              .gte('data_contagem', dataSegundaFinal)
              .order('data_contagem', { ascending: true })
              .limit(1);
            if (contagensProximas && contagensProximas.length > 0) {
              dataContagemFinal = contagensProximas[0].data_contagem;
              console.log(`  📦 Usando contagem futura: ${dataContagemFinal}`);
            } else {
              console.log(`  ⚠️ Nenhuma contagem futura encontrada, buscando dentro da semana...`);
              // Fallback: buscar a contagem mais recente DENTRO do período da semana
              const { data: contagemDentro } = await supabase
                .from('contagem_estoque_insumos')
                .select('data_contagem, estoque_final')
                .eq('bar_id', barId)
                .gte('data_contagem', dataInicio)
                .lte('data_contagem', dataFim)
                .order('data_contagem', { ascending: false })
                .limit(1);
              if (contagemDentro && contagemDentro.length > 0) {
                dataContagemFinal = contagemDentro[0].data_contagem;
                console.log(`  \u26a0\ufe0f Usando contagem DENTRO da semana: ${dataContagemFinal}`);
              }
            }
          }

          if (dataContagemFinal) {
            // Buscar insumos
            const { data: insumos } = await supabase
              .from('insumos')
              .select('id, codigo, tipo_local, categoria')
              .eq('bar_id', barId);

            if (insumos) {
              const insumosMap = new Map(insumos.map((i: any) => [i.id, i]));
              const insumosPorCodigo = new Map(insumos.map((i: any) => [i.codigo, i]));

              // Buscar contagens com custo unitário
              const { data: contagens } = await supabase
                .from('contagem_estoque_insumos')
                .select('insumo_id, insumo_codigo, estoque_final, custo_unitario')
                .eq('bar_id', barId)
                .eq('data_contagem', dataContagemFinal);

              if (contagens) {
                const categoriasCozinha = ['cozinha', 'ARMAZÉM (C)', 'HORTIFRUTI (C)', 'MERCADO (C)', 'Mercado (S)', 'PÃES', 'PEIXE', 'PROTEÍNA', 'tempero', 'hortifruti', 'líquido'];
                const categoriasDrinks = ['ARMAZÉM B', 'DESTILADOS', 'DESTILADOS LOG', 'HORTIFRUTI B', 'IMPÉRIO', 'MERCADO B', 'POLPAS', 'OUTROS'];
                const categoriasExcluir = ['HORTIFRUTI (F)', 'MERCADO (F)', 'PROTEÍNA (F)'];

                contagens.forEach((contagem: any) => {
                  // Tentar buscar insumo por ID, se não existir tentar por código
                  let insumo = contagem.insumo_id ? insumosMap.get(contagem.insumo_id) : null;
                  if (!insumo && contagem.insumo_codigo) {
                    insumo = insumosPorCodigo.get(contagem.insumo_codigo);
                  }
                  
                  // Se ainda não encontrou, usar lógica baseada apenas no código
                  const valor = contagem.estoque_final * (contagem.custo_unitario || 0);
                  const codigo = contagem.insumo_codigo || '';
                  const isProdDrinks = codigo.startsWith('pd');
                  const isProdCozinha = codigo.startsWith('pc');
                  const isInsumo = codigo.startsWith('i');

                  if (insumo) {
                    // Tem dados do insumo, usar categorização completa
                    if (categoriasExcluir.includes(insumo.categoria)) return;

                    if (insumo.tipo_local === 'bar') {
                      estoqueFinalDetalhado.estoque_final_bebidas += valor;
                    } else if (isProdDrinks) {
                      estoqueFinalDetalhado.estoque_final_drinks += valor;
                    } else if (isProdCozinha) {
                      estoqueFinalDetalhado.estoque_final_cozinha += valor;
                    } else if (insumo.tipo_local === 'cozinha' && categoriasDrinks.includes(insumo.categoria)) {
                      estoqueFinalDetalhado.estoque_final_drinks += valor;
                    } else if (insumo.tipo_local === 'cozinha' && categoriasCozinha.includes(insumo.categoria)) {
                      estoqueFinalDetalhado.estoque_final_cozinha += valor;
                    } else if (insumo.tipo_local === 'cozinha' && insumo.categoria === 'Não-alcóolicos') {
                      estoqueFinalDetalhado.estoque_final_drinks += valor;
                    }
                  } else if (isInsumo) {
                    // Fallback: insumos com código 'i' são geralmente bebidas (bar)
                    estoqueFinalDetalhado.estoque_final_bebidas += valor;
                  } else if (isProdDrinks) {
                    estoqueFinalDetalhado.estoque_final_drinks += valor;
                  } else if (isProdCozinha) {
                    estoqueFinalDetalhado.estoque_final_cozinha += valor;
                  }
                });

                const estoqueTotal = estoqueFinalDetalhado.estoque_final_cozinha + estoqueFinalDetalhado.estoque_final_bebidas + estoqueFinalDetalhado.estoque_final_drinks;
                console.log(`  📦 Estoque Final: R$ ${estoqueTotal.toFixed(2)} (Cozinha: R$ ${estoqueFinalDetalhado.estoque_final_cozinha.toFixed(2)}, Bebidas: R$ ${estoqueFinalDetalhado.estoque_final_bebidas.toFixed(2)}, Drinks: R$ ${estoqueFinalDetalhado.estoque_final_drinks.toFixed(2)})`);
              }
            }
          } else {
            console.log(`  ⚠️ Nenhuma contagem de estoque final encontrada para semana ${numeroSemana}`);
          }
        } catch (err) {
          console.error('  ⚠️ Erro ao buscar estoque final:', err);
        }
        */

        console.log(`⏱️ [${Date.now() - semanaStartTime}ms] Iniciando cálculos finais...`);
        // 5. Verificar dados existentes da semana (podem ter vindo da planilha)
        const dadosAtuais = dadosPorSemana.get(numeroSemana) || {};
        
        // 6. Propagar Estoque Inicial = Estoque Final da semana anterior
        // APENAS se não vier da planilha (dadosAtuais.estoque_inicial === 0)
        // Se a planilha tem estoque inicial, RESPEITAR o valor da planilha
        const semanaAnterior = numeroSemana - 1;
        const estoqueAnterior = estoqueFinalPorSemana.get(semanaAnterior);
        
        const estoqueInicialUpdate: any = {};
        if (dadosAtuais.estoque_inicial > 0) {
          // Planilha tem estoque inicial, NÃO propagar
          console.log(`  📋 Estoque Inicial semana ${numeroSemana} da planilha: R$ ${dadosAtuais.estoque_inicial.toFixed(2)}`);
        } else if (estoqueAnterior && estoqueAnterior.estoque_final > 0) {
          // Planilha NÃO tem estoque inicial, propagar da semana anterior
          estoqueInicialUpdate.estoque_inicial = estoqueAnterior.estoque_final;
          estoqueInicialUpdate.estoque_inicial_cozinha = estoqueAnterior.estoque_final_cozinha;
          estoqueInicialUpdate.estoque_inicial_bebidas = estoqueAnterior.estoque_final_bebidas;
          estoqueInicialUpdate.estoque_inicial_drinks = estoqueAnterior.estoque_final_drinks;
          estoqueInicialUpdate.estoque_inicial_funcionarios = estoqueAnterior.estoque_final_funcionarios;
          console.log(`  📦 Propagando Estoque Inicial semana ${numeroSemana} = Estoque Final semana ${semanaAnterior}: R$ ${estoqueAnterior.estoque_final.toFixed(2)}`);
        }

        // 7. Calcular CMV Real se tiver estoques válidos
        // CMV Real = Estoque Inicial + Compras - Estoque Final - Consumos + Bonificações
        // PRIORIDADE: Usar valores da planilha CMV
        const estoqueInicial = dadosAtuais.estoque_inicial || estoqueInicialUpdate.estoque_inicial || 0;
        // Usar SEMPRE o estoque final da planilha CMV (não calcular da contagem)
        const estoqueFinal = dadosAtuais.estoque_final || 0;
        
        let cmvReal = null;
        let cmvPercentual = null;
        let cmvLimpoPercentual = null;
        
        if (estoqueInicial > 0 || estoqueFinal > 0 || comprasCmvTotal > 0) {
          // Usar consumos da planilha (já com fator aplicado) se disponíveis
          // Caso contrário, usar valores brutos e aplicar fator
          let consumoSocios = dadosAtuais.consumo_socios || 0;
          let consumoBeneficios = dadosAtuais.consumo_beneficios || 0;
          let consumoArtista = dadosAtuais.consumo_artista || 0;
          let consumoRh = dadosAtuais.consumo_rh || 0;
          let outrosAjustes = dadosAtuais.outros_ajustes || 0;
          
          // Se não tiver consumos da planilha, calcular dos valores brutos
          if (consumoSocios === 0 && consumoBeneficios === 0 && consumoArtista === 0) {
            const fatorConsumo = await getFatorConsumo(barId);
            consumoSocios = (consumacoes.total_consumo_socios || 0) * fatorConsumo;
            consumoBeneficios = (consumacoes.mesa_beneficios_cliente || 0) * fatorConsumo;
            consumoArtista = (consumacoes.mesa_banda_dj || 0) * fatorConsumo;
            const consumoAdm = (consumacoes.mesa_adm_casa || 0) * fatorConsumo;
            consumoRh = consumoAdm; // mesa_adm_casa é o RH quando não vem da planilha
          }
          
          const totalConsumos = consumoSocios + consumoBeneficios + consumoArtista + consumoRh + outrosAjustes;
          const bonificacoes = dadosAtuais.bonificacao_contrato_anual || 0;
          
          // CMV Real = (Est. Inicial + Compras - Est. Final) - Consumos + Bonificações
          cmvReal = estoqueInicial + comprasCmvTotal - estoqueFinal - totalConsumos + bonificacoes;
          
          // CMV % (bruto) = CMV Real / Faturamento Bruto * 100
          if (faturamentoBruto > 0) {
            cmvPercentual = (cmvReal / faturamentoBruto) * 100;
          }
          
          // CMV Limpo % = CMV Real / Faturamento Líquido * 100
          // Faturamento Líquido = Faturamento Bruto - Comissão - Couvert
          if (faturamentoLimpo > 0) {
            cmvLimpoPercentual = (cmvReal / faturamentoLimpo) * 100;
          }
          
          console.log(`  💰 CMV Real: R$ ${cmvReal.toFixed(2)} | CMV Bruto: ${cmvPercentual?.toFixed(1) || 0}% | CMV Limpo: ${cmvLimpoPercentual?.toFixed(1) || 0}% | Consumos: R$ ${totalConsumos.toFixed(2)}`);
        }

        console.log(`⏱️ [${Date.now() - semanaStartTime}ms] Preparando update no banco...`);
        // 9. Montar objeto de update
        const updateData: any = {
          vendas_brutas: faturamentoBruto,
          vendas_liquidas: faturamentoLimpo,
          faturamento_bruto: faturamentoBruto,
          faturamento_cmvivel: faturamentoLimpo,
          // CMV - Total de compras (sem alimentação)
          compras_periodo: comprasCmvTotal,
          compras_cozinha: comprasPorCategoria.cozinha,
          compras_bebidas: comprasPorCategoria.bebidas,
          compras_drinks: comprasPorCategoria.drinks,
          // CMA - Alimentação (separado)
          compras_alimentacao: comprasPorCategoria.alimentacao,
          // Campos legado (manter compatibilidade)
          compras_custo_comida: comprasPorCategoria.cozinha,
          compras_custo_bebidas: comprasPorCategoria.bebidas,
          compras_custo_drinks: comprasPorCategoria.drinks,
          // Consumações (valores BRUTOS - multiplicador aplicado no cálculo do CMV)
          total_consumo_socios: consumacoes.total_consumo_socios,
          mesa_adm_casa: consumacoes.mesa_adm_casa,
          mesa_beneficios_cliente: consumacoes.mesa_beneficios_cliente,
          mesa_banda_dj: consumacoes.mesa_banda_dj,
          // Estoques finais detalhados
          estoque_final_cozinha: estoqueFinalDetalhado.estoque_final_cozinha,
          estoque_final_bebidas: estoqueFinalDetalhado.estoque_final_bebidas,
          estoque_final_drinks: estoqueFinalDetalhado.estoque_final_drinks,
          estoque_final: estoqueFinalDetalhado.estoque_final_cozinha + estoqueFinalDetalhado.estoque_final_bebidas + estoqueFinalDetalhado.estoque_final_drinks,
          // Propagar estoque inicial da semana anterior (só se não veio da planilha)
          ...estoqueInicialUpdate,
          updated_at: new Date().toISOString()
        };
        
        // Adicionar CMV calculado se válido
        // NOTA: cmv_percentual é GENERATED ALWAYS no banco — NÃO incluir no update
        // Usar CMV Real da planilha se disponível, senão calcular
        const cmvRealFinal = dadosAtuais.cmv_real !== null && dadosAtuais.cmv_real !== undefined 
          ? dadosAtuais.cmv_real 
          : cmvReal;
        
        if (cmvRealFinal !== null) {
          // Só sobrescrever CMV Real se não veio da planilha
          if (!dadosAtuais.cmv_real && dadosAtuais.cmv_real !== 0) {
            updateData.cmv_real = cmvRealFinal;
          }
          
          // Sempre recalcular CMV Limpo % = CMV Real / Faturamento Líquido * 100
          if (faturamentoLimpo > 0) {
            updateData.cmv_limpo_percentual = (cmvRealFinal / faturamentoLimpo) * 100;
          }
        }
        
        // Calcular gap se tiver CMV teórico
        if (cmvLimpoPercentual !== null && dadosAtuais.cmv_teorico_percentual > 0) {
          const gap = cmvLimpoPercentual - dadosAtuais.cmv_teorico_percentual;
          updateData.gap = gap;
        }

        // 10. Atualizar CMV no banco
        console.log(`⏱️ [${Date.now() - semanaStartTime}ms] Executando UPDATE...`);
        const { error: updateError } = await supabase
          .from('cmv_semanal')
          .update(updateData)
          .eq('bar_id', barId)
          .eq('ano', anoAtual)
          .eq('semana', numeroSemana);

        if (updateError) {
          console.error(`Erro ao atualizar CMV semana ${numeroSemana}:`, updateError);
          continue;
        }

        semanasProcessadas++;
        
        resultados.push({
          bar_id: barId,
          semana: numeroSemana,
          faturamento_bruto: faturamentoBruto,
          compras_cmv: comprasCmvTotal,
          compras_alimentacao: comprasPorCategoria.alimentacao,
          cmv_real: cmvReal,
          cmv_percentual: cmvPercentual,
          estoque_inicial: estoqueInicial,
          estoque_final: estoqueFinal,
          status: 'ok'
        });

        console.log(`✅ Semana ${numeroSemana}: Fat. Bruto R$ ${faturamentoBruto.toFixed(2)}, Limpo R$ ${faturamentoLimpo.toFixed(2)}, CMV Real R$ ${(cmvReal || 0).toFixed(2)}`);
      }
      
      // ========== PROPAGAÇÃO FINAL OBRIGATÓRIA DE ESTOQUE INICIAL ==========
      // REGRA CONTÁBIL: Estoque Inicial semana N = Estoque Final semana N-1
      // Esta segunda passagem garante consistência mesmo se houve updates parciais
      console.log(`\n🔄 Propagando estoque inicial (regra contábil) para bar ${barId}...`)
      
      const { data: todasSemanasBar } = await supabase
        .from('cmv_semanal')
        .select('id, ano, semana, estoque_final, estoque_final_cozinha, estoque_final_bebidas, estoque_final_drinks, estoque_final_funcionarios')
        .eq('bar_id', barId)
        .eq('ano', anoAtual)
        .order('semana', { ascending: true })

      if (todasSemanasBar && todasSemanasBar.length > 1) {
        let propagacoes = 0
        
        for (let i = 1; i < todasSemanasBar.length; i++) {
          const semanaAtual = todasSemanasBar[i]
          const semanaAnterior = todasSemanasBar[i - 1]
          
          // Propagar estoque final da semana anterior como inicial da atual
          const { error: propError } = await supabase
            .from('cmv_semanal')
            .update({
              estoque_inicial: semanaAnterior.estoque_final,
              estoque_inicial_cozinha: semanaAnterior.estoque_final_cozinha,
              estoque_inicial_bebidas: semanaAnterior.estoque_final_bebidas,
              estoque_inicial_drinks: semanaAnterior.estoque_final_drinks,
              estoque_inicial_funcionarios: semanaAnterior.estoque_final_funcionarios,
              updated_at: new Date().toISOString()
            })
            .eq('id', semanaAtual.id)
          
          if (!propError) {
            propagacoes++
          }
        }
        
        console.log(`✅ ${propagacoes} propagações de estoque inicial realizadas para bar ${barId}`)
      }
      // ========== FIM PROPAGAÇÃO ==========
    }

    console.log(`\n✅ Processamento concluído: ${semanasProcessadas} semanas atualizadas, ${semanasCriadas} criadas`);

    // 💓 Heartbeat: registrar sucesso
    await heartbeatEnd(
      supabase,
      heartbeatId,
      'success',
      startTime,
      semanasProcessadas + semanasCriadas,
      { semanas_processadas: semanasProcessadas, semanas_criadas: semanasCriadas }
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: `CMV processado: ${semanasProcessadas} semanas atualizadas, ${semanasCriadas} criadas`,
        semanas_processadas: semanasProcessadas,
        semanas_criadas: semanasCriadas,
        resultados,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Erro ao processar CMV:', error);
    
    // 💓 Heartbeat: registrar erro
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseForError = createClient(supabaseUrl, serviceKey);
      await heartbeatError(supabaseForError, heartbeatId, startTime, error instanceof Error ? error : String(error));
    } catch (hbErr) {
      console.warn('⚠️ Erro ao registrar heartbeat de erro:', hbErr);
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
