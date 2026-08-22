# Vigia da Operação — `public.operacao_watchdog()` (22/08/2026)

Nasceu do dia em que **todo problema apareceu por acaso**: o xarope de gengibre zerou e só se
descobriu porque a Mafê resolveu seguir o plano à risca pra investigar; 9 lançamentos de produção
com erro de 1000× só apareceram porque eu mexi no desvio; a Feijoada vende R$ 28 mil em 60 dias sem
ficha; o Refri. de Gengibre está no Controle com ficha vazia. **O sistema tinha o dado pra avisar os
quatro e não avisava nenhum.**

Mesmo desenho do `contahub_watchdog`: o banco DETECTA e guarda estado em
`system.operacao_alertas` (PK bar+tipo+chave, com `alertado_em`/`resolvido_em`); a rota
`/api/cron/operacao-watchdog` AVISA (WhatsApp só entrega com o token da Vercel). Cron `0 13 * * *`
= 10h BRT, depois da cadeia diária. `?dry=1` mostra sem mandar.

## As 4 checagens

| tipo | o que pega |
|---|---|
| `ruptura` | preparo do Controle que não dura até a próxima produção |
| `lancamento_torto` | execução com consumo fora de 0,2×–5× do que a ficha prevê |
| `produto_sem_ficha` | produto ativo com > R$ 3 mil em 30 dias e nenhuma ficha |
| `producao_sem_ficha` | produção no Controle com ficha vazia |

## A calibragem da ruptura (a 1ª versão era inútil)

A primeira rodada devolveu **26 alertas de ruptura, TODOS com estoque 0,00** e metade sem contagem
nenhuma. Estoque zero por falta de contagem **não é ruptura**. Três guardas resolveram (7 alertas,
todos reais):

1. **Contagem recente obrigatória** (≤ 10 dias). Sem contagem, o problema é outro.
2. **Tem que ser estocável** — estoque > 0 em alguma contagem dos últimos 60 dias. Molho pesto é
   feito na hora e vive zerado; alertar todo dia é ruído.
3. **Consumo material** — ≥ 1 unidade de contagem por semana. Corta "molho de pimenta 0,00/dia" e
   mantém "xarope de gengibre 2,62 L/dia".

Validação: o Xarope de Gengibre aparece com **0,2 dia de estoque**. O vigia teria avisado antes de
faltar — que era exatamente o caso que abriu a investigação.

## O que a 1ª rodada revelou de brinde

**9 dos 17 lançamentos tortos têm razão exatamente 0,001** — mil vezes menor. Não é acidente, é
rotina: gente lançando em **kg num campo que espera grama**. E a tela `AbaExecutar` **já avisa**
(`AvisoUnidade` + modal "Confira as unidades", dispara em 50×) — ou seja, **estão clicando através
do aviso**. O conserto de verdade não é mais um aviso: é o campo não deixar errar (default no valor
esperado, ou unidade no próprio input). Fica anotado.

## Teto de mensagem

12 linhas por envio. O resto fica sem `alertado_em` e entra no próximo — mensagem gigante no
WhatsApp não é lida. Melhor 12 tratadas que 40 ignoradas.
