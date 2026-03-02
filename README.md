# ⚔️ Infinite Tower Climber

A cinematic infinite platformer with **Prince of Persia–inspired UI** featuring physics-based curtain simulations, ornate medieval HUD, and atmospheric visuals.

## ✨ UI Features

- **Physics Curtain Simulation** — Cloth physics with spring constraints, gold tassels, and wind sway on menu screen
- **Ornate HUD** — Segmented health/fuel bars with tick marks, corner ornaments, and glow effects
- **Biome-aware atmosphere** — Animated starfield, ancient tower silhouette, rising smoke particles
- **Cinzel Typography** — Medieval serif fonts (Cinzel Decorative, Cormorant Garamond) for authentic feel
- **Game Over** — Dramatic crumble animation with stats panel and restore option

## 🚀 Deploy to GitHub Pages

### One-Time Setup

1. Push this repository to GitHub
2. Go to **Settings → Pages → Source** → Select **GitHub Actions**
3. Add your Gemini API key:
   - **Settings → Secrets → Actions → New repository secret**
   - Name: `GEMINI_API_KEY`  Value: your key

### Auto Deploy
Every push to `main` deploys automatically to:
```
https://<username>.github.io/<repo-name>/
```

### Manual Deploy
**Actions → Deploy to GitHub Pages → Run workflow**

## 💻 Local Development

```bash
npm install
cp .env.local.example .env.local   # add your GEMINI_API_KEY
npm run dev
# Open http://localhost:3000
```

## 🎮 Touch Controls

| Zone | Gesture | Action |
|------|---------|--------|
| Upper 75% | Tap | Jump |
| Upper 75% | Hold | Plasma Thrust |  
| Lower 25% | Swipe ◀▶ | Move |
| Lower 25% | Drag ▼ then release | Charged Power Jump |
