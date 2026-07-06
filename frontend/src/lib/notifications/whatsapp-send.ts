/**
 * Envio de WhatsApp reutilizável (servidor → WhatsApp) via Umbler Talk (canal OFICIAL).
 *
 * Chamado pelo dispatcher de notificações (canal 'whatsapp'). Best-effort: nunca lança.
 * Resolve auth_id → telefone (auth_custom.usuarios.telefone) e manda pela API da Umbler.
 *
 * ⚠️ Hoje envia TEXTO LIVRE (/messages/simplified/), que o WhatsApp Business só entrega
 * DENTRO da janela de 24h (após a pessoa ter mandado mensagem pro número). Pra alerta
 * business-initiated FORA da janela é preciso TEMPLATE aprovado
 * (/template-messages/simplified/, template `zykor_alerta`) — próximo passo.
 *
 * Config do canal "Zykor Notificações" (número dedicado): FROM/ORG por env com fallback
 * pros valores conhecidos; TOKEN só via env (segredo). Ver [[project_twilio_whatsapp_onboarding]].
 */
import { getAdminClient } from '@/lib/supabase-admin';

const UMBLER_BASE = 'https://app-utalk.umbler.com/api/v1';
const UMBLER_FROM = process.env.UMBLER_NOTIF_FROM || '5561998584761';
const UMBLER_ORG = process.env.UMBLER_NOTIF_ORG || 'aDjKophL8jEd_D8m';
const UMBLER_TOKEN = process.env.UMBLER_API_TOKEN || '';

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
  if (!UMBLER_TOKEN || !UMBLER_FROM || !UMBLER_ORG || usuarioIds.length === 0) {
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

  const destino = payload.url
    ? payload.url.startsWith('http')
      ? payload.url
      : `https://zykor.com.br${payload.url}`
    : null;
  const texto =
    `🟣 *Zykor* — ${payload.titulo}\n\n${payload.mensagem}` +
    (destino ? `\n\n${destino}` : '');

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
        const res = await fetch(`${UMBLER_BASE}/messages/simplified/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${UMBLER_TOKEN}`,
          },
          body: JSON.stringify({
            ToPhone: tel,
            FromPhone: UMBLER_FROM,
            OrganizationId: UMBLER_ORG,
            Message: texto,
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
