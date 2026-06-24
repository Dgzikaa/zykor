import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** GET ?id=&mes=&ano= -> funcionário + folha do mês (se houver) p/ gerar o recibo/holerite. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const id = Number(sp.get('id'));
  const mes = Number(sp.get('mes'));
  const ano = Number(sp.get('ano'));
  if (!id) return NextResponse.json({ success: false, error: 'id obrigatório' }, { status: 400 });

  const supabase = await getAdminClient();
  const { data: funcionario } = await (supabase as any).schema('hr').from('funcionarios')
    .select('id, nome, cpf, cargo_id, area_id, tipo_contratacao, salario_base, valor_diaria, data_admissao, chave_pix, tipo_chave_pix')
    .eq('id', id).eq('bar_id', user.bar_id).maybeSingle();
  if (!funcionario) return NextResponse.json({ success: false, error: 'Funcionário não encontrado' }, { status: 404 });

  let folha = null;
  if (mes && ano) {
    const { data } = await (supabase as any).schema('hr').from('folha_pagamento')
      .select('*').eq('funcionario_id', id).eq('mes', mes).eq('ano', ano).maybeSingle();
    folha = data || null;
  }

  // nomes de cargo/área p/ o cabeçalho do recibo
  const [{ data: cargo }, { data: area }] = await Promise.all([
    funcionario.cargo_id ? (supabase as any).schema('hr').from('cargos').select('nome').eq('id', funcionario.cargo_id).maybeSingle() : Promise.resolve({ data: null }),
    funcionario.area_id ? (supabase as any).schema('hr').from('areas').select('nome').eq('id', funcionario.area_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({
    success: true,
    funcionario: { ...funcionario, cargo_nome: cargo?.nome || null, area_nome: area?.nome || null },
    folha,
  });
}
