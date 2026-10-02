// GA4 Data API에서 방문자 수와 글별 조회수를 받아 stats.json으로 저장한다.
// 시크릿 GA_SERVICE_ACCOUNT(서비스 계정 JSON), GA_PROPERTY_ID(속성 ID 숫자)가 없으면 건너뛴다.
const fs = require('fs');
const crypto = require('crypto');

const SA = process.env.GA_SERVICE_ACCOUNT, PROP = process.env.GA_PROPERTY_ID;
if (!SA || !PROP) { console.log('GA 시크릿 없음 — 통계 건너뜀'); process.exit(0); }
const sa = JSON.parse(SA);
const START = '2026-09-29'; // 블로그 개설일

const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
async function token() {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly',
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
  fs.writeFileSync(__dirname + '/../stats.json', JSON.stringify(stats, null, 2) + '\n');
  console.log(`통계 저장: 어제 ${stats.yesterday}, 전체 ${stats.total}, 글 ${Object.keys(stats.pages).length}개`);
})().catch(e => { console.error(e.message); process.exit(0); }); // 통계 실패가 배포를 막지 않게
