import * as http from 'http';
import * as https from 'https';

// Generic request helper. Resolves with the parsed response body together with
// its status code so callers can distinguish success from a 404 / error
// response. The body is parsed as JSON when possible, otherwise returned as a
// string (falling back to the raw buffer).
//
// The transport follows the `protocol` option and defaults to HTTPS. Plain HTTP
// is supported so the SDK can also talk to an internal endpoint that terminates
// TLS elsewhere — see `GleapAdmin.apiUrl`.
export const request = ({ body, method = 'POST', protocol = 'https:', ...options }: any): Promise<{ statusCode: number; data: any }> =>
    new Promise((resolve, reject) => {
        const transport = protocol === 'http:' ? http : https;

        const req = transport.request(
            {
                method,
                protocol,
                ...options,
            },
            (res) => {
                const chunks: any[] = [];
                res.on('data', (data) => chunks.push(data));
                res.on('end', () => {
                    const resBody = Buffer.concat(chunks);
                    const statusCode = res.statusCode ?? 0;
                    const text = resBody.toString('utf8');

                    try {
                        resolve({ statusCode, data: JSON.parse(text) });
                        return;
                    } catch {
                        // Body is not valid JSON — fall back to text / raw buffer.
                    }

                    resolve({ statusCode, data: text || resBody });
                });
            },
        );
        req.on('error', reject);
        if (body) {
            req.write(body);
        }
        req.end();
    });

// POST helper kept for existing callers. Resolves with the parsed response body
// (not the status wrapper) to preserve its original contract.
export const post = async (options: any) => {
    const { data } = await request({ ...options, method: 'POST' });
    return data;
};
