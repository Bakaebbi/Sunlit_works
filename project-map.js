import {playSound} from './sounds.js';
import {readBrowseState, saveBrowseState} from './browse-state.js';
import {gsap} from 'gsap';

export function setupProjectMap(grid) {
    const canvas = document.querySelector('#project-canvas');
    const scene = document.querySelector('#map-scene');
    const branches = scene.querySelector('.map-branches');
    const svg = scene.querySelector('.map-lines');
    const articles = [...grid.querySelectorAll('.project')];
    const groups = new Map();
    articles.forEach(article => {
        const name = article.dataset.category;
        if (!groups.has(name)) groups.set(name, []);
        groups.get(name).push(article);
    });
    const remembered = readBrowseState().map;
    const collapsed = new Set(Array.isArray(remembered?.collapsed) ? remembered.collapsed.filter(name => groups.has(name)) : []);
    let initialized = false;
    let lastSize;
    let verticalLayout;
    const links = new Map();
    const pointers = new Map();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const zoomIn = document.querySelector('#map-in');
    const zoomOut = document.querySelector('#map-out');
    let world = {width: 1080, height: 760};
    let view = {x: 0, y: 0, scale: 1};
    let gesture;
    let dragged = false;
    const focusButtons = document.createElement('div');
    focusButtons.className = 'map-focus';
    focusButtons.setAttribute('role', 'group');
    focusButtons.setAttribute('aria-label', 'Приблизить проект на карте');
    document.querySelector('.map-tools').before(focusButtons);
    const focusArticle = article => {
        if (!active() || article.hidden) return;
        const cover = article.querySelector('.project-cover');
        document.querySelector('#current-project').textContent = `${cover.dataset.title} - ${cover.dataset.description}`;
        const x = parseFloat(article.style.getPropertyValue('--map-x'));
        const y = parseFloat(article.style.getPropertyValue('--map-y'));
        view.scale = Math.max(1, view.scale);
        view.x = canvas.clientWidth / 2 - (x + 110) * view.scale;
        view.y = canvas.clientHeight / 2 - (y + 96) * view.scale;
        render(true);
        focusButtons.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.projectId === article.dataset.projectId)));
    };
    articles.forEach(article => {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.projectId = article.dataset.projectId;
        button.textContent = article.querySelector('.project-cover').dataset.title;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {void playSound('select');focusArticle(article);});
        focusButtons.append(button);
    });
    const active = () => document.body.dataset.view === 'map';
    const duration = value => reduced.matches ? 0 : value;
    const clampScale = value => Math.max(.25, Math.min(2.4, value));

    function render(animate = false) {
        view.x = Math.max(48 - world.width * view.scale, Math.min(canvas.clientWidth - 48, view.x));
        view.y = Math.max(48 - world.height * view.scale, Math.min(canvas.clientHeight - 48, view.y));
        void gsap.to(scene, {...view, duration: animate ? duration(.45) : 0, ease: 'power3.out', overwrite: true});
        zoomIn.disabled = view.scale >= 2.4;
        zoomOut.disabled = view.scale <= .25;
    }

    function fit() {
        if (!active() || !canvas.clientWidth || !canvas.clientHeight) return;
        view.scale = clampScale(Math.min((canvas.clientWidth - 28) / world.width, (canvas.clientHeight - 28) / world.height, 1));
        view.x = (canvas.clientWidth - world.width * view.scale) / 2;
        view.y = (canvas.clientHeight - world.height * view.scale) / 2;
        render(true);
    }

    function zoom(factor, x = canvas.clientWidth / 2, y = canvas.clientHeight / 2) {
        const scale = clampScale(view.scale * factor);
        const ratio = scale / view.scale;
        view.x = x - (x - view.x) * ratio;
        view.y = y - (y - view.y) * ratio;
        view.scale = scale;
        render(true);
    }

    function path(d, category, article) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.setAttribute('d', d);
        if (category) line.dataset.category = category;
        svg.append(line);
        if (article) links.set(article, line);
        return line;
    }

    function draw(lines) {
        if (reduced.matches) return;
        lines.forEach((line, index) => {
            const length = line.getTotalLength();
            void gsap.fromTo(line, {strokeDasharray: length, strokeDashoffset: length}, {
                strokeDashoffset: 0, duration: .8, delay: index * .04, ease: 'power2.out',
                clearProps: 'strokeDasharray,strokeDashoffset', overwrite: true,
            });
        });
    }

    function toggleCategory(name, button) {
        const closing = !collapsed.has(name);
        void playSound(closing ? 'collapse' : 'expand');
        if (closing) collapsed.add(name); else collapsed.delete(name);
        button.setAttribute('aria-expanded', String(!closing));
        focusButtons.querySelectorAll('button').forEach(item => {if (groups.get(name).some(article => article.dataset.projectId === item.dataset.projectId)) item.disabled = closing;});
        const members = groups.get(name);
        const lines = members.map(article => links.get(article));
        gsap.killTweensOf([...members, ...lines]);
        if (closing) {
            members.forEach(article => article.inert = true);
            void gsap.to(members, {opacity: 0, x: -12, duration: duration(.25), overwrite: true,
                onComplete: () => {if (active() && collapsed.has(name)) members.forEach(article => article.hidden = true);},
            });
            void gsap.to(lines, {opacity: 0, duration: duration(.25)});
        } else {
            members.forEach(article => {article.hidden = false; article.inert = false;});
            void gsap.fromTo(members, {opacity: 0, x: -12}, {opacity: 1, x: 0, duration: duration(.6), stagger: reduced.matches ? 0 : .06, ease: 'power3.out', overwrite: true});
            void gsap.set(lines, {opacity: 1});
            draw(lines);
        }
    }

    function node(text, x, y, width, root = false) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `map-node${root ? ' map-root' : ''}`;
        button.textContent = text;
        Object.assign(button.style, {left: `${x}px`, top: `${y}px`, width: `${width}px`});
        branches.append(button);
        return button;
    }

    function layout() {
        if (!active()) return;
        gsap.killTweensOf([...articles, ...svg.children]);
        branches.replaceChildren();
        svg.replaceChildren();
        links.clear();
        const vertical = canvas.clientWidth < 900;
        const height = vertical ? Math.max(620, articles.length * 220 + groups.size * 130 + 130) : Math.max(560, articles.length * 220 + groups.size * 60 + 40);
        world = {width: vertical ? 440 : 1080, height};
        Object.assign(scene.style, {width: `${world.width}px`, height: `${world.height}px`});
        svg.setAttribute('viewBox', `0 0 ${world.width} ${world.height}`);
        const rootY = vertical ? 20 : height / 2 - 26;
        const root = node('Sunlit Works', vertical ? 140 : 80, rootY, 160, true);
        root.setAttribute('aria-label', 'Вписать всю карту Sunlit Works');
        root.addEventListener('click', () => {void playSound('reset');fit();});
        let cursor = vertical ? 145 : 60;
        for (const [name, members] of groups) {
            const center = vertical ? cursor + 26 : cursor + (members.length - 1) * 110 + 74;
            const categoryY = vertical ? cursor : center - 26;
            const category = node(name, vertical ? 155 : 390, categoryY, 130);
            category.setAttribute('aria-expanded', String(!collapsed.has(name)));
            category.setAttribute('aria-controls', 'projects-grid');
            category.addEventListener('click', () => toggleCategory(name, category));
            path(vertical
                ? `M220,72 C220,110 220,${categoryY - 30} 220,${categoryY}`
                : `M240,${rootY + 26} C310,${rootY + 26} 310,${center} 390,${center}`);
            members.forEach((article, index) => {
                const x = vertical ? 110 : 760;
                const y = vertical ? cursor + 130 + index * 220 : cursor + index * 220;
                article.style.setProperty('--map-x', `${x}px`);
                article.style.setProperty('--map-y', `${y}px`);
                void gsap.set(article, {clearProps: 'transform,opacity'});
                article.hidden = collapsed.has(name);
                article.inert = collapsed.has(name);
                const line = path(vertical
                    ? `M220,${categoryY + 52} C220,${categoryY + 100} 38,${y + 74} ${x},${y + 74}`
                    : `M520,${center} C630,${center} 650,${y + 74} ${x},${y + 74}`, name, article);
                if (collapsed.has(name)) line.style.opacity = '0';
            });
            cursor += members.length * 220 + (vertical ? 130 : 60);
        }
        const size = {width: canvas.clientWidth, height: canvas.clientHeight, vertical};
        if (!initialized && remembered && remembered.vertical === vertical && [remembered.x, remembered.y, remembered.scale, remembered.width, remembered.height].every(Number.isFinite)) {
            view = {x: remembered.x + (size.width - remembered.width) / 2, y: remembered.y + (size.height - remembered.height) / 2, scale: clampScale(remembered.scale)};
            render();
        } else if (initialized && lastSize?.vertical === vertical) {
            view.x += (size.width - lastSize.width) / 2;
            view.y += (size.height - lastSize.height) / 2;
            render();
        } else if (vertical) {
            view = {scale: 1, x: canvas.clientWidth / 2 - 220, y: 16};
            render();
        } else fit();
        lastSize = size;
        verticalLayout = vertical;
        initialized = true;
        focusButtons.querySelectorAll('button').forEach(button => button.disabled = collapsed.has(articles.find(article => article.dataset.projectId === button.dataset.projectId)?.dataset.category));
        draw([...svg.children].filter(line => line.style.opacity !== '0'));
    }

    articles.forEach(article => {
        const highlight = value => links.get(article)?.classList.toggle('is-active', value);
        article.addEventListener('pointerenter', () => {if (active()) highlight(true);});
        article.addEventListener('pointerleave', () => highlight(false));
        article.addEventListener('focusin', () => highlight(true));
        article.addEventListener('focusout', () => highlight(false));
    });
    zoomIn.addEventListener('click', () => {void playSound('zoomIn');zoom(1.25);});
    zoomOut.addEventListener('click', () => {void playSound('zoomOut');zoom(.8);});
    document.querySelector('#map-fit').addEventListener('click', () => {void playSound('reset');fit();});
    canvas.addEventListener('wheel', event => {
        if (!active()) return;
        event.preventDefault();
        const box = canvas.getBoundingClientRect();
        zoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * .004), event.clientX - box.left, event.clientY - box.top);
    }, {passive: false});

    function beginGesture() {
        const points = [...pointers.values()];
        if (!points.length) {gesture = null;return;}
        const box = canvas.getBoundingClientRect();
        const second = points[1] || points[0];
        gesture = {x: view.x, y: view.y, scale: view.scale,
            cx: (points[0].x + second.x) / 2 - box.left,
            cy: (points[0].y + second.y) / 2 - box.top,
            distance: Math.hypot(second.x - points[0].x, second.y - points[0].y),
        };
    }
    canvas.addEventListener('pointerdown', event => {
        if (!active() || event.button !== 0) return;
        if (!pointers.size) dragged = false;
        pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
        event.target.setPointerCapture(event.pointerId);
        gsap.killTweensOf(scene);
        const matrix = new DOMMatrixReadOnly(getComputedStyle(scene).transform);
        view = {x: matrix.e, y: matrix.f, scale: matrix.a};
        beginGesture();
    });
    canvas.addEventListener('pointermove', event => {
        if (!active() || !pointers.has(event.pointerId) || !gesture) return;
        pointers.set(event.pointerId, {x: event.clientX, y: event.clientY});
        const points = [...pointers.values()];
        const second = points[1] || points[0];
        const box = canvas.getBoundingClientRect();
        const cx = (points[0].x + second.x) / 2 - box.left;
        const cy = (points[0].y + second.y) / 2 - box.top;
        const distance = Math.hypot(second.x - points[0].x, second.y - points[0].y);
        const scale = points.length > 1 && gesture.distance ? clampScale(gesture.scale * distance / gesture.distance) : gesture.scale;
        if (Math.hypot(cx - gesture.cx, cy - gesture.cy) > 5 || points.length > 1) dragged = true;
        if (!dragged) return;
        canvas.classList.add('is-dragging');
        view = {scale, x: cx - (gesture.cx - gesture.x) * scale / gesture.scale, y: cy - (gesture.cy - gesture.y) * scale / gesture.scale};
        render();
    });
    const endPointer = event => {
        pointers.delete(event.pointerId);
        if (!pointers.size) canvas.classList.remove('is-dragging');
        beginGesture();
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('click', event => {
        if (active() && dragged) {event.preventDefault();event.stopImmediatePropagation();dragged = false;}
    }, true);
    canvas.addEventListener('dragstart', event => {if (active()) event.preventDefault();});
    canvas.addEventListener('keydown', event => {
        if (!active() || event.target !== canvas) return;
        if (['+', '='].includes(event.key)) zoom(1.2);
        else if (event.key === '-') zoom(1 / 1.2);
        else if (['Home', '0'].includes(event.key)) fit();
        else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
            view.x += event.key === 'ArrowLeft' ? 48 : event.key === 'ArrowRight' ? -48 : 0;
            view.y += event.key === 'ArrowUp' ? 48 : event.key === 'ArrowDown' ? -48 : 0;
            render(true);
        } else return;
        if (!event.repeat) void playSound(['+', '='].includes(event.key) ? 'zoomIn' : event.key === '-' ? 'zoomOut' : ['Home', '0'].includes(event.key) ? 'reset' : 'select');
        event.preventDefault();
    });
    canvas.addEventListener('focusin', event => {
        if (!active() || event.target === canvas) return;
        const box = event.target.getBoundingClientRect();
        const frame = canvas.getBoundingClientRect();
        if (box.left < frame.left || box.right > frame.right || box.top < frame.top || box.bottom > frame.bottom) {
            view.x += frame.left + frame.width / 2 - box.left - box.width / 2;
            view.y += frame.top + frame.height / 2 - box.top - box.height / 2;
            render(true);
        }
    });
    function changeView() {
        pointers.clear();
        gesture = null;
        canvas.classList.remove('is-dragging');
        gsap.killTweensOf([...articles, ...svg.children]);
        articles.forEach(article => {
            article.hidden = false;
            article.inert = false;
            void gsap.set(article, {clearProps: 'transform,opacity'});
        });
        if (active()) layout();
    }
    window.addEventListener('portfolio:capturestate', event => {
        if (!initialized) return;
        event.detail.map = {...view, collapsed: [...collapsed], vertical: verticalLayout, width: lastSize.width, height: lastSize.height};
    });
    window.addEventListener('portfolio:viewwillchange', () => {if (active()) saveBrowseState();});
    window.addEventListener('portfolio:viewchange', changeView);
    new ResizeObserver(() => {if (active()) layout();}).observe(canvas);
    reduced.addEventListener('change', () => {
        gsap.killTweensOf([...svg.children, ...articles, scene]);
        if (active()) {layout();render();}
    });
    if (active()) layout();
}
