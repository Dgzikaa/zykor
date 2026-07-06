/**
 * Envio de WhatsApp reutilizável (servidor → WhatsApp) via Umbler Talk (canal OFICIAL).
 *
 * Chamado pelo dispatcher de notificações (canal 'whatsapp'). Best-effort: nunca lança.
 * Resolve auth_id → telefone (auth_custom.usuarios.telefone) e manda pela API da Umbler.
 *
 * Envia via TEMPLATE aprovado (`zykor_alerta`) pelo endpoint
 * /template-messages/simplified/ → business-initiated, entrega A QUALQUER HORA (não
 * depende da janela de 24h, ninguém precisa mandar "oi" antes). Payload confirmado:
 * { ToPhone, FromPhone, OrganizationId, TemplateId, Params: ["{{1}}","{{2}}"] }.
 * O template tem 2 variáveis no corpo ({{1}}=título, {{2}}=detalhe) + botão ESTÁTICO
 * "Abrir no Zykor" → https://zykor.com.br/alertas?source=whatsapp (sem variável).
 *
 * Config do canal "Zykor Notificações" (número dedicado): FROM/ORG/TEMPLATE por env com
 * fallback pros valores conhecidos; TOKEN só via env (segredo). Ver [[project_twilio_whatsapp_onboarding]].
 */
import { getAdminClient } from '@/lib/supabase-admin';

const UMBLER_BASE = 'https://app-utalk.umbler.com/api/v1';
const UMBLER_FROM = process.env.UMBLER_NOTIF_FROM || '5561998584761';
const UMBLER_ORG = process.env.UMBLER_NOTIF_ORG || 'aDjKophL8jEd_D8m';
const UMBLER_TOKEN = process.env.UMBLER_API_TOKEN || '';
const UMBLER_TEMPLATE = process.env.UMBLER_NOTIF_TEMPLATE_ID || 'akvdZtIp0v4fiRGQ'; // zykor_alerta

/**
 * Sanitiza um parâmetro de template: a Meta rejeita quebras de linha / tabs / >4 espaços
 * seguidos em variável. Colapsa espaços em branco e limita o tamanho.
 */
function sanitizeParam(s: string): string {
  return (s || '').replace(/\s+/g, ' ').trim().slice(0, 1000);
}

export interface WhatsAppPayload {
  titulo: string;
  mensagem: string;
  url?: string;
}

export interface WhatsAppResult {
  enviados: number;
  semTelefone: number;
  falhas: number;
}

/** Normaliza pra E.164 sem "+" (DDI 55). Retorna null se claramente inválido. */
function normalizarTelefone(tel: string): string | null {
  let d = (tel || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d; // DDD + número → +55
  if (d.length < 12 || d.length > 13) return null; // 55 + 10/11 dígitos
  return d;
}

/**
 * Envia WhatsApp para os usuários dados (por auth_id), resolvendo o telefone de cada um.
 * Best-effort — nunca lança. Retorna quantos foram, quantos sem telefone e quantas falhas.
 */
export async function enviarWhatsAppParaUsuarios(
  usuarioIds: string[],
  payload: WhatsAppPayload
): Promise<WhatsAppResult> {
  if (!UMBLER_TOKEN || !UMBLER_FROM || !UMBLER_ORG || !UMBLER_TEMPLATE || usuarioIds.length === 0) {
    return { enviados: 0, semTelefone: usuarioIds.length, falhas: 0 };
  }

  const supabase = await getAdminClient();
  const { data: users, error } = await supabase
    .schema('auth_custom')
    .from('usuarios')
    .select('auth_id, telefone')
    .in('auth_id', usuarioIds)
    .eq('ativo', true);

  if (error || !users) {
    return { enviados: 0, semTelefone: usuarioIds.length, falhas: 0 };
  }

  // Template `zykor_alerta`: {{1}}=título, {{2}}=detalhe. O botão é estático
  // (sempre /alertas?source=whatsapp), então payload.url não vai no WhatsApp.
  const params = [sanitizeParam(payload.titulo), sanitizeParam(payload.mensagem)];

  let enviados = 0;
  let semTelefone = 0;
  let falhas = 0;

  await Promise.all(
    (users as Array<{ telefone: string | null }>).map(async (u) => {
      const tel = u.telefone ? normalizarTelefone(u.telefone) : null;
      if (!tel) {
        semTelefone++;
        return;
      }
      try {
        const res = await fetch(`${UMBLER_BASE}/template-messages/simplified/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${UMBLER_TOKEN}`,
          },
          body: JSON.stringify({
            ToPhone: tel,
            FromPhone: UMBLER_FROM,
            OrganizationId: UMBLER_ORG,
            TemplateId: UMBLER_TEMPLATE,
            Params: params,
          }),
        });
        if (res.ok) enviados++;
        else falhas++;
      } catch {
        falhas++;
      }
    })
  );

  // usuarioIds que nem existem em auth_custom.usuarios também contam como "sem telefone"
  semTelefone += Math.max(0, usuarioIds.length - (users as unknown[]).length);

  return { enviados, semTelefone, falhas };
}
