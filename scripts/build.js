// 배포 때마다 실행: 검색엔진용 정적 산출물을 만든다.
//  - 섹션 페이지 6개 (license.html …), 메인 페이지의 정적 카드, sitemap.xml, feed.xml, robots.txt
//  - 글마다 JSON-LD(Article·BreadcrumbList·FAQPage) 삽입, 검색 색인 search.json
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const BASE = fs.existsSync(path.join(ROOT, 'CNAME')) ? `https://${fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim()}/` : 'https://field.ynote.co.kr/';
const SECTIONS = { license: ['자격증', '📜', '국가기술자격증·면허 취득 방법, 시험 구성, 공부법'], safety: ['산업안전', '🦺', '법정 안전교육, 위험성평가, 보호구, 작업별 안전수칙'], case: ['사고사례 분석', '🚨', '산업재해 유형별 원인과 예방 대책'], tools: ['장비·공구', '🔧', '공구·측정기·설비 사용법과 고르는 기준'], trend: ['산업 트렌드', '🔋', '2차전지·반도체·자동화·물류 산업의 흐름'], life: ['현장 생활', '💼', '교대근무 건강관리, 작업복 관리, 현장 직장인 생활 팁'] };
const NAVER = '<meta name="naver-site-verification" content="c254b450f730ddc6064c4494834efa93d383bd94">';
const ADS = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9274785237746410" crossorigin="anonymous"></script>';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);

const posts = JSON.parse(read('posts.json')).sort((a, b) => b.date.localeCompare(a.date));
const stats = fs.existsSync(path.join(ROOT, 'stats.json')) ? JSON.parse(read('stats.json')) : null;
const today = new Date().toISOString().slice(0, 10);

const card = (p, big) => {
  const [name, icon] = SECTIONS[p.section] || ['', ''];
  const views = stats?.pages?.['posts/' + p.file];
  return `<a class="card c-${p.section}${big ? ' big' : ''}" href="posts/${esc(p.file)}"><div class="hero-box">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : icon}</div>
    <div class="t"><small>${name} · ${p.date}${views ? ` · 조회 ${views.toLocaleString()}` : ''}</small><b>${esc(p.title)}</b><p>${esc(p.summary)}</p></div></a>`;
};
const head = (title, desc, url) => `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${NAVER}
${ADS}
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="현장노트">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${BASE}assets/og-image.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">
<link rel="alternate" type="application/rss+xml" title="현장노트" href="${BASE}feed.xml">
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-GMS58YZHEH"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-GMS58YZHEH');</script>
<link rel="stylesheet" href="assets/style.css">`;
const header = `<header class="site"><div class="in">
  <a class="logo" href="index.html">현장<span>노트</span></a>
  <nav>${Object.entries(SECTIONS).map(([id, [name]]) => `<a href="${id}.html">${name}</a>`).join('')}</nav>
</div></header>`;
const footer = `<footer>
  <div><a href="about.html">소개</a>·<a href="contact.html">문의</a>·<a href="privacy.html">개인정보처리방침</a>·<a href="feed.xml">RSS</a></div>
  <div style="margin-top:8px">© 2026 현장노트 · 운영 황제효도르</div>
</footer>`;

// 1) 섹션 페이지
for (const [id, [name, icon, desc]] of Object.entries(SECTIONS)) {
  const list = posts.filter(p => p.section === id);
  const title = `${name} 글 모음 (${list.length}편) | 현장노트`;
  const ld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description: desc, url: `${BASE}${id}.html`,
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: '현장노트', item: BASE }, { '@type': 'ListItem', position: 2, name, item: `${BASE}${id}.html` }] } };
  write(`${id}.html`, `<!DOCTYPE html>
<html lang="ko">
<head>
${head(title, `${desc}. 현장노트 ${name} 섹션의 모든 글이에요.`, `${BASE}${id}.html`)}
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
${header}
<main class="home">
  <div class="banner c-${id}"><h1>${icon} ${name}</h1><p>${esc(desc)} · ${list.length}편</p></div>
  <div class="tabs">${Object.entries(SECTIONS).map(([s, [n, i]]) => `<a class="tab${s === id ? ' on' : ''}" href="${s}.html">${i} ${n}</a>`).join('')}</div>
  <div class="grid">${list.map((p, i) => card(p, i === 0)).join('\n')}</div>
</main>
${footer}
</body>
</html>
`);
}

// 2) 메인 페이지: 정적 카드(최신 12편)와 섹션 링크를 심는다 (JS가 뜨면 대체됨)
let idx = read('index.html');
idx = idx.replace(/<div class="grid" id="grid">[\s\S]*?<!--\/grid-->/, `<div class="grid" id="grid">${posts.slice(0, 12).map((p, i) => card(p, i === 0)).join('\n')}<!--/grid-->`);
idx = idx.replace(/<ul class="cats" id="cats">[\s\S]*?<\/ul>/, `<ul class="cats" id="cats">${Object.entries(SECTIONS).map(([id, [name, icon]]) => `<li><a href="${id}.html">${icon} ${name}</a><span>${posts.filter(p => p.section === id).length}</span></li>`).join('')}</ul>`);
if (!idx.includes('rss+xml')) idx = idx.replace('<!-- Google Analytics -->', `<link rel="alternate" type="application/rss+xml" title="현장노트" href="${BASE}feed.xml">\n<!-- Google Analytics -->`);
write('index.html', idx);

// 3) 글: JSON-LD + 검색 색인
const index = {};
for (const p of posts) {
  const fp = path.join(ROOT, 'posts', p.file);
  if (!fs.existsSync(fp)) continue;
  let html = fs.readFileSync(fp, 'utf8');
  const body = (html.split('<div class="wrap">')[1] || '').split('<div class="author">')[0];
  const text = body.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
  index[p.file] = text.slice(0, 4000);

  const [name] = SECTIONS[p.section] || [''];
  const image = (html.match(/og:image" content="([^"]+)"/) || [])[1] || `${BASE}assets/og-image.png`;
  const faqs = [...body.matchAll(/<details class="faq">\s*<summary>([^<]+)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g)]
    .map(m => ({ '@type': 'Question', name: m[1].trim(), acceptedAnswer: { '@type': 'Answer', text: m[2].replace(/<[^>]+>/g, '').trim() } }));
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: p.title, description: p.summary, image, datePublished: p.date, dateModified: p.date,
      author: { '@type': 'Person', name: '황제효도르', url: `${BASE}about.html` }, publisher: { '@type': 'Organization', name: '현장노트', logo: { '@type': 'ImageObject', url: `${BASE}assets/og-image.png` } },
      mainEntityOfPage: `${BASE}posts/${p.file}`, articleSection: name, inLanguage: 'ko', wordCount: text.length },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: '현장노트', item: BASE }, { '@type': 'ListItem', position: 2, name, item: `${BASE}${p.section}.html` }, { '@type': 'ListItem', position: 3, name: p.title }] },
  ];
  if (faqs.length) ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs });
  const tag = `<script type="application/ld+json" id="ld">${JSON.stringify(ld)}</script>`;
  html = html.includes('id="ld"') ? html.replace(/<script type="application\/ld\+json" id="ld">[\s\S]*?<\/script>/, tag) : html.replace('</head>', `${tag}\n</head>`);
  if (!html.includes('naver-site-verification')) html = html.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">', `$&\n${NAVER}`);
  if (!html.includes('adsbygoogle')) html = html.replace('</head>', `${ADS}\n</head>`);
  // 상단 메뉴를 섹션 페이지로
  html = html.replace(/<nav>[\s\S]*?<\/nav>/, `<nav>${Object.entries(SECTIONS).map(([id, [n]]) => `<a href="../${id}.html">${n}</a>`).join('')}</nav>`);
  fs.writeFileSync(fp, html);
}
write('search.json', JSON.stringify(index));

// 정적 페이지에도 네이버 인증 태그와 애드센스 코드
for (const f of ['index.html', 'about.html', 'contact.html', 'privacy.html', 'templates/post.html']) {
  let h = read(f);
  if (!h.includes('naver-site-verification')) h = h.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">', `$&\n${NAVER}`);
  if (!h.includes('adsbygoogle')) h = h.replace('</head>', `${ADS}\n</head>`);
  write(f, h);
}

// 4) sitemap / feed / robots
const pages = ['', 'about.html', 'contact.html', 'privacy.html', ...Object.keys(SECTIONS).map(s => `${s}.html`)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(u => `  <url><loc>${BASE}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
${posts.map(p => `  <url><loc>${BASE}posts/${p.file}</loc><lastmod>${p.date}</lastmod></url>`).join('\n')}
</urlset>
`);
write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>현장노트</title>
  <link>${BASE}</link>
  <description>현장에서 일하는 사람을 위한 실무 노트. 자격증, 산업안전, 사고사례 분석, 장비·공구, 산업 트렌드, 현장 생활.</description>
  <language>ko</language>
  <atom:link href="${BASE}feed.xml" rel="self" type="application/rss+xml"/>
${posts.slice(0, 30).map(p => `  <item>
    <title>${esc(p.title)}</title>
    <link>${BASE}posts/${p.file}</link>
    <guid>${BASE}posts/${p.file}</guid>
    <pubDate>${new Date(p.date + 'T03:00:00+09:00').toUTCString()}</pubDate>
    <category>${esc((SECTIONS[p.section] || [''])[0])}</category>
    <description>${esc(p.summary)}</description>
  </item>`).join('\n')}
</channel>
</rss>
`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${BASE}sitemap.xml\n`);
console.log(`빌드 완료: 글 ${posts.length}편, 섹션 페이지 ${Object.keys(SECTIONS).length}개, sitemap·feed·robots 갱신`);
