const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, '..', 'temp-templates.ts');
const destpath = path.join(__dirname, '..', 'frontend', 'src', 'app', 'api', 'configuracoes', 'templates', 'route.ts');

console.log('📝 Lendo arquivo limpo do git...');
let content = fs.readFileSync(filepath, 'utf8');

console.log('🔧 Aplicando correções...');

// 1. Substituir user.user_id por user.auth_id
content = content.replace(/user\.user_id/g, 'user.auth_id');

// 2. Adicionar check de bar_id no GET
content = content.replace(
  /const query = TemplateQuerySchema\.parse\(Object\.fromEntries\(searchParams\)\);\s*const supabase = await getAdminClient\(\);/,
  `const query = TemplateQuerySchema.parse(Object.fromEntries(searchParams));

    if (!user.bar_id) {
      return NextResponse.json({ error: 'Bar ID não encontrado' }, { status: 400 });
    }
    const barIdStr = user.bar_id.toString();

    const supabase = await getAdminClient();`
);

// 3. Substituir user.bar_id.toString() por barIdStr
content = content.replace(/user\.bar_id\.toString\(\)/g, 'barIdStr');

// 4. Corrigir join: usuarios_bar -> usuarios
content = content.replace(/criado_por:usuarios_bar!/g, 'criado_por:usuarios!');

console.log('💾 Salvando arquivo corrigido...');
fs.writeFileSync(destpath, content, 'utf8');

console.log('✅ Arquivo corrigido com sucesso!');
