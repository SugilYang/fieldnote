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
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/webmasters.readonly',
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
  try { stats.search = await searchConsole(tok); console.log(`검색: 노출 ${stats.search.impressions}, 클릭 ${stats.search.clicks}`); } catch (e) { console.log('Search Console 건너뜀:', e.message.slice(0, 120)); }
  fs.writeFileSync(__dirname + '/../stats.json', JSON.stringify(stats, null, 2) + '\n');
  console.log(`통계 저장: 어제 ${stats.yesterday}, 전체 ${stats.total}, 글 ${Object.keys(stats.pages).length}개`);
})().catch(e => { console.error(e.message); process.exit(0); }); // 통계 실패가 배포를 막지 않게
