function normalize(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    const doc = url.hostname === 'docs.google.com' && url.pathname.match(/^\/(document|spreadsheets|presentation)\/d\/([^/]+)(?:\/(?:edit|view|preview))?\/?$/);
    if (doc) return `${url.origin}/${doc[1]}/d/${doc[2]}`;
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.href;
  } catch { return null; }
}
export function urlsMatch(active: string, target: string): boolean {
  const normalized = normalize(active);
  return normalized !== null && normalized === normalize(target);
}
