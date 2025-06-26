// utils/scheduleUtils.js

function getNextRunDate(recurrence) {
  const now = new Date();
  const [hour, minute] = recurrence.timeOfDay.split(":").map(Number);

  const base = new Date(now);
  base.setHours(hour, minute, 0, 0);

  if (recurrence.frequency === "daily") {
    if (base <= now) base.setDate(base.getDate() + 1);
    return base;
  }

  if (recurrence.frequency === "weekly") {
    const day = recurrence.dayOfWeek;
    const diff = (day + 7 - base.getDay()) % 7;
    base.setDate(base.getDate() + (diff === 0 && base <= now ? 7 : diff));
    return base;
  }

  if (recurrence.frequency === "monthly") {
    base.setDate(recurrence.dayOfMonth);
    if (base <= now) {
      base.setMonth(base.getMonth() + 1);
    }
    return base;
  }

  throw new Error("Invalid recurrence frequency");
}

module.exports = { getNextRunDate };
