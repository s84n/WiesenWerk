import './ui/style.css';
import { MusicPlayer } from './audio/music';
import { SoundSystem } from './audio/sound';
import { SettingsStore } from './core/settings';
import { UndoManager } from './core/undo';
import { FixedStepLoop } from './core/loop';
import { SaveManager } from './core/saves';
import { closeDb } from './core/storage';
import { BUILDINGS } from './data/buildings';
import { QUALITY_PRESETS, QUALITY_PROBE, SAVE_CONFIG, SIM_CONFIG } from './data/config';
import { TEXTS } from './data/texts';
import { DebugOverlay } from './dev/debug-overlay';
import { createStressSimulation } from './dev/stress';
import { InputController } from './input/controls';
import { ToolController } from './input/tools';
import { GameRenderer } from './render/scene';
import { randomSeed } from './sim/rng';
import { Simulation } from './sim/simulation';
import { generateWorld } from './sim/worldgen';
import { BuildBar } from './ui/build-bar';
import { setItemIcons } from './ui/dom';
import { setErrorExport, showErrorScreen } from './ui/error-screen';
import { GoalsPanel } from './ui/goals-panel';
import { Hud } from './ui/hud';
import { InventoryWindow } from './ui/inventory-window';
import { InfoPanel } from './ui/info-panel';
import { MainMenu } from './ui/main-menu';
import { ResearchWindow } from './ui/research-window';
import { StatsWindow } from './ui/stats-window';
import { Toasts } from './ui/toasts';

/** Längste Bildpause, die noch nachgeholt wird (z. B. nach einem Ruckler). */
const MAX_FRAME_MS = 250;

function urlNumber(name: string): number {
  return Number(new URLSearchParams(location.search).get(name));
}

function start(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#spielfeld');
  const ui = document.querySelector<HTMLDivElement>('#ui');
  if (!canvas || !ui) throw new Error('Spielfeld oder UI-Ebene fehlt in index.html.');

  document.title = TEXTS.gameTitle;
  const settings = new SettingsStore();
  const view = new GameRenderer(canvas, QUALITY_PRESETS[settings.value.quality]);
  view.dayNight = settings.value.dayNight;
  let sim!: Simulation;
  /** Läuft ein echtes Spiel (sonst: Hintergrundwelt hinter dem Startmenü)? */
  let inGame = false;

  const loop = new FixedStepLoop(SIM_CONFIG.ticksPerSecond, SIM_CONFIG.maxTicksPerFrame, () =>
    sim.step(),
  );

  // ---------------------------------------------------------------- Oberfläche
  setItemIcons(view.itemIcons());
  const topLeft = buildStaticUi(ui);
  const hotbar = BUILDINGS.map((_, i) => i)
    .filter((i) => BUILDINGS[i].availableFromStart)
    .slice(0, 9);
  const tools = new ToolController(canvas, view.rig, () => sim, view.preview, hotbar);
  /** Öffnet das Menü; wird gesetzt, sobald das Menü existiert. */
  let openMenu = (): void => {};
  const research = new ResearchWindow(ui, () => sim, view.buildingIcons());
  const stats = new StatsWindow(ui);
  const inventory = new InventoryWindow(ui);
  const windows = [research, stats, inventory];
  const toggleWindow = (w: (typeof windows)[number]): void => {
    if (!inGame) return;
    for (const other of windows) if (other !== w) other.window.close();
    w.window.toggle();
  };
  const music = new MusicPlayer();
  const sound = new SoundSystem(() => music.start());
  const applySettings = (): void => {
    const s = settings.value;
    sound.configure(s.soundVolume, s.muted);
    music.setVolume(s.muted ? 0 : s.musicVolume);
    view.dayNight = s.dayNight;
  };
  applySettings();
  let shownQuality = settings.value.quality;
  settings.onChange((s) => {
    applySettings();
    if (s.quality !== shownQuality) {
      shownQuality = s.quality;
      view.setQuality(QUALITY_PRESETS[s.quality]);
    }
  });
  // Erster Start: Grafikstufe anhand der Bildrate wählen (nach einer Sekunde Anlaufzeit)
  let probeFrames = 0;
  let probeStart = -1;
  let probing = !settings.existed;
  // Leiser Klick bei jedem Knopf der Oberfläche
  ui.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('button')) sound.click();
  });
  const hud = new Hud(
    ui,
    {
      isPaused: () => loop.paused,
      togglePause: () => (loop.paused = !loop.paused),
      getSpeed: () => loop.speed,
      setSpeed: (s) => (loop.speed = s),
    },
    () => openMenu(),
    {
      research: () => toggleWindow(research),
      stats: () => toggleWindow(stats),
      inventory: () => toggleWindow(inventory),
      sound: {
        toggle: () => settings.set('muted', !settings.value.muted),
        muted: () => settings.value.muted,
      },
    },
  );
  const buildBar = new BuildBar(ui, tools, view.buildingIcons());
  const info = new InfoPanel(ui, tools, view.buildingIcons());
  tools.onChange = () => buildBar.refreshMode();
  const toasts = new Toasts(ui);
  const undo = new UndoManager();
  const goals = new GoalsPanel(topLeft, () => sim);

  const useSimulation = (next: Simulation): void => {
    sim = next;
    view.setSimulation(sim);
    tools.cancel();
    hud.invalidate();
    buildBar.invalidate();
    research.invalidate();
    inventory.invalidate();
    undo.clear();
  };

  // ---------------------------------------------------------------- Speichern
  const saves = new SaveManager({
    getSim: () => sim,
    camera: () => view.rig.snapshot(),
    apply: (next, camera) => {
      useSimulation(next);
      view.rig.restore(camera);
      inGame = true;
    },
    toast: (m) => toasts.message(m),
  });
  setErrorExport(() =>
    inGame && saves.canSave()
      ? saves.exportFile()
      : Promise.reject(new Error('nichts zu exportieren')),
  );

  const newGame = (seed: number, size?: number): void => {
    useSimulation(new Simulation(generateWorld(seed, size)));
    saves.reset();
    inGame = true;
  };

  let pausedBeforeMenu = false;
  const menu = new MainMenu(
    ui,
    {
      inGame: () => inGame,
      canSave: () => saves.canSave(),
      defaultName: () => saves.defaultName(),
      currentSeed: () => sim.world.seed,
      rollSeed: () => randomSeed(Math.random),
      continueGame: async () => {
        if (inGame) return;
        const slots = await saves.list().catch(() => []);
        if (slots.length > 0) await saves.load(slots[0].slot);
        else newGame(randomSeed(Math.random));
      },
      newGame: (seed, size) => {
        if (inGame) void saves.autosave().catch(() => undefined);
        newGame(seed, size);
      },
      save: (slot, name) => saves.save(slot, name),
      load: async (slot) => {
        if (inGame) await saves.autosave().catch(() => undefined);
        await saves.load(slot);
      },
      remove: (slot) => saves.remove(slot),
      list: () => saves.list(),
      exportFile: () => saves.exportFile(),
      importFile: (file) => saves.importFile(file),
      errorText: (e) => saves.errorText(e),
      settings: () => settings.value,
      setSetting: (key, value) => settings.set(key, value),
      visibilityChanged: (open) => {
        if (open) {
          pausedBeforeMenu = loop.paused;
          loop.paused = true;
          tools.cancel();
          for (const w of windows) w.window.close();
        } else {
          loop.paused = pausedBeforeMenu;
        }
      },
    },
    TEXTS.version(__APP_VERSION__, __BUILD_DATE__),
  );
  openMenu = () => menu.open();

  // ---------------------------------------------------------------- Start
  // Entwicklerhilfen: ?stress=1 lädt die Referenzfabrik, ?seed=123 startet sofort ein neues Spiel.
  const stress = urlNumber('stress');
  const urlSeed = urlNumber('seed');
  if (stress > 0) {
    useSimulation(createStressSimulation(stress).sim);
    inGame = true;
  } else if (Number.isFinite(urlSeed) && urlSeed >= 1) {
    newGame(Math.floor(urlSeed));
  } else {
    // Hintergrundwelt hinter dem Startmenü
    useSimulation(new Simulation(generateWorld(randomSeed(Math.random))));
    menu.open();
  }
  const devZoom = urlNumber('zoom');
  if (devZoom > 0) view.rig.zoomAt(devZoom / view.rig.viewHeight, 0, 0);

  const debug = new DebugOverlay(ui);
  const input = new InputController(canvas, view.rig, {
    toggleDebug: () => debug.toggle(),
    togglePause: () => {
      if (!menu.isOpen) loop.paused = !loop.paused;
    },
    togglePowerView: () => (powerView = !powerView),
  });
  let powerView = false;

  // Esc: Menü schließen bzw. öffnen, wenn nichts anderes abzubrechen ist (läuft vor den Werkzeugen)
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.code === 'Escape') {
        if (menu.isOpen) {
          if (inGame) menu.close();
          e.stopImmediatePropagation();
        } else if (windows.some((w) => w.window.isOpen)) {
          for (const w of windows) w.window.close();
          e.stopImmediatePropagation();
        } else if (tools.mode === 'select' && tools.selected < 0) {
          menu.open();
          e.stopImmediatePropagation();
        }
      } else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey) && !menu.isOpen) {
        e.preventDefault();
        if (inGame) {
          const n = undo.undo(sim);
          toasts.message(n > 0 ? TEXTS.messages.undone(n) : TEXTS.messages.nothingToUndo);
        }
      } else if (e.code === 'KeyS' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (inGame && saves.canSave())
          saves.quickSave().catch((err) => toasts.message(saves.errorText(err)));
      } else if (menu.isOpen && !(e.target instanceof HTMLInputElement)) {
        // Im Menü keine Spieltasten
        e.stopImmediatePropagation();
      } else if (!e.repeat && !(e.target instanceof HTMLInputElement)) {
        if (e.code === 'KeyT') toggleWindow(research);
        else if (e.code === 'KeyI') toggleWindow(stats);
      }
    },
    { capture: true },
  );

  // Spielstand-Datei ins Fenster ziehen
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    saves
      .importFile(file)
      .then(() => menu.close())
      .catch((err) => menu.showError(saves.errorText(err)));
  });

  // Automatisch speichern: alle 2 Minuten (IndexedDB) und beim Verlassen des Tabs (Notfall-Kopie)
  let autosaveTimer = 0;
  const autosave = (): void => {
    autosaveTimer = 0;
    if (inGame) saves.autosave().catch((err) => console.warn('Autosave fehlgeschlagen', err));
  };
  // Beim Verlassen (Tab-Wechsel, Schließen) nur die schnelle Notfall-Kopie schreiben: Ein laufender
  // IndexedDB-Vorgang in einer eingefrorenen Seite würde die Datenbank für die nächste Seite blockieren.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && inGame) saves.emergencySave();
  });
  window.addEventListener('pagehide', () => {
    if (inGame) saves.emergencySave();
    closeDb();
  });
  void saves.recoverEmergency();

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
      saves,
      menu,
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
      if (inGame) {
        sound.handleEvents(sim.events);
        undo.record(sim, sim.events);
      }
      toasts.handleEvents(sim.events, sim);
      sim.clearEvents();

      hud.update(sim, now);
      buildBar.update(sim, now);
      info.update(sim, now);
      research.update(sim, now);
      stats.update(sim, now);
      inventory.update(sim, now);
      goals.update(sim, inGame);
      view.showPower = powerView || tools.placingPower;
      view.render(loop.paused ? 0 : loop.alpha, now);
      debug.frame(now, tickMs, ticks, view, sim, loop.paused);
      if (inGame && !menu.isOpen) sound.update(now, view.animations.workingInView, loop.paused);
      sound.setRain(view.atmosphere.rain);
      music.update(now);
      if (probing && settings.value.qualityChosen) probing = false;
      if (probing) {
        if (probeStart < 0) probeStart = now + 1000;
        else if (now >= probeStart) {
          probeFrames++;
          const elapsed = (now - probeStart) / 1000;
          if (elapsed >= QUALITY_PROBE.seconds) {
            probing = false;
            const fps = probeFrames / elapsed;
            settings.set(
              'quality',
              fps >= QUALITY_PROBE.highFps
                ? 'high'
                : fps >= QUALITY_PROBE.mediumFps
                  ? 'medium'
                  : 'low',
            );
          }
        }
      }

      if (inGame && !menu.isOpen) {
        autosaveTimer += dt;
        if (autosaveTimer >= SAVE_CONFIG.autosaveSeconds) autosave();
      }
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

/** Baut Titel, Version und Hinweiszeile. Gibt die linke obere Spalte zurück. */
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
