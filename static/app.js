  const I18N = {
    zh: {
      appTitle: "SonicTag Studio",
      lrcSync: "导出独立 .lrc",
      carMode: "🚗 车载兼容 (压缩封面)",
      directSave: "直接保存到本地",
      chooseBtn: "浏览...",
      ask: "每次询问",
      queueHeader: "待处理队列",
      emptyTip: "拖入音频文件开始处理",
      dockTip: "+ 点击或拖拽音频文件到此处",
      searchBtn: "搜索",
      lblTitle: "标题 (TITLE)",
      lblArtist: "艺术家 (ARTIST)",
      lblAlbum: "专辑 (ALBUM)",
      lblAlbumArtist: "专辑艺术家 (ALBUM ARTIST)",
      lblGenre: "流派 (GENRE)",
      lblYear: "年份 (YEAR)",
      lblTrack: "音轨 (TRACK)",
      lblDisc: "碟号 (DISC)",
      lyricsTitle: "LRC 同步歌词",
      saveBtn: "一键导出",
      alertNoFolder: "未选定保存文件夹！",
      modalExportTitle: "正在导出与打标...",
      doneStatus: "处理完毕！"
    },
    en: {
      appTitle: "SonicTag Studio",
      lrcSync: "Export .lrc",
      carMode: "🚗 Car Mode (Compress Cover)",
      directSave: "Save Locally",
      chooseBtn: "Browse...",
      ask: "Always ask",
      queueHeader: "Audio Queue",
      emptyTip: "Drop audio files here to begin",
      dockTip: "+ Click or drop files here",
      searchBtn: "Search",
      lblTitle: "Title",
      lblArtist: "Artist",
      lblAlbum: "Album",
      lblAlbumArtist: "Album Artist",
      lblGenre: "Genre",
      lblYear: "Year",
      lblTrack: "Track #",
      lblDisc: "Disc #",
      lyricsTitle: "Synced Lyrics",
      saveBtn: "Export All",
      alertNoFolder: "Please select a destination folder!",
      modalExportTitle: "Exporting and Tagging...",
      doneStatus: "Completed!"
    },
    ja: {
      appTitle: "SonicTag Studio",
      lrcSync: "独立 .lrc 出力",
      carMode: "🚗 車載最適化 (圧縮)",
      directSave: "直接保存",
      chooseBtn: "参照...",
      ask: "毎回確認",
      queueHeader: "処理待ちキュー",
      emptyTip: "ファイルをドラッグして開始",
      dockTip: "+ ファイルを追加",
      searchBtn: "検索",
      lblTitle: "曲名",
      lblArtist: "アーティスト",
      lblAlbum: "アルバム",
      lblAlbumArtist: "アルバムアーティスト",
      lblGenre: "ジャンル",
      lblYear: "年",
      lblTrack: "トラック番号",
      lblDisc: "ディスク番号",
      lyricsTitle: "LRC 同期歌詞",
      saveBtn: "一括書き出し",
      alertNoFolder: "保存先を選択してください！",
      modalExportTitle: "書き込みおよび保存中...",
      doneStatus: "完了しました！"
    }
  };

  let currentLang = 'zh';
  let queue = [];
  let priorityQueue = []; // 优先插播队列 (存放 queue 中的索引引用)
  let currentIndex = -1;
  let currentPlayingIdx = -1;
  let savedLocalFolder = localStorage.getItem('musictag_save_dir') || '';
  let parsedLyrics = [];
  let activeLyricIdx = -1;
  let currentMainView = 'editor';

  let playMode = localStorage.getItem('musictag_play_mode') || 'list';
  const playbackRates = [1.0, 1.25, 1.5, 2.0, 0.75];
  let currentRateIdx = 0;
  let previousVolume = 0.85;

  const audio = document.getElementById('audioEngine');
  const timeCurrent = document.getElementById('timeCurrent');
  const timeDuration = document.getElementById('timeDuration');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const vinylDisc = document.getElementById('vinylDisc');
  const volumeScrubber = document.getElementById('volumeScrubber');

  // ---------------- 优先插播队列 (Play Next Queue) ----------------
  function addToPlayNext(idx, e) {
    if (e) e.stopPropagation();
    if (idx < 0 || idx >= queue.length) return;

    // 防止连续重复插入同一首
    priorityQueue.push(idx);
    updateUpNextUI();
    showResumeToast(`已将《${queue[idx].meta.title || queue[idx].filename}》加入下一首插播`);
  }

  function removeFromPriority(pIdx, e) {
    if (e) e.stopPropagation();
    priorityQueue.splice(pIdx, 1);
    updateUpNextUI();
  }

  function clearPriorityQueue() {
    priorityQueue = [];
    updateUpNextUI();
  }

  function toggleUpNextDrawer() {
    const drawer = document.getElementById('upNextDrawer');
    drawer.classList.toggle('show');
    if (drawer.classList.contains('show')) updateUpNextUI();
  }

  function updateUpNextUI() {
    document.getElementById('priorityCount').innerText = priorityQueue.length;
    document.getElementById('priorityBadgeDot').style.display = priorityQueue.length > 0 ? 'block' : 'none';

    // 更新当前曲目
    if (currentPlayingIdx >= 0 && currentPlayingIdx < queue.length) {
      const cur = queue[currentPlayingIdx];
      document.getElementById('upNextCurThumb').src = cur.meta.cover_data || cur.meta.cover_url || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>";
      document.getElementById('upNextCurTitle').innerText = `${cur.meta.title || cur.filename} · ${cur.meta.artist || '本地音频'}`;
    }

    // 渲染插播列表
    const container = document.getElementById('priorityListContainer');
    if (priorityQueue.length === 0) {
      container.innerHTML = `<div style="font-size:10px; color:var(--text-sub); padding:4px 0;">暂无插播，可在队列悬浮点击“设为下一首”</div>`;
      return;
    }

    container.innerHTML = priorityQueue.map((qIdx, pIdx) => {
      const item = queue[qIdx];
      if (!item) return '';
      return `
        <div class="upnext-item priority" onclick="playPriorityDirectly(${pIdx})">
          <img class="upnext-thumb" src="${item.meta.cover_data || item.meta.cover_url || ''}">
          <div class="upnext-title" title="${item.meta.title || item.filename}">${item.meta.title || item.filename}</div>
          <button class="upnext-del" onclick="removeFromPriority(${pIdx}, event)" title="移除此插播">✕</button>
        </div>
      `;
    }).join('');
  }

  function playPriorityDirectly(pIdx) {
    if (pIdx < 0 || pIdx >= priorityQueue.length) return;
    const targetQIdx = priorityQueue.splice(pIdx, 1)[0];
    updateUpNextUI();
    selectItem(targetQIdx, true);
  }

  // ---------------- 侧边栏收起/展开控制 ----------------
  function toggleSidebar() {
    const wb = document.getElementById('workbench');
    const btn = document.getElementById('sidebarToggleBtn');
    wb.classList.toggle('sidebar-collapsed');
    const isCollapsed = wb.classList.contains('sidebar-collapsed');
    btn.classList.toggle('collapsed', isCollapsed);
    localStorage.setItem('musictag_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  }

  // ---------------- 沉浸无操作自动淡出 + 手动沉浸模式 ----------------
  let idleTimer = null;
  let manualImmersive = false;
  const IDLE_TIMEOUT_MS = 3600;

  function enterManualImmersive() {
    manualImmersive = true;
    const win = document.getElementById('appWindow');
    win.classList.add('immersive-idle', 'manual-immersive');
    document.getElementById('upNextDrawer').classList.remove('show');
  }

  function exitManualImmersive() {
    manualImmersive = false;
    const win = document.getElementById('appWindow');
    win.classList.remove('immersive-idle', 'manual-immersive');
    resetIdleTimer();
  }

  function resetIdleTimer() {
    const win = document.getElementById('appWindow');

    // 手动沉浸模式下不响应自动退出
    if (manualImmersive) return;

    if (win.classList.contains('immersive-idle')) {
      win.classList.remove('immersive-idle');
    }
    clearTimeout(idleTimer);

    idleTimer = setTimeout(() => {
      const isModal = document.getElementById('progressModal').classList.contains('show');
      const isDrawer = document.getElementById('upNextDrawer').classList.contains('show');
      const activeEl = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isTyping = (activeEl === 'input' || activeEl === 'textarea');

      if (!isModal && !isDrawer && !isTyping) {
        win.classList.add('immersive-idle');
      }
    }, IDLE_TIMEOUT_MS);
  }

  ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetIdleTimer, { passive: true });
  });

  // ---------------- 封面流光背景取色 ----------------
  function extractAndApplyFluidColors(coverSrc) {
    if (!coverSrc || coverSrc.startsWith('data:image/svg')) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const cvs = document.createElement('canvas');
        cvs.width = 40; cvs.height = 40;
        const ctx = cvs.getContext('2d');
        ctx.drawImage(img, 0, 0, 40, 40);
        const imgData = ctx.getImageData(0, 0, 40, 40).data;

        const getZoneRgb = (startX, startY, w, h) => {
          let r = 0, g = 0, b = 0, count = 0;
          for (let y = startY; y < startY + h; y++) {
            for (let x = startX; x < startX + w; x++) {
              const i = (y * 40 + x) * 4;
              r += imgData[i];
              g += imgData[i+1];
              b += imgData[i+2];
              count++;
            }
          }
          return `rgba(${Math.round(r/count)}, ${Math.round(g/count)}, ${Math.round(b/count)}, 0.45)`;
        };

        const root = document.documentElement;
        root.style.setProperty('--ambient-1', getZoneRgb(2, 2, 14, 14));
        root.style.setProperty('--ambient-2', getZoneRgb(24, 2, 14, 14));
        root.style.setProperty('--ambient-3', getZoneRgb(2, 24, 14, 14));
        root.style.setProperty('--ambient-4', getZoneRgb(24, 24, 14, 14));
      } catch (err) {
        console.warn("Fluid color extract error:", err);
      }
    };
    img.src = coverSrc;
  }

  // ---------------- 真实波形进度条轨道 ----------------
  let currentWaveformPoints = [];
  const waveCanvas = document.getElementById('waveformCanvas');
  const waveBox = document.getElementById('waveformBox');
  const waveCursor = document.getElementById('waveCursor');
  const waveTooltip = document.getElementById('waveTooltip');
  let isWaveDragging = false;

  function resizeWaveformCanvas() {
    const rect = waveBox.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    waveCanvas.width = rect.width * dpr;
    waveCanvas.height = rect.height * dpr;
    drawWaveform();
  }
  window.addEventListener('resize', resizeWaveformCanvas);

  async function generateAudioWaveform(file) {
    currentWaveformPoints = [];
    drawWaveform();
    try {
      const arrayBuffer = await file.arrayBuffer();
      const offlineCtx = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
      const rawData = audioBuffer.getChannelData(0);
      const samplesCount = 120;
      const blockSize = Math.floor(rawData.length / samplesCount);
      const peaks = [];

      for (let i = 0; i < samplesCount; i++) {
        const start = blockSize * i;
        let sum = 0;
        for (let j = 0; j < blockSize; j += 6) {
          sum += Math.abs(rawData[start + j]);
        }
        peaks.push(sum / (blockSize / 6));
      }

      const maxPeak = Math.max(...peaks, 0.001);
      currentWaveformPoints = peaks.map(p => Math.max(0.12, p / maxPeak));
      drawWaveform();
      offlineCtx.close();
    } catch (e) {
      currentWaveformPoints = Array.from({length: 100}, (_, i) => 0.2 + Math.sin(i / 5) * 0.15 + Math.random() * 0.2);
      drawWaveform();
    }
  }

  function drawWaveform() {
    const ctx = waveCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = waveCanvas.width;
    const h = waveCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const progress = (audio.duration && audio.duration > 0) ? (audio.currentTime / audio.duration) : 0;
    const barsCount = currentWaveformPoints.length || 100;
    const barWidth = (w / barsCount) * 0.7;
    const gap = (w - (barWidth * barsCount)) / (barsCount - 1);

    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#fc3c44';
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const unplayedColor = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)';

    for (let i = 0; i < barsCount; i++) {
      const val = currentWaveformPoints[i] || 0.15;
      const barH = Math.max(4 * dpr, val * (h * 0.85));
      const x = i * (barWidth + gap);
      const y = (h - barH) / 2;

      ctx.fillStyle = (i / barsCount <= progress) ? accentColor : unplayedColor;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, 2 * dpr);
      ctx.fill();
    }
  }

  waveBox.addEventListener('mousemove', (e) => {
    const rect = waveBox.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    waveCursor.style.left = `${pos * 100}%`;

    const hoverTime = (audio.duration || 0) * pos;
    waveTooltip.style.left = `${pos * 100}%`;
    waveTooltip.innerText = formatTime(hoverTime);

    if (isWaveDragging && audio.duration) {
      audio.currentTime = hoverTime;
      drawWaveform();
    }
  });

  waveBox.addEventListener('mousedown', (e) => {
    isWaveDragging = true;
    const rect = waveBox.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audio.duration) {
      audio.currentTime = (audio.duration || 0) * pos;
      drawWaveform();
    }
  });

  window.addEventListener('mouseup', () => { isWaveDragging = false; });

  // ---------------- 画中画桌面动态歌词 ----------------
  const pipCanvas = document.getElementById('pipCanvas');
  const pipVideo = document.getElementById('pipVideo');
  const pipBtn = document.getElementById('pipBtn');
  let isPipActive = false;
  let pipRenderTimer = null;

  async function togglePictureInPicture() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        return;
      }

      renderPipLyrics();

      if (!pipVideo.srcObject) {
        const stream = pipCanvas.captureStream(25);
        pipVideo.srcObject = stream;

        await new Promise((resolve) => {
          if (pipVideo.readyState >= 1) return resolve();
          pipVideo.onloadedmetadata = () => resolve();
          setTimeout(resolve, 300);
        });
      }

      await pipVideo.play();
      await pipVideo.requestPictureInPicture();

      isPipActive = true;
      pipBtn.classList.add('active');

      if (pipRenderTimer) clearInterval(pipRenderTimer);
      pipRenderTimer = setInterval(renderPipLyrics, 66);

    } catch (e) {
      console.error("[画中画启动异常]:", e);
      alert("画中画启动失败，请检查浏览器是否已授权媒体播放：\n" + e.message);
    }
  }

  pipVideo.addEventListener('leavepictureinpicture', () => {
    isPipActive = false;
    pipBtn.classList.remove('active');
    if (pipRenderTimer) {
      clearInterval(pipRenderTimer);
      pipRenderTimer = null;
    }
  });

  function renderPipLyrics() {
    if (!pipCanvas) return;
    const ctx = pipCanvas.getContext('2d');
    const w = pipCanvas.width;
    const h = pipCanvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#141416';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    const trackTitle = document.getElementById('dockTitle')?.innerText || "SonicTag Studio";
    const trackArtist = document.getElementById('dockArtist')?.innerText || "未选择曲目";

    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.font = '600 13px -apple-system, sans-serif';
    ctx.fillText(`${trackTitle}  ·  ${trackArtist}`, 24, 34);

    let curOrig = "♪ SonicTag Player";
    let curTrans = "";
    let nextOrig = "";

    if (parsedLyrics && parsedLyrics.length > 0 && activeLyricIdx >= 0 && activeLyricIdx < parsedLyrics.length) {
      const item = parsedLyrics[activeLyricIdx];
      curOrig = item.orig || '♪';
      curTrans = item.trans || '';
      if (activeLyricIdx + 1 < parsedLyrics.length) {
        nextOrig = parsedLyrics[activeLyricIdx + 1].orig || '';
      }
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
    ctx.shadowColor = 'rgba(252, 60, 68, 0.6)';
    ctx.shadowBlur = 12;
    ctx.fillText(curOrig, 24, 78);
    ctx.shadowBlur = 0;

    if (curTrans) {
      ctx.fillStyle = '#fa2d48';
      ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
      ctx.fillText(curTrans, 24, 110);
    }

    if (nextOrig) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
      ctx.fillText(nextOrig, 24, curTrans ? 146 : 124);
    }
  }

  // ---------------- Web Audio API 动效分析仪 ----------------
  let audioCtx = null;
  let analyser = null;
  let visualizerInit = false;
  let peakHeights = [];

  function initAudioVisualizer() {
    if (visualizerInit) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const srcNode = audioCtx.createMediaElementSource(audio);
      srcNode.connect(analyser);
      analyser.connect(audioCtx.destination);
      visualizerInit = true;
      drawVisualizerLoop();
    } catch (e) {
      console.warn("Visualizer fallback:", e);
    }
  }

  function drawVisualizerLoop() {
    requestAnimationFrame(drawVisualizerLoop);
    if (!analyser || currentMainView !== 'vinyl') return;

    const canvas = document.getElementById('visualizerCanvas');
    const ctx = canvas.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (peakHeights.length !== bufferLength) {
      peakHeights = new Array(bufferLength).fill(0);
    }

    const barWidth = (canvas.width / bufferLength) * 1.5;
    let x = (canvas.width - (bufferLength * barWidth)) / 2;

    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#fc3c44';
    const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
    gradient.addColorStop(0, accentColor);
    gradient.addColorStop(1, '#ff8a93');

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height * 0.92;
      if (barHeight > peakHeights[i]) {
        peakHeights[i] = barHeight;
      } else {
        peakHeights[i] = Math.max(0, peakHeights[i] - 0.7);
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, canvas.height - barHeight, barWidth - 3, barHeight, [3, 3, 0, 0]);
      ctx.fill();

      if (peakHeights[i] > 2) {
        ctx.fillStyle = accentColor;
        ctx.fillRect(x, canvas.height - peakHeights[i] - 2, barWidth - 3, 1.5);
      }
      x += barWidth;
    }
  }

  function switchMainView(viewName) {
    currentMainView = viewName;
    document.getElementById('btnViewEditor').classList.toggle('active', viewName === 'editor');
    document.getElementById('btnViewLyrics').classList.toggle('active', viewName === 'lyrics');
    document.getElementById('btnViewVinyl').classList.toggle('active', viewName === 'vinyl');

    document.getElementById('viewEditor').style.display = viewName === 'editor' ? 'flex' : 'none';
    document.getElementById('viewLyrics').style.display = viewName === 'lyrics' ? 'grid' : 'none';
    document.getElementById('viewVinyl').style.display = viewName === 'vinyl' ? 'flex' : 'none';

    // 沉浸歌词视图下激活全屏动态流光背景
    document.getElementById('appWindow').classList.toggle('ambient-active', viewName === 'lyrics');

    // 在沉浸歌词视图下把播放控件移动到封面下方
    const playerArea = document.getElementById('playerArea');
    const topBar = document.getElementById('topBar');
    const immersiveHost = document.getElementById('immersivePlayerHost');

    if (viewName === 'lyrics') {
      immersiveHost.appendChild(playerArea);
    } else {
      const navRight = topBar.querySelector('.nav-right');
      topBar.insertBefore(playerArea, navRight);
    }

    // DOM 移动后重绘波形进度条
    setTimeout(resizeWaveformCanvas, 0);

    if (viewName === 'lyrics') {
      renderImmersiveLyrics(document.getElementById('fieldLyrics').value);
      syncLyricPosition(audio.currentTime);
    }
  }

  const candidatesBar = document.getElementById('candidatesList');
  candidatesBar.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      candidatesBar.scrollLeft += e.deltaY;
    }
  }, { passive: false });

  function toggleTheme() {
    const root = document.documentElement;
    const btn = document.getElementById('themeBtn');
    const cur = root.getAttribute('data-theme');
    if (!cur) {
      root.setAttribute('data-theme', 'light');
      btn.innerText = "☀️ 浅色";
    } else if (cur === 'light') {
      root.setAttribute('data-theme', 'dark');
      btn.innerText = "🌙 深色";
    } else {
      root.removeAttribute('data-theme');
      btn.innerText = "🌓 自动";
    }
    setTimeout(drawWaveform, 50);
  }

  function changeLanguage(lang) {
    currentLang = lang;
    const t = I18N[lang];
    for (let k in t) {
      const el = document.getElementById(`i18n-${k}`);
      if (el) el.innerText = t[k];
    }
    document.getElementById('saveBtn').innerText = t.saveBtn;
    renderList();
  }

  function updatePlayModeUI() {
    const iconList = document.getElementById('iconLoopList');
    const iconSingle = document.getElementById('iconLoopSingle');
    const iconShuffle = document.getElementById('iconShuffle');
    const btn = document.getElementById('modeBtn');

    iconList.style.display = playMode === 'list' ? 'block' : 'none';
    iconSingle.style.display = playMode === 'single' ? 'block' : 'none';
    iconShuffle.style.display = playMode === 'shuffle' ? 'block' : 'none';

    btn.title = playMode === 'list' ? '列表循环' : (playMode === 'single' ? '单曲循环' : '随机播放');
    btn.classList.toggle('active', playMode !== 'list');
  }

  function cyclePlayMode() {
    if (playMode === 'list') playMode = 'single';
    else if (playMode === 'single') playMode = 'shuffle';
    else playMode = 'list';
    localStorage.setItem('musictag_play_mode', playMode);
    updatePlayModeUI();
  }

  function cyclePlaybackRate() {
    currentRateIdx = (currentRateIdx + 1) % playbackRates.length;
    const rate = playbackRates[currentRateIdx];
    audio.playbackRate = rate;
    document.getElementById('rateBtn').innerText = `${rate.toFixed( rate % 1 === 0 ? 1 : 2 )}x`.replace(".0x", "x");
  }

  function setVolume(val, syncScrubber = true) {
    val = Math.max(0, Math.min(1, val));
    audio.volume = val;
    if (syncScrubber) volumeScrubber.value = val;
    localStorage.setItem('musictag_volume', val);

    const iconHigh = document.getElementById('iconVolHigh');
    const iconLow = document.getElementById('iconVolLow');
    const iconMute = document.getElementById('iconVolMute');

    if (val === 0) {
      iconHigh.style.display = 'none'; iconLow.style.display = 'none'; iconMute.style.display = 'block';
    } else if (val < 0.4) {
      iconHigh.style.display = 'none'; iconLow.style.display = 'block'; iconMute.style.display = 'none';
    } else {
      iconHigh.style.display = 'block'; iconLow.style.display = 'none'; iconMute.style.display = 'none';
    }
  }

  function toggleMute() {
    if (audio.volume > 0) {
      previousVolume = audio.volume;
      setVolume(0);
    } else {
      setVolume(previousVolume || 0.85);
    }
  }

  volumeScrubber.addEventListener('input', (e) => {
    setVolume(parseFloat(e.target.value), false);
  });

  // ---------------- 播放引擎与切歌逻辑（含插播优先级队列消费） ----------------
  function loadAudioIntoPlayer(item, autoPlay = false) {
    if (!item) return;
    if (audio.src && audio.src.startsWith('blob:')) {
      URL.revokeObjectURL(audio.src);
    }
    audio.src = URL.createObjectURL(item.file);
    audio.load();

    const title = item.meta.title || item.filename;
    const artist = item.meta.artist || "本地音频";
    const cover = item.meta.cover_data || item.meta.cover_url || "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>";

    document.getElementById('dockTitle').innerText = title;
    document.getElementById('dockArtist').innerText = artist;
    document.getElementById('dockCover').src = cover;

    document.getElementById('immTitle').innerText = title;
    document.getElementById('immArtist').innerText = artist;
    document.getElementById('immCover').src = cover;

    document.getElementById('vinylJacketImg').src = cover;
    document.getElementById('vinylLabelImg').src = cover;

    document.getElementById('specFormat').innerText = item.specs.format || "AUDIO";
    document.getElementById('specSample').innerText = item.specs.sample_rate ? `${(item.specs.sample_rate/1000).toFixed(1)} kHz` : "44.1 kHz";
    document.getElementById('specBits').innerText = item.specs.bits_per_sample ? `${item.specs.bits_per_sample}-Bit` : "16-Bit";
    document.getElementById('specBitrate').innerText = item.specs.bitrate ? `${item.specs.bitrate} kbps` : "--";

    extractAndApplyFluidColors(cover);
    generateAudioWaveform(item.file);
    updateMediaSession(item);
    updateUpNextUI();

    // 检查断点续播
    checkBreakpointResume(item);

    if (autoPlay) {
      togglePlay(true);
    }
  }

  function showResumeToast(msg) {
    const toast = document.getElementById('resumeToast');
    document.getElementById('resumeToastText').innerText = msg;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 2600);
  }

  function checkBreakpointResume(item) {
    try {
      const saved = localStorage.getItem('musictag_last_track');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.filename === item.filename && data.time > 3.0) {
          audio.currentTime = data.time;
          showResumeToast(`已自动恢复至上次播放进度：${formatTime(data.time)}`);
        }
      }
    } catch (e) {}
  }

  function togglePlay(forcePlay = false) {
    if (!audio.src) {
      if (queue.length > 0) selectItem(0, true);
      return;
    }
    initAudioVisualizer();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (forcePlay || audio.paused) {
      audio.play().catch(e => console.log("Play interrupted:", e));
    } else {
      audio.pause();
    }
  }

  function playPrev() {
    if (queue.length === 0) return;
    if (audio.currentTime > 3.0) {
      audio.currentTime = 0;
      return;
    }

    let targetIdx = 0;
    if (playMode === 'shuffle') {
      targetIdx = Math.floor(Math.random() * queue.length);
    } else {
      targetIdx = currentPlayingIdx - 1;
      if (targetIdx < 0) targetIdx = queue.length - 1;
    }
    selectItem(targetIdx, true);
  }

  function playNext(isAutoEnd = false) {
    if (queue.length === 0) return;

    if (isAutoEnd && playMode === 'single') {
      audio.currentTime = 0;
      audio.play();
      return;
    }

    // 1. 优先消费插播队列
    if (priorityQueue.length > 0) {
      const nextTarget = priorityQueue.shift();
      updateUpNextUI();
      selectItem(nextTarget, true);
      return;
    }

    // 2. 正常流转消费主列表
    let targetIdx = 0;
    if (playMode === 'shuffle') {
      if (queue.length > 1) {
        do {
          targetIdx = Math.floor(Math.random() * queue.length);
        } while (targetIdx === currentPlayingIdx);
      } else {
        targetIdx = 0;
      }
    } else {
      targetIdx = (currentPlayingIdx + 1) % queue.length;
    }
    selectItem(targetIdx, true);
  }

  audio.addEventListener('ended', () => { playNext(true); });

  audio.addEventListener('play', () => {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
    vinylDisc.classList.add('playing');
    updateSidebarPlayingState(true);
  });

  audio.addEventListener('pause', () => {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    vinylDisc.classList.remove('playing');
    updateSidebarPlayingState(false);
  });

  function updateSidebarPlayingState(isPlaying) {
    const barsList = document.querySelectorAll('.playing-bars');
    barsList.forEach(el => {
      el.classList.toggle('paused', !isPlaying);
    });
  }

  audio.addEventListener('loadedmetadata', () => {
    timeDuration.innerText = formatTime(audio.duration);
    resizeWaveformCanvas();
  });

  let lastSaveTimestamp = 0;
  audio.addEventListener('timeupdate', () => {
    if (!isWaveDragging) {
      timeCurrent.innerText = formatTime(audio.currentTime);
      drawWaveform();
    }
    syncLyricPosition(audio.currentTime);

    // 每 2 秒记录一次断点会话
    const now = Date.now();
    if (now - lastSaveTimestamp > 2000 && currentPlayingIdx >= 0 && currentPlayingIdx < queue.length) {
      lastSaveTimestamp = now;
      localStorage.setItem('musictag_last_track', JSON.stringify({
        filename: queue[currentPlayingIdx].filename,
        time: audio.currentTime
      }));
    }
  });

  function formatTime(secs) {
    if (!secs || isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // ---------------- 系统媒体中心集成 ----------------
  function updateMediaSession(item) {
    if (!('mediaSession' in navigator) || !item) return;
    const coverUrl = item.meta.cover_data || item.meta.cover_url;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: item.meta.title || item.filename,
      artist: item.meta.artist || "本地音频",
      album: item.meta.album || "SonicTag Studio",
      artwork: coverUrl ? [{ src: coverUrl, sizes: '512x512', type: 'image/jpeg' }] : []
    });
  }

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => togglePlay(true));
    navigator.mediaSession.setActionHandler('pause', () => togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext(false));
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) audio.currentTime = details.seekTime;
    });
  }

  // ---------------- 全局快捷键 ----------------
  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - 5);
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
    } else if (e.code === 'ArrowUp') {
      e.preventDefault();
      setVolume(audio.volume + 0.05);
    } else if (e.code === 'ArrowDown') {
      e.preventDefault();
      setVolume(audio.volume - 0.05);
    } else if (e.key === '[' || (e.altKey && e.code === 'ArrowLeft')) {
      e.preventDefault();
      playPrev();
    } else if (e.key === ']' || (e.altKey && e.code === 'ArrowRight')) {
      e.preventDefault();
      playNext(false);
    } else if (e.code === 'Escape') {
      if (manualImmersive) {
        e.preventDefault();
        exitManualImmersive();
      }
    }
  });

  // ---------------- 歌词解析与双语同步 ----------------
  function parseLRC(lrcText) {
    if (!lrcText) return [];
    const lines = lrcText.split('\n');
    const rawList = [];
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    for (const line of lines) {
      const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
      let match;
      timeRegex.lastIndex = 0;
      while ((match = timeRegex.exec(line)) !== null) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
        rawList.push({ time: min * 60 + sec + ms / 1000, text: text });
      }
    }
    rawList.sort((a, b) => a.time - b.time);

    const grouped = [];
    for (let i = 0; i < rawList.length; i++) {
      const curr = rawList[i];
      if (i + 1 < rawList.length && Math.abs(rawList[i + 1].time - curr.time) < 0.15) {
        grouped.push({ time: curr.time, orig: curr.text, trans: rawList[i + 1].text });
        i++;
      } else {
        grouped.push({ time: curr.time, orig: curr.text, trans: '' });
      }
    }
    return grouped;
  }

  function renderFlowLyrics(lrcText) {
    parsedLyrics = parseLRC(lrcText);
    const container = document.getElementById('lyricsFlowContainer');
    if (parsedLyrics.length === 0) {
      container.innerHTML = `<div style="margin: auto; color: var(--text-sub); font-size: 13px;">暂无 LRC 同步歌词</div>`;
      return;
    }

    container.innerHTML = parsedLyrics.map((item, idx) => `
      <div class="lyric-line" id="lyric-line-${idx}" onclick="seekToLyric(${item.time})">
        <div class="line-orig">${item.orig || '♪'}</div>
        ${item.trans ? `<div class="line-trans">${item.trans}</div>` : ''}
      </div>
    `).join('');
  }

  function renderImmersiveLyrics(lrcText) {
    const immScroll = document.getElementById('immLyricsScroll');
    if (parsedLyrics.length === 0) {
      immScroll.innerHTML = `<div style="color: var(--text-sub); font-size: 18px; margin: auto;">暂无 LRC 同步歌词</div>`;
      return;
    }

    immScroll.innerHTML = parsedLyrics.map((item, idx) => `
      <div class="immersive-line" id="imm-line-${idx}" onclick="seekToLyric(${item.time})">
        <div class="immersive-orig">${item.orig || '♪'}</div>
        ${item.trans ? `<div class="immersive-trans">${item.trans}</div>` : ''}
      </div>
    `).join('');
  }

  function syncLyricPosition(currentTime) {
    if (!parsedLyrics || parsedLyrics.length === 0) return;

    let targetIdx = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (currentTime >= parsedLyrics[i].time) {
        targetIdx = i;
      } else {
        break;
      }
    }

    if (targetIdx !== activeLyricIdx) {
      if (activeLyricIdx !== -1) {
        const prevEl = document.getElementById(`lyric-line-${activeLyricIdx}`);
        if (prevEl) prevEl.classList.remove('active');
        const prevImm = document.getElementById(`imm-line-${activeLyricIdx}`);
        if (prevImm) prevImm.classList.remove('active');
      }

      if (targetIdx !== -1) {
        const curEl = document.getElementById(`lyric-line-${targetIdx}`);
        if (curEl) {
          curEl.classList.add('active');
          curEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const curImm = document.getElementById(`imm-line-${targetIdx}`);
        if (curImm) {
          curImm.classList.add('active');
          curImm.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      activeLyricIdx = targetIdx;
      renderPipLyrics();
    }
  }

  function seekToLyric(seconds) {
    audio.currentTime = seconds;
    if (audio.paused) togglePlay();
  }

  function switchLyricView(mode) {
    const flowBox = document.getElementById('lyricsFlowContainer');
    const textBox = document.getElementById('fieldLyrics');
    const btnFlow = document.getElementById('btnModeFlow');
    const btnText = document.getElementById('btnModeText');

    if (mode === 'flow') {
      flowBox.style.display = 'flex';
      textBox.style.display = 'none';
      btnFlow.classList.add('active');
      btnText.classList.remove('active');
      renderFlowLyrics(textBox.value);
    } else {
      flowBox.style.display = 'none';
      textBox.style.display = 'block';
      btnFlow.classList.remove('active');
      btnText.classList.add('active');
    }
  }

  function switchBilingualMode(type) {
    if (currentIndex === -1) return;
    const item = queue[currentIndex];
    if (!item.lrcData) return;

    document.getElementById('btnBi').classList.toggle('active', type === 'bilingual');
    document.getElementById('btnOrig').classList.toggle('active', type === 'orig');
    document.getElementById('btnTrans').classList.toggle('active', type === 'trans');

    if (type === 'bilingual') {
      item.meta.lyrics = item.lrcData.bilingual || item.lrcData.orig;
    } else if (type === 'orig') {
      item.meta.lyrics = item.lrcData.orig;
    } else if (type === 'trans') {
      item.meta.lyrics = item.lrcData.trans || item.lrcData.orig;
    }

    document.getElementById('fieldLyrics').value = item.meta.lyrics;
    renderFlowLyrics(item.meta.lyrics);
    renderImmersiveLyrics(item.meta.lyrics);
    item.lrcType = type;
  }

  function onLyricsEdited() {
    updateCurrentMeta();
    const lrc = document.getElementById('fieldLyrics').value;
    parsedLyrics = parseLRC(lrc);
    renderImmersiveLyrics(lrc);
    renderPipLyrics();
  }

  // ---------------- 基础文件队列与列表渲染 ----------------
  const coverBox = document.getElementById('detailCover');
  const coverFileInput = document.getElementById('coverFileInput');

  function triggerPickCover() { coverFileInput.click(); }
  coverFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleCustomCoverFile(e.target.files[0]);
  });
  coverBox.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
  coverBox.addEventListener('drop', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files.length > 0) {
      const f = e.dataTransfer.files[0];
      if (f.type.startsWith('image/')) {
        handleCustomCoverFile(f);
      } else {
        handleFiles(e.dataTransfer.files);
      }
    }
  });

  function handleCustomCoverFile(imgFile) {
    if (!imgFile.type.startsWith('image/')) return alert("请拖入图片文件！");
    const reader = new FileReader();
    reader.onload = (e) => {
      if (currentIndex !== -1) {
        queue[currentIndex].meta.cover_data = e.target.result;
        queue[currentIndex].meta.cover_url = e.target.result;
        coverBox.innerHTML = `<img src="${e.target.result}"><div class="cover-overlay">已替换为自定义封面</div>`;
        document.getElementById('dockCover').src = e.target.result;
        document.getElementById('immCover').src = e.target.result;
        document.getElementById('vinylJacketImg').src = e.target.result;
        document.getElementById('vinylLabelImg').src = e.target.result;
        renderList();
        updateMediaSession(queue[currentIndex]);
        extractAndApplyFluidColors(e.target.result);
      }
    };
    reader.readAsDataURL(imgFile);
  }

  const fileInput = document.getElementById('fileInput');
  window.addEventListener('dragover', (e) => { e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  });

  async function handleFiles(files) {
    const valid = Array.from(files).filter(f => {
      const ext = f.name.toLowerCase();
      return ext.endsWith('.flac') || ext.endsWith('.mp3');
    });

    if (valid.length === 0) return alert("请导入 FLAC 或 MP3 文件！");

    for (let f of valid) {
      const qItem = {
        file: f,
        filename: f.name,
        cleanName: f.name.replace(/\.[^/.]+$/, "").replace(/[_\-\.]/g, " "),
        status: 'pending',
        candidates: [],
        specs: { badge: '...', color: 'silver', spec_text: '' },
        lrcData: null,
        lrcType: 'bilingual',
        meta: { title: '', artist: '', album: '', album_artist: '', genre: '', year: '', track_num: '', track_total: '', disc_num: '', disc_total: '', lyrics: '', cover_url: '', cover_data: '' }
      };
      queue.push(qItem);
      renderList();
      inspectSingleFile(qItem);
    }
    autoProcessQueue();
  }

  async function inspectSingleFile(item) {
    try {
      const formData = new FormData();
      formData.append("file", item.file);
      const res = await fetch("/api/inspect", { method: "POST", body: formData });
      const data = await res.json();
      item.specs = data.specs || {};
      renderList();
    } catch (e) {}
  }

  function renderList() {
    const listEl = document.getElementById('fileList');
    document.getElementById('queueCount').innerText = queue.length;
    document.getElementById('saveBtn').disabled = queue.length === 0;

    if (queue.length === 0) {
      listEl.innerHTML = `<div style="padding: 40px 16px; text-align: center; color: var(--text-sub); font-size: 12px;">${I18N[currentLang].emptyTip}</div>`;
      return;
    }

    listEl.innerHTML = queue.map((item, idx) => {
      const isPlayingThis = (idx === currentPlayingIdx);
      const isPaused = audio.paused;
      return `
        <div class="file-cell ${idx === currentIndex ? 'active' : ''}" onclick="selectItem(${idx}, false)">
          <img class="cell-cover" src="${item.meta.cover_data || item.meta.cover_url || ''}">
          <div class="cell-info">
            <div class="cell-title">
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.filename}</span>
              ${isPlayingThis ? `
                <div class="playing-bars ${isPaused ? 'paused' : ''}" title="${isPaused ? '已暂停' : '正在播放'}">
                  <span></span><span></span><span></span>
                </div>
              ` : ''}
              ${item.specs.badge ? `<span class="audio-badge ${item.specs.color === 'gold' ? 'badge-gold' : 'badge-silver'}">${item.specs.badge}</span>` : ''}
            </div>
            <div class="cell-sub">
              ${item.meta.title ? `${item.meta.title} ·${item.meta.artist}` : (item.status === 'searching' ? '匹配中...' : '未匹配')}
              ${item.specs.spec_text ? ` · <span style="font-size:10px;">${item.specs.spec_text}</span>` : ''}
            </div>
          </div>

          <!-- 悬浮快捷插播按键 -->
          <div class="cell-hover-actions">
            <button class="cell-action-btn" onclick="addToPlayNext(${idx}, event)" title="设为下一首插播">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 14 4 9 9 4"></polyline>
                <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  async function autoProcessQueue() {
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === 'pending') {
        queue[i].status = 'searching';
        renderList();
        await matchSingle(queue[i]);
        queue[i].status = queue[i].meta.title ? 'done' : 'fail';
        renderList();
        if (currentIndex === -1) selectItem(0, false);
      }
    }
  }

  async function matchSingle(item) {
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(item.cleanName)}`);
      const data = await res.json();
      item.candidates = data.items || [];
      if (item.candidates.length > 0) {
        applyCandidate(item, item.candidates[0]);
      }
    } catch (e) {
      console.error(e);
    }
  }

  function applyCandidate(item, candidate) {
    item.meta.title = candidate.title;
    item.meta.artist = candidate.artist;
    item.meta.album = candidate.album;
    item.meta.album_artist = candidate.album_artist || candidate.artist;
    item.meta.genre = candidate.genre;
    item.meta.year = candidate.year || '';
    item.meta.track_num = candidate.track_num || '1';
    item.meta.track_total = candidate.track_total || '1';
    item.meta.disc_num = candidate.disc_num || '1';
    item.meta.disc_total = candidate.disc_total || '1';
    item.meta.cover_url = candidate.cover_url;
    item.selectedId = candidate.id;

    fetch(`/api/lyrics?track=${encodeURIComponent(candidate.title)}&artist=${encodeURIComponent(candidate.artist)}&duration=${candidate.duration}`)
      .then(res => res.json())
      .then(d => {
        item.lrcData = d;
        item.meta.lyrics = d.lyrics || "";
        if (queue[currentIndex] === item) {
          updateLyricsUI(item);
        }
      });
  }

  function updateLyricsUI(item) {
    document.getElementById('fieldLyrics').value = item.meta.lyrics;
    renderFlowLyrics(item.meta.lyrics);
    renderImmersiveLyrics(item.meta.lyrics);

    const biGroup = document.getElementById('bilingualGroup');
    if (item.lrcData && item.lrcData.has_translation) {
      biGroup.style.display = 'flex';
      const curType = item.lrcType || 'bilingual';
      document.getElementById('btnBi').classList.toggle('active', curType === 'bilingual');
      document.getElementById('btnOrig').classList.toggle('active', curType === 'orig');
      document.getElementById('btnTrans').classList.toggle('active', curType === 'trans');
    } else {
      biGroup.style.display = 'none';
    }
  }

  function selectItem(idx, autoPlay = false) {
    if (idx < 0 || idx >= queue.length) return;
    currentIndex = idx;
    currentPlayingIdx = idx;

    const item = queue[idx];
    const canvasViewport = document.getElementById('canvasViewport');
    canvasViewport.style.opacity = '1';
    canvasViewport.style.pointerEvents = 'auto';

    document.getElementById('manualQuery').value = item.cleanName;
    document.getElementById('fieldTitle').value = item.meta.title || "";
    document.getElementById('fieldArtist').value = item.meta.artist || "";
    document.getElementById('fieldAlbum').value = item.meta.album || "";
    document.getElementById('fieldAlbumArtist').value = item.meta.album_artist || "";
    document.getElementById('fieldGenre').value = item.meta.genre || "";
    document.getElementById('fieldYear').value = item.meta.year || "";
    
    const trackStr = item.meta.track_total ? `${item.meta.track_num}/${item.meta.track_total}` : item.meta.track_num || "";
    const discStr = item.meta.disc_total ? `${item.meta.disc_num}/${item.meta.disc_total}` : item.meta.disc_num || "";
    document.getElementById('fieldTrack').value = trackStr;
    document.getElementById('fieldDisc').value = discStr;

    const coverSrc = item.meta.cover_data || item.meta.cover_url;
    coverBox.innerHTML = coverSrc ? `<img src="${coverSrc}"><div class="cover-overlay">点击/拖入图片更换封面</div>` : `<span>拖入图片</span><div class="cover-overlay">点击/拖入图片</div>`;

    renderCandidatePills(item);
    updateLyricsUI(item);
    loadAudioIntoPlayer(item, autoPlay);
    renderList();
  }

  function renderCandidatePills(item) {
    const list = document.getElementById('candidatesList');
    if (!item.candidates || item.candidates.length === 0) {
      list.innerHTML = `<div style="font-size:11px; color:var(--text-sub); padding: 4px;">未搜索到候选版本</div>`;
      return;
    }
    list.innerHTML = item.candidates.map(c => `
      <div class="candidate-pill ${item.selectedId === c.id ? 'active' : ''}" onclick="pickCandidate('${c.id}')">
        <img class="pill-img" src="${c.cover_url}">
        <div class="pill-info">
          <div class="pill-name" title="${c.title}">${c.title}</div>
          <div class="pill-sub">${c.artist} · ${c.year || ''}</div>
        </div>
      </div>
    `).join('');
  }

  function pickCandidate(cid) {
    if (currentIndex === -1) return;
    const item = queue[currentIndex];
    const found = item.candidates.find(c => c.id === cid);
    if (!found) return;
    applyCandidate(item, found);
    selectItem(currentIndex, false);
    item.status = 'done';
    renderList();
  }

  function updateCurrentMeta() {
    if (currentIndex === -1) return;
    const item = queue[currentIndex];
    item.meta.title = document.getElementById('fieldTitle').value;
    item.meta.artist = document.getElementById('fieldArtist').value;
    item.meta.album = document.getElementById('fieldAlbum').value;
    item.meta.album_artist = document.getElementById('fieldAlbumArtist').value;
    item.meta.genre = document.getElementById('fieldGenre').value;
    item.meta.year = document.getElementById('fieldYear').value;
    item.meta.lyrics = document.getElementById('fieldLyrics').value;

    const tVal = document.getElementById('fieldTrack').value.trim();
    if (tVal.includes('/')) {
      const parts = tVal.split('/');
      item.meta.track_num = parts[0].trim();
      item.meta.track_total = parts[1].trim();
    } else {
      item.meta.track_num = tVal;
    }

    const dVal = document.getElementById('fieldDisc').value.trim();
    if (dVal.includes('/')) {
      const parts = dVal.split('/');
      item.meta.disc_num = parts[0].trim();
      item.meta.disc_total = parts[1].trim();
    } else {
      item.meta.disc_num = dVal;
    }

    item.status = item.meta.title ? 'done' : 'fail';
    renderList();
  }

  async function manualReSearch() {
    if (currentIndex === -1) return;
    const q = document.getElementById('manualQuery').value.trim();
    if (!q) return;
    queue[currentIndex].cleanName = q;
    queue[currentIndex].status = 'searching';
    renderList();
    await matchSingle(queue[currentIndex]);
    queue[currentIndex].status = queue[currentIndex].meta.title ? 'done' : 'fail';
    selectItem(currentIndex, false);
  }

  // ---------------- 保存与批处理 ----------------
  function toggleSaveMode() {
    const isLocal = document.getElementById('chkSaveLocal').checked;
    document.getElementById('localGroup').style.display = isLocal ? 'flex' : 'none';
  }

  async function chooseFolder() {
    const res = await fetch('/api/select-folder');
    const data = await res.json();
    if (data.folder) {
      savedLocalFolder = data.folder;
      localStorage.setItem('musictag_save_dir', data.folder);
      document.getElementById('displayFolder').innerText = data.folder;
      return data.folder;
    }
    return '';
  }

  function showProgressModal(title, initialStatus) {
    const modal = document.getElementById('progressModal');
    document.getElementById('pModalTitle').innerText = title;
    document.getElementById('pModalStatus').innerText = initialStatus;
    document.getElementById('pModalPercent').innerText = "0%";
    document.getElementById('pModalFill').style.width = "0%";
    modal.classList.add('show');
  }

  function updateProgressModal(percent, statusText) {
    const pct = Math.min(100, Math.max(0, percent));
    document.getElementById('pModalPercent').innerText = `${pct}%`;
    document.getElementById('pModalFill').style.width = `${pct}%`;
    if (statusText) document.getElementById('pModalStatus').innerText = statusText;
  }

  function hideProgressModal() {
    setTimeout(() => { document.getElementById('progressModal').classList.remove('show'); }, 400);
  }

  async function submitBatch() {
    const isSaveLocal = document.getElementById('chkSaveLocal').checked;
    const exportLrc = document.getElementById('chkExportLrc').checked;
    const carMode = document.getElementById('chkCarMode').checked;
    const pattern = document.getElementById('organizePattern').value;
    const alwaysAsk = document.getElementById('chkAlwaysAsk').checked;
    const t = I18N[currentLang];

    let targetDir = savedLocalFolder;
    if (isSaveLocal) {
      if (!targetDir || alwaysAsk) {
        targetDir = await chooseFolder();
        if (!targetDir) return alert(t.alertNoFolder);
      }
    }

    const btn = document.getElementById('saveBtn');
    btn.disabled = true;

    const jobId = 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    showProgressModal(t.modalExportTitle, "正在准备音频流 (0%)...");

    let pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/progress?job_id=${jobId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'processing') {
            updateProgressModal(data.percent, `处理第 [${data.current}/${data.total}] 首: ${data.file}`);
          } else if (data.status === 'done') {
            updateProgressModal(100, t.doneStatus);
            clearInterval(pollInterval);
          }
        }
      } catch (e) {}
    }, 200);

    try {
      const formData = new FormData();
      queue.forEach(i => formData.append("files", i.file));
      formData.append("metadata_json", JSON.stringify(queue.map(i => i.meta)));
      formData.append("export_lrc", exportLrc);
      formData.append("save_to_local", isSaveLocal);
      formData.append("target_folder", targetDir);
      formData.append("organize_pattern", pattern);
      formData.append("compress_for_car", carMode);
      formData.append("job_id", jobId);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/batch-process", true);
      xhr.responseType = "blob";

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const upPct = Math.round((e.loaded / e.total) * 22);
          updateProgressModal(upPct, `正在传输数据 (${Math.round((e.loaded / e.total) * 100)}%)...`);
        }
      };

      xhr.onload = function() {
        clearInterval(pollInterval);
        if (xhr.status === 200) {
          updateProgressModal(100, t.doneStatus);
          if (!isSaveLocal) {
            const blob = xhr.response;
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `SonicTag_${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            a.remove();
          }
          hideProgressModal();
        } else {
          hideProgressModal();
          alert("处理异常，请查看终端输出。");
        }
        btn.disabled = false;
      };

      xhr.onerror = function() {
        clearInterval(pollInterval);
        hideProgressModal();
        alert("网络传输中断");
        btn.disabled = false;
      };

      xhr.send(formData);

    } catch (e) {
      clearInterval(pollInterval);
      hideProgressModal();
      btn.disabled = false;
      alert("提交异常");
    }
  }

  // ---------------- 页面载入初始化与持久化恢复 ----------------
  window.addEventListener('DOMContentLoaded', () => {
    if (savedLocalFolder) {
      document.getElementById('displayFolder').innerText = savedLocalFolder;
    }
    document.getElementById('chkAlwaysAsk').checked = localStorage.getItem('musictag_ask') === 'true';

    // 恢复音量
    const savedVol = localStorage.getItem('musictag_volume');
    if (savedVol !== null) setVolume(parseFloat(savedVol));
    else setVolume(0.85);

    // 恢复播放循环模式
    updatePlayModeUI();

    // 恢复侧边栏折叠
    if (localStorage.getItem('musictag_sidebar_collapsed') === 'true') {
      document.getElementById('workbench').classList.add('sidebar-collapsed');
      document.getElementById('sidebarToggleBtn').classList.add('collapsed');
    }

    resizeWaveformCanvas();
    resetIdleTimer();
  });

  document.getElementById('chkAlwaysAsk').addEventListener('change', (e) => {
    localStorage.setItem('musictag_ask', e.target.checked);
  });