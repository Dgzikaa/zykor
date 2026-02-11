# Documento de Melhorias - Zykor
**Última atualização:** 2026-02-10

Este documento consolida oportunidades de melhoria identificadas em auditorias, otimizações e análise do sistema. As sugestões estão ordenadas por impacto e esforço.

---

## 1. Crítico – Produção 100%

*Requer ação antes de declarar o sistema pronto para produção.*

### 1.1 Módulo Checklists
- **Problema:** Tabelas `checklists`, `checklist_execucoes` removidas; ~20 rotas quebradas.
- **Opções:**
  - **A)** Recriar tabelas via migração (se o módulo for usado)
  - **B)** Adaptar rotas para `checklist_agendamentos` e `checklist_auto_executions`
  - **C)** Desativar módulo e redirecionar para “em manutenção”
- **Arquivos afetados:** badges, analytics-service, backup-system, operacional/*, analitico/dashboard, atribuições

### 1.2 Módulo WhatsApp (legado Meta API)
- **Problema:** Tabelas `whatsapp_configuracoes`, `whatsapp_contatos`, `whatsapp_mensagens` removidas.
- **Opções:**
  - **A)** Recriar tabelas (se Meta API for usada)
  - **B)** Migrar webhook/config/messages para `umbler_config` e fluxo Umbler
  - **C)** Desativar rotas legado
- **Arquivos afetados:** webhook, config, messages, campanhas, whatsapp-service

### 1.3 CRM Campanhas
- **Problema:** Usa `whatsapp_configuracoes`.
- **Solução:** Usar `umbler_config` ou fonte equivalente.

### 1.4 Deploy Edge Functions
- **Problema:** `google-sheets-sync`, `contahub-sync`, `alertas-unified` referenciados por crons, mas podem não estar deployados.
- **Ação:** Verificar e executar deploy com o `project_ref` correto.

---

## 2. Performance

*Otimizações adicionais para carregamento e fluidez.*

### 2.1 Uso de fetch com cache
- **Status:** `fetch-cache.ts` criado, mas pouco usado.
- **Melhoria:** Adotar em dashboards e relatórios que fazem polling ou múltiplas chamadas à mesma API.

### 2.2 React Query ou SWR
- **Status:** Não há camada de cache/deduplicação global de fetches.
- **Melhoria:** Avaliar React Query ou SWR para cache, revalidação e deduplicação de requisições.

### 2.3 Páginas com Recharts
- **Status:** `optimizePackageImports` reduz o bundle; imports diretos em várias páginas.
- **Melhoria:** Em páginas muito pesadas (ex.: retrospectiva-2025), considerar `dynamic()` com `ssr: false` para o bloco de gráficos.

### 2.4 Prefetch de rotas
- **Status:** `ROTAS_PRIORITARIAS` em ModernSidebarOptimized.
- **Melhoria:** Usar `router.prefetch()` ou `Link` com `prefetch` nas navegações principais.

### 2.5 Service Worker e PWA
- **Status:** PWA e VersionChecker já existem.
- **Melhoria:** Revisar estratégia de cache do SW para assets e APIs estáticas.

---

## 3. Qualidade de Código

### 3.1 TypeScript
- **Status:** `ignoreBuildErrors: true` no next.config.
- **Melhoria:** Corrigir erros gradualmente e desativar `ignoreBuildErrors` para evitar erros em produção.

### 3.2 ESLint
- **Status:** `ignoreDuringBuilds: true`.
- **Melhoria:** Habilitar ESLint no build e corrigir regras mais críticas.

### 3.3 Duplicação de lógica
- **Problema:** Criação de cliente Supabase em vários arquivos.
- **Melhoria:** Centralizar em `getSupabaseClient()` / `createServerClient()` e reutilizar.

### 3.4 Tratamento de erros
- **Problema:** Alguns `try/catch` só fazem `console.error`.
- **Melhoria:** Padronizar: mensagens amigáveis, logs estruturados e, se aplicável, Sentry.

### 3.5 Código morto
- **Problema:** Componentes e rotas comentados (RetrospectiveButton, AssistantWrapper, etc.).
- **Melhoria:** Remover ou reativar de forma explícita.

---

## 4. UX/UI

### 4.1 Estados vazios
- **Melhoria:** Garantir `empty-state` consistente em listas (tabelas, dashboards, relatórios).

### 4.2 Feedback de ações
- **Melhoria:** Toast/feedback claro em ações assíncronas (salvar, sync, export).

### 4.3 Acessibilidade
- **Status:** Componentes como `AccessibleText`, `SkipLink` existem.
- **Melhoria:** Auditoria com axe ou Lighthouse; garantir contraste, foco e labels.

### 4.4 Mobile
- **Status:** BottomNavigation e layouts responsivos.
- **Melhoria:** Testar fluxos críticos em mobile (login, home, operacional).

### 4.5 Modo escuro
- **Status:** Suportado via ThemeContext.
- **Melhoria:** Revisar componentes que ainda não usam classes dark.

---

## 5. Segurança

### 5.1 Variáveis de ambiente
- **Melhoria:** Documentar variáveis obrigatórias e nunca commitar secrets.

### 5.2 RLS (Row Level Security)
- **Melhoria:** Rodar `get_advisors` (security) periodicamente e corrigir tabelas sem RLS.

### 5.3 Sanitização de inputs
- **Melhoria:** Revisar rotas que usam `execute_raw_sql` ou `exec_sql` para evitar SQL injection.

### 5.4 Rate limiting
- **Status:** `lib/rate-limit.ts` existe.
- **Melhoria:** Aplicar em rotas sensíveis (login, webhooks, APIs públicas).

---

## 6. Testes

### 6.1 Testes automatizados
- **Status:** Sem evidência clara de testes e2e ou unitários.
- **Melhoria:** Adotar Jest + React Testing Library para componentes e Playwright/Cypress para fluxos críticos.

### 6.2 Testes de API
- **Melhoria:** Collections Postman/Insomnia ou testes automatizados para rotas principais.

---

## 7. DevOps e Infraestrutura

### 7.1 CI/CD
- **Melhoria:** Pipeline com type-check, lint e build antes do deploy.

### 7.2 Monitoramento
- **Status:** Sentry desabilitado.
- **Melhoria:** Reativar Sentry ou usar alternativa para erros em produção.

### 7.3 Logs
- **Melhoria:** Padronizar formato de log (estruturado) e rotação.

### 7.4 Backup
- **Status:** `backup-system.ts` referencia tabelas removidas.
- **Melhoria:** Atualizar para o schema atual e automatizar backups de banco.

---

## 8. Funcionalidades

### 8.1 Agente IA
- **Melhoria:** Expandir insights automáticos e integração com mais módulos.

### 8.2 Relatórios exportáveis
- **Melhoria:** PDF/Excel em relatórios principais (desempenho, retrospectiva).

### 8.3 Notificações push
- **Status:** PWA e push existem.
- **Melhoria:** Regras de notificação mais granulares (por módulo, por bar).

### 8.4 Onboarding
- **Melhoria:** Tour ou guia para novos usuários.

---

## 9. Documentação

### 9.1 README do projeto
- **Melhoria:** README com setup, variáveis, comandos e arquitetura resumida.

### 9.2 Docs de API
- **Melhoria:** Documentar rotas principais (parâmetros, respostas, erros).

### 9.3 Changelog
- **Melhoria:** Manter CHANGELOG.md com mudanças relevantes.

---

## 10. Manutenção Técnica

### 10.1 Dependências
- **Melhoria:** Atualizar dependências com frequência e revisar vulnerabilidades (npm audit).

### 10.2 Funções órfãs no banco
- **Problema:** Diversas funções RPC possivelmente não usadas (ver AUDITORIA_DATABASE_FUNCTIONS).
- **Melhoria:** Identificar uso real e descontinuar as não utilizadas.

### 10.3 Edge Functions
- **Melhoria:** Consolidar funções semelhantes (ver CONSOLIDACAO_EDGE_FUNCTIONS).

---

## Matriz de Priorização

| Prioridade | Área            | Esforço | Impacto |
|------------|-----------------|---------|---------|
| P0         | Checklists/WhatsApp | Alto    | Crítico |
| P0         | Deploy Edge Functions | Baixo  | Crítico |
| P1         | TypeScript/ESLint   | Médio  | Alto    |
| P1         | React Query/SWR     | Médio  | Alto    |
| P2         | Testes automatizados | Alto  | Alto    |
| P2         | Monitoramento/Sentry | Baixo  | Alto    |
| P3         | Acessibilidade      | Médio  | Médio   |
| P3         | Documentação        | Baixo  | Médio   |

---

## Referências

- `AUDITORIA_FINAL_PRE_PRODUCAO.md` – Status de produção e módulos quebrados
- `OTIMIZACOES_APLICADAS.md` – Otimizações já implementadas
- `AUDITORIA_DATABASE_FUNCTIONS.md` – RPCs e funções do banco
