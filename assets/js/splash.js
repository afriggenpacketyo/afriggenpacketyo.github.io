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
                if ((animationType === 'default' && e.propertyName === 'transform') || (animationType !== 'default' && e.animationName.startsWith('splash-'))) {
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

  // --- Main Execution Logic ---
  document.body.classList.add('splash-active');

  // Listen for a universal 'pageReady' event. This event should be fired by
  // the page-specific logic (e.g., about.js, or common.js for card layouts)
  // once all critical rendering and setup are complete.
  document.addEventListener('pageReady', () => {
    console.log("Splash: Received 'pageReady' event. Starting splash animation.");
    runSplashAnimation();
  }, { once: true });

})();