import React, { useState, useEffect, useRef, useCallback } from 'react';
import GameCanvas from './components/GameCanvas';
import { GoogleGenAI } from "@google/genai";
import { RESTORE_COST, RESET_RECHARGE_MS } from './constants';

// ─── Physics Curtain ──────────────────────────────────────────────────────────
interface CurtainPoint { x: number; y: number; ox: number; oy: number; vx: number; vy: number; pinned: boolean; }

function useCurtainCanvas(canvasRef: React.RefObject<HTMLCanvasElement>, side: 'left' | 'right') {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const COLS = 14;
    const ROWS = 22;
    const restLen = H / (ROWS - 1);

    const pts: CurtainPoint[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = side === 'left'
          ? c * (W / (COLS - 1))
          : W - c * (W / (COLS - 1));
        const y = r * restLen;
        pts.push({ x, y, ox: x, oy: y, vx: 0, vy: 0, pinned: r === 0 });
      }
    }

    const idx = (r: number, c: number) => r * COLS + c;
    let t = 0;
    let rafId: number;

    const update = () => {
      t += 0.012;
      const wind = Math.sin(t * 0.7) * 0.9 + Math.sin(t * 1.3) * 0.4;

      pts.forEach(p => {
        if (p.pinned) return;
        p.vy += 0.22;
        p.vx += wind;
        p.vx *= 0.96;
        p.vy *= 0.97;
        p.x += p.vx;
        p.y += p.vy;
      });

      // Constraint relaxation
      for (let iter = 0; iter < 8; iter++) {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const p = pts[idx(r, c)];
            // Vertical
            if (r < ROWS - 1) {
              const q = pts[idx(r + 1, c)];
              const dx = q.x - p.x; const dy = q.y - p.y;
              const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
              const diff = (d - restLen) / d * 0.5;
              const mx = dx * diff; const my = dy * diff;
              if (!p.pinned) { p.x += mx; p.y += my; }
              if (!q.pinned) { q.x -= mx; q.y -= my; }
            }
            // Horizontal
            if (c < COLS - 1) {
              const q = pts[idx(r, c + 1)];
              const hRest = W / (COLS - 1);
              const dx = q.x - p.x; const dy = q.y - p.y;
              const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
              const diff = (d - hRest) / d * 0.5;
              const mx = dx * diff; const my = dy * diff;
              if (!p.pinned) { p.x += mx; p.y += my; }
              if (!q.pinned) { q.x -= mx; q.y -= my; }
            }
          }
        }
      }

      // ── Draw ──
      ctx.clearRect(0, 0, W, H);

      // Fabric triangles
      for (let r = 0; r < ROWS - 1; r++) {
        for (let c = 0; c < COLS - 1; c++) {
          const tl = pts[idx(r, c)];
          const tr = pts[idx(r, c + 1)];
          const bl = pts[idx(r + 1, c)];
          const br = pts[idx(r + 1, c + 1)];

          const depthFactor = 1 - r / ROWS;
          const baseDark = side === 'left' ? [45, 10, 5] : [35, 8, 3];
          const baseLight = [120, 40, 15];
          const interp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
          const cr = interp(baseDark[0], baseLight[0], depthFactor * 0.6);
          const cg = interp(baseDark[1], baseLight[1], depthFactor * 0.6);
          const cb = interp(baseDark[2], baseLight[2], depthFactor * 0.6);

          ctx.fillStyle = `rgba(${cr},${cg},${cb},0.96)`;
          ctx.beginPath();
          ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y);
          ctx.lineTo(bl.x, bl.y); ctx.closePath(); ctx.fill();

          // Gold trim lines every 3 rows
          if (r % 3 === 0) {
            ctx.strokeStyle = `rgba(200,155,60,${0.15 + depthFactor * 0.2})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Gold tassel edge
      const edgeCol = side === 'left' ? COLS - 1 : 0;
      for (let r = 0; r < ROWS - 1; r++) {
        const p1 = pts[idx(r, edgeCol)];
        const p2 = pts[idx(r + 1, edgeCol)];
        ctx.strokeStyle = `rgba(200,155,60,0.7)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
      // Tassel drops at bottom
      const bottomRow = ROWS - 1;
      for (let c = 0; c < COLS; c += 2) {
        const p = pts[idx(bottomRow, c)];
        const dropLen = 18 + Math.sin(t + c) * 4;
        ctx.strokeStyle = 'rgba(200,155,60,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.sin(t + c) * 2, p.y + dropLen);
        ctx.stroke();
        ctx.fillStyle = '#c89b3c';
        ctx.beginPath();
        ctx.arc(p.x + Math.sin(t + c) * 2, p.y + dropLen, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Top ornate rod
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, '#8b6914');
      grad.addColorStop(0.3, '#ffd700');
      grad.addColorStop(0.7, '#ffd700');
      grad.addColorStop(1, '#8b6914');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, 8);
      ctx.fillStyle = '#c89b3c';
      ctx.beginPath();
      ctx.arc(W / 2, 4, 6, 0, Math.PI * 2);
      ctx.fill();

      rafId = requestAnimationFrame(update);
    };
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [side]);
}

// ─── Smoke Particles ─────────────────────────────────────────────────────────
function SmokeParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width = canvas.offsetWidth;
    const H = canvas.height = canvas.offsetHeight;
    const particles: { x: number; y: number; r: number; vx: number; vy: number; life: number; maxLife: number; }[] = [];
    const spawn = () => {
      particles.push({
        x: Math.random() * W, y: H + 10,
        r: 20 + Math.random() * 40,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(0.3 + Math.random() * 0.5),
        life: 0, maxLife: 160 + Math.random() * 80
      });
    };
    let frame = 0;
    let rafId: number;
    const draw = () => {
      frame++;
      if (frame % 18 === 0) spawn();
      ctx.clearRect(0, 0, W, H);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.life++;
        const t = p.life / p.maxLife;
        const alpha = Math.sin(t * Math.PI) * 0.12;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (1 + t));
        grad.addColorStop(0, `rgba(200,150,50,${alpha})`);
        grad.addColorStop(0.5, `rgba(100,50,20,${alpha * 0.5})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + t), 0, Math.PI * 2);
        ctx.fill();
        if (p.life >= p.maxLife) particles.splice(i, 1);
      }
      rafId = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(rafId);
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}

// ─── Left Curtain ─────────────────────────────────────────────────────────────
function LeftCurtain() {
  const ref = useRef<HTMLCanvasElement>(null);
  useCurtainCanvas(ref, 'left');
  return <canvas ref={ref} width={180} height={700} style={{ position: 'absolute', left: 0, top: 0, height: '100%', pointerEvents: 'none' }} />;
}
function RightCurtain() {
  const ref = useRef<HTMLCanvasElement>(null);
  useCurtainCanvas(ref, 'right');
  return <canvas ref={ref} width={180} height={700} style={{ position: 'absolute', right: 0, top: 0, height: '100%', pointerEvents: 'none' }} />;
}

// ─── Ornate HUD Bar ───────────────────────────────────────────────────────────
function HudBar({ value, color, label, icon }: { value: number; color: string; label: string; icon: string }) {
  const isLow = value < 25;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 130 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, fontFamily: 'Cinzel, serif', letterSpacing: '0.15em', color: 'rgba(200,155,60,0.7)', textTransform: 'uppercase' }}>
          {icon} {label}
        </span>
        <span style={{ fontSize: 9, fontFamily: 'Cinzel, serif', color: isLow ? '#ff4444' : 'rgba(200,155,60,0.5)', letterSpacing: '0.05em' }}>
          {Math.round(value)}%
        </span>
      </div>
      <div className="hud-bar-container" style={{ height: 10 }}>
        {/* Segmented ticks */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', top: 0, bottom: 0, left: `${i * 10}%`, width: 1,
            background: 'rgba(0,0,0,0.4)', zIndex: 2
          }} />
        ))}
        <div style={{
          height: '100%', width: `${value}%`,
          background: color === 'red'
            ? `linear-gradient(to right, #5a0000, #c0392b, #e74c3c)`
            : `linear-gradient(to right, #0a2a50, #1e6bbf, #5bb3f5)`,
          transition: 'width 0.25s ease',
          position: 'relative',
          animation: isLow ? 'healthPulse 0.8s ease-in-out infinite' : 'none'
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)' }} />
        </div>
      </div>
      {/* Ornate border dots */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{
            width: 4, height: 4, borderRadius: 1,
            background: i < Math.round(value / 10)
              ? (color === 'red' ? '#c0392b' : '#1e88e5')
              : 'rgba(255,255,255,0.07)',
            boxShadow: i < Math.round(value / 10) ? `0 0 4px ${color === 'red' ? '#c0392b' : '#1e88e5'}` : 'none'
          }} />
        ))}
      </div>
    </div>
  );
}

// ─── Score Gem ────────────────────────────────────────────────────────────────
function ScoreDisplay({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 8, fontFamily: 'Cinzel, serif', letterSpacing: '0.25em', color: 'rgba(200,155,60,0.5)', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 26, fontFamily: 'Cinzel Decorative, cursive', fontWeight: 900, color: '#e8c56a', letterSpacing: '0.05em', textShadow: '0 0 12px rgba(200,155,60,0.6)' }}>
        {value}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [score, setScore] = useState(0);
  const [height, setHeight] = useState(0);
  const [fuel, setFuel] = useState(100);
  const [health, setHealth] = useState(100);
  const [charge, setCharge] = useState(0);
  const [totalCoins, setTotalCoins] = useState(Number(localStorage.getItem('totalCoins') || 0));
  const [coinsInRun, setCoinsInRun] = useState(0);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
  const [biomeTitle, setBiomeTitle] = useState('THE FOOTHILLS');
  const [restartKey, setRestartKey] = useState(0);
  const [restoreKey, setRestoreKey] = useState(0);
  const [lastResetTime, setLastResetTime] = useState(0);
  const [resetRechargePercent, setResetRechargePercent] = useState(100);
  const [menuMounted, setMenuMounted] = useState(false);
  const lastBiomeRef = useRef<string>('');

  useEffect(() => { setTimeout(() => setMenuMounted(true), 100); }, []);
  useEffect(() => { localStorage.setItem('totalCoins', totalCoins.toString()); }, [totalCoins]);
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - lastResetTime;
      setResetRechargePercent(Math.min(100, (elapsed / RESET_RECHARGE_MS) * 100));
    }, 100);
    return () => clearInterval(timer);
  }, [lastResetTime]);

  const startGame = () => {
    setGameState('playing');
    setScore(0); setHeight(0); setFuel(100); setHealth(100); setCharge(0); setCoinsInRun(0);
  };
  const handleManualReset = () => {
    if (resetRechargePercent < 100) return;
    setRestartKey(p => p + 1); setLastResetTime(Date.now());
    setScore(0); setHeight(0); setFuel(100); setHealth(100); setCharge(0); setCoinsInRun(0);
  };
  const handleRestore = () => {
    if (totalCoins >= RESTORE_COST) {
      setTotalCoins(p => p - RESTORE_COST);
      setRestoreKey(p => p + 1);
      setGameState('playing');
    }
  };
  const onStateUpdate = (currentScore: number, currentHeight: number, biome: string, currentFuel: number, currentHealth: number, _weapon: string, currentCharge: number, currentCoinsInRun: number) => {
    setScore(currentScore); setHeight(currentHeight); setFuel(currentFuel);
    setHealth(currentHealth); setCharge(currentCharge); setCoinsInRun(currentCoinsInRun);
    if (biome !== lastBiomeRef.current) {
      lastBiomeRef.current = biome;
      fetchBiomeDescription(biome, currentHeight);
    }
  };
  const fetchBiomeDescription = async (biome: string, h: number) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `Give me a short 2-3 word epic title for a climber at ${h}m in a ${biome} zone. JUST the title.`,
      });
      if (response.text) setBiomeTitle(response.text.trim().toUpperCase().replace(/[\"']/g, ''));
    } catch { setBiomeTitle(biome); }
  };
  const handleGameOver = () => {
    setTotalCoins(p => p + coinsInRun * 10);
    setGameState('gameover');
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#0a0500', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>

        {/* Game Canvas */}
        {gameState === 'playing' && (
          <GameCanvas onGameOver={handleGameOver} onUpdate={onStateUpdate} restartTrigger={restartKey} restoreTrigger={restoreKey} />
        )}

        {/* ═══ PLAYING HUD ════════════════════════════════════════════════════ */}
        {(gameState === 'playing' || gameState === 'gameover') && (
          <>
            {/* Top HUD bar */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
              background: 'linear-gradient(to bottom, rgba(5,2,0,0.95), rgba(5,2,0,0.7), transparent)',
              padding: '10px 16px 20px',
              borderBottom: '1px solid rgba(200,155,60,0.2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              pointerEvents: 'none',
            }}>
              {/* Left: Health + Fuel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 140 }}>
                <HudBar value={health} color="red" label="Vitality" icon="♥" />
                <HudBar value={fuel} color="blue" label="Plasma" icon="⚡" />
              </div>

              {/* Center: height + biome */}
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  padding: '4px 20px 6px',
                  border: '1px solid rgba(200,155,60,0.35)',
                  background: 'rgba(0,0,0,0.6)',
                  position: 'relative'
                }}>
                  {/* Corner ornaments */}
                  {['top:0,left:0', 'top:0,right:0', 'bottom:0,left:0', 'bottom:0,right:0'].map((pos, i) => {
                    const [v, h] = pos.split(',');
                    const [vk, vv] = v.split(':'); const [hk, hv] = h.split(':');
                    return <div key={i} style={{
                      position: 'absolute', [vk]: -3, [hk]: -3, width: 8, height: 8,
                      borderTop: i < 2 ? '1px solid rgba(200,155,60,0.7)' : undefined,
                      borderBottom: i >= 2 ? '1px solid rgba(200,155,60,0.7)' : undefined,
                      borderLeft: (i === 0 || i === 2) ? '1px solid rgba(200,155,60,0.7)' : undefined,
                      borderRight: (i === 1 || i === 3) ? '1px solid rgba(200,155,60,0.7)' : undefined,
                    }} />;
                  })}
                  <div className="cinzel" style={{ fontSize: 8, letterSpacing: '0.3em', color: 'rgba(200,155,60,0.6)', textTransform: 'uppercase', marginBottom: 2 }}>Altitude</div>
                  <div className="cinzel-deco" style={{ fontSize: 28, fontWeight: 900, color: '#e8c56a', textShadow: '0 0 15px rgba(200,155,60,0.7)', letterSpacing: '0.05em' }}>{height}<span style={{ fontSize: 12, marginLeft: 2 }}>M</span></div>
                  <div className="cinzel" style={{ fontSize: 7, letterSpacing: '0.25em', color: 'rgba(200,155,60,0.5)', textTransform: 'uppercase' }} className="rune-glow">{biomeTitle}</div>
                </div>
              </div>

              {/* Right: Coins */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 120 }}>
                <div style={{ textAlign: 'right' }}>
                  <div className="cinzel" style={{ fontSize: 8, letterSpacing: '0.2em', color: 'rgba(200,155,60,0.5)', textTransform: 'uppercase' }}>Treasury</div>
                  <div className="cinzel-deco" style={{ fontSize: 14, color: 'rgba(200,155,60,0.7)', letterSpacing: '0.05em' }}>{totalCoins.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="cinzel" style={{ fontSize: 8, letterSpacing: '0.2em', color: 'rgba(200,155,60,0.5)', textTransform: 'uppercase' }}>Run</div>
                  <div className="cinzel-deco" style={{ fontSize: 20, fontWeight: 900, color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.5)', letterSpacing: '0.05em' }}>+{coinsInRun.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Charge meter */}
            {charge > 0 && (
              <div style={{
                position: 'absolute', bottom: '28%', left: '50%', transform: 'translateX(-50%)',
                zIndex: 20, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
              }}>
                <div className="cinzel" style={{ fontSize: 9, letterSpacing: '0.5em', color: '#ffd700', textTransform: 'uppercase', textShadow: '0 0 10px #ffd700', animation: 'blink 0.5s ease infinite' }}>
                  ✦ IGNITION READY ✦
                </div>
                <div style={{ width: 200, height: 10, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(200,155,60,0.4)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: `${i * 10}%`, width: 1, background: 'rgba(0,0,0,0.5)', zIndex: 1 }} />
                  ))}
                  <div style={{
                    height: '100%', width: `${charge}%`,
                    background: `linear-gradient(to right, #c89b3c, #ffd700, #fff8dc)`,
                    boxShadow: '0 0 12px #ffd700',
                    transition: 'width 0.08s ease'
                  }} />
                </div>
              </div>
            )}

            {/* Bottom controls info */}
            <div style={{
              position: 'absolute', bottom: 10, left: 0, right: 0, zIndex: 10,
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
              padding: '0 12px', pointerEvents: 'none'
            }}>
              {/* Reset button */}
              <button
                onClick={handleManualReset}
                disabled={resetRechargePercent < 100}
                className="btn-ornate"
                style={{
                  padding: '8px 16px', fontSize: 8, letterSpacing: '0.2em', borderRadius: 2,
                  opacity: resetRechargePercent < 100 ? 0.5 : 1, pointerEvents: 'all',
                  cursor: resetRechargePercent < 100 ? 'not-allowed' : 'pointer'
                }}
              >
                {resetRechargePercent < 100 ? `⟳ SYNC ${Math.floor(resetRechargePercent)}%` : '⟳ RECALIBRATE'}
              </button>

              {/* Mini controls legend */}
              <div style={{ textAlign: 'right', opacity: 0.25 }}>
                <div className="cinzel" style={{ fontSize: 7, color: 'rgba(200,155,60,0.8)', letterSpacing: '0.15em', lineHeight: 1.8 }}>
                  ▲ TAP JUMP · HOLD THRUST<br />
                  ◀ ▶ SWIPE MOVE · ▼ CHARGE JUMP
                </div>
              </div>
            </div>

            {/* Side vignette effects */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5,
              background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)'
            }} />
          </>
        )}

        {/* ═══ GAME OVER ═══════════════════════════════════════════════════════ */}
        {gameState === 'gameover' && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'linear-gradient(135deg, rgba(5,0,0,0.97), rgba(15,5,0,0.95))',
            backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 32, textAlign: 'center',
            animation: 'fadeUp 0.6s ease forwards'
          }}>
            {/* Top decorative line */}
            <div style={{ width: '100%', maxWidth: 320, marginBottom: 30 }}>
              <div className="separator-line cormorant" style={{ fontSize: 13, color: 'rgba(200,155,60,0.6)', letterSpacing: '0.3em' }}>
                ✦ CHRONICLE ENDS ✦
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom: 8 }}>
              <div className="cinzel" style={{ fontSize: 8, letterSpacing: '0.5em', color: 'rgba(200,155,60,0.5)', textTransform: 'uppercase', marginBottom: 6 }}>The Hero Has Fallen</div>
              <h2 className="cinzel-deco" style={{
                fontSize: 58, fontWeight: 900, color: '#c0392b',
                textShadow: '0 0 20px rgba(192,57,43,0.8), 0 0 40px rgba(192,57,43,0.4), 0 4px 0 #5a0000',
                letterSpacing: '0.05em', margin: 0, lineHeight: 1,
                animation: 'crumbleFall 1s ease forwards',
                animationFillMode: 'forwards'
              }}>
                FALLEN
              </h2>
            </div>

            {/* Stats */}
            <div style={{
              display: 'flex', gap: 32, margin: '24px 0',
              padding: '16px 32px',
              border: '1px solid rgba(200,155,60,0.2)',
              background: 'rgba(0,0,0,0.4)',
              position: 'relative'
            }}>
              {[
                ['Height', `${height}M`],
                ['Score', score.toLocaleString()],
                ['Coins', coinsInRun.toLocaleString()]
              ].map(([label, val], i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div className="cinzel" style={{ fontSize: 7, letterSpacing: '0.25em', color: 'rgba(200,155,60,0.5)', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div className="cinzel-deco" style={{ fontSize: 20, color: '#e8c56a', textShadow: '0 0 8px rgba(200,155,60,0.5)' }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 280 }}>
              {/* Restore button */}
              <button
                onClick={handleRestore}
                disabled={totalCoins < RESTORE_COST}
                className="btn-ornate btn-primary"
                style={{
                  padding: '20px 24px', fontSize: 13, letterSpacing: '0.25em', borderRadius: 3,
                  opacity: totalCoins < RESTORE_COST ? 0.4 : 1,
                  cursor: totalCoins < RESTORE_COST ? 'not-allowed' : 'pointer',
                  borderColor: totalCoins >= RESTORE_COST ? 'rgba(200,155,60,0.8)' : 'rgba(200,155,60,0.2)',
                }}
              >
                <div style={{ fontSize: 16, marginBottom: 4, letterSpacing: '0.2em' }}>✦ RESTORE LEGEND</div>
                <div style={{ fontSize: 9, color: 'rgba(200,155,60,0.6)', letterSpacing: '0.2em' }}>
                  {totalCoins >= RESTORE_COST
                    ? `COSTS ${RESTORE_COST} COINS · TREASURY: ${totalCoins}`
                    : `NEED ${RESTORE_COST - totalCoins} MORE COINS`}
                </div>
              </button>

              {/* New game */}
              <button
                onClick={startGame}
                className="btn-ornate"
                style={{ padding: '18px 24px', fontSize: 13, letterSpacing: '0.25em', borderRadius: 3 }}
              >
                <div style={{ fontSize: 16, letterSpacing: '0.2em' }}>BEGIN NEW ASCENT</div>
              </button>

              {/* Back to menu */}
              <button
                onClick={() => setGameState('menu')}
                className="btn-ornate"
                style={{ padding: '10px 24px', fontSize: 9, letterSpacing: '0.3em', borderRadius: 3, opacity: 0.6 }}
              >
                RETURN TO SANCTUM
              </button>
            </div>

            {/* Bottom decoration */}
            <div style={{ marginTop: 24 }}>
              <div className="separator-line cormorant" style={{ fontSize: 11, color: 'rgba(200,155,60,0.35)', letterSpacing: '0.2em', fontStyle: 'italic' }}>
                Treasury: {totalCoins.toLocaleString()} coins
              </div>
            </div>
          </div>
        )}

        {/* ═══ MENU ════════════════════════════════════════════════════════════ */}
        {gameState === 'menu' && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'linear-gradient(180deg, #0a0300 0%, #1a0800 30%, #0d0400 60%, #050200 100%)',
            overflow: 'hidden'
          }}>
            {/* Stars background */}
            <StarField />
            {/* Atmospheric smoke */}
            <SmokeParticles />

            {/* Curtains */}
            <LeftCurtain />
            <RightCurtain />

            {/* Central tower silhouette */}
            <TowerSilhouette />

            {/* Content */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '20px 180px', textAlign: 'center'
            }}>
              {/* Sigil / emblem */}
              <div className="orb-float" style={{
                width: 56, height: 56, borderRadius: '50%', marginBottom: 24,
                background: 'radial-gradient(circle at 35% 35%, rgba(255,200,50,0.3), rgba(200,100,0,0.15), transparent)',
                border: '1px solid rgba(200,155,60,0.5)',
                boxShadow: '0 0 20px rgba(200,155,60,0.3), 0 0 40px rgba(200,155,60,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
                opacity: menuMounted ? 1 : 0,
                transition: 'opacity 0.8s ease 0.3s'
              }}>
                ◈
              </div>

              {/* Title */}
              <div style={{
                opacity: menuMounted ? 1 : 0,
                transform: menuMounted ? 'translateY(0) scaleX(1)' : 'translateY(-30px) scaleX(0.85)',
                filter: menuMounted ? 'blur(0)' : 'blur(12px)',
                transition: 'all 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.5s',
                marginBottom: 8
              }}>
                <div className="cinzel" style={{ fontSize: 10, letterSpacing: '0.6em', color: 'rgba(200,155,60,0.6)', textTransform: 'uppercase', marginBottom: 8 }}>
                  — The Legend of —
                </div>
                <h1 className="cinzel-deco" style={{
                  fontSize: 'clamp(28px, 5vw, 52px)', fontWeight: 900, lineHeight: 1.1,
                  margin: 0, letterSpacing: '0.05em',
                  background: 'linear-gradient(180deg, #fff8e1 0%, #ffd700 40%, #c89b3c 80%, #8b6914 100%)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  filter: 'drop-shadow(0 0 20px rgba(200,155,60,0.5))',
                }}>
                  INFINITE<br />TOWER
                </h1>
                <div className="cinzel" style={{
                  fontSize: 'clamp(8px, 1.2vw, 11px)', letterSpacing: '0.5em',
                  color: 'rgba(200,155,60,0.7)', textTransform: 'uppercase', marginTop: 8,
                  textShadow: '0 0 10px rgba(200,155,60,0.4)',
                  animation: 'runeGlow 3s ease-in-out infinite'
                }}>
                  ✦ ASCEND TO GLORY ✦
                </div>
              </div>

              {/* Ornate divider */}
              <div style={{
                width: '100%', maxWidth: 280, margin: '20px auto',
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: menuMounted ? 1 : 0, transition: 'opacity 0.8s ease 1s'
              }}>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, transparent, rgba(200,155,60,0.5))' }} />
                <div className="cormorant" style={{ fontSize: 16, color: 'rgba(200,155,60,0.7)', letterSpacing: '0.3em' }}>⁂</div>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(to left, transparent, rgba(200,155,60,0.5))' }} />
              </div>

              {/* Main CTA */}
              <div style={{
                width: '100%', maxWidth: 260,
                opacity: menuMounted ? 1 : 0,
                transform: menuMounted ? 'translateY(0)' : 'translateY(20px)',
                transition: 'all 0.8s ease 1.1s'
              }}>
                <button
                  onClick={startGame}
                  className="btn-ornate btn-primary"
                  style={{
                    width: '100%', padding: '22px 24px', fontSize: 14,
                    letterSpacing: '0.35em', borderRadius: 3,
                    boxShadow: '0 8px 32px rgba(200,155,60,0.2), 0 0 0 1px rgba(200,155,60,0.3)',
                  }}
                >
                  BEGIN THE ASCENT
                </button>

                {totalCoins > 0 && (
                  <div className="cormorant" style={{
                    fontSize: 11, color: 'rgba(200,155,60,0.4)', marginTop: 12,
                    letterSpacing: '0.15em', fontStyle: 'italic'
                  }}>
                    Treasury: {totalCoins.toLocaleString()} coins
                  </div>
                )}
              </div>

              {/* Controls */}
              <div style={{
                marginTop: 28, maxWidth: 260,
                opacity: menuMounted ? 1 : 0, transition: 'opacity 0.8s ease 1.4s'
              }}>
                <div className="cinzel" style={{ fontSize: 7, letterSpacing: '0.3em', color: 'rgba(200,155,60,0.35)', textTransform: 'uppercase', lineHeight: 2.2 }}>
                  ▲ UPPER ZONE · TAP TO JUMP · HOLD TO THRUST<br />
                  ▼ LOWER ZONE · SWIPE TO MOVE · DRAG DOWN TO CHARGE
                </div>
              </div>
            </div>

            {/* Scanline overlay */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px)',
            }} />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Star Field ───────────────────────────────────────────────────────────────
function StarField() {
  const stars = React.useMemo(() => Array.from({ length: 120 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    opacity: Math.random() * 0.6 + 0.1,
    animDelay: Math.random() * 5,
    animDur: 2 + Math.random() * 4
  })), []);

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
      {stars.map(s => (
        <div key={s.id} style={{
          position: 'absolute',
          left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size,
          borderRadius: '50%',
          background: s.size > 2 ? '#ffd700' : '#ffffff',
          opacity: s.opacity,
          animation: `runeGlow ${s.animDur}s ease-in-out ${s.animDelay}s infinite`,
          boxShadow: s.size > 1.5 ? `0 0 ${s.size * 2}px rgba(200,155,60,0.5)` : 'none'
        }} />
      ))}
    </div>
  );
}

// ─── Tower Silhouette ─────────────────────────────────────────────────────────
function TowerSilhouette() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
      <svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMax meet"
        style={{ width: '60%', maxWidth: 380, height: '100%', opacity: 0.18 }}>
        {/* Tower body */}
        <rect x="150" y="100" width="100" height="500" fill="#8b6914" />
        {/* Battlements */}
        {[0, 1, 2, 3, 4].map(i => (
          <rect key={i} x={150 + i * 22} y="88" width="14" height="20" fill="#8b6914" />
        ))}
        {/* Windows */}
        {[200, 280, 360, 440].map((y, i) => (
          <React.Fragment key={i}>
            <rect x="185" y={y} width="14" height="22" fill="#c89b3c" rx="7" />
            <rect x="201" y={y} width="14" height="22" fill="#c89b3c" rx="7" />
          </React.Fragment>
        ))}
        {/* Spire */}
        <polygon points="200,20 190,100 210,100" fill="#c89b3c" />
        {/* Base */}
        <rect x="120" y="580" width="160" height="20" fill="#8b6914" />
        <rect x="100" y="590" width="200" height="10" fill="#6b4f10" />
      </svg>
      {/* Glow beneath tower */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '40%', height: 200,
        background: 'radial-gradient(ellipse at bottom, rgba(200,155,60,0.15), transparent)',
        filter: 'blur(30px)'
      }} />
    </div>
  );
}

export default App;
