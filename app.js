// ===== 영어 말하기 연습: 화면이 움직이게 하는 파일 =====

// 이 날짜에 1번 세트로 시작하고, 하루에 한 세트씩 다음으로 넘어갑니다.
const START_DATE = '2026-10-28';

// ----- 날짜 도우미 -----

// 날짜를 "1970년 1월 1일부터 며칠째" 숫자로 바꿉니다 (내 폰의 시간대 기준).
function dayNumber(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

// 오늘이 몇 번째 세트인지: 시작일부터 지난 날 수를 세트 개수로 나눈 나머지
function setIndexFor(date, setCount) {
  const [y, m, d] = START_DATE.split('-').map(Number);
  const days = dayNumber(date) - dayNumber(new Date(y, m - 1, d));
  return ((days % setCount) + setCount) % setCount;
}

// 날짜를 "2026-10-28" 같은 글자로 바꿉니다. 저장할 때 날짜 이름표로 씁니다.
function dateKey(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + m + '-' + d;
}

const todayKey = dateKey(new Date());

// ----- 브라우저 저장 공간(localStorage) -----
// 사파리 개인정보 보호 모드처럼 저장이 막힌 경우에도 사이트는 그대로 동작하게 합니다.
const STORAGE_KEY = 'english-practice';

function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // 저장이 막혀 있어도 지금 화면은 계속 쓸 수 있어요.
  }
}

const store = loadStore();

// ----- 듣기 (브라우저 내장 음성) -----
const canSpeak = 'speechSynthesis' in window;
let englishVoice = null;
let stopCurrent = null; // 지금 읽고 있는 문장의 버튼을 원래대로 돌리는 함수

// 폰·컴퓨터에 깔린 목소리 중에서 미국 영어 목소리를 고릅니다.
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  const us = voices.filter(v => v.lang.replace('_', '-') === 'en-US');
  const preferred = ['Samantha', 'Natural', 'Google US English'];
  englishVoice =
    us.find(v => preferred.some(name => v.name.includes(name))) ||
    us[0] ||
    voices.find(v => v.lang.startsWith('en')) ||
    null;
}

if (canSpeak) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice; // 목소리 목록은 조금 늦게 도착하기도 해요
}

function stopSpeaking() {
  if (stopCurrent) stopCurrent();
  if (canSpeak) speechSynthesis.cancel();
}

// 문장을 읽어 줍니다. 다 읽으면(또는 다른 문장 때문에 멈추면) onEnd를 부릅니다.
function speak(text, onEnd) {
  if (!canSpeak) {
    showError('이 브라우저에서는 듣기 기능을 쓸 수 없어요. 사파리나 크롬으로 열어 주세요.');
    return false;
  }
  stopSpeaking(); // 재생 중인 다른 문장은 멈춤
  if (!englishVoice) pickVoice();

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (stopCurrent === finish) stopCurrent = null;
    onEnd();
  };
  stopCurrent = finish;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  if (englishVoice) utterance.voice = englishVoice;
  utterance.rate = 0.9; // 조금 천천히
  utterance.onend = finish;
  utterance.onerror = finish;
  speechSynthesis.speak(utterance);
  return true;
}

// ----- 화면 전환 -----
// 주소 끝이 #three 면 3분 모드, #twentyfive 면 25분 모드, 없으면 홈을 보여줍니다.
// (이렇게 하면 사파리의 뒤로 가기 버튼도 그대로 동작해요.)
const SCREENS = ['home', 'three', 'twentyfive'];

function showScreen() {
  const name = location.hash.slice(1);
  const current = SCREENS.includes(name) ? name : 'home';
  for (const id of SCREENS) {
    document.getElementById(id).hidden = id !== current;
  }
  stopSpeaking();
  window.scrollTo(0, 0);
}

// ----- 문장 파일 읽기 -----
async function loadSentences() {
  let res;
  try {
    res = await fetch('sentences.json', { cache: 'no-store' });
  } catch {
    throw new Error('sentences.json을 불러오지 못했어요.\n파일을 더블클릭해서 열면 이렇게 돼요. 미리보기 서버 주소로 열어 주세요.');
  }
  if (!res.ok) {
    throw new Error('sentences.json 파일을 찾지 못했어요. (' + res.status + ')');
  }
  try {
    return JSON.parse(await res.text());
  } catch (e) {
    throw new Error('sentences.json 모양이 잘못됐어요.\n쉼표(,)나 따옴표(")가 빠지거나 하나 더 들어갔는지 확인해 주세요.\n\n자세한 내용: ' + e.message);
  }
}

function showError(message) {
  const box = document.getElementById('error');
  box.textContent = message;
  box.hidden = false;
  window.scrollTo(0, 0);
}

// ----- 홈 화면 -----
function renderHome(set, index, setCount) {
  document.getElementById('today-topic').textContent = set.title;
  document.getElementById('today-set').textContent = '세트 ' + (index + 1) + '/' + setCount;
}

// ----- 3분 모드 -----

// 오늘 "말했어요"를 누른 문장 번호들 (날짜가 바뀌면 빈 목록)
function saidToday() {
  return store.three && store.three.date === todayKey ? store.three.said : [];
}

function renderThree(set) {
  document.getElementById('three-topic').textContent = set.title;
  const list = document.getElementById('three-cards');
  const template = document.getElementById('card-template');
  const total = set.sentences.length;

  set.sentences.forEach((sentence, i) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector('.card-num').textContent = (i + 1) + ' / ' + total;
    card.querySelector('.card-en').textContent = sentence.en;
    card.querySelector('.card-ko').textContent = sentence.ko || '';

    const listenButton = card.querySelector('.btn-listen');
    const listenLabel = listenButton.querySelector('.label');
    listenButton.addEventListener('click', () => {
      const started = speak(sentence.en, () => {
        listenButton.classList.remove('playing');
        listenLabel.textContent = '다시 듣기';
        card.classList.add('listened');
      });
      if (started) {
        listenButton.classList.add('playing');
        listenLabel.textContent = '재생 중…';
      }
    });

    card.querySelector('.btn-said').addEventListener('click', () => toggleSaid(i, total));
    list.append(card);
  });

  updateThree(total);
}

// "말했어요"를 누르면 체크, 한 번 더 누르면 취소
function toggleSaid(i, total) {
  const said = new Set(saidToday());
  if (said.has(i)) said.delete(i);
  else said.add(i);
  store.three = { date: todayKey, said: [...said] };
  saveStore();

  const finished = updateThree(total);
  if (finished) {
    document.getElementById('three-done').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// 체크 상태에 맞게 카드 색, 진행 막대, 완료 상자를 바꿉니다. 다 했으면 true.
function updateThree(total) {
  const said = saidToday();
  document.querySelectorAll('#three-cards .card').forEach((card, i) => {
    const done = said.includes(i);
    card.classList.toggle('said', done);
    const button = card.querySelector('.btn-said');
    button.setAttribute('aria-pressed', String(done));
    button.textContent = done ? '✓ 말했어요' : '말했어요';
  });

  const count = said.filter(i => i < total).length;
  document.getElementById('three-count').textContent = count + '/' + total;
  document.getElementById('three-bar').style.width = (count / total) * 100 + '%';
  document.getElementById('three-done').hidden = count < total;
  return count === total;
}

// ----- 25분 모드: 내용 -----

// Claude 앱에 붙여 넣을 프롬프트. 문구를 바꾸고 싶으면 여기를 고치세요.
function buildPrompt(set) {
  const lines = set.sentences.map((s, i) => (i + 1) + '. ' + s.en).join('\n');
  return `너는 내 영어 말하기 연습 상대야. 지금부터 음성으로 10분 동안 롤플레이를 하자.

상황: ${set.situation}

규칙:
- 영어로만, 짧고 쉬운 문장으로 말해 줘.
- 한 번에 1~2문장만 말하고 내 대답을 기다려 줘.
- 아래 문장들을 내가 자연스럽게 써 볼 수 있게 대화를 이끌어 줘.
- 내 영어가 어색하면 대화를 멈추지 말고, 자연스러운 표현으로 한 번 바꿔 말해 줘.
- 내가 "끝"이라고 하면, 오늘 고치면 좋을 표현 3개를 한국어로 짧게 정리해 줘.

오늘 연습한 문장:
${lines}

준비되면 네가 먼저 상황에 맞게 영어로 말을 걸어 줘.`;
}

// 문장 목록(영어 + 뜻 + 듣기 버튼)을 만듭니다.
function renderMiniList(listId, sentences) {
  const list = document.getElementById(listId);
  const template = document.getElementById('mini-template');
  sentences.forEach(sentence => {
    const item = template.content.firstElementChild.cloneNode(true);
    item.querySelector('.mini-en').textContent = sentence.en;
    item.querySelector('.mini-ko').textContent = sentence.ko || '';
    const button = item.querySelector('.mini-listen');
    button.addEventListener('click', () => {
      if (speak(sentence.en, () => button.classList.remove('playing'))) {
        button.classList.add('playing');
      }
    });
    list.append(item);
  });
}

function renderTwentyFive(todaySet, reviewSet) {
  document.getElementById('tf-topic').textContent = todaySet.title;
  document.getElementById('review-topic').textContent = reviewSet.title;
  renderMiniList('review-list', reviewSet.sentences);
  renderMiniList('today-list', todaySet.sentences);
  document.getElementById('situation').textContent = todaySet.situation;

  const prompt = buildPrompt(todaySet);
  document.getElementById('prompt').textContent = prompt;

  const copyButton = document.getElementById('copy-prompt');
  copyButton.addEventListener('click', async () => {
    const ok = await copyText(prompt);
    copyButton.textContent = ok ? '✓ 복사됐어요' : '복사가 안 돼요. 글자를 길게 눌러 복사해 주세요';
    setTimeout(() => { copyButton.textContent = '프롬프트 복사'; }, 2500);
  });
}

// 클립보드(복사해 둔 글자를 잠깐 보관하는 곳)에 글자를 넣습니다.
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 새 방법이 막힌 경우(예: http 주소) 예전 방법으로 한 번 더 시도
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.append(area);
  area.select();
  area.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

// ----- 25분 모드: 타이머 -----
// 남은 초를 1초씩 세지 않고 "끝나는 시각"을 저장해 둡니다.
// 그래서 Claude 앱에 갔다 오거나 화면이 꺼져도 시간이 정확해요.

const STEPS = [
  { name: '복습', minutes: 5 },
  { name: '오늘 문장 따라 말하기', minutes: 10 },
  { name: 'Claude 롤플레이', minutes: 10 },
];
const TOTAL_MS = STEPS.reduce((sum, step) => sum + step.minutes, 0) * 60000;

// 오늘의 타이머 상태. endAt: 돌아가는 중이면 끝나는 시각, remaining: 멈춰 있을 때 남은 시간
function timerState() {
  if (!store.timer || store.timer.date !== todayKey) {
    store.timer = { date: todayKey, endAt: null, remaining: TOTAL_MS };
  }
  return store.timer;
}

function remainingMs() {
  const t = timerState();
  return t.endAt ? Math.max(0, t.endAt - Date.now()) : t.remaining;
}

// 지난 시간으로 지금 몇 번째 단계인지, 그 단계가 얼마나 남았는지 계산
function stepAt(elapsed) {
  let end = 0;
  for (let i = 0; i < STEPS.length; i++) {
    end += STEPS[i].minutes * 60000;
    if (elapsed < end) return { index: i, left: end - elapsed };
  }
  return { index: STEPS.length, left: 0 }; // 다 끝남
}

function formatTime(ms) {
  const seconds = Math.ceil(ms / 1000);
  return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}

let shownStep = null; // 화면에 마지막으로 보여준 단계 (단계가 바뀌는 순간을 알아채려고)

function updateTimer() {
  const t = timerState();
  if (t.endAt && Date.now() >= t.endAt) {
    // 25분이 다 지남
    t.endAt = null;
    t.remaining = 0;
    saveStore();
    keepScreenOn(false);
  }

  const left = remainingMs();
  const running = Boolean(t.endAt);
  const { index, left: stepLeft } = stepAt(TOTAL_MS - left);
  const finished = index === STEPS.length;

  document.getElementById('timer-step').textContent =
    finished ? '25분 끝!' : (index + 1) + '단계 · ' + STEPS[index].name;
  document.getElementById('timer-time').textContent = formatTime(stepLeft);
  document.getElementById('timer-total').textContent = '전체 남은 시간 ' + formatTime(left);

  const startButton = document.getElementById('timer-start');
  startButton.hidden = finished;
  startButton.textContent = running ? '일시정지' : left === TOTAL_MS ? '시작' : '계속하기';
  document.getElementById('timer-reset').hidden = running || left === TOTAL_MS;

  STEPS.forEach((step, i) => {
    const box = document.getElementById('step-' + i);
    box.classList.toggle('current', i === index);
    box.classList.toggle('done', i < index);
    box.querySelector('.step-num').textContent = i < index ? '✓' : String(i + 1);
  });
  document.getElementById('tf-done').hidden = !finished;

  // 다음 단계로 넘어가는 순간: 삐삐 소리 + 그 단계로 화면 이동
  if (shownStep !== null && index > shownStep) {
    beep();
    const target = finished ? document.getElementById('tf-done') : document.getElementById('step-' + index);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  shownStep = index;
}

function toggleTimer() {
  const t = timerState();
  if (t.endAt) {
    // 일시정지: 남은 시간을 기억
    t.remaining = Math.max(0, t.endAt - Date.now());
    t.endAt = null;
  } else {
    // 시작·계속하기: 끝나는 시각을 기억
    prepareSound();
    t.endAt = Date.now() + t.remaining;
  }
  saveStore();
  keepScreenOn(Boolean(t.endAt));
  updateTimer();
}

function resetTimer() {
  if (!confirm('타이머를 처음부터 다시 할까요?')) return;
  store.timer = null;
  saveStore();
  shownStep = null;
  updateTimer();
  window.scrollTo(0, 0);
}

// ----- 단계가 바뀔 때 나는 삐삐 소리 -----
// 아이폰은 사용자가 버튼을 누른 순간에만 소리를 켤 수 있어서, 시작 버튼을 누를 때 미리 준비합니다.
let sound = null;

function prepareSound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!sound && AudioContextClass) sound = new AudioContextClass();
  if (sound && sound.state === 'suspended') sound.resume();
}

function beep() {
  if (!sound) return;
  const now = sound.currentTime;
  [0, 0.3].forEach(offset => {
    const osc = sound.createOscillator();
    const gain = sound.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2);
    osc.connect(gain);
    gain.connect(sound.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.22);
  });
}

// ----- 타이머가 도는 동안 화면이 꺼지지 않게 -----
// (지원하지 않는 폰이면 그냥 넘어가요. 화면이 꺼져도 타이머 시간은 맞습니다.)
let wakeLock = null;

async function keepScreenOn(on) {
  try {
    if (on && !wakeLock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    wakeLock = null;
  }
}

// ----- 시작 -----
async function start() {
  showScreen();
  window.addEventListener('hashchange', showScreen);

  const now = new Date();
  document.getElementById('today-date').textContent =
    now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

  document.getElementById('timer-start').addEventListener('click', toggleTimer);
  document.getElementById('timer-reset').addEventListener('click', resetTimer);
  updateTimer();
  setInterval(updateTimer, 250);
  if (timerState().endAt) keepScreenOn(true);

  try {
    const data = await loadSentences();
    const count = data.sets.length;
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const index = setIndexFor(now, count);
    const today = data.sets[index];
    renderHome(today, index, count);
    renderThree(today);
    renderTwentyFive(today, data.sets[setIndexFor(yesterday, count)]);
  } catch (err) {
    document.getElementById('today-topic').textContent = '-';
    showError(err.message);
  }
}

// 다른 앱에 갔다가 돌아왔을 때
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  // 사파리는 탭을 며칠씩 열어 두기도 해요. 날짜가 바뀌었으면 새로고침합니다.
  if (dateKey(new Date()) !== todayKey) {
    location.reload();
    return;
  }
  updateTimer();
  if (timerState().endAt) keepScreenOn(true); // 다른 앱에 가면 화면 켜짐 유지가 풀려서 다시 켬
});

// 뒤로 가기 등으로 이 페이지에 돌아왔을 때도 날짜 확인
window.addEventListener('pageshow', () => {
  if (dateKey(new Date()) !== todayKey) location.reload();
});

start();
