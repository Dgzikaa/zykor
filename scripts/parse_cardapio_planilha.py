import json, re, sys

SRC = r"C:\Users\rodri\.claude\projects\C--Projects-zykor\80499b98-8f0b-4d4e-a097-2c185c01420a\tool-results\mcp-claude_ai_Google_Drive-read_file_content-1780362758551.txt"
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
        v = float(s)
        return round(v, 4)
    except ValueError:
        return None

CODE = re.compile(r"[a-z]\d{4}")

# ---- Bloco A: linha 6..2315, layout 20 col, cod em cells[3] ----
blocoA = {}
for ln in lines[6:2316]:
    cells = [c.strip() for c in ln.split("|")]
    if len(cells) < 13:
        continue
    cod = cells[3]
    if not re.fullmatch(r"[a-z]\d{4}", cod):
        continue
    nome = cells[4]
    if not nome:
        continue
    blocoA[cod] = {
        "codigo": cod, "nome": nome,
        "custo_final": money(cells[8]),
        "preco_venda": money(cells[11]),
        "ativo": cells[2],
        "macro": cells[18] if len(cells) > 18 else "",
        "origem": "A",
    }

# ---- Bloco D: a partir de 5041, layout 6 col: cod|nome|cat|custoFinal|precoVenda|cmv ----
blocoD = {}
for ln in lines[5041:]:
    cells = [c.strip() for c in ln.split("|")]
    if len(cells) < 6:
        continue
    cod = cells[1]
    if not re.fullmatch(r"[a-z]\d{4}", cod):
        continue
    nome = cells[2]
    if not nome:
        continue
    blocoD[cod] = {
        "codigo": cod, "nome": nome,
        "categoria": cells[3],
        "custo_final": money(cells[4]),
        "preco_venda": money(cells[5]),
        "origem": "D",
    }

# merge: D manda (tem c/d), A complementa
merged = {}
for cod, r in blocoA.items():
    merged[cod] = r
for cod, r in blocoD.items():
    if cod in merged:
        # preferir custo de D se A nao tem; manter ativo/macro de A
        a = merged[cod]
        r["ativo"] = a.get("ativo", "")
        r["macro"] = a.get("macro", "")
    merged[cod] = r

from collections import Counter
def pref_counts(d):
    return dict(Counter(c[0] for c in d))
print("Bloco A (b-codes bebida):", len(blocoA), pref_counts(blocoA))
print("Bloco D (resumo final):  ", len(blocoD), pref_counts(blocoD))
print("Merged total:            ", len(merged), pref_counts(merged))
com_custo = {k: v for k, v in merged.items() if v.get("custo_final")}
print("Com custo_final>0:       ", len(com_custo), pref_counts(com_custo))

out = r"C:\Projects\zykor\scripts\cardapio_planilha_produtos.json"
json.dump(list(merged.values()), open(out, "w", encoding="utf-8"), ensure_ascii=False)
print("Salvo:", out)

print("\nAmostra Bloco D:")
for r in list(blocoD.values())[:8]:
    print("  ", r["codigo"], r["nome"][:35].ljust(35), "custoF=", r["custo_final"], "pv=", r["preco_venda"])
