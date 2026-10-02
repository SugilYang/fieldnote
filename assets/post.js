// 글 페이지 공통: 공유 버튼, 조회수, 이전/다음 글, 맨 위로
(async () => {
  const file = location.pathname.split('/').pop();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const url = location.href.split('#')[0], title = document.title.replace(' | 현장노트', '');

  // 공유 버튼
  const share = document.createElement('div');
  share.className = 'share';
  const canShare = !!navigator.share;
  share.innerHTML = `<span>공유</span>
    ${canShare ? '<button type="button" id="nativeShare" class="kakao">💬 카카오톡·문자로 공유</button>' : ''}
    <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener" title="페이스북">f 페이스북</a>
    <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}" target="_blank" rel="noopener" title="X">𝕏</a>
    <button type="button" id="copyLink">🔗 링크 복사</button>`;
  document.querySelector('.wrap')?.prepend(share);
  if (canShare) document.getElementById('nativeShare').onclick = () => navigator.share({ title, url }).catch(() => {});
  document.getElementById('copyLink').onclick = async e => {
    try { await navigator.clipboard.writeText(url); e.target.textContent = '✔ 복사됨 — 카카오톡에 붙여넣기'; setTimeout(() => e.target.textContent = '🔗 링크 복사', 2500); } catch {}
  };

  // 맨 위로
  const top = document.createElement('a'); top.className = 'top'; top.href = '#'; top.textContent = '↑';
  top.onclick = e => { e.preventDefault(); scrollTo({top: 0, behavior: 'smooth'}); };
  document.body.appendChild(top);
  addEventListener('scroll', () => top.classList.toggle('show', scrollY > 400));

  // 목록·통계
  const [posts, stats] = await Promise.all([
    fetch('../posts.json').then(r => r.json()).catch(() => []),
    fetch('../stats.json').then(r => r.ok ? r.json() : null).catch(() => null),
  ]);
  const views = stats?.pages?.['posts/' + file];
  if (views) document.querySelector('.meta')?.append(` · 조회 ${views.toLocaleString()}`);

  posts.sort((a, b) => b.date.localeCompare(a.date));
  const i = posts.findIndex(p => p.file === file);
  if (i < 0) return;
  const next = posts[i - 1], prev = posts[i + 1];
  const nav = document.createElement('div');
  nav.className = 'prevnext';
  nav.innerHTML = (next ? `<a href="${esc(next.file)}" class="n"><small>다음 글 ▶</small>${esc(next.title)}</a>` : '<span></span>')
    + (prev ? `<a href="${esc(prev.file)}" class="p"><small>◀ 이전 글</small>${esc(prev.title)}</a>` : '<span></span>');
  const author = document.querySelector('.author');
  author ? author.before(nav) : document.querySelector('.wrap')?.append(nav);
})();
