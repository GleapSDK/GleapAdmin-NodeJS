/* eslint-disable no-empty */
/* eslint-disable prettier/prettier */
import * as https from 'https';

export const httpsPost = ({ body, ...options }: any) => new Promise((resolve, reject) => {
    const req = https.request(
        {
            method: 'POST',
            ...options,
        },
        (res) => {
            const chunks: any[] = [];
            res.on('data', (data) => chunks.push(data));
            res.on('end', () => {
                const resBody = Buffer.concat(chunks);
                try {
                    const json = JSON.parse(resBody.toString('utf8'));
                    resolve(json);
                    return;
                } catch (err) {}

                try {
                    const string = resBody.toString('utf8');
                    resolve(string);
                    return;
                } catch (err) {}

                resolve(resBody);
            });
        },
    );
    req.on('error', reject);
    if (body) {
        req.write(body);
    }
    req.end();
});
