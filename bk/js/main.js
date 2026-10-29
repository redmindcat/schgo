  const siteNav = document.getElementById('siteNav');
  let currentSectionId = 'main';
  let suppressMascot = false;
  let pendingMascotTargetId = null;
  // True whenever any part of the hero/main section is still on screen.
  // Domain sections are the same height as the viewport and sit immediately
  // after main, so a domain section can reach the scrollspy's middle band
  // (see `observer` below) while main is still up to ~50% visible. Gating
  // the mascot's appearance on this flag prevents it from popping up early,
  // while main is still substantially in view.
  let mainVisible = true;
  const mascotObjBySection = {
    physics: 'images/br_cat_obj_1.png',
    chemistry: 'images/br_cat_obj_2.png',
    biology: 'images/br_cat_obj_3.png',
    earth: 'images/br_cat_obj_4.png',
  };

  // Replays the pop-in scale animation on the mascot object icon.
  function playMascotObjPop(imgEl){
    const wrap = imgEl && imgEl.parentElement;
    if(!wrap || !wrap.classList.contains('mascot-obj-wrap')) return;
    wrap.classList.remove('pop-in');
    void wrap.offsetWidth;
    wrap.classList.add('pop-in');
  }

  // Sets the mascot object icon and plays the pop-in motion, but only once
  // per actual appearance. Several independent code paths (nav-link click,
  // scrollspy observer, main-hide observer) can all fire for the same
  // section change within the same transition, so without this guard the
  // motion would replay 2-3x back to back. It only replays when the icon is
  // newly appearing (section-mascot wasn't already visible) or when the
  // icon image itself is actually changing to a different section's icon.
  function setMascotObj(imgEl, sectionMascotEl, src){
    if(!imgEl || !src) return;
    const wasVisible = !!(sectionMascotEl && sectionMascotEl.classList.contains('visible'));
    const changed = imgEl.getAttribute('src') !== src;
    imgEl.src = src;
    if(!wasVisible || changed) playMascotObjPop(imgEl);
  }

  // Anchor / CTA smooth-scroll with fixed-nav offset (registered first, isolated from other features)
  try {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href').slice(1);
        const target = document.getElementById(targetId);
        if(target){
          e.preventDefault();
          const sectionMascot = document.getElementById('sectionMascot');
          const mascotObj = document.getElementById('mascotObj');
          const topBtn = document.getElementById('topBtn');
          if(targetId === 'main'){
            suppressMascot = true;
            pendingMascotTargetId = 'main';
            mainVisible = true;
            if(sectionMascot) sectionMascot.classList.remove('visible');
            if(topBtn) topBtn.classList.remove('visible');
          } else if(mascotObjBySection[targetId]){
            suppressMascot = true;
            pendingMascotTargetId = targetId;
            mainVisible = false;
            setMascotObj(mascotObj, sectionMascot, mascotObjBySection[targetId]);
            if(sectionMascot) sectionMascot.classList.add('visible');
            if(topBtn) topBtn.classList.add('visible');
          }
          const targetTop = target.getBoundingClientRect().top + window.pageYOffset;
          window.scrollTo({ top: targetTop, behavior: 'smooth' });
          if(targetId === 'main' || mascotObjBySection[targetId]){
            setTimeout(() => {
              if(pendingMascotTargetId === targetId){
                suppressMascot = false;
                pendingMascotTargetId = null;
              }
            }, 1000);
          }
        }
      });
    });
  } catch(err) { console.error('anchor scroll setup failed', err); }

  // Hero background video sequence. Each video is paired 1:1 with its own
  // headline copy. Playback order is a shuffled queue of all videos (so the
  // first one is random, and the remaining ones play out one after another);
  // once the queue is exhausted it's reshuffled and the cycle repeats
  // forever. The headline fades out/in whenever it changes.
  //
  // Uses two stacked <video> elements (double buffering) instead of one.
  // The clips are different lengths/file sizes (schgo_m_new_4.mp4 in
  // particular is ~3x larger than the others), so swapping a single
  // element's .src mid-playback left a window where the browser was still
  // decoding the new clip and would briefly show a stale/leftover frame —
  // that's what caused the flash. Now the *next* clip is preloaded into the
  // hidden element well ahead of time, and switching is just an opacity
  // crossfade to an element that's already fully buffered and ready.
  try {
    const heroHeadlineEl = document.getElementById('heroHeadline');
    // Bumped on every animated headline swap so a stale in-flight swap (see
    // setHeroHeadlineFor below) can tell it's been superseded and no-op
    // instead of writing text out of order.
    let heroHeadlineGen = 0;
    const heroVideoCopy = {
      'videos/schgo_m_new_3.mp4': '과학은 원래,<br>궁금한 것에서 시작하니까.',
      'videos/schgo_m_new_4.mp4': '오늘은 슈고랑<br>어떤 실험을 해볼까요?',
      'videos/schgo_m_new_5.mp4': '과학을 만나는<br>가장 재미있는 방법.'
    };
    const heroVideoEls = [document.getElementById('heroBgVideoA'), document.getElementById('heroBgVideoB')];

    // avoidAt / landingIndex: when reshuffling for a new cycle, whichever
    // slot playback will actually land on next (index 0 when advancing
    // forward past the end, or the last index when stepping backward past
    // the start) could land on the same file that was just playing — pass
    // that file + slot here so it's excluded from that specific slot and the
    // same clip never plays twice back-to-back, in either direction.
    function shuffledVideoQueue(avoidAt, landingIndex){
      const files = Object.keys(heroVideoCopy);
      for(let i = files.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [files[i], files[j]] = [files[j], files[i]];
      }
      if(avoidAt && landingIndex !== undefined && files[landingIndex] === avoidAt && files.length > 1){
        const otherIndexes = files.map((_, idx) => idx).filter(idx => idx !== landingIndex);
        const swapWith = otherIndexes[Math.floor(Math.random() * otherIndexes.length)];
        [files[landingIndex], files[swapWith]] = [files[swapWith], files[landingIndex]];
      }
      return files;
    }

    // Same breakpoint as the CSS mobile media query (max-width:860px or
    // max-height:640px) — used to skip the headline fade on phones. Fading
    // still occasionally showed two overlapping headlines on iPhone Safari
    // even after waiting for 'transitionend' below, likely a mobile Safari
    // compositing quirk with rapid opacity + text changes under video-decode
    // load rather than a JS timing bug — so on mobile we sidestep it
    // entirely and just hard-swap the text instantly, no fade either way.
    function isMobileHeadline(){
      return window.matchMedia('(max-width:860px), (max-height:640px)').matches;
    }

    // Swaps the headline text. On desktop, fades the old copy out before
    // writing the new one in and fading it back in. On mobile it's an
    // instant swap (see isMobileHeadline above).
    //
    // Previously the fade used a fixed 350ms setTimeout matched to the CSS
    // opacity transition's duration to decide when the old text had finished
    // fading out. On a phone that's simultaneously decoding an 8s 1080p
    // video, the browser can drop enough frames that the *real* fade-out
    // hasn't visually finished by the time that timer fires — so the text
    // got swapped while the old copy was still partly rendered, and for a
    // moment two different headlines showed blended/overlapping on screen.
    // Waiting for the actual 'transitionend' event instead of a fixed delay
    // fixed most of it, but not all of it on iPhone Safari — hence skipping
    // the fade on mobile entirely instead of continuing to chase the timing.
    function setHeroHeadlineFor(file, animate){
      if(!heroHeadlineEl) return;
      const text = heroVideoCopy[file];
      if(!text) return;
      if(!animate || isMobileHeadline()){
        heroHeadlineEl.innerHTML = text;
        heroHeadlineEl.style.opacity = '1';
        return;
      }

      const myGen = ++heroHeadlineGen;
      function doSwap(){
        if(myGen !== heroHeadlineGen) return;
        heroHeadlineEl.innerHTML = text;
        requestAnimationFrame(() => {
          if(myGen !== heroHeadlineGen) return;
          heroHeadlineEl.style.opacity = '1';
        });
      }

      let settled = false;
      function onTransitionEnd(e){
        if(e.propertyName !== 'opacity') return;
        settled = true;
        heroHeadlineEl.removeEventListener('transitionend', onTransitionEnd);
        doSwap();
      }
      heroHeadlineEl.addEventListener('transitionend', onTransitionEnd);
      heroHeadlineEl.style.opacity = '0';

      // Backstop in case 'transitionend' never fires (e.g. opacity was
      // already 0, or the browser coalesces the transition away entirely) —
      // same 350ms window as before, just as a fallback rather than the
      // primary trigger.
      setTimeout(() => {
        if(settled) return;
        heroHeadlineEl.removeEventListener('transitionend', onTransitionEnd);
        doSwap();
      }, 400);
    }

    if(heroVideoEls[0] && heroVideoEls[1]){
      let heroVideoQueue = shuffledVideoQueue();
      let heroVideoPos = 0;
      let activeIdx = 0;
      // Guards against overlapping transitions — e.g. a prev/next click
      // landing right as the clip naturally ends, or a double-click — which
      // could otherwise race two crossfades against each other and touch
      // an element mid-fade (the same class of bug as above).
      let isTransitioning = false;

      // Figures out what the *next* slot in the queue will be without
      // mutating any real state yet — used to preload ahead of time.
      function peekNext(){
        const justPlayed = heroVideoQueue[heroVideoPos];
        let queue = heroVideoQueue;
        let pos = heroVideoPos + 1;
        if(pos >= queue.length){
          queue = shuffledVideoQueue(justPlayed, 0);
          pos = 0;
        }
        return { queue, pos };
      }

      // Loads the upcoming clip into the currently-hidden element and just
      // lets it buffer in the background — nothing is shown until it's
      // swapped in via crossfadeToStandby().
      function preloadStandby(){
        const standbyEl = heroVideoEls[1 - activeIdx];
        const peeked = peekNext();
        standbyEl.src = peeked.queue[peeked.pos];
        standbyEl.load();
        standbyEl._pendingQueue = peeked.queue;
        standbyEl._pendingPos = peeked.pos;
      }

      // Swaps the standby element (already preloaded) in as the visible,
      // playing one, and hides the old active element.
      //
      // This is a hard, instant cut — not a CSS opacity crossfade. The
      // previous version faded opacity over 0.4s, which meant for that
      // whole window BOTH video elements were actually playing and
      // compositing on screen at once. That overlap is exactly what looked
      // like "a different video laid underneath, briefly showing through" —
      // that description was correct, it just wasn't a bug in the JS state,
      // it was the fade itself. Here the swap is a single frame: the
      // incoming element flips to visible/playing and the outgoing one
      // flips to hidden/paused in the same tick, so there's never a moment
      // where two videos are actually on screen together, and the old
      // element's .src is never touched until it's fully hidden.
      function crossfadeToStandby(animateHeadline){
        if(isTransitioning) return;
        isTransitioning = true;

        const standbyIdx = 1 - activeIdx;
        const standbyEl = heroVideoEls[standbyIdx];
        const activeEl = heroVideoEls[activeIdx];

        heroVideoQueue = standbyEl._pendingQueue;
        heroVideoPos = standbyEl._pendingPos;

        standbyEl.currentTime = 0;
        standbyEl.play();
        standbyEl.classList.add('is-active');
        activeEl.classList.remove('is-active');
        activeEl.pause();

        activeIdx = standbyIdx;
        setHeroHeadlineFor(heroVideoQueue[heroVideoPos], animateHeadline);

        // The old element is now fully hidden (visibility:hidden, paused) —
        // safe to repurpose it as the new standby right away.
        preloadStandby();
        isTransitioning = false;
      }

      // Jumps directly to an explicit queue/position (used for the manual
      // "prev" button, which steps backward off-queue and so can't rely on
      // the forward-only preload above). Loads straight into the active
      // element's slot ahead of a fade so the swap still looks clean.
      function jumpTo(queue, pos){
        if(isTransitioning) return;
        const standbyEl = heroVideoEls[1 - activeIdx];
        standbyEl.src = queue[pos];
        standbyEl.load();
        standbyEl._pendingQueue = queue;
        standbyEl._pendingPos = pos;
        const onReady = () => {
          standbyEl.removeEventListener('loadeddata', onReady);
          crossfadeToStandby(true);
        };
        standbyEl.addEventListener('loadeddata', onReady);
      }

      // Initial setup: play the first clip immediately, and start
      // preloading the second one right away in the background.
      heroVideoEls[activeIdx].src = heroVideoQueue[heroVideoPos];
      heroVideoEls[activeIdx].load();
      heroVideoEls[activeIdx].classList.add('is-active');
      heroVideoEls[activeIdx].play();
      setHeroHeadlineFor(heroVideoQueue[heroVideoPos], false);
      preloadStandby();

      heroVideoEls.forEach((el, idx) => {
        el.addEventListener('ended', () => {
          if(idx === activeIdx) crossfadeToStandby(true);
        });
      });

      const heroPrevBtn = document.getElementById('heroPrevBtn');
      const heroNextBtn = document.getElementById('heroNextBtn');
      if(heroNextBtn) heroNextBtn.addEventListener('click', () => crossfadeToStandby(true));
      if(heroPrevBtn) heroPrevBtn.addEventListener('click', () => {
        const justPlayed = heroVideoQueue[heroVideoPos];
        let queue = heroVideoQueue;
        let pos = heroVideoPos - 1;
        if(pos < 0){
          const lastIndex = heroVideoQueue.length - 1;
          queue = shuffledVideoQueue(justPlayed, lastIndex);
          pos = lastIndex;
        }
        jumpTo(queue, pos);
      });

      // Pause the playing hero video once the hero has scrolled fully out
      // of view, and resume it on the way back. It was decoding for the
      // entire time the page was open regardless of scroll position, which
      // is unnecessary GPU/CPU load competing with the browser's scroll
      // compositing for the rest of the page — a plausible contributor to
      // general scroll jank, on top of it being wasted battery/data.
      const mainSectionForVideo = document.getElementById('main');
      if(mainSectionForVideo){
        const heroVideoVisibilityObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            const activeEl = heroVideoEls[activeIdx];
            if(!activeEl) return;
            if(entry.isIntersecting){
              activeEl.play();
            } else {
              activeEl.pause();
            }
          });
        }, { threshold: 0 });
        heroVideoVisibilityObserver.observe(mainSectionForVideo);
      }
    }
  } catch(err) { console.error('hero video playlist setup failed', err); }

  // Hamburger menu overlay
  try {
    const menuBtn = document.getElementById('menuBtn');
    const menuOverlay = document.getElementById('menuOverlay');

    function openMenu(){
      menuOverlay.classList.add('open');
      menuBtn.classList.add('open');
      if(siteNav) siteNav.classList.add('menu-open');
      document.body.classList.add('menu-open');
      menuBtn.setAttribute('aria-label', '메뉴 닫기');
      document.body.style.overflow = 'hidden';
    }
    function closeMenu(){
      menuOverlay.classList.remove('open');
      menuBtn.classList.remove('open');
      if(siteNav) siteNav.classList.remove('menu-open');
      document.body.classList.remove('menu-open');
      menuBtn.setAttribute('aria-label', '전체 메뉴 열기');
      document.body.style.overflow = '';
    }
    function toggleMenu(){
      if(menuOverlay.classList.contains('open')){
        closeMenu();
      } else {
        openMenu();
      }
    }
    menuBtn.addEventListener('click', toggleMenu);
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape') closeMenu();
    });
    menuOverlay.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  } catch(err) { console.error('menu setup failed', err); }

  // Nav background on scroll past hero
  try {
    const mainSection = document.getElementById('main');
    const navBgObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          siteNav.classList.remove('scrolled');
          document.body.classList.remove('past-hero');
        } else {
          siteNav.classList.add('scrolled');
          document.body.classList.add('past-hero');
        }
      });
    }, { threshold: 0.6 });
    navBgObserver.observe(mainSection);
  } catch(err) { console.error('nav bg observer setup failed', err); }

  // Dot-nav + top nav-links scrollspy
  try {
    const dots = document.querySelectorAll('.dot-nav .dot');
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = ['main','physics','chemistry','biology','earth'].map(id => document.getElementById(id));
    const sectionMascot = document.getElementById('sectionMascot');
    const mascotObj = document.getElementById('mascotObj');
    const topBtn = document.getElementById('topBtn');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if(!entry.isIntersecting) return;
        currentSectionId = entry.target.id;
        const dot = document.querySelector('.dot-nav .dot[data-section="' + entry.target.id + '"]');
        if(dot){
          dots.forEach(d => d.classList.remove('active'));
          dot.classList.add('active');
        }
        navLinks.forEach(a => {
          a.classList.toggle('active', a.getAttribute('data-section') === entry.target.id);
        });
        const objSrc = mascotObjBySection[entry.target.id];
        // Skip showing the mascot while main is still visible (see mainVisible
        // comment above) — mainHideObserver below will show it once main has
        // actually scrolled fully out of view.
        if(objSrc && !mainVisible){
          if(suppressMascot && entry.target.id !== pendingMascotTargetId) return;
          if(suppressMascot && entry.target.id === pendingMascotTargetId){
            suppressMascot = false;
            pendingMascotTargetId = null;
          }
          setMascotObj(mascotObj, sectionMascot, objSrc);
          if(sectionMascot) sectionMascot.classList.add('visible');
          if(topBtn) topBtn.classList.add('visible');
        }
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    sections.forEach(sec => sec && observer.observe(sec));

    // Dedicated, highly-sensitive observer that hides the mascot the instant
    // ANY part of the main/hero section scrolls into view (not just once it's
    // halfway visible). Kept separate from the section observer above so the
    // two never race/override each other when both fire in the same batch.
    const mainSection = document.getElementById('main');
    if(mainSection){
      const mainHideObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          mainVisible = entry.isIntersecting;
          if(entry.isIntersecting){
            suppressMascot = false;
            pendingMascotTargetId = null;
            if(sectionMascot) sectionMascot.classList.remove('visible');
            if(topBtn) topBtn.classList.remove('visible');
            return;
          }
          // Main just scrolled fully out of view again. The regular section
          // observer only fires on a fresh crossing, so if the user only
          // peeked at main briefly (without ever scrolling far enough for the
          // current domain section to itself cross out of its own band), it
          // never gets a new "true" event to re-show the mascot. Re-sync from
          // currentSectionId here as a catch-all so it always comes back.
          // Exception: if a click-nav is currently in flight (suppressMascot),
          // trust pendingMascotTargetId instead of currentSectionId — during a
          // long scroll (e.g. main -> chemistry) the scrollspy observer above
          // still updates currentSectionId for whatever section band the page
          // briefly passes through (e.g. physics), which would otherwise cause
          // that intermediate section's object to flash here before settling
          // on the real destination.
          const fallbackId = (suppressMascot && pendingMascotTargetId) ? pendingMascotTargetId : currentSectionId;
          const objSrc = mascotObjBySection[fallbackId];
          if(objSrc){
            setMascotObj(mascotObj, sectionMascot, objSrc);
            if(sectionMascot) sectionMascot.classList.add('visible');
            if(topBtn) topBtn.classList.add('visible');
          }
        });
      }, { threshold: 0, rootMargin: '-4px 0px 0px 0px' });
      mainHideObserver.observe(mainSection);
    }
  } catch(err) { console.error('dot nav setup failed', err); }

  // Pin the mascot/top-btn to the bottom edge of the earth section instead of
  // letting them float (fixed) over the footer. As the page scrolls past the
  // point where "fixed" would start covering the footer, switch each element
  // to position:absolute anchored to that exact spot so it scrolls away with
  // the earth section and the footer passes underneath undisturbed. Runs on
  // all viewport sizes — top-btn should still catch at the footer on mobile
  // too.
  try {
    const sectionMascot = document.getElementById('sectionMascot');
    const topBtn = document.getElementById('topBtn');
    const earth = document.getElementById('earth');
    const pinnableEls = [sectionMascot, topBtn].filter(Boolean);

    // Cached instead of reading window.innerHeight live inside the scroll
    // handler below — on mobile Safari, innerHeight changes as the address
    // bar collapses/expands while scrolling, which fed directly into the
    // pin/unpin threshold and made it flip-flop. Only refreshed on a real
    // width resize.
    let viewportH = window.innerHeight;
    let pinLastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
      if(window.innerWidth === pinLastWidth) return;
      pinLastWidth = window.innerWidth;
      viewportH = window.innerHeight;
    });

    const pinEl = (el, earthBottomDoc) => {
      const isPinned = el.dataset.pinned === '1';
      const basePosition = isPinned ? 'fixed' : getComputedStyle(el).position;
      if(basePosition !== 'fixed' && !isPinned) return;
      const bottomOffset = isPinned
        ? parseFloat(el.dataset.bottomOffset || '0')
        : parseFloat(getComputedStyle(el).bottom) || 0;
      if(!isPinned) el.dataset.bottomOffset = String(bottomOffset);
      const elHeight = el.offsetHeight;
      const naturalBottomDoc = window.scrollY + viewportH - bottomOffset;
      if(naturalBottomDoc > earthBottomDoc){
        el.style.position = 'absolute';
        el.style.top = (earthBottomDoc - elHeight) + 'px';
        el.style.bottom = 'auto';
        el.dataset.pinned = '1';
      } else if(isPinned){
        el.style.position = '';
        el.style.top = '';
        el.style.bottom = '';
        el.dataset.pinned = '';
      }
    };

    let pinRAF = null;
    function updatePin(){
      pinRAF = null;
      if(!earth) return;
      const earthBottomDoc = earth.offsetTop + earth.offsetHeight;
      pinnableEls.forEach(el => pinEl(el, earthBottomDoc));
    }
    function requestPinUpdate(){
      if(pinRAF) return;
      pinRAF = requestAnimationFrame(updatePin);
    }
    window.addEventListener('scroll', requestPinUpdate, { passive: true });
    window.addEventListener('resize', requestPinUpdate);
    updatePin();

    // The very first updatePin() above runs before the custom webfont has
    // necessarily finished loading — if it swaps in afterward with
    // different line-wrapping/metrics, earth's height (and so its pin
    // threshold) shifts, but nothing re-runs updatePin() to pick that up
    // until the next scroll/resize. That's the most likely reason the
    // footer catch worked sometimes and not others. Re-running it once
    // fonts and the rest of the page (images etc.) have actually finished
    // loading closes that gap.
    window.addEventListener('load', requestPinUpdate);
    if(document.fonts && document.fonts.ready){
      document.fonts.ready.then(requestPinUpdate).catch(() => {});
    }
  } catch(err) { console.error('mascot footer pin setup failed', err); }

  // Top button scroll-to-top
  try {
    const topBtn = document.getElementById('topBtn');
    if(topBtn){
      topBtn.addEventListener('click', () => {
        suppressMascot = true;
        pendingMascotTargetId = 'main';
        mainVisible = true;
        const sectionMascot = document.getElementById('sectionMascot');
        if(sectionMascot) sectionMascot.classList.remove('visible');
        topBtn.classList.remove('visible');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
          if(pendingMascotTargetId === 'main'){
            suppressMascot = false;
            pendingMascotTargetId = null;
          }
        }, 1000);
      });
    }
  } catch(err) { console.error('top button setup failed', err); }

  // Keep the current section filling the viewport when the window is
  // resized — but only for an actual desktop window resize (width change).
  //
  // This was firing on mobile too, because on mobile Safari the address bar
  // hiding/showing as you scroll changes window.innerHeight and dispatches
  // a real 'resize' event — so every ordinary scroll gesture was triggering
  // this handler, which then yanked the scroll position back to the exact
  // top of whatever section counted as "current". That's what looked like
  // the page snapping section-by-section and juddering at odd spots. Only
  // reacting when the width actually changes skips that mobile scroll
  // noise entirely while keeping the real desktop-resize behavior intact.
  try {
    let resizeRAF = null;
    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
      if(window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      if(resizeRAF) return;
      resizeRAF = requestAnimationFrame(() => {
        resizeRAF = null;
        const section = document.getElementById(currentSectionId);
        if(section){
          const targetTop = section.getBoundingClientRect().top + window.pageYOffset;
          window.scrollTo({ top: targetTop, behavior: 'instant' });
        }
      });
    });
  } catch(err) { console.error('resize realign setup failed', err); }

  // The bottom-right mascot is CSS-hidden (display:none) on mobile, but a
  // display:none <video> isn't guaranteed to actually stop decoding in
  // every browser — it's autoplay/loop, so left alone it can keep
  // decoding frames for a video nobody can see for the entire session.
  // Explicitly pausing it on mobile removes that as a possible contributor
  // to general scroll jank, on top of saving battery/data.
  try {
    const mascotCatVideo = document.querySelector('.mascot-cat');
    if(mascotCatVideo && window.matchMedia('(max-width:860px), (max-height:640px)').matches){
      mascotCatVideo.pause();
    }
  } catch(err) { console.error('mobile mascot video pause failed', err); }

  // Card-grid slide progress bar (mobile card slider)
  try {
    document.querySelectorAll('.card-grid').forEach(grid => {
      const track = grid.nextElementSibling;
      if(!track || !track.classList.contains('slide-progress')) return;
      const thumb = track.querySelector('.slide-progress-bar');
      function update(){
        const maxScroll = grid.scrollWidth - grid.clientWidth;
        const visibleRatio = Math.min(1, grid.clientWidth / grid.scrollWidth);
        const trackWidth = track.clientWidth;
        const thumbWidth = visibleRatio * trackWidth;
        thumb.style.width = thumbWidth + 'px';
        if(maxScroll <= 0){
          thumb.style.transform = 'translateX(0)';
          return;
        }
        const progress = grid.scrollLeft / maxScroll;
        const maxThumbTranslate = trackWidth - thumbWidth;
        thumb.style.transform = 'translateX(' + (progress * maxThumbTranslate) + 'px)';
      }
      grid.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      update();
    });
  } catch(err) { console.error('slide progress setup failed', err); }
