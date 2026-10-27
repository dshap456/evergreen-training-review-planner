export const MAX_ENTRIES = 200;
export const STORAGE_KEY = 'evergreen-training-review-planner-v1';

export function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Enter a date in YYYY-MM-DD format.');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || year > 9999 || date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('Enter a valid date between 1900 and 9999.');
  }
  return date;
}

export function calculateReviewDate(start, interval, unit) {
  const date = parseDate(start);
  if (!Number.isInteger(interval) || interval < 1 || interval > 1200) {
    throw new Error('Choose a whole-number interval from 1 to 1200.');
  }
  if (!['days', 'months', 'years'].includes(unit)) {
    throw new Error('Choose days, months, or years.');
  }
  if (unit === 'days') {
    date.setUTCDate(date.getUTCDate() + interval);
  } else {
    const originalDay = date.getUTCDate();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + interval * (unit === 'years' ? 12 : 1));
    const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(originalDay, lastDay));
  }
  if (date.getUTCFullYear() > 9999) throw new Error('The review date must be no later than year 9999.');
  return date.toISOString().slice(0, 10);
}

export function validateEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid saved entry.');
  if (typeof entry.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(entry.id)) throw new Error('Invalid entry identifier.');
  if (typeof entry.label !== 'string' || !entry.label.trim() || entry.label.trim().length > 120 || /[\u0000-\u001f\u007f]/.test(entry.label)) {
    throw new Error('Use a task or role name of 1–120 characters, without line breaks.');
  }
  return {
    id: entry.id,
    label: entry.label.trim(),
    start: entry.start,
    interval: entry.interval,
    unit: entry.unit,
    review: calculateReviewDate(entry.start, entry.interval, entry.unit),
  };
}

export function readEntries(raw) {
  if (raw === null) return [];
  if (typeof raw !== 'string' || raw.length > 150000) throw new Error('Saved data is too large to load.');
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.entries) || value.entries.length > MAX_ENTRIES) {
    throw new Error('Saved data has an unsupported format.');
  }
  const entries = value.entries.map(validateEntry);
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length) throw new Error('Saved data has duplicate identifiers.');
  return entries;
}

export function csvCell(value) {
  let text = String(value);
  // Quote every cell and neutralize spreadsheet formula prefixes, even after whitespace.
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function exportCsv(entries) {
  const rows = [['Task or role', 'Starting date', 'Interval', 'Unit', 'Planned review date']];
  for (const entry of entries.map(validateEntry)) rows.push([entry.label, entry.start, entry.interval, entry.unit, entry.review]);
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
