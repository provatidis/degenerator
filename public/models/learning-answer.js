// Match the precision requested by the question and used by its displayed result.
// More precise answers may be equivalent; an adjacent incorrectly rounded answer is not.
export function learningAnswerMatches(answer, expected, digits, whole = false) {
  if (typeof answer !== 'string' || answer.trim() === '' || !Number.isFinite(Number(answer))) return false;
  const entered = Number(answer);
  if (whole && !Number.isInteger(entered)) return false;
  const formatter = new Intl.NumberFormat('en-US', { useGrouping: false, minimumFractionDigits: digits, maximumFractionDigits: digits });
  return Number(formatter.format(entered)) === Number(formatter.format(expected));
}
