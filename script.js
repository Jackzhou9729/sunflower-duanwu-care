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
  var musicStarted = false;   // 音乐是否已启动（自动播放用）
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

  // ===== 背景音乐系统 =====
  // 优先播放 love.mp3（阿肆 - 直到你降临），文件不存在时 Web Audio 兜底
  var bgMusic = document.getElementById('bgMusic');
  var mp3Failed = false;

  // === Web Audio 兜底音乐：午后阳光般的舒缓环境音 ===
  var audioCtx = null;
  var masterGain = null;
  var allNodes = [];
  var melodyTimer = null;
  var chordTimer = null;

  function playNote(freq, startTime, duration, vol, dest) {
    if (!audioCtx) return;
    var osc = audioCtx.createOscillator(); osc.type='sine';
    osc.frequency.setValueAtTime(freq, startTime); allNodes.push(osc);
    var g = audioCtx.createGain();
    g.gain.setValueAtTime(0, startTime);
    g.gain.linearRampToValueAtTime(vol, startTime+0.15);
    g.gain.setValueAtTime(vol*0.6, startTime+duration*0.6);
    g.gain.linearRampToValueAtTime(0, startTime+duration);
    allNodes.push(g);
    osc.connect(g); g.connect(dest); osc.start(startTime); osc.stop(startTime+duration+0.2);
  }

  function startAmbientMusic(callback) {
    if (audioCtx) { if(callback)callback(); return; }
    try { audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch(e){ if(callback)callback(); return; }
    var ready = (audioCtx.state==='suspended') ? audioCtx.resume() : Promise.resolve();
    ready.then(function(){
      if(!audioCtx)return; var t=audioCtx.currentTime;

      // 主音量：非常轻柔，淡入 3 秒
      masterGain=audioCtx.createGain();
      masterGain.gain.setValueAtTime(0,t);
      masterGain.gain.linearRampToValueAtTime(0.08,t+3);
      masterGain.connect(audioCtx.destination);
      allNodes.push(masterGain);

      // === 空间混响 ===
      var dG=audioCtx.createGain();dG.gain.setValueAtTime(0.35,t);allNodes.push(dG);
      var d1=audioCtx.createDelay(1.5);d1.delayTime.setValueAtTime(0.4,t);allNodes.push(d1);
      var d2=audioCtx.createDelay(1.5);d2.delayTime.setValueAtTime(0.7,t);allNodes.push(d2);
      var filter=audioCtx.createBiquadFilter();filter.type='lowpass';
      filter.frequency.setValueAtTime(1500,t);filter.Q.setValueAtTime(0.35,t);
      filter.connect(masterGain);allNodes.push(filter);
      filter.connect(d1);d1.connect(d2);d2.connect(dG);dG.connect(filter);

      // === 和弦铺底：Cmaj7 → Am7 → Fmaj7 → G7 循环 ===
      var chordSeq = [
        [261.63, 329.63, 392.00, 493.88],  // Cmaj7
        [220.00, 261.63, 329.63, 392.00],  // Am7
        [174.61, 220.00, 261.63, 349.23],  // Fmaj7
        [196.00, 246.94, 293.66, 392.00]    // G7
      ];
      var bassFreqs = [130.81, 110.00, 87.31, 98.00]; // 低音根音
      var chordLen = 8; // 每和弦 8 秒

      var padGain=audioCtx.createGain();padGain.gain.setValueAtTime(0,t);padGain.gain.linearRampToValueAtTime(0.015,t+2);padGain.connect(filter);allNodes.push(padGain);
      var ci=0;
      function nextChord() {
        if(!audioCtx)return;
        var now=audioCtx.currentTime;
        // 为当前和弦创建柔和铺底音
        var ch=chordSeq[ci%4];
        for(var j=0;j<4;j++){
          var o=audioCtx.createOscillator();o.type='sine';
          o.frequency.setValueAtTime(ch[j],now+0.05);
          var cg=audioCtx.createGain();cg.gain.setValueAtTime(0,now);
          cg.gain.linearRampToValueAtTime(0.012+j*0.003,now+1.5);
          cg.gain.linearRampToValueAtTime(0,now+chordLen-0.5);
          o.connect(cg);cg.connect(padGain);o.start(now);o.stop(now+chordLen);
          allNodes.push(o);allNodes.push(cg);
        }
        // 低音
        var bo=audioCtx.createOscillator();bo.type='sine';
        bo.frequency.setValueAtTime(bassFreqs[ci%4]*0.5,now);
        var bg=audioCtx.createGain();bg.gain.setValueAtTime(0,now);
        bg.gain.linearRampToValueAtTime(0.02,now+1);
        bg.gain.linearRampToValueAtTime(0,now+chordLen-0.5);
        bo.connect(bg);bg.connect(filter);bo.start(now);bo.stop(now+chordLen);
        allNodes.push(bo);allNodes.push(bg);
        ci++;
        chordTimer=setTimeout(nextChord,chordLen*1000);
      }
      setTimeout(nextChord,500);

      // === 旋律层：稀疏轻柔的五声音阶 ===
      var mel=[330,392,440,523,440,392,330,294,262,330,392,330,262,294,330,392,440,392,330,294,262,330,440,523,440,392,330,262];
      var beat=1.3; // 更慢的节奏
      var mg=audioCtx.createGain();mg.gain.setValueAtTime(0,t);mg.gain.linearRampToValueAtTime(0.018,t+4);mg.connect(filter);allNodes.push(mg);
      var ni=0;
      function s(){if(!audioCtx)return;playNote(mel[ni%mel.length],audioCtx.currentTime+0.2,beat*0.8,0.7,mg);ni++;melodyTimer=setTimeout(s,beat*1000);}
      setTimeout(s,2000);

      musicStarted=true;if(callback)callback();
    }).catch(function(){if(callback)callback();});
  }

  function stopAmbientMusic() {
    if(melodyTimer){clearTimeout(melodyTimer);melodyTimer=null;}
    if(chordTimer){clearTimeout(chordTimer);chordTimer=null;}
    if(!audioCtx)return;
    try{if(masterGain)masterGain.gain.linearRampToValueAtTime(0,audioCtx.currentTime+1.2);}catch(e){}
    setTimeout(function(){allNodes.forEach(function(n){try{n.disconnect();}catch(e){}});allNodes=[];try{if(audioCtx&&audioCtx.state!=='closed')audioCtx.close();}catch(e){}audioCtx=null;masterGain=null;},1300);
  }

  function startMusic(callback) {
    if (mp3Failed) { startAmbientMusic(callback); return; }
    var p = bgMusic.play();
    if (p !== undefined) {
      p.then(function () { musicStarted = true; if (callback) callback(); })
       .catch(function () { mp3Failed = true; startAmbientMusic(callback); });
    } else { musicStarted = true; if (callback) callback(); }
  }

  function stopMusic() {
    if (!mp3Failed) { bgMusic.pause(); bgMusic.currentTime = 0; }
    else { stopAmbientMusic(); }
  }

  function initMusic() {
    musicBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (isMusicPlaying) { stopMusic(); musicBtn.classList.remove('playing'); isMusicPlaying = false; }
      else { musicBtn.classList.add('playing'); isMusicPlaying = true; startMusic(); }
    });
    document.addEventListener('click', function autoStart() {
      if (!musicStarted && !isMusicPlaying) { isMusicPlaying = true; musicBtn.classList.add('playing'); startMusic(); }
    }, { once: true });
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
      }, 3200);

      // 4. 向日葵完全盛开后，显示祝福区域
      setTimeout(function () {
        showSceneTwo();
      }, 4500);
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
