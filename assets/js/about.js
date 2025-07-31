// Don't dispatch pageReady immediately - wait for DOM and all initialization to complete

document.addEventListener('DOMContentLoaded', function () {
    // Add mobile landscape mode logo hiding functionality (copied from mobile.js)
    (function () {
        // Immediate logo blocking for landscape mode
        const styleBlocker = document.createElement('style');
        styleBlocker.id = 'about-initial-logo-block';
        styleBlocker.textContent = `
            /* Logo visible by default */
            .logo-container {
                opacity: 1;
                visibility: visible;
                display: block;
            }

            /* Only hide for mobile landscape */
            @media (max-height: 500px) and (min-width: 400px) and (max-width: 1024px) and (orientation: landscape) and (hover: none) and (pointer: coarse) {
                .logo-container {
                    opacity: 0 !important;
                    visibility: hidden !important;
                    display: none !important;
                }

                .page-header {
                    opacity: 0 !important;
                    visibility: hidden !important;
                    display: none !important;
                }
            }
        `;
        document.head.appendChild(styleBlocker);

        // Add this function for consistent aspect ratio detection
        function isPhoneLandscape() {
            const mediaQuery = window.matchMedia("(max-height: 500px) and (min-width: 400px) and (max-width: 1024px) and (orientation: landscape) and (hover: none) and (pointer: coarse)");
            return mediaQuery.matches;
        }

        // Simplified logo visibility function - only handles show/hide, no positioning
        // Only affects mobile devices, not desktop
        function toggleLogoVisibility(show) {
            // Skip if on desktop to avoid interfering with desktop logo fade animation
            if (window.innerWidth >= 1024) return;

            const logoContainer = document.querySelector('.logo-container');
            const pageHeader = document.querySelector('.page-header');

            if (logoContainer) {
                // Hide in landscape mode or when explicitly hidden
                if (isPhoneLandscape() || !show) {
                    logoContainer.style.opacity = '0';
                    logoContainer.style.visibility = 'hidden';
                    logoContainer.style.display = 'none';
                } else {
                    // Show in all other cases - let CSS handle positioning
                    logoContainer.style.opacity = '1';
                    logoContainer.style.visibility = 'visible';
                    logoContainer.style.display = '';
                    logoContainer.style.transition = 'opacity 0.3s ease';
                }
            }

            if (pageHeader) {
                // Hide in landscape mode or when explicitly hidden
                if (isPhoneLandscape() || !show) {
                    pageHeader.style.opacity = '0';
                    pageHeader.style.visibility = 'hidden';
                    pageHeader.style.display = 'none';
                } else {
                    // Show in all other cases - let CSS handle positioning
                    pageHeader.style.opacity = '1';
                    pageHeader.style.visibility = 'visible';
                    pageHeader.style.display = '';
                    pageHeader.style.transition = 'opacity 0.3s ease';
                }
            }
        }

        // Listen for orientation changes
        window.addEventListener('orientationchange', function () {
            setTimeout(function () {
                toggleLogoVisibility(true);
            }, 100);
        });

        // Initial check
        toggleLogoVisibility(true);
    })();

    // =============================================================
    // HERO BADGE FADE-IN ANIMATION ON PAGE LOAD
    // =============================================================

    // Trigger hero badge fade-in animation on page load
    function initHeroBadgeAnimation() {
        const heroBadge = document.querySelector('.hero-badge');
        if (heroBadge) {
            // Add fade-in class after a short delay to ensure DOM is ready
            setTimeout(() => {
                heroBadge.classList.add('fade-in');
            }, 300);
        }
    }

    // Call the hero badge animation
    initHeroBadgeAnimation();

    const sections = document.querySelectorAll('.about-section');
    const container = document.querySelector('.about-container');

    // =============================================================
    // ENHANCED MODERN ANIMATIONS
    // =============================================================

    // Enhanced intersection observer for sections with animations
    if (sections.length > 0 && container) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');

                    // Trigger animations for child elements
                    animateChildElements(entry.target);
                }
            });
        }, {
            root: container, // Observes scrolling within the .about-container
            threshold: 0.2, // More sensitive trigger
            rootMargin: '0px 0px -5% 0px' // Trigger slightly before fully visible
        });

        sections.forEach(section => {
            observer.observe(section);
        });
    }

    // =============================================================
    // CHILD ELEMENT ANIMATIONS
    // =============================================================

    function animateChildElements(section) {
        const animatedElements = section.querySelectorAll('[data-animate]');

        animatedElements.forEach((element, index) => {
            const animationType = element.dataset.animate;
            const delay = element.dataset.delay || index * 0.1;

            setTimeout(() => {
                element.classList.add('animate');

                // Apply specific animation based on type
                switch (animationType) {
                    case 'slide-up':
                        element.style.transform = 'translateY(0)';
                        element.style.opacity = '1';
                        break;
                    case 'slide-left':
                        element.style.transform = 'translateX(0)';
                        element.style.opacity = '1';
                        break;
                    case 'slide-right':
                        element.style.transform = 'translateX(0)';
                        element.style.opacity = '1';
                        break;
                    case 'zoom-in':
                        element.style.transform = 'scale(1)';
                        element.style.opacity = '1';
                        break;
                    case 'fade-in':
                        element.style.opacity = '1';
                        break;
                }
            }, delay * 1000);
        });

        // Animate glass cards
        const glassCards = section.querySelectorAll('.glass-card');
        glassCards.forEach((card, index) => {
            setTimeout(() => {
                card.classList.add('animate');
            }, index * 150);
        });

        // Animate process steps
        const processSteps = section.querySelectorAll('.process-step');
        processSteps.forEach((step, index) => {
            setTimeout(() => {
                step.classList.add('animate');
            }, index * 200);
        });

        // Animate profile card
        const profileCard = section.querySelector('.profile-card');
        if (profileCard) {
            setTimeout(() => {
                profileCard.classList.add('animate');
            }, 300);
        }
    }

    // =============================================================
    // SMOOTH SCROLLING FOR INTERNAL LINKS
    // =============================================================

    const internalLinks = document.querySelectorAll('a[href^="#"]');
    internalLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                // Use your existing device detection
                const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                const headerHeight = window.headerHeightManager.getHeight();

                if (isMobile && window.headerHeightManager) {
                    // Mobile: account for header

                    const targetPosition = targetElement.offsetTop - headerHeight - 20;
                    container.scrollTo({ top: targetPosition, behavior: 'smooth' });
                } else {
                    // Desktop: keep existing working solution
                    const targetPosition = targetElement.offsetTop - headerHeight + 100;
                    container.scrollTo({ top: targetPosition, behavior: 'smooth' });
                }
            }
        });
    });

    // =============================================================
    // EQUALIZE ELEMENT HEIGHTS (Generic Function)
    // =============================================================
    function equalizeElementHeights(selector) {
        const elements = document.querySelectorAll(selector);
        if (elements.length === 0) {
            return;
        }

        // Reset heights to auto to get the natural height
        elements.forEach(element => {
            element.style.minHeight = 'auto';
        });

        // Use a timeout to ensure the browser has time to reflow and calculate natural heights
        setTimeout(() => {
            let maxHeight = 0;
            elements.forEach(element => {
                if (element.offsetHeight > maxHeight) {
                    maxHeight = element.offsetHeight;
                }
            });

            // Apply the max height to all elements
            if (maxHeight > 0) {
                elements.forEach(element => {
                    element.style.minHeight = `${maxHeight}px`;
                });
            }
        }, 200); // Increased delay to allow for animations
    }

    function runAllEqualizers() {
        equalizeElementHeights('.process-step');
        equalizeElementHeights('.glass-card');
    }

    // Run on initial load and after animations might have run
    window.addEventListener('load', runAllEqualizers);

    // Run on resize, with a debounce to avoid performance issues
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(runAllEqualizers, 150);
    });

    // Also run it after a delay to catch any transitions/animations
    setTimeout(runAllEqualizers, 500);
    // Run it again after a longer delay as a final catch-all
    setTimeout(runAllEqualizers, 1500);


    // =============================================================
    // PARALLAX EFFECT FOR FLOATING SHAPES
    // =============================================================

    const floatingShapes = document.querySelectorAll('.shape');

    if (container && floatingShapes.length > 0) {
        container.addEventListener('scroll', function () {
            const scrolled = container.scrollTop;

            floatingShapes.forEach((shape, index) => {
                const speed = 0.3 + (index * 0.1);
                const yPos = -(scrolled * speed);
                shape.style.transform = `translateY(${yPos}px)`;
            });
        });
    }

    // =============================================================
    // ENHANCED BUTTON INTERACTIONS
    // =============================================================

    const ctaButtons = document.querySelectorAll('.cta-button');

    ctaButtons.forEach(button => {
        button.addEventListener('mouseenter', function () {
            this.style.transform = 'translateY(-3px)';
        });

        button.addEventListener('mouseleave', function () {
            this.style.transform = 'translateY(0)';
        });

        button.addEventListener('mousedown', function () {
            this.style.transform = 'translateY(-1px) scale(0.98)';
        });

        button.addEventListener('mouseup', function () {
            this.style.transform = 'translateY(-3px)';
        });
    });

    // =============================================================
    // FLOATING CARDS INTERACTION
    // =============================================================

    const floatingCards = document.querySelectorAll('.floating-card');

    floatingCards.forEach(card => {
        card.addEventListener('mouseenter', function () {
            this.style.transform = 'translateY(-10px) scale(1.05)';
            this.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.2)';
        });

        card.addEventListener('mouseleave', function () {
            this.style.transform = '';
            this.style.boxShadow = '';
        });
    });

    // =============================================================
    // PERFORMANCE OPTIMIZATIONS
    // =============================================================

    // Respect user's motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
        // Reduce animations for users who prefer less motion
        const style = document.createElement('style');
        style.textContent = `
            .about-section, .glass-card, .process-step, .profile-card {
                transition-duration: 0.2s !important;
            }
            .shape {
                animation-duration: 5s !important;
            }
        `;
        document.head.appendChild(style);
    }

    // =============================================================
    // INITIAL ANIMATION SETUP
    // =============================================================

    // Set initial states for animated elements
    document.querySelectorAll('[data-animate="slide-left"]').forEach(el => {
        el.style.transform = 'translateX(-50px)';
        el.style.opacity = '0';
        el.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
    });

    document.querySelectorAll('[data-animate="slide-right"]').forEach(el => {
        el.style.transform = 'translateX(50px)';
        el.style.opacity = '0';
        el.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
    });

    document.querySelectorAll('[data-animate="zoom-in"]').forEach(el => {
        el.style.transform = 'scale(0.8)';
        el.style.opacity = '0';
        el.style.transition = 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
    });

    // =============================================================
    // DYNAMIC HEADER HEIGHT CALCULATION WITH ROBUST MANAGEMENT
    // =============================================================

    function updateSectionPadding(headerHeight) {
        const sections = document.querySelectorAll('.about-section');
        sections.forEach(section => {
            // Use CSS custom properties instead of inline styles for better performance
            section.style.paddingTop = `var(--header-height-plus-2rem)`;
        });

        console.log('About sections updated with header height:', headerHeight + 'px');
    }

    // Wait for header height manager to be available
    function initializeHeaderHeightIntegration() {
        if (window.headerHeightManager) {
            // Add observer to update sections when header height changes
            window.headerHeightManager.addObserver(updateSectionPadding);

            // Initial update
            updateSectionPadding(window.headerHeightManager.getHeight());

            console.log('About page integrated with HeaderHeightManager');
        } else {
            // Fallback if header height manager isn't available
            console.warn('HeaderHeightManager not available, using fallback');
            fallbackHeaderCalculation();
        }
    }

    function fallbackHeaderCalculation() {
        const header = document.querySelector('.page-header');
        if (header) {
            const headerHeight = header.offsetHeight;
            // Safety check: if header height is unreasonable, use a default
            const safeHeaderHeight = (headerHeight > 500 || headerHeight < 50) ? 120 : headerHeight;
            console.log(`About.js: Header height calculated as ${headerHeight}px, using ${safeHeaderHeight}px`);

            document.documentElement.style.setProperty('--header-height', safeHeaderHeight + 'px');
            document.documentElement.style.setProperty('--header-height-plus-2rem', `calc(${safeHeaderHeight}px + 2rem)`);
            updateSectionPadding(safeHeaderHeight);
        } else {
            // If no header found, use a reasonable default
            console.log('About.js: No header found, using default height of 120px');
            const defaultHeight = 120;
            document.documentElement.style.setProperty('--header-height', defaultHeight + 'px');
            document.documentElement.style.setProperty('--header-height-plus-2rem', `calc(${defaultHeight}px + 2rem)`);
            updateSectionPadding(defaultHeight);
        }
    }

    // Initialize header height integration
    initializeHeaderHeightIntegration();

    // =============================================================
    // LANDSCAPE ROTATION FIX
    // =============================================================

    function handleViewportChange() {
        // Force recalculation on viewport changes
        if (window.headerHeightManager) {
            window.headerHeightManager.forceRecalculate();
        } else {
            fallbackHeaderCalculation();
        }

        // Also force reflow to fix any layout issues
        document.body.offsetHeight;
    }

    // Handle orientation change with proper timing
    window.addEventListener('orientationchange', function () {
        setTimeout(handleViewportChange, 100);
        setTimeout(handleViewportChange, 500); // Double-check after layout settles
    });

    // Handle visual viewport changes (iOS Safari)
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleViewportChange);
    }

    // Initialize modern landing page
    console.log('🚀 Modern landing page initialized with enhanced animations and preserved snap scrolling');

    // =============================================================
    // WAIT FOR SPLASH SCREEN TO COMPLETE
    // =============================================================

    // Listen for splash screen completion before initializing desktop logo fade
    let splashCompleted = false;

    // Check if splash is already completed
    const splashOverlay = document.querySelector('.splash-overlay');
    if (!splashOverlay || splashOverlay.style.opacity === '0' || splashOverlay.classList.contains('splash-hide')) {
        splashCompleted = true;
    }

    // Listen for splash completion events
    document.addEventListener('splashComplete', function () {
        splashCompleted = true;
        // Logo fade is already initialized, no need to reinitialize
    });

    // Fallback timeout in case splash event doesn't fire
    setTimeout(() => {
        if (!splashCompleted) {
            splashCompleted = true;
            // Logo fade is already initialized, no need to reinitialize
        }
    }, 3000); // 3 second fallback

    // =============================================================
    // DESKTOP LOGO INITIAL STATE
    // =============================================================

    // Ensure logo is visible on page load for desktop
    function initDesktopLogoState() {
        if (!isDesktop()) return;

        const logoContainer = document.querySelector('.logo-container');
        const headerLogoContainer = document.querySelector('.header-logo-container');

        if (logoContainer && headerLogoContainer) {
            // Reset any existing classes
            logoContainer.classList.remove('logo-fade-out', 'logo-animate-fade-out');
            headerLogoContainer.classList.remove('logo-fade-out', 'logo-animate-fade-out');

            // Ensure logos are visible initially
            logoContainer.style.opacity = '1';
            logoContainer.style.visibility = 'visible';
            logoContainer.style.display = '';
            logoContainer.style.pointerEvents = 'auto';

            headerLogoContainer.style.opacity = '1';
            headerLogoContainer.style.visibility = 'visible';
            headerLogoContainer.style.display = '';
            headerLogoContainer.style.pointerEvents = 'auto';

            console.log('🎯 Desktop logo initial state set to visible');
        }
    }

    // Initialize desktop logo state immediately
    initDesktopLogoState();

    // Initialize desktop logo fade immediately for desktop (don't wait for splash)
    if (isDesktop()) {
        initDesktopLogoFade();
    }

    // =============================================================
    // DESKTOP LOGO FADE ANIMATION ON SCROLL
    // =============================================================

    // Check if we're on desktop
    function isDesktop() {
        return window.innerWidth >= 1024;
    }

    // Desktop logo fade animation controller
    function initDesktopLogoFade() {
        if (!isDesktop()) return;

        const logoContainer = document.querySelector('.logo-container');
        const headerLogoContainer = document.querySelector('.header-logo-container');
        const heroSection = document.querySelector('#section1');

        if (!logoContainer || !headerLogoContainer || !heroSection || !container) return;

        let isLogoVisible = true;
        let fadeAnimationId = null;
        let currentFrame = 0;
        const totalFrames = 10;

        // Frame-by-frame animation function
        function animateLogoFade(isVisible, onComplete) {
            if (fadeAnimationId) {
                cancelAnimationFrame(fadeAnimationId);
            }

            const startFrame = isVisible ? 0 : totalFrames;
            const endFrame = isVisible ? totalFrames : 0;
            const direction = isVisible ? 1 : -1;

            function animate() {
                if (isVisible && currentFrame < endFrame) {
                    currentFrame += direction;
                } else if (!isVisible && currentFrame > endFrame) {
                    currentFrame += direction;
                } else {
                    // Animation complete
                    if (onComplete) onComplete();
                    return;
                }

                // Apply frame-specific classes
                const frameClass = `logo-fade-frame-${Math.abs(currentFrame)}`;

                // Remove all frame classes
                for (let i = 0; i <= totalFrames; i++) {
                    logoContainer.classList.remove(`logo-fade-frame-${i}`);
                    headerLogoContainer.classList.remove(`logo-fade-frame-${i}`);
                }

                // Add current frame class
                if (currentFrame > 0) {
                    logoContainer.classList.add(frameClass);
                    headerLogoContainer.classList.add(frameClass);
                }

                // Continue animation
                fadeAnimationId = requestAnimationFrame(animate);
            }

            animate();
        }

        // Alternative CSS keyframe animation function
        function animateLogoFadeCSS(isVisible) {
            // Remove existing animation classes
            logoContainer.classList.remove('logo-animate-fade-in', 'logo-animate-fade-out');
            headerLogoContainer.classList.remove('logo-animate-fade-in', 'logo-animate-fade-out');

            // Add appropriate animation class
            const animationClass = isVisible ? 'logo-animate-fade-in' : 'logo-animate-fade-out';
            logoContainer.classList.add(animationClass);
            headerLogoContainer.classList.add(animationClass);
        }

        // Scroll-based logo visibility controller
        function handleLogoVisibility() {
            if (!isDesktop()) return;

            const heroRect = heroSection.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Calculate how much of the hero section is still visible
            const heroHeight = heroRect.height;
            const visibleHeroHeight = Math.min(heroRect.bottom, containerRect.bottom) - Math.max(heroRect.top, containerRect.top);
            const visibilityRatio = Math.max(0, visibleHeroHeight / heroHeight);

            // Start fading out when hero section is 70% visible, completely gone at 40%
            const shouldShowLogo = visibilityRatio > 0.7;

            if (shouldShowLogo && !isLogoVisible) {
                // Logo should fade in
                isLogoVisible = true;
                currentFrame = 0;

                // Use CSS keyframe animation for smoother performance
                animateLogoFadeCSS(true);

                console.log(`🎯 Desktop logo fading IN (hero ${Math.round(visibilityRatio * 100)}% visible)`);
            } else if (!shouldShowLogo && isLogoVisible) {
                // Logo should fade out
                isLogoVisible = false;
                currentFrame = totalFrames;

                // Use CSS keyframe animation for smoother performance
                animateLogoFadeCSS(false);

                console.log(`🎯 Desktop logo fading OUT (hero ${Math.round(visibilityRatio * 100)}% visible)`);
            }
        }

        // Enhanced intersection observer specifically for logo fade
        const logoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.target.id === 'section1') {
                    // Use intersection ratio for more precise control
                    const intersectionRatio = entry.intersectionRatio;

                    // Logo should start fading out when hero section is 70% visible
                    // and be completely gone when hero section is 40% visible
                    const shouldShowLogo = intersectionRatio > 0.7;

                    if (shouldShowLogo && !isLogoVisible) {
                        isLogoVisible = true;
                        currentFrame = 0;
                        animateLogoFadeCSS(true);
                        console.log(`🎯 Desktop logo fading IN (hero section ${Math.round(intersectionRatio * 100)}% visible)`);
                    } else if (!shouldShowLogo && isLogoVisible) {
                        isLogoVisible = false;
                        currentFrame = totalFrames;
                        animateLogoFadeCSS(false);
                        console.log(`🎯 Desktop logo fading OUT (hero section ${Math.round(intersectionRatio * 100)}% visible)`);
                    }
                }
            });
        }, {
            root: container,
            threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0], // More precise thresholds
            rootMargin: '0px 0px -20% 0px' // Start fading earlier - when 20% of hero is out of view
        });

        // Observe the hero section
        logoObserver.observe(heroSection);

        // Also add scroll listener for fine-tuned control
        let scrollTimeout;
        container.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(handleLogoVisibility, 16); // ~60fps
        });

        // Initialize logo state
        handleLogoVisibility();

        console.log('🚀 Desktop logo fade animation initialized');
    }

    // Reinitialize on window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            initDesktopLogoFade();
        }, 250);
    });

    // =============================================================
    // DESKTOP LOGO FADE DEBUG AND TESTING
    // =============================================================

    // Debug function to test logo fade manually (for development)
    window.testDesktopLogoFade = function (fadeOut = true) {
        if (!isDesktop()) {
            console.log('⚠️ testDesktopLogoFade: Not on desktop');
            return;
        }

        const logoContainer = document.querySelector('.logo-container');
        const headerLogoContainer = document.querySelector('.header-logo-container');

        if (!logoContainer || !headerLogoContainer) {
            console.log('⚠️ testDesktopLogoFade: Logo elements not found');
            return;
        }

        // Remove existing animation classes
        logoContainer.classList.remove('logo-animate-fade-in', 'logo-animate-fade-out');
        headerLogoContainer.classList.remove('logo-animate-fade-in', 'logo-animate-fade-out');

        // Add appropriate animation class
        const animationClass = fadeOut ? 'logo-animate-fade-out' : 'logo-animate-fade-in';
        logoContainer.classList.add(animationClass);
        headerLogoContainer.classList.add(animationClass);

        console.log(`🎯 testDesktopLogoFade: ${fadeOut ? 'Fading OUT' : 'Fading IN'}`);
    };

    // Add to window for easy testing
    window.isDesktopLogoFadeActive = function () {
        return isDesktop() && splashCompleted;
    };

    // ===============================
    // PROCESS ARROW DIRECTION BASED ON DEVICE
    // ===============================
    function updateProcessArrows() {
        const isMobile = window.innerWidth < 1024;
        const arrows = document.querySelectorAll('.process-arrow');
        arrows.forEach(arrow => {
            arrow.textContent = isMobile ? '↓' : '→';
        });
    }
    // Run on load
    updateProcessArrows();
    // Run on resize
    window.addEventListener('resize', updateProcessArrows);

    // =============================================================
    // SOURCES OVERLAY FUNCTIONALITY
    // =============================================================

    // Sources overlay functionality
    const sourcesLink = document.getElementById('sources-link');

    // List of news source logos (using actual logo filenames from the folder)
    const newsSources = [
        'abc.png',
        'bbc.png',
        'reuters.png',
        'cnn.png',
        'wall_street_journal.png',
        'the_guardian.png',
        'npr.png',
        'cbs_news.png',
        'nbc_news.png',
        'fox_news.png',
        'usa_today.png',
        'politico.png',
        'cnbc.png',
        'huffpost.png',
        'vox.png',
        'the_atlantic.png',
        'washington_post.png',
        'yahoo_news.png',
        'la_times.png',
        'sky_news.png',
        'south_china_morning_post.png',
        'deutsche_welle.png',
        'caixin.png',
        'kyodo_news.svg'
    ];

    if (sourcesLink) {
        sourcesLink.addEventListener('click', function (e) {
            e.preventDefault();
            showSourcesOverlay();
        });
    }

    function showSourcesOverlay() {
        // Create overlay if it doesn't exist
        let overlay = document.getElementById('sources-overlay');
        if (!overlay) {
            overlay = createSourcesOverlay();
            document.body.appendChild(overlay);
        }

        // Show overlay
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function createSourcesOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'sources-overlay';
        overlay.className = 'sources-overlay';

        const modal = document.createElement('div');
        modal.className = 'sources-modal';

        const title = document.createElement('h3');
        title.textContent = 'Our News Sources';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-sources';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', hideSourcesOverlay);

        const grid = document.createElement('div');
        grid.className = 'sources-grid';

        // Create logo elements
        newsSources.forEach((logoFile, index) => {
            const logoContainer = document.createElement('div');
            logoContainer.className = 'source-logo';

            const img = document.createElement('img');
            img.src = `assets/images/news_logos/${logoFile}`;
            img.alt = logoFile.replace('.png', '').replace('.svg', '').replace(/_/g, ' ');
            img.onerror = function () {
                // Fallback if image doesn't exist
                logoContainer.style.display = 'none';
            };

            logoContainer.appendChild(img);
            grid.appendChild(logoContainer);
        });

        modal.appendChild(closeBtn);
        modal.appendChild(title);
        modal.appendChild(grid);
        overlay.appendChild(modal);

        // Apply circular packing after DOM is ready
        setTimeout(() => {
            applyCircularPacking();
        }, 100);

        // Close on overlay click
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) {
                hideSourcesOverlay();
            }
        });

        return overlay;
    }

    // Circular packing algorithm with dynamic container sizing (Apple Watch style)
    function applyCircularPacking() {
        const grid = document.querySelector('.sources-grid');
        const logos = grid.querySelectorAll('.source-logo');

        if (!logos.length) return;

        // Circle dimensions
        const isMobile = window.innerWidth <= 768;
        const circleSize = isMobile ? 45 : 60;
        const circleRadius = circleSize / 2;

        // Calculate proper spacing to avoid overlaps
        const spacing = circleSize * 1.15; // Slight spacing between circles

        // Calculate the number of rings needed for circular packing
        const logosCount = logos.length;
        let ringsNeeded = 0;
        let totalCapacity = 0;

        // Calculate rings needed: center(1) + ring1(6) + ring2(12) + ring3(18) + ring4(24)...
        while (totalCapacity < logosCount) {
            if (ringsNeeded === 0) {
                totalCapacity += 1; // Center circle
            } else {
                totalCapacity += ringsNeeded * 6; // Each ring has 6 * ringNumber circles
            }
            ringsNeeded++;
        }

        // Calculate required container dimensions
        const maxRingRadius = (ringsNeeded - 1) * spacing;
        const requiredWidth = (maxRingRadius * 2) + (circleSize * 2);
        const requiredHeight = (maxRingRadius * 2) + (circleSize * 2);

        // Update container size
        grid.style.width = `${Math.max(requiredWidth, 300)}px`;
        grid.style.height = `${Math.max(requiredHeight, 300)}px`;

        // Get updated container dimensions
        const containerWidth = grid.offsetWidth;
        const containerHeight = grid.offsetHeight;
        const centerX = containerWidth / 2;
        const centerY = containerHeight / 2;

        // Array to store all positions
        const positions = [];

        // Center circle
        positions.push({ x: centerX, y: centerY });

        // Generate ring positions in circular pattern
        for (let ring = 1; ring < ringsNeeded; ring++) {
            const circlesInRing = ring * 6;
            const radius = ring * spacing;

            // Start at bottom (270°), then alternate left/right
            const baseAngle = Math.PI * 1.5; // 270° in radians
            let direction = 1; // 1 for right, -1 for left
            let step = Math.PI * 2 / circlesInRing;
            positions.push({ // First position at bottom
                x: centerX + radius * Math.cos(baseAngle),
                y: centerY + radius * Math.sin(baseAngle)
            });
            for (let i = 1; i < circlesInRing; i++) {
                // Alternate left/right from bottom
                let offset = Math.ceil(i / 2) * step;
                let angle = baseAngle + direction * offset;
                positions.push({
                    x: centerX + radius * Math.cos(angle),
                    y: centerY + radius * Math.sin(angle)
                });
                direction *= -1; // Switch direction each time
            }
        }

        // Apply positions to logos
        logos.forEach((logo, index) => {
            if (index < positions.length) {
                const pos = positions[index];
                logo.style.left = `${pos.x - circleRadius}px`;
                logo.style.top = `${pos.y - circleRadius}px`;
                logo.style.transform = 'translate(0, 0)';

                // Add subtle stagger animation
                logo.style.animationDelay = `${index * 0.05}s`;
                logo.style.opacity = '0';
                logo.style.animation = 'circleFadeIn 0.5s ease-out forwards';
                logo.style.display = 'block';
            } else {
                // Hide excess logos that don't fit
                logo.style.display = 'none';
            }
        });

        // Debug logging
        console.log(`🔵 Circular packing: ${positions.length} positions for ${logos.length} logos`);
        console.log(`📐 Container: ${containerWidth}x${containerHeight}, Circle size: ${circleSize}px`);
        console.log(`🔄 Rings needed: ${ringsNeeded}, Max radius: ${maxRingRadius}px`);
    }

    // Add CSS animation for circle fade-in with Apple Watch-style bounce
    const circleAnimation = document.createElement('style');
    circleAnimation.textContent = `
        @keyframes circleFadeIn {
            0% {
                opacity: 0;
                transform: scale(0.3);
            }
            50% {
                opacity: 0.8;
                transform: scale(1.05);
            }
            100% {
                opacity: 1;
                transform: scale(1);
            }
        }

        @keyframes circleHover {
            0% { transform: scale(1.15); }
            50% { transform: scale(1.18); }
            100% { transform: scale(1.15); }
        }

        .source-logo:hover {
            animation: circleHover 0.6s ease-in-out;
        }
    `;
    document.head.appendChild(circleAnimation);

    function hideSourcesOverlay() {
        const overlay = document.getElementById('sources-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            hideSourcesOverlay();
        }
    });

    // Reposition on window resize
    window.addEventListener('resize', function () {
        const overlay = document.getElementById('sources-overlay');
        if (overlay && overlay.classList.contains('active')) {
            setTimeout(applyCircularPacking, 100);
        }
    });

    // =============================================================
    // FINAL INITIALIZATION & SPLASH SIGNAL
    // =============================================================

    // Fire splash signal only after window.onload (all resources, CSS, fonts, images loaded) and next paint
// --- START OF CODE TO ADD ---
// =============================================================
// ROBUST PAGE READY SIGNAL
// =============================================================

function dispatchPageReadyWhenStable() {
    // Promise for window.load event (ensures all images are loaded)
    const windowLoadPromise = new Promise(resolve => {
        if (document.readyState === 'complete') {
            resolve();
        } else {
            window.addEventListener('load', resolve, { once: true });
        }
    });

    // Promise for document fonts ready (prevents layout shift from font loading)
    const fontsReadyPromise = document.fonts.ready;

    // Promise to wait for critical initial animations and layout adjustments.
    // The longest timeout in this script is for equalizeElementHeights (1500ms).
    // We will wait slightly longer to ensure all rendering is complete.
    const layoutSettlePromise = new Promise(resolve => setTimeout(resolve, 1600));

    Promise.all([windowLoadPromise, fontsReadyPromise, layoutSettlePromise]).then(() => {
        // Final check: ensure the main hero title is actually rendered and visible.
        const heroTitle = document.querySelector('.hero-title');
        if (heroTitle && heroTitle.offsetHeight > 0) {
            console.log("About.js: All conditions met. Page is stable. Firing 'pageReady'.");
            document.dispatchEvent(new CustomEvent('pageReady'));
        } else {
            // Fallback if the check fails, dispatch after a short delay anyway.
            console.warn("About.js: Stability check failed, retrying pageReady dispatch in 500ms.");
            setTimeout(() => {
                console.log("About.js: Retrying 'pageReady' dispatch.");
                document.dispatchEvent(new CustomEvent('pageReady'));
            }, 500);
        }
    }).catch(error => {
        console.error("About.js: Error waiting for page stability, firing pageReady to prevent app freeze.", error);
        // Fire the event anyway so the application doesn't get stuck on the splash screen.
        document.dispatchEvent(new CustomEvent('pageReady'));
    });
}

// Start the process of checking for page stability.
dispatchPageReadyWhenStable();

// =============================================================
// END OF ROBUST PAGE READY SIGNAL
// =============================================================
});
