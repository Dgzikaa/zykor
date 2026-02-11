# Auditoria Final Pré-Produção - Zykor
**Data:** 2026-02-10

---

## ⚠️ STATUS: NÃO PRONTO PARA 100%

Após revisão completa de funções, páginas e rotas, foram identificados **módulos quebrados** que impedem declarar o projeto 100% pronto.

---

## 1. TABELAS INEXISTENTES (removidas na limpeza)

| Tabela | Impacto | Arquivos Afetados |
|--------|---------|-------------------|
| `checklists` | **CRÍTICO** | operacional/checklists/*, schedules, copy-items, bulk, alerts, agendamentos |
| `checklist_execucoes` | **CRÍTICO** | ~20 arquivos – badges, backup, analytics, execucoes, finalizar, dashboard, produtividade, atribuições, notifications |
| `checklist_execucao_itens` | **CRÍTICO** | (removido – alertas-inteligentes já corrigido) |
| `whatsapp_configuracoes` | **CRÍTICO** | webhook, config, messages, campanhas |
| `whatsapp_contatos` | **CRÍTICO** | webhook, messages, whatsapp-service |
| `whatsapp_mensagens` | **CRÍTICO** | webhook (processMessageStatuses), messages, analytics, config |

---

## 2. MÓDULOS QUEBRADOS

### 2.1 Módulo Checklists (inteiro)
- **Páginas:** `/configuracoes/checklists`, `/checklists/abertura`, `/operacoes/checklists`
- **Rotas API:** Todas em `/api/operacional/checklists/*`, `/api/operacional/checklist-execucoes/*`, `/api/operacional/execucoes/*`
- **Problema:** Tabelas `checklists`, `checklist_execucoes` não existem. O módulo usa apenas `checklist_agendamentos`, `checklist_auto_executions`, `checklist_automation_logs`.
- **Rotas que falham:** badges, badge-data, bulk, agendamentos, notifications, [id], [id]/execucoes, finalizar, analitico/dashboard/resumo, analitico/dashboard/produtividade, configuracoes/atribuicoes

### 2.2 Módulo WhatsApp (legado Meta API)
- **Rotas:** `/api/configuracoes/whatsapp/webhook`, `/api/configuracoes/whatsapp/config`, `/api/configuracoes/whatsapp/messages`
- **Problema:** Tabelas `whatsapp_configuracoes`, `whatsapp_contatos`, `whatsapp_mensagens` não existem.
- **Sistema atual:** Umbler (umbler_config, umbler_conversas, umbler_mensagens).

### 2.3 CRM Campanhas
- **Rota:** `/api/crm/campanhas`
- **Problema:** Usa `whatsapp_configuracoes` (linha 174).

### 2.4 Serviços e Utilitários
- **lib/whatsapp-service.ts** – Usa whatsapp_* (obsoleto).
- **lib/analytics-service.ts** – Usa `checklist_execucoes` (linhas 72, 115, 332).
- **lib/backup-system.ts** – Inclui `checklist_execucoes` na lista de backup.

---

## 3. RPCs INEXISTENTES (com fallback OK)
- `get_umbler_getin_cruzamento` – fallback em cruzamento-reservas ✅
- `get_umbler_metricas` – fallback em dashboard ✅
- `calcular_novos_clientes_por_mes` – fallback em novos-clientes ✅
- `buscar_comentarios_nps` – fallback em nps/agregado ✅
- `get_cliente_stats_agregado` – fallback em analitico/clientes ✅

---

## 4. RPCs INEXISTENTES (sem fallback – possíveis falhas)
- `execute_sql_readonly` – agente-sql-expert (Edge Function)
- `increment_contact_stat` – webhook (já em try/catch, mas `whatsapp_mensagens` não existe – `processMessageStatuses` vai falhar antes)

---

## 5. CORREÇÕES APLICADAS (já feitas)
- ✅ alertas-inteligentes → checklist_agendamentos + checklist_automation_logs
- ✅ recalcular-eventos-base → calculate_evento_metrics
- ✅ desempenho → fallback sem aggregate_by_date
- ✅ webhook processReceivedMessages → umbler_conversas/umbler_mensagens
- ✅ crm/whatsapp-config → umbler_config (fallback)

---

## 6. AÇÕES NECESSÁRIAS PARA 100%

### Opção A – Recriar tabelas (se checklists e WhatsApp forem usados)
Criar migrações para `checklists`, `checklist_execucoes`, `checklist_execucao_itens`, `whatsapp_configuracoes`, `whatsapp_contatos`, `whatsapp_mensagens`.

### Opção B – Desativar/adaptar módulos (se forem legado)
1. **Checklists:** Remover ou redirecionar páginas/rotas para “em manutenção” ou para `checklist_agendamentos` onde fizer sentido.
2. **WhatsApp legado:** Desativar webhook Meta ou adaptar GET/POST para usar `umbler_config` em vez de `whatsapp_configuracoes`.
3. **Campanhas:** Trocar `whatsapp_configuracoes` por `umbler_config` ou fonte equivalente.
4. **Analytics/Backup:** Remover ou condicionar uso de `checklist_execucoes`.

---

## 7. CONCLUSÃO

**O projeto não está 100% pronto para produção.**  
Os módulos de **Checklists** e **WhatsApp (legado)** dependem de tabelas removidas.  
Rotas como badges, dashboard analítico e campanhas podem retornar 500 até que as tabelas sejam recriadas ou o código seja adaptado conforme Opção A ou B.
