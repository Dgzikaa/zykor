import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * GET /api/estrategico/desempenho/metas
 *
 * Params: bar_id, periodo, semana?, ano?
 *
 * Quando semana+ano são fornecidos (visão semanal):
 *   1. Busca metas específicas daquela semana
 *   2. Fallback: busca semana anterior (até 52 semanas atrás)
 *   3. Fallback final: meta global (semana IS NULL)
 *   Retorna { metas, origens } onde origens indica se cada meta é 'definida' ou 'herdada'
 *
 * Quando semana+ano NÃO são fornecidos (visão mensal ou global):
 *   Comportamento original: busca metas globais (semana IS NULL)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const barId = searchParams.get('bar_id');
    const periodo = searchParams.get('periodo'); // 'semanal' ou 'mensal'
    const semana = searchParams.get('semana');
    const ano = searchParams.get('ano');

    if (!barId) {
      return NextResponse.json(
        { error: 'bar_id é obrigatório' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Se semana+ano fornecidos: busca com fallback
    if (semana && ano) {
      const semanaNum = Number(semana);
      const anoNum = Number(ano);

      // Buscar TODAS as metas do bar para período semanal (com e sem semana)
      const { data: todasMetas, error } = await supabase
        .schema('meta' as never)
        .from('metas_desempenho')
        .select('*')
        .eq('bar_id', barId)
        .eq('periodo', periodo || 'semanal');

      if (error) {
        console.error('Erro ao buscar metas:', error);
        return NextResponse.json({ error: 'Erro ao buscar metas' }, { status: 500 });
      }

      const rows = todasMetas || [];

      // Separar: metas da semana pedida, metas de semanas anteriores, metas globais
      const metasSemanaExata: typeof rows = [];
      const metasGlobais: typeof rows = [];
      const metasOutrasSemanas: typeof rows = [];

      for (const m of rows) {
        if (m.semana === semanaNum && m.ano === anoNum) {
          metasSemanaExata.push(m);
        } else if (m.semana == null) {
          metasGlobais.push(m);
        } else {
          metasOutrasSemanas.push(m);
        }
      }

      // Ordenar outras semanas por proximidade (mais recente primeiro)
      metasOutrasSemanas.sort((a, b) => {
        const distA = (anoNum - a.ano) * 53 + (semanaNum - a.semana);
        const distB = (anoNum - b.ano) * 53 + (semanaNum - b.semana);
        // Apenas semanas anteriores (distância positiva), mais próxima primeiro
        if (distA <= 0 && distB <= 0) return distA - distB; // ambas futuras
        if (distA <= 0) return 1; // a é futura, b na frente
        if (distB <= 0) return -1; // b é futura, a na frente
        return distA - distB; // ambas passadas, mais próxima primeiro
      });

      // Montar mapa com fallback: semana exata > semana anterior mais próxima > global
      const metasMap: Record<string, { valor: number; operador: string }> = {};
      const origens: Record<string, { tipo: 'definida' | 'herdada'; semana?: number; ano?: number }> = {};

      // Coletar todas as métricas únicas
      const todasMetricas = new Set(rows.map(m => m.metrica));

      for (const metrica of todasMetricas) {
        // 1. Tentar semana exata
        const exata = metasSemanaExata.find(m => m.metrica === metrica);
        if (exata) {
          metasMap[metrica] = { valor: parseFloat(exata.valor_meta), operador: exata.operador };
          origens[metrica] = { tipo: 'definida', semana: semanaNum, ano: anoNum };
          continue;
        }

        // 2. Tentar semana anterior mais próxima (apenas passadas)
        const anterior = metasOutrasSemanas.find(m => {
          if (m.metrica !== metrica) return false;
          const dist = (anoNum - m.ano) * 53 + (semanaNum - m.semana);
          return dist > 0; // apenas semanas passadas
        });
        if (anterior) {
          metasMap[metrica] = { valor: parseFloat(anterior.valor_meta), operador: anterior.operador };
          origens[metrica] = { tipo: 'herdada', semana: anterior.semana, ano: anterior.ano };
          continue;
        }

        // 3. Fallback: meta global
        const global = metasGlobais.find(m => m.metrica === metrica);
        if (global) {
          metasMap[metrica] = { valor: parseFloat(global.valor_meta), operador: global.operador };
          origens[metrica] = { tipo: 'herdada' };
          continue;
        }
      }

      return NextResponse.json({ metas: metasMap, origens });
    }

    // Sem semana: comportamento original (metas globais)
    let query = supabase
      .schema('meta' as never)
      .from('metas_desempenho')
      .select('*')
      .eq('bar_id', barId)
      .is('semana', null);

    if (periodo) {
      query = query.eq('periodo', periodo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar metas:', error);
      return NextResponse.json({ error: 'Erro ao buscar metas de desempenho' }, { status: 500 });
    }

    const metasMap: Record<string, { valor: number; operador: string }> = {};
    (data || []).forEach((meta: any) => {
      metasMap[meta.metrica] = {
        valor: parseFloat(meta.valor_meta),
        operador: meta.operador
      };
    });

    return NextResponse.json({ metas: metasMap, raw: data });
  } catch (error) {
    console.error('Erro na API de metas:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

type MetaPayload = {
  metrica: string;
  valor: number;
  operador?: string;
};

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const barId = Number(body?.bar_id);
    const periodo = String(body?.periodo || '');
    const metas = (body?.metas || []) as MetaPayload[];
    const semana = body?.semana != null ? Number(body.semana) : null;
    const ano = body?.ano != null ? Number(body.ano) : null;

    if (!barId || Number.isNaN(barId)) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    if (periodo !== 'semanal' && periodo !== 'mensal') {
      return NextResponse.json({ error: 'periodo inválido (use semanal ou mensal)' }, { status: 400 });
    }

    if (!Array.isArray(metas) || metas.length === 0) {
      return NextResponse.json({ error: 'metas é obrigatório e deve ser um array não vazio' }, { status: 400 });
    }

    const metasValidas = metas
      .filter((m) => m && typeof m.metrica === 'string' && m.metrica.trim() !== '')
      .map((m) => ({
        bar_id: barId,
        periodo,
        metrica: m.metrica.trim(),
        valor_meta: Number(m.valor),
        operador: m.operador && m.operador.trim() ? m.operador.trim() : '>=',
        semana,
        ano,
        updated_at: new Date().toISOString(),
      }))
      .filter((m) => Number.isFinite(m.valor_meta));

    if (!metasValidas.length) {
      return NextResponse.json({ error: 'Nenhuma meta válida para salvar' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Upsert usa o novo unique index (bar_id, periodo, metrica, COALESCE(semana,0), COALESCE(ano,0))
    // Como Supabase não suporta onConflict com expressões, fazemos delete + insert
    for (const meta of metasValidas) {
      let deleteQuery = supabase
        .schema('meta' as never)
        .from('metas_desempenho')
        .delete()
        .eq('bar_id', barId)
        .eq('periodo', periodo)
        .eq('metrica', meta.metrica);

      if (semana != null && ano != null) {
        deleteQuery = deleteQuery.eq('semana', semana).eq('ano', ano);
      } else {
        deleteQuery = deleteQuery.is('semana', null).is('ano', null);
      }

      await deleteQuery;
    }

    const { error: insertError } = await supabase
      .schema('meta' as never)
      .from('metas_desempenho')
      .insert(metasValidas);

    if (insertError) {
      console.error('Erro ao salvar metas:', insertError);
      return NextResponse.json({ error: 'Erro ao salvar metas de desempenho' }, { status: 500 });
    }

    // Recarregar
    let reloadQuery = supabase
      .schema('meta' as never)
      .from('metas_desempenho')
      .select('*')
      .eq('bar_id', barId)
      .eq('periodo', periodo);

    if (semana != null && ano != null) {
      reloadQuery = reloadQuery.eq('semana', semana).eq('ano', ano);
    } else {
      reloadQuery = reloadQuery.is('semana', null).is('ano', null);
    }

    const { data, error: fetchError } = await reloadQuery;

    if (fetchError) {
      console.error('Erro ao recarregar metas após salvar:', fetchError);
      return NextResponse.json({ error: 'Metas salvas, mas falha ao recarregar' }, { status: 500 });
    }

    const metasMap: Record<string, { valor: number; operador: string }> = {};
    (data || []).forEach((meta: any) => {
      metasMap[meta.metrica] = {
        valor: parseFloat(meta.valor_meta),
        operador: meta.operador,
      };
    });

    return NextResponse.json({ success: true, salvas: metasValidas.length, metas: metasMap });
  } catch (error) {
    console.error('Erro ao salvar metas (PUT):', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// PATCH - Edição individual de meta com histórico (agora por semana)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const barId = Number(body?.bar_id);
    const periodo = String(body?.periodo || 'semanal');
    const metrica = String(body?.metrica || '');
    const valorNovo = Number(body?.valor);
    const operador = body?.operador ? String(body.operador) : undefined;
    const alteradoPor = body?.alterado_por ? String(body.alterado_por) : 'Sistema';
    const semana = body?.semana != null ? Number(body.semana) : null;
    const ano = body?.ano != null ? Number(body.ano) : null;

    if (!barId || Number.isNaN(barId)) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    if (!metrica.trim()) {
      return NextResponse.json({ error: 'metrica é obrigatória' }, { status: 400 });
    }

    if (!Number.isFinite(valorNovo)) {
      return NextResponse.json({ error: 'valor inválido' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Buscar meta atual para registrar valor anterior
    let buscaAtual = supabase
      .schema('meta' as never)
      .from('metas_desempenho')
      .select('id, valor_meta')
      .eq('bar_id', barId)
      .eq('periodo', periodo)
      .eq('metrica', metrica);

    if (semana != null && ano != null) {
      buscaAtual = buscaAtual.eq('semana', semana).eq('ano', ano);
    } else {
      buscaAtual = buscaAtual.is('semana', null).is('ano', null);
    }

    const { data: metaAtual } = await buscaAtual.maybeSingle();

    const valorAnterior = metaAtual?.valor_meta ?? null;
    const metaId = metaAtual?.id ?? null;

    // Delete + Insert (para evitar problemas com onConflict e expressões COALESCE)
    if (metaAtual) {
      await supabase
        .schema('meta' as never)
        .from('metas_desempenho')
        .delete()
        .eq('id', metaAtual.id);
    }

    const dadosMeta: Record<string, unknown> = {
      bar_id: barId,
      periodo,
      metrica: metrica.trim(),
      valor_meta: valorNovo,
      semana,
      ano,
      updated_at: new Date().toISOString(),
    };
    if (operador) {
      dadosMeta.operador = operador;
    }

    const { data: metaSalva, error: insertError } = await supabase
      .schema('meta' as never)
      .from('metas_desempenho')
      .insert(dadosMeta)
      .select('id')
      .single();

    if (insertError) {
      console.error('Erro ao salvar meta:', insertError);
      return NextResponse.json({ error: 'Erro ao salvar meta' }, { status: 500 });
    }

    // Registrar histórico
    const { error: historicoError } = await supabase
      .schema('meta' as never)
      .from('metas_desempenho_historico')
      .insert({
        meta_id: metaSalva?.id || metaId,
        bar_id: barId,
        metrica: metrica.trim(),
        periodo,
        semana,
        ano,
        valor_anterior: valorAnterior,
        valor_novo: valorNovo,
        alterado_por: alteradoPor,
      });

    if (historicoError) {
      console.error('Erro ao registrar histórico (não crítico):', historicoError);
    }

    return NextResponse.json({
      success: true,
      metrica,
      valor_anterior: valorAnterior,
      valor_novo: valorNovo,
      semana,
      ano,
    });
  } catch (error) {
    console.error('Erro ao editar meta (PATCH):', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
