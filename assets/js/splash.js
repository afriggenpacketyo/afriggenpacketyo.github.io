(function() {
  const splashOverlay = document.getElementById('splash-overlay');
  const splashLogo = document.getElementById('splash-logo');
  const splashLogoWrapper = splashLogo ? splashLogo.parentElement : null;
  const isMobile = 'ontouchstart' in window;

  if (!splashOverlay || !splashLogo) {
    console.warn("Splash: Elements not found. Aborting splash.");
    return;
  }

  /**
   * PAGE VISIBILITY GATE: Ensures splash NEVER runs until page is actually visible.
   * This prevents Chrome autocomplete preloading from "stealing" the splash animation.
   * Returns a Promise that resolves only when the page becomes visible.
   */
  function waitForPageVisibility() {
    return new Promise((resolve) => {
      // If page is already visible, resolve immediately
      if (document.visibilityState === 'visible') {
        console.log('Splash: Page is visible, proceeding immediately');
        resolve();
        return;
      }

      // Page is hidden (prerendered/preloaded) - wait for it to become visible
      console.log('Splash: Page is HIDDEN (prerendered/preloaded) - waiting for visibility...');
      console.log('Splash: Current visibilityState:', document.visibilityState);

      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log('Splash: Page became VISIBLE - starting splash sequence now');
          document.removeEventListener('visibilitychange', onVisibilityChange);
          // Small delay to let browser fully transition
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        }
      };

      document.addEventListener('visibilitychange', onVisibilityChange);
    });
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
    // ENHANCED safety check: Ensure DOM is fully ready and cards are positioned
    const hasCardSystem = document.querySelector('.container');
    if (hasCardSystem) {
      // For CardSystem pages, verify cards are positioned AND properly sized
      const activeCard = document.querySelector('.flip-card.active');
      if (!activeCard) {
        console.warn('Splash: Active card not found, cannot start animation');
        console.warn('Splash: Available cards:', document.querySelectorAll('.flip-card').length);
        console.warn('Splash: Cards with active class:', document.querySelectorAll('.flip-card.active').length);
        return;
      }

      // Verify the card has proper dimensions (not collapsed)
      const rect = activeCard.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        // Check if the card is filtered (hidden by filters)
        if (activeCard.classList.contains('filtered')) {
          console.log('Splash: Active card is filtered, proceeding with animation anyway');
          // Continue with animation even if active card is filtered
        } else {
          console.warn('Splash: Active card not properly sized, cannot start animation');
          console.warn('Splash: Active card rect:', rect);
          console.warn('Splash: Active card element:', activeCard);
          console.warn('Splash: Active card computed style display:', getComputedStyle(activeCard).display);
          console.warn('Splash: Active card computed style visibility:', getComputedStyle(activeCard).visibility);
          return;
        }
      }

      // Verify CardSystem is fully initialized
      if (!window.CardSystem || !window.CardSystem.isLayoutReady) {
        console.warn('Splash: CardSystem not ready, cannot start animation');
        return;
      }
    }

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
            let endedBy = 'unknown';
            splashLogo.classList.remove('splash-animate', 'splash-bounce', 'splash-draw', 'splash-pixel', 'splash-spin');
            function cleanup() {
                splashLogo.removeEventListener('animationend', animationEndHandler);
                splashLogo.removeEventListener('transitionend', animationEndHandler);
                clearTimeout(safetyTimeout);
                console.log(`Splash: Logo animation finished via ${endedBy}.`);
                resolve();
            }
            animationEndHandler = function(e) {
                if ((animationType === 'default' && e.propertyName === 'transform') || (animationType !== 'default' && e.animationName && e.animationName.startsWith('splash-'))) {
                    endedBy = e.type === 'animationend' ? 'animationend' : 'transitionend';
                    cleanup();
                }
            };
            splashLogo.addEventListener('animationend', animationEndHandler);
            splashLogo.addEventListener('transitionend', animationEndHandler);
            safetyTimeout = setTimeout(() => { endedBy = 'safety-timeout'; cleanup(); }, 1600);
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
    return new Promise((resolve) => {
      // The logo is hidden by default with CSS (opacity: 0)

      const preloadImg = new Image();

      function showLogoAndWaitForFadeIn() {
        // Add visible class to trigger CSS opacity transition
        if (!splashLogo.classList.contains('is-visible')) {
          splashLogo.classList.add('is-visible');
        }

        // Compute transition duration for a precise safety timeout
        const styles = getComputedStyle(splashLogo);
        const durations = styles.transitionDuration.split(',').map(s => parseFloat(s) || 0);
        const maxDurationSec = durations.length ? Math.max(...durations) : 0;
        const safetyMs = Math.max(300, Math.round(maxDurationSec * 1000) + 50);

        // If there is no transition or opacity is already at 1, resolve immediately
        const currentOpacity = parseFloat(styles.opacity);
        const hasTransition = maxDurationSec > 0;
        if (!hasTransition || currentOpacity >= 1) {
          resolve();
          return;
        }

        let resolved = false;
        const onEnd = (e) => {
          if (resolved) return;
          if (!e || e.propertyName === 'opacity') {
            resolved = true;
            splashLogo.removeEventListener('transitionend', onEnd);
            clearTimeout(timer);
            resolve();
          }
        };
        const timer = setTimeout(() => onEnd(null), safetyMs);
        splashLogo.addEventListener('transitionend', onEnd);
      }

      preloadImg.onload = () => {
        console.log("Splash: Logo image fully preloaded");
        showLogoAndWaitForFadeIn();
      };

      preloadImg.onerror = () => {
        console.warn("Splash: Failed to preload logo image, showing anyway");
        showLogoAndWaitForFadeIn(); // Still proceed, but ensure fade-in completes
      };

      // Start preloading by setting the src
      preloadImg.src = splashLogo.src;
    });
  }

  // --- Main Execution Logic ---
  // Body already has splash-active class from HTML to prevent initial scrollbar

  // CRITICAL: Wait for page visibility FIRST before doing ANYTHING
  // This ensures Chrome autocomplete preloading can't steal the splash
  waitForPageVisibility().then(() => {
    console.log('Splash: Visibility confirmed - now preloading logo');

    // First preload the logo image, then start the animation
    return preloadSplashLogo();
  }).then(() => {
    // Logo is preloaded, start the shimmer animation.
    if (splashLogoWrapper) splashLogoWrapper.classList.add('is-loading');
    console.log("Splash: Logo preloaded. Shimmering started.");

    // Readiness barriers
    // 1) Minimum visual hold
    const minHoldPromise = new Promise(resolve => setTimeout(resolve, 1500));

    // 2) App-ready gate - purely event-driven
    const appReadyPromise = new Promise((resolve, reject) => {
      // Check if we're on a CardSystem page (has .container)
      const hasCardSystem = document.querySelector('.container');

      if (hasCardSystem) {
        // For CardSystem pages, wait for pageReady event which guarantees everything is positioned
        let timeoutId;
        const onPageReady = () => {
          console.log('Splash: pageReady event received - all systems ready');
          if (timeoutId) clearTimeout(timeoutId);
          resolve('pageReady');
        };

        if (window.__pageReadyFired) {
          console.log('Splash: pageReady already fired');
          resolve('pageReady');
        } else {
          document.addEventListener('pageReady', onPageReady, { once: true });

          // Safety timeout - if pageReady doesn't fire within 5 seconds, proceed anyway
          timeoutId = setTimeout(() => {
            console.warn('Splash: pageReady timeout - proceeding with animation anyway');
            resolve('pageReady-timeout');
          }, 5000);
        }
      } else {
        // For simple pages, determine the correct readiness event
        if (document.body.classList.contains('about-page')) {
          // For about.html, wait for its specific ready signal which includes image preloading
          const onAboutPageReady = () => {
            console.log('Splash: AppReady resolved via aboutPageReady event.');
            resolve('aboutPageReady');
          };

          if (window.__aboutPageReadyFired) {
            onAboutPageReady();
          } else {
            document.addEventListener('aboutPageReady', onAboutPageReady, { once: true });
          }
        } else {
          // Fallback for any other simple pages: wait for CSS or document ready
          const onAllCSS = () => {
            console.log('Splash: AppReady resolved via allCSSLoaded event.');
            resolve('allCSSLoaded');
          };

          if (window.__allCSSLoadedFired || document.readyState === 'complete') {
            onAllCSS();
          } else {
            document.addEventListener('allCSSLoaded', onAllCSS, { once: true });
          }
        }
      }
    });

    // Wait for both the minimum time and the app readiness barrier
    Promise.all([minHoldPromise, appReadyPromise]).then(() => {
      console.log("Splash: Minimum hold elapsed and AppReady met. Starting animation.");
      // Stop the shimmer and run the main animation.
      if (splashLogoWrapper) splashLogoWrapper.classList.remove('is-loading');
      runSplashAnimation();
    }).catch((error) => {
      console.error("Splash: Critical error during initialization:", error);
      console.error("Splash: Cannot proceed without proper initialization - splash will remain visible");
      // Don't proceed if we can't guarantee proper initialization
      // The user will see the splash screen, indicating something is wrong
    });
  });

})();