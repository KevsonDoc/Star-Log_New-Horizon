import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApp } from '../src/server/app.ts';

test('HTTP serves public files and denies server output', async (context) => {
    const fixture = await mkdtemp(path.join(tmpdir(), 'star-log-http-'));
    const publicDirectory = path.join(fixture, 'public');
    await mkdir(path.join(publicDirectory, 'css'), { recursive: true });
    await mkdir(path.join(fixture, 'server'));
    await writeFile(path.join(publicDirectory, 'index.html'), '<html>Home</html>');
    await writeFile(path.join(publicDirectory, 'game.html'), '<html>Game</html>');
    await writeFile(path.join(publicDirectory, 'css', 'app.css'), '.flex { display: flex; }');
    await writeFile(path.join(fixture, 'server', 'index.js'), 'private server output');

    const server = createServer(createApp(publicDirectory));
    context.after(async () => {
        await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
        assert.equal(path.dirname(fixture), tmpdir());
        await rm(fixture, { recursive: true, force: true });
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const origin = 'http://127.0.0.1:' + address.port;

    for (const route of ['/', '/star', '/css/app.css']) {
        const response = await fetch(origin + route);
        assert.equal(response.status, 200, route);
        assert.equal(response.headers.get('x-powered-by'), null);
        assert.ok(!(await response.text()).includes('livereload'));
    }

    for (const route of ['/css/server.js', '/server/index.js', '/src/server.ts', '/package.json']) {
        const response = await fetch(origin + route);
        assert.equal(response.status, 404, route);
    }
});
