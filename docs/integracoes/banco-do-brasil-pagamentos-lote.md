# Banco do Brasil — API Pagamentos em Lote

Integração de pagamentos (PIX, TED/transferência, boleto, tributos) para
`/ferramentas/agendamento`, ao lado da integração Inter (PIX avulso) já existente.

Status: **estrutura pronta, aguardando acesso BB**. Quando o convênio PAG e as
credenciais do Portal Developers estiverem liberados, seguir o checklist abaixo.

## Por que é diferente do Inter

| | Inter (PIX) | BB (Lote) |
|---|---|---|
| Modelo | 1 POST = 1 PIX | cria lote → libera → consulta liquidação |
| Tipos | PIX | PIX, TED, boleto, tributos |
| Confirmação | webhook + polling | consulta de liquidação (sem webhook) |
| Auth | client_id/secret no corpo | OAuth Basic + `gw-dev-app-key` |
| Cert | mTLS | mTLS Certificado A1 (ICP-Brasil, >1 ano) |

## O que o acesso BB produz (lado do cliente)

No [Portal Developers BB](https://app.developers.bb.com.br) + contrato do convênio PAG:

1. **client_id** e **client_secret** (credenciais OAuth da aplicação)
2. **gw-dev-app-key** (chave da aplicação — vai em toda chamada de API)
3. **Certificado A1** (`.crt` + `.key`, ou `.pfx` que se converte) — CA válida, validade > 1 ano
4. **número do convênio PAG**, agência e conta de débito

## Checklist de conexão

### 1. Subir o certificado A1 (bucket privado)
- Criar bucket **`bb`** no Supabase Storage com **public = false**
- Subir `certificado.crt` e `chave.key`

### 2. Cadastrar a credencial (uma por bar — Ordinário e Deboche)
```sql
INSERT INTO api_credentials (
  bar_id, sistema, ambiente, client_id, client_secret,
  empresa_nome, empresa_cnpj, ativo, configuracoes
) VALUES (
  3, 'banco_brasil', 'producao',  -- 'sandbox' p/ homologar primeiro
  '<client_id>', '<client_secret>',
  'ORDI BAR - API BB', '<cnpj>', true,
  jsonb_build_object(
    'gw_dev_app_key', '<gw-dev-app-key>',
    'numero_convenio', '<convenio_pag>',
    'agencia', '<agencia>',
    'conta', '<conta>',
    'cert_file', 'certificado.crt',  -- nome no bucket bb
    'key_file', 'chave.key'
  )
);
-- repetir para bar_id = 4 (Deboche)
```

### 3. Aplicar a migration de tracking
`database/migrations/2026-06-01-bb-pagamentos-lote-tracking.sql`

### 4. Validar o swagger e destravar os TODOs
Com o acesso ao portal, conferir no swagger do BB e ajustar os pontos marcados
`TODO(swagger BB)` em:
- `frontend/src/lib/bb/getAccessToken.ts` — path do token + scopes
- `frontend/src/lib/bb/lotePagamento.ts` — endpoints e nomes de campo de cada tipo de lote
  (atenção: algumas APIs BB usam data no formato `ddmmaaaa` como número, não `YYYY-MM-DD`)

### 5. Homologar
Cadastrar com `ambiente='sandbox'` (hosts `oauth.sandbox.bb.com.br` / `api.sandbox.bb.com.br`),
rodar um lote de teste, conferir liquidação, depois virar `ambiente='producao'`.

## Arquivos da integração

```
frontend/src/lib/bb/
  certificates.ts        # carrega A1 do bucket privado bb
  getAccessToken.ts      # OAuth Basic + mTLS
  lotePagamento.ts       # ciclo do lote (criar/liberar/consultar) por tipo
frontend/src/app/api/financeiro/bb/
  credenciais/route.ts   # lista credenciais BB do bar
  lote/route.ts          # (a fazer) cria+libera lote, registra tracking
  lote/status/route.ts   # (a fazer) consulta liquidação
database/migrations/
  2026-06-01-bb-pagamentos-lote-tracking.sql
```

## Pendências de UI (quando o endpoint /lote estiver testável)
- A tela hoje carrega só credenciais Inter. Generalizar o seletor de "Resumo" para
  listar Inter **e** BB, marcando o provedor de cada credencial.
- `processarPagamentoCompleto` deve rotear: `sistema=banco_inter` → `/api/financeiro/inter/pix`;
  `sistema=banco_brasil` → `/api/financeiro/bb/lote`.
- Não refatorar o fluxo Inter (em produção) — só adicionar o ramo BB.
