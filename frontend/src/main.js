import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ============================================================
   NAV — add .scrolled class on scroll
   ============================================================ */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

/* ============================================================
   HERO — staggered entrance
   ============================================================ */
const heroTL = gsap.timeline({ delay: 0.1, defaults: { ease: 'power3.out' } });
heroTL
  .from('.hero-eyebrow', { y: 22, opacity: 0, duration: 0.55 })
  // Word-mask reveal: words slide up from below their container
  .from('.hw', { y: '110%', duration: 0.72, stagger: 0.12 }, '-=0.28')
  .from('.hero-body',  { y: 20, opacity: 0, duration: 0.5 }, '-=0.28')
  .from('.hero-cta',   { y: 18, opacity: 0, duration: 0.45 }, '-=0.22')
  .from('.hero-phone-wrap', { x: 75, opacity: 0, duration: 0.9, ease: 'power2.out' }, '-=0.8')
  .from('.chip-a', { scale: 0, opacity: 0, duration: 0.55, ease: 'back.out(2.5)' }, '-=0.25')
  .from('.chip-b', { scale: 0, opacity: 0, duration: 0.55, ease: 'back.out(2.5)', delay: 0.22 }, '-=0.45')
  .from('.chip-c', { scale: 0, opacity: 0, duration: 0.55, ease: 'back.out(2.5)', delay: 0.45 }, '-=0.45')
  .from('.scroll-hint', { opacity: 0, y: 10, duration: 0.5 }, '-=0.2');

// Hero phone gentle float
gsap.to('.hero-iphone', {
  y: -16,
  duration: 3.2,
  ease: 'sine.inOut',
  yoyo: true,
  repeat: -1,
});

// Chip float after entrance completes
heroTL.eventCallback('onComplete', () => {
  ['.chip-a', '.chip-b', '.chip-c'].forEach((sel, i) => {
    gsap.to(sel, {
      y: -9,
      duration: 2.6 + i * 0.4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: i * 0.8,
    });
  });
});

// Dot-grid parallax
gsap.to('.hero-dots', {
  scrollTrigger: { trigger: '#hero', scrub: 1.5 },
  y: 120,
  opacity: 0,
});

/* ============================================================
   STORY — screen switching + annotation pop-ins + step text
   ============================================================ */
const storyScreens = Array.from(document.querySelectorAll('.story-scr'));
const storyVideos = Array.from(document.querySelectorAll('.story-video'));
const anns = Array.from(document.querySelectorAll('.ann'));
const dots = Array.from(document.querySelectorAll('.sdot'));
const storyDots = document.querySelector('.story-dots');

// Step index -> video index: 0=Scanning, 1=FindFriends, 2=AssignItems, 3=Balances
const stepToVideoIndex = [0, 1, 2, 3];

// Initialise story videos: only video 0 visible and playing
if (storyVideos.length > 0) {
  gsap.set(storyVideos[0], { opacity: 1 });
  gsap.set(storyVideos.slice(1), { opacity: 0 });
  storyVideos[0].play().catch(() => {});
  storyVideos.slice(1).forEach(v => v.pause());
}

// Initialise screen opacities (only if story screens exist)
if (storyScreens.length > 0) {
  gsap.set(storyScreens, { opacity: 0, y: 10 });
  gsap.set(storyScreens[0], { opacity: 1, y: 0 });
}

let currentStep = -1;

function goToStep(idx) {
  if (idx === currentStep) return;

  // Story videos: crossfade to the video for this step
  if (storyVideos.length > 0 && stepToVideoIndex[idx] !== undefined) {
    const prevVideoIdx = currentStep >= 0 ? stepToVideoIndex[currentStep] : -1;
    const nextVideoIdx = stepToVideoIndex[idx];
    
    // Only transition if the video index actually changes
    if (prevVideoIdx !== nextVideoIdx) {
      const prevVideo = prevVideoIdx >= 0 ? storyVideos[prevVideoIdx] : null;
      const nextVideo = storyVideos[nextVideoIdx];
      
      if (prevVideo) {
        gsap.to(prevVideo, { opacity: 0, duration: 0.35, ease: 'power2.in', onComplete: () => prevVideo.pause() });
      }
      if (nextVideo) {
        gsap.fromTo(nextVideo, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power2.out', delay: 0.1, onStart: () => nextVideo.play().catch(() => {}) });
      }
    }
  }

  // Screens (only if story screens exist)
  if (storyScreens.length > 0) {
    if (currentStep >= 0) {
      gsap.to(storyScreens[currentStep], { opacity: 0, y: -8, duration: 0.3, ease: 'power2.in' });
    }
    gsap.fromTo(
      storyScreens[idx],
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out', delay: 0.08 }
    );
  }

  // Annotations: Ensure ONLY the current index is shown, hide all others
  if (anns.length > 0) {
    anns.forEach((ann, i) => {
      if (i === idx) {
        // Show current
        gsap.killTweensOf(ann);
        gsap.fromTo(ann, 
          { opacity: 0, scale: 0.65, y: 8 }, 
          { opacity: 1, scale: 1, y: 0, duration: 0.48, ease: 'back.out(2)', delay: 0.28 }
        );
      } else {
        // Hide others (forcefully if needed)
        gsap.to(ann, { opacity: 0, scale: 0.65, duration: 0.22, ease: 'power2.in', overwrite: true });
      }
    });
  }

  // Progress dots
  dots.forEach((d, i) => d.classList.toggle('active', i === idx));

  currentStep = idx;
}

// Show/hide the progress dots when story is in view
if (storyDots) {
  ScrollTrigger.create({
    trigger: '#story',
    start: 'top 60%',
    end: 'bottom 40%',
    onEnter:      () => storyDots.classList.add('visible'),
    onLeave:      () => storyDots.classList.remove('visible'),
    onEnterBack:  () => storyDots.classList.add('visible'),
    onLeaveBack:  () => storyDots.classList.remove('visible'),
  });
}

// Animate first annotation in when story appears
// (Removed redundant one-time trigger; goToStep(0) handles this now)

// Step text is static; only switch phone/annotations when step reaches mid-viewport
const steps = document.querySelectorAll('.story-step');
steps.forEach((step, i) => {
  ScrollTrigger.create({
    trigger: step,
    start: 'top 56%',
    end: 'bottom 56%',
    onEnter:     () => goToStep(i),
    onEnterBack: () => goToStep(i),
  });
});

/* ============================================================
   FEATURES — staggered card reveal
   ============================================================ */
gsap.from('.features-head', {
  scrollTrigger: { trigger: '#features', start: 'top 78%' },
  y: 44, opacity: 0, duration: 0.7, ease: 'power2.out',
});

gsap.from('.feat-card', {
  scrollTrigger: { trigger: '.feat-grid', start: 'top 88%' },
  y: 55, opacity: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out',
});

/* ============================================================
   SHOWCASE — slide in text + phones
   ============================================================ */
gsap.from('.showcase-text > *', {
  scrollTrigger: { trigger: '#showcase', start: 'top 80%' },
  y: 30, opacity: 0, duration: 0.55, stagger: 0.12, ease: 'power2.out',
});

gsap.from('.sc-phone-1', {
  scrollTrigger: { trigger: '.showcase-phones', start: 'top 88%' },
  y: 65, opacity: 0, rotation: -3, duration: 0.85, ease: 'power3.out',
});
gsap.from('.sc-phone-2', {
  scrollTrigger: { trigger: '.showcase-phones', start: 'top 88%' },
  y: 85, opacity: 0, rotation: 3, duration: 0.85, delay: 0.18, ease: 'power3.out',
});

// Rolling counters
document.querySelectorAll('.cnt').forEach(el => {
  const target = parseInt(el.dataset.to, 10);
  ScrollTrigger.create({
    trigger: el,
    start: 'top 88%',
    once: true,
    onEnter() {
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target,
        duration: 1.6,
        ease: 'power2.out',
        onUpdate() { el.textContent = Math.round(obj.v); },
      });
    },
  });
});

/* ============================================================
   DOWNLOAD — entrance + phone float + glow pulse
   ============================================================ */
gsap.from('.sec-tag-dl', {
  scrollTrigger: { trigger: '#download', start: 'top 82%' },
  y: 18, opacity: 0, duration: 0.45,
});
gsap.from('.dl-h2', {
  scrollTrigger: { trigger: '#download', start: 'top 78%' },
  y: 55, opacity: 0, duration: 0.8, ease: 'power3.out',
});
gsap.from('.dl-p', {
  scrollTrigger: { trigger: '#download', start: 'top 74%' },
  y: 25, opacity: 0, duration: 0.55, delay: 0.12,
});
gsap.from('.dl-actions', {
  scrollTrigger: { trigger: '#download', start: 'top 70%' },
  y: 22, opacity: 0, duration: 0.5, delay: 0.25,
});
gsap.from('.dl-phone-wrap', {
  scrollTrigger: { trigger: '.dl-phone-wrap', start: 'top 95%' },
  y: 110, opacity: 0, duration: 1.1, ease: 'power3.out',
});

// Glow breathing
gsap.to('.dl-glow', {
  scale: 1.18,
  opacity: 0.85,
  duration: 3.5,
  ease: 'sine.inOut',
  yoyo: true,
  repeat: -1,
});

// Download phone float
gsap.to('.dl-iphone', {
  y: -14,
  duration: 3.6,
  ease: 'sine.inOut',
  yoyo: true,
  repeat: -1,
  delay: 1.2,
});
