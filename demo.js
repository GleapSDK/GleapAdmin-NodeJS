/* eslint-disable no-console */
/* eslint-disable prettier/prettier */
const GleapAdmin = require('./dist/index');

GleapAdmin.default.initialize('SECRET_API_KEY');

// eslint-disable-next-line require-await
const x = async () => {
    await GleapAdmin.default.identify('XOXO', {
        name: 'XOXO',
        email: 'asdf@asf.de',
        value: 1,
        phone: '+4395959595',
        customData: {
            xoxo: 'xoxo',
        },
    });

    console.log('Now log events.');

    GleapAdmin.default.trackEvent('XOXO', 'test', {
        value: 1,
        xo: 2,
    });

    GleapAdmin.default.trackEvent('XOXO', '4444', {
        value: 1,
        xo: 2,
    });

    GleapAdmin.default.trackEvent('XOXO', 'asdfasdf', {
        value: 1,
        xo: 2,
    });
};
x();
