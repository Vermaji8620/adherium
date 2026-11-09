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
} = require('../models');
const {
  objectBody,
  boundedString,
  pageQuery,
  dates,
  fail,
} = require('../validation');
const analytics = require('../services/analytics');
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

module.exports = {
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
};
