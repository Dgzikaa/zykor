# Script de Inserção de Eventos - Abril a Junho 2026

## Descrição

Este script insere eventos planejados para os meses de Abril, Maio e Junho de 2026 no Planejamento Comercial do Ordinário (bar_id = 4).

## Eventos Incluídos

- **Abril 2026**: 30 eventos
- **Maio 2026**: 31 eventos  
- **Junho 2026**: 30 eventos

**Total**: 91 eventos

## Como Usar

### Pré-requisitos

1. Servidor de desenvolvimento rodando (`npm run dev` no frontend)
2. Estar autenticado no sistema
3. Ter permissão para o bar Ordinário (bar_id = 4)

### Executar o Script

```bash
cd c:\Projects\zykor\scripts
node inserir-eventos-abril-junho.js
```

### O que o Script Faz

1. Conecta na API `/api/eventos/bulk-insert`
2. Envia todos os 91 eventos em uma única requisição
3. Usa `upsert` para inserir ou atualizar eventos existentes
4. Retorna mensagem de sucesso ou erro

### Estrutura dos Eventos

Cada evento contém:
- `data_evento`: Data no formato YYYY-MM-DD
- `nome`: Nome do evento/atração
- `dia_semana`: Dia da semana (SEGUNDA, TERÇA, etc.)
- `m1_r`: Receita planejada (Meta M1)

### Campos Automáticos

O sistema adiciona automaticamente:
- `bar_id`: 4 (Ordinário)
- `ativo`: true
- `precisa_recalculo`: false
- `versao_calculo`: 1

## Correções Implementadas

### 1. Filtro de Mês Corrigido

**Problema**: Março mostrava 37 eventos (incluindo dias 30 e 31 de março que não existem)

**Solução**: Adicionado filtro rigoroso para garantir que apenas eventos do mês/ano solicitado sejam retornados:

```typescript
const eventosFiltrados = (eventos || []).filter(evento => {
  const [anoEvento, mesEvento] = evento.data_evento.split('-').map(Number);
  return mesEvento === mes && anoEvento === ano;
});
```

### 2. API de Inserção em Lote

Criada nova API `/api/eventos/bulk-insert` que permite inserir múltiplos eventos de uma vez usando `upsert`.

## Verificação

Após executar o script, verifique no Planejamento Comercial:

1. Acesse: https://zykor.com.br/estrategico/planejamento-comercial
2. Selecione Abril/2026 - deve mostrar 30 eventos
3. Selecione Maio/2026 - deve mostrar 31 eventos
4. Selecione Junho/2026 - deve mostrar 30 eventos

## Sobre a Edição com Cores Laranja

A edição com destaque laranja é o comportamento padrão do sistema para indicar a célula selecionada. Isso ajuda a visualizar qual campo está sendo editado ou visualizado.

**Comportamento atual**:
- Linha selecionada: fundo azul claro
- Célula clicada: borda laranja + fundo laranja claro
- Hover: fundo azul muito claro

Este comportamento é intencional e melhora a UX ao navegar pela tabela.
