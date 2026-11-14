import './check-punctuation.mjs';
import assert from 'node:assert/strict';
import {readFile, stat, readdir} from 'node:fs/promises';
import path from 'node:path';
/** @type {Array<{id:string, title:string, siteUrl?:string, caseUrl?:string, coverSources:Array<{src:string,width:number}>, mapCoverSources?:Array<{src:string,width:number}>}>} */
const projects=JSON.parse(await readFile('data/projects.json','utf8'));
const index=await readFile('dist/index.html','utf8');
assert.equal([...index.matchAll(/data-project-id="/g)].length,projects.length,'Static project cards must not duplicate across preparation runs');
assert(index.includes('Sunlit Works - веб-разработка'),'Branded title');
assert(index.includes('property="og:image"'),'Social preview metadata');
assert(index.includes('mailto:sunlit.tile@gmail.com'),'Contact email link');
assert(!index.includes('fl.ru'),'Removed profile link');
for(const project of projects){
    for(const variant of [...project.coverSources,...(project.mapCoverSources||[])]){
        const size=(await stat(path.join('dist',variant.src))).size;
        assert(size>0 && size<120000,`Oversized cover: ${variant.src}`);
    }
    if(project.caseUrl){
        const html=await readFile(path.join('dist',project.caseUrl),'utf8');
        assert.equal([...html.matchAll(/class="case-switch"/g)].length,projects.filter(p=>p.caseUrl).length,'Navigation must include all cases');
        assert(html.includes(`view-transition-name: project-${project.id}`),'Generic transition identifier');
        if (project.siteUrl) {
            const action = html.match(/<a class="case-site-link"[^>]*>/)?.[0];
            assert(action && action.includes(`href="${project.siteUrl}"`) && action.includes('target="_blank"') && action.includes('noopener'), 'Visible project website action');
        }
        assert(!/assets\/projects\/.*\.(png|jpg)/.test(html),'Original heavyweight imagery must not be shipped');
    }
}
const validateFiles=async(dir)=>{
    for(const entry of await readdir(dir,{withFileTypes:true})){
        const file=path.join(dir,entry.name);
        if(entry.isDirectory())await validateFiles(file);
        else if(entry.name.endsWith('.html')){
            const html=await readFile(file,'utf8');
            assert(!/[\u2013-\u2015]/u.test(html), `Long dash punctuation in ${file}`);
            for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
                const url=match[1];if(/^(?:https?:|data:|mailto:)/.test(url))continue;
                const target=path.resolve(path.dirname(file),url.split(/[?#]/)[0]);
                await stat(target).catch(()=>assert.fail(`Missing local link ${url} in ${file}`));
            }
        }
    }
};
await validateFiles('dist');
console.log(`PASS: ${projects.length} static projects, bounded asset sizes, generic case navigation/transitions, branded metadata and all local src/href targets.`);
