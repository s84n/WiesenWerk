import './ui/style.css';
import { FixedStepLoop } from './core/loop';
import { SIM_CONFIG } from './data/config';
import { TEXTS } from './data/texts';
import { DebugOverlay } from './dev/debug-overlay';
import { InputController } from './input/controls';
import { GameRenderer } from './render/scene';
import { randomSeed } from './sim/rng';
import { Simulation } from './sim/simulation';
import { generateWorld } from './sim/worldgen';
import { showErrorScreen } from './ui/error-screen';
import { SeedPanel } from './ui/seed-panel';

/** Längste Bildpause, die noch nachgeholt wird (z. B. nach einem Ruckler). */
const MAX_FRAME_MS = 250;

function initialSeed(): number {
  const fromUrl = Number(new URLSearchParams(location.search).get('seed'));
  return Number.isFinite(fromUrl) && fromUrl >= 1 ? Math.floor(fromUrl) : randomSeed(Math.random);
}

function start(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#spielfeld');
  const ui = document.querySelector<HTMLDivElement>('#ui');
  if (!canvas || !ui) throw new Error('Spielfeld oder UI-Ebene fehlt in index.html.');

  document.title = TEXTS.gameTitle;
  const view = new GameRenderer(canvas);
  let sim!: Simulation;

  const loop = new FixedStepLoop(SIM_CONFIG.ticksPerSecond, SIM_CONFIG.maxTicksPerFrame, () =>
    sim.step(),
  );

  const newWorld = (seed: number): void => {
    const world = generateWorld(seed);
    sim = new Simulation(world);
    view.setWorld(world);
    // Seed in die Adresse schreiben, damit Neuladen dieselbe Welt zeigt
    const url = new URL(location.href);
    url.searchParams.set('seed', String(seed));
    history.replaceState(null, '', url);
  };

  const seed = initialSeed();
  newWorld(seed);
  // Entwicklerhilfe: ?zoom=<sichtbare Höhe> startet mit anderer Zoomstufe
  const devZoom = Number(new URLSearchParams(location.search).get('zoom'));
  if (devZoom > 0) view.rig.zoomAt(devZoom / view.rig.viewHeight, 0, 0);

  const top = buildStaticUi(ui);
  new SeedPanel(top, seed, newWorld, () => randomSeed(Math.random));
  const debug = new DebugOverlay(ui);
  const input = new InputController(canvas, view.rig, {
    toggleDebug: () => debug.toggle(),
    togglePause: () => (loop.paused = !loop.paused),
  });

  window.addEventListener('resize', () => view.resize());

  let last = performance.now();
  let running = true;

  const frame = (now: number): void => {
    if (!running) return;
    try {
      const dtMs = Math.min(now - last, MAX_FRAME_MS);
      last = now;

      // Im Hintergrund-Tab pausiert das Spiel.
      const t0 = performance.now();
      const ticks = document.hidden ? 0 : loop.advance(dtMs);
      const tickMs = performance.now() - t0;

      input.update(dtMs / 1000);
      view.render(dtMs / 1000);
      debug.frame(now, tickMs, ticks, view, sim, loop.paused);
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

/** Baut Titel, Version und Hinweiszeile. Gibt die obere linke Spalte zurück. */
function buildStaticUi(ui: HTMLElement): HTMLElement {
  const column = document.createElement('div');
  column.className = 'top-left';

  const badge = document.createElement('div');
  badge.className = 'panel title-badge';
  const h1 = document.createElement('h1');
  h1.textContent = TEXTS.gameTitle;
  const version = document.createElement('div');
  version.className = 'version';
  version.textContent = TEXTS.version(__APP_VERSION__, __BUILD_DATE__);
  badge.append(h1, version);
  column.appendChild(badge);

  const hint = document.createElement('div');
  hint.className = 'panel hint';
  hint.textContent = TEXTS.hint;

  ui.append(column, hint);
  return column;
}

window.addEventListener('error', (e) => showErrorScreen(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => showErrorScreen(e.reason));

try {
  start();
} catch (err) {
  showErrorScreen(err);
}
