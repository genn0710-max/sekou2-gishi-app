/**
 * v2.11.0 拡張モジュール
 *  1. 全セクション「🎧 聞き流しモード」（連続自動読み上げ）
 *  2. 発音補正の追加ルール＆Windows音声（Nanami / Keita / Haruka 等）自動最適化
 *  3. PC・Windows キーボードショートカット＆デスクトップ操作バー
 * app.js の後に読み込むこと。
 */
(function () {
  'use strict';

  const IS_WINDOWS = /Windows/i.test(navigator.userAgent);
  const $ = (id) => document.getElementById(id);
  const isVisible = (el) => !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none';

  // ==========================================================================
  // 1. 発音補正 追加ルール（PhoneticSanitizer を前後から拡張）
  // ==========================================================================
  // 前処理: 既存ルールに分解される前に複合語を確定させる
  const PRE_RULES = [
    [/小口径/g, 'しょうこうけい'],
    [/打継目地/g, 'うちつぎめじ'],
    [/水盛遣形/g, 'みずもりやりかた'],
    [/36協定/g, 'さぶろくきょうてい'],
    [/(\d+)月以内/g, (_, n) => (n === '1' ? 'ひとつきいない' : `${n}かげついない`)],
    [/1次検定/g, 'いちじけんてい'],
    [/2次検定/g, 'にじけんてい'],
    [/1次締め?/g, 'いちじじめ'],
    [/1級/g, 'いっきゅう'],
    [/2級/g, 'にきゅう'],
    [/1人/g, 'ひとり'],
    [/2人/g, 'ふたり'],
    [/1工区/g, 'いちこうく'],
    [/2工区/g, 'にこうく'],
    [/2割5分/g, 'にわりごぶ'],
    [/㎡/g, '平方メートル'],
    [/㎥/g, '立方メートル'],
    [/CaCO3/g, 'たんさんカルシウム'],
    [/Ca\(OH\)2/g, 'すいさんかカルシウム'],
    [/H2O/g, 'みず'],
    [/NaCl/g, 'えんかナトリウム'],
    [/Xbar-R/g, 'エックスバー アール'],
    [/Xbar/g, 'エックスバー'],
    [/Low Emissivity/gi, 'ロー エミシビティ'],
    [/SD490/g, 'エスディーよんひゃくきゅうじゅう'],
    [/SD390/g, 'エスディーさんびゃくきゅうじゅう'],
    [/CN50/g, 'シーエヌごじゅう'],
    [/CN65/g, 'シーエヌろくじゅうご'],
    [/Gmax/g, 'ジーマックス'],
    [/R0?([1-6])年度/g, 'れいわ$1ねんど'],
    [/令和(\d)年度/g, 'れいわ$1ねんど']
  ];
  // 後処理: 残った略語・記号を読み上げ可能な形へ
  const POST_RULES = [
    [/\bLeq\b/g, 'エルイーキュー'],
    [/\bSWS\b/g, 'エスダブリューエス'],
    [/\bXPS\b/g, 'エックスピーエス'],
    [/\bSBS\b/g, 'エスビーエス'],
    [/\bPVB\b/g, 'ピーブイビー'],
    [/\bLED\b/g, 'エルイーディー'],
    [/\bIH\b/g, 'アイエイチ'],
    [/\bSRC\b/g, 'エスアールシー'],
    [/\bRC\b/g, 'アールシー'],
    [/\bPC\b/g, 'ピーシー'],
    [/\bQC\b/g, 'キューシー'],
    [/\bCOP\b/g, 'シーオーピー'],
    [/\bVCB\b/g, 'ブイシービー'],
    [/\bKY\b/g, 'ケーワイ'],
    [/\bCIE\b/g, 'シーアイイー'],
    [/\bLLT\b/g, 'エルエルティー'],
    [/\bMT\b/g, 'エムティー'],
    [/\bSN\b/g, 'エスエヌ'],
    [/\bSS\b/g, 'エスエス'],
    [/\bSM\b/g, 'エスエム'],
    [/\bdB\b/g, 'デシベル'],
    [/\bmg\b/g, 'ミリグラム'],
    [/\blm\b/g, 'ルーメン'],
    [/\bcd\b/g, 'カンデラ'],
    [/\bkm\b/g, 'キロメートル'],
    [/[〜～]/g, 'から'],
    [/[→➔⇒]/g, '、'],
    [/①/g, 'いち、'], [/②/g, 'に、'], [/③/g, 'さん、'], [/④/g, 'よん、'], [/⑤/g, 'ご、'],
    [/＋/g, 'プラス'],
    [/[／/]/g, '、'],
    [/[【】「」『』]/g, '、'],
    [/[〇○]：/g, 'まる、'],
    [/[×✕]：/g, 'ばつ、'],
    [/、{2,}/g, '、']
  ];

  if (typeof PhoneticSanitizer !== 'undefined' && !PhoneticSanitizer._v211) {
    const origSanitize = PhoneticSanitizer.sanitize.bind(PhoneticSanitizer);
    PhoneticSanitizer.sanitize = function (text) {
      if (!text) return '';
      let t = String(text);
      PRE_RULES.forEach(([re, rep]) => { t = t.replace(re, rep); });
      t = origSanitize(t);
      POST_RULES.forEach(([re, rep]) => { t = t.replace(re, rep); });
      return t;
    };
    PhoneticSanitizer._v211 = true;
  }

  // ==========================================================================
  // 2. 音声エンジン（最適な日本語音声の自動選択・Windows安定化）
  // ==========================================================================
  const VoiceManager = {
    voices: [],
    voice: null,
    rate: parseFloat(localStorage.getItem('sekou2_listen_rate') || '1.0') || 1.0,
    preferredName: localStorage.getItem('sekou2_voice_name') || '',

    score(v) {
      const n = v.name || '';
      if (/Nanami/i.test(n)) return 100;          // Windows/Edge 自然音声
      if (/Keita/i.test(n)) return 95;
      if (/Google\s*日本語/i.test(n)) return 90;   // Chrome
      if (/Kyoko|O-?ren|Hattori/i.test(n)) return 85; // macOS / iOS
      if (/Natural|Online/i.test(n)) return 80;
      if (/Haruka/i.test(n)) return 70;           // Windows ローカル
      if (/Ayumi/i.test(n)) return 65;
      if (/Ichiro|Sayaka/i.test(n)) return 60;
      return 50;
    },

    load() {
      if (!('speechSynthesis' in window)) return;
      const all = window.speechSynthesis.getVoices() || [];
      this.voices = all.filter(v => /^ja(-|_|$)/i.test(v.lang) || /日本語|Japanese/i.test(v.name));
      let chosen = null;
      if (this.preferredName) chosen = this.voices.find(v => v.name === this.preferredName) || null;
      if (!chosen && this.voices.length) {
        chosen = [...this.voices].sort((a, b) => this.score(b) - this.score(a))[0];
      }
      this.voice = chosen;
      renderVoiceSelects();
    },

    setVoice(name) {
      this.preferredName = name || '';
      localStorage.setItem('sekou2_voice_name', this.preferredName);
      this.load();
    },

    setRate(r) {
      this.rate = parseFloat(r) || 1.0;
      localStorage.setItem('sekou2_listen_rate', String(this.rate));
      document.querySelectorAll('.ls-rate-select').forEach(s => { s.value = String(this.rate); });
    }
  };
  window.VoiceManager = VoiceManager;

  if ('speechSynthesis' in window) {
    const synth = window.speechSynthesis;
    VoiceManager.load();
    synth.onvoiceschanged = () => VoiceManager.load();

    // 全ての発話に最適な日本語音声を自動適用＆GC保護（既存の読み上げ・聞き流しタブも含む）
    const origSpeak = synth.speak.bind(synth);
    synth.speak = function (u) {
      try {
        if (u && !u.voice && VoiceManager.voice) u.voice = VoiceManager.voice;
        if (u) u.lang = 'ja-JP';
        window._activeUtterance = u;
      } catch (e) {}
      return origSpeak(u);
    };

    // Windows: pause()/resume() のキープアライブで自然音声が途切れる不具合を回避
    // （チャンクは60文字以下に分割済みのため、キープアライブは不要）
    if (IS_WINDOWS) {
      synth.pause = function () {};
      synth.resume = function () {};
    }
  }

  // ==========================================================================
  // 3. セクション別 聞き流しエンジン
  // ==========================================================================
  const SECTION_LABELS = {
    stages: '段階ステップ',
    mock: '模擬試験',
    mockResult: '模擬試験 解説',
    drill: '分野別特訓',
    essay: '経験記述 模範解答',
    practical: '実地記述・工程表',
    flashcards: '重要数値カード',
    terms: '用語・漢字辞典'
  };

  const Listener = {
    token: 0,
    active: false,
    section: null,
    status: '',
    startIndex: 0,

    alive(tok) { return this.active && tok === this.token; },

    setStatus(text) {
      this.status = text;
      const el = $('lsPlayerStatus');
      if (el) el.textContent = text;
    },

    utter(chunk) {
      return new Promise(resolve => {
        const clean = PhoneticSanitizer.sanitize(chunk);
        if (!clean.trim()) return resolve();
        const u = new SpeechSynthesisUtterance(clean);
        u.lang = 'ja-JP';
        u.rate = VoiceManager.rate;
        if (VoiceManager.voice) u.voice = VoiceManager.voice;
        let done = false;
        const fin = () => { if (done) return; done = true; clearTimeout(wd); resolve(); };
        u.onend = fin;
        u.onerror = fin;
        const wd = setTimeout(fin, 3000 + clean.length * 350 / VoiceManager.rate);
        window._activeUtterance = u;
        try { window.speechSynthesis.speak(u); } catch (e) { fin(); }
      });
    },

    async say(text, el, tok) {
      if (!this.alive(tok) || !text) return this.alive(tok);
      if (el) {
        el.classList.add('ls-reading');
        scrollIntoViewIfNeeded(el);
      }
      const chunks = splitSpeechText(String(text));
      for (const c of chunks) {
        if (!this.alive(tok)) break;
        await this.utter(c);
      }
      if (el) el.classList.remove('ls-reading');
      return this.alive(tok);
    },

    wait(ms, tok) {
      return new Promise(r => setTimeout(() => r(this.alive(tok)), ms / Math.max(0.6, VoiceManager.rate)));
    },

    start(section, startIndex) {
      this.stop(true);
      if (!('speechSynthesis' in window)) {
        alert('このブラウザは音声読み上げに対応していません。Chrome または Edge をご利用ください。');
        return;
      }
      if (typeof AudioLearner !== 'undefined' && AudioLearner.isPlaying) AudioLearner.pause();
      const handler = HANDLERS[section];
      if (!handler) return;
      this.active = true;
      this.section = section;
      this.startIndex = startIndex || 0;
      const tok = ++this.token;
      try { window.speechSynthesis.cancel(); } catch (e) {}
      try { WakeLockManager.requestWakeLock(); } catch (e) {}
      this.setStatus('読み上げ準備中...');
      updateListenUI();
      setTimeout(() => {
        handler(tok)
          .catch(err => console.warn('[Listener]', err))
          .finally(() => { if (tok === this.token) this.stop(); });
      }, 60);
    },

    stop(silent) {
      this.token++;
      const was = this.active;
      this.active = false;
      this.section = null;
      try { window.speechSynthesis.cancel(); } catch (e) {}
      document.querySelectorAll('.ls-reading').forEach(el => el.classList.remove('ls-reading'));
      updateListenUI();
      if (was && !silent) this.setStatus('停止しました');
    },

    toggle(section, startIndex) {
      if (this.active && this.section === section) this.stop();
      else this.start(section, startIndex);
    }
  };
  window.SectionListener = Listener;

  function scrollIntoViewIfNeeded(el) {
    try {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (r.top < 90 || r.bottom > vh - 90) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {}
  }

  function answerIntro(q) {
    const opt = (q.options && q.options[q.answer]) || '';
    try { return QuestionTargetHelper.getSpeechIntro(q.question, q.answer, opt); }
    catch (e) { return `正解は${q.answer + 1}番。${opt}`; }
  }

  function logicHtml(q) {
    try { return QuestionTargetHelper.getLogicSummaryHtml(q.question, q.answer, q.options[q.answer]); }
    catch (e) { return ''; }
  }

  // ---------- 段階ステップ ----------
  function revealStageWithoutScoring(q) {
    for (let i = 0; i < q.options.length; i++) {
      const btn = $(`stageOptBtn_${i}`);
      if (!btn) continue;
      btn.disabled = true;
      if (i === q.answer) btn.classList.add('correct');
    }
    const expBox = $('stagePlayExp');
    const expContent = $('stagePlayExpContent');
    const expBadge = $('stagePlayExpBadge');
    if (expBadge) { expBadge.textContent = '🎧 聞き流し：正答と解説（採点対象外）'; expBadge.className = 'exp-badge text-gold'; }
    if (expContent) expContent.innerHTML = `${logicHtml(q)}<div style="margin-top: 10px; line-height: 1.6;">${escapeHtml(q.explanation)}</div>`;
    if (expBox) expBox.style.display = 'block';
  }

  async function runStages(tok) {
    while (Listener.alive(tok)) {
      const sp = AppState.stagePlay;
      const q = sp.questions[sp.currentIndex];
      if (!q || !isVisible($('stagePlayModal')) || !isVisible($('stagePlayCard'))) break;
      Listener.setStatus(`STAGE ${sp.stageNum}：第${sp.currentIndex + 1}問 / ${sp.questions.length}`);
      if (sp.answers[sp.currentIndex] === undefined) {
        if (!await Listener.say(`第${sp.currentIndex + 1}問。${q.question}`, $('stagePlayQuestion'), tok)) return;
        for (let i = 0; i < q.options.length; i++) {
          if (!await Listener.say(`${i + 1}番。${q.options[i]}`, $(`stageOptBtn_${i}`), tok)) return;
        }
        if (!await Listener.wait(2500, tok)) return;
        revealStageWithoutScoring(q);
      }
      if (!await Listener.say(`${answerIntro(q)} 解説。${q.explanation}`, $('stagePlayExp'), tok)) return;
      if (!await Listener.wait(1500, tok)) return;
      if (sp.currentIndex < sp.questions.length - 1) {
        sp.currentIndex++;
        renderStagePlayQuestion();
      } else {
        showVersionToast('🎧 このステージの聞き流しが完了しました。次は自力で解いて確認しましょう！');
        break;
      }
    }
  }

  // ---------- 本番模擬試験（受験中） ----------
  async function runMock(tok) {
    while (Listener.alive(tok)) {
      const exam = AppState.mockExam;
      const q = exam.questions[exam.currentIndex];
      if (!q || !isVisible($('mockExamRunning'))) break;
      Listener.setStatus(`模擬試験：第${exam.currentIndex + 1}問 / ${exam.questions.length}`);
      if (!await Listener.say(`第${exam.currentIndex + 1}問。${q.question}`, $('mockQText'), tok)) return;
      const items = document.querySelectorAll('#mockQOptions .option-item');
      for (let i = 0; i < q.options.length; i++) {
        if (!await Listener.say(`${i + 1}番。${q.options[i]}`, items[i], tok)) return;
      }
      if (!await Listener.wait(2500, tok)) return;
      if (items[q.answer]) items[q.answer].classList.add('cheat-revealed');
      const peek = $('mockCheatPeekBox');
      if (peek) {
        peek.innerHTML = `<div style="font-weight: 800; color: var(--accent-gold); margin-bottom: 6px;">🎧 聞き流し：正答【${q.answer + 1}番】と解説</div>${logicHtml(q)}<div style="font-size: 0.88rem; line-height: 1.6; white-space: pre-wrap; color: var(--text-sub);">${escapeHtml(q.explanation)}</div>`;
        peek.style.display = 'block';
      }
      if (!await Listener.say(`${answerIntro(q)} 解説。${q.explanation}`, peek, tok)) return;
      if (!await Listener.wait(1500, tok)) return;
      if (exam.currentIndex < exam.questions.length - 1) jumpToMockQuestion(exam.currentIndex + 1);
      else { showVersionToast('🎧 全問の聞き流しが完了しました。'); break; }
    }
  }

  // ---------- 模擬試験 結果（全問解説） ----------
  async function runMockResult(tok) {
    const list = $('mockReviewList');
    if (list) list.style.display = 'flex';
    const exam = AppState.mockExam;
    const items = document.querySelectorAll('#mockReviewList .review-item');
    for (let i = Listener.startIndex; i < exam.questions.length; i++) {
      const q = exam.questions[i];
      const ua = exam.answers[i];
      Listener.setStatus(`解説：第${i + 1}問 / ${exam.questions.length}`);
      const judge = ua === undefined ? '未解答' : (ua === q.answer ? '正解' : '不正解');
      const text = `第${i + 1}問、${judge}。${q.question}。${answerIntro(q)} 解説。${q.explanation}`;
      if (!await Listener.say(text, items[i], tok)) return;
      if (!await Listener.wait(1500, tok)) return;
    }
  }

  // ---------- 分野別特訓 ----------
  function drillAnswered() { return isVisible($('drillExplanationBox')); }

  function revealDrillWithoutScoring(q) {
    const items = document.querySelectorAll('#drillOptions .option-item');
    items.forEach((item, idx) => {
      item.onclick = null;
      if (idx === q.answer) {
        item.style.borderColor = 'var(--accent-green)';
        item.style.backgroundColor = 'var(--accent-green-bg)';
      }
    });
    $('drillExpHeader').innerHTML = '<span style="color: var(--accent-gold);">🎧 聞き流し：正答と解説（採点対象外）</span>';
    $('drillExpContent').innerHTML = `${logicHtml(q)}<div style="margin-top: 10px; line-height: 1.6;">${escapeHtml(q.explanation)}</div>`;
    $('drillExplanationBox').style.display = 'block';
  }

  function drillNext() {
    const d = AppState.drill;
    d.currentIndex++;
    if (d.currentIndex >= d.questions.length) d.currentIndex = 0; // alert を避けて先頭へループ
    renderDrillQuestion();
  }

  async function runDrill(tok) {
    while (Listener.alive(tok)) {
      const d = AppState.drill;
      const q = d.questions[d.currentIndex];
      if (!q) break;
      Listener.setStatus(`分野別特訓：${d.currentIndex + 1} / ${d.questions.length}問`);
      if (!drillAnswered()) {
        if (!await Listener.say(q.question, $('drillQuestionText'), tok)) return;
        const items = document.querySelectorAll('#drillOptions .option-item');
        for (let i = 0; i < q.options.length; i++) {
          if (!await Listener.say(`${i + 1}番。${q.options[i]}`, items[i], tok)) return;
        }
        if (!await Listener.wait(2500, tok)) return;
        revealDrillWithoutScoring(q);
      }
      if (!await Listener.say(`${answerIntro(q)} 解説。${q.explanation}`, $('drillExplanationBox'), tok)) return;
      if (!await Listener.wait(1500, tok)) return;
      drillNext();
    }
  }

  // ---------- 経験記述（模範解答） ----------
  async function runEssay(tok) {
    const sel = $('essayThemeSelect');
    const themes = (AppState.essayTemplates && AppState.essayTemplates.themes) || [];
    if (!themes.length) return;
    let idx = Math.max(0, themes.findIndex(t => t.id === (sel && sel.value)));
    while (Listener.alive(tok)) {
      const t = themes[idx];
      if (sel) sel.value = t.id;
      renderEssaySample();
      const s = t.sample;
      Listener.setStatus(`経験記述 模範解答：${t.name}`);
      if (!await Listener.say(`テーマ、${t.name}。合格記述の勘所。${t.point_guide || ''}`, $('themePointGuide'), tok)) return;
      const blocks = document.querySelectorAll('#sampleContent .sample-block');
      const parts = [
        `工事概要。${s.project_name}。${s.structure}。立場、${s.role}。`,
        `設問1、技術的課題。${s.problem}`,
        `設問2、検討事項。${s.consideration}`,
        `設問3、具体的措置と結果。${s.action}`
      ];
      for (let i = 0; i < parts.length; i++) {
        if (!await Listener.say(parts[i], blocks[i], tok)) return;
        if (!await Listener.wait(800, tok)) return;
      }
      if (!await Listener.wait(2000, tok)) return;
      idx = (idx + 1) % themes.length;
    }
  }

  function speakEssayDraft() {
    const g = (id) => ($(id) ? $(id).value.trim() : '');
    const text = [
      g('projName') && `工事件名、${g('projName')}。`,
      g('essayProblem') && `設問1。${g('essayProblem')}`,
      g('essayConsideration') && `設問2。${g('essayConsideration')}`,
      g('essayAction') && `設問3。${g('essayAction')}`
    ].filter(Boolean).join('\n');
    if (!text) { alert('下書きが入力されていません。'); return; }
    speakSingleText(text);
  }

  // ---------- 実地記述・工程表 ----------
  async function runPractical(tok) {
    const qs = AppState.questions2nd || [];
    if (!qs.length) return;
    let i = Listener.startIndex % qs.length;
    while (Listener.alive(tok)) {
      const q = qs[i];
      const card = document.querySelectorAll('#practicalQuestionsList .practical-card')[i];
      Listener.setStatus(`実地記述：第${i + 1}問 / ${qs.length}`);
      if (!await Listener.say(`第${i + 1}問。${q.theme}。${q.question}`, card, tok)) return;
      if (!await Listener.wait(3000, tok)) return;
      const box = $(`practicalAnsBox-${i}`);
      if (box) box.style.display = 'block';
      const ans = `模範解答。${(q.model_answers || []).join('\n')}\n必須キーワード。${(q.keywords || []).join('、')}。`;
      if (!await Listener.say(ans, box, tok)) return;
      if (!await Listener.wait(2000, tok)) return;
      i = (i + 1) % qs.length;
    }
  }

  // ---------- 重要数値カード ----------
  async function runFlashcards(tok) {
    while (Listener.alive(tok)) {
      const card = AppState.numbersCards[AppState.flashcard.currentIndex];
      if (!card) break;
      Listener.setStatus(`数値カード：${AppState.flashcard.currentIndex + 1} / ${AppState.numbersCards.length}`);
      const main = $('mainFlashcard');
      if (main && main.classList.contains('flipped')) renderFlashcard();
      if (!await Listener.say(`${card.title}。${card.question}`, main, tok)) return;
      if (!await Listener.wait(2500, tok)) return;
      if (main && !main.classList.contains('flipped')) flipCurrentCard();
      if (!await Listener.say(`正解。${card.answer}。ポイント。${card.point}`, main, tok)) return;
      if (!await Listener.wait(1500, tok)) return;
      changeFlashcard(1);
    }
  }

  // ---------- 用語・漢字辞典 ----------
  function filteredTerms() {
    let list = AppState.termsMaster || [];
    const tm = TermsMaster;
    if (tm.currentCategory !== 'all') list = list.filter(t => t.category === tm.currentCategory);
    if (tm.searchQuery) {
      const sq = tm.searchQuery;
      list = list.filter(t => ['term', 'reading', 'definition', 'trap', 'keyPoint'].some(k => t[k] && String(t[k]).toLowerCase().includes(sq)));
    }
    return list;
  }

  async function runTerms(tok) {
    const list = filteredTerms();
    if (!list.length) return;
    let i = Listener.startIndex % list.length;
    while (Listener.alive(tok)) {
      if (!isVisible($('termsMasterModal'))) break;
      const t = list[i];
      const card = document.querySelectorAll('#termsMasterList .term-card')[i];
      Listener.setStatus(`用語辞典：${i + 1} / ${list.length}語`);
      const text = `${t.term}。読み方、${t.reading}。${t.definition || ''}${t.trap ? '\nひっかけ注意。' + t.trap : ''}${t.keyPoint ? '\n重要ポイント。' + t.keyPoint : ''}`;
      if (!await Listener.say(text, card, tok)) return;
      if (!await Listener.wait(1200, tok)) return;
      i = (i + 1) % list.length;
    }
  }

  const HANDLERS = {
    stages: runStages,
    mock: runMock,
    mockResult: runMockResult,
    drill: runDrill,
    essay: runEssay,
    practical: runPractical,
    flashcards: runFlashcards,
    terms: runTerms
  };

  // ==========================================================================
  // 4. 音声聞き流しタブの拡張（過去5年分・2次実地・用語辞典）
  // ==========================================================================
  function extendAudioLearner() {
    if (typeof AudioLearner === 'undefined' || AudioLearner._v211) return;
    AudioLearner._v211 = true;
    AudioLearner.past5yYear = 'all';
    const origBuild = AudioLearner.buildTracks.bind(AudioLearner);

    AudioLearner.buildTracks = function () {
      if (this.mode === 'past5y') {
        let pool = [...(AppState.questionsPast5y || [])];
        if (this.past5yYear !== 'all') pool = pool.filter(q => q.year_code === this.past5yYear);
        pool.sort((a, b) => (b.year_code || '').localeCompare(a.year_code || '') || (a.q_num || 0) - (b.q_num || 0));
        this.tracks = pool.map(q => ({
          id: q.id,
          type: '1st',
          title: `[${q.year || ''} 第${q.q_num || ''}問] ${q.subcategory || ''}`,
          badge: `🏛️ ${q.year || '過去問'} 本試験`,
          questionText: q.question,
          options: q.options || [],
          answerIndex: q.answer,
          answerText: answerIntro(q),
          explanationText: q.explanation,
          subInfo: `${q.year || ''} 第${q.q_num || ''}問`
        }));
      } else if (this.mode === 'practical2nd') {
        this.tracks = (AppState.questions2nd || []).map((q, i) => ({
          id: q.id,
          type: '2nd',
          title: `第${i + 1}問：${q.theme}（${q.subcategory || ''}）`,
          badge: '📐 2次検定 実地記述',
          questionText: q.question,
          options: [],
          answerIndex: -1,
          answerText: `模範解答。\n${(q.model_answers || []).join('\n')}`,
          explanationText: `必須キーワード。${(q.keywords || []).join('、')}。`,
          subInfo: q.scoring_points || ''
        }));
      } else if (this.mode === 'terms') {
        this.tracks = (AppState.termsMaster || []).map(t => ({
          id: t.id,
          type: 'terms',
          title: `${t.term}【${t.reading}】`,
          badge: `🧠 用語辞典（${t.category}）`,
          questionText: `${t.term}。読み方、${t.reading}。`,
          options: [],
          answerIndex: -1,
          answerText: t.definition || '',
          explanationText: `${t.trap ? 'ひっかけ注意。' + t.trap + '\n' : ''}${t.keyPoint ? '重要ポイント。' + t.keyPoint : ''}`,
          subInfo: t.keyPoint || ''
        }));
      } else {
        origBuild();
      }
      if (this.currentIndex >= this.tracks.length) this.currentIndex = 0;
    };

    // 聞き流しタブ再生時はセクション聞き流しを停止
    const origPlay = AudioLearner.play.bind(AudioLearner);
    AudioLearner.play = function () {
      if (Listener.active) Listener.stop(true);
      return origPlay();
    };

    const modeSelect = $('audioModeSelect');
    if (modeSelect && !modeSelect.querySelector('option[value="past5y"]')) {
      const add = (value, label, before) => {
        const o = document.createElement('option');
        o.value = value;
        o.textContent = label;
        const ref = before ? modeSelect.querySelector(`option[value="${before}"]`) : null;
        modeSelect.insertBefore(o, ref);
      };
      add('past5y', '🏛️ 過去5年分 本試験問題（R06〜R02・全200問）', 'essay_samples');
      add('practical2nd', '📐 2次検定 実地記述・工程表（模範解答）', 'numbers');
      add('terms', '🧠 重要用語・漢字辞典（読み・定義・ひっかけ）', null);
    }

    const stageContainer = $('audioStageFilterContainer');
    if (stageContainer && !$('audioYearFilterContainer')) {
      const wrap = document.createElement('div');
      wrap.id = 'audioYearFilterContainer';
      wrap.style.cssText = 'display: none; flex-direction: column;';
      wrap.innerHTML = `
        <label style="display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 4px; color: var(--text-sub);">年度指定：</label>
        <select id="audioYearFilterSelect" class="form-select" style="min-width: 200px;">
          <option value="all">🏛️ 過去5年分 全200問</option>
          <option value="R06">令和6年度（40問）</option>
          <option value="R05">令和5年度（40問）</option>
          <option value="R04">令和4年度（40問）</option>
          <option value="R03">令和3年度（40問）</option>
          <option value="R02">令和2年度（40問）</option>
        </select>`;
      stageContainer.parentNode.insertBefore(wrap, stageContainer.nextSibling);
      $('audioYearFilterSelect').addEventListener('change', (e) => {
        AudioLearner.pause();
        AudioLearner.past5yYear = e.target.value;
        AudioLearner.currentIndex = 0;
        renderAudioTab();
      });
    }

    if (modeSelect) {
      modeSelect.addEventListener('change', () => {
        const yc = $('audioYearFilterContainer');
        if (yc) yc.style.display = modeSelect.value === 'past5y' ? 'flex' : 'none';
      });
    }

    // 音声選択（聞き流しタブの操作行）
    const ctrlRow = document.querySelector('#tab-audio .audio-controls-row');
    if (ctrlRow && !ctrlRow.querySelector('.ls-voice-select')) {
      const div = document.createElement('div');
      div.className = 'speed-selector';
      div.innerHTML = '<span>音声:</span><select class="form-select speed-select ls-voice-select" title="読み上げ音声（Windowsは Nanami / Keita 推奨）"></select>';
      ctrlRow.appendChild(div);
      renderVoiceSelects();
    }
  }

  function playPast5yInAudioTab(yearCode) {
    if (typeof AudioLearner === 'undefined') return;
    Listener.stop(true);
    switchTab('audio');
    const modeSelect = $('audioModeSelect');
    if (modeSelect) modeSelect.value = 'past5y';
    AudioLearner.mode = 'past5y';
    AudioLearner.past5yYear = yearCode || 'all';
    const ys = $('audioYearFilterSelect');
    if (ys) ys.value = AudioLearner.past5yYear;
    const yc = $('audioYearFilterContainer');
    if (yc) yc.style.display = 'flex';
    const sc = $('audioStageFilterContainer');
    if (sc) sc.style.display = 'none';
    AudioLearner.stopSpeechImmediately();
    AudioLearner.currentIndex = 0;
    renderAudioTab();
    AudioLearner.play();
  }

  function listenSelectedMockSetup() {
    const modeEl = document.querySelector('input[name="mockMode"]:checked');
    const mode = modeEl ? modeEl.value : 'past';
    if (mode === 'past') {
      const yearEl = document.querySelector('input[name="mockYear"]:checked');
      const y = yearEl ? yearEl.value : 'R06';
      playPast5yInAudioTab(y === 'all5y' ? 'all' : y);
    } else {
      switchTab('audio');
      const modeSelect = $('audioModeSelect');
      if (modeSelect) modeSelect.value = '1st_questions';
      AudioLearner.mode = '1st_questions';
      const sc = $('audioStageFilterContainer');
      if (sc) sc.style.display = 'none';
      AudioLearner.currentIndex = 0;
      renderAudioTab();
      AudioLearner.play();
    }
  }

  // ==========================================================================
  // 5. UI 注入（各セクションのボタン・フローティングプレイヤー）
  // ==========================================================================
  function lsButton(section, label, extraClass) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `btn btn-outline btn-xs ls-btn ${extraClass || ''}`;
    b.dataset.section = section;
    b.dataset.label = label;
    b.title = `${label}（キーボード: L）`;
    b.innerHTML = `<span>🎧</span> <span class="ls-btn-label">${label}</span>`;
    b.addEventListener('click', (e) => { e.stopPropagation(); Listener.toggle(section); });
    return b;
  }

  function plainButton(label, title, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-outline btn-xs';
    b.innerHTML = label;
    b.title = title;
    b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
    return b;
  }

  function injectUI() {
    // 段階ステップ（モーダルヘッダー）
    const stageCheat = $('stageCheatModeBtn');
    if (stageCheat && !document.querySelector('.ls-btn[data-section="stages"]')) {
      stageCheat.parentNode.insertBefore(lsButton('stages', '聞き流し'), stageCheat);
    }

    // 模擬試験（受験中ヘッダー＆問題カード）
    const mockCheat = $('mockCheatModeBtn');
    if (mockCheat && !document.querySelector('.ls-btn[data-section="mock"]')) {
      mockCheat.parentNode.insertBefore(lsButton('mock', '聞き流し'), mockCheat);
    }
    const mockFlag = $('mockFlagBtn');
    if (mockFlag && !$('lsMockSpeakBtn')) {
      const b = plainButton('🔊 問題を聴く', '問題文と選択肢を読み上げ（キーボード: S）', speakCurrentMockQuestion);
      b.id = 'lsMockSpeakBtn';
      b.style.marginLeft = 'auto';
      mockFlag.style.marginLeft = '6px';
      mockFlag.parentNode.insertBefore(b, mockFlag);
    }

    // 模擬試験 設定画面
    const startBtn = $('startMockExamBtn');
    if (startBtn && !$('lsMockSetupBtn')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = 'lsMockSetupBtn';
      b.className = 'btn btn-outline btn-block ls-setup-btn';
      b.innerHTML = '🎧 選択中の年度・過去問を聞き流す（問題 ➔ 選択肢 ➔ 正答・解説を自動連続再生）';
      b.addEventListener('click', listenSelectedMockSetup);
      startBtn.parentNode.insertBefore(b, startBtn.nextSibling);
    }

    // 模擬試験 結果画面
    const resultActions = document.querySelector('#mockExamResult .result-actions');
    if (resultActions && !resultActions.querySelector('.ls-btn')) {
      resultActions.appendChild(lsButton('mockResult', '全問の解説を聞き流す', 'btn-sm'));
    }

    // 分野別特訓
    const drillMeta = document.querySelector('#drillCard .drill-meta');
    if (drillMeta && !$('lsDrillSpeakQ')) {
      const wrap = document.createElement('div');
      wrap.className = 'ls-inline-tools';
      const q = plainButton('🔊 問題を聴く', '問題文と選択肢を読み上げ（S）', speakCurrentDrillQuestion);
      q.id = 'lsDrillSpeakQ';
      const ex = plainButton('🔊 解説を聴く', '正答と解説を読み上げ', speakCurrentDrillExp);
      wrap.appendChild(lsButton('drill', '聞き流し'));
      wrap.appendChild(q);
      wrap.appendChild(ex);
      drillMeta.parentNode.insertBefore(wrap, drillMeta.nextSibling);
    }

    // 経験記述
    const themeSel = document.querySelector('#tab-essay .essay-theme-selector');
    if (themeSel && !themeSel.querySelector('.ls-btn')) {
      const b = lsButton('essay', '模範解答を聞き流す（全4テーマ）', 'btn-sm');
      b.style.marginTop = '8px';
      themeSel.appendChild(b);
    }
    const editorActions = document.querySelector('#tab-essay .editor-actions');
    if (editorActions && !$('lsEssayDraftBtn')) {
      const b = plainButton('🔊 下書きを耳でチェック', '自分の下書きを読み上げて文章の流れ・誤字を耳で確認', speakEssayDraft);
      b.id = 'lsEssayDraftBtn';
      b.classList.replace('btn-xs', 'btn-sm');
      editorActions.insertBefore(b, editorActions.firstChild);
    }

    // 実地記述
    const practicalHeader = document.querySelector('#tab-practical2nd .practical-header');
    if (practicalHeader && !practicalHeader.querySelector('.ls-btn')) {
      practicalHeader.style.display = 'flex';
      practicalHeader.style.justifyContent = 'space-between';
      practicalHeader.style.alignItems = 'center';
      practicalHeader.style.flexWrap = 'wrap';
      practicalHeader.style.gap = '12px';
      practicalHeader.appendChild(lsButton('practical', '全問を聞き流す（問題 ➔ 模範解答）', 'btn-sm'));
    }

    // 数値カード
    const cardControls = document.querySelector('#tab-flashcards .card-controls');
    if (cardControls && !cardControls.querySelector('.ls-btn')) {
      const b = lsButton('flashcards', '聞き流し（自動めくり）');
      b.classList.replace('btn-xs', 'btn-sm');
      cardControls.insertBefore(b, cardControls.firstChild);
    }

    // 用語辞典
    const termsHeader = document.querySelector('#termsMasterModal .stage-play-header');
    if (termsHeader && !termsHeader.querySelector('.ls-btn')) {
      const close = termsHeader.querySelector('.btn-close');
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display: flex; align-items: center; gap: 8px;';
      termsHeader.insertBefore(wrap, close);
      wrap.appendChild(lsButton('terms', '表示中の用語を聞き流す'));
      wrap.appendChild(close);
    }

    // フローティング聞き流しプレイヤー
    if (!$('lsPlayer')) {
      const p = document.createElement('div');
      p.id = 'lsPlayer';
      p.className = 'ls-player';
      p.innerHTML = `
        <span class="ls-player-dot"></span>
        <div class="ls-player-info">
          <strong id="lsPlayerSection">🎧 聞き流し中</strong>
          <span id="lsPlayerStatus">待機中</span>
        </div>
        <select class="form-select ls-rate-select" title="読み上げ速度">
          <option value="0.8">0.8x</option><option value="1">1.0x</option><option value="1.2">1.2x</option>
          <option value="1.5">1.5x</option><option value="1.8">1.8x</option><option value="2">2.0x</option>
        </select>
        <select class="form-select ls-voice-select" title="読み上げ音声"></select>
        <button type="button" class="btn btn-danger btn-xs" id="lsPlayerStop" title="停止（Esc）">⏹ 停止</button>`;
      document.body.appendChild(p);
      $('lsPlayerStop').addEventListener('click', () => Listener.stop());
    }

    document.querySelectorAll('.ls-rate-select').forEach(s => {
      s.value = String(VoiceManager.rate);
      if (![...s.options].some(o => o.value === s.value)) s.value = '1';
      if (!s._bound) { s._bound = true; s.addEventListener('change', () => VoiceManager.setRate(s.value)); }
    });
    renderVoiceSelects();

    // デスクトップ キーボード操作バー
    const header = document.querySelector('.app-header');
    if (header && !$('desktopShortcutBar')) {
      const bar = document.createElement('div');
      bar.id = 'desktopShortcutBar';
      bar.className = 'desktop-shortcut-bar';
      bar.innerHTML = `
        <div class="desktop-shortcut-inner">
          <span class="shortcut-bar-title">⌨️ PC・Windows キー操作:</span>
          <span class="kb-item"><kbd>1</kbd>〜<kbd>4</kbd> 解答</span>
          <span class="kb-item"><kbd>Enter</kbd>/<kbd>→</kbd> 次へ</span>
          <span class="kb-item"><kbd>←</kbd> 前へ</span>
          <span class="kb-item"><kbd>L</kbd> 🎧聞き流し</span>
          <span class="kb-item"><kbd>S</kbd> 🔊読み上げ</span>
          <span class="kb-item"><kbd>C</kbd> 👀カンニング</span>
          <span class="kb-item"><kbd>F</kbd> 🚩見直し／カード反転</span>
          <span class="kb-item"><kbd>Space</kbd> 再生/一時停止（聞き流しタブ）</span>
          <span class="kb-item"><kbd>Esc</kbd> 停止・閉じる</span>
          <button type="button" class="kb-close" title="非表示（ヘッダーの ⌨️ で再表示）">✕</button>
        </div>`;
      header.appendChild(bar);
      bar.querySelector('.kb-close').addEventListener('click', () => setShortcutBar(false));
    }
    const actions = document.querySelector('.header-actions');
    if (actions && !$('kbGuideToggleBtn')) {
      const b = document.createElement('button');
      b.type = 'button';
      b.id = 'kbGuideToggleBtn';
      b.className = 'btn btn-outline btn-sm hide-mobile kb-toggle-btn';
      b.title = 'PC・Windows キーボードショートカット一覧の表示切替';
      b.innerHTML = '⌨️ <span>キー操作</span>';
      b.addEventListener('click', () => setShortcutBar(!document.body.classList.contains('kb-bar-on')));
      actions.insertBefore(b, actions.firstChild);
    }
    const saved = localStorage.getItem('sekou2_kb_bar');
    setShortcutBar(saved === null ? isDesktop() : saved === 'true', true);

    updateListenUI();
  }

  function isDesktop() {
    return window.matchMedia && window.matchMedia('(pointer: fine)').matches && window.innerWidth >= 900;
  }

  function setShortcutBar(on, noSave) {
    document.body.classList.toggle('kb-bar-on', !!on);
    if (!noSave) localStorage.setItem('sekou2_kb_bar', on ? 'true' : 'false');
  }

  function renderVoiceSelects() {
    const sels = document.querySelectorAll('.ls-voice-select');
    if (!sels.length) return;
    const voices = VoiceManager.voices || [];
    const html = voices.length
      ? voices.map(v => `<option value="${escapeHtml(v.name)}">${escapeHtml(v.name.replace(/^Microsoft\s*/, '').replace(/\s*-\s*Japanese.*$/i, ''))}</option>`).join('')
      : '<option value="">既定の日本語音声</option>';
    sels.forEach(s => {
      s.innerHTML = html;
      if (VoiceManager.voice) s.value = VoiceManager.voice.name;
      if (!s._bound) { s._bound = true; s.addEventListener('change', () => VoiceManager.setVoice(s.value)); }
    });
  }

  function updateListenUI() {
    document.body.classList.toggle('ls-active', Listener.active);
    document.querySelectorAll('.ls-btn').forEach(b => {
      const on = Listener.active && Listener.section === b.dataset.section;
      b.classList.toggle('active', on);
      const label = b.querySelector('.ls-btn-label');
      if (label) label.textContent = on ? '聞き流し停止' : b.dataset.label;
    });
    const p = $('lsPlayer');
    if (p) p.classList.toggle('show', Listener.active);
    const sec = $('lsPlayerSection');
    if (sec && Listener.section) sec.textContent = `🎧 聞き流し中：${SECTION_LABELS[Listener.section] || ''}`;
  }

  // ---------- 単発読み上げ ----------
  function speakCurrentMockQuestion() {
    const exam = AppState.mockExam;
    const q = exam && exam.questions[exam.currentIndex];
    if (!q) return;
    const opts = q.options.map((o, i) => `${i + 1}番、${o}`).join('。\n');
    speakSingleText(`${q.question}\n選択肢。\n${opts}`);
  }

  function speakCurrentDrillQuestion() {
    const d = AppState.drill;
    const q = d.questions[d.currentIndex];
    if (!q) return;
    const opts = q.options.map((o, i) => `${i + 1}番、${o}`).join('。\n');
    speakSingleText(`${q.question}\n選択肢。\n${opts}`);
  }

  function speakCurrentDrillExp() {
    const d = AppState.drill;
    const q = d.questions[d.currentIndex];
    if (!q) return;
    speakSingleText(`${answerIntro(q)} 解説。${q.explanation}`);
  }

  // ==========================================================================
  // 6. 既存関数のラップ（停止連動・不具合修正）
  // ==========================================================================
  function wrapGlobals() {
    if (window._v211Wrapped) return;
    window._v211Wrapped = true;

    const origSwitch = window.switchTab;
    window.switchTab = function (tabId) {
      if (tabId === 'mock') tabId = 'mock-exam'; // 振り返り→再特訓時に画面が空になる不具合を修正
      if (Listener.active) Listener.stop(true);
      const r = origSwitch(tabId);
      if (tabId === 'mock-exam') { try { renderExamHistoryList(); } catch (e) {} }
      return r;
    };

    const origSingle = window.speakSingleText;
    window.speakSingleText = function () {
      if (Listener.active) Listener.stop(true);
      return origSingle.apply(this, arguments);
    };

    const origCloseStage = window.closeStagePlay;
    window.closeStagePlay = function () {
      if (Listener.section === 'stages') Listener.stop(true);
      return origCloseStage.apply(this, arguments);
    };

    const origCloseTerms = window.closeTermsMasterModal;
    if (origCloseTerms) {
      window.closeTermsMasterModal = function () {
        if (Listener.section === 'terms') Listener.stop(true);
        return origCloseTerms.apply(this, arguments);
      };
    }

    const origFinish = window.finishMockExam;
    window.finishMockExam = function () {
      if (Listener.section === 'mock') Listener.stop(true);
      return origFinish.apply(this, arguments);
    };

    // 実地記述：各問題に読み上げボタンを追加
    const origPractical = window.renderPractical2nd;
    window.renderPractical2nd = function () {
      const r = origPractical.apply(this, arguments);
      document.querySelectorAll('#practicalQuestionsList .practical-card').forEach((card, idx) => {
        const header = card.querySelector('.practical-q-header');
        if (!header || header.querySelector('.ls-card-tools')) return;
        const tools = document.createElement('span');
        tools.className = 'ls-card-tools';
        tools.appendChild(plainButton('🔊', 'この問題と模範解答を読み上げ', () => {
          const q = AppState.questions2nd[idx];
          speakSingleText(`${q.question}\n模範解答。\n${(q.model_answers || []).join('\n')}`);
        }));
        tools.appendChild(plainButton('🎧 ここから', 'この問題から連続聞き流し', () => Listener.start('practical', idx)));
        header.appendChild(tools);
      });
      return r;
    };

    // 用語辞典：カードごとに「ここから聞き流す」
    if (typeof TermsMaster !== 'undefined') {
      const origRender = TermsMaster.render.bind(TermsMaster);
      TermsMaster.render = function () {
        const r = origRender();
        document.querySelectorAll('#termsMasterList .term-card').forEach((card, idx) => {
          const header = card.querySelector('.term-header');
          if (!header || header.querySelector('.ls-term-from')) return;
          const b = plainButton('🎧 ここから', 'この用語から連続聞き流し', () => Listener.start('terms', idx));
          b.classList.add('ls-term-from');
          header.appendChild(b);
        });
        return r;
      };
    }
  }

  // ==========================================================================
  // 7. PC・Windows キーボードショートカット
  // ==========================================================================
  function activeTabId() {
    const t = document.querySelector('.tab-content.active');
    return t ? t.id.replace(/^tab-/, '') : '';
  }

  function onKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target && e.target.tagName) || '';
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable)) return;
    if (isVisible($('accessAuthModal'))) return;

    const key = e.key;
    const lower = key.length === 1 ? key.toLowerCase() : key;
    let num = 0;
    if (/^[1-4]$/.test(key)) num = parseInt(key, 10);
    else if (/^Numpad[1-4]$/.test(e.code)) num = parseInt(e.code.slice(-1), 10);

    const handled = () => { e.preventDefault(); e.stopPropagation(); };

    // Esc：停止 → モーダルを閉じる
    if (key === 'Escape') {
      if (Listener.active) { Listener.stop(); return handled(); }
      if (typeof AudioLearner !== 'undefined' && AudioLearner.isPlaying) { AudioLearner.pause(); return handled(); }
      if (window.speechSynthesis && window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); return handled(); }
      const modals = [
        ['termsMasterModal', () => closeTermsMasterModal()],
        ['examDetailReviewModal', () => closeExamReviewModal()],
        ['versionModal', () => closeVersionModal()],
        ['examScheduleModal', () => closeExamScheduleModal()],
        ['adminSecurityModal', () => closeAdminSecurityModal()],
        ['stagePlayModal', () => closeStagePlay()]
      ];
      for (const [id, fn] of modals) {
        if (isVisible($(id))) { fn(); return handled(); }
      }
      return;
    }

    // 用語辞典モーダル
    if (isVisible($('termsMasterModal'))) {
      if (lower === 'l') { Listener.toggle('terms'); return handled(); }
      return;
    }
    // その他の情報系モーダル表示中は無効
    if (['examDetailReviewModal', 'versionModal', 'examScheduleModal', 'adminSecurityModal'].some(id => isVisible($(id)))) return;

    // 段階ステップ（モーダル）
    if (isVisible($('stagePlayModal'))) {
      const sp = AppState.stagePlay;
      const playing = isVisible($('stagePlayCard'));
      if (num && playing) { handleStageOptionClick(num - 1); return handled(); }
      if ((key === 'Enter' || key === ' ' || key === 'ArrowRight') && playing && isVisible($('stagePlayExp'))) {
        nextStagePlayQuestion(); return handled();
      }
      if (lower === 's' || lower === 'v') {
        if (sp.answers[sp.currentIndex] !== undefined || isVisible($('stagePlayExp'))) speakCurrentStageExp();
        else speakCurrentStageQuestion();
        return handled();
      }
      if (lower === 'l' && playing) { Listener.toggle('stages'); return handled(); }
      if (lower === 'c') { toggleCheatMode(); return handled(); }
      return;
    }

    const tab = activeTabId();

    if (tab === 'mock-exam') {
      if (isVisible($('mockExamRunning'))) {
        if (num) { selectMockAnswer(num - 1); return handled(); }
        if (key === 'Enter' || key === 'ArrowRight') { changeMockQuestion(1); return handled(); }
        if (key === 'ArrowLeft') { changeMockQuestion(-1); return handled(); }
        if (lower === 'f') { toggleMockFlag(); return handled(); }
        if (lower === 'c') { toggleCheatMode(); return handled(); }
        if (lower === 's' || lower === 'v') { speakCurrentMockQuestion(); return handled(); }
        if (lower === 'l') { Listener.toggle('mock'); return handled(); }
      } else if (isVisible($('mockExamResult'))) {
        if (lower === 'l') { Listener.toggle('mockResult'); return handled(); }
      } else if (isVisible($('mockExamSetup'))) {
        if (lower === 'l') { listenSelectedMockSetup(); return handled(); }
      }
      return;
    }

    if (tab === 'drill') {
      const answered = drillAnswered();
      if (num && !answered) { answerDrillQuestion(num - 1); return handled(); }
      if ((key === 'Enter' || key === ' ' || key === 'ArrowRight') && answered) { $('drillNextBtn').click(); return handled(); }
      if (lower === 's' || lower === 'v') { answered ? speakCurrentDrillExp() : speakCurrentDrillQuestion(); return handled(); }
      if (lower === 'l') { Listener.toggle('drill'); return handled(); }
      return;
    }

    if (tab === 'flashcards') {
      if (key === ' ' || lower === 'f' || key === 'Enter') { flipCurrentCard(); return handled(); }
      if (key === 'ArrowRight') { changeFlashcard(1); return handled(); }
      if (key === 'ArrowLeft') { changeFlashcard(-1); return handled(); }
      if (lower === 's' || lower === 'v') { speakCurrentFlashcard(); return handled(); }
      if (lower === 'm') { toggleMasterCurrentCard(); return handled(); }
      if (lower === 'l') { Listener.toggle('flashcards'); return handled(); }
      return;
    }

    if (tab === 'essay' && lower === 'l') { Listener.toggle('essay'); return handled(); }
    if (tab === 'practical2nd' && lower === 'l') { Listener.toggle('practical'); return handled(); }

    if (tab === 'audio' && typeof AudioLearner !== 'undefined') {
      if (key === ' ' || lower === 'l') { AudioLearner.togglePlay(); return handled(); }
      if (key === 'ArrowRight') { AudioLearner.nextTrack(); return handled(); }
      if (key === 'ArrowLeft') { AudioLearner.prevTrack(); return handled(); }
      return;
    }

    if (tab === 'stages' && lower === 'l') { playStageInAudioLearner('all_unlocked'); return handled(); }
  }

  // ==========================================================================
  // 初期化
  // ==========================================================================
  function init() {
    try { wrapGlobals(); } catch (e) { console.warn('[v2.11 wrap]', e); }
    try { extendAudioLearner(); } catch (e) { console.warn('[v2.11 audio]', e); }
    try { injectUI(); } catch (e) { console.warn('[v2.11 ui]', e); }
    document.addEventListener('keydown', onKeyDown);
    if (IS_WINDOWS) document.body.classList.add('os-windows');
    // データ読み込み後に再描画（実地記述の各問ボタン等）
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      if ((AppState.questions2nd && AppState.questions2nd.length) || tries > 40) {
        clearInterval(iv);
        try { if (activeTabId() === 'practical2nd') renderPractical2nd(); } catch (e) {}
        VoiceManager.load();
      }
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
