import { usd, signedUSD } from './format.js';

// Present feedback beside inputs; calculation models remain the source of validity.
export function labFeedback({ prefix, fields, limits, optional = [], range = false }) {
  const $ = id => document.getElementById(id);
  let hasFieldErrors = false;
  function validate(input) {
    const messages = {};
    for (const [key, id] of Object.entries(fields)) {
      const field = $(id), { min, max, label } = limits[key];
      const empty = !field.value.trim();
      messages[key] = field.validity.badInput ? 'Enter a valid number.'
        : empty && !optional.includes(key) ? 'Enter the ' + label.toLowerCase() + '.'
        : !Number.isFinite(input[key]) || input[key] < min || input[key] > max
          ? label + ' must be between ' + usd(min) + ' and ' + usd(max) + '.' : '';
    }
    if (range && !messages.lowerPrice && !messages.upperPrice && input.lowerPrice >= input.upperPrice) {
      messages.lowerPrice = 'Lower price must be below the upper price.';
      messages.upperPrice = 'Upper price must be above the lower price.';
    }
    for (const [key, id] of Object.entries(fields)) {
      $(id).setAttribute('aria-invalid', String(Boolean(messages[key])));
      $(id + '-error').textContent = messages[key];
      $(id + '-error').hidden = !messages[key];
    }
    hasFieldErrors = Object.values(messages).some(Boolean);
    $(prefix + '-error').classList.toggle('sr-only', hasFieldErrors);
    return Object.values(messages).find(Boolean) || '';
  }
  function result(value, state = '') {
    const tied = Math.abs(value.difference) < 0.005;
    $(prefix + '-quick-gap').textContent = tied ? 'Matches holding' : signedUSD(value.difference) + ' vs holding';
    $(prefix + '-quick-gap').className = tied || value.difference >= 0 ? 'gain' : 'loss';
    $(prefix + '-quick-values').textContent = 'LP ' + usd(value.lpValue) + ' · Holding ' + usd(value.holdValue);
    $(prefix + '-quick-note').textContent = (state ? state + ' · ' : '') + usd(value.fees) + ' assumed cash fees';
    $(prefix + '-show-results').disabled = false;
  }
  function invalid(message) {
    $(prefix + '-quick-gap').textContent = 'Check the inputs';
    $(prefix + '-quick-gap').className = 'muted';
    $(prefix + '-quick-values').textContent = 'No outcome calculated.';
    $(prefix + '-quick-note').textContent = 'Correct the message beside each highlighted field.';
    $(prefix + '-show-results').disabled = true;
    $(prefix + '-error').textContent = message;
  }
  $(prefix + '-show-results').addEventListener('click', () => {
    const target = $(prefix + '-results');
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  return { validate, result, invalid };
}
