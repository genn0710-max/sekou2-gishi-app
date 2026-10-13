const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('【v2.10.0 総合検証テストスイート】過去5年分200問＆システム整合性');
console.log('====================================================\n');

let failedTests = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failedTests++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

// 1. JSONファイル読込検証
const dataDir = path.join(__dirname, '..', 'data');
const qPastFile = path.join(dataDir, 'questions_past5y.json');
const q1File = path.join(dataDir, 'questions_1st.json');
const versionFile = path.join(__dirname, '..', 'version.json');
const appJsFile = path.join(__dirname, '..', 'app.js');
const swJsFile = path.join(__dirname, '..', 'sw.js');
const indexHtmlFile = path.join(__dirname, '..', 'index.html');

assert(fs.existsSync(qPastFile), 'data/questions_past5y.json が存在する');
assert(fs.existsSync(q1File), 'data/questions_1st.json が存在する');

const past5y = JSON.parse(fs.readFileSync(qPastFile, 'utf8'));
const q1 = JSON.parse(fs.readFileSync(q1File, 'utf8'));
const versionJson = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
const appJs = fs.readFileSync(appJsFile, 'utf8');
const swJs = fs.readFileSync(swJsFile, 'utf8');
const indexHtml = fs.readFileSync(indexHtmlFile, 'utf8');

// 2. 過去問データ数・スキーマ検証
assert(Array.isArray(past5y) && past5y.length === 200, `過去問総数が200問である (実際: ${past5y.length}問)`);
assert(Array.isArray(q1) && q1.length === 180, `第1次検定ステップ問題が180問である (実際: ${q1.length}問)`);

const yearCounts = {};
const idSet = new Set();
let lawUpdatedCount = 0;
let tekitouCount = 0;
let futekitouCount = 0;
const ansDist = [0, 0, 0, 0];

past5y.forEach((q, idx) => {
  assert(!idSet.has(q.id), `問題ID重複なし: ${q.id}`);
  idSet.add(q.id);

  yearCounts[q.year_code] = (yearCounts[q.year_code] || 0) + 1;
  assert(q.options && q.options.length === 4, `${q.id}: 選択肢が4つある`);
  assert(q.answer >= 0 && q.answer <= 3, `${q.id}: 解答が0〜3の範囲内 (${q.answer})`);
  assert(q.explanation && q.explanation.length > 20, `${q.id}: 解説が十分詳細である`);
  assert(q.question && q.question.length > 10, `${q.id}: 問題文が存在する`);

  ansDist[q.answer]++;
  if (q.law_updated) lawUpdatedCount++;
  if (q.question.includes('適当なもの') && !q.question.includes('不適当')) {
    tekitouCount++;
  } else {
    futekitouCount++;
  }
});

['R06', 'R05', 'R04', 'R03', 'R02'].forEach(yr => {
  assert(yearCounts[yr] === 40, `${yr}年度の問題数が40問である (実際: ${yearCounts[yr]})`);
});

console.log(`\n【過去問出題統計】`);
console.log(`- 適当なもの設問: ${tekitouCount}問 (${(tekitouCount/200*100).toFixed(1)}%)`);
console.log(`- 不適当なもの設問: ${futekitouCount}問 (${(futekitouCount/200*100).toFixed(1)}%)`);
console.log(`- 解答肢分布: [1]: ${ansDist[0]}問, [2]: ${ansDist[1]}問, [3]: ${ansDist[2]}問, [4]: ${ansDist[3]}問`);
console.log(`- 法令改訂マーク設問: ${lawUpdatedCount}問\n`);

// 3. バージョン整合性チェック
assert(versionJson.version === '2.10.0', `version.json のバージョンが 2.10.0 である (${versionJson.version})`);
assert(appJs.includes('const APP_VERSION = "2.10.0";'), 'app.js の APP_VERSION が "2.10.0" である');
assert(swJs.includes("const CACHE_NAME = 'sekou2-app-v2.10.0';"), 'sw.js の CACHE_NAME が sekou2-app-v2.10.0 である');
assert(swJs.includes("'./data/questions_past5y.json'"), 'sw.js の ASSETS に questions_past5y.json が登録されている');
assert(indexHtml.includes('v2.10.0'), 'index.html に v2.10.0 が表記されている');
assert(indexHtml.includes('mockQYearBadge'), 'index.html に mockQYearBadge が存在する');
assert(indexHtml.includes('name="mockMode"'), 'index.html に mockMode 切替が存在する');
assert(indexHtml.includes('name="mockYear"'), 'index.html に mockYear 切替が存在する');

// 4. シャッフルロジック＆正解追従テスト
function knuthShuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleQuestionOptions(q) {
  const originalAnswerIdx = q.answer;
  const originalAnswerText = q.options[originalAnswerIdx];
  const indices = knuthShuffle(q.options.map((_, i) => i));
  const newOptions = indices.map(i => q.options[i]);
  const newAnswerIdx = newOptions.indexOf(originalAnswerText);
  let newExplanation = q.explanation || '';
  if (originalAnswerIdx !== newAnswerIdx && newExplanation) {
    const oldDisplayNum = originalAnswerIdx + 1;
    const newDisplayNum = newAnswerIdx + 1;
    newExplanation = newExplanation
      .replace(new RegExp(`【不適当な選択肢：${oldDisplayNum}】`, 'g'), `【不適当な選択肢：${newDisplayNum}】`)
      .replace(new RegExp(`【適当な選択肢：${oldDisplayNum}】`, 'g'), `【適当な選択肢：${newDisplayNum}】`)
      .replace(new RegExp(`【正答肢：第${oldDisplayNum}肢】`, 'g'), `【正答肢：第${newDisplayNum}肢】`);
  }
  return {
    ...q,
    options: newOptions,
    answer: newAnswerIdx,
    explanation: newExplanation
  };
}

const sampleQ = past5y[0];
let shuffleDiffersCount = 0;
for (let t = 0; t < 20; t++) {
  const shuffled = shuffleQuestionOptions(sampleQ);
  assert(shuffled.options[shuffled.answer] === sampleQ.options[sampleQ.answer], `シャッフル後も正解テキストが正答番号と完全一致している (試行${t+1})`);
  if (shuffled.answer !== sampleQ.answer) shuffleDiffersCount++;
}
assert(shuffleDiffersCount > 0, `20回中 ${shuffleDiffersCount}回 シャッフルによって位置が動的に変化した（位置暗記防止機能の健全動作）`);

console.log('\n====================================================');
if (failedTests === 0) {
  console.log('🎉 ALL TESTS PASSED! 過去5年分200問および全システムが完全稼働状態です。');
} else {
  console.error(`⚠️ FAILED: ${failedTests} 件のテストが失敗しました。要修正！`);
  process.exit(1);
}
console.log('====================================================');
