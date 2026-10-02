// posts/*.html 본문 텍스트를 뽑아 search.json으로 저장한다 (검색용).
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'posts'), out = {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  const body = (html.split('<div class="wrap">')[1] || '').split('<div class="author">')[0];
  out[f] = body.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
}
fs.writeFileSync(path.join(__dirname, '..', 'search.json'), JSON.stringify(out));
console.log('검색 색인:', Object.keys(out).length, '개 글');
