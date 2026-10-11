// Provider metadata describes the capture; imported URLs are never contacted.
export function validateProvider(value) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('The snapshot has invalid provider metadata.');
  let url;
  try { url = new URL(value); } catch { throw new Error('The snapshot has invalid provider metadata.'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('The snapshot has invalid provider metadata.');
  return value;
}
