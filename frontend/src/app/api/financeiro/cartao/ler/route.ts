import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { fin } from '@/lib/financeiro/pedidos-pagamento';
import Anthropic from '@anthropic-ai/sdk';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Lê uma FATURA de cartão (foto/PDF) com IA e devolve as linhas + categoria sugerida.
 * A sugestão usa (1) o de-para que APRENDE (financial.cartao_categoria_map) e
 * (2) a IA escolhendo entre as categorias que o bar REALMENTE usa.
 * POST /api/financeiro/cartao/ler  (multipart: file)
 * Retorna { linhas: [{data, descricao, valor, categoria_nome, origem}], categorias: [...] }
 */
const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ success: false, error: 'IA não configurada' }, { status: 500 });

  let file: File | null = null;
  try { file = (await request.formData()).get('file') as File | null; }
  catch { return NextResponse.json({ success: false, error: 'envie o arquivo (multipart)' }, { status: 400 }); }
  if (!file) return NextResponse.json({ success: false, error: 'fatura é obrigatória' }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ success: false, error: 'arquivo acima de 15MB' }, { status: 400 });

  // Tipo de arquivo: aqui é só foto/PDF (IA lê a imagem). Planilha/OFX/CSV vão na aba "Fatura Cartão".
  const nomeArq = (file.name || '').toLowerCase();
  if (/\.(xls|xlsx|ofx|csv)$/.test(nomeArq)) {
    return NextResponse.json({
      success: false,
      error: 'Arquivo de extrato (.xls/.xlsx/.ofx/.csv) deve ser importado na aba "Fatura Cartão". Esta aba lê só foto ou PDF da fatura.',
    }, { status: 400 });
  }
  const mimeArq = file.type || '';
  if (!(mimeArq === 'application/pdf' || /\.pdf$/.test(nomeArq) || mimeArq.startsWith('image/'))) {
    return NextResponse.json({ success: false, error: 'Envie uma foto (imagem) ou PDF da fatura.' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  // Categorias reais do bar + de-para aprendido
  const [{ data: cats }, { data: mapRows }] = await Promise.all([
    fin(supabase).from('categorias_despesa_usadas').select('categoria_id, categoria_nome, n').eq('bar_id', user.bar_id).order('n', { ascending: false }).limit(80),
    fin(supabase).from('cartao_categoria_map').select('keyword, categoria_id, categoria_nome').eq('bar_id', user.bar_id),
  ]);
  const categorias = (cats || []).map((c: any) => ({ categoria_id: c.categoria_id, categoria_nome: c.categoria_nome }));
  const aprendido: Array<{ keyword: string; categoria_id: string; categoria_nome: string }> = (mapRows || []) as any;

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  const mime = file.type || 'application/pdf';
  const isPdf = mime === 'application/pdf';
  const block: any = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } };

  const listaCats = categorias.map((c: any) => c.categoria_nome).join(' | ');
  const prompt = `Você lê FATURAS DE CARTÃO DE CRÉDITO. Extraia TODAS as transações (linhas de compra).
Para cada linha, escolha a categoria mais provável APENAS da lista abaixo (ou null se nenhuma servir).
CATEGORIAS DISPONÍVEIS: ${listaCats}
Responda APENAS com JSON válido:
{ "linhas": [ { "data": "AAAA-MM-DD" | null, "descricao": string, "valor": number, "categoria_nome": string | null } ] }
Ignore linhas de pagamento da fatura anterior, juros, IOF e saldo. Some parcelamentos como aparecem.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      messages: [{ role: 'user', content: [block, { type: 'text', text: prompt }] }],
    });
    const texto = msg.content[0]?.type === 'text' ? msg.content[0].text : '';
    const m = texto.match(/\{[\s\S]*\}/);
    if (!m) return NextResponse.json({ success: false, error: 'não consegui ler a fatura', bruto: texto.slice(0, 500) }, { status: 422 });
    const parsed = JSON.parse(m[0]);
    const linhasRaw: any[] = Array.isArray(parsed.linhas) ? parsed.linhas : [];

    // de-para aprendido tem prioridade sobre a sugestão da IA
    const linhas = linhasRaw.map((l) => {
      const desc = String(l.descricao || '');
      const dn = norm(desc);
      const hit = aprendido.find((a) => a.keyword && dn.includes(a.keyword));
      const catNome = hit?.categoria_nome || l.categoria_nome || null;
      const catId = hit?.categoria_id || categorias.find((c: any) => c.categoria_nome === l.categoria_nome)?.categoria_id || null;
      return {
        data: l.data || null,
        descricao: desc,
        valor: typeof l.valor === 'number' ? l.valor : Number(String(l.valor).replace(/[R$\s.]/g, '').replace(',', '.')) || 0,
        categoria_id: catId,
        categoria_nome: catNome,
        origem: hit ? 'aprendido' : (l.categoria_nome ? 'ia' : 'sem_sugestao'),
      };
    }).filter((l) => l.valor > 0);

    const total = linhas.reduce((s, l) => s + l.valor, 0);
    return NextResponse.json({ success: true, linhas, categorias, total });
  } catch (e: any) {
    console.error('[cartao/ler]', e);
    return NextResponse.json({ success: false, error: e?.message || 'erro na leitura por IA' }, { status: 500 });
  }
}
