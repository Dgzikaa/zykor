# Integração Tangerino (Sólides DP) — API de Ponto / RH

> Plataforma de **folha de ponto, jornada, férias e ausências**. "Tangerino" virou **Sólides DP**.
> Vamos conectar na **Central do Funcionário** (schema `hr` / `/rh/funcionarios`).
> Doc oficial: https://docs.tangerino.com.br/ · Status (jun/2026): **mapeado, aguardando token/API key**.

## APIs e Swagger
| API | Base URL | Swagger |
|-----|----------|---------|
| Empregador (cadastros) | `https://employer.tangerino.com.br` | `/swagger-ui.html` |
| Ponto (Punch) | `https://api.tangerino.com.br/api/punch` | `/swagger-ui.html` |
| Relatórios (Report) | `https://api.tangerino.com.br/api/report` | `/swagger-ui.html` |

OpenAPI JSON: `https://api.tangerino.com.br/api/punch/v2/api-docs` (funciona; usar pros schemas).

## Autenticação
- **JWT via Basic** — header em TODA requisição: `Authorization: Basic <seu_token>`.
- Token é **solicitado ao suporte** da Sólides/Tangerino; aparece em **Empregador → Integrações** (menu novo) / **Configurações → Integrações** (menu antigo).
- Teste de conectividade: `GET https://employer.tangerino.com.br/test` (retorna saudação).
- **Multi-tenant (importante p/ nós):** cada bar/empresa terá seu PRÓPRIO token → guardar por `bar_id` (envelope encryption, igual Stone/CA — ver [[project_multi_tenant_integrations]]).

## Endpoints (por categoria)

### Cadastros básicos (Empregador)
- `POST /job-role/register` · `GET /job-role/find` · `GET /job-role/find-all` — **Cargos**
- `POST /workplace/register` · `GET /workplace/find` · `GET /workplace/find-all` — **Local de trabalho/Setor**
- `GET /work-schedule` — **Escalas** (resposta: `startShift1/endShift1/startShift2/endShift2` em ms, por dia da semana 1=Dom..7=Sáb)
- `POST /employee/register` · `GET /employee/find` — **Colaborador**
- `POST /manager/register` — **Gestor** (marca um colaborador como gestor)
- `GET /adjustment-reason/find-all` — **Motivos de ajuste** (`id, description, allowance, fullDay, countAsMissing`)

### Colaborador — `POST /employee/register` (body)
```json
{
  "name": "João da Silva",
  "email": "joao@dominio.com",
  "birthDateInMillis": 1553113792002,
  "phone": "0123456789",
  "cpf": "99773635015",
  "ctps": "54321", "series": "123", "pis": "54238589918",
  "admissionDate": 1553113792002,
  "effectiveDate": 1553113792002,
  "workSchedule": 0,      // id da escala
  "workplace": 0,         // id do local
  "timeZone": "SAO_PAULO",
  "externalId": "<nosso id>"   // opcional — usar p/ amarrar ao hr.funcionarios
}
```
Resposta inclui `id` (gerado) + `pin` (acesso ao relógio). Datas em **milissegundos**.

### Ponto — `GET /api/punch/` (consulta de marcações)
Operation: `findPunchByFilterUsingGET`. Params: `employeeId`, `startDate`, `endDate`, `status` (APPROVED/PENDING/REPROVED), `lastUpdate` (delta — só modificados desde), `justClosed`, `page`, `size`. Resposta: `Page«Punch»` (content[] + first/last/number/totalElements/totalPages).
**Modelo Punch:** `id, employeeId, employeeName, date, dateIn, dateOut, status, comments, edited, excluded, hashStart, hashEnd, photoIn(Photo), photoOut(Photo), locationIn(Location), locationOut(Location), workPlace, employee, employer`.
- `GET /api/punch/observation-historical` — histórico de observações da marcação.

### Lançamentos / Ajustes
- **Férias** — `POST /adjustment/register`:
```json
{ "adjustmentReasonDTO": { "id": 1, "description": "FÉRIAS" },
  "employeeDTO": { "id": "<employee_id>" },
  "startDate": 1553113792002, "endDate": 1553200192002,
  "fullDay": true, "origem": "Integração", "status": "APROVADO" }
```
`status`: APROVADO | PENDENTE | REPROVADO. (mesmo endpoint p/ atestados/ajustes, variando o `adjustmentReasonDTO`).
- **Ponto em atraso** — `POST /register/late/1.1`:
```json
{ "employeeId": "<id>", "date": "2019-08-01T14:52:36.968-0300", "manualEditingJustificationId": "<id>" }
```
Aqui a data é ISO `yyyy-MM-dd'T'HH:mm:ss.SSSZ` (NÃO milissegundos). Uma marcação = um instante; o sistema classifica entrada/saída sozinho.

### Relatório
- `GET /api/report/.../time-sheet` — **Folha de ponto** (retorna **PDF em base64**).

## Como encaixa na Central do Funcionário (schema `hr`)
| Feature nossa | Fonte Tangerino |
|---|---|
| Cadastro/dossiê de funcionário | `employee/find` (+ `register` p/ criar lá, amarrando `externalId`) |
| **Ponto eletrônico / espelho de ponto** | `GET /api/punch` por `employeeId`+período (pull incremental via `lastUpdate`) |
| Férias / ausências / atestados | `adjustment/register` (escrita) + `adjustment-reason/find-all` (de-para de motivos) |
| Escala / jornada | `GET /work-schedule` |
| Cargo / setor | `job-role/*`, `workplace/*` |
| Hora-extra / faltas (cálculo) | derivar de `punch` (dateIn/dateOut) × `work-schedule`; `countAsMissing` dos motivos |

## Plano de integração (quando a key chegar)
1. **Credencial por bar** em `api_credentials` (sistema `tangerino`), token cifrado (resolver único, igual Stone). `GET /test` valida.
2. **Bronze**: `bronze_tangerino_employees`, `bronze_tangerino_punch` (raw JSON), `bronze_tangerino_*` (escalas/cargos/locais). Cron de **pull diário** + delta por `lastUpdate` (marcações).
3. **Silver/Gold**: tipar marcações → `hr` (espelho de ponto por dia, hora-extra, faltas), juntando com escala.
4. **De-para**: `externalId` (Tangerino) ↔ `hr.funcionarios.id`; `adjustment-reason` ↔ motivos internos.
5. **UI**: aba Ponto no dossiê do funcionário (Central de Funcionários), com espelho/marcações; escrita de férias/ajustes opcional (fase 2).

## A confirmar com a key em mãos
- Schema exato de `Photo`, `Location`, `Employee`, `Employer` (puxar do `v2/api-docs`).
- Paginação real (tamanho máx de `size`) e rate limit (não documentado).
- Se `lastUpdate` cobre exclusões (`excluded=true`) p/ sincronizar remoções.
- Fuso: marcações vêm em ms/ISO — confirmar timezone (alinhar com nosso dt_gerencial se for cruzar com operação).
- Se há **webhook** (não apareceu na doc — provavelmente só pull).
