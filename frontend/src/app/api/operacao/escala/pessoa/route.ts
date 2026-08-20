import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { equipeDoUsuario } from '@/lib/rh/equipe';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ops = (c: ReturnType<typeof sb>) => (c as any).schema('operations');

// =====================================================
// Pessoas na escala.
//
// Sem isso não dava pra contratar ninguém: a grade só mostrava quem já tinha linha no
// período, então uma semana ainda não escalada não tinha onde adicionar gente.
//
// A identidade da pessoa é (função, slot) enquanto não houver vínculo com funcionário —
// a planilha só tem o primeiro nome, e a seção CUMIM tem dois "ALEXANDRE".
// =====================================================

/** POST — cria a pessoa marcando FOLGA nos dias do período (linha visível na grade). */
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const funcaoId = String(body.funcao_id || '');
  const de = String(body.de || '');
  const ate = String(body.ate || '');
  /**
   * `funcionario_id` é o caminho novo: a pessoa vem do CADASTRO (organograma), não digitada.
   * `pessoa_nome` solto continua aceito porque a planilha ainda alimenta a escala e quem não
   * tem cadastro (freela de segurança, por exemplo) precisa entrar de algum jeito.
   */
  const funcionarioId = Number(body.funcionario_id) || null;
  /** linha criada pelo líder pra registrar quem veio SEM estar planejado */
  const foraEscala = body.fora_escala === true;
  let nome = String(body.pessoa_nome || '').trim().toUpperCase();

  if (!funcaoId || !/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) {
    return NextResponse.json({ error: 'Informe funcao_id, de e ate' }, { status: 400 });
  }
  if (!nome && !funcionarioId) {
    return NextResponse.json({ error: 'Informe a pessoa (funcionario_id ou pessoa_nome)' }, { status: 400 });
  }

  const c = sb();
  const { data: funcao } = await ops(c).from('operacao_funcao').select('id')
    .eq('bar_id', user.bar_id).eq('id', funcaoId).maybeSingle();
  if (!funcao) return NextResponse.json({ error: 'Função não encontrada neste bar' }, { status: 404 });

  /**
   * Líder só escala gente da PRÓPRIA árvore do organograma. Não é enfeite de tela: sem a
   * checagem aqui, bastaria mandar outro funcionario_id na requisição. Quem não lidera
   * ninguém (RH, admin) passa direto — é `equipe.ids = null`.
   */
  if (funcionarioId) {
    const equipe = await equipeDoUsuario(c, user);
    if (equipe.ids && !equipe.ids.has(funcionarioId)) {
      return NextResponse.json(
        { error: 'Essa pessoa não está na sua equipe do organograma — fale com o RH ou com a gerência.' },
        { status: 403 },
      );
    }
    const { data: f } = await (c as any).schema('hr').from('funcionarios')
      .select('id, nome').eq('id', funcionarioId).eq('bar_id', user.bar_id).maybeSingle();
    if (!f) return NextResponse.json({ error: 'Funcionário não encontrado neste bar' }, { status: 404 });
    // o nome da escala passa a ser o do cadastro — é o que acaba com o de-para daqui pra frente
    nome = String(f.nome || '').trim().toUpperCase();
  }

  // próximo slot livre DA FUNÇÃO INTEIRA (não só do período) — reusar um slot de alguém que
  // saiu misturaria o histórico das duas pessoas na mesma linha.
  const { data: usados } = await ops(c).from('escala_dia').select('slot')
    .eq('bar_id', user.bar_id).eq('funcao_id', funcaoId).order('slot', { ascending: false }).limit(1);
  const slot = ((usados?.[0]?.slot as number) ?? 0) + 1;

  // cria os dias do período como FOLGA — a linha aparece na grade e o time preenche por cima
  const dias: any[] = [];
  for (let d = new Date(de + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= ate; d.setUTCDate(d.getUTCDate() + 1)) {
    dias.push({
      bar_id: user.bar_id, data: d.toISOString().slice(0, 10), funcao_id: funcaoId, slot,
      pessoa_nome: nome, funcionario_id: funcionarioId,
      // fora da escala = veio sem estar planejado, então não nasce FOLGA: nasce em branco
      // pro líder colocar o horário que a pessoa fez.
      marcador: foraEscala ? null : 'FOLGA', turno: 'unico',
      origem: foraEscala ? 'fora_escala' : 'zykor',
    });
  }

  const { error } = await ops(c).from('escala_dia')
    .upsert(dias, { onConflict: 'bar_id,data,funcao_id,slot', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ pessoa_nome: nome, funcao_id: funcaoId, slot, dias: dias.length });
}

/**
 * DELETE — tira a pessoa do PERÍODO (não do histórico).
 * Apagar o histórico inteiro destruiria o planejado × realizado dos meses passados; quem
 * saiu simplesmente deixa de ter linha daqui pra frente.
 */
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const url = new URL(request.url);
  const funcaoId = url.searchParams.get('funcao_id') || '';
  const slot = Number(url.searchParams.get('slot'));
  const de = url.searchParams.get('de') || '';
  const ate = url.searchParams.get('ate') || '';
  if (!funcaoId || !Number.isFinite(slot) || !de || !ate) {
    return NextResponse.json({ error: 'Informe funcao_id, slot, de e ate' }, { status: 400 });
  }

  const c = sb();
  const { error } = await ops(c).from('escala_dia').delete()
    .eq('bar_id', user.bar_id).eq('funcao_id', funcaoId).eq('slot', slot)
    .gte('data', de).lte('data', ate);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ removido: true, de, ate });
}
