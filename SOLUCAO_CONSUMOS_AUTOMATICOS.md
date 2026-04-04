# Solução: Consumos Automáticos de contahub_analitico

## Problema Identificado

A Edge Function `cmv-semanal-auto` está com **timeout** (>60s) ao tentar processar semanas, mesmo com código minimal. Isso indica um problema de **infraestrutura do Supabase**, não do código.

## Solução Implementada

### 1. Função SQL Criada: `get_consumos_classificados_semana()`

```sql
CREATE OR REPLACE FUNCTION get_consumos_classificados_semana(
  input_bar_id INTEGER,
  input_data_inicio DATE,
  input_data_fim DATE
)
RETURNS TABLE (categoria TEXT, total NUMERIC)
```

**O que faz:**
- Busca consumos de `contahub_analitico` (campo `desconto` onde `valorfinal = 0`)
- Faz JOIN com `contahub_periodo` para pegar o `motivo`
- Classifica automaticamente em: `socios`, `clientes`, `artistas`, `funcionarios`
- Retorna totais agregados por categoria

**Performance:** ~1-2 segundos ✅

### 2. Padrões de Classificação Atualizados

**Ordem de prioridade:** CLIENTES → ARTISTAS → FUNCIONARIOS → SOCIOS

**SOCIOS:**
- sócios, socios, socio, sócio, x-socio, x-sócio, x-soc
- gonza, corbal, diogo, diego, cadu, augusto, rodrigo
- digao, vinicius, vini, bueno, kaizen, caisen
- joão pedro, joao pedro, jp, 3v, cantucci, moai, luan, viny

**CLIENTES:**
- aniver, anivers, aniversário, aniversario, aniversariante, niver
- voucher, benefício, beneficio, mesa mágica, mágica
- influencer, influ, influencia, influência
- club, clube, midia, mídia, social, insta, digital
- cliente, ambev, promoção, chegadeira, nct

**ARTISTAS:**
- musico, músicos, dj, banda, artista
- breno, benza, stz, zelia, tia
- samba, sambadona, doze, boca, boka
- pé, chão, pe no, segunda, resenha, pagode, roda
- reconvexa, rodie, roudier, roudi, som
- técnico, tecnico, pv, paulo victor, prod
- elas, bonsai, afrika, caju, negrita

**FUNCIONARIOS:**
- funcionários, funcionario, rh, financeiro, fin
- mkt, marketing, slu, adm, administrativo
- prêmio, confra, wendel, natalia, nato, x dudu
- kauan, ana bia, teixeira, jhonny, andreia, lucia
- phelipe, isabel, dakota, thais, edna, richard
- gustavo, aladim, duarte, renan, henrique, deivid
- vivi, rafa, adriana

### 3. Resultados para Semana 13 (Ordinário)

**Consumos Brutos (preço de venda):**
- Sócios: R$ 3.901,22
- Clientes: R$ 4.253,95
- Artistas: R$ 11.559,55
- Funcionários: R$ 1.566,84
- **TOTAL**: R$ 21.281,56

**Consumos com Fator 35%:**
- Sócios: R$ 1.365,43
- Clientes: R$ 1.488,88
- Artistas: R$ 4.045,84
- Funcionários: R$ 548,39
- **TOTAL**: R$ 7.448,54

**CMV Calculado:**
- CMV Real: R$ 177.319,14
- CMV Limpo %: **52,88%**

### 4. Uso da Função SQL

**Via MCP (recomendado):**
```sql
SELECT * FROM get_consumos_classificados_semana(3, '2026-03-23', '2026-03-29');
```

**Resultado:**
```
categoria   | total
------------|----------
artistas    | 11559.55
clientes    |  4253.95
funcionarios|  1566.84
socios      |  3901.22
```

### 5. Atualização Manual do Banco

Como a Edge Function está com timeout, use SQL direto:

```sql
-- 1. Atualizar consumos brutos e com fator
UPDATE cmv_semanal 
SET 
    total_consumo_socios = 3901.22,
    mesa_beneficios_cliente = 4253.95,
    mesa_banda_dj = 11559.55,
    mesa_adm_casa = 1566.84,
    consumo_socios = 1365.43,
    consumo_beneficios = 1488.88,
    consumo_artista = 4045.84,
    consumo_rh = 548.39,
    updated_at = NOW()
WHERE bar_id = 3 AND semana = 13 AND ano = 2026;

-- 2. Recalcular CMV Real e CMV Limpo %
UPDATE cmv_semanal 
SET 
    cmv_real = (
        estoque_inicial + compras_periodo - estoque_final - 
        (consumo_socios + consumo_beneficios + consumo_artista + consumo_rh + COALESCE(outros_ajustes, 0)) + 
        COALESCE(bonificacao_contrato_anual, 0)
    ),
    cmv_limpo_percentual = CASE 
        WHEN faturamento_cmvivel > 0 THEN (
            (estoque_inicial + compras_periodo - estoque_final - (consumo_socios + consumo_beneficios + consumo_artista + consumo_rh + COALESCE(outros_ajustes, 0)) + COALESCE(bonificacao_contrato_anual, 0)) 
            / faturamento_cmvivel * 100
        )
        ELSE 0 
    END
WHERE bar_id = 3 AND semana = 13 AND ano = 2026;
```

## Próximos Passos

1. **Investigar timeout da Edge Function** - Pode ser problema de cold start ou configuração do Supabase
2. **Criar rotina automática** - Usar pg_cron ou script externo para atualizar consumos semanalmente
3. **Validar outras semanas** - Aplicar a mesma lógica para semanas 11, 12, 14, etc.

## Arquivos Modificados

- `backend/supabase/functions/cmv-semanal-auto/index.ts` - Atualizado com nova lógica (mas com timeout)
- `database/functions/get_consumos_classificados_semana.sql` - Função SQL criada
- `database/functions/get_consumos_por_mesa.sql` - Função auxiliar criada
- `atualizar-consumos-semana.ps1` - Script PowerShell para atualização manual

## Status

✅ Lógica de classificação implementada e testada
✅ Função SQL funcionando perfeitamente
✅ Semana 13 atualizada manualmente com sucesso
⚠️ Edge Function com problema de timeout (investigar separadamente)
