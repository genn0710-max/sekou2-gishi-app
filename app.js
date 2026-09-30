/**
 * 2級建築施工管理技士 絶対合格プログラム
 * フロントエンド コア アプリケーション
 */

// グローバルステート
const AppState = {
  categories: [],
  questions1st: [],
  questions2nd: [],
  numbersCards: [],
  essayTemplates: {},
  userState: {
    history: {},       // questionId -> { answered: bool, correct: bool, lastAnswer: int }
    bookmarks: [],
    essayDraft: {
      theme: 'quality',
      projName: '',
      projRole: '',
      projStructure: '',
      projSite: '',
      problem: '',
      consideration: '',
      action: '',
      lastScore: null,
      lastRank: null
    },
    masteredNumbers: [],
    examRecords: []
  },
  
  // 模擬試験状態
  mockExam: {
    isRunning: false,
    questions: [],
    currentIndex: 0,
    answers: {},       // qIndex -> selectedOption
    flags: {},         // qIndex -> bool
    timer: null,
    totalSeconds: 0,
    remainingSeconds: 0
  },

  // 分野別ドリル状態
  drill: {
    questions: [],
    currentIndex: 0,
    selectedCategory: 'all'
  },

  // フラッシュカード状態
  flashcard: {
    currentIndex: 0,
    isFlipped: false
  }
};

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initCountdown();
  initNav();
  await loadAllData();
  renderDashboard();
  initMockExamEvents();
  initDrillEvents();
  initEssayEvents();
  initFlashcardEvents();
  initManageEvents();
});

// テーマ初期化
function initTheme() {
  const savedTheme = localStorage.getItem('sekou_theme') || 'theme-dark';
  document.body.className = savedTheme;
  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (document.body.classList.contains('theme-dark')) {
        document.body.className = 'theme-light';
        localStorage.setItem('sekou_theme', 'theme-light');
      } else {
        document.body.className = 'theme-dark';
        localStorage.setItem('sekou_theme', 'theme-dark');
      }
    });
  }
}

// 試験日カウントダウン（直近の11月中旬検定日に設定）
function initCountdown() {
  const now = new Date();
  let targetYear = now.getFullYear();
  // 建築施工管理技士 後期検定日は一般に11月の第2または第3日曜日
  let examDate = new Date(targetYear, 10, 15); // 11月15日目安
  if (now > examDate) {
    examDate = new Date(targetYear + 1, 10, 15);
  }
  const diffTime = examDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const badge = document.getElementById('countdownDays');
  if (badge) badge.textContent = Math.max(0, diffDays);
}

// ナビゲーション切り替え
function initNav() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      switchTab(target);
    });
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === `tab-${tabId}`);
  });

  // タブ切り替えごとのレンダリング
  if (tabId === 'dashboard') renderDashboard();
  if (tabId === 'drill') startDrill();
  if (tabId === 'practical2nd') renderPractical2nd();
  if (tabId === 'flashcards') renderFlashcard();
}

// APIデータ一括ロード（GitHub Pages静的ホスティング＆ローカルサーバー両対応）
async function loadAllData() {
  const fetchWithFallback = async (apiPath, staticPath) => {
    try {
      const res = await fetch(apiPath);
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) return await res.json();
      }
    } catch (e) {
      // サーバー未起動または静的環境
    }
    const resStatic = await fetch(staticPath);
    return await resStatic.json();
  };

  try {
    const [cats, q1, q2, nums, essays] = await Promise.all([
      fetchWithFallback('/api/categories', './data/categories.json'),
      fetchWithFallback('/api/questions/1st', './data/questions_1st.json'),
      fetchWithFallback('/api/questions/2nd', './data/questions_2nd.json'),
      fetchWithFallback('/api/numbers', './data/numbers_card.json'),
      fetchWithFallback('/api/essay/templates', './data/essay_templates.json')
    ]);

    AppState.categories = cats || [];
    AppState.questions1st = q1 || [];
    AppState.questions2nd = q2 || [];
    AppState.numbersCards = nums || [];
    AppState.essayTemplates = essays || {};

    // ユーザー追加のカスタム問題があれば結合
    const customQuestions = JSON.parse(localStorage.getItem('sekou_custom_q1') || '[]');
    if (customQuestions.length > 0) {
      const existingIds = new Set(AppState.questions1st.map(q => q.id));
      customQuestions.forEach(cq => {
        if (!existingIds.has(cq.id)) AppState.questions1st.push(cq);
      });
    }

    // ローカルストレージと統合
    const localUser = localStorage.getItem('sekou_user_state');
    if (localUser) {
      try {
        AppState.userState = { ...AppState.userState, ...JSON.parse(localUser) };
      } catch (e) {
        console.error(e);
      }
    }
  } catch (err) {
    console.warn('データロードフォールバック完了:', err);
  }
}

// ユーザー状態の保存
async function saveUserState() {
  localStorage.setItem('sekou_user_state', JSON.stringify(AppState.userState));
  try {
    await fetch('/api/user/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(AppState.userState)
    });
  } catch (e) {
    // オフラインまたは静的環境時はlocalStorageのみで問題なく保持
  }
}

// ==========================================================================
// 1. ダッシュボード
// ==========================================================================
function renderDashboard() {
  const total1st = AppState.questions1st.length;
  const history = AppState.userState.history || {};
  const answeredKeys = Object.keys(history);
  const totalAnswered = answeredKeys.length;
  const correctCount = answeredKeys.filter(k => history[k].correct).length;

  const progressRate = total1st > 0 ? Math.round((totalAnswered / total1st) * 100) : 0;
  const accuracyRate = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

  // 進捗UI更新
  const progElem = document.getElementById('dash1stProgress');
  const progBar = document.getElementById('dash1stProgressBar');
  const countElem = document.getElementById('dash1stCount');
  if (progElem) progElem.textContent = `${progressRate}%`;
  if (progBar) progBar.style.width = `${progressRate}%`;
  if (countElem) countElem.textContent = `${totalAnswered} / ${total1st}問完了`;

  // 正答率
  const accElem = document.getElementById('dashAccuracy');
  if (accElem) accElem.textContent = totalAnswered > 0 ? `${accuracyRate}%` : '--%';

  // 経験記述
  const draft = AppState.userState.essayDraft;
  const rankElem = document.getElementById('dashEssayRank');
  const scoreElem = document.getElementById('dashEssayScore');
  if (rankElem && draft.lastRank) {
    rankElem.textContent = draft.lastRank;
    if (scoreElem) scoreElem.textContent = `スコア: ${draft.lastScore || 0} / 100点`;
  }

  // 暗記カード進捗
  const mastered = AppState.userState.masteredNumbers || [];
  const totalNums = AppState.numbersCards.length;
  const numRate = totalNums > 0 ? Math.round((mastered.length / totalNums) * 100) : 0;
  const numProgElem = document.getElementById('dashNumberProgress');
  const numCountElem = document.getElementById('dashNumberCount');
  if (numProgElem) numProgElem.textContent = `${numRate}%`;
  if (numCountElem) numCountElem.textContent = `${mastered.length} / ${totalNums}項目習得`;

  // 分野別進捗リスト
  const catListElem = document.getElementById('categoryStatusList');
  if (catListElem) {
    const cats1st = AppState.categories.filter(c => c.section === '1st');
    catListElem.innerHTML = cats1st.map(c => {
      const qInCat = AppState.questions1st.filter(q => q.category === c.id);
      const answeredInCat = qInCat.filter(q => history[q.id]);
      const catRate = qInCat.length > 0 ? Math.round((answeredInCat.length / qInCat.length) * 100) : 0;

      return `
        <div class="cat-status-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-weight: 700; font-size: 0.95rem;">${c.icon} ${c.name}</span>
            <span style="font-weight: 700; color: ${c.color}; font-size: 0.9rem;">${catRate}%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${catRate}%; background-color: ${c.color};"></div>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-sub); margin-top: 6px;">
            ${answeredInCat.length} / ${qInCat.length}問 完了
          </div>
        </div>
      `;
    }).join('');
  }
}

// ==========================================================================
// 2. 本番模擬試験
// ==========================================================================
function initMockExamEvents() {
  const startBtn = document.getElementById('startMockExamBtn');
  if (startBtn) startBtn.addEventListener('click', startMockExam);

  const prevBtn = document.getElementById('mockPrevBtn');
  if (prevBtn) prevBtn.addEventListener('click', () => changeMockQuestion(-1));

  const nextBtn = document.getElementById('mockNextBtn');
  if (nextBtn) nextBtn.addEventListener('click', () => changeMockQuestion(1));

  const flagBtn = document.getElementById('mockFlagBtn');
  if (flagBtn) flagBtn.addEventListener('click', toggleMockFlag);

  const finishEarlyBtn = document.getElementById('finishMockExamEarlyBtn');
  if (finishEarlyBtn) {
    finishEarlyBtn.addEventListener('click', () => {
      if (confirm('試験を終了して採点しますか？')) finishMockExam();
    });
  }

  const reviewBtn = document.getElementById('reviewAllAnswersBtn');
  if (reviewBtn) reviewBtn.addEventListener('click', toggleReviewList);
}

function startMockExam() {
  const countVal = document.querySelector('input[name="mockCount"]:checked').value;
  const timerVal = parseInt(document.querySelector('input[name="mockTimer"]:checked').value, 10);

  // 問題をシャッフル
  let pool = [...AppState.questions1st].sort(() => Math.random() - 0.5);
  let total = pool.length;
  if (countVal === '10') total = Math.min(10, pool.length);
  if (countVal === '15') total = Math.min(15, pool.length);

  AppState.mockExam = {
    isRunning: true,
    questions: pool.slice(0, total),
    currentIndex: 0,
    answers: {},
    flags: {},
    timer: null,
    totalSeconds: timerVal * 60,
    remainingSeconds: timerVal * 60
  };

  document.getElementById('mockExamSetup').style.display = 'none';
  document.getElementById('mockExamResult').style.display = 'none';
  document.getElementById('mockExamRunning').style.display = 'block';

  // タイマー開始
  if (timerVal > 0) {
    updateTimerDisplay();
    AppState.mockExam.timer = setInterval(() => {
      AppState.mockExam.remainingSeconds--;
      updateTimerDisplay();
      if (AppState.mockExam.remainingSeconds <= 0) {
        clearInterval(AppState.mockExam.timer);
        alert('⏰ 制限時間になりました！採点を行います。');
        finishMockExam();
      }
    }, 1000);
  } else {
    document.getElementById('mockTimerDisplay').textContent = '⏱️ 制限なし';
  }

  renderMockPalette();
  renderMockCurrentQuestion();
}

function updateTimerDisplay() {
  const rem = AppState.mockExam.remainingSeconds;
  const m = Math.floor(rem / 60);
  const s = rem % 60;
  const display = document.getElementById('mockTimerDisplay');
  if (display) {
    display.innerHTML = `⏱️ <span id="timerMinutes">${String(m).padStart(2, '0')}</span>:<span id="timerSeconds">${String(s).padStart(2, '0')}</span>`;
    if (rem < 180) display.style.color = 'var(--accent-red)';
    else display.style.color = 'var(--accent-gold)';
  }
}

function renderMockPalette() {
  const container = document.getElementById('questionPalette');
  if (!container) return;
  const total = AppState.mockExam.questions.length;

  container.innerHTML = AppState.mockExam.questions.map((q, idx) => {
    const isCurrent = idx === AppState.mockExam.currentIndex;
    const isAnswered = AppState.mockExam.answers[idx] !== undefined;
    const isFlagged = !!AppState.mockExam.flags[idx];

    let classes = ['palette-btn'];
    if (isCurrent) classes.push('current');
    if (isAnswered) classes.push('answered');
    if (isFlagged) classes.push('flagged');

    return `<button class="${classes.join(' ')}" onclick="jumpToMockQuestion(${idx})">${idx + 1}</button>`;
  }).join('');
}

function renderMockCurrentQuestion() {
  const exam = AppState.mockExam;
  const q = exam.questions[exam.currentIndex];
  if (!q) return;

  document.getElementById('currentQuestionNum').textContent = exam.currentIndex + 1;
  document.getElementById('totalQuestionNum').textContent = exam.questions.length;

  const catObj = AppState.categories.find(c => c.id === q.category) || {};
  document.getElementById('mockQCategory').textContent = catObj.name || q.category;
  document.getElementById('mockQSubcategory').textContent = q.subcategory || '';
  document.getElementById('mockQText').textContent = q.question;

  // フラグ状態
  const flagBtn = document.getElementById('mockFlagBtn');
  flagBtn.classList.toggle('active', !!exam.flags[exam.currentIndex]);

  // 選択肢
  const optContainer = document.getElementById('mockQOptions');
  const selected = exam.answers[exam.currentIndex];

  optContainer.innerHTML = q.options.map((opt, optIdx) => {
    const isSel = selected === optIdx;
    return `
      <div class="option-item ${isSel ? 'selected' : ''}" onclick="selectMockAnswer(${optIdx})">
        <span class="opt-index">${optIdx + 1}</span>
        <div style="flex: 1;">${opt}</div>
      </div>
    `;
  }).join('');

  // 前へ／次へボタン制御
  document.getElementById('mockPrevBtn').disabled = exam.currentIndex === 0;
  const nextBtn = document.getElementById('mockNextBtn');
  if (exam.currentIndex === exam.questions.length - 1) {
    nextBtn.textContent = '全問解答完了・採点へ';
    nextBtn.className = 'btn btn-gold';
  } else {
    nextBtn.textContent = '次の問題 →';
    nextBtn.className = 'btn btn-primary';
  }

  renderMockPalette();
}

function selectMockAnswer(optIndex) {
  AppState.mockExam.answers[AppState.mockExam.currentIndex] = optIndex;
  renderMockCurrentQuestion();
}

function toggleMockFlag() {
  const cur = AppState.mockExam.currentIndex;
  AppState.mockExam.flags[cur] = !AppState.mockExam.flags[cur];
  renderMockCurrentQuestion();
}

function jumpToMockQuestion(idx) {
  AppState.mockExam.currentIndex = idx;
  renderMockCurrentQuestion();
}

function changeMockQuestion(delta) {
  const exam = AppState.mockExam;
  const target = exam.currentIndex + delta;
  if (target >= 0 && target < exam.questions.length) {
    exam.currentIndex = target;
    renderMockCurrentQuestion();
  } else if (target >= exam.questions.length) {
    // 最終問題で「次へ」を押した時
    const answeredCount = Object.keys(exam.answers).length;
    const unanswered = exam.questions.length - answeredCount;
    if (unanswered > 0) {
      if (confirm(`未解答の問題が ${unanswered} 問あります。試験を終了して採点しますか？`)) {
        finishMockExam();
      }
    } else {
      finishMockExam();
    }
  }
}

function finishMockExam() {
  const exam = AppState.mockExam;
  if (exam.timer) clearInterval(exam.timer);
  exam.isRunning = false;

  let correctCount = 0;
  exam.questions.forEach((q, idx) => {
    const userAns = exam.answers[idx];
    const isCorrect = userAns === q.answer;
    if (isCorrect) correctCount++;

    // ユーザー履歴に記録
    if (userAns !== undefined) {
      AppState.userState.history[q.id] = {
        answered: true,
        correct: isCorrect,
        lastAnswer: userAns
      };
    }
  });

  saveUserState();

  const total = exam.questions.length;
  const scorePercent = Math.round((correctCount / total) * 100);
  const isPassed = scorePercent >= 60; // 施工管理技士の合格基準は60%以上

  document.getElementById('mockExamRunning').style.display = 'none';
  document.getElementById('mockExamResult').style.display = 'block';

  const badge = document.getElementById('resultGradeBadge');
  badge.className = `result-badge ${isPassed ? 'pass' : 'fail'}`;
  badge.textContent = isPassed ? '🏆 合格基準クリア！' : '不合格（再挑戦）';

  document.getElementById('resultTitle').textContent = isPassed ? '合格水準に到達しています！' : '惜しい！弱点を復習しましょう';
  document.getElementById('resultScoreNum').textContent = scorePercent;
  document.getElementById('resultSummaryText').textContent = `${total}問中 ${correctCount}問正解（合格ライン: 60%）`;

  // レビューリスト生成
  const reviewList = document.getElementById('mockReviewList');
  reviewList.innerHTML = exam.questions.map((q, idx) => {
    const userAns = exam.answers[idx];
    const isCorrect = userAns === q.answer;
    return `
      <div class="review-item ${isCorrect ? 'review-correct' : 'review-incorrect'}">
        <div style="font-weight: 700; margin-bottom: 6px;">
          第${idx + 1}問: ${isCorrect ? '✅ 正解' : '❌ 不正解'}
        </div>
        <div style="margin-bottom: 8px;">${q.question}</div>
        <div style="font-size: 0.85rem; color: var(--text-sub); margin-bottom: 8px;">
          あなたの解答: ${userAns !== undefined ? `${userAns + 1}. ${q.options[userAns]}` : '未解答'} <br>
          正解: <strong style="color: var(--accent-green);">${q.answer + 1}. ${q.options[q.answer]}</strong>
        </div>
        <div style="font-size: 0.85rem; background: var(--bg-surface); padding: 10px; border-radius: 4px; white-space: pre-wrap;">${q.explanation}</div>
      </div>
    `;
  }).join('');
}

function startNewMockExam() {
  document.getElementById('mockExamResult').style.display = 'none';
  document.getElementById('mockExamSetup').style.display = 'block';
}

function toggleReviewList() {
  const reviewList = document.getElementById('mockReviewList');
  if (reviewList.style.display === 'none' || reviewList.style.display === '') {
    reviewList.style.display = 'flex';
  } else {
    reviewList.style.display = 'none';
  }
}

// ==========================================================================
// 3. 分野別特訓ドリル（一問一答）
// ==========================================================================
function initDrillEvents() {
  const filter = document.getElementById('drillCategoryFilter');
  if (filter) {
    filter.addEventListener('change', () => {
      AppState.drill.selectedCategory = filter.value;
      startDrill();
    });
  }

  const nextBtn = document.getElementById('drillNextBtn');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      AppState.drill.currentIndex++;
      renderDrillQuestion();
    });
  }
}

function startDrill() {
  let pool = [...AppState.questions1st];
  const cat = AppState.drill.selectedCategory;

  if (cat === 'weak') {
    // 間違えた問題だけ
    const hist = AppState.userState.history;
    pool = pool.filter(q => hist[q.id] && !hist[q.id].correct);
    if (pool.length === 0) {
      alert('現在、間違えた問題の履歴はありません！全問正解または未解答です。');
      pool = [...AppState.questions1st];
    }
  } else if (cat !== 'all') {
    pool = pool.filter(q => q.category === cat);
  }

  AppState.drill.questions = pool.sort(() => Math.random() - 0.5);
  AppState.drill.currentIndex = 0;
  renderDrillQuestion();
}

function renderDrillQuestion() {
  const drill = AppState.drill;
  const expBox = document.getElementById('drillExplanationBox');
  expBox.style.display = 'none';

  if (drill.currentIndex >= drill.questions.length) {
    alert('🎉 この分野の全問題の特訓が完了しました！');
    drill.currentIndex = 0;
  }

  const q = drill.questions[drill.currentIndex];
  if (!q) return;

  const catObj = AppState.categories.find(c => c.id === q.category) || {};
  document.getElementById('drillCategoryBadge').textContent = catObj.name || q.category;
  document.getElementById('drillSubcategoryBadge').textContent = q.subcategory || '';
  document.getElementById('drillCounter').textContent = `${drill.currentIndex + 1} / ${drill.questions.length}問`;
  document.getElementById('drillQuestionText').textContent = q.question;

  const optContainer = document.getElementById('drillOptions');
  optContainer.innerHTML = q.options.map((opt, idx) => {
    return `
      <div class="option-item" onclick="answerDrillQuestion(${idx})">
        <span class="opt-index">${idx + 1}</span>
        <div style="flex: 1;">${opt}</div>
      </div>
    `;
  }).join('');
}

function answerDrillQuestion(selectedIdx) {
  const drill = AppState.drill;
  const q = drill.questions[drill.currentIndex];
  const isCorrect = selectedIdx === q.answer;

  // 選択肢UIハイライト
  const items = document.querySelectorAll('#drillOptions .option-item');
  items.forEach((item, idx) => {
    item.onclick = null; // クリック無効化
    if (idx === q.answer) {
      item.style.borderColor = 'var(--accent-green)';
      item.style.backgroundColor = 'var(--accent-green-bg)';
    } else if (idx === selectedIdx && !isCorrect) {
      item.style.borderColor = 'var(--accent-red)';
      item.style.backgroundColor = 'var(--accent-red-bg)';
    }
  });

  // 履歴更新
  AppState.userState.history[q.id] = {
    answered: true,
    correct: isCorrect,
    lastAnswer: selectedIdx
  };
  saveUserState();

  // 解説ボックス表示
  const expBox = document.getElementById('drillExplanationBox');
  const expHeader = document.getElementById('drillExpHeader');
  const expContent = document.getElementById('drillExpContent');

  expHeader.innerHTML = isCorrect ? '<span style="color: var(--accent-green);">✅ 正解！</span>' : '<span style="color: var(--accent-red);">❌ 不正解...</span>';
  expContent.textContent = q.explanation;
  expBox.style.display = 'block';
}

// ==========================================================================
// 4. 第2次検定：経験記述マスター＆リアルタイムAI添削
// ==========================================================================
function initEssayEvents() {
  const themeSelect = document.getElementById('essayThemeSelect');
  if (themeSelect) {
    themeSelect.addEventListener('change', () => {
      AppState.userState.essayDraft.theme = themeSelect.value;
      renderEssaySample();
    });
  }

  // 文字数カウントのバインド
  const bindCount = (id, countId) => {
    const el = document.getElementById(id);
    const countEl = document.getElementById(countId);
    if (el && countEl) {
      el.addEventListener('input', () => {
        countEl.textContent = `${el.value.length} 文字`;
      });
    }
  };
  bindCount('essayProblem', 'countProblem');
  bindCount('essayConsideration', 'countConsideration');
  bindCount('essayAction', 'countAction');

  // 下書き保存ボタン
  const saveBtn = document.getElementById('saveDraftBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      saveEssayDraft();
      alert('💾 経験記述の下書きを保存しました。');
    });
  }

  // 模範解答コピーボタン
  const copyBtn = document.getElementById('copySampleBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', copySampleToEditor);
  }

  // リアルタイム添削ボタン
  const analyzeBtn = document.getElementById('analyzeEssayBtn');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', analyzeEssay);
  }

  // 初期ロード時
  loadSavedEssayDraft();
  renderEssaySample();
}

function renderEssaySample() {
  const theme = document.getElementById('essayThemeSelect').value;
  const themes = AppState.essayTemplates.themes || [];
  const currentTheme = themes.find(t => t.id === theme) || themes[0];

  const sampleContainer = document.getElementById('sampleContent');
  if (sampleContainer && currentTheme) {
    const s = currentTheme.sample;
    sampleContainer.innerHTML = `
      <div class="sample-block">
        <span class="sample-label">【工事概要例】</span>
        <div class="sample-text">${s.project_name} / ${s.structure} / 立場: ${s.role}</div>
      </div>
      <div class="sample-block">
        <span class="sample-label">【設問1：課題・重要項目】</span>
        <div class="sample-text">${s.problem}</div>
      </div>
      <div class="sample-block">
        <span class="sample-label">【設問2：検討事項・協議】</span>
        <div class="sample-text">${s.consideration}</div>
      </div>
      <div class="sample-block">
        <span class="sample-label">【設問3：具体的措置と結果】</span>
        <div class="sample-text">${s.action}</div>
      </div>
    `;
  }

  // NGワード一覧
  const ngContainer = document.getElementById('ngWordsList');
  if (ngContainer && AppState.essayTemplates.ng_words) {
    ngContainer.innerHTML = AppState.essayTemplates.ng_words.map(item => `
      <div class="ng-item">
        <span class="ng-word">× 「${item.word}」</span>
        <span class="ng-reason">${item.reason}</span>
      </div>
    `).join('');
  }
}

function copySampleToEditor() {
  const theme = document.getElementById('essayThemeSelect').value;
  const themes = AppState.essayTemplates.themes || [];
  const currentTheme = themes.find(t => t.id === theme);
  if (!currentTheme) return;

  const s = currentTheme.sample;
  document.getElementById('projName').value = s.project_name;
  document.getElementById('projRole').value = s.role;
  document.getElementById('projStructure').value = s.structure;
  document.getElementById('projSite').value = s.site;
  document.getElementById('essayProblem').value = s.problem;
  document.getElementById('essayConsideration').value = s.consideration;
  document.getElementById('essayAction').value = s.action;

  // カウント更新
  document.getElementById('countProblem').textContent = `${s.problem.length} 文字`;
  document.getElementById('countConsideration').textContent = `${s.consideration.length} 文字`;
  document.getElementById('countAction').textContent = `${s.action.length} 文字`;

  alert('模範解答を入力欄にコピーしました。ここから自分の現場に合わせて加筆修正してみましょう！');
}

function saveEssayDraft() {
  AppState.userState.essayDraft = {
    theme: document.getElementById('essayThemeSelect').value,
    projName: document.getElementById('projName').value,
    projRole: document.getElementById('projRole').value,
    projStructure: document.getElementById('projStructure').value,
    projSite: document.getElementById('projSite').value,
    problem: document.getElementById('essayProblem').value,
    consideration: document.getElementById('essayConsideration').value,
    action: document.getElementById('essayAction').value,
    lastScore: AppState.userState.essayDraft.lastScore,
    lastRank: AppState.userState.essayDraft.lastRank
  };
  saveUserState();
}

function loadSavedEssayDraft() {
  const d = AppState.userState.essayDraft;
  if (!d) return;

  if (d.theme) document.getElementById('essayThemeSelect').value = d.theme;
  if (d.projName) document.getElementById('projName').value = d.projName;
  if (d.projRole) document.getElementById('projRole').value = d.projRole;
  if (d.projStructure) document.getElementById('projStructure').value = d.projStructure;
  if (d.projSite) document.getElementById('projSite').value = d.projSite;
  if (d.problem) {
    document.getElementById('essayProblem').value = d.problem;
    document.getElementById('countProblem').textContent = `${d.problem.length} 文字`;
  }
  if (d.consideration) {
    document.getElementById('essayConsideration').value = d.consideration;
    document.getElementById('countConsideration').textContent = `${d.consideration.length} 文字`;
  }
  if (d.action) {
    document.getElementById('essayAction').value = d.action;
    document.getElementById('countAction').textContent = `${d.action.length} 文字`;
  }
}

async function analyzeEssay() {
  saveEssayDraft();
  const d = AppState.userState.essayDraft;

  if (!d.problem && !d.consideration && !d.action) {
    alert('設問の文章を入力してください（または左上の「模範解答をコピー」してお試しください）。');
    return;
  }

  let result = null;
  // 1. サーバーAPIを試行
  try {
    const res = await fetch('/api/essay/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d)
    });
    if (res.ok) {
      result = await res.json();
    }
  } catch (e) {
    // サーバーなし（GitHub Pages / オフライン）
  }

  // 2. サーバーがない場合は内蔵エンジンで自己診断
  if (!result || !result.score) {
    result = runClientEssayDiagnosis(d);
  }

  // 結果表示
  const panel = document.getElementById('evaluationPanel');
  panel.style.display = 'block';

  document.getElementById('evalRankBadge').textContent = `判定：${result.rank}`;
  document.getElementById('evalScoreNumber').textContent = result.score;
  document.getElementById('evalScoreDesc').textContent = `総文字数: ${result.char_counts.total}字 | ${result.score >= 70 ? '合格ラインを突破しています！' : '改善点を反映してさらに高得点を目指しましょう'}`;

  document.getElementById('scoreNg').textContent = `${result.scores.ng_free} / 25点`;
  document.getElementById('scoreNumbers').textContent = `${result.scores.numbers} / 25点`;
  document.getElementById('scoreLogic').textContent = `${result.scores.logic_structure} / 25点`;
  document.getElementById('scoreVolume').textContent = `${result.scores.volume} / 25点`;

  const fbList = document.getElementById('evalFeedbackList');
  fbList.innerHTML = result.feedback.map(f => `<div style="font-size: 0.9rem; line-height: 1.5;">${f}</div>`).join('');

  // ステート更新
  AppState.userState.essayDraft.lastScore = result.score;
  AppState.userState.essayDraft.lastRank = result.rank;
  saveUserState();
  renderDashboard();

  // スクロール
  panel.scrollIntoView({ behavior: 'smooth' });
}

// クライアント側自己診断エンジン（サーバー不要・完全オフライン対応）
function runClientEssayDiagnosis(d) {
  const problem = d.problem || "";
  const consideration = d.consideration || "";
  const action = d.action || "";
  const combined = `${problem}\n${consideration}\n${action}`;

  const ngWords = AppState.essayTemplates.ng_words || [];
  const foundNg = ngWords.filter(ng => combined.includes(ng.word));

  const hasNumbers = /\d+(?:℃|分|日|時間|m|cm|mm|%|N|kg|㎡)/.test(combined);

  const lenP = problem.trim().length;
  const lenC = consideration.trim().length;
  const lenA = action.trim().length;

  const scores = {
    ng_free: foundNg.length === 0 ? 25 : Math.max(0, 25 - foundNg.length * 10),
    numbers: hasNumbers ? 25 : 10,
    logic_structure: (lenP >= 30 && lenC >= 50 && lenA >= 80) ? 25 : 15,
    volume: (80 <= (lenP + lenC + lenA) && (lenP + lenC + lenA) <= 800) ? 25 : 15
  };
  const totalScore = scores.ng_free + scores.numbers + scores.logic_structure + scores.volume;

  const feedback = [];
  if (foundNg.length > 0) {
    const wordsStr = foundNg.map(n => `「${n.word}」`).join('、');
    feedback.push(`⚠️ 抽象的表現 ${wordsStr} が見られます。客観的な数値や具体的な作業手順に置き換えましょう。`);
  } else {
    feedback.push("✅ 抽象的なNG表現はなく、引き締まった記述です。");
  }

  if (hasNumbers) {
    feedback.push("✅ 具体的な管理数値（寸法・時間・温度等）が盛り込まれており、説得力があります。");
  } else {
    feedback.push("💡 具体的な数値基準（〇cm以上、〇℃以下、〇時間以内など）を追加するとさらに高得点になります。");
  }

  if (lenA < 80) {
    feedback.push("💡 「現場で実施した処置・結果」をもう少し具体的に（1.〜 2.〜 などの箇条書き）記述すると加点されます。");
  } else {
    feedback.push("✅ 措置と得られた結果の記述量が充実しています。");
  }

  const rank = totalScore >= 85 ? "S (絶対合格圏)" : (totalScore >= 70 ? "A (合格圏内)" : (totalScore >= 50 ? "B (あと一歩)" : "C (要改善)"));

  return {
    score: totalScore,
    rank: rank,
    scores: scores,
    char_counts: { problem: lenP, consideration: lenC, action: lenA, total: lenP + lenC + lenA },
    ng_words_found: foundNg,
    has_numbers: hasNumbers,
    feedback: feedback
  };
}

// ==========================================================================
// 5. 第2次検定：実地記述・工程表特訓
// ==========================================================================
function renderPractical2nd() {
  const container = document.getElementById('practicalQuestionsList');
  if (!container) return;

  container.innerHTML = AppState.questions2nd.map((q, idx) => {
    return `
      <div class="practical-card">
        <div class="practical-q-header">
          <span class="badge">${q.theme}</span>
          <span class="badge badge-sub">${q.subcategory}</span>
          <span style="margin-left: auto; font-size: 0.8rem; color: var(--text-sub); font-weight: 700;">第${idx + 1}問</span>
        </div>
        <div style="font-weight: 700; font-size: 1.05rem; line-height: 1.7; margin-bottom: 16px; white-space: pre-wrap;">${q.question}</div>
        
        <div style="margin-bottom: 12px;">
          <textarea class="form-textarea" rows="3" placeholder="あなたの記述・計算メモ（任意入力）"></textarea>
        </div>

        <button class="btn btn-outline btn-sm" onclick="togglePracticalAnswer(${idx})">
          👁️ 模範解答・採点基準を表示
        </button>

        <div class="practical-answer-box" id="practicalAnsBox-${idx}">
          <div style="font-weight: 700; color: var(--accent-green); margin-bottom: 8px;">【模範解答】</div>
          <div style="white-space: pre-wrap; margin-bottom: 12px; font-size: 0.95rem; line-height: 1.7;">${q.model_answers.join('\n\n')}</div>
          
          <div style="font-weight: 700; color: var(--accent-gold); margin-bottom: 4px; font-size: 0.85rem;">【必須キーワード】</div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px;">
            ${q.keywords.map(k => `<span class="badge badge-sub">${k}</span>`).join('')}
          </div>

          <div style="font-size: 0.8rem; color: var(--text-sub);">
            <strong>採点基準：</strong> ${q.scoring_points}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function togglePracticalAnswer(idx) {
  const box = document.getElementById(`practicalAnsBox-${idx}`);
  if (box.style.display === 'none' || box.style.display === '') {
    box.style.display = 'block';
  } else {
    box.style.display = 'none';
  }
}

// ==========================================================================
// 6. 重要数値フラッシュカード
// ==========================================================================
function initFlashcardEvents() {
  const prevBtn = document.getElementById('prevCardBtn');
  if (prevBtn) prevBtn.addEventListener('click', () => changeFlashcard(-1));

  const nextBtn = document.getElementById('nextCardBtn');
  if (nextBtn) nextBtn.addEventListener('click', () => changeFlashcard(1));

  const flipBtn = document.getElementById('flipCardBtn');
  if (flipBtn) flipBtn.addEventListener('click', flipCurrentCard);

  const masterBtn = document.getElementById('masterCardBtn');
  if (masterBtn) masterBtn.addEventListener('click', toggleMasterCurrentCard);
}

function renderFlashcard() {
  const nums = AppState.numbersCards;
  const idx = AppState.flashcard.currentIndex;
  const card = nums[idx];
  if (!card) return;

  // 反転状態リセット
  const cardElem = document.getElementById('mainFlashcard');
  cardElem.classList.remove('flipped');
  AppState.flashcard.isFlipped = false;

  // 表面
  document.getElementById('cardCategory').textContent = card.category;
  document.getElementById('cardTitle').textContent = card.title;
  document.getElementById('cardQuestion').textContent = card.question;

  // 裏面
  document.getElementById('cardAnswer').textContent = card.answer;
  document.getElementById('cardPoint').textContent = `💡 ${card.point}`;

  // 習得状況
  const mastered = AppState.userState.masteredNumbers || [];
  const isMastered = mastered.includes(card.id);
  const masterBtn = document.getElementById('masterCardBtn');
  if (isMastered) {
    masterBtn.textContent = '🌟 習得済み！（解除する）';
    masterBtn.className = 'btn btn-outline';
  } else {
    masterBtn.textContent = '✅ 覚えた！（習得済みにする）';
    masterBtn.className = 'btn btn-success';
  }

  document.getElementById('flashcardMasteredCount').textContent = mastered.length;
  document.getElementById('flashcardTotalCount').textContent = nums.length;

  // 一覧テーブル
  const table = document.getElementById('cardsTable');
  if (table) {
    table.innerHTML = nums.map((c, i) => {
      const ok = mastered.includes(c.id);
      return `
        <div class="card-row-item" style="cursor: pointer;" onclick="jumpToFlashcard(${i})">
          <div>
            <span class="badge" style="margin-right: 8px;">${c.category}</span>
            <strong>${c.title}</strong>
          </div>
          <div>${ok ? '✅ <span style="color: var(--accent-green); font-weight: 700;">習得</span>' : '<span style="color: var(--text-muted);">未習得</span>'}</div>
        </div>
      `;
    }).join('');
  }
}

function flipCurrentCard() {
  const cardElem = document.getElementById('mainFlashcard');
  cardElem.classList.toggle('flipped');
  AppState.flashcard.isFlipped = cardElem.classList.contains('flipped');
}

function changeFlashcard(delta) {
  const total = AppState.numbersCards.length;
  AppState.flashcard.currentIndex = (AppState.flashcard.currentIndex + delta + total) % total;
  renderFlashcard();
}

function jumpToFlashcard(index) {
  AppState.flashcard.currentIndex = index;
  renderFlashcard();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMasterCurrentCard() {
  const card = AppState.numbersCards[AppState.flashcard.currentIndex];
  if (!card) return;

  let mastered = AppState.userState.masteredNumbers || [];
  if (mastered.includes(card.id)) {
    mastered = mastered.filter(id => id !== card.id);
  } else {
    mastered.push(card.id);
  }
  AppState.userState.masteredNumbers = mastered;
  saveUserState();
  renderFlashcard();
  renderDashboard();
}

// ==========================================================================
// 7. 自作問題の追加
// ==========================================================================
function initManageEvents() {
  const form = document.getElementById('addQuestionForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const category = document.getElementById('newQCategory').value;
      const subcategory = document.getElementById('newQSubcat').value;
      const question = document.getElementById('newQText').value;
      const explanation = document.getElementById('newQExp').value;
      const correctIdx = parseInt(document.querySelector('input[name="newCorrectOption"]:checked').value, 10);

      const options = [
        document.getElementById('opt0').value,
        document.getElementById('opt1').value,
        document.getElementById('opt2').value,
        document.getElementById('opt3').value
      ];

      const newQ = {
        category,
        subcategory,
        question,
        options,
        answer: correctIdx,
        explanation
      };

      try {
        const res = await fetch('/api/questions/1st', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newQ)
        });
        if (res.ok) {
          const data = await res.json();
          alert('✅ 新規問題をサーバーに登録しました！模擬試験および特訓ドリルに追加されました。');
          form.reset();
          await loadAllData();
          renderDashboard();
          return;
        }
      } catch (err) {
        // 静的環境 / オフライン
      }

      // ローカルストレージに保存（GitHub Pages対応）
      newQ.id = `local-${Date.now()}`;
      const saved = JSON.parse(localStorage.getItem('sekou_custom_q1') || '[]');
      saved.push(newQ);
      localStorage.setItem('sekou_custom_q1', JSON.stringify(saved));
      AppState.questions1st.push(newQ);

      alert('✅ 新規問題をブラウザに登録しました！模擬試験および特訓ドリルに追加されました。');
      form.reset();
      renderDashboard();
    });
  }
}
