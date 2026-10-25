import { fileURLToPath } from 'node:url';

export function readServerConfig(environment: NodeJS.ProcessEnv = process.env) {
    const port = Number(environment.PORT ?? 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('PORT must be an integer between 1 and 65535.');
    }
    return {
        port,
        publicDirectory: fileURLToPath(new URL('../public/', import.meta.url)),
    };
}
