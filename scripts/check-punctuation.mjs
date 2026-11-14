import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
const skip=new Set(['node_modules','.git','dist','public','.idea']);
const extensions=new Set(['.js','.mjs','.css','.html','.md','.json','.svg','.txt','.yml','.yaml']);
const failures=[];
async function scan(directory){
    for(const entry of await readdir(directory,{withFileTypes:true})){
        if(skip.has(entry.name))continue;
        const file=path.join(directory,entry.name);
        if(entry.isDirectory())await scan(file);
        else if(extensions.has(path.extname(file))){
            const text=await readFile(file,'utf8');
            if(/[\u2013-\u2015]/u.test(text))failures.push(file);
        }
    }
}
await scan('.');
if(failures.length)throw Error(`Replace long dash punctuation with U+002D in: ${failures.join(', ')}`);
console.log('PASS: authored source text uses short hyphens only.');
