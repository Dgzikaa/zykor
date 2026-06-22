import json, re, unicodedata

PLAN = r"C:\Projects\zykor\scripts\deboche_planilha_produtos.json"
CH = r"C:\Users\rodri\.claude\projects\C--Projects-zykor\80499b98-8f0b-4d4e-a097-2c185c01420a\tool-results\mcp-claude_ai_Supabase-execute_sql-1780365882334.txt"
OUT = r"C:\Projects\zykor\scripts\load_custo_manual_bar4.sql"
BAR = 4

plan = json.load(open(PLAN, encoding="utf-8"))
ch = json.loads(re.search(r"\[\s*\{.*\}\s*\]", json.load(open(CH, encoding="utf-8"))["result"], re.S).group(0))

def norm(s):
    s = (s or "").strip().replace("\\", "")
    s = re.sub(r"^\s*\[[A-Za-z]{1,4}\]\s*", "", s)
    s = re.sub(r"\bHH\b", "", s)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

plan_by_norm = {}
for p in plan:
    if not p.get("custo_final"):
        continue
    n = norm(p["nome"])
    if n:
        plan_by_norm.setdefault(n, p)
plan_norms = sorted(plan_by_norm.keys(), key=len, reverse=True)

def find_match(n):
    if n in plan_by_norm:
        return plan_by_norm[n], "exato"
    for pn in plan_norms:
        if len(pn) >= 4 and (n.startswith(pn + " ") or n == pn):
            return plan_by_norm[pn], "prefixo"
    return None, None

def esc(s):
    return (s or "").replace("'", "''")

rows4 = [r for r in ch if r["bar_id"] == BAR]
rec_total = sum(float(r["receita"]) for r in rows4)
sem = [r for r in rows4 if not r["tem_custo"]]
rec_sem = sum(float(r["receita"]) for r in sem)

vals, rec_casada_sem, casam_sem = [], 0.0, 0
for r in rows4:
    match, tipo = find_match(norm(r["produto_desc"]))
    if not match or not match["custo_final"] or match["custo_final"] <= 0:
        continue
    pv = match.get("preco_venda")
    vals.append(f"({BAR}, '{esc(str(r['produto_codigo']))}', '{esc(r['produto_desc'])}', "
                f"{match['custo_final']}, {pv if pv else 'NULL'}, '{esc(match['codigo'])}', '{tipo}')")
    if not r["tem_custo"]:
        casam_sem += 1
        rec_casada_sem += float(r["receita"])

print(f"BAR {BAR}: produtos vendidos {len(rows4)} | sem custo {len(sem)}")
print(f"  receita total R$ {rec_total:,.0f} | sem custo R$ {rec_sem:,.0f}")
print(f"  produtos casados (carga total): {len(vals)}")
print(f"  recupera do gap sem-custo: {casam_sem}/{len(sem)} -> R$ {rec_casada_sem:,.0f} ({rec_casada_sem/rec_sem*100:.0f}% do gap)")

naomatch = sorted([r for r in sem if not find_match(norm(r['produto_desc']))[0]], key=lambda r:-float(r['receita']))
print("  TOP 12 ainda sem match:")
for r in naomatch[:12]:
    print(f"     {str(r['produto_codigo']):>5} R$ {float(r['receita']):>8,.0f}  {r['produto_desc'][:40]}")

sql = ("INSERT INTO operations.produto_custo_manual\n"
       "  (bar_id, produto_codigo, produto_desc, custo_manual, preco_venda_planilha, codigo_planilha, match_tipo)\nVALUES\n"
       + ",\n".join(vals) +
       "\nON CONFLICT (bar_id, produto_codigo) DO UPDATE SET\n"
       "  produto_desc=EXCLUDED.produto_desc, custo_manual=EXCLUDED.custo_manual,\n"
       "  preco_venda_planilha=EXCLUDED.preco_venda_planilha, codigo_planilha=EXCLUDED.codigo_planilha,\n"
       "  match_tipo=EXCLUDED.match_tipo, fonte='planilha_cardapio', atualizado_em=now();\n")
open(OUT, "w", encoding="utf-8").write(sql)
print("SQL salvo:", OUT)
