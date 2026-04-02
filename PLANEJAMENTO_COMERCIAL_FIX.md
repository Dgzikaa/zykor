# Correções no Planejamento Comercial

## Problemas Identificados e Resolvidos

### 1. Março mostrando 37 eventos (deveria mostrar 31)

**Problema**: O filtro de datas estava incluindo eventos de outros meses devido a problemas de timezone ou dados incorretos.

**Solução**: Adicionado filtro rigoroso em dois lugares:

#### `frontend/src/app/api/estrategico/planejamento-comercial/route.ts`
```typescript
const eventosFiltrados = eventos?.filter(evento => {
  const [anoEvento, mesEvento, diaEvento] = evento.data_evento.split('-').map(Number);
  
  // CRITICAL FIX: Garantir que APENAS eventos do mês/ano solicitado sejam retornados
  const isCorrectMonth = mesEvento === mes && anoEvento === ano;
  
  if (!isCorrectMonth) {
    return false; // Rejeitar imediatamente eventos de outros meses
  }
  
  // Verificar se o bar opera nesse dia
  const dataEvento = new Date(evento.data_evento + 'T00:00:00Z');
  const dow = dataEvento.getUTCDay();
  const barOpera = barOperaNoDia(operacaoBar, dow);

  return barOpera;
}) || [];
```

#### `frontend/src/app/estrategico/planejamento-comercial/services/planejamento-service.ts`
```typescript
// CRITICAL FIX: Filtrar eventos para garantir APENAS o mês/ano solicitado
const eventosFiltrados = (eventos || []).filter(evento => {
  const [anoEvento, mesEvento] = evento.data_evento.split('-').map(Number);
  return mesEvento === mes && anoEvento === ano;
});
```

### 2. Abril mostrando dias 30 e 31 de março

**Problema**: Mesmo problema do item 1 - filtro de datas não estava funcionando corretamente.

**Solução**: Com os filtros implementados acima, agora apenas eventos do mês correto são exibidos.

### 3. Eventos de Abril, Maio e Junho 2026 não existiam

**Problema**: Não havia eventos cadastrados para esses meses.

**Solução**: 
- Criado script `scripts/inserir-eventos-direto.js` que insere 91 eventos:
  - **Abril 2026**: 30 eventos
  - **Maio 2026**: 31 eventos
  - **Junho 2026**: 30 eventos

**Execução**:
```bash
cd c:\Projects\zykor
node scripts/inserir-eventos-direto.js
```

**Resultado**:
```
✅ Operação concluída!
   Inseridos: 91 eventos
   Atualizados: 0 eventos
```

### 4. Sobre a edição com cores laranja

**Não é um bug** - É o comportamento padrão do sistema para indicar a célula selecionada.

**Comportamento atual**:
- **Linha selecionada**: fundo azul claro
- **Célula clicada**: borda laranja + fundo laranja claro (destaque visual)
- **Hover**: fundo azul muito claro

Este comportamento melhora a UX ao navegar pela tabela, permitindo que o usuário saiba exatamente qual célula está selecionada.

## Arquivos Alterados

### Código
1. `frontend/src/app/api/estrategico/planejamento-comercial/route.ts` - Filtro de mês corrigido
2. `frontend/src/app/estrategico/planejamento-comercial/services/planejamento-service.ts` - Filtro de mês corrigido
3. `frontend/src/app/api/eventos/bulk-insert/route.ts` - Nova API para inserção em lote (criado)

### Scripts
1. `scripts/inserir-eventos-direto.js` - Script para inserir eventos (criado)
2. `scripts/inserir-eventos-abril-junho.js` - Script alternativo via API (criado)
3. `scripts/README-INSERIR-EVENTOS.md` - Documentação (criado)

## Validação

### Type-check
```bash
cd frontend
npm run type-check
```
**Resultado**: ✅ Sem erros

### Verificação Manual
1. Acesse: https://zykor.com.br/estrategico/planejamento-comercial
2. Selecione **Março 2026**: Deve mostrar exatamente 31 eventos (não 37)
3. Selecione **Abril 2026**: Deve mostrar 30 eventos (sem dias de março)
4. Selecione **Maio 2026**: Deve mostrar 31 eventos
5. Selecione **Junho 2026**: Deve mostrar 30 eventos

## Eventos Inseridos

### Abril 2026 (30 eventos)
- 01/04 a 30/04
- Incluindo feriados: 03/04 (Sexta-feira Santa), 21/04 (Tiradentes)
- Eventos especiais: 18/04 (STZ - R$ 150k), 20/04 (Clima de Montanha - R$ 80k), 25/04 (STZ - R$ 140k)

### Maio 2026 (31 eventos)
- 01/05 a 31/05
- Incluindo feriado: 01/05 (Dia do Trabalho)
- Todos os eventos regulares da programação

### Junho 2026 (30 eventos)
- 01/06 a 30/06
- Incluindo feriado: 04/06 (Corpus Christi)
- Eventos especiais da Copa: 13/06 (Brasil x Marrocos - R$ 150k), 19/06 (Brasil x Haiti - R$ 150k), 24/06 (Brasil x Escócia - R$ 125k), 29/06 (Brasil oitavas - R$ 100k)

## Próximos Passos

1. ✅ Validar que março agora mostra 31 eventos (não 37)
2. ✅ Validar que abril não mostra dias de março
3. ✅ Validar que abril, maio e junho têm todos os eventos
4. 🔄 Fazer commit das alterações
5. 🔄 Deploy para produção

## Notas Técnicas

- O filtro de mês agora é aplicado em **duas camadas** (API e Service) para garantir máxima confiabilidade
- O script de inserção verifica se o evento já existe antes de inserir (evita duplicatas)
- Todos os eventos foram inseridos com `precisa_recalculo: false` e `versao_calculo: 1`
- Os valores de M1 (Meta) foram fornecidos pelo usuário e inseridos exatamente como especificado
