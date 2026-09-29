// posts/*.html 안의 data-photo="검색어" 자리에 Unsplash 사진을 채워 넣는다.
// GitHub Actions에서 UNSPLASH_KEY 시크릿으로 실행된다. 키가 없으면 아무것도 하지 않는다.
const fs = require('fs');
const path = require('path');

const KEY = process.env.UNSPLASH_KEY;
if (!KEY) { console.log('UNSPLASH_KEY 없음 — 사진 삽입 건너뜀'); process.exit(0); }

const UTM = 'utm_source=fieldnote&utm_medium=referral';
const postsDir = path.join(__dirname, '..', 'posts');
const postsJsonPath = path.join(__dirname, '..', 'posts.json');
const postsJson = JSON.parse(fs.readFileSync(postsJsonPath, 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

async function search(query) {
  const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&content_filter=high`,
    { headers: { Authorization: `Client-ID ${KEY}`, 'Accept-Version': 'v1' } });
  if (!r.ok) throw new Error(`Unsplash ${r.status} (${query})`);
  const p = (await r.json()).results[0];
  if (!p) return null;
  // Unsplash API 가이드라인: 사용 시 download 엔드포인트 호출
  fetch(p.links.download_location, { headers: { Authorization: `Client-ID ${KEY}` } }).catch(() => {});
  return {
    url: `${p.urls.raw}&w=1200&q=80&auto=format&fit=crop`,
    thumb: `${p.urls.raw}&w=600&q=70&auto=format&fit=crop`,
    alt: p.alt_description || query,
    credit: `사진: <a href="${p.user.links.html}?${UTM}" target="_blank" rel="noopener">${esc(p.user.name)}</a> / <a href="https://unsplash.com/?${UTM}" target="_blank" rel="noopener">Unsplash</a>`,
  };
}

(async () => {
  let changed = 0;
  for (const file of fs.readdirSync(postsDir).filter(f => f.endsWith('.html'))) {
    const fp = path.join(postsDir, file);
    let html = fs.readFileSync(fp, 'utf8');
    if (!html.includes('data-photo=')) continue;
    const entry = postsJson.find(p => p.file === file);

    // 대표 사진: <div class="post-hero" data-photo="...">
    const hero = html.match(/<div class="post-hero" data-photo="([^"]+)">/);
    if (hero) {
      const p = await search(hero[1]);
      if (p) {
        html = html.replace(hero[0], `<div class="post-hero photo" style="--photo:url('${p.url}')">`);
        html = html.replace('<div class="wrap">', `<div class="wrap">\n    <p class="credit">${p.credit}</p>`);
        if (entry) entry.image = p.thumb;
        html = html.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${p.url}">`);
      } else {
        html = html.replace(hero[0], '<div class="post-hero">');
      }
    }

    // 본문 사진: <figure data-photo="..."><figcaption>설명</figcaption></figure>
    for (const m of [...html.matchAll(/<figure data-photo="([^"]+)">\s*<figcaption>([^<]*)<\/figcaption>\s*<\/figure>/g)]) {
      const p = await search(m[1]);
      html = html.replace(m[0], p
        ? `<figure><img src="${p.url}" alt="${esc(p.alt)}" loading="lazy"><figcaption>${esc(m[2])} · ${p.credit}</figcaption></figure>`
        : '');
    }

    fs.writeFileSync(fp, html);
    changed++;
    console.log('사진 삽입:', file);
  }
  fs.writeFileSync(postsJsonPath, JSON.stringify(postsJson, null, 2) + '\n');
  console.log(`완료: ${changed}개 글`);
})().catch(e => { console.error(e); process.exit(1); });
