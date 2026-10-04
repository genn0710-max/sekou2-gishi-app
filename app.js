/**
 * 2級建築施工管理技士 絶対合格プログラム
 * フロントエンド コア アプリケーション
 */

const APP_VERSION = "2.6.0";
const BUILD_IDENTIFIER = "20261004.01-STABLE-PWA";

// グローバルステート
const AppState = {
  categories: [],
  questions1st: [],
  questions2nd: [],
  numbersCards: [],
  essayTemplates: {},
  stages: [],
  stageProgress: {
    unlockedMaxStage: 1,
    clearedStages: {},
    relationHistory: {}
  },
  stagePlay: {
    stageNum: 1,
    questions: [],
    currentIndex: 0,
    answers: {},
    correctCount: 0,
    wrongList: []
  },
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
  initFontSize();
  initVersionManagement();
  initCountdown();
  initNav();
  await loadAllData();
  renderDashboard();
  initStagesEvents();
  initMockExamEvents();
  initDrillEvents();
  initEssayEvents();
  initFlashcardEvents();
  initAudioEvents();
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

// 文字サイズ初期化（標準 / 大 / 特大）
function initFontSize() {
  // 保存されている設定、未設定の場合はスマホなら 'large'、PCなら 'standard' を自動初期選択
  const isMobile = window.innerWidth <= 768;
  const savedSize = localStorage.getItem('sekou2_font_size') || (isMobile ? 'large' : 'large'); // スマホ配慮でデフォルト大
  setFontSize(savedSize);

  // ボタンイベント登録
  const fontBtns = document.querySelectorAll('.font-btn');
  fontBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const size = btn.dataset.size;
      setFontSize(size);
    });
  });
}

function setFontSize(size) {
  document.body.setAttribute('data-font-size', size);
  localStorage.setItem('sekou2_font_size', size);

  // ボタンスタイル同期
  document.querySelectorAll('.font-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.size === size);
  });
}

// バージョン管理・自動更新・データ保全
let newWorkerWaiting = null;

function initVersionManagement() {
  // バージョンバッジの更新
  const vBadge = document.getElementById('appVersionBadge');
  if (vBadge) {
    vBadge.textContent = `v${APP_VERSION}`;
  }
  const currDisp = document.getElementById('currentVersionDisplay');
  if (currDisp) {
    currDisp.textContent = `現行バージョン: v${APP_VERSION}`;
  }

  // 以前のバージョンチェック
  const lastRecordedVersion = localStorage.getItem('sekou2_app_version');
  if (!lastRecordedVersion) {
    localStorage.setItem('sekou2_app_version', APP_VERSION);
  } else if (lastRecordedVersion !== APP_VERSION) {
    console.log(`[Version] App updated from ${lastRecordedVersion} to ${APP_VERSION}`);
    localStorage.setItem('sekou2_app_version', APP_VERSION);
    showVersionToast(`アプリが最新版 v${APP_VERSION} にアップデートされました！`);
  }

  // Service Worker 更新待機検知
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      // 既に待機中の新しいService Workerがあるか確認
      if (registration.waiting) {
        newWorkerWaiting = registration.waiting;
        showUpdateBanner(APP_VERSION);
      }

      // 新しいService Workerがインストールされた際の検知
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              newWorkerWaiting = newWorker;
              showUpdateBanner(APP_VERSION);
            }
          });
        }
      });
    });

    // コントローラーが切り替わったら全画面リロード
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }

  // アプリ起動後、バックグラウンドで最新バージョンを静かに照合
  setTimeout(() => {
    checkForAppUpdate(false);
  }, 2000);
}

// リモート version.json との照合＆更新確認
async function checkForAppUpdate(isManual = false) {
  const resultDiv = document.getElementById('updateCheckResult');
  const btnText = document.getElementById('checkUpdateBtnText');
  const statusBadge = document.getElementById('versionStatusBadge');

  if (isManual && btnText) {
    btnText.innerHTML = '<span class="spin-anim">🔄</span> 照合中...';
  }

  try {
    const res = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('version.json 取得失敗');
    const remoteData = await res.json();
    const remoteVersion = remoteData.version;

    console.log(`[VersionCheck] Local: ${APP_VERSION}, Remote: ${remoteVersion}`);

    const hasNewVersion = isVersionNewer(remoteVersion, APP_VERSION);

    if (hasNewVersion) {
      if (statusBadge) {
        statusBadge.textContent = `⚡ 新版 v${remoteVersion} 利用可能`;
        statusBadge.style.background = '#f59e0b';
      }
      showUpdateBanner(remoteVersion);

      if (isManual && resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <div style="background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; padding: 10px; border-radius: 8px; color: #fbbf24;">
            <strong>⚡ 新しいバージョン (v${remoteVersion}) が配信されています！</strong><br>
            <span style="font-size: 0.8rem; color: #cbd5e1;">「今すぐ更新」を押すと、最新のコードと問題データが即座に反映されます。</span>
            <div style="margin-top: 8px;">
              <button class="btn btn-primary btn-sm" onclick="applyAppUpdate()">⚡ 今すぐ更新して適用</button>
            </div>
          </div>
        `;
      }
    } else {
      if (statusBadge) {
        statusBadge.textContent = '✅ 最新バージョン';
        statusBadge.style.background = '#10b981';
      }
      if (isManual && resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; padding: 10px; border-radius: 8px; color: #34d399;">
            ✅ お使いのアプリは最新版（v${APP_VERSION}）です。すべての機能と180問が正常に動作しています。
          </div>
        `;
      }
    }
  } catch (err) {
    console.warn('[VersionCheck] Offline or error:', err);
    if (isManual && resultDiv) {
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = `
        <div style="background: rgba(100, 116, 139, 0.2); border: 1px solid #64748b; padding: 10px; border-radius: 8px; color: #94a3b8;">
          現在オフラインまたはサーバー接続待機中です（端末内のv${APP_VERSION}で快適にご利用いただけます）。
        </div>
      `;
    }
  } finally {
    if (isManual && btnText) {
      btnText.textContent = '🔄 最新アップデートを確認';
    }
  }
}

// セマンティックバージョン比較 (v1 > v2 ?)
function isVersionNewer(v1, v2) {
  if (!v1 || !v2) return false;
  const p1 = v1.replace(/^v/, '').split('.').map(Number);
  const p2 = v2.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return true;
    if (num1 < num2) return false;
  }
  return false;
}

// 更新バナー表示
function showUpdateBanner(version) {
  const banner = document.getElementById('appUpdateBanner');
  const bannerVer = document.getElementById('updateBannerVersion');
  if (banner) {
    if (bannerVer && version) bannerVer.textContent = `v${version}`;
    banner.style.display = 'block';
  }
}

function dismissUpdateBanner() {
  const banner = document.getElementById('appUpdateBanner');
  if (banner) banner.style.display = 'none';
}

// 最新版をワンタッチ適用
async function applyAppUpdate() {
  showVersionToast('最新バージョンを適用して再起動中...');
  try {
    if (newWorkerWaiting) {
      newWorkerWaiting.postMessage({ action: 'skipWaiting' });
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (e) {
    console.warn(e);
  }
  setTimeout(() => {
    window.location.href = window.location.pathname + '?updated=' + Date.now();
  }, 300);
}

function openVersionModal() {
  const modal = document.getElementById('versionModal');
  if (modal) modal.style.display = 'flex';
}

function closeVersionModal() {
  const modal = document.getElementById('versionModal');
  if (modal) modal.style.display = 'none';
}

// PWAキャッシュ完全消去＆強制再読込
async function forceUpdateAppCache() {
  if (confirm('最新バージョンのアプリデータを再取得します。よろしいですか？\n（学習履歴データは保持されます）')) {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[Cache] Cleared all caches:', cacheNames);
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      window.location.href = window.location.pathname + '?v=' + Date.now();
    } catch (e) {
      console.error('Failed to clear cache:', e);
      window.location.reload(true);
    }
  }
}

// 学習データのJSONバックアップ書き出し（エクスポート）
function exportUserData() {
  const backupData = {
    app: "2級建築施工管理技士 絶対合格プログラム",
    version: APP_VERSION,
    build: BUILD_IDENTIFIER,
    exportedAt: new Date().toISOString(),
    userState: AppState.userState,
    stageProgress: AppState.stageProgress
  };
  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sekou2_backup_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showVersionToast('💾 学習履歴データをJSONファイルとして保存しました！');
}

// 学習データのJSON復元（インポート）
function importUserData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.userState && !data.stageProgress) {
        alert('無効なバックアップファイルです。施工管理アプリのバックアップJSONを指定してください。');
        return;
      }

      if (confirm(`以下のバックアップデータを復元しますか？\n作成日時: ${data.exportedAt || '不明'}\n元バージョン: ${data.version || '不明'}`)) {
        if (data.userState) {
          AppState.userState = Object.assign(AppState.userState, data.userState);
          localStorage.setItem('sekou_user_state', JSON.stringify(AppState.userState));
        }
        if (data.stageProgress) {
          AppState.stageProgress = Object.assign(AppState.stageProgress, data.stageProgress);
          localStorage.setItem('sekou_stage_progress', JSON.stringify(AppState.stageProgress));
        }

        renderDashboard();
        renderStages();
        closeVersionModal();
        showVersionToast('✅ 学習データのインポートが完了しました！');
      }
    } catch (err) {
      alert('ファイルの読み込みに失敗しました: ' + err.message);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

// 簡易トースト通知
function showVersionToast(message) {
  const existing = document.querySelector('.version-toast-banner');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'version-toast-banner';
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #10b981;
    color: #ffffff;
    padding: 14px 22px;
    border-radius: 12px;
    font-size: 0.95rem;
    font-weight: 700;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    z-index: 9999;
    animation: fadeIn 0.3s ease;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid rgba(255,255,255,0.2);
  `;
  toast.innerHTML = `<span>✨</span><span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.4s ease';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
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
  if (tabId === 'stages') renderStagesTab();
  if (tabId === 'drill') startDrill();
  if (tabId === 'practical2nd') renderPractical2nd();
  if (tabId === 'flashcards') renderFlashcard();
  if (tabId === 'audio') renderAudioTab();
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
    const [cats, q1, q2, nums, essays, stages] = await Promise.all([
      fetchWithFallback('/api/categories', './data/categories.json'),
      fetchWithFallback('/api/questions/1st', './data/questions_1st.json'),
      fetchWithFallback('/api/questions/2nd', './data/questions_2nd.json'),
      fetchWithFallback('/api/numbers', './data/numbers_card.json'),
      fetchWithFallback('/api/essay/templates', './data/essay_templates.json'),
      fetchWithFallback('/api/stages', './data/stages.json')
    ]);

    AppState.categories = cats || [];
    AppState.questions1st = q1 || [];
    AppState.questions2nd = q2 || [];
    AppState.numbersCards = nums || [];
    AppState.essayTemplates = essays || {};
    AppState.stages = stages || [];

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

    // ステージ進捗の復元
    const localStages = localStorage.getItem('sekou_stage_progress');
    if (localStages) {
      try {
        AppState.stageProgress = { ...AppState.stageProgress, ...JSON.parse(localStages) };
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
  if (countVal === '20') total = Math.min(20, pool.length);
  if (countVal === '40') total = Math.min(40, pool.length);

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
  const pointGuideElem = document.getElementById('themePointGuide');
  if (pointGuideElem && currentTheme && currentTheme.point_guide) {
    pointGuideElem.textContent = currentTheme.point_guide;
  }
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

// ==========================================================================
// 8. 音声聞き流し学習エンジン（Audio Mode）
// ==========================================================================
const AudioLearner = {
  mode: '1st_questions', // '1st_questions' | 'essay_samples' | 'numbers'
  tracks: [],
  currentIndex: 0,
  isPlaying: false,
  rate: 1.0,
  timerId: null,
  speechSynth: window.speechSynthesis,

  init() {
    this.buildTracks();
  },

  buildTracks() {
    if (this.mode === '1st_questions') {
      this.tracks = AppState.questions1st.map((q, idx) => {
        const correctOpt = q.options[q.answer] || '';
        return {
          id: q.id,
          type: '1st',
          title: `第${idx + 1}問：${q.subcategory || '施工管理'}`,
          badge: '1次検定 問題',
          questionText: q.question,
          options: q.options || [],
          answerIndex: q.answer,
          answerText: `正解は、${q.answer + 1}番。「${correctOpt}」です。`,
          explanationText: q.explanation,
          subInfo: `正解：${q.answer + 1}番`
        };
      });
    } else if (this.mode === 'essay_samples') {
      const themes = AppState.essayTemplates.themes || [];
      this.tracks = themes.map(t => {
        const s = t.sample;
        return {
          id: t.id,
          type: 'essay',
          title: `経験記述模範：${t.name}`,
          badge: '2次検定 模範解答',
          questionText: `工事件名：${s.project_name}。\n構造規模：${s.structure}。\n立場：${s.role}。`,
          options: [],
          answerIndex: -1,
          answerText: `【設問1・技術的課題】\n${s.problem}。\n\n【設問2・検討事項】\n${s.consideration}。`,
          explanationText: `【設問3・具体的措置と結果】\n${s.action}`,
          subInfo: t.description
        };
      });
    } else if (this.mode === 'numbers') {
      this.tracks = AppState.numbersCards.map(c => {
        return {
          id: c.id,
          type: 'numbers',
          title: `重要数値：${c.title}`,
          badge: `数値暗記（${c.category}）`,
          questionText: c.question,
          options: [],
          answerIndex: -1,
          answerText: `基準値は、${c.answer}です。`,
          explanationText: c.point,
          subInfo: `要点：${c.point}`
        };
      });
    }
  },

  speakText(text, onEnd) {
    if (!this.speechSynth) {
      if (onEnd) setTimeout(onEnd, 2000);
      return;
    }
    this.speechSynth.cancel();

    // 読みやすさのために不要な記号を調整
    const cleanText = text
      .replace(/[\n\r]+/g, '。')
      .replace(/【.*?】/g, '')
      .replace(/〇|×/g, '')
      .replace(/Fc\s*=\s*/g, 'エフシー ')
      .replace(/W\/C/g, '水セメント比 ')
      .replace(/λ\s*=\s*/g, 'ラムダ ')
      .replace(/m\^4|cm\^4/g, 'の4乗 ')
      .replace(/m\^3|cm\^3/g, 'の3乗 ');

    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = 'ja-JP';
    utter.rate = this.rate;

    utter.onend = () => {
      if (this.isPlaying && onEnd) onEnd();
    };

    utter.onerror = (e) => {
      console.warn('Speech error:', e);
      if (this.isPlaying && onEnd) setTimeout(onEnd, 1000);
    };

    this.speechSynth.speak(utter);
  },

  play() {
    this.isPlaying = true;
    this.updateUI();
    this.playCurrentTrack();
  },

  pause() {
    this.isPlaying = false;
    if (this.speechSynth) this.speechSynth.cancel();
    if (this.timerId) clearTimeout(this.timerId);
    this.clearHighlights();
    this.updateUI();
  },

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  },

  nextTrack() {
    if (this.timerId) clearTimeout(this.timerId);
    if (this.speechSynth) this.speechSynth.cancel();
    this.clearHighlights();
    this.currentIndex = (this.currentIndex + 1) % this.tracks.length;
    this.updateUI();
    if (this.isPlaying) this.playCurrentTrack();
  },

  prevTrack() {
    if (this.timerId) clearTimeout(this.timerId);
    if (this.speechSynth) this.speechSynth.cancel();
    this.clearHighlights();
    this.currentIndex = (this.currentIndex - 1 + this.tracks.length) % this.tracks.length;
    this.updateUI();
    if (this.isPlaying) this.playCurrentTrack();
  },

  jumpToTrack(index) {
    if (this.timerId) clearTimeout(this.timerId);
    if (this.speechSynth) this.speechSynth.cancel();
    this.clearHighlights();
    this.currentIndex = index;
    this.updateUI();
    if (this.isPlaying) this.playCurrentTrack();
  },

  clearHighlights() {
    const qBox = document.getElementById('audioQuestionBox');
    if (qBox) qBox.classList.remove('reading');
    for (let i = 0; i < 4; i++) {
      const optEl = document.getElementById(`audioOpt${i}`);
      if (optEl) {
        optEl.classList.remove('reading');
        optEl.classList.remove('correct-highlight');
      }
    }
  },

  playCurrentTrack() {
    const track = this.tracks[this.currentIndex];
    if (!track) return;

    this.clearHighlights();

    // UI初期設定
    document.getElementById('audioDisplayTitle').textContent = track.title;
    const qBox = document.getElementById('audioQuestionBox');
    qBox.textContent = track.questionText;

    const optList = document.getElementById('audioOptionsList');
    const expBox = document.getElementById('audioExpBox');
    const statusText = document.getElementById('audioStatusText');

    if (track.type === '1st' && track.options && track.options.length === 4) {
      optList.style.display = 'flex';
      for (let i = 0; i < 4; i++) {
        const item = document.getElementById(`audioOpt${i}`);
        if (item) {
          const textSpan = item.querySelector('.opt-text');
          if (textSpan) textSpan.textContent = track.options[i];
        }
      }
    } else {
      optList.style.display = 'none';
    }

    expBox.style.display = 'none';

    // ステップ1: 問題文の読み上げ
    statusText.textContent = '🎧 問題文を読み上げ中...';
    qBox.classList.add('reading');

    this.speakText(track.questionText, () => {
      if (!this.isPlaying) return;
      qBox.classList.remove('reading');

      const shouldReadOptions = document.getElementById('audioReadOptionsCheck') ? document.getElementById('audioReadOptionsCheck').checked : true;

      // 1次検定で選択肢読み上げがONの場合：選択肢1〜4を1つずつ読み上げ＆リアルタイムハイライト
      if (track.type === '1st' && shouldReadOptions && track.options && track.options.length === 4) {
        this.readOptionStep(track, 0);
      } else {
        // 選択肢読み上げなし、または経験記述/数値カードの場合
        this.startThinkingTime(track);
      }
    });
  },

  readOptionStep(track, optIdx) {
    if (!this.isPlaying) return;
    if (optIdx >= 4) {
      // 全選択肢の読み上げ終了 ➔ シンキングタイムへ
      this.startThinkingTime(track);
      return;
    }

    const item = document.getElementById(`audioOpt${optIdx}`);
    if (item) item.classList.add('reading');

    const statusText = document.getElementById('audioStatusText');
    if (statusText) statusText.textContent = `🎧 選択肢 ${optIdx + 1} を読み上げ中...`;

    const speechText = `${optIdx + 1}番。${track.options[optIdx]}`;
    this.speakText(speechText, () => {
      if (!this.isPlaying) return;
      if (item) item.classList.remove('reading');
      this.readOptionStep(track, optIdx + 1);
    });
  },

  startThinkingTime(track) {
    if (!this.isPlaying) return;
    const statusText = document.getElementById('audioStatusText');
    if (statusText) statusText.textContent = '⏳ シンキングタイム（3秒間）...';

    this.timerId = setTimeout(() => {
      if (!this.isPlaying) return;

      // 正解発表＆正解肢の鮮やかなハイライト
      if (track.type === '1st' && track.answerIndex >= 0) {
        const correctItem = document.getElementById(`audioOpt${track.answerIndex}`);
        if (correctItem) correctItem.classList.add('correct-highlight');
      }

      if (statusText) statusText.textContent = '✅ 正解発表！';

      // 解説ボックスを表示
      const expBox = document.getElementById('audioExpBox');
      const expText = document.getElementById('audioExpText');
      if (expBox && expText) {
        expBox.style.display = 'block';
        expText.textContent = `${track.answerText}\n\n${track.explanationText}`;
      }

      // 正解と詳細解説の読み上げ
      const fullAnsSpeech = `${track.answerText}。解説。${track.explanationText}`;
      this.speakText(fullAnsSpeech, () => {
        if (!this.isPlaying) return;

        // 次のトラックへ自動スキップ（2秒後）
        if (statusText) statusText.textContent = '⏭️ 2秒後に次の問題へ進みます...';
        this.timerId = setTimeout(() => {
          if (this.isPlaying) {
            this.nextTrack();
          }
        }, 2000);
      });
    }, 3000);
  },

  updateUI() {
    const playBtn = document.getElementById('audioPlayBtn');
    const visualizer = document.getElementById('audioVisualizer');
    const counter = document.getElementById('audioTrackCounter');
    const badge = document.getElementById('audioContentBadge');

    if (playBtn) playBtn.textContent = this.isPlaying ? '⏸️' : '▶️';
    if (visualizer) visualizer.classList.toggle('playing', this.isPlaying);
    if (counter && this.tracks.length > 0) {
      counter.textContent = `トラック ${this.currentIndex + 1} / ${this.tracks.length}`;
    }

    const currentTrack = this.tracks[this.currentIndex];
    if (badge && currentTrack) badge.textContent = currentTrack.badge;

    // プレイリストのハイライト
    const items = document.querySelectorAll('#audioPlaylist .playlist-item');
    items.forEach((item, idx) => {
      item.classList.toggle('playing', idx === this.currentIndex);
    });
  }
};

function initAudioEvents() {
  const modeSelect = document.getElementById('audioModeSelect');
  if (modeSelect) {
    modeSelect.addEventListener('change', () => {
      AudioLearner.pause();
      AudioLearner.mode = modeSelect.value;
      AudioLearner.currentIndex = 0;
      AudioLearner.buildTracks();
      renderAudioTab();
    });
  }

  const playBtn = document.getElementById('audioPlayBtn');
  if (playBtn) playBtn.addEventListener('click', () => AudioLearner.togglePlay());

  const prevBtn = document.getElementById('audioPrevBtn');
  if (prevBtn) prevBtn.addEventListener('click', () => AudioLearner.prevTrack());

  const nextBtn = document.getElementById('audioNextBtn');
  if (nextBtn) nextBtn.addEventListener('click', () => AudioLearner.nextTrack());

  const speedSelect = document.getElementById('audioSpeedSelect');
  if (speedSelect) {
    speedSelect.addEventListener('change', () => {
      AudioLearner.rate = parseFloat(speedSelect.value);
    });
  }
}

function renderAudioTab() {
  AudioLearner.buildTracks();
  AudioLearner.updateUI();

  const playlistElem = document.getElementById('audioPlaylist');
  if (playlistElem) {
    playlistElem.innerHTML = AudioLearner.tracks.map((t, idx) => {
      const isCur = idx === AudioLearner.currentIndex;
      return `
        <div class="playlist-item ${isCur ? 'playing' : ''}" onclick="AudioLearner.jumpToTrack(${idx})">
          <div>
            <span class="badge" style="margin-right: 8px;">${t.badge}</span>
            <strong>${t.title}</strong>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-sub);">
            ${isCur && AudioLearner.isPlaying ? '🔊 再生中' : '選択'}
          </div>
        </div>
      `;
    }).join('');
  }
}

// ==========================================================================
// 段階ステップアップ（ステージ制・全180問・リレーション形式）ロジック
// ==========================================================================
function initStagesEvents() {
  const closeBtn = document.getElementById('closeStagePlayBtn');
  if (closeBtn) closeBtn.addEventListener('click', closeStagePlay);

  const nextBtn = document.getElementById('stagePlayNextBtn');
  if (nextBtn) nextBtn.addEventListener('click', nextStagePlayQuestion);

  const nextStageBtn = document.getElementById('stageNextStageBtn');
  if (nextStageBtn) {
    nextStageBtn.addEventListener('click', () => {
      const nextNum = AppState.stagePlay.stageNum + 1;
      if (nextNum <= 18) {
        startStagePlay(nextNum);
      } else {
        alert('🎉 おめでとうございます！全18ステージ（180問）をすべて制覇しました！本番模試に挑戦してください！');
        closeStagePlay();
      }
    });
  }

  const retryBtn = document.getElementById('stageRetryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      startStagePlay(AppState.stagePlay.stageNum);
    });
  }

  const backMapBtn = document.getElementById('stageBackToMapBtn');
  if (backMapBtn) backMapBtn.addEventListener('click', closeStagePlay);

  const resetBtn = document.getElementById('resetStagesBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('段階ステップアップの進捗状況をリセットして最初（STAGE 01）からやり直しますか？')) {
        AppState.stageProgress = {
          unlockedMaxStage: 1,
          clearedStages: {},
          relationHistory: {}
        };
        saveStageProgress();
        renderStagesTab();
      }
    });
  }
}

// ステージ画面レンダリング
function renderStagesTab() {
  const stages = AppState.stages || [];
  const prog = AppState.stageProgress;
  const grid = document.getElementById('stagesGrid');
  if (!grid) return;

  const clearedCount = Object.keys(prog.clearedStages).length;
  let totalStars = 0;
  Object.values(prog.clearedStages).forEach(cs => {
    if (cs.perfect) totalStars += 3;
    else if (cs.score >= 8) totalStars += 2;
    else totalStars += 1;
  });

  // 進捗サマリー更新
  const progressPill = document.getElementById('stageProgressPill');
  if (progressPill) progressPill.textContent = `${clearedCount} / ${stages.length} STAGE`;

  const starsPill = document.getElementById('stageStarsPill');
  if (starsPill) starsPill.textContent = `⭐ ${clearedCount} クリア (${totalStars}★)`;

  const progressBar = document.getElementById('stageOverallProgressBar');
  if (progressBar) {
    const pct = stages.length > 0 ? Math.round((clearedCount / stages.length) * 100) : 0;
    progressBar.style.width = `${pct}%`;
  }

  // 18ステージカード生成
  grid.innerHTML = stages.map(st => {
    const stageNum = st.stage;
    const isUnlocked = stageNum <= (prog.unlockedMaxStage || 1);
    const clearedInfo = prog.clearedStages[stageNum];
    const isCleared = !!clearedInfo;
    const isPerfect = clearedInfo && clearedInfo.score === 10;

    let cardClass = 'stage-card';
    let statusBadge = '';
    let btnHtml = '';

    if (!isUnlocked) {
      cardClass += ' locked';
      statusBadge = '<span class="stage-status-badge text-muted">🔒 ロック中</span>';
      btnHtml = `<button class="btn btn-outline btn-sm btn-block" disabled>STAGE ${stageNum - 1} クリアで解放</button>`;
    } else if (isPerfect) {
      cardClass += ' perfect';
      statusBadge = '<span class="stage-status-badge text-green">👑 パーフェクト達成 (10/10)</span>';
      btnHtml = `<button class="btn btn-success btn-sm btn-block" onclick="startStagePlay(${stageNum})">再挑戦する (10問)</button>`;
    } else if (isCleared) {
      cardClass += ' cleared';
      statusBadge = `<span class="stage-status-badge text-gold">⭐ クリア済み (${clearedInfo.score}/10)</span>`;
      btnHtml = `<button class="btn btn-primary btn-sm btn-block" onclick="startStagePlay(${stageNum})">満点に挑戦 (10問)</button>`;
    } else {
      statusBadge = '<span class="stage-status-badge text-accent">⚡ 挑戦可能</span>';
      btnHtml = `<button class="btn btn-primary btn-sm btn-block" onclick="startStagePlay(${stageNum})">スタート (10問)</button>`;
    }

    return `
      <div class="${cardClass}">
        <div>
          <div class="stage-card-top">
            <span class="stage-number">STAGE ${String(stageNum).padStart(2, '0')}</span>
            ${statusBadge}
          </div>
          <h4 class="stage-card-title">${st.name}</h4>
          <p class="stage-card-desc">${st.desc}</p>
        </div>
        <div>
          <div class="stage-card-footer">
            <div class="stage-score-label">
              ${clearedInfo ? `最高スコア: <strong>${clearedInfo.score} / 10</strong>` : '基準: <strong>8問以上</strong>で合格'}
            </div>
          </div>
          <div style="margin-top: 12px;">
            ${btnHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ステージプレイ開始
function startStagePlay(stageNum) {
  const allQ = AppState.questions1st || [];
  // 本ステージの10問を抽出
  let stageQuestions = allQ.filter(q => q.stage === stageNum);

  // リレーション復習問題の組み込み（直前ステージの誤答があれば差し込む）
  const relationCheck = document.getElementById('stageRelationToggle');
  const isRelationOn = relationCheck ? relationCheck.checked : true;
  let relationQuestions = [];

  if (isRelationOn && stageNum > 1) {
    const prevWrongIds = AppState.stageProgress.relationHistory[stageNum - 1] || [];
    if (prevWrongIds.length > 0) {
      relationQuestions = allQ.filter(q => prevWrongIds.includes(q.id)).slice(0, 2);
      relationQuestions.forEach(rq => { rq._isRelation = true; });
    }
  }

  // 結合（リレーション復習問題を先頭または適正位置に配置）
  const playQuestions = [...relationQuestions, ...stageQuestions];

  if (playQuestions.length === 0) {
    alert('設問データを読み込めませんでした。');
    return;
  }

  const stageMeta = (AppState.stages || []).find(s => s.stage === stageNum) || {
    name: `STAGE ${stageNum}`,
    desc: ''
  };

  AppState.stagePlay = {
    stageNum: stageNum,
    stageMeta: stageMeta,
    questions: playQuestions,
    currentIndex: 0,
    answers: {},
    correctCount: 0,
    wrongList: []
  };

  // モーダルを開く
  const modal = document.getElementById('stagePlayModal');
  if (modal) {
    modal.style.display = 'flex';
    document.getElementById('stagePlayCard').style.display = 'block';
    document.getElementById('stageResultCard').style.display = 'none';
    document.getElementById('stagePlayBadge').textContent = `STAGE ${String(stageNum).padStart(2, '0')}`;
    document.getElementById('stagePlayTitle').textContent = stageMeta.name;
    renderStagePlayQuestion();
  }
}

// ステージ問題の描画
function renderStagePlayQuestion() {
  const sp = AppState.stagePlay;
  const q = sp.questions[sp.currentIndex];
  if (!q) return;

  const currentNumElem = document.getElementById('stagePlayCurrentNum');
  if (currentNumElem) currentNumElem.textContent = sp.currentIndex + 1;

  const totalNumElem = document.getElementById('stagePlayTotalNum');
  if (totalNumElem) totalNumElem.textContent = sp.questions.length;

  const progBar = document.getElementById('stagePlayProgressBar');
  if (progBar) {
    const pct = Math.round(((sp.currentIndex + 1) / sp.questions.length) * 100);
    progBar.style.width = `${pct}%`;
  }

  const relationBadge = document.getElementById('stagePlayRelationBadge');
  if (relationBadge) {
    relationBadge.style.display = q._isRelation ? 'inline-block' : 'none';
  }

  const catBadge = document.getElementById('stagePlayCategory');
  if (catBadge) catBadge.textContent = q.category || '建築施工';

  const subCatBadge = document.getElementById('stagePlaySubcategory');
  if (subCatBadge) subCatBadge.textContent = q.subcategory || '';

  const qText = document.getElementById('stagePlayQuestion');
  if (qText) qText.textContent = q.question;

  // 選択肢描画
  const optsContainer = document.getElementById('stagePlayOptions');
  if (optsContainer) {
    optsContainer.innerHTML = q.options.map((opt, idx) => {
      return `
        <button class="option-btn" id="stageOptBtn_${idx}" onclick="handleStageOptionClick(${idx})">
          <span class="option-num">${idx + 1}</span>
          <span class="option-text">${opt}</span>
        </button>
      `;
    }).join('');
  }

  // 解説エリアを隠す
  const expBox = document.getElementById('stagePlayExp');
  if (expBox) expBox.style.display = 'none';
}

// 選択肢クリック時の判定と解説表示
function handleStageOptionClick(selectedIdx) {
  const sp = AppState.stagePlay;
  const q = sp.questions[sp.currentIndex];
  if (!q || sp.answers[sp.currentIndex] !== undefined) return; // 既に解答済みなら無視

  sp.answers[sp.currentIndex] = selectedIdx;
  const isCorrect = (selectedIdx === q.answer);

  if (isCorrect) {
    sp.correctCount++;
  } else {
    sp.wrongList.push(q.id);
  }

  // 全ボタン無効化＆カラー点灯
  for (let i = 0; i < q.options.length; i++) {
    const btn = document.getElementById(`stageOptBtn_${i}`);
    if (!btn) continue;
    btn.disabled = true;
    if (i === q.answer) {
      btn.classList.add('correct');
    }
    if (i === selectedIdx && !isCorrect) {
      btn.classList.add('incorrect');
    }
  }

  // ユーザーの履歴にも記録
  AppState.userState.history[q.id] = {
    answered: true,
    correct: isCorrect,
    lastAnswer: selectedIdx,
    timestamp: new Date().toISOString()
  };
  saveUserState();

  // 解説表示
  const expBox = document.getElementById('stagePlayExp');
  const expContent = document.getElementById('stagePlayExpContent');
  const expBadge = document.getElementById('stagePlayExpBadge');

  if (expBox && expContent) {
    expBadge.textContent = isCorrect ? '⭕ 正解！ 解説を確認しましょう' : '❌ 不正解... 解説を確認しましょう';
    expBadge.className = isCorrect ? 'exp-badge text-green' : 'exp-badge text-danger';
    expContent.textContent = q.explanation;
    expBox.style.display = 'block';

    const nextBtn = document.getElementById('stagePlayNextBtn');
    if (nextBtn) {
      const isLast = sp.currentIndex === sp.questions.length - 1;
      nextBtn.textContent = isLast ? '結果を見る（ステージ判定）🎉' : '次の問題へ進む →';
    }
  }
}

// 次の問題へ
function nextStagePlayQuestion() {
  const sp = AppState.stagePlay;
  if (sp.currentIndex < sp.questions.length - 1) {
    sp.currentIndex++;
    renderStagePlayQuestion();
  } else {
    finishStagePlay();
  }
}

// ステージ完了処理
function finishStagePlay() {
  const sp = AppState.stagePlay;
  const total = sp.questions.length;
  const score = sp.correctCount;
  const isCleared = score >= 8;
  const isPerfect = score === total;

  document.getElementById('stagePlayCard').style.display = 'none';
  const resultCard = document.getElementById('stageResultCard');
  if (resultCard) resultCard.style.display = 'block';

  const badgeElem = document.getElementById('stageResultBadge');
  const titleElem = document.getElementById('stageResultTitle');
  const scoreElem = document.getElementById('stageResultScore');
  const msgElem = document.getElementById('stageResultMsg');
  const starsElem = document.getElementById('stageResultStars');
  const nextStageBtn = document.getElementById('stageNextStageBtn');

  if (scoreElem) scoreElem.textContent = score;

  if (isPerfect) {
    if (badgeElem) badgeElem.textContent = 'PERFECT! 満点達成';
    if (titleElem) titleElem.textContent = `👑 STAGE ${String(sp.stageNum).padStart(2, '0')} パーフェクト！`;
    if (starsElem) starsElem.textContent = '⭐⭐⭐';
    if (msgElem) msgElem.textContent = '素晴らしい！全問正解で完全マスターしました。この知識は長期記憶として定着しています。';
  } else if (isCleared) {
    if (badgeElem) badgeElem.textContent = 'STAGE CLEAR! 合格';
    if (titleElem) titleElem.textContent = `🎉 STAGE ${String(sp.stageNum).padStart(2, '0')} クリア達成！`;
    if (starsElem) starsElem.textContent = '⭐⭐';
    if (msgElem) msgElem.textContent = '合格基準（80%以上）をクリアしました！次のステージがアンロックされました。';
  } else {
    if (badgeElem) badgeElem.textContent = 'CHALLENGE FAILED もう一歩';
    if (titleElem) titleElem.textContent = `STAGE ${String(sp.stageNum).padStart(2, '0')} 再挑戦`;
    if (starsElem) starsElem.textContent = '⭐';
    if (msgElem) msgElem.textContent = '8問以上正解でクリアとなります。間違えた問題を復習して、もう一度挑戦しましょう！';
  }

  // ステージ進捗の記録
  const prevRecord = AppState.stageProgress.clearedStages[sp.stageNum];
  const bestScore = prevRecord ? Math.max(prevRecord.score, score) : score;

  if (isCleared) {
    AppState.stageProgress.clearedStages[sp.stageNum] = {
      score: bestScore,
      total: 10,
      perfect: isPerfect || (prevRecord && prevRecord.perfect),
      clearedAt: new Date().toISOString()
    };

    // 次のステージを解放
    if (sp.stageNum === AppState.stageProgress.unlockedMaxStage && sp.stageNum < 18) {
      AppState.stageProgress.unlockedMaxStage = sp.stageNum + 1;
    }
  }

  // 次ステージ用のリレーション誤答リストを保存
  AppState.stageProgress.relationHistory[sp.stageNum] = sp.wrongList;
  saveStageProgress();

  if (nextStageBtn) {
    nextStageBtn.style.display = isCleared ? 'inline-block' : 'none';
  }

  // 背景のステージマップも更新
  renderStagesTab();
  renderDashboard();
}

// モーダルを閉じる
function closeStagePlay() {
  const modal = document.getElementById('stagePlayModal');
  if (modal) modal.style.display = 'none';
  renderStagesTab();
}

// ステージ進捗の永続化
function saveStageProgress() {
  localStorage.setItem('sekou_stage_progress', JSON.stringify(AppState.stageProgress));
}
