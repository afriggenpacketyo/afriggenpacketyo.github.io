// --- FILE: script.js ---

// === DARK MODE SYNC ===
(function() {
  const toggle = document.getElementById('header-slider-toggle');
  if (!toggle) return;

  // The 'anti-flicker' script has already set the theme.
  // We just need to sync the toggle's visual state.
  toggle.checked = document.documentElement.classList.contains('dark-mode');

  // And attach the event listener for future clicks.
  toggle.addEventListener('change', function(event) {
    const isDark = event.target.checked;
    localStorage.setItem('darkMode', isDark ? '1' : '0');
    document.documentElement.classList.toggle('dark-mode', isDark);
  });
})();

document.addEventListener('DOMContentLoaded', function() {

  // --- Insert invisible rectangles after links in cards (desktop only) ---
  document.querySelectorAll('.flip-card-back a').forEach(function(link) {
    if (!link.nextElementSibling || !link.nextElementSibling.classList.contains('card-link-rectangle')) {
      var rect = document.createElement('div');
      rect.className = 'card-link-rectangle';
      link.parentNode.insertBefore(rect, link.nextSibling);
    }
  });

  // --- SCRIPT LOADER ---
  const isMobile = 'ontouchstart' in window;

  function loadScript(src) {
      return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
      });
  }

  // Define the loading sequence with proper dependency management
  async function initializeApp() {
      try {
          // Wait for CSS to be loaded before initializing scripts
          await new Promise(resolve => {
              const checkCSS = () => {
                  const testElement = document.documentElement;
                  const bgColor = getComputedStyle(testElement).getPropertyValue('--background-main');
                  if (bgColor && bgColor.trim() !== '') {
                      console.log('CSS variables detected, CSS is loaded');
                      resolve(); // CSS already loaded
                  } else if (window.__allCSSLoadedFired) {
                      console.log('allCSSLoaded event already fired, proceeding');
                      resolve();
                  } else {
                      console.log('Waiting for allCSSLoaded event...');
                      document.addEventListener('allCSSLoaded', resolve, { once: true });
                  }
              };
              
              if (document.readyState === 'loading') {
                  document.addEventListener('allCSSLoaded', resolve, { once: true });
              } else {
                  checkCSS();
              }
          });

          console.log('CSS loaded, initializing scripts...');

          // Load common.js first
          await loadScript('assets/js/common.js?v=20250606');

          // Load platform-specific script
          const platformScript = isMobile ? 'assets/js/mobile.js?v=20250606' : 'assets/js/desktop.js?v=20250606';
          await loadScript(platformScript);

          // Load dependent scripts in parallel
          await Promise.all([
              loadScript('assets/js/hamburger.js?v=20250606'),
              loadScript('assets/js/filters.js?v=20250606')
          ]);

          console.log('All scripts loaded successfully in correct order.');

          // Mark that scripts have loaded globally
          window.__scriptsLoadedFired = true;

          // Dispatch event to notify platform-specific scripts that all dependencies are ready
          document.dispatchEvent(new CustomEvent('scriptsLoaded'));

      } catch (error) {
          console.error('Script loading failed:', error);
          // Still mark as loaded and dispatch the event to prevent hanging
          window.__scriptsLoadedFired = true;
          document.dispatchEvent(new CustomEvent('scriptsLoaded'));
      }
  }

  initializeApp();

  // --- Gyroscopic effect (self-contained, can stay as is) ---
  (function() {
      if (typeof window.DeviceOrientationEvent !== 'function') return;
      function lerpColor(a, b, t) {
          const ah = a.replace('#',''), bh = b.replace('#','');
          const ar = parseInt(ah.substring(0,2),16), ag = parseInt(ah.substring(2,4),16), ab = parseInt(ah.substring(4,6),16);
          const br = parseInt(bh.substring(0,2),16), bg = parseInt(bh.substring(2,4),16), bb = parseInt(bh.substring(4,6),16);
          const rr = Math.round(ar + (br-ar)*t), rg = Math.round(ag + (bg-ag)*t), rb = Math.round(ab + (bb-ab)*t);
          return `#${rr.toString(16).padStart(2,'0')}${rg.toString(16).padStart(2,'0')}${rb.toString(16).padStart(2,'0')}`;
      }
      const COLOR_ORANGE = '#e38d2c', COLOR_TAN = '#c49b45';
      function updateHeadlineColor(tilt) {
          if (document.documentElement.classList.contains('dark-mode')) {
              const t = Math.max(0, Math.min(1, (tilt + 90) / 180));
              const color = lerpColor(COLOR_ORANGE, COLOR_TAN, t);
              const headline = document.querySelector('.flip-card.active .flip-card-front h2');
              if (headline) headline.style.color = color;
          }
      }
      window.addEventListener('deviceorientation', e => { if (typeof e.gamma === 'number') updateHeadlineColor(e.gamma); }, true);
      function resetHeadlineColor() {
          const headline = document.querySelector('.flip-card.active .flip-card-front h2');
          if (headline) headline.style.color = '';
      }
      window.addEventListener('orientationchange', resetHeadlineColor);
      document.addEventListener('visibilitychange', resetHeadlineColor);
  })();
});