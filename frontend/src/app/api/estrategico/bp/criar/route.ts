import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { createServerClient } from '@/lib/supabase-server';

/**
 * Cria uma nova versao de Business Plan copiando as linhas/indicadores de uma
 * versao existente, com os valores (valor_mensal) editados pelo socio.
 *
 * Escreve em meta.bp_linha / meta.bp_indicador (as views public.* sao read-only
 * pro PostgREST nesse caso). percentual_receita e recalculado a partir dos
 * novos valores (receita total do bloco "Receitas").
 *
 * POST body {
 *   bar_id, ano, versao,                         // destino (novo BP)
 *   linhas:  [{ bloco, linha, ordem, tipo, valor_mensal, por_dia_semana?, observacao? }],
 *   indicadores?: [{ indicador, valor, unidade?, observacao? }],
 * }
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  try {
    const body = await request.json().catch(() => ({}));
    const barId = Number(body?.bar_id);
    const ano = Number(body?.ano);
    const versao = String(body?.versao || '').trim();
    const linhas = Array.isArray(body?.linhas) ? body.linhas : [];
    const indicadores = Array.isArray(body?.indicadores) ? body.indicadores : [];

    if (!barId || !ano || !versao) {
      return NextResponse.json(
        { error: 'bar_id, ano e versao sao obrigatorios' },
        { status: 400 },
      );
    }
    if (linhas.length === 0) {
      return NextResponse.json({ error: 'Nenhuma linha para copiar' }, { status: 400 });
    }

    const supabase = createServerClient();
    const meta = supabase.schema('meta' as never);

    // Nao sobrescrever uma versao que ja existe
    const { data: existente, error: errCheck } = await (meta as any)
      .from('bp_linha')
      .select('id')
      .eq('bar_id', barId)
      .eq('ano', ano)
      .eq('versao', versao)
      .limit(1);

    if (errCheck) {
      console.error('[bp/criar check]', errCheck);
      return NextResponse.json({ error: errCheck.message }, { status: 500 });
    }
    if (existente && existente.length > 0) {
      return NextResponse.json(
        { error: `Ja existe um BP "${versao}" (${ano}) para este bar. Escolha outro nome.` },
        { status: 409 },
      );
    }

    // Receita total (pra recalcular % receita das demais linhas)
    const receitaTotal = linhas
      .filter((l: any) => l.bloco === 'Receitas')
      .reduce((s: number, l: any) => s + (Number(l.valor_mensal) || 0), 0);

    const linhasInsert = linhas.map((l: any) => {
      const valor = Number(l.valor_mensal) || 0;
      const percentual = receitaTotal > 0 ? (valor / receitaTotal) * 100 : null;
      return {
        bar_id: barId,
        ano,
        versao,
        bloco: String(l.bloco),
        linha: String(l.linha),
        ordem: Number(l.ordem) || 0,
        tipo: String(l.tipo || 'despesa'),
        valor_mensal: valor,
        percentual_receita: percentual,
        por_dia_semana: l.por_dia_semana ?? null,
        observacao: l.observacao ?? null,
        ativo: true,
      };
    });

    const { error: errLinhas } = await (meta as any).from('bp_linha').insert(linhasInsert);
    if (errLinhas) {
      console.error('[bp/criar linhas]', errLinhas);
      return NextResponse.json({ error: errLinhas.message }, { status: 500 });
    }

    if (indicadores.length > 0) {
      const indInsert = indicadores
        .filter((i: any) => i?.indicador)
        .map((i: any) => ({
          bar_id: barId,
          ano,
          versao,
          indicador: String(i.indicador),
          valor: i.valor === null || i.valor === undefined ? null : Number(i.valor),
          unidade: i.unidade ?? null,
          observacao: i.observacao ?? null,
          ativo: true,
        }));
      if (indInsert.length > 0) {
        const { error: errInd } = await (meta as any).from('bp_indicador').insert(indInsert);
        if (errInd) {
          // Linhas ja foram criadas; reporta mas nao derruba tudo.
          console.error('[bp/criar indicadores]', errInd);
          return NextResponse.json(
            { error: `Linhas criadas, mas falhou ao copiar indicadores: ${errInd.message}` },
            { status: 500 },
          );
        }
      }
    }

    return NextResponse.json({ success: true, ano, versao, linhas: linhasInsert.length });
  } catch (err) {
    console.error('[bp/criar] excecao:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro' },
      { status: 500 },
    );
  }
}
