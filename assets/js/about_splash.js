(function() {
  const splashOverlay = document.getElementById('splash-overlay');
  const splashLogo = document.getElementById('splash-logo');
  const isMobile = 'ontouchstart' in window;

  if (!splashOverlay || !splashLogo) {
    console.warn("About Splash: Elements not found. Aborting splash.");
    return;
  }

  function finalizePageLoad() {
    splashOverlay.classList.add('splash-hide');
    setTimeout(() => {
      if (splashOverlay) splashOverlay.style.display = 'none';
      document.body.classList.remove('splash-active');
    }, 500); // Match fade-out duration
  }

  function runSplashAnimation() {
    const mainLogoContainer = document.querySelector('.logo-container');
    const mainSiteLogo = document.querySelector('.site-logo');

    function setDesktopAnimationTarget() {
        if (!isMobile && mainLogoContainer && mainSiteLogo) {
            const splashLogoInitialRect = splashLogo.getBoundingClientRect();
            if (splashLogoInitialRect.width === 0) return;
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
            setDesktopAnimationTarget();
            const animationClass = animationType === 'default' ? 'splash-animate' : `splash-${animationType}`;
            splashLogo.classList.add(animationClass);
        });
    }

    let animationOrder = JSON.parse(localStorage.getItem('splashAnimationOrder') || 'null');
    let nextIndex = parseInt(localStorage.getItem('splashAnimationIndex') || '0', 10);
    if (!animationOrder || nextIndex >= animationOrder.length) {
      animationOrder = ['default', 'pixel', 'spin', 'draw'];
      for (let i = animationOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [animationOrder[i], animationOrder[j]] = [animationOrder[j], animationOrder[i]];
      }
      localStorage.setItem('splashAnimationOrder', JSON.stringify(animationOrder));
      nextIndex = 0;
    }
    const chosenAnimation = animationOrder[nextIndex];
    localStorage.setItem('splashAnimationIndex', (nextIndex + 1).toString());

    animateLogoAndWait(chosenAnimation).then(finalizePageLoad);
  }

  document.body.classList.add('splash-active');

  // For the simpler about page, we can trigger the animation once the DOM is ready.
  document.addEventListener('DOMContentLoaded', () => {
    console.log("About Splash: DOM ready. Starting splash animation.");
    runSplashAnimation();
  }, { once: true });

})();
