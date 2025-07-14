// Dynamic Splash Animation Manager
// Calculates splash logo positioning based on actual header logo position

class SplashManager {
    constructor() {
        this.splashOverlay = null;
        this.splashLogo = null;
        this.headerLogo = null;
        this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.isInitialized = false;

        this.init();
    }

    init() {
        // Wait for DOM and header height manager
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.splashOverlay = document.getElementById('splash-overlay');
        this.splashLogo = document.getElementById('splash-logo');
        this.headerLogo = document.querySelector('.header-logo') || document.querySelector('.site-logo');

        if (!this.splashOverlay || !this.splashLogo) {
            console.warn('SplashManager: Splash elements not found');
            return;
        }

        // Calculate dynamic positioning
        this.calculateSplashPositioning();

        // Set up event listeners
        this.setupEventListeners();

        // Start splash animation
        this.startSplashAnimation();

        this.isInitialized = true;
        console.log('SplashManager: Initialized with dynamic positioning');
    }

    calculateSplashPositioning() {
        // Wait for header height manager to be available
        if (window.headerHeightManager) {
            this.calculateWithHeaderManager();
        } else {
            // Fallback calculation
            this.calculateFallback();
        }
    }

    calculateWithHeaderManager() {
        const headerHeight = window.headerHeightManager.getHeight();
        const headerLogo = this.headerLogo;

        if (!headerLogo) {
            console.warn('SplashManager: Header logo not found, using fallback positioning');
            this.calculateFallback();
            return;
        }

        // Get header logo dimensions and position
        const headerLogoRect = headerLogo.getBoundingClientRect();
        const headerLogoWidth = headerLogoRect.width;
        const headerLogoHeight = headerLogoRect.height;

        // Calculate splash logo dimensions
        const splashLogoRect = this.splashLogo.getBoundingClientRect();
        const splashLogoWidth = splashLogoRect.width;
        const splashLogoHeight = splashLogoRect.height;

        // Calculate scale factor
        const scaleX = headerLogoWidth / splashLogoWidth;
        const scaleY = headerLogoHeight / splashLogoHeight;
        const scale = Math.min(scaleX, scaleY); // Maintain aspect ratio

        // Calculate position
        const viewportHeight = window.innerHeight;
        const splashLogoCenterY = viewportHeight / 2;
        const headerLogoCenterY = headerLogoRect.top + (headerLogoHeight / 2);

        const translateY = headerLogoCenterY - splashLogoCenterY;
        const translateYVh = (translateY / viewportHeight) * 100;

        // Set CSS custom properties
        const root = document.documentElement;

        if (this.isMobile) {
            root.style.setProperty('--splash-logo-mobile-scale', scale.toFixed(3));
            root.style.setProperty('--splash-logo-mobile-translate-y', `${translateYVh.toFixed(2)}vh`);
        } else {
            root.style.setProperty('--splash-logo-desktop-scale', scale.toFixed(3));
            root.style.setProperty('--splash-logo-desktop-translate-y', `${translateYVh.toFixed(2)}vh`);
        }

        console.log('SplashManager: Dynamic positioning calculated', {
            scale: scale.toFixed(3),
            translateY: `${translateYVh.toFixed(2)}vh`,
            headerHeight,
            isMobile: this.isMobile
        });
    }

    calculateFallback() {
        // Fallback values when header height manager is not available
        const root = document.documentElement;

        if (this.isMobile) {
            root.style.setProperty('--splash-logo-mobile-scale', '0.18');
            root.style.setProperty('--splash-logo-mobile-translate-y', '-45vh');
        } else {
            root.style.setProperty('--splash-logo-desktop-scale', '0.08');
            root.style.setProperty('--splash-logo-desktop-translate-y', '-35vh');
        }

        console.log('SplashManager: Using fallback positioning');
    }

    setupEventListeners() {
        // Recalculate on resize
        window.addEventListener('resize', () => {
            this.debounceRecalculate();
        });

        // Recalculate on orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.calculateSplashPositioning();
            }, 100);
        });

        // Listen for header height changes
        if (window.headerHeightManager) {
            window.headerHeightManager.addObserver(() => {
                this.calculateSplashPositioning();
            });
        }
    }

    debounceRecalculate() {
        if (this.recalculateTimer) {
            clearTimeout(this.recalculateTimer);
        }

        this.recalculateTimer = setTimeout(() => {
            this.calculateSplashPositioning();
        }, 100);
    }

    startSplashAnimation() {
        // Add splash-active class to body
        document.body.classList.add('splash-active');

        // Start animation after a brief delay
        setTimeout(() => {
            this.animateSplash();
        }, 100);
    }

    animateSplash() {
        if (!this.splashLogo) return;

        // Add animation class to trigger CSS animation
        this.splashLogo.classList.add('splash-animate');

        // Hide splash overlay after animation completes
        setTimeout(() => {
            this.hideSplash();
        }, 1000); // Adjust timing based on animation duration
    }

    hideSplash() {
        if (this.splashOverlay) {
            this.splashOverlay.classList.add('splash-hide');
            document.body.classList.remove('splash-active');

            // Remove splash overlay from DOM after transition
            setTimeout(() => {
                if (this.splashOverlay && this.splashOverlay.parentNode) {
                    this.splashOverlay.parentNode.removeChild(this.splashOverlay);
                }
            }, 500);
        }
    }

    // Public methods
    forceRecalculate() {
        this.calculateSplashPositioning();
    }

    skipSplash() {
        this.hideSplash();
    }
}

// Initialize splash manager
window.splashManager = new SplashManager();

// Also export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SplashManager;
}
