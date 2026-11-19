/**
 * The start-up chime: three soft rising notes (E5, B5, E6), like a coin landing, synthesised with Web Audio so there
 * is no audio file to ship. Off when the user turns it off in Settings → Appearance (kept outside the database,
 * which may still be locked when it plays).
 */
const KEY = 'monto:boot-sound';

export const bootSoundOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export const setBootSound = (on: boolean) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode: plays every time */ } };

export function playBootChime(): void {
  if (!bootSoundOn() || typeof AudioContext === 'undefined') return;
  try {
    const ctx = new AudioContext();
    const start = ctx.currentTime + 0.05;
    const master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
    for (const [freq, at] of [[659.25, 0], [987.77, 0.11], [1318.51, 0.22]] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start + at);
      env.gain.exponentialRampToValueAtTime(1, start + at + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.9);
      osc.connect(env).connect(master);
      osc.start(start + at);
      osc.stop(start + at + 1);
    }
    setTimeout(() => void ctx.close().catch(() => undefined), 1600);
  } catch {
    /* no audio device: start silently */
  }
}
