const scoreElement = document.querySelector('#score');
const timeElement = document.querySelector('#time');
const bestElement = document.querySelector('#best-score');
const screenBestElement = document.querySelector('#screen-best');
const target = document.querySelector('#target');
const playfield = document.querySelector('#playfield');
const startButton = document.querySelector('#start-button');
const message = document.querySelector('#screen-message');
const gameStatus = document.querySelector('#game-status');

const BEST_KEY = 'baconrbxdev-neon-click-best';
let score = 0;
let timeLeft = 30;
let timerId = null;
let isPlaying = false;

function readBestScore() {
  try {
    const stored = Number.parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  } catch {
    return 0;
  }
}

let bestScore = readBestScore();

function formatScore(value) {
  return String(value).padStart(3, '0');
}

function showBestScore() {
  bestElement.textContent = bestScore;
  screenBestElement.textContent = formatScore(bestScore);
}

function moveTarget() {
  const fieldBounds = playfield.getBoundingClientRect();
  const size = target.offsetWidth;
  const padding = size / 2 + 8;
  const x = padding + Math.random() * Math.max(0, fieldBounds.width - padding * 2);
  const y = padding + Math.random() * Math.max(0, fieldBounds.height - padding * 2);
  target.style.left = `${x}px`;
  target.style.top = `${y}px`;
}

function endGame() {
  window.clearInterval(timerId);
  timerId = null;
  isPlaying = false;
  target.hidden = true;
  startButton.disabled = false;
  startButton.innerHTML = 'Play again <span aria-hidden="true">→</span>';
  gameStatus.textContent = 'TIME UP';
  message.hidden = false;
  message.querySelector('b').textContent = 'NICE RUN!';
  message.querySelector('small').textContent = `You scored ${score} points. Give it another go!`;
}

function startGame() {
  if (isPlaying) return;
  window.clearInterval(timerId);
  score = 0;
  timeLeft = 30;
  isPlaying = true;
  scoreElement.textContent = formatScore(score);
  timeElement.textContent = timeLeft;
  startButton.disabled = true;
  startButton.textContent = 'Game in progress…';
  gameStatus.textContent = 'IN GAME';
  message.hidden = true;
  target.hidden = false;
  moveTarget();
  timerId = window.setInterval(() => {
    timeLeft -= 1;
    timeElement.textContent = timeLeft;
    if (timeLeft <= 0) endGame();
  }, 1000);
}

target.addEventListener('click', () => {
  if (!isPlaying) return;
  score += 1;
  scoreElement.textContent = formatScore(score);
  if (score > bestScore) {
    bestScore = score;
    try {
      localStorage.setItem(BEST_KEY, String(bestScore));
    } catch {
      // The game still works if browser storage is unavailable.
    }
    showBestScore();
  }
  moveTarget();
});

startButton.addEventListener('click', startGame);

document.querySelector('#year').textContent = new Date().getFullYear();
showBestScore();
