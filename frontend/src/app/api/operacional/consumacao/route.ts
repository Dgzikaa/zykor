import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { getFatorCmv } from '@/lib/config/getFatorCmv';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createServiceRoleClient();

/**
 * Chave estável de uma linha de consumação (pra ignorar/restaurar). Combina os campos
 * que identificam o lançamento na tela — colisão exata = linhas 100% idênticas, que
 * costumam ser erros duplicados e devem ser ignoradas juntas mesmo.
 */
export function hashLinhaConsumacao(input: {
  mesa_norm: string;
  data: string;
  motivo: string;
  produto: string;
  valor_bruto: number;
  qtd: number;
}): string {
  const s = `${input.mesa_norm}|${input.data}|${input.motivo}|${input.produto}|${input.valor_bruto}|${input.qtd}`;
  return createHash('md5').update(s).digest('hex');
}

/**
 * Controle de Consumação — análise linha a linha das consumações (descontos/cortesias),
 * classificadas nas 9 categorias padronizadas + Outros (mesma fonte da Gestão CMV).
 *
 * GET ?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
 * Usa get_consumos_9_detalhes_custo_semana (categoria=null → todas): cada lançamento com o
 * CUSTO REAL — se o produto tem ficha técnica, custo = custo_ficha proporcional ao desconto;
 * senão, desconto × fator (0,35). Paginado via p_limit/p_offset (imune ao cap de 1000 do PostgREST).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const dataInicio = sp.get('data_inicio');
  const dataFim = sp.get('data_fim');
  if (!dataInicio || !dataFim) {
    return NextResponse.json({ success: false, error: 'data_inicio e data_fim são obrigatórios' }, { status: 400 });
  }

  const barId = Number(user.bar_id);

  // normalização da mesa — DEVE bater com a do frontend (page.tsx normMesa)
  const normMesa = (m: string | null) => (m || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || '—';
  // tipo do vínculo → categoria implícita (quando não há override explícito)
  const TIPO_CAT: Record<string, string> = {
    artista: 'artistas',
    socio: 'socios',
    funcionario: 'funcionarios_operacao',
  };

  try {
    const fator = await getFatorCmv(supabase, barId);

    // Wrapper json_agg (perf 2026-07-11): a função base é WITH RECURSIVE + scans pesados de bronze;
    // paginar (p_limit/p_offset ≤1000, por causa do cap de 1000 do PostgREST) re-rodava as CTEs por
    // página → junho = 6 páginas ≈ 6× o custo (~10s). O wrapper `_agg` faz json_agg da função (p_limit
    // NULL = roda 1×) e RETORNA JSON: 1 linha só, então o cap de 1000 (que limita LINHAS) NÃO trunca o
    // array. Row-count validado (junho bar3 = 5232, igual à paginação). Ver feedback do cap 1000.
    const { data, error } = await (supabase as any).rpc('get_consumos_9_detalhes_custo_semana_agg', {
      input_bar_id: barId,
      input_data_inicio: dataInicio,
      input_data_fim: dataFim,
      input_categoria: null,
      p_fator: fator,
    });
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
    const rows: any[] = (data as any[]) || [];

    // vínculos por mesa (override de categoria + entidade), cadastros p/ os dropdowns
    // e chaves de linhas marcadas como "ignorar" (não entram no resumo/totais).
    const fin = (supabase as any).schema('financial');
    const ops = (supabase as any).schema('operations');
    const [{ data: vincRows }, { data: socios }, { data: artistas }, { data: ignoradosRows }] = await Promise.all([
      fin.from('consumo_mesa_vinculo').select('mesa_norm, mesa_label, tipo, artista_id, socio_id, entidade_nome, categoria_override').eq('bar_id', barId),
      fin.from('consumo_socio').select('id, nome').eq('bar_id', barId).eq('ativo', true).order('nome'),
      ops.from('bar_artistas').select('id, nome').eq('bar_id', barId).eq('ativo', true).order('nome'),
      fin.from('consumo_ignorados').select('chave_hash, motivo, criado_em').eq('bar_id', barId),
    ]);
    const vincMap = new Map<string, any>((vincRows || []).map((v: any) => [v.mesa_norm, v]));
    const ignMap = new Map<string, { motivo: string | null; criado_em: string }>(
      (ignoradosRows || []).map((r: any) => [r.chave_hash, { motivo: r.motivo, criado_em: r.criado_em }]),
    );

    const linhas = rows.map((r) => {
      const mesa = r.mesa || null;
      const v = vincMap.get(normMesa(mesa));
      // categoria efetiva: override explícito > categoria implícita do tipo > motivo original
      const categoria = v ? v.categoria_override || TIPO_CAT[v.tipo] || String(r.categoria) : String(r.categoria);
      const motivo = r.motivo || null;
      const produto = r.prd_desc || null;
      const valor_bruto = Number(r.valor_desconto) || 0;
      const qtd = Number(r.qtd) || 0;
      const chave_hash = hashLinhaConsumacao({
        mesa_norm: normMesa(mesa),
        data: String(r.data),
        motivo: motivo || '',
        produto: produto || '',
        valor_bruto,
        qtd,
      });
      const ign = ignMap.get(chave_hash);
      return {
        categoria,
        data: r.data,
        mesa,
        motivo,
        produto,
        qtd,
        valor_bruto,
        custo: Number(r.custo_real) || 0, // custo real (ficha) ou desconto×fator quando sem ficha
        tem_ficha: !!r.tem_ficha,
        chave_hash,
        ignorada: !!ign,
        ignorada_motivo: ign?.motivo ?? null,
        ignorada_em: ign?.criado_em ?? null,
      };
    });

    // resumo por categoria só considera não-ignoradas — o objetivo do "ignorar" é
    // tirar da conta os lançamentos errados sem apagar o histórico.
    const linhasAtivas = linhas.filter((l) => !l.ignorada);
    const map = new Map<string, { categoria: string; linhas: number; com_ficha: number; bruto: number; custo: number }>();
    for (const l of linhasAtivas) {
      const a = map.get(l.categoria) || { categoria: l.categoria, linhas: 0, com_ficha: 0, bruto: 0, custo: 0 };
      a.linhas += 1;
      if (l.tem_ficha) a.com_ficha += 1;
      a.bruto += l.valor_bruto;
      a.custo += l.custo;
      map.set(l.categoria, a);
    }
    const resumo = Array.from(map.values())
      .map((r) => ({ ...r, bruto: Math.round(r.bruto * 100) / 100, custo: Math.round(r.custo * 100) / 100 }))
      .sort((a, b) => b.bruto - a.bruto);

    return NextResponse.json({
      success: true,
      fator,
      data_inicio: dataInicio,
      data_fim: dataFim,
      total_bruto: Math.round(linhasAtivas.reduce((s, l) => s + l.valor_bruto, 0) * 100) / 100,
      total_custo: Math.round(linhasAtivas.reduce((s, l) => s + l.custo, 0) * 100) / 100,
      total_bruto_ignorado: Math.round(linhas.filter((l) => l.ignorada).reduce((s, l) => s + l.valor_bruto, 0) * 100) / 100,
      qtd_ignoradas: linhas.filter((l) => l.ignorada).length,
      com_ficha: linhasAtivas.filter((l) => l.tem_ficha).length,
      resumo,
      linhas,
      vinculos: vincRows || [],
      socios: socios || [],
      artistas: artistas || [],
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Erro interno' }, { status: 500 });
  }
}
