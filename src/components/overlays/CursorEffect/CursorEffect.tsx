/**
 * Cursor whimsy - keeps the OS cursor as-is and adds a small particle
 * trail beside it. Reads `appearance.cursor` from AppContext.
 *
 *   companion mode (sootsprite)
 *     Not a trail: a persistent single-file line of animated soot
 *     sprites that walks after the cursor - see SootCompanion below.
 *
 *   trail modes (soot, sparkle, petal, bubble, heart, leaf,
 *                strawberry, shikigami)
 *     Particles emit at the cursor position on movement (per-mode
 *     throttle). Each particle has a CSS animation that drifts +
 *     fades; we cull after a fixed lifetime so the active list never
 *     grows unbounded. Drift direction varies per mode (petals/leaves
 *     fall down, bubbles/sparkles/hearts float up).
 *
 * `pointer-events: none` on every rendered element so nothing
 * intercepts clicks. Mount once at the App root.
 */

import React, { useEffect, useRef, useState } from "react";
import { assetUrl } from "../../../utils/assetUrl";
import {
  CursorName,
  cursorAssetPath,
  normalizeCursor,
  useAppContext,
} from "../../../contexts/AppContext";
import "./CursorEffect.css";

const TRAIL_MODES: CursorName[] = [
  "soot",
  "sparkle",
  "petal",
  "bubble",
  "heart",
  "leaf",
  "strawberry",
  "shikigami",
];

// How long a trail particle stays alive (must match the CSS
// animation duration on `.cursor-particle`).
const PARTICLE_LIFETIME_MS = 1100;
// Minimum gap between particle spawns. Per-mode so soot is sparser
// (fluffy, ambient) and sparkles/petals feel denser.
const THROTTLE_BY_MODE: Record<string, number> = {
  soot: 180,
  bubble: 140,
  heart: 110,
  leaf: 110,
  strawberry: 130,
  // Dense enough to read as a flock rather than the odd bird - these
  // arrive in swarms in the film, and a single one every 200ms just
  // looked like a stray.
  shikigami: 60,
  sparkle: 70,
  petal: 70,
};

// Modes that drift downward with gravity (vs the default upward float).
// Strawberries fall like fruit - gravity feels natural.
const FALLING_MODES = new Set<CursorName>(["petal", "leaf", "strawberry"]);

interface Particle {
  id: number;
  x: number;
  y: number;
  // Per-particle randomness so trails look organic.
  driftX: number;
  driftY: number;
  rotate: number;
  scale: number;
}

const Trail: React.FC<{ kind: CursorName }> = ({ kind }) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const lastSpawnRef = useRef(0);
  const idRef = useRef(0);

  useEffect(() => {
    const throttle = THROTTLE_BY_MODE[kind] ?? 70;
    const falls = FALLING_MODES.has(kind);
    const onMove = (e: MouseEvent) => {
      const now = performance.now();
      if (now - lastSpawnRef.current < throttle) return;
      lastSpawnRef.current = now;
      const id = ++idRef.current;
      // Strawberries hug the cursor more tightly than petals/leaves
      // (they're a heavier "fruit" trail, not airy debris) - half
      // the falling drift keeps the berries near the cursor instead
      // of drifting far below it.
      const driftY =
        kind === "strawberry"
          ? 14 + Math.random() * 12
          : falls
            ? 30 + Math.random() * 24
            : kind === "soot"
              ? -8 - Math.random() * 14
              : -12 - Math.random() * 20;
      const driftX =
        kind === "strawberry"
          ? (Math.random() - 0.5) * 14
          : (Math.random() - 0.5) * (falls ? 28 : 22);
      const rotate = (Math.random() - 0.5) * 90;
      const scale =
        kind === "soot"
          ? 0.85 + Math.random() * 0.35
          : 0.7 + Math.random() * 0.6;
      const p: Particle = {
        id,
        x: e.clientX,
        y: e.clientY,
        driftX,
        driftY,
        rotate,
        scale,
      };
      setParticles((prev) => [...prev, p]);
      window.setTimeout(() => {
        setParticles((prev) => prev.filter((q) => q.id !== id));
      }, PARTICLE_LIFETIME_MS);
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, [kind]);

  return (
    <div className="cursor-trail" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className={`cursor-particle cursor-particle-${kind}`}
          style={{
            left: `${p.x}px`,
            top: `${p.y}px`,
            // CSS reads these for the keyframes' end transform.
            ["--drift-x" as any]: `${p.driftX}px`,
            ["--drift-y" as any]: `${p.driftY}px`,
            ["--rotate" as any]: `${p.rotate}deg`,
            ["--scale" as any]: p.scale,
          }}
        >
          <img src={assetUrl(cursorAssetPath(kind))} alt="" draggable={false} />
        </div>
      ))}
    </div>
  );
};

// --- Soot companion -------------------------------------------------
// "sootsprite" isn't a trail: it's a little FAMILY of animated sprites
// that walk after the OS cursor. At rest they sit stacked as one; each
// chases the pointer at a different speed, so movement strings them
// out along the path and stillness merges them back together. A rAF
// loop lerps every sprite toward its target and writes transforms
// straight to the DOM nodes - no React state per mousemove, so
// following stays 60fps cheap. The GIFs keep animating the whole time.
const SOOT_COUNT = 3;
// The whole file walks at the same size.
const SOOT_SIZES = [44, 44, 44];
// Every sprite chases the SAME point, each at its own speed - so at
// rest they sit stacked on top of one another as a single sprite, and
// motion strings them out along the path until they catch up and
// merge again. The spread between these numbers IS the trail length.
const SOOT_EASES = [0.18, 0.11, 0.065];
// Rest offset of the LEADER from the pointer hotspot: just
// below-right, so the line tags along beside the arrow instead of
// hiding under it.
const SOOT_OFFSET_X = 38;
const SOOT_OFFSET_Y = 30;

const SootCompanion: React.FC = () => {
  const wrapRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const wraps = wrapRefs.current.slice(0, SOOT_COUNT);
    if (wraps.some((w) => !w)) return;

    // Pointer target; each sprite's current position + facing.
    // Hidden until the first real mousemove seeds the line.
    let pointerX = 0;
    let pointerY = 0;
    let seeded = false;
    const curX = new Array<number>(SOOT_COUNT).fill(0);
    const curY = new Array<number>(SOOT_COUNT).fill(0);
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      pointerX = e.clientX + SOOT_OFFSET_X;
      pointerY = e.clientY + SOOT_OFFSET_Y;
      if (!seeded) {
        seeded = true;
        for (let i = 0; i < SOOT_COUNT; i++) {
          // Seed the stack directly on the pointer's rest point.
          curX[i] = pointerX;
          curY[i] = pointerY;
        }
        wraps.forEach((w) => (w!.style.opacity = "1"));
      }
    };
    // Pointer left the window: fade the family out so it doesn't sit
    // orphaned at the edge; next move brings it back.
    const onLeave = () => {
      wraps.forEach((w) => (w!.style.opacity = "0"));
    };
    const onEnter = () => {
      if (seeded) wraps.forEach((w) => (w!.style.opacity = "1"));
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!seeded) return;
      for (let i = 0; i < SOOT_COUNT; i++) {
        // Everyone chases the same pointer rest point, each at its
        // own ease - slower sprites lag further behind on the path,
        // then pile back onto the stack when the mouse settles. No
        // flipping - the GIF keeps its native right-facing pose.
        curX[i] += (pointerX - curX[i]) * SOOT_EASES[i];
        curY[i] += (pointerY - curY[i]) * SOOT_EASES[i];
        wraps[i]!.style.transform =
          `translate3d(${curX[i]}px, ${curY[i]}px, 0)`;
      }
    };

    document.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseenter", onEnter);
    raf = requestAnimationFrame(tick);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseenter", onEnter);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {/* Followers render first so the leader overlaps on crossings. */}
      {Array.from({ length: SOOT_COUNT }, (_, i) => SOOT_COUNT - 1 - i).map(
        (i) => (
          <div
            key={i}
            ref={(el) => {
              wrapRefs.current[i] = el;
            }}
            className="cursor-companion"
            style={{
              width: `${SOOT_SIZES[i]}px`,
              height: `${SOOT_SIZES[i]}px`,
              marginLeft: `${-SOOT_SIZES[i] / 2}px`,
              marginTop: `${-SOOT_SIZES[i] / 2}px`,
            }}
            aria-hidden="true"
          >
            <img
              src={assetUrl(cursorAssetPath("sootsprite"))}
              alt=""
              draggable={false}
            />
          </div>
        ),
      )}
    </>
  );
};

const CursorEffect: React.FC = () => {
  const { appearance } = useAppContext();
  // Normalised, so a cursor retired in a later build (the old rainbow
  // trail) degrades to the plain pointer instead of rendering nothing
  // while the picker shows no selection.
  const mode = normalizeCursor(appearance.cursor);
  if (mode === "default") return null;
  if (mode === "sootsprite") return <SootCompanion />;
  if (TRAIL_MODES.includes(mode)) return <Trail kind={mode} />;
  return null;
};

export default CursorEffect;
