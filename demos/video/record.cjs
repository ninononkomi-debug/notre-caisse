// Enregistre les vidéos publicitaires (1080×1920, 30 s) à partir des démos
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BASE = 'http://localhost:8765';
const OUT = process.argv[2];
const ONLY = process.argv[3];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const ICON = {
  caisse: '<svg width="96" height="96" viewBox="0 0 96 96"><path d="M48 58 C 30 46, 30 28, 41 28 C 45 28, 47 31, 48 33 C 49 31, 51 28, 55 28 C 66 28, 66 46, 48 58 Z" fill="#FFF4E2"/><g fill="#E0A526"><path d="M10 60 C 14 54, 20 52, 26 54 L 40 59 C 44 60.5, 45 64.5, 41.5 66 L 31 64 C 33 67, 38 70, 46 71 L 46 80 C 32 80, 22 75, 16 70 L 10 70 Z"/><g transform="translate(96 0) scale(-1 1)"><path d="M10 60 C 14 54, 20 52, 26 54 L 40 59 C 44 60.5, 45 64.5, 41.5 66 L 31 64 C 33 67, 38 70, 46 71 L 46 80 C 32 80, 22 75, 16 70 L 10 70 Z"/></g></g></svg>',
  stock: '<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.9 15.5A2 2 0 0 0 8.5 14.1l-6.1-1.6a.5.5 0 0 1 0-1L8.5 9.9A2 2 0 0 0 9.9 8.5l1.6-6.1a.5.5 0 0 1 1 0l1.6 6.1a2 2 0 0 0 1.4 1.4l6.1 1.6a.5.5 0 0 1 0 1l-6.1 1.6a2 2 0 0 0-1.4 1.4l-1.6 6.1a.5.5 0 0 1-1 0z"/><path d="M20 3v4M22 5h-4"/></svg>',
  tontine: '<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>',
};
const outroHtml = (line) => `
  <div class="brand">Orly<i>Digital</i></div>
  <p>${line}</p>
  <div class="pill">Démo gratuite · prix doux</div>
  <div class="wa">WhatsApp 076 37 08 81</div>
  <p class="small">Applications Android sur mesure · Libreville</p>`;

const VIDEOS = {
  caisse: {
    theme: ['#7A1E3A', '#E0A526'], src: '/dist-demo/index.html',
    intro: `<div class="logo">${ICON.caisse}</div><h1>Notre Caisse</h1><p>La caisse de la famille<br><span class="hl">dans votre téléphone</span></p>`,
    outro: outroHtml('Votre caisse familiale, votre tontine ou votre boutique… <span class="hl">en application</span>'),
    async run(s) {
      await s.cap('Fini le cahier de cotisations&nbsp;! <em>Tout le monde voit la caisse</em>');
      await wait(2600);
      await s.cap('Qui a cotisé ce mois&nbsp;? <em>En un coup d’œil</em>');
      await s.scroll(560); await wait(2200);
      await s.cap('Chacun déclare son dépôt <em>avec la capture</em>');
      await s.tap('.tabbar .add'); await wait(2300);
      await s.scrollIn('.sheet-body', 600); await wait(1000);
      await s.esc();
      await s.cap('La trésorière <em>valide en 1 clic</em>');
      await s.tap('.tabbar button[aria-label="Caisse"]'); await wait(1300);
      await s.scroll(240); await wait(800);
      await s.tap('.validate button:has-text("Valider")'); await wait(1600);
      await s.cap('À jour ou en retard&nbsp;? <em>Chaque mois, chaque membre</em>');
      await s.tap('.tabbar button[aria-label="Membres"]'); await wait(1300);
      await s.tap('.item-main b:text-is("Rodrigue")'); await wait(2200);
      await s.esc();
      await s.cap('Rappels automatiques <em>avant le 10 du mois</em>');
      await s.tap('.tabbar button[aria-label="Accueil"]');
      await s.notif('Notre Caisse · Rappel', 'Cotisation du mois : 2 600 F à verser avant le 10.'); await wait(2600);
    },
  },
  stock: {
    theme: ['#A8446A', '#F2C14E'], src: '/demos/stock/dist-single/index.html',
    intro: `<div class="logo">${ICON.stock}</div><h1>Beauté Stock</h1><p>Votre boutique de cosmétiques<br><span class="hl">gérée depuis le téléphone</span></p>`,
    outro: outroHtml('Boutique, stock, caisse, tontine… <span class="hl">votre application sur mesure</span>'),
    async run(s) {
      await s.cap('Ventes et bénéfice du jour, <em>en direct</em>');
      await wait(2600);
      await s.cap('Une vente en <em>3 appuis</em>');
      await s.tap('.tabbar .add'); await wait(900);
      await s.tap('.sell-item button:has-text("Ajouter")', 0); await wait(500);
      await s.tap('.sell-item.on button[aria-label="Plus"]', 0); await wait(500);
      await s.tap('.sell-item button:has-text("Ajouter")', 2); await wait(900);
      await s.tap('.sheet-foot button'); await wait(1500);
      await s.cap('Alerte quand un produit <em>va manquer</em>');
      await s.scroll(330); await wait(2600);
      await s.cap('Le stock se met à jour <em>tout seul</em>');
      await s.tap('.tabbar button[aria-label="Produits"]'); await wait(2400);
      await s.cap('Vos vendeuses vendent, <em>vous gardez le contrôle</em>');
      await s.tap('.tabbar button[aria-label="Mouvements"]'); await wait(2600);
      await s.cap('Bénéfice du mois et <em>valeur du stock</em>');
      await s.tap('.tabbar button[aria-label="Accueil"]'); await wait(400);
      await s.scroll(150); await wait(2200);
    },
  },
  tontine: {
    theme: ['#1E3A8A', '#F59E0B'], src: '/demos/tontine/dist-single/index.html',
    intro: `<div class="logo">${ICON.tontine}</div><h1>Tontine Facile</h1><p>Votre tontine <span class="hl">sans cahier<br>ni dispute</span></p>`,
    outro: outroHtml('Tontine, caisse familiale, boutique… <span class="hl">votre application sur mesure</span>'),
    async run(s) {
      await s.cap('Mon tour, mes cotisations, <em>tout est clair</em>');
      await wait(3000);
      await s.cap('Toutes vos tontines <em>au même endroit</em>');
      await s.scroll(520); await wait(2700);
      await s.cap('Qui a payé&nbsp;? <em>Qui reçoit ce mois-ci&nbsp;?</em>');
      await s.tap('.tcard', 0); await wait(2900);
      await s.cap('Le calendrier des tours, <em>pour tout le monde</em>');
      await s.tap('.segmented button:has-text("Calendrier")'); await wait(2600);
      await s.cap('La présidente <em>valide en 1 clic</em>');
      await s.tap('.segmented button:has-text("À valider")'); await wait(1200);
      await s.tap('.validate button:has-text("Valider")', 0); await wait(1800);
      await s.cap('Retard&nbsp;? <em>La pénalité se calcule toute seule</em>');
      await s.tap('.tabbar .add'); await wait(800);
      await s.tap('.sheet .chip:has-text("Famille Ndong")', 0); await wait(3600);
    },
  },
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const [name, v] of Object.entries(VIDEOS)) {
    if (ONLY && ONLY !== name) continue;
    const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(`${BASE}/demos/video/studio.html`);
    await page.evaluate(([c, a]) => window.studio.setTheme(c, a), v.theme);
    await page.evaluate((h) => window.studio.intro(h), v.intro);
    await page.evaluate((src) => window.studio.load(src), BASE + v.src);
    await page.waitForTimeout(1500);
    const app = page.frameLocator('#app');
    const s = {
      cap: (h) => page.evaluate((x) => window.studio.caption(x), h),
      async tap(sel, i = 0) {
        const loc = app.locator(sel).nth(i);
        await loc.scrollIntoViewIfNeeded().catch(() => {});
        const b = await loc.boundingBox();
        if (b) await page.evaluate(([x, y]) => window.studio.tap(x, y), [b.x + b.width / 2 - 75, b.y + b.height / 2 - 138]);
        await wait(280);
        await loc.click();
      },
      scroll: (y) => page.frame({ url: /index\.html/ }).evaluate((yy) => document.querySelector('.content').scrollTo({ top: yy, behavior: 'smooth' }), y),
      scrollIn: (sel, y) => page.frame({ url: /index\.html/ }).evaluate(([ss, yy]) => document.querySelector(ss)?.scrollTo({ top: yy, behavior: 'smooth' }), [sel, y]),
      esc: async () => { await page.frame({ url: /index\.html/ }).evaluate(() => window.__sheetClose && window.__sheetClose()); await wait(500); },
      notif: (t, b) => page.evaluate(([x, y]) => window.studio.notif(x, y), [t, b]),
    };
    // Capture image par image (haute qualité)
    const cdp = await ctx.newCDPSession(page);
    const dir = path.join(OUT, name + '_frames');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir);
    const frames = [];
    cdp.on('Page.screencastFrame', async (f) => {
      const file = path.join(dir, `${String(frames.length).padStart(5, '0')}.jpg`);
      fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
      frames.push({ file, t: f.metadata.timestamp });
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
    const t0 = Date.now();
    await wait(2600);
    await page.evaluate(() => window.studio.hideIntro());
    await wait(500);
    await v.run(s);
    await page.evaluate((h) => window.studio.outro(h), v.outro);
    await wait(4300);
    await cdp.send('Page.stopScreencast');
    const total = (Date.now() - t0) / 1000;
    // Liste concat avec durées réelles
    let list = '';
    for (let i = 0; i < frames.length; i++) {
      const d = i + 1 < frames.length ? frames[i + 1].t - frames[i].t : Math.max(0.5, frames[0].t + total - frames[i].t);
      list += `file '${frames[i].file}'\nduration ${Math.max(0.001, d).toFixed(4)}\n`;
    }
    list += `file '${frames[frames.length - 1].file}'\n`;
    fs.writeFileSync(path.join(OUT, name + '.txt'), list);
    const mp4 = path.join(OUT, `${name}.mp4`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(OUT, name + '.txt'),
      '-vf', 'scale=1080:1920:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-t', '30', '-movflags', '+faststart', '-an', mp4]);
    console.log(name, 'frames', frames.length, 'durée', total.toFixed(1), 's', errs.length ? 'ERREURS ' + errs.join(' | ') : '');
    await ctx.close();
  }
  await browser.close();
})();
