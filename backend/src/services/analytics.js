const { Patient, AdherenceRecord, Device, Alert } = require('../models');

async function overview({ days = 7, cohort, referenceDate = new Date() } = {}) {
  const to = new Date(referenceDate);
  to.setUTCHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - days + 1);
  const match = { date: { $gte: from, $lte: to } };
  if (cohort) {
    const patients = await Patient.find({
      cohort: cohort === 'asthma' ? /^asthma/ : cohort,
    }).select('_id');
    match.patient = { $in: patients.map((patient) => patient._id) };
  }
  const [agg, devices, alerts] = await Promise.all([
    AdherenceRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          taken: { $sum: '$taken' },
          scheduled: { $sum: '$scheduled' },
          rescue: { $sum: '$rescueUses' },
          records: { $sum: 1 },
        },
      },
    ]),
    Device.aggregate([
      { $group: { _id: '$connectivity', count: { $sum: 1 } } },
    ]),
    Alert.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);
  const totals = agg[0] || { taken: 0, scheduled: 0, rescue: 0, records: 0 };
  return {
    periodDays: days,
    adherence: totals.scheduled ? totals.taken / totals.scheduled : 0,
    rescueUses: totals.rescue,
    doseRecords: totals.records,
    devices,
    alerts,
  };
}

module.exports = { overview };
