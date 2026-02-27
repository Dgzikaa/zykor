# Correção: Erro na Página Visão Geral

## Problema Identificado

A página `/estrategico/visao-geral` está apresentando erro 500 com a seguinte mensagem:

```
Could not find the function public.calcular_metricas_clientes(p_bar_id, p_data_fim_anterior, p_data_fim_atual, p_data_inicio_anterior, p_data_inicio_atual) in the schema cache
```

### Causa Raiz

As seguintes funções RPC estão sendo chamadas pelo código, mas **não existem no banco de dados**:

1. `calcular_visao_geral_anual` - chamada em `page.tsx` linha 71
2. `calcular_visao_geral_trimestral` - chamada em `page.tsx` linha 74
3. `calcular_metricas_clientes` - chamada em `indicadores-service.ts` linha 162

O arquivo `database/views/visao_geral_views.sql` cria apenas as **materialized views**, mas não as funções RPC necessárias.

## Solução

Criei o arquivo `visao_geral_functions.sql` na raiz do projeto com as 3 funções necessárias:

### 1. calcular_visao_geral_anual
- Consulta a view `view_visao_geral_anual`
- Retorna dados anuais agregados (faturamento, pessoas, reputação)

### 2. calcular_visao_geral_trimestral
- Consulta a view `view_visao_geral_trimestral`
- Calcula variações comparando com trimestre anterior
- Retorna clientes, CMO, artística com variações

### 3. calcular_metricas_clientes
- Calcula métricas de clientes para dois períodos
- Identifica clientes totais, novos e retornantes
- Usado para calcular taxa de retenção

## ✅ Correção Aplicada

As funções foram criadas com sucesso no banco de dados em 27/02/2026.

### Arquivo SQL
`database/functions/visao_geral_functions.sql`

### Verificação
Todas as 3 funções estão disponíveis e funcionando:
- ✅ calcular_visao_geral_anual
- ✅ calcular_visao_geral_trimestral  
- ✅ calcular_metricas_clientes

## Verificação

Após executar o SQL, verifique se as funções foram criadas:

```sql
-- No SQL Editor do Supabase
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'calcular_visao_geral_anual',
    'calcular_visao_geral_trimestral', 
    'calcular_metricas_clientes'
  );
```

Deve retornar 3 linhas com `routine_type = 'FUNCTION'`.

## Teste

Após aplicar a correção:

1. Recarregue a página `/estrategico/visao-geral`
2. Os erros devem desaparecer
3. Os indicadores devem ser calculados corretamente

## Arquivos Modificados

- ✅ **Criado**: `visao_geral_functions.sql` - Funções RPC necessárias
- 📝 **Referência**: `frontend/src/app/estrategico/visao-geral/page.tsx` - Usa as funções
- 📝 **Referência**: `frontend/src/app/estrategico/visao-geral/services/indicadores-service.ts` - Usa calcular_metricas_clientes

## Observações Importantes

1. As funções usam `SECURITY DEFINER` para garantir acesso às views
2. As permissões são concedidas para `anon` e `authenticated`
3. As materialized views devem estar atualizadas para retornar dados corretos
4. Se as views estiverem vazias, execute o refresh:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY public.view_visao_geral_anual;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.view_visao_geral_trimestral;
```

## Próximos Passos

Após aplicar esta correção, considere:

1. Adicionar estas funções ao repositório em `database/functions/`
2. Criar uma migration formal se estiver usando Supabase Migrations
3. Documentar as dependências entre views e funções
4. Adicionar testes automatizados para estas funções
