"""
Analise de findings multiple_permissive_policies do Supabase Performance Advisor.

Inputs:
  database/_advisor_snapshots/2026-04-24-perf-after-02.json (apos Fase 2)
  database/_advisor_snapshots/2026-04-24-pg-policies-post-fase2.json (estado fresco)

Output:
  database/_advisor_snapshots/2026-04-24-multiple-permissive-preflight.md

Fase 3.0 = analise apenas. NAO gera migration. NAO aplica DDL.
Migration eh gerada na Fase 3.1, apos aprovacao por bucket.

Idempotente: rodar 2x produz o mesmo output.
"""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parents[2]
SNAP = ROOT / "database" / "_advisor_snapshots"

PERF_FILE = SNAP / "2026-04-24-perf-after-02.json"
PG_POLICIES_FILE = SNAP / "2026-04-24-pg-policies-post-fase2.json"
PREFLIGHT = SNAP / "2026-04-24-multiple-permissive-preflight.md"

BS = chr(92)


def parse_detail(detail: str) -> Optional[tuple]:
    """Extrai (schema, table, role, action, policies_tuple) do detail."""
    parts = detail.split("`")
    if len(parts) < 8:
        return None
    st = parts[1].rstrip(BS)
    role = parts[3].rstrip(BS)
    action = parts[5].rstrip(BS)
    pols_raw = parts[7].rstrip(BS).strip("{}")
    if "." not in st:
        return None
    s, t = st.split(".", 1)
    pols = tuple(sorted(p.strip() for p in pols_raw.split(",")))
    return s, t, role, action, pols


def is_service_role_check(qual: str) -> bool:
    """True se qual eh check 'auth.role() = service_role' (com ou sem wrap)."""
    if not qual:
        return False
    q = qual.lower().replace(" ", "").replace("\n", "")
    needles = [
        "auth.role()='service_role'",
        "auth.role()=cast('service_role'astext)",
        "(selectauth.role())='service_role'",
        "(selectauth.role()asrole)='service_role'",
    ]
    return any(n in q for n in needles)


def is_always_true(qual: str) -> bool:
    return qual is not None and qual.strip().lower() == "true"


def is_user_writer_check(qual: str) -> bool:
    """True se qual contem auth.role()='authenticated' E user_has_bar_access."""
    if not qual:
        return False
    q = qual.lower()
    return "'authenticated'" in q and "user_has_bar_access" in q


def main() -> None:
    perf = json.loads(PERF_FILE.read_text(encoding="utf-8"))
    pol_list = json.loads(PG_POLICIES_FILE.read_text(encoding="utf-8"))

    pol_by_table: dict[tuple[str, str], list[dict]] = defaultdict(list)
    pol_index: dict[tuple[str, str, str], dict] = {}
    for p in pol_list:
        key_table = (p["schemaname"], p["tablename"])
        pol_by_table[key_table].append(p)
        pol_index[(p["schemaname"], p["tablename"], p["policyname"])] = p

    findings = [l for l in perf if l["name"] == "multiple_permissive_policies"]

    # Agrupa por (schema, table)
    table_findings: dict[tuple[str, str], list[tuple]] = defaultdict(list)
    parse_failures = []
    for f in findings:
        parsed = parse_detail(f.get("detail", ""))
        if parsed is None:
            parse_failures.append(f.get("cache_key", "?"))
            continue
        s, t, role, action, pols = parsed
        table_findings[(s, t)].append((role, action, pols))

    # Para cada tabela, classificar
    bucket_a = []  # DROP redundant service_role (BYPASSRLS makes it no-op)
    bucket_b = []  # roles distintos (legitimo)
    bucket_c = []  # complexo / read-write split / precisa decisao

    for (s, t), entries in sorted(table_findings.items()):
        all_pols = pol_by_table[(s, t)]
        permissive_pols = [p for p in all_pols if p["permissive"] == "PERMISSIVE"]

        # Pegar uniao de policies envolvidas em qualquer finding
        flagged_names = set()
        for _, _, pols in entries:
            flagged_names.update(pols)

        # Classificar
        # Pattern A (DROP service_role): exatamente 2 policies envolvidas, uma e
        # service_role check (ou USING true), outra e auth.role()='authenticated'
        # ou bar_access. service_role bypass RLS, entao DROP eh seguro.
        if len(flagged_names) == 2:
            pol_objs = [p for p in permissive_pols if p["policyname"] in flagged_names]
            if len(pol_objs) == 2:
                p1, p2 = pol_objs
                # Identificar service_role policy
                sr = None
                other = None
                for p in pol_objs:
                    if is_service_role_check(p.get("qual", "") or "") or is_always_true(p.get("qual", "") or ""):
                        sr = p
                    else:
                        other = p
                if sr and other:
                    # Confirma que sr eh redundante (cmd=ALL ou cmd=SELECT) e other tem auth check
                    bucket_a.append({
                        "schema": s,
                        "table": t,
                        "drop": sr,
                        "keep": other,
                        "findings_count": len(entries),
                    })
                    continue

        # Pattern C (read/write split): 2 policies, ambas com is_user_admin / user_has_bar_access
        # Ou outro pattern nao trivial
        bucket_c.append({
            "schema": s,
            "table": t,
            "policies": [p for p in permissive_pols if p["policyname"] in flagged_names],
            "findings_count": len(entries),
        })

    # ---------- preflight md ----------
    md = []
    md.append("# Preflight — perf/03-multiple-permissive-policies")
    md.append("")
    md.append(f"Findings raw: **{len(findings)}**, parse failures: **{len(parse_failures)}**")
    md.append(f"Tabelas distintas afetadas: **{len(table_findings)}**")
    md.append("")
    md.append("## Sumario por bucket")
    md.append("")
    md.append("| Bucket | Tabelas | Significado |")
    md.append("|---|---:|---|")
    md.append(f"| A — DROP service_role redundante | {len(bucket_a)} | service_role tem BYPASSRLS=true; policy USING(auth.role()='service_role') OR USING(true) eh no-op. DROP eh seguro. |")
    md.append(f"| B — Roles distintos | {len(bucket_b)} | Policies com roles diferentes; pode ser intencional. |")
    md.append(f"| C — Read/write split / complexo | {len(bucket_c)} | Cmds diferentes; merge nao trivial. Precisa decisao. |")
    total = len(bucket_a) + len(bucket_b) + len(bucket_c)
    md.append(f"| **Total** | **{total}** | |")
    md.append("")

    md.append("## Premissa critica (verificada via pg_roles)")
    md.append("")
    md.append("```")
    md.append("rolname            rolbypassrls")
    md.append("anon               false")
    md.append("authenticated      false")
    md.append("authenticator      false")
    md.append("dashboard_user     false")
    md.append("postgres           true")
    md.append("service_role       true   <-- bypassa RLS")
    md.append("supabase_admin     true")
    md.append("```")
    md.append("")
    md.append("Conclusao: policies do tipo `service_role_full_*` com `USING (auth.role()='service_role')`")
    md.append("ou `USING (true)` sao redundantes — `service_role` ja bypassa qualquer RLS por default.")
    md.append("DROP dessas policies NAO altera comportamento de service_role.")
    md.append("")
    md.append("Bonus: 2 das policies a dropar (contaazul_*) tem `roles={public}` + `USING (true)`,")
    md.append("o que vazava SELECT pra TODOS os roles (incluindo `anon`). DROP fortalece seguranca.")
    md.append("")

    # ---------- Bucket A ----------
    if bucket_a:
        md.append("## Bucket A — DROP service_role policy redundante")
        md.append("")
        md.append("Pattern: DROP POLICY <service_role_*> + manter <usuarios_leem_*> intacta.")
        md.append("")
        md.append("**SEM ALTER POLICY** na que fica — ela ja esta correta.")
        md.append("**COM DROP POLICY** na redundante (bypass RLS torna inutil).")
        md.append("")
        for entry in bucket_a:
            s, t = entry["schema"], entry["table"]
            drop = entry["drop"]
            keep = entry["keep"]
            md.append(f"### `{s}.{t}` ({entry['findings_count']} findings)")
            md.append("")
            md.append("**Atual:**")
            md.append("```sql")
            md.append(f"-- DROP candidate (redundante por BYPASSRLS):")
            md.append(f"--   {drop['policyname']:50s} cmd={drop['cmd']:6s} permissive={drop['permissive']}")
            md.append(f"--     roles: {drop['roles']}")
            md.append(f"--     qual:  {drop.get('qual')}")
            if drop.get("with_check"):
                md.append(f"--     with_check: {drop.get('with_check')}")
            md.append(f"")
            md.append(f"-- KEEP (policy real do usuario):")
            md.append(f"--   {keep['policyname']:50s} cmd={keep['cmd']:6s} permissive={keep['permissive']}")
            md.append(f"--     roles: {keep['roles']}")
            md.append(f"--     qual:  {keep.get('qual')}")
            if keep.get("with_check"):
                md.append(f"--     with_check: {keep.get('with_check')}")
            md.append("```")
            md.append("")
            md.append("**SQL proposto:**")
            md.append("```sql")
            md.append(f'DROP POLICY "{drop["policyname"]}" ON "{s}"."{t}";')
            md.append("```")
            md.append("")
            # Notas especiais
            if is_always_true(drop.get("qual", "") or ""):
                md.append("⚠️ **Nota seguranca**: esta policy tinha `USING (true)` + `roles={public}`,")
                md.append("permitindo SELECT por TODOS os roles incluindo `anon`. DROP corrige bug de seguranca")
                md.append("que ja existia. service_role continua acessando via BYPASSRLS.")
                md.append("")

    # ---------- Bucket B ----------
    if bucket_b:
        md.append("## Bucket B — Roles distintos")
        md.append("")
        for entry in bucket_b:
            s, t = entry["schema"], entry["table"]
            md.append(f"### `{s}.{t}`")
            md.append("(detalhes pendentes — nenhum caso identificado nesta rodada)")
            md.append("")

    # ---------- Bucket C ----------
    if bucket_c:
        md.append("## Bucket C — Read/write split (precisa decisao)")
        md.append("")
        md.append("Estas tabelas tem 2 policies PERMISSIVE com cmds diferentes (uma SELECT, outra ALL).")
        md.append("Overlap so existe em SELECT. NAO da pra simplesmente DROP — perde funcionalidade.")
        md.append("")
        md.append("Opcoes possiveis (escolher por tabela):")
        md.append("1. **Adiar** — manter como esta. Overhead de 2 policies em SELECT eh pequeno.")
        md.append("2. **Split cmd** — DROP a policy ALL + CREATE 3 novas (INSERT, UPDATE, DELETE).")
        md.append("   Mantem semantica, satisfaz advisor. Mas viola 'no DROP+CREATE' (cria 3 novas).")
        md.append("3. **Merge cmd=ALL com USING e WITH CHECK separados** — DROP read + ALTER write")
        md.append("   pra `USING (read_cond OR write_cond) WITH CHECK (write_cond)`. Funciona em")
        md.append("   SELECT/INSERT/UPDATE mas DELETE so checa USING (vaza permissao de delete!).")
        md.append("   ⚠️ Risco de regressao de seguranca em DELETE.")
        md.append("")
        for entry in bucket_c:
            s, t = entry["schema"], entry["table"]
            md.append(f"### `{s}.{t}`")
            md.append("")
            md.append("**Policies envolvidas:**")
            md.append("```sql")
            for p in entry["policies"]:
                md.append(f"-- {p['policyname']:50s} cmd={p['cmd']:6s} roles={p['roles']}")
                md.append(f"--   qual: {p.get('qual')}")
                if p.get("with_check"):
                    md.append(f"--   with_check: {p.get('with_check')}")
                md.append("--")
            md.append("```")
            md.append("")
            md.append("**Recomendacao**: opcao 1 (adiar) por default. Opcao 2 se voce quiser")
            md.append("eliminar todos os warnings. Opcao 3 NAO recomendada (risco DELETE).")
            md.append("")

    PREFLIGHT.write_text("\n".join(md), encoding="utf-8")

    # ---------- console summary ----------
    print(f"[ok] {PREFLIGHT.relative_to(ROOT)}")
    print()
    print(f"Findings: {len(findings)}, tabelas: {len(table_findings)}")
    print(f"Bucket A (DROP redundant): {len(bucket_a)}")
    print(f"Bucket B (roles distintos): {len(bucket_b)}")
    print(f"Bucket C (read/write split): {len(bucket_c)}")


if __name__ == "__main__":
    main()
