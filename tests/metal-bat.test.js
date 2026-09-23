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
    vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), sandbox, { filename: relativePath });
}

load('js/config.js');
vm.runInContext(`
    var isDragging = false;
    var holdTimer = null;
    var fastBtn = { classList: { add() {}, remove() {} } };
    function changeScreen() {}
`, sandbox);
load('js/game.js');

vm.runInContext(`
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    groupBoard = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    board[12][3] = 19;
    batBugs = [{ id: 'metal', row: 12, posX: 3, dir: 1, speed: 1.8, minX: 1, maxX: 5, type: 19 }];

    Math.random = () => 0.1;
    assert.equal(transformMetalBug(12, 3, 19), 14);
    assert.equal(board[12][3], 14);
    assert.equal(batBugs.length, 1);
    assert.equal(batBugs[0].type, 14);

    board[12][3] = 19;
    batBugs[0].type = 19;
    Math.random = () => 0.9;
    const colorBat = transformMetalBug(12, 3, 19);
    assert.ok(colorBat >= 15 && colorBat <= 18);
    assert.equal(board[12][3], colorBat);
    assert.equal(batBugs.length, 1);
    assert.equal(batBugs[0].type, colorBat);
`, sandbox);

console.log('metal-bat tests passed');
