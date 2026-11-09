const mongoose = require('mongoose');
const { config } = require('../config');
const { connect } = require('../db');
const M = require('../models');
const { generate, TODAY, DAYS } = require('./generate');
const data = generate();
const counts = {
  Patient: data.length,
  Device: data.length,
  MedicationSchedule: data.length,
  AdherenceRecord: data.length * DAYS,
  InhalerEvent: data.reduce(
    (n, p) =>
      n +
      p.doses.reduce((a, b) => a + (b > 0 ? 1 : 0), 0) +
      p.rescue.filter((x) => x > 0).length,
    0,
  ),
  Alert: data.filter((p) => p.i % 19 === 0).length,
  CareNote: 2,
  Report: 4,
  ImportHistory: 4,
  IntegrationStatus: 3,
  Firmware: 3,
};
console.log(
  'Seed plan (insert-only upserts; existing rows are not overwritten):',
);
for (const [k, v] of Object.entries(counts))
  console.log(`  ${k}: ${v} planned`);
if (process.argv.includes('--dry-run')) process.exit(0);
if (!process.argv.includes('--apply')) {
  console.log('No records changed. Rerun with --apply to write this plan.');
  process.exit(0);
}
(async () => {
  try {
    await connect(config().mongoUri);
    const byName = {
      Patient: M.Patient,
      Device: M.Device,
      MedicationSchedule: M.MedicationSchedule,
      AdherenceRecord: M.AdherenceRecord,
      InhalerEvent: M.InhalerEvent,
      Alert: M.Alert,
      CareNote: M.CareNote,
      Report: M.Report,
      ImportHistory: M.ImportHistory,
      IntegrationStatus: M.IntegrationStatus,
      Firmware: M.Firmware,
    };
    console.log('Existing counts:');
    for (const [name, model] of Object.entries(byName))
      console.log(`  ${name}: ${await model.countDocuments()}`);
    const ops = (model, docs, key) =>
      model.bulkWrite(
        docs.map((d) => ({
          updateOne: {
            filter: { [key]: d[key] },
            update: { $setOnInsert: d },
            upsert: true,
          },
        })),
        { ordered: false },
      );
    const pdocs = data.map((p) => ({
      externalId: p.externalId,
      cohort: p.cohort,
      status: p.status,
      battery: p.battery,
      lastSyncAt: new Date(TODAY.getTime() - p.lastSyncMinutes * 60000),
      enrolledDaysAgo: p.enrolledDaysAgo,
      synthetic: true,
      profile: {
        ageBand: 'Not represented in source',
        medication: 'Controller inhaler',
      },
    }));
    await ops(M.Patient, pdocs, 'externalId');
    const idMap = new Map(
      (
        await M.Patient.find({
          externalId: { $in: data.map((p) => p.externalId) },
        })
      ).map((p) => [p.externalId, p]),
    );
    const devices = data.map((p) => ({
      externalId: `DEV-${p.externalId.slice(3)}`,
      patient: idMap.get(p.externalId)._id,
      connectivity: p.status,
      battery: p.battery,
      firmware: p.i % 7 === 0 ? '2.2.0' : p.i % 3 === 0 ? '2.3.8' : '2.4.1',
      lastSyncAt: new Date(TODAY.getTime() - p.lastSyncMinutes * 60000),
    }));
    await ops(M.Device, devices, 'externalId');
    await ops(
      M.MedicationSchedule,
      data.map((p) => ({
        patient: idMap.get(p.externalId)._id,
        medication: 'Controller inhaler',
        dosesPerDay: 2,
        timing: ['AM', 'PM'],
        effectiveFrom: new Date(TODAY.getTime() - p.enrolledDaysAgo * 86400000),
      })),
      'patient',
    );
    const adher = [],
      events = [];
    for (const p of data) {
      const patient = idMap.get(p.externalId);
      for (let d = 0; d < DAYS; d++) {
        const date = new Date(TODAY.getTime() - (DAYS - 1 - d) * 86400000),
          dateKey = date.toISOString().slice(0, 10);
        adher.push({
          patient: patient._id,
          date,
          scheduled: 2,
          taken: p.doses[d],
          rescueUses: p.rescue[d],
          synthetic: true,
        });
        if (p.doses[d])
          events.push({
            externalId: `EV-${p.i}-${dateKey}-controller`,
            patient: patient._id,
            type: 'controller-dose',
            occurredAt: new Date(date.getTime() + 12 * 3600000),
            hour: 12,
            synthetic: true,
          });
        if (p.rescue[d])
          events.push({
            externalId: `EV-${p.i}-${dateKey}-rescue`,
            patient: patient._id,
            type: 'rescue-use',
            occurredAt: new Date(date.getTime() + (d % 24) * 3600000),
            hour: d % 24,
            synthetic: true,
          });
      }
    }
    await M.AdherenceRecord.bulkWrite(
      adher.map((d) => ({
        updateOne: {
          filter: { patient: d.patient, date: d.date },
          update: { $setOnInsert: d },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    await ops(M.InhalerEvent, events, 'externalId');
    const alerts = [];
    for (const p of data.filter((x, i) => i % 19 === 0).slice(0, 14)) {
      const patient = idMap.get(p.externalId);
      alerts.push({
        externalId: `AL-${p.externalId}`,
        patient: patient._id,
        type:
          p.status === 'offline'
            ? 'Inhaler offline'
            : p.battery < 26
              ? 'Low battery'
              : 'Adherence below target',
        severity: p.status === 'offline' ? 'high' : 'med',
        status: 'open',
        detail: 'Synthetic demo alert',
        createdAt: new Date(TODAY.getTime() - p.i * 3600000),
      });
    }
    await ops(M.Alert, alerts, 'externalId');
    await ops(
      M.CareNote,
      [
        {
          externalId: 'N-101',
          patient: idMap.get('PT-001')._id,
          role: 'Healthcare Provider',
          category: 'Follow-up call',
          text: 'Synthetic demonstration follow-up note.',
          author: 'Synthetic demo operator',
        },
        {
          externalId: 'N-102',
          patient: idMap.get('PT-002')._id,
          role: 'Care Coordinator',
          category: 'Medication review',
          text: 'Synthetic demonstration medication review.',
          author: 'Synthetic demo operator',
        },
      ],
      'externalId',
    );
    await ops(
      M.Report,
      ['weekly', 'devices', 'cohort', 'followup'].map((type, i) => ({
        externalId: `RP-${String(13 + i).padStart(3, '0')}`,
        type,
        cohort: 'all',
        rangeDays: 7,
        snapshot: { synthetic: true, template: type },
        createdAt: new Date(TODAY.getTime() - i * 86400000),
      })),
      'externalId',
    );
    await ops(
      M.ImportHistory,
      [
        {
          externalId: 'IM-seed-1',
          name: 'data',
          rows: 248,
          status: 'Completed',
          createdAt: TODAY,
        },
        {
          externalId: 'IM-seed-2',
          name: 'tracts-26107',
          rows: 18,
          status: 'Failed',
          createdAt: TODAY,
        },
        {
          externalId: 'IM-seed-3',
          name: 'Enrollment batch, spring clinic',
          rows: 42,
          status: 'Completed',
          createdAt: new Date('2026-11-06'),
        },
        {
          externalId: 'IM-seed-4',
          name: 'Device assignment update',
          rows: 18,
          status: 'Completed with warnings',
          createdAt: new Date('2026-10-31'),
        },
      ],
      'externalId',
    );
    await ops(
      M.IntegrationStatus,
      [
        ['phone-relay', 'Phone app relay', 'active', true],
        ['cloud-ingestion', 'Cloud ingestion', 'active', true],
        ['ehr-export', 'EHR export', 'off', true],
      ].map(([key, name, status, simulated]) => ({
        key,
        name,
        status,
        simulated,
        details: 'Prototype display state; no external integration',
      })),
      'key',
    );
    await ops(
      M.Firmware,
      [
        ['2.4.1', true],
        ['2.3.8', false],
        ['2.2.0', false],
      ].map(([version, current]) => ({
        version,
        current,
        deviceCount: data.filter(
          (p) =>
            (p.i % 7 === 0 ? '2.2.0' : p.i % 3 === 0 ? '2.3.8' : '2.4.1') ===
            version,
        ).length,
      })),
      'version',
    );
    console.log('Seed completed.');
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
