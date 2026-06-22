import json, re, unicodedata

PLAN = r"C:\Projects\zykor\scripts\cardapio_planilha_produtos.json"
CH = r"C:\Users\rodri\.claude\projects\C--Projects-zykor\80499b98-8f0b-4d4e-a097-2c185c01420a\tool-results\mcp-claude_ai_Supabase-execute_sql-1780365882334.txt"

plan = json.load(open(PLAN, encoding="utf-8"))

# extrair array JSON de dentro do arquivo de resultado (wrapper de untrusted-data)
outer = json.load(open(CH, encoding="utf-8"))
result_str = outer["result"]
m = re.search(r"\[\s*\{.*\}\s*\]", result_str, re.S)
ch = json.loads(m.group(0))

def norm(s):
    s = (s or "").strip()
    s = s.replace("\\", "")                                 # markdown escape: \[PP\] -> [PP]
    s = re.sub(r"^\s*\[[A-Za-z]{1,4}\]\s*", "", s)         # remove prefixo [PP] [DD] [HH] [PPHH]
    s = re.sub(r"\bHH\b", "", s)                            # sufixo " HH"
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    return s

# index planilha por nome_norm (preferir com custo)
plan_by_norm = {}
for p in plan:
    if not p.get("custo_final"):
        continue
    n = norm(p["nome"])
    if not n:
        continue
    plan_by_norm.setdefault(n, p)

# nomes-base da planilha p/ match por prefixo (>=4 chars, evita lixo); maior primeiro
plan_norms = sorted(plan_by_norm.keys(), key=len, reverse=True)

def find_match(n):
    if n in plan_by_norm:
        return plan_by_norm[n], "exato"
    # prefixo: nome ContaHub começa com nome-base da planilha (ex: 'caipirinha limao' ~ 'caipirinha')
    for pn in plan_norms:
        if len(pn) >= 4 and (n.startswith(pn + " ") or n == pn):
            return plan_by_norm[pn], "prefixo"
    return None, None

print("Produtos planilha com custo e nome_norm unico:", len(plan_by_norm))

for bar in (3, 4):
    rows = [r for r in ch if r["bar_id"] == bar]
    sem_custo = [r for r in rows if not r["tem_custo"]]
    rec_total = sum(float(r["receita"]) for r in rows)
    rec_sem = sum(float(r["receita"]) for r in sem_custo)

    casados, rec_casada, naomatch = 0, 0.0, []
    tipos = {"exato": 0, "prefixo": 0}
    for r in sem_custo:
        n = norm(r["produto_desc"])
        match, tipo = find_match(n)
        if match:
            casados += 1
            rec_casada += float(r["receita"])
            tipos[tipo] += 1
        else:
            naomatch.append(r)
    print(f"  (match exato={tipos['exato']} prefixo={tipos['prefixo']})")
    print(f"\n===== BAR {bar} =====")
    print(f"  produtos vendidos 90d: {len(rows)} | sem custo: {len(sem_custo)}")
    print(f"  receita total: R$ {rec_total:,.0f} | sem custo: R$ {rec_sem:,.0f} ({rec_sem/rec_total*100:.0f}%)")
    print(f"  CASAM com planilha: {casados}/{len(sem_custo)} produtos")
    print(f"  receita RECUPERADA: R$ {rec_casada:,.0f}  ({rec_casada/rec_sem*100:.0f}% do gap, {rec_casada/rec_total*100:.0f}% do total)")
    naomatch.sort(key=lambda r: -float(r["receita"]))
    print(f"  TOP 15 ainda sem match (maior receita):")
    for r in naomatch[:15]:
        print(f"     {str(r['produto_codigo']):>5}  R$ {float(r['receita']):>9,.0f}  {r['produto_desc'][:45]}")
