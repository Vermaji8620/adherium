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

router.get(
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

router.get(
  '/analytics/overview',
  handler(async (req, res) => {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 7));
    res.json(await analytics.overview({ days, cohort: req.query.cohort }));
  }),
);

module.exports = router;
