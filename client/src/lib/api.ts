export type ApiEnvelope<T> = {
  items?: T[];
  item?: T;
  total?: number;
  page?: number;
  limit?: number;
};

export async function api<T>(
  path: string,
  init?: RequestInit & { body?: unknown },
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
    throw new Error(message);
  }
  return payload as T;
}

export async function allPages<T>(path: string): Promise<T[]> {
  const first = await api<ApiEnvelope<T>>(
    `${path}${path.includes('?') ? '&' : '?'}page=1&limit=100`,
  );
  const items = first.items || [];
  const total = first.total || items.length;
  const pageCount = Math.ceil(total / 100);
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
            `${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=100`,
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
};
type CohortShape = {
  id: string;
  name: string;
  short: string;
  color: string;
  hatch: string;
};
type LegacyPatient = {
  id: string;
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
  const health = await fetch('/health', { cache: 'no-store' });
  if (!health.ok)
    throw new Error(`Backend health check failed (${health.status}).`);
  const [
    patientRows,
    deviceRows,
    adherenceRows,
    alertRows,
    noteRows,
    reportRows,
    importsRows,
    auditRows,
    integrations,
    firmware,
    overview,
    eventRows,
  ] = await Promise.all([
    allPages<PatientRecord>('/patients'),
    allPages<DeviceRecord>('/devices'),
    allPages<AdherenceRecord>(
      `/adherence?from=${encodeURIComponent(new Date(Date.now() - 90 * 86400000).toISOString())}`,
    ),
    allPages<AlertRecord>('/alerts'),
    allPages<NoteRecord>('/notes'),
    allPages<ReportRecord>('/reports'),
    allPages<ImportRecord>('/data/imports'),
    allPages<AuditRecord>('/data/audit'),
    api<{ items: unknown[] }>('/data/integrations').then((x) => x.items || []),
    api<{ items: unknown[] }>('/data/firmware').then((x) => x.items || []),
    api('/analytics/overview?days=90'),
    allPages<EventRecord>(
      `/events?type=rescue-use&from=${encodeURIComponent(new Date(Date.now() - 90 * 86400000).toISOString())}`,
    ),
  ]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
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
      const key = String(record.date).slice(0, 10);
      const date = new Date(`${key}T00:00:00`);
      const offset = Math.round((today.getTime() - date.getTime()) / 86400000);
      if (offset >= 0 && offset < 90) {
        doses[89 - offset] = record.taken;
        rescue[89 - offset] = record.rescueUses;
      }
    }
    const lastSyncAt = device?.lastSyncAt || patient.lastSyncAt;
    return {
      id: patient.externalId,
      cohort: cohortData[patient.cohort],
      doses,
      rescue,
      status: device?.connectivity || patient.status,
      battery: device?.battery ?? patient.battery,
      lastSync: lastSyncAt
        ? Math.max(0, Math.floor((Date.now() - timestamp(lastSyncAt)) / 60000))
        : Number.NaN,
      enrolled: patient.enrolledDaysAgo || 0,
    };
  });
  const byId = new Map(patients.map((patient) => [patient.id, patient]));
  const alerts: LegacyAlert[] = alertRows.flatMap((alert) => {
    const p = byId.get(patientId(alert.patient));
    if (!p) return [];
    const kind = typeLabel(alert.type);
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
          Math.round((Date.now() - timestamp(alert.createdAt)) / 60000),
        ),
        status: alert.status || 'open',
        by: alert.assignedTo || alert.acknowledgedBy || null,
      },
    ];
  });
  const at = (value: string) => value;
  return {
    page,
    patientId: selectedPatient,
    patients,
    alerts,
    events: eventRows.map((event) => ({
      patientId: patientId(event.patient),
      type: event.type,
      occurredAt: event.occurredAt,
      hour: event.hour,
    })),
    db: {
      alerts: Object.fromEntries(
        alertRows.map((alert) => [
          alert.externalId,
          {
            status: alert.status,
            by: alert.assignedTo || alert.acknowledgedBy,
            at: alert.acknowledgedAt || alert.createdAt,
          },
        ]),
      ),
      devs: {},
      audit: auditRows.map((row) => ({
        msg: row.action,
        role: row.role,
        at: at(row.createdAt),
      })),
      notes: noteRows.map((row) => ({
        id: row.externalId,
        pt: patientId(row.patient),
        role: row.role,
        cat: row.category,
        text: row.text,
        at: row.createdAt,
      })),
      reports: reportRows.map((row) => ({
        id: row.externalId,
        tpl: row.type,
        cohort: row.cohort,
        range: row.rangeDays,
        at: row.createdAt,
        status: row.status,
        snapshot: row.snapshot,
      })),
      imports: importsRows.map((row) => ({
        id: row.externalId,
        name: row.name,
        rows: row.rows,
        status: row.status,
        at: row.createdAt,
      })),
    },
    integrations,
    firmware,
    overview,
  };
}

export async function downloadCsv(path: string, filename: string) {
  const response = await fetch('/api/v1' + path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`CSV export failed (${response.status}).`);
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}
