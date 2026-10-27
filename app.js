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

function speak(text, onEnd) {
  speechSynthesis.cancel(); // 재생 중인 다른 문장은 멈춤
  if (!englishVoice) pickVoice();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  if (englishVoice) utterance.voice = englishVoice;
  utterance.rate = 0.9; // 조금 천천히
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  speechSynthesis.speak(utterance);
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
  if (canSpeak) speechSynthesis.cancel();
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
      if (!canSpeak) {
        showError('이 브라우저에서는 듣기 기능을 쓸 수 없어요. 사파리나 크롬으로 열어 주세요.');
        return;
      }
      listenButton.classList.add('playing');
      listenLabel.textContent = '재생 중…';
      speak(sentence.en, () => {
        listenButton.classList.remove('playing');
        listenLabel.textContent = '다시 듣기';
        card.classList.add('listened');
      });
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

// ----- 시작 -----
async function start() {
  showScreen();
  window.addEventListener('hashchange', showScreen);

  const now = new Date();
  document.getElementById('today-date').textContent =
    now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

  try {
    const data = await loadSentences();
    const index = setIndexFor(now, data.sets.length);
    const today = data.sets[index];
    renderHome(today, index, data.sets.length);
    renderThree(today);
  } catch (err) {
    document.getElementById('today-topic').textContent = '-';
    showError(err.message);
  }
}

// 사파리는 탭을 며칠씩 열어 두기도 해요. 다시 열었을 때 날짜가 바뀌었으면 새로고침합니다.
function reloadIfNewDay() {
  if (document.visibilityState === 'visible' && dateKey(new Date()) !== todayKey) {
    location.reload();
  }
}
document.addEventListener('visibilitychange', reloadIfNewDay);
window.addEventListener('pageshow', reloadIfNewDay);

start();
