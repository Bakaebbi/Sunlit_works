import {gsap} from 'gsap';

// The hit area stays still while only the artwork follows the pointer.
export function setupProjectMotion(grid, dialog) {
    const media = gsap.matchMedia();
    media.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
        const controller = new AbortController();
        const options = {signal: controller.signal};
        const label = document.createElement('div');
        label.className = 'project-pointer-label';
        label.setAttribute('aria-hidden', 'true');
        const title = document.createElement('span');
        const detail = document.createElement('span');
        detail.className = 'project-pointer-detail';
        label.append(title, detail);
        document.body.append(label);

        const labelX = gsap.quickTo(label, 'x', {duration: .35, ease: 'power3.out'});
        const labelY = gsap.quickTo(label, 'y', {duration: .35, ease: 'power3.out'});
        let active;
        const entries = [...grid.querySelectorAll('.project')].map(article => {
            const cover = article.querySelector('.project-cover');
            const follow = Object.fromEntries(['x', 'y'].map(property => [
                property, gsap.quickTo(cover, property, {duration: .65, ease: 'power3.out'}),
            ]));
            return {article, cover, follow, preview: null, playback: null};
        });

        function showPreview(entry) {
            if (!entry.cover.dataset.preview) return;
            if (!entry.preview) {
                const frame = document.createElement('span');
                frame.className = 'project-preview';
                frame.setAttribute('aria-hidden', 'true');
                const image = new Image();
                image.alt = '';
                image.decoding = 'async';
                frame.append(image);
                entry.preview = frame;
                image.addEventListener('load', () => {
                    if (controller.signal.aborted) return;
                    entry.cover.append(frame);
                    entry.playback = gsap.timeline({paused: true, repeat: -1, yoyo: true, repeatDelay: 1})
                        .to(image, {
                            y: () => -Math.min(Math.max(0, image.offsetHeight - frame.clientHeight), frame.clientHeight * 1.5),
                            scale: 1.025, transformOrigin: '50% 0%',
                            duration: 6, ease: 'power1.inOut', delay: .6,
                        });
                    if (active === entry) showPreview(entry);
                }, {once: true, signal: controller.signal});
                image.src = entry.cover.dataset.preview;
            }
            if (!entry.playback) return;
            void gsap.fromTo(entry.preview, {clipPath: 'inset(4% 4% 4% 4%)'}, {opacity: 1, clipPath: 'inset(0% 0% 0% 0%)', duration: .65, ease: 'power3.out', overwrite: true});
            void entry.playback.play();
        }

        function release() {
            if (active) {
                Object.values(active.follow).forEach(move => move(0));

                if (active.preview && active.playback) {
                    const entry = active;
                    entry.playback.pause();
                    void gsap.to(entry.preview, {opacity: 0, duration: .25, overwrite: true,
                        onComplete: () => entry.playback.pause(0),
                    });
                }
                active.article.classList.remove('is-active');
                active = null;
            }
            void gsap.to(label, {opacity: 0, duration: .18, overwrite: 'auto'});
        }

        function moveLabel(event, immediate = false) {
            const box = label.getBoundingClientRect();
            const x = Math.max(12, Math.min(event.clientX + 20, innerWidth - box.width - 12));
            const y = Math.max(12, Math.min(event.clientY + 22, innerHeight - box.height - 12));
            if (immediate) {
                void labelX(x, x);
                void labelY(y, y);
            } else {
                void labelX(x);
                void labelY(y);
            }
        }

        for (const entry of entries) {
            const {article, cover, follow} = entry;
            article.addEventListener('pointerenter', event => {
                if (event.pointerType !== 'mouse' || dialog.open || document.body.dataset.view === 'list') return;
                release();
                active = entry;
                article.classList.add('is-active');
                showPreview(entry);
                title.textContent = cover.dataset.title;
                detail.textContent = cover.dataset.description;
                moveLabel(event, true);
                void gsap.to(label, {opacity: 1, duration: .25, overwrite: 'auto'});

            }, options);
            article.addEventListener('pointermove', event => {
                if (active !== entry || event.pointerType !== 'mouse') return;
                const rect = article.getBoundingClientRect();
                const x = Math.max(-.5, Math.min(.5, (event.clientX - rect.left) / rect.width - .5));
                const y = Math.max(-.5, Math.min(.5, (event.clientY - rect.top) / rect.height - .5));
                void follow.x(x * 14);
                void follow.y(y * 12);
                moveLabel(event);
            }, options);
            article.addEventListener('pointerleave', () => {
                if (active === entry) release();
            }, options);
            cover.addEventListener('click', release, options);
            cover.addEventListener('blur', release, options);
        }
        window.addEventListener('resize', () => {
            release();
            entries.forEach(entry => entry.playback?.invalidate());
        }, options);
        window.addEventListener('portfolio:viewchange', release, options);
        window.addEventListener('portfolio:overlayopen', release, options);
        window.addEventListener('blur', release, options);
        window.addEventListener('scroll', release, {...options, passive: true});
        document.addEventListener('visibilitychange', release, options);

        return () => {
            controller.abort();
            for (const {article, cover, follow, preview, playback} of entries) {
                article.classList.remove('is-active');
                playback?.kill();
                if (preview) {
                    gsap.killTweensOf(preview);
                    preview.remove();
                }
                Object.values(follow).forEach(move => move.tween.kill());
                gsap.killTweensOf(cover);
                void gsap.set(cover, {clearProps: 'transform'});
            }
            gsap.killTweensOf(label);
            label.remove();
        };
    });
    return () => media.revert();
}
