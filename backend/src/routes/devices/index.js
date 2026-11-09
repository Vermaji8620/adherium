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

router.get(
  '/devices/:id',
  handler(async (req, res) => {
    const item = await Device.findOne({ externalId: req.params.id })
      .populate('patient', 'externalId cohort')
      .lean();
    if (!item) fail('Device was not found.');
    res.json({ item });
  }),
);

router.patch(
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

router.post(
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

router.post(
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

module.exports = router;
