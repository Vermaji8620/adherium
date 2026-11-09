const TODAY = new Date('2026-11-09T00:00:00.000Z'),
  DAYS = 90;
function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
function generate() {
  const R = rng(20260611),
    fx = Array.from({ length: DAYS }, () => (R() - 0.5) * 0.2),
    patients = [];
  for (let i = 1; i <= 248; i++) {
    const r = R(),
      cohort =
        r < 0.46 ? 'asthma-adult' : r < 0.68 ? 'asthma-pediatric' : 'copd',
      base = Math.max(
        0.3,
        Math.min(0.99, 0.68 + R() * 0.32 - (cohort === 'copd' ? 0.06 : 0)),
      ),
      drift = (R() - 0.25) * 0.14,
      doses = [],
      rescue = [];
    for (let d = 0; d < DAYS; d++) {
      const p = Math.max(
        0.05,
        Math.min(
          0.995,
          base + drift * (d / DAYS) + fx[d] * (cohort === 'copd' ? 0.7 : 1),
        ),
      );
      doses.push((R() < p ? 1 : 0) + (R() < p ? 1 : 0));
      const lam = (cohort === 'copd' ? 0.55 : 0.3) * (1.4 - base);
      rescue.push(
        R() < lam ? 1 + (R() < 0.3 ? 1 : 0) + (R() < 0.08 ? 2 : 0) : 0,
      );
    }
    const s = R(),
      status = s < 0.855 ? 'connected' : s < 0.94 ? 'pending' : 'offline',
      battery = Math.round(20 + R() * 80),
      lastSyncMinutes =
        status === 'connected'
          ? Math.round(R() * 50)
          : status === 'pending'
            ? Math.round(60 * (6 + R() * 30))
            : Math.round(60 * (72 + R() * 120));
    patients.push({
      i,
      externalId: `PT-${String(i).padStart(3, '0')}`,
      cohort,
      status,
      battery,
      lastSyncMinutes,
      doses,
      rescue,
      enrolledDaysAgo: Math.round(R() * 400),
    });
  }
  return patients;
}
module.exports = { generate, TODAY, DAYS };
