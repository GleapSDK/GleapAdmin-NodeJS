const GleapAdmin = require('./dist/index').default;

GleapAdmin.initialize('SECRET_API_KEY');

const run = async () => {
  // Identify a user and associate them with a company.
  await GleapAdmin.identify('XOXO', {
    name: 'John Doe',
    email: 'john@doe.io',
    value: 1,
    phone: '+4395959595',
    customData: {
      plan: 'Growth plan',
    },
    company: {
      id: 'acme-inc',
      name: 'ACME inc.',
    },
  });

  // Set authoritative company attributes from the backend.
  await GleapAdmin.updateCompany('acme-inc', {
    name: 'ACME inc.',
    plan: 'Growth plan',
    value: 4990,
    sla: 3600,
  });

  const company = await GleapAdmin.getCompany('acme-inc');
  console.log('Loaded company:', company);

  // Track a couple of events.
  GleapAdmin.trackEvent('XOXO', 'Subscription started', { value: 1200 });
  GleapAdmin.trackEvent('XOXO', 'Feature used', { name: 'export' });
};

run();
