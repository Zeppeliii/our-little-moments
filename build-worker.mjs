import {readFile,writeFile} from 'node:fs/promises';
const read = path => readFile(new URL(path,import.meta.url),'utf8');
const model = (await read('memory-model.js')).replaceAll('export ','');
const store = (await read('github-store.js')).replace(/^import .*;\n/,'').replaceAll('export ','');
const worker = (await read('worker.js')).replace(/^import .*;\n/gm,'');
const bundle = `// 自动生成：运行 node build-worker.mjs 更新。\nconst model = (() => {\n${model}\nreturn {StoreError,validateDraft,validateManifest,photoPath};\n})();\nconst {StoreError,validateDraft} = model;\nconst GitHubStore = (() => {\nconst {StoreError,validateDraft,validateManifest,photoPath} = model;\n${store}\nreturn GitHubStore;\n})();\n${worker}`;
await writeFile(new URL('worker-bundle.js',import.meta.url),bundle);
