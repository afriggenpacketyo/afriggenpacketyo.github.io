// Header Height Manager - Robust dynamic header height calculation
// This script eliminates magic numbers and provides accurate header spacing

class HeaderHeightManager {
    constructor() {
        this.headerElement = null;
        this.currentHeight = 0;
        this.observers = [];
        this.isInitialized = false;
        this.debounceTimer = null;
        
        // Centralized device detection
        this.deviceInfo = this.detectDevice();
        this.setGlobalDeviceInfo();

        // Bind methods
        this.handleResize = this.handleResize.bind(this);
        this.handleOrientationChange = this.handleOrientationChange.bind(this);
        this.calculateHeight = this.calculateHeight.bind(this);

        this.init();
    }
    
    // Centralized device detection method
    detectDevice() {
        const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isTablet = isMobile && Math.min(window.innerWidth, window.innerHeight) >= 768;
        const isDesktop = !isMobile;
        const isLandscape = window.innerWidth > window.innerHeight;
        const isPortrait = !isLandscape;
        
        // Specific mobile landscape detection for header hiding
        const isPhoneLandscape = window.matchMedia("(max-height: 500px) and (min-width: 400px) and (max-width: 1024px) and (orientation: landscape) and (hover: none) and (pointer: coarse)").matches;
        
        return {
            isMobile,
            isTablet,
            isDesktop,
            isLandscape,
            isPortrait,
            isPhoneLandscape,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            aspectRatio: window.innerWidth / window.innerHeight
        };
    }
    
    // Set global device info for other scripts to use
    setGlobalDeviceInfo() {
        // Make device info globally available
        window.deviceInfo = this.deviceInfo;
        
        // Set CSS custom properties for device-specific values
        const root = document.documentElement;
        
        // Device type classes
        root.classList.toggle('is-mobile', this.deviceInfo.isMobile);
        root.classList.toggle('is-tablet', this.deviceInfo.isTablet);
        root.classList.toggle('is-desktop', this.deviceInfo.isDesktop);
        root.classList.toggle('is-landscape', this.deviceInfo.isLandscape);
        root.classList.toggle('is-portrait', this.deviceInfo.isPortrait);
        root.classList.toggle('is-phone-landscape', this.deviceInfo.isPhoneLandscape);
        
        // Device-specific spacing variables (NO MORE MAGIC NUMBERS!)
        if (this.deviceInfo.isMobile) {
            root.style.setProperty('--device-section-padding', '1rem');
            root.style.setProperty('--device-card-gap', '1rem');
            root.style.setProperty('--device-text-scale', '1');
            root.style.setProperty('--device-header-extra-padding', '1rem');
        } else if (this.deviceInfo.isTablet) {
            root.style.setProperty('--device-section-padding', '1.5rem');
            root.style.setProperty('--device-card-gap', '1.5rem');
            root.style.setProperty('--device-text-scale', '1.1');
            root.style.setProperty('--device-header-extra-padding', '2rem');
        } else {
            root.style.setProperty('--device-section-padding', '2rem');
            root.style.setProperty('--device-card-gap', '2rem');
            root.style.setProperty('--device-text-scale', '1.2');
            root.style.setProperty('--device-header-extra-padding', '3rem');
        }
        
        // Screen dimension variables
        root.style.setProperty('--screen-width', this.deviceInfo.screenWidth + 'px');
        root.style.setProperty('--screen-height', this.deviceInfo.screenHeight + 'px');
        root.style.setProperty('--aspect-ratio', this.deviceInfo.aspectRatio.toFixed(2));
        
        console.log('HeaderHeightManager: Device info set', this.deviceInfo);
    }
    
    // Update device info on resize/orientation change
    updateDeviceInfo() {
        const oldDeviceInfo = { ...this.deviceInfo };
        this.deviceInfo = this.detectDevice();
        
        // Only update if device info actually changed
        if (JSON.stringify(oldDeviceInfo) !== JSON.stringify(this.deviceInfo)) {
            this.setGlobalDeviceInfo();
            console.log('HeaderHeightManager: Device info updated', this.deviceInfo);
        }
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        this.headerElement = document.querySelector('.page-header');

        if (!this.headerElement) {
            console.warn('HeaderHeightManager: No .page-header element found');
            return;
        }

        // Initial calculation
        this.calculateHeight();

        // Set up event listeners
        this.setupEventListeners();

        // Set up ResizeObserver for the header itself
        this.setupResizeObserver();

        // Wait for fonts to load and recalculate
        this.waitForFonts();

        this.isInitialized = true;
        console.log('HeaderHeightManager: Initialized with height', this.currentHeight + 'px');
    }

    setupEventListeners() {
        // Debounced resize handler
        window.addEventListener('resize', this.handleResize);

        // Orientation change handler with proper timing
        window.addEventListener('orientationchange', this.handleOrientationChange);

        // Listen for viewport changes (iOS Safari specifically)
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this.handleResize);
        }
    }

    setupResizeObserver() {
        if ('ResizeObserver' in window) {
            const resizeObserver = new ResizeObserver(entries => {
                for (let entry of entries) {
                    if (entry.target === this.headerElement) {
                        this.calculateHeight();
                    }
                }
            });

            resizeObserver.observe(this.headerElement);
        }
    }

    handleResize() {
        this.debounceCalculation();
    }

    handleOrientationChange() {
        // Orientation change needs special handling
        // iOS Safari has a delay before viewport stabilizes
        setTimeout(() => {
            this.calculateHeight();
        }, 100);

        // Also check after a longer delay in case of slow rotation
        setTimeout(() => {
            this.calculateHeight();
        }, 500);
    }

    debounceCalculation() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.calculateHeight();
        }, 16); // ~60fps
    }

    calculateHeight() {
        if (!this.headerElement) return;

        // Force layout calculation
        this.headerElement.offsetHeight;

        // Get the computed height including padding, borders, etc.
        const computedStyle = window.getComputedStyle(this.headerElement);
        const height = this.headerElement.offsetHeight;

        // Check if height actually changed
        if (height !== this.currentHeight) {
            this.currentHeight = height;
            this.updateCSSVariables();
            this.notifyObservers();

            console.log('HeaderHeightManager: Height updated to', height + 'px');
        }
    }

    updateCSSVariables() {
        // Set multiple CSS custom properties for different use cases
        const root = document.documentElement;

        // Base height
        root.style.setProperty('--header-height', this.currentHeight + 'px');

        // With padding variations
        root.style.setProperty('--header-height-plus-1rem', `calc(${this.currentHeight}px + 1rem)`);
        root.style.setProperty('--header-height-plus-2rem', `calc(${this.currentHeight}px + 2rem)`);
        root.style.setProperty('--header-height-plus-3rem', `calc(${this.currentHeight}px + 3rem)`);

        // For about page specific usage
        root.style.setProperty('--calculated-header-height', this.currentHeight + 'px');

        // Safe area compensation (for mobile)
        root.style.setProperty('--header-safe-height', `calc(${this.currentHeight}px + env(safe-area-inset-top, 0px))`);
    }

    waitForFonts() {
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
                // Recalculate after fonts load
                setTimeout(() => {
                    this.calculateHeight();
                }, 100);
            });
        }
    }

    // Observer pattern for other scripts to listen to height changes
    addObserver(callback) {
        this.observers.push(callback);
    }

    removeObserver(callback) {
        this.observers = this.observers.filter(obs => obs !== callback);
    }

    notifyObservers() {
        this.observers.forEach(callback => {
            try {
                callback(this.currentHeight);
            } catch (error) {
                console.error('HeaderHeightManager: Observer callback error:', error);
            }
        });
    }

    // Public methods
    getHeight() {
        return this.currentHeight;
    }

    forceRecalculate() {
        this.calculateHeight();
    }

    // Utility method to check if header is visible
    isHeaderVisible() {
        if (!this.headerElement) return false;

        const style = window.getComputedStyle(this.headerElement);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               style.opacity !== '0';
    }
}

// Create global instance
window.headerHeightManager = new HeaderHeightManager();

// Also export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeaderHeightManager;
}
