import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const outputDirectory = path.resolve(projectRoot, 'dist');
if (path.dirname(outputDirectory) !== projectRoot || path.basename(outputDirectory) !== 'dist') {
    throw new Error('Refusing to clean outside the project output directory.');
}
await rm(outputDirectory, { recursive: true, force: true });
