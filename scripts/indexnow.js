// 새로 올라온 글 주소를 IndexNow(네이버·빙 등)에 알린다. 실패해도 배포는 막지 않는다.
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const BASE = fs.existsSync(path.join(ROOT, 'CNAME')) ? `https://${fs.readFileSync(path.join(ROOT, 'CNAME'), 'utf8').trim()}/` : 'https://field.ynote.co.kr/';
const host = new URL(BASE).host;
const KEY = fs.readFileSync(path.join(ROOT, 'indexnow-key.txt'), 'utf8').trim();

let changed = [];
try { changed = execSync('git diff --name-only HEAD~1 HEAD', { cwd: ROOT }).toString().split('\n').filter(f => f.startsWith('posts/') && f.endsWith('.html')); } catch {}
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'posts.json'), 'utf8')).sort((a, b) => b.date.localeCompare(a.date));
const files = changed.length ? changed.map(f => f.replace('posts/', '')) : posts.slice(0, 6).map(p => p.file);
const urlList = [BASE, ...files.map(f => `${BASE}posts/${f}`)];

fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key: KEY, keyLocation: `${BASE}${KEY}.txt`, urlList }) })
  .then(r => console.log(`IndexNow ${r.status}: ${urlList.length}개 주소 통보`))
  .catch(e => console.log('IndexNow 실패:', e.message));
