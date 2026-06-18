import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { fin, podeAprovar } from '@/lib/financeiro/pedidos-pagamento';

export const dynamic = 'force-dynamic';

/**
 * Base-mestre de beneficiários do Zykor (financial.beneficiarios) — fonte de verdade
 * de PIX + CPF + vínculo com o fornecedor do Conta Azul. Serve freela, fornecedor, sócio.
 *
 * GET  /api/financeiro/beneficiarios?tipo=freela&q=texto&ativos=1
 * POST /api/financeiro/beneficiarios
 *   { nome, cpf_cnpj, tipo, funcao?, chave_pix, tipo_chave, valor_padrao?,
 *     categoria_id?, categoria_nome?, contaazul_pessoa_id? }
 *   - se vier contaazul_pessoa_id, já registra o de-para (CA -> beneficiário).
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const supabase = await getAdminClient();
  let q = fin(supabase).from('beneficiarios').select('*').eq('bar_id', user.bar_id).order('nome');
  if (sp.get('tipo')) q = q.eq('tipo', sp.get('tipo'));
  if (sp.get('ativos') === '1') q = q.eq('ativo', true);
  const termo = (sp.get('q') || '').trim();
  if (termo) q = q.or(`nome.ilike.%${termo}%,cpf_cnpj.ilike.%${termo}%`);
  const { data, error } = await q.limit(500);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, beneficiarios: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });
  if (!podeAprovar(user)) return authErrorResponse('Sem permissão para gerenciar beneficiários', 403);

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 }); }

  const nome = String(body.nome || '').trim();
  if (!nome) return NextResponse.json({ success: false, error: 'nome é obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const novo = {
    bar_id: user.bar_id,
    nome,
    cpf_cnpj: body.cpf_cnpj ? String(body.cpf_cnpj).replace(/\D/g, '') : null,
    tipo: body.tipo || 'fornecedor',
    funcao: body.funcao || null,
    chave_pix: body.chave_pix ? String(body.chave_pix).trim() : null,
    tipo_chave: body.tipo_chave || null,
    valor_padrao: body.valor_padrao != null ? Math.round(Number(body.valor_padrao) * 100) / 100 : null,
    categoria_id: body.categoria_id || null,
    categoria_nome: body.categoria_nome || null,
    contaazul_pessoa_id: body.contaazul_pessoa_id || null,
    observacao: body.observacao || null,
    ativo: body.ativo !== false,
  };

  const { data, error } = await fin(supabase).from('beneficiarios').insert(novo).select().single();
  if (error) {
    // 23505 = violação do unique por CPF/CNPJ no bar
    if ((error as any).code === '23505') {
      return NextResponse.json({ success: false, error: 'Já existe um beneficiário com esse CPF/CNPJ neste bar' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Vincula o fornecedor do CA ao beneficiário (de-para p/ centralizar histórico)
  if (novo.contaazul_pessoa_id) {
    await fin(supabase).from('beneficiario_contaazul_map').upsert({
      bar_id: user.bar_id, contaazul_pessoa_id: novo.contaazul_pessoa_id,
      beneficiario_id: data.id, origem: 'manual',
    }, { onConflict: 'bar_id,contaazul_pessoa_id' });
  }

  return NextResponse.json({ success: true, beneficiario: data });
}
