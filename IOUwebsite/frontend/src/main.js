import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register plugins
gsap.registerPlugin(ScrollTrigger);

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
  
  // Animation Logic
  const steps = document.querySelectorAll('.step');
  const screens = document.querySelectorAll('.screen-content');
  const phone = document.querySelector('.iphone-mockup');

  // Initial animation for phone
  gsap.from(phone, {
    y: 100,
    opacity: 0,
    duration: 1.5,
    ease: "power3.out"
  });

  // Setup ScrollTriggers for each step
  steps.forEach((step, index) => {
    const screenId = step.getAttribute('data-screen');
    const targetScreen = document.getElementById(screenId);

    ScrollTrigger.create({
      trigger: step,
      start: "top center",
      end: "bottom center",
      onEnter: () => updateScreen(targetScreen),
      onEnterBack: () => updateScreen(targetScreen),
      onLeave: () => {
        // Optional: fade out current screen if needed, 
        // but usually we just wait for next one to enter
      },
      toggleClass: { targets: step, className: "active" },
      // markers: true // for debugging
    });
  });

  function updateScreen(newScreen) {
    if (!newScreen) return;
    
    // Fade out other screens
    screens.forEach(s => {
      if (s !== newScreen && s.classList.contains('active')) {
        gsap.to(s, {
          opacity: 0,
          duration: 0.5,
          zIndex: 1,
          onComplete: () => s.classList.remove('active')
        });
      }
    });

    // Fade in target screen
    if (!newScreen.classList.contains('active')) {
      newScreen.classList.add('active');
      gsap.fromTo(newScreen, 
        { opacity: 0, zIndex: 2 },
        { opacity: 1, duration: 0.5, ease: "power2.out" }
      );
      
      // If it's a video, ensure it plays
      const video = newScreen.querySelector('video');
      if (video) {
          video.currentTime = 0;
          video.play().catch(e => console.log("Autoplay prevented", e));
      }
    }
  }

  // QR Modal Logic (Preserved from original)
  const APP_STORE_URL = 'https://apps.apple.com/app/iou/id000000000'; // Replace ID
  const QR_API = 'https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=';
  const modal = document.getElementById('qr-modal');
  const qrImg = document.getElementById('qr-code-image');
  const appStoreLink = document.getElementById('app-store-link');

  function openModal() {
    if(!qrImg.src) qrImg.src = QR_API + encodeURIComponent(APP_STORE_URL);
    appStoreLink.href = APP_STORE_URL;
    modal.classList.add('modal-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('modal-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.open-qr-modal, #nav-download').forEach(el => {
    el.addEventListener('click', openModal);
  });
  document.getElementById('close-qr-modal')?.addEventListener('click', closeModal);
  document.getElementById('modal-backdrop')?.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('modal-open')) closeModal();
  });

});
