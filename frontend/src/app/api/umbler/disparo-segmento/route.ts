import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';
import { UMBLER_API_V1, UMBLER_ORG_FALLBACK, UMBLER_FROM_FALLBACK, getUmblerToken, umblerAuthHeaders } from '@/lib/umbler';

export const dynamic = 'force-dynamic';

const supabase = createServiceRoleClient();

const UMBLER_SIMPLIFIED = `${UMBLER_API_V1}/messages/simplified/`;
const UMBLER_TEMPLATE_SIMPLIFIED = `${UMBLER_API_V1}/template-messages/simplified/`;

// Segurança: teto de destinatários por disparo (evita timeout e envio acidental massivo).
const MAX_DESTINATARIOS = 500;

const NIVEIS_VALIDOS = ['diamante', 'ouro', 'prata', 'bronze', 'sem_nivel'];

function normalizePhone(phone: string): string {
  if (!phone) return '';
  let d = phone.replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d;
}

function primeiroNome(nome: string | null): string {
  if (!nome) return '';
  return nome.trim().split(/\s+/)[0] || '';
}

// Substitui {nome} e {primeiro_nome} na mensagem do marketing.
function montarMensagem(template: string, nome: string | null): string {
  const nomeCompleto = (nome || '').trim();
  return template
    .replace(/\{primeiro_nome\}/gi, primeiroNome(nome))
    .replace(/\{nome\}/gi, nomeCompleto);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST /api/umbler/disparo-segmento
 * Dispara WhatsApp (Umbler) para aniversariantes filtrados por nível.
 * Grava cada envio em umbler_mensagens com campanha_id + metadata.nivel
 * pra permitir medir a ação por nível depois.
 *
 * body: {
 *   bar_id: number,
 *   dias?: number = 30,            // janela de aniversário
 *   niveis: string[],             // ex: ['ouro','prata']
 *   apenas_proximos7?: boolean,   // só quem faz aniversário em <=7d
 *   message?: string,             // texto livre (modo sem template), aceita {nome}/{primeiro_nome}
 *   template_id?: string,         // se presente: envia via template aprovado da Umbler
 *   template_label?: string,      // rótulo do template (só p/ log)
 *   params?: string[],            // valores/tokens das variáveis do template, em ordem ({{1}},{{2}}...)
 *   dry_run?: boolean = true      // true = só simula e conta, NÃO envia
 * }
 */
export async function POST(request: NextRequest) {
  await authenticateUser(request);
  try {
    const body = await request.json();
    const barId = Number(body.bar_id);
    const dias = Number(body.dias ?? 30);
    const apenasProximos7 = Boolean(body.apenas_proximos7);
    const message: string = (body.message ?? '').toString();
    const templateId: string = (body.template_id ?? '').toString().trim();
    const templateLabel: string = (body.template_label ?? '').toString();
    const paramsTokens: string[] = Array.isArray(body.params) ? body.params.map((p: any) => String(p ?? '')) : [];
    const usaTemplate = templateId.length > 0;
    const dryRun = body.dry_run !== false; // default true — só dispara de verdade com dry_run:false explícito
    const niveis: string[] = Array.isArray(body.niveis)
      ? body.niveis.filter((n: string) => NIVEIS_VALIDOS.includes(n))
      : [];

    if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    if (niveis.length === 0) return NextResponse.json({ error: 'Selecione ao menos um nível' }, { status: 400 });
    if (!dryRun && !usaTemplate && message.trim().length < 5) {
      return NextResponse.json({ error: 'Escolha um template ou escreva a mensagem' }, { status: 400 });
    }

    // Token da conta (com fallback env); org/from/channel de log e rate-limit vêm do bar.
    const [{ data: config }, token] = await Promise.all([
      supabase.from('umbler_config').select('organization_id, channel_id, phone_number, rate_limit_per_minute')
        .eq('bar_id', barId).eq('ativo', true).maybeSingle(),
      getUmblerToken(supabase),
    ]);

    if (!dryRun && !token) {
      return NextResponse.json({ error: 'Token da Umbler não configurado (nem no banco, nem no env)' }, { status: 400 });
    }

    const orgId = config?.organization_id || UMBLER_ORG_FALLBACK;
    const fromPhone = normalizePhone(config?.phone_number || UMBLER_FROM_FALLBACK);

    // 2. Destinatários: aniversariantes na janela, com telefone, nos níveis escolhidos
    const hoje = new Date().toISOString().split('T')[0];
    const fim = new Date(Date.now() + dias * 86400000).toISOString().split('T')[0];
    const hoje7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    let query = (supabase as any).schema('crm').from('aniversariantes')
      .select('cliente_fone_norm, cliente_nome, nivel, proximo_aniver')
      .eq('bar_id', barId)
      .gte('proximo_aniver', hoje)
      .lte('proximo_aniver', apenasProximos7 ? hoje7 : fim)
      .in('nivel', niveis)
      .not('cliente_fone_norm', 'is', null)
      .order('proximo_aniver')
      .limit(MAX_DESTINATARIOS + 1);

    const { data: rows, error } = await query;
    if (error) throw error;

    const destinatarios = (rows ?? []).filter((r: any) => r.cliente_fone_norm);
    const truncado = destinatarios.length > MAX_DESTINATARIOS;
    const lista = destinatarios.slice(0, MAX_DESTINATARIOS);

    // Contagem por nível (pra prévia e pra medição)
    const porNivel: Record<string, number> = {};
    for (const r of lista) {
      const n = r.nivel || 'sem_nivel';
      porNivel[n] = (porNivel[n] || 0) + 1;
    }

    // 3. DRY RUN — não envia nada, só devolve a prévia
    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        modo: usaTemplate ? 'template' : 'texto',
        total: lista.length,
        truncado,
        por_nivel: porNivel,
        amostra: lista.slice(0, 5).map((r: any) => ({
          nome: r.cliente_nome,
          telefone: r.cliente_fone_norm,
          nivel: r.nivel,
          preview: usaTemplate
            ? paramsTokens.map((p) => montarMensagem(p, r.cliente_nome)).join(' | ')
            : montarMensagem(message, r.cliente_nome),
        })),
      });
    }

    // 4. ENVIO REAL — respeita rate_limit_per_minute
    const rate = Number(config?.rate_limit_per_minute) || 60;
    const delayMs = Math.min(Math.ceil(60000 / rate), 500);
    const campanhaId = crypto.randomUUID();
    const agora = new Date().toISOString();

    let enviados = 0;
    let falhas = 0;
    const erros: Array<{ telefone: string; erro: string }> = [];
    const enviadosPorNivel: Record<string, number> = {};

    for (const r of lista) {
      const toPhone = normalizePhone(r.cliente_fone_norm);
      const nivel = r.nivel || 'sem_nivel';
      // Modo template: resolve tokens ({primeiro_nome}) por destinatário; modo texto: mensagem livre.
      const paramsResolvidos = paramsTokens.map((p) => montarMensagem(p, r.cliente_nome));
      const texto = usaTemplate ? paramsResolvidos.join(' | ') : montarMensagem(message, r.cliente_nome);
      let ok = false;
      let msgId = '';
      let erroTxt = '';

      try {
        const resp = await fetch(usaTemplate ? UMBLER_TEMPLATE_SIMPLIFIED : UMBLER_SIMPLIFIED, {
          method: 'POST',
          headers: umblerAuthHeaders(token),
          body: JSON.stringify(
            usaTemplate
              ? {
                  ToPhone: toPhone,
                  FromPhone: fromPhone,
                  OrganizationId: orgId,
                  TemplateId: templateId,
                  Params: paramsResolvidos,
                }
              : {
                  ToPhone: toPhone,
                  FromPhone: fromPhone,
                  OrganizationId: orgId,
                  Message: texto,
                }
          ),
        });
        if (resp.ok) {
          const data = await resp.json().catch(() => ({}));
          msgId = data.id || data.messageId || data.Id || '';
          ok = true;
        } else {
          erroTxt = `HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`;
        }
      } catch (e: any) {
        erroTxt = String(e?.message || e);
      }

      if (ok) {
        enviados++;
        enviadosPorNivel[nivel] = (enviadosPorNivel[nivel] || 0) + 1;
      } else {
        falhas++;
        if (erros.length < 20) erros.push({ telefone: toPhone, erro: erroTxt });
      }

      // Registra o envio (sucesso ou falha) pra medir a ação por nível
      await supabase.from('umbler_mensagens').insert({
        id: msgId || `aniv_${campanhaId}_${enviados + falhas}`,
        bar_id: barId,
        channel_id: config?.channel_id || null,
        direcao: 'saida',
        tipo_remetente: 'campanha',
        contato_telefone: toPhone,
        contato_nome: r.cliente_nome || null,
        tipo_mensagem: usaTemplate ? 'template' : 'text',
        conteudo: texto,
        template_name: usaTemplate ? (templateLabel || templateId) : null,
        template_params: usaTemplate ? paramsResolvidos : null,
        status: ok ? 'enviada' : 'falha',
        erro_mensagem: ok ? null : erroTxt.slice(0, 500),
        campanha_id: campanhaId,
        enviada_em: ok ? new Date().toISOString() : null,
        metadata: { origem: 'aniversariantes', nivel, dias, disparado_em: agora, template_id: usaTemplate ? templateId : null },
      });

      await sleep(delayMs);
    }

    return NextResponse.json({
      dry_run: false,
      modo: usaTemplate ? 'template' : 'texto',
      campanha_id: campanhaId,
      total: lista.length,
      enviados,
      falhas,
      truncado,
      por_nivel: porNivel,
      enviados_por_nivel: enviadosPorNivel,
      erros,
    });
  } catch (error: any) {
    console.error('Erro no disparo segmentado:', error);
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
