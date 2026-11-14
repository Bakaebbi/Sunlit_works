import process from 'node:process';
import {Buffer} from 'node:buffer';
import sharp from 'sharp';
import {readFile, writeFile, mkdir, rm, rename} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const output = 'assets/optimized';
const generatedDirectory = path.resolve(root, 'public', output);
if (!generatedDirectory.startsWith(path.resolve(root, 'public') + path.sep)) throw Error('Generated path escapes public directory');
await mkdir(generatedDirectory, {recursive: true});
await mkdir('public/data', {recursive: true});
async function saveImage(operation, target) {
    const {data, info} = await operation.toBuffer({resolveWithObject:true});
    const temporary = `${target}.tmp`;
    await writeFile(temporary, data);
    await rename(temporary, target);
    return info;
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const projects = JSON.parse(await readFile('data/projects.json', 'utf8'));
const seen = new Set(['main']);
const siteBase = process.env.SITE_URL ? new URL(process.env.SITE_URL.replace(/\/?$/, '/')) : null;
if (siteBase && !['https:', 'http:'].includes(siteBase.protocol)) throw Error('SITE_URL must be an HTTP(S) URL');
const urlMetadata = (html, route) => {
    html = html.replace(/\s*<!-- urls:start -->[\s\S]*?<!-- urls:end -->/, '');
    if (siteBase) html = html.replace(/(<meta property="og:image" content=")[^"]*(">)/, `$1${new URL('assets/social-preview.jpg', siteBase).href}$2`);
    return html.replace('</head>', `<!-- urls:start --><meta property="og:site_name" content="Sunlit Works"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Sunlit Works - избранные проекты веб-разработки">${siteBase ? `<link rel="canonical" href="${escape(new URL(route, siteBase).href)}"><meta property="og:url" content="${escape(new URL(route, siteBase).href)}">` : ''}<!-- urls:end -->\n</head>`);
};
for (const project of projects) {
    if (!/^[a-z][a-z0-9-]*$/.test(project.id) || seen.has(project.id)) throw Error(`Invalid or duplicate project id: ${project.id}`);
    seen.add(project.id);
    project.coverSource ||= project.cover;
    project.previewSource ||= project.preview;
    let source = project.coverSource;
    let mapSource;
    if (project.artwork) {
        const {screen, background, ink} = project.artwork;
        const metadata = await sharp(screen).metadata();
        const screenImage = await sharp(screen).extract({left:0, top:0, width:metadata.width, height:Math.min(metadata.height, Math.round(metadata.width * .69))}).resize(832, 574, {fit:'cover',position:'top'}).png().toBuffer();
        const svg = `<svg width="960" height="960" xmlns="http://www.w3.org/2000/svg"><rect width="960" height="960" fill="${background}"/><g fill="${ink}" font-family="Arial,sans-serif"><text x="64" y="149" font-size="${project.title.length > 7 ? 78 : 96}" letter-spacing="-4">${escape(project.title)}</text><text x="68" y="202" font-size="27">${escape(project.description)}</text></g><rect x="64" y="265" width="832" height="574" fill="white"/><g fill="${ink}"><rect x="68" y="884" width="13" height="13" rx="2"/><rect x="88" y="884" width="13" height="13" rx="2"/></g></svg>`;
        source = await sharp(Buffer.from(svg)).composite([{input:screenImage,left:64,top:265}]).png().toBuffer();
        const mapScreen = await sharp(screen).extract({left:0,top:0,width:metadata.width,height:Math.min(metadata.height, Math.round(metadata.width * .69))}).resize(572,252,{fit:'cover',position:'top'}).png().toBuffer();
        const mapSVG = `<svg width="660" height="440" xmlns="http://www.w3.org/2000/svg"><rect width="660" height="440" fill="${background}"/><g fill="${ink}" font-family="Arial,sans-serif"><text x="44" y="76" font-size="${project.title.length > 7 ? 48 : 58}" letter-spacing="-2">${escape(project.title)}</text><text x="46" y="112" font-size="19">${escape(project.description)}</text></g></svg>`;
        mapSource = await sharp(Buffer.from(mapSVG)).composite([{input:mapScreen,left:44,top:144}]).png().toBuffer();
    }
    project.coverSources = [];
    for (const size of [160, 480, 960]) {
        const target = `${output}/${project.id}-${size}.webp`;
        await saveImage(sharp(source).resize({width:size, height:size, fit:'cover'}).webp({quality:82}), `public/${target}`);
        project.coverSources.push({src:target,width:size});
    }
    project.mapCoverSources = [];
    for (const width of [330,660]) {
        const target = `${output}/${project.id}-map-${width}.webp`;
        await saveImage(sharp(mapSource || source).resize(width, Math.round(width * 2 / 3), {fit:'cover'}).webp({quality:84}), `public/${target}`);
        project.mapCoverSources.push({src:target,width});
    }
    project.mapCover = `${output}/${project.id}-map-660.webp`;
    project.cover = `${output}/${project.id}-960.webp`;
    project.thumbnail = `${output}/${project.id}-160.webp`;
    project.coverWidth = project.coverHeight = 960;
    project.coverAlt = `${project.title} - ${project.description}`;
    if (project.previewSource || project.preview) {
        const input = project.previewSource || project.preview;
        const target = `${output}/${project.id}-preview.webp`;
        await saveImage(sharp(input).resize({width:1100,withoutEnlargement:true}).webp({quality:80}), `public/${target}`);
        project.preview = target;
    }
}
await writeFile('data/projects.json', JSON.stringify(projects,null,2)+'\n');
const nav = (current) => projects.filter(p=>p.caseUrl).map(p=>`<a class="case-switch" href="./${escape(path.basename(p.caseUrl))}" aria-label="Кейс ${escape(p.title)}"${p.id===current?' aria-current="page"':''}><img src="../${p.thumbnail}" alt="" width="160" height="160"><span class="case-switch-label">${escape(p.title)}</span></a>`).join('');
for (const project of projects.filter(p=>p.caseUrl)) {
    const file = path.resolve(root, project.caseUrl);
    if (!file.startsWith(root+path.sep) || !existsSync(file)) throw Error(`Case page missing: ${project.caseUrl}`);
    let html = await readFile(file, 'utf8');
    html = html.replace(/(<figure class="case-visual cover")[^>]*>/, `$1 data-project="${project.id}">`);
    html = html.replace(/(<nav class="case-switcher"[^>]*>)[\s\S]*?(<\/nav>)/, `$1${nav(project.id)}$2`);
    html = html.replace(/(<figure class="case-visual cover"[^>]*>\s*<a[^>]*>\s*)<img[^>]*>/, `$1<img src="../${project.cover}" srcset="${project.coverSources.map(s=>`../${s.src} ${s.width}w`).join(', ')}" sizes="(max-width: 980px) 94vw, 940px" alt="${escape(project.coverAlt)}" width="960" height="960" style="view-transition-name: project-${project.id}">`);
    html = html.replace(/(<h1 class="case-name">)[\s\S]*?(<\/h1>)/, `$1${escape(project.title)}$2`);
    html = html.replace(/<meta name="description"[\s\S]*?>/, `<meta name="description" content="${escape(project.description)}. Кейс веб-разработки Sunlit Works.">`);
    if (project.siteUrl) html = html.replace(/(<figure class="case-visual cover"[^>]*>\s*)<a[^>]*>/, `$1<a class="case-cover-link" href="${escape(project.siteUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Открыть сайт ${escape(project.title)}">`);
    html = html.replace(/\s*<!-- project-action:start -->[\s\S]*?<!-- project-action:end -->/,'');
    if (project.siteUrl) {
        const action = `<div class="case-project-actions"><a class="case-site-link" href="${escape(project.siteUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Открыть сайт ${escape(project.title)} в новой вкладке"><span>Открыть сайт</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8"/></svg></a></div>`;
        html = html.replace(/(<div class="case-tools">\s*<h1 class="case-name">[\s\S]*?<\/h1>)/, `$1\n<!-- project-action:start -->${action}<!-- project-action:end -->`);
    }
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escape(project.title)} - Sunlit Works</title>`);
    html = html.replace(/<link rel="icon"[^>]*>/, '<link rel="icon" href="../assets/favicon.svg?v=2" type="image/svg+xml">');
    html = html.replace(/\s*<!-- social:start -->[\s\S]*?<!-- social:end -->/, '');
    html = html.replace(/<style id="case-transition-layer">[\s\S]*?<\/style>/, '');
    html = html.replace('</head>', `<style id="case-transition-layer">::view-transition-group(project-${project.id}){z-index:2}</style></head>`);
    html = html.replace('</head>', `    <!-- social:start --><meta property="og:title" content="${escape(project.title)} - Sunlit Works"><meta property="og:description" content="${escape(project.description)}"><meta property="og:type" content="website"><meta property="og:image" content="../assets/social-preview.jpg"><meta name="twitter:card" content="summary_large_image"><!-- social:end -->\n</head>`);
    html = html.replaceAll('"../assets/', '"/assets/').replaceAll(', ../assets/', ', /assets/');
    await writeFile(file, urlMetadata(html, project.caseUrl));
}
// Optional detail imagery follows the same pipeline for every project.
for (const project of projects.filter(p=>p.caseUrl)) {
    let html = await readFile(project.caseUrl,'utf8');
    for (const input of project.mediaSources || []) {
        const basename = path.parse(input).name;
        const target = `${output}/${project.id}-${basename}.webp`;
        const result = await saveImage(sharp(input).resize({width:1400,withoutEnlargement:true}).webp({quality:84}), `public/${target}`);
        const candidates = [input, `${output}/${basename}.webp`, target];
        const pattern = candidates.flatMap(src=>[`../${src}`,`/${src}`]).map(src=>src.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
        html = html.replace(new RegExp(`<img([^>]*?)src="(?:${pattern})"([^>]*)>`,'g'), (_,before,after)=>`<img${before}src="/${target}"${after.replace(/\s+(width|height)="[^"]*"/g,'')} width="${result.width}" height="${result.height}">`);
    }
    await writeFile(project.caseUrl,html);
}
const cards = projects.map(p=>`<article class="project" data-project-id="${p.id}" data-category="${escape(p.category || 'Сайты')}"><a class="project-cover has-image" href="${escape(p.caseUrl||p.siteUrl||'#main')}" data-tone="${p.id}" data-preview="${escape(p.preview||'')}" data-title="${escape(p.title)}" data-description="${escape(p.description)}" aria-label="Открыть проект ${escape(p.title)}" style="--cover-ratio:1"><img src="/${p.cover}" srcset="${p.coverSources.map(s=>`/${s.src} ${s.width}w`).join(', ')}" sizes="(max-width:900px) 76vw, (max-width:1440px) 30vw, 420px" alt="${escape(p.coverAlt)}" width="960" height="960" style="view-transition-name:project-${p.id}"></a><div class="project-caption"><span class="project-caption-title">${escape(p.title)}</span><span class="project-caption-description">${escape(p.description)}</span></div></article>`).join('\n');
let index = await readFile('index.html','utf8');
const gridPattern = index.includes('<!-- cards:end -->') ? /(<div id="projects-grid" class="projects-grid">)[\s\S]*?<\/div><!-- cards:end -->/ : /(<div id="projects-grid" class="projects-grid">)[\s\S]*?<\/div>/;
index = index.replace(gridPattern, `$1\n${cards}\n</div><!-- cards:end -->`);
index = index.replace('<p id="projects-status" role="status">Загружаю проекты…</p>', '<p id="projects-status" role="status" hidden></p>');
index = index.replace(/<noscript>[\s\S]*?<\/noscript>/, '<noscript><link rel="stylesheet" href="/assets/noscript.css"><p class="noscript-note">Проекты доступны по ссылкам. Для анимации и карты включите JavaScript.</p></noscript>');
index = index.replace(/<title>[^<]*<\/title>/, '<title>Sunlit Works - веб-разработка</title>').replace(/<meta name="description"[^>]*>/, '<meta name="description" content="Sunlit Works - сайты и веб-приложения. Избранные проекты, интерфейсы и решения на HTML, CSS и JavaScript.">').replace(/<link rel="icon"[^>]*>/, '<link rel="icon" href="/assets/favicon.svg?v=2" type="image/svg+xml">');
index = index.replace(/\s*<!-- social:start -->[\s\S]*?<!-- social:end -->/, '');
index = index.replace('</head>', '    <!-- social:start --><meta property="og:title" content="Sunlit Works - веб-разработка"><meta property="og:description" content="Сайты, веб-приложения и продуманные интерфейсы."><meta property="og:type" content="website"><meta property="og:image" content="/assets/social-preview.jpg"><meta name="twitter:card" content="summary_large_image"><!-- social:end -->\n</head>');
const runtime = projects.map(({coverSource,previewSource,artwork,mediaSources,...project})=>project);
index = index.replace(/\s*<script type="application\/json" id="project-data">[\s\S]*?<\/script>/,'');
index = index.replace('</body>', `<script type="application/json" id="project-data">${JSON.stringify(runtime).replaceAll('<','\\u003c')}</script>\n</body>`);
await writeFile('public/data/projects.json',JSON.stringify(runtime));
await writeFile('public/assets/favicon.svg',await readFile('assets/favicon.svg'));
await writeFile('index.html',urlMetadata(index, ''));
await writeFile('public/robots.txt',`User-agent: *\nAllow: /\n${siteBase ? `Sitemap: ${new URL('sitemap.xml',siteBase).href}\n` : ''}`);
// The HTTP URI identifies the sitemap XML vocabulary; it is not a network request.
if (siteBase) await writeFile('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['',...projects.filter(p=>p.caseUrl).map(p=>p.caseUrl)].map(route=>`<url><loc>${escape(new URL(route,siteBase).href)}</loc></url>`).join('')}</urlset>`);
else await rm('public/sitemap.xml',{force:true});
const socialSVG = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#f6f4ed"/><text x="64" y="112" fill="#20251f" font-family="Arial,sans-serif" font-size="64">Sunlit Works</text><text x="68" y="164" fill="#555d50" font-family="Arial,sans-serif" font-size="28">Веб-разработка</text></svg>`;
await saveImage(sharp(Buffer.from(socialSVG)).composite(await Promise.all(projects.slice(0,3).map(async(p,i)=>({input:await sharp(`public/${p.cover}`).resize(290,290).toBuffer(),left:68+i*386,top:260})))).jpeg({quality:88}), 'public/assets/social-preview.jpg');
console.log(`Prepared ${projects.length} projects: responsive artwork, navigation, static cards and metadata.`);
