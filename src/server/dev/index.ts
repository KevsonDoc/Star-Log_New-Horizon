import express from 'express';
import connectLivereload from 'connect-livereload';
import livereload from 'livereload';
import { createApp } from '../app.js';
import { readServerConfig } from '../config.js';
import { startServer } from '../listen.js';

const { port, publicDirectory } = readServerConfig();
const liveReloadServer = livereload.createServer({ exts: ['html', 'css', 'js'], delay: 250 });
liveReloadServer.watch(publicDirectory);

const app = express();
app.disable('x-powered-by');
app.use(connectLivereload());
app.use(createApp(publicDirectory));
startServer(app, port, () => liveReloadServer.close());
