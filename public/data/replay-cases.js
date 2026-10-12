// Bundled records, ordered from a baseline to a range-crossing case.
export const REPLAY_CASES = Object.freeze([
  { id: 'in-range', title: '01 · Stays in range', hash: '#historical-case', file: 'uniswap-v3-position-period.json',
    detail: 'Separate principal, earned fee tokens and holding.' },
  { id: 'range-return', title: '02 · Exit and return', hash: '#historical-case=range-return', file: 'uniswap-v3-position-range-return.json',
    detail: 'Add time outside, fee pauses and a sampled return.' },
]);

export const replayCaseFromHash = hash => REPLAY_CASES.find(item => item.hash === hash) || null;
export const isReplayHash = hash => hash === '#historical-case' || hash.startsWith('#historical-case=');
