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

router.patch(
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

router.post(
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

module.exports = router;
