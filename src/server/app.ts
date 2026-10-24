import express from 'express';
import path from 'node:path';

export function createApp(publicDirectory: string): express.Express {
    const app = express();
    app.disable('x-powered-by');

    app.get('/', (_request, response) => {
        response.sendFile(path.join(publicDirectory, 'index.html'));
    });
    app.get('/star', (_request, response) => {
        response.sendFile(path.join(publicDirectory, 'game.html'));
    });

    app.use(express.static(publicDirectory, { index: false }));
    return app;
}
