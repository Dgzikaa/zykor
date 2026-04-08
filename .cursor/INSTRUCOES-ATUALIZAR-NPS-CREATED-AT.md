# Instruções: Atualizar NPS para usar created_at

## 📋 Resumo

Para alinhar 100% o NPS do Zykor com o Falae, precisamos usar `created_at` (data da resposta) ao invés de `data_visita` (data da visita real).

## ✅ Alterações Já Realizadas

1. ✅ **API de Sync** (`frontend/src/app/api/falae/sync/route.ts`):
   - Linha 91: Alterado para usar apenas `created_at`

2. ✅ **Dados Recalculados**:
   - Tabelas `nps_falae_diario` e `nps_falae_diario_pesquisa` foram limpas e recalculadas

## ⚠️ Ação Necessária: Atualizar Função SQL

A função `recalcular_nps_diario_pesquisa` no banco de dados ainda está usando `data_visita`. Você precisa executar o SQL abaixo **manualmente no Supabase Dashboard**.

### Passos:

1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Vá em **SQL Editor**
3. Cole o SQL abaixo e execute:

```sql
-- Função: recalcular_nps_diario_pesquisa
-- Atualizado em: 2026-04-08
-- Descrição: Recalcula NPS diário por pesquisa usando created_at (data da resposta)
-- Alteração: Usa apenas created_at para alinhar 100% com o Falae

CREATE OR REPLACE FUNCTION public.recalcular_nps_diario_pesquisa(
  p_bar_id integer,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_rows_affected INTEGER := 0;
BEGIN
  IF p_data_inicio IS NULL THEN
    p_data_inicio := CURRENT_DATE - INTERVAL '90 days';
  END IF;
  IF p_data_fim IS NULL THEN
    p_data_fim := CURRENT_DATE;
  END IF;

  INSERT INTO nps_falae_diario_pesquisa (
    bar_id,
    data_referencia,
    search_name,
    respostas_total,
    promotores,
    neutros,
    detratores,
    nps_score,
    nps_media,
    atualizado_em
  )
  SELECT
    bar_id,
    (created_at AT TIME ZONE 'America/Sao_Paulo')::date as data_ref,
    COALESCE(search_name, 'Geral'),
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE nps >= 9)::INTEGER,
    COUNT(*) FILTER (WHERE nps >= 7 AND nps <= 8)::INTEGER,
    COUNT(*) FILTER (WHERE nps <= 6)::INTEGER,
    CASE WHEN COUNT(*) > 0 THEN
      ROUND((
        (COUNT(*) FILTER (WHERE nps >= 9)::NUMERIC / COUNT(*) * 100) -
        (COUNT(*) FILTER (WHERE nps <= 6)::NUMERIC / COUNT(*) * 100)
      ))::INTEGER
    ELSE 0 END,
    CASE WHEN COUNT(*) > 0 THEN ROUND(AVG(nps)::NUMERIC, 2) ELSE NULL END,
    NOW()
  FROM falae_respostas
  WHERE bar_id = p_bar_id
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= p_data_inicio
    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= p_data_fim
  GROUP BY bar_id, data_ref, COALESCE(search_name, 'Geral')
  ON CONFLICT (bar_id, data_referencia, search_name) DO UPDATE SET
    respostas_total = EXCLUDED.respostas_total,
    promotores = EXCLUDED.promotores,
    neutros = EXCLUDED.neutros,
    detratores = EXCLUDED.detratores,
    nps_score = EXCLUDED.nps_score,
    nps_media = EXCLUDED.nps_media,
    atualizado_em = EXCLUDED.atualizado_em;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
  RETURN v_rows_affected;
END;
$$;
```

4. Após executar, rode o script de recalculação:

```bash
npx tsx scripts/limpar-e-recalcular-nps.ts
```

## 🧪 Validação

Após executar o SQL e recalcular, rode:

```bash
npx tsx scripts/verificar-nps-semana-14.ts
```

**Resultado esperado:**
- Respostas brutas: **20**
- Respostas agregadas: **20** (não mais 24!)
- NPS: **55** (alinhado com o Falae)

## 📊 Diferença: created_at vs data_visita

### Antes (data_visita):
- **Semana 14 (30.03-05.04)**: 24 respostas, NPS 46
- Incluía respostas dadas em abril sobre visitas de março

### Depois (created_at):
- **Semana 14 (30.03-05.04)**: 20 respostas, NPS 55
- Inclui apenas respostas dadas entre 30.03 e 05.04

## 🔮 Futuro

No futuro, se quiser voltar para `data_visita` (mais preciso para análise de desempenho), basta:
1. Reverter a linha 91 do `frontend/src/app/api/falae/sync/route.ts`
2. Executar o SQL antigo (está em `database/functions/recalcular_nps_diario_pesquisa.sql`)
3. Recalcular os dados

## ✅ Checklist

- [x] Ajustar API de sync para usar `created_at`
- [x] Limpar dados agregados antigos
- [x] Recalcular dados via API
- [ ] **Executar SQL no Supabase Dashboard** ⚠️ **VOCÊ PRECISA FAZER ISSO**
- [ ] Recalcular dados novamente após SQL
- [ ] Validar que NPS bate com Falae
