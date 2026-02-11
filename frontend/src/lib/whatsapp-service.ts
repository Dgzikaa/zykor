import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

// ========================================
// 📱 WHATSAPP NOTIFICATION SERVICE (LEGADO)
// ========================================
// DEPRECATED: Usa tabelas whatsapp_configuracoes, whatsapp_contatos, whatsapp_mensagens que foram removidas.
// Sistema atual: Umbler (umbler_config, umbler_conversas, umbler_mensagens).
// Prefira /api/umbler/send para envio de mensagens.
// ========================================

export interface WhatsAppConfig {
  phone_number_id: string;
  access_token: string;
  api_version: string;
  rate_limit_per_minute: number;
  template_prefix: string;
  idioma: string;
}

export interface WhatsAppContact {
  id: number;
  numero_whatsapp: string;
  nome_contato: string;
  aceita_notificacoes: boolean;
  aceita_lembretes: boolean;
  aceita_relatorios: boolean;
  horario_inicio: string;
  horario_fim: string;
  dias_semana: number[];
}

export interface WhatsAppTemplate {
  name: string;
  body_text: string;
  parameters: string[];
  variables_count: number;
}

export interface SendMessageOptions {
  destinatario: string;
  template_name?: string;
  template_parameters?: string[];
  conteudo?: string;
  modulo: string;
  checklist_id?: number;
  checklist_execucao_id?: number;
  notificacao_id?: number;
  prioridade?: 'baixa' | 'normal' | 'alta';
}

// Interfaces para notificações
interface NotificationData {
  id: number;
  tipo: string;
  titulo: string;
  mensagem: string;
  modulo: string;
  usuario_id?: number;
  checklist_id?: number;
  checklist_execucao_id?: number;
  dados_adicional?: Record<string, unknown>;
}

interface UserData {
  id: number;
  nome: string;
  email: string;
  numero_whatsapp?: string;
}

interface WhatsAppMessage {
  messaging_product: string;
  to: string;
  type: string;
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: string;
      parameters: Array<{
        type: string;
        text: string;
      }>;
    }>;
  };
  text?: {
    body: string;
  };
}

// Interfaces para tipagem adequada
interface WhatsAppMessageData {
  id?: string;
  tipo_mensagem: 'template' | 'text';
  template_name?: string;
  template_parameters?: string[];
  conteudo?: string;
  status: string;
  error_message?: string;
  tentativas: number;
  enviado_em?: string;
  entregue_em?: string;
  lido_em?: string;
  modulo: string;
  checklist_id?: string;
  checklist_execucao_id?: string;
  created_at: string;
}

interface WhatsAppPayload {
  messaging_product: string;
  to: string;
  type: 'template' | 'text';
  template?: {
    name: string;
    language: { code: string };
    components: Array<{
      type: string;
      parameters: Array<{
        type: string;
        text: string;
      }>;
    }>;
  };
  text?: {
    body: string;
  };
}

export class WhatsAppNotificationService {
  private barId: number;
  private config: WhatsAppConfig | null = null;

  constructor(barId: number) {
    this.barId = barId;
  }

  // ========================================
  // 🔧 CONFIGURAÇÃO E INICIALIZAÇÃO
  // ========================================

  /**
   * Inicializa o serviço carregando configurações
   */
  async initialize(): Promise<boolean> {
    try {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      if (!supabase) {
        console.error('Supabase client não disponível');
        return false;
      }

      const { data: config } = await (supabase as any)
        .from('whatsapp_configuracoes')
        .select('*')
        .eq('bar_id', this.barId)
        .eq('ativo', true)
        .single();

      if (config) {
        this.config = config;
        return true;
      }

      return false;
    } catch (error) {
      console.error('Erro ao inicializar WhatsApp Service:', error);
      return false;
    }
  }

  /**
   * Verifica se WhatsApp está ativo
   */
  isActive(): boolean {
    return this.config !== null;
  }

  // ========================================
  // 📞 GERENCIAMENTO DE CONTATOS
  // ========================================

  /**
   * Busca contato WhatsApp por usuário
   */
  async getContactByUserId(usuarioId: number): Promise<WhatsAppContact | null> {
    try {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      if (!supabase) {
        return null;
      }

      const { data: contato } = await (supabase as any)
        .from('whatsapp_contatos')
        .select('*')
        .eq('bar_id', this.barId)
        .eq('usuario_id', usuarioId)
        .single();

      return contato as any;
    } catch (error) {
      console.error('Erro ao buscar contato por usuário:', error);
      return null;
    }
  }

  /**
   * Busca contato WhatsApp por número
   */
  async getContactByPhone(
    numeroWhatsapp: string
  ): Promise<WhatsAppContact | null> {
    try {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      if (!supabase) {
        return null;
      }

      const { data: contato } = await (supabase as any)
        .from('whatsapp_contatos')
        .select('*')
        .eq('bar_id', this.barId)
        .eq('numero_whatsapp', numeroWhatsapp)
        .single();

      return contato as any;
    } catch (error) {
      console.error('Erro ao buscar contato por número:', error);
      return null;
    }
  }

  /**
   * Cria novo contato WhatsApp
   */
  async createContact(
    usuarioId: number,
    numeroWhatsapp: string,
    nomeContato: string
  ): Promise<WhatsAppContact | null> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) {
        return null;
      }

      const { data: contato } = await (supabase as any)
        .from('whatsapp_contatos')
        .insert({
          bar_id: this.barId,
          usuario_id: usuarioId,
          numero_whatsapp: numeroWhatsapp,
          nome_contato: nomeContato,
          aceita_notificacoes: true,
          aceita_lembretes: true,
          aceita_relatorios: true,
          horario_inicio: '08:00',
          horario_fim: '22:00',
          dias_semana: JSON.stringify([1, 2, 3, 4, 5, 6, 7]),
        })
        .select()
        .single();

      return contato as any;
    } catch (error) {
      console.error('Erro ao criar contato:', error);
      return null;
    }
  }

  // ========================================
  // 📋 GERENCIAMENTO DE TEMPLATES
  // ========================================

  /**
   * Busca template por nome
   */
  async getTemplate(templateName: string): Promise<WhatsAppTemplate | null> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) {
        return null;
      }

      const { data: template } = await (supabase as any)
        .from('whatsapp_templates')
        .select('*')
        .eq('bar_id', this.barId)
        .eq('name', templateName)
        .eq('ativo', true)
        .single();

      return template as any;
    } catch (error) {
      console.error('Erro ao buscar template:', error);
      return null;
    }
  }

  /**
   * Busca templates por módulo
   */
  async getTemplatesByModule(modulo: string): Promise<WhatsAppTemplate[]> {
    try {
      const supabase = await getSupabaseClient();
      if (!supabase) {
        return [];
      }

      const { data: templates } = await (supabase as any)
        .from('whatsapp_templates')
        .select('*')
        .eq('bar_id', this.barId)
        .eq('modulo', modulo)
        .eq('ativo', true);

      return (templates as any) || [];
    } catch (error) {
      console.error('Erro ao buscar templates por módulo:', error);
      return [];
    }
  }

  // ========================================
  // 📤 ENVIO DE MENSAGENS
  // ========================================

  /**
   * Envia mensagem WhatsApp
   */
  async sendMessage(options: SendMessageOptions): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      if (!this.config) {
        return { success: false, error: 'WhatsApp não configurado' };
      }

      // Buscar contato
      const contato = await this.getContactByPhone(options.destinatario);
      if (!contato) {
        return { success: false, error: 'Contato não encontrado' };
      }

      // Verificar permissões
      if (!this.canSendNotification(contato, options.modulo)) {
        return { success: false, error: 'Notificação não permitida' };
      }

      // Verificar horário
      if (!this.isWithinAllowedHours(contato)) {
        return { success: false, error: 'Fora do horário permitido' };
      }

      // Preparar mensagem
      const mensagem: WhatsAppMessageData = {
        tipo_mensagem: options.template_name ? 'template' : 'text',
        template_name: options.template_name,
        template_parameters: options.template_parameters,
        conteudo: options.conteudo,
        status: 'pendente',
        tentativas: 0,
        modulo: options.modulo,
        checklist_id: options.checklist_id?.toString(),
        checklist_execucao_id: options.checklist_execucao_id?.toString(),
        created_at: new Date().toISOString(),
      };

      // Salvar no banco
      const supabase = await getSupabaseClient();
      if (!supabase) {
        return { success: false, error: 'Erro de conexão' };
      }

      const { data: mensagemSalva, error: saveError } = await (supabase as any)
        .from('whatsapp_mensagens')
        .insert({
          ...(mensagem as any),
          bar_id: this.barId,
          destinatario: options.destinatario,
        })
        .select()
        .single();

      if (saveError) {
        return { success: false, error: 'Erro ao salvar mensagem' };
      }

      // Enviar via API
      const result = await this.sendToWhatsAppAPI(contato, mensagem);

      // Atualizar status
      await (supabase as any)
        .from('whatsapp_mensagens')
        .update({
          status: result.success ? 'enviado' : 'erro',
          error_message: result.errorMessage,
          enviado_em: result.success ? new Date().toISOString() : null,
        })
        .eq('id', mensagemSalva.id);

      return {
        success: result.success,
        messageId: result.messageId,
        error: result.errorMessage,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Envia mensagem com template
   */
  async sendTemplateMessage(
    destinatario: string,
    templateName: string,
    parameters: string[] = [],
    context?: {
      modulo: string;
      checklist_id?: number;
      checklist_execucao_id?: number;
      notificacao_id?: number;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return this.sendMessage({
      destinatario,
      template_name: templateName,
      template_parameters: parameters,
      modulo: context?.modulo || 'geral',
      checklist_id: context?.checklist_id,
      checklist_execucao_id: context?.checklist_execucao_id,
    });
  }

  /**
   * Processa notificação para WhatsApp
   */
  async processNotificationForWhatsApp(
    notificacao: NotificationData
  ): Promise<boolean> {
    try {
      if (!notificacao.usuario_id) {
        return false;
      }

      // Buscar usuário
      const supabase = await getSupabaseClient();
      if (!supabase) {
        return false;
      }

      const { data: usuario } = await supabase
        .from('usuarios_bar')
        .select('id, nome, email, user_id')
        .eq('user_id', notificacao.usuario_id.toString())
        .single();

      if (!usuario) {
        return false;
      }

      // Buscar contato WhatsApp
      const contato = await this.getContactByUserId(notificacao.usuario_id);
      if (!contato) {
        return false;
      }

      // Selecionar template
      const templateInfo = await this.selectTemplateForNotification(notificacao);
      if (!templateInfo) {
        return false;
      }

      // Preparar parâmetros
      const parameters = this.prepareTemplateParameters(
        notificacao,
        usuario as any,
        templateInfo.template
      );

      // Enviar mensagem
      const result = await this.sendTemplateMessage(
        contato.numero_whatsapp,
        templateInfo.templateName,
        parameters,
        {
          modulo: notificacao.modulo,
          checklist_id: notificacao.checklist_id,
          checklist_execucao_id: notificacao.checklist_execucao_id,
        }
      );

      return result.success;
    } catch (error) {
      console.error('Erro ao processar notificação WhatsApp:', error);
      return false;
    }
  }

  // ========================================
  // 🔧 MÉTODOS PRIVADOS
  // ========================================

  /**
   * Verifica se pode enviar notificação
   */
  private canSendNotification(
    contato: WhatsAppContact,
    modulo: string
  ): boolean {
    switch (modulo) {
      case 'checklists':
        return contato.aceita_lembretes;
      case 'relatorios':
        return contato.aceita_relatorios;
      default:
        return contato.aceita_notificacoes;
    }
  }

  /**
   * Verifica se está dentro do horário permitido
   */
  private isWithinAllowedHours(contato: WhatsAppContact): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const startTime = parseInt(contato.horario_inicio.split(':')[0]) * 60 + 
                     parseInt(contato.horario_inicio.split(':')[1]);
    const endTime = parseInt(contato.horario_fim.split(':')[0]) * 60 + 
                   parseInt(contato.horario_fim.split(':')[1]);

    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * Envia mensagem para API WhatsApp
   */
  private async sendToWhatsAppAPI(
    contato: WhatsAppContact,
    mensagem: WhatsAppMessageData
  ): Promise<{
    success: boolean;
    messageId?: string;
    errorCode?: string;
    errorMessage?: string;
  }> {
    try {
      if (!this.config) {
        return {
          success: false,
          errorMessage: 'Configuração não encontrada',
        };
      }

      const payload: WhatsAppPayload = {
        messaging_product: 'whatsapp',
        to: contato.numero_whatsapp,
        type: 'text',
      };

      if (mensagem.tipo_mensagem === 'template') {
        payload.type = 'template';
        payload.template = {
          name: mensagem.template_name!,
          language: { code: this.config.idioma },
          components: [],
        };

        if (
          mensagem.template_parameters &&
          mensagem.template_parameters.length > 0
        ) {
          payload.template.components.push({
            type: 'body',
            parameters: mensagem.template_parameters.map((param: string) => ({
              type: 'text',
              text: param,
            })),
          });
        }
      } else {
        payload.type = 'text';
        payload.text = { body: mensagem.conteudo || '' };
      }

      const response = await fetch(
        `https://graph.facebook.com/v${this.config.api_version}/${this.config.phone_number_id}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.config.access_token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (response.ok) {
        return {
          success: true,
          messageId: result.messages?.[0]?.id,
        };
      } else {
        return {
          success: false,
          errorCode: result.error?.code,
          errorMessage: result.error?.message,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      return {
        success: false,
        errorMessage,
      };
    }
  }

  /**
   * Seleciona template para notificação
   */
  private async selectTemplateForNotification(
    notificacao: NotificationData
  ): Promise<{
    templateName: string;
    template: WhatsAppTemplate;
  } | null> {
    // Mapear tipo de notificação para template
    const templateMap: Record<string, string> = {
      'lembrete_agendamento': 'sgb_lembrete_checklist',
      'checklist_atrasado': 'sgb_checklist_atrasado',
      'checklist_concluido': 'sgb_checklist_concluido',
      'meta_atingida': 'sgb_meta_atingida',
      'relatorio_pronto': 'sgb_relatorio_pronto',
    };

    const templateName = templateMap[notificacao.tipo] || 'sgb_notificacao_geral';
    const template = await this.getTemplate(templateName);

    if (!template) {
      return null;
    }

    return { templateName, template };
  }

  /**
   * Prepara parâmetros do template
   */
  private prepareTemplateParameters(
    notificacao: NotificationData,
    usuario: UserData,
    template: WhatsAppTemplate
  ): string[] {
    const parameters: string[] = [];

    // Mapear variáveis do template
    for (const param of template.parameters) {
      switch (param) {
        case 'nome_usuario':
          parameters.push(usuario.nome);
          break;
        case 'titulo_notificacao':
          parameters.push(notificacao.titulo);
          break;
        case 'mensagem_notificacao':
          parameters.push(notificacao.mensagem);
          break;
        case 'modulo':
          parameters.push(notificacao.modulo);
          break;
        case 'data_hora':
          parameters.push(new Date().toLocaleString('pt-BR'));
          break;
        default:
          parameters.push('N/A');
      }
    }

    return parameters;
  }
}

// ========================================
// 🚀 FUNÇÃO DE CRIAÇÃO DO SERVIÇO
// ========================================

export async function createWhatsAppService(
  barId: number
): Promise<WhatsAppNotificationService | null> {
  const service = new WhatsAppNotificationService(barId);
  const initialized = await service.initialize();
  return initialized ? service : null;
}

// ========================================
// 📱 WHATSAPP SERVICE (LEGACY)
// ========================================

interface ChecklistAlert {
  id: string;
  checklistId: string;
  titulo: string;
  categoria: string;
  nivel: 'baixo' | 'medio' | 'alto' | 'critico';
  tempoAtraso: number;
  horaEsperada: string;
  responsavel?: string;
  setor?: string;
}

interface ChecklistExecution {
  id: string;
  checklist_id: string;
  titulo: string;
  responsavel: string;
  setor: string;
  tempo_execucao: number;
  total_itens: number;
  itens_ok: number;
  itens_problema: number;
  status: string;
  observacoes_gerais?: string;
  concluido_em: string;
}

interface WhatsAppMessageTemplates {
  reminder: string;
  alert: string;
  completion: string;
  share: string;
}

export class WhatsAppService {
  private static templates: WhatsAppMessageTemplates = {
    reminder: `🔔 *Lembrete de Checklist*
    
Olá {funcionario}! 

O checklist *{checklist}* precisa ser executado às *{horario}* no setor *{setor}*.

Prioridade: {prioridade}

Execute agora para manter a qualidade do serviço! 🎯`,

    alert: `🚨 *Checklist Atrasado*
    
*{checklist}* está atrasado há *{tempo_atraso}*!

Responsável: {responsavel}
Setor: {setor}
Hora esperada: {hora_esperada}

**Ação imediata necessária!** ⚡`,

    completion: `✅ *Checklist Concluído*
    
Parabéns, {funcionario}! 

Checklist *{checklist}* executado com sucesso:
• Tempo: {tempo_execucao} min
• Itens OK: {itens_ok}/{total_itens}
• Score: {score}%

Setor: {setor}
Concluído em: {concluido_em}

Excelente trabalho! 🎉`,

    share: `📋 *Checklist Compartilhado*
    
{checklist} foi executado por {responsavel}:

📊 *Resultados:*
• Tempo: {tempo_execucao} min
• Score: {score}%
• Status: {status}

📝 *Observações:*
{observacoes}

Setor: {setor}
Data: {data}`,
  };

  // ========================================
  // 📤 MÉTODOS DE ENVIO
  // ========================================

  static async sendMessage(to: string, message: string): Promise<boolean> {
    try {
      // Implementação básica - pode ser expandida
      console.log(`Enviando mensagem para ${to}:`, message);
      return true;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      return false;
    }
  }

  static async sendReminder(
    phoneNumber: string,
    checklistNome: string,
    horario: string,
    setor: string,
    funcionario: string,
    prioridade: string
  ): Promise<boolean> {
    const message = this.templates.reminder
      .replace('{funcionario}', funcionario)
      .replace('{checklist}', checklistNome)
      .replace('{horario}', horario)
      .replace('{setor}', setor)
      .replace('{prioridade}', this.formatPrioridade(prioridade));

    return this.sendMessage(phoneNumber, message);
  }

  static async sendAlert(
    phoneNumber: string,
    alert: ChecklistAlert
  ): Promise<boolean> {
    const message = this.templates.alert
      .replace('{checklist}', alert.titulo)
      .replace('{tempo_atraso}', this.formatTempoAtraso(alert.tempoAtraso))
      .replace('{responsavel}', alert.responsavel || 'Não definido')
      .replace('{setor}', alert.setor || 'Geral')
      .replace('{hora_esperada}', alert.horaEsperada);

    return this.sendMessage(phoneNumber, message);
  }

  static async sendCompletion(
    phoneNumber: string,
    execution: ChecklistExecution
  ): Promise<boolean> {
    const score = Math.round((execution.itens_ok / execution.total_itens) * 100);
    const message = this.templates.completion
      .replace('{funcionario}', execution.responsavel)
      .replace('{checklist}', execution.titulo)
      .replace('{tempo_execucao}', execution.tempo_execucao.toString())
      .replace('{itens_ok}', execution.itens_ok.toString())
      .replace('{total_itens}', execution.total_itens.toString())
      .replace('{score}', score.toString())
      .replace('{setor}', execution.setor)
      .replace('{concluido_em}', execution.concluido_em);

    return this.sendMessage(phoneNumber, message);
  }

  static async shareChecklist(
    phoneNumbers: string[],
    execution: ChecklistExecution
  ): Promise<{ success: number; failed: number }> {
    const score = Math.round((execution.itens_ok / execution.total_itens) * 100);
    const message = this.templates.share
      .replace('{checklist}', execution.titulo)
      .replace('{responsavel}', execution.responsavel)
      .replace('{tempo_execucao}', execution.tempo_execucao.toString())
      .replace('{score}', score.toString())
      .replace('{status}', this.formatStatus(execution.status))
      .replace('{observacoes}', execution.observacoes_gerais || 'Nenhuma observação')
      .replace('{setor}', execution.setor)
      .replace('{data}', new Date().toLocaleDateString('pt-BR'));

    let success = 0;
    let failed = 0;

    for (const phoneNumber of phoneNumbers) {
      const result = await this.sendMessage(phoneNumber, message);
      if (result) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }

  // ========================================
  // 🔧 MÉTODOS UTILITÁRIOS
  // ========================================

  static async testConnection(phoneNumber: string): Promise<boolean> {
    try {
      const testMessage = '🔧 Teste de conexão SGB - Se você recebeu esta mensagem, a integração está funcionando!';
      return await this.sendMessage(phoneNumber, testMessage);
    } catch (error) {
      console.error('Erro no teste de conexão:', error);
      return false;
    }
  }

  private static formatPrioridade(prioridade: string): string {
    const map: Record<string, string> = {
      baixa: '🟢 Baixa',
      normal: '🟡 Normal',
      alta: '🔴 Alta',
      critica: '⚫ Crítica',
    };
    return map[prioridade] || '🟡 Normal';
  }

  private static formatNivelUrgencia(nivel: string): string {
    const map: Record<string, string> = {
      baixo: '🟢 Baixo',
      medio: '🟡 Médio',
      alto: '🔴 Alto',
      critico: '⚫ Crítico',
    };
    return map[nivel] || '🟡 Médio';
  }

  private static formatTempoAtraso(minutos: number): string {
    if (minutos < 60) {
      return `${minutos} minutos`;
    } else if (minutos < 1440) {
      const horas = Math.floor(minutos / 60);
      return `${horas} hora${horas > 1 ? 's' : ''}`;
    } else {
      const dias = Math.floor(minutos / 1440);
      return `${dias} dia${dias > 1 ? 's' : ''}`;
    }
  }

  private static formatStatus(status: string): string {
    const map: Record<string, string> = {
      concluido: '✅ Concluído',
      pendente: '⏳ Pendente',
      atrasado: '🚨 Atrasado',
      cancelado: '❌ Cancelado',
    };
    return map[status] || status;
  }

  private static generateResultSummary(execution: ChecklistExecution): string {
    const score = Math.round((execution.itens_ok / execution.total_itens) * 100);
    const emoji = score >= 90 ? '🎉' : score >= 70 ? '👍' : score >= 50 ? '⚠️' : '❌';
    
    return `${emoji} Score: ${score}% | Tempo: ${execution.tempo_execucao}min | Itens: ${execution.itens_ok}/${execution.total_itens}`;
  }

  // ========================================
  // ⚙️ CONFIGURAÇÃO
  // ========================================

  static setCustomTemplates(
    customTemplates: Partial<WhatsAppMessageTemplates>
  ): void {
    this.templates = { ...this.templates, ...customTemplates };
  }

  static getTemplates(): WhatsAppMessageTemplates {
    return { ...this.templates };
  }

  // ========================================
  // 📊 ESTATÍSTICAS
  // ========================================

  static async getMessageStats(userId: string): Promise<{
    total: number;
    sent: number;
    failed: number;
    lastSent?: string;
  }> {
    // TODO: Implementar busca real de estatísticas
    return {
      total: 0,
      sent: 0,
      failed: 0,
    };
  }

  // ========================================
  // ⏰ PROCESSAMENTO AUTOMÁTICO
  // ========================================

  static async processScheduledReminders(): Promise<void> {
    try {
      // Implementação para processar lembretes agendados
      console.log('Processando lembretes agendados...');
    } catch (error) {
      console.error('Erro ao processar lembretes:', error);
    }
  }

  // ========================================
  // 🔍 VALIDAÇÃO
  // ========================================

  static validatePhoneNumber(phoneNumber: string): boolean {
    // Remove caracteres especiais
    const cleanNumber = phoneNumber.replace(/[^\d]/g, '');
    
    // Verifica se tem entre 10 e 15 dígitos
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
      return false;
    }
    
    // Verifica se começa com código de país (Brasil: 55)
    if (cleanNumber.startsWith('55')) {
      return cleanNumber.length >= 12; // 55 + DDD + número
    }
    
    return cleanNumber.length >= 10; // DDD + número
  }

  static formatPhoneNumber(phoneNumber: string): string {
    // Remove caracteres especiais
    let cleanNumber = phoneNumber.replace(/[^\d]/g, '');
    
    // Adiciona código do Brasil se não tiver
    if (!cleanNumber.startsWith('55')) {
      cleanNumber = '55' + cleanNumber;
    }
    
    // Formata: +55 11 99999-9999
    if (cleanNumber.length === 13) {
      return `+${cleanNumber.slice(0, 2)} ${cleanNumber.slice(2, 4)} ${cleanNumber.slice(4, 9)}-${cleanNumber.slice(9)}`;
    }
    
    return `+${cleanNumber}`;
  }
}

// ========================================
// 🎣 HOOK REACT
// ========================================

export function useWhatsApp() {
  const sendMessage = async (to: string, message: string) => {
    return WhatsAppService.sendMessage(to, message);
  };

  const sendReminder = async (
    phoneNumber: string,
    checklistNome: string,
    horario: string,
    setor: string,
    funcionario: string,
    prioridade: string
  ) => {
    return WhatsAppService.sendReminder(
      phoneNumber,
      checklistNome,
      horario,
      setor,
      funcionario,
      prioridade
    );
  };

  const sendAlert = async (phoneNumber: string, alert: ChecklistAlert) => {
    return WhatsAppService.sendAlert(phoneNumber, alert);
  };

  const sendCompletion = async (
    phoneNumber: string,
    execution: ChecklistExecution
  ) => {
    return WhatsAppService.sendCompletion(phoneNumber, execution);
  };

  const shareChecklist = async (
    phoneNumbers: string[],
    execution: ChecklistExecution
  ) => {
    return WhatsAppService.shareChecklist(phoneNumbers, execution);
  };

  const testConnection = async (phoneNumber: string) => {
    return WhatsAppService.testConnection(phoneNumber);
  };

  const validatePhone = (phoneNumber: string) => {
    return WhatsAppService.validatePhoneNumber(phoneNumber);
  };

  const formatPhone = (phoneNumber: string) => {
    return WhatsAppService.formatPhoneNumber(phoneNumber);
  };

  return {
    sendMessage,
    sendReminder,
    sendAlert,
    sendCompletion,
    shareChecklist,
    testConnection,
    validatePhone,
    formatPhone,
  };
}
