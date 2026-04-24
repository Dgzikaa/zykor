#!/usr/bin/env python3
"""Adiciona @camada header em edge functions baseado em ops.job_camada_mapping.

Uso:
    python scripts/_active/add-camada-headers.py [--dry-run]

Fonte de verdade: ops.job_camada_mapping (snapshot inline abaixo — atualizar
quando o mapping mudar).
"""
import sys
from pathlib import Path

# Snapshot de ops.job_camada_mapping (2026-04-23)
MAPPING = {
    # bronze
    "apify-sync":                   ("bronze", "Sync generico Apify"),
    "contaazul-sync":               ("bronze", "Sync diario Conta Azul"),
    "contahub-sync-automatico":     ("bronze", "Sync recorrente ContaHub"),
    "contahub-sync-direto":         ("bronze", "Sync direto ContaHub (manual)"),
    "getin-sync-continuous":        ("bronze", "Sync GetIn (15min)"),
    "google-reviews-apify-sync":    ("bronze", "Scraping reviews via Apify"),
    "google-sheets-sync":           ("bronze", "Sync planilhas Google"),
    "nibo-sync":                    ("bronze", "Sync NIBO"),
    "sympla-sync":                  ("bronze", "Sync Sympla"),
    "umbler-sync":                  ("bronze", "Sync Umbler"),
    # consumo
    "gerar-pdf-semanal":            ("consumo", "PDF semanal"),
    # gold
    "recalcular-desempenho-v2":     ("gold",   "Recalcula gold.desempenho_semanal"),
    "sync-cliente-perfil-consumo":  ("gold",   "Popula gold.cliente_perfil_consumo"),
    "sync-faturamento-hora":        ("gold",   "Popula gold.faturamento_hora"),
    # ops
    "agente-detector":              ("ops",    "AI V2 detector"),
    "agente-dispatcher":            ("ops",    "AI V2 dispatcher"),
    "agente-narrator":              ("ops",    "AI V2 narrator"),
    "agente-pipeline-v2":           ("ops",    "AI V2 orquestrador"),
    "alertas-dispatcher":           ("ops",    "Alertas Discord/WhatsApp"),
    "contaazul-auth":               ("ops",    "OAuth callback Conta Azul"),
    "cron-watchdog":                ("ops",    "Verifica crons atrasados"),
    "inter-pix-webhook":            ("ops",    "Webhook PIX Inter"),
    "sync-dispatcher":              ("ops",    "Roteador de syncs"),
    "unified-dispatcher":           ("ops",    "Roteador unificado"),
    "webhook-dispatcher":           ("ops",    "Roteador de webhooks"),
    # silver
    "contahub-processor":           ("silver", "Raw JSON -> tabelas tipadas"),
    "silver-processor":             ("silver", "Silver generico"),
    "stockout-processar":           ("silver", "Estoque diario"),
}

HEADER_TEMPLATE = """/**
 * @camada {camada}
 * @jobName {name}
 * @descricao {desc}
 *
 * Classificacao medallion mantida em ops.job_camada_mapping (ver
 * database/migrations/2026-04-23-observability-mapping.sql). Observability
 * via _shared/heartbeat.ts ou _shared/observability.ts.
 */
"""


def process(path: Path, camada: str, name: str, desc: str, dry_run: bool) -> str:
    content = path.read_text(encoding="utf-8")
    if "@camada" in content[:500]:
        return "skip (ja tem @camada)"
    header = HEADER_TEMPLATE.format(camada=camada, name=name, desc=desc)
    new_content = header + content
    if not dry_run:
        path.write_text(new_content, encoding="utf-8")
    return "updated"


def main():
    dry_run = "--dry-run" in sys.argv
    root = Path("backend/supabase/functions")
    updated, skipped, missing = [], [], []

    for name, (camada, desc) in MAPPING.items():
        index = root / name / "index.ts"
        if not index.exists():
            missing.append(name)
            continue
        status = process(index, camada, name, desc, dry_run)
        if status.startswith("updated"):
            updated.append(name)
        else:
            skipped.append(f"{name} ({status})")

    print(f"updated: {len(updated)}")
    for n in updated:
        print(f"  + {n}")
    print(f"skipped: {len(skipped)}")
    for n in skipped:
        print(f"  - {n}")
    if missing:
        print(f"missing (nao existem localmente, verificar): {len(missing)}")
        for n in missing:
            print(f"  ? {n}")
    print(f"\n{'(dry-run)' if dry_run else 'DONE'}")


if __name__ == "__main__":
    main()
