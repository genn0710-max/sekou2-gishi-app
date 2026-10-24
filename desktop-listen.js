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
    // 見出しブラケット（続けざま読み上げ防止＆ポーズ挿入）
    [/【混同注意】/g, ' 混同注意。 '],
    [/【誤読[・･]混同注意】/g, ' 誤読・混同注意。 '],
    [/【誤読注意】/g, ' 誤読注意。 '],
    [/【([^】]+)】/g, ' $1。 '],

    // 助詞「は」の正確な発音化（カギ括弧引用直前や梁・柱等の「ハ」誤読防止）
    [/巻くのは、?/g, 'まくのわ、'],
    [/梁は、?/g, 'はりわ、'],
    [/柱は、?/g, 'はしらは、'],
    [/([^\s、。！？])のは\s*[「『]/g, '$1のわ、「'],
    [/([^\s、。！？])は\s*[「『]/g, '$1は、「'],

    // 梁（はり）の確定発音化（「りょう」誤読の完全防止）
    [/大梁/g, 'おおばり'],
    [/小梁/g, 'こばり'],
    [/基礎梁/g, 'きそばり'],
    [/境界梁/g, 'きょうかいばり'],
    [/梁せい/g, 'はりせい'],
    [/梁幅/g, 'はりはば'],
    [/梁主筋/g, 'はりしゅきん'],
    [/梁が/g, 'はりが'],
    [/梁を/g, 'はりを'],
    [/梁に/g, 'はりに'],
    [/梁の/g, 'はりの'],
    [/梁/g, 'はり'],

    // 地盤・山留め・遮水壁（v2.11.13追加・確定発音補正）
    [/地中遮水壁/g, 'ちちゅうしゃすいへき'],
    [/鋼矢板遮水壁/g, 'こうやいたしゃすいへき'],
    [/遮水壁施工/g, 'しゃすいへきせこう'],
    [/遮水壁工法/g, 'しゃすいへきこうほう'],
    [/遮水壁/g, 'しゃすいへき'],
    [/遮水層/g, 'しゃすいそう'],
    [/遮水工/g, 'しゃすいこう'],
    [/遮水シート/g, 'しゃすいシート'],
    [/遮水効果/g, 'しゃすいこうか'],
    [/遮水性/g, 'しゃすいせい'],
    [/遮水/g, 'しゃすい'],
    [/止水壁/g, 'しすいへき'],
    [/止水工/g, 'しすいこう'],
    [/止水板/g, 'しすいばん'],
    [/止水性/g, 'しすいせい'],
    [/止水/g, 'しすい'],

    // 基礎・杭工事・杭心（v2.11.14追加・確定発音補正）
    [/杭心ず[れレ]|杭芯ず[れレ]/g, 'くいしんずれ'],
    [/杭心位置|杭芯位置/g, 'くいしんいち'],
    [/杭心逃げ墨|杭芯逃げ墨/g, 'くいしんにげずみ'],
    [/杭心墨|杭芯墨/g, 'くいしんずみ'],
    [/杭心セット|杭芯セット/g, 'くいしんセット'],
    [/杭心管理|杭芯管理/g, 'くいしんかんり'],
    [/杭心確認|杭芯確認/g, 'くいしんかくにん'],
    [/杭心出[しシ]|杭芯出[しシ]/g, 'くいしんだし'],
    [/杭心測定|杭芯測定/g, 'くいしんそくてい'],
    [/杭心精度|杭芯精度/g, 'くいしんせいど'],
    [/杭心|杭芯/g, 'くいしん'],

    // 構造力学・剛心・壁厚・配筋（v2.11.8追加・確定発音補正）
    [/剛心/g, 'ごうしん'],
    [/剛性率/g, 'ごうせいりつ'],
    [/偏心率/g, 'へんしんりつ'],
    [/壁厚/g, 'かべあつ'],
    [/配筋検査/g, 'ハイキンケンサ'],
    [/配筋図/g, 'ハイキンズ'],
    [/配筋状況/g, 'ハイキンジョウキョウ'],
    [/配筋間隔/g, 'ハイキンカンカク'],
    [/配筋作業/g, 'ハイキンサギョウ'],
    [/配筋要領/g, 'ハイキンヨウリョウ'],
    [/配筋位置/g, 'ハイキンイチ'],
    [/配筋完了後/g, 'ハイキンカンリョウゴ'],
    [/配筋完了/g, 'ハイキンカンリョウ'],
    [/配筋前/g, 'ハイキンマエ'],
    [/配筋後/g, 'ハイキンゴ'],
    [/単筋配筋/g, 'タンキンハイキン'],
    [/現場配筋/g, 'ゲンバハイキン'],
    [/RC梁柱配筋/g, 'アールシーはりばしらハイキン'],
    [/梁柱配筋/g, 'はりばしらハイキン'],
    [/基礎配筋/g, 'きそハイキン'],
    [/柱配筋/g, 'はしらハイキン'],
    [/梁配筋/g, 'はりハイキン'],
    [/壁配筋/g, 'かべハイキン'],
    [/スラブ配筋/g, 'スラブハイキン'],
    [/ダブル配筋/g, 'ダブルハイキン'],
    [/シングル配筋/g, 'シングルハイキン'],
    [/複配筋/g, 'フクハイキン'],
    [/単配筋/g, 'タンハイキン'],
    [/主配筋/g, 'シュハイキン'],
    [/無配筋/g, 'ムハイキン'],
    [/配筋/g, 'ハイキン'],

    // 木材・材料・異方性（v2.11.8追加・確定発音補正）
    [/異方性材料/g, 'いほうせいざいりょう'],
    [/異方性/g, 'いほうせい'],

    // 地盤・土質・間隙水・オランダ二重管・砂利・実大基礎・泥水・掘削水・法肩（v2.11.8追加・確定発音補正）
    [/過剰間隙水圧/g, 'かじょうかんげきすいあつ'],
    [/間隙水圧/g, 'かんげきすいあつ'],
    [/間隙水/g, 'かんげきすい'],
    [/間隙比/g, 'かんげきひ'],
    [/間隙率/g, 'かんげきりつ'],
    [/間隙/g, 'かんげき'],
    [/オランダ二重管コーン貫入試験|オランダ式二重管コーン貫入試験/g, 'オランダしきにじゅうかんコーンかんにゅうしけん'],
    [/オランダ二重管|オランダ式二重管/g, 'オランダしきにじゅうかん'],
    [/二重管コーン貫入試験/g, 'にじゅうかんコーンかんにゅうしけん'],
    [/コーン貫入試験/g, 'コーンかんにゅうしけん'],
    [/静的コーン貫入試験/g, 'せいてきコーンかんにゅうしけん'],
    [/砂利地盤/g, 'じゃりじばん'],
    [/砂利敷き|砂利敷/g, 'じゃりしき'],
    [/川砂利/g, 'かわじゃり'],
    [/山砂利/g, 'やまじゃり'],
    [/砂利/g, 'じゃり'],
    [/実大基礎/g, 'じつだいきそ'],
    [/実大実験/g, 'じつだいじっけん'],
    [/実大試験/g, 'じつだいしけん'],
    [/実大/g, 'じつだい'],
    [/掘削水/g, 'くっさくすい'],
    [/泥水加圧シールド工法/g, 'でいすいかあつシールドこうほう'],
    [/泥水シールド工法/g, 'でいすいシールドこうほう'],
    [/泥水工法/g, 'でいすいこうほう'],
    [/泥水掘削/g, 'でいすいくっさく'],
    [/泥水/g, 'でいすい'],
    [/掘削法肩/g, 'くっさくのりかた'],
    [/法肩/g, 'のりかた'],
    [/法尻/g, 'のりじり'],
    [/法勾配/g, 'のりこうばい'],
    [/法面保護/g, 'のりめんほご'],
    [/法面/g, 'のりめん'],

    // 地盤改良・攪拌翼・改良体（v2.11.8追加・確定発音補正）
    [/攪拌翼|撹拌翼/g, 'かくはんよく'],
    [/攪拌体|撹拌体/g, 'かくはんたい'],
    [/改良体/g, 'かくはんたい'],
    [/機械攪拌|機械撹拌/g, 'きかいかくはん'],
    [/強制攪拌|強制撹拌/g, 'きょうせいかくはん'],
    [/攪拌混合|撹拌混合/g, 'かくはんこんごう'],
    [/攪拌機|撹拌機/g, 'かくはんき'],
    [/攪拌|撹拌/g, 'かくはん'],

    // 構造・主要部・主（v2.11.8追加・確定発音補正）
    [/主応力/g, 'しゅおうりょく'],
    [/主軸/g, 'しゅじく'],
    [/主梁/g, 'しゅばり'],
    [/主架構/g, 'しゅかこう'],
    [/主要構造部/g, 'しゅようこうぞうぶ'],
    [/主要構造/g, 'しゅようこうぞう'],
    [/主要部/g, 'しゅようぶ'],
    [/主筋/g, 'しゅきん'],

    // 材料・コンクリート・骨材・耐硫酸塩性・材齢・含水率（v2.11.8追加・確定発音補正）
    [/耐硫酸塩ポルトランドセメント/g, 'たいりゅうさんえんポルトランドセメント'],
    [/耐硫酸塩セメント/g, 'たいりゅうさんえんセメント'],
    [/耐硫酸塩性/g, 'たいりゅうさんえんせい'],
    [/耐硫酸塩/g, 'たいりゅうさんえん'],
    [/硫酸塩/g, 'りゅうさんえん'],
    [/人工軽量骨材/g, 'じんこうけいりょうこつざい'],
    [/軽量骨材/g, 'けいりょうこつざい'],
    [/再生骨材/g, 'さいせいこつざい'],
    [/砕石骨材/g, 'さいせきこつざい'],
    [/粗骨材/g, 'そこつざい'],
    [/細骨材/g, 'さいこつざい'],
    [/骨材粒度/g, 'こつざいりゅうど'],
    [/骨材/g, 'こつざい'],
    [/材齢28日|材齢２８日/g, 'ざいれいにじゅうはちにち'],
    [/材齢14日|材齢１４日/g, 'ざいれいじゅうよっか'],
    [/材齢7日|材齢７日/g, 'ざいれいなのか'],
    [/材齢3日|材齢３日/g, 'ざいれいみっか'],
    [/材齢初期/g, 'ざいれいしょき'],
    [/材齢/g, 'ざいれい'],
    [/気乾含水率/g, 'きかんがんすいりつ'],
    [/平衡含水率/g, 'へいこうがんすいりつ'],
    [/全乾含水率/g, 'ぜんかんがんすいりつ'],
    [/含水率/g, 'がんすいりつ'],
    [/含水比/g, 'がんすいひ'],
    [/含水量/g, 'がんすいりょう'],
    [/含水状態/g, 'がんすいじょうたい'],
    [/含水/g, 'がんすい'],

    // 測量・三次元座標（v2.11.8追加・確定発音補正）
    [/三次元座標/g, 'さんじげんざひょう'],
    [/二次元座標/g, 'にじげんざひょう'],
    [/三次元/g, 'さんじげん'],
    [/二次元/g, 'にじげん'],

    // 躯体構造・壁体・耐力壁・山留め（v2.11.7追加・確定発音補正）
    [/山留め壁体|山留壁体/g, 'やまどめへきたい'],
    [/壁体内結露/g, 'へきたいないけつろ'],
    [/壁体内部/g, 'へきたいないぶ'],
    [/壁体内/g, 'へきたいない'],
    [/壁体変位/g, 'へきたいへんい'],
    [/壁体/g, 'へきたい'],
    [/非耐力壁/g, 'ひたいりょくへき'],
    [/耐力壁線/g, 'たいりょくへきせん'],
    [/耐力壁/g, 'たいりょくへき'],
    [/耐震壁/g, 'たいしんへき'],

    // 温熱・気象・換気・外気温（v2.11.7追加・確定発音補正）
    [/外気温度/g, 'がいきおんど'],
    [/外気温/g, 'がいきおん'],
    [/外気側/g, 'がいきがわ'],
    [/外気冷房/g, 'がいきれいぼう'],
    [/外気導入/g, 'がいきどうにゅう'],
    [/外気/g, 'がいき'],

    // 音響・環境工学・低周波音・吸音（v2.11.7追加・確定発音補正）
    [/低周波騒音/g, 'ていしゅうはそうおん'],
    [/低周波振動/g, 'ていしゅうはしんどう'],
    [/低周波音/g, 'ていしゅうはおん'],
    [/低周波域/g, 'ていしゅうはいき'],
    [/低周波/g, 'ていしゅうは'],
    [/高周波騒音/g, 'こうしゅうはそうおん'],
    [/高周波音/g, 'こうしゅうはおん'],
    [/高周波域/g, 'こうしゅうはいき'],
    [/高周波/g, 'こうしゅうは'],
    [/多孔質吸音材/g, 'たこうしつきゅうおんざい'],
    [/多孔質吸音構造/g, 'たこうしつきゅうおんこうぞう'],
    [/板振動吸音構造/g, 'いたしんどうきゅうおんこうぞう'],
    [/吸音構造/g, 'きゅうおんこうぞう'],
    [/吸音材/g, 'きゅうおんざい'],
    [/吸音率/g, 'きゅうおんりつ'],
    [/吸音/g, 'きゅうおん'],

    // 測量・器高（v2.11.6追加・確定発音補正）
    [/器高式水準測量/g, 'きこうしきすいじゅんそくりょう'],
    [/器高式/g, 'きこうしき'],
    [/器高/g, 'きこう'],
    [/視準高/g, 'しじゅんこう'],
    [/機械高/g, 'きかいこう'],
    [/目標高/g, 'もくひょうこう'],

    // 空調・換気・吸排気口・排気設備・環境工学（v2.11.6追加・確定発音補正）
    [/吸排気口|給排気口/g, 'きゅうはいきこう'],
    [/吸排気筒|給排気筒/g, 'きゅうはいきとう'],
    [/吸排気ファン|給排気ファン/g, 'きゅうはいきファン'],
    [/吸排気/g, 'きゅうはいき'],
    [/給排気/g, 'きゅうはいき'],
    [/吸気口/g, 'きゅうきこう'],
    [/給気口/g, 'きゅうきこう'],
    [/自然排気口/g, 'しぜんはいきこう'],
    [/排気口/g, 'はいきこう'],
    [/排気筒/g, 'はいきとう'],
    [/排気ファン/g, 'はいきファン'],
    [/排気ダクト/g, 'はいきダクト'],
    [/排気設備/g, 'はいきせつび'],
    [/排気フード/g, 'はいきフード'],
    [/排気風量/g, 'はいきふうりょう'],
    [/自然排気/g, 'しぜんはいき'],
    [/機械排気/g, 'きかいはいき'],
    [/厨房排気/g, 'ちゅうぼうはいき'],
    [/排気機/g, 'はいきき'],
    [/給気機/g, 'きゅうきき'],
    [/排気圧/g, 'はいきあつ'],
    [/排気/g, 'はいき'],
    [/給気/g, 'きゅうき'],

    // 採光・日照・室形状・室指数（v2.11.6追加・確定発音補正）
    [/室形状/g, 'しつけいじょう'],
    [/室指数/g, 'しつしすう'],
    [/室容積/g, 'しつようせき'],
    [/昼光率/g, 'ちゅうこうりつ'],

    // コンクリート練混ぜ・製造管理（v2.11.6追加・確定発音補正）
    [/練混ぜ時間|練り混ぜ時間/g, 'ねりまぜじかん'],
    [/練混ぜ量|練り混ぜ量/g, 'ねりまぜりょう'],
    [/練混ぜ水|練り混ぜ水/g, 'ねりまぜすい'],
    [/練混ぜ開始|練り混ぜ開始/g, 'ねりまぜかいし'],
    [/練混ぜ完了|練り混ぜ完了/g, 'ねりまぜかんりょう'],
    [/練混ぜ機|練り混ぜ機/g, 'ねりまぜき'],
    [/練混ぜ時|練り混ぜ時/g, 'ねりまぜじ'],
    [/練混ぜ|練り混ぜ/g, 'ねりまぜ'],
    [/練上がり|練り上がり/g, 'ねりあがり'],

    // 敷地調査・地下埋設物・ガス管・各種設備配管（v2.11.4追加・確定発音補正）
    [/埋設物事前調査/g, 'まいせつぶつじぜんちょうさ'],
    [/地下埋設物/g, 'ちかまいせつぶつ'],
    [/地中埋設物/g, 'ちちゅうまいせつぶつ'],
    [/重要埋設物/g, 'じゅうようまいせつぶつ'],
    [/埋設物/g, 'まいせつぶつ'],
    [/埋設位置/g, 'まいせついち'],
    [/埋設深さ/g, 'まいせつふかさ'],
    [/埋設配管/g, 'まいせつはいかん'],
    [/埋設管/g, 'まいせつかん'],
    [/埋設部/g, 'まいせつぶ'],
    [/埋設/g, 'まいせつ'],
    [/石綿事前調査結果報告/g, 'いしわたじぜんちょうさけっかほうこく'],
    [/石綿事前調査/g, 'いしわたじぜんちょうさ'],
    [/事前調査結果報告/g, 'じぜんちょうさけっかほうこく'],
    [/事前調査結果/g, 'じぜんちょうさけっか'],
    [/事前調査/g, 'じぜんちょうさ'],
    [/ガス管/g, 'ガスかん'],
    [/ガス配管/g, 'ガスはいかん'],
    [/冷温水配管/g, 'れいおんすいはいかん'],
    [/冷温水管/g, 'れいおんすいかん'],
    [/冷媒配管/g, 'れいばいはいかん'],
    [/給湯用銅管/g, 'きゅうとうようどうかん'],
    [/給湯配管/g, 'きゅうとうはいかん'],
    [/給湯管/g, 'きゅうとうかん'],
    [/銅管/g, 'どうかん'],
    [/鋼管スリーブ/g, 'こうかんスリーブ'],
    [/さや管|サヤ管/g, 'さやかん'],
    [/防護管/g, 'ぼうごかん'],
    [/高圧送電線/g, 'こうあつそうでんせん'],
    [/敷地掘削/g, 'しきちくっさく'],
    [/敷地調査/g, 'しきちちょうさ'],
    [/人力掘削/g, 'じんりきくっさく'],
    [/手掘り/g, 'てぼり'],
    [/重機掘削/g, 'じゅうきくっさく'],
    [/試掘/g, 'しくつ'],
    // 水理・水頭・水位・水和反応・衛生給排水設備（v2.11.3追加・確定発音補正）
    [/圧力水頭/g, 'あつりょくすいとう'],
    [/位置水頭/g, 'いちすいとう'],
    [/速度水頭/g, 'そくどすいとう'],
    [/全水頭/g, 'ぜんすいとう'],
    [/水頭差/g, 'すいとうさ'],
    [/水頭/g, 'すいとう'],
    [/水和反応/g, 'すいわはんのう'],
    [/水和熱/g, 'すいわねつ'],
    [/水和生成物/g, 'すいわせいせいぶつ'],
    [/水和作用/g, 'すいわさよう'],
    [/水和速度/g, 'すいわそくど'],
    [/水和/g, 'すいわ'],
    [/水準測量/g, 'すいじゅんそくりょう'],
    [/水準点/g, 'すいじゅんてん'],
    [/水準器/g, 'すいじゅんき'],
    [/水準/g, 'すいじゅん'],
    [/揚水管/g, 'ようすいかん'],
    [/揚水ポンプ/g, 'ようすいポンプ'],
    [/揚水量/g, 'ようすいりょう'],
    [/揚水/g, 'ようすい'],
    [/給水管/g, 'きゅうすいかん'],
    [/給水装置/g, 'きゅうすいそうち'],
    [/給水方式/g, 'きゅうすいほうしき'],
    [/給水量/g, 'きゅうすいりょう'],
    [/通気立て管/g, 'つうきたてかん'],
    [/伸頂通気管/g, 'しんちょうつうきかん'],
    [/各個通気管/g, 'かっこつうきかん'],
    [/ループ通気管/g, 'ループつうきかん'],
    [/通気管/g, 'つうきかん'],
    [/通気層/g, 'つうきそう'],
    [/通気/g, 'つうき'],
    [/排水立て管/g, 'ハイスイたてかん'],
    [/間接排水/g, 'カンセツハイスイ'],
    [/直接排水/g, 'チョクセツハイスイ'],
    [/排水系統/g, 'ハイスイケイトウ'],
    [/排水管/g, 'ハイスイカン'],
    [/排水溝/g, 'ハイスイコウ'],
    [/排水設備/g, 'ハイスイセツビ'],
    [/排水勾配/g, 'ハイスイコウバイ'],
    [/排水トラップ/g, 'ハイスイトラップ'],
    [/排水/g, 'ハイスイ'],
    [/雨水排水/g, 'ウスイハイスイ'],
    [/雨水桝/g, 'うすいます'],
    [/雨水/g, 'うすい'],
    [/汚水系統/g, 'おすいけいとう'],
    [/汚水管/g, 'おすいかん'],
    [/汚水桝/g, 'おすいます'],
    [/汚水/g, 'おすい'],
    [/封水深/g, 'ふうすいしん'],
    [/封水/g, 'ふうすい'],
    [/破封/g, 'はふう'],
    // 地盤・土工事・山留め・計測管理用語（v2.11.2追加・確定発音補正）
    [/地下水位低下/g, 'ちかすいいていか'],
    [/地下水位/g, 'ちかすいい'],
    [/地下水低下/g, 'ちかすいていか'],
    [/地下水/g, 'ちかすい'],
    [/自然水位/g, 'しぜんすいい'],
    [/設計水位/g, 'せっけいすいい'],
    [/最高水位/g, 'さいこうすいい'],
    [/異常水位/g, 'いじょうすいい'],
    [/水位低下/g, 'すいいていか'],
    [/水位計/g, 'すいいけい'],
    [/水位/g, 'すいい'],
    [/砂質土地盤/g, 'さしつどじばん'],
    [/砂質土/g, 'さしつど'],
    [/粘性土地盤/g, 'ねんせいどじばん'],
    [/粘性土/g, 'ねんせいど'],
    [/有機質土/g, 'ゆうきしつど'],
    [/礫質土/g, 'れきしつど'],
    [/吸水管/g, 'きゅうすいかん'],
    [/吸水率/g, 'きゅうすいりつ'],
    [/吸水調整材/g, 'きゅうすいちょうせいざい'],
    [/吸水性/g, 'きゅうすいせい'],
    [/排土状況/g, 'はいどじょうきょう'],
    [/排土性状/g, 'はいどせいじょう'],
    [/掘削排土/g, 'くっさくはいど'],
    [/排土する/g, 'はいどする'],
    [/排土/g, 'はいど'],
    [/切梁端部/g, 'きりばりたんぶ'],
    [/切梁交差部/g, 'きりばりこうさぶ'],
    [/切梁中央部/g, 'きりばりちゅうおうぶ'],
    [/切梁軸力/g, 'きりばりじくりょく'],
    [/切梁プレロード/g, 'きりばりプレロード'],
    [/切梁/g, 'きりばり'],
    [/変位速度/g, 'へんいそくど'],
    [/水平変位/g, 'すいへいへんい'],
    [/壁体変位/g, 'へきたいへんい'],
    [/不同変位/g, 'ふどうへんい'],
    [/変位量/g, 'へんいりょう'],
    [/変位/g, 'へんい'],
    [/山留め壁|山留壁/g, 'やまどめかべ'],
    [/山留め支保工/g, 'やまどめしほこう'],
    [/柱状図/g, 'ちゅうじょうず'],
    [/盤ぶくれ/g, 'ばんぶくれ'],
    [/軟弱地盤/g, 'なんじゃくじばん'],
    [/透水係数/g, 'とうすいけいすう'],
    [/透水性/g, 'とうすいせい'],
    [/止水壁/g, 'しすいへき'],
    [/止水工/g, 'しすいこう'],
    [/止水板/g, 'しすいばん'],
    [/止水性/g, 'しすいせい'],
    [/止水/g, 'しすい'],

    // 基礎・杭工事・杭心（v2.11.14追加・確定発音補正）
    [/杭心ず[れレ]|杭芯ず[れレ]/g, 'くいしんずれ'],
    [/杭心位置|杭芯位置/g, 'くいしんいち'],
    [/杭心逃げ墨|杭芯逃げ墨/g, 'くいしんにげずみ'],
    [/杭心墨|杭芯墨/g, 'くいしんずみ'],
    [/杭心セット|杭芯セット/g, 'くいしんセット'],
    [/杭心管理|杭芯管理/g, 'くいしんかんり'],
    [/杭心確認|杭芯確認/g, 'くいしんかくにん'],
    [/杭心出[しシ]|杭芯出[しシ]/g, 'くいしんだし'],
    [/杭心測定|杭芯測定/g, 'くいしんそくてい'],
    [/杭心精度|杭芯精度/g, 'くいしんせいど'],
    [/杭心|杭芯/g, 'くいしん'],
    [/地中遮水壁/g, 'ちちゅうしゃすいへき'],
    [/鋼矢板遮水壁/g, 'こうやいたしゃすいへき'],
    [/遮水壁施工/g, 'しゃすいへきせこう'],
    [/遮水壁工法/g, 'しゃすいへきこうほう'],
    [/遮水壁/g, 'しゃすいへき'],
    [/遮水層/g, 'しゃすいそう'],
    [/遮水工/g, 'しゃすいこう'],
    [/遮水シート/g, 'しゃすいシート'],
    [/遮水効果/g, 'しゃすいこうか'],
    [/遮水性/g, 'しゃすいせい'],
    [/遮水/g, 'しゃすい'],
    [/土圧/g, 'どあつ'],
    [/水圧/g, 'すいあつ'],
    [/側圧/g, 'そくあつ'],
    [/梁端部/g, 'はりたんぶ'],
    [/柱端部/g, 'ちゅうたんぶ'],
    [/部材端部/g, 'ぶざいたんぶ'],
    [/止端部/g, 'したんぶ'],
    [/端部/g, 'たんぶ'],
    [/中央部/g, 'ちゅうおうぶ'],
    // 基礎・土工事・山留め
    [/親杭横矢板工法/g, 'おやくいよこやいたこうほう'],
    [/親柱横矢板工法/g, 'おやばしらよこやいたこうほう'],
    [/親杭横矢板/g, 'おやくいよこやいた'],
    [/親柱横矢板/g, 'おやばしらよこやいた'],
    [/親杭/g, 'おやくい'],
    [/親柱/g, 'おやばしら'],
    [/横矢板/g, 'よこやいた'],
    [/腹起し|腹起/g, 'はらおこし'],
    [/切梁/g, 'きりばり'],
    [/火打ち|火打/g, 'ひうち'],
    [/床付け面|床付面/g, 'とこづけめん'],
    [/床付け|床付/g, 'とこづけ'],
    [/釜場/g, 'かまば'],
    [/乗入れ構台/g, 'のりいれこうだい'],
    [/構台/g, 'こうだい'],
    [/水盛遣方|水盛遣形/g, 'みずもりやりかた'],
    [/遣方|遣形/g, 'やりかた'],
    [/逃げ墨/g, 'にげずみ'],
    [/親墨/g, 'おやずみ'],
    [/地墨/g, 'じずみ'],
    [/子墨/g, 'こずみ'],
    [/腰墨/g, 'こしずみ'],
    [/通り芯墨/g, 'とおりしんずみ'],
    [/心々|芯々/g, 'しんしん'],
    [/敷均し|敷ならし/g, 'しきならし'],
    [/小口径/g, 'しょうこうけい'],
    [/芯材/g, 'しんざい'],

    // コンクリート・打込み・打設・打放し・打継ぎ・打重ね
    [/打ち込み完了時間限度|打込み完了時間限度/g, 'うちこみかんりょうじかんげんど'],
    [/打ち込み時間限度|打込み時間限度/g, 'うちこみじかんげんど'],
    [/打ち込み時間制限|打込み時間制限/g, 'うちこみじかんせいげん'],
    [/打ち込み完了時|打込み完了時/g, 'うちこみかんりょうじ'],
    [/打ち込み終了時|打込み終了時/g, 'うちこみしゅうりょうじ'],
    [/打ち込み完了|打込み完了/g, 'うちこみかんりょう'],
    [/打ち込み終了|打込み終了/g, 'うちこみしゅうりょう'],
    [/打ち込み時|打込み時/g, 'うちこみじ'],
    [/打ち込み作業中|打込み作業中/g, 'うちこみさぎょうちゅう'],
    [/打ち込み作業|打込み作業/g, 'うちこみさぎょう'],
    [/打ち込み計画|打込み計画/g, 'うちこみけいかく'],
    [/打ち込み前受入検査|打込み前受入検査/g, 'うちこみまえうけいれけんさ'],
    [/打ち込み直前|打込み直前/g, 'うちこみちょくぜん'],
    [/打ち込み直後|打込み直後/g, 'うちこみちょくご'],
    [/打ち込み前|打込み前/g, 'うちこみまえ'],
    [/打ち込み後|打込み後/g, 'うちこみご'],
    [/打ち込み中|打込み中/g, 'うちこみちゅう'],
    [/打ち込み済(?:み)?|打込み済(?:み)?/g, 'うちこみずみ'],
    [/打ち込み面|打込み面/g, 'うちこみめん'],
    [/打ち込み速度|打込み速度/g, 'うちこみそくど'],
    [/打ち込み高さ|打込み高さ|打込み高/g, 'うちこみたかさ'],
    [/打ち込み落下高|打込み落下高/g, 'うちこみらっかだか'],
    [/打ち込み厚さ|打込み厚さ|打込み厚/g, 'うちこみあつさ'],
    [/打ち込み数量|打込み数量/g, 'うちこみすうりょう'],
    [/打ち込み区画割|打込み区画割/g, 'うちこみくかくわり'],
    [/打ち込み量|打込み量/g, 'うちこみりょう'],
    [/打ち込み天端|打込み天端/g, 'うちこみてんば'],
    [/打ち込みピン|打込みピン/g, 'うちこみピン'],
    [/打ち込み|打込み/g, 'うちこみ'],
    [/打ち込む|打込む/g, 'うちこむ'],
    [/打ち込んだ|打込んだ/g, 'うちこんだ'],
    [/打ち込んで|打込んで/g, 'うちこんで'],
    [/打ち込ん|打込ん/g, 'うちこん'],
    [/打ち込め|打込め/g, 'うちこめ'],
    [/打ち重ね時間間隔|打重ね時間間隔/g, 'うちがさねじかんかんかく'],
    [/打ち重ね時間限度|打重ね時間限度/g, 'うちがさねじかんげんど'],
    [/打ち重ね時間|打重ね時間/g, 'うちがさねじかん'],
    [/打ち重ね時|打重ね時/g, 'うちがさねじ'],
    [/打ち重ねる|打重ねる/g, 'うちがさねる'],
    [/打ち重ねた|打重ねた/g, 'うちがさねた'],
    [/打ち重ね|打重ね/g, 'うちがさね'],
    [/打継ぎ面|打ち継ぎ面|打継面/g, 'うちつぎめん'],
    [/打継ぎ部|打ち継ぎ部|打継部/g, 'うちつぎぶ'],
    [/打継ぎ目地|打継目地/g, 'うちつぎめじ'],
    [/打継ぎ目|打ち継ぎ目|打継目/g, 'うちつぎめ'],
    [/打継ぎ位置|打継位置/g, 'うちつぎいち'],
    [/打継ぎ長さ|打継長さ/g, 'うちつぎながさ'],
    [/打継ぎ|打ち継ぎ|打継/g, 'うちつぎ'],
    [/打ち継ぐ|打継ぐ/g, 'うちつぐ'],
    [/打ち継い|打継い/g, 'うちつい'],
    [/コンクリート打放し仕上げ/g, 'コンクリートうちっぱなししあげ'],
    [/コンクリート打放し/g, 'コンクリートうちっぱなし'],
    [/打放しコンクリート面|打放コンクリート面/g, 'うちっぱなしコンクリートめん'],
    [/打放しコンクリート|打放コンクリート/g, 'うちっぱなしコンクリート'],
    [/打放し仕上げ|打放仕上げ/g, 'うちっぱなししあげ'],
    [/打放し面|打放面/g, 'うちっぱなしめん'],
    [/打放し|打放/g, 'うちっぱなし'],
    [/場所打ちコンクリート杭|場所打ち杭/g, 'ばしょうちコンクリートくい'],
    [/場所打ち|場所打/g, 'ばしょうち'],
    [/現場打ちコンクリート杭|現場打ち杭/g, 'げんばうちコンクリートくい'],
    [/現場打ちコンクリート|現場打ち/g, 'げんばうちコンクリート'],
    [/現場打/g, 'げんばうち'],
    [/増し打ち時|増打ち時/g, 'ましうちじ'],
    [/増し打ち|増打ち/g, 'ましうち'],
    [/打撃打ち込み|打撃打込み/g, 'だげきうちこみ'],
    [/打撃時/g, 'だげきじ'],
    [/打設完了|打設終了/g, 'だせつかんりょう'],
    [/打設時/g, 'だせつじ'],
    [/打設中/g, 'だせつちゅう'],
    [/打設前/g, 'だせつまえ'],
    [/打設後/g, 'だせつご'],
    [/打設直前/g, 'だせつちょくぜん'],
    [/打設直後/g, 'だせつちょくご'],
    [/打設面/g, 'だせつめん'],
    [/打設/g, 'だせつ'],

    // 鉄骨・形鋼・鋼材 (ユーザー指摘の「H形鋼（エイチがたこう）」等)
    [/[HＨ]形鋼梁/g, 'エイチがたこうばり'],
    [/[HＨ]形鋼柱/g, 'エイチがたこうちゅう'],
    [/[HＨ]形鋼等/g, 'エイチがたこうなど'],
    [/[HＨ]形鋼/g, 'エイチがたこう'],
    [/[HＨ]鋼杭/g, 'エイチこうくい'],
    [/[HＨ]鋼/g, 'エイチこう'],
    [/不等辺山形鋼/g, 'ふとうへんやまがたこう'],
    [/等辺山形鋼/g, 'とうへんやまがたこう'],
    [/山形鋼等/g, 'やまがたこうなど'],
    [/山形鋼/g, 'やまがたこう'],
    [/リップ溝形鋼/g, 'リップみぞがたこう'],
    [/溝形鋼/g, 'みぞがたこう'],
    [/[IＩ]形鋼/g, 'アイがたこう'],
    [/[LＬ]形鋼/g, 'エルがたこう'],
    [/[CＣ]形鋼/g, 'シーがたこう'],
    [/[TＴ]形鋼/g, 'ティーがたこう'],
    [/[UＵ]形鋼/g, 'ユーがたこう'],
    [/[ZＺ]形鋼/g, 'ゼットがたこう'],
    [/平鋼/g, 'ひらこう'],
    [/丸鋼/g, 'まるこう'],
    [/異形棒鋼/g, 'いけいぼうこう'],
    [/冷間成形角形鋼管/g, 'れいかんせいけいかくがたこうかん'],
    [/角形鋼管柱/g, 'かくがたこうかんちゅう'],
    [/円形鋼管柱/g, 'えんけいこうかんちゅう'],
    [/角形鋼管/g, 'かくがたこうかん'],
    [/円形鋼管/g, 'えんけいこうかん'],
    [/鋼管柱/g, 'こうかんちゅう'],
    [/鋼管杭/g, 'こうかんくい'],
    [/鋼管/g, 'こうかん'],
    [/トルシア形高力ボルト/g, 'トルシアがたこうりきボルト'],
    [/トルシア形/g, 'トルシアがた'],
    [/ベローズ形/g, 'ベローズがた'],
    [/形鋼/g, 'かたこう'],

    // 「〜時（じ）」確定読み
    [/大地震時/g, 'だいじしんじ'],
    [/地震時/g, 'じしんじ'],
    [/暴風時/g, 'ぼうふうじ'],
    [/強風時/g, 'きょうふうじ'],
    [/雨天時/g, 'うてんじ'],
    [/降雨時/g, 'こううじ'],
    [/大雨時/g, 'おおあめじ'],
    [/降雪時|積雪時/g, 'せきせつじ'],
    [/低温時/g, 'ていおんじ'],
    [/高温時/g, 'こうおんじ'],
    [/施工時/g, 'せこうじ'],
    [/掘削時/g, 'くっさくじ'],
    [/脱型時/g, 'だっけいじ'],
    [/解体時/g, 'かいたいじ'],
    [/架設時/g, 'かせつじ'],
    [/溶接時/g, 'ようせつじ'],
    [/建方時/g, 'たてかたじ'],
    [/建て込み時|建込み時|建込時/g, 'たてこみじ'],
    [/現場受入時|受入れ時|受入時/g, 'うけいれじ'],
    [/荷卸し時|荷卸時/g, 'におろしじ'],
    [/搬入時/g, 'はんにゅうじ'],
    [/締付け時|締付時/g, 'しめつけじ'],
    [/締固め時/g, 'しめかためじ'],
    [/養生時/g, 'ようじょうじ'],
    [/硬化初期/g, 'こうかしょき'],
    [/硬化時/g, 'こうかじ'],
    [/設置時/g, 'せっちじ'],
    [/固定時/g, 'こていじ'],
    [/運搬時/g, 'うんぱんじ'],
    [/満水時/g, 'まんすいじ'],
    [/出火時|火災時/g, 'かさいじ'],
    [/非常時/g, 'ひじょうじ'],
    [/停電時/g, 'ていでんじ'],
    [/使用時/g, 'しようじ'],
    [/作動時/g, 'さどうじ'],
    [/点検時/g, 'てんけんじ'],
    [/検査時/g, 'けんさじ'],
    [/練混ぜ時|練り混ぜ時/g, 'ねりまぜじ'],

    // 構造・材料・規格記号
    [/SRC構造/g, 'エスアールシーこうぞう'],
    [/RC構造/g, 'アールシーこうぞう'],
    [/S構造/g, 'エスこうぞう'],
    [/SRC造/g, 'エスアールシーぞう'],
    [/CFT造/g, 'シーエフティーぞう'],
    [/WRC造/g, 'ダブリューアールシーぞう'],
    [/RC造外壁|RC外壁/g, 'アールシーぞうがいへき'],
    [/RC造/g, 'アールシーぞう'],
    [/S造/g, 'エスぞう'],
    [/RC梁柱配筋/g, 'アールシーはりばしらはいきん'],
    [/RC梁/g, 'アールシーばり'],
    [/RC柱/g, 'アールシーばしら'],
    [/RC壁/g, 'アールシーかべ'],
    [/RC床/g, 'アールシーゆか'],
    [/RC連壁/g, 'アールシーれんぺき'],
    [/PCa板/g, 'ピーシーエーばん'],
    [/PCa工法/g, 'ピーシーエーこうほう'],
    [/PC板/g, 'ピーシーばん'],
    [/ALC板/g, 'エーエルシーばん'],
    [/SS材/g, 'エスエスざい'],
    [/SN材/g, 'エスエヌざい'],
    [/SM材/g, 'エスエムざい'],
    [/SD345/g, 'エスディーさんびゃくよんじゅうご'],
    [/SD295A/g, 'エスディーにひゃくきゅうじゅうごエー'],
    [/SD295/g, 'エスディーにひゃくきゅうじゅうご'],
    [/SD390/g, 'エスディーさんびゃくきゅうじゅう'],
    [/SD490/g, 'エスディーよんひゃくきゅうじゅう'],
    [/D10/g, 'ディーじゅう'],
    [/D13/g, 'ディーじゅうさん'],
    [/D16/g, 'ディーじゅうろく'],
    [/D19/g, 'ディーじゅうきゅう'],
    [/D22/g, 'ディーにじゅうに'],
    [/D25/g, 'ディーにじゅうご'],
    [/D29/g, 'ディーにじゅうきゅう'],
    [/D32/g, 'ディーさんじゅうに'],
    [/A種接地工事/g, 'エーしゅせっちこうじ'],
    [/B種接地工事/g, 'ビーしゅせっちこうじ'],
    [/C種接地工事/g, 'シーしゅせっちこうじ'],
    [/D種接地工事/g, 'ディーしゅせっちこうじ'],
    [/A種接地/g, 'エーしゅせっち'],
    [/B種接地/g, 'ビーしゅせっち'],
    [/C種接地/g, 'シーしゅせっち'],
    [/D種接地/g, 'ディーしゅせっち'],
    [/A種/g, 'エーしゅ'],
    [/B種/g, 'ビーしゅ'],
    [/C種/g, 'シーしゅ'],
    [/D種/g, 'ディーしゅ'],
    [/B1票/g, 'ビーワンひょう'],
    [/B2票/g, 'ビーツーひょう'],
    [/C1票/g, 'シーワンひょう'],
    [/C2票/g, 'シーツーひょう'],
    [/A票/g, 'エーひょう'],
    [/D票/g, 'ディーひょう'],
    [/E票/g, 'イーひょう'],
    [/A特性/g, 'エートクセイ'],
    [/C特性/g, 'シートクセイ'],
    [/A火災/g, 'エーかさい'],
    [/B火災/g, 'ビーかさい'],
    [/C火災/g, 'シーかさい'],
    [/X方向/g, 'エックスほうこう'],
    [/Y方向/g, 'ワイほうこう'],
    [/Z方向/g, 'ゼットほうこう'],
    [/U値/g, 'ユーち'],
    [/C値/g, 'シーち'],
    [/Q値/g, 'キューち'],
    [/Ds値/g, 'ディーエスち'],
    [/SC値/g, 'エスシーち'],
    [/F値/g, 'エフち'],
    [/N値/g, 'エヌち'],
    [/K値/g, 'ケーち'],
    [/R型受信機/g, 'アールがたじゅしんき'],
    [/P型受信機/g, 'ピーがたじゅしんき'],
    [/P型1級/g, 'ピーがたいっきゅう'],
    [/P型2級/g, 'ピーがたにきゅう'],
    [/P型/g, 'ピーがた'],
    [/R型/g, 'アールがた'],
    [/U字溝/g, 'ユーじこう'],
    [/U字/g, 'ユーじ'],
    [/L字/g, 'エルじ'],
    [/T字/g, 'ティーじ'],
    [/S字状/g, 'エスじじょう'],
    [/S字/g, 'エスじ'],
    [/V溝/g, 'ブイみぞ'],
    [/Vカット/g, 'ブイカット'],
    [/Uカット/g, 'ユーカット'],
    [/ASR対策/g, 'エーエスアールたいさく'],
    [/ASR/g, 'エーエスアール'],
    [/UT検査/g, 'ユーティーけんさ'],
    [/MT検査/g, 'エムティーけんさ'],
    [/PT検査/g, 'ピーティーけんさ'],
    [/RT検査/g, 'アールティーけんさ'],
    [/CAV方式/g, 'シーエーブイほうしき'],
    [/VAV方式/g, 'ブイエーブイほうしき'],
    [/VRF方式/g, 'ブイアールエフほうしき'],
    [/LED照明器具/g, 'エルイーディーしょうめいきぐ'],
    [/LED照明/g, 'エルイーディーしょうめい'],
    [/SWS試験/g, 'エスダブルエスしけん'],
    [/SMW工法/g, 'エスエムダブリューこうほう'],
    [/SMW柱列壁/g, 'エスエムダブリューちゅうれつへき'],
    [/SMW/g, 'エスエムダブリュー'],
    [/QC手法/g, 'キューシーしゅほう'],
    [/QC7つ道具/g, 'キューシーななつどうぐ'],
    [/CIE標準曇天/g, 'シーアイイーひょうじゅんどんてん'],
    [/Low-?E複層ガラス/gi, 'ローイーふくそうガラス'],
    [/Low-?E/gi, 'ローイー'],
    [/富調合/g, 'とみちょうごう'],
    [/集水桝/g, 'しゅうすいます'],
    [/雨水桝/g, 'うすいます'],
    [/汚水桝/g, 'おすいます'],
    [/減圧弁/g, 'げんあつべん'],
    [/逆止め弁|逆止弁/g, 'ぎゃくどめべん'],
    [/チャッキ弁/g, 'チャッキべん'],
    [/空気抜き弁/g, 'くうきぬきべん'],
    [/電磁弁/g, 'でんじべん'],
    [/隠し釘/g, 'かくしくぎ'],
    [/突き付け目地|突付け目地|突付目地/g, 'つきつけめじ'],
    [/突き付け張り|突付け張り|突付張り/g, 'つきつけばり'],
    [/突き付け|突付け|突付/g, 'つきつけ'],

    // 一般数値・記号
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
    [/はいすい/g, 'ハイスイ'],
    [/はいきん/g, 'ハイキン'],
    [/はいき/g, 'ハイキ'],
    [/はいど/g, 'ハイド'],
    [/はいかん/g, 'ハイカン'],
    [/わいきん/g, 'ハイキン'],
    [/わいすい/g, 'ハイスイ'],
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
    trackCurrent: 0,
    trackTotal: 0,
    trackUnit: '問',

    alive(tok) { return this.active && tok === this.token; },

    setStatus(text) {
      this.status = text;
      const el = $('lsPlayerStatus');
      if (el) el.textContent = text;
    },

    setTrack(current, total, unit = '問') {
      this.trackCurrent = current || 0;
      this.trackTotal = total || 0;
      this.trackUnit = unit || '問';
      const el = $('lsPlayerTrack');
      if (el) {
        if (this.trackTotal > 0) {
          el.textContent = `${this.trackCurrent} / ${this.trackTotal} ${this.trackUnit}`;
          el.style.display = 'inline-block';
        } else {
          el.style.display = 'none';
        }
      }
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

      // 複数文（チャンク）がある場合、解説や問題文コンテナをカラオケ式に文章追従ハイライト
      let chunkContainer = null;
      let originalHtml = null;
      if (el && chunks.length > 0) {
        if (el.id === 'stagePlayExp') {
          chunkContainer = $('stagePlayExpContent') || el;
        } else if (
          el.id === 'stagePlayQuestion' ||
          el.id === 'mockQText' ||
          el.id === 'drillQuestionText' ||
          el.id === 'drillExplanationBox' ||
          el.id === 'themePointGuide' ||
          el.classList.contains('q-explanation') ||
          el.classList.contains('cheat-peek-box') ||
          el.classList.contains('sample-block') ||
          el.classList.contains('practical-card') ||
          el.classList.contains('practical-ans-box') ||
          el.classList.contains('term-card') ||
          el.classList.contains('exp-content') ||
          el.classList.contains('review-item')
        ) {
          chunkContainer = el;
        }
      }

      let requestedChunkIdx = -1;
      let clickHandler = null;

      if (chunkContainer) {
        originalHtml = chunkContainer.innerHTML;
        chunkContainer.innerHTML = chunks.map((c, i) => `<span class="speech-chunk ls-chunk" data-chunk="${i}" title="タップでこの文から読み上げ">${escapeHtml(c)}</span>`).join(' ');

        clickHandler = (e) => {
          const chunkSpan = e.target.closest('.speech-chunk.ls-chunk');
          if (!chunkSpan) return;
          const idx = parseInt(chunkSpan.getAttribute('data-chunk'), 10);
          if (!isNaN(idx) && idx >= 0 && idx < chunks.length) {
            e.stopPropagation();
            requestedChunkIdx = idx;
            try { window.speechSynthesis.cancel(); } catch (err) {}
          }
        };
        chunkContainer.addEventListener('click', clickHandler);
      }

      let i = 0;
      while (i < chunks.length && this.alive(tok)) {
        if (requestedChunkIdx !== -1) {
          i = requestedChunkIdx;
          requestedChunkIdx = -1;
        }
        const c = chunks[i];

        // 音声コントローラーのステータスに現在読み上げ中の文をリアルタイム表示
        this.setStatus(`🔊 ${c.length > 30 ? c.substring(0, 28) + '…' : c}`);

        if (chunkContainer) {
          const spans = chunkContainer.querySelectorAll('.speech-chunk.ls-chunk');
          spans.forEach((s, idx) => {
            s.classList.toggle('active', idx === i);
            s.classList.toggle('spoken', idx < i);
          });
          const activeSpan = chunkContainer.querySelector('.speech-chunk.ls-chunk.active');
          if (activeSpan) scrollIntoViewIfNeeded(activeSpan);
        }

        await this.utter(c);

        if (requestedChunkIdx !== -1) {
          i = requestedChunkIdx;
          requestedChunkIdx = -1;
        } else {
          i++;
        }
      }

      if (chunkContainer) {
        if (clickHandler) chunkContainer.removeEventListener('click', clickHandler);
        if (originalHtml !== null) {
          chunkContainer.innerHTML = originalHtml;
        }
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
      this.setTrack(0, 0);
      try { window.speechSynthesis.cancel(); } catch (e) {}
      document.querySelectorAll('.ls-reading').forEach(el => el.classList.remove('ls-reading'));
      document.querySelectorAll('.speech-chunk.ls-chunk').forEach(s => s.classList.remove('active', 'spoken'));
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
    if (!el) return;
    try {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (r.top < 80 || r.bottom > vh - 105) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
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
      Listener.setTrack(sp.currentIndex + 1, sp.questions.length, '問');
      Listener.setStatus(`STAGE ${sp.stageNum}：第${sp.currentIndex + 1}問`);
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
      Listener.setTrack(exam.currentIndex + 1, exam.questions.length, '問');
      Listener.setStatus(`第${exam.currentIndex + 1}問（模擬試験）`);
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
      Listener.setTrack(i + 1, exam.questions.length, '問');
      Listener.setStatus(`第${i + 1}問の解説`);
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
      Listener.setTrack(d.currentIndex + 1, d.questions.length, '問');
      Listener.setStatus(`分野別特訓：第${d.currentIndex + 1}問`);
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
      Listener.setTrack(idx + 1, themes.length, 'テーマ');
      Listener.setStatus(`模範解答：${t.name}`);
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
      Listener.setTrack(i + 1, qs.length, '問');
      Listener.setStatus(`実地記述：第${i + 1}問`);
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
      Listener.setTrack(AppState.flashcard.currentIndex + 1, AppState.numbersCards.length, '枚');
      Listener.setStatus(`重要数値：${card.title}`);
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
      Listener.setTrack(i + 1, list.length, '語');
      Listener.setStatus(`用語：${t.term}`);
      let trapText = '';
      if (t.trap) {
        if (t.trap.startsWith('【混同注意】')) {
          trapText = '\n混同注意。' + t.trap.replace('【混同注意】', '').trim();
        } else if (t.trap.startsWith('【')) {
          trapText = '\n' + t.trap.replace(/^【([^】]+)】/, '$1。').trim();
        } else {
          trapText = '\nひっかけ注意。' + t.trap;
        }
      }
      const text = `${t.term}。読み方、${t.reading}。${t.definition || ''}${trapText}${t.keyPoint ? '\n重要ポイント。' + t.keyPoint : ''}`;
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
      p.setAttribute('role', 'region');
      p.setAttribute('aria-label', '音声聞き流しコントローラー');
      p.innerHTML = `
        <span class="ls-player-dot"></span>
        <div class="ls-player-info" title="ドラッグで画面端へ自由に移動・ダブルクリックで初期位置に戻せます">
          <div class="ls-player-header-row">
            <strong id="lsPlayerSection">🎧 聞き流し中</strong>
            <span id="lsPlayerTrack" class="ls-player-track" style="display: none;"></span>
          </div>
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

      // ドラッグ移動＆画面端見切れ防止（スマホ・PC両対応）
      let isDragging = false;
      let startX = 0, startY = 0, origLeft = 0, origTop = 0;
      p.addEventListener('pointerdown', (e) => {
        if (e.target.closest('select, button')) return;
        isDragging = true;
        p.classList.add('is-dragged');
        try { p.setPointerCapture(e.pointerId); } catch (err) {}
        const r = p.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        origLeft = r.left;
        origTop = r.top;
      });
      p.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const w = p.offsetWidth;
        const h = p.offsetHeight;
        const minX = 6;
        const maxX = window.innerWidth - w - 6;
        const minY = 6;
        const maxY = window.innerHeight - h - 6;
        const newX = Math.max(minX, Math.min(maxX, origLeft + dx));
        const newY = Math.max(minY, Math.min(maxY, origTop + dy));
        p.style.left = `${newX}px`;
        p.style.top = `${newY}px`;
        p.style.right = 'auto';
        p.style.bottom = 'auto';
        p.style.transform = 'none';
      });
      const endDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        p.classList.remove('is-dragged');
        try { p.releasePointerCapture(e.pointerId); } catch (err) {}
      };
      p.addEventListener('pointerup', endDrag);
      p.addEventListener('pointercancel', endDrag);
      p.addEventListener('dblclick', (e) => {
        if (e.target.closest('select, button')) return;
        p.style.left = '';
        p.style.top = '';
        p.style.right = '';
        p.style.bottom = '';
        p.style.transform = '';
      });

      // 画面リサイズ時に外へ飛び出さないようリセット
      window.addEventListener('resize', () => {
        if (!p.style.top) return;
        const r = p.getBoundingClientRect();
        if (r.right > window.innerWidth || r.bottom > window.innerHeight) {
          p.style.left = '';
          p.style.top = '';
          p.style.right = '';
          p.style.bottom = '';
          p.style.transform = '';
        }
      });
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

    // リストアイテム＆カードのクリック／タップによる読み上げジャンプ機能
    const mockReview = $('mockReviewList');
    if (mockReview) {
      mockReview.addEventListener('click', (e) => {
        if (e.target.closest('.speech-chunk, button, a')) return;
        const item = e.target.closest('.review-item');
        if (!item) return;
        const items = Array.from(mockReview.querySelectorAll('.review-item'));
        const idx = items.indexOf(item);
        if (idx !== -1) {
          Listener.start('mockResult', idx);
        }
      });
    }

    const practicalList = $('practicalQuestionsList');
    if (practicalList) {
      practicalList.addEventListener('click', (e) => {
        if (e.target.closest('.speech-chunk, button, a')) return;
        const card = e.target.closest('.practical-card');
        if (!card) return;
        const cards = Array.from(practicalList.querySelectorAll('.practical-card'));
        const idx = cards.indexOf(card);
        if (idx !== -1) {
          Listener.start('practical', idx);
        }
      });
    }

    const termsList = $('termsMasterList');
    if (termsList) {
      termsList.addEventListener('click', (e) => {
        if (e.target.closest('.speech-chunk, button, a')) return;
        const card = e.target.closest('.term-card');
        if (!card) return;
        const cards = Array.from(termsList.querySelectorAll('.term-card'));
        const idx = cards.indexOf(card);
        if (idx !== -1) {
          Listener.start('terms', idx);
        }
      });
    }

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
    const trackEl = $('lsPlayerTrack');
    if (trackEl) {
      if (Listener.active && Listener.trackTotal > 0) {
        trackEl.textContent = `${Listener.trackCurrent} / ${Listener.trackTotal} ${Listener.trackUnit}`;
        trackEl.style.display = 'inline-block';
      } else {
        trackEl.style.display = 'none';
      }
    }
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
