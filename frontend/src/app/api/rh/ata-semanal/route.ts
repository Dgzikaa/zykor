import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { cmoFixoDoPeriodo, montarFolhaDoMes } from '@/lib/operacao/cmo';
import { renderAta, segundaDe, somaDias, type BlocosAta, type Pessoa } from '@/lib/rh/ata-semanal';
import { fimDoAviso } from '@/lib/rh/desligamento';

export const dynamic = 'force-dynamic';

/**
 * Ata semanal do RH (objetivo 3 da ata de 13/08/2026).
 *
 * Monta a mensagem de segunda a partir do que os módulos passaram a registrar. Só lê — quem
 * dispara no WhatsApp é outra coisa, e o canal Umbler ainda não entrega.
 *
 * GET /api/rh/ata-semanal?semana=2026-08-03   (qualquer dia da semana serve)
 */

const nomeDia = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7);

export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const sp = new URL(request.url).searchParams;
  const hoje = new Date().toISOString().slice(0, 10);
  // sem parâmetro, a ata é da semana que ACABOU — é a que se manda na segunda
  const inicio = segundaDe(sp.get('semana') || somaDias(hoje, -7));
  const fim = somaDias(inicio, 6);

  const supabase = await getAdminClient();
  const hr = (t: string) => (supabase as any).schema('hr').from(t);
  const ops = (t: string) => (supabase as any).schema('operations').from(t);

  const [
    barRes, funcRes, checkinRes, ocorrRes, deslRes, vagasRes, onbRes,
    diasRes, funcaoRes, paramRes, folhaRes,
  ] = await Promise.all([
    (supabase as any).from('bars').select('nome').eq('id', user.bar_id).maybeSingle(),
    hr('funcionarios').select('id, nome, ativo, data_admissao, data_fim_experiencia, cargo_id')
      .eq('bar_id', user.bar_id),
    hr('v_checkin_dia').select('funcionario_id, nome, data, checkin_status, ponto_situacao')
      .eq('bar_id', user.bar_id).gte('data', inicio).lte('data', fim),
    hr('funcionario_ocorrencias').select('funcionario_id, tipo, cartao, data_inicio, data_fim, descricao, colaborador_nome')
      .eq('bar_id', user.bar_id).lte('data_inicio', fim).or(`data_fim.is.null,data_fim.gte.${inicio}`),
    hr('desligamentos').select('funcionario_id, data_comunicacao, data_desligamento, aviso_previo, modalidade, iniciativa')
      .eq('bar_id', user.bar_id),
    hr('v_cadeiras_vagas').select('codigo, cargo_nome, area_nome, vaga_id').eq('bar_id', user.bar_id),
    hr('onboarding_itens').select('funcionario_id, item, prazo, concluido')
      .eq('bar_id', user.bar_id).eq('concluido', false).not('prazo', 'is', null),
    ops('operacao_dia').select('faturamento_previsto').eq('bar_id', user.bar_id).gte('data', inicio).lte('data', fim),
    ops('v_operacao_dia_funcao').select('custo').eq('bar_id', user.bar_id).gte('data', inicio).lte('data', fim),
    ops('operacao_parametro').select('cmo_fixo_mensal').eq('bar_id', user.bar_id)
      .lte('vigencia_inicio', fim).or(`vigencia_fim.is.null,vigencia_fim.gte.${fim}`)
      .order('vigencia_inicio', { ascending: false }).limit(1).maybeSingle(),
    (supabase as any).schema('gold').from('cmo_produtividade_mensal')
      .select('mes, cmo_fixo_operacao').eq('bar_id', user.bar_id).lte('mes', fim).order('mes'),
  ]);

  const funcs = funcRes.data || [];
  const nomePor = new Map<number, string>(funcs.map((f: any) => [f.id, f.nome]));

  // ---- CMO -------------------------------------------------------------------------------
  const freelas = (funcaoRes.data || []).reduce((s: number, l: any) => s + Number(l.custo || 0), 0);
  const faturamento = (diasRes.data || []).reduce((s: number, d: any) => s + Number(d.faturamento_previsto || 0), 0);
  const { folha } = montarFolhaDoMes({
    meses: folhaRes.data || [],
    override: paramRes.data?.cmo_fixo_mensal == null ? null : Number(paramRes.data.cmo_fixo_mensal),
    hojeISO: hoje,
  });
  const fixo = cmoFixoDoPeriodo(inicio, fim, folha);
  const totalCmo = freelas + fixo;
  const cmo = faturamento > 0 || totalCmo > 0
    ? { freelas, fixo, total: totalCmo, faturamento, pct: faturamento > 0 ? (totalCmo / faturamento) * 100 : null }
    : null;

  // ---- Faltas: só o que o LÍDER confirmou no check-in --------------------------------------
  // O ponto sozinho superconta grosseiramente: na semana 03–09/08 ele acusou 106 faltas em 252
  // turnos, contra ~9 na mensagem real. PJ e liderança não batem ponto e caem como falta.
  const linhasCheck = checkinRes.data || [];
  const faltas: Pessoa[] = linhasCheck
    .filter((l: any) => l.checkin_status === 'falta')
    .map((l: any) => ({ nome: l.nome, detalhe: nomeDia(l.data) }));
  const cobertura = {
    escalados: linhasCheck.length,
    com_checkin: linhasCheck.filter((l: any) => !!l.checkin_status).length,
  };
  const absenteismo = cobertura.com_checkin > 0 ? (faltas.length / cobertura.com_checkin) * 100 : null;

  // ---- Atestados e cartões da semana --------------------------------------------------------
  const ocorrs = ocorrRes.data || [];
  const noPeriodo = (o: any) => String(o.data_inicio) <= fim && (!o.data_fim || String(o.data_fim) >= inicio);
  const rotulo = (o: any) => o.colaborador_nome || nomePor.get(o.funcionario_id) || 'Sem nome';

  const atestados: Pessoa[] = ocorrs.filter((o: any) => o.tipo === 'atestado' && noPeriodo(o))
    .map((o: any) => ({ nome: rotulo(o), detalhe: o.data_fim && o.data_fim !== o.data_inicio ? `${nomeDia(o.data_inicio)} a ${nomeDia(o.data_fim)}` : nomeDia(o.data_inicio) }));

  const cartoes: Pessoa[] = ocorrs.filter((o: any) => o.cartao && String(o.data_inicio) >= inicio && String(o.data_inicio) <= fim)
    .map((o: any) => ({ nome: rotulo(o), detalhe: `${o.cartao}${o.descricao ? ` — ${o.descricao}` : ''}` }));

  // ---- Entradas e saídas ---------------------------------------------------------------------
  const entradas: Pessoa[] = funcs
    .filter((f: any) => f.data_admissao && String(f.data_admissao) >= inicio && String(f.data_admissao) <= fim)
    .map((f: any) => ({ nome: f.nome, detalhe: nomeDia(f.data_admissao) }));

  const desligs = deslRes.data || [];
  const saidas: Pessoa[] = desligs
    .filter((d: any) => d.data_desligamento && String(d.data_desligamento) >= inicio && String(d.data_desligamento) <= fim)
    .map((d: any) => ({ nome: nomePor.get(d.funcionario_id) || 'Sem nome', detalhe: nomeDia(d.data_desligamento) }));

  // Aviso prévio trabalhado ainda correndo na semana. A data de fim é calculada, não digitada —
  // mesma regra da tela de desligamento (comunicação + 1 mês, menos 7 dias na modalidade 7_dias).
  const avisos: Pessoa[] = desligs
    .filter((d: any) => d.aviso_previo === 'trabalhado' && d.data_comunicacao)
    .map((d: any) => ({ d, fimAviso: fimDoAviso(d.data_comunicacao, 'trabalhado', d.modalidade || null) }))
    .filter((x: any) => x.fimAviso >= inicio && String(x.d.data_comunicacao) <= fim)
    .map((x: any) => ({
      nome: nomePor.get(x.d.funcionario_id) || 'Sem nome',
      detalhe: `início ${nomeDia(x.d.data_comunicacao)}${x.d.modalidade === '2h_dia' ? ' (2h a menos)' : x.d.modalidade === '7_dias' ? ' (−7 dias)' : ''} — final ${nomeDia(x.fimAviso)}`,
    }));

  // ---- Experiência vencendo nos próximos 15 dias ---------------------------------------------
  const limiteExp = somaDias(hoje, 15);
  const experiencia: Pessoa[] = funcs
    .filter((f: any) => f.ativo && f.data_fim_experiencia && String(f.data_fim_experiencia) >= hoje && String(f.data_fim_experiencia) <= limiteExp)
    .sort((a: any, b: any) => String(a.data_fim_experiencia).localeCompare(String(b.data_fim_experiencia)))
    .map((f: any) => ({ nome: f.nome, detalhe: `termina ${nomeDia(f.data_fim_experiencia)}` }));

  // ---- Onboarding em aberto com prazo ---------------------------------------------------------
  const onboarding: Pessoa[] = (onbRes.data || [])
    .filter((i: any) => String(i.prazo) <= limiteExp)
    .sort((a: any, b: any) => String(a.prazo).localeCompare(String(b.prazo)))
    .map((i: any) => ({ nome: nomePor.get(i.funcionario_id) || 'Sem nome', detalhe: `${i.item} até ${nomeDia(i.prazo)}` }));

  // ---- Vagas abertas do quadro ------------------------------------------------------------------
  const vagas: Pessoa[] = (vagasRes.data || []).map((v: any) => ({
    nome: v.cargo_nome || v.codigo,
    detalhe: [v.area_nome, v.vaga_id ? 'processo aberto' : 'sem processo'].filter(Boolean).join(' · '),
  }));

  const blocos: BlocosAta = {
    bar_nome: barRes.data?.nome || `Bar ${user.bar_id}`,
    inicio, fim, cmo,
    faltas, atestados, cobertura, absenteismo_pct: absenteismo,
    entradas, saidas, cartoes, vagas, experiencia, onboarding, avisos_previos: avisos,
  };

  return NextResponse.json({ success: true, blocos, texto: renderAta(blocos) });
}
