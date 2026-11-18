import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Points,
  PointsMaterial,
  Vector3,
  type MeshLambertMaterial,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { SEASON_CONFIG, SIM_CONFIG, WEATHER_CONFIG, type QualityPreset } from '../data/config';
import { PALETTE } from '../data/palette';
import { dayTimeAt, seasonWeights } from '../sim/daylight';
import { hash3Float } from '../sim/rng';
import { anchored, anchorPeriod } from './world-anchor';

/** Ein Stützpunkt im Tagesverlauf (Tageszeit 0..1, 0 = Mitternacht). */
interface Key {
  t: number;
  sun: number;
  sunI: number;
  sky: number;
  ground: number;
  hemiI: number;
  fog: number;
  /** Nachtleuchten von Fenstern, Laternen, Glut (0..1). */
  glow: number;
}

/**
 * Tagesverlauf: Nacht bleibt freundlich blau (nie zu dunkel zum Bauen), warmes Morgen- und
 * Abendlicht, goldener Nachmittag. Farben aus der Palette.
 */
const KEYS: readonly Key[] = [
  {
    t: 0.0,
    sun: PALETTE.moon,
    sunI: 0.7,
    sky: PALETTE.nightSky,
    ground: PALETTE.nightGround,
    hemiI: 1.2,
    fog: PALETTE.nightFog,
    glow: 1,
  },
  {
    t: 0.16,
    sun: PALETTE.moon,
    sunI: 0.7,
    sky: PALETTE.nightSky,
    ground: PALETTE.nightGround,
    hemiI: 1.2,
    fog: PALETTE.nightFog,
    glow: 1,
  },
  {
    t: 0.205,
    sun: PALETTE.dawnSun,
    sunI: 1.25,
    sky: PALETTE.dawnSky,
    ground: PALETTE.dawnGround,
    hemiI: 1.3,
    fog: PALETTE.dawnFog,
    glow: 0.5,
  },
  {
    t: 0.245,
    sun: PALETTE.sunriseSun,
    sunI: 1.8,
    sky: PALETTE.sunriseSky,
    ground: PALETTE.dawnGround,
    hemiI: 1.3,
    fog: PALETTE.sunriseFog,
    glow: 0.1,
  },
  {
    t: 0.32,
    sun: PALETTE.morningSun,
    sunI: 2.1,
    sky: PALETTE.hemiSky,
    ground: PALETTE.hemiGround,
    hemiI: 1.45,
    fog: PALETTE.fog,
    glow: 0,
  },
  {
    t: 0.5,
    sun: PALETTE.sun,
    sunI: 2.3,
    sky: PALETTE.hemiSky,
    ground: PALETTE.hemiGround,
    hemiI: 1.5,
    fog: PALETTE.fog,
    glow: 0,
  },
  {
    t: 0.62,
    sun: PALETTE.goldenSun,
    sunI: 2.2,
    sky: PALETTE.goldenSky,
    ground: PALETTE.hemiGround,
    hemiI: 1.45,
    fog: PALETTE.goldenFog,
    glow: 0,
  },
  {
    t: 0.74,
    sun: PALETTE.sunsetSun,
    sunI: 1.75,
    sky: PALETTE.sunsetSky,
    ground: PALETTE.hemiGround,
    hemiI: 1.4,
    fog: PALETTE.sunsetFog,
    glow: 0.2,
  },
  {
    t: 0.8,
    sun: PALETTE.duskSun,
    sunI: 1.2,
    sky: PALETTE.duskSky,
    ground: PALETTE.nightGround,
    hemiI: 1.3,
    fog: PALETTE.duskFog,
    glow: 0.6,
  },
  {
    t: 0.86,
    sun: PALETTE.moon,
    sunI: 0.7,
    sky: PALETTE.nightSky,
    ground: PALETTE.nightGround,
    hemiI: 1.2,
    fog: PALETTE.nightFog,
    glow: 1,
  },
  {
    t: 1.0,
    sun: PALETTE.moon,
    sunI: 0.7,
    sky: PALETTE.nightSky,
    ground: PALETTE.nightGround,
    hemiI: 1.2,
    fog: PALETTE.nightFog,
    glow: 1,
  },
];

const ca = new Color();
const cb = new Color();
const sunDay = new Vector3();
const MOON_DIR = new Vector3(0.35, 1, 0.55).normalize();

/** Gemeinsame Shader-Bausteine: Rauschen für Wolkenschatten und Wasser. */
const NOISE = /* glsl */ `
float wwHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// ohne sin: auch bei großen Weltkoordinaten gleichmäßig (für die feine Gras-Struktur)
float wwHash2(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float wwNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wwHash(i), wwHash(i + vec2(1.0, 0.0)), u.x),
             mix(wwHash(i + vec2(0.0, 1.0)), wwHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

/**
 * Atmosphäre: Tageszeit, Lichtfarben, Nachtleuchten (selbstleuchtende Fenster und Glut im Shader),
 * Wiegen von Bäumen und Gras, Wasserglanz, Wolkenschatten, Regen und Glühwürmchen.
 * Alles rein optisch; die Zeit kommt aus der Spielzeit, steht also in der Pause still.
 */
export class Atmosphere {
  readonly group = new Group();
  /** Uniforms, die alle gepatchten Materialien teilen. */
  private readonly u = {
    uTime: { value: 0 },
    uGlow: { value: 0 },
    uSway: { value: 0 },
    uCloud: { value: 0 },
    uWet: { value: 0 },
    uSun: { value: 1 },
    uGlowA: { value: new Color(PALETTE.windowLight) },
    uGlowB: { value: new Color(PALETTE.glow) },
    uLeafA: { value: new Color(PALETTE.leaf) },
    uLeafB: { value: new Color(PALETTE.leafLight) },
    uLeafC: { value: new Color(PALETTE.leafDark) },
    uLeafD: { value: new Color(PALETTE.meadowDark) },
    uFlag: { value: new Color(PALETTE.flag) },
    uSpring: { value: 0 },
    uAutumn: { value: 0 },
    uWinter: { value: 0 },
    uView: { value: 30 },
  };
  /** Jahreszeit (fortlaufend 0..4) und Anteile Frühling, Sommer, Herbst, Winter. */
  season = 1.5;
  readonly seasonMix = [0, 1, 0, 0];
  /** Aktuelle Tageszeit (0..1) und Regenstärke (0..1) – für Klang und Anzeige. */
  dayTime = 0;
  rain = 0;
  glow = 0;
  private readonly rainLines: LineSegments;
  private readonly rainPos: Float32Array;
  private readonly rainSeed: Float32Array;
  private readonly flies: Points;
  private readonly flyPos: Float32Array;

  constructor() {
    // Regen: eine Linienliste, jedes Bild um die Kamera herum neu gesetzt
    const n = WEATHER_CONFIG.drops;
    this.rainPos = new Float32Array(n * 6);
    this.rainSeed = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) this.rainSeed[i] = Math.random();
    const rg = new BufferGeometry();
    rg.setAttribute('position', new BufferAttribute(this.rainPos, 3));
    this.rainLines = new LineSegments(
      rg,
      new LineBasicMaterial({
        color: PALETTE.rain,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;

    // Glühwürmchen
    this.flyPos = new Float32Array(WEATHER_CONFIG.fireflies * 3);
    const fg = new BufferGeometry();
    fg.setAttribute('position', new BufferAttribute(this.flyPos, 3));
    this.flies = new Points(
      fg,
      new PointsMaterial({
        color: PALETTE.firefly,
        size: 4,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    );
    this.flies.frustumCulled = false;
    this.flies.visible = false;
    this.group.add(this.rainLines, this.flies);
  }

  /** Erweitert das gemeinsame Material um Nachtleuchten, Wiegen und Wolkenschatten. */
  patchMaterial(mat: MeshLambertMaterial): void {
    mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, this.u);
      shader.vertexShader =
        /* glsl */ `
uniform float uTime; uniform float uSway;
uniform vec3 uLeafA; uniform vec3 uLeafB; uniform vec3 uLeafC; uniform vec3 uLeafD;
uniform vec3 uFlag;
varying vec3 vWPos;
varying float vLeaf;
` +
        shader.vertexShader
          .replace(
            '#include <begin_vertex>',
            /* glsl */ `#include <begin_vertex>
  vLeaf = 0.0;
#if defined(USE_INSTANCING) && defined(USE_COLOR)
  {
    vec3 c = color.rgb;
    float leaf = max(max(step(distance(c, uLeafA), 0.01), step(distance(c, uLeafB), 0.01)),
                     max(step(distance(c, uLeafC), 0.01), step(distance(c, uLeafD), 0.01)));
    vec3 base = instanceMatrix[3].xyz;
    float ph = base.x * 0.7 + base.z * 1.3;
    float sw = sin(uTime * 1.6 + ph) * 0.6 + sin(uTime * 2.7 + ph * 1.7) * 0.4;
    transformed.x += leaf * uSway * sw * 0.05 * transformed.y;
    transformed.z += leaf * uSway * sw * 0.03 * transformed.y;
    vLeaf = leaf;
    // Fahne weht: Welle entlang der Fahne, am Mast fest
    float flag = step(distance(c, uFlag), 0.01);
    transformed.z += flag * sin(uTime * 7.0 + transformed.x * 14.0 + ph) * 0.12 * max(0.0, transformed.x);
  }
#endif`,
          )
          .replace(
            '#include <project_vertex>',
            /* glsl */ `#include <project_vertex>
#ifdef USE_INSTANCING
  vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif`,
          );
      shader.fragmentShader =
        /* glsl */ `
uniform float uTime; uniform float uGlow; uniform float uCloud; uniform float uWet;
uniform vec3 uGlowA; uniform vec3 uGlowB;
uniform float uSpring; uniform float uAutumn; uniform float uWinter; uniform float uView;
varying vec3 vWPos;
varying float vLeaf;
${NOISE}
` +
        shader.fragmentShader
          .replace(
            '#include <color_fragment>',
            /* glsl */ `#include <color_fragment>
  // Ausrichtung der Fläche aus den Bildschirmableitungen (das Gelände hat keine Normalen)
  float wwUp = abs(normalize(cross(dFdx(vWPos), dFdy(vWPos))).y);
#if defined(USE_COLOR) && !defined(USE_INSTANCING)
  {
    // Gras-Struktur auf Wiesen und Waldboden (nur Gelände, rein im Shader: keine Geometrie).
    // Feine Anteile blenden beim Herauszoomen aus, damit nichts flimmert.
    vec3 c = diffuseColor.rgb;
    float green = clamp((c.g - max(c.r, c.b)) * 5.0, 0.0, 1.0) * step(0.6, wwUp);
    if (green > 0.0) {
      vec2 p = vWPos.xz;
      float near = 1.0 - smoothstep(30.0, 75.0, uView);
      float close = 1.0 - smoothstep(14.0, 30.0, uView);
      float big = wwNoise(p * 0.55) - 0.5;
      float k = big * 0.14 + (wwNoise(p * 2.1 + 9.0) - 0.5) * 0.10 * near;
      // Grasbüschel: je Zelle ein Punkt mit heller Spitze und dunklem Fuß
      vec2 q = p * 4.0;
      vec2 cell = floor(q);
      vec2 r = vec2(wwHash2(cell), wwHash2(cell + 17.3));
      vec2 d = fract(q) - (0.2 + r * 0.6);
      float tuft = 1.0 - smoothstep(0.05, 0.34, length(d * vec2(1.0, 0.6)));
      k += tuft * (d.y < 0.0 ? 0.13 : -0.16) * near;
      k += (wwHash2(floor(p * 16.0)) - 0.5) * 0.10 * close;
      // große Flecken leicht gelblich bzw. bläulich-grün
      vec3 tint = vec3(1.0 + big * 0.12, 1.0, 1.0 - big * 0.16);
      diffuseColor.rgb = mix(c, c * tint * (1.0 + k), green);
    }
  }
#endif
#ifdef USE_COLOR
  if (uSpring + uAutumn + uWinter > 0.001) {
    // Jahreszeiten: Grüntöne färben sich (Laub stark, Wiesen schwach), im Winter Schnee obenauf
    vec3 c = diffuseColor.rgb;
    float glowC = max(step(distance(c, uGlowA), 0.012), step(distance(c, uGlowB), 0.012));
    float green = clamp((c.g - max(c.r, c.b)) * 5.0, 0.0, 1.0);
    float n1 = wwNoise(vWPos.xz * 0.45);
    float n2 = wwNoise(vWPos.xz * 1.7 + 3.1);
    float lum = dot(c, vec3(0.3, 0.55, 0.15));
    c = mix(c, c * vec3(0.97, 1.05, 0.93) + vec3(0.0, 0.01, 0.0), uSpring * green);
    vec3 fall = mix(vec3(0.93, 0.55, 0.16), vec3(0.95, 0.78, 0.25), n1);
    fall = mix(fall, vec3(0.80, 0.30, 0.16), step(0.68, n2));
    c = mix(c, fall * (0.55 + lum * 0.9), uAutumn * green * max(vLeaf * 0.9, 0.13));
    c = mix(c, vec3(lum) * vec3(0.92, 0.97, 1.02), uWinter * green * 0.45);
    float up = smoothstep(0.45, 0.85, wwUp);
    float patchy = smoothstep(0.12, 0.42, n1 * 0.7 + n2 * 0.3 + 0.15);
    c = mix(c, vec3(0.97, 0.99, 1.04), uWinter * up * patchy * 0.93 * (1.0 - glowC));
    diffuseColor.rgb = c;
  }
#endif`,
          )
          .replace(
            '#include <emissivemap_fragment>',
            /* glsl */ `#include <emissivemap_fragment>
  float wwGlowMask = 0.0;
#ifdef USE_COLOR
  wwGlowMask = max(step(distance(vColor.rgb, uGlowA), 0.012), step(distance(vColor.rgb, uGlowB), 0.012));
  totalEmissiveRadiance += vColor.rgb * wwGlowMask * uGlow * 1.05;
#endif`,
          )
          .replace(
            '#include <opaque_fragment>',
            /* glsl */ `
  if (uCloud > 0.0) {
    vec2 cp = vWPos.xz * 0.035 + vec2(uTime * 0.012, uTime * 0.006);
    float n = wwNoise(cp) * 0.65 + wwNoise(cp * 2.3 + 7.1) * 0.35;
    float cloud = smoothstep(0.52, 0.72, n);
    outgoingLight *= 1.0 - uCloud * cloud * 0.24 * (1.0 - wwGlowMask);
  }
  outgoingLight *= 1.0 - uWet * 0.12 * (1.0 - wwGlowMask);
#include <opaque_fragment>`,
          );
    };
    mat.customProgramCacheKey = () => 'wiesenwerk-atmo';
    mat.needsUpdate = true;
  }

  /** Wasser: sanfte Wellenbänder und funkelnde Lichtreflexe. */
  patchWater(mat: MeshLambertMaterial): void {
    mat.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, this.u);
      shader.vertexShader =
        'varying vec3 vWPos;\n' +
        shader.vertexShader.replace(
          '#include <project_vertex>',
          '#include <project_vertex>\n  vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader =
        `uniform float uTime; uniform float uSun; uniform float uGlow;\nvarying vec3 vWPos;\n${NOISE}\n` +
        shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          /* glsl */ `#include <emissivemap_fragment>
  {
    vec2 p = vWPos.xz;
    float w = sin(p.x * 0.9 + uTime * 0.8 + wwNoise(p * 0.3) * 3.0) * sin(p.y * 0.7 - uTime * 0.6);
    diffuseColor.rgb *= 0.93 + 0.08 * w;
    float s = wwNoise(p * 2.2 + vec2(uTime * 0.5, -uTime * 0.35));
    float spark = pow(max(0.0, s - 0.55) / 0.45, 6.0);
    totalEmissiveRadiance += vec3(1.0, 0.96, 0.85) * spark * (0.55 * uSun + 0.25 * uGlow);
  }`,
        );
    };
    mat.customProgramCacheKey = () => 'wiesenwerk-water';
    mat.needsUpdate = true;
  }

  /**
   * Pro Bild: Tageszeit und Wetter aus der Spielzeit, Lichter und Nebel einstellen,
   * Regen und Glühwürmchen um den Blickpunkt (`cx`, `cz`, sichtbare Höhe `view`) setzen.
   */
  update(
    simTicks: number,
    seed: number,
    now: number,
    preset: QualityPreset,
    dayNight: boolean,
    sun: DirectionalLight,
    sunDir: Vector3,
    hemi: HemisphereLight,
    fog: Fog,
    background: Color,
    cx: number,
    cz: number,
    view: number,
    /** Fotomodus: fest gewählte Tageszeit (0..1) statt der Spielzeit. */
    timeOverride: number | null = null,
    /** Jahreszeit als fortlaufende Zahl 0..4 (`seasonAt`). */
    season = SEASON_CONFIG.fixedSeason + 0.5,
  ): void {
    this.season = season;
    const mix = seasonWeights(season, this.seasonMix);
    // dieselbe Rechnung wie für die Solarfelder in der Simulation
    const t = timeOverride ?? dayTimeAt(simTicks, dayNight);
    this.dayTime = t;

    // Stützpunkte suchen und mischen
    let k = 0;
    while (k < KEYS.length - 2 && KEYS[k + 1].t <= t) k++;
    const a = KEYS[k];
    const b = KEYS[k + 1];
    const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 0;

    // Regen (nur Ultra)
    this.rain = preset.weather ? rainAt(simTicks / SIM_CONFIG.ticksPerSecond, seed) : 0;
    const dry = 1 - this.rain * 0.35;

    lerpColor(sun.color, a.sun, b.sun, f);
    sun.intensity = lerp(a.sunI, b.sunI, f) * dry;
    lerpColor(hemi.color, a.sky, b.sky, f);
    lerpColor(hemi.groundColor, a.ground, b.ground, f);
    hemi.intensity = lerp(a.hemiI, b.hemiI, f) * (1 - this.rain * 0.12);
    lerpColor(fog.color, a.fog, b.fog, f);
    if (this.rain > 0) fog.color.lerp(ca.setHex(PALETTE.rainFog), this.rain * 0.55);
    // Winter: kühleres, klareres Licht (sonst wirkt der Schnee beige)
    const winter = this.seasonMix[3];
    if (winter > 0) {
      ca.setHex(PALETTE.winterLight);
      sun.color.lerp(ca, winter * 0.45);
      hemi.color.lerp(ca, winter * 0.35);
      fog.color.lerp(ca, winter * 0.3);
    }
    background.copy(fog.color);
    this.glow = lerp(a.glow, b.glow, f);

    // Sonnenstand: tagsüber von Ost nach West, flach am Morgen und Abend; nachts der Mond
    const dayU = Math.min(1, Math.max(0, (t - 0.2) / 0.65));
    const az = -0.9 + dayU * 1.8;
    const elev = 0.3 + 0.9 * Math.sin(Math.PI * dayU);
    sunDay.set(-Math.cos(az) * 0.6, elev, Math.sin(az) * 0.6 + 0.25).normalize();
    sunDir.copy(sunDay).lerp(MOON_DIR, this.glow).normalize();

    const u = this.u;
    u.uTime.value = now / 1000;
    u.uGlow.value = this.glow;
    u.uSway.value = preset.sway ? 1 + this.rain * 0.8 : 0;
    u.uCloud.value = preset.clouds ? 1 : 0;
    // im Winter fällt Schnee statt Regen: kein nasser Boden
    u.uWet.value = this.rain * (1 - mix[3]);
    u.uView.value = view;
    u.uSpring.value = mix[0];
    u.uAutumn.value = mix[2];
    u.uWinter.value = mix[3];
    u.uSun.value = (1 - this.glow) * dry;

    this.updateRain(now, cx, cz, view);
    this.updateFlies(now, preset.fireflies && this.rain < 0.2 ? this.glow : 0, cx, cz, view);
  }

  private updateRain(now: number, cx: number, cz: number, view: number): void {
    const show = this.rain > 0.01;
    this.rainLines.visible = show;
    if (!show) return;
    const mat = this.rainLines.material as LineBasicMaterial;
    // Winter: dicke, langsame Flocken statt Regenstriche
    const snow = this.seasonMix[3] > 0.5;
    mat.opacity = (snow ? 0.8 : 0.3) * this.rain;
    mat.color.setHex(snow ? PALETTE.snow : PALETTE.rain);
    const speed = snow ? 16 / SEASON_CONFIG.snowSlowdown : 16;
    const len = snow ? 0.07 : 0.3;
    const n = WEATHER_CONFIG.drops;
    const period = anchorPeriod(view * 2.2);
    const top = 14;
    const t = now / 1000;
    const pos = this.rainPos;
    const s = this.rainSeed;
    for (let i = 0; i < n; i++) {
      const x = anchored(s[i * 3], cx, period);
      const z = anchored(s[i * 3 + 1], cz, period);
      const y = top - ((t * speed + s[i * 3 + 2] * top) % top);
      // Flocken taumeln seitlich
      const drift = snow ? Math.sin(t * 1.3 + s[i * 3] * 40) * 0.25 : 0;
      const o = i * 6;
      pos[o] = x + drift;
      pos[o + 1] = y;
      pos[o + 2] = z;
      pos[o + 3] = x + drift - 0.04 * (snow ? 0.5 : 1);
      pos[o + 4] = y - len;
      pos[o + 5] = z + 0.02;
    }
    this.rainLines.geometry.getAttribute('position').needsUpdate = true;
  }

  private updateFlies(now: number, amount: number, cx: number, cz: number, view: number): void {
    const show = amount > 0.05;
    this.flies.visible = show;
    if (!show) return;
    (this.flies.material as PointsMaterial).opacity = amount * (0.7 + 0.3 * Math.sin(now / 300));
    const t = now / 1000;
    const period = anchorPeriod(view * 1.6);
    const pos = this.flyPos;
    const s = this.rainSeed;
    for (let i = 0; i < pos.length / 3; i++) {
      const ph = s[i * 3 + 2] * 6.28;
      pos[i * 3] = anchored(s[i * 3], cx, period) + Math.sin(t * 0.4 + ph) * 0.8;
      pos[i * 3 + 1] = 0.4 + Math.sin(t * 0.9 + ph * 2) * 0.3 + 0.4 * s[i * 3 + 2];
      pos[i * 3 + 2] = anchored(s[i * 3 + 1], cz, period) + Math.cos(t * 0.33 + ph) * 0.8;
    }
    this.flies.geometry.getAttribute('position').needsUpdate = true;
  }
}

/** Regenstärke zur Spielzeit: einzelne Schauer mit sanftem Ein- und Ausklingen. */
export function rainAt(seconds: number, seed: number): number {
  const slot = Math.floor(seconds / WEATHER_CONFIG.slotSeconds);
  if (slot < 1 || hash3Float(slot, 13, seed) >= WEATHER_CONFIG.rainChance) return 0;
  const f = seconds / WEATHER_CONFIG.slotSeconds - slot;
  const env = smooth(Math.min(1, f / 0.25)) * smooth(Math.min(1, (1 - f) / 0.25));
  return env;
}

function lerp(x: number, y: number, f: number): number {
  return x + (y - x) * f;
}

function lerpColor(out: Color, x: number, y: number, f: number): void {
  out.copy(ca.setHex(x)).lerp(cb.setHex(y), f);
}

function smooth(x: number): number {
  return x * x * (3 - 2 * x);
}
