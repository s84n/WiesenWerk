import './ui/style.css';
import { FixedStepLoop } from './core/loop';
import { BUILDINGS } from './data/buildings';
import { SIM_CONFIG } from './data/config';
import { TEXTS } from './data/texts';
import { DebugOverlay } from './dev/debug-overlay';
import { InputController } from './input/controls';
import { ToolController } from './input/tools';
import { GameRenderer } from './render/scene';
import { randomSeed } from './sim/rng';
import { Simulation } from './sim/simulation';
import { generateWorld } from './sim/worldgen';
import { BuildBar } from './ui/build-bar';
import { showErrorScreen } from './ui/error-screen';
import { Hud } from './ui/hud';
import { SeedPanel } from './ui/seed-panel';
import { Toasts } from './ui/toasts';

/** Längste Bildpause, die noch nachgeholt wird (z. B. nach einem Ruckler). */
const MAX_FRAME_MS = 250;

function urlNumber(name: string): number {
  return Number(new URLSearchParams(location.search).get(name));
}

function initialSeed(): number {
  const fromUrl = urlNumber('seed');
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

  // Oberfläche
  const top = buildStaticUi(ui);
  const hotbar = BUILDINGS.map((_, i) => i)
    .filter((i) => BUILDINGS[i].availableFromStart)
    .slice(0, 9);
  const tools = new ToolController(canvas, view.rig, () => sim, view.preview, hotbar);
  const hud = new Hud(ui, {
    isPaused: () => loop.paused,
    togglePause: () => (loop.paused = !loop.paused),
    getSpeed: () => loop.speed,
    setSpeed: (s) => (loop.speed = s),
  });
  const buildBar = new BuildBar(ui, tools, view.buildingIcons());
  tools.onChange = () => buildBar.refreshMode();
  const toasts = new Toasts(ui);

  const newWorld = (seed: number): void => {
    sim = new Simulation(generateWorld(seed));
    view.setSimulation(sim);
    tools.cancel();
    hud.invalidate();
    buildBar.invalidate();
    // Seed in die Adresse schreiben, damit Neuladen dieselbe Welt zeigt
    const url = new URL(location.href);
    url.searchParams.set('seed', String(seed));
    history.replaceState(null, '', url);
  };

  const seed = initialSeed();
  newWorld(seed);
  // Entwicklerhilfe: ?zoom=<sichtbare Höhe> startet mit anderer Zoomstufe
  const devZoom = urlNumber('zoom');
  if (devZoom > 0) view.rig.zoomAt(devZoom / view.rig.viewHeight, 0, 0);

  new SeedPanel(
    top,
    seed,
    (s) => {
      if (sim.buildingCount === 0 || window.confirm(TEXTS.seed.confirmReplace)) newWorld(s);
    },
    () => randomSeed(Math.random),
  );
  const debug = new DebugOverlay(ui);
  const input = new InputController(canvas, view.rig, {
    toggleDebug: () => debug.toggle(),
    togglePause: () => (loop.paused = !loop.paused),
  });

  window.addEventListener('resize', () => view.resize());

  // Entwicklerzugang für automatische Tests im Browser (nur im Entwicklungsmodus)
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__wiesenwerk = {
      get sim() {
        return sim;
      },
      view,
      tools,
      loop,
    };
  }

  let last = performance.now();
  let running = true;

  const frame = (now: number): void => {
    if (!running) return;
    try {
      const dtMs = Math.min(now - last, MAX_FRAME_MS);
      last = now;
      const dt = dtMs / 1000;

      // Befehle auch in der Pause sofort anwenden, dann die Ticks dieses Bildes.
      sim.flushCommands();
      const t0 = performance.now();
      const ticks = document.hidden ? 0 : loop.advance(dtMs);
      const tickMs = performance.now() - t0;

      input.update(dt);
      view.updateCamera(dt);
      tools.update(dt);
      sim.flushCommands();

      view.handleEvents(sim.events);
      toasts.handleEvents(sim.events, sim);
      sim.clearEvents();

      hud.update(sim, now);
      buildBar.update(sim, now);
      view.render();
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
