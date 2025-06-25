// --- START OF FILE common.js ---

// Global variables and utility functions shared between implementations
window.CardSystem = {
    // DOM elements
    flipCards: document.querySelectorAll('.flip-card'),
    container: document.querySelector('.container'),
    isFiltering: false, // Flag to indicate if filtering is active

    // State variables
    activeCardIndex: 0,
    currentlyFlippedCard: null,
    isManuallyFlipping: false,
    isUserClicking: false,

    // Dot indicator properties
    visibleStartIndex: 0,
    visibleRange: 9, // Show a maximum of 9 dots at a time
    previousDirection: 0, // 0 = initial, 1 = right, -1 = left
    previousActiveIndex: 0,
    previousVisibleActiveIndex: -1, // Added for filter-aware logic

    // Utility functions
    updateUI: function() {
        // Ensure header is accounted for before positioning cards
        const header = document.querySelector('.page-header');
        if (header && this.container) {
            const headerHeight = header.offsetHeight;
            const minPadding = headerHeight + 20;
            const currentPadding = parseInt(getComputedStyle(this.container).paddingTop);
            if (currentPadding < minPadding) {
                this.container.style.paddingTop = minPadding + 'px';
            }
        }

        // Find the correct active index if the current one is filtered
        this.ensureActiveCardVisible();

        // Update card active classes
        this.flipCards.forEach((card, i) => {
            card.classList.toggle('active', i === this.activeCardIndex);
        });

        // Update dot active/filtered classes and text content
        let visibleDotCounter = 1;
        document.querySelectorAll('.indicator-dot').forEach((dot, i) => {
            const card = this.flipCards[i];
            const isFiltered = card && card.classList.contains('filtered');

            dot.classList.toggle('active', i === this.activeCardIndex);
            dot.classList.toggle('filtered', isFiltered);

            if (!isFiltered) {
                dot.textContent = visibleDotCounter.toString();
                visibleDotCounter++;
            }
        });

        // Show/hide indicator container based on currently flipped card - KEEP VISIBLE IN REGULAR MODE
        const cardIndicator = document.querySelector('.card-indicator');
        if (cardIndicator) {
            // Only hide dots if there's an active overlay (hamburger menu)
            const overlay = document.querySelector('.hamburger-overlay');
            const isOverlayActive = overlay && overlay.style.display !== 'none';

            if (isOverlayActive) {
                // Hide dots only when overlay is active
                cardIndicator.style.opacity = '0';
                cardIndicator.style.pointerEvents = 'none';
            } else {
                // Always show dots in regular mode - never hide them for flipped cards
                cardIndicator.style.opacity = '1';
                cardIndicator.style.pointerEvents = 'auto';
            }
        }

        // Run the new, filter-aware dot styling logic
        this.updateInstagramStyleDots(this.activeCardIndex);
    },

    /**
     * HYBRID: Filter-aware dot indicator logic with smooth Instagram-style transitions.
     * Combines the filtering logic from the new version with the smooth animations from the old version.
     * @param {number} masterActiveIndex The index of the active card in the full, original list.
     */
    updateInstagramStyleDots: function(masterActiveIndex) {
        const allDots = document.querySelectorAll('.indicator-dot');
        const visibleDots = Array.from(allDots).filter(dot => !dot.classList.contains('filtered'));
        const totalVisibleDots = visibleDots.length;

        if (totalVisibleDots === 0 || masterActiveIndex < 0) {
            allDots.forEach(dot => {
                dot.className = dot.className.replace(/size-\\w+|visible/g, '').trim();
                dot.style.transition = '';
            });
            this.previousVisibleActiveIndex = -1;
            return;
        }

        let activeDotMaster = allDots[masterActiveIndex];
        let visibleActiveIndex = visibleDots.indexOf(activeDotMaster);

        // Adjust if masterActiveIndex points to a filtered card
        if (visibleActiveIndex === -1) {
            let newMasterActiveIndex = -1;
            // Try to find the closest visible card if the current one is filtered
            if (this.isFiltering || (activeDotMaster && activeDotMaster.classList.contains('filtered'))) {
                // Search forward
                for (let i = masterActiveIndex; i < allDots.length; i++) {
                    if (!allDots[i].classList.contains('filtered')) {
                        newMasterActiveIndex = i;
                        break;
                    }
                }
                // If not found, search backward
                if (newMasterActiveIndex === -1) {
                    for (let i = masterActiveIndex - 1; i >= 0; i--) {
                        if (!allDots[i].classList.contains('filtered')) {
                            newMasterActiveIndex = i;
                            break;
                        }
                    }
                }
            }

            if (newMasterActiveIndex !== -1) {
                masterActiveIndex = newMasterActiveIndex; // Update masterActiveIndex to the new visible one
                activeDotMaster = allDots[masterActiveIndex];
                visibleActiveIndex = visibleDots.indexOf(activeDotMaster);
            } else {
                // No visible dot can be made active, clear all and return
                allDots.forEach(dot => { dot.className = dot.className.replace(/size-\\w+|visible/g, '').trim(); dot.style.transition = ''; });
                this.previousVisibleActiveIndex = -1;
                return;
            }
            // If still -1 after adjustment, something is wrong or no visible dots available
            if (visibleActiveIndex === -1) {
                 allDots.forEach(dot => { dot.className = dot.className.replace(/size-\\w+|visible/g, '').trim(); dot.style.transition = ''; });
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
    updateFilterAwareDotState: function(dot, visibleIndex, activeVisibleIndex, visibleDots) {
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

    resetFlippedCard: function() {
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

    adjustCardHeight: function(card, setHeight = false) {
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

    addSectionTitles: function() {
        this.flipCards.forEach(card => {
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

            // Insert titles in the DOM
            if (summaryText) {
                back.insertBefore(summaryTitle, summaryText);
            }

            if (scoreText) {
                back.insertBefore(scoreTitle, scoreText);

                // Style the score
                const scoreMatch = scoreText.textContent.match(/(\d+)\/100/);
                if (scoreMatch) {
                    const score = parseInt(scoreMatch[1]);
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
        });
    },

    preloadImages: function() {
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
    setupCardIndicator: function() {
        const cardIndicator = document.createElement('div');
        cardIndicator.className = 'card-indicator';

        this.flipCards.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.className = 'indicator-dot' + (index === 0 ? ' active' : '');
            dot.dataset.index = index;
            dot.textContent = (index + 1).toString();
            cardIndicator.appendChild(dot);
        });

        document.body.appendChild(cardIndicator);
        return cardIndicator;
    },

    // Initialize common elements
    init: function() {
        // Add coverflow class
        this.container.classList.add('with-coverflow');

        // Setup card indicator
        this.setupCardIndicator();

        // Preload images
        this.preloadImages();

        // Add section titles
        this.addSectionTitles();

        // Initial UI update
        this.updateUI();

        console.log("CardSystem initialized");

        // Check for auto-apply filters immediately after initialization
        this.checkAutoApplyFilters();
    },

    // Check and apply auto-filters if enabled
    checkAutoApplyFilters: function() {
        if (localStorage.getItem('autoApplyFilters') === 'true') {
            const excludes = localStorage.getItem('Excludes') || '';

            if (excludes.trim()) {
                console.log('Auto-applying filters during CardSystem initialization...');

                // Apply filters immediately
                this.isFiltering = true;

                // Apply the filtering logic directly here
                const excludeTerms = excludes.toLowerCase().split(',').map(term => term.trim()).filter(Boolean);
                let firstVisibleIndex = -1;

                this.flipCards.forEach((card, index) => {
                    const summaryElement = card.querySelector('.flip-card-back p:first-of-type');
                    const summary = summaryElement ? summaryElement.textContent.toLowerCase() : '';

                    const shouldHide = excludeTerms.some(term => summary.includes(term));

                    card.classList.toggle('filtered', shouldHide);

                    if (!shouldHide && firstVisibleIndex === -1) {
                        firstVisibleIndex = index;
                    }
                });

                // Update active card index to first visible card
                if (firstVisibleIndex !== -1) {
                    this.activeCardIndex = firstVisibleIndex;
                    this.updateUI();
                }

                // Re-enable after filtering
                setTimeout(() => {
                    this.isFiltering = false;
                    console.log("Auto-apply filters complete during initialization.");
                }, 100);
            }
        }
    },

    // Add initialization for dots
    initializeDots: function() {
        // Setup card indicator click handlers
        const cardIndicator = document.querySelector('.card-indicator');
        if (cardIndicator) {
            cardIndicator.querySelectorAll('.indicator-dot').forEach((dot) => {
                dot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(dot.dataset.index);
                    this.activeCardIndex = index;
                    this.updateUI();
                });
            });
        }

        // Initialize dots
        this.updateInstagramStyleDots(this.activeCardIndex);
    },

    // Navigation helper functions for filtering-aware navigation
    findNextVisibleIndex: function(currentIndex) {
        // Find next unfiltered card
        for (let i = currentIndex + 1; i < this.flipCards.length; i++) {
            if (!this.flipCards[i].classList.contains('filtered')) {
                return i;
            }
        }
        return currentIndex; // No next visible card found
    },

    findPrevVisibleIndex: function(currentIndex) {
        // Find previous unfiltered card
        for (let i = currentIndex - 1; i >= 0; i--) {
            if (!this.flipCards[i].classList.contains('filtered')) {
                return i;
            }
        }
        return currentIndex; // No previous visible card found
    },

    // Utility function to ensure active card is not filtered
    ensureActiveCardVisible: function() {
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

    toggleBodyScrollLock: function(isLocked) {
        if (isLocked) {
            document.body.classList.add('body-no-scroll');
        } else {
            document.body.classList.remove('body-no-scroll');
        }
    }

    // Utility functions
};

// Initialize common functionality
window.CardSystem.init();

// Initialize dots when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    CardSystem.initializeDots();
});
// --- END OF FILE common.js ---