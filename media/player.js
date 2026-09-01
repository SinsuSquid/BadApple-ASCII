/**
 * Bad Apple!! ASCII Engine & Sidebar Webview Player
 * Supports Automatic Dark/Light VS Code Theme Adaptation
 */

(function () {
    // Character Palettes
    const CHARSETS = {
        standard: " .:-=+*#%@",
        detailed: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
        blocks: " ░▒▓█",
        braille: " ⠄⠆⠇⠗⠟⠿⣿",
        matrix: " ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ",
        binary: " 01",
        katakana: " ﾊﾐﾋｰｳｼﾅﾓﾆｻﾜﾂｵﾘｱﾎﾃﾏｹﾒｴｶｷﾑﾕﾗｾﾈｽﾀﾇﾍ"
    };

    // DOM Elements
    const video = document.getElementById('video-source');
    const canvas = document.getElementById('render-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const asciiDisplay = document.getElementById('ascii-display');
    const stage = document.getElementById('stage');
    const hudBar = document.getElementById('hud-bar');
    const controlBar = document.getElementById('control-bar');
    const hudFps = document.getElementById('hud-fps');
    const hudRes = document.getElementById('hud-res');

    // Controls
    const charsetSelect = document.getElementById('charset-select');
    const btnInvert = document.getElementById('btn-invert');
    const btnCrt = document.getElementById('btn-crt');
    const btnPlay = document.getElementById('btn-play');
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');
    const btnRestart = document.getElementById('btn-restart');
    const seekBar = document.getElementById('seek-bar');
    const timeDisplay = document.getElementById('time-display');
    const btnLoop = document.getElementById('btn-loop');

    // Modal
    const modalCustom = document.getElementById('modal-custom-charset');
    const inputCustom = document.getElementById('input-custom-charset');
    const btnSaveCustom = document.getElementById('btn-save-custom');
    const btnCancelCustom = document.getElementById('btn-cancel-custom');

    // Initial Configuration
    const config = window.__INITIAL_CONFIG__ || {};
    let currentCharsetKey = config.charset || 'standard';
    let customCharset = " .:-=+*#%@";
    let currentRes = config.resolution || 'auto';
    let crtEnabled = config.crtScanlines !== false;
    let isInverted = config.inverted === true;
    let isLooping = config.loop !== false;
    let contrast = Number(config.contrast) || 1.2;

    // Render Metrics
    let cols = 60;
    let rows = 22;
    const aspectCorrection = 0.48; // Mono font aspect ratio compensation

    // Performance & FPS tracking
    let frameCount = 0;
    let lastFpsTime = performance.now();
    let isSeeking = false;
    let idleTimer = null;
    let animHandle = null;

    // Initialize UI state
    charsetSelect.value = currentCharsetKey;
    if (isInverted) btnInvert.classList.add('active');
    if (crtEnabled) btnCrt.classList.add('active');
    if (isLooping) btnLoop.classList.add('active');
    video.loop = isLooping;

    // Detect if VS Code is currently in Light Theme
    function isLightMode() {
        return document.body.classList.contains('vscode-light') || 
               document.body.classList.contains('vscode-high-contrast-light') ||
               (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
    }

    // Get active character palette
    function getActivePalette() {
        if (currentCharsetKey === 'custom') {
            return customCharset.length > 0 ? customCharset : " #";
        }
        return CHARSETS[currentCharsetKey] || CHARSETS.standard;
    }

    // Calculate dimensions & resize display font
    function updateDimensions() {
        const stageW = Math.max(stage.clientWidth - 8, 100);
        const stageH = Math.max(stage.clientHeight - 8, 100);

        if (currentRes === 'auto') {
            if (stageW < 280) {
                cols = Math.max(36, Math.floor(stageW / 5.2));
            } else if (stageW < 450) {
                cols = Math.max(48, Math.floor(stageW / 5.8));
            } else {
                cols = Math.min(160, Math.max(70, Math.floor(stageW / 6.8)));
            }
        } else {
            cols = parseInt(currentRes, 10) || 60;
        }

        // 480x360 video aspect ratio (4:3) -> 0.75
        rows = Math.max(12, Math.round(cols * 0.75 * aspectCorrection));

        canvas.width = cols;
        canvas.height = rows;

        // Auto-scale font size to fit stage perfectly
        const fontByWidth = stageW / (cols * 0.605);
        const fontByHeight = stageH / rows;
        const optimalFontSize = Math.max(4.0, Math.min(fontByWidth, fontByHeight, 22));

        asciiDisplay.style.fontSize = `${optimalFontSize.toFixed(2)}px`;
        hudRes.textContent = `${cols}x${rows}`;
    }

    // Convert frame to ASCII string
    function renderFrameToAscii() {
        if (!video.videoWidth || !video.videoHeight) return;

        ctx.drawImage(video, 0, 0, cols, rows);
        const imgData = ctx.getImageData(0, 0, cols, rows).data;

        const palette = getActivePalette();
        const paletteLen = palette.length;
        
        // Auto-adapt to Light vs Dark theme
        const lightMode = isLightMode();
        const effectiveInvert = isInverted ? !lightMode : lightMode;
        const cont = contrast;

        let ascii = '';

        for (let y = 0; y < rows; y++) {
            const rowOffset = y * cols * 4;
            let line = '';
            for (let x = 0; x < cols; x++) {
                const idx = rowOffset + (x * 4);
                const r = imgData[idx];
                const g = imgData[idx + 1];
                const b = imgData[idx + 2];

                // Fast ITU-R BT.601 luminance
                let lum = 0.299 * r + 0.587 * g + 0.114 * b;

                if (cont !== 1.0) {
                    lum = ((lum - 128) * cont) + 128;
                    if (lum < 0) lum = 0;
                    else if (lum > 255) lum = 255;
                }

                if (effectiveInvert) {
                    lum = 255 - lum;
                }

                const charIndex = Math.min(paletteLen - 1, Math.floor((lum / 256) * paletteLen));
                line += palette[charIndex];
            }
            ascii += line + (y < rows - 1 ? '\n' : '');
        }

        asciiDisplay.textContent = ascii;

        // FPS calculation
        frameCount++;
        const now = performance.now();
        if (now - lastFpsTime >= 500) {
            const currentFps = Math.round((frameCount * 1000) / (now - lastFpsTime));
            hudFps.textContent = `${currentFps} FPS`;
            frameCount = 0;
            lastFpsTime = now;
        }

        // Timeline update
        if (!isSeeking && video.duration) {
            seekBar.value = (video.currentTime / video.duration) * 100;
            timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
        }
    }

    // Main animation loop
    function loop() {
        if (!video.paused && !video.ended) {
            renderFrameToAscii();
        }
        if ('requestVideoFrameCallback' in video) {
            video.requestVideoFrameCallback(loop);
        } else {
            animHandle = requestAnimationFrame(loop);
        }
    }

    // Format seconds to mm:ss
    function formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // Playback control
    function togglePlay() {
        if (video.paused || video.ended) {
            video.play().then(() => {
                iconPlay.style.display = 'none';
                iconPause.style.display = 'block';
                if (!('requestVideoFrameCallback' in video)) {
                    animHandle = requestAnimationFrame(loop);
                }
            }).catch(err => {
                console.error('Play error:', err);
            });
        } else {
            video.pause();
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
        }
    }

    function restartPlayback() {
        video.currentTime = 0;
        video.play();
        iconPlay.style.display = 'none';
        iconPause.style.display = 'block';
    }

    // Mouse Idle Cinema Mode
    function resetIdleTimer() {
        document.body.classList.remove('idle-cursor');
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            if (!video.paused) {
                document.body.classList.add('idle-cursor');
            }
        }, 2800);
    }

    // Observe theme changes in VS Code live
    const themeObserver = new MutationObserver(() => {
        if (video.paused) renderFrameToAscii();
    });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
            if (video.paused) renderFrameToAscii();
        });
    }

    // Event Listeners
    window.addEventListener('resize', () => {
        updateDimensions();
        if (video.paused) renderFrameToAscii();
    });

    document.addEventListener('mousemove', resetIdleTimer);
    document.addEventListener('mousedown', resetIdleTimer);

    btnPlay.addEventListener('click', togglePlay);
    btnRestart.addEventListener('click', restartPlayback);
    stage.addEventListener('click', togglePlay);

    charsetSelect.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            modalCustom.style.display = 'flex';
            inputCustom.focus();
        } else {
            currentCharsetKey = e.target.value;
            if (video.paused) renderFrameToAscii();
        }
    });

    btnSaveCustom.addEventListener('click', () => {
        const val = inputCustom.value;
        if (val && val.length > 0) {
            customCharset = val;
            currentCharsetKey = 'custom';
            charsetSelect.value = 'custom';
            modalCustom.style.display = 'none';
            if (video.paused) renderFrameToAscii();
        }
    });

    btnCancelCustom.addEventListener('click', () => {
        modalCustom.style.display = 'none';
        charsetSelect.value = currentCharsetKey;
    });

    btnInvert.addEventListener('click', () => {
        isInverted = !isInverted;
        btnInvert.classList.toggle('active', isInverted);
        if (video.paused) renderFrameToAscii();
    });

    btnCrt.addEventListener('click', () => {
        crtEnabled = !crtEnabled;
        btnCrt.classList.toggle('active', crtEnabled);
        document.body.classList.toggle('crt-scanlines', crtEnabled);
    });

    btnLoop.addEventListener('click', () => {
        isLooping = !isLooping;
        video.loop = isLooping;
        btnLoop.classList.toggle('active', isLooping);
    });

    // Seek bar events
    seekBar.addEventListener('mousedown', () => { isSeeking = true; });
    seekBar.addEventListener('input', () => {
        if (video.duration) {
            video.currentTime = (seekBar.value / 100) * video.duration;
            timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
            renderFrameToAscii();
        }
    });
    seekBar.addEventListener('mouseup', () => { isSeeking = false; });

    // Video lifecycle events
    video.addEventListener('loadedmetadata', () => {
        updateDimensions();
        timeDisplay.textContent = `00:00 / ${formatTime(video.duration)}`;
        renderFrameToAscii();
    });

    video.addEventListener('ended', () => {
        if (!isLooping) {
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
            document.body.classList.remove('idle-cursor');
        }
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target === inputCustom) return;

        switch (e.code) {
            case 'Space':
            case 'KeyK':
                e.preventDefault();
                togglePlay();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                video.currentTime = Math.max(0, video.currentTime - 5);
                renderFrameToAscii();
                break;
            case 'ArrowRight':
                e.preventDefault();
                video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
                renderFrameToAscii();
                break;
            case 'ArrowUp':
                e.preventDefault();
                contrast = Math.min(2.5, Number((contrast + 0.1).toFixed(1)));
                if (video.paused) renderFrameToAscii();
                break;
            case 'ArrowDown':
                e.preventDefault();
                contrast = Math.max(0.5, Number((contrast - 0.1).toFixed(1)));
                if (video.paused) renderFrameToAscii();
                break;
            case 'KeyI':
                btnInvert.click();
                break;
            case 'KeyC':
                btnCrt.click();
                break;
            case 'KeyR':
                restartPlayback();
                break;
        }
    });

    // Initial setup & auto-start
    updateDimensions();

    video.addEventListener('canplay', () => {
        renderFrameToAscii();
        video.play().then(() => {
            iconPlay.style.display = 'none';
            iconPause.style.display = 'block';
            if ('requestVideoFrameCallback' in video) {
                video.requestVideoFrameCallback(loop);
            } else {
                animHandle = requestAnimationFrame(loop);
            }
        }).catch(() => {
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
            renderFrameToAscii();
        });
    }, { once: true });

})();
