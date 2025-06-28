/**
 * Calculate the next run date based on recurrence settings
 * @param {Object} recurrence - Recurrence configuration
 * @returns {Date} - Next run date
 */
function getNextRunDate(recurrence) {
  const now = new Date();
  const { type, hour = 9, minute = 0, timezone = "UTC" } = recurrence;

  // Create base date for next run
  let nextRun = new Date();

  // Set time
  nextRun.setHours(hour, minute, 0, 0);

  switch (type) {
    case "daily":
      // If time has passed today, schedule for tomorrow
      if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      break;

    case "weekly":
      const { dayOfWeek = 1 } = recurrence; // Monday = 1, Sunday = 0
      const currentDay = nextRun.getDay();
      let daysUntilTarget = dayOfWeek - currentDay;

      // If target day is today but time has passed, or target day is in the past
      if (daysUntilTarget < 0 || (daysUntilTarget === 0 && nextRun <= now)) {
        daysUntilTarget += 7; // Next week
      }

      nextRun.setDate(nextRun.getDate() + daysUntilTarget);
      break;

    case "monthly":
      const { dayOfMonth = 1 } = recurrence;

      // Set to target day of current month
      nextRun.setDate(dayOfMonth);

      // If date has passed this month, move to next month
      if (nextRun <= now) {
        nextRun.setMonth(nextRun.getMonth() + 1);
        nextRun.setDate(dayOfMonth);
      }

      // Handle edge case where dayOfMonth doesn't exist in target month
      if (nextRun.getDate() !== dayOfMonth) {
        // Move to last day of month if dayOfMonth is too high
        nextRun.setDate(0); // Last day of previous month
      }
      break;

    case "once":
      // For one-time schedules, use provided date or immediate
      if (recurrence.scheduledDate) {
        nextRun = new Date(recurrence.scheduledDate);
      } else {
        nextRun = new Date(now.getTime() + 60000); // 1 minute from now
      }
      break;

    default:
      throw new Error(`Unsupported recurrence type: ${type}`);
  }

  return nextRun;
}

/**
 * Get human-readable description of recurrence schedule
 * @param {Object} recurrence - Recurrence configuration
 * @returns {string} - Human-readable description
 */
function getRecurrenceDescription(recurrence) {
  const { type, hour = 9, minute = 0 } = recurrence;
  const timeStr = `${hour}:${minute.toString().padStart(2, "0")}`;

  switch (type) {
    case "daily":
      return `Daily at ${timeStr}`;

    case "weekly":
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const dayName = dayNames[recurrence.dayOfWeek || 1];
      return `Weekly on ${dayName} at ${timeStr}`;

    case "monthly":
      const dayOfMonth = recurrence.dayOfMonth || 1;
      const suffix = getDayOfMonthSuffix(dayOfMonth);
      return `Monthly on the ${dayOfMonth}${suffix} at ${timeStr}`;

    case "once":
      if (recurrence.scheduledDate) {
        return `Once on ${new Date(recurrence.scheduledDate).toLocaleString()}`;
      }
      return "Once (immediate)";

    default:
      return "Unknown schedule";
  }
}

/**
 * Get ordinal suffix for day of month (1st, 2nd, 3rd, etc.)
 * @param {number} day - Day of month
 * @returns {string} - Ordinal suffix
 */
function getDayOfMonthSuffix(day) {
  if (day >= 11 && day <= 13) {
    return "th";
  }
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/**
 * Check if a recurrence schedule is valid
 * @param {Object} recurrence - Recurrence configuration
 * @returns {Object} - Validation result
 */
function validateRecurrence(recurrence) {
  const { type, hour, minute, dayOfWeek, dayOfMonth } = recurrence;

  const errors = [];

  // Validate type
  if (!["daily", "weekly", "monthly", "once"].includes(type)) {
    errors.push("Invalid recurrence type");
  }

  // Validate time
  if (hour !== undefined && (hour < 0 || hour > 23)) {
    errors.push("Hour must be between 0 and 23");
  }
  if (minute !== undefined && (minute < 0 || minute > 59)) {
    errors.push("Minute must be between 0 and 59");
  }

  // Validate weekly settings
  if (type === "weekly" && dayOfWeek !== undefined) {
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      errors.push("Day of week must be between 0 (Sunday) and 6 (Saturday)");
    }
  }

  // Validate monthly settings
  if (type === "monthly" && dayOfMonth !== undefined) {
    if (dayOfMonth < 1 || dayOfMonth > 31) {
      errors.push("Day of month must be between 1 and 31");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

module.exports = {
  getNextRunDate,
  getRecurrenceDescription,
  validateRecurrence,
  getDayOfMonthSuffix,
};
