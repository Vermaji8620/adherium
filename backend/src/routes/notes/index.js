const { randomUUID } = require('node:crypto');
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

router.post(
  '/notes',
  handler(async (req, res) => {
    const b = objectBody(req.body),
      p = await patientById(b.patient);
    const item = await CareNote.create({
      externalId: `CN-${randomUUID()}`,
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

module.exports = router;
