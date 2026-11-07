import { useEffect, useRef } from "react";
import { canRunHeroEffects, readVisualEffectsPref } from "../lib/visual-capability";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  life: number;
};

function sampleRupee(w: number, h: number, count: number): { x: number; y: number }[] {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${Math.floor(h * 0.55)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("₹", w / 2, h / 2 + h * 0.02);
  const { data } = ctx.getImageData(0, 0, w, h);
  const pts: { x: number; y: number }[] = [];
  const step = 3;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4]! > 128) pts.push({ x, y });
    }
  }
  if (pts.length <= count) return pts;
  const out: { x: number; y: number }[] = [];
  const stride = pts.length / count;
  for (let i = 0; i < count; i++) out.push(pts[Math.floor(i * stride)]!);
  return out;
}

export function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (!canRunHeroEffects(readVisualEffectsPref())) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let pointer = { x: 0.5, y: 0.5 };
    let particles: Particle[] = [];
    let w = 0;
    let h = 0;
    let dpr = 1;
    let formT = 0;
    let frames = 0;
    let fpsAcc = 0;
    let last = performance.now();
    let degraded = false;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(1400, Math.floor((w * h) / 280));
      const targets = sampleRupee(Math.floor(w * 0.7), Math.floor(h * 0.7), count);
      const ox = w * 0.15;
      const oy = h * 0.15;
      particles = targets.map((t) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0,
        vy: 0,
        tx: t.x + ox,
        ty: t.y + oy,
        life: Math.random(),
      }));
    };

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      pointer = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    };

    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        running = false;
      } else if (!running && !degraded) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    const loop = (now: number) => {
      if (!running) return;
      const dt = Math.min(32, now - last);
      last = now;
      frames++;
      fpsAcc += dt;
      if (fpsAcc > 2000) {
        const fps = (frames / fpsAcc) * 1000;
        frames = 0;
        fpsAcc = 0;
        if (fps < 40) {
          degraded = true;
          running = false;
          canvas.classList.add("hero-canvas-off");
          return;
        }
      }

      formT = Math.min(1, formT + dt / 1800);
      const form = 1 - Math.pow(1 - formT, 3);
      const px = (pointer.x - 0.5) * 40;
      const py = (pointer.y - 0.5) * 40;

      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, w * 0.55);
      g.addColorStop(0, "rgba(198,244,50,0.08)");
      g.addColorStop(0.45, "rgba(56,189,248,0.04)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (const p of particles) {
        const tx = p.tx + px;
        const ty = p.ty + py;
        const ax = (tx - p.x) * 0.045 * form;
        const ay = (ty - p.y) * 0.045 * form;
        p.vx = (p.vx + ax) * 0.86;
        p.vy = (p.vy + ay) * 0.86;
        p.x += p.vx;
        p.y += p.vy;
        const glow = 0.35 + 0.65 * form;
        ctx.fillStyle = `rgba(198,244,50,${0.25 + glow * 0.55})`;
        ctx.fillRect(p.x, p.y, 1.6, 1.6);
      }

      raf = requestAnimationFrame(loop);
    };

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointermove", onMove);
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className="hero-canvas" aria-hidden="true" />;
}
