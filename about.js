import {trapDialogFocus} from './dialog-focus.js';
import {gsap} from 'gsap';
import {playSound} from './sounds.js';

export function setupAbout() {
    const trigger = document.querySelector('#about-trigger');
    const dialog = document.querySelector('#about-dialog');
    const closeButton = document.querySelector('#about-close');
    const sections = [...dialog.querySelectorAll('.about-section')];
    trapDialogFocus(dialog);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let closing = null;
    let finishClose;
    let opener;
    const duration = value => reduced.matches ? 0 : value;

    function open() {
        if (dialog.open || closing) return;
        opener = document.activeElement;
        dialog.showModal();
        dialog.scrollTop = 0;
        document.body.classList.add('about-open');
        trigger.setAttribute('aria-expanded','true');
        window.dispatchEvent(new Event('portfolio:overlayopen'));
        void playSound('expand');
        void gsap.fromTo(dialog, {opacity:0,backdropFilter:'blur(0px)'}, {opacity:1,backdropFilter:reduced.matches?'none':'blur(40px)',duration:duration(.7),ease:'power3.out',overwrite:true});
        void gsap.fromTo(sections, {opacity:0,y:16,filter:'blur(6px)'}, {opacity:1,y:0,filter:'blur(0px)',duration:duration(.65),delay:duration(.1),stagger:reduced.matches?0:.055,ease:'power3.out',overwrite:true});
        closeButton.focus({preventScroll:true});
    }
    function close({restoreFocus = true} = {}) {
        if (closing) return closing;
        if (!dialog.open) return Promise.resolve();
        closing = new Promise(resolve => finishClose = resolve);
        const result = closing;
        void playSound('collapse');
        gsap.killTweensOf(sections);
        const complete = () => {
            if (dialog.open) dialog.close();
            trigger.setAttribute('aria-expanded','false');
            document.body.classList.remove('about-open');
            const resolve = finishClose;
            finishClose = null;
            closing = null;
            if (restoreFocus && opener?.isConnected) opener.focus({preventScroll:true});
            resolve?.();
        };
        void gsap.to(dialog, {opacity:0,backdropFilter:'blur(0px)',duration:duration(.25),ease:'power2.out',overwrite:true,onComplete:complete});
        return result;
    }
    trigger.addEventListener('click', open);
    closeButton.addEventListener('click', () => void close());
    dialog.addEventListener('cancel', event => {event.preventDefault();void close();});
    dialog.addEventListener('click', event => {if (event.target === dialog) void close();});
    dialog.addEventListener('close', () => {
        trigger.setAttribute('aria-expanded','false');
        document.body.classList.remove('about-open');
    });
    reduced.addEventListener('change', () => {
        if (closing) {gsap.getTweensOf(dialog).forEach(tween => tween.progress(1));return;}
        if (!dialog.open) return;
        gsap.killTweensOf([dialog,...sections]);
        void gsap.set(dialog,{opacity:1,backdropFilter:reduced.matches?'none':'blur(40px)'});
        void gsap.set(sections,{opacity:1,y:0,filter:'none'});
    });
    return {close};
}
