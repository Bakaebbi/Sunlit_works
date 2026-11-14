import {playSound} from './sounds.js';
import {readBrowseState} from './browse-state.js';
import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// One visual canvas on desktop, native horizontal browsing on touch screens.
export function setupGalleryFlow(grid) {
    const footer = document.querySelector('#current-project');
    const articles = [...grid.querySelectorAll('.project')];
    const previous = document.querySelector('#gallery-prev');
    const next = document.querySelector('#gallery-next');
    const describe = article => {
        const cover = article?.querySelector('.project-cover');
        if (footer && cover) footer.textContent = `${cover.dataset.title} - ${cover.dataset.description}`;
    };
    const update = () => {
        const max = grid.scrollWidth - grid.clientWidth;
        previous.disabled = grid.scrollLeft < 2;
        next.disabled = grid.scrollLeft >= max - 2;
        if (['list', 'map'].includes(document.body.dataset.view)) {
            footer.textContent = 'Избранные проекты';
            return;
        }
        if (max > 2) {
            const center = grid.getBoundingClientRect().left + grid.clientWidth / 2;
            const nearest = articles.reduce((best, article) => {
                const distance = node => {const box = node.getBoundingClientRect();return Math.abs(box.left + box.width / 2 - center);};
                return distance(article) < distance(best) ? article : best;
            }, articles[0]);
            describe(nearest);
        }
    };
    describe(articles.find(article => article.dataset.projectId === readBrowseState().selectedId) || articles[0]);
    articles.forEach(article => {
        article.addEventListener('pointerenter', () => describe(article));
        article.addEventListener('focusin', () => describe(article));
    });
    const browse = direction => {
        const center = grid.getBoundingClientRect().left + grid.clientWidth / 2;
        const distance = article => {const box = article.getBoundingClientRect();return Math.abs(box.left + box.width / 2 - center);};
        const nearest = articles.reduce((best, article) => distance(article) < distance(best) ? article : best, articles[0]);
        const target = articles[Math.max(0, Math.min(articles.length - 1, articles.indexOf(nearest) + direction))];
        if (target !== nearest) void playSound('select');
        const box = target.getBoundingClientRect();
        const frame = grid.getBoundingClientRect();
        grid.scrollBy({left: box.left + box.width / 2 - frame.left - grid.clientWidth / 2,
            behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    };
    previous.addEventListener('click', () => browse(-1));
    next.addEventListener('click', () => browse(1));
    grid.addEventListener('scroll', update, {passive: true});
    const resize = new ResizeObserver(update);
    resize.observe(grid);
    window.addEventListener('portfolio:viewchange', update);

    const media = gsap.matchMedia();
    media.add('(min-width: 901px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
        const reset = () => {void gsap.to(articles, {x: 0, y: 0, duration: 1, ease: 'power3.out', overwrite: 'auto'});};
        const move = event => {
            if (document.body.dataset.view !== 'gallery') return;
            const x = event.clientX / innerWidth - .5;
            const y = event.clientY / innerHeight - .5;
            articles.forEach((article, index) => {
                const depth = [12, 20, 15][index % 3];
                void gsap.to(article, {x: x * depth, y: y * depth, duration: 1.1, ease: 'power3.out', overwrite: 'auto'});
            });
        };
        grid.addEventListener('pointermove', move);
        grid.addEventListener('pointerleave', reset);
        window.addEventListener('portfolio:viewchange', reset);
        return () => {
            grid.removeEventListener('pointermove', move);
            grid.removeEventListener('pointerleave', reset);
            window.removeEventListener('portfolio:viewchange', reset);
            gsap.killTweensOf(articles);
            void gsap.set(articles, {clearProps: 'transform'});
        };
    });
    update();
    return () => {media.revert();resize.disconnect();window.removeEventListener('portfolio:viewchange', update);};
}

export function setupCaseFlow() {
    const media = gsap.matchMedia();
    media.add('(prefers-reduced-motion: no-preference)', () => {
        const elements = [...document.querySelectorAll('.case-main > :not(.cover)')];
        for (const element of elements) {
            void gsap.fromTo(element, {y: 32, opacity: 0}, {
                y: 0, opacity: 1, duration: .9, ease: 'power3.out',
                scrollTrigger: {trigger: element, start: 'top 94%', once: true},
                clearProps: 'transform,opacity',
            });
        }
        const refresh = () => ScrollTrigger.refresh();
        document.querySelector('.case-main')?.addEventListener('load', refresh, true);
        const revealFocus = event => {
            const section = elements.find(element => element.contains(event.target));
            if (section) {
                gsap.getTweensOf(section).forEach(tween => tween.progress(1));
                void gsap.set(section, {clearProps: 'transform,opacity'});
            }
        };
        document.addEventListener('focusin', revealFocus);
        return () => {
            document.querySelector('.case-main')?.removeEventListener('load', refresh, true);
            document.removeEventListener('focusin', revealFocus);
        };
    });
    return () => media.revert();
}
