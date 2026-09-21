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
    12: 'assets/images/enemy-normal-pink.png',
    13: 'assets/images/enemy-normal-metal.png'
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
