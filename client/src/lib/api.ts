export type ApiEnvelope<T> = {
  items?: T[];
  item?: T;
  total?: number;
  page?: number;
  limit?: number;
};

const RESOURCE_CACHE_TTL = 60_000;
const DAY_MS = 86_400_000;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}
const resourceCache = new Map<
  string,
  { expiresAt: number; promise: Promise<unknown> }
>();

function cachedResource<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cached = resourceCache.get(key);
  if (cached && cached.expiresAt > Date.now())
    return cached.promise as Promise<T>;
  const promise = load().catch((error) => {
    if (resourceCache.get(key)?.promise === promise) resourceCache.delete(key);
    throw error;
  });
  resourceCache.set(key, {
    expiresAt: Date.now() + RESOURCE_CACHE_TTL,
    promise,
  });
  return promise;
}

function clearResourceCache() {
  resourceCache.clear();
  rawData = createRawData();
}

export async function api<T>(
  path: string,
  init?: Omit<RequestInit, 'body'> & { body?: unknown },
): Promise<T> {
  const { body, headers, ...rest } = init || {};
  const response = await fetch(`/api/v1${path}`, {
    ...rest,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = text;
  }
  if (!response.ok) {
    const error =
      payload && typeof payload === 'object' && 'error' in payload
        ? (payload as { error: unknown }).error
        : undefined;
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : error
          ? String(error)
          : `Request failed (${response.status})`;
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code)
        : undefined;
    throw new ApiError(message, response.status, code);
  }
  if ((rest.method || 'GET').toUpperCase() !== 'GET') clearResourceCache();
  return payload as T;
}

export async function allPages<T>(
  path: string,
  requestedLimit = 100,
): Promise<T[]> {
  const first = await api<ApiEnvelope<T>>(
    `${path}${path.includes('?') ? '&' : '?'}page=1&limit=${requestedLimit}`,
  );
  const items = first.items || [];
  const total = first.total || items.length;
  const limit = first.limit || requestedLimit;
  const pageCount = Math.ceil(total / limit);
  const rest: ApiEnvelope<T>[] = [];
  for (let start = 2; start <= pageCount; start += 10) {
    const pageNumbers = Array.from(
      { length: Math.min(10, pageCount - start + 1) },
      (_, index) => start + index,
    );
    rest.push(
      ...(await Promise.all(
        pageNumbers.map((page) =>
          api<ApiEnvelope<T>>(
            `${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=${limit}`,
          ),
        ),
      )),
    );
  }
  return [...items, ...rest.flatMap((page) => page.items || [])];
}

export type PatientRecord = {
  externalId: string;
  cohort: 'asthma-adult' | 'asthma-pediatric' | 'copd';
  status: 'connected' | 'pending' | 'offline';
  battery: number;
  lastSyncAt?: string;
  enrolledDaysAgo?: number;
  synthetic?: boolean;
};
type DeviceRecord = {
  externalId: string;
  patient: { externalId: string } | string;
  connectivity: PatientRecord['status'];
  battery: number;
  lastSyncAt?: string;
};
type AdherenceRecord = {
  patient: { externalId: string } | string;
  date: string;
  taken: number;
  rescueUses: number;
  synthetic?: boolean;
};
type AlertRecord = {
  externalId: string;
  patient: { externalId: string } | string;
  type?: string;
  severity?: 'high' | 'med' | 'low';
  status?: 'open' | 'assigned' | 'ack';
  detail?: string;
  assignedTo?: string;
  acknowledgedBy?: string;
  createdAt?: string;
  acknowledgedAt?: string;
};
type NoteRecord = {
  externalId: string;
  patient: { externalId: string } | string;
  role: string;
  category: string;
  text: string;
  createdAt: string;
};
type ReportRecord = {
  externalId: string;
  type: string;
  cohort: string;
  rangeDays: number;
  snapshot?: Record<string, unknown>;
  createdAt: string;
  status: string;
};
type ImportRecord = {
  externalId: string;
  name: string;
  rows: number;
  status: string;
  createdAt: string;
};
type AuditRecord = { action: string; role: string; createdAt: string };
type EventRecord = {
  patient: { externalId: string } | string;
  type: string;
  occurredAt: string;
  hour?: number;
  synthetic?: boolean;
};
type HealthResponse = {
  status: string;
  database: string;
  demoDataEnd: string;
};
type ResourceName =
  | 'patients'
  | 'devices'
  | 'adherence'
  | 'alerts'
  | 'notes'
  | 'reports'
  | 'imports'
  | 'audit'
  | 'integrations'
  | 'firmware'
  | 'events'
  | 'overview';
type RawData = {
  patients?: PatientRecord[];
  devices?: DeviceRecord[];
  adherence: Map<string, AdherenceRecord>;
  alerts?: AlertRecord[];
  notes?: NoteRecord[];
  reports?: ReportRecord[];
  imports?: ImportRecord[];
  audit?: AuditRecord[];
  integrations?: unknown[];
  firmware?: unknown[];
  events: Map<string, EventRecord>;
  overview?: unknown;
  adherenceDays: number;
};
const createRawData = (): RawData => ({
  adherence: new Map(),
  events: new Map(),
  adherenceDays: 0,
});
let rawData = createRawData();
type CohortShape = {
  id: string;
  name: string;
  short: string;
  color: string;
  hatch: string;
};
type LegacyPatient = {
  id: string;
  deviceId?: string;
  cohort: CohortShape;
  doses: number[];
  rescue: number[];
  status: PatientRecord['status'];
  battery: number;
  lastSync: number;
  enrolled: number;
};
type LegacyAlert = {
  id: string;
  p: LegacyPatient;
  kind: string;
  sev: string;
  icon: string;
  text: string;
  mins: number;
  status: string;
  by: string | null;
};
type Boot = {
  page: string;
  patientId?: string;
  demoDataEnd: string;
  demoOffsetDays: number;
  demoNow: string;
  loadedResources: ResourceName[];
  historyDays: number;
  patients: LegacyPatient[];
  alerts: LegacyAlert[];
  db: {
    alerts: Record<string, unknown>;
    devs: Record<string, unknown>;
    audit: { msg: string; role: string; at: string }[];
    notes: {
      id: string;
      pt: string;
      role: string;
      cat: string;
      text: string;
      at: string;
    }[];
    reports: {
      id: string;
      tpl: string;
      cohort: string;
      range: number;
      at: string;
      status: string;
      snapshot?: Record<string, unknown>;
    }[];
    imports: {
      id: string;
      name: string;
      rows: number;
      status: string;
      at: string;
    }[];
  };
  integrations: unknown[];
  firmware: unknown[];
  overview: unknown;
  events: {
    patientId: string;
    type: string;
    occurredAt: string;
    hour?: number;
  }[];
};

export function demoDateWindow(demoDataEnd: string, days: number) {
  const end = new Date(`${demoDataEnd}T00:00:00.000Z`);
  const from = new Date(end.getTime() - (days - 1) * DAY_MS);
  const to = new Date(end.getTime() + DAY_MS - 1);
  return { from, to };
}

export function projectDemoTimestamp(
  value: string | undefined,
  shouldProject: boolean,
  demoOffsetDays: number,
  demoDataEnd: string,
) {
  if (!value || !shouldProject) return value;
  const time = new Date(value).getTime();
  const sourceEndExclusive =
    new Date(`${demoDataEnd}T00:00:00.000Z`).getTime() + DAY_MS;
  if (!Number.isFinite(time) || time >= sourceEndExclusive) return value;
  return new Date(time + demoOffsetDays * DAY_MS).toISOString();
}

const cohortData: Record<PatientRecord['cohort'], CohortShape> = {
  'asthma-adult': {
    id: 'asthma-a',
    name: 'Asthma, adult',
    short: 'Asthma adult',
    color: '#087BFF',
    hatch: 'h-blue',
  },
  'asthma-pediatric': {
    id: 'asthma-p',
    name: 'Asthma, pediatric',
    short: 'Asthma pediatric',
    color: '#B9DAFF',
    hatch: 'h-sky',
  },
  copd: {
    id: 'copd',
    name: 'COPD',
    short: 'COPD',
    color: '#111111',
    hatch: 'h-ink',
  },
};
const patientId = (value: { externalId: string } | string) =>
  typeof value === 'string' ? value : value.externalId;
const timestamp = (value?: string) =>
  value ? new Date(value).getTime() : Date.now();
const typeLabel = (value?: string) =>
  (
    ({
      'rescue-spike': 'Rescue use spike',
      'missed-doses': 'Missed doses',
      'low-adherence': 'Low adherence',
      'device-offline': 'Inhaler offline',
      'low-battery': 'Low battery',
    }) as Record<string, string>
  )[value || ''] ||
  (value || 'Alert')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const typeIcon = (label: string) =>
  /rescue/i.test(label)
    ? 'lungs'
    : /dose|adherence/i.test(label)
      ? 'pill'
      : 'inhaler';

export async function loadBoot(
  page: string,
  selectedPatient?: string,
): Promise<Boot> {
  const pageResources: Record<string, string[]> = {
    dashboard: ['patients', 'devices', 'alerts', 'adherence:60'],
    'overview-history': ['patients', 'adherence:42'],
    patients: ['patients', 'devices', 'alerts', 'adherence:30'],
    'patient-profile': [
      'patients',
      'devices',
      'alerts',
      'notes',
      'adherence:35',
    ],
    devices: ['patients', 'devices', 'adherence:30'],
    'medication-adherence': [
      'patients',
      'devices',
      'adherence:60',
      'events:30',
    ],
    'respiratory-analytics': [
      'patients',
      'devices',
      'adherence:84',
      'events:30',
    ],
    alerts: ['patients', 'devices', 'alerts', 'adherence:30'],
    'care-team': ['patients', 'devices', 'notes', 'adherence:30'],
    reports: [
      'patients',
      'devices',
      'adherence:90',
      'alerts',
      'notes',
      'reports',
    ],
    'data-management': ['imports', 'audit', 'integrations', 'firmware'],
  };
  const requested = pageResources[page] || pageResources.dashboard;
  const health = await cachedResource<HealthResponse>('health', async () => {
    const response = await fetch('/health', { cache: 'no-store' });
    if (!response.ok)
      throw new Error(`Backend health check failed (${response.status}).`);
    return (await response.json()) as HealthResponse;
  });
  if (!health.demoDataEnd)
    throw new Error('The backend did not provide the demo data period.');
  const demoNow = new Date();
  // Seeded timestamps are projected by whole UTC days, so compare them at midnight too.
  demoNow.setUTCHours(0, 0, 0, 0);
  const demoDataEndDate = new Date(`${health.demoDataEnd}T00:00:00.000Z`);
  const demoOffsetDays = Math.round(
    (demoNow.getTime() - demoDataEndDate.getTime()) / DAY_MS,
  );
  await Promise.all(
    requested.map(async (resource) => {
      const [name, daysText] = resource.split(':');
      const days = Number(daysText);
      const key = days ? `${name}:${days}` : name;
      // A cached longer window already contains every record this page needs.
      if (name === 'adherence' || name === 'events') {
        const covering = [...resourceCache.entries()].find(
          ([cachedKey, value]) =>
            cachedKey.startsWith(`${name}:`) &&
            Number(cachedKey.split(':')[1]) >= days &&
            value.expiresAt > Date.now(),
        );
        if (covering) {
          await covering[1].promise;
          return;
        }
      }
      await cachedResource(key, async () => {
        switch (name as ResourceName) {
          case 'patients':
            return (rawData.patients =
              await allPages<PatientRecord>('/patients'));
          case 'devices':
            return (rawData.devices = await allPages<DeviceRecord>('/devices'));
          case 'adherence': {
            const { from, to } = demoDateWindow(health.demoDataEnd, days);
            const rows = await allPages<AdherenceRecord>(
              `/adherence?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
              5000,
            );
            for (const row of rows) {
              const id = patientId(row.patient);
              rawData.adherence.set(
                `${id}:${String(row.date).slice(0, 10)}`,
                row,
              );
            }
            rawData.adherenceDays = Math.max(rawData.adherenceDays, days);
            return rows;
          }
          case 'alerts':
            return (rawData.alerts = await allPages<AlertRecord>('/alerts'));
          case 'notes':
            return (rawData.notes = await allPages<NoteRecord>('/notes'));
          case 'reports':
            return (rawData.reports = await allPages<ReportRecord>('/reports'));
          case 'imports':
            return (rawData.imports =
              await allPages<ImportRecord>('/data/imports'));
          case 'audit':
            return (rawData.audit = await allPages<AuditRecord>('/data/audit'));
          case 'integrations':
            return (rawData.integrations =
              (await api<{ items: unknown[] }>('/data/integrations')).items ||
              []);
          case 'firmware':
            return (rawData.firmware =
              (await api<{ items: unknown[] }>('/data/firmware')).items || []);
          case 'events': {
            const { from, to } = demoDateWindow(health.demoDataEnd, days);
            const rows = await allPages<EventRecord>(
              `/events?type=rescue-use&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
              5000,
            );
            for (const row of rows) {
              const id = patientId(row.patient);
              rawData.events.set(
                `${id}:${row.type}:${row.occurredAt}:${row.hour ?? ''}`,
                row,
              );
            }
            return rows;
          }
          case 'overview':
            return (rawData.overview = await api(
              '/analytics/overview?days=90',
            ));
        }
      });
    }),
  );
  const patientRows = rawData.patients || [];
  const deviceRows = rawData.devices || [];
  const adherenceRows = [...rawData.adherence.values()];
  const alertRows = rawData.alerts || [];
  const noteRows = rawData.notes || [];
  const reportRows = rawData.reports || [];
  const importsRows = rawData.imports || [];
  const auditRows = rawData.audit || [];
  const eventRows = [...rawData.events.values()];
  const resourceNames = new Set<ResourceName>(
    requested.map((resource) => resource.split(':')[0] as ResourceName),
  );
  if (resourceNames.has('adherence') || resourceNames.has('devices'))
    resourceNames.add('patients');
  const loadedResources = [...resourceNames];
  const today = demoNow;
  const deviceByPatient = new Map(
    deviceRows.map((device) => [patientId(device.patient), device]),
  );
  const adherenceByPatient = new Map<string, AdherenceRecord[]>();
  for (const record of adherenceRows) {
    const id = patientId(record.patient);
    const list = adherenceByPatient.get(id) || [];
    list.push(record);
    adherenceByPatient.set(id, list);
  }
  const patients: LegacyPatient[] = patientRows.map((patient) => {
    const device = deviceByPatient.get(patient.externalId);
    const daily = adherenceByPatient.get(patient.externalId) || [];
    const doses = Array(90).fill(Number.NaN) as number[];
    const rescue = Array(90).fill(Number.NaN) as number[];
    for (const record of daily) {
      const projectedDate = projectDemoTimestamp(
        record.date,
        record.synthetic === true,
        demoOffsetDays,
        health.demoDataEnd,
      );
      const date = new Date(projectedDate || record.date);
      const offset = Math.round(
        (today.getTime() -
          Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            date.getUTCDate(),
          )) /
          DAY_MS,
      );
      if (offset >= 0 && offset < 90) {
        doses[89 - offset] = record.taken;
        rescue[89 - offset] = record.rescueUses;
      }
    }
    const lastSyncAt = projectDemoTimestamp(
      device?.lastSyncAt || patient.lastSyncAt,
      patient.synthetic === true,
      demoOffsetDays,
      health.demoDataEnd,
    );
    return {
      id: patient.externalId,
      deviceId: device?.externalId,
      cohort: cohortData[patient.cohort],
      doses,
      rescue,
      status: device?.connectivity || patient.status,
      battery: device?.battery ?? patient.battery,
      lastSync: lastSyncAt
        ? Math.max(
            0,
            Math.floor((demoNow.getTime() - timestamp(lastSyncAt)) / 60000),
          )
        : Number.NaN,
      enrolled: patient.enrolledDaysAgo || 0,
    };
  });
  const byId = new Map(patients.map((patient) => [patient.id, patient]));
  const alerts: LegacyAlert[] = alertRows.flatMap((alert) => {
    const p = byId.get(patientId(alert.patient));
    if (!p) return [];
    const kind = typeLabel(alert.type);
    const createdAt = projectDemoTimestamp(
      alert.createdAt,
      alert.externalId.startsWith('AL-PT-'),
      demoOffsetDays,
      health.demoDataEnd,
    );
    return [
      {
        id: alert.externalId,
        p,
        kind,
        sev: alert.severity || 'low',
        icon: typeIcon(kind),
        text: alert.detail || 'Alert details are not available.',
        mins: Math.max(
          0,
          Math.round((demoNow.getTime() - timestamp(createdAt)) / 60000),
        ),
        status: alert.status || 'open',
        by: alert.assignedTo || alert.acknowledgedBy || null,
      },
    ];
  });
  const projectSeedDate = (value: string | undefined, isSeedRecord: boolean) =>
    projectDemoTimestamp(
      value,
      isSeedRecord,
      demoOffsetDays,
      health.demoDataEnd,
    );
  return {
    page,
    patientId: selectedPatient,
    demoDataEnd: health.demoDataEnd,
    demoOffsetDays,
    demoNow: demoNow.toISOString(),
    loadedResources,
    historyDays: rawData.adherenceDays,
    patients,
    alerts,
    events: eventRows.map((event) => ({
      patientId: patientId(event.patient),
      type: event.type,
      occurredAt:
        projectSeedDate(event.occurredAt, event.synthetic === true) ||
        event.occurredAt,
      hour: event.hour,
    })),
    db: {
      alerts: Object.fromEntries(
        alertRows.map((alert) => [
          alert.externalId,
          {
            status: alert.status,
            by: alert.assignedTo || alert.acknowledgedBy,
            at:
              alert.acknowledgedAt ||
              projectSeedDate(
                alert.createdAt,
                alert.externalId.startsWith('AL-PT-'),
              ) ||
              alert.createdAt,
          },
        ]),
      ),
      devs: {},
      audit: auditRows.map((row) => ({
        msg: row.action,
        role: row.role,
        at: row.createdAt,
      })),
      notes: noteRows.map((row) => ({
        id: row.externalId,
        pt: patientId(row.patient),
        role: row.role,
        cat: row.category,
        text: row.text,
        at:
          projectSeedDate(
            row.createdAt,
            ['N-101', 'N-102'].includes(row.externalId),
          ) || row.createdAt,
      })),
      reports: reportRows.map((row) => ({
        id: row.externalId,
        tpl: row.type,
        cohort: row.cohort,
        range: row.rangeDays,
        at:
          projectSeedDate(row.createdAt, row.snapshot?.synthetic === true) ||
          row.createdAt,
        status: row.status,
        snapshot: row.snapshot,
      })),
      imports: importsRows.map((row) => ({
        id: row.externalId,
        name: row.name,
        rows: row.rows,
        status: row.status,
        at:
          projectSeedDate(
            row.createdAt,
            row.externalId.startsWith('IM-seed-'),
          ) || row.createdAt,
      })),
    },
    integrations: rawData.integrations || [],
    firmware: rawData.firmware || [],
    overview: rawData.overview,
  };
}

export async function downloadCsv(path: string, filename: string) {
  const response = await fetch('/api/v1' + path, { cache: 'no-store' });
  if (!response.ok) {
    const error = new ApiError(
      `CSV export failed (${response.status}).`,
      response.status,
      response.status === 401 ? 'UNAUTHENTICATED' : undefined,
    );
    if (response.status === 401) window.__ADHERIUM_SHOW_ERROR__?.(error);
    throw error;
  }
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}
