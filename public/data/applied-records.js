import { REPLAY_CASES } from './replay-cases.js';
import { validatePositionPeriod } from './position-period.js';

export function createAppliedRecordLoader(fetchRecord = (...args) => fetch(...args)) {
  const requests = new Map();
  return async caseId => {
    const record = REPLAY_CASES.find(item => item.id === caseId);
    if (!record) throw new Error('Choose a bundled historical case.');
    if (!requests.has(caseId)) {
      const request = (async () => {
        let response;
        try { response = await fetchRecord(new URL('../examples/' + record.file, import.meta.url)); }
        catch { throw new Error('The recorded case could not be loaded. Check your connection, then try again.'); }
        if (!response.ok) throw new Error('The recorded case could not be loaded. Try again.');
        return validatePositionPeriod(await response.json());
      })();
      requests.set(caseId, request);
      request.catch(() => { if (requests.get(caseId) === request) requests.delete(caseId); });
    }
    return requests.get(caseId);
  };
}
