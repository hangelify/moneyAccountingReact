const DETAIL = /^\/bills\/(?:(confirmed|drafts)\/)?[^/]+$/;
const LISTS = new Set(['review', 'duplicates', 'confirmed', 'drafts']);

/** List route to fall back to when a bill detail page's budget changes; null elsewhere. */
export function billDetailParent(pathname: string): string | null {
  const m = DETAIL.exec(pathname);
  if (!m) return null;
  if (m[1]) return `/bills/${m[1]}`;
  const id = pathname.split('/')[2];
  return id && LISTS.has(id) ? null : '/bills';
}
