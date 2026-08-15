import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/**
 * Transferência de funcionário entre empresas do grupo.
 *
 * "pode acontecer de 1 funcionário estar trabalhando no ordinário e daqui um tempo ir pro
 * deboche, aí tem que ter essa parte que registramos a transferência" (Rodrigo, 15/08/2026).
 *
 * É o ÚNICO caminho para alguém mudar de empresa — o botão "mover para o organograma
 * administrativo" que existia dentro da cadeira saiu justamente porque movia gente sem
 * registrar nada. Aqui fica data, origem, destino e motivo.
 *
 * GET  — histórico de transferências da pessoa
 * POST — { bar_destino, data?, motivo? }
 */
const hrDe = (sb: any) => (t: string) => sb.schema('hr').from(t);

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;

  const { id } = await params;
  const supabase = await getAdminClient();
  const hr = hrDe(supabase);

  const [{ data: transf }, { data: bares }] = await Promise.all([
    hr('transferencias').select('*').eq('funcionario_id', Number(id)).order('data', { ascending: false }),
    (supabase as any).schema('operations').from('bares').select('id, nome').eq('ativo', true).order('id'),
  ]);

  const nomeBar = new Map<number, string>((bares || []).map((b: any) => [b.id, b.nome]));
  return NextResponse.json({
    success: true,
    bares: bares || [],
    transferencias: (transf || []).map((t: any) => ({
      ...t,
      bar_origem_nome: nomeBar.get(t.bar_origem) || `Bar ${t.bar_origem}`,
      bar_destino_nome: nomeBar.get(t.bar_destino) || `Bar ${t.bar_destino}`,
    })),
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  if (!user.bar_id) return NextResponse.json({ success: false, error: 'Nenhum bar selecionado' }, { status: 400 });

  const { id } = await params;
  const funcId = Number(id);
  const body = await request.json().catch(() => ({} as any));
  const destino = Number(body.bar_destino);
  const data = String(body.data || new Date().toISOString().slice(0, 10));
  if (!Number.isFinite(funcId) || !Number.isFinite(destino)) {
    return NextResponse.json({ success: false, error: 'Informe bar_destino' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ success: false, error: 'Data inválida' }, { status: 400 });
  }

  const supabase = await getAdminClient();
  const hr = hrDe(supabase);

  // a pessoa tem que ser do bar de quem está transferindo — ninguém tira gente de outra empresa
  const { data: f } = await hr('funcionarios').select('id, nome, bar_id')
    .eq('id', funcId).eq('bar_id', user.bar_id).maybeSingle();
  if (!f) return NextResponse.json({ success: false, error: 'Funcionário não encontrado neste bar' }, { status: 404 });
  if (f.bar_id === destino) {
    return NextResponse.json({ success: false, error: 'A pessoa já está nesta empresa' }, { status: 400 });
  }

  const { data: barDest } = await (supabase as any).schema('operations').from('bares')
    .select('id, nome').eq('id', destino).eq('ativo', true).maybeSingle();
  if (!barDest) return NextResponse.json({ success: false, error: 'Empresa de destino inválida' }, { status: 400 });

  // A cadeira da empresa ANTIGA é liberada na data da transferência: manter a pessoa ocupando
  // cadeira de um bar em que ela não está mais faria o quadro daquele bar mentir sobre o que
  // está vago — e é justamente o quadro que decide abertura de vaga.
  await hr('cadeira_ocupacao')
    .update({ fim: data, motivo_saida: `Transferência para ${barDest.nome}` })
    .eq('funcionario_id', funcId).is('fim', null);

  // `bar_manual` trava a sync do Tangerino: sem isso o workplace de lá traria a pessoa de volta
  // na próxima sincronização, sem ninguém entender por quê.
  const { error: eUp } = await hr('funcionarios')
    .update({ bar_id: destino, bar_manual: true, atualizado_em: new Date().toISOString() })
    .eq('id', funcId);
  if (eUp) return NextResponse.json({ success: false, error: eUp.message }, { status: 500 });

  const { error: eIns } = await hr('transferencias').insert({
    funcionario_id: funcId,
    bar_origem: f.bar_id,
    bar_destino: destino,
    data,
    motivo: body.motivo || null,
    registrado_por: user.auth_id,
  });
  if (eIns) return NextResponse.json({ success: false, error: eIns.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    nome: f.nome,
    destino: barDest.nome,
    aviso: 'A pessoa saiu da cadeira que ocupava aqui. Aloque na nova empresa pelo Organograma de lá.',
  });
}
