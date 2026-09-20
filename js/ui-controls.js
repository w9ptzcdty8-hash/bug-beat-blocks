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
