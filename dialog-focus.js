export function trapDialogFocus(dialog) {
    dialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab' || !dialog.open) return;
        const controls = [...dialog.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')]
            .filter(node => node.getClientRects().length && !node.closest('[hidden],[inert],[aria-hidden="true"]'));
        const first = controls[0];
        const last = controls.at(-1);
        if (!first) {event.preventDefault();dialog.focus();return;}
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
            event.preventDefault();last.focus({preventScroll:true});
        } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
            event.preventDefault();first.focus({preventScroll:true});
        }
    });
}
