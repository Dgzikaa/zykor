#!/usr/bin/env node

// Script de configuração automática do Zykor
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🚀 ZYKOR - Setup de Configuração\n');

// Verificar se .env.local já existe
const envPath = path.join(__dirname, '../.env.local');
const envExists = fs.existsSync(envPath);

if (envExists) {
  console.log('⚠️  .env.local já existe. Criando backup...');
  fs.copyFileSync(envPath, `${envPath}.backup.${Date.now()}`);
}

// Gerar JWT secrets seguros
const jwtSecret = crypto.randomBytes(64).toString('hex');
const jwtRefreshSecret = crypto.randomBytes(64).toString('hex');

// Template do .env.local
const envTemplate = `# ZYKOR - Configuração Automática - ${new Date().toISOString()}

# =============================================================================
# 🔗 SUPABASE (OBRIGATÓRIO - ATUALIZE COM SUAS CHAVES)
# =============================================================================
# ⚠️ NUNCA commite este arquivo com valores reais!
# Obtenha suas chaves em: https://supabase.com/dashboard/project/[seu-projeto]/settings/api
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# =============================================================================
# 🤖 IA PROVIDERS (ADICIONE PELO MENOS UM)
# =============================================================================
# OpenAI (Recomendado para GPT-4)
OPENAI_API_KEY=sk-proj-SUA_CHAVE_OPENAI_AQUI

# Anthropic (Alternativa para Claude)
ANTHROPIC_API_KEY=SUA_CHAVE_ANTHROPIC_AQUI

# =============================================================================
# 🔐 SEGURANÇA (GERADOS AUTOMATICAMENTE)
# =============================================================================
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}

# =============================================================================
# 📊 MONITORAMENTO SENTRY (OPCIONAL)
# =============================================================================
NEXT_PUBLIC_SENTRY_DSN=https://SUA_DSN@sentry.io/PROJECT_ID

# =============================================================================
# 🚨 ALERTAS (OPCIONAL)
# =============================================================================
# Discord Webhook para alertas
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/SEU_WEBHOOK

# Slack Webhook para alertas  
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/SEU_WEBHOOK

# =============================================================================
# 📧 EMAIL PARA ALERTAS LGPD (OPCIONAL)
# =============================================================================
ALERT_EMAIL=rodrigo.zykor@gmail.com.br
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=SEU_EMAIL@gmail.com
SMTP_PASS=SUA_SENHA_APP

# =============================================================================
# 🏢 INFORMAÇÕES DA EMPRESA (LGPD)
# =============================================================================
COMPANY_NAME="Zykor Tecnologia Ltda"
COMPANY_DOCUMENT="00.000.000/0001-00"
COMPANY_ADDRESS="São Paulo, SP"
COMPANY_EMAIL="privacidade@zykor.com.br"
DPO_EMAIL="dpo@zykor.com.br"

# =============================================================================
# 🔢 VERSÃO DO APP
# =============================================================================
NEXT_PUBLIC_APP_VERSION=2.0.0
`;

// Escrever arquivo .env.local
fs.writeFileSync(envPath, envTemplate);

console.log('✅ .env.local criado com sucesso!');
console.log('🔐 JWT Secrets gerados automaticamente');
console.log('\n📝 PRÓXIMOS PASSOS OBRIGATÓRIOS:\n');

console.log('1. 🤖 CONFIGURE A IA (OBRIGATÓRIO):');
console.log('   - OpenAI: https://platform.openai.com/api-keys');
console.log('   - Anthropic: https://console.anthropic.com/');
console.log('   - Adicione a chave no .env.local\n');

console.log('2. 🔗 CONFIGURE O SUPABASE:');
console.log('   - Pegue suas chaves do painel Supabase');
console.log('   - Substitua no .env.local\n');

console.log('3. 📊 CONFIGURE SENTRY (RECOMENDADO):');
console.log('   - https://sentry.io/');
console.log('   - Crie projeto Next.js');
console.log('   - Adicione DSN no .env.local\n');

console.log('4. 🚨 CONFIGURE ALERTAS (OPCIONAL):');
console.log('   - Discord: Configurações > Integrações > Webhooks');
console.log('   - Adicione webhook URL no .env.local\n');

console.log('📋 CHECKLIST:');
console.log('   [ ] API Key da IA configurada');
console.log('   [ ] Chaves Supabase atualizadas');
console.log('   [ ] Sentry configurado (opcional)');
console.log('   [ ] Discord webhook (opcional)');
console.log('   [ ] Teste: npm run dev\n');

console.log('🎉 Zykor pronto para rodar!');
console.log('📖 Leia o env-setup-guide.md para detalhes completos');
