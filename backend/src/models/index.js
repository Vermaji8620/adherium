const mongoose = require('mongoose');
const { Schema } = mongoose;
const base = { timestamps: true };
const patientSchema = new Schema(
  {
    externalId: { type: String, required: true, unique: true },
    cohort: {
      type: String,
      enum: ['asthma-adult', 'asthma-pediatric', 'copd'],
      required: true,
    },
    status: {
      type: String,
      enum: ['connected', 'pending', 'offline'],
      required: true,
    },
    battery: { type: Number, min: 0, max: 100, required: true },
    lastSyncAt: Date,
    enrolledDaysAgo: Number,
    synthetic: { type: Boolean, default: true },
    profile: { ageBand: String, medication: String, clinicianNotes: String },
  },
  base,
);
patientSchema.index({ cohort: 1, status: 1 });
const deviceSchema = new Schema(
  {
    externalId: { type: String, required: true, unique: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    model: { type: String, default: 'Smart inhaler sensor' },
    connectivity: {
      type: String,
      enum: ['connected', 'pending', 'offline'],
      required: true,
    },
    battery: { type: Number, min: 0, max: 100, required: true },
    firmware: { type: String, required: true },
    lastSyncAt: Date,
    syncSimulation: String,
  },
  base,
);
deviceSchema.index({ connectivity: 1, battery: 1 });
const eventSchema = new Schema(
  {
    externalId: { type: String, unique: true, sparse: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    device: { type: Schema.Types.ObjectId, ref: 'Device' },
    type: {
      type: String,
      enum: ['controller-dose', 'rescue-use'],
      required: true,
    },
    occurredAt: { type: Date, required: true },
    hour: { type: Number, min: 0, max: 23 },
    synthetic: { type: Boolean, default: true },
  },
  base,
);
eventSchema.index({ patient: 1, occurredAt: -1 });
eventSchema.index({ type: 1, occurredAt: -1 });
const scheduleSchema = new Schema(
  {
    patient: {
      type: Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      unique: true,
    },
    medication: { type: String, default: 'Controller inhaler' },
    dosesPerDay: { type: Number, default: 2 },
    timing: { type: [String], default: ['AM', 'PM'] },
    effectiveFrom: Date,
  },
  base,
);
const adherenceSchema = new Schema(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    date: { type: Date, required: true },
    scheduled: { type: Number, default: 2 },
    taken: { type: Number, min: 0, max: 2, required: true },
    rescueUses: { type: Number, default: 0 },
    synthetic: { type: Boolean, default: true },
  },
  base,
);
adherenceSchema.index({ patient: 1, date: -1 }, { unique: true });
const alertSchema = new Schema(
  {
    externalId: { type: String, required: true, unique: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    type: String,
    severity: { type: String, enum: ['high', 'med', 'low'] },
    status: {
      type: String,
      enum: ['open', 'assigned', 'ack'],
      default: 'open',
    },
    detail: String,
    assignedTo: String,
    createdAt: Date,
    acknowledgedAt: Date,
    acknowledgedBy: String,
  },
  base,
);
alertSchema.index({ status: 1, severity: 1, createdAt: -1 });
const noteSchema = new Schema(
  {
    externalId: { type: String, unique: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    role: String,
    category: {
      type: String,
      enum: [
        'Follow-up call',
        'Medication review',
        'Device support',
        'Education',
      ],
    },
    text: { type: String, minlength: 4, maxlength: 4000 },
    author: String,
  },
  base,
);
noteSchema.index({ patient: 1, createdAt: -1 });
noteSchema.index({ role: 1, createdAt: -1 });
const reportSchema = new Schema(
  {
    externalId: { type: String, required: true, unique: true },
    type: {
      type: String,
      enum: ['weekly', 'devices', 'cohort', 'followup'],
      required: true,
    },
    cohort: { type: String, enum: ['all', 'asthma', 'copd'], default: 'all' },
    rangeDays: { type: Number, enum: [7, 14, 30], default: 7 },
    snapshot: Schema.Types.Mixed,
    status: { type: String, default: 'Ready' },
    createdAt: Date,
  },
  base,
);
const importSchema = new Schema(
  {
    externalId: { type: String, unique: true },
    name: String,
    rows: Number,
    status: String,
    issues: [Schema.Types.Mixed],
    createdAt: Date,
    source: { type: String, default: 'synthetic-demo' },
  },
  base,
);
const auditSchema = new Schema(
  {
    action: String,
    role: String,
    targetType: String,
    targetId: String,
    createdAt: Date,
    metadata: Schema.Types.Mixed,
  },
  base,
);
const integrationSchema = new Schema(
  {
    key: { type: String, unique: true },
    name: String,
    status: String,
    simulated: Boolean,
    details: String,
  },
  base,
);
const firmwareSchema = new Schema(
  {
    version: { type: String, unique: true },
    current: Boolean,
    deviceCount: Number,
  },
  base,
);
const firmwareJobSchema = new Schema(
  {
    externalId: { type: String, unique: true },
    versions: [String],
    status: String,
    simulated: { type: Boolean, default: true },
    scheduledAt: Date,
  },
  base,
);
function model(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}
module.exports = {
  Patient: model('Patient', patientSchema),
  Device: model('Device', deviceSchema),
  InhalerEvent: model('InhalerEvent', eventSchema),
  MedicationSchedule: model('MedicationSchedule', scheduleSchema),
  AdherenceRecord: model('AdherenceRecord', adherenceSchema),
  Alert: model('Alert', alertSchema),
  CareNote: model('CareNote', noteSchema),
  Report: model('Report', reportSchema),
  ImportHistory: model('ImportHistory', importSchema),
  AuditEvent: model('AuditEvent', auditSchema),
  IntegrationStatus: model('IntegrationStatus', integrationSchema),
  Firmware: model('Firmware', firmwareSchema),
  FirmwareJob: model('FirmwareJob', firmwareJobSchema),
};
