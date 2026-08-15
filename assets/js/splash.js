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
   * ACTIVATION GATE (correctness-critical, intentionally has NO timeout).
   *
   * Chrome prerenders pages from the omnibox before the user presses Enter. Per
   * spec a prerendered document lays out using "the creation-time size of the
   * referring page as the viewport", so every viewport-derived measurement taken
   * during prerender is wrong:
   *   https://github.com/WICG/nav-speculation/blob/main/prerendering-same-site.md#rendering-related-behavior
   *
   * We must not run the splash (or let layout be measured) until activation.
   *
   * A timeout here would be actively harmful: it would let the splash run with
   * the bogus prerender viewport, which is the exact bug we are fixing. Waiting
   * forever is safe, because a prerender that is never activated is never shown
   * to the user.
   *
   * window.__whenActivated is created in the <head> of the document so the
   * prerenderingchange listener is registered before it can possibly fire.
   */
  function waitForActivation() {
    if (window.__whenActivated) return window.__whenActivated;
    // Fallback if the inline head gate is missing (e.g. another page reusing this
    // script): implement the canonical pattern locally.
    return new Promise((resolve) => {
      if (document.prerendering) {
        document.addEventListener('prerenderingchange', resolve, { once: true });
      } else {
        resolve();
      }
    });
  }

  /**
   * VISIBILITY GATE (cosmetic, so it IS allowed to give up).
   *
   * Distinct from activation. A page can be fully activated (or never prerendered)
   * yet still be in a background tab - e.g. opened via middle-click. There the
   * viewport is already correct, so layout is fine; the only issue is that the
   * splash animation would play unseen and rAF is throttled.
   *
   * Because this is purely about whether the user *watches* the animation, a
   * bounded wait is appropriate. If it expires we proceed rather than hang.
   */
  function waitForVisibility({ timeoutMs = 5000 } = {}) {
    if (document.visibilityState === 'visible') return Promise.resolve('visible');

    console.log('Splash: Page is in a hidden/background tab - deferring splash until viewed.');
    return new Promise((resolve) => {
      let settled = false;
      const finish = (reason) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        resolve(reason);
      };
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') finish('visibilitychange');
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      const timer = setTimeout(() => finish('visibility-timeout'), timeoutMs);
    });
  }

  /**
   * Wait until the viewport has actually settled, then resolve.
   *
   * This replaces blanket `setTimeout(..., 500)` guesswork. It returns on the very
   * next frame when the viewport is already stable (the overwhelmingly common
   * case), and only keeps waiting while the size is genuinely still changing -
   * e.g. a mobile URL bar collapsing right after activation.
   */
  function waitForStableViewport({ stableFrames = 3, maxMs = 1000 } = {}) {
    const read = () => (window.visualViewport ? window.visualViewport.height : window.innerHeight);
    return new Promise((resolve) => {
      const start = performance.now();
      let last = read();
      let stable = 0;
      const tick = () => {
        const now = read();
        if (Math.abs(now - last) < 2) {
          stable++;
        } else {
          stable = 0;
          last = now;
        }
        if (stable >= stableFrames) return resolve(now);
        if (performance.now() - start >= maxMs) {
          console.warn('Splash: viewport still changing after', maxMs + 'ms; proceeding at', now + 'px');
          return resolve(now);
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /**
   * REVISED: This function now focuses ONLY on the visual splash animation
   * and delegates all layout/positioning responsibilities to other scripts.
   * Idempotent: safe to call multiple times (normal flow + hard ceiling).
   */
  let splashFinalized = false;
  function finalizeAppLoad() {
    if (splashFinalized) return;
    splashFinalized = true;
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
   *
   * IMPORTANT: Every bail-out path MUST call finalizeAppLoad() so the splash
   * overlay is never left permanently visible. A "safety" check that traps the
   * user behind a frozen splash is worse than the glitch it tries to prevent.
   */
  function runSplashAnimation() {
    // ENHANCED safety check: Ensure DOM is fully ready and cards are positioned
    const hasCardSystem = document.querySelector('.container');
    if (hasCardSystem) {
      // For CardSystem pages, verify cards are positioned AND properly sized
      const activeCard = document.querySelector('.flip-card.active');
      if (!activeCard) {
        console.warn('Splash: Active card not found - skipping animation, dismissing splash');
        console.warn('Splash: Available cards:', document.querySelectorAll('.flip-card').length);
        console.warn('Splash: Cards with active class:', document.querySelectorAll('.flip-card.active').length);
        finalizeAppLoad();
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
          console.warn('Splash: Active card not properly sized - skipping animation, dismissing splash');
          console.warn('Splash: Active card rect:', rect);
          console.warn('Splash: Active card element:', activeCard);
          console.warn('Splash: Active card computed style display:', getComputedStyle(activeCard).display);
          console.warn('Splash: Active card computed style visibility:', getComputedStyle(activeCard).visibility);
          finalizeAppLoad();
          return;
        }
      }

      // Verify CardSystem is fully initialized
      if (!window.CardSystem || !window.CardSystem.isLayoutReady) {
        console.warn('Splash: CardSystem not ready - skipping animation, dismissing splash');
        finalizeAppLoad();
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

  /**
   * SHIMMER CYCLE TRACKER
   *
   * The shimmer is a translateX(-100%) -> translateX(100%) pass. Cutting it off
   * mid-sweep freezes the highlight band partway across the logo and then yanks
   * it away, which reads as a rendering glitch rather than a loading state. So
   * the splash is only ever dismissed on a cycle boundary: the shimmer always
   * runs a WHOLE number of sweeps, never a fraction of one.
   *
   * The shimmer keeps looping for as long as the app is still working (CSS
   * `infinite`), so a slow load simply gets more whole sweeps. The reveal is
   * then gated on: app fully ready  AND  current sweep finished.
   *
   * Must be started AFTER `is-loading` is added, since the ::after
   * pseudo-element (and therefore the animation) only exists while that class
   * is present.
   */
  function startShimmerTracking() {
    // The shimmer is purely decorative - never hold the page for it if the user
    // has asked for reduced motion, or if there is no wrapper to animate.
    const reducedMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !splashLogoWrapper) {
      return {
        enabled: false,
        cycleMs: 0,
        completedCycles: () => 0,
        waitForBoundary: () => Promise.resolve(reducedMotion ? 'reduced-motion' : 'no-wrapper')
      };
    }

    // Derive the cycle length from the CSS itself so the two can never drift
    // apart if the animation duration is retuned later.
    let cycleMs = 1500;
    try {
      const afterStyles = getComputedStyle(splashLogoWrapper, '::after');
      const declared = afterStyles.animationDuration;
      const parsed = parseFloat(declared);
      if (parsed > 0) cycleMs = declared.includes('ms') ? parsed : parsed * 1000;
    } catch (e) {
      /* fall back to the default above */
    }

    const startedAt = performance.now();
    let completed = 0;
    let pending = null;

    function settle(via) {
      if (!pending) return;
      const waiter = pending;
      pending = null;
      clearTimeout(waiter.timer);
      waiter.resolve(via);
    }

    // Animation events originating from a pseudo-element are dispatched on the
    // originating element (AnimationEvent.pseudoElement identifies the source).
    // `animationiteration` fires at every cycle boundary, so this both counts
    // whole sweeps and provides the exact moment it is safe to stop.
    splashLogoWrapper.addEventListener('animationiteration', (e) => {
      if (e.animationName !== 'shimmer') return;
      completed++;
      settle('animationiteration');
    });

    return {
      enabled: true,
      cycleMs,
      completedCycles: () => completed,

      /**
       * Resolve at the next cycle boundary. Because the first boundary is one
       * full cycle after the shimmer starts, this inherently guarantees at
       * least one whole sweep no matter how fast the app became ready.
       */
      waitForBoundary() {
        if (pending) return Promise.resolve('already-waiting');
        return new Promise((resolve) => {
          // Deterministic fallback: if animation events never arrive (compositor
          // suppression, pseudo-element event quirks) compute the time left in
          // the current cycle from elapsed time so this can never stall.
          const elapsed = performance.now() - startedAt;
          const remaining = cycleMs - (elapsed % cycleMs);
          const timer = setTimeout(() => {
            completed++;
            settle('boundary-timeout');
          }, remaining + 120);
          pending = { resolve, timer };
        });
      }
    };
  }

  // --- Main Execution Logic ---
  // Body already has splash-active class from HTML to prevent initial scrollbar

  // WATCHDOG: the splash must never be left covering the page forever.
  //
  // Note this deliberately starts only AFTER activation, not at script parse
  // time. A prerendered page can sit unactivated for a long time; starting the
  // clock during prerender would burn the whole budget before the user has even
  // pressed Enter, and would then dump them straight into an un-measured layout.
  // Shimmer cycle tracker, created once the shimmer actually starts. Declared
  // here because the reveal step needs it after the readiness barrier resolves.
  let shimmer = null;

  let watchdog = null;
  function startWatchdog(ms) {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      console.warn(`Splash: watchdog fired after ${ms}ms - dismissing splash to avoid trapping the user`);
      if (splashLogoWrapper) splashLogoWrapper.classList.remove('is-loading');
      finalizeAppLoad();
    }, ms);
  }

  // STEP 1: Wait for activation. Until this resolves the viewport is a lie, so
  // nothing may measure layout and no animation may run. No timeout by design.
  waitForActivation().then(() => {
    if (window.__wasPrerendered) {
      console.log('Splash: page was prerendered; proceeding only now that it is activated.');
    }
    // STEP 2: Don't animate into a background tab.
    return waitForVisibility();
  }).then(() => {
    // From here on the page is genuinely on screen, so start the safety clock.
    startWatchdog(10000);

    // STEP 3: The viewport is only authoritative once the page is actually
    // presented. On activation the document is swapped into a tab that may be a
    // different size than the prerender viewport, and on mobile the URL bar can
    // still be settling. Resolve as soon as it is stable rather than guessing.
    return waitForStableViewport();
  }).then((viewportHeight) => {
    console.log('Splash: viewport settled at', viewportHeight + 'px - now preloading logo');
    return preloadSplashLogo();
  }).then(() => {
    if (splashLogoWrapper) splashLogoWrapper.classList.add('is-loading');
    // Start counting sweeps from the same moment the shimmer starts, so the
    // cycle boundaries we later align to are the real ones.
    shimmer = startShimmerTracking();
    console.log("Splash: Logo preloaded. Shimmering started.");

    // DOM-ready gate. Cheap, and guarantees we never reveal a document whose
    // markup is still being parsed.
    //
    // Deliberately NOT window.load: that also waits on ad iframes and images,
    // which on this page includes AdSense. Those can take many seconds and have
    // nothing to do with whether the app is usable, so blocking the reveal on
    // them would strand the user behind the splash for unrelated reasons.
    const domReadyPromise = document.readyState === 'loading'
      ? new Promise(resolve => document.addEventListener('DOMContentLoaded',
          () => resolve('DOMContentLoaded'), { once: true }))
      : Promise.resolve('dom-already-parsed');

    // Readiness barrier: wait for the app to report that it has measured and
    // laid itself out. There is no artificial minimum hold - the splash lasts
    // exactly as long as the work actually takes.
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

    // Everything that means "the app is genuinely ready to be looked at".
    // The shimmer keeps sweeping underneath while these settle.
    return Promise.all([appReadyPromise, domReadyPromise]);
  }).then(([readyVia, domVia]) => {
    // The app is fully ready and the DOM is parsed. Now let the sweep that is
    // currently in flight run to its end, so the shimmer always completes a
    // whole number of cycles instead of being guillotined mid-band.
    //
    // This is the ONLY place the splash is intentionally held past readiness,
    // and it is bounded by exactly one cycle (~1.5s worst case, 0 if we happen
    // to land on a boundary).
    console.log(`Splash: app ready via "${readyVia}" (dom: "${domVia}") after ${shimmer.completedCycles()} whole sweep(s) - letting the current sweep finish.`);
    // Re-arm the watchdog with a budget sized to this specific hold, so the
    // safety net can't pre-empt a wait we know to be bounded (and so it stays
    // tight rather than inheriting whatever was left of the original 10s).
    startWatchdog((shimmer.cycleMs || 0) + 1000);
    return shimmer.waitForBoundary().then((boundaryVia) => ({ readyVia, boundaryVia }));
  }).then(({ readyVia, boundaryVia }) => {
    clearTimeout(watchdog);
    console.log(`Splash: ${shimmer.completedCycles()} whole shimmer cycle(s) completed (boundary via "${boundaryVia}"), app ready via "${readyVia}". Revealing.`);
    // Stop the shimmer exactly on the boundary and run the main animation.
    if (splashLogoWrapper) splashLogoWrapper.classList.remove('is-loading');
    runSplashAnimation();
  }).catch((error) => {
    // Even on critical errors, we must dismiss the splash. Leaving it visible
    // traps the user with no recovery path.
    clearTimeout(watchdog);
    console.error("Splash: Critical error during initialization:", error);
    console.error("Splash: Dismissing splash despite error to avoid trapping the user.");
    if (splashLogoWrapper) splashLogoWrapper.classList.remove('is-loading');
    finalizeAppLoad();
  });

})();