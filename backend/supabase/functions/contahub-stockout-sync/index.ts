import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

console.log("­ƒôª ContaHub Stockout Sync - Controle de Estoque (Multi-Bar)");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generateDynamicTimestamp(): string {
  const now = new Date();
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}${String(now.getMilliseconds()).padStart(3, '0')}`;
}

// Fun├º├úo para enviar notifica├º├úo Discord
async function sendDiscordNotification(message: string, isError: boolean = false) {
  try {
    const webhookUrl = Deno.env.get('DISCORD_CONTAHUB_WEBHOOK');
    if (!webhookUrl) {
      console.log('ÔÜá´©Å Discord webhook n├úo configurado');
      return;
    }

    const embed = {
      title: isError ? 'ÔØî ContaHub Stockout - Erro' : '­ƒôª ContaHub Stockout',
      description: message,
      color: isError ? 15158332 : 3066993, // Vermelho ou Verde
      timestamp: new Date().toISOString(),
      footer: {
        text: 'SGB Stockout Control'
      }
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        embeds: [embed]
      })
    });

    if (!response.ok) {
      console.error('ÔØî Erro ao enviar notifica├º├úo Discord:', response.status, response.statusText);
    } else {
      console.log('­ƒôó Notifica├º├úo Discord enviada');
    }
  } catch (error) {
    console.error('ÔØî Erro ao enviar notifica├º├úo Discord:', error);
  }
}

// Interface para credenciais do ContaHub
interface ContaHubCredentials {
  username: string;
  password: string;
  base_url: string;
  empresa_id: string | null;
}

// Fun├º├úo para buscar credenciais do ContaHub do banco de dados
async function getContaHubCredentials(supabase: any, barId: number): Promise<ContaHubCredentials> {
  console.log(`­ƒöÉ Buscando credenciais do ContaHub para bar_id=${barId}...`);
  
  const { data, error } = await supabase
    .from('api_credentials')
    .select('username, password, base_url, empresa_id')
    .eq('sistema', 'contahub')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .single();

  if (error || !data) {
    console.error('ÔØî Erro ao buscar credenciais:', error);
    throw new Error(`Credenciais do ContaHub n├úo encontradas para bar_id=${barId}`);
  }

  console.log(`Ô£à Credenciais encontradas para bar_id=${barId}: ${data.username}`);
  return data;
}

// Fun├º├úo para extrair o ID da empresa do username (formato: usuario@empresa)
function getEmpresaId(credentials: ContaHubCredentials): string {
  // Prioridade 1: usar empresa_id se estiver preenchido
  if (credentials.empresa_id) {
    return credentials.empresa_id;
  }
  
  // Prioridade 2: extrair do username (formato: usuario@empresa)
  if (credentials.username && credentials.username.includes('@')) {
    const empresaId = credentials.username.split('@')[1];
    if (empresaId) {
      return empresaId;
    }
  }
  
  // Fallback: lan├ºar erro pois n├úo temos o ID da empresa
  throw new Error('ID da empresa n├úo encontrado nas credenciais. Preencha empresa_id ou use formato usuario@empresa no username.');
}

// Fun├º├úo de login no ContaHub
async function loginContaHub(credentials: ContaHubCredentials): Promise<string> {
  console.log(`­ƒöÉ Fazendo login no ContaHub com ${credentials.username}...`);
  
  const encoder = new TextEncoder();
  const data = encoder.encode(credentials.password);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordSha1 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  const loginData = new URLSearchParams({
    "usr_email": credentials.username,
    "usr_password_sha1": passwordSha1
  });
  
  const loginTimestamp = generateDynamicTimestamp();
  
  // Usar a base_url das credenciais
  const baseUrl = credentials.base_url.replace('/api', ''); // Remover /api se existir
  const loginUrl = `${baseUrl}/rest/contahub.cmds.UsuarioCmd/login/${loginTimestamp}?emp=0`;
  
  console.log(`­ƒöù URL de login: ${loginUrl}`);
  
  const loginResponse = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    },
    body: loginData,
  });
  
  if (!loginResponse.ok) {
    throw new Error(`Erro no login ContaHub: ${loginResponse.statusText}`);
  }
  
  const setCookieHeaders = loginResponse.headers.get('set-cookie');
  if (!setCookieHeaders) {
    throw new Error('Cookies de sess├úo n├úo encontrados no login');
  }
  
  console.log('Ô£à Login ContaHub realizado com sucesso');
  return setCookieHeaders;
}

// Fun├º├úo para fazer requisi├º├Áes ao ContaHub
async function fetchContaHubData(url: string, sessionToken: string) {
  console.log(`­ƒöù Fazendo requisi├º├úo: ${url}`);
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Cookie': sessionToken,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json'
    },
  });
  
  if (!response.ok) {
    throw new Error(`Erro na requisi├º├úo ContaHub: ${response.statusText}`);
  }
  
  const responseText = await response.text();
  
  // Log detalhado da resposta
  console.log('­ƒôÑ Resposta ContaHub (primeiros 200 chars):', responseText.substring(0, 200));
  console.log('­ƒôÅ Tamanho da resposta:', responseText.length);
  
  // Limpar poss├¡veis caracteres invis├¡veis no in├¡cio
  const cleanedText = responseText.trim().replace(/^\uFEFF/, ''); // Remove BOM se existir
  
  try {
    return JSON.parse(cleanedText);
  } catch (parseError) {
    console.error('ÔØî Erro ao fazer parse da resposta ContaHub:', parseError);
    console.error('­ƒôÑ Resposta original:', responseText);
    console.error('­ƒôÑ Resposta limpa:', cleanedText);
    throw new Error(`Erro no parsing da resposta ContaHub: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
  }
}

// Fun├º├úo para processar dados de stockout do ContaHub
async function processStockoutData(supabase: any, rawData: any, dataDate: string, barId: number) {
  console.log('­ƒôª Processando dados de stockout...');
  
  if (!rawData?.list || !Array.isArray(rawData.list)) {
    console.log('ÔÜá´©Å Nenhum dado de produto encontrado');
    return { processed: 0, errors: 0, skipped: 0 };
  }

  let processed = 0;
  let errors = 0;
  let skipped = 0;
  const stockoutRecords = [];

  // Lista de prefixos a serem excluídos do stockout
  // [HH] = Happy Hour (não disponíveis às 20h)
  // [DD] = Dose Dupla (variações que não devem contar)
  // [IN] = Insumos (não são produtos vendáveis)
  const prefixosExcluidos = ['[HH]', '[DD]', '[IN]'];

  for (const item of rawData.list) {
    // Verificar se o produto deve ser excluído por prefixo
    const prdDesc = item.prd_desc || '';
    const shouldExclude = prefixosExcluidos.some(prefixo => prdDesc.startsWith(prefixo));
    
    if (shouldExclude) {
      console.log(`⏭️ Pulando produto: ${item.prd_desc}`);
      skipped++;
      continue;
    }
    try {
      // Mapear TODAS as colunas da API corretamente
      const stockoutRecord = {
        bar_id: barId,
        data_consulta: dataDate,
        hora_consulta: '20:00:00',
        
        // Dados principais da API
        emp: item.emp || null,
        prd: item.prd || null,
        loc: item.loc || null,
        prd_desc: item.prd_desc || null,
        prd_venda: item.prd_venda || null, // CAMPO PRINCIPAL - "S" ou "N"
        prd_ativo: item.prd_ativo || null,
        prd_produzido: item.prd_produzido || null,
        prd_unid: item.prd_unid || null,
        prd_precovenda: item.prd_precovenda || null,
        prd_estoque: item.prd_estoque || null,
        prd_controlaestoque: item.prd_controlaestoque || null,
        prd_validaestoquevenda: item.prd_validaestoquevenda || null,
        prd_opcoes: item.prd_opcoes || null,
        prd_venda7: item.prd_venda7 || null,
        prd_venda30: item.prd_venda30 || null,
        prd_venda180: item.prd_venda180 || null,
        prd_nfencm: item.prd_nfencm || null,
        prd_nfeorigem: item.prd_nfeorigem || null,
        prd_nfecsosn: item.prd_nfecsosn || null,
        prd_nfecstpiscofins: item.prd_nfecstpiscofins || null,
        prd_nfepis: item.prd_nfepis || null,
        prd_nfecofins: item.prd_nfecofins || null,
        prd_nfeicms: item.prd_nfeicms || null,
        prd_qtddouble: item.prd_qtddouble || null,
        prd_disponivelonline: item.prd_disponivelonline || null,
        prd_cardapioonline: item.prd_cardapioonline || null,
        prd_semcustoestoque: item.prd_semcustoestoque || null,
        prd_balanca: item.prd_balanca || null,
        prd_delivery: item.prd_delivery || null,
        prd_entregaimediata: item.prd_entregaimediata || null,
        prd_semrepique: item.prd_semrepique || null,
        prd_naoimprimeproducao: item.prd_naoimprimeproducao || null,
        prd_agrupaimpressao: item.prd_agrupaimpressao || null,
        prd_contagemehperda: item.prd_contagemehperda || null,
        prd_naodesmembra: item.prd_naodesmembra || null,
        prd_naoimprimeficha: item.prd_naoimprimeficha || null,
        prd_servico: item.prd_servico || null,
        prd_zeraestoquenacompra: item.prd_zeraestoquenacompra || null,
        loc_desc: item.loc_desc || null,
        loc_inativo: item.loc_inativo || null,
        loc_statusimpressao: item.loc_statusimpressao || null,
        
        // Dados completos do JSON original
        raw_data: item,
        
        // Timestamps
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      stockoutRecords.push(stockoutRecord);
      processed++;

    } catch (error) {
      console.error('ÔØî Erro ao processar item:', error, item);
      errors++;
    }
  }

  // Salvar todos os registros de uma vez
  if (stockoutRecords.length > 0) {
    const { data, error } = await supabase
      .from('contahub_stockout')
      .insert(stockoutRecords);

    if (error) {
      console.error('ÔØî Erro ao salvar dados de stockout:', error);
      throw new Error(`Erro ao salvar stockout: ${error.message}`);
    }

    console.log(`Ô£à ${stockoutRecords.length} registros de stockout salvos`);
  }

  console.log(`­ƒôè Produtos Happy Hour exclu├¡dos: ${skipped}`);
  return { processed, errors, skipped };
}


Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const requestBody = await req.text();
    console.log('­ƒôÑ Body recebido:', requestBody);
    
    let parsedBody: { bar_id?: number; data_date?: string } = {};
    try {
      if (requestBody && requestBody.trim() !== '') {
        parsedBody = JSON.parse(requestBody);
      }
    } catch (jsonError) {
      console.error('ÔØî Erro ao fazer parse do JSON:', jsonError);
      throw new Error(`Erro no parsing do JSON: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
    }
    
    const { bar_id, data_date } = parsedBody;
    
    if (!bar_id || !data_date) {
      throw new Error('bar_id e data_date s├úo obrigat├│rios');
    }
    
    console.log(`­ƒÄ» Coletando STOCKOUT para bar_id=${bar_id}, data=${data_date}`);
    
    // Configurar Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Vari├íveis do Supabase n├úo encontradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Buscar credenciais do ContaHub para o bar espec├¡fico
    const credentials = await getContaHubCredentials(supabase, bar_id);
    
    // Extrair ID da empresa das credenciais
    const empresaId = getEmpresaId(credentials);
    
    console.log(`­ƒÅ¬ Bar ID: ${bar_id}`);
    console.log(`­ƒÅó Empresa ID: ${empresaId}`);
    console.log(`­ƒöù Base URL: ${credentials.base_url}`);
    
    // Enviar notifica├º├úo de in├¡cio
    await sendDiscordNotification(`­ƒÜÇ **Iniciando coleta Stockout**\n\n­ƒôè **Data:** ${data_date}\n­ƒÅ¬ **Bar ID:** ${bar_id}\n­ƒÅó **Empresa:** ${empresaId}\nÔÅ░ **In├¡cio:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    
    // Login no ContaHub
    const sessionToken = await loginContaHub(credentials);
    
    // Gerar timestamp din├ómico
    const queryTimestamp = generateDynamicTimestamp();
    
    // Usar a base_url das credenciais
    const baseUrl = credentials.base_url.replace('/api', ''); // Remover /api se existir
    
    // URL para buscar produtos (API correta) - usando empresaId din├ómico
    const url = `${baseUrl}/rest/contahub.cmds.ProdutoCmd/getProdutos/${queryTimestamp}?emp=${empresaId}&prd_desc=%20&grp=-29&nfe=1`;
    
    console.log(`­ƒöù URL Produtos: ${url}`);
    
    // Buscar dados do ContaHub
    const rawData = await fetchContaHubData(url, sessionToken);
    
    console.log(`­ƒôè Dados recebidos do ContaHub: ${rawData?.list?.length || 0} produtos`);
    
    // Limpar dados existentes para esta data
    console.log(`­ƒº╣ Removendo dados existentes para bar_id=${bar_id}, data=${data_date}...`);
    const { error: deleteError } = await supabase
      .from('contahub_stockout')
      .delete()
      .eq('bar_id', bar_id)
      .eq('data_consulta', data_date);
    
    if (deleteError) {
      console.error('ÔØî Erro ao limpar dados existentes:', deleteError);
      throw new Error(`Erro ao limpar dados: ${deleteError.message}`);
    }
    
    // Processar e salvar dados
    const result = await processStockoutData(supabase, rawData, data_date, bar_id);
    
    // Calcular estatísticas (excluindo [HH], [DD] e [IN])
    const prefixosExcluidosStats = ['[HH]', '[DD]', '[IN]'];
    const produtosFiltrados = rawData?.list?.filter((item: any) => {
      const prdDesc = item.prd_desc || '';
      return !prefixosExcluidosStats.some(prefixo => prdDesc.startsWith(prefixo));
    }) || [];
    
    const totalProdutos = produtosFiltrados.length;
    const produtosAtivos = produtosFiltrados.filter((item: any) => item.prd_venda === "S").length;
    const produtosInativos = totalProdutos - produtosAtivos;
    const percentualStockout = totalProdutos > 0 ? ((produtosInativos / totalProdutos) * 100).toFixed(2) : '0.00';
    
    // Resultado final
    const summary = {
      bar_id,
      empresa_id: empresaId,
      data_date,
      data_type: 'stockout',
      total_produtos: totalProdutos,
      produtos_ativos: produtosAtivos,
      produtos_inativos: produtosInativos,
      percentual_stockout: `${percentualStockout}%`,
      registros_processados: result.processed,
      produtos_happy_hour_excluidos: result.skipped,
      erros: result.errors,
      processamento_completo: true
    };
    
    console.log('\n­ƒôè RESUMO STOCKOUT:');
    console.log(`- Bar ID: ${bar_id}`);
    console.log(`- Empresa ID: ${empresaId}`);
    console.log(`- Data: ${data_date}`);
    console.log(`- Total produtos: ${summary.total_produtos}`);
    console.log(`- Produtos ativos: ${summary.produtos_ativos}`);
    console.log(`- Produtos inativos: ${summary.produtos_inativos}`);
    console.log(`- % Stockout: ${summary.percentual_stockout}`);
    console.log(`- Registros processados: ${summary.registros_processados}`);
    
    // Notifica├º├úo de sucesso
    const successMessage = `Ô£à **Stockout processado com sucesso**\n\n­ƒÅ¬ **Bar ID:** ${bar_id}\n­ƒÅó **Empresa:** ${empresaId}\n\n­ƒôè **Resultados:**\nÔÇó Total produtos: ${summary.total_produtos}\nÔÇó Produtos ativos: ${summary.produtos_ativos}\nÔÇó Produtos inativos: ${summary.produtos_inativos}\nÔÇó % Stockout: ${summary.percentual_stockout}\n\nÔÅ░ **Fim:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
    await sendDiscordNotification(successMessage);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Stockout coletado e processado completamente',
      summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
    
  } catch (error) {
    console.error('ÔØî Erro geral:', error);
    
    // Enviar notifica├º├úo de erro cr├¡tico
    const errorMessage = `ÔØî **Erro na coleta Stockout**\n\nÔÅ░ **Tempo:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n­ƒÜ¿ **Erro:** ${error instanceof Error ? error.message : String(error)}`;
    await sendDiscordNotification(errorMessage, true);
  
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  } 
});
