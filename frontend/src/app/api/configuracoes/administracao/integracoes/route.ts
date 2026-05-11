import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import {
  CATALOGO_INTEGRACOES,
  type IntegracaoCatalogo,
  type StatusGeral,
  type StatusCredencial,
} from '@/app/configuracoes/administracao/integracoes/catalog';

export const dynamic = 'force-dynamic';

interface IntegracaoResposta {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  logoLabel: string;
  logoCor: string;
  acento: string;
  global: boolean;
  statusGeral: StatusGeral;
  statusCredencial: StatusCredencial;
  problemas: string[];
  credencial: {
    fonte: string | null;
    valor_mascarado: Record<string, string | null>;
    expires_at: string | null;
    detalhes_extras: Record<string, unknown>;
  };
  ultimaSync: string | null;
  ultimaSyncStatus: string | null;
  volume7d: number | null;
  crons: string[];
  acoes: Array<{ id: string; label: string; tipo: string; url?: string }>;
}

function mascarar(valor: string | null | undefined, mostrarUltimos = 4): string | null {
  if (!valor) return null;
  if (valor.length <= mostrarUltimos) return '••••';
  return '••••' + valor.slice(-mostrarUltimos);
}

async function checarCredencialBar(
  supabase: any,
  cat: IntegracaoCatalogo,
  barId: number,
): Promise<{
  credencial: IntegracaoResposta['credencial'];
  statusCredencial: StatusCredencial;
  temRefreshToken: boolean;
}> {
  const credencial: IntegracaoResposta['credencial'] = {
    fonte: null,
    valor_mascarado: {},
    expires_at: null,
    detalhes_extras: {},
  };
  let statusCredencial: StatusCredencial = 'ausente';
  let temRefreshToken = false;

  for (const fonte of cat.fontesAuth) {
    if (fonte.tipo === 'api_credentials' && fonte.sistema?.length) {
      const { data: rows } = await supabase
        .from('api_credentials')
        .select('*')
        .eq('bar_id', barId)
        .in('sistema', fonte.sistema);
      const row = (rows || []).find((r: any) => r.ativo) || rows?.[0];
      if (row) {
        credencial.fonte = `api_credentials:${row.sistema}`;
        credencial.valor_mascarado = {
          api_token: mascarar(row.api_token),
          api_key: mascarar(row.api_key),
          access_token: mascarar(row.access_token),
          client_secret: mascarar(row.client_secret),
          username: row.username || null,
        };
        credencial.expires_at = row.expires_at;
        credencial.detalhes_extras = {
          empresa_nome: row.empresa_nome,
          empresa_cnpj: row.empresa_cnpj,
          ambiente: row.ambiente,
          scopes: row.scopes,
          last_token_refresh: row.last_token_refresh,
        };
        temRefreshToken = Boolean(row.refresh_token);
        const temAlguma = Boolean(
          row.api_token || row.api_key || row.access_token || row.client_secret,
        );
        const desativada = row.ativo === false;
        if (desativada) statusCredencial = 'desativada';
        else if (!temAlguma) statusCredencial = 'ausente';
        else if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) statusCredencial = 'expirado';
        else if (row.expires_at && new Date(row.expires_at).getTime() < Date.now() + 7 * 86400_000)
          statusCredencial = 'expirando';
        else statusCredencial = 'ok';
        return { credencial, statusCredencial, temRefreshToken };
      }
    }

    if (fonte.tipo === 'tabela' && fonte.schema && fonte.tabela) {
      const { data: row } = await supabase
        .from(fonte.tabela)
        .select('*')
        .eq(fonte.colunaBar || 'bar_id', barId)
        .maybeSingle();
      if (row) {
        credencial.fonte = `${fonte.schema}.${fonte.tabela}`;
        credencial.valor_mascarado = {
          channel_id: (row as any).channel_id || null,
          channel_name: (row as any).channel_name || null,
        };
        credencial.detalhes_extras = row;
        statusCredencial = (row as any).ativo === false ? 'desativada' : 'ok';
        return { credencial, statusCredencial, temRefreshToken: false };
      }
    }

    if (fonte.tipo === 'oauth_table' && fonte.tabela) {
      const { data: row } = await supabase
        .from(fonte.tabela)
        .select('*')
        .eq(fonte.colunaBar || 'bar_id', barId)
        .maybeSingle();
      if (row) {
        credencial.fonte = `${fonte.schema || 'integrations'}.${fonte.tabela}`;
        credencial.valor_mascarado = {
          access_token: mascarar((row as any).access_token),
          ig_username: (row as any).ig_username || null,
          facebook_page_name: (row as any).facebook_page_name || null,
        };
        credencial.expires_at = (row as any).expires_at;
        credencial.detalhes_extras = {
          conectado_em: (row as any).conectado_em,
          ultima_sync_em: (row as any).ultima_sync_em,
          token_type: (row as any).token_type,
        };
        if ((row as any).ativo === false) statusCredencial = 'desativada';
        else if ((row as any).expires_at && new Date((row as any).expires_at).getTime() < Date.now())
          statusCredencial = 'expirado';
        else if (
          (row as any).expires_at &&
          new Date((row as any).expires_at).getTime() < Date.now() + 7 * 86400_000
        )
          statusCredencial = 'expirando';
        else statusCredencial = 'ok';
        return { credencial, statusCredencial, temRefreshToken: false };
      }
    }
  }

  return { credencial, statusCredencial, temRefreshToken: false };
}

async function checarCredencialGlobal(cat: IntegracaoCatalogo): Promise<{
  credencial: IntegracaoResposta['credencial'];
  statusCredencial: StatusCredencial;
  temRefreshToken: boolean;
}> {
  const credencial: IntegracaoResposta['credencial'] = {
    fonte: 'env_global',
    valor_mascarado: {},
    expires_at: null,
    detalhes_extras: {},
  };
  let presentes = 0;
  let totalEsperado = 0;

  for (const fonte of cat.fontesAuth) {
    if (fonte.tipo === 'env_global' && fonte.envs?.length) {
      for (const env of fonte.envs) {
        totalEsperado++;
        const v = process.env[env];
        credencial.valor_mascarado[env] = v ? mascarar(v, 4) : null;
        if (v) presentes++;
      }
    }
  }

  let status: StatusCredencial = 'ausente';
  if (totalEsperado === 0) status = 'ausente';
  else if (presentes === 0) status = 'ausente';
  else if (presentes < totalEsperado) status = 'expirando'; // "parcial" — abusa do enum
  else status = 'ok';

  return { credencial, statusCredencial: status, temRefreshToken: false };
}

async function pegarUltimaSync(
  supabase: any,
  cat: IntegracaoCatalogo,
  barId: number | null,
): Promise<{ ultima: string | null; status: string | null }> {
  let melhorTimestamp: string | null = null;
  let statusEncontrado: string | null = null;

  for (const fonte of cat.fontesSync || []) {
    let q = supabase
      .from(fonte.tabela)
      .select(`${fonte.colunaTempo}${fonte.colunaStatus ? ',' + fonte.colunaStatus : ''}`)
      .order(fonte.colunaTempo, { ascending: false })
      .limit(1);

    const colBar = fonte.colunaBar;
    // colunaBar='' (vazio) significa "tabela não filtra por bar"
    if (barId != null && colBar !== '') {
      q = q.eq(colBar || 'bar_id', barId);
    }

    const { data } = await q;
    const row = data?.[0];
    if (!row) continue;
    const ts = row[fonte.colunaTempo] as string | null;
    if (ts && (!melhorTimestamp || new Date(ts) > new Date(melhorTimestamp))) {
      melhorTimestamp = ts;
      statusEncontrado = fonte.colunaStatus ? (row[fonte.colunaStatus] as string) : null;
    }
  }

  return { ultima: melhorTimestamp, status: statusEncontrado };
}

async function pegarVolume7d(supabase: any, cat: IntegracaoCatalogo, barId: number | null): Promise<number | null> {
  if (!cat.volumeTabela) return null;
  const desde = new Date(Date.now() - 7 * 86400_000).toISOString();
  let q = supabase
    .from(cat.volumeTabela.tabela)
    .select('*', { count: 'exact', head: true })
    .gte(cat.volumeTabela.colunaTempo, desde);
  if (barId != null) {
    q = q.eq(cat.volumeTabela.colunaBar || 'bar_id', barId);
  }
  const { count, error } = await q;
  if (error) return null;
  return count ?? 0;
}

function calcularStatusGeral(
  statusCred: StatusCredencial,
  ultimaSync: string | null,
  volume7d: number | null,
  global: boolean,
  temRefreshToken: boolean,
  cat: IntegracaoCatalogo,
): { status: StatusGeral; problemas: string[] } {
  const problemas: string[] = [];
  const naoExpira = Boolean(cat.naoExpira);
  const opcional = Boolean(cat.opcional);

  // Atividade recente = forte sinal de "tá funcionando", override credencial
  const temAtividadeRecente = (volume7d ?? 0) > 0 || (() => {
    if (!ultimaSync) return false;
    return (Date.now() - new Date(ultimaSync).getTime()) / 3600_000 < 48;
  })();

  // Integração configurada por evidência de atividade — credencial pode estar em outro lugar (Supabase secrets)
  if (cat.inferirPorAtividade) {
    if (temAtividadeRecente) {
      return { status: 'conectada', problemas: [] };
    }
    // Sem atividade nas últimas 7d mas integração tem que rodar — sinaliza problema
    // (sem essa cláusula, ContaHub/Apify cairiam em "ausente" o que está errado)
    if (statusCred === 'ausente') {
      return {
        status: 'parcial',
        problemas: ['Sem atividade nos últimos 7 dias — verifique se cron está rodando'],
      };
    }
  }

  if (statusCred === 'ausente') {
    return {
      status: 'nao_configurada',
      problemas: opcional ? ['Não configurada (opcional)'] : ['Credencial ausente'],
    };
  }
  if (statusCred === 'desativada') return { status: 'desconectada', problemas: ['Integração desativada'] };

  // Pra integrações que NÃO expiram (webhooks, DSN, API keys sem TTL), ignorar 'expirado'/'expirando'
  if (!naoExpira) {
    if (statusCred === 'expirado' && !temRefreshToken) {
      return { status: 'desconectada', problemas: ['Token expirado e sem refresh — requer reconexão'] };
    }
    if (statusCred === 'expirado' && temRefreshToken) {
      const horasDesdeSync = ultimaSync ? (Date.now() - new Date(ultimaSync).getTime()) / 3600_000 : 999;
      if (horasDesdeSync > 12) problemas.push('Token expirado — aguardando próximo refresh');
    }
    if (statusCred === 'expirando') problemas.push('Token expirando em menos de 7 dias');
  }

  if (!global && ultimaSync) {
    const horasDesdeUltimaSync = (Date.now() - new Date(ultimaSync).getTime()) / 3600_000;
    if (horasDesdeUltimaSync > 48) problemas.push(`Sem sync há ${Math.round(horasDesdeUltimaSync / 24)} dias`);
    else if (horasDesdeUltimaSync > 12) problemas.push(`Sem sync há ${Math.round(horasDesdeUltimaSync)}h`);
  }

  if (problemas.length === 0) return { status: 'conectada', problemas: [] };
  return { status: 'parcial', problemas };
}

function acoesPara(cat: IntegracaoCatalogo, status: StatusGeral): IntegracaoResposta['acoes'] {
  const acoes: IntegracaoResposta['acoes'] = [];

  if (cat.id === 'instagram') {
    if (status === 'conectada' || status === 'parcial') {
      acoes.push({ id: 'desconectar', label: 'Desconectar', tipo: 'instagram_disconnect' });
    } else {
      acoes.push({ id: 'conectar', label: 'Conectar Instagram', tipo: 'instagram_connect' });
    }
  }

  if (cat.id === 'vercel') {
    acoes.push({ id: 'dashboard', label: 'Abrir Vercel', tipo: 'externa', url: 'https://vercel.com/dashboard' });
  }
  if (cat.id === 'supabase') {
    acoes.push({
      id: 'dashboard',
      label: 'Abrir Supabase',
      tipo: 'externa',
      url: 'https://supabase.com/dashboard/project/uqtgsvujwcbymjmvkjhy',
    });
  }
  if (cat.id === 'sentry') {
    acoes.push({ id: 'dashboard', label: 'Abrir Sentry', tipo: 'externa', url: 'https://sentry.io/' });
  }

  return acoes;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barIdParam = searchParams.get('bar_id');
    if (!barIdParam) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    const barId = Number(barIdParam);
    if (Number.isNaN(barId)) return NextResponse.json({ error: 'bar_id inválido' }, { status: 400 });

    const supabase = await getAdminClient();

    const integracoes: IntegracaoResposta[] = await Promise.all(
      CATALOGO_INTEGRACOES.map(async (cat) => {
        const ehGlobal = Boolean(cat.global);
        const { credencial, statusCredencial, temRefreshToken } = ehGlobal
          ? await checarCredencialGlobal(cat)
          : await checarCredencialBar(supabase, cat, barId);

        const sync = await pegarUltimaSync(supabase, cat, ehGlobal ? null : barId);
        const volume = await pegarVolume7d(supabase, cat, ehGlobal ? null : barId);
        const { status, problemas } = calcularStatusGeral(
          statusCredencial,
          sync.ultima,
          volume,
          ehGlobal,
          temRefreshToken,
          cat,
        );

        return {
          id: cat.id,
          nome: cat.nome,
          descricao: cat.descricao,
          categoria: cat.categoria,
          logoLabel: cat.logoLabel,
          logoCor: cat.logoCor,
          acento: cat.acento,
          global: ehGlobal,
          statusGeral: status,
          statusCredencial,
          problemas,
          credencial,
          ultimaSync: sync.ultima,
          ultimaSyncStatus: sync.status,
          volume7d: volume,
          crons: cat.crons || [],
          acoes: acoesPara(cat, status),
        };
      }),
    );

    // Resumo agregado
    const resumo = {
      total: integracoes.length,
      conectadas: integracoes.filter((i) => i.statusGeral === 'conectada').length,
      parciais: integracoes.filter((i) => i.statusGeral === 'parcial').length,
      desconectadas: integracoes.filter((i) => i.statusGeral === 'desconectada').length,
      nao_configuradas: integracoes.filter((i) => i.statusGeral === 'nao_configurada').length,
    };

    return NextResponse.json({ success: true, barId, resumo, integracoes });
  } catch (error: any) {
    console.error('[integracoes] exceção:', error);
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
