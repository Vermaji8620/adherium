const express = require('express');
const {
  Patient,
  Device,
  InhalerEvent,
  MedicationSchedule,
  AdherenceRecord,
  Alert,
  CareNote,
  Report,
  ImportHistory,
  AuditEvent,
  IntegrationStatus,
  Firmware,
  FirmwareJob,
} = require('./models');
const {
  objectBody,
  boundedString,
  pageQuery,
  dates,
  fail,
} = require('./validation');
const analytics = require('./services/analytics');
const api = express.Router();
const paged = async (q, filter, sort = { createdAt: -1 }, populate = null) => {
  const { page, limit, skip } = pageQuery(q);
  let query = q.model.find(filter).sort(sort).skip(skip).limit(limit);
  if (populate) query = query.populate(populate);
  const [items, total] = await Promise.all([
    query.lean(),
    q.model.countDocuments(filter),
  ]);
  return { items, page, limit, total };
};
const handler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);
const patientById = async (id) => {
  const p = await Patient.findOne({ externalId: id }).lean();
  if (!p) fail('Patient was not found.');
  return p;
};
const audit = async (
  action,
  role = 'Healthcare Provider',
  targetType = '',
  targetId = '',
  metadata = {},
) =>
  AuditEvent.create({
    action,
    role,
    targetType,
    targetId,
    metadata,
    createdAt: new Date(),
  });
api.get(
  '/patients',
  handler(async (req, res) => {
    const { page, limit, skip } = pageQuery(req.query),
      filter = {};
    if (req.query.cohort) filter.cohort = req.query.cohort;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.q)
      filter.externalId = {
        $regex: req.query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      };
    const sort = {
      [req.query.sort || 'externalId']: req.query.order === 'desc' ? -1 : 1,
    };
    const [items, total] = await Promise.all([
      Patient.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      Patient.countDocuments(filter),
    ]);
    res.json({ items, page, limit, total });
  }),
);
api.post(
  '/patients',
  handler(async (req, res) => {
    const b = objectBody(req.body);
    const p = await Patient.create({
      externalId: boundedString(b.externalId, 'externalId', 3, 32),
      cohort: b.cohort,
      status: b.status || 'offline',
      battery: b.battery ?? 100,
      profile: b.profile,
    });
    res.status(201).json({ item: p });
  }),
);
api.get(
  '/patients/:id',
  handler(async (req, res) => {
    const patient = await patientById(req.params.id);
    const [device, schedule, adherence, alerts, notes] = await Promise.all([
      Device.findOne({ patient: patient._id }).lean(),
      MedicationSchedule.findOne({ patient: patient._id }).lean(),
      AdherenceRecord.find({ patient: patient._id })
        .sort({ date: -1 })
        .limit(30)
        .lean(),
      Alert.find({ patient: patient._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      CareNote.find({ patient: patient._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);
    res.json({ patient, device, schedule, adherence, alerts, notes });
  }),
);
api.patch(
  '/patients/:id',
  handler(async (req, res) => {
    objectBody(req.body);
    const p = await Patient.findOneAndUpdate(
      { externalId: req.params.id },
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!p) fail('Patient was not found.');
    await audit('Updated patient', undefined, 'patient', req.params.id);
    res.json({ item: p });
  }),
);
api.get(
  '/patients/:id/timeline',
  handler(async (req, res) => {
    const p = await patientById(req.params.id),
      { page, limit, skip } = pageQuery(req.query),
      filter = {
        patient: p._id,
        ...(Object.keys(dates(req.query)).length
          ? { occurredAt: dates(req.query) }
          : {}),
      };
    const [items, total] = await Promise.all([
      InhalerEvent.find(filter)
        .sort({ occurredAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InhalerEvent.countDocuments(filter),
    ]);
    res.json({ items, page, limit, total });
  }),
);
api.get(
  '/devices',
  handler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.connectivity = req.query.status;
    if (req.query.lowBattery === 'true') filter.battery = { $lt: 26 };
    const { page, limit, skip } = pageQuery(req.query);
    const [items, total] = await Promise.all([
      Device.find(filter)
        .populate('patient', 'externalId cohort')
        .sort({ lastSyncAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Device.countDocuments(filter),
    ]);
    res.json({ items, page, limit, total });
  }),
);
api.get(
  '/devices/:id',
  handler(async (req, res) => {
    const item = await Device.findOne({ externalId: req.params.id })
      .populate('patient', 'externalId cohort')
      .lean();
    if (!item) fail('Device was not found.');
    res.json({ item });
  }),
);
api.patch(
  '/devices/:id',
  handler(async (req, res) => {
    objectBody(req.body);
    const item = await Device.findOneAndUpdate(
      { externalId: req.params.id },
      { $set: req.body },
      { new: true, runValidators: true },
    );
    if (!item) fail('Device was not found.');
    await audit('Updated device', undefined, 'device', req.params.id);
    res.json({ item });
  }),
);
api.post(
  '/devices/:id/sync',
  handler(async (req, res) => {
    const item = await Device.findOne({ externalId: req.params.id });
    if (!item) fail('Device was not found.');
    item.syncSimulation = 'requested';
    await item.save();
    await audit(
      'Requested simulated device sync',
      undefined,
      'device',
      req.params.id,
    );
    res.json({
      simulated: true,
      message: 'Sync request recorded locally; no inhaler was contacted.',
      item,
    });
  }),
);
api.post(
  '/devices/sync',
  handler(async (req, res) => {
    const result = await Device.updateMany(
      { connectivity: { $ne: 'connected' } },
      { $set: { syncSimulation: 'requested' } },
    );
    await audit('Requested simulated fleet sync');
    res.json({
      simulated: true,
      requested: result.modifiedCount,
      message: 'No inhalers were contacted.',
    });
  }),
);
api.get(
  '/events',
  handler(async (req, res) => {
    const filter = {},
      d = dates(req.query);
    if (req.query.patient) {
      const p = await patientById(req.query.patient);
      filter.patient = p._id;
    }
    if (req.query.type) filter.type = req.query.type;
    if (Object.keys(d).length) filter.occurredAt = d;
    const { page, limit, skip } = pageQuery(req.query);
    const [items, total] = await Promise.all([
      InhalerEvent.find(filter)
        .populate('patient', 'externalId cohort')
        .sort({ occurredAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InhalerEvent.countDocuments(filter),
    ]);
    res.json({ items, page, limit, total });
  }),
);
api.get(
  '/adherence',
  handler(async (req, res) => {
    const filter = {},
      d = dates(req.query);
    if (req.query.patient) {
      const p = await patientById(req.query.patient);
      filter.patient = p._id;
    }
    if (Object.keys(d).length) filter.date = d;
    if (req.query.cohort) {
      const ps = await Patient.find({ cohort: req.query.cohort }).select('_id');
      filter.patient = { $in: ps.map((x) => x._id) };
    }
    const { page, limit, skip } = pageQuery(req.query);
    const [items, total] = await Promise.all([
      AdherenceRecord.find(filter)
        .populate('patient', 'externalId cohort')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AdherenceRecord.countDocuments(filter),
    ]);
    res.json({ items, page, limit, total });
  }),
);
api.get(
  '/analytics/overview',
  handler(async (req, res) => {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    res.json(await analytics.overview({ days, cohort: req.query.cohort }));
  }),
);
api.get(
  '/alerts',
  handler(async (req, res) => {
    const filter = {};
    for (const k of ['status', 'severity', 'type'])
      if (req.query[k]) filter[k] = req.query[k];
    if (req.query.patient) {
      const p = await patientById(req.query.patient);
      filter.patient = p._id;
    }
    if (req.query.from || req.query.to) filter.createdAt = dates(req.query);
    const { page, limit, skip } = pageQuery(req.query);
    const [items, total] = await Promise.all([
      Alert.find(filter)
        .populate('patient', 'externalId cohort')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Alert.countDocuments(filter),
    ]);
    res.json({ items, page, limit, total });
  }),
);
api.patch(
  '/alerts/:id',
  handler(async (req, res) => {
    const b = objectBody(req.body),
      update = {};
    if (b.status && !['open', 'assigned', 'ack'].includes(b.status))
      fail('status must be open, assigned, or ack.');
    for (const k of ['status', 'assignedTo'])
      if (b[k] !== undefined) update[k] = b[k];
    if (b.status === 'ack') {
      update.acknowledgedAt = new Date();
      update.acknowledgedBy = b.acknowledgedBy || 'Healthcare Provider';
    }
    if (b.status === 'open') {
      update.acknowledgedAt = null;
      update.acknowledgedBy = null;
    }
    const a = await Alert.findOneAndUpdate(
      { externalId: req.params.id },
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!a) fail('Alert was not found.');
    await audit(
      `Alert ${b.status || 'updated'}`,
      b.role || 'Healthcare Provider',
      'alert',
      req.params.id,
    );
    res.json({ item: a });
  }),
);
api.post(
  '/alerts/:id/acknowledge',
  handler(async (req, res) => {
    req.body = req.body || {};
    req.body.status = 'ack';
    const a = await Alert.findOneAndUpdate(
      { externalId: req.params.id },
      {
        $set: {
          status: 'ack',
          acknowledgedAt: new Date(),
          acknowledgedBy: req.body.role || 'Healthcare Provider',
        },
      },
      { new: true },
    );
    if (!a) fail('Alert was not found.');
    await audit('Acknowledged alert', req.body.role, 'alert', req.params.id);
    res.json({ item: a });
  }),
);
api.get(
  '/notes',
  handler(async (req, res) => {
    const filter = {};
    if (req.query.patient) {
      const p = await patientById(req.query.patient);
      filter.patient = p._id;
    }
    if (req.query.role) filter.role = req.query.role;
    if (req.query.category) filter.category = req.query.category;
    const { page, limit, skip } = pageQuery(req.query);
    const [items, total] = await Promise.all([
      CareNote.find(filter)
        .populate('patient', 'externalId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CareNote.countDocuments(filter),
    ]);
    res.json({ items, page, limit, total });
  }),
);
api.post(
  '/notes',
  handler(async (req, res) => {
    const b = objectBody(req.body),
      p = await patientById(b.patient);
    const item = await CareNote.create({
      patient: p._id,
      role: boundedString(b.role || 'Healthcare Provider', 'role', 1, 100),
      category: b.category,
      text: boundedString(b.text, 'text', 4),
      author: b.author || 'Synthetic demo operator',
    });
    await audit('Added care note', item.role, 'patient', b.patient);
    res.status(201).json({ item });
  }),
);
api.get(
  '/reports',
  handler(async (req, res) => {
    const { page, limit, skip } = pageQuery(req.query);
    const [items, total] = await Promise.all([
      Report.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Report.countDocuments(),
    ]);
    res.json({ items, page, limit, total });
  }),
);
api.post(
  '/reports',
  handler(async (req, res) => {
    const b = objectBody(req.body);
    if (!['weekly', 'devices', 'cohort', 'followup'].includes(b.type))
      fail('type must be weekly, devices, cohort, or followup.');
    const days = Number(b.rangeDays || 7);
    if (![7, 14, 30].includes(days)) fail('rangeDays must be 7, 14, or 30.');
    const cohort = b.cohort || 'all';
    const patientFilter =
      cohort === 'all'
        ? {}
        : cohort === 'asthma'
          ? { cohort: /^asthma/ }
          : { cohort: 'copd' };
    const ps = await Patient.find(patientFilter).select(
      '_id externalId cohort status battery',
    );
    const pids = ps.map((p) => p._id),
      from = new Date(Date.now() - days * 864e5);
    const [a, d, alerts, notes] = await Promise.all([
      AdherenceRecord.aggregate([
        { $match: { patient: { $in: pids }, date: { $gte: from } } },
        {
          $group: {
            _id: null,
            taken: { $sum: '$taken' },
            scheduled: { $sum: '$scheduled' },
            rescue: { $sum: '$rescueUses' },
          },
        },
      ]),
      Device.aggregate([
        { $match: { patient: { $in: pids } } },
        { $group: { _id: '$connectivity', count: { $sum: 1 } } },
      ]),
      Alert.countDocuments({ patient: { $in: pids } }),
      CareNote.countDocuments({ patient: { $in: pids } }),
    ]);
    const stats = {
      patients: ps.length,
      adherence: a[0]?.scheduled ? a[0].taken / a[0].scheduled : 0,
      rescueUses: a[0]?.rescue || 0,
      devices: d,
      alerts,
      notes,
      generatedFrom: 'stored synthetic records',
    };
    const item = await Report.create({
      externalId: `RP-${Date.now()}`,
      type: b.type,
      cohort,
      rangeDays: days,
      snapshot: stats,
      createdAt: new Date(),
    });
    await audit(
      `Generated ${b.type} report`,
      'Healthcare Provider',
      'report',
      item.externalId,
    );
    res.status(201).json({ item });
  }),
);
api.get(
  '/reports/:id',
  handler(async (req, res) => {
    const item = await Report.findOne({ externalId: req.params.id }).lean();
    if (!item) fail('Report was not found.');
    res.json({ item });
  }),
);
api.get(
  '/reports/:id/export.csv',
  handler(async (req, res) => {
    const r = await Report.findOne({ externalId: req.params.id }).lean();
    if (!r) fail('Report was not found.');
    const rows = [['measure', 'value'], ...Object.entries(r.snapshot || {})];
    const csv = rows
      .map((row) =>
        row.map((v) => `"${String(v ?? '').replaceAll('"', '""')}"`).join(','),
      )
      .join('\r\n');
    res.type('text/csv').attachment(`${r.externalId}.csv`).send(csv);
  }),
);
api.delete(
  '/reports/:id',
  handler(async (req, res) => {
    const x = await Report.findOneAndDelete({ externalId: req.params.id });
    if (!x) fail('Report was not found.');
    await audit(
      'Deleted report',
      'Healthcare Provider',
      'report',
      req.params.id,
    );
    res.json({ deleted: true });
  }),
);
api.get(
  '/data/imports',
  handler(async (req, res) => {
    const { page, limit, skip } = pageQuery(req.query);
    const [items, total] = await Promise.all([
      ImportHistory.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ImportHistory.countDocuments(),
    ]);
    res.json({ items, page, limit, total });
  }),
);
api.post(
  '/data/imports/validate',
  handler(async (req, res) => {
    const b = objectBody(req.body),
      name = boundedString(b.name || 'upload.csv', 'name', 1, 255),
      text = boundedString(b.csv, 'csv', 1, 1000000);
    const lines = text
        .replace(/\r/g, '')
        .split('\n')
        .filter((x) => x.trim()),
      headers = lines
        .shift()
        .toLowerCase()
        .split(',')
        .map((x) => x.trim()),
      pi = headers.indexOf('patient_id'),
      ci = headers.indexOf('cohort'),
      issues = [];
    if (pi < 0 || ci < 0)
      issues.push({
        row: 1,
        code: 'MISSING_COLUMN',
        message: 'CSV requires patient_id and cohort columns.',
      });
    const seen = new Set();
    if (pi >= 0 && ci >= 0)
      lines.forEach((line, i) => {
        const c = line.split(','),
          id = (c[pi] || '').trim().toUpperCase(),
          co = (c[ci] || '').trim();
        if (!/^PT-\d{3,}$/.test(id))
          issues.push({ row: i + 2, code: 'INVALID_PATIENT_ID' });
        if (seen.has(id))
          issues.push({ row: i + 2, code: 'DUPLICATE_PATIENT_ID' });
        seen.add(id);
        if (!/^(asthma|copd)/i.test(co))
          issues.push({ row: i + 2, code: 'INVALID_COHORT' });
      });
    const item = await ImportHistory.create({
      externalId: `IM-${Date.now()}`,
      name,
      rows: lines.length,
      status: issues.length ? 'Completed with warnings' : 'Completed',
      issues,
      createdAt: new Date(),
    });
    await audit(
      'Validated enrollment import',
      undefined,
      'import',
      item.externalId,
    );
    res.status(201).json({
      item,
      validRows: Math.max(0, lines.length - issues.length),
      issues,
    });
  }),
);
api.get(
  '/data/integrations',
  handler(async (req, res) =>
    res.json({ items: await IntegrationStatus.find().lean(), simulated: true }),
  ),
);
api.get(
  '/data/firmware',
  handler(async (req, res) =>
    res.json({ items: await Firmware.find().sort({ version: -1 }).lean() }),
  ),
);
api.post(
  '/data/firmware/schedule',
  handler(async (req, res) => {
    const versions = (
      await Firmware.find({ current: false }).select('version')
    ).map((x) => x.version);
    const item = await FirmwareJob.create({
      externalId: `FW-${Date.now()}`,
      versions,
      status: 'scheduled-simulated',
      simulated: true,
      scheduledAt: new Date(),
    });
    await audit('Scheduled simulated firmware update');
    res.status(201).json({
      simulated: true,
      item,
      message: 'Scheduled locally; no device will be updated.',
    });
  }),
);
api.get(
  '/data/audit',
  handler(async (req, res) => {
    const { page, limit, skip } = pageQuery(req.query);
    const [items, total] = await Promise.all([
      AuditEvent.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditEvent.countDocuments(),
    ]);
    res.json({ items, page, limit, total });
  }),
);
module.exports = { api };
