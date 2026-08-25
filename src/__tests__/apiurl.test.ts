import { request } from '../httpclient';
import GleapAdmin from '../index';

// Mock the network layer so these tests never hit the live API.
jest.mock('../httpclient');

const mockedRequest = request as jest.MockedFunction<typeof request>;

// Connection options of the last request the SDK issued.
const lastEndpoint = () => {
  const { protocol, hostname, port } = mockedRequest.mock.calls[0][0];
  return { protocol, hostname, port };
};

describe('GleapAdmin apiUrl', () => {
  afterAll(() => {
    GleapAdmin.stop();
  });

  beforeEach(() => {
    mockedRequest.mockReset();
    mockedRequest.mockResolvedValue({ statusCode: 200, data: [] });
  });

  test('requests go to the public API by default', async () => {
    GleapAdmin.initialize('test-token');

    expect(GleapAdmin.apiUrl).toBe('https://api.gleap.io');

    await GleapAdmin.getPipelines();
    expect(lastEndpoint()).toEqual({ protocol: 'https:', hostname: 'api.gleap.io', port: undefined });
  });

  test('an http api url with a port is used as given', async () => {
    GleapAdmin.initialize('test-token', { apiUrl: 'http://internal-host:9000' });

    expect(GleapAdmin.apiUrl).toBe('http://internal-host:9000');

    await GleapAdmin.getPipelines();
    expect(lastEndpoint()).toEqual({ protocol: 'http:', hostname: 'internal-host', port: '9000' });
  });

  test('a bare hostname means the public HTTPS API', () => {
    GleapAdmin.initialize('test-token', { apiUrl: 'api.eu.gleap.io' });

    expect(GleapAdmin.apiUrl).toBe('https://api.eu.gleap.io');
  });

  test('a trailing slash and a path are not part of the endpoint', () => {
    GleapAdmin.initialize('test-token', { apiUrl: 'https://api.gleap.io/' });
    expect(GleapAdmin.apiUrl).toBe('https://api.gleap.io');

    GleapAdmin.apiUrl = 'http://internal-host:9000/admin';
    expect(GleapAdmin.apiUrl).toBe('http://internal-host:9000');
  });

  test('re-initializing without an api url returns to the public API', () => {
    GleapAdmin.initialize('test-token', { apiUrl: 'http://internal-host:9000' });
    GleapAdmin.initialize('test-token');

    expect(GleapAdmin.apiUrl).toBe('https://api.gleap.io');
  });

  test('an empty api url falls back to the public API', () => {
    GleapAdmin.initialize('test-token', { apiUrl: '  ' });

    expect(GleapAdmin.apiUrl).toBe('https://api.gleap.io');
  });
});

describe('GleapAdmin apiUrl fallback', () => {
  afterAll(() => {
    GleapAdmin.stop();
  });

  test('an unparsable api url falls back to the public API instead of throwing', () => {
    GleapAdmin.initialize('test-token', { apiUrl: 'http://' });

    expect(GleapAdmin.apiUrl).toBe('https://api.gleap.io');
  });

  test('a protocol the SDK cannot speak falls back to the public API', () => {
    GleapAdmin.initialize('test-token', { apiUrl: 'ftp://files.gleap.io' });

    expect(GleapAdmin.apiUrl).toBe('https://api.gleap.io');
  });

  test('a host that looks like a scheme keeps its port', () => {
    GleapAdmin.initialize('test-token', { apiUrl: 'internal-host:9000' });

    expect(GleapAdmin.apiUrl).toBe('https://internal-host:9000');
  });
});
