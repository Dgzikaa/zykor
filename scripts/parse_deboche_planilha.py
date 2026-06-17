import json, re

SRC = r"C:\Users\rodri\.claude\projects\C--Projects-zykor\80499b98-8f0b-4d4e-a097-2c185c01420a\tool-results\mcp-claude_ai_Google_Drive-read_file_content-1780366863057.txt"
content = json.load(open(SRC, encoding="utf-8"))["fileContent"]
lines = content.split("\n")

def money(s):
    s = (s or "").strip().replace("\\-", "-").replace("R$", "").strip()
    if not s:
        return None
    s = s.replace(".", "").replace(",", ".")
    s = re.sub(r"[^0-9.\-]", "", s)
    if s in ("", "-", "."):
        return None
    try:
        return round(float(s), 4)
    except ValueError:
        return None

# Bloco D Deboche: a partir de L2586 -> Codigo|PRODUTO|Categoria|QTD|CUSTO FINAL|Preco|CMV
prod = {}
for ln in lines[2587:]:
    cells = [c.strip() for c in ln.split("|")]
    if len(cells) < 7:
        continue
    cod = cells[1]
    if not re.fullmatch(r"[a-z]\d{4}", cod):
        continue
    nome = cells[2]
    if not nome:
        continue
    prod[cod] = {
        "codigo": cod, "nome": nome, "categoria": cells[3],
        "custo_final": money(cells[5]),
        "preco_venda": money(cells[6]),
        "origem": "D_deboche",
    }

from collections import Counter
print("Deboche Bloco D produtos:", len(prod), dict(Counter(c[0] for c in prod)))
print("  com custo>0:", len([p for p in prod.values() if p["custo_final"]]))
out = r"C:\Projects\zykor\scripts\deboche_planilha_produtos.json"
json.dump(list(prod.values()), open(out, "w", encoding="utf-8"), ensure_ascii=False)
print("Salvo:", out)
for r in list(prod.values())[:5]:
    print("  ", r["codigo"], r["nome"][:30].ljust(30), "custoF=", r["custo_final"], "pv=", r["preco_venda"])
