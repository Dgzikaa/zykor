import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Cadastro de itens de Limpeza (L0XXX) e Utensílio (u0XXX) na Estoque-Histórico.
// Código é AUTO-GERADO (próximo da sequência por classe). Insumo "comum" tem sua
// própria tela (/operacional/insumos); aqui é só limpeza/utensílio.
// Limpeza usa 'L' (e não 'd') p/ não colidir com o código de produto Drink (dXXXX).
const PREFIXO: Record<string, string> = { limpeza: 'L', utensilio: 'u' };

function classeValida(c: unknown): c is 'limpeza' | 'utensilio' {
  return c === 'limpeza' || c === 'utensilio';
}

const numOuNull = (v: unknown): number | null => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

async function proximoCodigo(ops: any, barId: number, classe: string): Promise<string> {
  const pref = PREFIXO[classe];
  const { data } = await ops.from('insumos').select('codigo').eq('bar_id', barId).eq('classe', classe);
  let max = 0;
  for (const r of data || []) {
    const n = parseInt(String(r.codigo).replace(/\D/g, ''), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${pref}${String(max + 1).padStart(4, '0')}`;
}

// GET ?classe=limpeza|utensilio → catálogo do bar
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const classe = new URL(request.url).searchParams.get('classe') || '';
  if (!classeValida(classe)) return NextResponse.json({ success: false, error: 'classe inválida' }, { status: 400 });

  const { data, error } = await (sb() as any).schema('operations')
    .from('insumos')
    .select('id, codigo, nome, categoria, secao, tipo_local, unidade_medida, unidade_contagem, fator_contagem, estoque_ideal, estoque_min, estoque_max, custo_unitario, ativo')
    .eq('bar_id', user.bar_id).eq('classe', classe).eq('ativo', true)
    .order('codigo', { ascending: true });
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, classe, itens: data || [] });
}

// POST { action: 'criar'|'editar'|'excluir', ... }
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });
  const barId = user.bar_id;

  const body = await request.json().catch(() => ({}));
  const ops = (sb() as any).schema('operations');

  if (body.action === 'excluir') {
    if (!body.id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
    const { error } = await ops.from('insumos').update({ ativo: false }).eq('id', body.id).eq('bar_id', barId);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const classe = body.classe;
  if (!classeValida(classe)) return NextResponse.json({ success: false, error: 'classe inválida' }, { status: 400 });
  const nome = String(body.nome || '').trim();
  if (!nome) return NextResponse.json({ success: false, error: 'Nome é obrigatório' }, { status: 400 });

  // Utensílio: seção define o Local de Contagem; Limpeza fica no local 'limpeza'.
  const secao = body.secao ? String(body.secao).trim() : null;
  const tipo_local = classe === 'utensilio'
    ? (secao || 'cozinha').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    : 'limpeza';
  const categoria = classe === 'utensilio' ? (secao || null) : (body.categoria ? String(body.categoria).trim() : null);

  const campos: Record<string, any> = {
    nome,
    categoria,
    secao: classe === 'utensilio' ? secao : null,
    tipo_local,
    custo_unitario: numOuNull(body.preco) ?? 0,
    estoque_ideal: classe === 'limpeza' ? numOuNull(body.estoque_ideal) : null,
    estoque_min: classe === 'utensilio' ? numOuNull(body.estoque_min) : null,
    estoque_max: classe === 'utensilio' ? numOuNull(body.estoque_max) : null,
    unidade_medida: body.unidade_medida ? String(body.unidade_medida) : 'unid',
    unidade_contagem: body.unidade_contagem ? String(body.unidade_contagem) : 'unid',
    fator_contagem: numOuNull(body.fator_contagem) ?? 1,
  };

  if (body.action === 'editar') {
    if (!body.id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });
    const { error } = await ops.from('insumos').update(campos).eq('id', body.id).eq('bar_id', barId);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === 'criar') {
    const codigo = await proximoCodigo(ops, barId, classe);
    const { data, error } = await ops.from('insumos').insert({
      bar_id: barId, codigo, classe, frequencia: 'semanal', ativo: true, ...campos,
    }).select('id, codigo').single();
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: data?.id, codigo: data?.codigo });
  }

  return NextResponse.json({ success: false, error: 'ação inválida' }, { status: 400 });
}
