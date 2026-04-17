import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ContaHubCredentials {
  username: string;
  password: string;
  base_url: string;
  empresa_id: string | null;
}

async function getContaHubCredentials(barId: number): Promise<ContaHubCredentials> {
  const { data, error } = await supabase
    .from('api_credentials')
    .select('username, password, base_url, empresa_id')
    .eq('sistema', 'contahub')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .single();

  if (error || !data) {
    throw new Error('Credenciais do ContaHub não encontradas');
  }

  return data;
}

// Função para extrair o ID da empresa do username (formato: usuario@empresa)
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
  
  // Fallback: lançar erro pois não temos o ID da empresa
  throw new Error('ID da empresa não encontrado nas credenciais. Preencha empresa_id ou use formato usuario@empresa no username.');
}

async function fetchContaHubStockout(
  credentials: ContaHubCredentials,
  date: string,
  timestamp: string
): Promise<any> {
  // URL CORRETA para buscar produtos (não vendas!)
  const url = `${credentials.base_url}/rest/contahub.cmds.ProdutoCmd/getProdutos/${timestamp}`;
  
  // Extrair ID da empresa dinamicamente das credenciais
  const empresaId = getEmpresaId(credentials);
  
  const params = new URLSearchParams({
    emp: empresaId, // ID da empresa extraído das credenciais
    prd_desc: ' ', // Buscar todos os produtos
    grp: '-29', // Todos os grupos
    nfe: '1'
  });

  const response = await fetch(`${url}?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'User-Agent': 'SGB-Stockout-Monitor/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Erro na API ContaHub: ${response.status} - ${response.statusText}`);
  }

  return await response.json();
}

async function saveStockoutData(barId: number, date: string, hour: string, data: any[]): Promise<number> {
  // Filtrar produtos que não devem entrar no stockout
  // NOTA: 'baldes' como LOCAL contém cervejas individuais (deve entrar)
  // NOTA: 'Baldes' como GRUPO contém baldinhos promocionais (deve ser excluído)
  const termosExcluidos = ['happy hour', 'happyhour', 'happy-hour'];
  const locaisExcluidos = ['pegue e pague', 'venda volante']; // REMOVIDO 'baldes' - é local válido de cervejas
  const gruposExcluidos = ['baldes', 'happy hour', 'dose dupla', 'insumos', 'pegue e pague', 'uso interno'];
  
  const filteredData = data.filter(item => {
    const prdDesc = (item.prd_desc || '').toLowerCase();
    const locDesc = (item.loc_desc || '').toLowerCase();
    const grpDesc = (item.grp_desc || '').toLowerCase();
    
    // Excluir por nome do produto (mas não 'balde' genérico, apenas termos específicos)
    const excluirPorNome = termosExcluidos.some(termo => prdDesc.includes(termo));
    
    // Excluir por local de produção
    const excluirPorLocal = locaisExcluidos.some(local => locDesc.includes(local));
    
    // Excluir por grupo
    const excluirPorGrupo = gruposExcluidos.some(grupo => grpDesc.includes(grupo));
    
    return !excluirPorNome && !excluirPorLocal && !excluirPorGrupo;
  });

  const records = filteredData.map(item => ({
    bar_id: barId,
    data_consulta: date,
    hora_consulta: hour,
    
    // Mapear TODAS as colunas da API de produtos corretamente
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
  }));

  const { error } = await supabase
    .schema('gold')
    .from('gold_contahub_operacional_stockout')
    .upsert(records, {
      onConflict: 'bar_id,data_consulta,prd',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('Erro ao salvar dados de stockout:', error);
    throw new Error(`Erro ao salvar dados: ${error.message}`);
  }

  return records.length;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const hour = searchParams.get('hour') || '20:00:00';
    const barIdParam = searchParams.get('bar_id');
    
    if (!barIdParam) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }
    const barId = parseInt(barIdParam);

    // Buscar credenciais do ContaHub
    const credentials = await getContaHubCredentials(barId);

    // Criar timestamp para 20h do horário de Brasília
    const targetDateTime = new Date(`${date}T${hour}-03:00`);
    const timestamp = Math.floor(targetDateTime.getTime() / 1000).toString();

    // Buscar dados do ContaHub
    const stockoutData = await fetchContaHubStockout(credentials, date, timestamp);

    if (!stockoutData || !stockoutData.list) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum dado encontrado para o período especificado',
        data: {
          date,
          hour,
          records_found: 0,
          records_saved: 0
        }
      });
    }

    // Salvar dados no banco
    const recordsSaved = await saveStockoutData(barId, date, hour, stockoutData.list);

    return NextResponse.json({
      success: true,
      message: `Dados de stockout coletados com sucesso para ${date}`,
      data: {
        date,
        hour,
        timestamp,
        records_found: stockoutData.list.length,
        records_saved: recordsSaved,
        sample_data: stockoutData.list.slice(0, 3) // Primeiros 3 registros como amostra
      }
    });

  } catch (error) {
    console.error('❌ Erro na coleta de stockout:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { date, hour = '20:00:00', bar_id } = body;

    if (!bar_id) {
      return NextResponse.json({
        success: false,
        error: 'bar_id é obrigatório'
      }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({
        success: false,
        error: 'Data é obrigatória'
      }, { status: 400 });
    }

    // Buscar credenciais do ContaHub
    const credentials = await getContaHubCredentials(bar_id);

    // Criar timestamp para o horário especificado
    const targetDateTime = new Date(`${date}T${hour}-03:00`);
    const timestamp = Math.floor(targetDateTime.getTime() / 1000).toString();

    // Buscar dados do ContaHub
    const stockoutData = await fetchContaHubStockout(credentials, date, timestamp);

    if (!stockoutData || !stockoutData.list) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum dado encontrado para o período especificado',
        data: {
          date,
          hour,
          records_found: 0,
          records_saved: 0
        }
      });
    }

    // Salvar dados no banco
    const recordsSaved = await saveStockoutData(bar_id, date, hour, stockoutData.list);

    return NextResponse.json({
      success: true,
      message: `Dados de stockout coletados manualmente para ${date}`,
      data: {
        date,
        hour,
        timestamp,
        records_found: stockoutData.list.length,
        records_saved: recordsSaved,
        sample_data: stockoutData.list.slice(0, 5) // Primeiros 5 registros como amostra
      }
    });

  } catch (error) {
    console.error('❌ Erro na coleta manual de stockout:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
