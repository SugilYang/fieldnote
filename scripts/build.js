// 배포 때마다 실행: 검색엔진용 정적 산출물을 만든다.
//  - 섹션 페이지 6개 (license.html …), 메인 페이지의 정적 카드, sitemap.xml, feed.xml, robots.txt
//  - 글마다 JSON-LD(Article·BreadcrumbList·FAQPage) 삽입, 검색 색인 search.json
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const BASE = fs.existsSync(path.join(ROOT, 'CNAME')) ? `https://${fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim()}/` : 'https://field.ynote.co.kr/';
const SECTIONS = { license: ['자격증', '📜', '국가기술자격증·면허 취득 방법, 시험 구성, 공부법'], safety: ['산업안전', '🦺', '법정 안전교육, 위험성평가, 보호구, 작업별 안전수칙'], case: ['사고사례 분석', '🚨', '산업재해 유형별 원인과 예방 대책'], tools: ['장비·공구', '🔧', '공구·측정기·설비 사용법과 고르는 기준'], trend: ['산업 트렌드', '🔋', '2차전지·반도체·자동화·물류 산업의 흐름'], life: ['현장 생활', '💼', '교대근무 건강관리, 작업복 관리, 현장 직장인 생활 팁'], guide: ['산업안전지도사', '📋', '산업안전지도사 시험 과목별 정보, 응시자격, 일정, 공부법'] };
const NAVER = '<meta name="naver-site-verification" content="c254b450f730ddc6064c4494834efa93d383bd94">';
const ADS = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9274785237746410" crossorigin="anonymous"></script>';
// 디자인 파일이 바뀌면 주소 뒤 ?v=가 바뀌어 휴대폰 캐시에 남은 옛 파일 대신 새 파일을 받는다
const CSSV = require('crypto').createHash('md5').update(fs.readFileSync(path.join(ROOT, 'assets/style.css'))).digest('hex').slice(0, 8);
const ver = h => h.replace(/assets\/style\.css(\?v=\w+)?"/g, `assets/style.css?v=${CSSV}"`);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);

// 쿠팡파트너스 상품: 글 본문에 키워드가 있으면 관련 상품 카드를 최대 2개 넣는다 (법정 고지 문구 포함)
const products = fs.existsSync(path.join(ROOT, 'products.json')) ? JSON.parse(read('products.json')) : [];
const DISCLOSE = '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
function productBlock(p, text) {
  if (p.section === 'trend' || p.section === 'case') return '';
  // 제목에 키워드가 있거나 본문에 3번 이상 나올 때만 (스치듯 언급한 글에는 넣지 않는다)
  const cnt = (s, k) => (s.match(new RegExp(k, 'g')) || []).length;
  const hits = products.map(x => ({ x, t: x.keywords.some(k => cnt(p.title, k)), n: x.keywords.reduce((s, k) => s + cnt(text, k), 0) }))
    .filter(h => h.t || h.n >= 3).sort((a, b) => (b.t - a.t) || (b.n - a.n)).slice(0, 2);
  if (!hits.length) return '';
  return `<!--products--><div class="products"><b>🛒 관련 상품</b><div class="plist">${hits.map(({ x }) => `<a href="${x.url}" target="_blank" rel="nofollow sponsored noopener"><img src="${x.image}" alt="${esc(x.name)}" width="120" height="240" loading="lazy"><span><b>${esc(x.short)}</b><em>${esc(x.name)}</em><small>쿠팡에서 가격 보기 →</small></span></a>`).join('')}</div><p>${DISCLOSE}</p></div><!--/products-->`;
}
const posts = JSON.parse(read('posts.json')).sort((a, b) => b.date.localeCompare(a.date));
const stats = fs.existsSync(path.join(ROOT, 'stats.json')) ? JSON.parse(read('stats.json')) : null;
const today = new Date().toISOString().slice(0, 10);

const card = (p, big) => {
  const [name, icon] = SECTIONS[p.section] || ['', ''];
  const views = stats?.pages?.['posts/' + p.file];
  return `<a class="card c-${p.section}${big ? ' big' : ''}" href="posts/${esc(p.file)}"><div class="hero-box">${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : icon}</div>
    <div class="t"><small>${name} · ${p.date}${views ? ` · 조회 ${views.toLocaleString()}` : ''}</small><b>${esc(p.title)}</b><p>${esc(p.summary)}</p></div></a>`;
};
const head = (title, desc, url) => ver(`<meta charset="UTF-8">
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
<link rel="stylesheet" href="assets/style.css">`);
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
  // 상품 카드: 기존 블록은 교체, 없으면 FAQ 앞에 삽입
  html = html.replace(/\s*<!--products-->[\s\S]*?<!--\/products-->/, '');
  const pb = productBlock(p, p.title + ' ' + text);
  const anchor = ['<h2>자주 묻는 질문</h2>', '<h2>함께 보면 좋은 글</h2>', '<p class="note">'].find(a => html.includes(a));
  if (pb && anchor) html = html.replace(anchor, `${pb}\n\n    ${anchor}`);
  html = html.includes('id="ld"') ? html.replace(/<script type="application\/ld\+json" id="ld">[\s\S]*?<\/script>/, tag) : html.replace('</head>', `${tag}\n</head>`);
  if (!html.includes('naver-site-verification')) html = html.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">', `$&\n${NAVER}`);
  // 구글이 읽고 색인하지 않은 글 중 노출·조회가 없는 글은 검색엔진 평가에서 제외(noindex). 방문자에게는 그대로 보인다. 보강 후 posts.json에서 noindex를 지우면 다시 열린다.
  html = html.replace(/\n<meta name="robots" content="noindex,follow">/, '');
  if (p.noindex) html = html.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">', `$&\n<meta name="robots" content="noindex,follow">`);
  if (!html.includes('adsbygoogle')) html = html.replace('</head>', `${ADS}\n</head>`);
  // 저자 상자에 작성·검토 기준 명시
  html = html.replace(/<div class="author"><div class="av">효<\/div><div>[\s\S]*?<\/div><\/div>/, '<div class="author"><div class="av">효</div><div><b>황제효도르</b> · 현장노트 운영자<br>제조 현장에서 일하며 배운 것을 정리해요. 법령·기준·수치는 법제처, 안전보건공단, 큐넷, 제조사 자료를 확인해 쓰고, 바뀌는 기준은 기준 연도를 밝혀요. 틀린 내용은 <a href="../contact.html">문의</a>로 알려주시면 바로 고쳐요.</div></div>');
  // 상단 메뉴를 섹션 페이지로
  html = html.replace(/<nav>[\s\S]*?<\/nav>/, `<nav>${Object.entries(SECTIONS).map(([id, [n]]) => `<a href="../${id}.html">${n}</a>`).join('')}</nav>`);
  fs.writeFileSync(fp, ver(html));
}
write('search.json', JSON.stringify(index));

// 정적 페이지에도 네이버 인증 태그와 애드센스 코드, 디자인 파일 버전
for (const f of ['index.html', 'about.html', 'contact.html', 'privacy.html', 'templates/post.html', 'apps/shift.html', 'apps/injury-rate.html', 'apps/convert.html', 'apps/dday.html']) {
  let h = read(f);
  if (!h.includes('naver-site-verification')) h = h.replace('<meta name="viewport" content="width=device-width, initial-scale=1.0">', `$&\n${NAVER}`);
  if (!h.includes('adsbygoogle')) h = h.replace('</head>', `${ADS}\n</head>`);
  write(f, ver(h));
}

// 3-1) 네이버 블로그 붙여넣기용 페이지: naver/날짜.txt → naver/날짜.html (전체 선택·복사하면 문단·링크·사진이 그대로 들어간다)
const nvDir = path.join(ROOT, 'naver');
if (fs.existsSync(nvDir)) for (const f of fs.readdirSync(nvDir).filter(f => /^\d{4}-\d{2}-\d{2}\.txt$/.test(f))) {
  const t = fs.readFileSync(path.join(nvDir, f), 'utf8');
  const title = (t.match(/\[제목\]\s*(.+)/) || [, ''])[1].trim();
  const body = ((t.split('[본문]')[1] || '').split('[태그]')[0]).trim();
  const tags = (t.match(/\[태그\]\s*(.+)/) || [, ''])[1].trim();
  const postFile = (body.match(/posts\/([\w-]+\.html)/) || [])[1];
  const post = postFile && posts.find(p => p.file === postFile);
  const jpg = u => u ? u.replace(/&auto=format/, '') + '&fm=jpg' : '';
  const img = post && post.image ? jpg(post.image.replace('w=600&q=70', 'w=1200&q=80')) : '';
  const NCAT = { license: '자격증', safety: '산업안전', case: '산업안전', tools: '장비·공구', trend: '현장 생활', life: '현장 생활', guide: '산업안전지도사' };
  const cat = post ? NCAT[post.section] || '현장 생활' : '현장 생활';
  const tagList = tags.replace(/#/g, ' ').trim().split(/[\s,]+/).filter(Boolean).slice(0, 6);
  // 문단마다 빈 줄을 끼워 넣는다: 네이버 편집기에 붙여넣어도 문단 간격이 그대로 남는다. 링크 줄은 각각 한 문단.
  const lines = body.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean)
    .flatMap(s => /https?:\/\//.test(s) || /^■/m.test(s) ? s.split('\n').map(x => x.trim()).filter(Boolean) : [s]);
  // 본문 사진: 현장노트 글의 본문 사진 1장을 중간(두 번째 소제목 앞)에 넣는다
  const postHtml = post && fs.existsSync(path.join(ROOT, 'posts', post.file)) ? fs.readFileSync(path.join(ROOT, 'posts', post.file), 'utf8') : '';
  const midImg = jpg((postHtml.match(/<figure><img src="([^"]+)"/) || [])[1] || '');
  let headCount = 0;
  const paras = lines.map(s => {
    if (/^■\s*/.test(s)) { headCount++; const h = `<p><b>■ ${esc(s.replace(/^■\s*/, ''))}</b></p>`; return headCount === 2 && midImg ? `<p>📷 [사진 2 자리 — 이 줄 지우고 사진 넣기]</p>\n<p>&nbsp;</p>\n${h}` : h; }
    return '<p>' + esc(s).replace(/\n/g, ' ').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>') + '</p>';
  }).join('\n<p>&nbsp;</p>\n');
  // 소제목이 없는 날(경험담형)은 세 번째 문단 뒤에 사진 2 자리를 둔다
  let paras1 = paras;
  if (midImg && !paras.includes('사진 2 자리')) { const parts = paras.split('\n<p>&nbsp;</p>\n'); if (parts.length > 4) { parts.splice(3, 0, '<p>📷 [사진 2 자리 — 이 줄 지우고 사진 넣기]</p>'); paras1 = parts.join('\n<p>&nbsp;</p>\n'); } }
  const paras2 = (img ? '<p>📷 [사진 1 자리 — 이 줄 지우고 사진 넣기]</p>\n<p>&nbsp;</p>\n' : '') + paras1;
  write(`naver/${f.replace('.txt', '.html')}`, `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex,nofollow">
<title>네이버 붙여넣기용 ${esc(title)}</title>
<style>body{font-family:sans-serif;max-width:720px;margin:24px auto;padding:0 16px;line-height:1.8;font-size:16px}.how{background:#fff5e0;border-radius:10px;padding:12px 16px;font-size:14px;margin-bottom:20px}.copy{border:2px dashed #999;border-radius:10px;padding:16px}.copy img{max-width:100%;height:auto;border-radius:8px}.tags{margin-top:20px;background:#eef4ff;border-radius:10px;padding:12px 16px;font-size:14px}</style></head>
<body>
<div class="how"><b>휴대폰 앱 기준 순서</b><br>① 아래 <b>사진을 길게 눌러 저장</b> (네이버에 직접 올려야 "사진 있는 글"로 인정돼요)<br>② 점선 상자 안 글 전체 선택 → 복사<br>③ 네이버 앱 글쓰기 → 붙여넣기 → 본문 맨 앞 누르고 <b>📷 아이콘 → 저장한 사진 첨부</b><br>④ 제목 입력 → 등록 → 카테고리·태그(한 줄씩 입력 후 Enter) → 발행</div>
<p><b>제목:</b> ${esc(title)}</p>
<p><b>카테고리:</b> ${cat}</p>
${img ? `<p><b>① 저장할 사진</b> (각각 길게 눌러 저장 — JPG로 저장돼요)</p><p><b>사진 1</b> (글 맨 위)</p><p><img src="${img}" alt="${esc(title)}" style="max-width:100%;border-radius:8px"></p>` : ''}
${midImg ? `<p><b>사진 2</b> (두 번째 소제목 앞)</p><p><img src="${midImg}" alt="" style="max-width:100%;border-radius:8px"></p>` : ''}
<p><b>② 복사할 글</b> — 붙여넣은 뒤 📷 표시 줄을 지우고 그 자리에 사진을 넣으세요. 사진 1은 첫 번째 사진, 사진 2는 두 번째 사진이에요.</p>
<div class="copy">
${paras2}
</div>
<div class="tags"><b>태그</b> (한 줄씩 복사 → 붙여넣기 → Enter)<br>${tagList.map(t => `<div style="padding:4px 0;font-size:16px">${esc(t)}</div>`).join('')}</div>
</body></html>
`);
}

// 4) sitemap / feed / robots
// lastmod: 실제로 바뀐 날만 적는다 (매일 오늘 날짜로 갱신하면 신호로서 의미가 없다)
const gitDate = f => { try { return require('child_process').execSync(`git log -1 --format=%cs -- "${f}"`, { cwd: ROOT }).toString().trim() || today; } catch { return today; } };
const pages = [['', posts[0].date], ...['about.html', 'contact.html', 'privacy.html', 'apps/shift.html', 'apps/injury-rate.html', 'apps/convert.html', 'apps/dday.html'].map(f => [f, gitDate(f)]),
  ...Object.keys(SECTIONS).map(s => [`${s}.html`, (posts.find(p => p.section === s) || { date: today }).date])];
// 사이트맵 인덱스: 글 사이트맵(매일 갱신)과 페이지 사이트맵을 나눠 구글이 변경을 알아채기 쉽게 한다
const urlset = items => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items.map(([u, d]) => `  <url><loc>${u}</loc><lastmod>${d}</lastmod></url>`).join('\n')}
</urlset>
`;
write('sitemap-posts.xml', urlset(posts.filter(p => !p.noindex).map(p => [`${BASE}posts/${p.file}`, p.updated || p.date])));
write('sitemap-pages.xml', urlset(pages.map(([u, d]) => [`${BASE}${u}`, d])));
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${BASE}sitemap-posts.xml</loc><lastmod>${posts.reduce((m, p) => (p.updated || p.date) > m ? (p.updated || p.date) : m, '')}</lastmod></sitemap>
  <sitemap><loc>${BASE}sitemap-pages.xml</loc><lastmod>${pages.reduce((m, [, d]) => d > m ? d : m, '')}</lastmod></sitemap>
</sitemapindex>
`);
write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>현장노트</title>
  <link>${BASE}</link>
  <description>현장에서 일하는 사람을 위한 실무 노트. 자격증, 산업안전, 사고사례 분석, 장비·공구, 산업 트렌드, 현장 생활.</description>
  <language>ko</language>
  <atom:link href="${BASE}feed.xml" rel="self" type="application/rss+xml"/>
${posts.filter(p => !p.noindex).slice(0, 30).map(p => `  <item>
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
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: /naver/\nSitemap: ${BASE}sitemap.xml\n`);
console.log(`빌드 완료: 글 ${posts.length}편, 섹션 페이지 ${Object.keys(SECTIONS).length}개, sitemap·feed·robots 갱신`);
