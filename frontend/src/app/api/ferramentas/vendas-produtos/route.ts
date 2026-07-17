import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createServiceRoleClient();

/**
 * Consulta de vendas de produtos — espelha o "sintético" do ContaHub mas com filtros
 * que o CH não expõe (grupo, local, garçom, tipo de venda, produto).
 *
 * GET ?data_inicio=&data_fim=&produto=&grupos=A,B&locais=X&garcons=Y&tipos=Z
 * Retorna { total, agregado:[{produto,grupo,qtd,valor,...}], filtros:{grupos,locais,garcons,tipos} }
 */
const csvArr = (s: string | null) =>
  (s || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

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

  const produto = (sp.get('produto') || '').trim() || null;
  const grupos = csvArr(sp.get('grupos'));
  const locais = csvArr(sp.get('locais'));
  const garcons = csvArr(sp.get('garcons'));
  const tipos = csvArr(sp.get('tipos'));

  const { data, error } = await (supabase as any).schema('gold').rpc('consulta_vendas_produtos', {
    p_bar_id: Number(user.bar_id),
    p_data_inicio: dataInicio,
    p_data_fim: dataFim,
    p_produto: produto,
    p_grupos: grupos.length ? grupos : null,
    p_locais: locais.length ? locais : null,
    p_garcons: garcons.length ? garcons : null,
    p_tipos: tipos.length ? tipos : null,
  });

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    data_inicio: dataInicio,
    data_fim: dataFim,
    total: data?.total ?? { qtd: 0, valor: 0, desconto: 0, custo: 0, linhas: 0, produtos: 0 },
    agregado: data?.agregado ?? [],
    filtros: data?.filtros ?? { grupos: [], locais: [], garcons: [], tipos: [] },
  });
}
