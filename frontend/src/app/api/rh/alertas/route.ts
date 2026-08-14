import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { paginate } from '@/lib/supabase/paginate';
import { computarAlertas, type Alerta } from '@/lib/rh/alertas';

export const dynamic = 'force-dynamic';

/**
 * Alerta de RH — o `computarAlertas` do dossiê aplicado à base inteira (Fase 8 da ata).
 *
 * No dossiê o alerta só aparece quando alguém abre aquela pessoa. Quem precisa agir é o RH, que
 * não vai abrir 68 fichas pra descobrir quem está sem contrato. Aqui a mesma função roda pra
 * todo mundo de uma vez — a regra é uma só, não duas implementações que divergem com o tempo.
 *
 * GET /api/rh/alertas
 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);
  const bar = user.bar_id;

  const funcs = await paginate<any>(() => hr('funcionarios')
    .select('id, nome, ativo, cargo_id, data_admissao, data_fim_experiencia')
    .eq('bar_id', bar).eq('ativo', true).order('nome'), { label: 'hr.funcionarios' });
  const ids = funcs.map((f: any) => f.id);
  if (ids.length === 0) {
    return NextResponse.json({ success: true, linhas: [], resumo: { ativos: 0, com_pendencia: 0, limpos: 0 }, por_tipo: [] });
  }

  const [docs, ocorr, treinos, onb, cargos] = await Promise.all([
    // documentos_funcionario não tem bar_id — o recorte do bar vem pela lista de funcionários
    paginate<any>(() => hr('documentos_funcionario').select('funcionario_id, tipo, validade')
      .in('funcionario_id', ids), { label: 'hr.documentos_funcionario' }),
    paginate<any>(() => hr('funcionario_ocorrencias').select('funcionario_id, tipo, data_inicio')
      .eq('bar_id', bar), { label: 'hr.funcionario_ocorrencias' }),
    paginate<any>(() => hr('treinamentos').select('funcionario_id, nome, validade')
      .eq('bar_id', bar), { label: 'hr.treinamentos' }),
    paginate<any>(() => hr('onboarding_itens').select('funcionario_id, item, concluido, prazo')
      .eq('bar_id', bar), { label: 'hr.onboarding_itens' }),
    hr('cargos').select('id, nome').eq('bar_id', bar),
  ]);

  const agrupar = <T extends { funcionario_id: number }>(rows: T[]) => {
    const m = new Map<number, T[]>();
    for (const r of rows) {
      const at = m.get(r.funcionario_id); if (at) at.push(r); else m.set(r.funcionario_id, [r]);
    }
    return m;
  };
  const porDoc = agrupar(docs), porOc = agrupar(ocorr), porTr = agrupar(treinos), porOnb = agrupar(onb);
  const cargoNome = new Map<number, string>((cargos.data || []).map((c: any) => [c.id, c.nome]));

  const linhas = funcs.map((f: any) => {
    const alertas: Alerta[] = computarAlertas(
      f, porDoc.get(f.id) || [], porOc.get(f.id) || [], porTr.get(f.id) || [], porOnb.get(f.id) || [],
    );
    return {
      funcionario_id: f.id,
      nome: f.nome,
      cargo_nome: f.cargo_id ? cargoNome.get(f.cargo_id) || null : null,
      alertas,
      n_alerta: alertas.filter((a) => a.nivel === 'alerta').length,
      n_aviso: alertas.filter((a) => a.nivel === 'aviso').length,
    };
  });

  // quantas pessoas têm cada tipo de pendência — é por aí que o RH decide o que atacar primeiro
  const porTipo = new Map<string, { label: string; nivel: string; pessoas: number }>();
  for (const l of linhas) {
    for (const a of l.alertas) {
      // "Sem contrato" e "Contrato vencido" são tipos distintos; o label já vem pronto
      const at = porTipo.get(a.tipo) || { label: a.label, nivel: a.nivel, pessoas: 0 };
      at.pessoas++; porTipo.set(a.tipo, at);
    }
  }

  return NextResponse.json({
    success: true,
    linhas: linhas.sort((a, b) => b.n_alerta - a.n_alerta || a.nome.localeCompare(b.nome)),
    resumo: {
      ativos: linhas.length,
      com_pendencia: linhas.filter((l) => l.n_alerta + l.n_aviso > 0).length,
      limpos: linhas.filter((l) => l.n_alerta + l.n_aviso === 0).length,
    },
    por_tipo: Array.from(porTipo.entries())
      .map(([tipo, v]) => ({ tipo, ...v }))
      .sort((a, b) => b.pessoas - a.pessoas),
  });
}
