import type { Express } from 'express';

export function startServer(app: Express, port: number, onShutdown: () => void = () => {}) {
    const server = app.listen(port, () => {
        console.log('Star Log: New Horizons is running at http://localhost:' + port);
    });
    const shutdown = () => {
        onShutdown();
        server.close();
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    server.once('error', (error) => {
        console.error(error);
        onShutdown();
        process.exitCode = 1;
    });
    return server;
}
