'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  allPages,
  ApiError,
  downloadCsv,
  loadBoot,
  type PatientRecord,
} from '@/lib/api';

declare global {
  interface Window {
    __ADHERIUM_BOOT__: Awaited<ReturnType<typeof loadBoot>>;
    __ADHERIUM_PATIENTS__?: Array<{
      id: string;
      deviceId?: string;
      status: string;
      battery: number;
      lastSync: number;
      doses: number[];
      rescue: number[];
    }>;
    __ADHERIUM_API__: typeof api;
    __ADHERIUM_DOWNLOAD__: (path: string, filename: string) => Promise<void>;
    PAGES?: Record<string, () => void>;
    __ADHERIUM_RENDER_AUDIT__?: () => void;
    __ADHERIUM_ROUTE_FOR_PAGE__: (page: string, patientId?: string) => string;
    __ADHERIUM_LOAD_PROFILE__: (id?: string) => Promise<void>;
    __ADHERIUM_REFRESH_AUDIT__?: () => void;
    __ADHERIUM_SHOW_ERROR__?: (error: unknown) => void;
    __ADHERIUM_PROFILE__?: {
      patientId: string;
      events: { type: string; occurredAt: string; hour?: number }[];
    };
    __ADHERIUM_APP_STARTED__?: boolean;
    __ADHERIUM_ENSURE_PAGE_DATA__?: (page: string) => Promise<void>;
    __ADHERIUM_REFRESH_OVERVIEW__?: () => void;
  }
}

const routes: Record<string, string> = {
  dashboard: '/overview',
  patients: '/patients',
  'patient-profile': '/patient-profile',
  devices: '/devices',
  'medication-adherence': '/medication-adherence',
  'respiratory-analytics': '/analytics',
  alerts: '/alerts',
  'care-team': '/care-team',
  reports: '/reports',
  'data-management': '/data-management',
};

function routeState(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length || parts[0] === 'overview') return { page: 'dashboard' };
  if (parts[0] === 'patients' && parts[1])
    return { page: 'patient-profile', patientId: decodeURIComponent(parts[1]) };
  if (parts[0] === 'patient-profile')
    return {
      page: 'patient-profile',
      patientId: parts[1] ? decodeURIComponent(parts[1]) : undefined,
    };
  const alias: Record<string, string> = {
    analytics: 'respiratory-analytics',
    dashboard: 'dashboard',
  };
  const page = alias[parts[0]] || parts[0];
  return { page: routes[page] ? page : 'dashboard' };
}

function addScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.body.appendChild(script);
  });
}

type Boot = Awaited<ReturnType<typeof loadBoot>>;

function replaceArray<T>(target: T[], source: T[]) {
  target.splice(0, target.length, ...source);
}

function mergeBootData(current: Boot, next: Boot) {
  const loaded = new Set(next.loadedResources);
  if (loaded.has('patients')) {
    const previous = new Map(
      current.patients.map((patient) => [patient.id, patient]),
    );
    const patients = next.patients.map((patient) => {
      const existing = previous.get(patient.id);
      if (!existing) return patient;
      Object.assign(existing, patient);
      return existing;
    });
    replaceArray(current.patients, patients);
    current.historyDays = next.historyDays;
  }
  if (loaded.has('alerts')) {
    replaceArray(current.alerts, next.alerts);
    current.db.alerts = next.db.alerts;
  }
  if (loaded.has('devices')) current.db.devs = next.db.devs;
  if (loaded.has('notes')) replaceArray(current.db.notes, next.db.notes);
  if (loaded.has('reports')) replaceArray(current.db.reports, next.db.reports);
  if (loaded.has('imports')) replaceArray(current.db.imports, next.db.imports);
  if (loaded.has('audit')) replaceArray(current.db.audit, next.db.audit);
  if (loaded.has('events')) replaceArray(current.events, next.events);
  if (loaded.has('integrations')) current.integrations = next.integrations;
  if (loaded.has('firmware')) current.firmware = next.firmware;
  if (loaded.has('overview')) current.overview = next.overview;
  if (next.patientId) current.patientId = next.patientId;
  current.loadedResources = [
    ...new Set([...current.loadedResources, ...next.loadedResources]),
  ];
}

export default function PrototypeExperience({
  markup,
  pathname,
}: {
  markup: string;
  pathname: string;
}) {
  const router = useRouter();
  const host = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || window.__ADHERIUM_APP_STARTED__) return;
    started.current = true;
    const root = host.current;
    if (!root) return;
    const route = routeState(pathname);
    root.style.visibility = 'visible';
    const work = root.querySelector<HTMLElement>('#work');
    const routeTitles: Record<string, string> = {
      dashboard: 'Overview',
      patients: 'Patient Monitoring',
      'patient-profile': 'Patient Health Profile',
      devices: 'Smart Inhaler Devices',
      'medication-adherence': 'Medication Adherence',
      'respiratory-analytics': 'Respiratory Analytics',
      alerts: 'Alerts & Follow-up',
      'care-team': 'Care Team Workspace',
      reports: 'Reports & Insights',
      'data-management': 'Data & Device Management',
    };
    if (work)
      work.innerHTML = `<section class="card" style="margin:20px;padding:24px"><h2>Loading ${routeTitles[route.page] || 'workspace'}</h2><p style="color:var(--muted);margin-top:8px">Fetching this screen’s data…</p></section>`;
    let activePage = route.page;
    const notifyError = (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        router.replace('/login?reason=unauthenticated');
        return;
      }
      const message =
        error instanceof Error
          ? error.message
          : 'The local API request failed.';
      const work = root.querySelector<HTMLElement>('#work');
      if (work)
        work.innerHTML = `<section class="card" style="margin:20px;padding:24px"><h2>Unable to load workspace data</h2><p style="color:var(--muted);margin-top:8px">${message.replaceAll('<', '&lt;')}</p><p style="color:var(--muted);margin-top:8px">Start the Adherium backend and check BACKEND_API_URL in client/.env.local.</p><button class="btn" onclick="location.reload()" style="margin-top:14px">Retry</button></section>`;
      root.style.visibility = 'visible';
    };
    window.__ADHERIUM_SHOW_ERROR__ = notifyError;

    void loadBoot(route.page, route.patientId)
      .then(async (boot) => {
        window.__ADHERIUM_BOOT__ = boot;
        window.__ADHERIUM_API__ = api;
        window.__ADHERIUM_DOWNLOAD__ = downloadCsv;
        window.__ADHERIUM_ENSURE_PAGE_DATA__ = async (page) => {
          activePage = page;
          const next = await loadBoot(
            page,
            page === 'patient-profile'
              ? window.__ADHERIUM_BOOT__.patientId
              : undefined,
          );
          mergeBootData(window.__ADHERIUM_BOOT__, next);
        };
        window.__ADHERIUM_ROUTE_FOR_PAGE__ = (page, patientId) => {
          if (page === 'patient-profile')
            return `/patient-profile/${encodeURIComponent(patientId || window.__ADHERIUM_BOOT__.patientId || boot.patientId || 'PT-001')}`;
          return routes[page] || '/overview';
        };
        window.__ADHERIUM_LOAD_PROFILE__ = async (
          id = boot.patientId || 'PT-001',
        ) => {
          const [profile, timeline] = await Promise.all([
            api<{
              patient: PatientRecord;
              device?: {
                connectivity: string;
                battery: number;
                lastSyncAt?: string;
              };
              adherence?: { date: string; taken: number; rescueUses: number }[];
            }>(`/patients/${encodeURIComponent(id)}`),
            allPages<{ type: string; occurredAt: string; hour?: number }>(
              `/patients/${encodeURIComponent(id)}/timeline?from=${encodeURIComponent(new Date(Date.now() - 30 * 86400000).toISOString())}`,
            ),
          ]);
          const patient = window.__ADHERIUM_PATIENTS__?.find(
            (item) => item.id === id,
          );
          if (patient) {
            const now = new Date();
            now.setUTCHours(0, 0, 0, 0);
            const dates = profile.adherence || [];
            for (const record of dates) {
              const day = new Date(
                `${String(record.date).slice(0, 10)}T00:00:00Z`,
              );
              const offset = Math.round(
                (now.getTime() - day.getTime()) / 86400000,
              );
              if (offset >= 0 && offset < patient.doses.length) {
                patient.doses[patient.doses.length - 1 - offset] = record.taken;
                patient.rescue[patient.rescue.length - 1 - offset] =
                  record.rescueUses;
              }
            }
            if (profile.device) {
              patient.status = profile.device.connectivity;
              patient.battery = profile.device.battery;
              patient.lastSync = profile.device.lastSyncAt
                ? Math.max(
                    0,
                    Math.floor(
                      (Date.now() -
                        new Date(profile.device.lastSyncAt).getTime()) /
                        60000,
                    ),
                  )
                : patient.lastSync;
            }
          }
          window.__ADHERIUM_PROFILE__ = { patientId: id, events: timeline };
          window.__ADHERIUM_BOOT__.patientId = id;
        };
        window.__ADHERIUM_REFRESH_AUDIT__ = () => {
          void allPages<{ action: string; role: string; createdAt: string }>(
            '/data/audit',
          )
            .then((rows) => {
              boot.db.audit = rows.map((row) => ({
                msg: row.action,
                role: row.role,
                at: row.createdAt,
              }));
              window.__ADHERIUM_RENDER_AUDIT__?.();
            })
            .catch(notifyError);
        };
        await addScript('/prototype/gsap.min.js');
        await addScript('/prototype/core.js');
        await addScript('/prototype/pages.js');
        window.__ADHERIUM_APP_STARTED__ = true;
        if (route.page === 'patient-profile') {
          await window.__ADHERIUM_LOAD_PROFILE__(route.patientId);
          window.PAGES?.['patient-profile']?.();
        }
        root.style.visibility = 'visible';
        if (route.page === 'dashboard') {
          void loadBoot('overview-history')
            .then((history) => {
              if (activePage !== 'dashboard') return;
              mergeBootData(boot, history);
              window.__ADHERIUM_REFRESH_OVERVIEW__?.();
            })
            .catch((error) =>
              console.error('Could not load Overview chart history.', error),
            );
        }
      })
      .catch(notifyError);
  }, [markup, pathname, router]);

  return <div ref={host} dangerouslySetInnerHTML={{ __html: markup }} />;
}
