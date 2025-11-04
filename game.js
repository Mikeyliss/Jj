// game.js
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 480;
canvas.height = 800;

// UI Elements
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const livesEl = document.getElementById('lives');
const highScoreEl = document.getElementById('highScore');
const finalScoreEl = document.getElementById('finalScore');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

// Game constants
const ROWS = 12;
const COLS = 10;
const BUBBLE_RADIUS = 22;
const BUBBLE_WIDTH = BUBBLE_RADIUS * 2;
const CEILING_HEIGHT = ROWS * BUBBLE_RADIUS * Math.sqrt(3) / 2 + 40;
const SHOOTER_Y = canvas.height - 60;
const MAX_LIVES = 3;

// Game state
let score = 0;
let level = 1;
let lives = MAX_LIVES;
let bubbles = [];
let nextBubble = null;
let currentBubble = null;
let shooterAngle = -Math.PI / 2;
let gameOver = false;
let gameStarted = false;
let highScore = localStorage.getItem('gothicBlockBlastHighScore') || 0;

highScoreEl.textContent = `High: ${highScore}`;

// Bubble types: 0-5 normal, 6 = bomb (clear 3x3), 7 = lightning (clear column)
const BUBBLE_COLORS = [
  '#8b0000', // blood red
  '#4b0082', // indigo
  '#006400', // dark green
  '#b8860b', // gold
  '#483d8b', // slate blue
  '#8b4513', // sepia
  '#ff0000', // bomb (red pulse)
  '#ffff00'  // lightning (yellow)
];

// Initialize level
function initLevel(lvl) {
  bubbles = [];
  const rows = Math.min(6 + Math.floor(lvl / 2), ROWS);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < COLS; col++) {
      const isEvenRow = row % 2 === 0;
      const offset = isEvenRow ? 0 : BUBBLE_RADIUS;
      const x = offset + col * BUBBLE_WIDTH + BUBBLE_RADIUS;
      const y = row * BUBBLE_RADIUS * Math.sqrt(3) + BUBBLE_RADIUS + 20;
      const type = Math.random() < 0.05 ? 6 : // 5% bomb
                   Math.random() < 0.05 ? 7 : // 5% lightning
                   Math.floor(Math.random() * 6);
      bubbles.push({ x, y, row, col, type, attached: true });
    }
  }
  nextBubble = generateBubble();
  currentBubble = null;
}

// Generate a new bubble
function generateBubble() {
  const type = Math.random() < 0.1 ? 6 :
               Math.random() < 0.1 ? 7 :
               Math.floor(Math.random() * 6);
  return { x: canvas.width / 2, y: SHOOTER_Y, type, vx: 0, vy: 0, attached: false };
}

// Draw everything
function draw() {
  // Background
  ctx.fillStyle = '#0d0620';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw ceiling
  ctx.fillStyle = '#1a0a30';
  ctx.fillRect(0, 0, canvas.width, CEILING_HEIGHT);

  // Draw bubbles
  bubbles.forEach(b => {
    if (!b.attached) return;
    ctx.beginPath();
    ctx.arc(b.x, b.y, BUBBLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = BUBBLE_COLORS[b.type];
    if (b.type === 6) {
      // Pulsing bomb
      const pulse = 1 + 0.1 * Math.sin(Date.now() / 100);
      ctx.arc(b.x, b.y, BUBBLE_RADIUS * pulse, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Draw current bubble
  if (currentBubble) {
    ctx.beginPath();
    ctx.arc(currentBubble.x, currentBubble.y, BUBBLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = BUBBLE_COLORS[currentBubble.type];
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Draw shooter
  ctx.save();
  ctx.translate(canvas.width / 2, SHOOTER_Y);
  ctx.rotate(shooterAngle);
  ctx.fillStyle = '#5a3a6e';
  ctx.fillRect(-5, 0, 10, 30);
  ctx.restore();

  // Draw trajectory line (optional)
  if (currentBubble) {
    const steps = 10;
    const futureX = currentBubble.x + currentBubble.vx * steps;
    const futureY = currentBubble.y + currentBubble.vy * steps;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, SHOOTER_Y);
    ctx.lineTo(futureX, futureY);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// Update game
function update() {
  if (!gameStarted || gameOver) return;

  // Move current bubble
  if (currentBubble) {
    currentBubble.x += currentBubble.vx;
    currentBubble.y += currentBubble.vy;

    // Wall bounce
    if (currentBubble.x - BUBBLE_RADIUS < 0 || currentBubble.x + BUBBLE_RADIUS > canvas.width) {
      currentBubble.vx *= -0.7;
      currentBubble.x = Math.max(BUBBLE_RADIUS, Math.min(canvas.width - BUBBLE_RADIUS, currentBubble.x));
    }

    // Ceiling collision
    if (currentBubble.y - BUBBLE_RADIUS <= CEILING_HEIGHT) {
      attachBubble(currentBubble);
      checkMatches();
      if (bubbles.length === 0) {
        level++;
        levelEl.textContent = `Level: ${level}`;
        initLevel(level);
        playSound('levelUp');
      } else {
        currentBubble = null;
        nextBubble = generateBubble();
      }
    }

    // Bubble collision
    for (const b of bubbles) {
      if (!b.attached) continue;
      const dx = currentBubble.x - b.x;
      const dy = currentBubble.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < BUBBLE_RADIUS * 2) {
        attachBubble(currentBubble);
        checkMatches();
        currentBubble = null;
        nextBubble = generateBubble();
        break;
      }
    }

    // Missed shot (bottom)
    if (currentBubble && currentBubble.y > canvas.height + 50) {
      lives--;
      updateLives();
      if (lives <= 0) {
        endGame();
      } else {
        currentBubble = null;
        nextBubble = generateBubble();
        playSound('miss');
      }
    }
  }
}

function attachBubble(bubble) {
  // Find closest grid position
  const row = Math.floor((bubble.y - 20) / (BUBBLE_RADIUS * Math.sqrt(3)));
  const isEvenRow = row % 2 === 0;
  const col = Math.floor((bubble.x - (isEvenRow ? 0 : BUBBLE_RADIUS)) / BUBBLE_WIDTH);
  const x = (isEvenRow ? 0 : BUBBLE_RADIUS) + col * BUBBLE_WIDTH + BUBBLE_RADIUS;
  const y = row * BUBBLE_RADIUS * Math.sqrt(3) + BUBBLE_RADIUS + 20;
  bubbles.push({ x, y, row, col, type: bubble.type, attached: true });

  // Check if bubbles are floating
  const attachedSet = new Set();
  markAttached(bubbles.length - 1, attachedSet);
  for (let i = bubbles.length - 1; i >= 0; i--) {
    if (!attachedSet.has(i) && bubbles[i].attached) {
      bubbles[i].attached = false;
      // Animate falling
      bubbles[i].vy = 2;
      score += 10;
      playSound('pop');
    }
  }
}

function markAttached(index, attachedSet) {
  if (attachedSet.has(index)) return;
  attachedSet.add(index);
  const b = bubbles[index];
  for (let i = 0; i < bubbles.length; i++) {
    if (i === index || !bubbles[i].attached) continue;
    const dx = b.x - bubbles[i].x;
    const dy = b.y - bubbles[i].y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < BUBBLE_RADIUS * 2.1) {
      markAttached(i, attachedSet);
    }
  }
}

function checkMatches() {
  const toRemove = new Set();
  for (let i = 0; i < bubbles.length; i++) {
    if (!bubbles[i].attached) continue;
    const cluster = findCluster(i);
    if (cluster.size >= 3) {
      cluster.forEach(idx => toRemove.add(idx));
    }
    // Special bubbles
    if (bubbles[i].type === 6 && cluster.size >= 1) { // Bomb
      const bx = bubbles[i].x;
      const by = bubbles[i].y;
      for (let j = 0; j < bubbles.length; j++) {
        if (!bubbles[j].attached) continue;
        const dx = bubbles[j].x - bx;
        const dy = bubbles[j].y - by;
        if (dx * dx + dy * dy < 120 * 120) {
          toRemove.add(j);
        }
      }
    }
    if (bubbles[i].type === 7 && cluster.size >= 1) { // Lightning
      const col = bubbles[i].col;
      for (let j = 0; j < bubbles.length; j++) {
        if (bubbles[j].col === col && bubbles[j].attached) {
          toRemove.add(j);
        }
      }
    }
  }

  if (toRemove.size > 0) {
    score += toRemove.size * 20;
    scoreEl.textContent = `Score: ${score}`;
    toRemove.forEach(i => {
      bubbles[i].attached = false;
      playSound('pop');
    });
    // Remove after delay for visual
    setTimeout(() => {
      bubbles = bubbles.filter((b, i) => !toRemove.has(i));
    }, 100);
  }
}

function findCluster(index) {
  const visited = new Set();
  const cluster = new Set();
  const stack = [index];
  const targetType = bubbles[index].type;

  while (stack.length) {
    const i = stack.pop();
    if (visited.has(i) || bubbles[i].type !== targetType || !bubbles[i].attached) continue;
    visited.add(i);
    cluster.add(i);
    for (let j = 0; j < bubbles.length; j++) {
      if (visited.has(j)) continue;
      const dx = bubbles[i].x - bubbles[j].x;
      const dy = bubbles[i].y - bubbles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < BUBBLE_RADIUS * 2.1) {
        stack.push(j);
      }
    }
  }
  return cluster;
}

function updateLives() {
  livesEl.textContent = `Lives: ${'❤️'.repeat(lives)}`;
}

function endGame() {
  gameOver = true;
  finalScoreEl.textContent = score;
  gameOverScreen.classList.remove('hidden');
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('gothicBlockBlastHighScore', highScore);
    highScoreEl.textContent = `High: ${highScore}`;
  }
  playSound('gameOver');
}

// Sound system (synthesized)
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.connect(gain);
  gain.connect(audioContext.destination);

  switch (type) {
    case 'shoot':
      osc.frequency.value = 300;
      gain.gain.value = 0.1;
      break;
    case 'pop':
      osc.frequency.value = 600 + Math.random() * 200;
      gain.gain.value = 0.08;
      break;
    case 'levelUp':
      osc.frequency.setValueAtTime(400, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);
      gain.gain.value = 0.1;
      break;
    case 'miss':
      osc.frequency.value = 100;
      gain.gain.value = 0.1;
      break;
    case 'gameOver':
      osc.frequency.setValueAtTime(200, audioContext.currentTime);
      osc.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
      gain.gain.value = 0.2;
      break;
  }
  osc.type = 'sine';
  osc.start();
  osc.stop(audioContext.currentTime + 0.3);
}

// Input handling
canvas.addEventListener('mousemove', (e) => {
  if (!gameStarted || currentBubble) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const dx = x - canvas.width / 2;
  const dy = y - SHOOTER_Y;
  shooterAngle = Math.atan2(dy, dx);
  // Limit angle (don't shoot downward)
  if (shooterAngle > -0.1) shooterAngle = -0.1;
  if (shooterAngle < -Math.PI + 0.1) shooterAngle = -Math.PI + 0.1;
});

canvas.addEventListener('click', () => {
  if (!gameStarted || currentBubble || gameOver) return;
  if (audioContext.state === 'suspended') audioContext.resume();
  currentBubble = { ...nextBubble };
  currentBubble.vx = Math.cos(shooterAngle) * 8;
  currentBubble.vy = Math.sin(shooterAngle) * 8;
  playSound('shoot');
});

// Touch support for mobile
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!gameStarted || currentBubble) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.touches[0].clientX - rect.left;
  const y = e.touches[0].clientY - rect.top;
  const dx = x - canvas.width / 2;
  const dy = y - SHOOTER_Y;
  shooterAngle = Math.atan2(dy, dx);
  if (shooterAngle > -0.1) shooterAngle = -0.1;
  if (shooterAngle < -Math.PI + 0.1) shooterAngle = -Math.PI + 0.1;
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!gameStarted || currentBubble || gameOver) return;
  if (audioContext.state === 'suspended') audioContext.resume();
  currentBubble = { ...nextBubble };
  currentBubble.vx = Math.cos(shooterAngle) * 8;
  currentBubble.vy = Math.sin(shooterAngle) * 8;
  playSound('shoot');
});

startBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  gameStarted = true;
  score = 0;
  level = 1;
  lives = MAX_LIVES;
  gameOver = false;
  scoreEl.textContent = `Score: ${score}`;
  levelEl.textContent = `Level: ${level}`;
  updateLives();
  initLevel(level);
});

restartBtn.addEventListener('click', () => {
  gameOverScreen.classList.add('hidden');
  gameStarted = true;
  score = 0;
  level = 1;
  lives = MAX_LIVES;
  gameOver = false;
  scoreEl.textContent = `Score: ${score}`;
  levelEl.textContent = `Level: ${level}`;
  updateLives();
  initLevel(level);
});

// Game loop
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}
gameLoop();
