import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { paginate } from '@/lib/supabase/paginate';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFinanceiro } from '@/lib/auth/financeiro-guard';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!;

const CONTA_AZUL_API_URL = 'https://api-v2.contaazul.com';

function getSupabaseAdmin() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getCAToken(barId: number): Promise<{ token: string } | { error: string; status: number }> {
  const supabase = getSupabaseAdmin();
  const { data: credentials, error: credError } = await supabase
    .from('api_credentials')
    .select('access_token, expires_at')
    .eq('sistema', 'conta_azul')
    .eq('bar_id', barId)
    .single();

  if (credError || !credentials?.access_token) {
    return { error: 'Credenciais do Conta Azul não encontradas', status: 404 };
  }
  if (credentials.expires_at && new Date(credentials.expires_at) < new Date()) {
    return { error: 'Token CA expirado. Reconecte o Conta Azul.', status: 401 };
  }
  return { token: credentials.access_token };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barId = searchParams.get('bar_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const tipo = searchParams.get('tipo');
    const status = searchParams.get('status');
    const dataVencimentoDe = searchParams.get('data_vencimento_de');
    const dataVencimentoAte = searchParams.get('data_vencimento_ate');
    const dataCompetenciaDe = searchParams.get('data_competencia_de');
    const dataCompetenciaAte = searchParams.get('data_competencia_ate');
    const categoriaId = searchParams.get('categoria_id');
    const centroCustoId = searchParams.get('centro_custo_id');
    const busca = searchParams.get('busca');
    const sortColumn = searchParams.get('sort_column') || 'data_vencimento';
    const sortDirection = searchParams.get('sort_direction') || 'desc';

    if (!barId) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const offset = (page - 1) * limit;

    let query = supabase
      .schema('bronze' as any)
      .from('bronze_contaazul_lancamentos')
      .select('*', { count: 'exact' })
      .eq('bar_id', parseInt(barId))
      .is('excluido_em', null);

    if (tipo) query = query.eq('tipo', tipo);
    if (status) query = query.eq('status', status);
    if (dataVencimentoDe) query = query.gte('data_vencimento', dataVencimentoDe);
    if (dataVencimentoAte) query = query.lte('data_vencimento', dataVencimentoAte);
    if (dataCompetenciaDe) query = query.gte('data_competencia', dataCompetenciaDe);
    if (dataCompetenciaAte) query = query.lte('data_competencia', dataCompetenciaAte);
    if (categoriaId) query = query.eq('categoria_id', categoriaId);
    if (centroCustoId) query = query.eq('centro_custo_id', centroCustoId);
    if (busca) {
      query = query.or(`descricao.ilike.%${busca}%,pessoa_nome.ilike.%${busca}%`);
    }

    query = query.order(sortColumn, { ascending: sortDirection === 'asc' });
    query = query.range(offset, offset + limit - 1);

    const { data: lancamentos, error, count } = await query;

    if (error) {
      console.error('Erro ao buscar lançamentos:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // PAGINADO: queryTotais agrega TODOS os filtrados pra calcular totalizadores.
    // Sem paginacao, truncava a 1000 rows -> total_bruto/total_pago errados.
    const todosLancamentos = await paginate<any>(
      () => {
        let q = supabase
          .schema('bronze' as any)
          .from('bronze_contaazul_lancamentos')
          .select('valor_bruto, valor_pago, status, tipo')
          .eq('bar_id', parseInt(barId))
          .is('excluido_em', null)
          .order('id'); // ORDER estavel pra paginacao
        if (tipo) q = q.eq('tipo', tipo);
        if (status) q = q.eq('status', status);
        if (dataVencimentoDe) q = q.gte('data_vencimento', dataVencimentoDe);
        if (dataVencimentoAte) q = q.lte('data_vencimento', dataVencimentoAte);
        if (dataCompetenciaDe) q = q.gte('data_competencia', dataCompetenciaDe);
        if (dataCompetenciaAte) q = q.lte('data_competencia', dataCompetenciaAte);
        if (categoriaId) q = q.eq('categoria_id', categoriaId);
        if (centroCustoId) q = q.eq('centro_custo_id', centroCustoId);
        if (busca) q = q.or(`descricao.ilike.%${busca}%,pessoa_nome.ilike.%${busca}%`);
        return q;
      },
      { label: 'contaazul/lancamentos:totalizadores' },
    );

    const totalizadores = {
      total_bruto: 0,
      total_liquido: 0,
      total_pago: 0,
      valor_pendente: 0,
      count_receitas: 0,
      count_despesas: 0,
    };

    todosLancamentos.forEach((lanc: any) => {
      const valor = parseFloat(lanc.valor_bruto || 0);
      const pago = parseFloat(lanc.valor_pago || 0);

      totalizadores.total_bruto += valor;
      totalizadores.total_pago += pago;
      // Nota: total_bruto/total_pago aqui sao separados intencionalmente — UI exibe os dois.
      // Em outros lugares (CMV, CMO, DRE) usamos valor_pago>0?pago:bruto pra bater com CA.

      if (lanc.tipo === 'RECEITA') {
        totalizadores.count_receitas++;
      } else {
        totalizadores.count_despesas++;
      }

      if (lanc.status !== 'ACQUITTED') {
        totalizadores.valor_pendente += (valor - pago);
      }
    });

    return NextResponse.json({
      lancamentos: lancamentos || [],
      total: count || 0,
      page,
      limit,
      totalizadores,
    });
  } catch (err) {
    console.error('Erro ao buscar lançamentos:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

/**
 * POST: cria conta a pagar (DESPESA) no Conta Azul.
 *
 * Body:
 * {
 *   bar_id: number,
 *   data_competencia: 'YYYY-MM-DD',
 *   data_vencimento: 'YYYY-MM-DD',
 *   valor: number,
 *   descricao: string,
 *   observacao?: string,
 *   categoria_id: string (UUID CA),
 *   centro_custo_id?: string (UUID CA),
 *   conta_financeira_id?: string (UUID CA — se omitido, usa conta_padrao do bar),
 *   cpf_cnpj?: string (lookup fornecedor — alternativa a pessoa_id),
 *   pessoa_id?: string (UUID CA fornecedor — preferido)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // AUTENTICAÇÃO: cria conta a pagar real no Conta Azul — exige financeiro/admin.
    // bar_id vem do usuário autenticado (nunca do corpo).
    const user = await authenticateUser(request);
    if (!user) return authErrorResponse('Usuário não autenticado');
    if (!podeFinanceiro(user)) {
      return permissionErrorResponse('Sem permissão para criar lançamentos');
    }
    const body = await request.json();
    const {
      data_competencia,
      data_vencimento,
      valor,
      descricao,
      observacao,
      categoria_id,
      centro_custo_id,
      conta_financeira_id,
      cpf_cnpj,
      pessoa_id,
    } = body || {};

    const barIdNum = Number(user.bar_id);
    if (!Number.isFinite(barIdNum)) {
      return NextResponse.json({ error: 'Usuário sem bar associado' }, { status: 400 });
    }
    const valorNum = Number(valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      return NextResponse.json({ error: 'valor inválido' }, { status: 400 });
    }
    if (!data_competencia || !data_vencimento) {
      return NextResponse.json({ error: 'data_competencia e data_vencimento são obrigatórios' }, { status: 400 });
    }
    if (!categoria_id) {
      return NextResponse.json({ error: 'categoria_id é obrigatório' }, { status: 400 });
    }
    if (!descricao) {
      return NextResponse.json({ error: 'descricao é obrigatória' }, { status: 400 });
    }

    const tokenResult = await getCAToken(barIdNum);
    if ('error' in tokenResult) {
      return NextResponse.json({ error: tokenResult.error }, { status: tokenResult.status });
    }
    const token = tokenResult.token;
    const supabase = getSupabaseAdmin();

    // Resolver pessoa_id (fornecedor) — 3 caminhos: pessoa_id direto > documento > nome normalizado
    let resolvedPessoaId: string | null = pessoa_id || null;
    if (!resolvedPessoaId && cpf_cnpj) {
      const documento = String(cpf_cnpj).replace(/\D/g, '');
      if (documento.length === 11 || documento.length === 14) {
        const { data: pessoa } = await (supabase
          .schema('bronze' as any) as any)
          .from('bronze_contaazul_pessoas')
          .select('contaazul_id')
          .eq('bar_id', barIdNum)
          .eq('documento', documento)
          .limit(1)
          .maybeSingle();
        if (pessoa?.contaazul_id) {
          resolvedPessoaId = pessoa.contaazul_id;
        }
      }
    }
    // Fallback: lookup por nome normalizado (lower + sem acento + space-collapse)
    if (!resolvedPessoaId && body.nome_beneficiario) {
      const normalizar = (s: string) =>
        String(s)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      const alvo = normalizar(String(body.nome_beneficiario));
      // Pagina pra evitar limit default 1000 do Supabase
      let from = 0;
      const PAGE = 1000;
      while (!resolvedPessoaId) {
        const { data: candidatos } = await (supabase
          .schema('bronze' as any) as any)
          .from('bronze_contaazul_pessoas')
          .select('contaazul_id, nome')
          .eq('bar_id', barIdNum)
          .eq('perfil', 'FORNECEDOR')
          .neq('ativo', false)
          .range(from, from + PAGE - 1);
        const arr = ((candidatos as any[]) || []);
        const match = arr.find(c => normalizar(c.nome || '') === alvo);
        if (match?.contaazul_id) {
          resolvedPessoaId = match.contaazul_id;
          break;
        }
        if (arr.length < PAGE) break;
        from += PAGE;
        if (from > 50000) break; // hard cap
      }
    }
    if (!resolvedPessoaId) {
      return NextResponse.json(
        {
          error:
            'Fornecedor não encontrado. Use o botão "Cadastrar" no preview pra criar no Conta Azul antes de pagar.',
          hint: 'A folha não traz CPF/CNPJ — passe pessoa_id, cpf_cnpj ou nome_beneficiario que bata exatamente com algum fornecedor sincronizado.',
        },
        { status: 404 }
      );
    }

    // Conta financeira: exige escolha explícita (vem do select da sidebar)
    if (!conta_financeira_id) {
      return NextResponse.json(
        {
          error:
            'Selecione a conta financeira pagadora no painel lateral antes de processar pagamentos.',
        },
        { status: 400 }
      );
    }
    const resolvedContaFinId = String(conta_financeira_id);

    // Schema oficial CA v2: https://developers.contaazul.com/docs/financial-apis-openapi/v1/createpayablefinancialevent
    // Endpoint retorna 202 Accepted com { protocolId, status: PENDING|SUCCESS|ERROR, createdAt }
    const valorRound = Math.round(valorNum * 100) / 100;

    // VALIDACAO ANTI-DUPLICADO (2026-05-25)
    // Pode acontecer 2 pagamentos com valores DIFERENTES pra mesma pessoa no mesmo dia,
    // mas se TUDO bate (valor, descricao, categoria, data, fornecedor) → quase certamente
    // eh repeat-click acidental do usuario. Bloqueia.
    const normalizar = (s: string) =>
      String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
    const descricaoNorm = normalizar(descricao);

    const { data: duplicados } = await (supabase
      .schema('bronze' as any) as any)
      .from('bronze_contaazul_lancamentos')
      .select('contaazul_id, descricao, valor_bruto, data_competencia, categoria_id, stakeholder_id, status, created_at')
      .eq('bar_id', barIdNum)
      .eq('data_competencia', data_competencia)
      .eq('categoria_id', categoria_id)
      .is('excluido_em', null)
      .limit(50);

    const possivelDup = ((duplicados as any[]) || []).find(d => {
      const vMatch = Math.abs(Number(d.valor_bruto || 0) - valorRound) < 0.01;
      const dMatch = normalizar(d.descricao || '') === descricaoNorm;
      const sMatch = !d.stakeholder_id || d.stakeholder_id === resolvedPessoaId;
      return vMatch && dMatch && sMatch;
    });

    if (possivelDup) {
      return NextResponse.json(
        {
          error: 'Possivel pagamento duplicado detectado no Conta Azul.',
          duplicado: {
            contaazul_id: possivelDup.contaazul_id,
            descricao: possivelDup.descricao,
            valor: possivelDup.valor_bruto,
            data_competencia: possivelDup.data_competencia,
            criado_em: possivelDup.created_at,
            status: possivelDup.status,
          },
          hint: 'Mesmo valor, descricao, categoria, data e fornecedor ja existe. Se for proposital, altere a descricao ou crie em data diferente.',
        },
        { status: 409 }
      );
    }
    // Rateio: usa o multi-categoria do body (ex.: fatura de cartão) se vier; senão 1 categoria.
    const caRateio = Array.isArray(body.rateio) && body.rateio.length > 0
      ? body.rateio.map((r: any) => ({ id_categoria: r.id_categoria, valor: Math.round(Number(r.valor) * 100) / 100 }))
      : [
          {
            id_categoria: categoria_id,
            valor: valorRound,
            ...(centro_custo_id
              ? { rateio_centro_custo: [{ id_centro_custo: centro_custo_id, valor: valorRound }] }
              : {}),
          },
        ];

    const caBody = {
      data_competencia,
      valor: valorRound,
      observacao: observacao || `Pagamento via Zykor — ${descricao}`,
      descricao,
      contato: resolvedPessoaId,
      conta_financeira: resolvedContaFinId,
      rateio: caRateio,
      condicao_pagamento: {
        parcelas: [
          {
            descricao,
            data_vencimento,
            nota: 'Pagamento agendado via Zykor (PIX Inter)',
            conta_financeira: resolvedContaFinId,
            detalhe_valor: {
              valor_bruto: valorRound,
              valor_liquido: valorRound,
              juros: 0,
              multa: 0,
              desconto: 0,
              taxa: 0,
            },
          },
        ],
      },
    };

    const caResp = await fetch(
      `${CONTA_AZUL_API_URL}/v1/financeiro/eventos-financeiros/contas-a-pagar`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(caBody),
      }
    );

    const caRespText = await caResp.text();
    let caRespJson: any = null;
    try {
      caRespJson = caRespText ? JSON.parse(caRespText) : null;
    } catch {
      caRespJson = null;
    }

    if (!caResp.ok) {
      console.error('[CA-LANC-POST] Erro CA:', caResp.status, caRespText);
      return NextResponse.json(
        {
          error: `Conta Azul retornou ${caResp.status}: ${caRespJson?.message || caRespText || 'erro desconhecido'}`,
          ca_status: caResp.status,
          ca_body: caRespJson,
          payload_enviado: caBody,
        },
        { status: caResp.status >= 500 ? 502 : 400 }
      );
    }

    // CA v2 retorna 202 Accepted com { protocolId, status, createdAt }
    // O protocolId é o handle assíncrono — o ID definitivo da conta a pagar virá no próximo sync.
    const protocolId = caRespJson?.protocolId || caRespJson?.id || null;
    const caStatus = caRespJson?.status || null;

    if (caStatus === 'ERROR') {
      return NextResponse.json(
        {
          error: 'Conta Azul rejeitou o lançamento (status ERROR)',
          ca_response: caRespJson,
          payload_enviado: caBody,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      contaazul_id: protocolId,
      ca_response: caRespJson,
    });
  } catch (err: any) {
    console.error('[CA-LANC-POST] Erro:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao criar lançamento no Conta Azul' },
      { status: 500 }
    );
  }
}
