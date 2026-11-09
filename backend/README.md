# Adherium backend foundation

Standalone Express + Mongoose API for a local, synthetic-data review of the respiratory-monitoring prototype. It does not connect to Hailie devices or an EHR, and it is not a clinical system. Authentication and authorization are not implemented. Keep the server bound to localhost and never expose these unauthenticated APIs publicly.

Structure: `src/config.js` environment configuration; `src/db.js` MongoDB connection; `src/models/` Mongoose models and indexes; `src/routes.js` versioned API; `src/services/analytics.js` server-side dashboard aggregation; `src/validation.js` request/query validation; `src/seed/` deterministic generator and opt-in upsert runner; `test/` focused checks.

## Source review and data map

Reviewed `reference/Adherium_ Respiratory Monitoring_files/saved_resource.html` (actual app and interaction logic), the saved HTML wrapper, and `reference/adherium.md`. All files in `reference/` remain untouched. The source defines 248 deterministic synthetic patients using PRNG seed `20260611`, with 90 days of two-daily controller dose outcomes, rescue-use counts, three cohorts, device connectivity, battery and sync age. It defines screens and user interactions; dates, time labels, temporary browser state, and export rendering are dynamic. No real or device-originated clinical records are provided.

| Screen                      | Data and controls in source                                                                                                                                                   | Backend mapping / value origin                                                                                                                                                                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 Overview                  | Patient/adherence totals, cohort mix, device connectivity/battery, alerts and recent activity; date range; links to patient/alert detail.                                     | `GET /analytics/overview`, `/patients`, `/alerts`; `Patient`, `AdherenceRecord`, `Device`, `Alert`, `AuditEvent`. Totals/charts derived server-side.                                                                                                                                        |
| 2 Patient Monitoring        | 248 patient rows, cohort, adherence, rescue counts, device state; cohort/status/search, adherence sorting, date window, row detail.                                           | `GET /patients` filters `cohort,status,q,sort,order,page,limit`; `/analytics/overview`; `GET /patients/:id`. Records synthetic; adherence derived from records.                                                                                                                             |
| 3 Patient Health Profile    | Patient ID/cohort, 90-day dose/rescue series, device, alerts, notes; date range, patient search; add note, acknowledge alert, sync request, CSV export.                       | Patient aggregate `GET /patients/:id`; `/patients/:id/timeline?from&to`; `POST /notes`; `POST /alerts/:id/acknowledge`; `POST /devices/:id/sync`. Exportable timeline data; sync simulation only.                                                                                           |
| 4 Smart Inhaler Devices     | Assigned patient, connectivity, battery, last sync, firmware; connected/pending/offline/low battery filter, incremental list, selected device, individual/fleet sync, export. | `GET /devices?status&lowBattery&page&limit`, `GET /devices/:id`, `PATCH /devices/:id`, `POST /devices/:id/sync`, `POST /devices/sync`. Sync only records a local simulated request.                                                                                                         |
| 5 Medication Adherence      | Daily scheduled/taken doses, adherence bands, cohort comparison, calendar and missed-dose patient IDs; cohort, date range, **selected** day.                                  | `GET /adherence?cohort&from&to&page&limit`, `/analytics/overview`; `AdherenceRecord`. Rates/bands are server-derived.                                                                                                                                                                       |
| 6 Respiratory Analytics     | Rescue uses by hour, overnight share, weekly trend, symptom-free days, patient scatter; cohort and 7/14/30-day range, click-through patient.                                  | `/analytics/overview?cohort&days`; `/adherence`; `/events?type=rescue-use&from&to`. Aggregations from synthetic stored events/adherence.                                                                                                                                                    |
| 7 Alerts & Follow-up        | Type, severity, status, patient, recent adherence/device context; status/severity/type/date filters; select, acknowledge/reopen, assign role, add related note, export.       | `GET /alerts?status&severity&type&patient&from&to`; `PATCH /alerts/:id` supports status/assignedTo; acknowledge route; `POST /notes`. Updates create audit events.                                                                                                                          |
| 8 Care Team Workspace       | Role columns, assigned alerts, notes, patient filter; role and patient search; add categorized note; patient profile navigation.                                              | `GET /notes?role&patient&category&page&limit`; `POST /notes`. Roles/categories reflect source presentation; no account identity system.                                                                                                                                                     |
| 9 Reports & Insights        | Four templates (weekly, devices, cohort, follow-up), saved reports, cohort and 7/14/30 day controls; generate, select, CSV/Markdown export, delete, open patient.             | `GET/POST /reports`, `GET /reports/:id`, `GET /reports/:id/export.csv`, `DELETE /reports/:id`. Snapshot is computed from records. Markdown formatting remains a client presentation concern.                                                                                                |
| 10 Data & Device Management | Demo pipeline and integration state, firmware distribution, CSV enrollment validation/history, simulated firmware scheduling, audit CSV.                                      | `/data/integrations`, `/data/firmware`, `POST /data/firmware/schedule`, `GET /data/imports`, `POST /data/imports/validate`, `GET /data/audit`. Pipeline and integration statuses are static simulated presentation data; validation/history/audit and firmware schedule are stored records. |

### Collections

- `Patient`: stable `externalId`, cohort, connection summary, battery/sync age, synthetic profile placeholder.
- `Device`: patient reference, firmware, connectivity, battery, last sync, simulated-sync marker.
- `InhalerEvent`: patient/device reference, event type, timestamp/hour; indexed by patient and timeline.
- `MedicationSchedule`, `AdherenceRecord`: schedule and daily dose counts; patient/date index supports timeline and analytics.
- `Alert`: stable alert ID, patient, type/severity/status, assignment and acknowledgement timestamps; filter index.
- `CareNote`: patient, author/role, category/text and creation time.
- `Report`: type, cohort/date window and generated summary snapshot.
- `ImportHistory`, `AuditEvent`, `IntegrationStatus`, `Firmware`, `FirmwareJob`: actual changeable management records plus clearly simulated integration/firmware state.

## API

Base URL `http://127.0.0.1:4000/api/v1`. JSON errors use `{ "error": { "code": "...", "message": "..." } }`; list responses use `{ "items": [], "page": 1, "limit": 25, "total": 0 }`. List `page` defaults to 1; `limit` defaults to 25 and caps at 100. Date filters are ISO dates/timestamps (`from`, `to` inclusive). No endpoint returns stack traces or connection strings.

| Method and path                                    | Purpose / inputs                                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /health`                                      | Server and MongoDB connected/disconnected status; no connection details.                                                   |
| `GET /patients`                                    | `cohort`, `status`, `q`, `sort`, `order`, `page`, `limit`; patient monitoring.                                             |
| `POST /patients`                                   | Create `{externalId,cohort,status?,battery?,profile?}`.                                                                    |
| `GET /patients/:id`                                | Profile aggregate with device, schedule, recent adherence, alerts and notes.                                               |
| `PATCH /patients/:id`                              | Update patient fields.                                                                                                     |
| `GET /patients/:id/timeline`                       | Events; supports `from,to,page,limit`.                                                                                     |
| `GET /devices`                                     | Device list; `status`, `lowBattery=true`, `page`, `limit`.                                                                 |
| `GET /devices/:id`, `PATCH /devices/:id`           | Retrieve or update one stable device ID.                                                                                   |
| `POST /devices/:id/sync`, `POST /devices/sync`     | Record simulated individual/fleet sync request; explicitly no physical connection.                                         |
| `GET /events`                                      | `patient`, `type`, `from`, `to`, pagination.                                                                               |
| `GET /adherence`                                   | `patient`, `cohort`, `from`, `to`, pagination.                                                                             |
| `GET /analytics/overview`                          | Derived dose adherence, rescue count, device and alert counts; `days` (1–90), optional `cohort`.                           |
| `GET /alerts`                                      | `status`, `severity`, `type`, `patient`, `from`, `to`, pagination.                                                         |
| `PATCH /alerts/:id`                                | Update `{status,assignedTo,role?}`; status is `open`, `assigned`, or `ack`.                                                |
| `POST /alerts/:id/acknowledge`                     | Acknowledge with optional `{role}`.                                                                                        |
| `GET /notes`                                       | `patient`, `role`, `category`, pagination.                                                                                 |
| `POST /notes`                                      | Create `{patient,role,category,text,author?}`; categories: Follow-up call, Medication review, Device support, Education.   |
| `GET /reports`                                     | Saved report list with pagination.                                                                                         |
| `POST /reports`                                    | Generate `{type,cohort?,rangeDays?}`; type weekly/devices/cohort/followup; cohort all/asthma/copd; window 7/14/30.         |
| `GET /reports/:id`                                 | Retrieve stored report and snapshot.                                                                                       |
| `GET /reports/:id/export.csv`                      | Export saved summary snapshot as CSV.                                                                                      |
| `DELETE /reports/:id`                              | Delete report and audit action.                                                                                            |
| `GET /data/imports`, `POST /data/imports/validate` | View history; validate `{name,csv}` with expected `patient_id,cohort` columns. Upload validation does not create patients. |
| `GET /data/integrations`, `GET /data/firmware`     | Display simulated integration and firmware distribution records.                                                           |
| `POST /data/firmware/schedule`                     | Record a simulated update schedule; devices are not changed.                                                               |
| `GET /data/audit`                                  | Paginated audit trail.                                                                                                     |

Example:

```json
POST /api/v1/reports
{"type":"weekly","cohort":"asthma","rangeDays":7}
```

Response is `{ "item": { "externalId": "RP-...", "type": "weekly", "snapshot": {"patients": 0, "adherence": 0, "rescueUses": 0, "devices": [], "alerts": 0, "notes": 0} } }` with counts based on stored data.

## Setup (Windows PowerShell)

```powershell
Set-Location C:\Users\Adi\Desktop\Adherium\backend
npm install
Copy-Item .env.example .env.local
notepad .env.local
```

If `.env.local` already exists, do not replace it; add `MONGODB_URI` and `PORT=4000` using a local editor. Never paste credentials into chat. The API will fail safely if the URI is missing or MongoDB cannot be reached. Seed is opt-in and requires the explicit `--apply` flag:

```powershell
npm run seed
npm run seed -- --dry-run
npm run seed -- --apply
npm start
```

The seed first prints a collection plan; `--apply` then prints current counts and uses `$setOnInsert` upserts, without deleting or replacing existing records. Planned counts include 248 patients/devices/schedules, 22,320 adherence days, 26,452 deterministically generated dose/rescue events, 13 alerts, 2 notes, 4 reports, 4 import-history rows, 3 integration statuses and 3 firmware versions. The dataset is synthetic and reproducible; existing DB state may make the inserted count lower than plan. Seed never runs at server startup.

Checks and tests:

```powershell
npm test
npm run seed -- --dry-run
Invoke-RestMethod http://127.0.0.1:4000/health
```

Tests use pure validation, the generated fixture, and HTTP tests against an unconnected app. They do not use the configured MongoDB database. Install dependencies before running them.

## Limits and simulated behavior

The source shows generated browser demo data and simulated device sync, firmware schedule, app relay/cloud ingestion, EHR export, and import validation. It does not provide real identities, age/diagnosis/medication history, device serials, firmware status events, actual device readings, audit history state, report snapshot details, backend contracts, authentication, or live integrations. The seed preserves 248 synthetic IDs, cohort distribution algorithm, 90-day daily dose/rescue ranges, connectivity, battery, sync-age pattern, and firmware assignment pattern. Seed-generated events use representative timestamps/hours because browser data stores daily arrays rather than actual event timestamps. Never present this backend as live monitoring or clinically validated.
