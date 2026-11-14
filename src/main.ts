import './ui/style.css';
import { FixedStepLoop } from './core/loop';
import { SIM_CONFIG } from './data/config';
import { TEXTS } from './data/texts';
import { DebugOverlay } from './dev/debug-overlay';
import { GameRenderer } from './render/scene';
import { Simulation } from './sim/simulation';
import { showErrorScreen } from './ui/error-screen';

/** Längste Bildpause, die noch nachgeholt wird (z. B. nach einem Ruckler). */
const MAX_FRAME_MS = 250;

function start(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#spielfeld');
  const ui = document.querySelector<HTMLDivElement>('#ui');
  if (!canvas || !ui) throw new Error('Spielfeld oder UI-Ebene fehlt in index.html.');

  document.title = TEXTS.gameTitle;
  buildStaticUi(ui);

  const sim = new Simulation();
  const loop = new FixedStepLoop(SIM_CONFIG.ticksPerSecond, SIM_CONFIG.maxTicksPerFrame, () =>
    sim.step(),
  );
  const view = new GameRenderer(canvas);
  const debug = new DebugOverlay(ui);

  window.addEventListener('resize', () => view.resize());
  window.addEventListener('keydown', (e) => {
    if (e.code === 'F3') {
      e.preventDefault();
      debug.toggle();
    } else if (e.code === 'Space') {
      e.preventDefault();
      loop.paused = !loop.paused;
    }
  });

  let last = performance.now();
  let running = true;

  const frame = (now: number): void => {
    if (!running) return;
    try {
      const dt = Math.min(now - last, MAX_FRAME_MS);
      last = now;

      // Im Hintergrund-Tab pausiert das Spiel.
      const t0 = performance.now();
      const ticks = document.hidden ? 0 : loop.advance(dt);
      const tickMs = performance.now() - t0;

      view.render(sim, loop.alpha);
      debug.frame(now, tickMs, ticks, view.renderer, sim, loop.paused);
      requestAnimationFrame(frame);
    } catch (err) {
      running = false;
      showErrorScreen(err);
    }
  };

  document.addEventListener('visibilitychange', () => {
    // Beim Zurückkehren keine aufgestaute Zeit nachholen.
    last = performance.now();
  });

  requestAnimationFrame(frame);
}

function buildStaticUi(ui: HTMLElement): void {
  const badge = document.createElement('div');
  badge.className = 'panel title-badge';
  const h1 = document.createElement('h1');
  h1.textContent = TEXTS.gameTitle;
  const version = document.createElement('div');
  version.className = 'version';
  version.textContent = TEXTS.version(__APP_VERSION__, __BUILD_DATE__);
  badge.append(h1, version);

  const hint = document.createElement('div');
  hint.className = 'panel hint';
  hint.textContent = TEXTS.hint;

  ui.append(badge, hint);
}

window.addEventListener('error', (e) => showErrorScreen(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showErrorScreen(e.reason));

try {
  start();
} catch (err) {
  showErrorScreen(err);
}
