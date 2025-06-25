// --- START OF FILE splash.js ---

(function() {
  const splashOverlay = document.getElementById('splash-overlay');
  const splashLogo = document.getElementById('splash-logo');
  const isMobile = window.innerWidth <= 932 && 'ontouchstart' in window;

  if (!splashOverlay || !splashLogo) {
    console.warn("Splash elements not found. Aborting splash.");
    return;
  }

  /**
   * This function performs the final steps after the splash animation is complete.
   * It reveals the page, recenters cards, and applies filters.
   */
  function finalizeAppLoad() {
    console.log("Finalizing app load: Hiding splash, recentering cards, applying filters.");

    // 1. Hide the splash overlay with a fade-out.
    splashOverlay.classList.add('splash-hide');
    setTimeout(() => {
      if (splashOverlay) splashOverlay.style.display = 'none';
      document.body.classList.remove('splash-active'); // Unlock the body
    }, 500); // Match fade-out duration in splash.css

    // 2. Force a final, perfect re-centering of the card carousel.
    if (window.CardSystem && typeof window.CardSystem.forceRecenter === 'function') {
      window.CardSystem.forceRecenter();
    }

    // 3. Notify the filter system that it's now safe to run its auto-apply logic.
    if (typeof window.filtersCompleteInitialization === 'function') {
      window.filtersCompleteInitialization();
    }
  }

  /**
   * This function contains all the logic to prepare and run the splash animation.
   */
  function runSplashAnimation() {
    // Re-grab these elements in case they weren't ready before
    const mainLogoContainer = document.querySelector('.logo-container');
    const mainSiteLogo = document.querySelector('.site-logo');

    // (The helper functions for animation remain the same as your original file)
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
      animationOrder = ['default', 'pixel', 'spin'];
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

  // On desktop, the layout is ready almost instantly. We don't need to wait.
  if (!isMobile) {
    console.log("Desktop detected. Running splash animation immediately.");
    // We still wait for the page to be fully loaded to get correct logo positions.
    window.addEventListener('load', runSplashAnimation, { once: true });
  } else {
    // On mobile, we MUST wait for the layout to be ready.
    console.log("Mobile detected. Waiting for 'mobileLayoutReady' event...");
    document.addEventListener('mobileLayoutReady', () => {
      console.log("Splash.js received 'mobileLayoutReady'. Starting splash animation.");
      runSplashAnimation();
    }, { once: true });
  }

})();