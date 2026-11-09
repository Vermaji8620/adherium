const {
  express,
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
  objectBody,
  boundedString,
  pageQuery,
  dates,
  fail,
  analytics,
  handler,
  patientById,
  audit,
} = require('../shared');
const router = express.Router();

router.get(
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

router.post(
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

router.get(
  '/data/integrations',
  handler(async (req, res) =>
    res.json({ items: await IntegrationStatus.find().lean(), simulated: true }),
  ),
);

router.get(
  '/data/firmware',
  handler(async (req, res) =>
    res.json({ items: await Firmware.find().sort({ version: -1 }).lean() }),
  ),
);

router.post(
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

router.get(
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

module.exports = router;
