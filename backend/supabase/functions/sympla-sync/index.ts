import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache do token para evitar múltiplas queries
let cachedToken: string | null = null;

// Função para obter token do Sympla do banco de dados
async function getSymplaTokenFromDB(supabase: any, barId: number = 3): Promise<string> {
  // Se já temos o token em cache, usar ele
  if (cachedToken) {
    return cachedToken;
  }

  // Primeiro tenta buscar do banco
  const { data: creds, error } = await supabase
    .from('api_credentials')
    .select('api_token')
    .eq('bar_id', barId)
    .eq('sistema', 'sympla')
    .eq('ativo', true)
    .single();

  if (!error && creds?.api_token) {
    cachedToken = creds.api_token;
    console.log('✅ Token Sympla obtido do banco de dados');
    return creds.api_token;
  }

  // Fallback para variável de ambiente
  const envToken = Deno.env.get('SYMPLA_API_TOKEN');
  if (envToken) {
    cachedToken = envToken;
    console.log('⚠️ Token Sympla obtido de variável de ambiente (fallback)');
    return envToken;
  }

  throw new Error('Token do Sympla não encontrado no banco nem nas variáveis de ambiente');
}

// Função para fazer requisições HTTPS à API do Sympla
async function makeSymplaRequest(path: string, token: string) {
  const url = `https://api.sympla.com.br${path}`;
  
  console.log(`🔗 Fazendo requisição para: ${url}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      's_token': token,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Sympla API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// Função para buscar TODOS os eventos (com paginação completa)
async function buscarTodosEventos(token: string) {
  let todosEventos: any[] = [];
  let pagina = 1;
  let temProximaPagina = true;

  console.log(`🔄 Buscando eventos com paginação...`);

  while (temProximaPagina) {
    console.log(`   📄 Página ${pagina}...`);
    
    // Não usar filtros de data na API, filtrar depois no código
    const path = `/public/v1.5.1/events?page=${pagina}`;
    
    const response = await makeSymplaRequest(path, token);

    if (response.data && response.data.length > 0) {
      todosEventos = todosEventos.concat(response.data);
      pagina++;
      
      // Verificar se há próxima página (API Sympla retorna 100 por página)
      if (response.data.length < 100) {
        temProximaPagina = false;
      }
    } else {
      temProximaPagina = false;
    }
  }

  console.log(`   ✅ ${todosEventos.length} eventos encontrados em ${pagina - 1} páginas`);
  return todosEventos;
}

// Função para buscar participantes de um evento (com paginação completa)
async function buscarTodosParticipantes(eventoId: string, token: string) {
  let todosParticipantes: any[] = [];
  let pagina = 1;
  let temProximaPagina = true;

  console.log(`🔄 Buscando participantes com paginação...`);

  while (temProximaPagina) {
    console.log(`   📄 Página ${pagina}...`);
    const path = `/public/v1.5.1/events/${eventoId}/participants?page=${pagina}`;
    const response = await makeSymplaRequest(path, token);

    if (response.data && response.data.length > 0) {
      todosParticipantes = todosParticipantes.concat(response.data);
      pagina++;
      
      // Verificar se há próxima página (API Sympla retorna 100 por página)
      if (response.data.length < 100) {
        temProximaPagina = false;
      }
    } else {
      temProximaPagina = false;
    }
  }

  console.log(`   ✅ ${todosParticipantes.length} participantes encontrados em ${pagina - 1} páginas`);
  return todosParticipantes;
}

// Função para buscar pedidos de um evento (com paginação completa)
async function buscarTodosPedidos(eventoId: string, token: string) {
  let todosPedidos: any[] = [];
  let pagina = 1;
  let temProximaPagina = true;

  console.log(`🔄 Buscando pedidos com paginação...`);

  while (temProximaPagina) {
    console.log(`   📄 Página ${pagina}...`);
    const path = `/public/v1.5.1/events/${eventoId}/orders?page=${pagina}`;
    const response = await makeSymplaRequest(path, token);

    if (response.data && response.data.length > 0) {
      todosPedidos = todosPedidos.concat(response.data);
      pagina++;
      
      // Verificar se há próxima página
      if (response.data.length < 100) {
        temProximaPagina = false;
      }
    } else {
      temProximaPagina = false;
    }
  }

  console.log(`   ✅ ${todosPedidos.length} pedidos encontrados em ${pagina - 1} páginas`);
  return todosPedidos;
}

// Função para inserir eventos no banco (processamento em lotes)
async function inserirEventos(supabase: any, eventos: any[], barId: number) {
  console.log(`\n📊 Inserindo ${eventos.length} eventos no banco (bar_id: ${barId})...`);
  
  const eventosParaInserir = eventos.map((evento: any) => ({
    bar_id: barId,
    evento_sympla_id: evento.id,
    reference_id: evento.reference_id,
    nome_evento: evento.name,
    data_inicio: evento.start_date,
    data_fim: evento.end_date,
    publicado: evento.published === 1,
    imagem_url: evento.image,
    evento_url: evento.url,
    dados_endereco: evento.address,
    dados_host: evento.host,
    categoria_primaria: evento.category_prim?.name,
    categoria_secundaria: evento.category_sec?.name,
    raw_data: evento
  }));
  
  const { data, error } = await supabase
    .from('sympla_eventos')
    .upsert(eventosParaInserir, {
      onConflict: 'evento_sympla_id',
      ignoreDuplicates: false
    })
    .select('id');
  
  if (error) {
    console.error('❌ Erro ao inserir eventos:', error);
    return 0;
  }
  
  console.log(`✅ ${data?.length || 0} eventos inseridos/atualizados`);
  return data?.length || 0;
}

// Função para inserir participantes no banco (processamento em lotes)
async function inserirParticipantes(supabase: any, eventoId: string, participantes: any[], barId: number) {
  console.log(`\n👥 Inserindo ${participantes.length} participantes do evento ${eventoId} (bar_id: ${barId})...`);
  
  const participantesParaInserir = participantes.map((participante: any) => ({
    bar_id: barId,
    participante_sympla_id: participante.id,
    evento_sympla_id: participante.event_id,
    pedido_id: participante.order_id,
    nome_completo: `${participante.first_name || ''} ${participante.last_name || ''}`.trim(),
    email: participante.email,
    tipo_ingresso: participante.ticket_name,
    numero_ticket: participante.ticket_number,
    fez_checkin: participante.checkin?.check_in === true,
    data_checkin: participante.checkin?.check_in_date ? new Date(participante.checkin.check_in_date).toISOString() : null,
    status_pedido: participante.order_status,
    dados_ticket: {
      ticket_created_at: participante.ticket_created_at,
      ticket_updated_at: participante.ticket_updated_at,
      ticket_num_qr_code: participante.ticket_num_qr_code
    },
    raw_data: participante
  }));
  
  // Processar em lotes de 100 para evitar timeout
  const tamanhoLote = 100;
  let totalInserido = 0;
  
  for (let i = 0; i < participantesParaInserir.length; i += tamanhoLote) {
    const lote = participantesParaInserir.slice(i, i + tamanhoLote);
    console.log(`   📦 Processando lote ${Math.floor(i/tamanhoLote) + 1}: ${lote.length} registros`);
    
    const { data, error } = await supabase
      .from('sympla_participantes')
      .upsert(lote, {
        onConflict: 'participante_sympla_id',
        ignoreDuplicates: false
      })
      .select('id');
    
    if (error) {
      console.error(`❌ Erro no lote ${Math.floor(i/tamanhoLote) + 1}:`, error);
    } else {
      totalInserido += data?.length || 0;
      console.log(`   ✅ Lote ${Math.floor(i/tamanhoLote) + 1}: ${data?.length || 0} registros`);
    }
  }
  
  console.log(`✅ TOTAL: ${totalInserido} participantes inseridos/atualizados`);
  return totalInserido;
}

// Função para inserir pedidos no banco (processamento em lotes)
async function inserirPedidos(supabase: any, eventoId: string, pedidos: any[], barId: number) {
  console.log(`\n💰 Inserindo ${pedidos.length} pedidos do evento ${eventoId} (bar_id: ${barId})...`);
  
  const pedidosParaInserir = pedidos.map((pedido: any) => ({
    bar_id: barId,
    pedido_sympla_id: pedido.id,
    evento_sympla_id: pedido.event_id,
    data_pedido: pedido.order_date ? new Date(pedido.order_date).toISOString() : null,
    status_pedido: pedido.order_status,
    tipo_transacao: pedido.transaction_type,
    nome_comprador: `${pedido.buyer_first_name || ''} ${pedido.buyer_last_name || ''}`.trim(),
    email_comprador: pedido.buyer_email,
    valor_liquido: parseFloat(pedido.order_total_net_value || '0'),
    valor_bruto: parseFloat(pedido.order_total_sale_price || '0'),
    taxa_sympla: (parseFloat(pedido.order_total_sale_price || '0') - parseFloat(pedido.order_total_net_value || '0')),
    dados_utm: pedido.utm,
    dados_comprador: {
      buyer_first_name: pedido.buyer_first_name,
      buyer_last_name: pedido.buyer_last_name,
      buyer_email: pedido.buyer_email,
      updated_date: pedido.updated_date,
      approved_date: pedido.approved_date
    },
    raw_data: pedido
  }));
  
  // Processar em lotes de 100 para evitar timeout
  const tamanhoLote = 100;
  let totalInserido = 0;
  
  for (let i = 0; i < pedidosParaInserir.length; i += tamanhoLote) {
    const lote = pedidosParaInserir.slice(i, i + tamanhoLote);
    console.log(`   📦 Processando lote ${Math.floor(i/tamanhoLote) + 1}: ${lote.length} registros`);
    
    const { data, error } = await supabase
      .from('sympla_pedidos')
      .upsert(lote, {
        onConflict: 'pedido_sympla_id,evento_sympla_id',
        ignoreDuplicates: false
      })
      .select('id');
    
    if (error) {
      console.error(`❌ Erro no lote ${Math.floor(i/tamanhoLote) + 1}:`, error);
    } else {
      totalInserido += data?.length || 0;
      console.log(`   ✅ Lote ${Math.floor(i/tamanhoLote) + 1}: ${data?.length || 0} registros`);
    }
  }
  
  console.log(`✅ TOTAL: ${totalInserido} pedidos inseridos/atualizados`);
  return totalInserido;
}

// Função para registrar log de sincronização
async function registrarLogSync(supabase: any, eventoId: string, tipo: string, status: string, detalhes: any) {
  try {
    await supabase
      .from('sympla_sync_logs')
      .insert({
        evento_sympla_id: eventoId,
        tipo_sync: tipo,
        status: status,
        detalhes: detalhes
      });
  } catch (error) {
    console.warn('Erro ao registrar log (não crítico):', error);
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🎪 INICIANDO SYMPLA SYNC');

    // Supabase connection
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Pegar parâmetros da requisição
    const requestBody = await req.json().catch(() => ({}));
    // filtro_eventos vazio ou null = sem filtro de nome (pega todos)
    // bar_id é opcional - se não passar, processa todos os bares ativos
    const { filtro_eventos = '', data_inicio, data_fim, bar_id } = requestBody;
    
    // Buscar bares para processar
    const { data: todosOsBares, error: baresError } = await supabase
      .from('bars')
      .select('id, nome')
      .eq('ativo', true);
    
    if (baresError || !todosOsBares?.length) {
      return Response.json({
        success: false,
        error: 'Nenhum bar ativo encontrado'
      }, { status: 400, headers: corsHeaders });
    }
    
    // Se passou bar_id específico, filtra; senão processa todos
    const baresParaProcessar = bar_id 
      ? todosOsBares.filter(b => b.id === bar_id)
      : todosOsBares;
    
    console.log(`🏪 Processando ${baresParaProcessar.length} bar(es): ${baresParaProcessar.map(b => b.nome).join(', ')}`);

    // Calcular período de datas
    let dataInicioPeriodo: Date;
    let dataFimPeriodo: Date;
    
    if (data_inicio && data_fim) {
      dataInicioPeriodo = new Date(data_inicio);
      dataInicioPeriodo.setHours(0, 0, 0, 0);
      dataFimPeriodo = new Date(data_fim);
      dataFimPeriodo.setHours(23, 59, 59, 999);
      console.log(`📅 Usando período customizado: ${data_inicio} a ${data_fim}`);
    } else {
      const hoje = new Date();
      dataInicioPeriodo = new Date(hoje);
      dataInicioPeriodo.setDate(hoje.getDate() - 14);
      dataInicioPeriodo.setHours(0, 0, 0, 0);
      dataFimPeriodo = new Date(hoje);
      dataFimPeriodo.setHours(23, 59, 59, 999);
      console.log(`📅 Usando últimos 14 dias: ${dataInicioPeriodo.toISOString().split('T')[0]} a ${dataFimPeriodo.toISOString().split('T')[0]}`);
    }

    const dataInicioStr = dataInicioPeriodo.toISOString().split('T')[0];
    const dataFimStr = dataFimPeriodo.toISOString().split('T')[0];
    
    // Resultado consolidado de todos os bares
    const resultadosPorBar: any[] = [];
    let totalGeralEventos = 0;
    let totalGeralParticipantes = 0;
    let totalGeralPedidos = 0;
    
    // ====== LOOP POR CADA BAR ======
    for (const bar of baresParaProcessar) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🏪 PROCESSANDO BAR: ${bar.nome} (ID: ${bar.id})`);
      console.log(`${'='.repeat(60)}`);
      
      try {
        // Obter token do Sympla do banco para este bar
        let symplaToken: string;
        try {
          symplaToken = await getSymplaTokenFromDB(supabase, bar.id);
        } catch (tokenError) {
          console.log(`⚠️ Token Sympla não encontrado para ${bar.nome}, pulando...`);
          resultadosPorBar.push({ bar_id: bar.id, bar_nome: bar.nome, success: false, error: 'Token não encontrado' });
          continue;
        }
        
        console.log(`🔍 Buscando eventos para ${bar.nome}...`);
        const todosEventos = await buscarTodosEventos(symplaToken);
        
        // Filtrar eventos por nome (opcional) e período
        const eventosParaSincronizar = todosEventos.filter((evento: any) => {
          const temNomeCorreto = !filtro_eventos || 
            (evento.name && evento.name.toLowerCase().includes(filtro_eventos.toLowerCase()));
          if (!temNomeCorreto || !evento.start_date) return false;
          const dataEvento = new Date(evento.start_date);
          return dataEvento >= dataInicioPeriodo && dataEvento <= dataFimPeriodo;
        });

        console.log(`🎯 ${eventosParaSincronizar.length} eventos encontrados para ${bar.nome}`);
        
        if (eventosParaSincronizar.length === 0) {
          resultadosPorBar.push({ bar_id: bar.id, bar_nome: bar.nome, success: true, eventos: 0 });
          continue;
        }

        // Inserir eventos no banco
        await inserirEventos(supabase, eventosParaSincronizar, bar.id);

        let totalParticipantes = 0;
        let totalPedidos = 0;
        let totalCheckins = 0;
        let totalValorBruto = 0;
        let totalValorLiquido = 0;
        let eventosComErro = 0;
        
        for (let i = 0; i < eventosParaSincronizar.length; i++) {
          const evento = eventosParaSincronizar[i];
          
          try {
            await registrarLogSync(supabase, evento.id, 'evento', 'processando', { nome_evento: evento.name });
            
            // 🗑️ DELETAR participantes e pedidos antigos para garantir dados atualizados
            console.log(`🗑️ Deletando dados antigos do evento ${evento.id}...`);
            
            const { error: deletePartError } = await supabase
              .from('sympla_participantes')
              .delete()
              .eq('evento_sympla_id', evento.id)
              .eq('bar_id', bar.id);
            
            if (deletePartError) {
              console.warn(`⚠️ Erro ao deletar participantes: ${deletePartError.message}`);
            } else {
              console.log(`✅ Participantes deletados`);
            }
            
            const { error: deletePedError } = await supabase
              .from('sympla_pedidos')
              .delete()
              .eq('evento_sympla_id', evento.id)
              .eq('bar_id', bar.id);
            
            if (deletePedError) {
              console.warn(`⚠️ Erro ao deletar pedidos: ${deletePedError.message}`);
            } else {
              console.log(`✅ Pedidos deletados`);
            }
            
            // Buscar dados atualizados da API
            const participantesEvento = await buscarTodosParticipantes(evento.id, symplaToken);
            totalParticipantes += participantesEvento.length;
            const checkinsEvento = participantesEvento.filter((p: any) => p.checkin?.check_in === true).length;
            totalCheckins += checkinsEvento;
            
            console.log(`📊 Evento ${evento.name}: ${participantesEvento.length} participantes, ${checkinsEvento} checkins`);
            
            if (participantesEvento.length > 0) {
              await inserirParticipantes(supabase, evento.id, participantesEvento, bar.id);
            }
            
            const pedidosEvento = await buscarTodosPedidos(evento.id, symplaToken);
            totalPedidos += pedidosEvento.length;
            
            pedidosEvento.forEach((pedido: any) => {
              totalValorBruto += parseFloat(pedido.order_total_sale_price || '0');
              totalValorLiquido += parseFloat(pedido.order_total_net_value || '0');
            });
            
            if (pedidosEvento.length > 0) {
              await inserirPedidos(supabase, evento.id, pedidosEvento, bar.id);
            }
            
          } catch (error) {
            eventosComErro++;
            console.error(`❌ Erro evento ${evento.id}:`, error);
          }
        }
        
        // Atualizar eventos_base
        try {
          await supabase.rpc('update_eventos_base_with_sympla_yuzer', {
            p_bar_id: bar.id,
            p_data_inicio: dataInicioStr,
            p_data_fim: dataFimStr
          });
        } catch (e) { console.warn('⚠️ Erro ao atualizar eventos_base'); }
        
        console.log(`✅ ${bar.nome}: ${eventosParaSincronizar.length} eventos, ${totalParticipantes} participantes, ${totalPedidos} pedidos`);
        
        resultadosPorBar.push({
          bar_id: bar.id,
          bar_nome: bar.nome,
          success: true,
          eventos: eventosParaSincronizar.length,
          participantes: totalParticipantes,
          pedidos: totalPedidos,
          checkins: totalCheckins,
          valor_bruto: totalValorBruto,
          valor_liquido: totalValorLiquido,
          erros: eventosComErro
        });
        
        totalGeralEventos += eventosParaSincronizar.length;
        totalGeralParticipantes += totalParticipantes;
        totalGeralPedidos += totalPedidos;
        
      } catch (barError) {
        const errorMsg = barError instanceof Error ? barError.message : String(barError);
        console.error(`❌ Erro ao processar ${bar.nome}:`, errorMsg);
        resultadosPorBar.push({ bar_id: bar.id, bar_nome: bar.nome, success: false, error: errorMsg });
      }
    }
    // ====== FIM DO LOOP ======

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 RESUMO GERAL - TODOS OS BARES`);
    console.log(`   🏪 Bares processados: ${baresParaProcessar.length}`);
    console.log(`   🎪 Total eventos: ${totalGeralEventos}`);
    console.log(`   👥 Total participantes: ${totalGeralParticipantes}`);
    console.log(`   💰 Total pedidos: ${totalGeralPedidos}`);
    console.log(`${'='.repeat(60)}`);

    return Response.json({
      success: true,
      message: `Sympla sync concluído: ${baresParaProcessar.length} bar(es), ${totalGeralEventos} eventos`,
      bares_processados: baresParaProcessar.length,
      resultados_por_bar: resultadosPorBar,
      totais: {
        eventos: totalGeralEventos,
        participantes: totalGeralParticipantes,
        pedidos: totalGeralPedidos
      },
      periodo: { data_inicio: dataInicioStr, data_fim: dataFimStr }
    }, { headers: corsHeaders });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('💥 Erro na sincronização Sympla:', error);

    return Response.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { 
      status: 500,
      headers: corsHeaders 
    });
  }
});

