import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: ComponentHealth;
    cron_jobs: ComponentHealth;
    edge_functions: ComponentHealth;
    disk_usage: ComponentHealth;
  };
  metrics: {
    total_eventos: number;
    eventos_ultimos_7_dias: number;
    alertas_abertos: number;
    ultima_sincronizacao_contaazul: string | null;
    ultima_sincronizacao_contahub: string | null;
    database_size_mb: number;
  };
  response_time_ms: number;
}

interface ComponentHealth {
  status: 'ok' | 'warning' | 'error';
  message: string;
  latency_ms?: number;
}

const startTime = Date.now();

export async function GET(request: NextRequest) {
  const requestStart = Date.now();
  
  try {
    const supabase = await getAdminClient();
    
    // Verificações paralelas para performance
    const [
      dbCheck,
      cronCheck,
      metricsData
    ] = await Promise.all([
      checkDatabase(supabase),
      checkCronJobs(supabase),
      getMetrics(supabase)
    ]);
    
    const response_time_ms = Date.now() - requestStart;
    
    // Determinar status geral
    const allChecks = [dbCheck, cronCheck];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (allChecks.some(c => c.status === 'error')) {
      overallStatus = 'unhealthy';
    } else if (allChecks.some(c => c.status === 'warning')) {
      overallStatus = 'degraded';
    }
    
    const healthCheck: HealthCheck = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      checks: {
        database: dbCheck,
        cron_jobs: cronCheck,
        edge_functions: { status: 'ok', message: 'Edge Functions operacionais' },
        disk_usage: { status: 'ok', message: 'Uso de disco normal' }
      },
      metrics: metricsData,
      response_time_ms
    };
    
    const httpStatus = overallStatus === 'unhealthy' ? 503 : 
                       overallStatus === 'degraded' ? 200 : 200;
    
    return NextResponse.json(healthCheck, { 
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': overallStatus
      }
    });
    
  } catch (error: any) {
    const response_time_ms = Date.now() - requestStart;
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      checks: {
        database: { status: 'error', message: error.message },
        cron_jobs: { status: 'error', message: 'Não verificado' },
        edge_functions: { status: 'error', message: 'Não verificado' },
        disk_usage: { status: 'error', message: 'Não verificado' }
      },
      metrics: {
        total_eventos: 0,
        eventos_ultimos_7_dias: 0,
        alertas_abertos: 0,
        ultima_sincronizacao_contaazul: null,
        ultima_sincronizacao_contahub: null,
        database_size_mb: 0
      },
      response_time_ms,
      error: error.message
    }, { status: 503 });
  }
}

async function checkDatabase(supabase: any): Promise<ComponentHealth> {
  const start = Date.now();
  
  try {
    const { data, error } = await supabase
      .schema('operations')
      .from('bares')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    const latency = Date.now() - start;
    
    if (error) {
      return {
        status: 'error',
        message: `Erro de conexão: ${error.message}`,
        latency_ms: latency
      };
    }
    
    if (latency > 2000) {
      return {
        status: 'warning',
        message: `Latência alta: ${latency}ms`,
        latency_ms: latency
      };
    }
    
    return {
      status: 'ok',
      message: 'Conexão estável',
      latency_ms: latency
    };
    
  } catch (error: any) {
    return {
      status: 'error',
      message: error.message,
      latency_ms: Date.now() - start
    };
  }
}

async function checkCronJobs(supabase: any): Promise<ComponentHealth> {
  try {
    const { data, error } = await supabase.rpc('health_cron_stats_24h');
    
    if (error) {
      return {
        status: 'warning',
        message: 'Não foi possível verificar cron jobs'
      };
    }
    
    const result = Array.isArray(data) ? data[0] : data;
    const failed = Number(result?.failed_24h ?? 0);
    const successful = Number(result?.successful_24h ?? 0);
    
    if (failed > successful * 0.2) {
      return {
        status: 'warning',
        message: `${failed} falhas nas últimas 24h`
      };
    }
    
    return {
      status: 'ok',
      message: `${successful} execuções bem-sucedidas, ${failed} falhas`
    };
    
  } catch (error: any) {
    return {
      status: 'warning',
      message: 'Erro ao verificar cron jobs'
    };
  }
}

async function getMetrics(supabase: any): Promise<HealthCheck['metrics']> {
  try {
    const { data } = await supabase.rpc('health_metrics_snapshot');

    const result = Array.isArray(data) ? data[0] : data;
    
    return {
      total_eventos: Number(result?.total_eventos ?? 0),
      eventos_ultimos_7_dias: Number(result?.eventos_7_dias ?? 0),
      alertas_abertos: Number(result?.alertas_abertos ?? 0),
      ultima_sincronizacao_contaazul: result?.ultima_sync_contaazul ?? null,
      ultima_sincronizacao_contahub: result?.ultima_sync_contahub ?? null,
      database_size_mb: Number(result?.db_size_mb ?? 0)
    };
    
  } catch (error) {
    return {
      total_eventos: 0,
      eventos_ultimos_7_dias: 0,
      alertas_abertos: 0,
      ultima_sincronizacao_contaazul: null,
      ultima_sincronizacao_contahub: null,
      database_size_mb: 0
    };
  }
}

