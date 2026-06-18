/**
 * sunflower-duanwu-care 交互脚本
 * 功能：音乐控制、萤火虫、粽子点击展开、向日葵绽放、祝福显示、彩蛋飘落
 */

(function () {
  'use strict';

  // ===== DOM 元素 =====
  var app = document.getElementById('app');
  var musicBtn = document.getElementById('musicBtn');
  var firefliesContainer = document.getElementById('fireflies');
  var zongzi = document.getElementById('zongzi');
  var zongziArea = document.getElementById('zongziArea');
  var sunflowerHead = document.getElementById('sunflowerHead');
  var notesContainer = document.getElementById('notesContainer');
  var stickyNotes = document.querySelectorAll('.sticky-note');
  var sceneTwo = document.getElementById('sceneTwo');
  var receiveBtn = document.getElementById('receiveBtn');
  var surpriseOverlay = document.getElementById('surpriseOverlay');
  var surpriseClose = document.getElementById('surpriseClose');
  var fallingContainer = document.getElementById('fallingContainer');

  // 状态标记
  var isOpened = false;       // 粽子是否已点击
  var isMusicPlaying = false; // 音乐是否播放中
  var fallingCount = 0;       // 当前飘落元素数量
  var MAX_FALLING = 30;       // 最大同时飘落数量

  // ===== 初始化萤火虫 =====
  function createFireflies() {
    var count = 18;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var dot = document.createElement('div');
      dot.className = 'firefly';
      // 随机位置
      dot.style.left = Math.random() * 94 + 3 + '%';
      dot.style.top = Math.random() * 88 + 6 + '%';
      // 随机动画参数
      dot.style.setProperty('--duration', (2.5 + Math.random() * 4) + 's');
      dot.style.setProperty('--delay', (Math.random() * 5) + 's');
      // 随机大小
      var size = 2 + Math.random() * 4;
      dot.style.width = size + 'px';
      dot.style.height = size + 'px';
      dot.style.boxShadow = '0 0 ' + (size * 2) + 'px ' + size + 'px rgba(255, 233, 160, 0.5)';
      frag.appendChild(dot);
    }
    firefliesContainer.appendChild(frag);
  }

  // ===== Web Audio API 温馨背景音乐 =====
  var audioCtx = null;
  var masterGain = null;
  var oscillators = [];
  var lfoGains = [];
  var allOscs = []; // 所有振荡器（含 LFO），停止时统一清理

  /**
   * 生成舒缓的 C 大调和弦环境音
   * 频率：C4(262) E4(330) G4(392) C5(523)
   */
  function startAmbientMusic(callback) {
    if (audioCtx) { if (callback) callback(); return; }
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      if (callback) callback();
      return;
    }

    // resume() 是异步的，必须等它完成才能调度音频
    var ready = (audioCtx.state === 'suspended')
      ? audioCtx.resume()
      : Promise.resolve();

    ready.then(function () {
      if (!audioCtx) return; // 可能在等待期间被 stop 了

      var t = audioCtx.currentTime;

      // 主音量
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(0, t);
      masterGain.gain.linearRampToValueAtTime(0.1, t + 1.5);
      masterGain.connect(audioCtx.destination);

      // 低通滤波
      var filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, t);
      filter.Q.setValueAtTime(0.4, t);
      filter.connect(masterGain);

      var freqs = [261.63, 329.63, 392.00, 523.25];

      for (var i = 0; i < freqs.length; i++) {
        var osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freqs[i], t);
        allOscs.push(osc);

        var noteGain = audioCtx.createGain();
        noteGain.gain.setValueAtTime(0, t);
        noteGain.gain.linearRampToValueAtTime(0.03, t + 1 + i * 0.4);

        var lfo = audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.1 + Math.random() * 0.15, t);
        allOscs.push(lfo);

        var lfoAmp = audioCtx.createGain();
        lfoAmp.gain.setValueAtTime(0.015, t);

        lfo.connect(lfoAmp);
        lfoAmp.connect(noteGain.gain);
        osc.connect(noteGain);
        noteGain.connect(filter);

        osc.start(t);
        lfo.start(t);

        oscillators.push(osc);
        lfoGains.push(noteGain);
      }

      if (callback) callback();
    }).catch(function () {
      if (callback) callback();
    });
  }

  function stopAmbientMusic() {
    if (!audioCtx) return;
    try {
      if (masterGain) {
        masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
      }
    } catch (e) {}
    setTimeout(function () {
      allOscs.forEach(function (o) { try { o.stop(); } catch (e) {} });
      allOscs = [];
      oscillators = [];
      lfoGains = [];
      try {
        if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
      } catch (e) {}
      audioCtx = null;
      masterGain = null;
    }, 600);
  }

  function initMusic() {
    musicBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isMusicPlaying) {
        stopAmbientMusic();
        musicBtn.classList.remove('playing');
        isMusicPlaying = false;
      } else {
        musicBtn.classList.add('playing');
        isMusicPlaying = true;
        startAmbientMusic(function () {
          // 如果启动失败，回退状态
          if (!audioCtx) {
            musicBtn.classList.remove('playing');
            isMusicPlaying = false;
          }
        });
      }
    });
  }

  // ===== 粽子点击：第一幕 → 第二幕 =====
  function initZongziClick() {
    zongzi.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isOpened) return; // 只能触发一次
      isOpened = true;

      // 1. 计算并触发便签飞向粽子中心
      flyNotesToCenter();

      // 2. 添加 opened class，触发 CSS 动画（粽叶展开、向日葵升起、花瓣绽放）
      app.classList.add('opened');

      // 3. 花瓣绽放完毕后，添加摇摆动画
      setTimeout(function () {
        sunflowerHead.classList.add('swaying');
      }, 2100);

      // 4. 向日葵完全盛开后，显示祝福区域
      setTimeout(function () {
        showSceneTwo();
      }, 2800);
    });
  }

  /**
   * 计算每张便签到粽子中心的距离，触发飞入动画
   */
  function flyNotesToCenter() {
    var zongziRect = zongzi.getBoundingClientRect();
    var centerX = zongziRect.left + zongziRect.width / 2;
    var centerY = zongziRect.top + zongziRect.height / 2;

    stickyNotes.forEach(function (note) {
      var noteRect = note.getBoundingClientRect();
      var noteCX = noteRect.left + noteRect.width / 2;
      var noteCY = noteRect.top + noteRect.height / 2;
      var dx = centerX - noteCX;
      var dy = centerY - noteCY;
      note.style.setProperty('--dx', dx + 'px');
      note.style.setProperty('--dy', dy + 'px');
      note.classList.add('flying');
    });
  }

  /**
   * 显示祝福区域（场景二），逐行淡入
   */
  function showSceneTwo() {
    sceneTwo.classList.add('visible');

    // 滚动到祝福区域（兼容老浏览器）
    setTimeout(function () {
      try {
        sceneTwo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (e) {
        sceneTwo.scrollIntoView();
      }
    }, 400);
  }

  // ===== 收下按钮：触发飘落动画 + 彩蛋卡片 =====
  function initReceiveBtn() {
    receiveBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      // 生成飘落元素
      spawnFallingItems();
      // 显示彩蛋卡片
      showSurpriseCard();
    });
  }

  /**
   * 生成飘落元素
   */
  function spawnFallingItems() {
    // 避免元素堆积导致卡顿
    if (fallingCount >= MAX_FALLING) return;

    var items = [
      { type: 'emoji', content: '☀️' },
      { type: 'emoji', content: '🍃' },
      { type: 'emoji', content: '💛' },
      { type: 'zongzi' }
    ];

    // 每次生成 8-12 个飘落元素
    var count = 8 + Math.floor(Math.random() * 5);

    for (var i = 0; i < count; i++) {
      if (fallingCount >= MAX_FALLING) break;

      var item = items[Math.floor(Math.random() * items.length)];
      var el;

      if (item.type === 'zongzi') {
        // 创建小粽子飘落元素
        el = createFallingZongzi();
      } else {
        // 创建 emoji 飘落元素
        el = document.createElement('span');
        el.className = 'falling-item';
        el.textContent = item.content;
      }

      // 随机水平位置
      el.style.left = (Math.random() * 90 + 5) + '%';
      // 随机下落时长
      el.style.setProperty('--fall-dur', (3 + Math.random() * 3) + 's');
      // 随机延迟
      el.style.setProperty('--fall-delay', (Math.random() * 1.5) + 's');
      // 随机旋转角度
      el.style.setProperty('--fall-rotate', (180 + Math.random() * 540) + 'deg');
      // 随机缩放
      var scale = 0.5 + Math.random() * 0.8;
      el.style.setProperty('--fall-scale', scale);
      el.style.fontSize = (1.2 + Math.random() * 1.6) + 'rem';

      fallingContainer.appendChild(el);
      fallingCount++;

      // 动画结束后移除元素
      (function (element) {
        var duration = parseFloat(element.style.getPropertyValue('--fall-dur')) * 1000;
        var delay = parseFloat(element.style.getPropertyValue('--fall-delay')) * 1000;
        setTimeout(function () {
          if (element.parentNode) {
            element.parentNode.removeChild(element);
            fallingCount--;
          }
        }, duration + delay + 200);
      })(el);
    }
  }

  /**
   * 创建飘落的小粽子元素
   */
  function createFallingZongzi() {
    var container = document.createElement('div');
    container.className = 'falling-zongzi';

    var leaf1 = document.createElement('div');
    leaf1.className = 'falling-zongzi-leaf';

    var body = document.createElement('div');
    body.className = 'falling-zongzi-body';

    var leaf2 = document.createElement('div');
    leaf2.className = 'falling-zongzi-leaf';

    container.appendChild(leaf1);
    container.appendChild(body);
    container.appendChild(leaf2);

    return container;
  }

  /**
   * 显示彩蛋卡片
   */
  function showSurpriseCard() {
    surpriseOverlay.classList.add('show');
  }

  /**
   * 关闭彩蛋卡片
   */
  function hideSurpriseCard() {
    surpriseOverlay.classList.remove('show');
  }

  // ===== 彩蛋关闭按钮 =====
  function initSurpriseClose() {
    surpriseClose.addEventListener('click', function (e) {
      e.stopPropagation();
      hideSurpriseCard();
    });

    // 点击遮罩层也可关闭
    surpriseOverlay.addEventListener('click', function (e) {
      if (e.target === surpriseOverlay) {
        hideSurpriseCard();
      }
    });
  }

  // ===== 启动 =====
  function init() {
    createFireflies();
    initMusic();
    initZongziClick();
    initReceiveBtn();
    initSurpriseClose();
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
