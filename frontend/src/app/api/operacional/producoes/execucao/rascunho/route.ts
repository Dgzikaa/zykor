import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { authenticateUser, authErrorResponse } from '@/middleware/auth';
import { negarPorRota } from '@/lib/permissions/guard';

export const dynamic = 'force-dynamic';

/**
 * Rascunho (autosave) da execução de produção em andamento — aba Executar do Controle de Produção.
 *
 * Por que existe: antes, a produção em andamento (tempo + peso + rendimento + anotações) vivia SÓ
 * no localStorage do tablet até "Encerrar". Reload por deploy, descarte da aba pelo SO ou
 * localStorage cheio zeravam tudo. Agora a tela salva aqui a cada ~10s e hidrata daqui ao reabrir.
 *
 * Chave estável = idempotencia_key (UUID por instância de produção, o mesmo do anti-duplo-submit
 * da execução final). Escopo por device_id: cada tablet só recupera o que ele mesmo começou.
 * Não recalcula custo nem toca em producao_execucao — é só um blob de estado do cliente.
 */

const SCHEMA = 'operations';
const TABLE = 'producao_execucao_rascunho';

function toInt(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// GET ?bar_id=&device_id=&kind=&secao= — lista os rascunhos do bar. Sem device_id → varre o bar
// inteiro (usado no "retomar por bar", quando o cache do tablet foi limpo / trocou de aparelho).
export async function GET(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const deviceId = sp.get('device_id');
  const kind = sp.get('kind') || 'producao';
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  // TTL: só hidrata rascunho recente (produção real é minutos/horas). Mais velho que 2 dias =
  // abandonado (esqueceram de finalizar/descartar) → não ressuscita nem polui a tela.
  const recenteIso = new Date(Date.now() - 2 * 86400_000).toISOString();

  const supabase = await getAdminClient();
  let q = (supabase as any).schema(SCHEMA).from(TABLE)
    .select('idempotencia_key, secao, producao_id, rodando, duracao_seg, estado, atualizado_em, device_id, owner_device')
    .eq('bar_id', barId)
    .eq('kind', kind)
    .gte('atualizado_em', recenteIso)
    .order('atualizado_em', { ascending: true });
  if (deviceId) q = q.eq('device_id', deviceId);
  if (sp.get('secao')) q = q.eq('secao', sp.get('secao'));

  const { data, error } = await q;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Não mostra (nem ressuscita) rascunhos de produções JÁ FINALIZADAS — mesma idempotencia_key
  // com execução gravada. Cobre a corrida em que o autosave re-cria o rascunho DEPOIS do delete
  // da finalização, que enchia a lista "em outro aparelho" de produções concluídas. Self-heal:
  // apaga esses rascunhos de uma vez (best-effort).
  let rascunhos = (data || []) as any[];
  const keys = rascunhos.map(r => r.idempotencia_key).filter(Boolean);
  if (keys.length) {
    const { data: fin } = await (supabase as any).schema(SCHEMA).from('producao_execucao')
      .select('idempotencia_key').eq('bar_id', barId).in('idempotencia_key', keys);
    const finalizadas = new Set(((fin as any[]) || []).map(e => e.idempotencia_key));
    if (finalizadas.size) {
      rascunhos = rascunhos.filter(r => !finalizadas.has(r.idempotencia_key));
      (supabase as any).schema(SCHEMA).from(TABLE).delete()
        .eq('bar_id', barId).in('idempotencia_key', [...finalizadas]).then(() => {}, () => {});
    }
  }
  return NextResponse.json({ success: true, rascunhos });
}

// PUT { bar_id, device_id, rascunhos: [{ idempotencia_key, secao, producao_id, responsavel_id,
//       rodando, duracao_seg, estado }] } — upsert em lote (autosave). Ignora itens sem chave.
export async function PUT(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  const body = await request.json().catch(() => ({}));

  const barId = Number(body.bar_id) || user.bar_id;
  const deviceId = typeof body.device_id === 'string' ? body.device_id.slice(0, 80) : null;
  const rascunhos: any[] = Array.isArray(body.rascunhos) ? body.rascunhos : [];
  if (!barId) return NextResponse.json({ success: false, error: 'bar_id obrigatório' }, { status: 400 });

  const kindBody = typeof body.kind === 'string' && body.kind.trim() ? body.kind.trim() : 'producao';
  // claim_keys = produções que este aparelho está ASSUMINDO agora (botão "Retomar").
  // Só o claim troca o dono (owner_device); o autosave normal nunca muda dono.
  const claimKeys = new Set(
    (Array.isArray(body.claim_keys) ? body.claim_keys : []).map((k: any) => String(k).trim().slice(0, 80))
  );
  const rows = rascunhos
    .filter(r => typeof r?.idempotencia_key === 'string' && r.idempotencia_key.trim() && r?.estado != null)
    .map(r => ({
      bar_id: barId,
      idempotencia_key: String(r.idempotencia_key).trim().slice(0, 80),
      device_id: deviceId,
      kind: kindBody,
      secao: r.secao ? String(r.secao) : null,
      producao_id: toInt(r.producao_id),
      responsavel_id: toInt(r.responsavel_id),
      rodando: !!r.rodando,
      duracao_seg: toInt(r.duracao_seg),
      estado: r.estado,
      atualizado_em: new Date().toISOString(),
      criado_por: user.email ?? user.nome ?? null,
    }));

  if (!rows.length) return NextResponse.json({ success: true, upserted: 0, rejeitados: [] });

  const supabase = await getAdminClient();

  // Dono atual de cada chave (owner_device, com fallback pro device_id legado).
  const keys = rows.map(r => r.idempotencia_key);
  const { data: existentes } = await (supabase as any).schema(SCHEMA).from(TABLE)
    .select('idempotencia_key, owner_device, device_id').eq('bar_id', barId).in('idempotencia_key', keys);
  const donoAtual = new Map<string, string | null>(
    ((existentes as any[]) || []).map(e => [e.idempotencia_key, (e.owner_device ?? e.device_id) as string | null])
  );

  const rejeitados: string[] = [];
  const aceitos = rows.flatMap(row => {
    const dono = donoAtual.get(row.idempotencia_key) ?? null;
    if (claimKeys.has(row.idempotencia_key)) {
      // assumindo agora → vira dono
      return [{ ...row, owner_device: deviceId }];
    }
    if (dono && dono !== deviceId) {
      // outro aparelho é o dono → não deixa este sobrescrever (foi "roubada")
      rejeitados.push(row.idempotencia_key);
      return [];
    }
    // dono sou eu (ou registro novo) → mantém/define dono
    return [{ ...row, owner_device: dono ?? deviceId }];
  });

  if (aceitos.length) {
    const { error } = await (supabase as any).schema(SCHEMA).from(TABLE)
      .upsert(aceitos, { onConflict: 'bar_id,idempotencia_key' });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // faxina best-effort: purga rascunhos abandonados (>7 dias) deste bar pra não crescer sem limite.
  try {
    const purgaIso = new Date(Date.now() - 7 * 86400_000).toISOString();
    await (supabase as any).schema(SCHEMA).from(TABLE)
      .delete().eq('bar_id', barId).lt('atualizado_em', purgaIso);
  } catch { /* faxina não é crítica */ }

  // rejeitados = chaves que o cliente tentou salvar mas NÃO é mais dono (foram assumidas em
  // outro aparelho). O cliente usa isso pra tirar a produção da tela dele (dono único).
  return NextResponse.json({ success: true, upserted: aceitos.length, rejeitados });
}

// DELETE ?bar_id=&key=  — remove um rascunho (ao finalizar ou descartar a produção).
export async function DELETE(request: NextRequest) {
  const user = await authenticateUser(request);
  if (!user) return authErrorResponse('Usuário não autenticado');
  const nega = negarPorRota(user, request); if (nega) return nega;
  const sp = new URL(request.url).searchParams;
  const barId = Number(sp.get('bar_id')) || user.bar_id;
  const key = sp.get('key');
  if (!barId || !key) return NextResponse.json({ success: false, error: 'bar_id e key obrigatórios' }, { status: 400 });

  const supabase = await getAdminClient();
  const { error } = await (supabase as any).schema(SCHEMA).from(TABLE)
    .delete().eq('bar_id', barId).eq('idempotencia_key', key);
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
