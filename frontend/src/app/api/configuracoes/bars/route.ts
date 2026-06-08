import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/auth/server';

// CRUD de bares (operations.bares + operations.bares_config).
// Perfil e IDs de integração vivem no jsonb `config`; dias de operação,
// horários e flags de API vivem na tabela `operations.bares_config`.
export const dynamic = 'force-dynamic';

interface ApiError { message: string }

const OPERACAO_COLS = [
  'opera_segunda', 'opera_terca', 'opera_quarta', 'opera_quinta',
  'opera_sexta', 'opera_sabado', 'opera_domingo',
  'horario_abertura', 'horario_fechamento', 'happy_hour_inicio', 'happy_hour_fim',
  'tem_api_contahub', 'tem_api_yuzer', 'tem_api_sympla', 'dias_principais',
] as const;

function pickOperacao(src: Record<string, any> | undefined): Record<string, any> {
  const out: Record<string, any> = {};
  if (!src) return out;
  for (const c of OPERACAO_COLS) {
    if (c in src && src[c] !== undefined) out[c] = src[c];
  }
  return out;
}

// Zera os valores de metas mantendo a estrutura (pra um bar novo começar limpo).
function zerarMetas(v: any): any {
  if (typeof v === 'number') return 0;
  if (typeof v === 'string') return /^\d[\d.]*\/\d[\d.]*$/.test(v) ? '0/0' : v;
  if (Array.isArray(v)) return v.map(zerarMetas);
  if (v && typeof v === 'object') {
    const o: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) o[k] = zerarMetas(val);
    return o;
  }
  return v;
}

// ========================================
// GET — lista bares com perfil + operação
// ========================================
export const GET = requireAdmin(async (_request, _user) => {
  try {
    const supabase = await getAdminClient();

    const { data: bares, error } = await (supabase as any)
      .schema('operations').from('bares')
      .select('id, nome, cnpj, endereco, ativo, config, criado_em, atualizado_em')
      .order('id', { ascending: true });
    if (error) throw error;

    const { data: configs } = await (supabase as any)
      .schema('operations').from('bares_config').select('*');
    const configByBar = new Map<number, any>(
      (configs || []).map((c: any) => [c.bar_id, c])
    );

    const data = (bares || []).map((bar: any) => ({
      id: bar.id,
      nome: bar.nome || '',
      cnpj: bar.cnpj || '',
      endereco: bar.endereco || '',
      ativo: bar.ativo !== false,
      config: bar.config || {},
      operacao: configByBar.get(bar.id) || null,
      criado_em: bar.criado_em,
      atualizado_em: bar.atualizado_em,
    }));

    return NextResponse.json({ success: true, bars: data });
  } catch (error: unknown) {
    console.error('Erro ao buscar bares:', error);
    return NextResponse.json(
      { success: false, error: (error as ApiError).message },
      { status: 500 }
    );
  }
});

// ========================================
// POST — cria bar (perfil + operação + metas semeadas)
// ========================================
export const POST = requireAdmin(async (request, _user) => {
  try {
    const supabase = await getAdminClient();
    const body = await request.json();
    const { nome, cnpj, endereco, config: configIn, operacao, copiar_de, modo_manual } = body;

    if (!nome || !String(nome).trim()) {
      return NextResponse.json(
        { success: false, error: 'Nome é obrigatório' },
        { status: 400 }
      );
    }

    const fonteId = copiar_de ? parseInt(String(copiar_de), 10) : null;

    // metas: copiando de um bar -> usa as metas dele como template (com valores);
    // senão, semeia a estrutura do bar 3 zerada.
    let metasSeed: any = {};
    if (fonteId) {
      const { data: src } = await (supabase as any)
        .schema('operations').from('bares').select('metas').eq('id', fonteId).maybeSingle();
      metasSeed = src?.metas || {};
    } else {
      const { data: barRef } = await (supabase as any)
        .schema('operations').from('bares').select('metas').eq('id', 3).maybeSingle();
      if (barRef?.metas) metasSeed = zerarMetas(barRef.metas);
    }

    // Bar novo começa em "modo manual" (sem ContaHub) por padrão.
    const config = { ...(configIn || {}) };
    if (config.modo_manual === undefined) config.modo_manual = modo_manual !== false;

    const novoBar = {
      nome: String(nome).trim(),
      cnpj: cnpj || null,
      endereco: endereco || null,
      ativo: true,
      config,
      metas: metasSeed,
    };

    const { data: barCriado, error } = await (supabase as any)
      .schema('operations').from('bares')
      .insert([novoBar]).select().single();
    if (error) throw error;

    const barId = barCriado.id;

    // Operação: copiando de um bar -> herda dias/horários; flags de API sempre
    // false (bar novo é manual, liga ContaHub/etc. depois).
    let operacaoBase: Record<string, any> = {};
    if (fonteId) {
      const { data: srcCfg } = await (supabase as any)
        .schema('operations').from('bares_config')
        .select('opera_segunda,opera_terca,opera_quarta,opera_quinta,opera_sexta,opera_sabado,opera_domingo,horario_abertura,horario_fechamento,happy_hour_inicio,happy_hour_fim,dias_principais')
        .eq('bar_id', fonteId).maybeSingle();
      if (srcCfg) operacaoBase = srcCfg;
    }
    const operacaoRow = {
      bar_id: barId,
      ...operacaoBase,
      ...pickOperacao(operacao),
      tem_api_contahub: false,
      tem_api_yuzer: false,
      tem_api_sympla: false,
    };
    await (supabase as any)
      .schema('operations').from('bares_config').insert([operacaoRow]);

    // Clones best-effort a partir da fonte (não falham a criação).
    if (fonteId) {
      try {
        // Acessos: mesmo time do bar de origem.
        const { data: acessos } = await (supabase as any)
          .schema('auth_custom').from('usuarios_bares').select('usuario_id').eq('bar_id', fonteId);
        if (acessos?.length) {
          await (supabase as any).schema('auth_custom').from('usuarios_bares')
            .insert(acessos.map((a: any) => ({ usuario_id: a.usuario_id, bar_id: barId })));
        }
      } catch (e) { console.warn('clone acessos falhou:', e); }
      try {
        // Categorias de custo.
        const { data: cats } = await (supabase as any)
          .schema('operations').from('bar_categorias_custo').select('*').eq('bar_id', fonteId);
        if (cats?.length) {
          const novas = cats.map((c: any) => {
            const { id: _id, criado_em, atualizado_em, created_at, updated_at, ...rest } = c;
            return { ...rest, bar_id: barId };
          });
          await (supabase as any).schema('operations').from('bar_categorias_custo').insert(novas);
        }
      } catch (e) { console.warn('clone categorias_custo falhou:', e); }
    }

    // Configs padrão (best-effort, não falham a criação).
    try {
      await supabase.from('bar_notification_configs').insert([
        { bar_id: barId, email_enabled: true, discord_enabled: false, alerts_enabled: true },
      ]);
    } catch (e) {
      console.warn('Aviso: config padrão do bar não criada:', e);
    }

    return NextResponse.json({
      success: true,
      data: { ...barCriado, operacao: operacaoRow },
      message: `Bar "${nome}" criado com sucesso!`,
    });
  } catch (error: unknown) {
    console.error('Erro ao criar bar:', error);
    return NextResponse.json(
      { success: false, error: (error as ApiError).message },
      { status: 500 }
    );
  }
});

// ========================================
// PUT — atualiza perfil + operação
// ========================================
export const PUT = requireAdmin(async (request, _user) => {
  try {
    const supabase = await getAdminClient();
    const body = await request.json();
    const { id, nome, cnpj, endereco, ativo, config: configIn, operacao } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID do bar é obrigatório' },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
    if (nome !== undefined) updates.nome = nome;
    if (cnpj !== undefined) updates.cnpj = cnpj;
    if (endereco !== undefined) updates.endereco = endereco;
    if (ativo !== undefined) updates.ativo = ativo;

    // Merge superficial do config jsonb.
    if (configIn && typeof configIn === 'object') {
      const { data: barAtual } = await (supabase as any)
        .schema('operations').from('bares').select('config').eq('id', id).single();
      updates.config = { ...(barAtual?.config || {}), ...configIn };
    }

    const { data, error } = await (supabase as any)
      .schema('operations').from('bares')
      .update(updates).eq('id', id).select().single();
    if (error) throw error;

    // Atualiza operação (bares_config) — upsert manual por bar_id.
    const operacaoUpd = pickOperacao(operacao);
    if (Object.keys(operacaoUpd).length > 0) {
      const { data: cfgExist } = await (supabase as any)
        .schema('operations').from('bares_config').select('id').eq('bar_id', id).maybeSingle();
      if (cfgExist) {
        await (supabase as any).schema('operations').from('bares_config')
          .update({ ...operacaoUpd, updated_at: new Date().toISOString() }).eq('bar_id', id);
      } else {
        await (supabase as any).schema('operations').from('bares_config')
          .insert([{ bar_id: id, ...operacaoUpd }]);
      }
    }

    return NextResponse.json({
      success: true,
      data,
      message: `Bar "${nome || data.nome}" atualizado com sucesso!`,
    });
  } catch (error: unknown) {
    console.error('Erro ao atualizar bar:', error);
    return NextResponse.json(
      { success: false, error: (error as ApiError).message },
      { status: 500 }
    );
  }
});
