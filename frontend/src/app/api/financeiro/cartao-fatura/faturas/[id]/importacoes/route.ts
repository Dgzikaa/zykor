import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import { fin } from '@/lib/financeiro/pedidos-pagamento';
import { paginate } from '@/lib/supabase/paginate';

export const dynamic = 'force-dynamic';

// =====================================================
// Lotes de IMPORTAÇÃO de uma fatura de cartão.
//
// Um "lote" = as linhas que entraram juntas num upload. Não existe coluna de lote:
// agrupamos por (importado_em truncado no MINUTO + importado_por), que é o que a
// importação já grava. Serve pra desfazer/mover um upload feito no cartão errado
// sem precisar excluir a fatura inteira (que levaria junto os outros uploads).
// =====================================================

type LinhaLote = {
  id: string;
  dedupe_hash: string;
  valor: number | null;
  cartao_final: string | null;
  status: string | null;
  contaazul_lancamento_id: string | null;
  importado_em: string | null;
  importado_por: string | null;
};

/** Chave do lote: minuto do import + quem importou (o mesmo critério nos dois handlers). */
const chaveLote = (importadoEm: string | null, importadoPor: string | null) =>
  `${String(importadoEm || '').slice(0, 16)}|${importadoPor || ''}`;

/** Carrega a fatura garantindo que é do bar do usuário. */
async function getFatura(supabase: any, id: string, barId: number) {
  const { data } = await fin(supabase)
    .from('cartao_faturas').select('id, bar_id, status, cartao_id, vencimento').eq('id', id).maybeSingle();
  if (!data || data.bar_id !== barId) return null;
  return data;
}

/** Todas as linhas da fatura (paginado — fatura grande passa de 1000 linhas). */
async function linhasDaFatura(supabase: any, faturaId: string): Promise<LinhaLote[]> {
  return await paginate<LinhaLote>(() =>
    fin(supabase)
      .from('cartao_fatura_linhas')
      .select('id, dedupe_hash, valor, cartao_final, status, contaazul_lancamento_id, importado_em, importado_por')
      .eq('fatura_id', faturaId)
      .order('id'),
  );
}

// -----------------------------------------------------
// GET — lista os lotes de importação da fatura.
// -----------------------------------------------------
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.pedidos, 'ver')) return permissionErrorResponse('Sem permissão');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });
  const { id } = await params;

  const supabase = await getAdminClient();
  const fatura = await getFatura(supabase, id, user.bar_id);
  if (!fatura) return NextResponse.json({ success: false, error: 'Fatura não encontrada' }, { status: 404 });

  const linhas = await linhasDaFatura(supabase, id);

  const mapa = new Map<string, {
    importado_em: string | null; importado_por: string | null;
    linhas: number; total: number; lancadas: number; finais: Set<string>;
  }>();
  for (const l of linhas) {
    const k = chaveLote(l.importado_em, l.importado_por);
    let lote = mapa.get(k);
    if (!lote) {
      lote = { importado_em: l.importado_em, importado_por: l.importado_por, linhas: 0, total: 0, lancadas: 0, finais: new Set() };
      mapa.set(k, lote);
    }
    lote.linhas += 1;
    lote.total += Number(l.valor) || 0;
    if (l.status === 'lancado' || l.contaazul_lancamento_id) lote.lancadas += 1;
    if (l.cartao_final) lote.finais.add(l.cartao_final);
  }

  // Nome de quem importou (usuarios.auth_id === importado_por).
  const authIds = [...new Set([...mapa.values()].map(l => l.importado_por).filter(Boolean))] as string[];
  const nomePorAuth = new Map<string, string>();
  if (authIds.length) {
    const { data: users } = await supabase.from('usuarios').select('auth_id, nome').in('auth_id', authIds);
    (users || []).forEach((u: any) => nomePorAuth.set(u.auth_id, u.nome));
  }

  const lotes = [...mapa.values()]
    .map(l => ({
      importado_em: l.importado_em,
      importado_por: l.importado_por,
      importado_por_nome: (l.importado_por && nomePorAuth.get(l.importado_por)) || 'desconhecido',
      linhas: l.linhas,
      total: Math.round(l.total * 100) / 100,
      lancadas: l.lancadas,
      finais: [...l.finais].sort(),
    }))
    .sort((a, b) => String(b.importado_em || '').localeCompare(String(a.importado_em || '')));

  return NextResponse.json({ success: true, lotes });
}

// -----------------------------------------------------
// POST — desfaz (exclui) ou move um lote pra outra fatura.
// body: { importado_em, importado_por, acao: 'excluir' | 'mover', fatura_destino_id? }
// ?force=1 libera quando há linhas já lançadas no Conta Azul.
// -----------------------------------------------------
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });
  const { id } = await params;

  const body = await request.json().catch(() => ({} as any));
  const acao = body.acao === 'mover' ? 'mover' : body.acao === 'excluir' ? 'excluir' : null;
  if (!acao) return NextResponse.json({ success: false, error: "acao deve ser 'excluir' ou 'mover'" }, { status: 400 });

  // Excluir exige permissão de exclusão; mover é uma edição.
  const perm = acao === 'excluir' ? 'excluir' : 'editar';
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.pedidos, perm)) {
    return permissionErrorResponse(`Sem permissão para ${acao === 'excluir' ? 'excluir' : 'mover'} importações`);
  }

  const force = new URL(request.url).searchParams.get('force') === '1';
  const supabase = await getAdminClient();

  const fatura = await getFatura(supabase, id, user.bar_id);
  if (!fatura) return NextResponse.json({ success: false, error: 'Fatura não encontrada' }, { status: 404 });
  if (fatura.status !== 'aberta') {
    return NextResponse.json({ success: false, error: 'Fatura encerrada — reabra antes de mexer nas importações' }, { status: 409 });
  }

  // Seleciona o lote pelo mesmo critério do GET (minuto + quem importou).
  const alvo = chaveLote(String(body.importado_em || ''), String(body.importado_por || ''));
  const todas = await linhasDaFatura(supabase, id);
  const doLote = todas.filter(l => chaveLote(l.importado_em, l.importado_por) === alvo);
  if (!doLote.length) return NextResponse.json({ success: false, error: 'Importação não encontrada nesta fatura' }, { status: 404 });

  // Linha já lançada no CA: excluir/mover aqui NÃO remove do Conta Azul (o CA v2 não tem
  // DELETE de lançamento). Mesmo padrão do DELETE da fatura: 409 + requer_force.
  const lancadas = doLote.filter(l => l.status === 'lancado' || l.contaazul_lancamento_id).length;
  if (lancadas > 0 && !force) {
    return NextResponse.json({
      success: false, requer_force: true, lancadas,
      error: `${lancadas} linha(s) desta importação já foram lançadas no Conta Azul. Mexer aqui NÃO remove do CA — confirme para prosseguir.`,
    }, { status: 409 });
  }

  const ids = doLote.map(l => l.id);
  const chunk = <T,>(arr: T[], n: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  try {
    if (acao === 'excluir') {
      for (const lote of chunk(ids, 200)) {
        const { error } = await fin(supabase).from('cartao_fatura_linhas').delete().in('id', lote);
        if (error) throw new Error(error.message);
      }
      return NextResponse.json({ success: true, acao, excluidas: ids.length });
    }

    // ---- mover ----
    const destinoId = String(body.fatura_destino_id || '');
    if (!destinoId) return NextResponse.json({ success: false, error: 'Escolha a fatura de destino' }, { status: 400 });
    if (destinoId === id) return NextResponse.json({ success: false, error: 'A fatura de destino é a mesma de origem' }, { status: 400 });

    const destino = await getFatura(supabase, destinoId, user.bar_id);
    if (!destino) return NextResponse.json({ success: false, error: 'Fatura de destino não encontrada' }, { status: 404 });
    if (destino.status !== 'aberta') {
      return NextResponse.json({ success: false, error: 'A fatura de destino está encerrada — reabra antes de mover' }, { status: 409 });
    }

    // O UNIQUE é (fatura_id, dedupe_hash): o que já existe no destino não pode ser movido.
    // Essas linhas são a MESMA transação já registrada lá → descarta (apaga da origem).
    const hashes = doLote.map(l => l.dedupe_hash).filter(Boolean);
    const jaNoDestino = new Set<string>();
    for (const lote of chunk(hashes, 50)) {
      const { data, error } = await fin(supabase)
        .from('cartao_fatura_linhas').select('dedupe_hash').eq('fatura_id', destinoId).in('dedupe_hash', lote);
      if (error) throw new Error(error.message);
      (data || []).forEach((r: any) => jaNoDestino.add(r.dedupe_hash));
    }

    const mover = doLote.filter(l => !jaNoDestino.has(l.dedupe_hash)).map(l => l.id);
    const descartar = doLote.filter(l => jaNoDestino.has(l.dedupe_hash)).map(l => l.id);

    for (const lote of chunk(mover, 200)) {
      const { error } = await fin(supabase).from('cartao_fatura_linhas')
        .update({ fatura_id: destinoId, atualizado_em: new Date().toISOString() }).in('id', lote);
      if (error) throw new Error(error.message);
    }
    for (const lote of chunk(descartar, 200)) {
      const { error } = await fin(supabase).from('cartao_fatura_linhas').delete().in('id', lote);
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({
      success: true, acao,
      movidas: mover.length,
      descartadas_por_duplicidade: descartar.length,
      fatura_destino_id: destinoId,
    });
  } catch (e: any) {
    console.error('[CARTAO-FATURA][IMPORTACOES]', e);
    return NextResponse.json({ success: false, error: e?.message || 'Erro ao processar a importação' }, { status: 500 });
  }
}
