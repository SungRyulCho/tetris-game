const canvas = document.getElementById("tetris");
const context = canvas.getContext("2d");
context.scale(30, 30);

const nextCanvas = document.getElementById("next");
const nextMobileCanvas = document.getElementById("next-mobile");
const nextCtx = nextCanvas.getContext("2d");
const nextMobileCtx = nextMobileCanvas?.getContext("2d");
nextCtx.scale(20, 20);
if (nextMobileCtx) nextMobileCtx.scale(20, 20);

const sounds = {
  clear: new Audio("./sounds/clear.wav"),
  stageUp: new Audio("./sounds/stageup.wav"),
  gameOver: new Audio("./sounds/gameover.wav"),
  bomb: new Audio("./sounds/bomb.wav"),
  bgm: new Audio("./sounds/bgm.mp3"),
};
sounds.bgm.loop = true;

let bgmStarted = false;
let running = true;

const colors = [
  null,
  "#FF6188",
  "#78DCE8",
  "#A9DC76",
  "#AB9DF2",
  "#FFD866",
  "#FC9867",
  "#66D9EF",
  "#FF9AC1",
  "#ffffff",
  "#ff4444", // 폭탄
];

const pieces = "ILJOTSZU";

function getRandomPiece() {
  return Math.random() < 0.1
    ? "B"
    : pieces[(Math.random() * pieces.length) | 0];
}

function createPiece(type) {
  switch (type) {
    case "T":
      return [
        [0, 0, 0],
        [1, 1, 1],
        [0, 1, 0],
      ];
    case "O":
      return [
        [2, 2],
        [2, 2],
      ];
    case "L":
      return [
        [0, 3, 0],
        [0, 3, 0],
        [0, 3, 3],
      ];
    case "J":
      return [
        [0, 4, 0],
        [0, 4, 0],
        [4, 4, 0],
      ];
    case "I":
      return [
        [0, 0, 0, 0],
        [5, 5, 5, 5],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
    case "S":
      return [
        [0, 6, 6],
        [6, 6, 0],
        [0, 0, 0],
      ];
    case "Z":
      return [
        [7, 7, 0],
        [0, 7, 7],
        [0, 0, 0],
      ];
    case "U":
      return [
        [8, 0, 8],
        [8, 8, 8],
        [0, 0, 0],
      ];
    case "B":
      return [[10]];
  }
}

function explodeBomb(x, y) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const ny = y + dy,
        nx = x + dx;
      if (arena[ny] && arena[ny][nx] !== undefined) arena[ny][nx] = 0;
    }
  }
  player.score += 30;
  updateScore();
  sounds.bomb.play();
}

function createMatrix(w, h) {
  return Array.from({ length: h }, () => Array(w).fill(0));
}

function drawMatrix(matrix, offset, ctx = context) {
  matrix.forEach((row, y) =>
    row.forEach((value, x) => {
      if (value !== 0) {
        ctx.fillStyle = colors[value];
        ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
      }
    })
  );
}

function drawNext() {
  [nextCtx, nextMobileCtx].forEach((ctx) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, 80, 80);
    const offset = {
      x: Math.floor(80 / 20 - next.matrix[0].length) / 2,
      y: Math.floor(80 / 20 - next.matrix.length) / 2,
    };
    drawMatrix(next.matrix, offset, ctx);
  });
}

function collide(arena, player) {
  const [m, o] = [player.matrix, player.pos];
  for (let y = 0; y < m.length; ++y)
    for (let x = 0; x < m[y].length; ++x)
      if (m[y][x] !== 0 && arena[y + o.y]?.[x + o.x] !== 0) return true;
  return false;
}

function merge(arena, player) {
  player.matrix.forEach((row, y) =>
    row.forEach((value, x) => {
      if (value !== 0) {
        const py = y + player.pos.y;
        const px = x + player.pos.x;
        if (value === 10) explodeBomb(px, py);
        else arena[py][px] = value;
      }
    })
  );
}

function flashRow(y) {
  return new Promise((resolve) => {
    const original = [...arena[y]];
    arena[y].fill(9);
    draw();
    setTimeout(() => {
      arena[y] = original;
      draw();
      resolve();
    }, 100);
  });
}

async function arenaSweep() {
  let rowCount = 1;
  for (let y = arena.length - 1; y >= 0; --y) {
    const filled = arena[y].filter((cell) => cell !== 0).length;
    if (filled / arena[y].length < 0.9) continue;
    await flashRow(y);
    arena.splice(y, 1);
    arena.unshift(Array(arena[0].length).fill(0));
    player.score += rowCount * 10;
    rowCount *= 2;
    updateScore();
    sounds.clear.play();
    y++;
  }
}

function playerReset() {
  player.matrix = next.matrix;
  next.matrix = createPiece(getRandomPiece());
  player.pos.y = 0;
  player.pos.x =
    ((arena[0].length / 2) | 0) - ((player.matrix[0].length / 2) | 0);
  if (collide(arena, player)) gameOver();
  drawNext();
}

async function playerDrop() {
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    playerReset();
    await arenaSweep();
  }
  dropCounter = 0;
}

function playerInstantDrop() {
  while (!collide(arena, player)) player.pos.y++;
  player.pos.y--;
  playerDrop();
}

function playerRotate(dir) {
  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; ++y)
    for (let x = 0; x < y; ++x)
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
  dir > 0 ? matrix.forEach((row) => row.reverse()) : matrix.reverse();
}

function updateScore() {
  const stage = Math.floor(player.score / 100) + 1;
  document
    .querySelectorAll("#score")
    .forEach((el) => (el.innerText = player.score));
  document.querySelectorAll("#stage").forEach((el) => (el.innerText = stage));
  document
    .querySelectorAll("#high-score")
    .forEach((el) => (el.innerText = highScore));

  dropInterval = 1000 - Math.min(900, (stage - 1) * 100);
  if (stage !== currentStage) {
    showStagePopup(stage);
    sounds.stageUp.play();
    currentStage = stage;
  }

  if (player.score > highScore) {
    highScore = player.score;
    localStorage.setItem("highScore", highScore);
  }
}

function showStagePopup(stage) {
  const popup = document.getElementById("stage-popup");
  popup.innerText = `STAGE ${stage}`;
  popup.classList.add("show");
  setTimeout(() => popup.classList.remove("show"), 1500);
}

function gameOver() {
  running = false;
  sounds.gameOver.play();
  sounds.bgm.pause();
  document.getElementById("overlay").classList.add("show");
}

function restartGame() {
  arena.forEach((row) => row.fill(0));
  player.score = 0;
  playerReset();
  updateScore();
  dropInterval = 1000;
  currentStage = 1;
  running = true;
  sounds.bgm.currentTime = 0;
  sounds.bgm.play();
  document.getElementById("overlay").classList.remove("show");
  update();
}

function update(time = 0) {
  if (!running) return;
  const deltaTime = time - lastTime;
  lastTime = time;
  dropCounter += deltaTime;
  if (dropCounter > dropInterval) playerDrop();
  draw();
  requestAnimationFrame(update);
}

function draw() {
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawMatrix(arena, { x: 0, y: 0 });
  drawMatrix(player.matrix, player.pos);
}

document.addEventListener("keydown", (event) => {
  if (!bgmStarted) {
    sounds.bgm.volume = 0.3;
    sounds.bgm.play();
    bgmStarted = true;
  }
  if (!running && event.key !== "Enter") return;
  switch (event.key) {
    case "ArrowLeft":
      move("left");
      break;
    case "ArrowRight":
      move("right");
      break;
    case "ArrowDown":
      drop();
      break;
    case "ArrowUp":
      rotateBlock();
      break;
    case " ":
      instantDrop();
      break;
    case "p":
    case "P":
      running = !running;
      if (running) update();
      break;
  }
});

document.getElementById("restart-btn").addEventListener("click", restartGame);

const arena = createMatrix(10, 20);
const player = { pos: { x: 0, y: 0 }, matrix: null, score: 0 };
const next = { matrix: createPiece(getRandomPiece()) };
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let highScore = localStorage.getItem("highScore") || 0;
let currentStage = 1;

document
  .querySelectorAll("#high-score")
  .forEach((el) => (el.innerText = highScore));
playerReset();
updateScore();
update();

// 📱 모바일 조작 함수
function move(dir) {
  if (!running) return;
  dir === "left" ? player.pos.x-- : player.pos.x++;
  if (collide(arena, player)) player.pos.x += dir === "left" ? 1 : -1;
}
function rotateBlock() {
  if (!running) return;
  playerRotate(1);
}
function drop() {
  if (!running) return;
  playerDrop();
}
function instantDrop() {
  if (!running) return;
  playerInstantDrop();
}
