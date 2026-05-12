
/* ============================================================
   GLOBAL: เก็บ questions ที่โหลดจาก questions.json
   ============================================================ */
let QUESTIONS = [];

/* ============================================================
   STATE: ตัวแปรสถานะทั้งหมดของเกม
   แก้ค่า default ที่นี่ได้เลย เช่น จำนวนด่าน
   ============================================================ */
let state = {
    level: 1,      // ด่านปัจจุบัน (1 ถึง TOTAL_LEVELS)
    score: 0,      // คะแนนสะสม
    currentQ: null,   // คำถามที่กำลังแสดงอยู่ (object จาก QUESTIONS)
    counts: {},     // { left:0, right:0, up:0, down:0, single:0 }
    timerInterval: null,   // interval id ของ countdown
    timeLeft: 0,      // เวลาที่เหลือ (ms)
    totalTime: 0,      // เวลาทั้งหมดของด่านนี้ (ms)
    usedIds: [],     // id คำถามที่ใช้ไปแล้วในรอบนี้
    isResultShowing: false,  // ป้องกันกดปุ่มซ้ำขณะ overlay แสดงอยู่
    resultAction: null    // 'next' | 'restart' — สำหรับปุ่มใน overlay
};

const TOTAL_LEVELS = 30; // จำนวนด่านทั้งหมด (เปลี่ยนได้)

/* ============================================================
   TIME_CONFIG: ตั้งเวลาแยกตามระดับ (วินาที)
   แก้ที่นี่จุดเดียว มีผลกับทุกคำถามในระดับนั้นทันที
   ค่านี้จะ override ค่า "time" ใน questions.json
   ถ้าอยากให้แต่ละข้อกำหนดเองใน JSON → ลบ TIME_CONFIG
   แล้วแก้ startTimer(q.time) ใน loadLevel() ตรงๆ
   ============================================================ */
const TIME_CONFIG = {
    easy: 5,   // วินาที — ง่าย
    mid: 7,   // วินาที — กลาง
    hard: 9    // วินาที — ยาก
};

/* ============================================================
   โหลด questions.json ก่อนเริ่มเกม
   - ไฟล์ต้องอยู่ใน folder เดียวกันกับ index.html
   - ถ้าต้องการเปลี่ยน path แก้ที่ fetch('questions.json')
   ============================================================ */
async function loadQuestions() {
    try {
        const res = await fetch('questions.json');
        QUESTIONS = await res.json();
        console.log(`โหลดคำถามสำเร็จ: ${QUESTIONS.length} ข้อ`);
        updateRulesTime(); // อัปเดตเวลาใน rules box ให้ตรงกับ TIME_CONFIG
        document.getElementById('all-level').textContent = `${TOTAL_LEVELS}`;
    } catch (err) {
        console.error('โหลด questions.json ไม่สำเร็จ:', err);
        alert('ไม่พบไฟล์ questions.json กรุณาวางไฟล์ไว้ในโฟลเดอร์เดียวกัน');
    }
}

/* ============================================================
   สุ่มคำถาม 1 ข้อที่ยังไม่เคยใช้ในรอบนี้
   - กรองเฉพาะ id ที่ไม่อยู่ใน state.usedIds
   - ถ้า pool หมด return null
   ============================================================ */
function pickQuestion() {
    const pool = QUESTIONS.filter(q => !state.usedIds.includes(q.id));
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

/* ============================================================
   เริ่มเกมใหม่ตั้งแต่ด่าน 1 (รีเซ็ต state ทั้งหมด)
   ============================================================ */
function startGame() {
    state.level = 1;
    state.score = 0;
    state.usedIds = [];
    state.isResultShowing = false;
    hideOverlay();
    showScreen('screen-game');
    loadLevel();
    ClickPlaySound();
}

/* ============================================================
   โหลดด่านปัจจุบัน
   1. เลือกคำถาม
   2. รีเซ็ต counts
   3. Render UI
   4. เริ่ม timer
   ============================================================ */
function loadLevel() {
    clearTimer();

    const q = pickQuestion();
    if (!q) { showWin(); return; }

    state.currentQ = q;
    state.usedIds.push(q.id);
    state.counts = { left: 0, right: 0, up: 0, down: 0, single: 0 };

    updateHUD();
    renderInstruction(q);
    renderCounters(q);
    renderButtons(q);
    // ใช้เวลาจาก TIME_CONFIG ตาม level ของคำถาม
    // ถ้าต้องการให้แต่ละข้อกำหนดเวลาเองใน JSON → เปลี่ยนเป็น startTimer(q.time)
    const timeForLevel = TIME_CONFIG[q.level] ?? q.time;
    startTimer(timeForLevel);
}

/* ============================================================
   อัปเดต HUD (ด่าน + คะแนน)
   ============================================================ */
function updateHUD() {
    document.getElementById('hud-level').textContent = `ด่าน ${state.level} / ${TOTAL_LEVELS}`;
    document.getElementById('hud-score').textContent = `คะแนน: ${state.score}`;
}

/* ============================================================
   แสดงข้อความคำสั่งและ badge ระดับความยาก
   ============================================================ */
function renderInstruction(q) {
    document.getElementById('instruction-text').innerHTML = q.text;

    const badge = document.getElementById('level-badge');
    const config = { easy: ['🟢 ง่าย', 'easy'], mid: ['🟡 กลาง', 'mid'], hard: ['🔴 ยาก', 'hard'] };
    const [label, cls] = config[q.level];
    badge.textContent = label;
    badge.className = `badge ${cls}`;
}

/* ============================================================
   สร้าง counter box สำหรับแต่ละปุ่ม
   ============================================================ */
function renderCounters(q) {
    const wrap = document.getElementById('counters-wrap');
    wrap.innerHTML = '';
    const labelMap = { single: 'กด', left: '◀ ซ้าย', right: '▶ ขวา', up: '▲ บน', down: '▼ ล่าง' };

    q.buttons.forEach(key => {
        const div = document.createElement('div');
        div.className = 'counter-item';
        div.innerHTML = `
      <div class="c-label">${labelMap[key]}</div>
      <div class="c-val" id="cnt-${key}">0</div>`;
        wrap.appendChild(div);
    });
}

/* ============================================================
   สร้างปุ่มกดตามประเภทของคำถาม
   - single  → 1 ปุ่มกลาง
   - 2 ปุ่ม  → ซ้าย + ขวา แถวเดียว
   - 4 ปุ่ม  → D-pad (บน / ซ้าย+ขวา / ล่าง)
   ============================================================ */
function renderButtons(q) {
    const wrap = document.getElementById('buttons-wrap');
    wrap.innerHTML = '';

    if (q.buttons.includes('single')) {
        const row = document.createElement('div');
        row.className = 'buttons-row';
        row.appendChild(makeBtn('single', '⬤ กด'));
        wrap.appendChild(row);

    } else if (!q.buttons.includes('up')) {
        const row = document.createElement('div');
        row.className = 'buttons-row';
        row.appendChild(makeBtn('left', '◀ ซ้าย'));
        row.appendChild(makeBtn('right', 'ขวา ▶'));
        wrap.appendChild(row);

    } else {
        // D-pad layout
        const rowTop = document.createElement('div');
        rowTop.className = 'buttons-row';
        rowTop.appendChild(makeBtn('up', '▲ บน'));

        const rowMid = document.createElement('div');
        rowMid.className = 'buttons-row';
        rowMid.appendChild(makeBtn('left', '◀ ซ้าย'));
        rowMid.appendChild(makeBtn('right', 'ขวา ▶'));

        const rowBot = document.createElement('div');
        rowBot.className = 'buttons-row';
        rowBot.appendChild(makeBtn('down', '▼ ล่าง'));

        wrap.appendChild(rowTop);
        wrap.appendChild(rowMid);
        wrap.appendChild(rowBot);
    }
}

/* ============================================================
   สร้าง element ปุ่มเดี่ยว
   key   : 'single' | 'left' | 'right' | 'up' | 'down'
   label : ข้อความในปุ่ม
   ============================================================ */
function makeBtn(key, label) {
    const btn = document.createElement('button');
    btn.className = `game-btn ${key}`;
    btn.textContent = label;
    btn.onclick = () => pressBtn(key);
    return btn;
}

/* ============================================================
   เมื่อผู้เล่นกดปุ่ม
   - เพิ่ม counter + animation bounce
   ============================================================ */
function pressBtn(key) {
    if (state.isResultShowing) return;
    state.counts[key]++;

    const el = document.getElementById(`cnt-${key}`);
    if (el) {
        el.textContent = state.counts[key];
        el.style.transform = 'scale(1.4)';
        setTimeout(() => el.style.transform = 'scale(1)', 120);
    }
    clickOn();
}

/* ============================================================
   เริ่ม countdown bar
   - อัปเดตทุก 30ms (smooth animation)
   - สีเปลี่ยน: เขียว → เหลือง → แดง ตาม ratio ที่เหลือ
   - เมื่อหมดเวลา → เรียก confirmAnswer() อัตโนมัติ
   ============================================================ */
function startTimer(seconds) {
    state.totalTime = seconds * 1000;
    state.timeLeft = state.totalTime;

    const bar = document.getElementById('timer-bar');
    bar.style.transform = 'scaleX(1)';
    bar.style.background = 'var(--easy)';
    bar.classList.remove('danger');

    state.timerInterval = setInterval(() => {
        state.timeLeft -= 30;
        const ratio = Math.max(0, state.timeLeft / state.totalTime);
        bar.style.transform = `scaleX(${ratio})`;

        if (ratio < 0.3) {
            bar.style.background = 'var(--hard)';
            bar.classList.add('danger');
        } else if (ratio < 0.6) {
            bar.style.background = 'var(--mid)';
            bar.classList.remove('danger');
        }

        if (state.timeLeft <= 0) {
            clearTimer();
            confirmAnswer(); // หมดเวลา → ตรวจคำตอบทันที
        }
    }, 30);
}

/* ============================================================
   หยุด countdown
   ============================================================ */
function clearTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
    document.getElementById('timer-bar').classList.remove('danger');
}

/* ============================================================
   ตรวจคำตอบ — เรียกเมื่อกด ✔ ยืนยัน หรือหมดเวลา
   - ใช้ฟังก์ชัน evaluateCondition() แทน check function ใน JS
     เพราะคำถามมาจาก JSON ไม่มี function
   ============================================================ */
function confirmAnswer() {
    if (state.isResultShowing) return;
    clearTimer();

    const q = state.currentQ;
    const c = state.counts;
    const pass = evaluateCondition(q.condition, c);

    if (pass) {
        // คะแนนตาม level + bonus จากเวลาที่เหลือ
        const base = { easy: 100, mid: 200, hard: 300 }[q.level];
        const timeBonus = Math.floor((state.timeLeft / state.totalTime) * 50);
        state.score += base + timeBonus;

        if (state.level >= TOTAL_LEVELS) {
            showWin();
        } else {
            showResult(true, q);
        }
    } else {
        showResult(false, q);
    }
}

/* ============================================================
   ประเมินเงื่อนไขจาก condition object (แทน check function)
   รองรับ type ต่างๆ ที่กำหนดใน questions.json:

   exact               : key === value
   gt                  : key > value
   range               : min <= key <= max
   oneOf               : key อยู่ใน values[]
   multi_exact         : หลาย key ตรงค่าที่กำหนดทุกตัว
   compare_gt          : keyA > keyB (และ minTotal > 0)
   sum_exact           : ผลรวมของ keys[] === value
   forbidden_and_min   : forbidden === 0 และ required >= min
   diff_exact          : keyA - keyB === value
   equal_keys          : keys ทุกตัวเท่ากัน และ >= minEach
   sum_equal_groups    : sum(groupA) === sum(groupB) และ minTotal > 0
   all_min             : keys ทุกตัว >= min
   key_max             : key > ทุกตัวใน others และ key > 0
   multi_forbidden_and_min: forbidden ทุกตัว === 0 และ required รวมกัน >= minTotal
   equal_keys_strict   : equalKeys เท่ากัน, zeroKeys === 0, minEach > 0
   all_unique_nonzero  : keys ทุกตัวไม่ซ้ำ และ > 0

   ถ้าต้องการเพิ่ม condition type ใหม่ → เพิ่ม case ใน switch นี้
   และเพิ่ม object ใน questions.json ด้วย
   ============================================================ */
function evaluateCondition(cond, c) {
    switch (cond.type) {

        case 'exact':
            return c[cond.key] === cond.value;

        case 'gt':
            return c[cond.key] > cond.value;

        case 'range':
            return c[cond.key] >= cond.min && c[cond.key] <= cond.max;

        case 'oneOf':
            return cond.values.includes(c[cond.key]);

        case 'multi_exact':
            // ทุก key ต้องตรงค่าที่กำหนด
            return Object.entries(cond.keys).every(([k, v]) => c[k] === v);

        case 'compare_gt':
            return c[cond.keyA] > c[cond.keyB] && (c[cond.keyA] + c[cond.keyB]) >= cond.minTotal;

        case 'sum_exact':
            return cond.keys.reduce((s, k) => s + c[k], 0) === cond.value;

        case 'forbidden_and_min':
            return c[cond.forbidden] === 0 && c[cond.required] >= cond.min;

        case 'diff_exact':
            return (c[cond.keyA] - c[cond.keyB]) === cond.value;

        case 'equal_keys': {
            const vals = cond.keys.map(k => c[k]);
            return vals.every(v => v === vals[0] && v >= cond.minEach);
        }

        case 'sum_equal_groups': {
            const sumA = cond.groupA.reduce((s, k) => s + c[k], 0);
            const sumB = cond.groupB.reduce((s, k) => s + c[k], 0);
            return sumA === sumB && (sumA + sumB) >= cond.minTotal;
        }

        case 'all_min':
            return cond.keys.every(k => c[k] >= cond.min);

        case 'key_max':
            return c[cond.key] > 0 && cond.others.every(k => c[cond.key] > c[k]);

        case 'multi_forbidden_and_min': {
            const forbidOk = cond.forbidden.every(k => c[k] === 0);
            const requiredSum = cond.required.reduce((s, k) => s + c[k], 0);
            return forbidOk && requiredSum >= cond.minTotal;
        }

        case 'equal_keys_strict': {
            const eqVals = cond.equalKeys.map(k => c[k]);
            const allEq = eqVals.every(v => v === eqVals[0] && v >= cond.minEach);
            const allZero = cond.zeroKeys.every(k => c[k] === 0);
            return allEq && allZero;
        }

        case 'all_unique_nonzero': {
            const uVals = cond.keys.map(k => c[k]);
            return uVals.every(v => v > 0) && new Set(uVals).size === uVals.length;
        }

        default:
            console.warn('ไม่รู้จัก condition type:', cond.type);
            return false;
    }
}

/* ============================================================
   แสดง overlay ผลลัพธ์
   win = true  → ผ่านด่าน → ปุ่ม "ด่านต่อไป"
   win = false → แพ้       → ปุ่ม "เริ่มใหม่"
   ============================================================ */
function showResult(win, q) {
    state.isResultShowing = true;

    document.getElementById('result-icon').textContent = win ? '🎉' : '💥';
    document.getElementById('result-title').textContent = win ? 'ผ่านด่าน!' : 'แพ้แล้ว!';
    document.getElementById('result-score').textContent = `คะแนน: ${state.score}`;

    if (win) {
        document.getElementById('result-sub').innerHTML =
            `ด่าน ${state.level} ผ่านแล้ว! ไปด่าน ${state.level + 1} กันเลย`;
        document.getElementById('result-btn').textContent = '▶ ด่านต่อไป';
        correctSound();
        state.resultAction = 'next';
    } else {
        incorrectSound();
        document.getElementById('result-sub').innerHTML =
            `คำตอบผิด! <br><small style="color:var(--mid)">💡 ${q.hint}</small>`;
        document.getElementById('result-btn').textContent = '🔄 เริ่มใหม่';
        document.getElementById('result-btnH').textContent = '⏹️ กลับหน้าแรก';
        state.resultAction = 'restart';

        // Animation สั่นเมื่อแพ้
        const box = document.getElementById('result-box');
        box.classList.remove('shake');
        void box.offsetWidth; // force reflow
        box.classList.add('shake');
        
    }

    document.getElementById('result-overlay').classList.add('show');
}

/* ============================================================
   ปุ่มใน overlay ถูกกด
   - 'next'    → เพิ่มด่าน → loadLevel
   - 'restart' → startGame (รีเซ็ตทั้งหมด)
   ============================================================ */
function handleResultBtn() {
    state.isResultShowing = false;
    hideOverlay();

    if (state.resultAction === 'next') {
        state.level++;
        loadLevel();
    } else {
        startGame();
    }
}

/* ============================================================
   ซ่อน overlay
   ============================================================ */
function hideOverlay() {
    document.getElementById('result-overlay').classList.remove('show');
}

/* ============================================================
   แสดงหน้า Win Screen
   ============================================================ */
function showWin() {
    clearTimer();
    document.getElementById('win-score-text').textContent = `คะแนนรวม: ${state.score} คะแนน`;
    document.getElementById('all-level').textContent = `${TOTAL_LEVELS}`;
    showScreen('screen-win');
}

/* ============================================================
   เปลี่ยน screen ที่แสดง
   ============================================================ */
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

/* ============================================================
   อัปเดตข้อความเวลาใน rules box ให้ตรงกับ TIME_CONFIG
   เรียกครั้งเดียวตอน loadQuestions สำเร็จ
   ถ้าแก้ TIME_CONFIG แล้ว rules box จะอัปเดตอัตโนมัติ
   ============================================================ */
function updateRulesTime() {
    document.getElementById("time-easy").textContent = TIME_CONFIG.easy;
    document.getElementById("time-mid").textContent = TIME_CONFIG.mid;
    document.getElementById("time-hard").textContent = TIME_CONFIG.hard;
}




/* ============================================================
   เล่นเสียง
   ============================================================ */


function clickOn() {
    const click = document.getElementById("click");
    click.currentTime = 0.35;
    click.play();
}


function ClickPlaySound() {
    const click_play = document.getElementById("click-play");
    click_play.currentTime = 0.45;
    click_play.play();
}

function incorrectSound() {
    const incorrect = document.getElementById("incorrect");
    incorrect.currentTime = 0;
    incorrect.play();
}

function correctSound() {
    const correct = document.getElementById("correct");
    correct.currentTime = 0;
    correct.play();
}


/* ============================================================
   โหลดคำถามทันทีที่หน้าเว็บพร้อม
   ============================================================ */
window.addEventListener('DOMContentLoaded', loadQuestions);