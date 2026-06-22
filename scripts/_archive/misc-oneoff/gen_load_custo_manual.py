import json, re, unicodedata

PLAN = r"C:\Projects\zykor\scripts\cardapio_planilha_produtos.json"
CH = r"C:\Users\rodri\.claude\projects\C--Projects-zykor\80499b98-8f0b-4d4e-a097-2c185c01420a\tool-results\mcp-claude_ai_Supabase-execute_sql-1780365882334.txt"
OUT = r"C:\Projects\zykor\scripts\load_custo_manual_bar3.sql"

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

BAR = 3
vals = []
for r in ch:
    if r["bar_id"] != BAR:
        continue
    match, tipo = find_match(norm(r["produto_desc"]))
    if not match:
        continue
    custo = match["custo_final"]
    if not custo or custo <= 0:
        continue
    pv = match.get("preco_venda")
    pv_sql = f"{pv}" if pv else "NULL"
    vals.append(
        f"({BAR}, '{esc(str(r['produto_codigo']))}', '{esc(r['produto_desc'])}', "
        f"{custo}, {pv_sql}, '{esc(match['codigo'])}', '{tipo}')"
    )

sql = """-- Carga de custo manual (planilha Engenharia de Cardapio) -- BAR 3 / Ordinario
-- Gerado por scripts/gen_load_custo_manual.py. Idempotente (upsert).
INSERT INTO operations.produto_custo_manual
  (bar_id, produto_codigo, produto_desc, custo_manual, preco_venda_planilha, codigo_planilha, match_tipo)
VALUES
""" + ",\n".join(vals) + """
ON CONFLICT (bar_id, produto_codigo) DO UPDATE SET
  produto_desc         = EXCLUDED.produto_desc,
  custo_manual         = EXCLUDED.custo_manual,
  preco_venda_planilha = EXCLUDED.preco_venda_planilha,
  codigo_planilha      = EXCLUDED.codigo_planilha,
  match_tipo           = EXCLUDED.match_tipo,
  fonte                = 'planilha_cardapio',
  atualizado_em        = now();
"""
open(OUT, "w", encoding="utf-8").write(sql)
print(f"Linhas de custo geradas (bar {BAR}): {len(vals)}")
print("SQL salvo em:", OUT)
