import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-admin';
import { authenticateUser } from '@/middleware/auth';

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const user_id = searchParams.get('user_id');
    const action = searchParams.get('action');
    const hours = parseInt(searchParams.get('hours') || '24');

    // Calcular timestamp para filtrar por horas
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);

    // Criar cliente Supabase
    const supabase = createServiceRoleClient();

    // Buscar logs de auditoria da tabela security_events
    // (usando eventos de categoria 'audit' ou 'system')
    let query = supabase
      .from('security_events')
      .select('*')
      .in('category', ['audit', 'system', 'access'])
      .gte('timestamp', hoursAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(limit);

    // Filtros opcionais
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    if (action) {
      query = query.ilike('event_type', `%${action}%`);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error('Erro ao buscar logs de auditoria:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao buscar logs de auditoria' },
        { status: 500 }
      );
    }

    // Formatar eventos como logs de auditoria
    const auditLogs =
      events?.map(event => ({
        id: event.id,
        user_id: event.user_id || 'system',
        action: event.event_type,
        resource: event.endpoint || event.details?.resource || 'unknown',
        timestamp: event.timestamp,
        ip_address: event.ip_address,
        details: event.details,
        level: event.level,
        category: event.category,
      })) || [];

    return NextResponse.json({
      success: true,
      logs: auditLogs,
      total: events?.length || 0,
      filters: {
        user_id,
        action,
        hours,
      },
    });
  } catch (error) {
    console.error('Erro interno na API de auditoria:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Endpoint para registrar um log de auditoria
export async function POST(request: NextRequest) {
  await authenticateUser(request);
  try {
    const body = await request.json();

    // Criar cliente Supabase
    const supabase = createServiceRoleClient();

    const { data, error } = await supabase
      .from('security_events')
      .insert([
        {
          event_id: body.event_id || `audit_${Date.now()}`,
          timestamp: new Date().toISOString(),
          bar_id: body.bar_id || null,
          level: 'info',
          category: 'audit',
          event_type: body.action || 'unknown_action',
          user_id: body.user_id || null,
          ip_address: body.ip_address || null,
          user_agent: body.user_agent || null,
          endpoint: body.resource || null,
          details: {
            action: body.action,
            resource: body.resource,
            old_value: body.old_value,
            new_value: body.new_value,
            ...body.details,
          },
          risk_score: 1,
          resolved: true,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Erro ao registrar log de auditoria:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao registrar log de auditoria' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      log: data,
    });
  } catch (error) {
    console.error('Erro interno na API POST de auditoria:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
