import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';

/** GET ?mes= -> aniversariantes (nascimento) e aniversários de empresa (admissão) do mês. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const mes = Number(new URL(request.url).searchParams.get('mes')) || (new Date().getMonth() + 1);
  const anoAtual = new Date().getFullYear();

  const supabase = await getAdminClient();
  const { data: funcs, error } = await (supabase as any).schema('hr').from('funcionarios')
    .select('id, nome, data_nascimento, data_admissao')
    .eq('bar_id', user.bar_id).eq('ativo', true);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const mesDe = (d: string | null) => d ? Number(d.split('-')[1]) : null;
  const diaDe = (d: string | null) => d ? Number(d.split('-')[2]) : null;

  const niver = (funcs || []).filter((f: any) => mesDe(f.data_nascimento) === mes).map((f: any) => ({
    id: f.id, nome: f.nome, dia: diaDe(f.data_nascimento),
    idade: f.data_nascimento ? anoAtual - Number(f.data_nascimento.split('-')[0]) : null,
  })).sort((a: any, b: any) => (a.dia || 0) - (b.dia || 0));

  const empresa = (funcs || []).filter((f: any) => mesDe(f.data_admissao) === mes).map((f: any) => ({
    id: f.id, nome: f.nome, dia: diaDe(f.data_admissao),
    anos: f.data_admissao ? anoAtual - Number(f.data_admissao.split('-')[0]) : null,
  })).filter((e: any) => (e.anos || 0) >= 1).sort((a: any, b: any) => (a.dia || 0) - (b.dia || 0));

  return NextResponse.json({ success: true, mes, aniversariantes: niver, aniversarios_empresa: empresa });
}
