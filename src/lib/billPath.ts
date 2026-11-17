export type BillSection = 'all' | 'confirmed' | 'drafts';

/** `search` with `hid` set to the bill's budget; other params are kept. */
export function withHid(search: string, hid: string): string {
  const params = new URLSearchParams(search);
  params.set('hid', hid);
  return `?${params.toString()}`;
}

/** Link to a bill that carries its budget, so it opens in the right one. */
export function billPath(
  section: BillSection,
  id: string,
  hid: string,
  search = ''
): string {
  const base = section === 'all' ? '/bills' : `/bills/${section}`;
  return `${base}/${id}${withHid(search, hid)}`;
}
