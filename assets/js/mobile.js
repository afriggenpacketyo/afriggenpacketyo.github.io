// Mobile-specific implementation
(function() {
    // Get the CardSystem from common.js
    const CardSystem = window.CardSystem;
    const container = CardSystem.container;
    const flipCards = CardSystem.flipCards;



// Mobile-specific variables
let touchStartX = 0;
let touchEndX = 0;
let lastTouchX = 0;
let touchStartTime = 0;
let touchEndTime = 0;
let touchScrollStartTime = 0;
let touchVelocity = 0;
let isSlowTouchScroll = false;
let swipeVelocity = 0;
let isScrolling = false;
let scrollEndTimeout;
let currentSwipeOffset = 0;
let flippedCardTouchStartTime = 0;
let flippedCardTouchEndTime = 0;
let lastDotUpdateTime = 0;
let dotUpdateThrottleTime = 100; // ms between dot updates during fast scrolling

// Constants
const minSwipeDistance = 50;
const slowScrollThreshold = 0.5; // pixels per millisecond
const velocityThreshold = 0.3; // pixels per millisecond
const superFastVelocityThreshold = 0.8; // pixels per millisecond

// Store previous active index to determine swipe direction
let previousActiveIndex = CardSystem.activeCardIndex || 0;

// Track direction of movement
let lastSwipeDirection = 0; // 0 = initial, 1 = right, -1 = left

// Track current visible range and position
let visibleStartIndex = 0;
let visibleRange = 9; // Show 9 dots at a time
let previousDirection = 0; // 0 = initial, 1 = right, -1 = left
let centerPointActivated = true; // Whether the center point is currently activated
let consecutiveSwipesInSameDirection = 0; // Count of swipes in the same direction

// Override updateDotState function with a version that ensures symmetric transitions
function updateDotState(dot, index, activeIndex) {
    // Remove existing classes
    dot.classList.remove('size-small', 'size-mid', 'size-large', 'size-active', 'visible');

    // Check if dot should be visible
    const isVisible = (index >= visibleStartIndex &&
                      index < visibleStartIndex + visibleRange);

    if (isVisible) {
        dot.classList.add('visible');
        
        // First, ensure ALL dots have consistent transition timing for uniformity
        dot.style.transition = 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';

        // Special case: when absolute 2nd dot or 2nd-to-last dot is active
        const isSecondDotActive = activeIndex === 1;
        const isSecondToLastDotActive = activeIndex === (flipCards.length - 2);

        if (index === activeIndex) {
            // Active dot gets active size
            dot.classList.add('size-active');
        } else if (index === 0 || index === (flipCards.length - 1)) {
            // First and last dots (ABSOLUTE positions, not relative to visible window)
            // When absolute second dot is active, first dot needs consistent mid size
            if ((isSecondDotActive && index === 0) || 
                (isSecondToLastDotActive && index === (flipCards.length - 1))) {
                dot.classList.add('size-mid');
            } else if (index === visibleStartIndex || index === (visibleStartIndex + visibleRange - 1)) {
                // Edge dots in the visible window
                if ((activeIndex === visibleStartIndex + 1 && index === visibleStartIndex) ||
                    (activeIndex === visibleStartIndex + visibleRange - 2 && index === visibleStartIndex + visibleRange - 1)) {
                    dot.classList.add('size-mid');
                } else {
                    dot.classList.add('size-small');
                }
            } else {
                dot.classList.add('size-small');
            }
        } else if (index === 1) {
            // Absolute second dot
            if (activeIndex === 0 || activeIndex === 1 || activeIndex === 2) {
                dot.classList.add('size-large');
            } else {
                dot.classList.add('size-mid');
            }
        } else if (index === (flipCards.length - 2)) {
            // Absolute second-to-last dot
            if (activeIndex === (flipCards.length - 3) || 
                activeIndex === (flipCards.length - 2) || 
                activeIndex === (flipCards.length - 1)) {
                dot.classList.add('size-large');
            } else {
                dot.classList.add('size-mid');
            }
        } else if (index === visibleStartIndex || index === (visibleStartIndex + visibleRange - 1)) {
            // Edge dots (first and last in visible window)
            if ((activeIndex === visibleStartIndex + 1 && index === visibleStartIndex) ||
                (activeIndex === visibleStartIndex + visibleRange - 2 && index === visibleStartIndex + visibleRange - 1)) {
                dot.classList.add('size-mid');
            } else {
                dot.classList.add('size-small');
            }
        } else if (index === visibleStartIndex + 1) {
            // Second dot in visible window
            if (activeIndex === visibleStartIndex || activeIndex === visibleStartIndex + 1) {
                dot.classList.add('size-large');
            } else {
                dot.classList.add('size-mid');
            }
        } else if (index === visibleStartIndex + visibleRange - 2) {
            // Second-to-last dot in visible window
            if (activeIndex === visibleStartIndex + visibleRange - 1 ||
                activeIndex === visibleStartIndex + visibleRange - 2) {
                dot.classList.add('size-large');
            } else {
                dot.classList.add('size-mid');
            }
        } else {
            // All other inactive dots get the large size
            dot.classList.add('size-large');
        }
    }
}

// Make sure we're overriding the updateInstagramStyleDots to use our updated function
// Override the original function to use our updated updateDotState
const originalUpdateInstagramStyleDots = updateInstagramStyleDots;
function updateInstagramStyleDots(activeIndex) {
    const dots = document.querySelectorAll('.indicator-dot');
    const totalDots = dots.length;

    // Determine swipe direction (-1 for left, 1 for right)
    const currentDirection = (activeIndex > previousActiveIndex) ? 1 : -1;
    
    // Calculate the actual number of positions moved
    const positionsMoved = Math.abs(activeIndex - previousActiveIndex);

    // Skip animation if we're clicking the same dot we're already on
    const isSameDot = activeIndex === previousActiveIndex;

    // Special case - handle transitions to/from absolute 2nd and 2nd-to-last dots
    const isAbsoluteSecondDotInvolved = activeIndex === 1 || previousActiveIndex === 1;
    const isAbsoluteSecondToLastDotInvolved = activeIndex === (totalDots - 2) || previousActiveIndex === (totalDots - 2);
    
    // For these special cases, ensure edge dots get proper transition timing
    if (isAbsoluteSecondDotInvolved || isAbsoluteSecondToLastDotInvolved) {
        dots.forEach((dot, index) => {
            if ((index === 0 && isAbsoluteSecondDotInvolved) || 
                (index === totalDots - 1 && isAbsoluteSecondToLastDotInvolved)) {
                // Force reflow before setting transition to ensure it applies
                void dot.offsetHeight;
                dot.style.transition = 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
            }
        });
    }

    // Original edge case logic for window sliding
    if (activeIndex < visibleStartIndex + 2) {
        // Near left edge - shift window left
        visibleStartIndex = Math.max(0, activeIndex - 2);
    } else if (activeIndex > visibleStartIndex + visibleRange - 3) {
        // Near right edge - shift window right
        visibleStartIndex = Math.min(totalDots - visibleRange, activeIndex - (visibleRange - 3));
    }

    // CRITICAL CHANGE: Apply staggered transitions based on direction
    if (!isSameDot && positionsMoved > 1) {
        // Apply staggered transitions in the correct direction
        dots.forEach((dot, index) => {
            // Calculate distance from the dot to the active index
            let distanceToActive;
            
            if (currentDirection > 0) {
                // Going right (increasing index)
                // Dots before active should transition first, then dots after
                distanceToActive = index <= activeIndex ? 
                    (activeIndex - index) : 
                    (totalDots - index + activeIndex);
            } else {
                // Going left (decreasing index)
                // Dots after active should transition first, then dots before
                distanceToActive = index >= activeIndex ? 
                    (index - activeIndex) : 
                    (totalDots - activeIndex + index);
            }
            
            // Apply staggered delay based on distance
            const delayMs = Math.min(distanceToActive * 30, 150); // Max 150ms delay
            dot.style.transitionDelay = `${delayMs}ms`;
            dot.style.transition = `all 0.25s cubic-bezier(0.4, 0.0, 0.2, 1) ${delayMs}ms`;
        });
    } else {
        // For single position moves or same dot, use standard transition
        dots.forEach((dot, index) => {
            if (!isSameDot) {
                dot.style.transitionDelay = '0ms';
                dot.style.transition = 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
            } else {
                dot.style.transition = 'none';
                dot.style.transitionDelay = '0ms';
            }
        });
    }

    // Use our improved updateDotState function
    dots.forEach((dot, index) => {
        updateDotState(dot, index, activeIndex);
    });

    // Save values for next update
    previousActiveIndex = activeIndex;
    previousDirection = currentDirection;
    
    // Reset transition delays after animation completes
    setTimeout(() => {
        dots.forEach(dot => {
            dot.style.transitionDelay = '0ms';
        });
    }, 500);
}

// Override CardSystem's updateUI method to include our dot updates
const originalUpdateUI = CardSystem.updateUI;
CardSystem.updateUI = function() {
    // Call original method first
    originalUpdateUI.call(this);

    // Then add our Instagram-style dot updates
    updateInstagramStyleDots(this.activeCardIndex);
};

// Initialize dots on page load
document.addEventListener('DOMContentLoaded', function() {
    updateInstagramStyleDots(CardSystem.activeCardIndex);
});

// Add this to your existing touch events in mobile.js
container.addEventListener('touchend', function() {
    // At touch end, update the dots with the current active index
    updateInstagramStyleDots(CardSystem.activeCardIndex);
});

// Make sure card click events also update the dots
flipCards.forEach((card, index) => {
    const existingClickHandler = card.onclick;
    card.addEventListener('click', function(e) {
        // Run normal click handler (if applicable)
        if (existingClickHandler) existingClickHandler.call(this, e);

        // Update dots after a slight delay to ensure CardSystem.activeCardIndex is updated
        setTimeout(() => {
            updateInstagramStyleDots(CardSystem.activeCardIndex);
        }, 50);
    });
});

// Initialize Instagram-style dots right away
updateInstagramStyleDots(CardSystem.activeCardIndex);

// Setup card indicator click handlers for mobile
const cardIndicator = document.querySelector('.card-indicator');
cardIndicator.querySelectorAll('.indicator-dot').forEach((dot) => {
    dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(dot.dataset.index);

        // Update active card
        CardSystem.activeCardIndex = index;
        CardSystem.updateUI();

        // Use smooth scrolling for the recentering
        container.style.scrollBehavior = 'smooth';

        // Center the card
        centerCardProperly(index);

        // Reset scrolling behavior after animation
        setTimeout(() => {
            container.style.scrollBehavior = 'auto';
        }, 300);
    });
});

// Card click handler for mobile
flipCards.forEach((card, index) => {
    card.addEventListener('click', function(e) {
        // Skip link clicks
        if (e.target.tagName === 'A') return;

        e.preventDefault();
        e.stopPropagation();

        // Set flags
        CardSystem.isManuallyFlipping = true;

        // 1. Center this card with boundary enforcement
        CardSystem.activeCardIndex = index;
        CardSystem.updateUI();

        // Enable smooth centering
        container.style.scrollBehavior = 'smooth';

        // Use our boundary-respecting function
        centerCardProperly(index);

        // 2. Flip the card
        const shouldFlip = !this.classList.contains('flipped');

        // Handle any previously flipped card
        if (CardSystem.currentlyFlippedCard && CardSystem.currentlyFlippedCard !== this) {
            CardSystem.resetFlippedCard();
        }

        // Get the current transform-origin before changing anything
        const computedStyle = window.getComputedStyle(this);
        const originalTransformOrigin = computedStyle.transformOrigin;

        // Apply a consistent transform origin
        this.style.transformOrigin = 'center center';

        if (shouldFlip) {
            // Force a reflow before adding the flipped class
            CardSystem.adjustCardHeight(this, true);
            void this.offsetWidth; // Force reflow
            this.classList.add('flipped');
            CardSystem.currentlyFlippedCard = this;

            // Hide indicators when card is flipped on mobile
            document.querySelector('.card-indicator').style.opacity = '0';
            document.querySelector('.card-indicator').style.pointerEvents = 'none';

            // Make card larger and hide header banner
            expandCardForMobile(this);
            toggleHeaderBanner(false);

            // Add swipe-to-close event listeners to the flipped card
            this.addEventListener('touchstart', handleFlippedCardTouchStart, { passive: true });
            this.addEventListener('touchmove', handleFlippedCardTouchMove, { passive: true });
            this.addEventListener('touchend', handleFlippedCardTouchEnd);
        } else {
            // Force a reflow before removing the flipped class
            void this.offsetWidth; // Force reflow
            this.classList.remove('flipped');
            CardSystem.adjustCardHeight(this, false);
            CardSystem.currentlyFlippedCard = null;

            // Show indicators when card is unflipped on mobile
            document.querySelector('.card-indicator').style.opacity = '1';
            document.querySelector('.card-indicator').style.pointerEvents = 'auto';

            // Restore card size and show header banner
            restoreCardForMobile(this);
            toggleHeaderBanner(true);

            // Center the card after restoring it to make sure it's visible
            centerCardProperly(index);

            // Remove event listeners for swiping
            this.removeEventListener('touchstart', handleFlippedCardTouchStart);
            this.removeEventListener('touchmove', handleFlippedCardTouchMove);
            this.removeEventListener('touchend', handleFlippedCardTouchEnd);
        }

        // Reset manual flipping flag after a delay
        setTimeout(() => {
            CardSystem.isManuallyFlipping = false;
            container.style.scrollBehavior = 'auto';
        }, 300);
    });
});

// Variables for swipe detection on flipped cards
let flippedCardTouchStartX = 0;
let flippedCardTouchStartY = 0;
let flippedCardTouchEndX = 0;
let flippedCardTouchEndY = 0;
let isSwipingHorizontally = false;

// Touch start handler for flipped cards
function handleFlippedCardTouchStart(e) {
    flippedCardTouchStartX = e.touches[0].clientX;
    flippedCardTouchStartY = e.touches[0].clientY;
    flippedCardTouchStartTime = Date.now();
    isSwipingHorizontally = false;

    // We'll let the container handle scrolling normally
    // DO NOT prevent default or set any styles that would interfere
}

// Touch move handler for flipped cards
function handleFlippedCardTouchMove(e) {
    if (!e.touches.length) return;

    // Simply detect horizontal movement - don't try to control the card directly
    // Let the container's natural scroll behavior handle movement
    const touchMoveX = e.touches[0].clientX;
    const touchMoveY = e.touches[0].clientY;

    // Calculate distances
    const xDiff = Math.abs(touchMoveX - flippedCardTouchStartX);
    const yDiff = Math.abs(touchMoveY - flippedCardTouchStartY);

    // If horizontal movement is greater, mark as horizontal swipe
    if (xDiff > yDiff && xDiff > 10) {
        isSwipingHorizontally = true;
    }

    // NO preventDefault - let the container scroll naturally
}

// Touch end handler for flipped cards
function handleFlippedCardTouchEnd(e) {
    flippedCardTouchEndX = e.changedTouches[0].clientX;
    flippedCardTouchEndY = e.changedTouches[0].clientY;

    // Calculate the swipe distance
    const xDiff = flippedCardTouchEndX - flippedCardTouchStartX;

    // If it was a significant horizontal swipe, assist with navigation
    if (isSwipingHorizontally && Math.abs(xDiff) > 50) {
        const direction = xDiff > 0 ? -1 : 1; // -1 for right swipe, 1 for left swipe
        const currentIndex = CardSystem.activeCardIndex;
        const targetIndex = Math.max(0, Math.min(flipCards.length - 1, currentIndex + direction));

        // Only do something if we're changing cards
        if (targetIndex !== currentIndex) {
            CardSystem.activeCardIndex = targetIndex;
            CardSystem.updateUI();

            // Use smooth scrolling for the new card
            container.style.scrollBehavior = 'smooth';
            centerCardProperly(targetIndex);

            setTimeout(() => {
                container.style.scrollBehavior = 'auto';
            }, 300);
        }
    }
}

// Touch handling for mobile
container.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    lastTouchX = touchStartX;
    touchStartTime = Date.now();
    touchScrollStartTime = touchStartTime;

    // Immediately stop any ongoing animations
    container.style.scrollBehavior = 'auto';
    isScrolling = false;
    clearTimeout(scrollEndTimeout);

    // Record starting position
    container.dataset.touchStartActiveCard = CardSystem.activeCardIndex;
}, { passive: true });

container.addEventListener('touchmove', (e) => {
    // Calculate scroll velocity to determine if it's a slow scroll
    const now = Date.now();
    const currentX = e.changedTouches[0].screenX;
    const timeDelta = now - touchScrollStartTime;

    if (timeDelta > 0) {
        // Calculate velocity in pixels per millisecond
        touchVelocity = Math.abs(currentX - lastTouchX) / timeDelta;
        isSlowTouchScroll = touchVelocity < slowScrollThreshold;
    }

    lastTouchX = currentX;
    touchScrollStartTime = now;
}, { passive: true });

container.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchDiff = touchEndX - touchStartX;
    touchEndTime = Date.now();

    // For very small movements (likely a tap), don't interfere
    if (Math.abs(touchDiff) < 10) {
        return;
    }

    // Calculate swipe velocity
    const swipeDuration = touchEndTime - touchStartTime;
    swipeVelocity = touchDiff / swipeDuration;

    requestAnimationFrame(() => {
        // First, find the current active card (closest to center)
        const containerRect = container.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;

        // Determine which cards are visible and their positions relative to center
        const visibleCards = [];

        flipCards.forEach((card, index) => {
            const cardRect = card.getBoundingClientRect();
            const cardCenter = cardRect.left + cardRect.width / 2;
            const distance = cardCenter - containerCenter;
            const isVisible = cardRect.right > containerRect.left && cardRect.left < containerRect.right;

            if (isVisible) {
                visibleCards.push({
                    card,
                    index,
                    distance,
                    distanceAbs: Math.abs(distance)
                });
            }
        });

        // Sort by absolute distance to find closest
        visibleCards.sort((a, b) => a.distanceAbs - b.distanceAbs);
        const closestCardIndex = visibleCards.length > 0 ? visibleCards[0].index : CardSystem.activeCardIndex;
        const swipeDirection = Math.sign(touchDiff); // 1 for right, -1 for left

        let targetIndex;

        // SIMPLIFIED SWIPE LOGIC: Always move just one card if swipe is significant
        if (Math.abs(touchDiff) > minSwipeDistance) {
            if (swipeDirection > 0) {
                // Rightward swipe - go to previous card (if possible)
                targetIndex = Math.max(0, closestCardIndex - 1);
            } else {
                // Leftward swipe - go to next card (if possible)
                targetIndex = Math.min(flipCards.length - 1, closestCardIndex + 1);
            }
        } else {
            // For very small swipes, just center the closest card
            targetIndex = closestCardIndex;
        }

        if (targetIndex !== undefined) {
            // Update active card
            CardSystem.activeCardIndex = targetIndex;
            CardSystem.updateUI();

            // Use smooth scrolling for the recentering
            container.style.scrollBehavior = 'smooth';

            // Use our boundary-respecting function to center the card
            centerCardProperly(targetIndex);

            // Reset scrolling behavior after animation
            setTimeout(() => {
                container.style.scrollBehavior = 'auto';
            }, 300);
        }
    });
}, { passive: true });

// Scroll handling
container.addEventListener('scroll', () => {
    // Don't interfere with manual flipping
    if (CardSystem.isManuallyFlipping) return;

    // Clear any previous timeout
    clearTimeout(scrollEndTimeout);

    // Update active card during scroll, but throttle dot updates during fast scrolling
    const now = Date.now();
    if (!isScrolling) {
        requestAnimationFrame(() => {
            updateActiveCardDuringScroll();

            // Only update dots if we're not scrolling too fast or enough time has passed
            const timeSinceLastUpdate = now - lastDotUpdateTime;
            if (timeSinceLastUpdate > dotUpdateThrottleTime || touchVelocity < slowScrollThreshold) {
                lastDotUpdateTime = now;
                // Adjust transition speed based on scroll velocity
                adjustDotsForScrollSpeed();
            }
        });
    }

    // CRITICAL FIX: Properly handle flipped cards during scrolling
    if (CardSystem.currentlyFlippedCard) {
        const containerRect = container.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;
        const cardRect = CardSystem.currentlyFlippedCard.getBoundingClientRect();
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distanceFromCenter = Math.abs(cardCenter - containerCenter);

        // Show/hide indicators based on whether the flipped card is centered
        const cardIndicator = document.querySelector('.card-indicator');
        const isCentered = distanceFromCenter < 50; // Increased threshold for better detection

        cardIndicator.style.opacity = isCentered ? '0' : '1';
        cardIndicator.style.pointerEvents = isCentered ? 'none' : 'auto';

        // Also show/hide header banner based on whether the flipped card is centered
        toggleHeaderBanner(!isCentered);

        // CRITICAL FIX: Unflip card when it's scrolled significantly away from center
        // Use a smaller threshold to trigger unflipping sooner
        if (!isCentered && distanceFromCenter > cardRect.width / 3) {
            console.log("Unflipping card due to scroll distance:", distanceFromCenter);
            // Unflip the card if it's off-center
            CardSystem.currentlyFlippedCard.classList.remove('flipped');
            restoreCardForMobile(CardSystem.currentlyFlippedCard);
            CardSystem.currentlyFlippedCard = null;
        }
    }

    // Detect when scrolling stops
    scrollEndTimeout = setTimeout(() => {
        isScrolling = false;

        // One final update when scrolling ends, with normal transitions
        updateActiveCardDuringScroll();
        resetDotTransitions();
    }, 150);
}, { passive: true });

// Update active card during scroll
function updateActiveCardDuringScroll() {
    // Don't update if manually flipping or if we're in the middle of a dot navigation
    if (CardSystem.isManuallyFlipping || container.style.scrollBehavior === 'smooth') return;

    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;

    // Track the most visible card
    let mostVisibleCard = null;
    let highestVisibility = 0;

    // For each card, calculate visibility percentage
    flipCards.forEach((card, index) => {
        const cardRect = card.getBoundingClientRect();

        // Calculate intersection/overlap with container
        const overlapLeft = Math.max(containerRect.left, cardRect.left);
        const overlapRight = Math.min(containerRect.right, cardRect.right);
        const visibleWidth = Math.max(0, overlapRight - overlapLeft);
        const visibilityPercentage = visibleWidth / cardRect.width;

        // If this card is more visible than our current most visible
        if (visibilityPercentage > highestVisibility) {
            highestVisibility = visibilityPercentage;
            mostVisibleCard = { card, index };
        }
    });

    // Update active card if we found one that's at least 40% visible
    if (mostVisibleCard && highestVisibility >= 0.4) {
        const newActiveIndex = mostVisibleCard.index;
        if (newActiveIndex !== CardSystem.activeCardIndex) {
            CardSystem.activeCardIndex = newActiveIndex;
            CardSystem.updateUI();
        }
    }
}

// Center card properly for mobile
function centerCardProperly(index) {
    // Don't apply constraints - let the browser handle the bounce naturally
    const card = flipCards[index];
    const containerWidth = container.offsetWidth;
    const containerCenter = containerWidth / 2;
    const cardCenter = card.offsetWidth / 2;

    // Simple position calculation without constraints
    container.scrollLeft = card.offsetLeft - containerCenter + cardCenter;
}

// Add edge card padding for mobile
function addEdgeCardPadding() {
    const firstCard = flipCards[0];
    const lastCard = flipCards[flipCards.length - 1];

    // Set explicit left margin for first card to ensure it stays in the center
    firstCard.style.marginLeft = 'calc(50vw - 150px)';

    // Set explicit right margin for last card to ensure it stays in the center
    lastCard.style.marginRight = 'calc(50vw - 150px)';
}

// Fix edge scrolling for mobile
function fixEdgeScrolling() {
    // We need to modify how the container's scrollable area is defined
    const firstCard = document.querySelector('.flip-card:first-child');
    const lastCard = document.querySelector('.flip-card:last-child');

    if (!container || !firstCard || !lastCard) return;

    // Create padding elements to prevent scrolling past the first and last cards
    let leftPadding = document.querySelector('#left-scroll-padding');
    let rightPadding = document.querySelector('#right-scroll-padding');

    if (!leftPadding) {
        leftPadding = document.createElement('div');
        leftPadding.id = 'left-scroll-padding';
        leftPadding.style.flex = '0 0 calc(50vw - 150px)';
        leftPadding.style.minWidth = 'calc(50vw - 150px)';
        leftPadding.style.height = '1px';
        container.insertBefore(leftPadding, firstCard);
    } else {
        // Ensure styles are applied even if element exists
        leftPadding.style.flex = '0 0 calc(50vw - 150px)';
        leftPadding.style.minWidth = 'calc(50vw - 150px)';
    }

    if (!rightPadding) {
        rightPadding = document.createElement('div');
        rightPadding.id = 'right-scroll-padding';
        rightPadding.style.flex = '0 0 calc(50vw - 150px)';
        rightPadding.style.minWidth = 'calc(50vw - 150px)';
        rightPadding.style.height = '1px';
        container.appendChild(rightPadding);
    }

    // Remove any direct margins on cards that might interfere
    document.querySelectorAll('.flip-card').forEach(card => {
        card.style.marginLeft = '15px';
        card.style.marginRight = '15px';
    });
}

// Function to expand card for mobile view
function expandCardForMobile(card) {
    // Save original styles to restore later
    card.dataset.originalWidth = card.style.width || '';
    card.dataset.originalMaxWidth = card.style.maxWidth || '';
    card.dataset.originalMargin = card.style.margin || '';
    card.dataset.originalZIndex = card.style.zIndex || '';

    // CRITICAL CHANGE: Do NOT set overflow: hidden on body
    // document.body.style.overflow = 'hidden'; <- REMOVE THIS LINE

    // CRITICAL CHANGE: Use enhanced class without fixed positioning
    card.classList.add('enhanced-card');

    // Style improvements without breaking scrolling
    const enhancedCardStyle = document.getElementById('enhanced-card-style') || document.createElement('style');
    enhancedCardStyle.id = 'enhanced-card-style';
    enhancedCardStyle.textContent = `
        .enhanced-card {
            width: calc(100vw - 30px) !important;
            max-width: calc(100vw - 30px) !important;
            margin: 15px auto !important;
            z-index: 100 !important;
            height: auto !important;
            /* CRITICAL: NO position:fixed, NO transform that takes out of flow */
        }

        .enhanced-card .flip-card-back {
            max-height: none !important;
            height: auto !important;
            min-height: 400px !important;
            overflow-y: auto !important;
        }

        .enhanced-card .section-title {
            font-size: 1.5rem !important;
        }

        .enhanced-card .flip-card-back p {
            font-size: 1.2rem !important;
            line-height: 1.4 !important;
        }
    `;
    document.head.appendChild(enhancedCardStyle);

    // CRITICAL: DON'T add the absolute-center class that uses fixed positioning
    // card.classList.add('absolute-center'); <- REMOVE THIS LINE

    // CRITICAL: DON'T add the style with position:fixed
    // absoluteCenterStyle... <- REMOVE THIS ENTIRE SECTION

    // Let the card remain in normal document flow
    const cardBack = card.querySelector('.flip-card-back');
    if (cardBack) {
        cardBack.style.overflowY = 'auto';
        cardBack.style.maxHeight = 'none';
    }
}

// Function to restore card to original size
function restoreCardForMobile(card) {
    // Remove enhanced class
    card.classList.remove('enhanced-card');

    // Remove the style element
    const styleElement = document.getElementById('enhanced-card-style');
    if (styleElement) {
        styleElement.remove();
    }

    // Restore original styles
    card.style.width = card.dataset.originalWidth || '';
    card.style.maxWidth = card.dataset.originalMaxWidth || '';
    card.style.margin = card.dataset.originalMargin || '';
    card.style.zIndex = card.dataset.originalZIndex || '';
    card.style.height = ''; // Reset height to default
    card.style.minHeight = ''; // Reset minHeight to default

    // Restore card back
    const cardBack = card.querySelector('.flip-card-back');
    if (cardBack) {
        cardBack.style.overflowY = '';
        cardBack.style.maxHeight = '';
        cardBack.style.height = ''; // Reset height to default
        cardBack.style.minHeight = ''; // Reset minHeight to default
    }

    // Force a reflow to ensure dimensions are properly reset
    void card.offsetHeight;
}

// Function to toggle header banner visibility
function toggleHeaderBanner(show) {
    const header = document.querySelector('header');
    if (header) {
        if (show) {
            header.style.display = '';
            header.style.position = '';
            header.style.zIndex = '';
            header.style.visibility = '';
            header.style.pointerEvents = '';
            document.body.style.paddingTop = '';
        } else {
            header.style.display = 'none';
            header.style.position = 'absolute';
            header.style.zIndex = '-100';
            header.style.visibility = 'hidden';
            header.style.pointerEvents = 'none';
            document.body.style.paddingTop = '0';
        }
    }
}

// Add this function at the end of your file (before the console.log statement)
function fixVerticalPositioning() {
    // Adjust container's vertical padding
    container.style.paddingTop = '0';
    container.style.paddingBottom = '40px';

    // Ensure body is properly set up for vertical centering
    document.body.style.display = 'flex';
    document.body.style.flexDirection = 'column';
    document.body.style.justifyContent = 'center';
    document.body.style.height = '100vh';
    document.body.style.paddingTop = '0';

    // Compensate for the header height
    const header = document.querySelector('header');
    if (header) {
        const headerHeight = header.offsetHeight;
        // Adjust container position to account for header
        container.style.marginTop = `-${headerHeight/2}px`;
    }

    // Ensure flip cards are vertically centered
    document.querySelectorAll('.flip-card').forEach(card => {
        card.style.alignSelf = 'center';
    });
}

// Add this function to adjust dot transitions based on scroll speed
function adjustDotsForScrollSpeed() {
    const dots = document.querySelectorAll('.indicator-dot');

    // Fast scrolling needs quicker transitions
    if (touchVelocity > velocityThreshold) {
        dots.forEach(dot => {
            // Use faster transitions during rapid scrolling
            dot.style.transition = 'all 0.08s linear';
        });
    } else if (touchVelocity > slowScrollThreshold) {
        dots.forEach(dot => {
            // Medium speed scrolling
            dot.style.transition = 'all 0.15s ease';
        });
    } else {
        // Slow scrolling can use normal transition
        dots.forEach(dot => {
            dot.style.transition = 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
        });
    }
}

// Add this function to reset dot transitions when scrolling stops
function resetDotTransitions() {
    const dots = document.querySelectorAll('.indicator-dot');
    dots.forEach(dot => {
        // Reset to default smooth transition when scrolling stops
        dot.style.transition = 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)';
        dot.style.transitionDelay = '0ms'; // Reset any transition delays
    });
}

// Initialize mobile-specific features
addEdgeCardPadding();
fixEdgeScrolling();
fixVerticalPositioning();
centerCardProperly(0);
CardSystem.updateUI();

console.log("Mobile implementation initialized");
})();