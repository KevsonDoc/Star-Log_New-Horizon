import { createApp } from './app.js';
import { readServerConfig } from './config.js';
import { startServer } from './listen.js';

const { port, publicDirectory } = readServerConfig();
startServer(createApp(publicDirectory), port);
