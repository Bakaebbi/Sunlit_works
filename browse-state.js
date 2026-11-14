const key = 'sunlit-tile-browse-state';
let state;
try { state = JSON.parse(sessionStorage.getItem(key) || '{}'); } catch { state = {}; }
if (!state || typeof state !== 'object' || Array.isArray(state)) state = {};
export const readBrowseState = () => state;
export function saveBrowseState(patch = {}) {
    const detail = {...state, ...patch};
    window.dispatchEvent(new CustomEvent('portfolio:capturestate', {detail}));
    state = detail;
    try { sessionStorage.setItem(key, JSON.stringify(state)); } catch {}
    return state;
}
window.addEventListener('pagehide', () => saveBrowseState());
