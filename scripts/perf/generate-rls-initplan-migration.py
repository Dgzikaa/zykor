"""
Gerador deterministico de migration ALTER POLICY pra envelopar
chamadas auth.<fn>() em (select ...) — fix do auth_rls_initplan
do Supabase Performance Advisor.

Inputs:
  database/_advisor_snapshots/2026-04-24-pg-policies-before.json
  database/_advisor_snapshots/2026-04-24-perf.json

Outputs:
  database/_advisor_snapshots/2026-04-24-rls-initplan-preflight.md
  database/migrations/2026-04-24-perf-rls-initplan.sql
  database/migrations/2026-04-24-perf-rls-initplan.rollback.sql

Uso:
  python scripts/perf/generate-rls-initplan-migration.py

Idempotente: rodar 2x produz o mesmo output.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Optional, Tuple

ROOT = Path(__file__).resolve().parents[2]
SNAP = ROOT / "database" / "_advisor_snapshots"
MIG = ROOT / "database" / "migrations"

PG_POLICIES_FILE = SNAP / "2026-04-24-pg-policies-before.json"
PERF_FILE = SNAP / "2026-04-24-perf.json"
PREFLIGHT = SNAP / "2026-04-24-rls-initplan-preflight.md"
MIGRATION = MIG / "2026-04-24-perf-rls-initplan.sql"
ROLLBACK = MIG / "2026-04-24-perf-rls-initplan.rollback.sql"

# auth.uid()/role()/jwt() (case insensitive)
AUTH_CALL_RE = re.compile(r"\bauth\.(uid|role|jwt)\s*\(\s*\)", re.IGNORECASE)
# Wrapping ja existente: '(' + ws + 'select' + ws imediatamente antes
WRAPPED_BEFORE_RE = re.compile(r"\(\s*select\s+$", re.IGNORECASE)
# Heuristica de "nao trivial": auth.X() como argumento de outra funcao
# Excluimos 'select' como pseudo-funcao
NESTED_FUNC_RE = re.compile(
    r"(?<!\w)(?P<name>(?!select\b)(?!SELECT\b)\w+)\s*\(\s*auth\.(?P<fn>uid|role|jwt)\s*\(\s*\)",
    re.IGNORECASE,
)


def parse_detail(detail: str) -> Optional[Tuple[str, str, str]]:
    """Extrai (schema, table, policy_name) do campo detail do advisor.

    Format real: 'Table \\\\`schema.table\\\\` has a row level security policy \\\\`policy_name\\\\` ...'
    Apos split por backtick, parts[1] = 'schema.table', parts[3] = 'policy_name\\\\'.
    """
    parts = detail.split("`")
    if len(parts) < 4:
        return None
    schema_table = parts[1].strip().rstrip("\\")
    policy_name = parts[3].strip().rstrip("\\")
    if "." not in schema_table:
        return None
    schema, table = schema_table.split(".", 1)
    return schema, table, policy_name


def wrap_auth_calls(expr: Optional[str]) -> Tuple[Optional[str], int, int]:
    """Retorna (expr_transformada, n_substituicoes, n_ja_envelopadas)."""
    if expr is None:
        return None, 0, 0
    out = []
    last = 0
    replaced = 0
    already = 0
    for m in AUTH_CALL_RE.finditer(expr):
        before = expr[max(0, m.start() - 30) : m.start()]
        if WRAPPED_BEFORE_RE.search(before):
            already += 1
            continue
        out.append(expr[last : m.start()])
        out.append(f"(select {m.group(0)})")
        last = m.end()
        replaced += 1
    out.append(expr[last:])
    return "".join(out), replaced, already


def is_non_trivial(qual: Optional[str], with_check: Optional[str]) -> Optional[str]:
    """Retorna razao de nao-trivialidade, ou None se trivial."""
    for label, expr in (("qual", qual), ("with_check", with_check)):
        if expr is None:
            continue
        m = NESTED_FUNC_RE.search(expr)
        if m:
            return f"{label}: auth.{m.group('fn')}() como argumento de funcao `{m.group('name')}`"
    return None


def fmt_alter_policy(
    policy: dict,
    new_qual: Optional[str],
    new_with_check: Optional[str],
) -> str:
    """Gera ALTER POLICY (USING ... [WITH CHECK ...])."""
    schema = policy["schemaname"]
    table = policy["tablename"]
    name = policy["policyname"]
    parts = [f'ALTER POLICY "{name}" ON "{schema}"."{table}"']
    if new_qual is not None:
        parts.append(f"  USING ({new_qual})")
    if new_with_check is not None:
        parts.append(f"  WITH CHECK ({new_with_check})")
    return "\n".join(parts) + ";"


def main() -> None:
    pol_list = json.loads(PG_POLICIES_FILE.read_text(encoding="utf-8"))
    pol_index = {(p["schemaname"], p["tablename"], p["policyname"]): p for p in pol_list}

    perf = json.loads(PERF_FILE.read_text(encoding="utf-8"))
    findings = [l for l in perf if l["name"] == "auth_rls_initplan"]

    fix_applicable = []  # (policy, new_qual, new_with_check, n_replaced)
    already_wrapped = []  # (schema, table, policy)
    not_found = []  # (schema, table, policy_name)
    non_trivial = []  # (policy, reason)

    seen_keys = set()
    for f in findings:
        parsed = parse_detail(f.get("detail", ""))
        if parsed is None:
            not_found.append(("?", "?", f.get("cache_key", "?")))
            continue
        schema, table, policy_name = parsed
        key = (schema, table, policy_name)
        # Dedup: o mesmo policy pode aparecer em varios findings; processa 1x
        if key in seen_keys:
            continue
        seen_keys.add(key)

        policy = pol_index.get(key)
        if not policy:
            not_found.append(key)
            continue

        non_triv = is_non_trivial(policy.get("qual"), policy.get("with_check"))
        if non_triv:
            non_trivial.append((policy, non_triv))
            continue

        new_qual, q_replaced, q_already = wrap_auth_calls(policy.get("qual"))
        new_check, c_replaced, c_already = wrap_auth_calls(policy.get("with_check"))
        total_replaced = q_replaced + c_replaced
        total_already = q_already + c_already

        if total_replaced > 0:
            fix_applicable.append((policy, new_qual, new_check, total_replaced))
        elif total_already > 0:
            already_wrapped.append(key)
        else:
            # auth.* nao encontrado em nenhum dos dois — tratamos como ja envelopada
            # (advisor pode ter cache stale)
            already_wrapped.append(key)

    fix_applicable.sort(key=lambda x: (x[0]["schemaname"], x[0]["tablename"], x[0]["policyname"]))
    already_wrapped.sort()
    not_found.sort()
    non_trivial.sort(key=lambda x: (x[0]["schemaname"], x[0]["tablename"], x[0]["policyname"]))

    # ---------- migration ----------
    mig = [
        "-- Envelopa auth.<fn>() em (select ...) em policies RLS apontadas",
        "-- pelo Supabase Performance Advisor (auth_rls_initplan).",
        "-- Baseline: database/_advisor_snapshots/2026-04-24-perf.json",
        "-- Pre-flight: database/_advisor_snapshots/2026-04-24-rls-initplan-preflight.md",
        "--",
        "-- Gerado por scripts/perf/generate-rls-initplan-migration.py (deterministico).",
        "-- Transformacao: regex substitui auth.(uid|role|jwt)() top-level por",
        "-- (select auth.X()). Mantem qual/with_check identicos exceto por isso.",
        "-- Idempotente: ALTER POLICY com mesmo corpo = no-op.",
        "--",
        "-- NOTA edge cases:",
        "--   public.api_credentials, public.usuarios_bares — tabelas/views residuais",
        "--     da migracao public -> schemas nomeados (integrations, auth_custom), parcial.",
        "--     ALTER POLICY aqui e semanticamente equivalente, mas indica divida tecnica.",
        "--   ops.job_camada_mapping — schema novo criado em 13f6072e (observability).",
        "",
    ]
    rb = [
        "-- Rollback de 2026-04-24-perf-rls-initplan.sql.",
        "-- Reverte cada ALTER POLICY pro qual/with_check ORIGINAL do snapshot",
        "-- database/_advisor_snapshots/2026-04-24-pg-policies-before.json.",
        "",
    ]

    for policy, nq, nc, _ in fix_applicable:
        s, t, n = policy["schemaname"], policy["tablename"], policy["policyname"]
        mig.append(f"-- {s}.{t} :: {n}")
        mig.append(fmt_alter_policy(policy, nq, nc))
        mig.append("")
        rb.append(f"-- {s}.{t} :: {n}")
        rb.append(fmt_alter_policy(policy, policy.get("qual"), policy.get("with_check")))
        rb.append("")

    MIGRATION.write_text("\n".join(mig), encoding="utf-8")
    ROLLBACK.write_text("\n".join(rb), encoding="utf-8")

    # ---------- preflight md ----------
    md = []
    md.append("# Preflight — perf/02-rls-initplan")
    md.append("")
    md.append(f"Findings `auth_rls_initplan` no advisor (raw, com duplicatas): **{len(findings)}**")
    md.append(f"Policies distintas (apos dedup): **{len(seen_keys)}**")
    md.append("")
    md.append("## Buckets")
    md.append("")
    md.append("| Bucket | Count |")
    md.append("|---|---:|")
    md.append(f"| FIX APLICAVEL | {len(fix_applicable)} |")
    md.append(f"| JA ENVELOPADA (falso positivo do advisor) | {len(already_wrapped)} |")
    md.append(f"| NAO ENCONTRADA (policy ausente em pg_policies) | {len(not_found)} |")
    md.append(f"| CASO NAO-TRIVIAL (revisao manual) | {len(non_trivial)} |")
    total = len(fix_applicable) + len(already_wrapped) + len(not_found) + len(non_trivial)
    md.append(f"| **Total (distintas)** | **{total}** |")
    md.append("")

    if non_trivial:
        md.append("## Casos NAO-TRIVIAL (revisao manual obrigatoria)")
        md.append("")
        for policy, reason in non_trivial:
            s, t, n = policy["schemaname"], policy["tablename"], policy["policyname"]
            md.append(f"### `{s}.{t}` :: `{n}`")
            md.append(f"**Motivo**: {reason}")
            md.append("")
            md.append("```sql")
            md.append("-- USING:")
            md.append(policy.get("qual") or "-- (null)")
            md.append("-- WITH CHECK:")
            md.append(policy.get("with_check") or "-- (null)")
            md.append("```")
            md.append("")

    if not_found:
        md.append("## NAO ENCONTRADAS")
        md.append("Policies apontadas pelo advisor mas ausentes no snapshot pg_policies.")
        md.append("Possivel causa: snapshot defasado, ou policy criada/dropada entre snapshot e advisor run.")
        md.append("")
        for k in not_found:
            md.append(f"- `{k[0]}.{k[1]}` :: `{k[2]}`")
        md.append("")

    if already_wrapped:
        md.append("## JA ENVELOPADAS / sem auth.* aparente (falso positivo do advisor)")
        md.append("Advisor flaggou, mas inspecao mostra que auth.*() ja esta envelopada em `(select ...)`,")
        md.append("ou nem aparece no qual/with_check (cache stale). Nenhuma acao necessaria.")
        md.append("")
        for k in already_wrapped:
            md.append(f"- `{k[0]}.{k[1]}` :: `{k[2]}`")
        md.append("")

    if fix_applicable:
        md.append("## Amostra de 3 ALTER POLICY (FIX APLICAVEL)")
        md.append("Os 3 primeiros (ordem alfabetica) — pra validacao da forma.")
        md.append("")
        for policy, nq, nc, n_repl in fix_applicable[:3]:
            s, t, n = policy["schemaname"], policy["tablename"], policy["policyname"]
            md.append(f"### `{s}.{t}` :: `{n}` ({n_repl} substituicoes)")
            md.append("**Antes (snapshot pg_policies):**")
            md.append("```sql")
            if policy.get("qual") is not None:
                md.append(f"USING ({policy['qual']})")
            if policy.get("with_check") is not None:
                md.append(f"WITH CHECK ({policy['with_check']})")
            md.append("```")
            md.append("**Depois (gerado):**")
            md.append("```sql")
            md.append(fmt_alter_policy(policy, nq, nc))
            md.append("```")
            md.append("")

    PREFLIGHT.write_text("\n".join(md), encoding="utf-8")

    # ---------- console summary ----------
    print(f"[ok] {MIGRATION.relative_to(ROOT)}: {len(fix_applicable)} ALTER POLICY")
    print(f"[ok] {ROLLBACK.relative_to(ROOT)}: {len(fix_applicable)} reverse ALTER POLICY")
    print(f"[ok] {PREFLIGHT.relative_to(ROOT)}")
    print()
    print(
        f"Buckets: fix={len(fix_applicable)} ja_envelopada={len(already_wrapped)} "
        f"nao_encontrada={len(not_found)} nao_trivial={len(non_trivial)}"
    )
    print(f"Findings raw: {len(findings)}, distintas: {len(seen_keys)}")


if __name__ == "__main__":
    main()
