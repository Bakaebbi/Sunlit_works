import {trapDialogFocus} from './dialog-focus.js';
import {setupAbout} from './about.js';
import {setupContact} from './contact.js';
import {readBrowseState, saveBrowseState} from './browse-state.js';
import {setupProjectMap} from './project-map.js';
import {setupGalleryFlow} from './page-motion.js';
import {setupProjectMotion} from './project-motion.js';
import {playSound, setupSoundToggle} from './sounds.js';

const grid = document.querySelector('#projects-grid');
const status = document.querySelector('#projects-status');
const dialog = document.querySelector('#project-dialog');
trapDialogFocus(dialog);
const content = document.querySelector('#project-content');
const siteRoot = new URL('./', document.baseURI);
let opener;
let projectNavigationTimer;

setupSoundToggle();
setupContact();
const about = setupAbout();

function setProjectView(view) {
    window.dispatchEvent(new Event('portfolio:viewwillchange'));
    document.body.dataset.view = ['list', 'map'].includes(view) ? view : 'gallery';
    try { sessionStorage.setItem('portfolio-view', document.body.dataset.view); } catch {}
    document.querySelector('#project-canvas').tabIndex = view === 'map' ? 0 : -1;
    document.querySelectorAll('.view-switch [data-view]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.view === document.body.dataset.view));
    });
    window.dispatchEvent(new Event('portfolio:viewchange'));
}
const explicitGallery = new URL(location.href).searchParams.get('view') === 'gallery';
if (explicitGallery) saveBrowseState({pendingReturn:false, selectedId:null, scrollY:0});
try { setProjectView(explicitGallery ? 'gallery' : sessionStorage.getItem('portfolio-view')); }
catch { setProjectView('gallery'); }
let viewTransition;
let requestedView = document.body.dataset.view;
function requestProjectView(view, {home = false} = {}) {
    if (view === requestedView && !home) return;
    window.clearTimeout(projectNavigationTimer);
    saveBrowseState({pendingReturn:false});
    requestedView = view;
    void playSound('select');
    const update = async () => {
        if (view !== requestedView) return;
        window.scrollTo({top: 0, behavior: 'instant'});
        setProjectView(view);
        if (home) grid.scrollTo({left: 0, top: 0, behavior: 'instant'});
        await Promise.all([...grid.querySelectorAll('.project-cover > img')].map(image => image.decode().catch(() => {})));
    };
    viewTransition?.skipTransition();
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        viewTransition = document.startViewTransition(update);
        viewTransition.finished.catch(() => {});
    } else void update();
}
document.querySelectorAll('.view-switch [data-view]').forEach(button => {
    button.addEventListener('click', () => requestProjectView(button.dataset.view));
});
let homeRequest = 0;
document.querySelectorAll('.wordmark,[data-home-gallery]').forEach(link => {
    link.addEventListener('click', async event => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        const request = ++homeRequest;
        await about.close({restoreFocus: false});
        if (request !== homeRequest) return;
        saveBrowseState({pendingReturn: false, selectedId: null, scrollY: 0});
        requestProjectView('gallery', {home: true});
        document.querySelector('.wordmark').focus({preventScroll: true});
    });
});

function localPath(value, directory = '') {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const url = new URL(value, siteRoot);
        const prefix = new URL(directory, siteRoot);
        return url.origin === prefix.origin && url.pathname.startsWith(prefix.pathname)
        && !url.search && !url.hash ? url : null;
    } catch {
        return null;
    }
}

function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text) node.textContent = text;
    return node;
}

function tone(project) {
    return /^[a-z][a-z0-9-]*$/.test(project.id) ? project.id : 'neutral';
}

function createCover(project, tag = 'div') {
    const cover = element(tag, 'project-cover');
    cover.dataset.tone = tone(project);
    if (Number.isFinite(project.coverWidth) && Number.isFinite(project.coverHeight)
        && project.coverWidth > 0 && project.coverHeight > 0) {
        cover.style.setProperty('--cover-ratio', `${project.coverWidth} / ${project.coverHeight}`);
    }
    cover.append(element('span', 'cover-name', project.title), element('span', 'cover-note', 'Временная обложка'));
    const imageUrl = localPath(project.cover, 'assets/');
    if (imageUrl) {
        const image = document.createElement('img');
        image.alt = typeof project.coverAlt === 'string' ? project.coverAlt : '';
        image.decoding = 'async';
        image.draggable = false;
        if (project.coverWidth > 0 && project.coverHeight > 0) {
            image.width = project.coverWidth;
            image.height = project.coverHeight;
        }
        image.addEventListener('load', () => {
            cover.style.setProperty('--cover-ratio', `${image.naturalWidth} / ${image.naturalHeight}`);
            cover.classList.add('has-image');
            cover.replaceChildren(image);
        }, {once: true});
        image.style.viewTransitionName = `project-${tone(project)}`;
        if (project.coverSources) image.srcset = project.coverSources.filter(source => localPath(source.src, 'assets/') !== null).map(source => `${localPath(source.src).href} ${source.width}w`).join(', ');
        image.sizes = '(max-width:900px) 76vw, (max-width:1440px) 30vw, 420px';
        image.src = imageUrl.href;
    }
    return cover;
}

function openProject(project, button) {
    window.clearTimeout(projectNavigationTimer);
    saveBrowseState({pendingReturn:false});
    opener = button;
    const title = element('h2', '', project.title);
    title.id = 'project-title';
    const description = element('p', 'project-description', project.description);
    const info = element('div', 'project-details');
    info.append(title, description);
    const stack = Array.isArray(project.technologies) ? project.technologies.filter(item => typeof item === 'string') : [];
    const technologies = element('ul', 'project-technologies');
    technologies.setAttribute('aria-label', 'Технологии');
    (stack.length ? stack : ['Стек уточняется']).forEach(item => technologies.append(element('li', '', item)));
    info.append(technologies);
    const caseUrl = localPath(project.caseUrl);
    if (caseUrl && /\.html$/.test(caseUrl.pathname)) {
        void fetch(caseUrl, {method: 'HEAD'}).then(response => {
            if (response.ok && content.contains(info)) {
                const link = element('a', 'case-link', 'Смотреть полный кейс');
                link.href = caseUrl.href;
                info.append(link);
            }
        }).catch(() => {
        });
    }
    try {
        const website = new URL(project.siteUrl);
        if (['https:', 'http:'].includes(website.protocol)) {
            const link = element('a', 'case-link', 'Открыть сайт');
            link.href = website.href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            info.append(link);
        }
    } catch { /* A draft project may not have a public website yet. */ }
    content.replaceChildren(createCover(project), info);
    dialog.showModal();
    dialog.scrollTop = 0;
    document.body.classList.add('project-open');
    void playSound();
}

function closeProject() {
    dialog.close();
}

window.addEventListener('portfolio:overlayopen', () => {window.clearTimeout(projectNavigationTimer);saveBrowseState({pendingReturn:false});});

document.querySelector('#close-project').addEventListener('click', closeProject);
dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeProject();
});
dialog.addEventListener('close', () => {
    document.body.classList.remove('project-open');
    opener?.focus({preventScroll: true});
    void playSound('close');
});

function createProject(project, existing) {
    const article = existing || element('article', 'project');
    article.dataset.category = typeof project.category === 'string' && project.category.trim() ? project.category.trim() : 'Сайты';
    const caseUrl = localPath(project.caseUrl);
    const hasCase = caseUrl && /\.html$/.test(caseUrl.pathname);
    article.dataset.projectId = project.id;
    let button = existing?.querySelector('.project-cover') || createCover(project, hasCase ? 'a' : 'button');
    const tag = hasCase ? 'a' : 'button';
    if (button.localName !== tag) {
        const replacement = document.createElement(tag);
        for (const {name, value} of [...button.attributes]) {
            if (!['href', 'target', 'rel', 'type'].includes(name)) replacement.setAttribute(name, value);
        }
        replacement.append(...button.childNodes);
        button.replaceWith(replacement);
        button = replacement;
    }
    const previewUrl = localPath(project.preview, 'assets/');
    if (previewUrl) button.dataset.preview = previewUrl.href;
    button.draggable = false;
    const artworkImage = button.querySelector(':scope > img');
    if (artworkImage) artworkImage.draggable = false;
    button.dataset.title = project.title;
    button.dataset.description = project.description;
    button.setAttribute('aria-label', `Открыть проект ${project.title}`);
    if (hasCase) {
        button.href = caseUrl.href;
        button.addEventListener('click', event => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            window.clearTimeout(projectNavigationTimer);
            saveBrowseState({selectedId: project.id, pendingReturn: true, scrollY: window.scrollY});
            if (playSound('open')) {
                // Let the short press finish before the browser unloads its AudioContext.
                event.preventDefault();
                projectNavigationTimer = window.setTimeout(() => window.location.assign(caseUrl.href), 120);
            }
        });
    } else {
        button.type = 'button';
        button.setAttribute('aria-haspopup', 'dialog');
        button.addEventListener('click', () => openProject(project, button));
    }
    button.addEventListener('pointerenter', event => {
        if (event.pointerType === 'mouse') void playSound('hover');
    });
    if (!existing) {
        const caption = element('div', 'project-caption');
        caption.append(element('span', 'project-caption-title', project.title),
            element('span', 'project-caption-description', project.description));
        article.append(button, caption);
    }
    return article;
}

async function readProjects() {
    const embedded = document.querySelector('#project-data');
    const response = embedded ? null : await fetch(new URL('./data/projects.json', siteRoot));
    if (response && !response.ok) throw new Error(`Projects HTTP ${response.status}`);
    const projects = embedded ? JSON.parse(embedded.textContent) : await response.json();
    if (!Array.isArray(projects)) throw new TypeError('Expected an array of projects');
    return projects;
}

async function loadProjects() {
    try {
        const projects = await readProjects();
        const valid = projects.filter(project => project && typeof project.title === 'string' && typeof project.description === 'string');
        const existing = new Map([...grid.querySelectorAll('.project')].map(article => [article.dataset.projectId, article]));
        grid.replaceChildren(...valid.map(project => createProject(project, existing.get(project.id))));
        setupProjectMap(grid);
        setupGalleryFlow(grid);
        setupProjectMotion(grid, dialog);
        const updateSizes = () => valid.forEach(project => {
            const image = [...grid.children].find(article => article.dataset.projectId === project.id)?.querySelector('.project-cover > img');
            if (!image) return;
            const map = document.body.dataset.view === 'map' && project.mapCoverSources?.length;
            const sources = map ? project.mapCoverSources : project.coverSources;
            const sizes = document.body.dataset.view === 'list' ? '108px' : map ? '220px' : '(max-width:900px) 76vw, (max-width:1440px) 30vw, 420px';
            const srcset = (sources || []).filter(source => localPath(source.src,'assets/') !== null).map(source=>`${localPath(source.src).href} ${source.width}w`).join(', ');
            if (image.getAttribute('sizes') !== sizes) image.sizes = sizes;
            if (image.srcset !== srcset) image.srcset = srcset;
            const src = localPath(map ? project.mapCover : project.cover, 'assets/');
            if (src && image.src !== src.href) image.src = src.href;
        });
        window.addEventListener('portfolio:viewchange', updateSizes);
        updateSizes();
        const saved = readBrowseState();
        if (saved.pendingReturn) {
            const target = [...grid.children].find(article => article.dataset.projectId === saved.selectedId)?.querySelector('.project-cover');
            if (document.body.dataset.view === 'gallery' && target && grid.scrollWidth > grid.clientWidth) {
                const box = target.getBoundingClientRect();
                const frame = grid.getBoundingClientRect();
                grid.scrollBy({left:box.left + box.width / 2 - frame.left - frame.width / 2,behavior:'instant'});
            }
            if (document.body.dataset.view === 'list') window.scrollTo({top: saved.scrollY || 0, behavior:'instant'});
            if (target && !target.closest('[hidden]')) target.focus({preventScroll:true});
            saveBrowseState({pendingReturn:false});
        }
        status.hidden = valid.length > 0;
        status.textContent = valid.length ? '' : 'Проекты скоро появятся';
    } catch (error) {
        status.textContent = 'Не удалось загрузить проекты - попробуйте обновить страницу';
        console.error('Не удалось загрузить проекты:', error);
    }
}

void loadProjects();
