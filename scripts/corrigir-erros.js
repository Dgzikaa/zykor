const fs = require('fs');
const path = require('path');

const FRONTEND = path.join(__dirname, '..', 'frontend', 'src');

// Substituir user.user_id por user.auth_id em todos os arquivos
function substituirUserIdGlobal() {
  const arquivos = [
    'app/api/configuracoes/atribuicoes/route.ts',
    'app/api/configuracoes/atribuicoes/[id]/route.ts',
    'app/api/configuracoes/notifications/route.ts',
    'app/api/configuracoes/notifications/[id]/route.ts',
    'app/api/configuracoes/reports/templates/route.ts',
    'app/api/configuracoes/templates/route.ts',
    'app/api/configuracoes/templates/[id]/route.ts',
    'app/api/configuracoes/uploads/route.ts',
    'app/api/operacional/checklists/[id]/route.ts',
    'app/api/operacional/checklists/[id]/rollback/route.ts',
    'app/api/operacional/checklists/agendamentos/route.ts',
    'app/api/operacional/execucoes/[id]/finalizar/route.ts',
    'app/api/operacional/execucoes/[id]/route.ts'
  ];

  let total = 0;
  arquivos.forEach(arquivo => {
    const filepath = path.join(FRONTEND, arquivo);
    if (fs.existsSync(filepath)) {
      let content = fs.readFileSync(filepath, 'utf8');
      const antes = content;
      content = content.replace(/user\.user_id/g, 'user.auth_id');
      if (content !== antes) {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`✅ ${arquivo}`);
        total++;
      }
    }
  });
  return total;
}

// Adicionar check de bar_id e substituir user.bar_id.toString()
function adicionarCheckBarId() {
  const arquivos = [
    'app/api/configuracoes/atribuicoes/route.ts',
    'app/api/configuracoes/atribuicoes/[id]/route.ts',
    'app/api/configuracoes/notifications/route.ts',
    'app/api/configuracoes/templates/route.ts',
    'app/api/operacional/checklists/agendamentos/route.ts',
    'app/api/operacional/checklists/badge-data/route.ts'
  ];

  let total = 0;
  arquivos.forEach(arquivo => {
    const filepath = path.join(FRONTEND, arquivo);
    if (fs.existsSync(filepath)) {
      let content = fs.readFileSync(filepath, 'utf8');
      
      // Se já tem barIdStr, pular
      if (content.includes('const barIdStr')) {
        return;
      }
      
      // Adicionar check após getAdminClient
      const regex = /(const supabase = await getAdminClient\(\);?\s*\n)/;
      if (regex.test(content)) {
        content = content.replace(regex, `$1
    if (!user.bar_id) {
      return NextResponse.json({ error: 'Bar ID não encontrado' }, { status: 400 });
    }
    const barIdStr = user.bar_id.toString();

`);
        // Substituir user.bar_id.toString() por barIdStr
        content = content.replace(/user\.bar_id\.toString\(\)/g, 'barIdStr');
        
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(`✅ ${arquivo} (bar_id check)`);
        total++;
      }
    }
  });
  return total;
}

console.log('🔧 Corrigindo erros de TypeScript...\n');
console.log('📝 Substituindo user.user_id por user.auth_id...');
const total1 = substituirUserIdGlobal();
console.log(`\n📝 Adicionando checks de bar_id...`);
const total2 = adicionarCheckBarId();
console.log(`\n✨ Concluído! ${total1 + total2} arquivos corrigidos`);
