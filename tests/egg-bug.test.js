const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const noop = () => {};
const context2d = new Proxy({}, {
    get(target, key) {
        if (!(key in target)) target[key] = noop;
        return target[key];
    },
    set(target, key, value) {
        target[key] = value;
        return true;
    }
});
const element = {
    classList: { add: noop, remove: noop },
    getContext: () => context2d,
    innerText: '',
    width: 240,
    height: 432
};

const sandbox = {
    assert,
    console,
    performance: { now: () => 0 },
    document: { getElementById: () => element },
    Image: class Image {},
    setTimeout: noop,
    clearTimeout: noop
};
vm.createContext(sandbox);

function load(relativePath) {
    const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
    vm.runInContext(source, sandbox, { filename: relativePath });
}

load('js/config.js');
vm.runInContext(`
    var isDragging = false;
    var holdTimer = null;
    var fastBtn = { classList: { add() {}, remove() {} } };
    function changeScreen() {}
`, sandbox);
load('js/game.js');
load('js/render.js');

vm.runInContext(`
    Math.random = () => 0.99;
    setupStage(9);
    assert.equal(board.flat().filter(type => type === EGG_BUG).length, 0);

    setupStage(10);
    assert.equal(board.flat().filter(type => type === EGG_BUG).length, 3);
    assert.equal(remainingEnemies, 7);

    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    groupBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    for (let c = 0; c < 4; c++) {
        board[5][c] = 1;
        groupBoard[5][c] = 1;
    }
    board[4][0] = EGG_BUG;
    groupBoard[4][0] = -1;
    eggTurnCheckPending = false;
    processMatches(false);
    assert.equal(pendingClearBugs[4][0], true);
    assert.equal(eggTurnCheckPending, true);

    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    groupBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    board[10][0] = EGG_BUG;
    board[10][1] = CRACKED_EGG_BUG;
    Math.random = () => 0.1;
    assert.equal(startEggTurnResolution(), true);
    assert.deepEqual(eggTransitionActions.map(action => action.kind), ['crack', 'hatch']);

    selectedLevel = 10;
    assert.equal(getEggHatchCandidates().includes(19), false);
    assert.equal(getEggHatchCandidates().some(type => type >= 14 && type <= 18), true);
    selectedLevel = 15;
    assert.equal(getEggHatchCandidates().includes(19), true);

    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    groupBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    board[12][3] = CRACKED_EGG_BUG;
    eggTransitionActions = [{
        r: 12,
        c: 3,
        kind: 'hatch',
        fromType: CRACKED_EGG_BUG,
        toType: 14
    }];
    animPhase = 'EGG_TRANSITION';
    animTimer = EGG_TRANSITION_DURATION;
    remainingEnemies = 1;
    currentPiece = new Piece(1);
    nextPiece = new Piece(1);
    updateEggTransition();
    assert.equal(board[12][3], 14);
    assert.equal(batBugs.length, 1);
    assert.equal(batBugs[0].row, 12);
    assert.equal(Math.round(batBugs[0].posX), 3);

    gameState = 'PLAYING';
    drawGame();
`, sandbox);

console.log('egg-bug tests passed');
