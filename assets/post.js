// 글 페이지 공통: 공유 버튼, 조회수, 이전/다음 글, 맨 위로
(async () => {
  const file = location.pathname.split('/').pop();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const url = location.href.split('#')[0], title = document.title.replace(' | 현장노트', '');

  // 공유 버튼
  const share = document.createElement('div');
  share.className = 'share';
  // 공유창은 휴대폰에서만 (PC 윈도우 공유창은 앱이 없으면 '다시 시도하세요'만 뜬다)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || matchMedia('(pointer:coarse)').matches;
  const canShare = !!navigator.share && isMobile;
  const shareOrCopy = (btn, done = '✅ 링크를 복사했어요') => canShare ? navigator.share({ title, url }).catch(() => {}) : navigator.clipboard.writeText(url).then(() => { const t = btn.textContent; btn.textContent = done; setTimeout(() => btn.textContent = t, 2500); });
  share.innerHTML = `<span>공유</span>
    ${canShare ? '<button type="button" id="nativeShare" class="kakao">💬 카카오톡·문자로 공유</button>' : ''}
    <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener" title="페이스북">f 페이스북</a>
    <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}" target="_blank" rel="noopener" title="X">𝕏</a>
    <button type="button" id="copyLink">🔗 링크 복사</button>`;
  // 글자 크기 · 저장(북마크)
  const LS = (k, v) => { try { return v === undefined ? JSON.parse(localStorage.getItem(k) || 'null') : localStorage.setItem(k, JSON.stringify(v)); } catch { return null; } };
  const saved = () => LS('saved') || [];
  const isSaved = () => saved().some(s => s.file === file);
  share.insertAdjacentHTML('beforeend', `<button type="button" id="save">${isSaved() ? '🔖 저장됨' : '🔖 저장'}</button><span class="fs"><button type="button" data-d="-1" title="글자 작게">가−</button><button type="button" data-d="1" title="글자 크게">가＋</button></span>`);
  document.querySelector('.wrap')?.prepend(share);
  const applyFs = n => { document.documentElement.style.setProperty('--fs', n + 'px'); document.body.classList.toggle('fs-custom', n !== 17); };
  let fs = LS('fs') || 17; applyFs(fs);
  share.querySelectorAll('.fs button').forEach(b => b.onclick = () => { fs = Math.min(22, Math.max(14, fs + +b.dataset.d)); LS('fs', fs); applyFs(fs); });
  document.getElementById('save').onclick = e => {
    const list = saved().filter(s => s.file !== file);
    if (!isSaved()) list.unshift({ file, title, at: Date.now() });
    LS('saved', list.slice(0, 50)); e.target.textContent = isSaved() ? '🔖 저장됨' : '🔖 저장';
  };
  // 최근 본 글
  LS('recent', [{ file, title, at: Date.now() }, ...(LS('recent') || []).filter(r => r.file !== file)].slice(0, 20));
  // 읽기 진행 바
  const bar = document.createElement('div'); bar.className = 'progress'; document.body.prepend(bar);
  const art = document.querySelector('article');
  addEventListener('scroll', () => { const h = art ? art.offsetTop + art.offsetHeight - innerHeight : document.body.scrollHeight - innerHeight; bar.style.width = Math.min(100, Math.max(0, scrollY / h * 100)) + '%'; }, { passive: true });
  // 모바일 하단 바
  const bb = document.createElement('nav'); bb.className = 'bottombar';
  bb.innerHTML = `<a href="../index.html">🏠<small>홈</small></a><a href="../index.html#q">🔍<small>검색</small></a><a href="../index.html#tools">🧰<small>도구</small></a><button type="button" id="bbShare">📤<small>공유</small></button>`;
  document.body.appendChild(bb);
  document.getElementById('bbShare').onclick = e => shareOrCopy(e.currentTarget);
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

  // 도움이 됐어요 👍 (GA 이벤트로 집계 → 다음 날 숫자 표시) + 이웃추가·구독 묶음
  const helpful = stats?.helpful?.['posts/' + file] || 0, voted = (LS('helpful') || []).includes(file);
  const box = document.createElement('div'); box.className = 'helpful';
  box.innerHTML = `<div class="hq"><b>이 글이 도움이 됐나요?</b><button type="button" id="up" ${voted ? 'disabled' : ''}>👍 도움됐어요${helpful ? ` · ${helpful}명` : ''}</button><a href="../contact.html">✏️ 틀린 내용 알려주기</a></div>
    <div class="follow"><span>새 글 받아보기</span><a href="https://blog.naver.com/fedor0725" target="_blank" rel="noopener">N 네이버 블로그 이웃추가</a><a href="../feed.xml">RSS</a><button type="button" id="followShare">${canShare ? '💬 카톡으로 보내기' : '🔗 링크 복사해서 보내기'}</button></div>`;
  const author0 = document.querySelector('.author'); author0 ? author0.before(box) : document.querySelector('.wrap')?.append(box);
  document.getElementById('up').onclick = e => { try { gtag('event', 'helpful', { page_path: location.pathname }); } catch {} LS('helpful', [...(LS('helpful') || []), file]); e.target.disabled = true; e.target.textContent = '👍 고마워요!'; };
  document.getElementById('followShare').onclick = e => shareOrCopy(e.currentTarget);

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
