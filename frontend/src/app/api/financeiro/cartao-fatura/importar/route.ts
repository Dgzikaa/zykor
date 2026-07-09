import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeFerramentaFinanceira, FERRAMENTA_FINANCEIRA } from '@/lib/auth/financeiro-guard';
import { fin } from '@/lib/financeiro/pedidos-pagamento';
import { parseFaturaCartao } from '@/lib/financeiro/cartaoFatura/parse';

export const dynamic = 'force-dynamic';

// =====================================================
// POST — importa uma fatura de cartão (Itaú .xls/.xlsx | Nubank .csv/.ofx).
//   Detecta o banco, normaliza as linhas e DEDUPLICA (dedupe_hash / FITID):
//   linhas já vistas em importações anteriores são preservadas (status/categoria/bar),
//   só as novas entram como 'novo'. Devolve o conjunto todo da fatura.
// =====================================================
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!podeFerramentaFinanceira(user, FERRAMENTA_FINANCEIRA.pedidos, 'inserir')) return permissionErrorResponse('Sem permissão para importar faturas');

  let file: File | null = null;
  let faturaId = '';
  try {
    const form = await request.formData();
    file = form.get('file') as File | null;
    faturaId = String(form.get('fatura_id') || '');
  } catch {
    return NextResponse.json({ success: false, error: 'Envie o arquivo em multipart/form-data' }, { status: 400 });
  }
  if (!file) return NextResponse.json({ success: false, error: 'Arquivo não enviado' }, { status: 400 });
  if (!faturaId) return NextResponse.json({ success: false, error: 'Selecione a fatura antes de importar' }, { status: 400 });

  // Fatura precisa existir, ser do bar do usuário e estar ABERTA.
  const supabaseFat = await getAdminClient();
  const { data: fatura } = await fin(supabaseFat).from('cartao_faturas').select('id, bar_id, status').eq('id', faturaId).maybeSingle();
  if (!fatura || fatura.bar_id !== user.bar_id) {
    return NextResponse.json({ success: false, error: 'Fatura não encontrada' }, { status: 404 });
  }
  if (fatura.status !== 'aberta') {
    return NextResponse.json({ success: false, error: 'Fatura encerrada — reabra pra importar de novo' }, { status: 409 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = parseFaturaCartao(buffer, file.name);
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Falha ao ler o arquivo' }, { status: 400 });
  }

  const linhas = parsed.linhas;
  if (!linhas.length) {
    return NextResponse.json({
      success: true, banco: parsed.banco, formato: parsed.formato,
      importadas: 0, novos: 0, ja_vistos: 0, linhas: [],
      aviso: 'Nenhuma linha reconhecida no arquivo.',
    });
  }

  const supabase = await getAdminClient();
  const hashes = linhas.map(l => l.dedupe_hash);
  const chunk = <T,>(arr: T[], n: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  try {
    // Dedupe DENTRO DA FATURA (reimportar a mesma fatura atualiza; faturas são independentes).
    const existentesSet = new Set<string>();
    for (const lote of chunk(hashes, 50)) {
      const { data, error } = await fin(supabase)
        .from('cartao_fatura_linhas').select('dedupe_hash').eq('fatura_id', faturaId).in('dedupe_hash', lote);
      if (error) throw new Error(error.message);
      (data || []).forEach((r: any) => existentesSet.add(r.dedupe_hash));
    }

    const novos = linhas.filter(l => !existentesSet.has(l.dedupe_hash));
    if (novos.length) {
      const rows = novos.map(l => ({
        fatura_id: faturaId,
        bar_id: fatura.bar_id,
        dedupe_hash: l.dedupe_hash,
        banco: l.banco,
        origem_formato: l.origem_formato,
        fitid: l.fitid,
        data_transacao: l.data_transacao,
        descricao: l.descricao,
        valor: l.valor,
        tipo: l.tipo,
        parcela: l.parcela,
        cartao_final: l.cartao_final,
        titular_nome: l.titular_nome,
        status: 'novo',
        importado_por: user.auth_id,
      }));
      for (const lote of chunk(rows, 200)) {
        const { error } = await fin(supabase).from('cartao_fatura_linhas').insert(lote);
        if (error) throw new Error(error.message);
      }
    }

    // Devolve TODAS as linhas da fatura (novas + já vistas, com o status atual).
    const { data: todasData, error: errTodas } = await fin(supabase)
      .from('cartao_fatura_linhas').select('*').eq('fatura_id', faturaId).order('data_transacao', { ascending: false });
    if (errTodas) throw new Error(errTodas.message);
    const todas = todasData || [];

    return NextResponse.json({
      success: true,
      banco: parsed.banco,
      formato: parsed.formato,
      importadas: linhas.length,
      novos: novos.length,
      ja_vistos: linhas.length - novos.length,
      linhas: todas,
    });
  } catch (e: any) {
    console.error('[CARTAO-FATURA][IMPORT]', e);
    return NextResponse.json({ success: false, error: e?.message || 'Erro ao importar a fatura' }, { status: 500 });
  }
}
