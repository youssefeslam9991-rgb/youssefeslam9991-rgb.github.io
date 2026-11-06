const STORAGE_KEY = 'baconrbxdev-simulator-save-v1';
const REBIRTH_BASE = 25000;
const energyElement = document.querySelector('#energy');
const powerElement = document.querySelector('#tap-power');
const autoElement = document.querySelector('#auto-power');
const multiplierElement = document.querySelector('#multiplier');
const clickLevelElement = document.querySelector('#click-level');
const autoLevelElement = document.querySelector('#auto-level');
const clickCostElement = document.querySelector('#click-cost');
const autoCostElement = document.querySelector('#auto-cost');
const clickUpgradeButton = document.querySelector('#upgrade-click');
const autoUpgradeButton = document.querySelector('#upgrade-auto');
const rebirthButton = document.querySelector('#rebirth-button');
const rebirthCostElement = document.querySelector('#rebirth-cost');
const rebirthNoteElement = document.querySelector('#rebirth-note');
const rankElement = document.querySelector('#rank');
const progressFill = document.querySelector('#progress-fill');
const progressLabel = document.querySelector('#progress-label');
const collectButton = document.querySelector('#collect-button');
const particles = document.querySelector('#particles');

const defaultState = { energy: 0, lifetime: 0, clickLevel: 0, autoLevel: 0, rebirths: 0 };
let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return { ...defaultState };
    return Object.fromEntries(Object.keys(defaultState).map((key) => {
      const value = Number(saved[key]);
      return [key, Number.isFinite(value) && value >= 0 ? Math.floor(value) : defaultState[key]];
    }));
  } catch {
    return { ...defaultState };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // The simulator remains playable when browser storage is unavailable.
  }
}

function multiplier() {
  return 1 + state.rebirths;
}

function tapPower() {
  return (1 + state.clickLevel * 2) * multiplier();
}

function autoPower() {
  return state.autoLevel * 2 * multiplier();
}

function clickCost() {
  return Math.floor(25 * Math.pow(1.65, state.clickLevel));
}

function autoCost() {
  return Math.floor(100 * Math.pow(1.75, state.autoLevel));
}

function rebirthCost() {
  return REBIRTH_BASE * (state.rebirths + 1);
}

function pretty(value) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 1e4) return `${(value / 1e3).toFixed(value >= 1e5 ? 0 : 1).replace(/\.0$/, '')}K`;
  return Math.floor(value).toLocaleString();
}

function rankName() {
  const ranks = ['ROOKIE', 'RISING', 'POWERED', 'ELITE', 'LEGEND', 'COSMIC'];
  return ranks[Math.min(state.rebirths, ranks.length - 1)];
}

function render() {
  energyElement.textContent = pretty(state.energy);
  powerElement.textContent = pretty(tapPower());
  autoElement.textContent = pretty(autoPower());
  multiplierElement.textContent = `x${pretty(multiplier())}`;
  clickLevelElement.textContent = state.clickLevel;
  autoLevelElement.textContent = state.autoLevel;
  clickCostElement.textContent = pretty(clickCost());
  autoCostElement.textContent = pretty(autoCost());
  rankElement.textContent = rankName();
  const rebirthGoal = rebirthCost();
  rebirthCostElement.textContent = pretty(rebirthGoal);
  clickUpgradeButton.disabled = state.energy < clickCost();
  autoUpgradeButton.disabled = state.energy < autoCost();
  rebirthButton.disabled = state.energy < rebirthGoal;
  const progress = Math.min(100, (state.energy / rebirthGoal) * 100);
  progressFill.style.width = `${progress}%`;
  progressLabel.textContent = `${pretty(state.energy)} / ${pretty(rebirthGoal)}`;
  if (state.energy >= rebirthGoal) {
    rebirthNoteElement.innerHTML = 'Ready! Rebirth for a permanent <b>+1x boost</b>.';
  } else {
    rebirthNoteElement.innerHTML = `Reach <b>${pretty(rebirthGoal)} energy</b> to rebirth.`;
  }
}

function addEnergy(amount) {
  state.energy += amount;
  state.lifetime += amount;
  saveState();
  render();
}

function spawnParticle(event) {
  const bounds = collectButton.getBoundingClientRect();
  const particle = document.createElement('span');
  particle.className = 'particle';
  particle.textContent = `+${pretty(tapPower())}`;
  const x = event && Number.isFinite(event.clientX) ? event.clientX - bounds.left : bounds.width / 2;
  const y = event && Number.isFinite(event.clientY) ? event.clientY - bounds.top : bounds.height / 2;
  particle.style.left = `${x}px`;
  particle.style.top = `${y}px`;
  particle.style.setProperty('--dx', `${Math.round(Math.random() * 50 - 25)}px`);
  particles.append(particle);
  particle.addEventListener('animationend', () => particle.remove(), { once: true });
}

function collect(event) {
  addEnergy(tapPower());
  spawnParticle(event);
  collectButton.classList.remove('bump');
  void collectButton.offsetWidth;
  collectButton.classList.add('bump');
}

collectButton.addEventListener('click', collect);
clickUpgradeButton.addEventListener('click', () => {
  const cost = clickCost();
  if (state.energy < cost) return;
  state.energy -= cost;
  state.clickLevel += 1;
  saveState();
  render();
});
autoUpgradeButton.addEventListener('click', () => {
  const cost = autoCost();
  if (state.energy < cost) return;
  state.energy -= cost;
  state.autoLevel += 1;
  saveState();
  render();
});
rebirthButton.addEventListener('click', () => {
  const cost = rebirthCost();
  if (state.energy < cost) return;
  const confirmed = window.confirm('Rebirth now? Your energy and upgrades reset, but your permanent multiplier increases.');
  if (!confirmed) return;
  state.energy = 0;
  state.clickLevel = 0;
  state.autoLevel = 0;
  state.rebirths += 1;
  saveState();
  render();
});

document.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat) return;
  const tag = document.activeElement?.tagName;
  if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT') return;
  event.preventDefault();
  collect();
});

window.setInterval(() => {
  const earned = autoPower();
  if (earned <= 0) return;
  state.energy += earned;
  state.lifetime += earned;
  saveState();
  render();
}, 1000);

document.querySelector('#year').textContent = new Date().getFullYear();
render();
