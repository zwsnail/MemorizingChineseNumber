const CHINESE_NUMS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const PINYIN_NUMS = ['líng', 'yī', 'èr', 'sān', 'sì', 'wǔ', 'liù', 'qī', 'bā', 'jiǔ'];
const CHINESE_UNITS = ['', '十', '百', '千', '万'];
const PINYIN_UNITS = ['', 'shí', 'bǎi', 'qiān', 'wàn'];

/**
 * Converts a number to Chinese characters and Pinyin units.
 * @param {number} n 
 * @returns {Array<{char: string, py: string}>}
 */
function numberToChinese(n) {
    if (n === 0) return [{ char: CHINESE_NUMS[0], py: PINYIN_NUMS[0] }];

    if (n === 10) return [{ char: CHINESE_UNITS[1], py: PINYIN_UNITS[1] }];
    if (n > 10 && n < 20) {
        return [
            { char: CHINESE_UNITS[1], py: PINYIN_UNITS[1] },
            { char: CHINESE_NUMS[n % 10], py: PINYIN_NUMS[n % 10] }
        ];
    }

    let str = n.toString();
    let units = [];
    let len = str.length;

    for (let i = 0; i < len; i++) {
        let num = parseInt(str[i]);
        let unitIdx = len - i - 1;
        let unit = CHINESE_UNITS[unitIdx];
        let pUnit = PINYIN_UNITS[unitIdx];

        if (num !== 0) {
            units.push({ char: CHINESE_NUMS[num], py: PINYIN_NUMS[num] });
            if (unit) units.push({ char: unit, py: pUnit });
        } else {
            // Check if we should add a zero (avoid consecutive zeros or trailing zeros)
            if (units.length > 0 && units[units.length - 1].char !== CHINESE_NUMS[0] && i !== len - 1) {
                // Peek ahead: only add zero if there's a non-zero digit later
                let hasMoreNonZero = false;
                for (let j = i + 1; j < len; j++) {
                    if (str[j] !== '0') {
                        hasMoreNonZero = true;
                        break;
                    }
                }
                if (hasMoreNonZero) {
                    units.push({ char: CHINESE_NUMS[0], py: PINYIN_NUMS[0] });
                }
            }
        }
    }

    return units;
}

/**
 * Helper to get the full string for TTS
 */
function getChineseString(units) {
    return units.map(u => u.char).join('');
}

/**
 * Generates a random number with weighted difficulty.
 */
function generateNumber() {
    const rand = Math.random();
    if (rand < 0.8) {
        return Math.floor(Math.random() * 101);
    } else if (rand < 0.95) {
        return Math.floor(Math.random() * 900) + 101;
    } else {
        return Math.floor(Math.random() * 9000) + 1001;
    }
}

// App State
let currentState = {
    round: 0,
    totalRounds: 20,
    correctCount: 0,
    currentNumber: 0,
    showPinyin: true,
    voiceGender: 'female',
    history: []
};

// UI Elements
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');
const quizCardContent = document.querySelector('.card-content');
const answerInput = document.getElementById('answer-input');
const feedbackContainer = document.getElementById('feedback');
const feedbackMessage = document.getElementById('feedback-message');
const correctAnswerDisplay = document.getElementById('correct-answer');
const progressBar = document.getElementById('progress-bar');
const currentCountDisplay = document.getElementById('current-count');

// Settings Elements
const pinyinToggle = document.getElementById('pinyin-toggle');
const voiceRadios = document.getElementsByName('voice');

// Buttons
const startBtn = document.getElementById('start-btn');
const submitBtn = document.getElementById('submit-btn');
const nextBtn = document.getElementById('next-btn');
const restartBtn = document.getElementById('restart-btn');

// Initialization
document.getElementById('current-date').textContent = new Date().toLocaleDateString();

// TTS
let voices = [];
function loadVoices() {
    voices = window.speechSynthesis.getVoices();
}
// Refresh voices when they are loaded/changed
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

// --- Live Settings Interactions ---

// Live Pinyin Toggle
pinyinToggle.addEventListener('change', () => {
    currentState.showPinyin = pinyinToggle.checked;
    const pinyinElements = document.querySelectorAll('.card-content .pinyin');
    pinyinElements.forEach(el => {
        el.style.visibility = currentState.showPinyin ? 'visible' : 'hidden';
    });
});

// Live Voice Selection
voiceRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        if (radio.checked) {
            currentState.voiceGender = radio.value;
            // Speak current number if in quiz screen and not finished
            if (!quizScreen.classList.contains('hidden') && currentState.currentNumber !== null) {
                const units = numberToChinese(currentState.currentNumber);
                speak(getChineseString(units));
            }
        }
    });
});

function speak(text, forceGender = null) {
    if (!window.speechSynthesis) return;

    // Stop any current speech
    window.speechSynthesis.cancel();

    const msg = new SpeechSynthesisUtterance();
    msg.text = text;
    msg.lang = 'zh-CN';

    // Refresh voices if empty
    if (voices.length === 0) loadVoices();

    const targetGender = forceGender || currentState.voiceGender;

    // Adjust speed and pitch based on gender for better clarity
    if (targetGender === 'female') {
        msg.rate = 0.9;
        msg.pitch = 1.0;
    } else {
        msg.rate = 0.85; // Slightly slower than female but faster than 0.8 to maintain articulation
        msg.pitch = 1.0; // Reset pitch to default as lower pitch often reduces clarity
    }

    // Cross-platform voice finding logic
    const zhVoices = voices.filter(v => v.lang.includes('zh') || v.lang.includes('CN'));

    console.log('Available Chinese voices:', zhVoices.filter(v => v.lang.includes('zh')).map(v => v.name));

    let selectedVoice = null;

    if (targetGender === 'female') {
        // High quality female voices: Google (Cloud), Microsoft Xiaoxiao (Win), Tingting (Mac)
        selectedVoice = zhVoices.find(v => v.name.includes('Google') && v.name.includes('Mandarin')) ||
            zhVoices.find(v => v.name.includes('Xiaoxiao') || v.name.includes('Tingting') || v.name.includes('Xiaomi')) ||
            zhVoices[0];
    } else {
        // High quality male voices: Google (Cloud), Microsoft Yunxi (Win), Li-mu (Mac)
        // We prioritize Google Mandarin voices as they are often clearer than local compact voices
        selectedVoice = zhVoices.find(v => v.name.includes('Google') && v.name.includes('Mandarin') && !v.name.toLowerCase().includes('female')) ||
            zhVoices.find(v => v.name.includes('Li-mu') || v.name.includes('Li mu') || v.name.includes('Kangkang') || v.name.includes('Yunxi')) ||
            zhVoices.find(v => v.name.toLowerCase().includes('male')) ||
            zhVoices.filter(v => !v.name.includes('Xiaoxiao') && !v.name.includes('Tingting'))[0] ||
            zhVoices[zhVoices.length - 1];
    }

    if (selectedVoice) {
        msg.voice = selectedVoice;
        console.log('Playing with voice:', selectedVoice.name);
    }

    window.speechSynthesis.speak(msg);
}

// Add preview listener
document.getElementById('preview-voice-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    const selected = Array.from(voiceRadios).find(r => r.checked);
    const gender = selected ? selected.value : 'female';
    const testText = gender === 'female' ? '你好，我是女生声音' : '你好，我是男生声音';
    speak(testText, gender);
});

function startPractice() {
    currentState.showPinyin = pinyinToggle.checked;
    const selectedVoice = Array.from(voiceRadios).find(r => r.checked);
    currentState.voiceGender = selectedVoice ? selectedVoice.value : 'female';

    currentState.round = 0;
    currentState.correctCount = 0;
    currentState.history = [];
    currentState.currentNumber = null;

    showView('quiz-screen');
    nextQuestion();
}

function nextQuestion() {
    currentState.round++;
    if (currentState.round > currentState.totalRounds) {
        showResults();
        return;
    }

    currentState.currentNumber = generateNumber();
    const resultUnits = numberToChinese(currentState.currentNumber);

    // Clear and build card content
    quizCardContent.innerHTML = '';
    resultUnits.forEach(unit => {
        const charUnit = document.createElement('div');
        charUnit.className = 'char-unit';

        const py = document.createElement('div');
        py.className = 'pinyin';
        py.textContent = unit.py;
        py.style.visibility = currentState.showPinyin ? 'visible' : 'hidden'; // Check both toggle and current state

        const zh = document.createElement('div');
        zh.className = 'chinese-number';
        zh.textContent = unit.char;

        charUnit.appendChild(py);
        charUnit.appendChild(zh);
        quizCardContent.appendChild(charUnit);
    });

    answerInput.value = '';
    answerInput.disabled = false;
    answerInput.classList.remove('correct-flash', 'wrong-flash');
    feedbackContainer.classList.add('hidden');

    // Disable submit until input exists
    submitBtn.disabled = true;
    submitBtn.classList.remove('hidden');
    nextBtn.classList.add('hidden');

    updateProgress();
    answerInput.focus();

    // Clean up animations from previous round
    const card = document.querySelector('.card');
    card.classList.remove('bounce', 'shake');
}

// Add input validation listener
answerInput.addEventListener('input', () => {
    submitBtn.disabled = !answerInput.value.trim();
});

function updateProgress() {
    // Map Progress
    const mapPlayer = document.getElementById('map-player');
    const percent = (currentState.round / currentState.totalRounds) * 100;

    // Calculate left position (leaving room for goal)
    const mapWidth = document.querySelector('.adventure-map').offsetWidth;
    const padding = 40;
    const moveRange = mapWidth - (padding * 2);
    const pos = (percent / 100) * moveRange + padding - 20;

    mapPlayer.style.left = `${pos}px`;

    // Biome Logic
    const biomeLabel = document.getElementById('current-biome');
    const body = document.body;

    // Remove all biome classes
    body.className = body.className.split(' ').filter(c => !c.startsWith('biome-')).join(' ');

    if (currentState.round <= 5) {
        body.classList.add('biome-forest');
        biomeLabel.innerHTML = '森林探险 | Forest 🌲';
    } else if (currentState.round <= 10) {
        body.classList.add('biome-desert');
        biomeLabel.innerHTML = '沙漠绿洲 | Desert 🏜️';
    } else if (currentState.round <= 15) {
        body.classList.add('biome-ocean');
        biomeLabel.innerHTML = '深海寻宝 | Ocean 🌊';
    } else if (currentState.round < 20) {
        body.classList.add('biome-volcano');
        biomeLabel.innerHTML = '宝藏冲刺 | Volcano 🔥';
    } else {
        body.classList.add('biome-treasure');
        biomeLabel.innerHTML = '宝藏终点 | Treasure 🏴‍☠️';
    }
}

function checkAnswer() {
    const userAnswer = parseInt(answerInput.value);
    const isCorrect = userAnswer === currentState.currentNumber;

    const card = document.querySelector('.card');

    if (isCorrect) {
        currentState.correctCount++;
        feedbackMessage.innerHTML = '正确! (Correct) ✨<br><span class="py-inline">zhèngquè</span>';
        feedbackMessage.className = 'feedback-message correct';
        answerInput.classList.add('correct-flash');
        card.classList.add('bounce');
        
        // Small confetti burst for immediate feedback
        confetti({
            particleCount: 25,
            spread: 40,
            origin: { y: 0.6 },
            scalar: 1,
            shapes: ['circle', 'square']
        });
    } else {
        feedbackMessage.innerHTML = '别灰心! (Don\'t give up!) 💪<br><span class="py-inline">bié huīxīn</span>';
        feedbackMessage.className = 'feedback-message wrong';
        answerInput.classList.add('wrong-flash');
        card.classList.add('shake');
    }

    correctAnswerDisplay.textContent = currentState.currentNumber;
    feedbackContainer.classList.remove('hidden');
    answerInput.disabled = true;
    submitBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');

    // Play audio
    const units = numberToChinese(currentState.currentNumber);
    speak(getChineseString(units));
}

function showResults() {
    showView('result-screen');
    const accuracy = Math.round((currentState.correctCount / currentState.totalRounds) * 100);

    // Dynamic Header based on score with Pinyin
    const resultHeader = document.querySelector('#result-screen h2');
    if (accuracy === 100) {
        resultHeader.innerHTML = '<span class="py-inline" style="display:block;margin-bottom:0.25rem;color:#fde047">tài bàng le!</span>太棒了！<br><span style="font-size: 1.25rem; font-weight: normal; color: #facc15;">Perfect! 👑</span> 🎉';
    } else if (accuracy >= 80) {
        resultHeader.innerHTML = '<span class="py-inline" style="display:block;margin-bottom:0.25rem;color:#fde047">zuò de hǎo!</span>做得好！<br><span style="font-size: 1.25rem; font-weight: normal; color: #facc15;">Great Job! 🥳</span> 🎉';
    } else if (accuracy >= 60) {
        resultHeader.innerHTML = '<span class="py-inline" style="display:block;margin-bottom:0.25rem;color:#fde047">bú cuò yo!</span>不错哟！<br><span style="font-size: 1.25rem; font-weight: normal; color: #facc15;">Good Job! ✨</span>';
    } else if (accuracy > 0) {
        resultHeader.innerHTML = '<span class="py-inline" style="display:block;margin-bottom:0.25rem;color:#94a3b8">jì xù jiā yóu!</span>继续加油！<br><span style="font-size: 1.25rem; font-weight: normal; color: #94a3b8;">Keep it up! 💪</span>';
    } else {
        resultHeader.innerHTML = '<span class="py-inline" style="display:block;margin-bottom:0.25rem;color:#94a3b8">zài jiē zài lì!</span>再接再厉！<br><span style="font-size: 1.25rem; font-weight: normal; color: #94a3b8;">Try again! 📚</span>';
    }

    document.getElementById('result-date').textContent = new Date().toLocaleDateString();
    document.getElementById('accuracy').textContent = `${accuracy}%`;
    document.getElementById('correct-count-stat').textContent = `${currentState.correctCount}/${currentState.totalRounds}`;

    // Small delay to ensure shapes are ready and DOM is updated
    setTimeout(() => {
        triggerCelebration(accuracy);
    }, 200);
}

function triggerCelebration(accuracy) {
    const count = Math.max(70, accuracy * 2.5);
    const defaults = {
        origin: { y: 0.7 },
        zIndex: 1000
    };

    let emojis = [];
    if (accuracy === 100) emojis = ['💯', '👑', '🎉', '🎒'];
    else if (accuracy >= 80) emojis = ['💎', '⭐', '🎒', '✨'];
    else if (accuracy >= 60) emojis = ['👍', '🎒'];
    else if (accuracy > 0) emojis = ['💪', '📚', '🎒'];
    else emojis = ['💀', '🪦'];

    function fire(particleRatio, opts) {
        confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio),
            scalar: opts.scalar || 3, // Make them nice and big
            shapes: emojis.map(e => confetti.shapeFromText({ text: e }))
        });
    }

    fire(0.25, { spread: 40, startVelocity: 70, scalar: 5 });
    fire(0.2, { spread: 80, scalar: 4 });
    fire(0.35, { spread: 120, decay: 0.9, scalar: 3 });
    fire(0.1, { spread: 140, startVelocity: 40, decay: 0.92, scalar: 6 });
}

function showView(viewId) {
    [startScreen, quizScreen, resultScreen].forEach(view => {
        view.classList.add('hidden');
    });
    document.getElementById(viewId).classList.remove('hidden');

    // Add view-specific class to body for background styling
    document.body.classList.remove('on-start', 'on-quiz', 'on-result');
    const studentBg = document.getElementById('global-student-bg');
    
    if (viewId === 'start-screen' || viewId === 'result-screen') {
        document.body.classList.add(viewId === 'start-screen' ? 'on-start' : 'on-result');
        studentBg.classList.remove('hidden-bg');
    } else {
        studentBg.classList.add('hidden-bg');
        if (viewId === 'quiz-screen') document.body.classList.add('on-quiz');
    }
}

// Listeners
startBtn.addEventListener('click', startPractice);
submitBtn.addEventListener('click', checkAnswer);
nextBtn.addEventListener('click', nextQuestion);
restartBtn.addEventListener('click', startPractice);

answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const isSubmitVisible = !submitBtn.classList.contains('hidden');
        const isNextVisible = !nextBtn.classList.contains('hidden');

        if (isSubmitVisible && !submitBtn.disabled) {
            checkAnswer();
        } else if (isNextVisible) {
            nextQuestion();
        }
    }
});
// Initialize
showView('start-screen');
document.getElementById('current-date').textContent = new Date().toLocaleDateString();
