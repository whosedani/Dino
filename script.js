(function () {
  'use strict';

  // ==================== CONFIG ====================
  const DEFAULT_CONFIG = {
    ca: '',
    twitterUrl: 'https://x.com',
    communityUrl: '#',
    buyUrl: '#',
    tweet1Url: 'https://x.com/Jihooncrypto/status/2035907627197038699',
    tweet2Url: 'https://x.com/sungleeiq/status/2035911789968302576'
  };

  let siteConfig = { ...DEFAULT_CONFIG };

  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        siteConfig = { ...DEFAULT_CONFIG, ...data };
      }
    } catch (_) { /* use defaults */ }
    applyConfig();
  }

  function applyConfig() {
    const caText = document.getElementById('ca-text');
    const caDisplay = document.getElementById('ca-display');
    const communityLink = document.getElementById('community-link');
    const buyBtn = document.getElementById('buy-btn');

    if (siteConfig.ca) {
      caText.textContent = siteConfig.ca;
      caDisplay.dataset.ca = siteConfig.ca;
    } else {
      caText.textContent = 'CA: TBA';
    }
    if (siteConfig.communityUrl) communityLink.href = siteConfig.communityUrl;
    if (siteConfig.buyUrl) buyBtn.href = siteConfig.buyUrl;

    // Update tweet URLs
    const t1 = document.getElementById('tweet-1');
    const t2 = document.getElementById('tweet-2');
    if (siteConfig.tweet1Url) t1.dataset.tweetUrl = siteConfig.tweet1Url;
    if (siteConfig.tweet2Url) t2.dataset.tweetUrl = siteConfig.tweet2Url;
  }

  // ==================== COPY CA ====================
  function initCopyCA() {
    const caDisplay = document.getElementById('ca-display');
    const toast = document.getElementById('toast');
    caDisplay.addEventListener('click', async () => {
      const ca = caDisplay.dataset.ca || caDisplay.textContent.trim();
      if (!ca || ca === 'CA: TBA') return;
      try {
        await navigator.clipboard.writeText(ca);
      } catch (_) {
        // fallback
        const ta = document.createElement('textarea');
        ta.value = ca;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      toast.classList.add('toast--visible');
      setTimeout(() => toast.classList.remove('toast--visible'), 2000);
    });
  }

  // ==================== SCROLL REVEAL ====================
  function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal--visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );
    reveals.forEach((el) => observer.observe(el));
  }

  // ==================== TWEET EMBEDS ====================
  function initTweets() {
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;

    let loaded = false;
    const timeout = setTimeout(() => {
      if (!loaded) { /* fallback images already visible, do nothing */ }
    }, 3000);

    script.onload = () => {
      loaded = true;
      clearTimeout(timeout);
      if (window.twttr && window.twttr.widgets) {
        document.querySelectorAll('.tweet-embed').forEach((el) => {
          const url = el.dataset.tweetUrl;
          if (!url) return;
          const match = url.match(/status\/(\d+)/);
          if (!match) return;
          const fallbackImg = el.querySelector('.tweet-embed__fallback');
          const container = document.createElement('div');
          el.appendChild(container);
          window.twttr.widgets
            .createTweet(match[1], container, {
              theme: 'light',
              dnt: true,
              align: 'center'
            })
            .then((tweet) => {
              if (tweet && fallbackImg) fallbackImg.style.display = 'none';
            })
            .catch(() => { /* keep fallback */ });
        });
      }
    };
    script.onerror = () => {
      loaded = true;
      clearTimeout(timeout);
    };
    document.head.appendChild(script);
  }

  // ==================== GAME ENGINE ====================

  const PIXEL = 3;
  const CANVAS_W = 1200;
  const CANVAS_H = 300;
  const GROUND_Y = 210; // dino top; feet at ~210+60=270, ground line at 210+50=260
  const GRAVITY = 0.6;
  const JUMP_VEL = -11;
  const INITIAL_SPEED = 6;
  const SPEED_INC = 0.001;
  const PTERO_SCORE = 300;
  const NIGHT_SCORE = 500;
  const NIGHT_DURATION = 30000;

  // --- Sprite data (1 = fill pixel) ---

  // Dino standing/running frame 0 (22w x 24h pixels, drawn at PIXEL scale)
  const DINO_RUN_0 = [
    [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
    [0,1,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
    [0,1,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
    [0,1,1,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,1,1,1,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ];

  // Dino running frame 1 (legs swapped)
  const DINO_RUN_1 = [
    [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
    [0,1,0,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0],
    [0,1,0,0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
    [0,1,1,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0],
    [0,1,1,1,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0],
    [0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
  ];

  // Small cactus (7w x 14h)
  const CACTUS_SMALL = [
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0],
    [0,1,0,1,0,0,0],
    [0,1,0,1,0,1,0],
    [0,1,0,1,0,1,0],
    [0,1,0,1,0,1,0],
    [0,1,1,1,0,1,0],
    [0,0,0,1,1,1,0],
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0],
  ];

  // Large cactus (11w x 18h)
  const CACTUS_LARGE = [
    [0,0,0,0,0,1,0,0,0,0,0],
    [0,0,0,0,0,1,0,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,0,0],
    [0,1,0,0,1,1,1,0,0,0,0],
    [0,1,0,0,1,1,1,0,0,1,0],
    [0,1,0,0,1,1,1,0,0,1,0],
    [0,1,1,0,1,1,1,0,0,1,0],
    [0,1,1,0,1,1,1,0,1,1,0],
    [0,0,1,1,1,1,1,0,1,0,0],
    [0,0,0,0,1,1,1,1,1,0,0],
    [0,0,0,0,1,1,1,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,0,0],
  ];

  // Double small cactus (15w x 14h)
  const CACTUS_DOUBLE = [
    [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [0,1,0,1,0,0,0,0,0,1,0,1,0,0,0],
    [0,1,0,1,0,1,0,0,0,1,0,1,0,1,0],
    [0,1,0,1,0,1,0,0,0,1,0,1,0,1,0],
    [0,1,0,1,0,1,0,0,0,1,0,1,0,1,0],
    [0,1,1,1,0,1,0,0,0,1,1,1,0,1,0],
    [0,0,0,1,1,1,0,0,0,0,0,1,1,1,0],
    [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
  ];

  // Pterodactyl frame 0 — wings up (18w x 10h)
  const PTERO_0 = [
    [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ];

  // Pterodactyl frame 1 — wings down (18w x 10h)
  const PTERO_1 = [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0],
    [0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ];

  // Cloud (12w x 4h)
  const CLOUD = [
    [0,0,0,1,1,1,1,0,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,0,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,0],
    [0,1,1,1,1,1,1,1,1,1,1,1],
  ];

  // -- Game state --
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');

  const game = {
    active: false,
    over: false,
    started: false,
    score: 0,
    highScore: parseInt(localStorage.getItem('dino-hi') || '0', 10),
    speed: INITIAL_SPEED,
    dino: { x: 50, y: GROUND_Y, vy: 0, jumping: false, frame: 0, frameTick: 0 },
    obstacles: [],
    clouds: [{ x: 200, y: 30 }, { x: 500, y: 50 }, { x: 700, y: 20 }],
    groundX: 0,
    groundBumps: [],
    nightMode: false,
    nightStart: 0,
    nightTriggered: false,
    lastTime: 0,
    spawnTimer: 0,
    scoreFlash: 0,
  };

  // Generate ground bumps
  for (let i = 0; i < 80; i++) {
    game.groundBumps.push({ x: Math.random() * CANVAS_W * 2, w: Math.random() < 0.5 ? 1 : 2 });
  }


  // -- Palette --
  function pal() {
    return game.nightMode
      ? { bg: '#1A1A1A', fg: '#FAFAFA', cloud: '#555' }
      : { bg: '#FAFAFA', fg: '#535353', cloud: '#C4C4C4' };
  }

  // -- Draw sprite from bitmap --
  function drawSprite(sprite, x, y, color) {
    ctx.fillStyle = color;
    for (let r = 0; r < sprite.length; r++) {
      for (let c = 0; c < sprite[r].length; c++) {
        if (sprite[r][c]) {
          ctx.fillRect(x + c * PIXEL, y + r * PIXEL, PIXEL, PIXEL);
        }
      }
    }
  }

  // -- Sprite dimensions helper --
  function spriteSize(sprite) {
    return { w: sprite[0].length * PIXEL, h: sprite.length * PIXEL };
  }

  // -- Draw ground --
  function drawGround(p) {
    ctx.fillStyle = p.fg;
    const groundLineY = GROUND_Y + 55;
    ctx.fillRect(0, groundLineY, CANVAS_W, 1);
    // Bumps
    for (const bump of game.groundBumps) {
      const bx = ((bump.x - game.groundX) % (CANVAS_W * 2) + CANVAS_W * 2) % (CANVAS_W * 2) - CANVAS_W * 0.5;
      if (bx > -10 && bx < CANVAS_W + 10) {
        ctx.fillRect(bx, groundLineY + 2, bump.w * PIXEL, PIXEL);
      }
    }
  }

  // -- Draw score --
  function drawScore(p) {
    ctx.font = '16px Silkscreen, monospace';
    ctx.fillStyle = p.fg;
    ctx.textAlign = 'right';

    if (game.highScore > 0) {
      ctx.globalAlpha = 0.5;
      ctx.fillText('HI ' + String(game.highScore).padStart(5, '0'), CANVAS_W - 10, 24);
      ctx.globalAlpha = 1;
    }

    if (game.scoreFlash > 0 && Math.floor(game.scoreFlash / 4) % 2 === 0) {
      // flashing — skip draw
    } else {
      ctx.fillText(String(Math.floor(game.score)).padStart(5, '0'), CANVAS_W - (game.highScore > 0 ? 120 : 10), 24);
    }
  }

  // -- Draw game over --
  function drawGameOver(p) {
    ctx.font = '20px Silkscreen, monospace';
    ctx.fillStyle = p.fg;
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 10);

    // Restart icon
    const cx = CANVAS_W / 2, cy = CANVAS_H / 2 + 20;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 1.6);
    ctx.strokeStyle = p.fg;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 8, cy - 10);
    ctx.lineTo(cx + 14, cy - 4);
    ctx.lineTo(cx + 4, cy - 4);
    ctx.fillStyle = p.fg;
    ctx.fill();
  }

  // -- Spawn obstacle --
  function spawnObstacle() {
    const score = Math.floor(game.score);
    let type, sprite, yPos;

    // Pterodactyl after score 300
    if (score >= PTERO_SCORE && Math.random() < 0.3) {
      type = 'ptero';
      sprite = PTERO_0;
      const groundLineY = GROUND_Y + 55;
      const heights = [groundLineY - 60, groundLineY - 90, groundLineY - 30];
      yPos = heights[Math.floor(Math.random() * heights.length)];
    } else {
      const rand = Math.random();
      if (rand < 0.35) {
        type = 'cactus_small';
        sprite = CACTUS_SMALL;
      } else if (rand < 0.65) {
        type = 'cactus_large';
        sprite = CACTUS_LARGE;
      } else {
        type = 'cactus_double';
        sprite = CACTUS_DOUBLE;
      }
      const s = spriteSize(sprite);
      yPos = GROUND_Y + 55 - s.h;
    }

    const s = spriteSize(sprite);
    game.obstacles.push({
      type,
      x: CANVAS_W + 20,
      y: yPos,
      w: s.w,
      h: s.h,
      frame: 0,
      frameTick: 0
    });
  }

  // -- Collision detection (AABB with forgiveness) --
  function checkCollision() {
    const d = game.dino;
    const dinoSprite = DINO_RUN_0;
    const ds = spriteSize(dinoSprite);
    // Shrink hitbox for forgiveness
    const dx = d.x + 6;
    const dy = d.y + 4;
    const dw = ds.w - 12;
    const dh = ds.h - 8;

    for (const obs of game.obstacles) {
      const ox = obs.x + 4;
      const oy = obs.y + 4;
      const ow = obs.w - 8;
      const oh = obs.h - 8;

      if (dx < ox + ow && dx + dw > ox && dy < oy + oh && dy + dh > oy) {
        return true;
      }
    }
    return false;
  }

  // -- Game loop --
  function gameLoop(timestamp) {
    if (!game.active) return;

    const dt = game.lastTime ? Math.min((timestamp - game.lastTime) / 16.67, 3) : 1;
    game.lastTime = timestamp;

    const p = pal();

    // Clear
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (!game.over) {
      // -- Update dino --
      const d = game.dino;
      if (d.jumping) {
        d.vy += GRAVITY * dt;
        d.y += d.vy * dt;
        if (d.y >= GROUND_Y) {
          d.y = GROUND_Y;
          d.vy = 0;
          d.jumping = false;
        }
      }

      // Animate legs
      d.frameTick += dt;
      if (d.frameTick > 6) {
        d.frameTick = 0;
        d.frame = d.frame === 0 ? 1 : 0;
      }

      // -- Update speed --
      game.speed += SPEED_INC * dt;

      // -- Update score --
      game.score += 0.1 * dt * (game.speed / INITIAL_SPEED);
      if (game.scoreFlash > 0) game.scoreFlash -= dt;

      // Flash every 100 points
      const s100 = Math.floor(game.score);
      if (s100 > 0 && s100 % 100 === 0 && game.scoreFlash <= 0) {
        game.scoreFlash = 30;
      }

      // -- Night mode --
      if (!game.nightTriggered && Math.floor(game.score) >= NIGHT_SCORE) {
        game.nightMode = true;
        game.nightStart = timestamp;
        game.nightTriggered = true;
      }
      if (game.nightMode && timestamp - game.nightStart > NIGHT_DURATION) {
        game.nightMode = false;
      }

      // -- Spawn obstacles --
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0) {
        spawnObstacle();
        game.spawnTimer = Math.max(30, 80 - game.speed * 5) + Math.random() * 30;
      }

      // -- Update obstacles --
      for (let i = game.obstacles.length - 1; i >= 0; i--) {
        const obs = game.obstacles[i];
        const moveSpeed = obs.type === 'ptero' ? game.speed * 1.1 : game.speed;
        obs.x -= moveSpeed * dt;

        // Animate ptero
        if (obs.type === 'ptero') {
          obs.frameTick += dt;
          if (obs.frameTick > 10) {
            obs.frameTick = 0;
            obs.frame = obs.frame === 0 ? 1 : 0;
          }
        }

        if (obs.x + obs.w < -20) {
          game.obstacles.splice(i, 1);
        }
      }

      // -- Update clouds --
      for (const cloud of game.clouds) {
        cloud.x -= game.speed * 0.3 * dt;
        if (cloud.x < -30) {
          cloud.x = CANVAS_W + Math.random() * 100;
          cloud.y = 15 + Math.random() * 50;
        }
      }

      // -- Ground scroll --
      game.groundX += game.speed * dt;

      // -- Collision --
      if (checkCollision()) {
        game.over = true;
        if (Math.floor(game.score) > game.highScore) {
          game.highScore = Math.floor(game.score);
          localStorage.setItem('dino-hi', String(game.highScore));
        }
      }
    }

    // -- DRAW --
    const dp = pal();

    // Clouds
    for (const cloud of game.clouds) {
      drawSprite(CLOUD, cloud.x, cloud.y, dp.cloud);
    }

    // Ground
    drawGround(dp);

    // Obstacles
    for (const obs of game.obstacles) {
      let sprite;
      if (obs.type === 'cactus_small') sprite = CACTUS_SMALL;
      else if (obs.type === 'cactus_large') sprite = CACTUS_LARGE;
      else if (obs.type === 'cactus_double') sprite = CACTUS_DOUBLE;
      else if (obs.type === 'ptero') sprite = obs.frame === 0 ? PTERO_0 : PTERO_1;
      drawSprite(sprite, obs.x, obs.y, dp.fg);
    }

    // Dino
    const dinoSprite = game.dino.frame === 0 ? DINO_RUN_0 : DINO_RUN_1;
    drawSprite(dinoSprite, game.dino.x, game.dino.y, dp.fg);

    // Score
    drawScore(dp);

    // Game over overlay
    if (game.over) {
      drawGameOver(dp);
    }

    requestAnimationFrame(gameLoop);
  }

  // -- Jump --
  function jump() {
    if (!game.dino.jumping && !game.over) {
      game.dino.jumping = true;
      game.dino.vy = JUMP_VEL;
    }
  }

  // -- Start game --
  function startGame() {
    game.active = true;
    game.over = false;
    game.started = true;
    game.score = 0;
    game.speed = INITIAL_SPEED;
    game.dino = { x: 50, y: GROUND_Y, vy: 0, jumping: false, frame: 0, frameTick: 0 };
    game.obstacles = [];
    game.nightMode = false;
    game.nightTriggered = false;
    game.spawnTimer = 50;
    game.lastTime = 0;
    game.scoreFlash = 0;
    game.groundX = 0;

    const hint = document.getElementById('game-hint');
    if (hint) hint.style.display = 'none';

    requestAnimationFrame(gameLoop);
  }

  // -- Restart --
  function restartGame() {
    startGame();
  }

  // -- Draw initial idle state --
  function drawIdle() {
    const p = pal();
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    drawGround(p);
    for (const cloud of game.clouds) {
      drawSprite(CLOUD, cloud.x, cloud.y, p.cloud);
    }
    drawSprite(DINO_RUN_0, 50, GROUND_Y, p.fg);
  }

  // -- Input --
  function handleAction() {
    if (!game.started || game.over) {
      startGame();
      jump();
    } else if (game.active && !game.over) {
      jump();
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      // Only handle if hero section is in view or game is active
      e.preventDefault();
      handleAction();
    }
  });

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleAction();
  }, { passive: false });

  canvas.addEventListener('click', () => {
    handleAction();
  });

  // ==================== INIT ====================
  document.addEventListener('DOMContentLoaded', () => {
    // Draw idle canvas
    drawIdle();

    // Load config
    loadConfig();

    // Init features
    initCopyCA();
    initScrollReveal();
    initTweets();
  });
})();
