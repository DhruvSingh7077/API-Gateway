export default async function fetchMock(): Promise<never> {
  throw new Error('node-fetch mock called during tests');
}
