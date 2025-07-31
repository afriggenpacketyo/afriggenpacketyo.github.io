(function() {
  const splashOverlay = document.getElementById('splash-overlay');
  const splashLogo = document.getElementById('splash-logo');
  const isMobile = 'ontouchstart' in window;

  if (!splashOverlay || !splashLogo) {
    console.warn("Splash: Elements not found. Aborting splash.");
    return;
  }

  /**
   * REVISED: This function now focuses ONLY on the visual splash animation
   * and delegates all layout/positioning responsibilities to other scripts.
   */
  function finalizeAppLoad() {
    console.log("Splash: Finalizing app load - hiding splash screen.");

    // Simply hide the splash overlay with a fade-out.
    // All layout and filtering logic is handled by other systems.
    splashOverlay.classList.add('splash-hide');
    setTimeout(() => {
      if (splashOverlay) splashOverlay.style.display = 'none';
      document.body.classList.remove('splash-active'); // Unlock the body
      console.log("Splash: Animation complete and body unlocked.");
    }, 500); // Match fade-out duration in splash.css
  }

  /**
   * This function contains all the logic to prepare and run the splash animation.
   */
  function runSplashAnimation() {
    // Re-grab these elements in case they weren't ready before
    const mainLogoContainer = document.querySelector('.logo-container');
    const mainSiteLogo = document.querySelector('.site-logo');

    // Helper functions for animation (unchanged)
    function setDesktopAnimationTarget() {
        // Only run this for desktop
        if (!isMobile && mainLogoContainer && mainSiteLogo) {
            const splashLogoInitialRect = splashLogo.getBoundingClientRect();
            if (splashLogoInitialRect.width === 0) return; // Don't calculate if hidden
            const splashLogoInitialVisualWidth = splashLogoInitialRect.width;
            const splashLogoInitialCenterY = splashLogoInitialRect.top + splashLogoInitialRect.height / 2;
            const finalLogoMaxWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--logo-max-width').replace('px', '')) || 80;
            const finalLogoTopOffset = parseFloat(getComputedStyle(mainLogoContainer).top.replace('px', '')) || 80;
            const desktopTargetScale = finalLogoMaxWidth / splashLogoInitialVisualWidth;
            const finalLogoHeightApproximation = finalLogoMaxWidth;
            const finalLogoTargetCenterY = finalLogoTopOffset + (finalLogoHeightApproximation / 2);
            const translateYValue = finalLogoTargetCenterY - splashLogoInitialCenterY + 16;
            splashLogo.style.setProperty('--splash-logo-desktop-translate-y', `${translateYValue}px`);
            splashLogo.style.setProperty('--splash-logo-desktop-scale', desktopTargetScale.toFixed(4));
        } else {
            splashLogo.style.removeProperty('--splash-logo-desktop-translate-y');
            splashLogo.style.removeProperty('--splash-logo-desktop-scale');
        }
    }

    function animateLogoAndWait(animationType) {
        return new Promise(resolve => {
            let animationEndHandler;
            let safetyTimeout;
            splashLogo.classList.remove('splash-animate', 'splash-bounce', 'splash-draw', 'splash-pixel', 'splash-spin');
            function cleanup() {
                splashLogo.removeEventListener('animationend', animationEndHandler);
                splashLogo.removeEventListener('transitionend', animationEndHandler);
                clearTimeout(safetyTimeout);
                resolve();
            }
            animationEndHandler = function(e) {
                if ((animationType === 'default' && e.propertyName === 'transform') || (animationType !== 'default' && e.animationName && e.animationName.startsWith('splash-'))) {
                    cleanup();
                }
            };
            splashLogo.addEventListener('animationend', animationEndHandler);
            splashLogo.addEventListener('transitionend', animationEndHandler);
            safetyTimeout = setTimeout(cleanup, 1600);
            setDesktopAnimationTarget(); // Recalculate just before animating
            const animationClass = animationType === 'default' ? 'splash-animate' : `splash-${animationType}`;
            splashLogo.classList.add(animationClass);
        });
    }

    // Get a random animation
    let animationOrder = JSON.parse(localStorage.getItem('splashAnimationOrder') || 'null');
    let nextIndex = parseInt(localStorage.getItem('splashAnimationIndex') || '0', 10);
    if (!animationOrder || nextIndex >= animationOrder.length) {
      animationOrder = ['default', 'pixel', 'spin', 'draw',];
      for (let i = animationOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [animationOrder[i], animationOrder[j]] = [animationOrder[j], animationOrder[i]];
      }
      localStorage.setItem('splashAnimationOrder', JSON.stringify(animationOrder));
      nextIndex = 0;
    }
    const chosenAnimation = animationOrder[nextIndex];
    localStorage.setItem('splashAnimationIndex', (nextIndex + 1).toString());

    // Run the animation and then finalize the app load.
    animateLogoAndWait(chosenAnimation).then(finalizeAppLoad);
  }

  /**
   * Preload the splash logo image and only show it once fully loaded
   */
  function preloadSplashLogo() {
    return new Promise((resolve, reject) => {
      // Hide the logo initially to prevent progressive loading visibility
      splashLogo.style.opacity = '0';
      
      // Create a new image object to preload
      const preloadImg = new Image();
      
      preloadImg.onload = () => {
        console.log("Splash: Logo image fully preloaded");
        // Now show the logo since it's fully loaded
        splashLogo.style.opacity = '1';
        resolve();
      };
      
      preloadImg.onerror = () => {
        console.warn("Splash: Failed to preload logo image, showing anyway");
        splashLogo.style.opacity = '1';
        resolve(); // Still resolve to continue with animation
      };
      
      // Start preloading by setting the src
      preloadImg.src = splashLogo.src;
      
      // Safety timeout in case image loading hangs
      setTimeout(() => {
        if (splashLogo.style.opacity === '0') {
          console.warn("Splash: Logo preload timeout, showing anyway");
          splashLogo.style.opacity = '1';
          resolve();
        }
      }, 3000); // 3 second timeout
    });
  }

  // --- Main Execution Logic ---
  // Body already has splash-active class from HTML to prevent initial scrollbar

  // First preload the logo image, then listen for pageReady
  preloadSplashLogo().then(() => {
    // Listen for a universal 'pageReady' event. This event should be fired by
    // the page-specific logic (e.g., about.js, or common.js for card layouts)
    // once all critical rendering and setup are complete.
    document.addEventListener('pageReady', () => {
      console.log("Splash: Received 'pageReady' event. Starting splash animation.");
      runSplashAnimation();
    }, { once: true });
  });

})();