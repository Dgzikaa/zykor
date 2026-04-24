# `lib/medallion/` — client tipado por camada

> Introduzido na Etapa 4 do plano de limpeza (2026-04-23).

Camadas medallion do Zykor:

- **Bronze** → raw (ingestão de APIs externas, JSON bruto em `bronze.*`/`contahub_raw_data`).
- **Silver** → tipado (tabelas limpas e mapeadas em `public.*` e `silver.*`).
- **Gold** → calculado (métricas por evento e agregações em `gold.*`).

## Motivação

Antes desta lib, qualquer tela podia fazer `supabase.schema('gold' as never).from(...)` inline. Isso funciona mas esconde intenção: ao bater o olho no import não dá pra saber se aquela tela consome dado raw, tipado ou calculado.

Com a lib:

```ts
import { gold } from '@/lib/medallion/gold';

const { data } = await gold().from('desempenho_semanal').select('*');
```

Lê em uma linha: essa tela consome **gold**, ou seja, dados já calculados. Se alguém tentar importar `bronze` numa tela de dashboard, fica óbvio que algo está errado.

## Regras

1. **Dashboards consomem gold.** Se o frontend precisa calcular algo a partir de silver, é sinal pra mover o cálculo pro banco (função SQL + view gold).
2. **Silver é pra telas admin/debug** e pra edição de campos manuais (`operations.*`).
3. **Bronze é SOMENTE leitura**. Nunca escrever no bronze do frontend — isso é papel de edge function de ingestão.
4. Sempre filtrar por `bar_id` (regra universal do Zykor).

## API

Todos são `async () => SupabaseClient` pq o client admin é lazy-init.

```ts
const bronzeClient = await bronze();
const silverClient = await silver();
const goldClient   = await gold();
```

Cada um já aplica `.schema(...)` correspondente — basta chamar `.from('tabela')`.

## Migração das telas existentes

Não é um big bang. Refactor oportunista: quando for mexer numa tela, troca `supabase.schema('gold' as never)` → `import { gold } from '@/lib/medallion/gold'` + `(await gold()).from(...)`.

Meta (Etapa 4 do plano): pelo menos **5 telas** migradas como prova de conceito. Ver `docs/domains/frontend.md` (Etapa 5) pra lista.
