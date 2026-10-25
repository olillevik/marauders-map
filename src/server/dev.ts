import { createApp } from './app.ts';

const HOST = '127.0.0.1';
const PORT = 5173;

// The client ID comes from .env. The client secret comes from the keychain wrapper. Neither value is printed.
const clientId = process.env.BARENTSWATCH_CLIENT_ID;
const clientSecret = process.env.BARENTSWATCH_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error(
    'BARENTSWATCH_CLIENT_ID and BARENTSWATCH_CLIENT_SECRET must both be set. Set the client ID in .env (see .env.example) and start the server with npm run dev.',
  );
  process.exit(1);
}

const server = await createApp({ clientId, clientSecret });
server.listen(PORT, HOST, () => {
  console.log(`Marauders Map dev server: http://${HOST}:${PORT}/`);
});
