// posts/*.html 안의 data-photo="검색어" 자리에 Unsplash 사진을 채워 넣는다.
// GitHub Actions에서 UNSPLASH_KEY 시크릿으로 실행된다. 키가 없으면 아무것도 하지 않는다.
// 검색 결과가 없으면 검색어를 줄여 다시 찾고, 그래도 없으면 섹션 기본 검색어로 찾는다.
// 사용량 한도(시간당 50회)에 걸리면 남은 자리는 그대로 두고 다음 배포 때 이어서 채운다.
const fs = require('fs');
const path = require('path');

const KEY = process.env.UNSPLASH_KEY;
if (!KEY) { console.log('UNSPLASH_KEY 없음 — 사진 삽입 건너뜀'); process.exit(0); }

const UTM = 'utm_source=fieldnote&utm_medium=referral';
const postsDir = path.join(__dirname, '..', 'posts');
const postsJsonPath = path.join(__dirname, '..', 'posts.json');
const postsJson = JSON.parse(fs.readFileSync(postsJsonPath, 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const SECTION_QUERY = { license: 'study desk notes', safety: 'construction worker safety', case: 'industrial warning sign',
  tools: 'workshop tools', trend: 'factory automation', life: 'worker break' };

class RateLimit extends Error {}
const cache = new Map();
async function fetchResults(query) {
  if (cache.has(query)) return cache.get(query);
  const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape&content_filter=high`,
    { headers: { Authorization: `Client-ID ${KEY}`, 'Accept-Version': 'v1' } });
  if (r.status === 403 || r.status === 429) throw new RateLimit(`Unsplash ${r.status}`);
  if (!r.ok) throw new Error(`Unsplash ${r.status} (${query})`);
  const results = (await r.json()).results || [];
  cache.set(query, results);
  return results;
}

// used: 같은 글 안에서 이미 쓴 사진 id (중복 방지)
async function search(query, section, used) {
  const words = query.trim().split(/\s+/);
  const tries = [];
  for (let n = words.length; n >= 1; n--) tries.push(words.slice(0, n).join(' '));
  if (words.length > 1) tries.push(words.slice(-1)[0]);
  if (SECTION_QUERY[section]) tries.push(SECTION_QUERY[section]);
  for (const q of [...new Set(tries)]) {
    const p = (await fetchResults(q)).find(x => !used.has(x.id));
    if (!p) continue;
    used.add(p.id);
    // Unsplash API 가이드라인: 사용 시 download 엔드포인트 호출
    fetch(p.links.download_location, { headers: { Authorization: `Client-ID ${KEY}` } }).catch(() => {});
    return {
      url: `${p.urls.raw}&w=1200&q=80&auto=format&fit=crop`,
      thumb: `${p.urls.raw}&w=600&q=70&auto=format&fit=crop`,
      alt: p.alt_description || query,
      credit: `사진: <a href="${p.user.links.html}?${UTM}" target="_blank" rel="noopener">${esc(p.user.name)}</a> / <a href="https://unsplash.com/?${UTM}" target="_blank" rel="noopener">Unsplash</a>`,
    };
  }
  return null;
}

(async () => {
  let changed = 0;
  try {
    for (const file of fs.readdirSync(postsDir).filter(f => f.endsWith('.html'))) {
      const fp = path.join(postsDir, file);
      let html = fs.readFileSync(fp, 'utf8');
      if (!html.includes('data-photo=')) continue;
      const entry = postsJson.find(p => p.file === file);
      const section = entry?.section;
      const used = new Set([...html.matchAll(/images\.unsplash\.com\/(photo-[\w-]+)/g)].map(m => m[1]));

      try {
        // 대표 사진: <div class="post-hero" data-photo="...">
        const hero = html.match(/<div class="post-hero" data-photo="([^"]+)">/);
        if (hero) {
          const p = await search(hero[1], section, used);
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
          const p = await search(m[1], section, used);
          html = html.replace(m[0], p
            ? `<figure><img src="${p.url}" alt="${esc(p.alt)}" loading="lazy"><figcaption>${esc(m[2])} · ${p.credit}</figcaption></figure>`
            : '');
        }
      } finally {
        // 한도에 걸려 중간에 멈춰도 이미 채운 자리는 저장한다
        fs.writeFileSync(fp, html);
      }
      changed++;
      console.log('사진 삽입:', file);
    }
  } catch (e) {
    if (!(e instanceof RateLimit)) throw e;
    console.log(`사용량 한도 도달 — 남은 사진은 다음 배포 때 채움 (${e.message})`);
  }
  fs.writeFileSync(postsJsonPath, JSON.stringify(postsJson, null, 2) + '\n');
  console.log(`완료: ${changed}개 글`);
})().catch(e => { console.error(e); process.exit(0); }); // 사진 실패가 배포를 막지 않게
