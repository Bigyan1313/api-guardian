// A fixture, not part of the product. It builds its URL at run time, which the
// locator cannot read, so coverage of this repository is incomplete and an
// empty result must not be reported as "not affected".

const ROUTES: Record<string, string> = { contacts: '/v1/contacts' };

export async function load(base: string, key: string): Promise<unknown> {
  const route = ROUTES[key] ?? '/';
  return (await fetch(base + route)).json();
}
