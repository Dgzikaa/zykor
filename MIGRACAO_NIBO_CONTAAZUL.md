# Migração Nibo → Conta Azul

## 📋 Status Atual

✅ **Concluído:**
- Tabelas do banco criadas
- Edge Functions deployadas (`contaazul-auth`, `contaazul-sync`)
- APIs do frontend criadas
- Interface (ContaAzulIntegrationCard) criada
- Credenciais salvas no banco:
  - Ordinário (bar_id=3): client_id configurado
  - Deboche (bar_id=4): client_id configurado

⏳ **Pendente:**
- Autenticação OAuth (você precisa fazer manualmente)
- Primeira sincronização de dados
- Validação dos dados
- Desativação do Nibo

---

## 🔧 Passo a Passo para Validação

### **1. Autenticar via OAuth** (OBRIGATÓRIO)

Você precisa autorizar cada bar manualmente:

#### Ordinário (bar_id=3):
1. Abra no navegador: `https://zykor.com.br/api/financeiro/contaazul/oauth/authorize?bar_id=3`
2. Faça login com a conta do **CNPJ do Ordinário**
3. Clique em "Autorizar"
4. Você será redirecionado para `/configuracoes?contaazul=connected`

#### Deboche (bar_id=4):
1. Abra no navegador: `https://zykor.com.br/api/financeiro/contaazul/oauth/authorize?bar_id=4`
2. Faça login com a conta do **CNPJ do Deboche**
3. Clique em "Autorizar"
4. Você será redirecionado para `/configuracoes?contaazul=connected`

**OU** use a interface:
1. Acesse `https://zykor.com.br/configuracoes/integracoes`
2. Selecione o bar (Ordinário ou Deboche)
3. No card "Conta Azul", clique em **"Conectar Conta Azul"**

---

### **2. Testar Conexão e Sincronização**

Depois de autenticar, rode o script de teste:

```bash
node scripts/test-contaazul-connection.js
```

Este script vai:
- ✅ Verificar se a autenticação está OK
- ✅ Testar sincronização (categorias, centros custo, pessoas, contas, lançamentos)
- ✅ Mostrar estatísticas dos dados sincronizados

**Resultado esperado:**
```
🚀 Teste de Conexão Conta Azul

🔍 Testando Ordinário (bar_id=3)...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ Verificando status da autenticação...
   ✅ Status: { connected: true, has_credentials: true, ... }
2️⃣ Testando sincronização (full_sync)...
   ✅ Sincronização concluída!
   📊 Estatísticas: { lancamentos: 150, categorias: 45, ... }
   ⏱️  Duração: 12s

🔍 Testando Deboche (bar_id=4)...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
...

📊 RESUMO:
   Ordinário: ✅ OK
   Deboche: ✅ OK

🎉 Todos os testes passaram! Conta Azul está 100% funcional.
```

---

### **3. Verificar Dados Sincronizados**

```bash
# Ver dados de ambos os bares
node scripts/verificar-dados-contaazul.js

# Ver dados de um bar específico
node scripts/verificar-dados-contaazul.js 3  # Ordinário
node scripts/verificar-dados-contaazul.js 4  # Deboche
```

Este script mostra:
- 📁 Categorias sincronizadas
- 🏢 Centros de custo
- 👥 Fornecedores
- 💳 Contas financeiras
- 💰 Lançamentos (receitas e despesas)
- 📋 Histórico de sincronizações

---

### **4. Testar na Interface**

1. Acesse `https://zykor.com.br/configuracoes/integracoes`
2. Selecione um bar
3. No card "Conta Azul" você deve ver:
   - ✅ Badge "Conectado" (verde)
   - 📊 Estatísticas (lançamentos, categorias, etc)
   - 📅 Data da última sincronização
   - 🔄 Botão "Sincronizar Agora"

4. Clique em "Sincronizar Agora" para testar sync manual

---

## 🔍 Troubleshooting

### Erro: "Credenciais não configuradas"
- Verifique se as credenciais estão no banco:
  ```sql
  SELECT bar_id, sistema, client_id FROM api_credentials WHERE sistema = 'conta_azul';
  ```

### Erro: "Token expirado"
- O sistema renova automaticamente, mas se falhar:
  1. Vá em Configurações > Integrações
  2. Clique em "Conectar Conta Azul" novamente

### Erro 401 na sincronização
- Refaça a autenticação OAuth (passo 1)

### Nenhum lançamento sincronizado
- Verifique o período: por padrão sincroniza mês atual + mês anterior
- Para período customizado, use a API:
  ```bash
  curl -X POST https://zykor.com.br/api/financeiro/contaazul/sync \
    -H "Content-Type: application/json" \
    -d '{"bar_id": 3, "sync_mode": "custom", "date_from": "2024-01-01", "date_to": "2024-12-31"}'
  ```

---

## 📊 Estrutura de Dados

### Tabelas criadas:
- `contaazul_lancamentos` - Lançamentos (receitas e despesas)
- `contaazul_categorias` - Categorias
- `contaazul_centros_custo` - Centros de custo
- `contaazul_pessoas` - Fornecedores/clientes
- `contaazul_contas_financeiras` - Contas bancárias
- `contaazul_logs_sincronizacao` - Logs de sincronização

### Modos de sincronização:
- `daily_incremental` - Últimos 2 dias (alterações)
- `full_month` - Mês atual + mês anterior
- `full_sync` - Sync completo (categorias + lançamentos)
- `custom` - Período customizado

---

## ✅ Checklist de Validação

Antes de desativar o Nibo, confirme:

- [ ] OAuth funcionando para ambos os bares
- [ ] Sincronização full_sync executada com sucesso
- [ ] Dados visíveis no banco (categorias, lançamentos, etc)
- [ ] Interface mostrando status "Conectado"
- [ ] Sincronização manual funcionando
- [ ] Lançamentos com valores corretos
- [ ] Categorias mapeadas corretamente
- [ ] Fornecedores importados

---

## 🚀 Próximos Passos (Após Validação)

Quando tudo estiver 100% funcional:

1. **Desativar Nibo:**
   - Remover `NiboIntegrationCard` da interface
   - Desativar credenciais Nibo no banco
   - Remover scripts de exportação Nibo

2. **Configurar Sync Automático:**
   - Criar cron job para sync diário
   - Configurar alertas de falha

3. **Criar Dashboards:**
   - Visualização de lançamentos
   - Relatórios financeiros
   - Conciliação bancária

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs das Edge Functions no Supabase Dashboard
2. Rode os scripts de teste
3. Verifique a tabela `contaazul_logs_sincronizacao`
