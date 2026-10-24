import { watch } from 'node:fs';
import { cp, copyFile, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const publicDirectory = path.join(projectRoot, 'dist', 'public');
const pageDirectory = path.join(projectRoot, 'src', 'web', 'pages');
const partialDirectory = path.join(projectRoot, 'src', 'web', 'partials');

async function buildPublic(): Promise<void> {
    await mkdir(path.join(publicDirectory, 'vendor'), { recursive: true });
    await cp(path.join(projectRoot, 'public'), publicDirectory, { recursive: true });
    await copyFile(
        path.join(projectRoot, 'node_modules', 'phaser', 'dist', 'phaser.esm.min.js'),
        path.join(publicDirectory, 'vendor', 'phaser.esm.min.js'),
    );

    const navigation = await readFile(path.join(partialDirectory, 'navigation.html'), 'utf8');
    for (const page of await readdir(pageDirectory)) {
        if (!page.endsWith('.html')) continue;
        const source = await readFile(path.join(pageDirectory, page), 'utf8');
        const outputPath = path.join(publicDirectory, page);
        await writeFile(outputPath + '.tmp', source.replace('<!-- navigation -->', navigation));
        await rename(outputPath + '.tmp', outputPath);
    }
    console.log('Public pages and assets are ready.');
}

await buildPublic();

if (process.argv.includes('--watch')) {
    let timer: NodeJS.Timeout | undefined;
    let pendingBuild = Promise.resolve();
    const queueBuild = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            pendingBuild = pendingBuild.then(buildPublic).catch((error: unknown) => {
                console.error('Public build failed:', error);
            });
        }, 150);
    };
    const watchers = [path.join(projectRoot, 'public'), pageDirectory, partialDirectory]
        .map((directory) => watch(directory, { recursive: true }, queueBuild));
    const stopWatching = () => {
        clearTimeout(timer);
        for (const watcher of watchers) watcher.close();
    };
    process.once('SIGINT', stopWatching);
    process.once('SIGTERM', stopWatching);
}
