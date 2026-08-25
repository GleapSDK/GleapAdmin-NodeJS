import { post, request } from '../httpclient';
import GleapAdmin from '../index';

// Mock the network layer so these tests never hit the live API.
jest.mock('../httpclient');

const mockedRequest = request as jest.MockedFunction<typeof request>;
const mockedPost = post as jest.MockedFunction<typeof post>;

describe('GleapAdmin companies', () => {
  beforeAll(() => {
    GleapAdmin.initialize('test-token');
  });

  afterAll(() => {
    GleapAdmin.stop();
  });

  beforeEach(() => {
    mockedRequest.mockReset();
  });

  test('updateCompany PUTs whitelisted attributes to the company endpoint', async () => {
    mockedRequest.mockResolvedValue({ statusCode: 200, data: { companyId: 'acme', name: 'Acme' } });

    const company = await GleapAdmin.updateCompany('acme', { name: 'Acme', plan: 'pro', sla: 3600 });

    expect(mockedRequest).toHaveBeenCalledTimes(1);
    const arg = mockedRequest.mock.calls[0][0];
    expect(arg.method).toBe('PUT');
    expect(arg.path).toBe('/admin/companies/acme');
    expect(arg.headers['Api-Token']).toBe('test-token');
    expect(JSON.parse(arg.body)).toEqual({ name: 'Acme', plan: 'pro', sla: 3600 });
    expect(company).toEqual({ companyId: 'acme', name: 'Acme' });
  });

  test('updateCompany url-encodes the companyId', async () => {
    mockedRequest.mockResolvedValue({ statusCode: 200, data: {} });

    await GleapAdmin.updateCompany('acme/inc corp', { plan: 'x' });

    expect(mockedRequest.mock.calls[0][0].path).toBe('/admin/companies/acme%2Finc%20corp');
  });

  test('updateCompany returns null on a non-2xx response', async () => {
    mockedRequest.mockResolvedValue({ statusCode: 500, data: {} });
    expect(await GleapAdmin.updateCompany('acme', { plan: 'x' })).toBeNull();
  });

  test('getCompany returns the company on 200', async () => {
    mockedRequest.mockResolvedValue({ statusCode: 200, data: { companyId: 'acme' } });

    const company = await GleapAdmin.getCompany('acme');

    expect(mockedRequest.mock.calls[0][0].method).toBe('GET');
    expect(company).toEqual({ companyId: 'acme' });
  });

  test('getCompany returns null on 404', async () => {
    mockedRequest.mockResolvedValue({ statusCode: 404, data: { message: 'Company not found' } });
    expect(await GleapAdmin.getCompany('missing')).toBeNull();
  });

  test('deleteCompany returns true on success and false on error', async () => {
    mockedRequest.mockResolvedValue({ statusCode: 200, data: {} });
    expect(await GleapAdmin.deleteCompany('acme')).toBe(true);
    expect(mockedRequest.mock.calls[0][0].method).toBe('DELETE');

    mockedRequest.mockResolvedValue({ statusCode: 500, data: {} });
    expect(await GleapAdmin.deleteCompany('acme')).toBe(false);
  });

  test('an empty companyId never issues a request', async () => {
    expect(await GleapAdmin.updateCompany('', { name: 'x' })).toBeNull();
    expect(await GleapAdmin.getCompany('')).toBeNull();
    expect(await GleapAdmin.deleteCompany('')).toBe(false);
    expect(mockedRequest).not.toHaveBeenCalled();
  });
});

describe('GleapAdmin identify company association', () => {
  beforeAll(() => {
    GleapAdmin.initialize('test-token');
  });

  afterAll(() => {
    GleapAdmin.stop();
  });

  beforeEach(() => {
    mockedPost.mockReset();
    mockedPost.mockResolvedValue(undefined as any);
  });

  test('identify flattens company { id, name } to companyId / companyName', async () => {
    await GleapAdmin.identify('user-1', {
      name: 'John Doe',
      company: { id: 'acme', name: 'Acme Inc.' },
    });

    const body = JSON.parse(mockedPost.mock.calls[0][0].body);
    expect(body.companyId).toBe('acme');
    expect(body.companyName).toBe('Acme Inc.');
    expect(body.company).toBeUndefined();
    expect(body.userId).toBe('user-1');
    expect(body.name).toBe('John Doe');
  });

  test('identify omits company fields when no association is given', async () => {
    await GleapAdmin.identify('user-2', { email: 'john@doe.io' });

    const body = JSON.parse(mockedPost.mock.calls[0][0].body);
    expect(body.companyId).toBeUndefined();
    expect(body.companyName).toBeUndefined();
  });
});
