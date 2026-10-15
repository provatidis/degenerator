import { MANAGEMENT_IDS } from '../models/range-decisions.js?v=1.15.2';
export function managementLessonFromHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/,'')), id=params.get('manage');
  return MANAGEMENT_IDS.includes(id) && params.getAll('manage').length===1 && [...params.keys()].every(key=>key==='manage') ? id : null;
}
