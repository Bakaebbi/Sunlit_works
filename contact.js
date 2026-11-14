import {playSound} from './sounds.js';
import {gsap} from 'gsap';

export function setupContact() {
    const contact = document.querySelector('.contact');
    if (!contact) return;
    const trigger = contact.querySelector('.contact-trigger');
    const pill = contact.querySelector('.contact-pill');
    const copy = contact.querySelector('.contact-copy');
    const label = contact.querySelector('.contact-copy-label');
    const status = contact.querySelector('.contact-status');
    const check = contact.querySelector('.contact-check path');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const email = 'sunlit.tile@gmail.com';
    let open = false;
    let pinned = false;
    let timer;
    let busy = false;
    const duration = value => reduced.matches ? 0 : value;
    trigger.setAttribute('role', 'button');
    trigger.setAttribute('aria-label', `Контакты: скопировать почту ${email}`);

    function setCopied(copied) {
        label.textContent = copied ? 'Скопировано' : 'Копировать';
        copy.setAttribute('aria-label', copied ? `Скопировано. Повторно копировать почту ${email}` : `Копировать почту ${email}`);
        if (copied) contact.dataset.copied = 'true';
        else delete contact.dataset.copied;
    }
    setCopied(false);

    function show() {
        if (open) return;
        open = true;
        pill.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        gsap.killTweensOf(pill);
        void gsap.fromTo(pill, {opacity: 0, scale: .94, y: -3, filter: 'blur(4px)'}, {
            opacity: 1, scale: 1, y: 0, filter: 'blur(0px)',
            duration: duration(.45), ease: 'power3.out', overwrite: true,
        });
    }
    function hide() {
        open = false;
        pinned = false;
        trigger.setAttribute('aria-expanded', 'false');
        void gsap.to(pill, {opacity: 0, scale: .97, y: -2, filter: 'blur(3px)',
            duration: duration(.2), ease: 'power2.out', overwrite: true,
            onComplete: () => {if (!open) pill.hidden = true;},
        });
    }
    async function copyEmail() {
        if (busy) return;
        busy = true;
        pinned = true;
        show();
        clearTimeout(timer);
        setCopied(false);
        status.textContent = "";
        try {
            await navigator.clipboard.writeText(email);
            void playSound('confirm');
            setCopied(true);
            status.textContent = `${email} скопирован`;
            void gsap.fromTo(check, {strokeDashoffset: 1}, {strokeDashoffset: 0, duration: duration(.35), ease: 'power2.out'});
            void gsap.fromTo(copy, {scale: .96}, {scale: 1, duration: duration(.4), ease: 'power3.out', overwrite: true});
        } catch {
            status.textContent = 'Не удалось скопировать адрес. Нажмите на почту, чтобы открыть письмо.';
            setCopied(false);
            if (open) contact.querySelector('.contact-email').focus({preventScroll:true});
        } finally {
            busy = false;
            timer = setTimeout(() => {
                pinned = false;
                delete contact.dataset.copied;
                setCopied(false);
                if (!contact.matches(':hover') && !contact.matches(':focus-within')) hide();
            }, 2400);
        }
    }
    trigger.addEventListener('click', event => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        void copyEmail();
    });
    trigger.addEventListener('keydown', event => {
        if (event.key === ' ') {event.preventDefault();void copyEmail();}
    });
    contact.querySelector('.contact-email').addEventListener('click', () => void playSound('external'));
    copy.addEventListener('click', () => void copyEmail());
    contact.addEventListener('pointerenter', event => {if (event.pointerType === 'mouse') show();});
    contact.addEventListener('pointerleave', () => {if (!pinned && !contact.matches(':focus-within')) hide();});
    contact.addEventListener('focusin', show);
    window.addEventListener('portfolio:overlayopen', hide);
    contact.addEventListener('focusout', event => {if (!contact.contains(event.relatedTarget)) hide();});
    document.addEventListener('pointerdown', event => {if (open && !contact.contains(event.target)) hide();});
    contact.addEventListener('keydown', event => {
        if (event.key === 'Escape' && open) {
            void playSound('collapse');
            event.preventDefault();
            trigger.focus({preventScroll:true});
            hide();
        }
    });
    reduced.addEventListener('change', () => {
        gsap.killTweensOf([pill, copy, check]);
        void gsap.set(check, {strokeDashoffset: contact.dataset.copied === 'true' ? 0 : 1});
        void gsap.set(pill, {opacity: open ? 1 : 0, scale: 1, y: 0, filter: 'none'});
        pill.hidden = !open;
    });
}
