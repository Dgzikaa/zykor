# Pastas de rota vazias — arquivadas 2026-04-23

Duas pastas em `frontend/src/app/api/` que estavam sem `route.ts` nem sub-pastas, provavelmente resto de scaffolding ou rename abandonado.

- `_deprecated_nibo/` — explicitamente marcada deprecated, sem conteúdo
- `buscar-stakeholder/` — criada 2026-04-04, sem conteúdo

## Quando deletar

Next.js não exporta rota de pasta vazia, então já estavam inertes em produção. Depois de confirmar no Vercel que nenhuma chamada 404 reclamou esses paths, `git rm -r` no Cursor.
