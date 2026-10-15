import { periodPointView, periodIntervalView, periodMilestones } from './period-presentation.js';
import { learningAnswerMatches } from '../models/learning-answer.js?v=1.15.1';

export const APPLIED_IDS = Object.freeze(['fees-over-time', 'between-samples', 'period-vs-holding']);
export function appliedLessonFromHash(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const id = params.get('applied');
  return APPLIED_IDS.includes(id) && params.getAll('applied').length === 1 && [...params.keys()].every(key => key === 'applied') ? id : null;
}
export function appliedQuestion(period, id) {
  if (!APPLIED_IDS.includes(id)) throw new Error('Choose an applied exercise.');
  const expected = id === 'fees-over-time' ? 'position-1382030' : 'position-1375047';
  if (period.id !== expected) throw new Error('This exercise requires its recorded position.');
  const index = id === 'between-samples'
    ? periodMilestones(period).find(item => item.label === 'Between samples')?.index
    : period.points.length - 1;
  if (!Number.isInteger(index)) throw new Error('The recorded between-samples interval is missing.');
  const view = periodPointView(period, index), interval = periodIntervalView(period, index);
  if (id === 'fees-over-time') return { index, view, interval, answer: view.feesUSD, answerDigits: 2, prediction: 'earned', reason: 'growth' };
  if (id === 'between-samples') return { index, view, interval, answer: interval.secondsInRange, answerDigits: 0, wholeAnswer: true, prediction: 'possible', reason: 'counters' };
  return { index, view, interval, answer: view.gapUSD, answerDigits: 2, prediction: view.gapUSD >= 0 ? 'lp' : 'hold', reason: 'basket' };
}
export function checkAppliedAnswer(question, answer, reason) {
  const numeric = learningAnswerMatches(answer, question.answer, question.answerDigits, question.wholeAnswer);
  const reasoning = reason === question.reason;
  return { numeric, reasoning, passed: numeric && reasoning };
}
export function appliedReasonFeedback(id, reason) {
  const feedback = {
    'fees-over-time': {
      owed: 'The final collectable balance can include earlier fees and recorded owed amounts. The period result includes only new fee tokens since its starting checkpoint.',
      principal: 'Price changes alter principal value. New fee tokens are accounted for separately through fee growth; a principal value change is not fee income.',
    },
    'between-samples': {
      line: 'The line joins recorded samples. It does not reconstruct crossings between them; the range-time counter records active seconds independently.',
      status: 'An outside sample describes one block. The question interval records activity and earned tokens between two outside samples.',
    },
    'period-vs-holding': {
      forecast: 'The comparison describes the recorded period before costs. It does not predict future prices, fees or outperformance.',
      income: 'Fees can be smaller than the shortfall in principal value. Compare principal plus period fees with holding the same starting tokens.',
    },
  };
  return feedback[id]?.[reason] || 'Choose a conclusion supported by the marked question checkpoint or interval.';
}
