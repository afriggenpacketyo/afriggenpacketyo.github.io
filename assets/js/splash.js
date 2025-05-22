// Splash overlay logic for animated entry
(function() {
  // First, ensure the UI is never locked by splash
  document.body.classList.remove('splash-active');
  
  const splashOverlay = document.getElementById('splash-overlay');
  const splashLogo = document.getElementById('splash-logo');
  const mainLogoContainer = document.querySelector('.logo-container');
  const mainSiteLogo = document.querySelector('.site-logo');
  const mainHeaderLogoContainer = document.querySelector('.header-logo-container');

  if (!splashOverlay || !splashLogo) {
    console.warn("Splash overlay or logo not found.");
    return;
  }

  // Check if we should skip the splash (widescreen mobile)
  function shouldSkipSplash() {
    // Check if mobile device (touch support and small screen)
    const isMobile = 'ontouchstart' in window && 
                   (window.innerWidth <= 1024 || 
                    window.innerHeight <= 768);
    
    // Check if in landscape mode with widescreen aspect ratio (wider than 16:9)
    const isWidescreen = window.innerWidth > window.innerHeight * 1.8; // Wider than 16:9
    
    return isMobile && isWidescreen;
  }

  // Skip splash if on widescreen mobile
  if (shouldSkipSplash()) {
    // Just remove the splash overlay and let mobile.js handle the header visibility
    if (splashOverlay) {
      splashOverlay.remove();
    }
    return; // Exit early, don't show splash
  }
  
  // Only add splash-active if we're actually showing the splash
  document.body.classList.add('splash-active');

  // Helper: Wait for all images, fonts, and layout settle
  function pageSettledPromise() {
    return new Promise(resolve => {
      if (document.readyState !== 'complete') {
        window.addEventListener('load', resolve, { once: true });
      } else {
        resolve();
      }
    }).then(() => {
      const imgs = Array.from(document.images);
      const imagePromises = imgs
        .filter(img => !img.complete)
        .map(img => new Promise(res => {
          img.addEventListener('load', res, { once: true });
          img.addEventListener('error', res, { once: true });
        }));
      return Promise.all(imagePromises);
    }).then(() => {
      return new Promise(res => requestAnimationFrame(res)); // Layout settle
    });
  }

  // Function to calculate and set desktop animation target
  function setDesktopAnimationTarget() {
    if (window.innerWidth > 768 && mainLogoContainer && mainSiteLogo) {
      // Get dimensions and positions AFTER page has settled
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Splash logo initial state (it's flex-centered in splash-overlay)
      // Its visual width is 90vw or its max-width
      const splashLogoInitialRect = splashLogo.getBoundingClientRect();
      const splashLogoInitialVisualWidth = splashLogoInitialRect.width; // Actual rendered width
      const splashLogoInitialCenterY = splashLogoInitialRect.top + splashLogoInitialRect.height / 2;

      // Desktop final logo state
      const finalLogoMaxWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--logo-max-width').replace('px', '')) || 80;
      const finalLogoTopOffset = parseFloat(getComputedStyle(mainLogoContainer).top.replace('px','')) || 
                                 parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--logo-top').replace('px','')) || 80;


      // Calculate final scale for desktop
      // We want the splashLogo (original natural width might be large) to scale down to appear as `finalLogoMaxWidth`
      // This assumes the site-logo also respects aspect ratio.
      // If splashLogo's naturalWidth is W_natural, and its initial display width is W_displayed (90vw or max-width)
      // and we want its final display width to be D_final (80px).
      // The scale applied is relative to its CURRENT displayed size if transform-origin is center.
      // Scale = TargetDisplayWidth / CurrentDisplayWidth
      const desktopTargetScale = finalLogoMaxWidth / splashLogoInitialVisualWidth;

      // Calculate final Y translation for desktop
      // Target center Y of the logo: top offset of .logo-container + half of final logo height
      // The .site-logo inside .logo-container will determine its own height based on its width and aspect ratio.
      // For simplicity, let's assume the final logo is roughly square or its height is similar to its width.
      const finalLogoHeightApproximation = finalLogoMaxWidth; // Adjust if aspect ratio is very different
      const finalLogoTargetCenterY = finalLogoTopOffset + (finalLogoHeightApproximation / 2);
      
      const translateYValue = finalLogoTargetCenterY - splashLogoInitialCenterY +16;

      splashLogo.style.setProperty('--splash-logo-desktop-translate-y', `${translateYValue}px`);
      splashLogo.style.setProperty('--splash-logo-desktop-scale', desktopTargetScale.toFixed(4));
      
      console.log(`Desktop Splash Target: Scale=${desktopTargetScale.toFixed(4)}, TranslateY=${translateYValue}px`);
    } else if (window.innerWidth <= 768 && mainHeaderLogoContainer) {
        // For mobile, CSS handles it with translateY(-45vh) scale(0.18)
        // But we might want to dynamically calculate scale if aspect ratios are an issue.
        // For now, let's assume CSS `scale(0.18)` is visually correct for mobile.
        // We just need to ensure the default .splash-animate class is used.
        // Clear any desktop specific inline vars if they were set from a previous resize.
        splashLogo.style.removeProperty('--splash-logo-desktop-translate-y');
        splashLogo.style.removeProperty('--splash-logo-desktop-scale');
        console.log("Mobile Splash Target: Using CSS default animation values.");

    }
  }

  // Function to animate logo and wait for animation to complete
  function animateLogoAndWait() {
    return new Promise(resolve => {
      function onTransitionEnd(e) {
        if (e.propertyName === 'transform') { // Only listen for transform
          splashLogo.removeEventListener('transitionend', onTransitionEnd);
          clearTimeout(safetyTimeout); // Clear safety timeout
          resolve();
        }
      }
      
      splashLogo.addEventListener('transitionend', onTransitionEnd);
      
      const safetyTimeout = setTimeout(() => {
        console.warn("Splash logo transitionend fallback timeout triggered.");
        splashLogo.removeEventListener('transitionend', onTransitionEnd);
        resolve();
      }, 1200); // Slightly longer than 1.1s animation

      // Recalculate target just before animating, in case of resize during page load
      setDesktopAnimationTarget(); 
      
      // Start the animation
      splashLogo.classList.add('splash-animate'); // This triggers the CSS transform
    });
  }

  pageSettledPromise().then(() => {
    // Initial calculation and setup of desktop target on page load
    setDesktopAnimationTarget();

    // Add resize listener to update desktop target if viewport changes before animation starts
    // or if a user resizes during the splash (though less likely).
    // Debounce resize for performance
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (!splashLogo.classList.contains('splash-animate')) { // Only recalc if not yet animating
                 setDesktopAnimationTarget();
            }
        }, 100);
    });

    setTimeout(() => {
      animateLogoAndWait().then(() => {
        splashOverlay.classList.add('splash-hide');
        setTimeout(() => {
          splashOverlay.style.display = 'none';
          document.body.classList.remove('splash-active');
        }, 500); // Match overlay fade duration
      });
    }, 300); // Small delay for dramatic effect
  });
})();