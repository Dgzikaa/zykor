import { NextRequest, NextResponse } from 'next/server';
import { securityMonitor } from '@/lib/security-monitor';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic'

// Tipos para eventos de segurança
interface SecurityEvent {
  id?: number;
  level: 'critical' | 'warning' | 'info';
  category:
    | 'auth'
    | 'access'
    | 'injection'
    | 'rate_limit'
    | 'api_abuse'
    | 'backup'
    | 'system';
  event_type: string;
  ip_address?: string;
  user_agent?: string;
  endpoint?: string;
  details?: Record<string, unknown>;
  risk_score: number;
  timestamp?: string;
}

interface SuspiciousPattern {
  level: 'critical' | 'warning';
  category: 'auth' | 'api_abuse';
  event_type: string;
  ip_address: string;
  user_agent: string;
  endpoint: string;
  details: Record<string, unknown>;
  risk_score: number;
}

interface SuspiciousIP {
  ip: string;
  count: number;
}

interface IPGroups {
  [key: string]: SecurityEvent[];
}

interface EndpointGroups {
  [key: string]: SecurityEvent[];
}

interface DailyMetrics {
  critical_events: number;
  warning_events: number;
  info_events: number;
  auth_events: number;
  access_events: number;
  injection_events: number;
  rate_limit_events: number;
  api_abuse_events: number;
  backup_events: number;
  system_events: number;
  unique_ips: number;
  failed_logins: number;
  blocked_ips: number;
}

// Type guard para verificar se é um SecurityEvent
function isSecurityEvent(obj: unknown): obj is SecurityEvent {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'event_type' in obj &&
    typeof (obj as SecurityEvent).event_type === 'string'
  );
}

// Função para criar cliente Supabase com validação
function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Variáveis de ambiente Supabase não configuradas');
  }

  return createClient(supabaseUrl, serviceKey);
}

export async function GET(request: NextRequest) {
  try {
    // Verificar se é uma requisição de cron válida
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Criar cliente Supabase apenas quando necessário
    const supabase = getSupabaseClient();

    // 1. Verificar eventos suspeitos dos últimos 5 minutos
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);

    const { data: recentEvents, error: eventsError } = await supabase
      .from('security_events')
      .select('*')
      .gte('timestamp', last5Minutes.toISOString())
      .order('timestamp', { ascending: false });

    if (eventsError) {
      console.error('Erro ao buscar eventos recentes:', eventsError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Converter para SecurityEvent[] com validação
    const validatedEvents: SecurityEvent[] = (recentEvents || [])
      .filter(isSecurityEvent)
      .map(event => ({
        id: event.id,
        level: event.level,
        category: event.category,
        event_type: event.event_type,
        ip_address: event.ip_address,
        user_agent: event.user_agent,
        endpoint: event.endpoint,
        details: event.details,
        risk_score: event.risk_score,
        timestamp: event.timestamp,
      }));

    // 2. Análise de padrões suspeitos
    const suspiciousPatterns = await analyzeSuspiciousPatterns(validatedEvents);

    // 3. Registrar eventos detectados
    for (const pattern of suspiciousPatterns) {
      await securityMonitor.logEvent({
        level: pattern.level,
        category: pattern.category,
        event_type: pattern.event_type,
        ip_address: pattern.ip_address,
        user_agent: pattern.user_agent,
        endpoint: pattern.endpoint,
        details: pattern.details,
        risk_score: pattern.risk_score,
      });
    }

    // 4. Verificar IPs suspeitos
    const suspiciousIPs = await checkSuspiciousIPs(validatedEvents);

    // 5. Gerar eventos de sistema
    await generateSystemEvents();

    // 6. Calcular e salvar métricas diárias
    await calculateDailyMetrics(supabase);

    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      events_analyzed: validatedEvents.length,
      suspicious_patterns: suspiciousPatterns.length,
      suspicious_ips: suspiciousIPs.length,
      system_events_generated: 3,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Erro no monitoramento de segurança:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Analisar padrões suspeitos
async function analyzeSuspiciousPatterns(
  events: SecurityEvent[]
): Promise<SuspiciousPattern[]> {
  const patterns: SuspiciousPattern[] = [];

  // Múltiplas tentativas de login do mesmo IP
  const loginAttempts = events.filter(e => e.event_type === 'failed_login');
  const ipGroups = groupByIP(loginAttempts);

  for (const [ip, attempts] of Object.entries(ipGroups)) {
    if (attempts.length >= 3) {
      patterns.push({
        level: 'critical',
        category: 'auth',
        event_type: 'brute_force_detected',
        ip_address: ip,
        user_agent: attempts[0]?.user_agent || 'unknown',
        endpoint: '/api/auth/login',
        details: {
          attempt_count: attempts.length,
          time_window: '5_minutes',
          pattern: 'brute_force',
        },
        risk_score: 90,
      });
    }
  }

  // Múltiplas requisições para endpoints sensíveis
  const sensitiveEndpoints = ['/api/usuarios', '/api/configuracoes', '/api/configuracoes/security'];
  const sensitiveRequests = events.filter(
    e =>
      e.endpoint &&
      sensitiveEndpoints.some(endpoint => e.endpoint!.includes(endpoint))
  );

  const endpointGroups = groupByEndpoint(sensitiveRequests);
  for (const [endpoint, requests] of Object.entries(endpointGroups)) {
    if (requests.length >= 10) {
      patterns.push({
        level: 'warning',
        category: 'api_abuse',
        event_type: 'endpoint_abuse_detected',
        ip_address: requests[0]?.ip_address || 'unknown',
        user_agent: requests[0]?.user_agent || 'unknown',
        endpoint: endpoint,
        details: {
          request_count: requests.length,
          time_window: '5_minutes',
          pattern: 'endpoint_abuse',
        },
        risk_score: 70,
      });
    }
  }

  return patterns;
}

// Verificar IPs suspeitos
async function checkSuspiciousIPs(
  events: SecurityEvent[]
): Promise<SuspiciousIP[]> {
  const ipCounts = new Map<string, number>();

  events.forEach(event => {
    if (event.ip_address) {
      ipCounts.set(event.ip_address, (ipCounts.get(event.ip_address) || 0) + 1);
    }
  });

  const suspiciousIPs: SuspiciousIP[] = [];
  for (const [ip, count] of ipCounts.entries()) {
    if (count >= 20) {
      // Mais de 20 eventos em 5 minutos
      suspiciousIPs.push({ ip, count });
    }
  }

  return suspiciousIPs;
}

// Gerar eventos de sistema
async function generateSystemEvents() {
  const timestamp = new Date().toISOString();

  // Evento de verificação de sistema
  await securityMonitor.logEvent({
    level: 'info',
    category: 'system',
    event_type: 'security_check_completed',
    ip_address: 'system',
    user_agent: 'security-monitor-cron',
    endpoint: '/api/configuracoes/cron/security-monitor',
    details: {
      check_type: 'automated',
      timestamp: timestamp,
    },
    risk_score: 5,
  });

  // Simular alguns eventos de sistema baseados em horário
  const hour = new Date().getHours();

  if (hour >= 22 || hour <= 6) {
    // Horário de baixa atividade
    await securityMonitor.logEvent({
      level: 'info',
      category: 'system',
      event_type: 'low_activity_period',
      ip_address: 'system',
      user_agent: 'security-monitor-cron',
      endpoint: '/api/configuracoes/cron/security-monitor',
      details: {
        period: 'night',
        hour: hour,
      },
      risk_score: 1,
    });
  }

  if (hour >= 8 && hour <= 18) {
    // Horário de alta atividade
    await securityMonitor.logEvent({
      level: 'info',
      category: 'system',
      event_type: 'high_activity_period',
      ip_address: 'system',
      user_agent: 'security-monitor-cron',
      endpoint: '/api/configuracoes/cron/security-monitor',
      details: {
        period: 'business_hours',
        hour: hour,
      },
      risk_score: 2,
    });
  }
}

// Calcular métricas diárias
async function calculateDailyMetrics(supabase: SupabaseClient) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: todayEvents, error } = await supabase
    .from('security_events')
    .select('*')
    .gte('timestamp', today.toISOString())
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Erro ao buscar eventos do dia:', error);
    return;
  }

  const events = (todayEvents || []).filter(isSecurityEvent);

  const metrics: DailyMetrics = {
    critical_events: events.filter(e => e.level === 'critical').length,
    warning_events: events.filter(e => e.level === 'warning').length,
    info_events: events.filter(e => e.level === 'info').length,
    auth_events: events.filter(e => e.category === 'auth').length,
    access_events: events.filter(e => e.category === 'access').length,
    injection_events: events.filter(e => e.category === 'injection').length,
    rate_limit_events: events.filter(e => e.category === 'rate_limit').length,
    api_abuse_events: events.filter(e => e.category === 'api_abuse').length,
    backup_events: events.filter(e => e.category === 'backup').length,
    system_events: events.filter(e => e.category === 'system').length,
    unique_ips: new Set(events.map(e => e.ip_address).filter(Boolean)).size,
    failed_logins: events.filter(e => e.event_type === 'failed_login').length,
    blocked_ips: events.filter(e => e.event_type === 'ip_blocked').length,
  };

  // Salvar métricas diárias
  await supabase.from('security_daily_metrics').upsert({
    date: today.toISOString().split('T')[0],
    ...metrics,
    updated_at: new Date().toISOString(),
  });

}

// Funções auxiliares
function groupByIP(events: SecurityEvent[]): IPGroups {
  const groups: IPGroups = {};

  events.forEach(event => {
    const ip = event.ip_address || 'unknown';
    if (!groups[ip]) groups[ip] = [];
    groups[ip].push(event);
  });

  return groups;
}

function groupByEndpoint(events: SecurityEvent[]): EndpointGroups {
  const groups: EndpointGroups = {};

  events.forEach(event => {
    const endpoint = event.endpoint || 'unknown';
    if (!groups[endpoint]) groups[endpoint] = [];
    groups[endpoint].push(event);
  });

  return groups;
}
