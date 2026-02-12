import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NIBO_BASE_URL = 'https://api.nibo.com.br/empresas/v1';

// Buscar credenciais do NIBO para um bar
async function getNiboCredentials(barId: number = 3) {
  const { data: credencial, error } = await supabase
    .from('api_credentials')
    .select('api_token, empresa_id')
    .eq('sistema', 'nibo')
    .eq('bar_id', barId)
    .eq('ativo', true)
    .single();

  if (error || !credencial?.api_token) {
    return null;
  }

  return credencial;
}

// GET - Buscar lançamentos retroativos (criados após X com competência antes de Y)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '3');
    const criadoApos = searchParams.get('criado_apos'); // Data mínima de criação (createDate)
    const competenciaAntes = searchParams.get('competencia_antes'); // Data máxima de competência (accrualDate)
    let competenciaApos = searchParams.get('competencia_apos'); // Data mínima de competência (opcional)
    const criadoAntes = searchParams.get('criado_antes'); // Data máxima de criação (opcional)
    const mesesRetroativos = parseFloat(searchParams.get('meses_retroativos') || '3'); // Limite de meses (0.25 = 1 semana, 0.5 = 2 semanas, 1 = 1 mês)
    const categorias = searchParams.get('categorias'); // Filtro de categorias (separadas por vírgula)

    console.log(`[NIBO-CONSULTAS] Buscando lançamentos retroativos, bar_id=${barId}`);
    console.log(`[NIBO-CONSULTAS] Filtros: criado_apos=${criadoApos}, competencia_antes=${competenciaAntes}, categorias=${categorias}`);

    if (!criadoApos || !competenciaAntes) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Parâmetros obrigatórios: criado_apos e competencia_antes' 
        },
        { status: 400 }
      );
    }

    const credencial = await getNiboCredentials(barId);
    
    if (!credencial) {
      return NextResponse.json(
        { success: false, error: 'Credenciais NIBO não encontradas para este bar' },
        { status: 400 }
      );
    }

    // OTIMIZAÇÃO: Se competencia_apos não foi informado, limitar automaticamente aos últimos X meses/semanas
    // Isso evita buscar TODO o histórico da empresa e torna a consulta muito mais rápida
    let limiteAplicado = false;
    if (!competenciaApos) {
      const competenciaAntesDate = new Date(competenciaAntes);
      const limiteInferior = new Date(competenciaAntesDate);
      
      // Suportar frações de mês (0.25 = 1 semana, 0.5 = 2 semanas, 1 = 1 mês)
      const diasParaSubtrair = Math.round(mesesRetroativos * 30);
      limiteInferior.setDate(limiteInferior.getDate() - diasParaSubtrair);
      
      competenciaApos = limiteInferior.toISOString().split('T')[0];
      limiteAplicado = true;
      
      const periodoLabel = mesesRetroativos < 1 
        ? `${Math.round(mesesRetroativos * 4)} semana(s)` 
        : `${mesesRetroativos} mês(es)`;
      console.log(`[NIBO-CONSULTAS] OTIMIZAÇÃO: Aplicado limite de ${periodoLabel} (${diasParaSubtrair} dias). competencia_apos=${competenciaApos}`);
    }

    // Buscar schedules da API NIBO com paginação PARALELA para máxima velocidade
    const allSchedules: any[] = [];
    const top = 200;
    const maxPages = 15; // Reduzido para 15 páginas (3.000 registros máx)
    const parallelBatch = 4; // Buscar 4 páginas em paralelo

    // Montar filtro OData para competência - SEMPRE com limite inferior
    const odataFilter = `accrualDate lt ${competenciaAntes}T00:00:00Z and accrualDate ge ${competenciaApos}T00:00:00Z`;

    console.log(`[NIBO-CONSULTAS] Filtro OData: ${odataFilter}`);

    // Função para buscar uma página específica
    const fetchPage = async (skip: number): Promise<any[]> => {
      const url = new URL(`${NIBO_BASE_URL}/schedules`);
      url.searchParams.set('apitoken', credencial.api_token);
      url.searchParams.set('$filter', odataFilter);
      url.searchParams.set('$orderby', 'createDate desc');
      url.searchParams.set('$top', top.toString());
      url.searchParams.set('$skip', skip.toString());

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'apitoken': credencial.api_token
        }
      });

      if (!response.ok) {
        console.error('[NIBO-CONSULTAS] Erro página skip=' + skip);
        return [];
      }

      const data = await response.json();
      return data?.items || [];
    };

    // Buscar páginas em lotes paralelos
    let pageCount = 0;
    let hasMore = true;

    while (hasMore && pageCount < maxPages) {
      // Criar batch de requisições paralelas
      const batchPromises: Promise<any[]>[] = [];
      const batchStart = pageCount;
      
      for (let i = 0; i < parallelBatch && (pageCount + i) < maxPages; i++) {
        const skip = (batchStart + i) * top;
        batchPromises.push(fetchPage(skip));
      }

      console.log(`[NIBO-CONSULTAS] Buscando ${batchPromises.length} páginas em paralelo (${pageCount + 1}-${pageCount + batchPromises.length})...`);
      
      // Executar todas as requisições em paralelo
      const results = await Promise.all(batchPromises);
      
      // Processar resultados
      let totalItemsInBatch = 0;
      for (const items of results) {
        if (items.length > 0) {
          allSchedules.push(...items);
          totalItemsInBatch += items.length;
        }
      }

      pageCount += batchPromises.length;
      console.log(`[NIBO-CONSULTAS] Batch concluído: ${totalItemsInBatch} registros (total: ${allSchedules.length})`);

      // Verificar se deve continuar (se alguma página veio vazia ou incompleta)
      const lastResult = results[results.length - 1];
      if (!lastResult || lastResult.length < top) {
        hasMore = false;
      }
    }

    console.log(`[NIBO-CONSULTAS] Total de registros da API: ${allSchedules.length} (${pageCount} páginas)`);

    // Filtrar por createDate (data de criação) e categorias no código
    // A API NIBO pode não suportar filtro por createDate no OData
    const criadoAposDate = new Date(criadoApos + 'T00:00:00Z');
    const criadoAntesDate = criadoAntes ? new Date(criadoAntes + 'T23:59:59Z') : null;
    
    // Preparar lista de categorias para filtro (case-insensitive, normalizado)
    const normalizar = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const categoriasLista = categorias 
      ? categorias.split(',').map(c => normalizar(c)).filter(Boolean)
      : null;

    const matchCategoria = (categoriaNome: string, cat: string) => {
      const n = normalizar(categoriaNome);
      if (!n || !cat) return false;
      if (n === cat) return true;
      if (n.includes(cat)) return true;  // "Custo Bebidas" inclui "custo bebidas"
      if (cat.includes(n)) return true;  // "bebidas" é parte de "custo bebidas" - match parcial
      return false;
    };

    // CMV = apenas despesas (type=Debit). Receitas (type=Credit) devem ser excluídas.
    const isFiltroCusto = categoriasLista?.some(c => normalizar(c).includes('custo')) ?? false;

    const lancamentosRetroativos = allSchedules.filter(schedule => {
      if (!schedule.createDate) return false;
      
      const createDate = new Date(schedule.createDate);
      
      if (createDate < criadoAposDate) return false;
      if (criadoAntesDate && createDate > criadoAntesDate) return false;

      // Ao filtrar CMV/custos: excluir receitas - só despesas (Debit)
      const tipoSchedule = String(schedule.type || '').toLowerCase();
      const tipoCategoria = String((schedule.category as any)?.type || '').toLowerCase();
      if (isFiltroCusto) {
        if (tipoSchedule === 'credit' || tipoCategoria === 'income' || tipoCategoria === 'receita') return false;
      }

      if (categoriasLista && categoriasLista.length > 0) {
        const categoriaNome = schedule.category?.name || '';
        if (!categoriasLista.some(cat => matchCategoria(categoriaNome, cat))) {
          return false;
        }
      }

      return true;
    });
    
    console.log(`[NIBO-CONSULTAS] Filtro categorias: ${categoriasLista?.length || 0} categorias`);

    console.log(`[NIBO-CONSULTAS] Lançamentos retroativos encontrados: ${lancamentosRetroativos.length}`);

    // Formatar dados para resposta
    const resultado = lancamentosRetroativos.map(schedule => ({
      id: schedule.scheduleId,
      tipo: schedule.type,
      status: schedule.isPaid ? 'Pago' : 'Pendente',
      valor: Math.abs(schedule.value || 0),
      valorPago: Math.abs(schedule.paidValue || 0),
      
      // Datas importantes
      dataCompetencia: schedule.accrualDate?.split('T')[0] || null,
      dataVencimento: schedule.dueDate?.split('T')[0] || null,
      dataCriacao: schedule.createDate || null,
      dataAtualizacao: schedule.updateDate || null,
      
      // Quem criou/atualizou
      criadoPor: schedule.createUser || null,
      atualizadoPor: schedule.updateUser || null,
      
      // Detalhes
      descricao: schedule.description || '',
      referencia: schedule.reference || '',
      
      // Categoria
      categoriaId: schedule.category?.id || null,
      categoriaNome: schedule.category?.name || null,
      categoriaTipo: schedule.category?.type || null,
      
      // Stakeholder (fornecedor/cliente)
      stakeholderId: schedule.stakeholder?.id || null,
      stakeholderNome: schedule.stakeholder?.name || null,
      stakeholderTipo: schedule.stakeholder?.type || null,
      
      // Centro de custo
      centrosCusto: schedule.costCenters || [],
      
      // Flags
      isPaid: schedule.isPaid || false,
      isDued: schedule.isDued || false,
      isFlagged: schedule.isFlagged || false,
      hasInstallment: schedule.hasInstallment || false,
      hasRecurrence: schedule.hasRecurrence || false
    }));

    // Ordenar por data de criação (mais recente primeiro)
    resultado.sort((a, b) => {
      const dateA = new Date(a.dataCriacao || 0);
      const dateB = new Date(b.dataCriacao || 0);
      return dateB.getTime() - dateA.getTime();
    });

    // Calcular estatísticas
    const estatisticas = {
      total: resultado.length,
      totalPagos: resultado.filter(r => r.isPaid).length,
      totalPendentes: resultado.filter(r => !r.isPaid).length,
      valorTotal: resultado.reduce((sum, r) => sum + r.valor, 0),
      valorPago: resultado.reduce((sum, r) => sum + r.valorPago, 0),
      valorPendente: resultado.reduce((sum, r) => sum + (r.isPaid ? 0 : r.valor), 0),
      
      // Por usuário
      porUsuario: resultado.reduce((acc, r) => {
        const user = r.criadoPor || 'Não identificado';
        if (!acc[user]) {
          acc[user] = { count: 0, valor: 0 };
        }
        acc[user].count++;
        acc[user].valor += r.valor;
        return acc;
      }, {} as Record<string, { count: number; valor: number }>),
      
      // Por categoria
      porCategoria: resultado.reduce((acc, r) => {
        const cat = r.categoriaNome || 'Sem categoria';
        if (!acc[cat]) {
          acc[cat] = { count: 0, valor: 0 };
        }
        acc[cat].count++;
        acc[cat].valor += r.valor;
        return acc;
      }, {} as Record<string, { count: number; valor: number }>)
    };

    return NextResponse.json({
      success: true,
      filtros: {
        criadoApos,
        criadoAntes: criadoAntes || null,
        competenciaAntes,
        competenciaApos: competenciaApos || null,
        barId,
        mesesRetroativos,
        limiteAutoAplicado: limiteAplicado,
        categorias: categoriasLista || null,
        filtroCategoriasAplicado: categoriasLista !== null && categoriasLista.length > 0
      },
      estatisticas,
      data: resultado,
      total: resultado.length,
      paginasConsultadas: pageCount,
      registrosApiOriginal: allSchedules.length
    });

  } catch (error) {
    console.error('[NIBO-CONSULTAS] Erro:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro interno ao buscar lançamentos' 
      },
      { status: 500 }
    );
  }
}
