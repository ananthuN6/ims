module.exports = {
  server: {
    port: Number(process.env.PORT) || 4000,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  azure: {
    tenantId:     process.env.AZURE_TENANT_ID || '',
    clientId:     process.env.AZURE_CLIENT_ID || '',
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
    senderEmail:  process.env.AZURE_SENDER_EMAIL || '',
  },
  admin: {
    email: process.env.ADMIN_EMAIL || '',
    name:  process.env.ADMIN_NAME  || 'Admin IRT',
  },
  db: {
  dir:       './db',
  users:     './db/users.json',
  incidents: './db/incidents.json',
  emailLog:  './db/emailLog.json',
},
};
