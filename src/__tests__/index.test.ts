/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prettier/prettier */
/* eslint-disable arrow-body-style */
import { httpsPost } from '../httpclient';
import GleapAdmin from '../index';

describe('GleapAdmin', () => {
  beforeAll(() => {
    GleapAdmin.initialize('0eVRMwq5NHkDAllLvdkiEerja8YrI19F');
  });

  afterAll(() => {
    GleapAdmin.stop();
  });

  test('initialize SDK', () => {
    expect(GleapAdmin.apiToken).toBe('0eVRMwq5NHkDAllLvdkiEerja8YrI19F');
    expect(GleapAdmin.initialized).toBe(true);
  });

  test('identify user', () => {
    return GleapAdmin.identify('XOXO', {
      name: 'John Doe',
      email: 'john@doe.io',
      value: 100,
      phone: '+491234533333',
    }).then((success) => {
      expect(success).toBe(true);
    });
  });

  test('track event', () => {
    GleapAdmin.trackEvent('XOXO', 'test-event');
    expect(GleapAdmin.trackingCache.length).toBe(1);

    GleapAdmin.trackEvent('XOXO', 'test-event-2');
    expect(GleapAdmin.trackingCache.length).toBe(2);
  });

  test('stop', () => {
    GleapAdmin.stop();
    expect(GleapAdmin.trackingCache.length).toBe(0);
    expect(GleapAdmin.apiToken).toBe('');
    expect(GleapAdmin.initialized).toBe(false);
  });
});

describe('HttpHelper', () => {
  test('httpRequest', () => {
    return httpsPost({
      hostname: 'dummyjson.com',
      headers: {
        'Content-Type': 'application/json',
      },
      path: '/users/add',
      body: JSON.stringify({
        firstName: 'John',
        lastName: 'Ovi',
        age: 250,
      }),
    }).then((response: any) => {
      expect(response).toBeDefined();
      expect(response.firstName).toBe('John');
    });
  });
});
