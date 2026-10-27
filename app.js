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
    document.getElementById('today-topic').textContent = today.title;
    document.getElementById('today-set').textContent = '세트 ' + (index + 1) + '/' + data.sets.length;
  } catch (err) {
    document.getElementById('today-topic').textContent = '-';
    showError(err.message);
  }
}

start();
