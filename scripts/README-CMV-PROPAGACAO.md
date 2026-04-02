# Correção: Propagação de Estoque CMV

## Problema

O estoque inicial da semana N não batia com o estoque final da semana N-1, quebrando a regra contábil básica.

**Exemplo:**
- Semana 9: Estoque Final = R$ 110.453,96
- Semana 10: Estoque Inicial = valor diferente (da planilha antiga)

**Causa:** O sistema só propagava quando o inicial estava zerado. Se a planilha tinha um valor, ele não era sobrescrito.

## Solução Implementada

Agora o sistema **sempre** aplica a regra contábil:

> **Estoque Inicial semana N = Estoque Final semana N-1**

Isso vale para:
- Estoque total (CMV)
- Estoque por categoria (Cozinha, Bebidas, Drinks)
- Estoque de funcionários (CMA)

## Como Corrigir o Histórico

### Opção 1: Interface Web (Recomendado)

1. Acesse: `https://zykor.com.br/ferramentas/cmv-semanal/tabela`
2. Selecione o bar (Ordinário ou Deboche)
3. Clique no botão verde **"Propagar Estoque"**
4. Aguarde a confirmação
5. Verifique que os valores estão corretos

### Opção 2: Script PowerShell

```powershell
# Ordinário (bar_id 3)
.\scripts\test-cmv-propagacao.ps1 -BarId 3 -Ano 2026

# Deboche (bar_id 4)
.\scripts\test-cmv-propagacao.ps1 -BarId 4 -Ano 2026
```

O script:
1. Ajusta o row_map do Deboche (se necessário)
2. Propaga os estoques
3. Valida a consistência
4. Mostra erros se houver

### Opção 3: API Direta

```bash
# Propagar estoque
curl -X POST http://localhost:3000/api/cmv-semanal/propagar-estoque \
  -H "Content-Type: application/json" \
  -d '{"bar_id": 3, "ano": 2026}'

# Ajustar row_map do Deboche (uma vez)
curl -X POST http://localhost:3000/api/cmv-semanal/ajustar-rowmap-deboche
```

## Correção Específica do Deboche

### Problema do CMA (Alimentação)

O Deboche tem o bloco "Saída Alimentação" **2 linhas acima** do Ordinário na planilha:

| Bar | Estoque Inicial (F) | Compras Alim | Estoque Final (F) |
|-----|---------------------|--------------|-------------------|
| Ordinário | Linha 68 | Linha 69 | Linha 70 |
| Deboche | Linha 66 | Linha 67 | Linha 68 |

O sistema usava o mapeamento do Ordinário para ambos, então lia a linha **errada** no Deboche.

### Solução

A função `cmv-ajustar-rowmap-deboche` atualiza o `row_map_cmv_semanal` no banco para o Deboche, corrigindo os índices do CMA.

**O botão "Propagar Estoque" já faz isso automaticamente** quando o bar selecionado é o Deboche.

## Manutenção Automática

A partir de agora, **toda vez** que rodar:
- `cmv-semanal-auto` (job automático)
- `sync-cmv-sheets` (sincronizar planilha)
- `sync-contagem-sheets` (atualizar contagem)

O sistema **automaticamente** propaga os estoques (CMV + CMA) para manter a consistência.

## Arquivos Alterados

### Backend (Edge Functions)
1. `backend/supabase/functions/cmv-semanal-auto/index.ts`
2. `backend/supabase/functions/sync-cmv-sheets/index.ts`
3. `backend/supabase/functions/sync-contagem-sheets/index.ts`
4. `backend/supabase/functions/cmv-propagar-estoque/index.ts` (novo)
5. `backend/supabase/functions/cmv-ajustar-rowmap-deboche/index.ts` (novo)

### Frontend (APIs e UI)
6. `frontend/src/app/api/cmv-semanal/propagar-estoque/route.ts` (novo)
7. `frontend/src/app/api/cmv-semanal/ajustar-rowmap-deboche/route.ts` (novo)
8. `frontend/src/app/ferramentas/cmv-semanal/tabela/page.tsx`

### Scripts e Docs
9. `scripts/test-cmv-propagacao.ps1` (novo)
10. `CMV_ESTOQUE_PROPAGACAO_FIX.md` (este arquivo)

## Validação Pós-Deploy

### Ordinário (bar_id 3)
- [ ] Semana 10 inicial = Semana 9 final (110.453,96)
- [ ] Semana 11 inicial = Semana 10 final
- [ ] Todas as semanas 4-10 alinhadas
- [ ] CMA propagando corretamente

### Deboche (bar_id 4)
- [ ] Row map salvo no banco (`api_credentials.configuracoes`)
- [ ] Semana 13 CMA inicial = 137,36 (após sync da planilha)
- [ ] Estoque inicial CMV propagando corretamente
- [ ] Estoque inicial CMA propagando corretamente

### Automático
- [ ] Propagação automática funcionando nos próximos syncs
- [ ] Logs mostrando propagações realizadas
- [ ] Sem erros de consistência em novas semanas

## Troubleshooting

### "Estoque inicial ainda não bate"

1. Verifique se rodou a propagação após o último sync da planilha
2. Rode o script de teste para identificar qual semana está errada
3. Verifique os logs da Edge Function para ver se houve erro

### "CMA do Deboche ainda está errado"

1. Verifique se o row_map foi ajustado: consultar `api_credentials` onde `bar_id = 4`
2. Rode novamente o sync da planilha CMV
3. Rode a propagação de estoque

### "Valores negativos no CMV"

Isso pode acontecer se o estoque final for maior que inicial + compras. Verifique:
1. Se a contagem de estoque está correta
2. Se as compras do NIBO foram sincronizadas
3. Se há ajustes manuais necessários (bonificações, consumos)
