import { MAX_ENTRIES, STORAGE_KEY, calculateReviewDate, exportCsv, readEntries, validateEntry } from './core.mjs';

const form = document.querySelector('#planner');
const label = document.querySelector('#label');
const start = document.querySelector('#start');
const interval = document.querySelector('#interval');
const unit = document.querySelector('#unit');
const status = document.querySelector('#status');
const exportButton = document.querySelector('#export');
let entries = [];
let storageFailed = false;

// The popup and full-page options view use exactly the same tool and data.
if (location.protocol === 'chrome-extension:' && new URLSearchParams(location.search).has('popup')) {
  document.body.classList.add('extension-popup');
}

function message(text, error = false) {
  status.textContent = text;
  status.classList.toggle('error', error);
}

function load() {
  try {
    entries = readEntries(localStorage.getItem(STORAGE_KEY));
    storageFailed = false;
    return true;
  } catch {
    storageFailed = true;
    message('Saved data could not be read. It has not been changed. Try reopening this page; use Clear saved plan only if you want to discard it.', true);
    return false;
  }
}

function save(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries: next }));
    entries = next;
    storageFailed = false;
    render();
    return true;
  } catch {
    message('This browser could not save the change. Your form is still here. Check available storage and browser privacy settings.', true);
    return false;
  }
}

function render() {
  const body = document.querySelector('#entries');
  body.replaceChildren();
  const sorted = [...entries].sort((a, b) => a.review.localeCompare(b.review) || a.label.localeCompare(b.label));
  for (const entry of sorted) {
    const row = document.createElement('tr');
    for (const value of [entry.label, entry.start, `${entry.interval} ${entry.interval === 1 ? entry.unit.slice(0, -1) : entry.unit}`, entry.review]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    row.children[3].className = 'review-date';
    const actions = document.createElement('td');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'secondary';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${entry.label}, review ${entry.review}`);
    remove.addEventListener('click', () => {
      if (!load()) return;
      if (save(entries.filter((item) => item.id !== entry.id))) {
        message(`Removed ${entry.label}.`);
        label.focus();
      }
    });
    actions.append(remove);
    row.append(actions);
    body.append(row);
  }
  document.querySelector('#empty').hidden = entries.length > 0 || storageFailed;
  document.querySelector('#table-wrap').hidden = entries.length === 0;
  exportButton.disabled = entries.length === 0 || storageFailed;
}

function preview() {
  const output = document.querySelector('#preview');
  try {
    output.textContent = `Planned review: ${calculateReviewDate(start.value, Number(interval.value), unit.value)}`;
  } catch {
    output.textContent = '';
  }
}

form.addEventListener('input', (event) => {
  event.target.removeAttribute('aria-invalid');
  preview();
});
form.addEventListener('change', preview);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  for (const field of [label, start, interval, unit]) field.removeAttribute('aria-invalid');
  if (!form.checkValidity()) {
    const invalid = form.querySelector(':invalid');
    invalid.setAttribute('aria-invalid', 'true');
    invalid.focus();
    message('Enter a task or role, a valid date, and a whole-number interval from 1 to 1200.', true);
    return;
  }
  let entry;
  try {
    entry = validateEntry({ id: crypto.randomUUID(), label: label.value, start: start.value, interval: Number(interval.value), unit: unit.value });
  } catch (error) {
    message(error.message, true);
    label.focus();
    return;
  }
  if (!load()) return;
  if (entries.length >= MAX_ENTRIES) {
    message(`This planner holds up to ${MAX_ENTRIES} entries. Export your plan and remove an old entry before adding another.`, true);
    return;
  }
  if (save([...entries, entry])) {
    message(`Saved ${entry.label}. Planned review: ${entry.review}.`);
    label.value = '';
    label.focus();
  }
});

exportButton.addEventListener('click', () => {
  if (!load()) return;
  const url = URL.createObjectURL(new Blob(['\uFEFF', exportCsv(entries)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'training-review-plan.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  message('CSV export requested. Keep exported files private and check dates before use.');
});

document.querySelector('#reset').addEventListener('click', () => {
  if (!window.confirm('Delete this browser’s saved plan? Export a copy first if you need it. This cannot be undone.')) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    entries = [];
    storageFailed = false;
    render();
    message('Saved plan cleared.');
    label.focus();
  } catch {
    message('The browser could not clear the plan. Check browser privacy settings.', true);
  }
});
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) {
    if (load()) message('Plan updated from another open tab.');
    render();
  }
});
load();
render();
