import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { comentarioSistema, formatBRL } from '@/lib/financeiro/pedidos-pagamento';
import { calcularCache, resumoNegociacao, type BasesEvento } from '@/lib/artistas/cache';

export const dynamic = 'force-dynamic';

/**
 * Cachês a pagar — o cachê calculado da negociação de cada artista, show a show.
 *
 * GET  ?mes=AAAA-MM  lista os shows JÁ REALIZADOS do mês com o cachê calculado e o que já foi
 *                    lançado. Só passado: cachê de show que ainda não aconteceu é chute, e o
 *                    faturamento que alimenta o % ainda não existe.
 * POST               confirma um lote → 1 pedido_pagamento (tipo 'atracao', aguardando_aprovacao)
 *                    por show, e o financeiro aprova/agenda no motor que já existe.
 *
 * O valor é SEMPRE recalculado aqui no POST, nunca aceito do cliente: a tela mostra uma prévia,
 * mas quem manda dinheiro pro PIX é o servidor.
 */

const NEG_CAMPOS = 'id, nome, tipo_acordo, cachet_combinado, percentual_sociedade, base_calculo, favorecido_nome, chave_pix, tipo_chave, cpf_cnpj, contaazul_pessoa_id';

const hojeBRT = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());

/** Mês de referência → primeiro e último dia. */
function janelaDoMes(mes: string): { ini: string; fim: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!m) return null;
  const ano = Number(m[1]); const mm = Number(m[2]);
  if (mm < 1 || mm > 12) return null;
  const ultimo = new Date(Date.UTC(ano, mm, 0)).getUTCDate();
  return { ini: `${m[1]}-${m[2]}-01`, fim: `${m[1]}-${m[2]}-${String(ultimo).padStart(2, '0')}` };
}

const mesAtual = () => hojeBRT().slice(0, 7);

const basesDoEvento = (e: any): BasesEvento => ({
  total: Number(e.real_r) || 0,
  entrada: Number(e.faturamento_entrada) || 0,
  bar: Number(e.faturamento_bar) || 0,
});

/** Categoria "Atrações Programação" do bar — o id do Conta Azul muda por casa. */
async function categoriaAtracoes(supabase: any, barId: number) {
  const { data } = await supabase.schema('financial')
    .from('categorias_despesa_usadas')
    .select('categoria_id, categoria_nome, n')
    .eq('bar_id', barId)
    .ilike('categoria_nome', 'Atra%Programa%')
    .order('n', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { id: data.categoria_id as string, nome: data.categoria_nome as string } : null;
}

/**
 * Monta as linhas do mês: evento → artistas taggeados → negociação → cachê.
 * Reaproveitado pelo GET e pelo POST justamente pra os dois calcularem igual.
 */
async function montarLinhas(supabase: any, barId: number, ini: string, fim: string) {
  const ops = (t: string) => supabase.schema('operations').from(t);
  const limite = hojeBRT();
  const fimReal = fim < limite ? fim : limite;

  const { data: eventos, error: errEv } = await ops('eventos_base')
    .select('id, data_evento, nome, real_r, faturamento_entrada, faturamento_bar')
    .eq('bar_id', barId)
    .gte('data_evento', ini)
    .lte('data_evento', fimReal)
    .order('data_evento', { ascending: false });
  if (errEv) throw new Error(errEv.message);

  const lista = (eventos || []) as any[];
  if (!lista.length) return [];
  const ids = lista.map((e) => e.id);

  const [{ data: tags }, { data: lancados }] = await Promise.all([
    ops('evento_artistas').select('evento_id, artista_id, artista_nome, ordem').in('evento_id', ids),
    ops('artista_cache_lancamento').select('evento_id, artista_id, valor, pedido_id, criado_em, criado_por').in('evento_id', ids),
  ]);

  const artistaIds = [...new Set(((tags || []) as any[]).map((t) => t.artista_id).filter(Boolean))];
  const { data: cadastro } = artistaIds.length
    ? await ops('bar_artistas').select(NEG_CAMPOS).eq('bar_id', barId).in('id', artistaIds)
    : { data: [] as any[] };
  const negPor = new Map<number, any>(((cadastro || []) as any[]).map((a) => [a.id, a]));

  // Status do pedido: é o que diz se já foi aprovado/pago ou ainda está na fila do financeiro.
  const pedidoIds = ((lancados || []) as any[]).map((l) => l.pedido_id).filter(Boolean);
  const { data: pedidos } = pedidoIds.length
    ? await supabase.schema('financial').from('pedidos_pagamento').select('id, status, numero').in('id', pedidoIds)
    : { data: [] as any[] };
  const pedidoPor = new Map<string, any>(((pedidos || []) as any[]).map((p) => [p.id, p]));

  const lancadoPor = new Map<string, any>();
  for (const l of (lancados || []) as any[]) lancadoPor.set(`${l.evento_id}:${l.artista_id}`, l);

  const tagsPor = new Map<number, any[]>();
  for (const t of (tags || []) as any[]) {
    const arr = tagsPor.get(t.evento_id) ?? [];
    arr.push(t);
    tagsPor.set(t.evento_id, arr);
  }

  return lista.map((e) => {
    const bases = basesDoEvento(e);
    const artistas = (tagsPor.get(e.id) || [])
      .sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99))
      .map((t) => {
        const neg = t.artista_id ? negPor.get(t.artista_id) : null;
        const calc = calcularCache(neg, bases);
        const lanc = lancadoPor.get(`${e.id}:${t.artista_id}`);
        const pedido = lanc?.pedido_id ? pedidoPor.get(lanc.pedido_id) : null;
        return {
          artista_id: t.artista_id,
          nome: t.artista_nome || neg?.nome || '—',
          negociacao: neg ? resumoNegociacao(neg) : 'Sem negociação',
          tem_negociacao: Boolean(neg?.tipo_acordo),
          // Sem PIX o pedido nasce incompleto e trava na mão do financeiro — melhor avisar aqui.
          tem_pix: Boolean(neg?.chave_pix),
          favorecido: neg?.favorecido_nome || t.artista_nome || neg?.nome || null,
          valor: calc.valor,
          formula: calc.formula,
          motivo: calc.motivo || null,
          base_valor: calc.base_valor,
          base_calculo: calc.base_calculo,
          lancado: Boolean(lanc),
          lancado_valor: lanc ? Number(lanc.valor) : null,
          lancado_em: lanc?.criado_em || null,
          lancado_por: lanc?.criado_por || null,
          pedido_id: lanc?.pedido_id || null,
          pedido_status: pedido?.status || null,
          pedido_numero: pedido?.numero || null,
        };
      });

    return {
      evento_id: e.id,
      data_evento: e.data_evento,
      nome: e.nome || '',
      faturamento_total: bases.total,
      faturamento_entrada: bases.entrada,
      faturamento_bar: bases.bar,
      artistas,
    };
  });
}

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const mes = String(new URL(request.url).searchParams.get('mes') || mesAtual());
  const janela = janelaDoMes(mes);
  if (!janela) return NextResponse.json({ success: false, error: 'mes inválido (AAAA-MM)' }, { status: 400 });

  const supabase = await getAdminClient();
  try {
    const [linhas, categoria] = await Promise.all([
      montarLinhas(supabase, user.bar_id, janela.ini, janela.fim),
      categoriaAtracoes(supabase, user.bar_id),
    ]);
    return NextResponse.json({ success: true, mes, linhas, categoria });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'falha ao montar os cachês' }, { status: 500 });
  }
}

/** POST — confirma o lote. body: { itens: [{evento_id, artista_id}], data_vencimento? } */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.ativo) return authErrorResponse('Usuário inativo', 403);
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }); }

  const itens: Array<{ evento_id: number; artista_id: number }> = Array.isArray(body.itens) ? body.itens : [];
  if (!itens.length) return NextResponse.json({ success: false, error: 'nenhum show no lote' }, { status: 400 });

  const vencimento = String(body.data_vencimento || '');
  if (vencimento && !/^\d{4}-\d{2}-\d{2}$/.test(vencimento)) {
    return NextResponse.json({ success: false, error: 'data_vencimento inválida (AAAA-MM-DD)' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const ops = (t: string) => (supabase as any).schema('operations').from(t);

  // Recalcula do zero, pela mesma função do GET. O cliente manda QUAIS shows, nunca QUANTO.
  const eventoIds = [...new Set(itens.map((i) => Number(i.evento_id)))];
  const { data: eventosDoLote } = await ops('eventos_base')
    .select('data_evento').eq('bar_id', user.bar_id).in('id', eventoIds);
  const datasLote = ((eventosDoLote || []) as any[]).map((e) => e.data_evento).sort();
  if (!datasLote.length) return NextResponse.json({ success: false, error: 'shows não encontrados neste bar' }, { status: 404 });

  const linhas = await montarLinhas(supabase, user.bar_id, datasLote[0], datasLote[datasLote.length - 1]);
  const porChave = new Map<string, { linha: any; artista: any }>();
  for (const l of linhas) for (const a of l.artistas) porChave.set(`${l.evento_id}:${a.artista_id}`, { linha: l, artista: a });

  const categoria = await categoriaAtracoes(supabase, user.bar_id);
  const cadastroIds = [...new Set(itens.map((i) => Number(i.artista_id)))];
  const { data: cadastro } = await ops('bar_artistas').select(NEG_CAMPOS).eq('bar_id', user.bar_id).in('id', cadastroIds);
  const negPor = new Map<number, any>(((cadastro || []) as any[]).map((a) => [a.id, a]));

  const criados: any[] = [];
  const erros: string[] = [];

  for (const it of itens) {
    const chave = `${Number(it.evento_id)}:${Number(it.artista_id)}`;
    const alvo = porChave.get(chave);
    if (!alvo) { erros.push(`show ${chave} não encontrado`); continue; }
    const { linha, artista } = alvo;
    if (artista.lancado) { erros.push(`${artista.nome} (${linha.data_evento}) já foi lançado`); continue; }
    if (artista.valor == null || artista.valor <= 0) {
      erros.push(`${artista.nome} (${linha.data_evento}): ${artista.motivo || 'sem valor calculado'}`);
      continue;
    }

    const neg = negPor.get(Number(it.artista_id));
    // Vencimento padrão = o dia do show. Artista é pago na noite ou logo depois; jogar pro "hoje"
    // colocaria um show antigo com data errada no Conta Azul.
    const venc = vencimento || linha.data_evento;

    const pedido = {
      bar_id: user.bar_id,
      tipo: 'atracao',
      status: 'aguardando_aprovacao',
      solicitante_id: user.auth_id,
      solicitante_nome: user.nome,
      descricao: `Cachê ${artista.nome} — ${linha.nome || 'show'} (${linha.data_evento})`,
      valor: artista.valor,
      data_competencia: linha.data_evento,
      data_vencimento: venc,
      beneficiario_nome: neg?.favorecido_nome || artista.nome,
      chave_pix: neg?.chave_pix || null,
      tipo_chave: neg?.tipo_chave || null,
      cpf_cnpj: neg?.cpf_cnpj || null,
      categoria_id: categoria?.id || null,
      categoria_nome: categoria?.nome || null,
      contaazul_pessoa_id: neg?.contaazul_pessoa_id || null,
      observacao: artista.formula,
      criado_por: user.auth_id,
      atualizado_por: user.auth_id,
    };

    const { data: novo, error: errPed } = await (supabase as any).schema('financial')
      .from('pedidos_pagamento').insert(pedido).select().single();
    if (errPed) { erros.push(`${artista.nome}: ${errPed.message}`); continue; }

    // O lançamento é o que impede pagar duas vezes (unique evento+artista). Se ele falhar, o
    // pedido não pode ficar de pé sozinho — sem a trava, o próximo clique geraria outro PIX.
    const { error: errLanc } = await ops('artista_cache_lancamento').insert({
      bar_id: user.bar_id,
      evento_id: linha.evento_id,
      artista_id: Number(it.artista_id),
      data_evento: linha.data_evento,
      valor: artista.valor,
      base_valor: artista.base_valor,
      regra: {
        tipo_acordo: neg?.tipo_acordo || null,
        cachet_combinado: neg?.cachet_combinado ?? null,
        percentual: neg?.percentual_sociedade ?? null,
        base_calculo: artista.base_calculo,
        formula: artista.formula,
      },
      pedido_id: novo.id,
      criado_por: user.nome || user.email || null,
    });
    if (errLanc) {
      await (supabase as any).schema('financial').from('pedidos_pagamento').delete().eq('id', novo.id);
      erros.push(`${artista.nome}: ${errLanc.message}`);
      continue;
    }

    await comentarioSistema(supabase, {
      pedido_id: novo.id, bar_id: user.bar_id,
      mensagem: `Cachê calculado pela negociação e confirmado por ${user.nome} — ${formatBRL(novo.valor)}. ${artista.formula}`,
    });
    criados.push(novo);
  }

  if (!criados.length) {
    return NextResponse.json({ success: false, error: 'nada foi lançado', detalhes: erros }, { status: 400 });
  }
  const total = criados.reduce((s, p) => s + Number(p.valor || 0), 0);
  return NextResponse.json({ success: true, criados: criados.length, total, erros });
}
