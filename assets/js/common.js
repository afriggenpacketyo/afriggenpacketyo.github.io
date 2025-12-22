// Global variables and utility functions shared between implementations

// Only initialize the CardSystem on pages that use it (i.e., not about.html)
if (!window.location.pathname.includes('about.html')) {

    window.CardSystem = {
        // DOM elements
        flipCards: document.querySelectorAll('.flip-card'),
        container: document.querySelector('.container'),
        isFiltering: false, // Flag to indicate if filtering is active

        // New state tracking for better synchronization
        filteringPhase: 'idle', // 'idle', 'filtering', 'repositioning'
        pendingStateChange: false,

        // State variables
        activeCardIndex: 0,
        currentlyFlippedCard: null,
        isManuallyFlipping: false,
        isUserClicking: false,

        // Cached card data for efficient filtering
        cardData: [],

        // Initialization state
        isLayoutReady: false,
        isFullyInitialized: false,
        _checkingReadiness: false,
        _pageReadyDispatched: false,

        // Platform readiness tracking
        platformReadiness: {
            mobile: false,
            desktop: false
        },

        // Navigation coordination system to prevent multiple active dots
        _navigationLock: false,
        _pendingNavigation: null,

        // Dot indicator properties
        visibleStartIndex: 0,
        visibleRange: 9, // Show a maximum of 9 dots at a time
        previousDirection: 0, // 0 = initial, 1 = right, -1 = left
        previousActiveIndex: 0,
        previousVisibleActiveIndex: -1, // Added for filter-aware logic

        // Constants to replace magic numbers
        CARD_VISIBILITY_THRESHOLD: 0.4,
        SWIPE_DISTANCE_THRESHOLD: 30,
        POSITION_THRESHOLD: 0.4,

        // Spacing system constants and calculations (EXPERIMENTAL - NOT CURRENTLY USED)
        // a = distance from header bottom to logo center
        // b = distance from logo bottom/center to active card top
        // c = distance from header bottom to active card top (also bottom to dots)
        // Rules: a = b, c = a + b
        calculateSystematicSpacing: function() {
            const header = document.querySelector('.page-header');
            const logo = document.querySelector('.logo-container');
            const cardIndicator = document.querySelector('.card-indicator');

            if (!header || !logo || !cardIndicator) {
                console.warn('Spacing system: Required elements not found', {
                    header: !!header,
                    logo: !!logo,
                    cardIndicator: !!cardIndicator,
                    deviceType: this.isMobileDevice() ? 'mobile' : 'desktop'
                });
                return null;
            }

            const headerRect = header.getBoundingClientRect();
            const logoRect = logo.getBoundingClientRect();
            const indicatorRect = cardIndicator.getBoundingClientRect();

            const headerBottom = headerRect.bottom;
            const logoCenter = logoRect.top + (logoRect.height / 2);
            const logoBottom = logoRect.bottom;
            const indicatorTop = indicatorRect.top;

            // Calculate a: distance from header bottom to logo center
            const a = logoCenter - headerBottom;

            // b equals a (logo is centered between header and active card)
            const b = a;

            // c = a + b (total spacing from header to active card)
            const c = a + b;

            // Calculate active card center position
            const activeCardCenterY = headerBottom + c;

            // Validate spacing makes sense
            const totalAvailableSpace = indicatorTop - headerBottom;
            const requiredSpace = c * 2; // Space above and below active card

            if (requiredSpace > totalAvailableSpace) {
                console.warn('Spacing system: Not enough space for systematic layout', {
                    required: requiredSpace,
                    available: totalAvailableSpace
                });
                return null;
            }

            return {
                a: a,
                b: b,
                c: c,
                headerBottom: headerBottom,
                logoCenter: logoCenter,
                logoBottom: logoBottom,
                indicatorTop: indicatorTop,
                activeCardCenterY: activeCardCenterY,
                activeCardTopY: headerBottom + c
            };
        },

        // Utility function to measure and log current header-to-card distance
        logHeaderToCardDistance: function() {
            const header = document.querySelector('.page-header');
            const activeCard = this.flipCards[this.activeCardIndex];

            if (!header || !activeCard) {
                console.log('Header-to-Card Distance: Cannot measure - elements not found', {
                    header: !!header,
                    activeCard: !!activeCard,
                    activeCardIndex: this.activeCardIndex
                });
                return null;
            }

            const headerRect = header.getBoundingClientRect();
            const cardRect = activeCard.getBoundingClientRect();

            const headerBottom = headerRect.bottom;
            const cardTop = cardRect.top;
            const distance = cardTop - headerBottom;

            console.log(`Header-to-Card Distance: ${distance.toFixed(2)}px`, {
                'Header bottom': headerBottom.toFixed(2) + 'px',
                'Active card top': cardTop.toFixed(2) + 'px',
                'Distance': distance.toFixed(2) + 'px',
                'Active card index': this.activeCardIndex,
                'Device type': this.isMobileDevice() ? 'mobile' : 'desktop'
            });

            return distance;
        },

        // Apply systematic spacing to cards (desktop and mobile)
        applySystematicSpacing: function() {
            if (!this.container) return;

            const spacing = this.calculateSystematicSpacing();
            if (!spacing) return;

            const activeCard = this.flipCards[this.activeCardIndex];
            if (!activeCard) return;

            const activeCardRect = activeCard.getBoundingClientRect();
            const currentCardTop = activeCardRect.top;
            const cardHeight = activeCardRect.height;

            // Calculate where the card top should be for systematic spacing
            const idealCardTop = spacing.activeCardTopY;

            // For consistent centering, all cards should have their center at the same Y position
            const idealCardCenterY = spacing.activeCardCenterY;
            const idealCardTopForCenter = idealCardCenterY - (cardHeight / 2);

            // Use the center-based positioning for consistency
            const moveAmount = idealCardTopForCenter - currentCardTop;

            // Apply the transform
            this.container.style.transform = `translateY(${moveAmount}px)`;

            console.log('Systematic spacing applied:', {
                'a (header to logo center)': spacing.a.toFixed(2) + 'px',
                'b (logo to card)': spacing.b.toFixed(2) + 'px',
                'c (header to card)': spacing.c.toFixed(2) + 'px',
                'Card center Y': idealCardCenterY.toFixed(2) + 'px',
                'Move amount': moveAmount.toFixed(2) + 'px'
            });
        },

        // Utility functions
        updateUI: function () {
            // Don't recalculate centering on every card change - it interferes with swipes
            // Centering is now handled once on initialization and resize only

            // Find the correct active index if the current one is filtered
            this.ensureActiveCardVisible();

            // Update card active classes
            this.flipCards.forEach((card, i) => {
                card.classList.toggle('active', i === this.activeCardIndex);
            });

            // Update dot active/filtered classes and text content
            let visibleDotCounter = 1;
            document.querySelectorAll('.indicator-dot').forEach((dot) => {
                // Skip null dot - its visibility is managed by filtering logic
                if (dot.dataset.isNullDot === 'true') {
                    return;
                }

                // Use the stored card index from dataset, not the dot's position
                const cardIndex = parseInt(dot.dataset.index, 10);
                const card = this.flipCards[cardIndex];
                const isFiltered = card && card.classList.contains('filtered');

                dot.classList.toggle('active', cardIndex === this.activeCardIndex);
                dot.classList.toggle('filtered', isFiltered);

                if (!isFiltered) {
                    dot.textContent = visibleDotCounter.toString();
                    visibleDotCounter++;
                }
            });

            // Show/hide indicator container based on active overlays - KEEP VISIBLE IN REGULAR MODE
            const cardIndicator = document.querySelector('.card-indicator');
            if (cardIndicator) {
                // Correctly detect hamburger menu overlay (id="menu-overlay") and its visibility
                const menuOverlay = document.getElementById('menu-overlay');
                const isHamburgerOpen = !!(menuOverlay && menuOverlay.classList.contains('show'));

                // Detect mobile card overlay (created in mobile.js) being active
                const isCardOverlayActive = !!document.querySelector('.card-overlay.active');

                const mustHideDots = isHamburgerOpen || isCardOverlayActive;

                if (mustHideDots) {
                    cardIndicator.style.opacity = '0';
                    cardIndicator.style.pointerEvents = 'none';
                } else {
                    // Always show dots in regular mode
                    cardIndicator.style.opacity = '1';
                    cardIndicator.style.pointerEvents = 'auto';
                }
            }

            // Run the new, filter-aware dot styling logic
            this.updateInstagramStyleDots(this.activeCardIndex);
        },

        // UPDATED: Mobile centering with Safari safety checks (no systematic spacing on mobile)
        updateMobileVerticalCentering: function() {
            if (!this.container || !this.isMobileDevice()) return;

            // Mobile layout doesn't have .newsway-logo element, so skip systematic spacing
            // and use the proven mobile centering logic directly
            console.log('Mobile: Using optimized mobile centering (systematic spacing not applicable)');

            const header = document.querySelector('.page-header');
            const cardIndicator = document.querySelector('.card-indicator');
            const activeCard = this.flipCards[this.activeCardIndex];

            if (!header || !cardIndicator || !activeCard) return;

            // SAFARI SAFETY: Ensure elements have actual dimensions before measuring
            if (header.offsetHeight === 0 || cardIndicator.offsetHeight === 0 || activeCard.offsetHeight === 0) {
                console.warn('Mobile centering: Elements not ready, skipping');
                return;
            }

            // Get the EXACT positions for perfect centering calculation
            const headerRect = header.getBoundingClientRect();
            const indicatorRect = cardIndicator.getBoundingClientRect();
            const activeCardRect = activeCard.getBoundingClientRect();

            const headerBottom = headerRect.bottom;
            const indicatorTop = indicatorRect.top;
            const currentCardTop = activeCardRect.top;
            const cardHeight = activeCardRect.height;

            // THE WORKING CALCULATION - perfect centering between header and indicator
            const availableSpace = indicatorTop - headerBottom;

            // SAFARI SAFETY: Validate measurements make sense
            if (availableSpace <= 0 || cardHeight <= 0) {
                console.warn('Mobile centering: Invalid measurements, skipping', {
                    availableSpace,
                    cardHeight,
                    headerBottom,
                    indicatorTop
                });
                return;
            }
            const idealCardTop = headerBottom + (availableSpace - cardHeight) / 2;
            const moveAmount = idealCardTop - currentCardTop;

            // Apply centering transform ONCE - don't touch it again during swipes
            this.container.style.transform = `translateY(${moveAmount}px)`;
            this.container._centeringApplied = true;

            console.log('Mobile fallback centering applied:', {
                'Header bottom': headerBottom.toFixed(2) + 'px',
                'Indicator top': indicatorTop.toFixed(2) + 'px',
                'Available space': availableSpace.toFixed(2) + 'px',
                'Move amount': moveAmount.toFixed(2) + 'px',
                'Safari safety checks passed': true
            });

            // ONE-TIME: Calculate and set proportional height for all cards based on this viewport
            this.setProportionalCardHeight(availableSpace);
        },

        // NEW: Calculate and set proportional card height once for all cards (viewport-specific)
        setProportionalCardHeight: function(totalAvailableSpace) {
            if (!this.isMobileDevice() || this.container._heightSet) return;

            // Calculate proportional height: maintain 1/30th gaps (≈31.25px on typical mobile viewport)
            // Top gap = 1/30, Bottom gap = 1/30, Card = 28/30 of available space
            const gapRatio = 1/16;  // Each gap is 1/30th of available space
            const cardHeightRatio = 1 - (2 * gapRatio);  // 28/30 = 0.9333...
            const calculatedHeight = totalAvailableSpace * cardHeightRatio;
            const calculatedGapSize = totalAvailableSpace * gapRatio;

            // Apply this height to ALL cards once
            this.flipCards.forEach(card => {
                card.style.height = `${calculatedHeight}px`;

                // Ensure inner elements scale properly
                const cardInner = card.querySelector('.flip-card-inner');
                const cardFront = card.querySelector('.flip-card-front');
                const cardBack = card.querySelector('.flip-card-back');

                if (cardInner) cardInner.style.height = '100%';
                if (cardFront) cardFront.style.height = '100%';
                if (cardBack) cardBack.style.height = '100%';
            });

            // Mark as set to prevent recalculation
            this.container._heightSet = true;

            console.log('Mobile: Proportional height set for all cards:', {
                'Total available space': totalAvailableSpace.toFixed(2) + 'px',
                'Gap ratio (each)': `1/30 (${(gapRatio * 100).toFixed(2)}%)`,
                'Card height ratio': `28/30 (${(cardHeightRatio * 100).toFixed(2)}%)`,
                'Calculated gap size': calculatedGapSize.toFixed(2) + 'px',
                'Calculated card height': calculatedHeight.toFixed(2) + 'px',
                'Applied to': this.flipCards.length + ' cards',
                'Verification - Total': `${calculatedGapSize.toFixed(1)} + ${calculatedHeight.toFixed(1)} + ${calculatedGapSize.toFixed(1)} = ${(calculatedGapSize * 2 + calculatedHeight).toFixed(1)}px`
            });
        },

        // Mobile device detection - same logic as CSS file selection
        isMobileDevice: function() {
            return 'ontouchstart' in window;
        },

        /**
         * HYBRID: Filter-aware dot indicator logic with smooth Instagram-style transitions.
         * Combines the filtering logic from the new version with the smooth animations from the old version.
         * @param {number} masterActiveIndex The index of the active card in the full, original list.
         */
        updateInstagramStyleDots: function (masterActiveIndex) {
            const allDots = document.querySelectorAll('.indicator-dot');
            // Filter out null dot and filtered dots for Instagram-style animation
            const visibleDots = Array.from(allDots).filter(dot =>
                dot.dataset.isNullDot !== 'true' && !dot.classList.contains('filtered')
            );
            const totalVisibleDots = visibleDots.length;

            if (totalVisibleDots === 0 || masterActiveIndex < 0) {
                // CRITICAL: When no regular dots are visible, clear size classes but preserve null dot's visible state
                allDots.forEach(dot => {
                    // Skip null dot - its visibility is managed by filter logic
                    if (dot.dataset.isNullDot === 'true') {
                        return;
                    }
                    dot.className = dot.className.replace(/size-\w+|visible/g, '').trim();
                    dot.style.transition = '';
                });
                this.previousVisibleActiveIndex = -1;
                return;
            }

            // Find the dot that corresponds to the masterActiveIndex card using dataset.index
            let activeDotMaster = Array.from(allDots).find(dot => parseInt(dot.dataset.index, 10) === masterActiveIndex);
            let visibleActiveIndex = activeDotMaster ? visibleDots.indexOf(activeDotMaster) : -1;

            // Adjust if masterActiveIndex points to a filtered card or null card (no dot exists)
            if (visibleActiveIndex === -1 || !activeDotMaster) {
                let newMasterActiveIndex = -1;
                // Try to find the closest visible card if the current one is filtered or has no dot
                if (this.isFiltering || (activeDotMaster && activeDotMaster.classList.contains('filtered')) || !activeDotMaster) {
                    // Search forward from masterActiveIndex through cards
                    for (let i = masterActiveIndex; i < this.flipCards.length; i++) {
                        const dotForCard = Array.from(allDots).find(dot => parseInt(dot.dataset.index, 10) === i);
                        if (dotForCard && !dotForCard.classList.contains('filtered')) {
                            newMasterActiveIndex = i;
                            break;
                        }
                    }
                    // If not found, search backward
                    if (newMasterActiveIndex === -1) {
                        for (let i = masterActiveIndex - 1; i >= 0; i--) {
                            const dotForCard = Array.from(allDots).find(dot => parseInt(dot.dataset.index, 10) === i);
                            if (dotForCard && !dotForCard.classList.contains('filtered')) {
                                newMasterActiveIndex = i;
                                break;
                            }
                        }
                    }
                }

                if (newMasterActiveIndex !== -1) {
                    masterActiveIndex = newMasterActiveIndex; // Update masterActiveIndex to the new visible one
                    activeDotMaster = Array.from(allDots).find(dot => parseInt(dot.dataset.index, 10) === masterActiveIndex);
                    visibleActiveIndex = activeDotMaster ? visibleDots.indexOf(activeDotMaster) : -1;
                } else {
                    // No visible dot can be made active, clear all and return
                    allDots.forEach(dot => { dot.className = dot.className.replace(/size-\w+|visible/g, '').trim(); dot.style.transition = ''; });
                    this.previousVisibleActiveIndex = -1;
                    return;
                }
                // If still -1 after adjustment, something is wrong or no visible dots available
                if (visibleActiveIndex === -1) {
                    allDots.forEach(dot => { dot.className = dot.className.replace(/size-\w+|visible/g, '').trim(); dot.style.transition = ''; });
                    this.previousVisibleActiveIndex = -1;
                    return;
                }
            }

            if (typeof this.previousVisibleActiveIndex === 'undefined' || this.previousVisibleActiveIndex === -1) {
                this.previousVisibleActiveIndex = visibleActiveIndex;
            }
            const currentDirection = (visibleActiveIndex > this.previousVisibleActiveIndex) ? 1 : ((visibleActiveIndex < this.previousVisibleActiveIndex) ? -1 : 0);
            const isDotClick = Math.abs(visibleActiveIndex - this.previousVisibleActiveIndex) > 1;

            const previousVisibleStart = this.visibleStartIndex;

            if (totalVisibleDots <= this.visibleRange) {
                this.visibleStartIndex = 0;
            } else if (visibleActiveIndex < this.visibleStartIndex + 2) {
                this.visibleStartIndex = Math.max(0, visibleActiveIndex - 2);
            } else if (visibleActiveIndex > this.visibleStartIndex + this.visibleRange - 3) {
                this.visibleStartIndex = Math.min(totalVisibleDots - this.visibleRange, visibleActiveIndex - (this.visibleRange - 3));
            }

            const hasWindowShifted = previousVisibleStart !== this.visibleStartIndex;
            const activeVisibleDot = visibleDots[visibleActiveIndex]; // This is the dot that should be active

            // Clear transitions before applying new ones
            visibleDots.forEach(dot => dot.style.transition = '');

            if (hasWindowShifted) {
                // Apply the sliding transition to all visible dots
                visibleDots.forEach(dot => {
                    dot.style.transition = 'all 0.3s ease, transform 0.4s cubic-bezier(0.1, 0.7, 0.1, 1)';
                });
                // Update all visible dots with new states after transition is set
                visibleDots.forEach((dot, vIndex) => {
                    this.updateFilterAwareDotState(dot, vIndex, visibleActiveIndex, visibleDots);
                });
            } else { // No window shift
                // First, update all non-active visible dots
                visibleDots.forEach((dot, vIndex) => {
                    if (dot === activeVisibleDot) return; // Skip the active dot for now

                    if (isDotClick) {
                        dot.style.transition = 'all 0.2s ease';
                    } else {
                        dot.style.transition = visibleActiveIndex === this.previousVisibleActiveIndex ? 'none' : 'all 0.2s ease';
                    }
                    this.updateFilterAwareDotState(dot, vIndex, visibleActiveIndex, visibleDots);
                });

                // Then, handle the active dot with its specific transitions and delays
                if (activeVisibleDot) {
                    if (!isDotClick && this.previousVisibleActiveIndex !== visibleActiveIndex) { // Sequential swipe
                        if (visibleDots.length > 0 && visibleDots[0]) visibleDots[0].offsetHeight; // Force reflow

                        // Check if the new active dot was 'size-mid' before this update cycle
                        // This check relies on updateFilterAwareDotState from the *previous* call to updateUI
                        // or how classes were before this function started manipulating them.
                        // The key is that `activeVisibleDot` refers to the element that is *becoming* active.
                        // Its classes would reflect its state *before* it becomes active in this cycle.
                        if (activeVisibleDot.classList.contains('size-mid')) {
                            activeVisibleDot.classList.remove('size-mid');
                            activeVisibleDot.classList.add('size-large'); // Intermediate state
                            activeVisibleDot.style.transition = 'all 0.1s ease';

                            if (visibleDots.length > 0 && visibleDots[0]) visibleDots[0].offsetHeight; // Reflow for intermediate state

                            setTimeout(() => {
                                if (activeVisibleDot) {
                                    activeVisibleDot.style.transition = 'all 0.2s ease';
                                    this.updateFilterAwareDotState(activeVisibleDot, visibleActiveIndex, visibleActiveIndex, visibleDots); // Final state
                                }
                            }, 50);
                        } else { // Not previously size-mid, or not a sequential swipe that needs intermediate
                            activeVisibleDot.style.transition = 'all 0.2s ease'; // Set transition before timeout
                            setTimeout(() => {
                                if (activeVisibleDot) {
                                    // Transition already set, just update state
                                    this.updateFilterAwareDotState(activeVisibleDot, visibleActiveIndex, visibleActiveIndex, visibleDots);
                                }
                            }, 30);
                        }
                    } else { // Dot click or no change in active index
                        activeVisibleDot.style.transition = isDotClick ? 'all 0.3s ease' : 'none';
                        this.updateFilterAwareDotState(activeVisibleDot, visibleActiveIndex, visibleActiveIndex, visibleDots);
                    }
                }
            }

            this.previousVisibleActiveIndex = visibleActiveIndex;
            this.previousDirection = currentDirection;
        },

        /**
         * Helper function to update dot state based on visible dots array
         */
        updateFilterAwareDotState: function (dot, visibleIndex, activeVisibleIndex, visibleDots) {
            // Remove existing size classes
            dot.classList.remove('size-small', 'size-mid', 'size-large', 'size-active', 'visible');

            // Check if dot should be visible in the current window (indices are for visibleDots array)
            const isInWindow = (visibleIndex >= this.visibleStartIndex &&
                visibleIndex < this.visibleStartIndex + this.visibleRange);

            if (isInWindow) {
                dot.classList.add('visible');

                if (visibleIndex === activeVisibleIndex) {
                    dot.classList.add('size-active');
                } else if (visibleIndex === this.visibleStartIndex || visibleIndex === (this.visibleStartIndex + this.visibleRange - 1)) {
                    // Window edges
                    if ((activeVisibleIndex === this.visibleStartIndex + 1 && visibleIndex === this.visibleStartIndex) ||
                        (activeVisibleIndex === this.visibleStartIndex + this.visibleRange - 2 && visibleIndex === this.visibleStartIndex + this.visibleRange - 1)) {
                        dot.classList.add('size-mid');
                    } else {
                        dot.classList.add('size-small');
                    }
                } else if (visibleIndex === this.visibleStartIndex + 1) {
                    // Dot next to start edge
                    if (activeVisibleIndex === this.visibleStartIndex || activeVisibleIndex === this.visibleStartIndex + 1) {
                        dot.classList.add('size-large');
                    } else {
                        dot.classList.add('size-mid');
                    }
                } else if (visibleIndex === this.visibleStartIndex + this.visibleRange - 2) {
                    // Dot next to end edge
                    if (activeVisibleIndex === this.visibleStartIndex + this.visibleRange - 1 ||
                        activeVisibleIndex === this.visibleStartIndex + this.visibleRange - 2) {
                        dot.classList.add('size-large');
                    } else {
                        dot.classList.add('size-mid');
                    }
                } else {
                    // Other dots in window (not active, not edges, not next to edges)
                    dot.classList.add('size-large');
                }
            }
        },

        resetFlippedCard: function () {
            if (this.currentlyFlippedCard) {
                const flippedCardIndex = Array.from(this.flipCards).indexOf(this.currentlyFlippedCard);

                if (flippedCardIndex !== this.activeCardIndex) {
                    this.currentlyFlippedCard.classList.remove('flipped');
                    this.adjustCardHeight(this.currentlyFlippedCard, false);
                    this.currentlyFlippedCard = null;

                    // Don't hide card indicators - they should remain visible in regular mode
                    const cardIndicator = document.querySelector('.card-indicator');
                    if (cardIndicator) {
                        // Only hide if there's an active overlay, otherwise keep visible
                        const overlay = document.querySelector('.hamburger-overlay');
                        const isOverlayActive = overlay && overlay.style.display !== 'none';

                        if (!isOverlayActive) {
                            cardIndicator.style.opacity = '1';
                            cardIndicator.style.pointerEvents = 'auto';
                        }
                    }
                }
            }
        },

        adjustCardHeight: function (card, setHeight = false) {
            const inner = card.querySelector('.flip-card-inner');
            const back = card.querySelector('.flip-card-back');
            const originalHeight = 400; // Original standard card height

            if (setHeight) {
                // When flipped, expand to fit content if needed
                const contentHeight = back.scrollHeight;

                if (contentHeight > originalHeight) {
                    // Set card height to match content
                    card.style.height = `${contentHeight}px`;
                    inner.style.height = '100%';
                    back.style.minHeight = '100%';
                } else {
                    // Keep original height if content is smaller
                    card.style.height = `${originalHeight}px`;
                    inner.style.height = '100%';
                    back.style.minHeight = '100%';
                }
            } else {
                // When not flipped, return to standard height
                card.style.height = `${originalHeight}px`;
                inner.style.height = '100%';
                back.style.minHeight = '100%';
            }
        },

        addSectionTitles: function () {
            this.flipCards.forEach((card, index) => {
                const back = card.querySelector('.flip-card-back');

                // Create and add Summary title
                const summaryTitle = document.createElement('div');
                summaryTitle.className = 'section-title';
                summaryTitle.textContent = 'Summary';

                // Create and add Optimism Score title
                const scoreTitle = document.createElement('div');
                scoreTitle.className = 'section-title';
                scoreTitle.textContent = 'Optimism Score';

                // Create and add Source title
                const linkTitle = document.createElement('div');
                linkTitle.className = 'section-title';
                linkTitle.textContent = 'Source';

                // Get elements to insert titles before
                const summaryText = back.querySelector('p:first-of-type');
                const scoreText = back.querySelector('p:nth-of-type(2)');
                const linkElement = back.querySelector('a');

                // Cache card data for efficient filtering
                const cardData = {
                    summary: summaryText ? summaryText.textContent.toLowerCase() : '',
                    optimismScore: null
                };

                // Insert titles in the DOM
                if (summaryText) {
                    back.insertBefore(summaryTitle, summaryText);
                }

                if (scoreText) {
                    back.insertBefore(scoreTitle, scoreText);

                    // Style the score and cache the parsed value
                    const scoreMatch = scoreText.textContent.match(/(\d+)\/100/);
                    if (scoreMatch) {
                        const score = parseInt(scoreMatch[1]);
                        cardData.optimismScore = score; // Cache the parsed score

                        const scoreSpan = document.createElement('span');
                        scoreSpan.className = 'optimism-score';
                        scoreSpan.textContent = score + '/100';

                        if (score >= 70) {
                            scoreSpan.classList.add('score-high');
                        } else if (score >= 40) {
                            scoreSpan.classList.add('score-medium');
                        } else {
                            scoreSpan.classList.add('score-low');
                        }

                        scoreText.innerHTML = '';
                        scoreText.appendChild(scoreSpan);
                    }
                }

                if (linkElement) {
                    back.insertBefore(linkTitle, linkElement);
                }

                // Store cached data
                this.cardData[index] = cardData;
            });
        },

        preloadImages: function () {
            const images = document.querySelectorAll('.flip-card-front img, .flip-card-back img');
            images.forEach(img => {
                if (img.dataset.src) {
                    const preloadImg = new Image();
                    preloadImg.src = img.dataset.src;
                    preloadImg.onload = () => {
                        img.src = img.dataset.src;
                    };
                }
            });
        },

        // Setup card indicator
        setupCardIndicator: function () {
            // Dots are now pre-rendered in HTML, so just find and return them
            let cardIndicator = document.querySelector('.card-indicator');

            if (cardIndicator) {
                console.log('Card indicator found in HTML (no race condition possible - dots and cards render together)');

                // Mark the null card as filtered so navigation skips it
                const nullCard = document.querySelector('.flip-card.null-card');
                if (nullCard) {
                    nullCard.classList.add('filtered');
                    console.log('Null card marked as filtered');
                }

                return cardIndicator;
            }

            // FALLBACK: If dots don't exist in HTML for some reason, create them dynamically
            console.warn('Card indicator not found in HTML - creating dynamically as fallback');
            cardIndicator = document.createElement('div');
            cardIndicator.className = 'card-indicator';

            const currentFlipCards = document.querySelectorAll('.flip-card');
            console.log(`Creating ${currentFlipCards.length} indicator dots dynamically (fallback mode)`);

            currentFlipCards.forEach((card, index) => {
                const dot = document.createElement('div');

                if (card.classList.contains('null-card')) {
                    dot.className = 'indicator-dot null-dot filtered';
                    dot.dataset.index = index;
                    dot.dataset.isNullDot = 'true';
                    dot.textContent = '0';
                    card.classList.add('filtered');
                    console.log(`Created null dot at index ${index} and marked null card as filtered`);
                } else {
                    dot.className = 'indicator-dot' + (index === this.activeCardIndex ? ' active' : '');
                    dot.dataset.index = index;
                    dot.textContent = '';
                }

                cardIndicator.appendChild(dot);
            });

            document.body.appendChild(cardIndicator);
            console.log('Card indicator created dynamically (fallback)');

            return cardIndicator;
        },

        // Initialize common elements
        init: function () {
            // If the main container doesn't exist on this page, stop initialization.
            if (!this.container) {
                return;
            }

            // CRITICAL: Refresh flipCards to ensure we capture the null card from HTML
            this.flipCards = document.querySelectorAll('.flip-card');
            console.log(`CardSystem.init: Found ${this.flipCards.length} flip cards in DOM`);

            // Set initial activeCardIndex to first visible card (skip null card if it's first)
            for (let i = 0; i < this.flipCards.length; i++) {
                if (!this.flipCards[i].classList.contains('null-card')) {
                    this.activeCardIndex = i;
                    console.log('CardSystem: Initial activeCardIndex set to first regular card:', i);
                    break;
                }
            }

            const isMobile = this.isMobileDevice();
            console.log('CardSystem: Device detection - Mobile:', isMobile, 'Width:', window.innerWidth);

            // CRITICAL: Create cardIndicator FIRST before any measurements
            // The dots MUST exist in the DOM before we calculate available space for cards
            this.container.classList.add('with-coverflow');
            this.setupCardIndicator(); // Creates dots synchronously - MUST happen before card height calculations!

            console.log('CardSystem: Dot indicators created FIRST - now cards can measure available space');

            if (isMobile) {
                // BULLETPROOF SEQUENCING: Wait for complete resource loading, then measure space (dots now exist)
                this.waitForCompleteResourceLoading()
                    .then(() => this.calculateCardHeightFromCompleteUI()) // Measures space between header and EXISTING dots
                    .then((cardHeight) => this.processCardsWithGuaranteedHeight(cardHeight))
                    .then(() => this.finalizeAndShow())
                    .catch((error) => {
                        console.error('Mobile initialization failed:', error);
                        this.fallbackInit();
                    });
            } else {
                // Desktop: Standard approach
                this.loadUIInfrastructureForDesktop()
                    .then(() => this.processCardsAndFinalize(false));
            }
        },

        // NEW: Load UI infrastructure for desktop only
        loadUIInfrastructureForDesktop: function() {
            return new Promise((resolve) => {
                // Infrastructure already set up in init(), just resolve
                console.log("Desktop: UI infrastructure ready");
                requestAnimationFrame(() => resolve());
            });
        },

        // CHROME iOS VIEWPORT FLAGS
        _bulletproofCalculationComplete: false,
        _pageReadyWaiting: false,
        _measuredWithSuspiciousViewport: false,
        _postDisplayViewportHeight: null,
        _postDisplayMonitorActive: false,
        _viewportAtMeasurement: null,  // Track what viewport we actually measured with

        getViewportHeight: function() {
            return window.visualViewport ? window.visualViewport.height : window.innerHeight;
        },

        // NEW: Wait for complete resource loading with Chrome iOS preload detection
        waitForCompleteResourceLoading: function() {
            return new Promise((resolve) => {
                const promises = [];

                if (document.fonts) {
                    promises.push(document.fonts.ready);
                }

                if (!window.__allCSSLoadedFired) {
                    promises.push(new Promise((resolveCSS) => {
                        console.log('CardSystem: Waiting for allCSSLoaded event...');
                        document.addEventListener('allCSSLoaded', () => {
                            console.log('CardSystem: allCSSLoaded event received');
                            resolveCSS();
                        }, { once: true });
                    }));
                } else {
                    console.log('CardSystem: allCSSLoaded already fired');
                }

                if (document.readyState !== 'complete') {
                    promises.push(new Promise((resolveLoad) => {
                        window.addEventListener('load', resolveLoad);
                    }));
                }

                Promise.all(promises).then(() => {
                    const isChromeiOS = /CriOS/i.test(navigator.userAgent) ||
                                        (/Chrome/i.test(navigator.userAgent) && /iPhone|iPad/i.test(navigator.userAgent));

                    const proceedWithMeasurement = () => {
                        console.log('CardSystem: Proceeding with measurement, viewport:', this.getViewportHeight() + 'px');
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                requestAnimationFrame(() => {
                                    console.log('COMPLETE RESOURCE LOADING FINISHED - viewport:', this.getViewportHeight() + 'px');
                                    resolve();
                                });
                            });
                        });
                    };

                    const initialViewport = this.getViewportHeight();
                    // DEVICE-AGNOSTIC: Compare viewport to screen height
                    // If viewport is very close to screen height, address bar is likely hidden (preloaded state)
                    const screenHeight = window.screen.height;
                    const viewportToScreenRatio = initialViewport / screenHeight;
                    // If viewport is >85% of screen height on Chrome iOS, address bar is probably hidden
                    const viewportSeemsWrong = isChromeiOS && viewportToScreenRatio > 0.85;

                    console.log('CardSystem: Detection -', { isChromeiOS, initialViewport, viewportSeemsWrong });

                    if (viewportSeemsWrong) {
                        console.log('CardSystem: PAGE MAY BE PRELOADED - waiting for activation/visibility...');

                        let resolved = false;
                        const resolveOnce = () => {
                            if (resolved) return;
                            resolved = true;
                            console.log('CardSystem: Page activated/visible, viewport now:', this.getViewportHeight() + 'px');
                            setTimeout(() => {
                                console.log('CardSystem: Final viewport after settle:', this.getViewportHeight() + 'px');
                                proceedWithMeasurement();
                            }, 200);
                        };

                        const checkViewport = () => {
                            const currentViewport = this.getViewportHeight();
                            if (currentViewport < initialViewport - 50) {
                                console.log('CardSystem: Viewport shrunk (address bar appeared):', currentViewport + 'px');
                                resolveOnce();
                            } else if (!resolved) {
                                requestAnimationFrame(checkViewport);
                            }
                        };
                        requestAnimationFrame(checkViewport);

                        setTimeout(() => {
                            if (!resolved) {
                                const currentViewport = this.getViewportHeight();
                                console.log('CardSystem: Viewport timeout - proceeding with:', currentViewport + 'px');
                                // DEVICE-AGNOSTIC: If viewport still seems large relative to screen, mark suspicious
                                const currentRatio = currentViewport / screenHeight;
                                if (currentRatio > 0.85) {
                                    this._measuredWithSuspiciousViewport = true;
                                    this._viewportAtMeasurement = currentViewport;
                                    console.log('CardSystem: MARKED AS SUSPICIOUS (ratio:', currentRatio.toFixed(2), ') - pageReady will wait for post-display monitor');
                                }
                                resolveOnce();
                            }
                        }, 500);
                    } else {
                        console.log('CardSystem: Page appears normal, viewport:', initialViewport + 'px');
                        proceedWithMeasurement();
                    }
                });
            });
        },

        // NEW: Calculate card height from complete UI (ONE calculation, guaranteed correct)
        calculateCardHeightFromCompleteUI: function() {
            return new Promise((resolve, reject) => {
                const header = document.querySelector('.page-header');
                const cardIndicator = document.querySelector('.card-indicator');

                if (!header || !cardIndicator) {
                    reject(new Error('UI elements not found after complete loading'));
                    return;
                }

                // CRITICAL FIX: Wait for dot indicator to be fully rendered before measuring
                // Use multiple animation frames to ensure Safari mobile has settled
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Force layout calculation after settling
                        header.offsetHeight; // Trigger layout
                        cardIndicator.offsetHeight; // Trigger layout

                        const headerRect = header.getBoundingClientRect();
                        const indicatorRect = cardIndicator.getBoundingClientRect();

                        const availableSpace = indicatorRect.top - headerRect.bottom;

                        // SAFETY: Validate measurements are reasonable
                        if (availableSpace <= 100) {
                            console.warn('Mobile: Insufficient space detected:', availableSpace, 'px. Retrying measurement...');
                            // Retry once after a small delay
                            setTimeout(() => {
                                const retryHeaderRect = header.getBoundingClientRect();
                                const retryIndicatorRect = cardIndicator.getBoundingClientRect();
                                const retryAvailableSpace = retryIndicatorRect.top - retryHeaderRect.bottom;

                                if (retryAvailableSpace <= 100) {
                                    reject(new Error('Insufficient space detected after retry: ' + retryAvailableSpace + 'px'));
                                    return;
                                }

                                const gapRatio = 1/16;
                                const calculatedCardHeight = retryAvailableSpace * (1 - (2 * gapRatio));

                                console.log('CARD HEIGHT CALCULATED FROM COMPLETE UI (RETRY SUCCESSFUL):', {
                                    'Header bottom': retryHeaderRect.bottom.toFixed(3) + 'px',
                                    'Indicator top': retryIndicatorRect.top.toFixed(3) + 'px',
                                    'Available space': retryAvailableSpace.toFixed(3) + 'px',
                                    'Calculated height': calculatedCardHeight.toFixed(3) + 'px'
                                });

                                resolve(calculatedCardHeight);
                            }, 100);
                            return;
                        }

                        const gapRatio = 1/16;
                        const calculatedCardHeight = availableSpace * (1 - (2 * gapRatio));

                        console.log('CARD HEIGHT CALCULATED FROM COMPLETE UI (ONE PERFECT CALCULATION):', {
                            'Header bottom': headerRect.bottom.toFixed(3) + 'px',
                            'Indicator top': indicatorRect.top.toFixed(3) + 'px',
                            'Available space': availableSpace.toFixed(3) + 'px',
                            'Calculated height': calculatedCardHeight.toFixed(3) + 'px'
                        });

                        resolve(calculatedCardHeight);
                    });
                });
            });
        },

        // NEW: Process cards with guaranteed correct height
        processCardsWithGuaranteedHeight: function(cardHeight) {
            return new Promise((resolve) => {
                this.flipCards.forEach(card => {
                    card.style.height = `${cardHeight}px`;

                    const cardInner = card.querySelector('.flip-card-inner');
                    const cardFront = card.querySelector('.flip-card-front');
                    const cardBack = card.querySelector('.flip-card-back');

                    if (cardInner) cardInner.style.height = '100%';
                    if (cardFront) cardFront.style.height = '100%';
                    if (cardBack) cardBack.style.height = '100%';
                });

                this.container._heightSet = true;

                console.log('CARDS PROCESSED WITH GUARANTEED HEIGHT:', {
                    'Height applied': cardHeight.toFixed(3) + 'px',
                    'Cards updated': this.flipCards.length
                });

                resolve();
            });
        },

        // NEW: Finalize and show everything
        finalizeAndShow: function() {
            return new Promise((resolve) => {
                // Preload images, add sections, update UI
                this.preloadImages();
                this.addSectionTitles();
                this.updateUI();

                // Apply positioning with correct card heights
                if (!this.container._centeringApplied) {
                    this.updateMobileVerticalCentering();
                }

                // Setup responsive centering (no longer needs to handle touch events)
                this.setupResponsiveCentering();

                // Signal layout stability
                document.body.classList.add('layout-stable');
                console.log('CardSystem: Layout stable - container now visible');

                // Dispatch event to notify mobile.js that everything is ready for event attachment
                document.dispatchEvent(new CustomEvent('cardIndicatorReady'));
                console.log('CardSystem: cardIndicatorReady event dispatched - mobile.js can now attach events');

                console.log('MOBILE INITIALIZATION COMPLETE - Event-based coordination active');

                // Mark bulletproof calculation as complete
                this._bulletproofCalculationComplete = true;
                console.log('CardSystem: Bulletproof calculation complete');

                // Start post-display viewport monitor for Chrome iOS
                this.setupPostDisplayViewportMonitor();

                // Handle pageReady dispatch based on viewport state
                if (this._measuredWithSuspiciousViewport) {
                    console.log('CardSystem: pageReady DEFERRED - waiting for post-display viewport confirmation');
                    this._pageReadyWaiting = true;
                } else if (this._pageReadyWaiting) {
                    console.log('CardSystem: Dispatching deferred pageReady');
                    this._pageReadyWaiting = false;
                    this.dispatchPageReady();
                }

                resolve();
            });
        },

        // Post-display viewport monitor for Chrome iOS
        setupPostDisplayViewportMonitor: function() {
            const isChromeiOS = /CriOS/i.test(navigator.userAgent) ||
                                (/Chrome/i.test(navigator.userAgent) && /iPhone|iPad/i.test(navigator.userAgent));

            if (!isChromeiOS) {
                console.log('CardSystem: Not Chrome iOS, skipping post-display monitor');
                return;
            }

            this._postDisplayViewportHeight = this.getViewportHeight();
            this._postDisplayMonitorActive = true;

            console.log('CardSystem: Starting post-display viewport monitor (current:', this._postDisplayViewportHeight + 'px)');

            // CRITICAL FIX: Check IMMEDIATELY if viewport already changed
            // This catches the case where viewport shrunk during measurement/finalization
            // DEVICE-AGNOSTIC: Compare to measurement viewport, not hardcoded value
            if (this._measuredWithSuspiciousViewport && this._viewportAtMeasurement) {
                const shrinkage = this._viewportAtMeasurement - this._postDisplayViewportHeight;
                if (shrinkage > 50) {
                    console.log('CardSystem: IMMEDIATE RECALC - viewport shrunk by', shrinkage + 'px (from', this._viewportAtMeasurement + 'px to', this._postDisplayViewportHeight + 'px)');
                    this._postDisplayMonitorActive = false;
                    this.recalculateAfterViewportChange();
                    return;
                }
            }

            const checkForViewportChange = () => {
                if (!this._postDisplayMonitorActive) return;

                const currentHeight = this.getViewportHeight();
                const delta = this._postDisplayViewportHeight - currentHeight;

                if (delta > 50) {
                    console.log('CardSystem: POST-DISPLAY viewport shrunk!', this._postDisplayViewportHeight + 'px ->', currentHeight + 'px');
                    console.log('CardSystem: Address bar appeared - RECALCULATING LAYOUT');

                    this._postDisplayMonitorActive = false;
                    this._postDisplayViewportHeight = currentHeight;
                    this.recalculateAfterViewportChange();
                    return;
                }

                requestAnimationFrame(checkForViewportChange);
            };

            requestAnimationFrame(checkForViewportChange);

            setTimeout(() => {
                if (this._postDisplayMonitorActive) {
                    console.log('CardSystem: Post-display monitor timeout - viewport stable at', this.getViewportHeight() + 'px');
                    this._postDisplayMonitorActive = false;

                    if (this._pageReadyWaiting && this._measuredWithSuspiciousViewport) {
                        console.log('CardSystem: Viewport confirmed stable, dispatching pageReady');
                        this._measuredWithSuspiciousViewport = false;
                        this._pageReadyWaiting = false;
                        this.dispatchPageReady();
                    }
                }
            }, 3000);
        },

        // Recalculate layout after viewport change
        recalculateAfterViewportChange: function() {
            console.log('CardSystem: Recalculating layout after viewport change...');

            // CRITICAL: Reset container transform before measuring
            if (this.container) {
                console.log('CardSystem: Resetting container transform before recalculation');
                this.container.style.transform = '';
                this.container._centeringApplied = false;
                void this.container.offsetHeight;
            }

            this.calculateCardHeightFromCompleteUI()
                .then((newCardHeight) => {
                    console.log('CardSystem: New card height calculated:', newCardHeight.toFixed(3) + 'px');

                    this.flipCards.forEach(card => {
                        card.style.height = `${newCardHeight}px`;
                        const cardInner = card.querySelector('.flip-card-inner');
                        const cardFront = card.querySelector('.flip-card-front');
                        const cardBack = card.querySelector('.flip-card-back');
                        if (cardInner) cardInner.style.height = '100%';
                        if (cardFront) cardFront.style.height = '100%';
                        if (cardBack) cardBack.style.height = '100%';
                    });

                    this.container._centeringApplied = false;
                    this.updateMobileVerticalCentering();
                    this.updateUI();

                    console.log('CardSystem: Layout recalculated successfully after viewport change');

                    if (this._pageReadyWaiting) {
                        console.log('CardSystem: Recalculation complete, dispatching pageReady');
                        this._measuredWithSuspiciousViewport = false;
                        this._pageReadyWaiting = false;
                        this.dispatchPageReady();
                    }
                })
                .catch((error) => {
                    console.error('CardSystem: Recalculation failed:', error);
                    if (this._pageReadyWaiting) {
                        this._measuredWithSuspiciousViewport = false;
                        this._pageReadyWaiting = false;
                        this.dispatchPageReady();
                    }
                });
        },

        // NEW: Fallback initialization
        fallbackInit: function() {
            console.warn('Using fallback initialization');
            // Infrastructure already set up, just finalize
            this.processCardsAndFinalize(false);
        },


        // NEW: Process cards with correct heights, then finalize
        processCardsAndFinalize: function(isMobile, calculatedCardHeight = null) {
            return new Promise((resolve) => {
                // Apply calculated height to cards if mobile
                if (isMobile && calculatedCardHeight) {
                    this.flipCards.forEach(card => {
                        card.style.height = `${calculatedCardHeight}px`;

                        // Ensure inner elements scale properly
                        const cardInner = card.querySelector('.flip-card-inner');
                        const cardFront = card.querySelector('.flip-card-front');
                        const cardBack = card.querySelector('.flip-card-back');

                        if (cardInner) cardInner.style.height = '100%';
                        if (cardFront) cardFront.style.height = '100%';
                        if (cardBack) cardBack.style.height = '100%';
                    });

                    // Mark height as set to prevent recalculation
                    this.container._heightSet = true;

                    console.log('CARDS PROCESSED WITH GUARANTEED CORRECT HEIGHT:', {
                        'Applied height': calculatedCardHeight.toFixed(3) + 'px',
                        'Cards processed': this.flipCards.length
                    });
                }

                // Preload images
                this.preloadImages();

                // Add section titles
                this.addSectionTitles();

                // Initial UI update (cards now have correct height)
                this.updateUI();

                // Apply positioning
                if (isMobile) {
                    if (!this.container._centeringApplied) {
                        this.updateMobileVerticalCentering();
                    }
                } else {
                    // Desktop: Systematic spacing disabled - uses natural CSS layout
                    // The applySystematicSpacing() function is experimental and not currently used
                    // setTimeout(() => {
                    //     this.applySystematicSpacing();
                    // }, 100);
                }

                // Add event listeners for responsive centering
                this.setupResponsiveCentering();

                console.log("CardSystem initialized with BULLETPROOF sequencing");
                resolve();
            });
        },

        // RESTORED: Setup necessary event listeners but avoid responsive recalculation
        setupResponsiveCentering: function() {
            // Don't do responsive recalculation to avoid Safari race conditions
            // But ensure event listeners are properly set up for mobile functionality

            if (this.isMobileDevice()) {
                // Ensure dot indicator is ready for touch events
                const cardIndicator = document.querySelector('.card-indicator');
                if (cardIndicator) {
                    // Force a layout calculation to ensure element is positioned
                    cardIndicator.offsetHeight;
                    console.log('Mobile: Dot indicator prepared for touch events');
                } else {
                    console.warn('Mobile: Card indicator not found for touch setup');
                }
            }

            console.log('Mobile: Event listeners enabled, responsive recalculation disabled');
        },

        // Utility debounce function
        debounce: function(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func.apply(this, args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        // Add initialization for dots
        initializeDots: function () {
            // Setup card indicator click handlers (DESKTOP ONLY - mobile uses touch events)
            const cardIndicator = document.querySelector('.card-indicator');
            if (cardIndicator && !this.isMobileDevice()) {
                cardIndicator.querySelectorAll('.indicator-dot').forEach((dot) => {
                    dot.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const index = parseInt(dot.dataset.index);
                        this.activeCardIndex = index;
                        this.updateUI();
                    });
                });
                console.log('Desktop: Click listeners attached to dots');
            } else if (cardIndicator) {
                console.log('Mobile: Skipping click listeners (using touch events instead)');
            }

            // Initialize dots
            this.updateInstagramStyleDots(this.activeCardIndex);
        },

        // Navigation helper functions for filtering-aware navigation
        findNextVisibleIndex: function (currentIndex) {
            // Find next unfiltered card
            for (let i = currentIndex + 1; i < this.flipCards.length; i++) {
                if (!this.flipCards[i].classList.contains('filtered')) {
                    return i;
                }
            }
            return currentIndex; // No next visible card found
        },

        findPrevVisibleIndex: function (currentIndex) {
            // Find previous unfiltered card
            for (let i = currentIndex - 1; i >= 0; i--) {
                if (!this.flipCards[i].classList.contains('filtered')) {
                    return i;
                }
            }
            return currentIndex; // No previous visible card found
        },

        // ✅ CRITICAL: Navigation coordination system to prevent multiple active dots
        requestNavigation: function(newIndex, source = 'unknown') {
            // Validate index
            if (newIndex < 0 || newIndex >= this.flipCards.length) {
                console.warn(`Navigation: Invalid index ${newIndex} from ${source}`);
                return false;
            }

            // Check if navigation is locked
            if (this._navigationLock) {
                console.log(`Navigation: Locked, queuing request from ${source} for index ${newIndex}`);
                this._pendingNavigation = { index: newIndex, source: source };
                return false;
            }

            // Check if already at target index
            if (this.activeCardIndex === newIndex) {
                console.log(`Navigation: Already at index ${newIndex}, ignoring ${source} request`);
                return true;
            }

            // Lock navigation and update state atomically
            this._navigationLock = true;
            console.log(`Navigation: Accepted ${source} request for index ${newIndex}`);

            // Update active card index
            this.activeCardIndex = newIndex;

            // Update UI immediately
            this.updateUI();

            // Release lock after one frame to allow UI updates
            setTimeout(() => {
                this._navigationLock = false;

                // Process any pending navigation
                if (this._pendingNavigation) {
                    const pending = this._pendingNavigation;
                    this._pendingNavigation = null;
                    console.log(`Navigation: Processing queued ${pending.source} request for index ${pending.index}`);
                    this.requestNavigation(pending.index, `queued-${pending.source}`);
                }
            }, 16); // One frame duration

            return true;
        },

        // Utility function to ensure active card is not filtered
        ensureActiveCardVisible: function () {
            const activeCard = this.flipCards[this.activeCardIndex];
            if (activeCard && activeCard.classList.contains('filtered')) {
                // Find the first visible card
                for (let i = 0; i < this.flipCards.length; i++) {
                    if (!this.flipCards[i].classList.contains('filtered')) {
                        this.activeCardIndex = i;
                        return i;
                    }
                }
                // If no visible cards found, keep current index
            }
            return this.activeCardIndex;
        },

        // New: Proper state transition management
        setFilteringState: function (isFiltering, phase = 'idle') {
            this.isFiltering = isFiltering;
            this.filteringPhase = phase;
            this.pendingStateChange = isFiltering;

            console.log(`CardSystem: State changed - isFiltering: ${isFiltering}, phase: ${phase}`);

            // Dispatch event for any listeners
            document.dispatchEvent(new CustomEvent('cardSystemStateChange', {
                detail: { isFiltering, phase }
            }));
        },

        // New: Check if any filtering operation is in progress
        isFilteringInProgress: function () {
            return this.isFiltering || this.pendingStateChange || this.filteringPhase !== 'idle';
        },

        toggleBodyScrollLock: function (isLocked) {
            if (isLocked) {
                document.body.classList.add('body-no-scroll');
            } else {
                document.body.classList.remove('body-no-scroll');
            }
        },

        // Method to register readiness from a specific platform script
        registerPlatformReady: function (platform) {
            console.log(`CardSystem: Received readiness signal from "${platform}"`);
            if (platform === 'mobile' || platform === 'desktop') {
                // Prevent duplicate readiness signals
                if (this.platformReadiness[platform]) {
                    console.warn(`CardSystem: Platform "${platform}" already signaled readiness. Ignoring duplicate.`);
                    return;
                }

                this.platformReadiness[platform] = true;

                // Check readiness immediately when platform signals
                this.checkOverallLayoutReadiness();
            } else {
                console.warn(`CardSystem: Unknown platform "${platform}" signaled readiness.`);
            }
        },

        // Determines if the *currently active* platform has signaled readiness
        checkOverallLayoutReadiness: function () {
            // Prevent multiple simultaneous calls
            if (this.isLayoutReady || this._checkingReadiness) {
                return;
            }

            this._checkingReadiness = true;

            // Determine which platform is currently active based on environment
            const isCurrentPlatformMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
            const currentPlatform = isCurrentPlatformMobile ? 'mobile' : 'desktop';

            console.log(`CardSystem: Checking readiness for active platform "${currentPlatform}"`);

            // Check if the *active* platform has signaled readiness.
            if (this.platformReadiness[currentPlatform]) {
                console.log(`CardSystem: All required readiness signals met for "${currentPlatform}". Finalizing layout.`);
                this.isLayoutReady = true;
                this.finalizeLayout();
            } else {
                console.log(`CardSystem: Platform "${currentPlatform}" not ready yet. Current readiness:`, this.platformReadiness);
                // Will wait for platform to signal readiness - no timeout fallback
            }

            this._checkingReadiness = false;
        },

        // Helper for mobile check
        isMobileDeviceCheck: function () {
            return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
        },

        // Helper for mobile check
        isMobileDeviceCheck: function () {
            return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
        },

        // *** NEW: Centralized layout finalization ***
        finalizeLayout: function () {
            console.log('CardSystem: finalizeLayout called. Ensuring layout is ready and complete.');

            if (!this.isLayoutReady) {
                console.warn('CardSystem.finalizeLayout called but isLayoutReady is false. This might indicate an issue.');
            }

            // Mark as layout ready
            this.isLayoutReady = true;

            // *** CRITICAL FIX: Apply filters BEFORE initial display ***
            const applyFiltersAndPosition = () => {
                // Wait for all scripts to be loaded before applying filters
                const waitForScripts = () => {
                    return new Promise((resolve, reject) => {
                        // Check if scripts are already loaded
                        if (typeof window.filtersCompleteInitialization === 'function') {
                            console.log('CardSystem: Scripts already loaded, proceeding immediately');
                            resolve();
                            return;
                        }

                        // Check if scriptsLoaded event already fired
                        if (window.__scriptsLoadedFired) {
                            console.log('CardSystem: scriptsLoaded event already fired, proceeding');
                            resolve();
                            return;
                        }

                        console.log('CardSystem: Waiting for scriptsLoaded event...');

                        // Set up event listener - no timeout, must wait for actual event
                        const onScriptsLoaded = () => {
                            console.log('CardSystem: scriptsLoaded event received');
                            resolve();
                        };

                        document.addEventListener('scriptsLoaded', onScriptsLoaded, { once: true });
                    });
                };

                waitForScripts().then(() => {
                    console.log('CardSystem: Scripts loaded, applying filters before initial display...');

                    // Apply filters if function is available
                    if (typeof window.filtersCompleteInitialization === 'function') {
                        try {
                            // Pass callback to be called when filtering is complete
                            window.filtersCompleteInitialization(() => {
                                // Filtering is complete, now position and dispatch pageReady
                                this.positionAndDispatchPageReady();
                            });
                        } catch (error) {
                            console.warn('CardSystem: Error applying filters:', error);
                            // Still dispatch pageReady even if filtering failed
                            this.positionAndDispatchPageReady();
                        }
                    } else {
                        console.warn('CardSystem: filtersCompleteInitialization not available');
                        // No filtering available, just position and dispatch
                        this.positionAndDispatchPageReady();
                    }
                }).catch((error) => {
                    console.error('CardSystem: Critical error in script loading:', error);
                    console.error('CardSystem: Cannot proceed without scripts - layout will not be finalized');
                    // Don't proceed if scripts failed to load - this indicates a serious problem
                });
            };

            // Execute filter application and positioning
            applyFiltersAndPosition();

            // Update UI one final time
            this.updateUI();

            // Mark as fully initialized
            this.isFullyInitialized = true;

            console.log('CardSystem: Layout finalization complete. App is fully initialized.');
        },



        // Position cards and dispatch pageReady
        positionAndDispatchPageReady: function () {
            // Try to position to the active card if possible
            if (typeof this.moveToCard === 'function') {
                // Mobile: positioning is synchronous
                this.moveToCard(this.activeCardIndex, false); // false = instant
            } else if (typeof this.scrollToCard === 'function') {
                // Desktop: positioning is synchronous with scrollToCard
                this.scrollToCard(this.activeCardIndex, false); // false = instant
            }

            // Always dispatch pageReady regardless of whether positioning worked
            // Use requestAnimationFrame to ensure any DOM changes are processed
            requestAnimationFrame(() => {
                this.dispatchPageReady();
            });
        },

        // Centralized pageReady dispatch
        dispatchPageReady: function () {
            // Prevent multiple dispatches
            if (this._pageReadyDispatched) {
                console.warn('CardSystem: pageReady already dispatched, ignoring duplicate call');
                return;
            }

            // CRITICAL: If bulletproof calculation hasn't completed yet, defer pageReady
            if (!this._bulletproofCalculationComplete) {
                console.log('CardSystem: pageReady DEFERRED - bulletproof calculation not yet complete (splash will extend)');
                this._pageReadyWaiting = true;
                return;
            }

            // Ensure cards have active class before dispatching
            this.updateUI();

            // Force a reflow to ensure DOM changes are applied
            void document.body.offsetHeight;

            // Mark as dispatched and dispatch immediately
            this._pageReadyDispatched = true;
            window.__pageReadyFired = true;

            console.log('CardSystem: Dispatching pageReady event synchronously');
            document.dispatchEvent(new CustomEvent('pageReady'));
        }
    };

    // Initialize common functionality
    window.CardSystem.init();

    // Initialize dots when DOM is ready
    document.addEventListener('DOMContentLoaded', function () {
        CardSystem.initializeDots();
    });

} // End of the conditional block for CardSystem initialization