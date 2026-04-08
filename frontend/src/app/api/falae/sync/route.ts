import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    const json = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchAnswersPage(
  baseUrl: string,
  token: string,
  query: URLSearchParams
): Promise<{ ok: boolean; status: number; data: any[]; total: number | null; raw: string }> {
  const resp = await fetch(`${baseUrl}/api/answers?${query.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const raw = await resp.text();
  if (!resp.ok) {
    return { ok: false, status: resp.status, data: [], total: null, raw };
  }

  let parsed: any = null;
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }

  return {
    ok: true,
    status: resp.status,
    data: Array.isArray(parsed?.data) ? parsed.data : [],
    total: toNumber(parsed?.total),
    raw,
  };
}

type DailyNpsRow = {
  created_at: string;
  data_visita?: string | null;
  nps: number;
};

async function upsertDailyNps(
  supabase: any,
  barId: number,
  rows: DailyNpsRow[]
): Promise<{ dias_atualizados: number; respostas_total: number }> {
  if (!rows.length) {
    return { dias_atualizados: 0, respostas_total: 0 };
  }

  const byDay = new Map<
    string,
    { total: number; promotores: number; neutros: number; detratores: number; somaNps: number }
  >();

  for (const row of rows) {
    // Usar created_at (data da resposta) para alinhar com o Falae
    const day = String(row.created_at).slice(0, 10);
    if (!day) continue;
    if (!byDay.has(day)) {
      byDay.set(day, { total: 0, promotores: 0, neutros: 0, detratores: 0, somaNps: 0 });
    }
    const bucket = byDay.get(day)!;
    const nps = Number(row.nps) || 0;
    bucket.total += 1;
    bucket.somaNps += nps;
    if (nps >= 9) bucket.promotores += 1;
    else if (nps <= 6) bucket.detratores += 1;
    else bucket.neutros += 1;
  }

  const now = new Date().toISOString();
  const dailyRows = Array.from(byDay.entries()).map(([dataReferencia, v]) => ({
    bar_id: barId,
    data_referencia: dataReferencia,
    respostas_total: v.total,
    promotores: v.promotores,
    neutros: v.neutros,
    detratores: v.detratores,
    nps_score: v.total > 0 ? Math.round(((v.promotores - v.detratores) / v.total) * 100) : null,
    nps_media: v.total > 0 ? Math.round((v.somaNps / v.total) * 100) / 100 : null,
    atualizado_em: now,
  }));

  const { error } = await supabase
    .from('nps_falae_diario')
    .upsert(dailyRows, { onConflict: 'bar_id,data_referencia' });

  if (error) {
    throw error;
  }

  return { dias_atualizados: dailyRows.length, respostas_total: rows.length };
}

async function upsertDailyNpsFromDatabase(
  supabase: any,
  barId: number,
  dateStart: string,
  dateEnd: string
): Promise<{ dias_atualizados: number; respostas_total: number }> {
  const { data, error } = await supabase
    .from('falae_respostas')
    .select('created_at, nps')
    .eq('bar_id', barId)
    .gte('created_at', `${dateStart}T00:00:00`)
    .lte('created_at', `${dateEnd}T23:59:59`);

  if (error) throw error;
  return upsertDailyNps(supabase, barId, (data || []) as DailyNpsRow[]);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getAdminClient();

    // Obter parâmetros
    const body = await request.json().catch(() => ({}));
    const barId = Number(body.bar_id);
    const daysBack = Math.max(1, Number(body.days_back) || 7);
    if (!barId || Number.isNaN(barId)) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const hoje = new Date();
    const inicio = new Date();
    inicio.setDate(hoje.getDate() - daysBack);
    const dateStart = toIsoDate(inicio);
    const dateEnd = toIsoDate(hoje);

    const { data: credenciais, error: credError } = await supabase
      .from('api_credentials')
      .select('api_token, base_url, empresa_id')
      .eq('bar_id', barId)
      .eq('sistema', 'falae')
      .eq('ativo', true)
      .order('atualizado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (credError) {
      console.error('Erro ao buscar credenciais Falaê:', credError);
      return NextResponse.json({ error: 'Erro ao buscar credenciais Falaê' }, { status: 500 });
    }

    if (!credenciais?.api_token) {
      return NextResponse.json(
        { error: 'Credenciais Falaê não configuradas para este bar' },
        { status: 404 }
      );
    }

    const jwtPayload = decodeJwtPayload(credenciais.api_token);
    const companyId =
      (typeof credenciais.empresa_id === 'string' && credenciais.empresa_id) ||
      (typeof jwtPayload?.company_id === 'string' ? jwtPayload.company_id : null);

    const baseUrl = credenciais.base_url || 'https://api-b2s.experienciab2s.com';
    const limit = 50;
    const respostasMap = new Map<string, any>();
    const detalhes: Array<Record<string, unknown>> = [];
    const enpsModes = [false, true];

    for (const isEnps of enpsModes) {
      let offset = 1;
      let totalReportado: number | null = null;
      let paginas = 0;
      let erroNoModo = false;

      while (true) {
        paginas += 1;
        const baseQuery = new URLSearchParams({
          is_enps: String(isEnps),
          date_start: dateStart,
          date_end: dateEnd,
          limit: String(limit),
          offset: String(offset),
        });

        // Tenta SEM companies_id (o token JWT já contém a empresa)
        let pageResult: Awaited<ReturnType<typeof fetchAnswersPage>> | null = null;
        pageResult = await fetchAnswersPage(baseUrl, credenciais.api_token, baseQuery);

        if (!pageResult || !pageResult.ok) {
          detalhes.push({
            is_enps: isEnps,
            pagina: paginas,
            offset,
            status: pageResult?.status || 500,
            erro: true,
            raw_error: pageResult?.raw?.substring(0, 500),
          });
          erroNoModo = true;
          break;
        }

        const lote = pageResult.data;
        if (pageResult.total !== null) totalReportado = pageResult.total;

        for (const item of lote) {
          const id = String(item?.id || '');
          if (id) respostasMap.set(id, item);
        }

        if (lote.length < limit) break;
        offset += 1; // A API do Falaê usa offset paginado (1, 2, 3...), não índice absoluto.
        if (totalReportado !== null && offset > totalReportado) break;
        if (offset >= 100) break;
      }

      detalhes.push({
        is_enps: isEnps,
        paginas,
        total_reportado: totalReportado,
        erro: erroNoModo,
      });
    }

    // Se não encontrou respostas, retorna sucesso com 0 respostas (não é erro)
    if (respostasMap.size === 0) {
      return NextResponse.json({
        success: true,
        bar_id: barId,
        periodo: { inicio: dateStart, fim: dateEnd },
        respostas: {
          encontradas: 0,
          inseridas_atualizadas: 0,
          erros: 0,
        },
        nps_periodo: null,
        detalhes,
        nps_diario: { dias_atualizados: 0, respostas_total: 0 },
        nps_diario_pesquisa: { rows_affected: 0 },
        synced_at: new Date().toISOString(),
        message: 'Nenhuma resposta encontrada no período',
      });
    }

    const respostas = Array.from(respostasMap.values());
    const rows = respostas.map((answer) => {
      const search = answer?.search || {};
      const client = answer?.client || {};
      const consumption = answer?.consumption || {};
      const page = answer?.page || {};
      const company = answer?.company || {};
      const criterios = answer?.criteria || [];
      
      // Extrair "Data do pedido" dos critérios (data real da visita)
      let dataVisita: string | null = null;
      if (Array.isArray(criterios)) {
        const dataCriterio = criterios.find(
          (c: any) => c?.nick?.toLowerCase().includes('data do pedido') && c?.type === 'Data'
        );
        if (dataCriterio?.name && /^\d{4}-\d{2}-\d{2}$/.test(dataCriterio.name)) {
          dataVisita = dataCriterio.name;
        }
      }

      return {
        bar_id: barId,
        falae_id: String(answer?.id),
        created_at: String(answer?.created_at || new Date().toISOString()),
        nps: toNumber(answer?.nps) || 0,
        discursive_question: answer?.discursive_question || null,
        criterios: criterios.length > 0 ? criterios : null,
        search_id: search?.id || answer?.search_id || null,
        search_name: search?.name || null,
        client_id: client?.id || answer?.client_id || null,
        client_name: client?.name || null,
        client_email: client?.email || null,
        client_phone: client?.phone || null,
        consumption_id: consumption?.id || null,
        order_id: consumption?.order_id || null,
        data_visita: dataVisita,
        raw_data: {
          ...answer,
          page,
          company,
        },
        synced_at: new Date().toISOString(),
      };
    });

    const { error: upsertError } = await supabase
      .from('falae_respostas')
      .upsert(rows, { onConflict: 'bar_id,falae_id' });

    if (upsertError) {
      console.error('Erro ao salvar respostas Falaê:', upsertError);
      return NextResponse.json({ error: 'Erro ao persistir respostas' }, { status: 500 });
    }

    let npsDiario = { dias_atualizados: 0, respostas_total: 0 };
    try {
      npsDiario = await upsertDailyNps(
        supabase,
        barId,
        rows.map((r) => ({ created_at: r.created_at, data_visita: r.data_visita, nps: r.nps }))
      );
    } catch (npsError) {
      console.error('Erro ao atualizar nps_falae_diario:', npsError);
    }

    // Atualizar NPS diário por pesquisa (nova tabela separada por search_name)
    let npsDiarioPesquisa = { rows_affected: 0 };
    try {
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('recalcular_nps_diario_pesquisa', {
          p_bar_id: barId,
          p_data_inicio: dateStart,
          p_data_fim: dateEnd,
        });
      
      if (rpcError) {
        console.error('Erro ao atualizar nps_falae_diario_pesquisa:', rpcError);
      } else {
        npsDiarioPesquisa.rows_affected = rpcResult || 0;
      }
    } catch (npsError) {
      console.error('Erro ao atualizar nps_falae_diario_pesquisa:', npsError);
    }

    const promotores = rows.filter((r) => Number(r.nps) >= 9).length;
    const detratores = rows.filter((r) => Number(r.nps) <= 6).length;
    const npsPeriodo =
      rows.length > 0 ? Math.round(((promotores - detratores) / rows.length) * 100) : null;

    // Atualizar desempenho_semanal para semana atual e anterior
    try {
      const hoje = new Date();
      const semanaAtual = Math.ceil((((hoje.getTime() - new Date(Date.UTC(hoje.getUTCFullYear(), 0, 1)).getTime()) / 86400000) + 1) / 7);
      const anoAtual = hoje.getUTCFullYear();

      for (const semanaNum of [semanaAtual - 1, semanaAtual]) {
        // Buscar dados agregados da semana
        const { data: falaeSemanaDados } = await supabase
          .from('nps_falae_diario')
          .select('data_referencia, respostas_total, promotores, detratores')
          .eq('bar_id', barId);

        let totalSemana = 0;
        let promotoresSemana = 0;
        let detratoresSemana = 0;

        for (const d of falaeSemanaDados || []) {
          const data = new Date(`${d.data_referencia}T12:00:00`);
          const dUtc = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
          const dayNum = dUtc.getUTCDay() || 7;
          dUtc.setUTCDate(dUtc.getUTCDate() + 4 - dayNum);
          const yearStart = new Date(Date.UTC(dUtc.getUTCFullYear(), 0, 1));
          const semanaCalc = Math.ceil((((dUtc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

          if (semanaCalc === semanaNum) {
            totalSemana += Number(d.respostas_total) || 0;
            promotoresSemana += Number(d.promotores) || 0;
            detratoresSemana += Number(d.detratores) || 0;
          }
        }

        if (totalSemana > 0) {
          const npsScoreSemana = Math.round(((promotoresSemana - detratoresSemana) / totalSemana) * 100);
          await supabase
            .from('desempenho_semanal')
            .update({
              nps_digital_respostas: totalSemana,
              nps_digital: npsScoreSemana,
              atualizado_em: new Date().toISOString(),
            })
            .eq('bar_id', barId)
            .eq('ano', anoAtual)
            .eq('numero_semana', semanaNum);
        }
      }
    } catch (updateError) {
      console.warn('Aviso ao atualizar desempenho_semanal:', updateError);
    }

    return NextResponse.json({
      success: true,
      bar_id: barId,
      periodo: { inicio: dateStart, fim: dateEnd },
      respostas: {
        encontradas: respostas.length,
        inseridas_atualizadas: rows.length,
        erros: detalhes.filter((d) => d.erro).length,
      },
      nps_periodo: npsPeriodo,
      detalhes,
      nps_diario: npsDiario,
      nps_diario_pesquisa: npsDiarioPesquisa,
      synced_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Erro na API de sync Falaê:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getAdminClient();
    const { searchParams } = new URL(request.url);
    const barId = parseInt(searchParams.get('bar_id') || '', 10);
    if (!barId || Number.isNaN(barId)) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }
    const periodo = searchParams.get('periodo') || 'semana'; // semana, mes, trimestre
    
    // Calcular datas
    const hoje = new Date();
    let dataInicio: Date;
    
    switch (periodo) {
      case 'mes':
        dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
        break;
      case 'trimestre': {
        const mesAtual = hoje.getMonth();
        const trimestreInicio = Math.floor(mesAtual / 3) * 3;
        dataInicio = new Date(hoje.getFullYear(), trimestreInicio, 1);
        break;
      }
      case 'semana':
      default:
        dataInicio = new Date(hoje);
        dataInicio.setDate(hoje.getDate() - 7);
        break;
    }

    const dataInicioStr = dataInicio.toISOString().split('T')[0];
    const dataFimStr = hoje.toISOString().split('T')[0];

    // Buscar respostas do período
    const { data: respostas, error } = await supabase
      .from('falae_respostas')
      .select('nps, created_at, criterios, discursive_question')
      .eq('bar_id', barId)
      .gte('created_at', dataInicioStr)
      .lte('created_at', dataFimStr + 'T23:59:59')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar respostas:', error);
      return NextResponse.json({ error: 'Erro ao buscar dados' }, { status: 500 });
    }

    // Calcular métricas NPS
    const total = respostas?.length || 0;
    const promotores = respostas?.filter(r => r.nps >= 9).length || 0;
    const neutros = respostas?.filter(r => r.nps >= 7 && r.nps <= 8).length || 0;
    const detratores = respostas?.filter(r => r.nps <= 6).length || 0;
    const npsScore = total > 0 ? Math.round(((promotores - detratores) / total) * 100) : null;
    const mediaNps = total > 0 ? Math.round((respostas.reduce((acc, r) => acc + r.nps, 0) / total) * 10) / 10 : null;

    // Calcular médias por critério
    const criteriosTotais: Record<string, { soma: number; count: number }> = {};
    
    respostas?.forEach(r => {
      if (r.criterios && Array.isArray(r.criterios)) {
        r.criterios.forEach((c: any) => {
          if (c.type === 'Rating' && c.name) {
            const nota = parseFloat(c.name);
            if (!isNaN(nota)) {
              const nick = c.nick || 'Geral';
              if (!criteriosTotais[nick]) {
                criteriosTotais[nick] = { soma: 0, count: 0 };
              }
              criteriosTotais[nick].soma += nota;
              criteriosTotais[nick].count++;
            }
          }
        });
      }
    });

    const criteriosMedias = Object.entries(criteriosTotais).map(([nome, dados]) => ({
      nome,
      media: Math.round((dados.soma / dados.count) * 10) / 10,
      total: dados.count,
    }));

    // Últimos comentários (detratores primeiro)
    const comentarios = respostas
      ?.filter(r => r.discursive_question && r.discursive_question.trim().length > 0)
      .slice(0, 10)
      .map(r => ({
        nps: r.nps,
        comentario: r.discursive_question,
        data: r.created_at,
        tipo: r.nps >= 9 ? 'promotor' : r.nps <= 6 ? 'detrator' : 'neutro',
      })) || [];

    return NextResponse.json({
      periodo: { inicio: dataInicioStr, fim: dataFimStr },
      metricas: {
        total_respostas: total,
        nps_score: npsScore,
        media_nps: mediaNps,
        promotores,
        neutros,
        detratores,
        perc_promotores: total > 0 ? Math.round((promotores / total) * 100) : 0,
        perc_detratores: total > 0 ? Math.round((detratores / total) * 100) : 0,
      },
      criterios: criteriosMedias,
      ultimos_comentarios: comentarios,
    });

  } catch (error) {
    console.error('Erro na API de NPS Falaê:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
