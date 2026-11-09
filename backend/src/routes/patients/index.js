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

router.post(
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

router.get(
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

router.patch(
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

router.get(
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

module.exports = router;
