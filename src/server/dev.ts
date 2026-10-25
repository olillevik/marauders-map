import { createApp } from './app.ts';

const HOST = '127.0.0.1';
const PORT = 5173;

const server = await createApp();
server.listen(PORT, HOST, () => {
  console.log(`Marauders Map dev server: http://${HOST}:${PORT}/`);
});
