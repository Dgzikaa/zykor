import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse, permissionErrorResponse } from '@/middleware/auth';
import { podeRH } from '@/lib/auth/rh-guard';

export const dynamic = 'force-dynamic';

/**
 * Vínculo Zykor <-> Tangerino, resolvido AQUI e não lá.
 *
 * A sync decide o bar da pessoa pelo NOME do local de trabalho do Tangerino ("... Ordinário",
 * "... Deboche"). Quem está sem local (workplaceList apontando para o id 0) não resolve bar nenhum
 * e é **pulado em silêncio**: nunca vira ficha, nunca recebe ponto. Foi o que aconteceu com o
 * EDUARDO DA SILVA LIMA — existia no Tangerino, tinha ficha criada à mão no Zykor, e os dois nunca
 * se encontraram.
 *
 * Antes, consertar isso exigia entrar no Tangerino e atribuir o local. Esta rota tira essa
 * dependência: o RH enxerga as duas pontas soltas no Zykor e amarra por aqui. Uma vez amarrado, o
 * `tangerino_employee_id` manda em tudo — a sync passa a atualizar a pessoa mesmo sem local
 * definido lá, porque só a CRIAÇÃO depende de resolver o bar.
 *
 * GET  -> { sem_ficha, sem_vinculo }  pendências dos dois lados
 * POST -> { funcionario_id, tangerino_employee_id | null }  amarra ou desamarra
 */

/** normaliza para comparar nome: sem acento, minúsculo, espaços colapsados */
const norm = (s: string) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();
const soDigitos = (s: string | null | undefined) => String(s || '').replace(/\D/g, '') || null;

async function ctx(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return { erro: authErrorResponse('Usuário não autenticado') };
  if (!podeRH(user)) return { erro: permissionErrorResponse('Sem permissão no módulo de RH') };
  if (!user.bar_id) return { erro: NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 }) };
  const supabase = await getAdminClient();
  return { user, supabase };
}

export async function GET(request: NextRequest) {
  const c = await ctx(request);
  if (c.erro) return c.erro;
  const { user, supabase } = c as any;

  const [empRes, funcRes] = await Promise.all([
    supabase.schema('bronze').from('bronze_tangerino_employee').select('employee_id_ext, payload'),
    supabase.schema('hr').from('funcionarios')
      .select('id, nome, cpf, ativo, tangerino_employee_id').eq('bar_id', user.bar_id),
  ]);

  const empregados = (empRes.data || [])
    .map((e: any) => ({
      tangerino_employee_id: e.employee_id_ext,
      nome: e.payload?.name || '(sem nome)',
      cpf: soDigitos(e.payload?.cpf),
      demitido: !!e.payload?.fired,
      // workplace 0 = sem local atribuído; é justamente quem a sync não consegue rotear
      sem_local: !(e.payload?.workplaceList || []).some((w: any) => Number(w?.id) > 0),
    }))
    .filter((e: any) => !e.demitido);

  const fichas = funcRes.data || [];
  const ligados = new Set(
    fichas.filter((f: any) => f.tangerino_employee_id).map((f: any) => Number(f.tangerino_employee_id)),
  );

  // Ligados em QUALQUER bar contam como resolvidos — senão a pessoa do Deboche apareceria como
  // pendência na tela do Ordinário.
  const { data: ligadosGlobal } = await supabase.schema('hr').from('funcionarios')
    .select('tangerino_employee_id').not('tangerino_employee_id', 'is', null);
  const ligadosTodos = new Set((ligadosGlobal || []).map((f: any) => Number(f.tangerino_employee_id)));

  const semVinculo = fichas.filter((f: any) => f.ativo && !f.tangerino_employee_id);

  // Sugestão de par: CPF primeiro (é prova), nome só como palpite a conferir.
  const sugerir = (f: any) => {
    const cpf = soDigitos(f.cpf);
    if (cpf) {
      const porCpf = empregados.filter((e: any) => e.cpf && e.cpf === cpf && !ligadosTodos.has(e.tangerino_employee_id));
      if (porCpf.length === 1) return { ...porCpf[0], confianca: 'cpf' as const };
    }
    const n = norm(f.nome);
    const porNome = empregados.filter((e: any) =>
      !ligadosTodos.has(e.tangerino_employee_id) && (norm(e.nome).startsWith(n) || n.startsWith(norm(e.nome))));
    // dois candidatos = não sugere nada; escolher no escuro é como nascem as duplicatas
    if (porNome.length === 1) return { ...porNome[0], confianca: 'nome' as const };
    return null;
  };

  return NextResponse.json({
    success: true,
    // está no Tangerino, ativo lá, e não tem ficha em bar nenhum
    sem_ficha: empregados
      .filter((e: any) => !ligadosTodos.has(e.tangerino_employee_id))
      .map((e: any) => ({ ...e, ja_tem_ficha_neste_bar: ligados.has(e.tangerino_employee_id) })),
    // tem ficha ativa aqui e nenhum vínculo — pode ser PJ (não existe lá) ou vínculo perdido
    sem_vinculo: semVinculo.map((f: any) => ({
      funcionario_id: f.id, nome: f.nome, cpf: f.cpf, sugestao: sugerir(f),
    })),
  });
}

export async function POST(request: NextRequest) {
  const c = await ctx(request);
  if (c.erro) return c.erro;
  const { user, supabase } = c as any;

  const body = await request.json().catch(() => ({}));
  const funcionarioId = Number(body.funcionario_id);
  const tangerinoId = body.tangerino_employee_id == null ? null : Number(body.tangerino_employee_id);
  if (!funcionarioId) return NextResponse.json({ error: 'funcionario_id obrigatório' }, { status: 400 });

  const hr = (t: string) => supabase.schema('hr').from(t);

  const { data: ficha } = await hr('funcionarios')
    .select('id, nome').eq('id', funcionarioId).eq('bar_id', user.bar_id).maybeSingle();
  if (!ficha) return NextResponse.json({ error: 'Funcionário não encontrado neste bar' }, { status: 404 });

  if (tangerinoId != null) {
    // um funcionário do Tangerino não pode estar em duas fichas — é o índice único
    // funcionarios_tangerino_employee_id_uk, mas a mensagem daqui é legível
    const { data: jaTem } = await hr('funcionarios')
      .select('id, nome, bar_id').eq('tangerino_employee_id', tangerinoId).maybeSingle();
    if (jaTem && jaTem.id !== funcionarioId) {
      return NextResponse.json(
        { error: `Esse funcionário do Tangerino já está vinculado a "${jaTem.nome}" (bar ${jaTem.bar_id}).` },
        { status: 409 },
      );
    }
  }

  const { error } = await hr('funcionarios')
    .update({ tangerino_employee_id: tangerinoId, atualizado_em: new Date().toISOString() })
    .eq('id', funcionarioId).eq('bar_id', user.bar_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Puxa o ponto na hora: sem isto o vínculo parece não ter feito nada, porque o ponto só entraria
  // na próxima madrugada. A função é idempotente (ON CONFLICT funcionario_id,data).
  let diasPonto: number | null = null;
  if (tangerinoId != null) {
    const { data: etl } = await supabase.schema('hr').rpc('fn_tangerino_punch_to_ponto');
    diasPonto = (etl as any)?.dias_ponto ?? null;
  }

  return NextResponse.json({
    success: true,
    mensagem: tangerinoId == null
      ? `${ficha.nome} desvinculado do Tangerino.`
      : `${ficha.nome} vinculado ao Tangerino. O ponto dele passa a entrar automaticamente.`,
    dias_ponto_processados: diasPonto,
  });
}
