import { request } from '../httpclient';
import GleapAdmin from '../index';

// Mock the network layer so these tests never hit the live API.
jest.mock('../httpclient');

const mockedRequest = request as jest.MockedFunction<typeof request>;

describe('GleapAdmin pipelines', () => {
    beforeAll(() => {
        GleapAdmin.initialize('test-token');
    });

    afterAll(() => {
        GleapAdmin.stop();
    });

    beforeEach(() => {
        mockedRequest.mockReset();
    });

    test('getPipelines GETs the pipeline list', async () => {
        const pipelines = [
            {
                id: 'p1',
                name: 'Onboarding',
                recordType: 'COMPANY',
                stages: [],
                fields: [{ fieldId: 'contract_value', label: 'Contract value', type: 'NUMBER', unit: 'EUR' }],
            },
        ];
        mockedRequest.mockResolvedValue({ statusCode: 200, data: pipelines });

        const result = await GleapAdmin.getPipelines();

        expect(mockedRequest).toHaveBeenCalledTimes(1);
        const arg = mockedRequest.mock.calls[0][0];
        expect(arg.method).toBe('GET');
        expect(arg.path).toBe('/admin/pipelines');
        expect(arg.headers['Api-Token']).toBe('test-token');
        expect(result).toEqual(pipelines);
    });

    test('getPipelines returns null on a non-2xx response', async () => {
        mockedRequest.mockResolvedValue({ statusCode: 500, data: {} });
        expect(await GleapAdmin.getPipelines()).toBeNull();
    });

    test('addPipelineEntry POSTs to the company entry route', async () => {
        const entry = { id: 'e1', pipelineId: 'p1', companyId: 'acme', stageId: 's1', values: {} };
        mockedRequest.mockResolvedValue({ statusCode: 201, data: entry });

        const result = await GleapAdmin.addPipelineEntry('p1', { companyId: 'acme', stageId: 's1' });

        const arg = mockedRequest.mock.calls[0][0];
        expect(arg.method).toBe('POST');
        expect(arg.path).toBe('/admin/pipelines/p1/companies/acme');
        expect(JSON.parse(arg.body)).toEqual({ stageId: 's1' });
        expect(result).toEqual(entry);
    });

    test('addPipelineEntry routes a userId target to the contact entry route', async () => {
        mockedRequest.mockResolvedValue({ statusCode: 201, data: {} });

        await GleapAdmin.addPipelineEntry('p1', { userId: 'user-1', values: { plan: 'pro' } });

        const arg = mockedRequest.mock.calls[0][0];
        expect(arg.method).toBe('POST');
        expect(arg.path).toBe('/admin/pipelines/p1/contacts/user-1');
        expect(JSON.parse(arg.body)).toEqual({ values: { plan: 'pro' } });
    });

    test('addPipelineEntry returns null on a non-2xx response', async () => {
        mockedRequest.mockResolvedValue({ statusCode: 404, data: { message: 'Company not found' } });
        expect(await GleapAdmin.addPipelineEntry('p1', { companyId: 'missing' })).toBeNull();
    });

    test('updatePipelineEntry PUTs to the company entry route', async () => {
        const entry = { id: 'e1', pipelineId: 'p1', companyId: 'acme', stageId: 's2', values: { mrr: 499 } };
        mockedRequest.mockResolvedValue({ statusCode: 200, data: entry });

        const result = await GleapAdmin.updatePipelineEntry('p1', {
            companyId: 'acme',
            stageId: 's2',
            values: { mrr: 499 },
        });

        const arg = mockedRequest.mock.calls[0][0];
        expect(arg.method).toBe('PUT');
        expect(arg.path).toBe('/admin/pipelines/p1/companies/acme');
        expect(JSON.parse(arg.body)).toEqual({ stageId: 's2', values: { mrr: 499 } });
        expect(result).toEqual(entry);
    });

    test('updatePipelineEntry routes a userId target to the contact entry route', async () => {
        mockedRequest.mockResolvedValue({ statusCode: 200, data: {} });

        await GleapAdmin.updatePipelineEntry('p1', { userId: 'user-1', stageId: 's1' });

        const arg = mockedRequest.mock.calls[0][0];
        expect(arg.path).toBe('/admin/pipelines/p1/contacts/user-1');
        expect(JSON.parse(arg.body)).toEqual({ stageId: 's1' });
    });

    test('updatePipelineEntry url-encodes the pipelineId and target id', async () => {
        mockedRequest.mockResolvedValue({ statusCode: 200, data: {} });

        await GleapAdmin.updatePipelineEntry('p 1', { companyId: 'acme/inc' });

        expect(mockedRequest.mock.calls[0][0].path).toBe('/admin/pipelines/p%201/companies/acme%2Finc');
    });

    test('updatePipelineEntry omits unset stageId/values from the body', async () => {
        mockedRequest.mockResolvedValue({ statusCode: 200, data: {} });

        await GleapAdmin.updatePipelineEntry('p1', { companyId: 'acme' });

        expect(JSON.parse(mockedRequest.mock.calls[0][0].body)).toEqual({});
    });

    test('updatePipelineEntry returns null on a non-2xx response', async () => {
        mockedRequest.mockResolvedValue({ statusCode: 400, data: { message: 'Unknown stage' } });
        expect(await GleapAdmin.updatePipelineEntry('p1', { companyId: 'acme', stageId: 'nope' })).toBeNull();
    });

    test('getPipelineEntry returns the entry on 200 and null on 404', async () => {
        mockedRequest.mockResolvedValue({ statusCode: 200, data: { id: 'e1' } });
        expect(await GleapAdmin.getPipelineEntry('p1', { companyId: 'acme' })).toEqual({ id: 'e1' });
        expect(mockedRequest.mock.calls[0][0].method).toBe('GET');

        mockedRequest.mockResolvedValue({ statusCode: 404, data: { message: 'Record is not on this pipeline' } });
        expect(await GleapAdmin.getPipelineEntry('p1', { companyId: 'acme' })).toBeNull();
    });

    test('removePipelineEntry returns true on success and false on error', async () => {
        mockedRequest.mockResolvedValue({ statusCode: 200, data: {} });
        expect(await GleapAdmin.removePipelineEntry('p1', { userId: 'user-1' })).toBe(true);
        const arg = mockedRequest.mock.calls[0][0];
        expect(arg.method).toBe('DELETE');
        expect(arg.path).toBe('/admin/pipelines/p1/contacts/user-1');

        mockedRequest.mockResolvedValue({ statusCode: 500, data: {} });
        expect(await GleapAdmin.removePipelineEntry('p1', { userId: 'user-1' })).toBe(false);
    });

    test('an invalid target never issues a request', async () => {
        // Neither companyId nor userId.
        expect(await GleapAdmin.addPipelineEntry('p1', {})).toBeNull();
        expect(await GleapAdmin.updatePipelineEntry('p1', {})).toBeNull();
        // Both at once is ambiguous.
        expect(await GleapAdmin.updatePipelineEntry('p1', { companyId: 'acme', userId: 'user-1' })).toBeNull();
        // Missing pipelineId.
        expect(await GleapAdmin.addPipelineEntry('', { companyId: 'acme' })).toBeNull();
        expect(await GleapAdmin.getPipelineEntry('', { companyId: 'acme' })).toBeNull();
        expect(await GleapAdmin.removePipelineEntry('', { userId: 'user-1' })).toBe(false);
        expect(mockedRequest).not.toHaveBeenCalled();
    });
});
