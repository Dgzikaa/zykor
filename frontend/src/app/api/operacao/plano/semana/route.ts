import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';
import { sincronizarM1 } from '@/lib/operacao/m1';

export const dynamic = 'force-dynamic';

const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const ops = (c: ReturnType<typeof sb>) => (c as any).schema('operations');

/**
 * Campos de contexto que fazem sentido copiar de uma semana pra outra.
 *
 * O FATURAMENTO saiu daqui em 13/08/2026: ele agora vem do M1 do planejamento comercial
 * (`sincronizarM1` logo abaixo). Copiar o número da semana passada era justamente o
 * retrabalho que o M1 elimina — e pior, um valor copiado é "digitado" e ganharia do M1.
 */
const COPIAVEIS = [
  'programacao_musical', 'programacao_esportiva',
  'entrada', 'promocao', 'plano_chao', 'pilula_treinamento',
] as const;

const somaDias = (iso: string, n: number) => {
  const [a, m, d] = iso.split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return x.toISOString().slice(0, 10);
};
const ehSabado = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay() === 6;
};

// =====================================================
// POST /api/operacao/plano/semana
// body: { inicio: 'AAAA-MM-DD' (segunda), copiar_de?: 'AAAA-MM-DD' }
//
// Cria os dias da semana. Sem isso a tela era um beco sem saída: a tabela só desenha as
// colunas que vieram do banco, então uma semana ainda não planejada não tinha onde digitar.
//
// O SÁBADO NASCE PARTIDO em dia/noite porque é assim que a operação funciona (dois turnos,
// duas equipes, dois custos) — e era assim na planilha. Os outros dias nascem 'unico'.
//
// `copiar_de` traz o contexto da semana indicada (faturamento, programação, plano de chão…),
// que é como a planilha era usada na prática: quase toda semana é variação da anterior.
// NÃO copia override manual nem fixos — esses têm que vir da escala/decisão daquela semana.
// =====================================================
export async function POST(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ error: 'Nenhum bar selecionado' }, { status: 400 });

  const body = await request.json().catch(() => ({} as any));
  const inicio = String(body.inicio || '');
  const copiarDe = body.copiar_de ? String(body.copiar_de) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) {
    return NextResponse.json({ error: 'Informe inicio (segunda-feira, AAAA-MM-DD)' }, { status: 400 });
  }

  const c = sb();

  // origem opcional, indexada por (offset do dia na semana + turno)
  const origem = new Map<string, any>();
  if (copiarDe) {
    const { data: dias } = await ops(c).from('operacao_dia').select('*')
      .eq('bar_id', user.bar_id).gte('data', copiarDe).lte('data', somaDias(copiarDe, 6));
    (dias || []).forEach((d: any) => {
      const off = Math.round((Date.parse(d.data) - Date.parse(copiarDe)) / 86400000);
      origem.set(`${off}|${d.turno}`, d);
    });
  }

  const novos: any[] = [];
  for (let off = 0; off < 7; off++) {
    const data = somaDias(inicio, off);
    const turnos = ehSabado(data) ? ['dia', 'noite'] : ['unico'];
    for (const turno of turnos) {
      const base: any = { bar_id: user.bar_id, data, turno, atualizado_por: user.auth_id };
      const src = origem.get(`${off}|${turno}`) || (turnos.length > 1 ? origem.get(`${off}|unico`) : null);
      if (src) for (const campo of COPIAVEIS) base[campo] = src[campo] ?? null;
      novos.push(base);
    }
  }

  // ignoreDuplicates: reabrir uma semana já criada não pode apagar o que já foi planejado
  const { error } = await ops(c).from('operacao_dia')
    .upsert(novos, { onConflict: 'bar_id,data,turno', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // preenche fixos_escala e o total calculado de cada dia recém-criado
  const fim = somaDias(inicio, 6);
  const { data: dias } = await ops(c).from('operacao_dia').select('id, data, turno')
    .eq('bar_id', user.bar_id).gte('data', inicio).lte('data', fim);
  const { data: funcoes } = await ops(c).from('operacao_funcao').select('id')
    .eq('bar_id', user.bar_id).eq('ativo', true);
  const { data: escala } = await ops(c).from('escala_dia').select('data, funcao_id, turno')
    .eq('bar_id', user.bar_id).gte('data', inicio).lte('data', fim).not('entra', 'is', null);

  const linhas: any[] = [];
  for (const d of (dias || []) as any[]) {
    for (const f of (funcoes || []) as any[]) {
      const fixos = (escala || []).filter((e: any) =>
        e.data === d.data && e.funcao_id === f.id && (d.turno === 'unico' || e.turno === d.turno)).length;
      linhas.push({ operacao_dia_id: d.id, funcao_id: f.id, fixos_escala: fixos });
    }
  }
  if (linhas.length) {
    await ops(c).from('operacao_dia_funcao')
      .upsert(linhas, { onConflict: 'operacao_dia_id,funcao_id', ignoreDuplicates: true });
  }

  // puxa o faturamento do planejamento comercial e roda a cadeia por cima dele.
  // Falhar aqui não pode derrubar a criação da semana — a semana existe, e o M1 se
  // resolve no botão "Puxar M1" da tela.
  let m1: unknown = null;
  try {
    m1 = await sincronizarM1(c, user.bar_id, inicio, fim);
  } catch (e: any) {
    m1 = { erro: e?.message || 'Não deu pra puxar o M1' };
  }

  return NextResponse.json({ criados: novos.length, inicio, fim, copiado_de: copiarDe, m1 });
}
