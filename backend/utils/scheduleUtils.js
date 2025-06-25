export function getNextRunDate(recurrence) {
  if (!recurrence || !recurrence.timeOfDay) {
    throw new Error("recurrence.timeOfDay is required");
  }
  const [hour, minute] = recurrence.timeOfDay.split(":").map(Number);
  const now = new Date();
  let next = new Date();

  next.setHours(hour, minute, 0, 0);

  if (recurrence.frequency === "daily") {
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (recurrence.frequency === "weekly") {
    const day = recurrence.dayOfWeek ?? 0;
    while (next.getDay() !== day || next <= now) {
      next.setDate(next.getDate() + 1);
    }
  } else if (recurrence.frequency === "monthly") {
    const day = recurrence.dayOfMonth ?? 1;
    next.setDate(day);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
  }

  return next;
}
