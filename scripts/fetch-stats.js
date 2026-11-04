// GA4 Data API에서 방문자 수와 글별 조회수를 받아 stats.json으로 저장한다.
// 시크릿 GA_SERVICE_ACCOUNT(서비스 계정 JSON), GA_PROPERTY_ID(속성 ID 숫자)가 없으면 건너뛴다.
const fs = require('fs');
const crypto = require('crypto');

const SA = process.env.GA_SERVICE_ACCOUNT, PROP = process.env.GA_PROPERTY_ID || '556486591';
if (!SA || !PROP) { console.log('GA 시크릿 없음 — 통계 건너뜀'); process.exit(0); }
const sa = JSON.parse(SA);
const START = '2026-09-29'; // 블로그 개설일

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
async function token() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const sig = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${unsigned}.${sig}` });
  if (!r.ok) throw new Error('토큰 실패 ' + r.status + ' ' + await r.text());
  return (await r.json()).access_token;
}

async function report(tok, body) {
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${PROP}:runReport`, {
    method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('리포트 실패 ' + r.status + ' ' + await r.text());
  return (await r.json()).rows || [];
}

async function searchConsole(tok) {
  const end = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10); // SC는 2~3일 지연
  const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const q = async body => {
    const r = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Aynote.co.kr/searchAnalytics/query', {
      method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ startDate: start, endDate: end, ...body }) });
    if (!r.ok) throw new Error('Search Console ' + r.status + ' ' + await r.text());
    return (await r.json()).rows || [];
  };
  const [total, queries, pages] = await Promise.all([
    q({}), q({ dimensions: ['query'], rowLimit: 20 }), q({ dimensions: ['page'], rowLimit: 20 })]);
  return { period: `${start}~${end}`, clicks: total[0]?.clicks || 0, impressions: total[0]?.impressions || 0,
    queries: queries.map(r => ({ q: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: +r.position.toFixed(1) })),
    pages: pages.map(r => ({ page: r.keys[0].replace(/^https?:\/\/[^/]+\//, ''), clicks: r.clicks, impressions: r.impressions })) };
}

// 색인 추적: URL 검사 API로 글마다 구글 색인 상태를 기록한다 (하루 60개씩 순환, 신규 글 우선).
// stats.index[file] = { status, crawled(마지막 크롤), indexedOn(처음 '색인됨'으로 확인된 날), checked }
async function trackIndex(tok, prev) {
  const posts = JSON.parse(fs.readFileSync(__dirname + '/../posts.json', 'utf8')).sort((a, b) => b.date.localeCompare(a.date));
  const base = fs.existsSync(__dirname + '/../CNAME') ? `https://${fs.readFileSync(__dirname + '/../CNAME', 'utf8').trim()}/` : '';
  const index = prev || {}, today = new Date().toISOString().slice(0, 10);
  const pages = ['', ...['license', 'safety', 'case', 'tools', 'trend', 'life', 'guide'].map(s => s + '.html'), ...['shift', 'injury-rate', 'convert', 'dday'].map(a => `apps/${a}.html`)];
  // 아직 색인 안 된 것 중 가장 오래전에 확인한 순서로 60개 (색인된 글은 2주에 한 번만 재확인)
  const targets = [...pages, ...posts.map(p => 'posts/' + p.file)]
    .filter(u => !index[u] || index[u].status !== 'INDEXED' || (Date.now() - new Date(index[u].checked)) > 14 * 86400000)
    .sort((a, b) => (index[a]?.checked || '').localeCompare(index[b]?.checked || '')).slice(0, 60);
  let n = 0;
  for (const u of targets) {
    const r = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionUrl: base + u, siteUrl: 'sc-domain:ynote.co.kr' }) });
    if (!r.ok) { console.log('URL 검사 중단:', r.status, (await r.text()).slice(0, 120)); break; }
    const s = (await r.json()).inspectionResult?.indexStatusResult || {};
    const indexed = s.verdict === 'PASS' && /indexed/i.test(s.coverageState || '') && !/not indexed/i.test(s.coverageState || '');
    index[u] = { status: indexed ? 'INDEXED' : (s.coverageState || s.verdict || 'UNKNOWN'), crawled: (s.lastCrawlTime || '').slice(0, 10), indexedOn: index[u]?.indexedOn || (indexed ? today : ''), checked: today };
    n++;
  }
  // 요약: 글 발행일 기준 색인까지 걸린 날수 (신규 글 vs 기존 글 비교용)
  const byDate = {};
  for (const p of posts) { const i = index['posts/' + p.file]; if (!i) continue; const k = p.date >= '2026-11-04' ? 'new' : 'old'; byDate[k] = byDate[k] || { total: 0, indexed: 0, days: [] }; byDate[k].total++; if (i.status === 'INDEXED') { byDate[k].indexed++; byDate[k].days.push((new Date(i.indexedOn) - new Date(p.date)) / 86400000); } }
  const summary = Object.fromEntries(Object.entries(byDate).map(([k, v]) => [k, { total: v.total, indexed: v.indexed, avgDays: v.days.length ? +(v.days.reduce((a, b) => a + b) / v.days.length).toFixed(1) : null }]));
  console.log(`색인 추적: ${n}개 검사, 색인됨 ${Object.values(index).filter(i => i.status === 'INDEXED').length}/${Object.keys(index).length}`, JSON.stringify(summary));
  return { index, summary };
}

(async () => {
  const tok = await token();
  const [yday, total, pages] = await Promise.all([
    report(tok, { dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }], metrics: [{ name: 'activeUsers' }] }),
    report(tok, { dateRanges: [{ startDate: START, endDate: 'today' }], metrics: [{ name: 'activeUsers' }] }),
    report(tok, { dateRanges: [{ startDate: START, endDate: 'today' }], dimensions: [{ name: 'pagePath' }],
      metrics: [{ name: 'screenPageViews' }], dimensionFilter: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: '/posts/' } } }, limit: 1000 }),
  ]);
  const stats = {
    updated: new Date().toISOString().slice(0, 10),
    yesterday: +(yday[0]?.metricValues[0].value || 0),
    total: +(total[0]?.metricValues[0].value || 0),
    pages: Object.fromEntries(pages.map(r => [r.dimensionValues[0].value.replace(/^\/fieldnote\//, '').replace(/^\//, ''), +r.metricValues[0].value])),
  };
  // 어제 방문자 상세: 유입 경로·국가·기기·페이지 (방문자 분석용)
  try {
    const dim = async (name, metric = 'activeUsers') => (await report(tok, { dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }], dimensions: [{ name }], metrics: [{ name: metric }], limit: 15 }))
      .map(r => [r.dimensionValues[0].value, +r.metricValues[0].value]);
    stats.yesterdayDetail = { source: await dim('sessionSourceMedium'), country: await dim('country'), city: await dim('city'), device: await dim('deviceCategory'), pages: await dim('pagePath', 'screenPageViews') };
  } catch (e) { console.log('상세 건너뜀:', e.message.slice(0, 100)); }
  try { stats.search = await searchConsole(tok); console.log(`검색: 노출 ${stats.search.impressions}, 클릭 ${stats.search.clicks}`); } catch (e) {
    console.log('Search Console 건너뜀:', e.message.slice(0, 120));
    try { const prev = JSON.parse(fs.readFileSync(__dirname + '/../stats.json', 'utf8')).search; if (prev) stats.search = prev; } catch {}
  }
  try { const prevIdx = JSON.parse(fs.readFileSync(__dirname + '/../stats.json', 'utf8')); const t = await trackIndex(tok, prevIdx.index); stats.index = t.index; stats.indexSummary = t.summary; } catch (e) { console.log('색인 추적 건너뜀:', e.message.slice(0, 120)); try { const prev = JSON.parse(fs.readFileSync(__dirname + '/../stats.json', 'utf8')); if (prev.index) { stats.index = prev.index; stats.indexSummary = prev.indexSummary; } } catch {} }
  fs.writeFileSync(__dirname + '/../stats.json', JSON.stringify(stats, null, 2) + '\n');
  console.log(`통계 저장: 어제 ${stats.yesterday}, 전체 ${stats.total}, 글 ${Object.keys(stats.pages).length}개`);
})().catch(e => { console.error(e.message); process.exit(0); }); // 통계 실패가 배포를 막지 않게
