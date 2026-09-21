let tX = 0, tY = 0, tTime = 0;
let initialPieceX = 0;
let isDragging = false;
let holdTimer = null;

function preventNativeTouchGesture(e) {
    if (e.cancelable) {
        e.preventDefault();
    }
}

// iOSのダブルタップ後の長押しで表示されるルーペなど、
// Canvas上のネイティブタッチ操作をジェスチャー開始時から抑止する。
['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(eventName => {
    canvas.addEventListener(eventName, preventNativeTouchGesture, { passive: false });
});

function stopHoldFastDrop() {
    isFastDropping = false;
    clearTimeout(holdTimer);
    holdTimer = null;
    fastBtn.classList.remove('active');
}

canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
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
    e.preventDefault();
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
    e.preventDefault();
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

canvas.addEventListener('dblclick', e => {
    e.preventDefault();
});

canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
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
