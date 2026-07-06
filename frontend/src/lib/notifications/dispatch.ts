/**
 * Dispatcher central de notificações do Zykor.
 *
 * Ponto ÚNICO por onde toda notificação passa. Dado um evento do catálogo,
 * resolve a REGRA do bar (quem recebe, em quais canais) e entrega:
 *   - in_app  → grava em system.notificacoes (Realtime empurra pro sino na hora)
 *   - push    → Web Push nos aparelhos inscritos
 *   - whatsapp→ reservado (Umbler Talk ainda não configurado — no-op)
 *
 * Uso típico (de onde o fato acontece):
 *   await dispatchNotification({
 *     barId, eventKey: 'producao_criada',
 *     titulo: 'Nova produção', mensagem: 'Ficha X foi aberta por Fulano',
 *     url: `/operacional/producoes/${id}`,
 *   }).catch(() => {}); // best-effort: nunca quebra o fluxo principal
 */
import { repos } from '@/lib/repositories';
import { getEvent, type Severidade, type Canal } from './catalog';
import { enviarPushParaUsuarios } from './push-send';
import { enviarWhatsAppParaUsuarios } from './whatsapp-send';

export interface DispatchInput {
  barId: number;
  eventKey: string;
  titulo: string;
  mensagem: string;
  url?: string;
  dados?: Record<string, unknown>;
  /** sobrescreve a severidade padrão do catálogo */
  severidade?: Severidade;
  /**
   * Destinatários explícitos (broadcast manual). Se passado, IGNORA a regra
   * e envia direto pra estes cargos/usuários — mesmo sem regra cadastrada.
   */
  destinatarios?: { authIds?: string[]; roles?: string[] };
  /** sobrescreve os canais (broadcast manual) */
  canais?: Canal[];
}

export interface DispatchResult {
  enviadas: number; // linhas in_app criadas
  push: { enviados: number; removidas: number };
  whatsapp: { enviados: number; semTelefone: number; falhas: number };
  destinatarios: number;
  canais: Canal[];
  pulado: boolean; // true = regra desativada ou sem destinatários
  motivo?: string;
}

const VAZIO = (canais: Canal[], motivo: string): DispatchResult => ({
  enviadas: 0,
  push: { enviados: 0, removidas: 0 },
  whatsapp: { enviados: 0, semTelefone: 0, falhas: 0 },
  destinatarios: 0,
  canais,
  pulado: true,
  motivo,
});

export async function dispatchNotification(input: DispatchInput): Promise<DispatchResult> {
  const evento = getEvent(input.eventKey);
  const { notificacoes, notificationRules, usuarios } = await repos();

  const temOverride = !!(
    input.destinatarios?.authIds?.length || input.destinatarios?.roles?.length
  );

  const rule = temOverride ? null : await notificationRules.buscar(input.barId, input.eventKey);

  // Regra existe e está desativada → não dispara (broadcast manual ignora isso).
  if (rule && rule.ativo === false) {
    return VAZIO([], 'regra_desativada');
  }

  // Canais: override (broadcast) > regra > default do catálogo (in_app).
  const canais: Canal[] =
    input.canais && input.canais.length
      ? input.canais
      : (rule?.canais as Canal[] | undefined)?.length
        ? (rule!.canais as Canal[])
        : ['in_app'];

  // Destinatários (auth_ids).
  const authIds = new Set<string>();
  if (temOverride) {
    input.destinatarios!.authIds?.forEach((id) => authIds.add(id));
    if (input.destinatarios!.roles?.length) {
      const byRole = await usuarios.listarAuthIdsPorBarERoles(
        input.barId,
        input.destinatarios!.roles
      );
      byRole.forEach((id) => authIds.add(id));
    }
  } else if (rule) {
    (rule.target_user_ids ?? []).forEach((id) => authIds.add(id));
    if ((rule.target_roles ?? []).length) {
      const byRole = await usuarios.listarAuthIdsPorBarERoles(input.barId, rule.target_roles);
      byRole.forEach((id) => authIds.add(id));
    }
  }

  if (authIds.size === 0) {
    return VAZIO(canais, rule ? 'sem_destinatarios' : 'sem_regra');
  }

  const severidade = input.severidade ?? evento?.severidadePadrao ?? 'info';
  const categoria = evento?.categoria ?? 'sistema';
  const url = input.url ?? evento?.urlPadrao ?? null;
  const ids = [...authIds];

  // in_app → inbox + realtime
  let enviadas = 0;
  if (canais.includes('in_app')) {
    const created = await notificacoes.criarMuitas(
      ids.map((uid) => ({
        barId: input.barId,
        usuarioId: uid,
        eventKey: input.eventKey,
        categoria,
        severidade,
        titulo: input.titulo,
        mensagem: input.mensagem,
        url,
        dados: input.dados ?? {},
        canais,
      }))
    );
    enviadas = created.length;
  }

  // push
  let push = { enviados: 0, removidas: 0 };
  if (canais.includes('push')) {
    push = await enviarPushParaUsuarios(ids, {
      title: input.titulo,
      body: input.mensagem,
      url: url ?? '/',
      tag: input.eventKey,
      requireInteraction: severidade === 'critico',
    });
  }

  // whatsapp (Umbler Talk — canal oficial). Só dispara se a regra incluir 'whatsapp'.
  let whatsapp = { enviados: 0, semTelefone: 0, falhas: 0 };
  if (canais.includes('whatsapp')) {
    whatsapp = await enviarWhatsAppParaUsuarios(ids, {
      titulo: input.titulo,
      mensagem: input.mensagem,
      url: url ?? undefined,
    });
  }

  return { enviadas, push, whatsapp, destinatarios: ids.length, canais, pulado: false };
}
