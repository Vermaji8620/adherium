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

router.post(
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

router.get(
  '/reports/:id',
  handler(async (req, res) => {
    const item = await Report.findOne({ externalId: req.params.id }).lean();
    if (!item) fail('Report was not found.');
    res.json({ item });
  }),
);

router.get(
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

router.delete(
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

module.exports = router;
