const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const destpath = path.join(__dirname, '..', 'frontend', 'src', 'app', 'api', 'configuracoes', 'templates', 'route.ts');

console.log('📝 Lendo versão limpa do git...');
const content = execSync('git show 5136d802:frontend/src/app/api/configuracoes/templates/route.ts', {
  cwd: path.join(__dirname, '..'),
  encoding: 'utf8'
});

console.log('🔧 Aplicando correções...');

// 1. Remover BOM se existir
let fixed = content.replace(/^\uFEFF/, '');

// 2. Substituir user.user_id por user.auth_id
fixed = fixed.replace(/user\.user_id/g, 'user.auth_id');

// 3. Adicionar check de bar_id no GET
fixed = fixed.replace(
  /(const query = TemplateQuerySchema\.parse\(Object\.fromEntries\(searchParams\)\);)\s*(const supabase = await getAdminClient\(\);)/,
  `$1

    if (!user.bar_id) {
      return NextResponse.json({ error: 'Bar ID não encontrado' }, { status: 400 });
    }
    const barIdStr = user.bar_id.toString();

    $2`
);

// 4. Substituir user.bar_id.toString() por barIdStr
fixed = fixed.replace(/user\.bar_id\.toString\(\)/g, 'barIdStr');

// 5. Corrigir join: usuarios_bar -> usuarios
fixed = fixed.replace(/criado_por:usuarios_bar!/g, 'criado_por:usuarios!');

// 6. Adicionar tipo any[] para templatesParaInstalar
fixed = fixed.replace(/const templatesParaInstalar = \[\];/, 'const templatesParaInstalar: any[] = [];');

console.log('💾 Salvando com UTF-8 sem BOM...');
fs.writeFileSync(destpath, fixed, { encoding: 'utf8' });

console.log('✅ Arquivo corrigido com sucesso!');
