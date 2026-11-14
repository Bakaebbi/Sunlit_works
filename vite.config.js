import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vite';

/** @type {Array<{id:string, caseUrl?:string}>} */
const projects = JSON.parse(readFileSync(new URL('./data/projects.json', import.meta.url), 'utf8'));
/** @type {Record<string, string>} */
const input = {main: fileURLToPath(new URL('./index.html', import.meta.url))};
for (const project of projects) {
    if (project.caseUrl && existsSync(project.caseUrl)) {
        input[project.id] = fileURLToPath(new URL(project.caseUrl, import.meta.url));
    }
}

export default defineConfig({
    base: './',
    build: {
        rolldownOptions: {
            input,
        },
    },
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: false,
    },
    preview: {
        host: '127.0.0.1',
        port: 4173,
        strictPort: false,
    },
});
