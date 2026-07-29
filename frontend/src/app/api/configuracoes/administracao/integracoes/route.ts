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
  escopo: 'plataforma' | 'bar';
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
          row.api_token || row.api_key || row.access_token || row.client_secret ||
          row.configuracoes?.enc, // credenciais no formato envelope (cifrado)
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
      // `.schema()` explícito: instagram_contas tem alias em public, mas google_oauth_tokens só
      // existe em integrations — sem isso o PostgREST não acha a tabela e o card apareceria como
      // "não configurada" sem erro nenhum (a falha calada clássica do from() sem schema).
      const base = fonte.schema ? supabase.schema(fonte.schema) : supabase;
      const { data: row } = await base
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
          // Google: qual conta autorizou e qual ficha está amarrada ao bar
          conta_google: (row as any).google_email || null,
          ficha: (row as any).location_nome || (row as any).location_id || null,
        };
        credencial.expires_at = (row as any).expires_at;
        credencial.detalhes_extras = {
          conectado_em: (row as any).conectado_em,
          ultima_sync_em: (row as any).ultima_sync_em,
          token_type: (row as any).token_type,
          ...((row as any).ultimo_erro ? { ultimo_erro: (row as any).ultimo_erro } : {}),
        };
        temRefreshToken = Boolean((row as any).refresh_token);
        // O access_token do Google dura 1h — sem esta ressalva o card viveria "expirado" mesmo
        // funcionando, porque o token se renova sozinho pelo refresh na hora do uso.
        const expirado =
          (row as any).expires_at && new Date((row as any).expires_at).getTime() < Date.now();
        if ((row as any).ativo === false) statusCredencial = 'desativada';
        else if (expirado && !temRefreshToken) statusCredencial = 'expirado';
        else if (
          !temRefreshToken &&
          (row as any).expires_at &&
          new Date((row as any).expires_at).getTime() < Date.now() + 7 * 86400_000
        )
          statusCredencial = 'expirando';
        else statusCredencial = 'ok';
        return { credencial, statusCredencial, temRefreshToken };
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

/**
 * O catálogo diz o schema de cada tabela (bronze/system/integrations/financial), mas o client
 * padrão aponta pra `public` — e NENHUMA dessas tabelas tem view-alias em public. Sem aplicar
 * o schema, toda consulta de saúde falhava calada: volume7d e ultimaSync vinham null e o
 * painel dizia "Sem atividade nos últimos 7 dias" pra integração que estava rodando redondo
 * (ContaHub e Google Reviews, verificado em 26/07/2026 — havia dado do próprio dia).
 */
function de(supabase: any, schema: string | undefined, tabela: string) {
  return (schema && schema !== 'public' ? supabase.schema(schema) : supabase).from(tabela);
}

async function pegarUltimaSync(
  supabase: any,
  cat: IntegracaoCatalogo,
  barId: number | null,
): Promise<{ ultima: string | null; status: string | null }> {
  let melhorTimestamp: string | null = null;
  let statusEncontrado: string | null = null;

  for (const fonte of cat.fontesSync || []) {
    let q = de(supabase, fonte.schema, fonte.tabela)
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
  let q = de(supabase, cat.volumeTabela.schema, cat.volumeTabela.tabela)
    .select('*', { count: 'exact', head: true })
    .gte(cat.volumeTabela.colunaTempo, desde);
  if (barId != null) {
    q = q.eq(cat.volumeTabela.colunaBar || 'bar_id', barId);
  }
  const { count, error } = await q;
  if (error) return null;
  return count ?? 0;
}

/**
 * Já houve QUALQUER dado desta integração pra este bar, em qualquer época?
 *
 * É o que separa "o cron parou" de "este bar não usa isso". Sem essa distinção o painel
 * mandava verificar o cron do GetIn no Deboche — sendo que o Deboche nunca teve GetIn
 * (a API é só do Ordinário). Uma linha só, ordenada por tempo: barato.
 */
async function jaTeveAtividade(supabase: any, cat: IntegracaoCatalogo, barId: number | null): Promise<boolean | null> {
  if (!cat.volumeTabela) return null;
  let q = de(supabase, cat.volumeTabela.schema, cat.volumeTabela.tabela)
    .select(cat.volumeTabela.colunaTempo)
    .order(cat.volumeTabela.colunaTempo, { ascending: false })
    .limit(1);
  if (barId != null) q = q.eq(cat.volumeTabela.colunaBar || 'bar_id', barId);
  const { data, error } = await q;
  if (error) return null;
  return (data?.length ?? 0) > 0;
}

function calcularStatusGeral(
  statusCred: StatusCredencial,
  ultimaSync: string | null,
  volume7d: number | null,
  global: boolean,
  temRefreshToken: boolean,
  cat: IntegracaoCatalogo,
  jaTeve: boolean | null,
): { status: StatusGeral; problemas: string[] } {
  const problemas: string[] = [];
  const naoExpira = Boolean(cat.naoExpira);
  const opcional = Boolean(cat.opcional);

  // Atividade recente = forte sinal de "tá funcionando", override credencial.
  // Quando existe tabela de volume, ela MANDA: é o único sinal que filtra por bar. Log de
  // sync às vezes não tem bar_id (GetIn é assim) e, se valesse, o Deboche apareceria
  // "conectado" no GetIn por causa da sync do Ordinário.
  const temAtividadeRecente = volume7d != null
    ? volume7d > 0
    : (ultimaSync ? (Date.now() - new Date(ultimaSync).getTime()) / 3600_000 < 48 : false);

  // Integração configurada por evidência de atividade — credencial pode estar em outro lugar (Supabase secrets)
  if (cat.inferirPorAtividade) {
    if (temAtividadeRecente) {
      return { status: 'conectada', problemas: [] };
    }
    if (statusCred === 'ausente') {
      // Sem credencial e sem atividade: "nunca rodou aqui" e "parou de rodar" são coisas
      // diferentes e precisam de resposta diferente. Só é problema de cron se um dia já
      // teve dado deste bar.
      if (jaTeve === false) {
        return { status: 'nao_configurada', problemas: ['Este bar não usa esta integração'] };
      }
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
    // "Expirando em menos de 7 dias" só faz sentido pra token LONGO (Instagram dura 60 dias).
    // Com refresh token, expirar é o comportamento normal: o do Conta Azul vive ~1h e é
    // renovado sob demanda (+ cron de 6min), então a condição era SEMPRE verdadeira e virava
    // alarme permanente de uma coisa que funciona — bar 3 já renovou 15 vezes. Se o refresh
    // parasse de verdade, o token viraria 'expirado' e cairia nas regras acima.
    if (statusCred === 'expirando' && !temRefreshToken) {
      problemas.push('Token expirando em menos de 7 dias');
    }
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
  // ações declaradas no catálogo (ex.: Configurar token do Tangerino) + as hardcoded abaixo
  const acoes: IntegracaoResposta['acoes'] = [...(cat.acoes || [])];

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

    // Config de operação do bar (diz quais integrações o bar realmente usa).
    const { data: barConfig } = await supabase
      .schema('operations' as any)
      .from('bares_config')
      .select('tem_api_contahub, tem_api_yuzer, tem_api_sympla')
      .eq('bar_id', barId)
      .maybeSingle();

    // Bar em "modo manual" (sem ContaHub/integrações) — não cobra integração ausente.
    const { data: barRow } = await supabase
      .schema('operations' as any)
      .from('bares')
      .select('config')
      .eq('id', barId)
      .maybeSingle();
    const modoManual = Boolean((barRow as any)?.config?.modo_manual);

    const integracoes: IntegracaoResposta[] = await Promise.all(
      CATALOGO_INTEGRACOES.map(async (cat) => {
        const ehGlobal = Boolean(cat.global);
        const escopo: 'plataforma' | 'bar' = cat.escopo ?? (ehGlobal ? 'plataforma' : 'bar');

        // Integração do bar com flag desligada => o bar não usa. Não infere
        // status por atividade/credencial global (era o que dava "ContaHub
        // conectado" num bar sem ContaHub).
        if (escopo === 'bar' && cat.flagBar && barConfig && (barConfig as any)[cat.flagBar] === false) {
          return {
            id: cat.id, nome: cat.nome, descricao: cat.descricao, categoria: cat.categoria,
            logoLabel: cat.logoLabel, logoCor: cat.logoCor, acento: cat.acento,
            global: ehGlobal, escopo,
            statusGeral: 'nao_configurada' as StatusGeral,
            statusCredencial: 'ausente' as StatusCredencial,
            problemas: ['Este bar não usa esta integração'],
            credencial: { fonte: null, valor_mascarado: {}, expires_at: null, detalhes_extras: {} },
            ultimaSync: null, ultimaSyncStatus: null, volume7d: null,
            crons: cat.crons || [], acoes: [],
          };
        }
        // Paralelizar as 3 chamadas (credencial + ultima sync + volume).
        // Antes rodava sequencial — com 30 integracoes era O(3N) round trips,
        // agora eh O(N) round trips (~3x mais rapido por endpoint).
        const [credResult, sync, volume] = await Promise.all([
          ehGlobal
            ? checarCredencialGlobal(cat)
            : checarCredencialBar(supabase, cat, barId),
          pegarUltimaSync(supabase, cat, ehGlobal ? null : barId),
          pegarVolume7d(supabase, cat, ehGlobal ? null : barId),
        ]);
        const { credencial, statusCredencial, temRefreshToken } = credResult;
        // Só pergunta "já teve alguma vez?" quando não há atividade recente — que é o único
        // caso em que a resposta muda algo. Assim o caminho normal continua em 3 queries.
        const jaTeve = (volume ?? 0) > 0
          ? true
          : await jaTeveAtividade(supabase, cat, ehGlobal ? null : barId);
        let { status, problemas } = calcularStatusGeral(
          statusCredencial,
          sync.ultima,
          volume,
          ehGlobal,
          temRefreshToken,
          cat,
          jaTeve,
        );

        // Bar manual: integração do bar sem credencial não é "atenção", é só "não configurada".
        if (modoManual && escopo === 'bar' && statusCredencial === 'ausente' && status === 'parcial') {
          status = 'nao_configurada';
          problemas = ['Bar manual — integração não configurada'];
        }

        return {
          id: cat.id,
          nome: cat.nome,
          descricao: cat.descricao,
          categoria: cat.categoria,
          logoLabel: cat.logoLabel,
          logoCor: cat.logoCor,
          acento: cat.acento,
          global: ehGlobal,
          escopo,
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

    // Resumo: o número que importa pro bar é só das integrações DO BAR.
    // Plataforma (infra/IA/global) conta à parte pra não inflar o "conectadas".
    const doBar = integracoes.filter((i) => i.escopo === 'bar');
    const plataforma = integracoes.filter((i) => i.escopo === 'plataforma');
    const resumo = {
      total: doBar.length,
      conectadas: doBar.filter((i) => i.statusGeral === 'conectada').length,
      parciais: doBar.filter((i) => i.statusGeral === 'parcial').length,
      desconectadas: doBar.filter((i) => i.statusGeral === 'desconectada').length,
      nao_configuradas: doBar.filter((i) => i.statusGeral === 'nao_configurada').length,
      plataforma_total: plataforma.length,
      plataforma_ok: plataforma.filter((i) => i.statusGeral === 'conectada').length,
    };

    return NextResponse.json({ success: true, barId, resumo, integracoes }, {
      headers: {
        // Status de integracao muda lento (minutos). Cache 60s por usuario,
        // serve stale ate 5min enquanto revalida em background.
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch (error: any) {
    console.error('[integracoes] exceção:', error);
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
