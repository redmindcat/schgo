//const siteNav = document.getElementById('header');
let currentSectionId = 'main';
let suppressMascot = false;
let pendingMascotTargetId = null;
let mainVisible = true;




// header > menuBtn
try {
	const menuBtn = document.getElementById('menuBtn');
	const menuPop = document.getElementById('menuPop');
	function openMenu(){
	  menuPop.classList.add('open');
	  menuBtn.classList.add('on');
	  document.body.classList.add('menu-open');
	}
	function closeMenu(){
	  menuPop.classList.remove('open');
	  menuBtn.classList.remove('on');
	  document.body.classList.remove('menu-open');
	}
	function toggleMenu(){
		clickEffect();
		menuPop.classList.contains('open') ?  closeMenu() : openMenu();
	}
	menuBtn.addEventListener('click', toggleMenu);
	document.addEventListener('keydown', (e) => {
		if(e.key === 'Escape') closeMenu();
	});
	menuPop.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
} catch(err) { console.error('menu setup failed', err); }


// main video sld / hero headline
try {
	const heroHeadlineEl = document.getElementById('heroHeadline');

	let heroHeadlineGen = 0;
	const heroVideoCopy = {
		'./video/schgo_m_new_3.mp4': '과학은 원래,<br>궁금한 것에서 시작하니까.',
		'./video/schgo_m_new_4.mp4': '오늘은 슈고랑<br>어떤 실험을 해볼까요?',
		'./video/schgo_m_new_5.mp4': '과학을 만나는<br>가장 재미있는 방법.'
	};
	const heroVideoEls = [document.getElementById('heroBgVideoA'), document.getElementById('heroBgVideoB')];

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

	function isMobileHeadline(){
		return window.matchMedia('(max-width:860px), (max-height:640px)').matches;
	}

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
		let isTransitioning = false;

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

		function preloadStandby(){
			const standbyEl = heroVideoEls[1 - activeIdx];
			const peeked = peekNext();
			standbyEl.src = peeked.queue[peeked.pos];
			standbyEl.load();
			standbyEl._pendingQueue = peeked.queue;
			standbyEl._pendingPos = peeked.pos;
		}

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

			preloadStandby();
			isTransitioning = false;
		}

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

		heroVideoEls[activeIdx].src = heroVideoQueue[heroVideoPos];
		heroVideoEls[activeIdx].load();
		heroVideoEls[activeIdx].classList.add('is-active');
		heroVideoEls[activeIdx].play();
		setHeroHeadlineFor(heroVideoQueue[heroVideoPos], false);
		preloadStandby();

		heroVideoEls.forEach((el, idx) => {
			el.addEventListener('ended', () => { if(idx === activeIdx) crossfadeToStandby(true);});
		});

		const heroPrevBtn = document.getElementById('hero-prevbtn');
		const heroNextBtn = document.getElementById('hero-nextbtn');
		if(heroNextBtn) heroNextBtn.addEventListener('click', () => {
			clickEffect();
			crossfadeToStandby(true);
		});
		if(heroPrevBtn) heroPrevBtn.addEventListener('click', () => {
			clickEffect();
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

		const mainSectionForVideo = document.getElementById('main');
		if(mainSectionForVideo){
			const heroVideoVisibilityObserver = new IntersectionObserver((entries) => {
				entries.forEach(entry => {
					const activeEl = heroVideoEls[activeIdx];
					if(!activeEl) return;
					entry.isIntersecting ? activeEl.play() : activeEl.pause();
				});
			}, { threshold: 0 });
			heroVideoVisibilityObserver.observe(mainSectionForVideo);
		}
	}
} catch(err) { console.error('hero video playlist setup failed', err); }


// main video mobile pause
try {
	const mascotCatVideo = document.querySelector('.mas-vdo');
	if(mascotCatVideo && window.matchMedia('(max-width:860px), (max-height:640px)').matches){
		mascotCatVideo.pause();
	}
} catch(err) { console.error('mobile mascot video pause failed', err); }






//== scroll ===================================================================
// Nav background on scroll past hero
try {
	const mainSection = document.getElementById('main');
	const navBgObserver = new IntersectionObserver((entries) => {
		entries.forEach(entry => {
			if(entry.isIntersecting){
				document.body.classList.remove('scrolled');
				//document.body.classList.remove('past-hero');
			} else {
				document.body.classList.add('scrolled');
				//document.body.classList.add('past-hero');
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






// mascot
const mascotObjBySection = {
	physics: './images/br_cat_obj_1.png',
	chemistry: './images/br_cat_obj_2.png',
	biology: './images/br_cat_obj_3.png',
	earth: './images/br_cat_obj_4.png',
};

function playMascotObjPop(imgEl){
	const wrap = imgEl && imgEl.parentElement;
	if(!wrap || !wrap.classList.contains('mas-ico')) return;
	wrap.classList.remove('pop-in');
	void wrap.offsetWidth;
	wrap.classList.add('pop-in');
}

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
			clickEffect();
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
				const currentScrollY = window.scrollY || window.pageYOffset;
				const targetTop = target.getBoundingClientRect().top + currentScrollY;
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


try {
	const sectionMascot = document.getElementById('sectionMascot');
	const topBtn = document.getElementById('topBtn');
	const earth = document.getElementById('earth');
	const pinnableEls = [sectionMascot, topBtn].filter(Boolean);

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
		//const naturalBottomDoc = window.scrollY + viewportH - bottomOffset;
		const naturalBottomDoc = window.scrollY + window.innerHeight - bottomOffset;
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
		//const earthBottomDoc = earth.offsetTop + earth.offsetHeight;
		const earthBottomDoc = window.scrollY + earth.getBoundingClientRect().bottom;
		pinnableEls.forEach(el => pinEl(el, earthBottomDoc));
    }
    function requestPinUpdate(){
		if(pinRAF) return;
		pinRAF = requestAnimationFrame(updatePin);
    }
    window.addEventListener('scroll', requestPinUpdate, { passive: true });
    window.addEventListener('resize', requestPinUpdate);
    updatePin();

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
			clickEffect();
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


// resize
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

	

// Card-grid slide progress bar (mobile card slider)
try {
	document.querySelectorAll('.card-grid').forEach(grid => {
		const track = grid.nextElementSibling;
		if (!track || !track.classList.contains('card-progress')) return;
		const thumb = track.querySelector('.card-progress-bar');

		let isGridDragging = false;
		let isTrackDragging = false;
		let startX = 0;
		let startScrollLeft = 0;
		let isMoved = false;

		let moveHistory = [];
		let rafId = null;
		grid.addEventListener('dragstart', (e) => e.preventDefault());
		function update() {
			const maxScroll = grid.scrollWidth - grid.clientWidth;			

			if (maxScroll <= 0) {
				thumb.style.width = '100%';
				thumb.style.transform = 'translateX(0)';
				track.style.display = 'none';
				grid.style.cursor = 'default';
				return;
			}
			track.style.display = 'block';
			grid.style.cursor = 'grab';

			const visibleRatio = grid.clientWidth / grid.scrollWidth;
			const trackWidth = track.clientWidth;
			const thumbWidth = Math.max(30, visibleRatio * trackWidth);
			const maxThumbTranslate = trackWidth - thumbWidth;
			const progress = grid.scrollLeft / maxScroll;
			thumb.style.width = thumbWidth + 'px';
			thumb.style.transform = 'translateX(' + (progress * maxThumbTranslate) + 'px)';
		}
		grid.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update);
		update();
		const stopMomentum = () => {
			if (rafId) {
				cancelAnimationFrame(rafId);
				rafId = null;
			}
		};

		// 카드 영역 마우스 / 터치 드래그 & 관성 스크롤 ---
		grid.addEventListener('pointerdown', (e) => {
			if (e.pointerType === 'mouse' && e.button !== 0) return;
			stopMomentum();
			isGridDragging = true;
			isMoved = false;
			startX = e.clientX;
			startScrollLeft = grid.scrollLeft;

			const now = performance.now();
			moveHistory = [{ x: e.clientX, time: now }];
			grid.classList.add('dragging');
		});

		window.addEventListener('pointermove', (e) => {
			if (!isGridDragging) return;
			const walk = e.clientX - startX;
			if (Math.abs(walk) > 5) {
				isMoved = true;
			}
			grid.scrollLeft = startScrollLeft - walk;
			const now = performance.now();
			moveHistory.push({ x: e.clientX, time: now });
			while (moveHistory.length > 0 && now - moveHistory[0].time > 100) {
				moveHistory.shift();
			}
		});

		const stopGridDrag = () => {
			if (!isGridDragging) return;
			isGridDragging = false;
			grid.classList.remove('dragging');

			const now = performance.now();
			if (moveHistory.length >= 2) {
				const first = moveHistory[0];
				const last = moveHistory[moveHistory.length - 1];
				const dt = last.time - first.time;
				const dx = last.x - first.x;

				if (dt > 0 && (now - last.time) < 80) {
					const velocity = dx / dt; // px/ms
					if (Math.abs(velocity) > 0.1) {
						let currentVelocity = velocity * 18;
						const momentumLoop = () => {
							if (Math.abs(currentVelocity) < 0.1) {
								rafId = null;
								return;
							}
							grid.scrollLeft -= currentVelocity;
							currentVelocity *= 0.95; // ⭐️ 마찰 계수 (0.95: 스르륵 길게 미끄러짐)
							rafId = requestAnimationFrame(momentumLoop);
						};
						rafId = requestAnimationFrame(momentumLoop);
					}
				}
			}
		};

		window.addEventListener('pointerup', stopGridDrag);
		window.addEventListener('pointercancel', stopGridDrag);

		grid.addEventListener('click', (e) => {
			if (isMoved) {
				e.preventDefault();
				e.stopPropagation();
				isMoved = false;
			}
		}, true);

		const moveByTrack = (clientX) => {
			stopMomentum();
			const rect = track.getBoundingClientRect();
			const trackWidth = rect.width;
			const thumbWidth = thumb.offsetWidth;
			const maxScroll = grid.scrollWidth - grid.clientWidth;

			if (maxScroll <= 0) return;
			let offsetX = clientX - rect.left - (thumbWidth / 2);
			const maxOffset = trackWidth - thumbWidth;			
			offsetX = Math.max(0, Math.min(offsetX, maxOffset));
			const progress = maxOffset > 0 ? offsetX / maxOffset : 0;
			grid.scrollLeft = progress * maxScroll;
		};

		track.addEventListener('pointerdown', (e) => {
			if (e.pointerType === 'mouse' && e.button !== 0) return;
			isTrackDragging = true;
			moveByTrack(e.clientX);
		});

		window.addEventListener('pointermove', (e) => {
			if (!isTrackDragging) return;
			moveByTrack(e.clientX);
		});

		const stopTrackDrag = () => {
			isTrackDragging = false;
		};

		window.addEventListener('pointerup', stopTrackDrag);
		window.addEventListener('pointercancel', stopTrackDrag);
	});
} catch (err) {
	console.error('slide progress setup failed', err);
}







(function addDeviceClass() {
    const ua = navigator.userAgent;
    const html = document.documentElement;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);

    if (isIOS) {
        html.classList.add('is-mobile', 'is-ios');
    } else if (isAndroid) {
        html.classList.add('is-mobile', 'is-android');
    } else {
        html.classList.add('is-pc');
    }
})();

function clickEffect(){
	var audio = document.querySelector("#effectAdo");
	audio.src = "./js/click.mp3";
	audio.play();
}



