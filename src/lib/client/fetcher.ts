// Shared GET fetcher for useSWR calls -- keeps every screen's cache keyed
// consistently off the request URL and failing the same way (thrown Error)
// so SWR's error state works without each call site reimplementing this.
export async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request to ${url} failed (${response.status})`);
  return response.json();
}
