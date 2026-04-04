"use client";

import { useEffect, useRef, useState } from "react";

const MATRIX_CHARS = "ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍRAMOLA01234567890";
const TRIGGER = "JCS";

export function MatrixEasterEgg() {
  const [active, setActive] = useState(false);
  const bufferRef = useRef("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // Listen for trigger sequence
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (active) {
        // Dismiss on any key
        setActive(false);
        return;
      }

      bufferRef.current += e.key;
      // Keep only last 3 chars
      if (bufferRef.current.length > TRIGGER.length) {
        bufferRef.current = bufferRef.current.slice(-TRIGGER.length);
      }
      if (bufferRef.current === TRIGGER) {
        bufferRef.current = "";
        setActive(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);

  // Dismiss on mouse move
  useEffect(() => {
    if (!active) return;

    let moved = false;
    function onMove() {
      if (moved) {
        setActive(false);
      }
      moved = true; // ignore first move event (can fire immediately)
    }

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [active]);

  // Canvas animation
  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(animRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const fontSize = 16;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = new Array(columns).fill(0).map(() => Math.random() * -100);

    let lastTime = 0;
    const interval = 50; // ms between frames

    function draw(time: number) {
      if (!ctx || !canvas) return;

      if (time - lastTime < interval) {
        animRef.current = requestAnimationFrame(draw);
        return;
      }
      lastTime = time;

      // Semi-transparent black to create trail effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#0f0";
      ctx.font = `${fontSize}px monospace`;
      ctx.shadowColor = "#0f0";
      ctx.shadowBlur = 3;

      for (let i = 0; i < drops.length; i++) {
        const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Lead character is brighter
        ctx.fillStyle = "#fff";
        ctx.fillText(char, x, y);
        ctx.fillStyle = "#0f0";
        ctx.fillText(char, x, y - fontSize);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      animRef.current = requestAnimationFrame(draw);
    }

    // Initial black fill
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    animRef.current = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animRef.current);
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[9999] cursor-none" style={{ background: "#000" }}>
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p
          className="text-2xl md:text-4xl font-bold font-mono tracking-widest"
          style={{
            color: "#0f0",
            textShadow: "0 0 20px #0f0, 0 0 40px #0f0, 0 0 80px #0a0",
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          Wake up...
        </p>
        <p
          className="mt-4 text-lg md:text-xl font-mono"
          style={{
            color: "#0f0",
            opacity: 0.7,
            textShadow: "0 0 10px #0f0",
          }}
        >
          The Matrix has you
        </p>
        <p className="mt-8 text-xs font-mono" style={{ color: "#0a0", opacity: 0.4 }}>
          Follow the white rabbit...
        </p>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
