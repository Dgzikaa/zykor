# Análise de Consumos - Semana 13 (23/03 a 29/03/2026)
## Bar Ordinário (ID 3)

## Valores Esperados (Planilha CMV):
- **Consumo Sócios**: R$ 3.099,47
- **Consumo Benefícios (Clientes)**: R$ 4.323,80
- **Consumo Artista**: R$ 10.970,80
- **Consumo RH Operação**: R$ 846,38

---

## Análise de `contahub_analitico` - Registros com `desconto > 0`

### Top 100 Mesas por Total de Desconto:

| Mesa | Qtd Itens | Total Desconto | Total Pago | Categoria Sugerida |
|------|-----------|----------------|------------|-------------------|
| X DozeporOito | 85 | R$ 2.441,75 | R$ 0,00 | ARTISTA (Doze) |
| X Elas que toquem | 43 | R$ 1.088,85 | R$ 0,00 | ARTISTA |
| X Sambadona | 41 | R$ 989,95 | R$ 0,00 | ARTISTA |
| X Pe no Chao | 38 | R$ 948,10 | R$ 0,00 | ARTISTA (Pé no Chão) |
| X Samba da Tia Zelia | 42 | R$ 863,00 | R$ 0,00 | ARTISTA |
| X Banda Dudu | 22 | R$ 608,90 | R$ 0,00 | ARTISTA |
| X 7naRoda | 24 | R$ 508,90 | R$ 0,00 | ARTISTA (Roda) |
| X Boka de Sergipe | 17 | R$ 501,15 | R$ 0,00 | ARTISTA (Boka) |
| X DIOGO | 19 | R$ 479,65 | R$ 0,00 | SOCIO |
| X- Gonza | 20 | R$ 439,80 | R$ 0,00 | SOCIO |
| X Bonsai | 20 | R$ 438,00 | R$ 0,00 | ARTISTA? |
| **1897** | 18 | R$ 436,10 | R$ 0,00 | ? (pode ser Gonza) |
| **1659** | 14 | R$ 416,20 | R$ 0,00 | ? |
| X Breno Alves | 18 | R$ 403,15 | R$ 0,00 | ARTISTA |
| **026** | 4 | R$ 400,00 | R$ 7,80 | ? |
| X Aniversariante | 10 | R$ 332,45 | R$ 0,00 | CLIENTE |
| X-corbal | 9 | R$ 323,55 | R$ 0,00 | SOCIO |
| X-Corbal | 20 | R$ 310,35 | R$ 0,00 | SOCIO |
| X segunda da resenha | 9 | R$ 303,60 | R$ 0,00 | ARTISTA |
| X Wendel | 7 | R$ 270,73 | R$ 69,92 | ? |
| X cadu | 6 | R$ 263,70 | R$ 0,00 | SOCIO |
| X-Viny | 14 | R$ 203,22 | R$ 203,08 | SOCIO (Vinicius) |
| X NATALIA | 6 | R$ 202,55 | R$ 0,00 | ? |
| X Aniversario | 5 | R$ 158,75 | R$ 0,00 | CLIENTE |
| X Paulo Victor | 5 | R$ 150,75 | R$ 0,00 | ARTISTA (PV/Prod) |
| X Nato | 5 | R$ 139,85 | R$ 0,00 | ? |
| **Mesa magica** | 7 | R$ 128,65 | R$ 0,00 | CLIENTE |
| **1766** | 5 | R$ 122,70 | R$ 0,00 | ? |
| X DJ CAJU | 4 | R$ 97,80 | R$ 0,00 | ARTISTA |
| **1212** | 6 | R$ 92,70 | R$ 0,00 | ? |
| X luan | 1 | R$ 89,95 | R$ 0,00 | SOCIO |
| **Xslu** | 11 | R$ 87,45 | R$ 0,00 | FUNCIONARIO (SLU) |
| **1925** | 3 | R$ 85,85 | R$ 0,00 | ? |
| **1556** | 5 | R$ 70,75 | R$ 0,00 | ? |
| X Dj Negrita | 1 | R$ 65,95 | R$ 0,00 | ARTISTA |
| X Ana bia | 7 | R$ 64,66 | R$ 150,79 | ? |
| X-aniversario | 2 | R$ 63,90 | R$ 0,00 | CLIENTE |
| X Dj Afrika | 3 | R$ 59,85 | R$ 0,00 | ARTISTA |
| X Kauan | 8 | R$ 39,83 | R$ 92,82 | ? |
| X-Luan | 1 | R$ 49,95 | R$ 0,00 | SOCIO |
| X-Diego | 1 | R$ 39,95 | R$ 0,00 | SOCIO |

### Padrões Identificados:

1. **Mesas com "X " ou "X-"** = Contas especiais (Sócios, Artistas, Funcionários, Clientes)
2. **Mesas numéricas (ex: 1897, 1659, 026)** = Podem ser contas especiais sem identificação clara
3. **"Mesa magica"** (sem X) = Cliente especial
4. **"Xslu"** (sem espaço/hífen) = Funcionário
5. **Muitas mesas com desconto de exatamente R$ 100,00** = Promoção/desconto padrão

### Mesas Não Classificadas que Precisam de Definição:

- **1897** (R$ 436,10) - Pode ser Gonza?
- **1659** (R$ 416,20)
- **026** (R$ 400,00)
- **1766** (R$ 122,70)
- **1212** (R$ 92,70)
- **1925** (R$ 85,85)
- **1556** (R$ 70,75)
- **X Wendel** (R$ 270,73) - Sócio ou Funcionário?
- **X NATALIA** (R$ 202,55) - Sócio ou Funcionário?
- **X Nato** (R$ 139,85) - Sócio ou Funcionário?
- **X Ana bia** (R$ 64,66) - Funcionário?
- **X Kauan** (R$ 39,83) - Funcionário?
- **X Teixeira** (R$ 30,57) - Funcionário?
- **X Jhonny** (R$ 20,99) - Funcionário?

**Total de mesas não classificadas**: ~R$ 2.500,00

---

## Próximos Passos:

1. Classificar as mesas numéricas (1897, 1659, 026, etc.)
2. Classificar os nomes não identificados (Wendel, Natalia, Nato, etc.)
3. Decidir se usar **preço de venda direto** ou **aplicar fator de custo**
4. Verificar se as mesas com desconto de R$ 100,00 devem ser incluídas
