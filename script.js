/**
 * Bug Beat Blocks - レベル20全解放版
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

let COLS = 10;
let ROWS = 18;
let BLOCK_SIZE = 24;

const BLOCK_COLORS = [1, 2, 3, 4];

const COLORS = [
    null,
    '#ffd93d',
    '#4dd2ff',
    '#ff6f61',
    '#ff9de2',
    null, null, null,
    'BUG_WHITE',  // 8
    'BUG_YELLOW', // 9
    'BUG_SKY',    // 10
    'BUG_CORAL',  // 11
    'BUG_PINK',   // 12
    'BUG_METAL',  // 13
    'BUG_BAT_WHITE',  // 14
    'BUG_BAT_YELLOW', // 15
    'BUG_BAT_SKY',    // 16
    'BUG_BAT_CORAL',  // 17
    'BUG_BAT_PINK',   // 18
    'BUG_BAT_METAL'   // 19
];

const BUG_FACE_COLORS = {
    8:  '#fbf5eb',
    9:  '#ffd93d',
    10: '#4dd2ff',
    11: '#ff6f61',
    12: '#ff9de2',
    13: '#6a6c75',
    14: '#fbf5eb',
    15: '#ffd93d',
    16: '#4dd2ff',
    17: '#ff6f61',
    18: '#ff9de2',
    19: '#6a6c75'
};

const NORMAL_BUG_ASSET_SOURCES = {
    8: 'assets/images/enemy-normal-white.png',
    9: 'assets/images/enemy-normal-yellow.png',
    10: 'assets/images/enemy-normal-blue.png',
    11: 'assets/images/enemy-normal-red.png',
    12: 'assets/images/enemy-normal-pink.png'
};

const normalBugImages = {};
const normalBugImageReady = {};

Object.entries(NORMAL_BUG_ASSET_SOURCES).forEach(([bugType, src]) => {
    const image = new Image();
    normalBugImageReady[bugType] = false;
    image.onload = () => {
        normalBugImageReady[bugType] = true;
    };
    image.onerror = () => {
        normalBugImageReady[bugType] = false;
    };
    image.decoding = 'async';
    image.src = src;
    normalBugImages[bugType] = image;
});

const SHAPES = [
    [],
    [[1,1,1,1]],
    [[1,0,0],[1,1,1]],
    [[0,0,1],[1,1,1]],
    [[1,1],[1,1]],
    [[0,1,1],[1,1,0]],
    [[0,1,0],[1,1,1]],
    [[1,1,0],[0,1,1]]
];

let audioCtx = null;
function initAudio() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch(e) {}
}

let gameState = 'TITLE';
let selectedLevel = 1;
let score = 0;
let remainingEnemies = 0;
let board = [];        
let groupBoard = [];   
let nextGroupId = 1;

let currentPiece = null;
let nextPiece = null;

let dropCounter = 0;
let dropInterval = 1000;
let normalDropInterval = 1000;
let fastDropInterval = 35;
let isFastDropping = false;
let lastTime = 0;
let particles = [];
let popTexts = [];
let flashAlpha = 0;

let isAnimating = false;
let animPhase = 'NONE'; 
let animTimer = 0;
let pendingClearBlocks = [];
let pendingClearBugs = [];
let fallingGroups = []; 
let advanceAfterResolution = true;

let batBugs = [];

let chainCount = 0;

let devLogs = [];
function addLog(msg) {
    const timeStr = new Date().toTimeString().split(' ')[0];
    devLogs.push(`[${timeStr}] ${msg}`);
    if (devLogs.length > 100) devLogs.shift();
}

class Piece {
    constructor(type) {
        this.type = type;
        this.groupId = nextGroupId++;
        this.baseShape = SHAPES[type];
        this.shape = this.baseShape.map(row => 
            row.map(val => val ? BLOCK_COLORS[Math.floor(Math.random() * 4)] : 0)
        );
        this.x = Math.floor((COLS - this.shape[0].length) / 2);
        this.y = 0;
    }
}

function resizeCanvas() {
    const playArea = document.getElementById('play-area');
    const containerW = playArea.clientWidth;
    const containerH = playArea.clientHeight;

    let sidePanelW = 82; 
    let availableBoardW = containerW - sidePanelW - 8;

    let sizeFromW = Math.floor(availableBoardW / COLS);
    let sizeFromH = Math.floor(containerH / ROWS);

    BLOCK_SIZE = Math.max(1, Math.min(sizeFromW, sizeFromH));

    let boardWidth = COLS * BLOCK_SIZE;
    let boardHeight = ROWS * BLOCK_SIZE;

    canvas.width = boardWidth;
    canvas.height = boardHeight;

    canvas.style.width = `${boardWidth}px`;
    canvas.style.height = `${boardHeight}px`;

    const sidePanel = document.getElementById('side-panel');
    sidePanel.style.width = `${sidePanelW}px`;
    sidePanel.style.height = `${boardHeight}px`;
}

function changeScreen(state) {
    gameState = state;
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('level-screen').classList.add('hidden');
    document.getElementById('overlay-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('log-screen').classList.add('hidden');
    document.getElementById('game-header').classList.add('hidden');
    document.getElementById('side-panel').classList.add('hidden');

    if (state === 'TITLE') {
        document.getElementById('title-screen').classList.remove('hidden');
    } else if (state === 'LEVEL_SELECT') {
        document.getElementById('level-screen').classList.remove('hidden');
        buildLevelGrid();
    } else if (state === 'PLAYING') {
        document.getElementById('game-header').classList.remove('hidden');
        document.getElementById('side-panel').classList.remove('hidden');
        resizeCanvas();
    } else if (state === 'PAUSED') {
        document.getElementById('game-header').classList.remove('hidden');
        document.getElementById('pause-screen').classList.remove('hidden');
    } else if (state === 'LOGS') {
        document.getElementById('game-header').classList.remove('hidden');
        document.getElementById('log-screen').classList.remove('hidden');
        const container = document.getElementById('log-container');
        container.innerText = devLogs.join('\n') || 'ログはまだありません。';
        container.scrollTop = container.scrollHeight;
    } else if (state === 'GAMEOVER' || state === 'STAGECLEAR') {
        document.getElementById('overlay-screen').classList.remove('hidden');
        document.getElementById('game-header').classList.remove('hidden');
        document.getElementById('overlay-title').innerText = state === 'GAMEOVER' ? 'TRY AGAIN?' : 'CLEAR!';
        document.getElementById('overlay-sub').innerText = `SCORE ${score}`;
        document.getElementById('overlay-action-btn').innerText = state === 'GAMEOVER' ? 'RETRY' : 'NEXT STAGE';
        document.getElementById('overlay-action-btn').className = state === 'GAMEOVER' ? 'btn coral' : 'btn mint';
    }
}

/**
 * レベル1〜20までを全てオープン
 */
function buildLevelGrid() {
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    for (let i = 1; i <= 20; i++) {
        const btn = document.createElement('div');
        btn.className = `lvl-btn`;
        const bugCount = Math.min(i, 7);
        btn.innerHTML = `${i}<span class="bug-count">●×${bugCount}</span>`;
        btn.onclick = () => {
            selectedLevel = i;
            score = 0;
            setupStage(selectedLevel);
            changeScreen('PLAYING');
        };
        grid.appendChild(btn);
    }
}

document.getElementById('start-btn').onclick = () => {
    initAudio();
    addLog('Game Started: Level Select');
    changeScreen('LEVEL_SELECT');
};
document.getElementById('back-title-btn').onclick = () => changeScreen('TITLE');
document.getElementById('overlay-action-btn').onclick = () => {
    if (gameState === 'GAMEOVER') {
        score = 0;
        setupStage(selectedLevel);
        changeScreen('PLAYING');
    } else if (gameState === 'STAGECLEAR') {
        selectedLevel = Math.min(selectedLevel + 1, 20); // レベル20まで上限解放
        setupStage(selectedLevel);
        changeScreen('PLAYING');
    }
};

document.getElementById('pause-btn').onclick = () => {
    if (gameState === 'PLAYING') changeScreen('PAUSED');
};
document.getElementById('resume-btn').onclick = () => {
    if (gameState === 'PAUSED') changeScreen('PLAYING');
};
document.getElementById('pause-retry-btn').onclick = () => {
    score = 0;
    setupStage(selectedLevel);
    changeScreen('PLAYING');
};
document.getElementById('pause-title-btn').onclick = () => {
    changeScreen('TITLE');
};
document.getElementById('open-log-btn').onclick = () => {
    changeScreen('LOGS');
};
document.getElementById('close-log-btn').onclick = () => {
    changeScreen('PAUSED');
};

document.getElementById('copy-log-btn').onclick = () => {
    const logText = devLogs.join('\n');
    if (!logText) return;
    
    const textArea = document.createElement('textarea');
    textArea.value = logText;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        const copyBtn = document.getElementById('copy-log-btn');
        copyBtn.innerText = 'コピー完了！';
        setTimeout(() => { copyBtn.innerText = 'コピー'; }, 1500);
    } catch(err) {}
    document.body.removeChild(textArea);
};

function rotatePiece() {
    if (gameState !== 'PLAYING' || isAnimating || !currentPiece) return;
    let oldShape = currentPiece.shape;
    let rotated = oldShape[0].map((_, i) => oldShape.map(row => row[i]).reverse());
    let oldX = currentPiece.x;

    currentPiece.shape = rotated;
    if (checkCollisionAt(currentPiece.x, currentPiece.y, currentPiece.shape)) {
        currentPiece.x -= 1;
        if (checkCollisionAt(currentPiece.x, currentPiece.y, currentPiece.shape)) {
            currentPiece.x += 2;
            if (checkCollisionAt(currentPiece.x, currentPiece.y, currentPiece.shape)) {
                currentPiece.x = oldX;
                currentPiece.shape = oldShape;
            }
        }
    }
}

function movePiece(dir) {
    if (gameState !== 'PLAYING' || isAnimating || !currentPiece) return;
    let nextX = currentPiece.x + dir;
    if (!checkCollisionAt(nextX, currentPiece.y, currentPiece.shape)) {
        currentPiece.x = nextX;
    }
}

document.getElementById('btn-rotate').onclick = (e) => { e.preventDefault(); rotatePiece(); };
document.getElementById('btn-left').onclick = (e) => { e.preventDefault(); movePiece(-1); };
document.getElementById('btn-right').onclick = (e) => { e.preventDefault(); movePiece(1); };

const fastBtn = document.getElementById('btn-fast');
const startFastDrop = (e) => {
    e.preventDefault();
    isFastDropping = true;
    fastBtn.classList.add('active');
};
const stopFastDrop = (e) => {
    e.preventDefault();
    isFastDropping = false;
    fastBtn.classList.remove('active');
};
fastBtn.addEventListener('pointerdown', startFastDrop);
fastBtn.addEventListener('pointerup', stopFastDrop);
fastBtn.addEventListener('pointercancel', stopFastDrop);
fastBtn.addEventListener('pointerleave', stopFastDrop);

function setupStage(level) {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    groupBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    batBugs = [];
    nextGroupId = 1;

    const bugCount = Math.min(level, 7);
    remainingEnemies = bugCount;

    for (let i = 0; i < bugCount; i++) {
        let x = (i * 3 + 2) % COLS;
        let y = ROWS - 1 - Math.floor(i / 2) * 2;
        
        let bugType = 8; 
        let isBat = false;
        let batSubtype = 14; 

        if (level >= 7 && Math.random() < 0.35) {
            let batsOnRow = batBugs.filter(b => b.row === y).length;
            if (batsOnRow === 0) {
                isBat = true;
                if (level >= 15 && Math.random() < 0.3) {
                    batSubtype = 19; 
                } else if (level >= 10 && Math.random() < 0.5) {
                    batSubtype = Math.floor(Math.random() * 4) + 15; 
                }
            }
        }

        if (isBat) {
            bugType = batSubtype;
        } else {
            if (level >= 5 && Math.random() < 0.35) {
                bugType = 13; 
            } else if (level >= 2 && Math.random() < 0.6) {
                bugType = Math.floor(Math.random() * 4) + 9; 
            }
        }

        if (isBat) {
            batBugs.push({
                id: `bat_${i}`,
                row: y,
                posX: x,
                dir: Math.random() < 0.5 ? 1 : -1,
                speed: 1.8,
                minX: Math.max(0, x - 2),
                maxX: Math.min(COLS - 1, x + 2),
                type: bugType
            });
            board[y][x] = bugType;
            groupBoard[y][x] = -1;
        } else {
            board[y][x] = bugType;
            groupBoard[y][x] = -1;
        }
    }

    normalDropInterval = 1000;
    currentPiece = new Piece(Math.floor(Math.random() * 7) + 1);
    nextPiece = new Piece(Math.floor(Math.random() * 7) + 1);
    dropCounter = 0;
    dropInterval = 1000;
    lastTime = performance.now();
    particles = [];
    popTexts = [];
    flashAlpha = 0;
    pendingClearBlocks = [];
    pendingClearBugs = [];
    fallingGroups = [];
    isAnimating = false;
    isFastDropping = false;
    animPhase = 'NONE';
    animTimer = 0;
    advanceAfterResolution = true;
    chainCount = 0;
    isDragging = false;
    clearTimeout(holdTimer);
    holdTimer = null;
    fastBtn.classList.remove('active');

    addLog(`Setup Stage ${level}: ${bugCount} bugs (Bat Bugs: ${batBugs.length})`);
}

function isObstacleAt(r, c, currentBatId) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;

    let cell = board[r][c];
    if (cell !== 0 && (cell < 14 || cell > 19)) return true;

    for (let b of batBugs) {
        if (b.id === currentBatId) continue;
        if (b.row === r && Math.round(b.posX) === c) return true;
    }

    if (currentPiece && gameState === 'PLAYING' && !isAnimating) {
        let shape = currentPiece.shape;
        for (let pr = 0; pr < shape.length; pr++) {
            for (let pc = 0; pc < shape[pr].length; pc++) {
                if (shape[pr][pc]) {
                    if (currentPiece.y + pr === r && currentPiece.x + pc === c) return true;
                }
            }
        }
    }

    for (let g of fallingGroups) {
        for (let cell of g.cells) {
            let fallR = Math.round(cell.r + g.currentOffsetY);
            if (fallR === r && cell.c === c) return true;
        }
    }

    return false;
}

function updateBatBugs(dt) {
    if (gameState !== 'PLAYING' || isAnimating) return;

    let sec = dt / 1000;
    let movedCellOut = false;

    batBugs.forEach(b => {
        let currentGridX = Math.round(b.posX);

        let hasBlockAbove = isObstacleAt(b.row - 1, currentGridX, b.id);
        if (hasBlockAbove && b.row > 0) {
            b.posX = currentGridX;
            if (board[b.row][currentGridX] === 0) {
                board[b.row][currentGridX] = b.type;
                groupBoard[b.row][currentGridX] = -1;
            }
            return;
        }

        let effMinX = b.minX;
        let effMaxX = b.maxX;

        for (let x = currentGridX - 1; x >= b.minX; x--) {
            if (isObstacleAt(b.row, x, b.id)) {
                effMinX = x + 1;
                break;
            }
        }
        for (let x = currentGridX + 1; x <= b.maxX; x++) {
            if (isObstacleAt(b.row, x, b.id)) {
                effMaxX = x - 1;
                break;
            }
        }

        if (effMinX >= effMaxX) {
            b.posX = currentGridX;
            if (board[b.row][currentGridX] === 0) {
                board[b.row][currentGridX] = b.type;
                groupBoard[b.row][currentGridX] = -1;
            }
            return;
        }

        let nextX = b.posX + b.dir * b.speed * sec;

        if (b.dir < 0 && nextX <= effMinX) {
            nextX = effMinX;
            b.dir = 1;
        } else if (b.dir > 0 && nextX >= effMaxX) {
            nextX = effMaxX;
            b.dir = -1;
        }

        b.posX = nextX;
        let newGridX = Math.round(b.posX);

        if (newGridX !== currentGridX) {
            let myType = board[b.row][currentGridX];
            if (myType >= 14 && myType <= 19) {
                board[b.row][currentGridX] = 0;
                groupBoard[b.row][currentGridX] = 0;
            }
            if (!isObstacleAt(b.row, newGridX, b.id)) {
                board[b.row][newGridX] = b.type;
                groupBoard[b.row][newGridX] = -1;
            } else {
                b.posX = currentGridX;
                board[b.row][currentGridX] = b.type;
                groupBoard[b.row][currentGridX] = -1;
            }
            movedCellOut = true;
        }
    });

    if (movedCellOut) {
        checkAndTriggerFloatingBlocksGravity();
    }
}

function checkAndTriggerFloatingBlocksGravity() {
    if (isAnimating) return;

    let hasFloating = false;
    for (let r = 0; r < ROWS - 1; r++) {
        for (let c = 0; c < COLS; c++) {
            let type = board[r][c];
            if (type >= 1 && type <= 4) {
                if (board[r + 1][c] === 0) {
                    hasFloating = true;
                    break;
                }
            }
        }
        if (hasFloating) break;
    }

    if (hasFloating) {
        setupGroupGravityAnimation(false);
    }
}

function updateUI() {
    document.getElementById('ui-level').innerText = selectedLevel;
    document.getElementById('ui-bugs').innerText = remainingEnemies;
    document.getElementById('ui-score').innerText = score;
    drawMiniPiece(nextCtx, nextCanvas, nextPiece);
}

function drawMiniPiece(targetCtx, targetCanvas, piece) {
    targetCtx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    if (!piece) return;
    let size = 15;
    let shape = piece.shape;
    let w = shape[0].length * size;
    let h = shape.length * size;
    let startX = (targetCanvas.width - w) / 2;
    let startY = (targetCanvas.height - h) / 2;

    shape.forEach((row, r) => {
        row.forEach((val, c) => {
            if (val) {
                targetCtx.fillStyle = COLORS[val];
                targetCtx.fillRect(startX + c * size, startY + r * size, size - 1, size - 1);
                targetCtx.strokeStyle = 'rgba(0,0,0,0.15)';
                targetCtx.lineWidth = 1;
                targetCtx.strokeRect(startX + c * size, startY + r * size, size - 1, size - 1);
            }
        });
    });
}

function update(time = 0) {
    let dt = time - lastTime;
    lastTime = time;

    if (gameState === 'PLAYING') {
        updateBatBugs(dt);

        if (isAnimating) {
            updateAnimation(dt);
        } else {
            let activeInterval = isFastDropping ? fastDropInterval : normalDropInterval;
            dropCounter += dt;
            if (dropCounter > activeInterval) {
                currentPiece.y++;
                if (checkCollisionAt(currentPiece.x, currentPiece.y, currentPiece.shape)) {
                    currentPiece.y--;
                    mergePiece();
                    chainCount = 0;
                    processMatches();
                }
                dropCounter = 0;
            }
        }
        updateUI();
    }
    if (gameState === 'PLAYING' || gameState === 'CLEARING') {
        updateParticles(dt);
    }
    drawGame();
    requestAnimationFrame(update);
}

function checkCollisionAt(px, py, shape) {
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (shape[r][c]) {
                let nx = px + c;
                let ny = py + r;
                if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
                if (ny >= 0 && board[ny][nx]) return true;
            }
        }
    }
    return false;
}

function mergePiece() {
    currentPiece.shape.forEach((row, r) => {
        row.forEach((val, c) => {
            if (val) {
                board[currentPiece.y + r][currentPiece.x + c] = val;
                groupBoard[currentPiece.y + r][currentPiece.x + c] = currentPiece.groupId;
            }
        });
    });
    addLog(`Piece Merged (GroupID:${currentPiece.groupId}) at X:${currentPiece.x}, Y:${currentPiece.y}`);
    
    for (let c = 0; c < COLS; c++) {
        if (board[0][c] !== 0) {
            addLog('Game Over: Block Reached Top Edge (Row 0)');
            changeScreen('GAMEOVER');
            return;
        }
    }
}

function processMatches(shouldAdvance = true) {
    advanceAfterResolution = shouldAdvance;
    let visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    let toClearBlocks = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    let toClearBugs = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let color = board[r][c];
            if (color >= 1 && color <= 4 && !visited[r][c]) {
                let group = [];
                let queue = [{ r, c }];
                visited[r][c] = true;

                while (queue.length > 0) {
                    let curr = queue.pop();
                    group.push(curr);

                    let neighbors = [
                        { r: curr.r - 1, c: curr.c },
                        { r: curr.r + 1, c: curr.c },
                        { r: curr.r, c: curr.c - 1 },
                        { r: curr.r, c: curr.c + 1 }
                    ];

                    for (let n of neighbors) {
                        if (n.r >= 0 && n.r < ROWS && n.c >= 0 && n.c < COLS) {
                            if (!visited[n.r][n.c] && board[n.r][n.c] === color) {
                                visited[n.r][n.c] = true;
                                queue.push(n);
                            }
                        }
                    }
                }

                if (group.length >= 4) {
                    group.forEach(cell => { toClearBlocks[cell.r][cell.c] = true; });
                }
            }
        }
    }

    let hasClear = false;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (toClearBlocks[r][c]) {
                hasClear = true;
                let blockColor = board[r][c];

                let neighbors = [
                    { r: r - 1, c: c }, { r: r + 1, c: c },
                    { r: r, c: c - 1 }, { r: r, c: c + 1 }
                ];

                for (let n of neighbors) {
                    if (n.r >= 0 && n.r < ROWS && n.c >= 0 && n.c < COLS) {
                        let bugType = board[n.r][n.c];
                        
                        if (bugType === 8 || bugType === 13 || bugType === 14 || bugType === 19) {
                            toClearBugs[n.r][n.c] = true;
                        } 
                        else if (bugType >= 9 && bugType <= 12) {
                            if (bugType - 8 === blockColor) {
                                toClearBugs[n.r][n.c] = true;
                            }
                        }
                        else if (bugType >= 15 && bugType <= 18) {
                            if (bugType - 14 === blockColor) {
                                toClearBugs[n.r][n.c] = true;
                            }
                        }
                    }
                }
            }
        }
    }

    if (hasClear) {
        chainCount++;
        pendingClearBlocks = toClearBlocks;
        pendingClearBugs = toClearBugs;
        isAnimating = true;
        animPhase = 'WAIT_CLEAR';
        animTimer = 0;
        addLog(`Match Found: Chain x${chainCount}`);
    } else {
        if (advanceAfterResolution) {
            advancePiece();
        } else {
            isAnimating = false;
            animPhase = 'NONE';
        }
    }
}

function updateAnimation(dt) {
    animTimer += dt;

    if (animPhase === 'WAIT_CLEAR') {
        let clearWaitTime = normalDropInterval / 2;
        if (animTimer >= clearWaitTime) {
            let killed = 0;
            let clearedCount = 0;
            let centerSumX = 0, centerSumY = 0;

            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (pendingClearBlocks[r][c]) {
                        board[r][c] = 0;
                        groupBoard[r][c] = 0;
                        score += 10 * chainCount;
                        clearedCount++;
                        centerSumX += c * BLOCK_SIZE + BLOCK_SIZE / 2;
                        centerSumY += r * BLOCK_SIZE + BLOCK_SIZE / 2;
                        spawnClearSparkles(c * BLOCK_SIZE + BLOCK_SIZE / 2, r * BLOCK_SIZE + BLOCK_SIZE / 2);
                    }
                    if (pendingClearBugs[r][c]) {
                        let bugType = board[r][c];

                        if (bugType === 13 || bugType === 19) {
                            let nextType = (Math.random() < 0.4) ? 8 : Math.floor(Math.random() * 4) + 9;
                            board[r][c] = nextType;
                            score += 250 * chainCount;
                            
                            if (bugType === 19) {
                                batBugs = batBugs.filter(b => !(b.row === r && Math.round(b.posX) === c));
                            }
                            
                            spawnSquash(c * BLOCK_SIZE + BLOCK_SIZE / 2, r * BLOCK_SIZE + BLOCK_SIZE / 2);
                            spawnPopText(c * BLOCK_SIZE + BLOCK_SIZE / 2, r * BLOCK_SIZE + BLOCK_SIZE / 2, 'TRANSFORM!', '#ffd93d');
                        } else {
                            if (bugType >= 14 && bugType <= 18) {
                                batBugs = batBugs.filter(b => !(b.row === r && Math.round(b.posX) === c));
                            }
                            board[r][c] = 0;
                            groupBoard[r][c] = 0;
                            killed++;
                            score += 500 * chainCount;
                            spawnSquash(c * BLOCK_SIZE + BLOCK_SIZE / 2, r * BLOCK_SIZE + BLOCK_SIZE / 2);
                        }
                    }
                }
            }

            if (clearedCount > 0) {
                let popX = centerSumX / clearedCount;
                let popY = centerSumY / clearedCount;
                let textStr = chainCount > 1 ? `${chainCount}x CHAIN!!` : 'BOOM!';
                let textColor = chainCount > 1 ? '#ffd93d' : '#4fffb0';
                spawnPopText(popX, popY, textStr, textColor);
            }

            if (killed > 0) {
                remainingEnemies = Math.max(0, remainingEnemies - killed);
                flashAlpha = 0.6;
            }

            addLog(`Cleared ${clearedCount} blocks, Defeated ${killed} bugs (Chain x${chainCount}). Remaining: ${remainingEnemies}`);

            resplitDisconnectedGroups();
            setupGroupGravityAnimation(advanceAfterResolution);
        }
    } else if (animPhase === 'FALLING') {
        updateFallingGroups(dt);
    }
}

function resplitDisconnectedGroups() {
    let visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let type = board[r][c];
            if (type >= 1 && type <= 4 && !visited[r][c]) {
                let originalGId = groupBoard[r][c];
                let comp = [];
                let queue = [{ r, c }];
                visited[r][c] = true;

                while (queue.length > 0) {
                    let curr = queue.pop();
                    comp.push(curr);

                    let neighbors = [
                        { r: curr.r - 1, c: curr.c },
                        { r: curr.r + 1, c: curr.c },
                        { r: curr.r, c: curr.c - 1 },
                        { r: curr.r, c: curr.c + 1 }
                    ];

                    for (let n of neighbors) {
                        if (n.r >= 0 && n.r < ROWS && n.c >= 0 && n.c < COLS) {
                            if (!visited[n.r][n.c] && board[n.r][n.c] >= 1 && board[n.r][n.c] <= 4 && groupBoard[n.r][n.c] === originalGId) {
                                visited[n.r][n.c] = true;
                                queue.push(n);
                            }
                        }
                    }
                }

                let newGId = nextGroupId++;
                comp.forEach(cell => {
                    groupBoard[cell.r][cell.c] = newGId;
                });
            }
        }
    }
}

function setupGroupGravityAnimation(triggerNextPiece = true) {
    fallingGroups = [];
    let compVisited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    let components = [];

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let type = board[r][c];
            if (type >= 1 && type <= 4 && !compVisited[r][c]) {
                let targetGId = groupBoard[r][c];
                let compCells = [];
                let queue = [{ r, c }];
                compVisited[r][c] = true;

                while (queue.length > 0) {
                    let curr = queue.pop();
                    compCells.push({ r: curr.r, c: curr.c, type: board[curr.r][curr.c], groupId: targetGId });

                    let neighbors = [
                        { r: curr.r - 1, c: curr.c },
                        { r: curr.r + 1, c: curr.c },
                        { r: curr.r, c: curr.c - 1 },
                        { r: curr.r, c: curr.c + 1 }
                    ];

                    for (let n of neighbors) {
                        if (n.r >= 0 && n.r < ROWS && n.c >= 0 && n.c < COLS) {
                            let nType = board[n.r][n.c];
                            if (!compVisited[n.r][n.c] && nType >= 1 && nType <= 4 && groupBoard[n.r][n.c] === targetGId) {
                                compVisited[n.r][n.c] = true;
                                queue.push(n);
                            }
                        }
                    }
                }
                components.push({
                    id: targetGId,
                    cells: compCells,
                    totalFall: 0
                });
            }
        }
    }

    if (components.length === 0) {
        if (triggerNextPiece) {
            advancePiece();
        } else {
            isAnimating = false;
            animPhase = 'NONE';
        }
        return;
    }

    let simB = Array.from({ length: ROWS }, (_, r) => [...board[r]]);
    let simG = Array.from({ length: ROWS }, (_, r) => [...groupBoard[r]]);

    if (!triggerNextPiece && currentPiece) {
        currentPiece.shape.forEach((row, r) => {
            row.forEach((val, c) => {
                if (!val) return;
                const boardR = currentPiece.y + r;
                const boardC = currentPiece.x + c;
                if (boardR >= 0 && boardR < ROWS && boardC >= 0 && boardC < COLS && simB[boardR][boardC] === 0) {
                    simB[boardR][boardC] = -2;
                }
            });
        });
    }

    let movedAny = true;
    while (movedAny) {
        movedAny = false;

        for (let comp of components) {
            let compSet = new Set(comp.cells.map(cell => `${cell.r},${cell.c}`));
            
            let canFall = true;
            for (let cell of comp.cells) {
                let nextR = cell.r + 1;
                if (nextR >= ROWS) {
                    canFall = false;
                    break;
                }
                if (!compSet.has(`${nextR},${cell.c}`) && simB[nextR][cell.c] !== 0) {
                    canFall = false;
                    break;
                }
            }

            if (canFall) {
                for (let cell of comp.cells) {
                    simB[cell.r][cell.c] = 0;
                    simG[cell.r][cell.c] = 0;
                }
                for (let cell of comp.cells) {
                    cell.r += 1;
                    simB[cell.r][cell.c] = cell.type;
                    simG[cell.r][cell.c] = cell.groupId;
                }
                comp.totalFall += 1;
                movedAny = true;
            }
        }
    }

    let anyGroupMoving = false;
    for (let comp of components) {
        if (comp.totalFall > 0) {
            anyGroupMoving = true;
            let origCells = comp.cells.map(cell => ({
                r: cell.r - comp.totalFall,
                c: cell.c,
                type: cell.type,
                groupId: cell.groupId
            }));

            fallingGroups.push({
                cells: origCells,
                targetOffsetY: comp.totalFall,
                currentOffsetY: 0
            });
        }
    }

    if (anyGroupMoving) {
        fallingGroups.forEach(g => {
            g.cells.forEach(cell => {
                board[cell.r][cell.c] = 0;
                groupBoard[cell.r][cell.c] = 0;
            });
        });

        isAnimating = true;
        advanceAfterResolution = triggerNextPiece;
        animPhase = 'FALLING';
        animTimer = 0;
        addLog(`Gravity Fall Triggered: ${fallingGroups.length} groups moving`);
    } else {
        if (triggerNextPiece) {
            advancePiece();
        } else {
            isAnimating = false;
            animPhase = 'NONE';
        }
    }
}

function updateFallingGroups(dt) {
    let allFinished = true;
    
    let fallSpeedPerMs = 1 / (normalDropInterval / 2);
    let step = dt * fallSpeedPerMs;

    fallingGroups.forEach(g => {
        if (g.currentOffsetY < g.targetOffsetY) {
            g.currentOffsetY += step;
            if (g.currentOffsetY >= g.targetOffsetY) {
                g.currentOffsetY = g.targetOffsetY;
            } else {
                allFinished = false;
            }
        }
    });

    if (allFinished) {
        fallingGroups.forEach(g => {
            let offset = g.targetOffsetY;
            g.cells.forEach(cell => {
                board[cell.r + offset][cell.c] = cell.type;
                groupBoard[cell.r + offset][cell.c] = cell.groupId;
            });
        });
        fallingGroups = [];
        
        processMatches(advanceAfterResolution);
    }
}

function advancePiece() {
    isAnimating = false;
    animPhase = 'NONE';

    if (remainingEnemies <= 0) {
        gameState = 'CLEARING';
        addLog('All Bugs Defeated! Stage Clear');
        updateUI();
        setTimeout(() => {
            if (gameState === 'CLEARING') changeScreen('STAGECLEAR');
        }, 900);
        return;
    }

    currentPiece = nextPiece;
    nextPiece = new Piece(Math.floor(Math.random() * 7) + 1);

    if (checkCollisionAt(currentPiece.x, currentPiece.y, currentPiece.shape)) {
        addLog('Game Over: Spawn Block Collided');
        changeScreen('GAMEOVER');
    }
}

function spawnClearSparkles(cx, cy) {
    for (let i = 0; i < 14; i++) {
        particles.push({
            x: cx, y: cy,
            vx: (Math.random() - 0.5) * 5.0,
            vy: (Math.random() - 0.5) * 5.0,
            life: 400 + Math.random() * 250,
            age: 0,
            size: 2.5 + Math.random() * 3.5,
            color: [ '#ffd93d', '#ff9de2', '#4fffb0', '#4dd2ff', '#ffffff' ][i % 5]
        });
    }
}

function spawnSquash(cx, cy) {
    for (let i = 0; i < 16; i++) {
        particles.push({
            x: cx, y: cy,
            vx: (Math.random() - 0.5) * 4.5,
            vy: (Math.random() - 0.8) * 4.5,
            life: 500 + Math.random() * 250,
            age: 0,
            size: 3 + Math.random() * 3,
            color: [ '#ffd93d', '#ff9de2', '#4fffb0', '#4dd2ff' ][i % 4]
        });
    }
}

function spawnPopText(x, y, text, color) {
    popTexts.push({
        x: x, y: y,
        vy: -1.2,
        life: 700,
        age: 0,
        text: text,
        color: color
    });
}

function updateParticles(dt) {
    if (flashAlpha > 0) flashAlpha = Math.max(0, flashAlpha - dt / 220);
    particles.forEach(p => {
        p.age += dt;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
    });
    particles = particles.filter(p => p.age < p.life);

    popTexts.forEach(pt => {
        pt.age += dt;
        pt.y += pt.vy;
    });
    popTexts = popTexts.filter(pt => pt.age < pt.life);
}

function getGhostY() {
    if (!currentPiece) return 0;
    let gy = currentPiece.y;
    while (!checkCollisionAt(currentPiece.x, gy + 1, currentPiece.shape)) {
        gy++;
    }
    return gy;
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState !== 'PLAYING' && gameState !== 'CLEARING' && gameState !== 'PAUSED' && gameState !== 'LOGS' && gameState !== 'GAMEOVER' && gameState !== 'STAGECLEAR') return;

    ctx.fillStyle = '#1a0f3d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * BLOCK_SIZE, 0);
        ctx.lineTo(c * BLOCK_SIZE, ROWS * BLOCK_SIZE);
        ctx.stroke();
    }

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c]) {
                let px = c * BLOCK_SIZE;
                let py = r * BLOCK_SIZE;
                let gId = groupBoard[r][c];

                let scale = 1.0;
                if (animPhase === 'WAIT_CLEAR' && pendingClearBlocks[r][c]) {
                    let progress = animTimer / (normalDropInterval / 2);
                    scale = Math.max(0, 1.0 - progress * 0.8);
                }

                if (board[r][c] >= 8 && board[r][c] <= 13) {
                    drawBug(px, py, scale, board[r][c]);
                } else if (board[r][c] < 8) {
                    let t = (r > 0 && groupBoard[r - 1][c] === gId);
                    let b = (r < ROWS - 1 && groupBoard[r + 1][c] === gId);
                    let l = (c > 0 && groupBoard[r][c - 1] === gId);
                    let rRight = (c < COLS - 1 && groupBoard[r][c + 1] === gId);
                    drawConnectedCell(px, py, board[r][c], t, b, l, rRight, scale);
                }
            }
        }
    }

    batBugs.forEach(b => {
        let px = b.posX * BLOCK_SIZE;
        let py = b.row * BLOCK_SIZE;
        let scale = 1.0;
        if (animPhase === 'WAIT_CLEAR' && pendingClearBugs[b.row][Math.round(b.posX)]) {
            let progress = animTimer / (normalDropInterval / 2);
            scale = Math.max(0, 1.0 - progress * 0.8);
        }
        drawBatBug(px, py, scale, b.dir, b.type);
    });

    fallingGroups.forEach(g => {
        g.cells.forEach(cell => {
            let px = cell.c * BLOCK_SIZE;
            let py = (cell.r + g.currentOffsetY) * BLOCK_SIZE;

            if (cell.type >= 8 && cell.type <= 13) {
                drawBug(px, py, 1.0, cell.type);
            } else if (cell.type >= 14) {
                drawBatBug(px, py, 1.0, 1, cell.type);
            } else {
                let r = cell.r, c = cell.c, gId = cell.groupId;
                let t = g.cells.some(other => other.r === r - 1 && other.c === c && other.groupId === gId);
                let b = g.cells.some(other => other.r === r + 1 && other.c === c && other.groupId === gId);
                let l = g.cells.some(other => other.r === r && other.c === c - 1 && other.groupId === gId);
                let rRight = g.cells.some(other => other.r === r && other.c === c + 1 && other.groupId === gId);
                drawConnectedCell(px, py, cell.type, t, b, l, rRight, 1.0);
            }
        });
    });

    if (currentPiece && gameState === 'PLAYING' && !isAnimating) {
        let ghostY = getGhostY();
        let shape = currentPiece.shape;

        shape.forEach((row, r) => {
            row.forEach((val, c) => {
                if (val) drawGhostCell(currentPiece.x + c, ghostY + r);
            });
        });

        shape.forEach((row, r) => {
            row.forEach((val, c) => {
                if (val) {
                    let px = (currentPiece.x + c) * BLOCK_SIZE;
                    let py = (currentPiece.y + r) * BLOCK_SIZE;
                    let t = (r > 0 && shape[r - 1][c] > 0);
                    let b = (r < shape.length - 1 && shape[r + 1][c] > 0);
                    let l = (c > 0 && shape[r][c - 1] > 0);
                    let rRight = (c < row.length - 1 && shape[r][c + 1] > 0);
                    drawConnectedCell(px, py, val, t, b, l, rRight, 1.0);
                }
            });
        });
    }

    particles.forEach(p => {
        let t = 1 - p.age / p.life;
        ctx.globalAlpha = Math.max(0, t);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    popTexts.forEach(pt => {
        let t = 1 - pt.age / pt.life;
        ctx.globalAlpha = Math.max(0, t);
        ctx.font = '700 20px "Fredoka", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = pt.color;
        ctx.strokeStyle = '#2a1550';
        ctx.lineWidth = 4;
        ctx.strokeText(pt.text, pt.x, pt.y);
        ctx.fillText(pt.text, pt.x, pt.y);
    });
    ctx.globalAlpha = 1;

    if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255,217,61,${flashAlpha * 0.22})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (gameState === 'PAUSED' || gameState === 'LOGS') {
        ctx.fillStyle = 'rgba(20,10,45,0.55)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
}

function drawConnectedCell(px, py, type, top, bottom, left, right, scale = 1.0) {
    let base = COLORS[type];
    let radius = Math.max(3, BLOCK_SIZE * 0.24);

    let rTL = (!top && !left) ? radius : 0;
    let rTR = (!top && !right) ? radius : 0;
    let rBR = (!bottom && !right) ? radius : 0;
    let rBL = (!bottom && !left) ? radius : 0;

    let pad = 0.5;
    let x = px + (left ? -pad : 1.5);
    let y = py + (top ? -pad : 1.5);
    let w = BLOCK_SIZE - (left ? 0 : 1.5) - (right ? 0 : 1.5) + ((left ? pad : 0) + (right ? pad : 0));
    let h = BLOCK_SIZE - (top ? 0 : 1.5) - (bottom ? 0 : 1.5) + ((top ? pad : 0) + (bottom ? pad : 0));

    ctx.save();
    if (scale !== 1.0) {
        ctx.translate(px + BLOCK_SIZE / 2, py + BLOCK_SIZE / 2);
        ctx.scale(scale, scale);
        ctx.translate(-(px + BLOCK_SIZE / 2), -(py + BLOCK_SIZE / 2));
    }

    drawCustomRoundRect(x, y, w, h, rTL, rTR, rBR, rBL);
    ctx.fillStyle = base;
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    drawCustomRoundRect(x + 1.5, y + 1.5, w - 3, Math.max(2, h * 0.35), rTL * 0.7, rTR * 0.7, 0, 0);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.2;
    drawCustomRoundRect(x, y, w, h, rTL, rTR, rBR, rBL);
    ctx.stroke();

    ctx.restore();
}

function drawCustomRoundRect(x, y, w, h, rtl, rtr, rbr, rbl) {
    ctx.beginPath();
    ctx.moveTo(x + rtl, y);
    ctx.lineTo(x + w - rtr, y);
    if (rtr) ctx.arcTo(x + w, y, x + w, y + rtr, rtr); else ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - rbr);
    if (rbr) ctx.arcTo(x + w, y + h, x + w - rbr, y + h, rbr); else ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + rbl, y + h);
    if (rbl) ctx.arcTo(x, y + h, x, y + h - rbl, rbl); else ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + rtl);
    if (rtl) ctx.arcTo(x, y, x + rtl, y, rtl); else ctx.lineTo(x, y);
    ctx.closePath();
}

function drawNormalBugAsset(px, py, scale = 1.0, bugType = 8) {
    const s = BLOCK_SIZE;
    const isSquashed = Math.floor(performance.now() / 500) % 2 === 1;
    const idleScaleY = isSquashed ? 0.95 : 1.0;
    const drawHeight = s * idleScaleY;

    ctx.save();
    ctx.translate(px + s / 2, py + s / 2);
    ctx.scale(scale, scale);
    ctx.translate(-(px + s / 2), -(py + s / 2));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
        normalBugImages[bugType],
        px,
        py + s - drawHeight,
        s,
        drawHeight
    );
    ctx.restore();
}

function drawBug(px, py, scale = 1.0, bugType = 8) {
    if (normalBugImageReady[bugType]) {
        drawNormalBugAsset(px, py, scale, bugType);
        return;
    }

    let s = BLOCK_SIZE;
    ctx.save();

    ctx.translate(px + s / 2, py + s / 2);
    let baseScale = (s / 36) * scale; 
    ctx.scale(baseScale, baseScale);

    let faceColor = BUG_FACE_COLORS[bugType] || '#fbf5eb';

    ctx.fillStyle = faceColor;
    ctx.strokeStyle = '#3d312a';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(-5, -7);
    ctx.lineTo(-11, -15);
    ctx.lineTo(-15, -4); 
    ctx.quadraticCurveTo(-16, 7, -10, 13);
    ctx.quadraticCurveTo(0, 16, 10, 13);  
    ctx.quadraticCurveTo(16, 7, 15, -4);  
    ctx.lineTo(11, -15); 
    ctx.lineTo(5, -7);   
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = (bugType === 13) ? '#ff3b30' : '#3d312a';

    ctx.beginPath();
    ctx.ellipse(-6, 2, 2.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6, 2, 2.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = (bugType === 13) ? '#ff9500' : '#ffffff';
    ctx.fillRect(-7, -0.5, 2, 2);
    ctx.fillRect(5, -0.5, 2, 2);

    ctx.restore();
}

function drawBatBug(px, py, scale = 1.0, dir = 1, bugType = 14) {
    let s = BLOCK_SIZE;
    ctx.save();

    ctx.translate(px + s / 2, py + s / 2);
    let baseScale = (s / 36) * scale; 
    ctx.scale(baseScale, baseScale);

    // 視認性の高い、大きく明るいコウモリの羽
    ctx.fillStyle = '#6b5b95'; 
    ctx.strokeStyle = '#2a1550';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(-8, -2);
    ctx.lineTo(-28, -18);
    ctx.lineTo(-20, -5);
    ctx.lineTo(-30, 6);
    ctx.lineTo(-14, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(8, -2);
    ctx.lineTo(28, -18);
    ctx.lineTo(20, -5);
    ctx.lineTo(30, 6);
    ctx.lineTo(14, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    let faceColor = BUG_FACE_COLORS[bugType] || '#fbf5eb';

    ctx.fillStyle = faceColor;
    ctx.strokeStyle = '#3d312a';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.moveTo(-5, -7);
    ctx.lineTo(-11, -15);
    ctx.lineTo(-15, -4); 
    ctx.quadraticCurveTo(-16, 7, -10, 13);
    ctx.quadraticCurveTo(0, 16, 10, 13);  
    ctx.quadraticCurveTo(16, 7, 15, -4);  
    ctx.lineTo(11, -15); 
    ctx.lineTo(5, -7);   
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = (bugType === 19) ? '#ff3b30' : '#3d312a';
    ctx.beginPath();
    ctx.ellipse(-6, 2, 2.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6, 2, 2.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = (bugType === 19) ? '#ff9500' : '#ffffff';
    ctx.fillRect(-7, -0.5, 2, 2);
    ctx.fillRect(5, -0.5, 2, 2);

    ctx.restore();
}

function drawGhostCell(c, r) {
    let px = c * BLOCK_SIZE;
    let py = r * BLOCK_SIZE;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    drawCustomRoundRect(px + 2, py + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4, 3, 3, 3, 3);
    ctx.stroke();
    ctx.setLineDash([]);
}

let tX = 0, tY = 0, tTime = 0;
let initialPieceX = 0;
let isDragging = false;
let holdTimer = null;

function stopHoldFastDrop() {
    isFastDropping = false;
    clearTimeout(holdTimer);
    holdTimer = null;
    fastBtn.classList.remove('active');
}

canvas.addEventListener('pointerdown', e => {
    if (gameState !== 'PLAYING' || isAnimating) return;
    tX = e.clientX;
    tY = e.clientY;
    tTime = Date.now();
    initialPieceX = currentPiece.x;
    isDragging = true;

    clearTimeout(holdTimer);
    holdTimer = setTimeout(() => {
        if (isDragging) {
            isFastDropping = true;
        }
    }, 200);
});

canvas.addEventListener('pointermove', e => {
    if (!isDragging || gameState !== 'PLAYING' || isAnimating) return;

    let dx = e.clientX - tX;
    let dy = e.clientY - tY;

    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        stopHoldFastDrop();
    }

    let gridDeltaX = Math.round(dx / BLOCK_SIZE);
    let targetX = initialPieceX + gridDeltaX;

    let step = targetX > currentPiece.x ? 1 : -1;
    while (currentPiece.x !== targetX) {
        let nextX = currentPiece.x + step;
        if (checkCollisionAt(nextX, currentPiece.y, currentPiece.shape)) {
            break;
        }
        currentPiece.x = nextX;
    }
});

canvas.addEventListener('pointerup', e => {
    stopHoldFastDrop();
    if (!isDragging || gameState !== 'PLAYING' || isAnimating) return;
    isDragging = false;

    let dx = e.clientX - tX;
    let dy = e.clientY - tY;
    let dt = Date.now() - tTime;

    if (Math.abs(dx) < 15 && Math.abs(dy) < 15 && dt < 200) {
        rotatePiece();
    }
});

canvas.addEventListener('pointercancel', () => {
    isDragging = false;
    stopHoldFastDrop();
});

window.addEventListener('resize', resizeCanvas);

// iOS Safari等のダブルタップによるズーム防止処理
let lastTouchEnd = 0;
document.addEventListener('touchend', function (e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, { passive: false });

// ピンチイン・ピンチアウトのジェスチャーによるズーム防止
document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
});

changeScreen('TITLE');
requestAnimationFrame(update);
