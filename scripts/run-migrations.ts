/**
 * Script para executar migrations SQL via Supabase
 * Uso: npx tsx scripts/run-migrations.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variáveis de ambiente não configuradas!');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function executeSql(sql: string, description: string): Promise<void> {
  console.log(`\n🔄 Executando: ${description}...`);
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error(`❌ Erro: ${error.message}`);
      throw error;
    }
    
    console.log(`✅ Sucesso: ${description}`);
  } catch (error: any) {
    console.error(`❌ Falha ao executar: ${description}`);
    console.error(error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Iniciando execução de migrations...\n');
  console.log('📍 Supabase URL:', SUPABASE_URL);
  
  try {
    // 1. Criar tabela audit_log
    console.log('\n📦 ETAPA 1: Criar tabela audit_log');
    await executeSql(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id bigserial PRIMARY KEY,
        user_id integer,
        action text NOT NULL,
        resource text NOT NULL,
        resource_id text,
        changes jsonb,
        ip_address inet,
        user_agent text,
        created_at timestamptz DEFAULT now()
      );
      
      CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
      
      COMMENT ON TABLE audit_log IS 'Logs de auditoria de todas as operações sensíveis';
    `, 'Criar tabela audit_log');

    // 2. Criar tabela security_alerts
    console.log('\n📦 ETAPA 2: Criar tabela security_alerts');
    await executeSql(`
      CREATE TABLE IF NOT EXISTS security_alerts (
        id bigserial PRIMARY KEY,
        type text NOT NULL,
        severity text NOT NULL,
        user_id integer,
        ip_address inet,
        description text NOT NULL,
        metadata jsonb,
        created_at timestamptz DEFAULT now()
      );
      
      CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
      CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(type);
      CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON security_alerts(created_at DESC);
      
      COMMENT ON TABLE security_alerts IS 'Alertas de segurança do sistema';
    `, 'Criar tabela security_alerts');

    // 3. Verificar se tabelas foram criadas
    console.log('\n📦 ETAPA 3: Verificar tabelas criadas');
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['audit_log', 'security_alerts']);

    if (tablesError) {
      console.error('❌ Erro ao verificar tabelas:', tablesError);
    } else {
      console.log('✅ Tabelas criadas:', tables?.map(t => t.table_name).join(', '));
    }

    console.log('\n✅ MIGRATIONS CONCLUÍDAS COM SUCESSO!');
    console.log('\n📋 Próximos passos:');
    console.log('1. Consolidar tabelas de usuários (manual via SQL)');
    console.log('2. Implementar RLS (manual via SQL)');
    console.log('3. Testar sistema de autenticação');
    
  } catch (error) {
    console.error('\n❌ ERRO AO EXECUTAR MIGRATIONS:', error);
    process.exit(1);
  }
}

main();
