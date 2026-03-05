import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barIdParam = searchParams.get('bar_id');

    if (!barIdParam) {
      return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    }

    const barId = Number(barIdParam);
    if (Number.isNaN(barId)) {
      return NextResponse.json({ error: 'bar_id inválido' }, { status: 400 });
    }

    const supabase = await getAdminClient();
    const [credenciaisRes, umblerRes, getinUnitRes, barApiConfigsRes] = await Promise.all([
      supabase
        .from('api_credentials')
        .select('*')
        .eq('bar_id', barId),
      supabase
        .from('umbler_config')
        .select('id, organization_id, channel_id, channel_name, phone_number, ativo, updated_at')
        .eq('bar_id', barId)
        .maybeSingle(),
      supabase
        .from('getin_units')
        .select('id, unit_id, name, slug, raw_data, reservation_config, updated_at')
        .eq('bar_id', barId)
        .maybeSingle(),
      supabase
        .from('bar_api_configs')
        .select('*')
        .eq('bar_id', barId),
    ]);

    if (credenciaisRes.error || barApiConfigsRes.error) {
      return NextResponse.json({ error: 'Erro ao buscar credenciais' }, { status: 500 });
    }

    const credenciais = (credenciaisRes.data || []) as any[];
    const bySistema = new Map<string, any>();
    credenciais.forEach((item) => {
      bySistema.set(String(item.sistema || '').toLowerCase(), item);
    });

    const catalogo: Array<{ id: string; label: string; aliases?: string[] }> = [
      { id: 'nibo', label: 'NIBO' },
      { id: 'inter', label: 'Inter', aliases: ['banco_inter'] },
      { id: 'contahub', label: 'ContaHub' },
      { id: 'falae', label: 'Falae' },
      { id: 'vercel', label: 'Vercel' },
      { id: 'supabase', label: 'Supabase' },
      { id: 'google_sheets', label: 'Google Sheets' },
      { id: 'getin', label: 'GetIn' },
      { id: 'sympla', label: 'Sympla' },
      { id: 'yuzer', label: 'Yuzer' },
    ];

    const usados = new Set<string>();

    const items: Array<Record<string, unknown>> = catalogo.map((entry) => {
      const candidates = [entry.id, ...(entry.aliases || [])];
      const rows = candidates
        .map((key) => bySistema.get(key))
        .filter(Boolean) as any[];

      rows.forEach((r) => usados.add(String(r.sistema || '').toLowerCase()));
      const principal = rows[0] || null;

      return {
        id: entry.id,
        nome: entry.label,
        ativo: Boolean(principal?.ativo),
        configurado: Boolean(principal),
        origem: principal ? 'api_credentials' : null,
        atualizadoEm: principal?.atualizado_em || null,
        campos: principal
          ? {
              sistema: principal.sistema,
              bar_id: principal.bar_id,
              ambiente: principal.ambiente,
              api_token: principal.api_token,
              api_key: principal.api_key,
              username: principal.username,
              password: principal.password,
              client_id: principal.client_id,
              client_secret: principal.client_secret,
              access_token: principal.access_token,
              refresh_token: principal.refresh_token,
              token_type: principal.token_type,
              expires_at: principal.expires_at,
              webhook_url: principal.webhook_url,
              base_url: principal.base_url,
              empresa_id: principal.empresa_id,
              empresa_nome: principal.empresa_nome,
              empresa_cnpj: principal.empresa_cnpj,
              redirect_uri: principal.redirect_uri,
              scopes: principal.scopes,
              oauth_state: principal.oauth_state,
              authorization_code: principal.authorization_code,
              last_token_refresh: principal.last_token_refresh,
              token_refresh_count: principal.token_refresh_count,
              configuracoes: principal.configuracoes,
              registrosRelacionados: rows,
            }
          : {},
      };
    });

    credenciais.forEach((row) => {
      const sistema = String(row?.sistema || '').toLowerCase();
      if (!sistema || usados.has(sistema)) return;
      items.push({
        id: sistema,
        nome: sistema,
        ativo: Boolean(row?.ativo),
        configurado: true,
        origem: 'api_credentials',
        atualizadoEm: row?.atualizado_em || null,
        campos: row,
      });
    });

    const umbler = umblerRes.data as any;
    items.push({
      id: 'umbler',
      nome: 'Umbler',
      ativo: Boolean(umbler?.ativo),
      configurado: Boolean(umbler),
      origem: umbler ? 'umbler_config' : null,
      atualizadoEm: umbler?.updated_at || null,
      campos: umbler || {},
    });

    const getinUnit = getinUnitRes.data as any;
    items.push({
      id: 'getin_unit',
      nome: 'GetIn Unidade',
      ativo: Boolean(getinUnit),
      configurado: Boolean(getinUnit),
      origem: getinUnit ? 'getin_units' : null,
      atualizadoEm: getinUnit?.updated_at || null,
      campos: getinUnit || {},
    });

    const barApiConfigs = (barApiConfigsRes.data || []) as any[];
    barApiConfigs.forEach((cfg) => {
      const nomeSistema = String(cfg?.api_name || '').toLowerCase();
      if (!nomeSistema) return;

      const itemExistente = items.find((item) => item.id === nomeSistema);
      if (itemExistente) {
        const camposAtuais =
          itemExistente.campos && typeof itemExistente.campos === 'object'
            ? (itemExistente.campos as Record<string, unknown>)
            : {};
        itemExistente.campos = {
          ...camposAtuais,
          bar_api_config: cfg,
        };
        if (!itemExistente.origem) {
          itemExistente.origem = 'bar_api_configs';
        } else {
          itemExistente.origem = `${itemExistente.origem}+bar_api_configs`;
        }
      } else {
        items.push({
          id: nomeSistema,
          nome: cfg?.api_name || nomeSistema,
          ativo: true,
          configurado: true,
          origem: 'bar_api_configs',
          atualizadoEm: cfg?.created_at || null,
          campos: {
            bar_api_config: cfg,
          },
        });
      }
    });

    return NextResponse.json({ success: true, barId, integracoes: items });
  } catch (error) {
    console.error('Erro ao listar integrações:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
