// A single sound palette shared by the gallery and project navigation.
export const SOUND_SETTINGS = {
    volume: .7,
    hover: {duration: .065, attack: .006, frequency: 880, endFrequency: 830, gain: .022},
    open: {duration: .10, attack: .008, frequency: 660, endFrequency: 740, gain: .045},
    close: {duration: .10, attack: .008, frequency: 740, endFrequency: 660, gain: .045},
    navigate: {duration: .095, attack: .007, frequency: 740, endFrequency: 830, gain: .04},
    select: {duration: .075, attack: .007, frequency: 740, endFrequency: 784, gain: .028},
    expand: {duration: .09, attack: .008, frequency: 660, endFrequency: 740, gain: .03},
    collapse: {duration: .09, attack: .008, frequency: 740, endFrequency: 660, gain: .03},
    zoomIn: {duration: .055, attack: .006, frequency: 830, endFrequency: 880, gain: .018},
    zoomOut: {duration: .055, attack: .006, frequency: 880, endFrequency: 830, gain: .018},
    reset: {duration: .085, attack: .008, frequency: 740, endFrequency: 660, gain: .026},
    confirm: {duration: .095, attack: .008, frequency: 784, endFrequency: 988, gain: .026},
    external: {duration: .10, attack: .008, frequency: 740, endFrequency: 880, gain: .035},
};
const preferenceKey = 'portfolio-sound-enabled';
let enabled = true;
try {
    enabled = sessionStorage.getItem(preferenceKey) !== 'false';
} catch { /* Storage is optional. */
}
let audio;
let master;
let lastHover = -Infinity;
let lastPress = -Infinity;

export function unlockAudio() {
    if (!enabled) return;
    if (!audio) {
        audio = new AudioContext();
        master = audio.createGain();
        master.gain.value = SOUND_SETTINGS.volume;
        master.connect(audio.destination);
    }
    if (audio.state === 'suspended') void audio.resume().catch(() => {
    });
}

export function playSound(kind = 'open') {
    if (!enabled) return false;
    try {
        unlockAudio();
        if (audio.state !== 'running') return false;
        const now = audio.currentTime;
        const hover = kind === 'hover';
        if (hover && (now - lastHover < .24 || now - lastPress < .12)) return false;
        if (hover) lastHover = now;
        else lastPress = now;
        const settings = SOUND_SETTINGS[kind] || SOUND_SETTINGS.open;
        // A rounded, lightly voiced tap: no noise burst or low-frequency thud.
        const tone = audio.createOscillator();
        const overtone = audio.createOscillator();
        const overtoneLevel = audio.createGain();
        const envelope = audio.createGain();
        const end = now + settings.duration;

        tone.type = 'sine';
        tone.frequency.setValueAtTime(settings.frequency, now);
        tone.frequency.exponentialRampToValueAtTime(settings.endFrequency, end);
        overtone.type = 'sine';
        overtone.frequency.setValueAtTime(settings.frequency * 2, now);
        overtone.frequency.exponentialRampToValueAtTime(settings.endFrequency * 2, end);
        overtoneLevel.gain.value = .12;

        envelope.gain.setValueAtTime(0, now);
        envelope.gain.linearRampToValueAtTime(settings.gain, now + settings.attack);
        envelope.gain.exponentialRampToValueAtTime(.0001, end - .008);
        envelope.gain.linearRampToValueAtTime(0, end);
        tone.connect(envelope);
        overtone.connect(overtoneLevel);
        overtoneLevel.connect(envelope);
        envelope.connect(master);
        tone.start(now);
        overtone.start(now);
        tone.stop(end);
        overtone.stop(end);
        overtone.onended = () => {
            tone.disconnect();
            overtone.disconnect();
            overtoneLevel.disconnect();
            envelope.disconnect();
        };
        return true;
    } catch {
        return false;
    }
}

export function setupSoundToggle() {
    const button = document.querySelector('#sound-toggle');
    const label = document.querySelector('#sound-label');

    function render() {
        button.setAttribute('aria-pressed', String(enabled));
        label.textContent = enabled ? 'Выключить звук' : 'Включить звук';
    }

    render();
    button.addEventListener('click', () => {
        enabled = !enabled;
        try {
            sessionStorage.setItem(preferenceKey, String(enabled));
        } catch { /* Sound still works. */
        }
        render();
        if (enabled) {
            try {
                unlockAudio();
                if (audio.state === 'running') void playSound('select');
                else void audio.resume().then(() => {if (enabled) void playSound('select');}).catch(() => {});
            } catch {
            }
        } else if (audio) void audio.suspend().catch(() => {
        });
    });

    function unlockOnGesture(event) {
        if (event.target instanceof Element && event.target.closest('#sound-toggle')) return;
        if (event.type === 'keydown' && (event.repeat || !['Enter', ' '].includes(event.key))) return;
        try {
            unlockAudio();
        } catch { /* Autoplay/unsupported audio never blocks navigation. */
        }
    }

    document.addEventListener('pointerover', event => {
        if (event.pointerType !== 'mouse' || !(event.target instanceof Element)) return;
        const control = event.target.closest('a,button');
        if (!control || control.contains(event.relatedTarget) || control.matches(':disabled,[aria-disabled="true"],.project-cover,#sound-toggle,[aria-current="page"],.view-switch [aria-pressed="true"]')) return;
        void playSound('hover');
    });
    // Ordinary links without a dedicated action handler share the navigation voice.
    document.addEventListener('click', event => {
        if (event.defaultPrevented || !(event.target instanceof Element)) return;
        const link = event.target.closest('a[href]');
        if (!link || link.closest('.contact') || link.matches('.project-cover,.case-switch,.case-close,.case-cover-link,.case-site-link')) return;
        const url = new URL(link.href, document.baseURI);
        const local = url.origin === location.origin;
        if (url.hash && local && url.pathname === location.pathname) return;
        const played = playSound(local ? 'navigate' : 'external');
        if (played && ['http:', 'https:'].includes(url.protocol) && !link.target && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            setTimeout(() => location.assign(link.href), 110);
        }
    });
    document.addEventListener('pointerdown', unlockOnGesture, {capture: true, passive: true});
    document.addEventListener('keydown', unlockOnGesture, {capture: true});
}
