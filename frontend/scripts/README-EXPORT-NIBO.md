# Exportar Lançamentos NIBO para Conta Azul

Script para gerar arquivos Excel com lançamentos do NIBO formatados para importação no Conta Azul.

## 🎯 O que faz

Gera 2 arquivos CSV (formato Excel) com lançamentos criados após datas específicas:

- **nibo_ordinario_2026-03-25.csv**: Lançamentos do Ordinário criados após 25/03/2026 12:00 BRT
- **nibo_deboche_2026-03-26.csv**: Lançamentos do Deboche criados após 26/03/2026 10:30 BRT

## 📋 Colunas do Excel

Os arquivos gerados contêm as seguintes colunas (formato Conta Azul):

1. Data Competência
2. Data Vencimento
3. Data Pagamento
4. Descrição
5. Fornecedor
6. Categoria
7. Centro de Custo
8. Valor

## 🚀 Como usar

### 1. Instalar dependências (se necessário)

```bash
npm install dotenv @supabase/supabase-js
```

### 2. Executar o script

```bash
node scripts/export-nibo-para-contaazul.js
```

### 3. Arquivos gerados

Os arquivos CSV serão salvos na **raiz do projeto** (pasta `zykor/`):

- `nibo_ordinario_2026-03-25.csv`
- `nibo_deboche_2026-03-26.csv`

## 📝 Notas

- O script busca as credenciais NIBO automaticamente do banco de dados
- Os arquivos são gerados com encoding UTF-8 + BOM para o Excel reconhecer acentos corretamente
- O separador usado é ponto-e-vírgula (`;`) para compatibilidade com Excel BR
- Valores monetários usam vírgula como separador decimal

## ⚙️ Configuração

As datas de corte estão definidas no script em `BARS_CONFIG`:

```javascript
const BARS_CONFIG = [
  {
    id: 3,
    nome: 'Ordinário',
    createdAfter: new Date('2026-03-25T15:00:00Z'), // 12:00 BRT
    filename: 'nibo_ordinario_2026-03-25.csv'
  },
  {
    id: 4,
    nome: 'Deboche',
    createdAfter: new Date('2026-03-26T13:30:00Z'), // 10:30 BRT
    filename: 'nibo_deboche_2026-03-26.csv'
  }
]
```

Para alterar as datas, edite o arquivo `scripts/export-nibo-para-contaazul.js`.

## 🔧 Troubleshooting

### Erro: "Credenciais NIBO não encontradas"

Verifique se as credenciais NIBO estão cadastradas no banco:

```sql
SELECT * FROM api_credentials WHERE sistema = 'nibo' AND ativo = true;
```

### Erro: "NEXT_PUBLIC_SUPABASE_URL não encontrada"

Certifique-se de que o arquivo `frontend/.env.local` existe e contém:

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```
