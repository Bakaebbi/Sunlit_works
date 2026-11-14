import {saveBrowseState} from './browse-state.js';
import {setupCaseFlow} from './page-motion.js';
import {playSound, setupSoundToggle} from './sounds.js';

const currentProject = document.querySelector('.case-visual.cover')?.dataset.project;
if (currentProject) saveBrowseState({selectedId: currentProject, pendingReturn: true});
setupSoundToggle();
setupCaseFlow();
let navigationTimer;
document.querySelector('.case-switcher').addEventListener('click', event => {
    const link = event.target.closest('a.case-switch');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.getAttribute('aria-current') === 'page') {
        event.preventDefault();
        return;
    }
    window.clearTimeout(navigationTimer);
    if (playSound('navigate')) {
        event.preventDefault();
        navigationTimer = window.setTimeout(() => window.location.assign(link.href), 110);
    }
});

// Keep the closing tone audible before returning to the gallery.
document.querySelector('.case-close')?.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    window.clearTimeout(navigationTimer);
    if (playSound('close')) {
        event.preventDefault();
        const href = event.currentTarget.href;
        navigationTimer = window.setTimeout(() => window.location.assign(href), 110);
    }
});

// Both visible project actions and the cover preserve native new-tab behaviour.
document.querySelectorAll('.case-site-link,.case-cover-link').forEach(link => {
    link.addEventListener('click', () => void playSound('external'));
});
