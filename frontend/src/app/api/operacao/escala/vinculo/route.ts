import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { paginate } from '@/lib/supabase/paginate';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ops = (c: ReturnType<typeof sb>) => (c as any).schema('operations');
const hr = (c: ReturnType<typeof sb>) => (c as any).schema('hr');

/** Compara nome sem acento, sem caixa e sem espaço à toa. */
const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toUpperCase();
const primeiroNome = (s: string) => norm(s).split(/\s+/)[0] || '';
const palavras = (s: string) => norm(s).split(/\s+/).filter(Boolean);

/**
 * Candidatos de um nome da escala dentro do RH, do casamento mais forte pro mais fraco.
 *
 * O primeiro nome sozinho não bastava — a escala usa como a operação chama a pessoa:
 *   KLEY    -> KLEYDSON NATANAEL CARVALHO DA SILVA   (apelido encurtado)
 *   LACERDA -> ANA CAROLINA GALDINO DE LACERDA       (chamam pelo SOBRENOME)
 * Nos dois casos o funcionário estava lá e a tela mostrava "sem candidato".
 *
 * O corte de 4 letras no prefixo é o que separa "KLEY→KLEYDSON" de "ANA" casando com meio
 * mundo. E a sugestão continua saindo só quando o resultado é ÚNICO — o de-para nunca chuta.
 */
function candidatosDe(nomeEscala: string, funcionarios: Array<{ id: number; nome: string }>) {
  const t = norm(nomeEscala);
  if (!t) return [];
  const exatoPrimeiro = funcionarios.filter(f => primeiroNome(f.nome) === t);
  if (exatoPrimeiro.length) return exatoPrimeiro;
  const palavraExata = funcionarios.filter(f => palavras(f.nome).includes(t));
  if (palavraExata.length) return palavraExata;
  if (t.length < 4) return [];
  return funcionarios.filter(f => palavras(f.nome).some(p => p.startsWith(t)));
}

// =====================================================
// De-para pessoa da escala ↔ funcionário do RH.
//
// A escala veio da planilha e só tem o PRIMEIRO NOME ("NAYARA", dois "ALEXANDRE"), então a
// identidade de uma pessoa hoje é (funcao_id, slot). Casar com hr.funcionarios destrava o
// que depende de dado de RH — a automação de escala precisa de `genero` e
// `dias_trabalho_semana`, que só existem lá.
//
// NÃO dá pra fazer isso automático: casando por primeiro nome, só 21 das 45 pessoas do bar 3
// batem — 22 não acham ninguém e 2 acham mais de um. Por isso aqui é SUGESTÃO + confirmação,
// e o vínculo automático só é oferecido quando o nome bate com exatamente UM funcionário.
//
// GET  — pessoas da escala (todas, não só do período) + candidatos + sugestão
// POST — { vinculos: [{ funcao_id, slot, funcionario_id }] }, funcionario_id null desfaz
// =====================================================
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const c = sb();
  const [linhas, { data: funcoes }, { data: funcionarios }] = await Promise.all([
    paginate<any>(() => ops(c).from('escala_dia')
      .select('funcao_id, slot, pessoa_nome, funcionario_id, data')
      .eq('bar_id', user.bar_id).order('funcao_id').order('slot').order('data')),
    ops(c).from('operacao_funcao').select('id, nome, ordem').eq('bar_id', user.bar_id).order('ordem'),
    hr(c).from('funcionarios').select('id, nome, cargo_id, genero, dias_trabalho_semana, tipo_contratacao')
      .eq('bar_id', user.bar_id).eq('ativo', true).order('nome'),
  ]);

  // uma pessoa = (função, slot). O nome mais RECENTE vence: quem renomeou a linha no meio do
  // ano quis corrigir o nome, não criar outra pessoa.
  const pessoas = new Map<string, any>();
  linhas.forEach((l: any) => {
    const chave = `${l.funcao_id}|${l.slot}`;
    const at = pessoas.get(chave);
    if (!at) {
      pessoas.set(chave, {
        chave, funcao_id: l.funcao_id, slot: l.slot, nome: l.pessoa_nome,
        funcionario_id: l.funcionario_id, dias: 1, ultima_data: l.data,
      });
      return;
    }
    at.dias += 1;
    if (l.data >= at.ultima_data) { at.ultima_data = l.data; at.nome = l.pessoa_nome; }
    if (l.funcionario_id) at.funcionario_id = l.funcionario_id;
  });

  const porId = new Map<number, any>((funcionarios || []).map((f: any) => [f.id, f]));
  const nomeFuncao = new Map<string, string>((funcoes || []).map((f: any) => [String(f.id), f.nome]));

  const lista = [...pessoas.values()].map(p => {
    const candidatos = candidatosDe(p.nome, funcionarios || []);
    const vinculado = p.funcionario_id ? porId.get(p.funcionario_id) : null;
    return {
      ...p,
      funcao_nome: nomeFuncao.get(p.funcao_id) || '—',
      funcionario_nome: vinculado?.nome || null,
      // sugestão só com match ÚNICO — dois "ALEXANDRE" viram escolha humana
      sugestao_id: !p.funcionario_id && candidatos.length === 1 ? candidatos[0].id : null,
      sugestao_nome: !p.funcionario_id && candidatos.length === 1 ? candidatos[0].nome : null,
      candidatos: candidatos.length,
    };
  });

  return NextResponse.json({
    pessoas: lista,
    funcionarios: funcionarios || [],
    resumo: {
      total: lista.length,
      vinculados: lista.filter(p => p.funcionario_id).length,
      com_sugestao: lista.filter(p => p.sugestao_id).length,
    },
  });
}

export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const vinculos: Array<{ funcao_id: string; slot: number; funcionario_id: number | null }> =
    Array.isArray(body.vinculos) ? body.vinculos : [];
  if (!vinculos.length) return NextResponse.json({ error: 'Nada para vincular' }, { status: 400 });

  const c = sb();

  // só aceita funcionário ativo DESTE bar — id de outro bar entraria calado e o de-para
  // ficaria apontando pra pessoa errada
  const ids = [...new Set(vinculos.map(v => v.funcionario_id).filter((x): x is number => x != null))];
  if (ids.length) {
    const { data: validos } = await hr(c).from('funcionarios').select('id')
      .eq('bar_id', user.bar_id).eq('ativo', true).in('id', ids);
    const ok = new Set((validos || []).map((f: any) => f.id));
    const invalido = ids.find(id => !ok.has(id));
    if (invalido != null) {
      return NextResponse.json({ error: `Funcionário ${invalido} não é deste bar` }, { status: 400 });
    }
  }

  // O vínculo é identidade da PESSOA, não do período: grava em todas as linhas dela, inclusive
  // as passadas. É o que faz o histórico continuar sendo da mesma pessoa depois do de-para.
  let linhas = 0;
  for (const v of vinculos) {
    if (!v.funcao_id || !Number.isFinite(Number(v.slot))) continue;
    const { data, error } = await ops(c).from('escala_dia')
      .update({ funcionario_id: v.funcionario_id ?? null, atualizado_em: new Date().toISOString() })
      .eq('bar_id', user.bar_id).eq('funcao_id', v.funcao_id).eq('slot', Number(v.slot))
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    linhas += (data || []).length;
  }

  return NextResponse.json({ pessoas: vinculos.length, linhas });
}
