# Checklist Deploy - 10/02/2026

## ✅ Concluído

### Edge Functions (deployados)
- `google-sheets-sync` – retroativo NPS (data_inicio, data_fim)
- `desempenho-semanal-auto` – uso tabela nps_reservas quando nps vazio

### Frontend
- UI Sync Retroativo em Ferramentas → NPS
- Tab Disparo NPS em CRM → Umbler Talk
- CMV Semanal: critério competência vs criação
- Consulta NIBO: múltiplas categorias + filtro melhorado
- Type-check: OK

### Configuração
- `frontend/.env.example` com NEXT_PUBLIC_NPS_LINK

## Próximos passos

1. **Configurar NPS Link** (produção)
   - Adicionar `NEXT_PUBLIC_NPS_LINK=https://...` no .env do Vercel/produção

2. **Commit e push**
   ```bash
   git add -A
   git commit -m "feat: NPS retroativo, Umbler disparo, CMV critério data, consulta NIBO"
   git push
   ```

3. **Validar em produção**
   - Disparo NPS: /crm/umbler → Disparo NPS
   - Sync retroativo: Ferramentas → NPS
   - CMV: Buscar Dados com critério competência/criação
