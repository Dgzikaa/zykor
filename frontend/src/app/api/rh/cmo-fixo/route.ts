import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import {
  calcularFolha, diasDoMes, diasDeVinculo, diasVtPadrao, type SaidaFolha,
} from '@/lib/rh/folha';

export const dynamic = 'force-dynamic';

/**
 * CMO FIXO do mês — substitui a planilha CMO.
 *
 * A lista de pessoas vem do ORGANOGRAMA (cadeira ocupada), não de um cadastro paralelo: quem
 * senta numa cadeira está na folha, quem sai dela some. Era o pedido do Gonza — "puxando já
 * automaticamente os funcionários pelo organograma".
 *
 * Tudo é calculado a partir do cadastro (salário, VT, adicional, consumação, tipo, área). Os
 * únicos campos digitados são os que o próprio Gonza disse serem manuais: estimativa e tempo de
 * casa (no cadastro da pessoa) e os dias de VT aqui. Os DIAS que rateiam o custo saem da
 * admissão/demissão — quem entrou no dia 20 custa 11/31 sem ninguém informar nada.
 */

type Linha = SaidaFolha & {
  funcionario_id: number; nome: string; tipo_contratacao: string;
  cargo: string | null; area: string | null; grupo: string; cargo_confianca: boolean;
  vt_diaria: number; editado: boolean;
};

async function montar(supabase: any, barId: number, ano: number, mes: number) {
  const hr = (t: string) => supabase.schema('hr').from(t);
  const total = diasDoMes(ano, mes);

  const [{ data: ocup }, { data: areas }, { data: salvos }] = await Promise.all([
    hr('cadeira_ocupacao')
      .select(`funcionario_id, inicio, fim,
               cadeiras!inner(bar_id, ativa, cargo_id, area_id,
                              cargos:cargo_id(nome, cargo_confianca, funcao_escala_id)),
               funcionarios!inner(id, nome, tipo_contratacao, salario_base, vale_transporte_diaria,
                                  adicional_mensal, consumacao_mensal, estimativa_mensal,
                                  tempo_casa_mensal, dias_trabalho_semana, data_admissao,
                                  data_demissao, ativo)`)
      .is('fim', null).eq('cadeiras.bar_id', barId).eq('cadeiras.ativa', true),
    hr('areas').select('id, nome, adicional_noturno').eq('bar_id', barId),
    hr('folha_pagamento').select('*').eq('bar_id', barId).eq('ano', ano).eq('mes', mes),
  ]);

  const areaById = new Map<number, any>(((areas || []) as any[]).map((a) => [a.id, a]));
  const salvoPor = new Map<number, any>(((salvos || []) as any[]).map((s) => [s.funcionario_id, s]));
  const fechado = ((salvos || []) as any[]).some((s) => s.fechado);

  const linhas: Linha[] = ((ocup || []) as any[]).map((o) => {
    const f = o.funcionarios; const cad = o.cadeiras; const cargo = cad?.cargos;
    const area = cad?.area_id ? areaById.get(cad.area_id) : null;
    const salvo = salvoPor.get(f.id);

    const dias = diasDeVinculo(ano, mes, f.data_admissao, f.data_demissao);
    const diasVt = salvo?.dias_vt != null ? Number(salvo.dias_vt)
      : diasVtPadrao(f.dias_trabalho_semana, total);

    const calc = calcularFolha({
      salario: Number(f.salario_base || 0),
      estimativa: Number(f.estimativa_mensal || 0),
      tempo_casa: Number(f.tempo_casa_mensal || 0),
      adicional_noturno_area: Number(area?.adicional_noturno || 0),
      cargo_confianca: !!cargo?.cargo_confianca,
      adicionais: Number(f.adicional_mensal || 0),
      consumacao: Number(f.consumacao_mensal || 0),
      aviso_previo: Number(salvo?.aviso_previo || 0),
      vt_diaria: Number(f.vale_transporte_diaria || 0),
      tipo_contratacao: f.tipo_contratacao || 'CLT',
      // dias salvos ganham do calculado: o RH pode ter um motivo (afastamento, acordo) que a
      // admissão/demissão não conta.
      dias: salvo?.dias_trabalhados != null ? Number(salvo.dias_trabalhados) : dias,
      dias_mes: total,
      dias_vt: diasVt,
    });

    return {
      ...calc,
      funcionario_id: f.id, nome: f.nome, tipo_contratacao: f.tipo_contratacao || 'CLT',
      cargo: cargo?.nome ?? null, area: area?.nome ?? null,
      grupo: cargo?.cargo_confianca ? 'Liderança' : (area?.nome ?? 'Sem área'),
      cargo_confianca: !!cargo?.cargo_confianca,
      vt_diaria: Number(f.vale_transporte_diaria || 0),
      editado: !!salvo,
    };
  }).sort((a, b) => (a.grupo === b.grupo ? a.nome.localeCompare(b.nome, 'pt-BR')
    : a.grupo.localeCompare(b.grupo, 'pt-BR')));

  const soma = (k: keyof SaidaFolha) => linhas.reduce((s, l) => s + Number(l[k] || 0), 0);
  return {
    ano, mes, dias_mes: total, fechado, linhas,
    // Quem está sem salário no cadastro entra com custo 0 e some do total sem avisar — por isso
    // a tela recebe a lista pra cobrar o cadastro em vez de mostrar um número menor do que é.
    sem_salario: linhas.filter((l) => !l.salario_bruto).map((l) => l.nome),
    resumo: {
      pessoas: linhas.length,
      clt: linhas.filter((l) => l.tipo_contratacao === 'CLT').length,
      pj: linhas.filter((l) => l.tipo_contratacao !== 'CLT').length,
      salario_liquido: soma('salario_liquido'),
      encargos: soma('inss_empresa') + soma('fgts') + soma('provisao_certa') + soma('mensalidade_sindical'),
      vale_transporte: soma('vale_transporte'),
      adicionais: soma('adicionais'),
      consumacao: soma('consumacao'),
      custo_empresa: soma('custo_empresa'),
    },
  };
}

/** GET ?ano=2026&mes=8 */
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const hoje = new Date();
  const ano = Number(sp.get('ano')) || hoje.getFullYear();
  const mes = Number(sp.get('mes')) || hoje.getMonth() + 1;
  if (mes < 1 || mes > 12 || ano < 2020 || ano > 2100) {
    return NextResponse.json({ error: 'Período inválido' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  return NextResponse.json({ success: true, ...(await montar(supabase, user.bar_id, ano, mes)) });
}

/**
 * POST — grava o mês.
 *  { ano, mes, ajustes: [{ funcionario_id, dias_trabalhados?, dias_vt?, aviso_previo? }] }
 *  { ano, mes, acao: 'fechar' | 'reabrir' }
 *
 * Gravar CONGELA o cálculo em hr.folha_pagamento: o custo de agosto não pode mudar porque em
 * setembro alguém corrigiu um salário. Enquanto o mês está aberto, regravar recalcula.
 */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const ano = Number(body.ano); const mes = Number(body.mes);
  if (!ano || !mes || mes < 1 || mes > 12) {
    return NextResponse.json({ error: 'Informe ano e mes' }, { status: 400 });
  }
  const supabase = await getAdminClient();
  const folha = () => (supabase as any).schema('hr').from('folha_pagamento');

  if (body.acao === 'fechar' || body.acao === 'reabrir') {
    const fechar = body.acao === 'fechar';
    if (fechar) {
      // fechar sem ter gravado deixaria o mês "fechado" e vazio
      const salvar = await gravar(supabase, user.bar_id, ano, mes, []);
      if (salvar) return salvar;
    }
    const { error } = await folha().update({ fechado: fechar, atualizado_em: new Date().toISOString() })
      .eq('bar_id', user.bar_id).eq('ano', ano).eq('mes', mes);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, fechado: fechar });
  }

  const { data: jaFechado } = await folha().select('id').eq('bar_id', user.bar_id)
    .eq('ano', ano).eq('mes', mes).eq('fechado', true).limit(1);
  if (jaFechado?.length) {
    return NextResponse.json({ error: 'Mês fechado. Reabra antes de alterar.' }, { status: 409 });
  }

  const erro = await gravar(supabase, user.bar_id, ano, mes, Array.isArray(body.ajustes) ? body.ajustes : []);
  if (erro) return erro;
  return NextResponse.json({ success: true, ...(await montar(supabase, user.bar_id, ano, mes)) });
}

/** Aplica os ajustes e regrava o mês inteiro. Devolve NextResponse só quando dá erro. */
async function gravar(supabase: any, barId: number, ano: number, mes: number, ajustes: any[]) {
  const folha = () => supabase.schema('hr').from('folha_pagamento');

  if (ajustes.length) {
    // os ajustes entram primeiro pra que o recálculo já os enxergue
    const linhas = ajustes
      .filter((a) => Number(a?.funcionario_id))
      .map((a) => ({
        bar_id: barId, ano, mes, funcionario_id: Number(a.funcionario_id),
        dias_trabalhados: a.dias_trabalhados == null ? null : Number(a.dias_trabalhados),
        dias_vt: a.dias_vt == null ? null : Number(a.dias_vt),
        aviso_previo: a.aviso_previo == null ? null : Number(a.aviso_previo),
      }));
    if (linhas.length) {
      const { error } = await folha().upsert(linhas, { onConflict: 'funcionario_id,mes,ano' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const calculado = await montar(supabase, barId, ano, mes);
  const registros = calculado.linhas.map((l) => ({
    bar_id: barId, ano, mes, funcionario_id: l.funcionario_id,
    dias_trabalhados: l.dias_trabalhados, dias_mes: l.dias_mes, dias_vt: l.dias_vt,
    salario_bruto: l.salario_bruto, estimativa: l.estimativa, adicional_noturno: l.adicional_noturno,
    drs_noturno: l.drs_noturno, tempo_casa: l.tempo_casa, produtividade: l.produtividade,
    desc_vale_transporte: l.desc_vale_transporte, inss: l.inss, ir: l.ir,
    salario_liquido: l.salario_liquido, inss_empresa: l.inss_empresa, fgts: l.fgts,
    vale_transporte: l.vale_transporte, provisao_certa: l.provisao_certa,
    mensalidade_sindical: l.mensalidade_sindical, adicionais: l.adicionais,
    consumacao: l.consumacao, aviso_previo: l.aviso_previo, custo_empresa: l.custo_empresa,
    atualizado_em: new Date().toISOString(),
  }));
  if (registros.length) {
    const { error } = await folha().upsert(registros, { onConflict: 'funcionario_id,mes,ano' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return null;
}
