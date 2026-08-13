import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/**
 * Organograma — derivado de `hr.funcionarios.gestor_id`.
 *
 * Não existe "estrutura do organograma" guardada em separado: a árvore é uma
 * leitura do cadastro. Isso é o que faz alguém desligado sumir do desenho
 * sozinho, sem manutenção — o contrário do que acontece no Canva hoje.
 *
 * Só entra quem está ativo. Uma pessoa cujo gestor foi desligado vira raiz até
 * alguém arrastá-la para o gestor novo (ver `raizes` no cliente).
 */

/** GET -> pessoas ativas do bar com o vínculo de gestor. */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  const [funcRes, cargosRes, areasRes] = await Promise.all([
    hr('funcionarios')
      .select('id, nome, cargo_id, area_id, gestor_id, foto_url, data_admissao, data_nascimento, tipo_contratacao')
      .eq('bar_id', user.bar_id).eq('ativo', true).order('nome'),
    hr('cargos').select('id, nome').eq('bar_id', user.bar_id),
    hr('areas').select('id, nome, cor').eq('bar_id', user.bar_id),
  ]);

  if (funcRes.error) return NextResponse.json({ error: funcRes.error.message }, { status: 500 });

  const cargoMap = new Map((cargosRes.data || []).map((c: any) => [c.id, c.nome]));
  const areaMap = new Map((areasRes.data || []).map((a: any) => [a.id, a]));

  const pessoas = (funcRes.data || []).map((f: any) => {
    const area = f.area_id ? areaMap.get(f.area_id) : null;
    return {
      id: f.id,
      nome: f.nome,
      gestor_id: f.gestor_id,
      cargo_nome: f.cargo_id ? cargoMap.get(f.cargo_id) || null : null,
      area_nome: (area as any)?.nome || null,
      area_cor: (area as any)?.cor || null,
      foto_url: f.foto_url,
      data_admissao: f.data_admissao,
      data_nascimento: f.data_nascimento,
      tipo_contratacao: f.tipo_contratacao,
    };
  });

  return NextResponse.json({ pessoas });
}

/** PUT -> define (ou limpa) o gestor de uma pessoa. Body: { funcionario_id, gestor_id } */
export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const funcionarioId = Number(body.funcionario_id);
  const gestorId = body.gestor_id == null || body.gestor_id === '' ? null : Number(body.gestor_id);

  if (!funcionarioId) return NextResponse.json({ error: 'funcionario_id obrigatório' }, { status: 400 });
  if (gestorId === funcionarioId) return NextResponse.json({ error: 'Alguém não pode ser gestor de si mesmo' }, { status: 400 });

  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);

  // As duas pessoas precisam ser do bar da sessão — sem isso dava pra pendurar
  // alguém do Ordinário sob um gestor do Deboche mandando o id na mão.
  const idsParaChecar = gestorId ? [funcionarioId, gestorId] : [funcionarioId];
  const { data: validos } = await hr('funcionarios').select('id').eq('bar_id', user.bar_id).in('id', idsParaChecar);
  if ((validos?.length || 0) !== idsParaChecar.length) {
    return NextResponse.json({ error: 'Funcionário não encontrado neste bar' }, { status: 404 });
  }

  const { error } = await hr('funcionarios').update({ gestor_id: gestorId }).eq('id', funcionarioId).eq('bar_id', user.bar_id);
  if (error) {
    // O trigger hr.fn_funcionario_gestor_sem_ciclo devolve mensagem legível —
    // repassa em vez de virar "erro interno".
    const ciclo = /ciclo|si mesmo/i.test(error.message);
    return NextResponse.json({ error: error.message }, { status: ciclo ? 400 : 500 });
  }

  return NextResponse.json({ success: true });
}
