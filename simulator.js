(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const energyEl = document.querySelector('#energy');
  const crystalsEl = document.querySelector('#crystals');
  const levelEl = document.querySelector('#level');
  const zoneNameEl = document.querySelector('#zone-name');
  const toastEl = document.querySelector('#toast');
  const collectButton = document.querySelector('#collect-nearby');
  const worldNote = document.querySelector('#world-note');
  const emberCostEl = document.querySelector('#ember-cost');
  const unlockButton = document.querySelector('#unlock-ember');
  const STORAGE_KEY = 'baconrbxdev-explorer-save-v2';

  const defaults = { energy: 0, crystals: 0, lifetime: 0, gloves: 0, boots: 0, drone: 0, upgradesBought: 0, emberUnlocked: false, missions: { crystals: false, upgrades: false, world: false } };
  let state = loadState();
  const player = { x: 0, y: 0, radius: 13, facing: 1 };
  const keys = new Set();
  const crystals = [];
  const particles = [];
  let width = 0;
  let height = 0;
  let lastTime = 0;
  let toastTimer = 0;
  let droneTimer = 0;
  let walkTime = 0;
  let activeZone = 'meadow';
  let lastCollect = 0;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || typeof saved !== 'object') return structuredClone(defaults);
      return {
        ...defaults,
        ...saved,
        energy: safeInt(saved.energy), crystals: safeInt(saved.crystals), lifetime: safeInt(saved.lifetime),
        gloves: safeInt(saved.gloves), boots: safeInt(saved.boots), drone: safeInt(saved.drone), upgradesBought: safeInt(saved.upgradesBought),
        emberUnlocked: saved.emberUnlocked === true,
        missions: { ...defaults.missions, ...(saved.missions && typeof saved.missions === 'object' ? saved.missions : {}) }
      };
    } catch { return { ...defaults, missions: { ...defaults.missions } }; }
  }

  function safeInt(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0; }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* Continue without browser storage. */ } }
  function pretty(value) { if (value >= 1e6) return `${(value / 1e6).toFixed(1).replace(/\.0$/, '')}M`; if (value >= 1e4) return `${(value / 1e3).toFixed(value >= 1e5 ? 0 : 1).replace(/\.0$/, '')}K`; return Math.floor(value).toLocaleString(); }
  function level() { return 1 + Math.floor(state.lifetime / 250); }
  function tapValue() { return (10 + state.gloves * 12) * (activeZone === 'ember' ? 3 : 1); }
  function upgradeCost(type) { const base = { gloves: 50, boots: 75, drone: 150 }[type]; const factor = { gloves: 1.65, boots: 1.7, drone: 1.8 }[type]; return Math.floor(base * factor ** state[type]); }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width; height = rect.height;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!player.x) { player.x = width * .5; player.y = height * .58; }
    player.x = Math.min(width - 30, Math.max(30, player.x));
    player.y = Math.min(height - 35, Math.max(45, player.y));
  }
  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('visible'), 1500);
  }
  function crystalValue() { return Math.floor((activeZone === 'ember' ? 30 : 10) * (1 + state.gloves * .35)); }

  function spawnCrystal() {
    if (crystals.length >= 13 || !width || !height) return;
    const padding = 35;
    let x, y, attempts = 0;
    do {
      x = padding + Math.random() * Math.max(1, width - padding * 2);
      y = 55 + Math.random() * Math.max(1, height - 105);
      attempts++;
    } while (attempts < 15 && Math.hypot(x - player.x, y - player.y) < 70);
    crystals.push({ x, y, phase: Math.random() * Math.PI * 2, size: 7 + Math.random() * 4, hue: activeZone === 'ember' ? 22 + Math.random() * 18 : 155 + Math.random() * 35 });
  }
  function collectCrystal(index) {
    const crystal = crystals.splice(index, 1)[0];
    const value = crystalValue();
    state.energy += value;
    state.lifetime += value;
    state.crystals += 1;
    particles.push({ x: crystal.x, y: crystal.y, text: `+${pretty(value)}`, life: 1 });
    if (!state.missions.crystals && state.crystals >= 10) completeMission('crystals');
    save(); renderUI();
  }
  function collectNearby() {
    const radius = 52 + state.gloves * 3;
    let collected = 0;
    for (let i = crystals.length - 1; i >= 0; i--) {
      if (Math.hypot(crystals[i].x - player.x, crystals[i].y - player.y) <= radius) { collectCrystal(i); collected++; }
    }
    if (!collected) showToast('Move closer to a crystal!');
    else showToast(`Collected ${collected} crystal${collected === 1 ? '' : 's'}!`);
  }
  function completeMission(name) {
    state.missions[name] = true;
    state.energy += 250;
    state.lifetime += 250;
    showToast('MISSION COMPLETE · +250 ENERGY');
  }

  function renderUI() {
    energyEl.textContent = pretty(state.energy);
    crystalsEl.textContent = pretty(state.crystals);
    levelEl.textContent = level();
    document.querySelector('#gloves-level').textContent = state.gloves;
    document.querySelector('#boots-level').textContent = state.boots;
    document.querySelector('#drone-level').textContent = state.drone;
    for (const type of ['gloves', 'boots', 'drone']) {
      document.querySelector(`#${type}-cost`).textContent = pretty(upgradeCost(type));
      document.querySelector(`[data-upgrade="${type}"]`).disabled = state.energy < upgradeCost(type);
    }
    const emberCost = 1000;
    emberCostEl.textContent = pretty(emberCost);
    unlockButton.disabled = state.energy < emberCost || state.emberUnlocked;
    unlockButton.textContent = state.emberUnlocked ? 'Go' : 'Unlock';
    document.querySelector('.world-card:nth-of-type(2) .world-card-copy em').innerHTML = state.emberUnlocked ? '● UNLOCKED' : `Unlock for <span>${pretty(emberCost)}</span> energy`;
    document.querySelector('.world-card:nth-of-type(2) .world-card-copy em').classList.toggle('unlocked', state.emberUnlocked);
    worldNote.textContent = state.emberUnlocked ? 'Ember crystals are worth 3× more. Click “Go” to travel!' : 'Explore the field to find energy crystals.';
    document.querySelector('#mission-crystal-count').textContent = `${Math.min(state.crystals, 10)}/10`;
    document.querySelector('#mission-upgrade-count').textContent = `${Math.min(state.upgradesBought, 2)}/2`;
    document.querySelector('#mission-world-count').textContent = state.emberUnlocked ? '1/1' : '0/1';
    document.querySelector('#mission-crystal-bar').style.width = `${Math.min(100, state.crystals * 10)}%`;
    document.querySelector('#mission-upgrade-bar').style.width = `${Math.min(100, state.upgradesBought * 50)}%`;
    document.querySelector('#mission-world-bar').style.width = state.emberUnlocked ? '100%' : '0%';
    if (state.upgradesBought >= 2 && !state.missions.upgrades) completeMission('upgrades');
    if (state.emberUnlocked && !state.missions.world) completeMission('world');
    save();
  }

  function buyUpgrade(type) {
    const cost = upgradeCost(type);
    if (state.energy < cost) return;
    state.energy -= cost;
    state[type]++;
    state.upgradesBought++;
    showToast(`${type === 'gloves' ? 'POWER GLOVES' : type === 'boots' ? 'SPEED BOOTS' : 'HELPER DRONE'} UPGRADED!`);
    save(); renderUI();
  }
  document.querySelectorAll('[data-upgrade]').forEach((button) => button.addEventListener('click', () => buyUpgrade(button.dataset.upgrade)));
  unlockButton.addEventListener('click', () => {
    if (state.emberUnlocked) { activeZone = activeZone === 'meadow' ? 'ember' : 'meadow'; zoneNameEl.textContent = activeZone === 'ember' ? 'Ember Valley' : 'Crystal Fields'; crystals.length = 0; for (let i = 0; i < 9; i++) spawnCrystal(); showToast(`TRAVELLED TO ${activeZone === 'ember' ? 'EMBER VALLEY' : 'CRYSTAL FIELDS'}`); return; }
    if (state.energy < 1000) return;
    state.energy -= 1000; state.emberUnlocked = true;
    if (!state.missions.world) completeMission('world');
    save(); renderUI(); showToast('EMBER VALLEY UNLOCKED!');
  });
  collectButton.addEventListener('click', collectNearby);

  function pressDirection(direction, isDown) {
    const map = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    isDown ? keys.add(map[direction]) : keys.delete(map[direction]);
  }
  document.querySelectorAll('.mobile-pad button').forEach((button) => {
    const direction = button.dataset.dir;
    button.addEventListener('pointerdown', (event) => { event.preventDefault(); button.setPointerCapture(event.pointerId); pressDirection(direction, true); });
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(eventName, () => pressDirection(direction, false));
  });
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.code === 'Space' && !event.repeat) collectNearby();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  }
  function drawWorld(time) {
    const ember = activeZone === 'ember';
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, ember ? '#2b171b' : '#102d31'); bg.addColorStop(1, ember ? '#181326' : '#111a2b');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    // Distant atmospheric glow and layered hills.
    const glow = ctx.createRadialGradient(width * .55, height * .28, 8, width * .55, height * .28, width * .7);
    glow.addColorStop(0, ember ? 'rgba(255,111,75,.22)' : 'rgba(75,255,218,.16)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
    for (let layer = 0; layer < 3; layer++) {
      const y = height * (.38 + layer * .12);
      ctx.beginPath(); ctx.moveTo(0, y + 34);
      for (let x = 0; x <= width + 40; x += 40) ctx.lineTo(x, y + Math.sin(x * .012 + layer * 2.4) * (15 + layer * 5));
      ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath();
      ctx.fillStyle = ember ? ['#38202a', '#302136', '#202033'][layer] : ['#164047', '#17353f', '#1b2939'][layer]; ctx.fill();
    }
    // Perspective floor grid.
    ctx.save(); ctx.globalAlpha = .14; ctx.strokeStyle = ember ? '#ff9c6f' : '#88f4dc'; ctx.lineWidth = 1;
    const horizon = height * .52;
    for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(width / 2 + i * 3, horizon); ctx.lineTo(width / 2 + i * width * .13, height); ctx.stroke(); }
    for (let i = 0; i < 8; i++) { const y = horizon + Math.pow(i / 7, 1.8) * (height - horizon); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.restore();
    // Decorative crystals and distant structures.
    for (let i = 0; i < 7; i++) {
      const x = ((i * 173 + 61) % Math.max(width, 1)); const y = height * (.27 + (i % 3) * .06); const size = 8 + (i % 3) * 4;
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha = .3; ctx.fillStyle = ember ? '#ff9e74' : '#83ffe3'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.moveTo(0, -size); ctx.lineTo(size * .55, 0); ctx.lineTo(0, size * 1.4); ctx.lineTo(-size * .55, 0); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // Small floating crystal collectibles.
    for (const crystal of crystals) {
      const bob = Math.sin(time * .002 + crystal.phase) * 4;
      ctx.save(); ctx.translate(crystal.x, crystal.y + bob); ctx.rotate(Math.sin(time * .001 + crystal.phase) * .18);
      ctx.shadowColor = `hsl(${crystal.hue} 100% 68%)`; ctx.shadowBlur = 18;
      const gradient = ctx.createLinearGradient(-crystal.size, -crystal.size, crystal.size, crystal.size);
      gradient.addColorStop(0, '#f4ffff'); gradient.addColorStop(.4, `hsl(${crystal.hue} 100% 73%)`); gradient.addColorStop(1, `hsl(${crystal.hue} 75% 42%)`);
      ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(0, -crystal.size * 1.5); ctx.lineTo(crystal.size, -2); ctx.lineTo(crystal.size * .55, crystal.size * 1.25); ctx.lineTo(-crystal.size * .55, crystal.size * 1.25); ctx.lineTo(-crystal.size, -2); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = .6; ctx.fillStyle = '#fff'; ctx.fillRect(-1, -crystal.size, 2, crystal.size * 1.1); ctx.restore();
    }
    // Player shadow and little explorer character.
    const bob = Math.sin(walkTime * 10) * (keys.size ? 2 : 0);
    ctx.save(); ctx.translate(player.x, player.y + bob);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, 15, 17, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.shadowColor = '#69f5db'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#77eadb'; ctx.beginPath(); ctx.roundRect(-11, -7, 22, 23, 8); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#202335'; ctx.beginPath(); ctx.arc(0, -11, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e6fff9'; ctx.beginPath(); ctx.arc(player.facing * 4, -12, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a98bff'; ctx.beginPath(); ctx.roundRect(-10, -23, 20, 7, 3); ctx.fill();
    ctx.fillStyle = '#d7fff8'; ctx.font = '7px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('YOU', 0, 31); ctx.restore();
    // Collected-energy sparkle floats.
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]; p.life -= .02; p.y -= .7;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, p.life); ctx.fillStyle = '#bafff2'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.shadowColor = '#65ffe0'; ctx.shadowBlur = 10; ctx.fillText(p.text, p.x, p.y); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
    // A gate hints at the next unlock.
    if (!state.emberUnlocked) {
      const gx = width - 63, gy = height * .39;
      ctx.save(); ctx.strokeStyle = 'rgba(255,168,122,.8)'; ctx.lineWidth = 3; ctx.shadowColor = '#ff805b'; ctx.shadowBlur = 15; ctx.strokeRect(gx - 20, gy - 26, 40, 58); ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(9,11,17,.7)'; ctx.fillRect(gx - 15, gy - 21, 30, 48); ctx.fillStyle = '#ffd2ae'; ctx.font = '8px monospace'; ctx.textAlign = 'center'; ctx.fillText('LOCKED', gx, gy + 47); ctx.restore();
    }
  }

  function update(dt, time) {
    const speed = 155 + state.boots * 24;
    let dx = 0, dy = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) dx--;
    if (keys.has('ArrowRight') || keys.has('KeyD')) dx++;
    if (keys.has('ArrowUp') || keys.has('KeyW')) dy--;
    if (keys.has('ArrowDown') || keys.has('KeyS')) dy++;
    if (dx || dy) {
      const length = Math.hypot(dx, dy); dx /= length; dy /= length;
      player.x += dx * speed * dt; player.y += dy * speed * dt;
      if (dx) player.facing = Math.sign(dx);
      walkTime += dt;
    }
    player.x = Math.max(20, Math.min(width - 20, player.x));
    player.y = Math.max(35, Math.min(height - 25, player.y));
    const magnetRange = 24 + state.gloves * 9;
    for (let i = crystals.length - 1; i >= 0; i--) {
      const c = crystals[i]; const distance = Math.hypot(c.x - player.x, c.y - player.y);
      if (distance < magnetRange) collectCrystal(i);
    }
    if (time - lastCollect > 1050 && crystals.length < 10) { spawnCrystal(); lastCollect = time; }
    if (state.drone > 0) {
      droneTimer += dt;
      if (droneTimer >= 1) { const seconds = Math.floor(droneTimer); droneTimer -= seconds; const earned = seconds * state.drone * 5; state.energy += earned; state.lifetime += earned; save(); renderUI(); }
    }
  }
  function frame(time) {
    if (!lastTime) lastTime = time;
    const dt = Math.min((time - lastTime) / 1000, .05); lastTime = time;
    update(dt, time); drawWorld(time); requestAnimationFrame(frame);
  }

  canvas.addEventListener('pointerdown', (event) => {
    canvas.focus({ preventScroll: true });
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left; const y = event.clientY - rect.top;
    let nearest = -1; let distance = 48;
    crystals.forEach((crystal, index) => { const d = Math.hypot(crystal.x - x, crystal.y - y); if (d < distance) { nearest = index; distance = d; } });
    if (nearest >= 0) collectCrystal(nearest);
  });

  resize();
  window.addEventListener('resize', resize);
  for (let i = 0; i < 8; i++) spawnCrystal();
  renderUI();
  document.querySelector('#year').textContent = new Date().getFullYear();
  requestAnimationFrame(frame);
})();
