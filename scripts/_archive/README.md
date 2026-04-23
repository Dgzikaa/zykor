# scripts/_archive/ — one-offs históricos

> Arquivados em 2026-04-23. **Não executar.**

Estes 143 scripts foram utilitários pontuais (fixes, debug, recálculos de semana específica, syncs datados, backfills) que cumpriram seu papel e foram preservados apenas para referência histórica.

Subpastas:
- `fix/` — hotfixes pontuais
- `debug-investigar/` — debug e investigação ad-hoc
- `comparar-verificar/` — comparações e verificações pontuais
- `recalcular/` — recálculos por semana/dia específico
- `reprocessar/` — reprocessamentos pontuais
- `sync-oneoff/` — syncs datados (NÃO são sync recorrente — este roda via edge function)
- `test/` — testes manuais
- `misc-oneoff/` — ad-hocs que não entraram em outra categoria

Ver `scripts/README.md` pra regras de quando arquivar vs manter em `_active/`.

## Antes de deletar

Dá pra `git rm -r scripts/_archive/` quando ninguém consultar por 6 meses. Até lá, é histórico útil.
