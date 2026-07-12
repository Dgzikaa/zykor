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

// Segmentos válidos da matview crm.cliente_rfm.
const SEGMENTOS_VALIDOS = ['Campeões', 'Leais', 'Em risco', 'Promissores', 'Novos', 'Hibernando', 'Perdidos'];

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
 * POST /api/umbler/disparo-winback
 * Dispara WhatsApp (Umbler) para clientes em risco/dormentes (RFM) — campanha de reativação.
 * Grava cada envio em umbler_mensagens com campanha_id + metadata.segmento
 * pra permitir medir a ação por segmento depois.
 *
 * body: {
 *   bar_id: number,
 *   segmentos: string[],          // ex: ['Em risco','Hibernando','Perdidos']
 *   valor_min?: number = 0,       // monetario >= (valor de vida em R$)
 *   recencia_min?: number = 0,    // recencia_dias >=
 *   recencia_max?: number,        // recencia_dias <= (opcional)
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
    const valorMin = Number(body.valor_min ?? 0) || 0;
    const recenciaMin = Number(body.recencia_min ?? 0) || 0;
    const recenciaMax = body.recencia_max != null && body.recencia_max !== '' ? Number(body.recencia_max) : null;
    const message: string = (body.message ?? '').toString();
    const templateId: string = (body.template_id ?? '').toString().trim();
    const templateLabel: string = (body.template_label ?? '').toString();
    const paramsTokens: string[] = Array.isArray(body.params) ? body.params.map((p: any) => String(p ?? '')) : [];
    const usaTemplate = templateId.length > 0;
    const dryRun = body.dry_run !== false; // default true — só dispara de verdade com dry_run:false explícito
    const segmentos: string[] = Array.isArray(body.segmentos)
      ? body.segmentos.filter((n: string) => SEGMENTOS_VALIDOS.includes(n))
      : [];

    if (!barId) return NextResponse.json({ error: 'bar_id é obrigatório' }, { status: 400 });
    if (segmentos.length === 0) return NextResponse.json({ error: 'Selecione ao menos um segmento' }, { status: 400 });
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

    // 2. Destinatários: clientes RFM nos segmentos escolhidos, com telefone, acima do valor/recência mínimos
    let query = (supabase as any).schema('crm').from('cliente_rfm')
      .select('cliente_fone_norm, cliente_nome, segmento, monetario, recencia_dias')
      .eq('bar_id', barId)
      .in('segmento', segmentos)
      .gte('monetario', valorMin)
      .gte('recencia_dias', recenciaMin)
      .not('cliente_fone_norm', 'is', null)
      .order('monetario', { ascending: false })
      .limit(MAX_DESTINATARIOS + 1);
    if (recenciaMax != null) query = query.lte('recencia_dias', recenciaMax);

    const { data: rows, error } = await query;
    if (error) throw error;

    const destinatarios = (rows ?? []).filter((r: any) => r.cliente_fone_norm);
    const truncado = destinatarios.length > MAX_DESTINATARIOS;
    const lista = destinatarios.slice(0, MAX_DESTINATARIOS);

    // Contagem por segmento (pra prévia e pra medição)
    const porSegmento: Record<string, number> = {};
    for (const r of lista) {
      const seg = r.segmento || 'Sem segmento';
      porSegmento[seg] = (porSegmento[seg] || 0) + 1;
    }

    // 3. DRY RUN — não envia nada, só devolve a prévia
    if (dryRun) {
      return NextResponse.json({
        dry_run: true,
        modo: usaTemplate ? 'template' : 'texto',
        total: lista.length,
        truncado,
        por_segmento: porSegmento,
        amostra: lista.slice(0, 5).map((r: any) => ({
          nome: r.cliente_nome,
          telefone: r.cliente_fone_norm,
          segmento: r.segmento,
          monetario: r.monetario,
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
    const enviadosPorSegmento: Record<string, number> = {};

    for (const r of lista) {
      const toPhone = normalizePhone(r.cliente_fone_norm);
      const segmento = r.segmento || 'Sem segmento';
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
        enviadosPorSegmento[segmento] = (enviadosPorSegmento[segmento] || 0) + 1;
      } else {
        falhas++;
        if (erros.length < 20) erros.push({ telefone: toPhone, erro: erroTxt });
      }

      // Registra o envio (sucesso ou falha) pra medir a ação por segmento
      await supabase.from('umbler_mensagens').insert({
        id: msgId || `winback_${campanhaId}_${enviados + falhas}`,
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
        metadata: { origem: 'win-back', segmento, valor_min: valorMin, recencia_min: recenciaMin, disparado_em: agora, template_id: usaTemplate ? templateId : null },
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
      por_segmento: porSegmento,
      enviados_por_segmento: enviadosPorSegmento,
      erros,
    });
  } catch (error: any) {
    console.error('Erro no disparo win-back:', error);
    return NextResponse.json({ error: error?.message || 'Erro interno' }, { status: 500 });
  }
}
