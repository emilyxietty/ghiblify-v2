/**
 * Cursor whimsy — keeps the OS cursor as-is and adds a small particle
 * trail beside it. Reads `appearance.cursor` from AppContext.
 *
 *   trail modes (soot, sparkle, petal, bubble, heart, leaf)
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
import { CursorName, useAppContext } from "../../contexts/AppContext";
import "./CursorEffect.css";

const TRAIL_MODES: CursorName[] = [
  "soot",
  "sparkle",
  "petal",
  "bubble",
  "heart",
  "leaf",
  "strawberry",
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
  sparkle: 70,
  petal: 70,
};

// Modes that drift downward with gravity (vs the default upward float).
// Strawberries fall like fruit — gravity feels natural.
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
      // (they're a heavier "fruit" trail, not airy debris) — half
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

/**
 * Rainbow trail — a continuous canvas line drawn behind the cursor,
 * not discrete particles. On every mousemove we draw a segment from
 * the previous cursor position to the current one, painted with the
 * next hue in a cycling HSL sweep. A per-frame `destination-out`
 * fade over the whole canvas erases old strokes gradually so the
 * tail trails off smoothly. The visible result is one ribbon of
 * shifting color following the cursor.
 */
const RainbowTrail: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match the canvas backing store to viewport × DPR so strokes
    // render crisp on retina without filling memory on low-DPI.
    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // Wide ribbon — a thin line read as a frantic squiggle, this
      // reads as a pastel brush stroke following the cursor.
      ctx.lineWidth = 18;
    };
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);

    let lastX = -1;
    let lastY = -1;
    let hue = 0;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      if (lastX < 0) {
        lastX = e.clientX;
        lastY = e.clientY;
        return;
      }
      // Stroke a segment from the previous cursor position to the
      // current one. Hue advances 6° per move so 60 segments paints
      // a full rainbow — any reasonable mouse motion produces an
      // obviously colorful arc.
      // Pastel palette: lower saturation + higher lightness, plus
      // the alpha makes each freshly-drawn segment sit translucent
      // on the page so it doesn't read as a solid neon pen.
      ctx.strokeStyle = `hsla(${hue}, 70%, 78%, 0.55)`;
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(e.clientX, e.clientY);
      ctx.stroke();
      lastX = e.clientX;
      lastY = e.clientY;
      hue = (hue + 6) % 360;
    };

    // Per-frame subtractive fade. `destination-out` with low alpha
    // erases a thin layer of every existing pixel each frame, so
    // strokes lose opacity gradually rather than vanishing all at
    // once. Tune alpha (0–1) for a longer/shorter trail tail.
    //
    // The fillRect coordinates run through the dpr-scaled transform
    // we set in sizeCanvas — so we pass CSS px (window.innerWidth /
    // .innerHeight), NOT canvas.width/.height (which are device px).
    // Using device-px values here let the transform scale them up
    // again, drawing past the canvas; only the top-left chunk got
    // faded each frame and strokes elsewhere accumulated forever.
    const tick = () => {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.06)";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    document.addEventListener("mousemove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", sizeCanvas);
      document.removeEventListener("mousemove", onMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="cursor-rainbow-canvas" />;
};

const CursorEffect: React.FC = () => {
  const { appearance } = useAppContext();
  const mode = appearance.cursor ?? "default";
  if (mode === "default") return null;
  if (mode === "rainbow") return <RainbowTrail />;
  if (TRAIL_MODES.includes(mode)) return <Trail kind={mode} />;
  return null;
};

export default CursorEffect;
