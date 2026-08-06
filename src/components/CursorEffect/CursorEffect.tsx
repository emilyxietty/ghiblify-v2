/**
 * Cursor whimsy - keeps the OS cursor as-is and adds a small particle
 * trail beside it. Reads `appearance.cursor` from AppContext.
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
import {
  CursorName,
  normalizeCursor,
  useAppContext,
} from "../../contexts/AppContext";
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
          <img src={`/assets/cursors/${kind}.svg`} alt="" draggable={false} />
        </div>
      ))}
    </div>
  );
};

const CursorEffect: React.FC = () => {
  const { appearance } = useAppContext();
  // Normalised, so a cursor retired in a later build (the old rainbow
  // trail) degrades to the plain pointer instead of rendering nothing
  // while the picker shows no selection.
  const mode = normalizeCursor(appearance.cursor);
  if (mode === "default") return null;
  if (TRAIL_MODES.includes(mode)) return <Trail kind={mode} />;
  return null;
};

export default CursorEffect;
