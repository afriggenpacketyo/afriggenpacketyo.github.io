// === DARK MODE PREFERENCE PERSISTENCE ===
(function() {
    const toggle = document.getElementById('header-slider-toggle');
    if (!toggle) return;
  
    // Restore preference
    const darkPref = localStorage.getItem('darkMode');
    if (darkPref === '1') {
      document.documentElement.classList.add('dark-mode');
      toggle.checked = true;
    } else {
      document.documentElement.classList.remove('dark-mode');
      toggle.checked = false;
    }
  
    // Save preference on change
    toggle.addEventListener('change', function(event) {
      const isDark = event.target.checked;
      localStorage.setItem('darkMode', isDark ? '1' : '0');
      document.documentElement.classList.toggle('dark-mode', isDark);
    });
  })();
  
  // === END DARK MODE PREFERENCE ===
  
  document.addEventListener('DOMContentLoaded', function() {
  
    // --- Insert invisible rectangles after links in cards (desktop only) ---
    document.querySelectorAll('.flip-card-back a').forEach(function(link) {
      if (!link.nextElementSibling || !link.nextElementSibling.classList.contains('card-link-rectangle')) {
        var rect = document.createElement('div');
        rect.className = 'card-link-rectangle';
        link.parentNode.insertBefore(rect, link.nextSibling);
      }
    });
  
    // Hamburger menu overlay logic
    const hamburger = document.querySelector('.header-hamburger');
    const menuOverlay = document.getElementById('menu-overlay');
    const menuContent = menuOverlay ? menuOverlay.querySelector('.menu-content') : null;
  
    if (hamburger && menuOverlay) {
      hamburger.addEventListener('click', function(e) {
        menuOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
      // Close on click outside menu content
      menuOverlay.addEventListener('click', function(e) {
        if (e.target === menuOverlay) {
          menuOverlay.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
      // Close on Escape key
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && menuOverlay.classList.contains('active')) {
          menuOverlay.classList.remove('active');
          document.body.style.overflow = '';
        }
      });
    }
  
    // Dark mode toggle logic
    const darkModeToggle = document.getElementById('header-slider-toggle');
    const htmlEl = document.documentElement;
    const logoImg = document.querySelector('.site-logo');
  
    function setDarkMode(isDark) {
      if (isDark) {
        htmlEl.classList.add('dark-mode');
      } else {
        htmlEl.classList.remove('dark-mode');
      }
      // Immediately update card highlights for current mode
      if (window.CardSystem && typeof window.resetCardHighlights === 'function') {
        window.resetCardHighlights();
      }
    }
  
    if (darkModeToggle) {
      darkModeToggle.addEventListener('change', function(e) {
        setDarkMode(darkModeToggle.checked);
        // (Redundant but safe: ensure highlights update after mode change)
        if (window.CardSystem && typeof window.resetCardHighlights === 'function') {
          window.resetCardHighlights();
        }
      });
    }
  
  
      // Detect device type
      const isMobile = window.innerWidth <= 768;
  
      // Create global CardSystem namespace
      window.CardSystem = {
          // Will be populated by common.js
          flipCards: null,
          container: null,
          activeCardIndex: 0,
          currentlyFlippedCard: null,
          isManuallyFlipping: false,
          isUserClicking: false
      };
  
      // Load common utilities first
      const commonScript = document.createElement('script');
      commonScript.src = 'assets/js/common.js?v=20250322';
  
      commonScript.onload = function() {
          // After common utilities load, load the platform-specific implementation
          const implementationScript = document.createElement('script');
          implementationScript.src = isMobile ?
              'assets/js/mobile.js?v=20250322' :
              'assets/js/desktop.js?v=20250322';
          document.body.appendChild(implementationScript);
      };
  
      document.body.appendChild(commonScript);
  
      // Handle resize events that might require switching implementations
      window.addEventListener('resize', () => {
          const currentIsMobile = window.innerWidth <= 768;
          if (currentIsMobile !== isMobile) {
              // Device type changed, force a hard reload to get the correct implementation
              window.location.href = window.location.href.split('#')[0] +
                  '?reload=' + Date.now();
          }
      });
  
      // --- Gyroscopic color effect for active card headline in dark mode ---
      (function() {
        // Only run on devices that support DeviceOrientationEvent
        if (typeof window.DeviceOrientationEvent !== 'function' && typeof window.DeviceOrientationEvent !== 'object') return;
  
        // Utility: interpolate between two hex colors
        function lerpColor(a, b, t) {
          const ah = a.replace('#','');
          const bh = b.replace('#','');
          const ar = parseInt(ah.substring(0,2),16), ag = parseInt(ah.substring(2,4),16), ab = parseInt(ah.substring(4,6),16);
          const br = parseInt(bh.substring(0,2),16), bg = parseInt(bh.substring(2,4),16), bb = parseInt(bh.substring(4,6),16);
          const rr = Math.round(ar + (br-ar)*t);
          const rg = Math.round(ag + (bg-ag)*t);
          const rb = Math.round(ab + (bb-ab)*t);
          return `#${rr.toString(16).padStart(2,'0')}${rg.toString(16).padStart(2,'0')}${rb.toString(16).padStart(2,'0')}`;
        }
  
        // Orange and tan
        const COLOR_ORANGE = '#e38d2c'; // warm orange
        const COLOR_TAN = '#c49b45'; // brown-gold tan
  
        function updateHeadlineColor(tilt) {
          // tilt: -90 (left) to +90 (right), normalize to 0-1
          const t = Math.max(0, Math.min(1, (tilt + 90) / 180));
          const color = lerpColor(COLOR_ORANGE, COLOR_TAN, t);
          // Only apply in dark mode
          if (document.documentElement.classList.contains('dark-mode')) {
            const headline = document.querySelector('.flip-card.active .flip-card-front h2');
            if (headline) headline.style.color = color;
          }
        }
  
        window.addEventListener('deviceorientation', function(event) {
          // gamma: left/right tilt (-90 to +90)
          if (typeof event.gamma === 'number') {
            updateHeadlineColor(event.gamma);
          }
        }, true);
  
        // Optionally: reset color on card flip or mode change
        function resetHeadlineColor() {
          const headline = document.querySelector('.flip-card.active .flip-card-front h2');
          if (headline) headline.style.color = '';
        }
        window.addEventListener('orientationchange', resetHeadlineColor);
        document.addEventListener('visibilitychange', resetHeadlineColor);
      })();
  });