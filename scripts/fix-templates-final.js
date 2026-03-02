const fs = require('fs');
const path = require('path');

const filepath = path.join(__dirname, '..', 'frontend', 'src', 'app', 'api', 'configuracoes', 'templates', 'route.ts');

console.log('📝 Lendo arquivo...');
let content = fs.readFileSync(filepath, 'utf8');

console.log('🔧 Aplicando correções finais...');

// 1. Adicionar check de bar_id após parse do query
const regex1 = /(const query = TemplateQuerySchema\.parse\(Object\.fromEntries\(searchParams\)\);)\s*(const supabase = await getAdminClient\(\);)/;
if (regex1.test(content)) {
  content = content.replace(regex1, `$1

    if (!user.bar_id) {
      return NextResponse.json({ error: 'Bar ID não encontrado' }, { status: 400 });
    }
    const barIdStr = user.bar_id.toString();

    $2`);
  console.log('✅ Adicionado check de bar_id no GET');
}

// 2. Substituir user.bar_id.toString() por barIdStr
const antes = content;
content = content.replace(/user\.bar_id\.toString\(\)/g, 'barIdStr');
if (content !== antes) {
  console.log('✅ Substituído user.bar_id.toString() por barIdStr');
}

// 3. Corrigir join: usuarios_bar -> usuarios
content = content.replace(/criado_por:usuarios_bar!/g, 'criado_por:usuarios!');
console.log('✅ Corrigido join usuarios_bar -> usuarios');

console.log('💾 Salvando arquivo...');
fs.writeFileSync(filepath, content, 'utf8');

console.log('✅ Correções aplicadas com sucesso!');
