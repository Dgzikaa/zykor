import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic'

// Interfaces para tipagem
interface ExportData {
  data: {
    profile?: any;
    lgpdSettings?: any;
    userSettings?: any[];
    loginHistory?: any[];
    auditTrail?: any[];
    associatedBars?: any[];
    checklistExecutions?: any[];
    notifications?: any[];
    uploads?: any[];
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Erro ao conectar com banco' },
        { status: 500 }
      );
    }

    // TODO: Implementar autenticação real
    // Por enquanto, usando ID fixo para teste
    const userId = 'test-user-id';

    // Inicializar estrutura de dados para exportação
    let exportData: ExportData = { data: {} };

    // 1. Perfil do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profile) {
      exportData.data.profile = profile;
    }

    // 2. Configurações LGPD
    const { data: lgpdSettings } = await supabase
      .from('user_lgpd_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (lgpdSettings) {
      exportData.data.lgpdSettings = lgpdSettings;
    }

    // 3. Configurações do usuário
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId);

    exportData.data.userSettings = userSettings || [];

    // 4. Histórico de login (últimos 100)
    const { data: loginHistory } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    exportData.data.loginHistory = loginHistory || [];

    // 5. Log de auditoria LGPD
    const { data: auditLogs } = await supabase
      .from('lgpd_audit_log')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false });

    exportData.data.auditTrail = auditLogs || [];

    // 6. Dados de negócio (bars associados)
    const { data: userBars } = await supabase
      .from('user_bars')
      .select(
        `
        *,
        bars (
          id,
          name,
          created_at
        )
      `
      )
      .eq('user_id', userId);

    exportData.data.associatedBars = userBars || [];

    // 7. Execuções de checklist (tabela legada - pode não existir nos tipos)
    const { data: checklistExecutions } = await (supabase as any)
      .from('checklist_executions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);

    exportData.data.checklistExecutions = checklistExecutions || [];

    // 8. Notificações
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    exportData.data.notifications = notifications || [];

    // 9. Uploads/arquivos do usuário
    const { data: uploads } = await supabase
      .from('uploads')
      .select('*')
      .eq('user_id', userId);

    exportData.data.uploads = uploads || [];

    // Log da solicitação de portabilidade
    await supabase.from('lgpd_audit_log').insert({
      user_id: userId,
      action: 'data_portability_requested',
      details: {
        exportedAt: new Date().toISOString(),
        ipAddress: getClientIP(request),
        dataTypes: Object.keys(exportData.data),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Dados de portabilidade gerados com sucesso',
      data: exportData.data,
      meta: {
        exportedAt: new Date().toISOString(),
        totalDataTypes: Object.keys(exportData.data).length,
        dataTypes: Object.keys(exportData.data),
      },
    });
  } catch (error) {
    console.error('Erro ao gerar dados de portabilidade:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  return 'unknown';
}
