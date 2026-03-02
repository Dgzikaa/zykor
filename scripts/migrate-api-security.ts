/**
 * Script para migrar APIs para o novo sistema de autenticação
 * 
 * Uso: npx ts-node scripts/migrate-api-security.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface MigrationRule {
  pattern: RegExp;
  replacement: string;
  description: string;
}

const migrations: MigrationRule[] = [
  // 1. Adicionar imports necessários
  {
    pattern: /^(import.*from.*;\n)/m,
    replacement: `$1import { requireAuth, requireAdmin, requirePermission, logAuditEvent } from '@/lib/auth/server';\n`,
    description: 'Adicionar imports de autenticação'
  },
  
  // 2. Migrar export async function GET para requireAuth
  {
    pattern: /export async function GET\(request: NextRequest\)/g,
    replacement: 'export const GET = requireAuth(async (request, user)',
    description: 'Migrar GET para requireAuth'
  },
  
  // 3. Migrar export async function POST para requireAuth
  {
    pattern: /export async function POST\(request: NextRequest\)/g,
    replacement: 'export const POST = requireAuth(async (request, user)',
    description: 'Migrar POST para requireAuth'
  },
  
  // 4. Migrar export async function PUT para requireAuth
  {
    pattern: /export async function PUT\(request: NextRequest\)/g,
    replacement: 'export const PUT = requireAuth(async (request, user)',
    description: 'Migrar PUT para requireAuth'
  },
  
  // 5. Migrar export async function DELETE para requireAuth
  {
    pattern: /export async function DELETE\(request: NextRequest\)/g,
    replacement: 'export const DELETE = requireAuth(async (request, user)',
    description: 'Migrar DELETE para requireAuth'
  },
  
  // 6. Fechar funções com )
  {
    pattern: /(\n}\n)$/,
    replacement: '});',
    description: 'Fechar HOC'
  },
];

async function migrateFile(filePath: string): Promise<boolean> {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    
    // Verificar se já foi migrado
    if (content.includes('requireAuth') || content.includes('requireAdmin')) {
      console.log(`⏭️  Pulando ${filePath} (já migrado)`);
      return false;
    }
    
    // Aplicar migrações
    for (const migration of migrations) {
      if (migration.pattern.test(content)) {
        content = content.replace(migration.pattern, migration.replacement);
        modified = true;
      }
    }
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ Migrado: ${filePath}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Erro ao migrar ${filePath}:`, error);
    return false;
  }
}

async function main() {
  const apiDir = path.join(process.cwd(), 'frontend', 'src', 'app', 'api');
  const files = await glob(`${apiDir}/**/route.ts`);
  
  console.log(`📦 Encontrados ${files.length} arquivos de API`);
  console.log('🚀 Iniciando migração...\n');
  
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const file of files) {
    const result = await migrateFile(file);
    if (result) {
      migrated++;
    } else if (result === false) {
      skipped++;
    } else {
      errors++;
    }
  }
  
  console.log('\n📊 Resumo:');
  console.log(`✅ Migrados: ${migrated}`);
  console.log(`⏭️  Pulados: ${skipped}`);
  console.log(`❌ Erros: ${errors}`);
}

main().catch(console.error);
