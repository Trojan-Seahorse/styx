// ==UserScript==
// @name         Styx — NCME 解构器
// @namespace    styx-ncme
// @version      3.2.0
// @description  Styx — 继续医学教育自动化解构器。自动答题·倍速锁定·智能跳课·无人值守完成NCME课程。Duke Ewell Laboratory
// @author       Xi Ewell · Duke Ewell Laboratory
// @homepage     https://github.com/Trojan-Seahorse
// @match        https://www.ncme.org.cn/player/record*
// @match        https://www.ncme.org.cn/player/replay*
// @match        https://www.ncme.org.cn/study-course/*
// @match        https://www.ncme.org.cn/qbank/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

// ╔══════════════════════════════════════╗
// ║  Styx — NCME 解构器  v3.2.0         ║
// ║  Xi Ewell · Duke Ewell Laboratory   ║
// ║  github.com/Trojan-Seahorse         ║
// ║  Licensed under CC BY-NC-ND 4.0     ║
// ╚══════════════════════════════════════╝

(function() {
  'use strict';

  const CFG = {
    pollMs: 1000,
    mountTimeoutMs: 20000,
    nextDelayMs: 1500,
    testAnswerStrategy: 'first',
    testRetryMax: 3,
    courseDelayMs: 5000,       // 课程页自动跳转前等待（秒）v1.5: reduced from 30s
    checkpointGapMs: 2000,     // 每个进度检查点的播放时长
    checkpointPct: [0.25, 0.50, 0.75, 0.92], // 进度检查点（百分比）
  };

  // 全局自动化开关：ESC 暂停/恢复
  var AUTO_PAUSED = false;
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      AUTO_PAUSED = !AUTO_PAUSED;
      ui('nh-st', AUTO_PAUSED ? '⏸ 已暂停(ESC恢复)' : '▶ 自动运行中');
      console.log('[Styx] 自动化:', AUTO_PAUSED ? '暂停' : '恢复');
    }
  });

  // ═══════════════════════════════════════════════════
  //  UI — 用 style.cssText 直接赋值，绕过 CSP
  // ═══════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════
  //  Stage indicator — updated at each transition
  // ═══════════════════════════════════════════════════
  var STAGE_ICON = '';
  function setStage(icon, label) {
    STAGE_ICON = icon;
    var s = document.getElementById('nh-stage');
    if (s) s.textContent = icon + ' ' + label;
  }

  function createPanel() {
    if (document.getElementById('nh-panel')) return;
    console.log('[Styx] 创建面板...');

    // Container — Stygian glass morphism
    var p = document.createElement('div');
    p.id = 'nh-panel';
    p.style.cssText =
      'display:block;visibility:visible;opacity:1;' +
      'position:fixed;bottom:24px;right:24px;z-index:2147483647;' +
      'background:rgba(15,15,30,0.94);' +
      'padding:16px 18px 14px 18px;border-radius:14px;' +
      'font-family:"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;' +
      'font-size:14px;line-height:1.65;min-width:220px;max-width:270px;' +
      'color:#cbd5e1;' +
      'box-shadow:0 8px 32px rgba(0,0,0,0.55),0 0 0 1px rgba(124,58,237,0.18),0 0 20px rgba(124,58,237,0.08);' +
      'border:1px solid rgba(124,58,237,0.25);' +
      'backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);' +
      'user-select:none;transition:opacity 0.3s;';

    // ── Header: trident + name ──
    var hdr = document.createElement('div');
    hdr.style.cssText =
      'display:flex;align-items:center;gap:8px;margin-bottom:10px;';
    var icon = document.createElement('span');
    icon.textContent = '⚓';
    icon.style.cssText =
      'font-size:18px;' +
      'background:linear-gradient(135deg,#a78bfa,#7c3aed);' +
      '-webkit-background-clip:text;-webkit-text-fill-color:transparent;' +
      'filter:drop-shadow(0 0 6px rgba(124,58,237,0.4));';
    hdr.appendChild(icon);
    var nameEl = document.createElement('span');
    nameEl.textContent = 'Styx';
    nameEl.style.cssText =
      'font-size:16px;font-weight:800;letter-spacing:2px;' +
      'background:linear-gradient(135deg,#7c3aed,#a78bfa,#0d9488);' +
      '-webkit-background-clip:text;-webkit-text-fill-color:transparent;' +
      'filter:drop-shadow(0 0 4px rgba(124,58,237,0.3));';
    hdr.appendChild(nameEl);
    var ver = document.createElement('span');
    ver.textContent = 'v3.2.0';
    ver.style.cssText = 'font-size:10px;color:#64748b;margin-left:auto;font-weight:400;';
    hdr.appendChild(ver);
    p.appendChild(hdr);

    // ── Divider ──
    var div = document.createElement('div');
    div.style.cssText =
      'height:1px;background:linear-gradient(90deg,rgba(124,58,237,0.4),rgba(13,148,136,0.3),transparent);margin-bottom:10px;';
    p.appendChild(div);

    // ── Stage indicator ──
    var stage = document.createElement('div');
    stage.id = 'nh-stage';
    stage.textContent = '◈ 初始化';
    stage.style.cssText =
      'font-size:13px;font-weight:600;color:#a78bfa;margin-bottom:8px;' +
      'letter-spacing:0.5px;';
    p.appendChild(stage);

    // ── Info rows ──
    function addRow(iconChar, id, val, color, iconColor, iconSize) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:2px 0;';
      var ic = document.createElement('span');
      ic.textContent = iconChar;
      ic.style.cssText =
        'font-size:' + (iconSize || '12px') + ';width:16px;text-align:center;' +
        'color:' + (iconColor || '#64748b') + ';flex-shrink:0;' +
        'text-shadow:0 0 0.4px currentColor;';
      row.appendChild(ic);
      var valEl = document.createElement('span');
      valEl.id = id;
      valEl.textContent = val;
      valEl.style.cssText =
        'flex:1;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
        'font-size:13px;color:' + (color || '#e2e8f0') + ';';
      row.appendChild(valEl);
      p.appendChild(row);
    }

    addRow('✦', 'nh-pg', '—', '#94a3b8', '#a78bfa', '13px');
    addRow('❯', 'nh-ln', '—', '#e2e8f0', '#0d9488', '15px');
    addRow('⏰', 'nh-et', '—', '#64748b', '#d97706', '13px');

    // ── Signature ──
    var sig = document.createElement('div');
    sig.style.cssText =
      'margin-top:10px;padding-top:6px;' +
      'border-top:1px solid rgba(100,116,139,0.2);' +
      'text-align:right;font-size:9px;color:rgba(148,163,184,0.4);' +
      'letter-spacing:0.5px;font-style:italic;';
    sig.textContent = 'Duke Ewell Laboratory';
    p.appendChild(sig);

    try { document.body.appendChild(p); console.log('[Styx] 面板已挂载'); }
    catch(e) { document.documentElement.appendChild(p); console.error('[Styx] 面板挂载失败:', e); }
  }

  function ui(id, t, warn) {
    // nh-st → merged into nh-stage (v3.2.0)
    var el = document.getElementById(id === 'nh-st' ? 'nh-stage' : id);
    if (!el) return;
    el.textContent = t;
    if (warn) el.style.color = '#ef4444';
    else if (id === 'nh-st') el.style.color = '#a78bfa';
    else el.style.color = '';
  }  // ═══════════════════════════════════════════════════
  //  URL Builder — Video
  // ═══════════════════════════════════════════════════
  function buildVideoURL(unitId, materialId, periodId, courseId) {
    return '/player/record?data=' + encodeURIComponent(btoa(JSON.stringify({
      unitId: unitId, id: materialId, periodId: String(periodId), kcid: courseId, playScene: ''
    })));
  }

  // ═══════════════════════════════════════════════════
  //  URL Builder — Test (replay popup)
  // ═══════════════════════════════════════════════════
  function buildTestURL(materialId, periodId, courseId) {
    return '/player/replay?projectType=4&periodId=' + periodId + '&data=' +
      encodeURIComponent(btoa(JSON.stringify({
        uid: materialId, id: materialId, periodId: periodId, kcid: courseId, playScene: ''
      })));
  }

  // ═══════════════════════════════════════════════════
  //  Player Page (Video)
  // ═══════════════════════════════════════════════════
  function findPlayerVM() {
    const xt = document.querySelector('#__xt');
    if (!xt || !xt.__vue__) return null;
    try { return xt.__vue__.$children[1].$children[0].$children[0].$children[0]; }
    catch (e) { return null; }
  }

  function navToNextMaterial(vm) {
    // Check if the NEXT material is a test (type=4). If so, redirect to course page.
    const ab = vm.$refs && vm.$refs.actionBar;
    if (!ab || !ab.nextDir) {
      // No next directory → might be last video, or next is a test.
      // Redirect to course page to let initCourse decide
      const ci = vm.courseInfo;
      if (ci && ci.courseId && ci.periodId != null) {
        ui('nh-st', '→ 返回课程页');
        // v3.1.2: Set auto-return flag so initCourse knows to auto-proceed
        try { sessionStorage.setItem('ncme_auto_return', '1'); } catch(e) {}
        setTimeout(function() {
          window.location.href = '/study-course/' + ci.courseId + '?periodId=' + ci.periodId;
        }, 500);
        return false;
      }
      setStage('★', '课程已全部完成');
      ui('nh-st', '🏁 课程已全部完成');
      return false;
    }
    const ci = vm.courseInfo;
    if (!ci || ci.periodId == null || ci.courseId == null) { ui('nh-st', '缺少课程信息', true); return false; }
    const url = buildVideoURL(ab.nextDir.resourceCode, ab.nextDir.materialId, ci.periodId, ci.courseId);
    ui('nh-st', '→ ' + (ab.nextDir.directoryName || '下一课'));
    setTimeout(function() { window.location.href = url; }, 300);
    return true;
  }

  function initPlayer() {
    createPanel();
    setStage('◈', '等待播放器');
    ui('nh-st', '等待播放器...');
    console.log('[Styx] 播放页初始化');

    var t0 = Date.now();
    var t = setInterval(function() {
      var vm = findPlayerVM();
      if (!vm) { if (Date.now()-t0 > CFG.mountTimeoutMs) { clearInterval(t); ui('nh-st','超时',true); setStage('✗', '超时'); } return; }
      var video = document.querySelector('#parentNode video');
      if (!video) return;
      clearInterval(t);

      // Anti-cheat bypass
      if (vm.checkRate) vm.checkRate = function(){};
      setStage('▶', '播放中');
      if (vm.currentDir) ui('nh-ln', vm.currentDir.directoryName||'--');

      // ── Autoplay ──
      video.muted = true;

      // Use CC SDK's own play() for better compatibility
      var cp = window.cc_js_Player;
      var useSDK = !!(cp && cp.play && cp.jumpToTime);

      var playPromise;
      if (useSDK) {
        playPromise = cp.play();
      } else {
        playPromise = video.play();
      }

      if (playPromise && playPromise.catch) {
        playPromise.catch(function(e) {
          console.log('[Styx] autoplay blocked:', e.name);
          ui('nh-st', '🔊 点一下页面启用播放');
          var resume = function() {
            video.muted = false;
            if (useSDK) { cp.play(); } else { video.play().catch(function(){}); }
            document.removeEventListener('click', resume);
            ui('nh-st', '▶ 播放中');
          };
          document.addEventListener('click', resume, {once: true});
        });
      }

      // ── Progress Checkpoint Simulation ──
      var checkpoints = CFG.checkpointPct.slice();
      var currentCP = 0;
      var cpDone = false;
      var completeDone = false;
      var cpTimer = null;

      function startCheckpoint() {
        if (cpDone || currentCP >= checkpoints.length) {
          cpDone = true;
          // ── Final stretch: seek near end, play to completion ──
          // v3.2.0: Fixed 15s final segment, no speed hijack needed
          video.playbackRate = 1;
          if (video.duration) {
            var finalSegment = 15;
            var finalPos = Math.max(0, video.duration - finalSegment);
            if (useSDK) { cp.jumpToTime(finalPos); } else { video.currentTime = finalPos; }
          }
          if (useSDK) { cp.play(); }
          ui('nh-et', '末段' + Math.round(finalPos === 0 ? 0 : (video.duration - finalPos)) + 's');
          ui('nh-st', '▶ 末段播放中');
          setStage('◈', '末段播放');
          console.log('[Styx] 末段 播放 (pos=' + Math.round(video.currentTime) + ')');
          return;
        }

        var target = video.duration * checkpoints[currentCP];
        if (isNaN(target) || target <= 0) return;

        // Seek to checkpoint, play at normal speed
        video.playbackRate = 1;
        if (useSDK) {
          cp.jumpToTime(target);
          cp.play();
        } else {
          video.currentTime = target;
        }
        ui('nh-st', '⏳ 检查点 ' + (currentCP+1) + '/' + checkpoints.length);
        setStage('🚩', '检查点 ' + (currentCP+1) + '/' + checkpoints.length);
        console.log('[Styx] 检查点 ' + (currentCP+1) + ': ' + Math.round(checkpoints[currentCP]*100) + '%  pos=' + Math.round(video.currentTime));

        clearTimeout(cpTimer);
        cpTimer = setTimeout(function() {
          currentCP++;
          startCheckpoint();
        }, CFG.checkpointGapMs);
      }

      // ── Stuck detection: if video position stalls for too long, reload ──
      var lastPos = 0;
      var stuckCount = 0;
      var stuckThreshold = 30; // 30 poll cycles (~30s) without movement = stuck

      // Kick off checkpoint simulation once duration is known
      var checkpointStarted = false;
      var mainLoop = setInterval(function() {
        if (AUTO_PAUSED) return;

        if (video.duration && !checkpointStarted) {
          checkpointStarted = true;
          startCheckpoint();
        }

        // Update UI — use SDK position for accuracy when available
        var pos = useSDK && cp.getPosition ? cp.getPosition() : video.currentTime;
        if (video.duration && !video.paused) {
          var pct = Math.round(pos / video.duration * 100);
          ui('nh-pg', pct + '%');
          if (!cpDone) {
            ui('nh-et', '检查点 ' + (currentCP+1) + '/' + checkpoints.length);
          } else {
            var remaining = Math.max(0, Math.round(video.duration - pos));
            ui('nh-et', Math.floor(remaining/60) + '分' + String(remaining%60).padStart(2,'0')+'秒');
          }
        }

        // ── Stuck detection (v3.0.2) ──
        if (cpDone && !completeDone) {
          var moved = Math.abs(pos - lastPos);
          if (moved < 0.5) {
            stuckCount++;
            if (stuckCount >= stuckThreshold) {
              console.log('[Styx] 末段卡住检测: pos=' + Math.round(pos) + ' 持续' + stuckCount + '周期，刷新重试');
              ui('nh-st', '🔄 卡住，刷新...');
              clearInterval(mainLoop);
              setTimeout(function() { location.reload(); }, 2000);
              return;
            }
          } else {
            stuckCount = 0;
          }
          lastPos = pos;
        }

        // Detect completion — check both video ended and SDK position
        if (!completeDone && video.duration) {
          var nearEnd = pos >= video.duration - 3;
          if (nearEnd || video.ended) {
            completeDone = true;
            clearInterval(mainLoop);
            ui('nh-st', '⏭ 已完成'); ui('nh-pg', '100%');
            setTimeout(function() { navToNextMaterial(vm); }, CFG.nextDelayMs);
            return;
          }
        }

        // Detect showNextModal (platform's own completion signal)
        if (!completeDone && vm.showNextModal) {
          completeDone = true;
          clearInterval(mainLoop);
          ui('nh-st', '✅ 已完成');
          setTimeout(function() { navToNextMaterial(vm); }, CFG.nextDelayMs);
        }
      }, CFG.pollMs);
    }, 500);
  }

  // ═══════════════════════════════════════════════════
  //  Test Page (Popup) — Auto Answer
  // ═══════════════════════════════════════════════════
  function findTestVM() {
    var xt = document.querySelector('#__xt');
    if (!xt || !xt.__vue__) {
      console.log('[Styx] findTestVM: #__xt 不存在或无 __vue__');
      return null;
    }
    function walk(vm, d) {
      if (!vm || d > 12) return null;
      if (vm.$data && Array.isArray(vm.$data.dataList) && vm.$data.dataList.length > 0) return vm;
      if (vm.$children) { for (var i = 0; i < vm.$children.length; i++) { var f = walk(vm.$children[i], d + 1); if (f) return f; } }
      return null;
    }
    var result = walk(xt.__vue__, 0);
    if (!result) {
      console.log('[Styx] findTestVM: 未找到 dataList，打印根组件结构...');
      // Log root children for debugging
      try {
        var root = xt.__vue__;
        if (root.$children) {
          for (var i = 0; i < root.$children.length; i++) {
            var c = root.$children[i];
            console.log('[Styx] root.$children[' + i + ']:', c.$options ? c.$options.name || '(anonymous)' : '(no $options)');
            if (c.$children) {
              for (var j = 0; j < c.$children.length; j++) {
                var cc = c.$children[j];
                console.log('[Styx]   $children[' + j + ']:', cc.$options ? cc.$options.name || '(anonymous)' : '(no $options)', Object.keys(cc.$data || {}));
              }
            }
          }
        }
      } catch(e) { console.log('[Styx] 打印组件树失败:', e); }
    }
    return result;
  }

  // ── Probe Vue data for correct answers ──
  // Many platforms embed the answer key for server-side grading
  function extractCorrectAnswers(vm) {
    const answers = {};
    if (!vm || !vm.dataList) return answers;

    const dl = vm.dataList;
    console.log('[Styx] dataList length:', dl.length);
    if (dl.length > 0) {
      // Log first item keys so user can see the structure
      // Log ALL keys (not just first 10)
      var allKeys = Object.keys(dl[0]);
      console.log('[Styx] dataList[0] ALL keys (' + allKeys.length + '):', allKeys);
      // Log each key's value type for the first question
      allKeys.forEach(function(k) {
        try {
          var v = dl[0][k];
          var vt = typeof v;
          if (vt === 'object' && v !== null) {
            if (Array.isArray(v)) {
              console.log('[Styx]   ' + k + ': Array[' + v.length + ']', v.length > 0 ? v[0] : 'empty');
            } else {
              console.log('[Styx]   ' + k + ': Object keys=' + Object.keys(v).join(','));
            }
          } else {
            console.log('[Styx]   ' + k + ': ' + vt + ' = ' + String(v).substring(0, 80));
          }
        } catch(e) { console.log('[Styx]   ' + k + ': ERROR ' + e.message); }
      });
      // Log optionList structure if present
      if (dl[0].optionList !== undefined) {
        try {
          var ol = dl[0].optionList;
          if (Array.isArray(ol) && ol.length > 0) {
            console.log('[Styx] optionList[0] keys:', Object.keys(ol[0]));
            console.log('[Styx] optionList[0]:', ol[0]);
          }
        } catch(e) {}
      }
      // Log answerSheetList deeper
      if (vm.answerSheetList && vm.answerSheetList.length > 0) {
        try {
          var asAllKeys = Object.keys(vm.answerSheetList[0]);
          console.log('[Styx] answerSheetList[0] ALL keys:', asAllKeys);
          // If it has 'list', dive in
          if (vm.answerSheetList[0].list && vm.answerSheetList[0].list.length > 0) {
            console.log('[Styx] answerSheetList[0].list[0] keys:', Object.keys(vm.answerSheetList[0].list[0]));
            console.log('[Styx] answerSheetList[0].list[0]:', vm.answerSheetList[0].list[0]);
          }
        } catch(e) {}
      }
      console.log('[Styx] dataList[0]:', dl[0]);
    }
    // Also log answerSheetList if present
    if (vm.answerSheetList && vm.answerSheetList.length > 0) {
      console.log('[Styx] answerSheetList[0]:', vm.answerSheetList[0]);
    }

    // Try known answer field names on each question
    const answerKeys = ['answer', 'rightAnswer', 'correctAnswer', 'rightKey',
      'answerKey', 'correctKey', 'answerCode', 'correctOption', 'rightOption',
      'result', 'standardAnswer', 'trueAnswer', 'key'];

    dl.forEach(function (q, idx) {
      for (let i = 0; i < answerKeys.length; i++) {
        const k = answerKeys[i];
        if (q[k] !== undefined && q[k] !== null && q[k] !== '') {
          if (Array.isArray(q[k])) {
            answers[idx] = q[k].join(',');
          } else {
            answers[idx] = String(q[k]).trim();
          }
          console.log('[Styx] 找到答案: 第' + (idx + 1) + '题 → ' + answers[idx] + ' (字段: ' + k + ')');
          break;
        }
      }

      // Also check optionList items for isRight / score
      if (!answers[idx] && Array.isArray(q.optionList)) {
        const right = q.optionList.find(function (o) {
          return o.isRight === true || o.isCorrect === true || o.score > 0 || o.isAnswer === true;
        });
        if (right) {
          answers[idx] = String(right.optionCode || right.code || right.key || '').trim();
          console.log('[Styx] 找到答案(optionList): 第' + (idx + 1) + '题 → ' + answers[idx]);
        }
      }

      // Check itemList (alternative name)
      if (!answers[idx] && Array.isArray(q.itemList)) {
        const right = q.itemList.find(function (o) {
          return o.isRight === true || o.isCorrect === true || o.score > 0 || o.isAnswer === true;
        });
        if (right) {
          answers[idx] = String(right.optionCode || right.code || right.key || right.itemCode || '').trim();
          console.log('[Styx] 找到答案(itemList): 第' + (idx + 1) + '题 → ' + answers[idx]);
        }
      }

      // Check optionalContent (new structure v3.1: {mark, chooseContent} instead of optionList)
      if (!answers[idx] && Array.isArray(q.optionalContent)) {
        const right = q.optionalContent.find(function (o) {
          return o.isRight === true || o.isCorrect === true || o.score > 0 || o.isAnswer === true;
        });
        if (right) {
          answers[idx] = String(right.mark || right.code || right.key || '').trim();
          console.log('[Styx] 找到答案(optionalContent): 第' + (idx + 1) + '题 → ' + answers[idx]);
        }
      }
    });

    // Check answerSheetList on the VM (sometimes pre-populated)
    if (vm.answerSheetList && Array.isArray(vm.answerSheetList)) {
      vm.answerSheetList.forEach(function (sheet, idx) {
        if (!answers[idx]) {
          // answerSheetList items might have: answer, userAnswer (pre-filled), rightAnswer, etc.
          const sheetKeys = Object.keys(sheet);
          console.log('[Styx] answerSheetList[' + idx + '] keys:', sheetKeys);
          for (let i = 0; i < answerKeys.length; i++) {
            const k = answerKeys[i];
            if (sheet[k] !== undefined && sheet[k] !== null && sheet[k] !== '') {
              answers[idx] = String(sheet[k]).trim();
              console.log('[Styx] 找到答案(answerSheet): 第' + (idx + 1) + '题 → ' + answers[idx]);
              break;
            }
          }
        }
      });
    }

    // Also extract question types for strategy routing
    var questionTypes = {};
    dl.forEach(function (q, idx) {
      if (q.type !== undefined && q.type !== null) {
        questionTypes[idx] = String(q.type);
      }
      // Also check typeDesc (human-readable: "单选题", "多选题", etc.)
      if (q.typeDesc !== undefined && q.typeDesc !== null) {
        questionTypes[idx] = String(q.typeDesc);
      }
    });

    return { answers: answers, types: questionTypes };
  }

  // ── clickOption: routes based on answer format ──
  function clickOption(targetCode) {
    if (!targetCode) return clickAnyOption();
    // 判断题
    if (targetCode === '正确' || targetCode === '错误' || targetCode === '对' || targetCode === '错') {
      return clickJudge(targetCode);
    }
    // 多选题
    if (targetCode.indexOf(',') > -1) {
      return clickMulti(targetCode);
    }
    // 单选题
    return clickSingle(targetCode);
  }

  // ── Single-choice click: ONLY radios / labels (NO checkboxes) ──
  function clickSingle(targetCode) {
    // A: Element UI radio (.el-radio)
    var radios = document.querySelectorAll('.el-radio');
    for (var ri = 0; ri < radios.length; ri++) {
      var rLabel = (radios[ri].textContent || '').trim();
      var rm = rLabel.match(/^([A-E])[\s\.、．）\))]/);
      if (rm && rm[1] === targetCode) {
        var rOrig = radios[ri].querySelector('.el-radio__original');
        if (rOrig) { rOrig.checked = true; rOrig.dispatchEvent(new Event('change', { bubbles: true })); }
        radios[ri].click();
        radios[ri].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        console.log('[Styx] el-radio 点击: ' + targetCode);
        return true;
      }
    }

    // B: .el-radio__original inputs directly
    var rInputs = document.querySelectorAll('.el-radio__original');
    for (var ii = 0; ii < rInputs.length; ii++) {
      var iv = (rInputs[ii].value || '').toUpperCase();
      if (iv === targetCode) {
        rInputs[ii].checked = true;
        rInputs[ii].dispatchEvent(new Event('change', { bubbles: true }));
        rInputs[ii].click();
        console.log('[Styx] radio-input 点击: ' + targetCode);
        return true;
      }
      var pLabel = rInputs[ii].closest('label');
      if (pLabel) {
        var pt = (pLabel.textContent || '').trim();
        var pm = pt.match(/^([A-E])[\s\.、．）\))]/);
        if (pm && pm[1] === targetCode) {
          rInputs[ii].checked = true;
          rInputs[ii].dispatchEvent(new Event('change', { bubbles: true }));
          rInputs[ii].click();
          pLabel.click();
          console.log('[Styx] radio(label) 点击: ' + targetCode);
          return true;
        }
      }
    }

    // C: Plain radio inputs
    var plainRadios = document.querySelectorAll('input[type="radio"]');
    for (var pi = 0; pi < plainRadios.length; pi++) {
      if (plainRadios[pi].classList.contains('el-radio__original')) continue;
      var pv = (plainRadios[pi].value || '').toUpperCase();
      if (pv === targetCode) {
        plainRadios[pi].checked = true;
        plainRadios[pi].dispatchEvent(new Event('change', { bubbles: true }));
        plainRadios[pi].click();
        console.log('[Styx] plain-radio 点击: ' + targetCode);
        return true;
      }
    }

    // D: Any clickable element with option text pattern (NOT checkbox)
    var allEls = document.querySelectorAll('label, span, div, li, button');
    for (var ei = 0; ei < allEls.length; ei++) {
      if (allEls[ei].classList.contains('el-checkbox')) continue;
      var et = (allEls[ei].textContent || '').trim();
      var em = et.match(/^([A-E])[\s\.、．）\))]/);
      if (em && em[1] === targetCode && et.length < 200) {
        allEls[ei].click();
        allEls[ei].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        console.log('[Styx] 通用元素 点击: ' + targetCode + ' (' + et.substring(0, 40) + ')');
        return true;
      }
    }

    return false;
  }

  // ── Multi-choice click: ONLY checkboxes ──
  function clickMulti(targetCodes) {
    var parts = targetCodes.split(',');
    var clicked = 0;
    for (var mp = 0; mp < parts.length; mp++) {
      var letter = parts[mp].trim();
      if (!letter) continue;
      var found = false;

      // 1) Element UI checkboxes
      var checkboxes = document.querySelectorAll('.el-checkbox');
      for (var ci = 0; ci < checkboxes.length && !found; ci++) {
        var cbLabel = (checkboxes[ci].textContent || '').trim();
        var cm = cbLabel.match(/^([A-E])[\s\.、．）\))]/);
        if (cm && cm[1] === letter) {
          var cbOrig = checkboxes[ci].querySelector('.el-checkbox__original');
          if (cbOrig) { cbOrig.checked = true; cbOrig.dispatchEvent(new Event('change', { bubbles: true })); }
          checkboxes[ci].click();
          checkboxes[ci].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          console.log('[Styx] 多选-checkbox: ' + letter);
          found = true;
        }
      }

      // 2) Plain checkboxes
      if (!found) {
        var plainCB = document.querySelectorAll('input[type="checkbox"]');
        for (var pci = 0; pci < plainCB.length && !found; pci++) {
          if (plainCB[pci].classList.contains('el-checkbox__original')) continue;
          var pcv = (plainCB[pci].value || '').toUpperCase();
          if (pcv === letter) {
            plainCB[pci].checked = true;
            plainCB[pci].dispatchEvent(new Event('change', { bubbles: true }));
            plainCB[pci].click();
            console.log('[Styx] 多选-plainCB: ' + letter);
            found = true;
          }
        }
      }

      // 3) Generic element click (fallback)
      if (!found) {
        var allEls = document.querySelectorAll('label, span, div, li');
        for (var ei = 0; ei < allEls.length && !found; ei++) {
          var et = (allEls[ei].textContent || '').trim();
          var em = et.match(/^([A-E])[\s\.、．）\))]/);
          if (em && em[1] === letter && et.length < 200) {
            allEls[ei].click();
            allEls[ei].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            console.log('[Styx] 多选-generic: ' + letter);
            found = true;
          }
        }
      }

      if (found) clicked++;
    }
    console.log('[Styx] 多选: ' + targetCodes + ' → ' + clicked + '/' + parts.length);
    return clicked > 0;
  }

  // ── 判断题 click: "正确"/"错误"/"对"/"错" ──
  function clickJudge(targetCode) {
    var judgeLabels = document.querySelectorAll('label, span, div, li, .el-radio, .el-checkbox');
    for (var ji = 0; ji < judgeLabels.length; ji++) {
      var jt = (judgeLabels[ji].textContent || '').trim();
      if (jt === targetCode || jt.indexOf(targetCode) === 0) {
        // Try inner radio/checkbox first
        var jOrig = judgeLabels[ji].querySelector('.el-radio__original, .el-checkbox__original, input');
        if (jOrig) { jOrig.checked = true; jOrig.dispatchEvent(new Event('change', { bubbles: true })); }
        judgeLabels[ji].click();
        judgeLabels[ji].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        console.log('[Styx] 判断 点击: ' + targetCode + ' ("' + jt.substring(0, 20) + '")');
        return true;
      }
    }
    // Fallback: try partial match (e.g. button text contains the answer)
    var allBtns = document.querySelectorAll('button, .el-button');
    for (var bi = 0; bi < allBtns.length; bi++) {
      var bt = (allBtns[bi].textContent || '').trim();
      if (bt.indexOf(targetCode) > -1 && bt.length < 20) {
        allBtns[bi].click();
        console.log('[Styx] 判断-btn 点击: ' + targetCode);
        return true;
      }
    }
    return false;
  }

  // ── ANSWER VIA VUE MODEL (v1.1: userAnswer + status) ──
  // answerSheetList maps modules: [0]=单选题, [1]=多选题, [2]=判断题, [3]=案例题
  // Module 0 (单选): Q1-Q6, Module 1 (多选): Q7-Q9, Module 2 (判断): Q10, Module 3 (案例): Q11
  var sheetIdxMap = []; // computed once: question index -> {moduleIdx, itemIdx}
  function buildSheetMap(vm) {
    if (sheetIdxMap.length > 0) return;
    if (!vm.answerSheetList) return;
    for (var mi = 0; mi < vm.answerSheetList.length; mi++) {
      var mod = vm.answerSheetList[mi];
      if (mod && mod.list && Array.isArray(mod.list)) {
        for (var li = 0; li < mod.list.length; li++) {
          // Match answerSheet items to dataList by 'no' field
          var sheetQ = mod.list[li];
          for (var di = 0; di < vm.dataList.length; di++) {
            if (vm.dataList[di].no === sheetQ.no) {
              sheetIdxMap[di] = { m: mi, i: li };
              break;
            }
          }
        }
      }
    }
    console.log('[Styx] SheetMap built: ' + sheetIdxMap.filter(Boolean).length + ' entries');
  }

  function setAnswerViaVue(vm, qIdx, target) {
    if (!vm || !vm.dataList || !vm.dataList[qIdx]) return false;
    var q = vm.dataList[qIdx];
    var isMulti = target.indexOf(',') > -1;
    var answerArr = isMulti ? target.split(',').map(function(s) { return s.trim(); }) : [target];

    // PRIMARY: Set userAnswer and status on dataList item
    // (userAnswer is created dynamically by handleSingleQItemChange in the platform)
    try {
      if (vm.$set) {
        vm.$set(q, 'userAnswer', answerArr);
        vm.$set(q, 'status', 1);
      } else {
        q.userAnswer = answerArr;
        q.status = 1;
      }
      console.log('[Styx] ✓ Q' + (qIdx + 1) + ' userAnswer=' + JSON.stringify(answerArr) + ' status=1');
    } catch(e) {
      console.log('[Styx] ✗ Q' + (qIdx + 1) + ' Vue-set failed:', e.message);
      return false;
    }

    // Also set on answerSheetList
    if (vm.answerSheetList) {
      buildSheetMap(vm);
      var map = sheetIdxMap[qIdx];
      if (map) {
        var mod = vm.answerSheetList[map.m];
        if (mod && mod.list && mod.list[map.i]) {
          var sq = mod.list[map.i];
          try {
            if (vm.$set) {
              vm.$set(sq, 'userAnswer', answerArr);
              vm.$set(sq, 'status', 1);
            } else {
              sq.userAnswer = answerArr;
              sq.status = 1;
            }
          } catch(e) {}
        }
      }
    }

    return true;
  }


  // ── Click any option (no target, just pick first available) ──
  function clickAnyOption() {
    // Try Element UI radios first
    var elRadios = document.querySelectorAll('.el-radio');
    if (elRadios.length > 0) {
      var orig = elRadios[0].querySelector('.el-radio__original');
      if (orig) { orig.checked = true; orig.dispatchEvent(new Event('change', { bubbles: true })); }
      elRadios[0].click();
      return true;
    }
    // Fallback: any radio
    var r = document.querySelector('input[type="radio"]');
    if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); r.click(); return true; }
    // Last resort: click first matching label
    var els = document.querySelectorAll('label, span');
    for (var i = 0; i < els.length; i++) {
      if (/^[A-E][\s\.、．）\))]/.test((els[i].textContent || '').trim())) {
        els[i].click(); return true;
      }
    }
    return false;
  }

  // ── Find and click a button by text ──
  function clickButton(text) {
    // Element UI buttons
    const btns = document.querySelectorAll('button, .el-button, [role="button"], .van-button');
    for (let i = 0; i < btns.length; i++) {
      const t = (btns[i].textContent || '').trim();
      if (t.indexOf(text) !== -1 && t.length < 30) {
        btns[i].click();
        btns[i].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        console.log('[Styx] 按钮点击: ' + t);
        return true;
      }
    }
    return false;
  }

  // ── Move to next question ──
  function clickNextQuestion() {
    if (clickButton('下一题')) return true;
    // Try Element UI tabs
    const tabs = document.querySelectorAll('.el-tabs__item, .el-tab-pane');
    // Try pagination
    const pagers = document.querySelectorAll('.el-pager li, .el-pagination button');
    for (let i = 0; i < pagers.length; i++) {
      if ((pagers[i].textContent || '').trim() === '▶' || pagers[i].classList.contains('btn-next')) {
        pagers[i].click(); return true;
      }
    }
    return false;
  }

  // ── Submit via handleSubmit + auto-click confirmation ──
  function clickSubmit() {
    // Approach 1: Click the "提交" button (preferred — triggers full flow)
    if (clickButton('提交') || clickButton('提 交')) {
      console.log('[Styx] 点击了提交按钮');
      // Auto-click confirmation "结束练习" button when it appears
      autoConfirmSubmit();
      return true;
    }
    // Approach 2: Direct Vue handleSubmit call
    try {
      if (typeof vm !== 'undefined' && vm && typeof vm.handleSubmit === 'function') {
        vm.handleSubmit();
        console.log('[Styx] Vue handleSubmit called');
        autoConfirmSubmit();
        return true;
      }
    } catch(e) {
      console.log('[Styx] handleSubmit error:', e.message);
    }
    return false;
  }

  function autoConfirmSubmit() {
    // Poll for the confirmation dialog and click "结束练习"
    var confirmAttempts = 0;
    var confirmTimer = setInterval(function() {
      confirmAttempts++;
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        var txt = (btns[i].textContent || '').trim();
        if (txt.indexOf('结束练习') > -1 || txt.indexOf('确定') > -1 || txt.indexOf('确认') > -1) {
          btns[i].click();
          console.log('[Styx] 自动确认: ' + txt);
          clearInterval(confirmTimer);
          return;
        }
      }
      if (confirmAttempts > 20) {
        clearInterval(confirmTimer);
        console.log('[Styx] 确认框超时');
      }
    }, 300);
  }

  // ── Main test handler ──
  function initTestPage() {
    createPanel();
    ui('nh-st', '检测到测试页面...');
    ui('nh-et', '自动答题中');
      setStage('✏', '自动答题');
console.log('[Styx] 测试页初始化');

    var t0 = Date.now();
    var t = setInterval(function () {
      var vm = findTestVM();
      if (!vm) { if (Date.now() - t0 > CFG.mountTimeoutMs) { clearInterval(t); ui('nh-st', '超时', true); } return; }
      clearInterval(t);

      var extractResult = extractCorrectAnswers(vm);
      var correctAnswers = extractResult.answers;
      var questionTypes = extractResult.types || {};
      var totalQ = vm.dataList.length;
      // v3.1: Dynamic survey detection (type 4 or "问卷"/"调查")
      var surveyIdx = -1;
      var lastQ = vm.dataList[totalQ - 1];
      if (lastQ && (lastQ.type === 4 || (lastQ.typeDesc && (lastQ.typeDesc.indexOf('问卷') > -1 || lastQ.typeDesc.indexOf('调查') > -1)))) {
        surveyIdx = totalQ - 1;
        console.log('[Styx] 检测到问卷题(idx=' + surveyIdx + ')，将跳过');
      }
      var hasAnswers = Object.keys(correctAnswers).length > 0;

      ui('nh-ln', '共' + totalQ + '题' + (hasAnswers ? ' (有答案!)' : ' (猜测模式)'));
      console.log('[Styx] 测试题数:', totalQ, '正确答案:', hasAnswers ? correctAnswers : '无');

      // ── Strategy selection ──
      var strategy = hasAnswers ? 'answer' : CFG.testAnswerStrategy;
      var attempt = 0;
      var maxAttempts = CFG.testRetryMax;

      // Capture periodId for auto-proceed
      var periodId = null;
      try { periodId = vm.$route ? vm.$route.query.periodId : null; } catch(e) {}
      if (!periodId) { var up = new URLSearchParams(location.search); periodId = up.get('periodId'); }

      function runOneRound() {
        attempt++;
        console.log('[Styx] 第 ' + attempt + '/' + maxAttempts + ' 轮答题');
        ui('nh-st', '📝 答题中 第' + attempt + '轮 (' + strategy + ')');
        ui('nh-pg', '0/' + totalQ);

        var answered = 0;
        var answeredFlags = new Array(totalQ).fill(false);
        var questionContainers = null;
        var currentPage = 0;
        var maxPages = 30;
        var pageStuckCount = 0;
        var lastAnsweredCount = -1;

        // ── DOM visibility check ──
        function isVisible(el) {
          if (!el) return false;
          var rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) return false;
          var style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          var p = el.parentElement;
          while (p) {
            var ps = window.getComputedStyle(p);
            if (ps.display === 'none' || ps.visibility === 'hidden') return false;
            p = p.parentElement;
          }
          return true;
        }

        function findQuestionContainers() {
          // Check radio groups
          var groups = document.querySelectorAll('.el-radio-group');
          if (groups.length >= totalQ) {
            console.log('[Styx] 找到 ' + groups.length + ' 个 radio-group');
            return Array.prototype.slice.call(groups);
          }
          // Check checkbox groups (multi-select questions)
          var cbGroups = document.querySelectorAll('.el-checkbox-group');
          if (cbGroups.length >= totalQ) {
            console.log('[Styx] 找到 ' + cbGroups.length + ' 个 checkbox-group');
            return Array.prototype.slice.call(cbGroups);
          }
          // Check combined: radio + checkbox groups
          var allGroups = document.querySelectorAll('.el-radio-group, .el-checkbox-group');
          if (allGroups.length >= totalQ) {
            console.log('[Styx] 找到 ' + allGroups.length + ' 个 mixed-group');
            return Array.prototype.slice.call(allGroups);
          }
          var items = document.querySelectorAll('[class*="question"], [class*="topic"], [class*="subject"]');
          if (items.length >= totalQ) {
            console.log('[Styx] 找到 ' + items.length + ' 个 question-block');
            return Array.prototype.slice.call(items).slice(0, totalQ);
          }
          return null;
        }

        function answerQuestion(qIdx) {
          // Skip survey question (dynamically detected)
          if (surveyIdx >= 0 && qIdx === surveyIdx) {
            console.log('[Styx] Q' + (qIdx + 1) + ' → 问卷，跳过');
            return true;
          }
          var target = correctAnswers[qIdx];

          // Vue model assignment (userAnswer + status)
          if (setAnswerViaVue(vm, qIdx, target)) {
            return true;
          }

          // FALLBACK: DOM clicking (should rarely be needed)
          var container = questionContainers ? questionContainers[qIdx] : null;

          if (container) {
            if (target) {
              // Multi-select: delegate to scoped multi-click
              if (target.indexOf(',') > -1) {
                var parts = target.split(',');
                var clicked = 0;
                for (var p = 0; p < parts.length; p++) {
                  var letter = parts[p].trim();
                  if (!letter) continue;
                  var found = false;
                  // Checkboxes in container
                  var cbxs = container.querySelectorAll('.el-checkbox');
                  for (var c = 0; c < cbxs.length && !found; c++) {
                    var cbt = (cbxs[c].textContent || '').trim();
                    var cbm = cbt.match(/^([A-E])[\s\.、．）\))]/);
                    if (cbm && cbm[1] === letter) {
                      var cbo = cbxs[c].querySelector('.el-checkbox__original');
                      if (cbo) { cbo.checked = true; cbo.dispatchEvent(new Event('change', { bubbles: true })); }
                      cbxs[c].click();
                      cbxs[c].dispatchEvent(new MouseEvent('click', { bubbles: true }));
                      console.log('[Styx] Q' + (qIdx + 1) + ' → ' + letter + ' (s-cb)');
                      found = true;
                    }
                  }
                  // Plain checkboxes in container
                  if (!found) {
                    var pcbs = container.querySelectorAll('input[type="checkbox"]');
                    for (var pc = 0; pc < pcbs.length && !found; pc++) {
                      if ((pcbs[pc].value || '').toUpperCase() === letter) {
                        pcbs[pc].checked = true;
                        pcbs[pc].dispatchEvent(new Event('change', { bubbles: true }));
                        pcbs[pc].click();
                        console.log('[Styx] Q' + (qIdx + 1) + ' → ' + letter + ' (s-pcb)');
                        found = true;
                      }
                    }
                  }
                  // Generic fallback in container
                  if (!found) {
                    var gels = container.querySelectorAll('label, span, div, li');
                    for (var ge = 0; ge < gels.length && !found; ge++) {
                      var get = (gels[ge].textContent || '').trim();
                      var gem = get.match(/^([A-E])[\s\.、．）\))]/);
                      if (gem && gem[1] === letter && get.length < 200) {
                        gels[ge].click();
                        gels[ge].dispatchEvent(new MouseEvent('click', { bubbles: true }));
                        console.log('[Styx] Q' + (qIdx + 1) + ' → ' + letter + ' (s-gen)');
                        found = true;
                      }
                    }
                  }
                  if (found) clicked++;
                }
                console.log('[Styx] Q' + (qIdx + 1) + ' 多选: ' + target + ' → ' + clicked + '/' + parts.length);
                return clicked > 0;
              }
              // 判断题: answer is text like "正确"/"错误"
              if (target === '正确' || target === '错误' || target === '对' || target === '错') {
                var judgeEls = container.querySelectorAll('label, span, div, li, .el-radio, .el-checkbox');
                for (var ji = 0; ji < judgeEls.length; ji++) {
                  var jt = (judgeEls[ji].textContent || '').trim();
                  if (jt === target || jt.indexOf(target) === 0) {
                    var jOrig = judgeEls[ji].querySelector('.el-radio__original, .el-checkbox__original, input');
                    if (jOrig) { jOrig.checked = true; jOrig.dispatchEvent(new Event('change', { bubbles: true })); }
                    judgeEls[ji].click();
                    judgeEls[ji].dispatchEvent(new MouseEvent('click', { bubbles: true }));
                    console.log('[Styx] Q' + (qIdx + 1) + ' → ' + target + ' (scoped-judge)');
                    return true;
                  }
                }
                return false;
              }
              // Single-select
              var radios = container.querySelectorAll('.el-radio');
              for (var i = 0; i < radios.length; i++) {
                var txt = (radios[i].textContent || '').trim();
                var m = txt.match(/^([A-E])[\s\.、．）\))]/);
                if (m && m[1] === target) {
                  var orig = radios[i].querySelector('.el-radio__original');
                  if (orig) { orig.checked = true; orig.dispatchEvent(new Event('change', { bubbles: true })); }
                  radios[i].click();
                  radios[i].dispatchEvent(new MouseEvent('click', { bubbles: true }));
                  console.log('[Styx] Q' + (qIdx + 1) + ' → ' + target + ' (scoped)');
                  return true;
                }
              }
              var inputs = container.querySelectorAll('input[type="radio"]');
              for (var j = 0; j < inputs.length; j++) {
                if ((inputs[j].value || '').toUpperCase() === target) {
                  inputs[j].checked = true;
                  inputs[j].dispatchEvent(new Event('change', { bubbles: true }));
                  inputs[j].click();
                  console.log('[Styx] Q' + (qIdx + 1) + ' → ' + target + ' (input)');
                  return true;
                }
              }
              return false;
            } else {
              // No target (empty answer) — try to guess
              var firstRadio = container.querySelector('.el-radio');
              if (firstRadio) {
                var orig2 = firstRadio.querySelector('.el-radio__original');
                if (orig2) { orig2.checked = true; orig2.dispatchEvent(new Event('change', { bubbles: true })); }
                firstRadio.click();
                console.log('[Styx] Q' + (qIdx + 1) + ' → guess');
                return true;
              }
              // Also try checkboxes for multi-select with no answer
              var firstCB = container.querySelector('.el-checkbox');
              if (firstCB) {
                var cbo3 = firstCB.querySelector('.el-checkbox__original');
                if (cbo3) { cbo3.checked = true; cbo3.dispatchEvent(new Event('change', { bubbles: true })); }
                firstCB.click();
                console.log('[Styx] Q' + (qIdx + 1) + ' → guess(cb)');
                return true;
              }
              return false;
            }
          } else {
            if (target) return clickOption(target);
            return clickAnyOption();
          }
        }

        // ── Navigate to next page of questions ──
        function navigateToNextPage() {
          // 1) Element UI pagination "next" button
          var nextBtn = document.querySelector('.el-pagination .btn-next:not(.disabled)');
          if (nextBtn) { nextBtn.click(); console.log('[Styx] 翻页: btn-next'); return true; }

          // 2) Active page number's sibling
          var activeLi = document.querySelector('.el-pager li.active');
          if (activeLi && activeLi.nextElementSibling && activeLi.nextElementSibling.tagName === 'LI') {
            activeLi.nextElementSibling.click();
            console.log('[Styx] 翻页: next page number');
            return true;
          }

          // 3) "下一页" text button
          var allBtns = document.querySelectorAll('button, .el-button');
          for (var i = 0; i < allBtns.length; i++) {
            var bt = (allBtns[i].textContent || '').trim();
            if (bt.indexOf('下一页') > -1 || bt === '>' || bt === '›') {
              allBtns[i].click();
              console.log('[Styx] 翻页: 按钮 ' + bt);
              return true;
            }
          }

          // 4) Element UI tabs
          var tabs = document.querySelectorAll('.el-tabs__item:not(.is-active)');
          for (var j = 0; j < tabs.length; j++) {
            if (isVisible(tabs[j])) {
              tabs[j].click();
              console.log('[Styx] 翻页: tab');
              return true;
            }
          }

          return false;
        }

        // ── Main answer loop ──
        var nextAnswerTime = 0; // v1.2: random delay between answers (800-3500ms)
        var answerTimer = setInterval(function () {
          if (questionContainers === null) {
            questionContainers = findQuestionContainers();
          }

          var answeredThisRound = 0;

          // Answer visible unanswered questions
          for (var qIdx = 0; qIdx < totalQ; qIdx++) {
            if (answeredFlags[qIdx]) continue;
            // Skip survey question
            if (surveyIdx >= 0 && qIdx === surveyIdx) { answeredFlags[qIdx] = true; answered++; answeredThisRound++; continue; }
            // Skip invisible containers (hidden pages/tabs)
            if (questionContainers && !isVisible(questionContainers[qIdx])) continue;
            // v1.2: random delay between questions (anti-detect)
            if (Date.now() < nextAnswerTime) continue;
            if (answerQuestion(qIdx)) {
              answeredFlags[qIdx] = true;
              answered++;
              answeredThisRound++;
              // Schedule next answer after random delay 800-3500ms
              nextAnswerTime = Date.now() + Math.floor(Math.random() * 2700) + 800;
            }
          }

          if (answeredThisRound > 0) {
            ui('nh-pg', answered + '/' + totalQ);
            console.log('[Styx] 已答 ' + answered + '/' + totalQ + ' (本轮+' + answeredThisRound + ', 页' + (currentPage + 1) + ')');
            pageStuckCount = 0;
            lastAnsweredCount = answered;
          }

          // All done → submit
          if (answered >= totalQ) {
            clearInterval(answerTimer);
            ui('nh-st', '✅ 全部答完，提交中...');
            ui('nh-pg', totalQ + '/' + totalQ);
            setTimeout(function () {
  setStage('✅', '提交中');
              // Try Vue submit first, then button click, then retry
              var submitted = clickSubmit();
              if (!submitted) {
                // Try again after a short delay
                setTimeout(function() {
                  submitted = clickSubmit();
                  if (!submitted) {
                    // Last resort: find any submit button
                    var allBtns = document.querySelectorAll('button');
                    for (var bi = 0; bi < allBtns.length; bi++) {
                      var bt = (allBtns[bi].textContent || '').trim();
                      if (bt.length < 10) {
                        allBtns[bi].click();
                        submitted = true;
                        console.log('[Styx] 尝试提交按钮: ' + bt);
                        break;
                      }
                    }
                  }
                }, 1500);
              }
              if (submitted) {
                console.log('[Styx] 已提交');
                ui('nh-st', '📝 已提交，等待结果...');
                watchResult();
              } else {
                console.log('[Styx] 所有提交方式失败');
                ui('nh-st', '❌ 提交失败', true);
              }
            }, 1000);
            return;
          }

          // Nothing answered this round → try page navigation
          if (answeredThisRound === 0) {
            // v1.3: Don't count as stuck if we're waiting for random delay
            if (nextAnswerTime > 0 && Date.now() < nextAnswerTime) {
              pageStuckCount = 0; // waiting for delay, reset stuck counter
            } else if (lastAnsweredCount === answered) {
              pageStuckCount++;
            }
            lastAnsweredCount = answered;

            if (pageStuckCount >= 3) {
              if (currentPage < maxPages && navigateToNextPage()) {
                currentPage++;
                pageStuckCount = 0;
                console.log('[Styx] → 第 ' + (currentPage + 1) + ' 页');
                ui('nh-et', '第' + (currentPage + 1) + '页');
              } else {
                // Give up, submit what we have
                clearInterval(answerTimer);
                console.log('[Styx] 无法翻页，提交已答 ' + answered + '/' + totalQ);
                ui('nh-st', '⚠ 部分(' + answered + '/' + totalQ + ')，提交...');
                setTimeout(function () {
                  if (!clickSubmit()) {
                    // Try Vue direct submit as fallback
                    try {
                      var xt2 = document.querySelector('#__xt');
                      if (xt2 && xt2.__vue__) {
                        function walkSubmit(vm2, d2) {
                          if (!vm2 || d2 > 10) return false;
                          if (vm2.$options && vm2.$options.methods) {
                            for (var mk in vm2.$options.methods) {
                              if (mk.indexOf('submit') > -1 || mk.indexOf('finish') > -1 || mk.indexOf('commit') > -1) {
                                try { vm2.$options.methods[mk].call(vm2); console.log('[Styx] 强制提交: ' + mk); return true; } catch(e) {}
                              }
                            }
                          }
                          if (vm2.$children) { for (var mc = 0; mc < vm2.$children.length; mc++) { if (walkSubmit(vm2.$children[mc], d2 + 1)) return true; } }
                          return false;
                        }
                        walkSubmit(xt2.__vue__, 0);
                      }
                    } catch(e) { console.log('[Styx] 强制提交异常:', e); }
                  }
                  watchResult();
                }, 500);
              }
            }
          }
        }, hasAnswers ? 600 : 1200);
      }

      // ── Watch for test result after submission ──
      function watchResult() {
        var retriesLeft = maxAttempts - attempt;
        var resultTimer = setInterval(function () {
          // Detect result page navigation
          var onReportPage = location.pathname.indexOf('/report/paper') > -1;
          var bodyTxt = (document.body.textContent || '');

          // Extract score if visible
          var scoreMatch = bodyTxt.match(/(\d+)\s*分/) || bodyTxt.match(/得分[：:]\s*(\d+)/);
          var correctMatch = bodyTxt.match(/(\d+)\/\d+/) || bodyTxt.match(/正确题数[：:]\s*(\d+)/);
          var wrongMatch = bodyTxt.match(/答错[：:]\s*(\d+)/);
          var unansweredMatch = bodyTxt.match(/未答[：:]\s*(\d+)/);

          if (onReportPage || scoreMatch || correctMatch) {
            clearInterval(resultTimer);
            var score = scoreMatch ? scoreMatch[1] : '?';
            var correct = correctMatch ? correctMatch[1] : '?';
            console.log('[Styx] 测试完成 — 得分:' + score + ' 正确:' + correct);

            // Check if passed (score > 0 OR no "不通过" on the page)
            // v2.0: Tri-state: true=passed, false=failed, null=unknown (no retry)
            var passed = null;
            try {
              var backEl3 = document.querySelector('.back-btn');
              if (backEl3 && backEl3.__vue__ && backEl3.__vue__.$parent) {
                var reportVm3 = backEl3.__vue__.$parent;
                var rd = null;
                if (reportVm3.report && typeof reportVm3.report === 'string') {
                  rd = JSON.parse(reportVm3.report);
                } else if (reportVm3.reportData) {
                  rd = reportVm3.reportData;
                }
                if (rd && typeof rd.score === 'number') {
                  score = String(rd.score);
                  passed = rd.score >= 60;
                }
              }
            } catch(e) { console.log('[Styx] watchResult Vue parse:', e); }

            if (passed === true || (passed === null && (parseInt(score) >= 60 || correct !== '?' || onReportPage))) {
              ui('nh-st', '✅ 得分:' + score + ' (' + correct + '/' + (totalQ || '?') + ')');
              console.log('[Styx] 测试通过 得分=' + score);

// v1.8: Full page navigation (not SPA back) + set auto_return flag
              // SPA handleBack() causes stale course data → dead loop
              setTimeout(function() {
                try { sessionStorage.setItem('ncme_auto_return', '1'); } catch(e) {}
                var params = new URLSearchParams(location.search);
                var pid = params.get('periodId') || periodId;
                if (pid) {
                  // v3.1: Use referrer if it has the correct course page URL (handles new multi-module courses)
                  var ref2 = document.referrer;
                  var courseUrl;
                  if (ref2 && ref2.indexOf('/study-course/') > -1) {
                    courseUrl = ref2;
                  } else {
                    courseUrl = '/study-course/0?periodId=' + pid;
                  }
                  console.log('[Styx] Full nav to course: ' + courseUrl);
                  window.location.href = courseUrl;
                } else {
                  var ref = document.referrer;
                  if (ref && ref.indexOf('/study-course/') > -1) {
                    window.location.href = ref;
                  } else {
                    try { window.history.back(); } catch(e) { location.reload(); }
                  }
                }
              }, 3000);
            } else {
              ui('nh-st', '❌ 未通过 得分:' + score);
              console.log('[Styx] 测试未通过');
            }
            return;
          }

          // Detect failure and retry (v2.0: only retry if Vue data confirms fail)
          if (passed === false) {
            if (retriesLeft > 0) {
              retriesLeft--;
              clearInterval(resultTimer);
              ui('nh-st', '🔄 未通过，重试(' + retriesLeft + '/' + maxAttempts + ')...');
              console.log('[Styx] 测试未通过，剩余重试:', retriesLeft);
              // v1.3: Use Vue component handleAgain for retry
              setTimeout(function () {
                var retried = false;
                // Approach 1: Find report component via .back-btn and call handleAgain
                var backEl2 = document.querySelector('.back-btn');
                if (backEl2 && backEl2.__vue__ && backEl2.__vue__.$parent) {
                  var reportVm2 = backEl2.__vue__.$parent;
                  if (typeof reportVm2.handleAgain === 'function') {
                    reportVm2.handleAgain();
                    console.log('[Styx] Vue handleAgain called');
                    retried = true;
                  }
                }
                // Approach 2: Try "重新练习" button on report page
                if (!retried) {
                  var againBtn = document.querySelector('.btn.el-button--success');
                  if (againBtn) { againBtn.click(); retried = true; console.log('[Styx] Clicked 重新练习'); }
                }
                // Approach 3: Fallback - clickButton text search
                if (!retried) {
                  retried = clickButton('重新练习') || clickButton('再试') || clickButton('重做');
                }
                // Approach 4: Reload the page as last resort
                if (!retried) {
                  setTimeout(function () {
                    if (document.body.textContent.indexOf('不通过') !== -1 ||
                        document.body.textContent.indexOf('未通过') !== -1) {
                      console.log('[Styx] 无重试按钮，刷新页面');
                      location.reload();
                    }
                  }, 2000);
                } else {
                  // Retry will re-trigger initTestPage
                  setTimeout(function () { runOneRound(); }, 2000);
                }
              }, 1500);
            } else {
              clearInterval(resultTimer);
              ui('nh-st', '❌ 重试耗尽，请手动处理', true);
              console.log('[Styx] 测试重试耗尽');
            }
            return;
          }
        }, 2000);

        // Timeout after 60 seconds
        setTimeout(function () {
          clearInterval(resultTimer);
          if (retriesLeft > 0) {
            console.log('[Styx] 结果监听超时，刷新重试');
            location.reload();
          }
        }, 60000);
      }

      // ── Start first round ──
      runOneRound();
    }, 500);
  }

  // ═══════════════════════════════════════════════════
  //  Course Page — Scan & Navigate
  // ═══════════════════════════════════════════════════
  function findCourseData() {
    const xt = document.querySelector('#__xt');
    if (!xt || !xt.__vue__) return null;

    // Find component with btnClickFn (has courseList / stageList)
    function findVM(vm,d) {
      if (!vm||d>8) return null;
      if (vm.$options&&vm.$options.methods&&vm.$options.methods.btnClickFn) return vm;
      if (vm.$children) { for (let i=0;i<vm.$children.length;i++) { const f=findVM(vm.$children[i],d+1); if(f) return f; } }
      return null;
    }
    const btnVM = findVM(xt.__vue__,0);
    if (!btnVM) return null;

    let periodId = null;
    try { periodId = xt.__vue__.$children[1].$children[0].periodId; } catch(e) {}
    if (!periodId) { const p=new URLSearchParams(location.search); periodId=p.get('periodId'); }

    // ── StageList structure (rare: some courses have stageList deep in tree) ──
    if (btnVM.stageList && btnVM.stageList.length > 0) {
      const stage = btnVM.stageList[0];
      if (!stage.contentList) return null;
      const materials = [];
      for (var sci = 0; sci < stage.contentList.length; sci++) {
        var chapter = stage.contentList[sci];
        if (chapter.materialList && Array.isArray(chapter.materialList)) {
          for (var smi = 0; smi < chapter.materialList.length; smi++) {
            var smat = chapter.materialList[smi];
            smat._kcid = chapter.id; // v3.1.1: tag with parent chapter's ID
            materials.push(smat);
          }
        }
      }
      console.log('[Styx] stageList: ' + stage.contentList.length + '章节 → ' + materials.length + '素材');
      return {
        materials: materials,
        courseId: 0,
        courseName: stage.stageName || stage.name || '课程',
        periodId: periodId,
        btnVM: btnVM,
      };
    }

    // ── CourseList structure ──
    // v3.1: Flatten ALL course modules (old courses have 1 module, new ones have 2-8)
    if (!btnVM.courseList || !btnVM.courseList.length) return null;
    const materials = [];
    var courseName = '';
    var courseId = 0;
    for (var ci = 0; ci < btnVM.courseList.length; ci++) {
      var courseItem = btnVM.courseList[ci];
      if (courseItem.materialList && Array.isArray(courseItem.materialList)) {
        for (var cmi = 0; cmi < courseItem.materialList.length; cmi++) {
          var mat = courseItem.materialList[cmi];
          // v3.1.1: Tag each material with its parent module's ID for correct kcid
          mat._kcid = courseItem.id;
          materials.push(mat);
        }
      }
      if (!courseName && courseItem.name) courseName = courseItem.name;
      if (!courseId && courseItem.id) courseId = courseItem.id;
    }
    if (!materials.length) return null;

    console.log('[Styx] courseList: ' + btnVM.courseList.length + '模块 → ' + materials.length + '素材');
    return {
      materials: materials,
      courseId: courseId,
      courseName: courseName,
      periodId: periodId,
      btnVM: btnVM,
    };
  }

  function findNextMaterial(materials) {
    // priority: uncompleted videos first, then unpassed tests
    // v1.7: Skip the last-opened material to prevent loop on stale data
    var skipId = null;
    try { skipId = sessionStorage.getItem('ncme_last_material_id'); } catch(e) {}

    const nextVideo = materials.find(function(m) {
      return m.type===2 && m.studyStatus!==2 && String(m.id) !== skipId;
    });
    if (nextVideo) return nextVideo;

    // If all videos done, check for unpassed tests
    const nextTest = materials.find(function(m) {
      return m.type===4 && m.studyStatus!==2 && String(m.id) !== skipId;
    });
    return nextTest || null;
  }

  // ── Report page handler (v1.4) ──
  function initReportPage() {
    createPanel();
      setStage('★', '查看报告');
console.log('[Styx] Report页初始化');

    var t0 = Date.now();
    var t = setInterval(function() {
      // Wait for .back-btn to appear (Vue hydration)
      var backEl = document.querySelector('.back-btn');
      if (!backEl || !backEl.__vue__ || !backEl.__vue__.$parent) {
        if (Date.now() - t0 > CFG.mountTimeoutMs) { clearInterval(t); console.log('[Styx] Report超时'); }
        return;
      }
      clearInterval(t);

      var reportVm = backEl.__vue__.$parent;
      // v1.9: Use Vue data for reliable score/pass detection
      // Body text scanning has false positives (dictCode mappings in page JS contain "不通过"/"未通过")
      var score = '?';
      var passed = false;
      try {
        var reportData = null;
        if (reportVm.report && typeof reportVm.report === 'string') {
          reportData = JSON.parse(reportVm.report);
        } else if (reportVm.reportData) {
          reportData = reportVm.reportData;
        }
        if (reportData && typeof reportData.score === 'number') {
          score = String(reportData.score);
          passed = reportData.score >= 60;
        }
      } catch(e) { console.log('[Styx] Report Vue data parse failed:', e); }

      // v2.0: Poll Vue data if not immediately available (don't fall back to body text)
      if (score === '?') {
        var pollAttempts = 0;
        var maxPollAttempts = 20;
        var pollVueTimer = setInterval(function() {
          pollAttempts++;
          try {
            var rd2 = null;
            if (reportVm.report && typeof reportVm.report === 'string') {
              rd2 = JSON.parse(reportVm.report);
            } else if (reportVm.reportData) {
              rd2 = reportVm.reportData;
            }
            if (rd2 && typeof rd2.score === 'number') {
              score = String(rd2.score);
              passed = rd2.score >= 60;
              clearInterval(pollVueTimer);
              console.log('[Styx] Report Vue poll success (attempt ' + pollAttempts + '): score=' + score + ' passed=' + passed);
              proceed();
            }
          } catch(e2) {}
          if (pollAttempts >= maxPollAttempts) {
            clearInterval(pollVueTimer);
            console.log('[Styx] Report Vue poll exhausted, assuming passed');
            passed = true;
            proceed();
          }
        }, 500);
        // Don't proceed yet - wait for poll
        return;
      }

      proceed();

      function proceed() {
      console.log('[Styx] Report得分=' + score + ' 通过=' + passed);

      if (!passed) {
        ui('nh-st', '❌ 未通过(' + score + ')，重试中...');
        // Retry: call handleAgain after short pause
        setTimeout(function() {
          if (typeof reportVm.handleAgain === 'function') {
            reportVm.handleAgain();
            console.log('[Styx] Report handleAgain called');
          } else {
            console.log('[Styx] handleAgain not found, reloading');
            location.reload();
          }
        }, 2000);
      } else {
        ui('nh-st', '✅ 通过！' + score + '分，返回课程...');
        // v1.5: Full page navigation to course (not SPA back)
        // SPA back keeps stale course data -> loops same test
        setTimeout(function() {
            setStage('★', '返回课程'); // report pass
// v1.6: Mark as auto-return so initCourse knows to auto-proceed
          try { sessionStorage.setItem('ncme_auto_return', '1'); } catch(e) {}
          // Extract periodId from URL
          var params = new URLSearchParams(location.search);
          var pid = params.get('periodId');
          // Try document.referrer first (if user came from course page)
          var ref = document.referrer;
          if (ref && ref.indexOf('/study-course/') > -1) {
            console.log('[Styx] Full nav to referrer: ' + ref);
            window.location.href = ref;
          } else if (pid) {
            var courseUrl = '/study-course/0?periodId=' + pid;
            console.log('[Styx] Full nav to: ' + courseUrl);
            window.location.href = courseUrl;
          } else {
            // Fallback: SPA back
            console.log('[Styx] Fallback: SPA back');
            try { window.history.back(); } catch(e) { location.reload(); }
          }
        }, 3000);
      }
      } // end proceed()
    }, 500);
  }

  function initCourse() {
    createPanel();
    setStage('◈', '扫描课程');
console.log('[Styx] 课程页初始化');

    var t0 = Date.now();
    var t = setInterval(function() {
      var data = findCourseData();
      if (!data) { if (Date.now()-t0>CFG.mountTimeoutMs) { clearInterval(t); ui('nh-st','超时',true); } return; }
      clearInterval(t);

      var materials = data.materials;
      var courseId = data.courseId;
      var courseName = data.courseName;
      var periodId = data.periodId;
      var btnVM = data.btnVM;

      var videos = materials.filter(function(m){return m.type===2;});
      var tests = materials.filter(function(m){return m.type===4;});
      var completedV = videos.filter(function(m){return m.studyStatus===2;}).length;

      ui('nh-ln',courseName||'共'+videos.length+'节课');
      ui('nh-pg',completedV+'/'+videos.length+'视频');

      var next = findNextMaterial(materials);
      if (!next) { setStage('★', '课程已全部完成'); ui('nh-st','🏁 课程已全部完成'); return; }

      // v1.6: Only auto-proceed if script auto-returned from test
      var isAutoReturn = false;
      try { isAutoReturn = sessionStorage.getItem('ncme_auto_return') === '1'; sessionStorage.removeItem('ncme_auto_return'); } catch(e) {}

      if (!isAutoReturn) {
        // Manual entry: show status only, don't auto-navigate
        ui('nh-st', '📍 ' + (next.type === 2 ? '下一视频: ' + next.name : '下一测试: ' + next.name));
        ui('nh-et', '手动进入，等待操作');
          setStage('⌛', '等待操作');
console.log('[Styx] 手动进入课程页，不自动跳转');
        return;
      }

      // ── Countdown before auto-navigation (v1.6: auto-return only) ──
      // User can press ESC during countdown to pause automation and browse
      var delaySec = CFG.courseDelayMs / 1000;
        setStage('⏳', '自动跳转中'); // countdown start
var countdown = delaySec;

      ui('nh-st', '⏳ ' + countdown + '秒后自动继续...');
      ui('nh-et', '按ESC暂停');

      var countdownTimer = setInterval(function() {
        if (AUTO_PAUSED) {
          ui('nh-st', '⏸ 已暂停');
          ui('nh-et', '按ESC恢复');
          return; // don't count down while paused
        }
        countdown--;
        if (countdown <= 0) {
          clearInterval(countdownTimer);
          doNavigate();
        } else {
          ui('nh-st', '⏳ ' + countdown + '秒后自动继续...');
        }
      }, 1000);

      function doNavigate() {
        if (AUTO_PAUSED) {
          // Wait a bit and retry
          setTimeout(doNavigate, 1000);
          return;
        }

        // Re-fetch data to ensure it's current
        var freshData = findCourseData();
        if (freshData) {
          materials = freshData.materials;
          courseId = freshData.courseId;
          periodId = freshData.periodId;
          btnVM = freshData.btnVM;
          next = findNextMaterial(materials);
        }

        if (!next) { setStage('★', '课程已全部完成'); ui('nh-st','🏁 课程已全部完成'); return; }

        if (next.type === 2) {
          // Video lesson
          ui('nh-st','→ 视频: '+next.name);
          setTimeout(function() {
            if (!AUTO_PAUSED) {
                setStage('▶', '跳转视频');
window.location.href = buildVideoURL(next.id,next.materialId,periodId,next._kcid||courseId);
            }
          }, 500);
        } else {
          // Test
          var testVideos = videos.filter(function(m){return m.studyStatus===2;}).length;
          ui('nh-st','📝 测试: '+next.name);
          ui('nh-pg',testVideos+'/'+videos.length+'视频完, 需测试');
            setStage('▶', '跳转测试');
console.log('[Styx] 打开测试弹窗:', next.name);

          var testRetries = CFG.testRetryMax;
          var testPollTimer = null;

          function openTestPopup() {
            // v2.1: Track which material we're opening to prevent loop
            try { sessionStorage.setItem('ncme_last_material_id', String(next.id)); } catch(e) {}
            // v2.1: Use DOM click instead of btnClickFn (which doesn't work from script)
            var targetName = next.name;
            var clicked = false;
            var allEls = document.querySelectorAll('*');
            for (var ei = 0; ei < allEls.length; ei++) {
              var el = allEls[ei];
              if (el.childNodes.length === 1 &&
                  el.childNodes[0].nodeType === 3 &&
                  el.childNodes[0].textContent.trim() === '\u53bb\u505a\u9898') {
                // Check if this button's context matches our target material
                var ctx = el.parentElement;
                var steps = 0;
                while (ctx && steps < 10 && (ctx.textContent || '').length < 80) {
                  ctx = ctx.parentElement;
                  steps++;
                }
                if (ctx && ctx.textContent && ctx.textContent.indexOf(targetName) > -1) {
                  el.click();
                  clicked = true;
                  console.log('[Styx] DOM click \u53bb\u505a\u9898: ' + targetName + ' (material=' + next.id + ')');
                  break;
                }
              }
            }
            if (!clicked) {
              // Fallback: try btnClickFn (may not work, but last resort)
              var course = btnVM.courseList ? btnVM.courseList[0] : null;
              try { btnVM.btnClickFn(next, course); console.log('[Styx] btnClickFn fallback material=' + next.id); }
              catch(e) { console.error('[Styx] btnClickFn failed:', e); }
            }
          }

          function pollTestResult() {
            var pollStart = Date.now();
            var pollTimeout = 5 * 60 * 1000;
            clearInterval(testPollTimer);

            testPollTimer = setInterval(function() {
              if (AUTO_PAUSED) return;

              var elapsed = Date.now() - pollStart;
              if (elapsed > pollTimeout) {
                clearInterval(testPollTimer);
                testRetries--;
                if (testRetries > 0) {
                  ui('nh-st', '🔄 测试超时，重试(' + testRetries + '/' + CFG.testRetryMax + ')...');
                  console.log('[Styx] 测试轮询超时，剩余重试:', testRetries);
                  openTestPopup();
                  pollTestResult();
                } else {
                  ui('nh-st', '❌ 测试失败，已达最大重试', true);
                }
                return;
              }

              var elapsedMin = Math.floor(elapsed / 60000);
              var elapsedSec = Math.floor((elapsed % 60000) / 1000);
              ui('nh-et', elapsedMin + '分' + String(elapsedSec).padStart(2, '0') + '秒');

              var freshData2 = findCourseData();
              if (!freshData2) return;
              var testMat = freshData2.materials.find(function(m) {
                return m.type===4 && m.id===next.id;
              });
              if (testMat && testMat.studyStatus === 2) {
                clearInterval(testPollTimer);
                ui('nh-st','✅ 测试通过！'); setStage('★', '课程已全部完成');
                var nextNext = findNextMaterial(freshData2.materials);
                if (nextNext && nextNext.type === 2) {
                  setTimeout(function() {
                    if (!AUTO_PAUSED) {
                      window.location.href = buildVideoURL(nextNext.id,nextNext.materialId,periodId,courseId);
                    }
                  }, 1500);
                } else if (!nextNext) {
                  setStage('★', '课程已全部完成');
                  ui('nh-st','🏁 课程已全部完成');
                } else if (nextNext.type === 4) {
                  ui('nh-st','📝 下一个还是测试，继续...');
                  setTimeout(function() { if (!AUTO_PAUSED) location.reload(); }, 2000);
                }
              }
            }, 3000);
          }

          openTestPopup();
            setStage('⌛', '等待测试');
ui('nh-st','⏳ 等待完成测试...');
          pollTestResult();
        }
      }
    }, 500);
  }

  // ═══════════════════════════════════════════════════
  //  Entry
  // ═══════════════════════════════════════════════════
  // ── URL change monitor (v1.4: SPA re-trigger) ──
  var _lastPath = location.pathname;
  setInterval(function() {
    if (location.pathname !== _lastPath) {
      var old = _lastPath;
      _lastPath = location.pathname;
      console.log('[Styx] SPA导航: ' + old + ' -> ' + _lastPath);
      routePage(_lastPath);
    }
  }, 1500);

  function routePage(path) {
    if (path.includes('/qbank/do/report/')) {
      initReportPage();
    } else if (path.includes('/player/replay') || path.includes('/qbank/')) {
      initTestPage();
    } else if (path.includes('/player/record')) {
      initPlayer();
    } else if (path.includes('/study-course/')) {
      initCourse();
    } else {
      console.log('[Styx] 未匹配的路径:', path);
    }
  }

  function main() {
    var path = location.pathname;
    console.log('[Styx] 脚本启动 v3.2.0, path=' + path);
    routePage(path);
  }

  // Delay startup for SPA hydration (fixes Bug 1: UI not showing on first load)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(main, 500); });
  } else {
    setTimeout(main, 500);
  }
})();

