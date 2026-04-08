# Problema: Atrasos não aparecem em Planejamento Comercial

## Situação Atual

### ✅ Desempenho Semanal (Funciona)
- **Fonte**: Tabela `desempenho_semanal`
- **Dados**: Agregados por semana
- **Campos**: `atrasinhos_bar`, `atrasinhos_cozinha`, `atraso_bar`, `atraso_cozinha`
- **Status**: ✅ Tem dados corretos

### ❌ Planejamento Comercial (Não funciona)
- **Fonte**: Tabela `eventos_base`
- **Dados**: Por evento (dia a dia)
- **Campos**: `atrasao_bar`, `atrasao_cozinha`
- **Status**: ❌ Todos os valores estão zerados

## Análise

### Tabela `eventos_base`
```sql
SELECT 
  data_evento,
  atrasao_cozinha,
  atrasao_bar
FROM eventos_base
WHERE bar_id = 3 AND data_evento >= '2026-04-01'
```
**Resultado**: Todos zerados (0)

### Tabela `tempos_producao`
```sql
SELECT COUNT(*) FROM tempos_producao
WHERE bar_id = 3 AND data_producao = '2026-04-04'
```
**Resultado**: 2.822 registros

**Problema**: Campo `t0_t3` (tempo total) está zerado em todos os registros!

```sql
SELECT t0_t3 FROM tempos_producao 
WHERE bar_id = 3 AND data_producao = '2026-04-04'
ORDER BY t0_t3 DESC LIMIT 10
```
**Resultado**: Todos 0.0

## Causa Raiz

A tabela `tempos_producao` não está calculando os tempos corretamente. Os campos de timestamp (`t0_lancamento`, `t1_prodini`, `t2_prodfim`, `t3_entrega`) podem estar preenchidos, mas o campo calculado `t0_t3` está zerado.

## Solução Necessária

### Opção 1: Calcular em tempo real (Recomendado)
Modificar a query do planejamento comercial para calcular os atrasos diretamente da tabela `tempos_producao`:

```sql
WITH atrasos_diarios AS (
  SELECT 
    data_producao,
    COUNT(*) FILTER (WHERE categoria = 'comida' 
      AND EXTRACT(EPOCH FROM (t3_entrega - t0_lancamento)) > 720) as atrasao_cozinha,
    COUNT(*) FILTER (WHERE categoria IN ('drink', 'bebida') 
      AND EXTRACT(EPOCH FROM (t3_entrega - t0_lancamento)) > 240) as atrasao_bar
  FROM tempos_producao
  WHERE bar_id = 3
    AND t0_lancamento IS NOT NULL
    AND t3_entrega IS NOT NULL
  GROUP BY data_producao
)
SELECT * FROM atrasos_diarios
```

### Opção 2: Corrigir o cálculo de `t0_t3`
Criar um trigger ou função que calcule corretamente o campo `t0_t3` quando os registros são inseridos:

```sql
CREATE OR REPLACE FUNCTION calcular_tempos_producao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.t0_lancamento IS NOT NULL AND NEW.t3_entrega IS NOT NULL THEN
    NEW.t0_t3 = EXTRACT(EPOCH FROM (NEW.t3_entrega - NEW.t0_lancamento));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Opção 3: Atualizar `eventos_base` periodicamente
Criar uma função que calcule os atrasos diários e atualize a tabela `eventos_base`:

```sql
CREATE OR REPLACE FUNCTION atualizar_atrasos_eventos()
RETURNS void AS $$
BEGIN
  UPDATE eventos_base e
  SET 
    atrasao_cozinha = COALESCE(t.atrasao_cozinha, 0),
    atrasao_bar = COALESCE(t.atrasao_bar, 0)
  FROM (
    SELECT 
      data_producao,
      COUNT(*) FILTER (WHERE categoria = 'comida' 
        AND EXTRACT(EPOCH FROM (t3_entrega - t0_lancamento)) > 720) as atrasao_cozinha,
      COUNT(*) FILTER (WHERE categoria IN ('drink', 'bebida') 
        AND EXTRACT(EPOCH FROM (t3_entrega - t0_lancamento)) > 240) as atrasao_bar
    FROM tempos_producao
    WHERE t0_lancamento IS NOT NULL
      AND t3_entrega IS NOT NULL
    GROUP BY data_producao
  ) t
  WHERE e.data_evento = t.data_producao
    AND e.bar_id = 3;
END;
$$ LANGUAGE plpgsql;
```

## Próximos Passos

1. Verificar se os timestamps em `tempos_producao` estão preenchidos
2. Escolher uma das opções acima
3. Implementar a solução
4. Testar com dados reais
5. Atualizar o código do planejamento comercial se necessário

## Arquivos Relacionados

- `frontend/src/app/estrategico/planejamento-comercial/services/planejamento-service.ts` (linha 289-290)
- `frontend/src/app/estrategico/planejamento-comercial/components/PlanejamentoClient.tsx` (linha 1063-1071)
