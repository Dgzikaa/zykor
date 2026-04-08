# PROMPTS DE FINALIZAÇÃO — 05/04/2026

Status: Tarefas finais para fechar a revisão completa do projeto.

---

## FIN-1: Commit e Push das correções de ESLint

**Prioridade**: ALTA
**Tipo**: Git + Deploy
**Risco**: MÉDIO (re-habilita ESLint no build — se houver warning novo, build quebra)

### Contexto
Os 7 `eslint-disable-next-line react-hooks/exhaustive-deps` foram removidos e os hooks corrigidos em 6 arquivos. O `next.config.js` foi atualizado para `ignoreDuringBuilds: false`. Precisa fazer commit, push e verificar se o build do Vercel passa.

### Arquivos modificados
```
frontend/src/app/ferramentas/cmv-semanal/page.tsx
frontend/src/app/ferramentas/stockout/page.tsx
frontend/src/app/analitico/clientes/page.tsx
frontend/src/app/ferramentas/cmv-semanal/visualizar/page.tsx
frontend/src/app/configuracoes/checklists/page.tsx
frontend/src/app/ferramentas/agendamento/debug/page.tsx
frontend/next.config.js
```

### Ação
```bash
cd /caminho/do/projeto
git add frontend/src/app/ferramentas/cmv-semanal/page.tsx \
        frontend/src/app/ferramentas/stockout/page.tsx \
        frontend/src/app/analitico/clientes/page.tsx \
        frontend/src/app/ferramentas/cmv-semanal/visualizar/page.tsx \
        frontend/src/app/configuracoes/checklists/page.tsx \
        frontend/src/app/ferramentas/agendamento/debug/page.tsx \
        frontend/next.config.js
git commit -m "fix: corrigir react-hooks/exhaustive-deps warnings e reativar ESLint no build

- Corrigir 7 violações em 6 arquivos (useCallback, deps corretas)
- Reativar eslint no build (ignoreDuringBuilds: false)
- cmv-semanal: adicionar deps calcularValoresAutomaticos e carregarCMVs
- stockout: adicionar deps de filtros e datas
- clientes: adicionar fetchClientes callback
- checklists: wrap carregarChecklists em useCallback
- agendamento/debug: wrap carregarCredenciais em useCallback

FIN-1: ESLint warnings corrigidos
Made-with: Cursor"
git push origin main
```

### Validação
- [ ] Build do Vercel fica READY (sem erros de ESLint)
- [ ] Se build falhar: reverter `ignoreDuringBuilds` para `true` e investigar

### Fallback
Se algum warning novo aparecer que não foi detectado:
```js
// Em next.config.js, reverter temporariamente:
eslint: {
  ignoreDuringBuilds: true,
}
```

---

## FIN-2: Corrigir 404 do discord-notification (edge function inexistente)

**Prioridade**: MÉDIA
**Tipo**: Edge Function fix + Deploy
**Risco**: BAIXO

### Contexto
3 arquivos referenciam `/functions/v1/discord-notification` que NÃO existe. A edge function real é `discord-dispatcher`. Os 404s aparecem nos logs toda vez que `contahub-sync-automatico` roda (a cada 30 min para cada bar).

### Arquivos a corrigir

**1. `backend/supabase/functions/contahub-sync-automatico/index.ts` (linha ~869)**

Trocar a chamada direta a `discord-notification` por `discord-dispatcher` com action `notification`:

```typescript
// ANTES (linha 869):
const discordResponse = await fetch('https://uqtgsvujwcbymjmvkjhy.supabase.co/functions/v1/discord-notification', {

// DEPOIS:
const discordResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/discord-dispatcher`, {
```

E no body, adicionar `action: 'notification'`:
```typescript
body: JSON.stringify({
  action: 'notification',  // ← ADICIONAR
  title: summary.error_count === 0 ? '✅ ContaHub Sync Concluído' : '⚠️ ContaHub Sync com Erros',
  // ... resto igual
})
```

**2. `backend/supabase/functions/discord-dispatcher/index.ts` (linha 22)**

O dispatcher precisa PROCESSAR a action `notification` internamente (enviar para Discord webhook) em vez de redirecionar para uma função inexistente.

Opção A (recomendada) — Processar inline:
```typescript
const ACTION_URLS: Record<string, string> = {
  // 'notification': PROCESSAR INTERNAMENTE (ver abaixo)
  'command': '/functions/v1/discord-commands',
  'pdf': '/functions/v1/relatorio-pdf',
};
```

Adicionar handler inline para notification:
```typescript
if (action === 'notification') {
  // Enviar diretamente para Discord webhook
  const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');
  if (!webhookUrl) {
    throw new Error('DISCORD_WEBHOOK_URL não configurada');
  }

  const { title, custom_message, webhook_type } = params;
  const discordPayload = {
    embeds: [{
      title: title || 'Notificação Zykor',
      description: custom_message || 'Sem detalhes',
      color: title?.includes('✅') ? 0x00ff00 : title?.includes('⚠️') ? 0xffa500 : 0x0099ff,
      timestamp: new Date().toISOString()
    }]
  };

  const webhookResponse = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(discordPayload)
  });

  // retornar resultado...
}
```

**3. `backend/supabase/functions/unified-dispatcher/index.ts` (linha 36)**
Mesma correção — remover `discord-notification` do mapeamento.

### Deploy
```bash
supabase functions deploy contahub-sync-automatico --project-ref uqtgsvujwcbymjmvkjhy
supabase functions deploy discord-dispatcher --project-ref uqtgsvujwcbymjmvkjhy
supabase functions deploy unified-dispatcher --project-ref uqtgsvujwcbymjmvkjhy
```

### Validação
- [ ] Logs do Supabase não mostram mais 404 em `discord-notification`
- [ ] `contahub-sync-automatico` retorna 200 E envia notificação Discord com sucesso

---

## FIN-3: Deletar edge function nibo-sync

**Prioridade**: BAIXA
**Tipo**: Limpeza
**Risco**: NENHUM (função já não é chamada por ninguém)

### Contexto
A função `nibo-sync` ainda está deployed no Supabase mas não tem nenhum cron job ou código que a chame. O NIBO foi completamente removido do projeto.

### Ação
Via Supabase Dashboard:
1. Ir em https://supabase.com/dashboard/project/uqtgsvujwcbymjmvkjhy/functions
2. Encontrar `nibo-sync`
3. Clicar nos 3 pontos → Delete
4. Confirmar deleção

OU via CLI:
```bash
supabase functions delete nibo-sync --project-ref uqtgsvujwcbymjmvkjhy
```

### Validação
- [ ] `nibo-sync` não aparece mais em `supabase functions list`

---

## FIN-4: Verificar contahub-sync 404 (segunda fonte de 404)

**Prioridade**: BAIXA
**Tipo**: Investigação
**Risco**: NENHUM

### Contexto
Os logs mostram 404 em `/functions/v1/contahub-sync` (que não existe — a função real é `contahub-sync-automatico`). Não há cron job nem código chamando `contahub-sync`. Pode ser:
1. Um cron job antigo que não foi migrado (verificar `cron.job` por `contahub-sync` sem `automatico`)
2. Um database trigger
3. Uma chamada hardcoded em algum lugar

### Ação
```sql
-- Verificar se existe cron job oculto
SELECT * FROM cron.job WHERE command ILIKE '%contahub-sync%' AND command NOT ILIKE '%contahub-sync-automatico%';

-- Verificar triggers
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE action_statement ILIKE '%contahub-sync%';
```

Se encontrar a fonte, corrigir a URL para `contahub-sync-automatico`.

### Validação
- [ ] Logs não mostram mais 404 em `contahub-sync`
