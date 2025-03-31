document.addEventListener('DOMContentLoaded', function() {
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
});