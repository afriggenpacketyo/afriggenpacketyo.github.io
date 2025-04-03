// Mobile-specific implementation
(function() {
    // Get the CardSystem from common.js
    const CardSystem = window.CardSystem;
    const container = CardSystem.container;
    const flipCards = CardSystem.flipCards;

    // Touch tracking variables
    let touchStartX = 0;
    let touchCurrentX = 0;
    let touchEndX = 0;
    let touchStartTime = 0;
    let isTouchActive = false;
    let isAnimating = false;
    let initialScrollLeft = 0;
    let currentDragOffset = 0;
    let lastDragTimestamp = 0;
    let lastDragX = 0;
    let dragVelocity = 0;
    let swipeInProgress = false; // Track if a swipe has triggered card movement
    let lastSwipeDirection = 0; // -1 for left, 1 for right, 0 for none
    let pendingCardIndex = -1; // Track which card we're transitioning to

    // Constants - UPDATED FOR BETTER TOUCH RESPONSE
    const SWIPE_THRESHOLD = 30; // Minimum distance for a swipe
    const SWIPE_TIMEOUT = 300;  // Maximum time in ms for a swipe
    const DRAG_RESISTANCE = 1.0; // No resistance for more direct control
    const POSITION_THRESHOLD = 0.4; // When to snap to next/previous card
    const TRANSITION_DURATION = 178; // Faster transition for better responsiveness

    // Variables for flipped card handling
    let flippedCardTouchStartX = 0;
    let flippedCardTouchStartY = 0;

    // Instagram style dot indicator
    let previousActiveIndex = CardSystem.activeCardIndex || 0;
    let visibleStartIndex = 0;
    let visibleRange = 9; // Show 9 dots at a time

    // Add this near the top where other variables are defined
    let isAnyCardFlipped = false;

    // Function to update dot sizes based on active index
    function updateInstagramStyleDots(activeIndex) {
        const dots = document.querySelectorAll('.indicator-dot');
        const totalDots = dots.length;

        // Determine swipe direction
        const currentDirection = (activeIndex > previousActiveIndex) ? 1 : -1;

        // Skip animation if we're clicking the same dot we're already on
        const isSameDot = activeIndex === previousActiveIndex;

        // Check if we need to shift the window (approaching edge)
        let needsWindowShift = false;
        let newVisibleStartIndex = visibleStartIndex;

        if (activeIndex < visibleStartIndex + 2) {
            // Near left edge - will shift window left
            newVisibleStartIndex = Math.max(0, activeIndex - 2);
            needsWindowShift = (newVisibleStartIndex !== visibleStartIndex);
        } else if (activeIndex > visibleStartIndex + visibleRange - 3) {
            // Near right edge - will shift window right
            newVisibleStartIndex = Math.min(totalDots - visibleRange, activeIndex - (visibleRange - 3));
            needsWindowShift = (newVisibleStartIndex !== visibleStartIndex);
        }

        // First update with existing window position to show transition
        if (needsWindowShift) {
            // Apply transition to all dots
            dots.forEach((dot, index) => {
                // Use a gentler transition with linear timing for smoother effect
                dot.style.transition = 'all 0.22s linear';
                updateDotState(dot, index, activeIndex);
            });

            // Delay the window shift to allow the first transition to be visible
            setTimeout(() => {
                // Now update the window position
                visibleStartIndex = newVisibleStartIndex;

                // Apply another transition for the shift
                dots.forEach((dot, index) => {
                    // Use a slightly longer, eased transition for the shift
                    dot.style.transition = 'all 0.25s ease-out';
                    updateDotState(dot, index, activeIndex);
                });
            }, 42); // Adjust delay to match the first transition
        } else {
            // No window shift needed, just update normally
            dots.forEach((dot, index) => {
                // Only apply transition if we're not clicking the same dot
                if (!isSameDot) {
                    dot.style.transition = 'all 0.25s ease';
                } else {
                    dot.style.transition = 'none';
                }
                updateDotState(dot, index, activeIndex);
            });
        }

        // Save values for next update
        previousActiveIndex = activeIndex;
    }

    // Helper function to update individual dot state
    function updateDotState(dot, index, activeIndex) {
        // Remove existing classes
        dot.classList.remove('size-small', 'size-mid', 'size-large', 'size-active', 'visible');

        // Check if dot should be visible
        const isVisible = (index >= visibleStartIndex &&
                          index < visibleStartIndex + visibleRange);

        if (isVisible) {
            dot.classList.add('visible');

            if (index === activeIndex) {
                // Active dot gets active size
                dot.classList.add('size-active');
            } else if (index === visibleStartIndex || index === (visibleStartIndex + visibleRange - 1)) {
                // Edge dots (first and last)
                dot.classList.add('size-small');

                // Only upgrade to mid size if directly adjacent to active index
                if ((index === visibleStartIndex && (activeIndex === visibleStartIndex || activeIndex === visibleStartIndex + 1)) ||
                    (index === visibleStartIndex + visibleRange - 1 && (activeIndex === visibleStartIndex + visibleRange - 1 || activeIndex === visibleStartIndex + visibleRange - 2))) {
                    dot.classList.remove('size-small');
                    dot.classList.add('size-mid');
                }
            } else if (index === visibleStartIndex + 1 || index === visibleStartIndex + visibleRange - 2) {
                // Second and second-to-last dots
                dot.classList.add('size-mid');

                // Only upgrade to large if they are active or adjacent to active
                if ((index === visibleStartIndex + 1 &&
                     (activeIndex === visibleStartIndex || activeIndex === visibleStartIndex + 1)) ||
                    (index === visibleStartIndex + visibleRange - 2 &&
                     (activeIndex === visibleStartIndex + visibleRange - 1 ||
                      activeIndex === visibleStartIndex + visibleRange - 2))) {
                    dot.classList.remove('size-mid');
                    dot.classList.add('size-large');
                }
            } else {
                // All other inactive dots get the large size
                dot.classList.add('size-large');
            }
        }
    }

    // Override CardSystem's updateUI method to include our dot updates
    const originalUpdateUI = CardSystem.updateUI;
    CardSystem.updateUI = function() {
        // Call original method first
        originalUpdateUI.call(this);

        // Then add our Instagram-style dot updates
        updateInstagramStyleDots(this.activeCardIndex);
    };

    // CORE FUNCTION: Move to a specific card with animation
    function moveToCard(index, shouldAnimate = true) {
        // Always cancel any ongoing animations
        if (isAnimating) {
            clearTimeout(container._animationResetTimer);
            container.style.transition = 'none';
            container.scrollLeft = getCurrentCardScrollPosition();
            void container.offsetWidth;
        }

        // Enforce boundaries
        index = Math.max(0, Math.min(flipCards.length - 1, index));

        // Store the pending target card index
        pendingCardIndex = index;

        // Update CardSystem state
        CardSystem.activeCardIndex = index;
        CardSystem.updateUI();

        // Update active/inactive card styles after changing index
        resetCardHighlights();

        // Get target card
        const targetCard = flipCards[index];

        // SIMPLIFIED: Direct calculation without complex positioning logic
        const containerWidth = container.offsetWidth;
        const cardWidth = targetCard.offsetWidth;
        const targetScrollLeft = targetCard.offsetLeft - (containerWidth - cardWidth) / 2;

        // Apply smooth scroll animation if requested
        if (shouldAnimate) {
            container.style.scrollBehavior = 'smooth';
            container.style.transition = `all ${TRANSITION_DURATION}ms cubic-bezier(0.1, 0.7, 0.1, 1)`;
            isAnimating = true;
            swipeInProgress = true; // Prevent new swipes until animation completes
        } else {
            container.style.scrollBehavior = 'auto';
            container.style.transition = 'none';
        }

        // Scroll to target position
        container.scrollLeft = targetScrollLeft;

        // Reset animation state after a delay
        if (shouldAnimate) {
            container._animationResetTimer = setTimeout(() => {
                isAnimating = false;
                swipeInProgress = false; // Allow new swipes after animation completes
                pendingCardIndex = -1; // Reset pending card index
                container.style.scrollBehavior = 'auto';
                container.style.transition = '';
            }, TRANSITION_DURATION + 50);
        }
    }

    // Move to next card (Instagram-style)
    function moveToNextCard() {
        const nextIndex = Math.min(flipCards.length - 1, CardSystem.activeCardIndex + 1);
        moveToCard(nextIndex);
    }

    // Move to previous card (Instagram-style)
    function moveToPrevCard() {
        const prevIndex = Math.max(0, CardSystem.activeCardIndex - 1);
        moveToCard(prevIndex);
    }

    // Calculate the position of a specific card
    function getCardScrollPosition(index) {
        const card = flipCards[index];
        const containerWidth = container.offsetWidth;
        const cardWidth = card.offsetWidth;
        return card.offsetLeft - (containerWidth - cardWidth) / 2;
    }

    // Get current active card scroll position
    function getCurrentCardScrollPosition() {
        return getCardScrollPosition(CardSystem.activeCardIndex);
    }

    // CRITICAL: Replace the scroll-based navigation with hybrid touch-based navigation
    // Allow real-time dragging but enforce one-card-at-a-time on release
    container.style.overflow = 'hidden'; // Disable native scrolling

    // Clean up existing touch event listeners if any
    container.removeEventListener('touchstart', container._touchstartHandler);
    container.removeEventListener('touchmove', container._touchmoveHandler);
    container.removeEventListener('touchend', container._touchendHandler);

    // Add SIMPLIFIED touch event handlers
    container._touchstartHandler = function(e) {
        // If a card is flipped, ignore new touches
        if (CardSystem.currentlyFlippedCard) return;

        // Allow touch input even during swipe animation - makes it interruptible
        // Only check for flipped card, not swipeInProgress

        // Store initial touch and scroll position
        touchStartX = e.touches[0].clientX;
        touchCurrentX = touchStartX;
        touchStartTime = Date.now();
        initialScrollLeft = container.scrollLeft;
        currentDragOffset = 0;
        isTouchActive = true;
        lastSwipeDirection = 0; // Reset swipe direction

        // IMPORTANT: Always cancel any ongoing animations to allow immediate interaction
        if (isAnimating) {
            clearTimeout(container._animationResetTimer);
            container.style.transition = 'none';
            container.scrollLeft = getCurrentCardScrollPosition();
            void container.offsetWidth;
            isAnimating = false;
            swipeInProgress = false;

            // If there was a pending target, make that the new active index
            // This ensures we don't skip cards while making transitions interruptible
            if (pendingCardIndex >= 0) {
                CardSystem.activeCardIndex = pendingCardIndex;
                pendingCardIndex = -1;
                // Update UI to reflect the new active card
                CardSystem.updateUI();
                resetCardHighlights();
            }
        }
    };

    container._touchmoveHandler = function(e) {
        // Only proceed if touch is active and not on a flipped card
        if (!isTouchActive || CardSystem.currentlyFlippedCard) return;

        // Allow movement even during animation - makes it interruptible
        // Remove the swipeInProgress check here

        // Update current touch position
        touchCurrentX = e.touches[0].clientX;

        // Calculate velocity for momentum scrolling
        const now = Date.now();
        const timeDelta = now - lastDragTimestamp;
        if (timeDelta > 0) {
            dragVelocity = (touchCurrentX - lastDragX) / timeDelta;
        }
        lastDragX = touchCurrentX;
        lastDragTimestamp = now;

        // Calculate drag distance with 1:1 mapping (MUCH more responsive)
        const touchDistance = touchCurrentX - touchStartX;

        // Determine current swipe direction
        const currentDirection = touchDistance > 0 ? 1 : touchDistance < 0 ? -1 : 0;

        // Only apply edge resistance (not general resistance)
        let effectiveDistance = touchDistance;
        if ((CardSystem.activeCardIndex === 0 && touchDistance > 0) ||
            (CardSystem.activeCardIndex === flipCards.length - 1 && touchDistance < 0)) {
            // Apply resistance only at the edges (first and last card)
            effectiveDistance = touchDistance * 0.3;
        }

        // Apply the drag immediately with no artificial resistance
        currentDragOffset = effectiveDistance;
        container.scrollLeft = initialScrollLeft - currentDragOffset;

        // Highlight cards during swipe
        const cardWidth = flipCards[CardSystem.activeCardIndex].offsetWidth;
        const progress = Math.abs(effectiveDistance) / (cardWidth * POSITION_THRESHOLD);

        // If we're swiping past the threshold and the direction is valid
        if (progress > 0.5) {
            // Give visual feedback about which card will be activated
            if (currentDirection < 0 && CardSystem.activeCardIndex < flipCards.length - 1) {
                // Highlight next card
                const nextCard = flipCards[CardSystem.activeCardIndex + 1];
                highlightTargetCard(nextCard);
            } else if (currentDirection > 0 && CardSystem.activeCardIndex > 0) {
                // Highlight previous card
                const prevCard = flipCards[CardSystem.activeCardIndex - 1];
                highlightTargetCard(prevCard);
            }
        }

        // Prevent default to disable native scrolling
        e.preventDefault();
    };

    container._touchendHandler = function(e) {
        // Only proceed if touch is active and not on a flipped card
        if (!isTouchActive || CardSystem.currentlyFlippedCard) return;

        // Get final touch position
        touchEndX = e.changedTouches[0].clientX;
        const touchDuration = Date.now() - touchStartTime;
        const touchDistance = touchEndX - touchStartX;
        const absTouchDistance = Math.abs(touchDistance);

        // Get card width to calculate threshold
        const cardWidth = flipCards[CardSystem.activeCardIndex].offsetWidth;
        const thresholdDistance = cardWidth * POSITION_THRESHOLD;

        // Determine whether to move to next/prev card or snap back
        let targetIndex = CardSystem.activeCardIndex;

        // If we've moved far enough OR swipe was fast enough
        // Remove the swipeInProgress check to make transitions interruptible
        if (absTouchDistance > thresholdDistance ||
            (touchDuration < SWIPE_TIMEOUT && absTouchDistance > SWIPE_THRESHOLD)) {

            // Direction based on touch distance
            if (touchDistance > 0 && CardSystem.activeCardIndex > 0) {
                // Right swipe - previous card
                targetIndex = CardSystem.activeCardIndex - 1;
            } else if (touchDistance < 0 && CardSystem.activeCardIndex < flipCards.length - 1) {
                // Left swipe - next card
                targetIndex = CardSystem.activeCardIndex + 1;
            }
        }

        // Reset all card highlights
        resetCardHighlights();

        // IMMEDIATE feedback - start animation right away
        container.style.scrollBehavior = 'smooth';
        container.style.transition = `all ${TRANSITION_DURATION}ms cubic-bezier(0.1, 0.7, 0.1, 1)`;

        // Move to target card (will snap back if same as current)
        moveToCard(targetIndex);

        isTouchActive = false;
    };

    // Function to highlight the target card
    function highlightTargetCard(card) {
        // Reset all cards first (but preserve proper active index from CardSystem)
        resetCardHighlights();

        // Add highlight effect to target card
        card.classList.add('card-targeted');

        // Get current active card and card we're moving to
        const currentCard = flipCards[CardSystem.activeCardIndex];

        // CRITICAL: Make the target card FULLY VISIBLE like an active card
        // Set explicit styles with !important to override any potential conflicts
        if (card.querySelector('.flip-card-front')) {
            // Force full opacity with !important
            card.querySelector('.flip-card-front').style.cssText = `
                opacity: 1 !important;
                background-color: var(--primary-color, #0078e7) !important;
                border-color: var(--primary-color-dark, #005bb1) !important;
                padding-bottom: 0px !important;
                transition: opacity 0.2s ease, background-color 0.2s ease, transform 0.2s ease !important;
            `;
        }

        // Make the current card visually inactive (reduced opacity, lighter blue)
        if (currentCard !== card && currentCard.querySelector('.flip-card-front')) {
            currentCard.querySelector('.flip-card-front').style.cssText = `
                opacity: 0.7 !important;
                background-color: var(--secondary-color, #76b5e7) !important;
                border-color: var(--secondary-color-dark, #5090c9) !important;
                transition: opacity 0.2s ease, background-color 0.2s ease, transform 0.2s ease !important;
            `;
        }
    }

    // Function to reset all card highlights
    function resetCardHighlights() {
        // Reset temporary visual styles
        flipCards.forEach(card => {
            card.classList.remove('card-targeted');
        });

        // Ensure proper active/inactive states based on CardSystem.activeCardIndex
        flipCards.forEach((card, index) => {
            if (card.querySelector('.flip-card-front')) {
                if (index === CardSystem.activeCardIndex) {
                    // Active card - full opacity, primary color
                    card.querySelector('.flip-card-front').style.cssText = `
                        opacity: 1 !important;
                        background-color: var(--primary-color, #0078e7) !important;
                        border-color: var(--primary-color-dark, #005bb1) !important;
                        padding-bottom: 20px !important;
                        transition: opacity 0.2s ease, background-color 0.2s ease, transform 0.2s ease !important;
                    `;
                } else {
                    // Inactive card - reduced opacity, secondary color
                    card.querySelector('.flip-card-front').style.cssText = `
                        opacity: 0.7 !important;
                        background-color: var(--secondary-color, #76b5e7) !important;
                        border-color: var(--secondary-color-dark, #5090c9) !important;
                        transition: opacity 0.2s ease, background-color 0.2s ease, transform 0.2s ease !important;
                    `;
                }
            }
        });
    }

    // Add the event listeners
    container.addEventListener('touchstart', container._touchstartHandler, { passive: true });
    container.addEventListener('touchmove', container._touchmoveHandler, { passive: false });
    container.addEventListener('touchend', container._touchendHandler);

    // Setup card indicator click handlers
    const cardIndicator = document.querySelector('.card-indicator');
    cardIndicator.querySelectorAll('.indicator-dot').forEach((dot) => {
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(dot.dataset.index);

            // Get distance between current and target index to adjust animation duration
            const currentIndex = CardSystem.activeCardIndex;
            const indexDistance = Math.abs(index - currentIndex);

            // For distant jumps (more than 2 cards away), adjust animation parameters
            if (indexDistance > 2) {
                // Save original transition duration
                const originalDuration = TRANSITION_DURATION;

                // Temporarily increase transition duration based on distance
                const adjustedDuration = Math.min(TRANSITION_DURATION * (1 + indexDistance * 0.15), 350);
                container.style.transition = `all ${adjustedDuration}ms cubic-bezier(0.1, 0.7, 0.1, 1)`;

                // Move to card with animation
                moveToCard(index, true);

                // Reset to original duration after this transition
                setTimeout(() => {
                    container.style.transition = `all ${originalDuration}ms cubic-bezier(0.1, 0.7, 0.1, 1)`;
                }, adjustedDuration + 50);
            } else {
                // For adjacent cards, use normal animation
                moveToCard(index, true);
            }
        });
    });

    // Card click handler for toggling flip state
    flipCards.forEach((card, index) => {
        card.addEventListener('click', function(e) {
            // Skip link clicks
            if (e.target.tagName === 'A') return;

            e.preventDefault();
            e.stopPropagation();

            // Ensure we're on the correct card first
            if (CardSystem.activeCardIndex !== index) {
                moveToCard(index);
                setTimeout(() => toggleCardFlip(this), TRANSITION_DURATION);
            } else {
                toggleCardFlip(this);
            }
        });
    });

    // Function to toggle card flip state
    function toggleCardFlip(card) {
        // Set flags
        CardSystem.isManuallyFlipping = true;

        // Check if already flipped
        const shouldFlip = !card.classList.contains('flipped');

        // Handle any previously flipped card
        if (CardSystem.currentlyFlippedCard && CardSystem.currentlyFlippedCard !== card) {
            CardSystem.resetFlippedCard();
        }

        if (shouldFlip) {
            // Force a reflow before adding the flipped class
            CardSystem.adjustCardHeight(card, true);
            void card.offsetWidth; // Force reflow
            card.classList.add('flipped');
            CardSystem.currentlyFlippedCard = card;

            // Hide indicators when card is flipped on mobile
            document.querySelector('.card-indicator').style.opacity = '0';
            document.querySelector('.card-indicator').style.pointerEvents = 'none';

            // Make card larger and hide header banner
            expandCardForMobile(card);
            toggleHeaderBanner(false);

            // Add swipe-down-to-close event listeners
            card.addEventListener('touchstart', handleFlippedCardTouchStart, { passive: true });
            card.addEventListener('touchmove', handleFlippedCardTouchMove, { passive: true });
            card.addEventListener('touchend', handleFlippedCardTouchEnd);

            // When a card is flipped:
            isAnyCardFlipped = true;
            toggleLogoVisibility(false);
        } else {
            // Unflip the card
            card.classList.remove('flipped');
            CardSystem.adjustCardHeight(card, false);
            CardSystem.currentlyFlippedCard = null;

            // Show indicators when card is unflipped
            document.querySelector('.card-indicator').style.opacity = '1';
            document.querySelector('.card-indicator').style.pointerEvents = 'auto';

            // Restore card size and show header banner
            restoreCardForMobile(card);
            toggleHeaderBanner(true);

            // Remove swipe-to-close event listeners
            card.removeEventListener('touchstart', handleFlippedCardTouchStart);
            card.removeEventListener('touchmove', handleFlippedCardTouchMove);
            card.removeEventListener('touchend', handleFlippedCardTouchEnd);

            // When a card is unflipped:
            isAnyCardFlipped = false;

            // Wait for the header to become visible before showing the logo
            setTimeout(() => {
                toggleLogoVisibility(true);
                // Update logo position after it's visible
                setTimeout(updateLogoPosition, 100);
            }, 100);
        }

        // Reset manual flipping flag after a delay
        setTimeout(() => {
            CardSystem.isManuallyFlipping = false;
        }, TRANSITION_DURATION);
    }

    // Touch handlers for flipped cards (swipe down to close AND swipe left/right)
    function handleFlippedCardTouchStart(e) {
        flippedCardTouchStartX = e.touches[0].clientX;
        flippedCardTouchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
        isTouchActive = true;

        // Reset drag tracking
        currentDragOffset = 0;

        // If we're animating, stop any current animation
        if (isAnimating) {
            clearTimeout(container._animationResetTimer);
            container.style.transition = 'none';
            container.scrollLeft = getCurrentCardScrollPosition();
            void container.offsetWidth;
        }
    }

    function handleFlippedCardTouchMove(e) {
        if (!isTouchActive) return;

        // Get current touch position
        const touchCurrentX = e.touches[0].clientX;
        const touchCurrentY = e.touches[0].clientY;

        // Calculate vertical distance to detect if it's a down swipe
        const vertDistance = touchCurrentY - flippedCardTouchStartY;

        // Calculate horizontal distance for card sliding
        const horizDistance = touchCurrentX - flippedCardTouchStartX;
        const absHorizDistance = Math.abs(horizDistance);

        // If it's primarily a horizontal movement (wider than tall)
        if (absHorizDistance > Math.abs(vertDistance) && absHorizDistance > 20) {
            // Apply resistance to make it feel more natural
            let resistanceFactor = DRAG_RESISTANCE;

            // Add extra resistance at the edges
            if ((CardSystem.activeCardIndex === 0 && horizDistance > 0) ||
                (CardSystem.activeCardIndex === flipCards.length - 1 && horizDistance < 0)) {
                resistanceFactor *= 0.3;
            }

            // Calculate drag offset with resistance
            currentDragOffset = horizDistance * resistanceFactor;

            // Apply drag in real-time
            const basePosition = getCurrentCardScrollPosition();
            container.style.transition = 'none';
            container.scrollLeft = basePosition - currentDragOffset;

            // Prevent default to disable native scrolling
            e.preventDefault();
        }
        // For vertical movements, we don't do anything special - let native scrolling work
        // Remove the downward swipe detection that was here before
    }

    function handleFlippedCardTouchEnd(e) {
        if (!isTouchActive) return;
        isTouchActive = false;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const touchDuration = Date.now() - touchStartTime;

        // Calculate distances
        const xDistance = touchEndX - flippedCardTouchStartX;
        const absXDistance = Math.abs(xDistance);
        const yDistance = touchEndY - flippedCardTouchStartY;
        const absYDistance = Math.abs(yDistance);

        // Get thresholds for navigation
        const cardWidth = flipCards[CardSystem.activeCardIndex].offsetWidth;
        const thresholdDistance = cardWidth * POSITION_THRESHOLD;

        // ONLY handle horizontal swipes - ignore vertical swipes completely
        // Check if it's primarily a horizontal movement
        if (absXDistance > absYDistance &&
            ((touchDuration < SWIPE_TIMEOUT && absXDistance > SWIPE_THRESHOLD) ||
             absXDistance > thresholdDistance)) {

            // Store the currently flipped card and target index
            const flippedCard = CardSystem.currentlyFlippedCard;
            const currentIndex = CardSystem.activeCardIndex;
            const targetIndex = xDistance < 0 ?
                Math.min(flipCards.length - 1, currentIndex + 1) :
                Math.max(0, currentIndex - 1);

            // Start navigation immediately
            if (targetIndex !== currentIndex) {
                // Begin navigation immediately
                moveToCard(targetIndex);

                // Simultaneously close the card
                toggleCardFlip(flippedCard);
            } else {
                // At the edge - snap back with animation
                moveToCard(currentIndex);
            }
        } else if (absXDistance > 20) {
            // Below threshold but still a horizontal movement - snap back to current card
            moveToCard(CardSystem.activeCardIndex);
        }
        // For vertical movements, we do nothing - let native scrolling handle it
    }

    // Function to expand card for mobile view
    function expandCardForMobile(card) {
        // Save original styles to restore later
        card.dataset.originalWidth = card.style.width || '';
        card.dataset.originalMaxWidth = card.style.maxWidth || '';
        card.dataset.originalMargin = card.style.margin || '';
        card.dataset.originalZIndex = card.style.zIndex || '';

        // Apply expanded styles
        card.classList.add('enhanced-card');

        // Style for flipped cards
        const cardBack = card.querySelector('.flip-card-back');
        if (cardBack) {
            // Clear any existing styles first
            cardBack.style.cssText = '';

            // Apply fixed positioning with viewport-centered approach
            cardBack.style.position = 'fixed !important';
            cardBack.style.top = '50% !important';
            cardBack.style.left = '50% !important';
            cardBack.style.transform = 'translate(-50%, -50%) rotateY(180deg) !important';

            // Set dimensions with important flags
            cardBack.style.width = '95vw !important';
            cardBack.style.height = 'auto !important';
            cardBack.style.minHeight = '70vh !important';
            cardBack.style.maxHeight = '80vh !important'; // Reduced to ensure it fits within viewport

            // Add margin to prevent touching edges
            cardBack.style.margin = '0 !important';

            // Other important styles
            cardBack.style.overflowY = 'auto !important';
            cardBack.style.padding = '25px !important';
            cardBack.style.zIndex = '1000 !important';

            // Add safe area insets for modern browsers
            cardBack.style.paddingTop = 'max(25px, env(safe-area-inset-top)) !important';
            cardBack.style.paddingBottom = 'max(25px, env(safe-area-inset-bottom)) !important';

            // Force a reflow to ensure styles are applied
            void cardBack.offsetHeight;
        }
    }

    // Function to restore card to original size
    function restoreCardForMobile(card) {
        // Remove enhanced class
        card.classList.remove('enhanced-card');

        // Restore original styles
        card.style.width = card.dataset.originalWidth || '';
        card.style.maxWidth = card.dataset.originalMaxWidth || '';
        card.style.margin = card.dataset.originalMargin || '';
        card.style.zIndex = card.dataset.originalZIndex || '';

        // Restore card back
        const cardBack = card.querySelector('.flip-card-back');
        if (cardBack) {
            cardBack.style.overflowY = '';
            cardBack.style.maxHeight = '';

            // Clear positioning styles
            cardBack.style.position = '';
            cardBack.style.top = '';
            cardBack.style.left = '';
            cardBack.style.transform = 'rotateY(180deg)'; // Keep only the rotation
            cardBack.style.width = '';
            cardBack.style.minHeight = '';
            cardBack.style.maxHeight = '';
            cardBack.style.margin = '';
            cardBack.style.zIndex = '';
        }
    }

    // Function to toggle header banner visibility
    function toggleHeaderBanner(show) {
        const header = document.querySelector('header');
        if (header) {
            if (show) {
                header.style.display = '';
                header.style.visibility = '';
            } else {
                header.style.display = 'none';
                header.style.visibility = 'hidden';
            }
        }
    }

    // Add CSS for enhanced cards
    const enhancedCardStyle = document.createElement('style');
    enhancedCardStyle.id = 'enhanced-card-style';
    enhancedCardStyle.textContent = `
        .enhanced-card {
            width: 300px !important;
            height: 400px !important;
            margin: 0 15px !important;
            z-index: 100 !important;
        }

        .enhanced-card .flip-card-back {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) rotateY(180deg) !important;
            width: 95vw !important;
            height: auto !important;
            min-height: 70vh !important;
            max-height: 80vh !important;
            overflow-y: auto !important;
            padding: 25px !important;
            z-index: 1000 !important;
            margin: 0 !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15) !important;
            border-radius: 10px !important;

            /* Add safe area insets for modern browsers */
            padding-top: max(25px, env(safe-area-inset-top)) !important;
            padding-bottom: max(25px, env(safe-area-inset-bottom)) !important;
        }

        /* Chrome-specific adjustments */
        body.chrome-browser .enhanced-card .flip-card-back {
            top: 50% !important;
            transform: translate(-50%, -50%) rotateY(180deg) !important;
            max-height: 80vh !important;
        }

        /* Safari-specific adjustments */
        body.safari-browser .enhanced-card .flip-card-back {
            top: 50% !important; /* Center vertically */
            transform: translate(-50%, -50%) rotateY(180deg) !important;
            max-height: 85vh !important; /* Consistent height constraint */
        }

        /* Safari mobile specific fix - Keep top position, extend downward */
        body.safari-mobile .enhanced-card .flip-card-back {
            /* Keep current top position exactly as is */
            top: 50% !important;
            bottom: auto !important;
            /* Keep the transform that was working */
            transform: translate(-50%, -50%) rotateY(180deg) !important;

            /* Use fixed height but increase it */
            height: 75vh !important;
            max-height: 75vh !important;
            min-height: 75vh !important;

            /* Add a small offset with padding to push content down */
            padding: 20px !important;
            padding-top: 15px !important; /* Less padding at top */
            padding-bottom: 25px !important; /* More padding at bottom */

            /* Add a small negative margin at top to pull up slightly */
            margin-top: -10px !important;
            margin-bottom: 0 !important;

            /* Ensure content is properly contained */
            overflow-y: auto !important;
            display: block !important;
        }

        /* Additional fix for iOS devices with notches */
        @supports (padding-top: env(safe-area-inset-top)) {
            body.safari-mobile .enhanced-card .flip-card-back {
                padding-top: max(15px, env(safe-area-inset-top)) !important;
                padding-bottom: max(25px, env(safe-area-inset-bottom)) !important;
            }
        }

        .enhanced-card .section-title {
            font-size: 1.5rem !important;
        }

        .enhanced-card .flip-card-back p {
            font-size: 1.2rem !important;
            line-height: 1.4 !important;
        }

        /* Card highlight effect for next/prev card being targeted */
        .card-targeted {
            box-shadow: 0 5px 20px rgba(0,0,0,0.2) !important;
            transform: scale(1.05) !important;
            transition: transform 0.2s ease, box-shadow 0.2s ease !important;
            z-index: 10 !important;
        }

        /* CRITICAL FIX: Override the :not(.active) selector with higher specificity */
        .flip-card.card-targeted:not(.active) {
            opacity: 1 !important;
        }

        /* Apply smooth transitions to card front styles */
        .flip-card-front {
            transition: opacity 0.2s ease, background-color 0.2s ease, transform 0.2s ease !important;
        }

        /* Just keep the performance hint without transition */
        .flip-cards-container {
            will-change: transform, scroll-position;
        }
    `;
    document.head.appendChild(enhancedCardStyle);

    // Add edge card padding for better visual appearance
    function addEdgeCardPadding() {
        // Add spacers at the start and end for better appearance
        const firstCard = flipCards[0];
        const lastCard = flipCards[flipCards.length - 1];

        if (firstCard && lastCard) {
            // Create padding elements if they don't exist
            let leftPadding = document.querySelector('#left-scroll-padding');
            let rightPadding = document.querySelector('#right-scroll-padding');

            if (!leftPadding) {
                leftPadding = document.createElement('div');
                leftPadding.id = 'left-scroll-padding';
                leftPadding.style.flex = '0 0 calc(50vw - 150px)';
                leftPadding.style.minWidth = 'calc(50vw - 150px)';
                leftPadding.style.height = '1px';
                container.insertBefore(leftPadding, firstCard);
            }

            if (!rightPadding) {
                rightPadding = document.createElement('div');
                rightPadding.id = 'right-scroll-padding';
                rightPadding.style.flex = '0 0 calc(50vw - 150px)';
                rightPadding.style.minWidth = 'calc(50vw - 150px)';
                rightPadding.style.height = '1px';
                container.appendChild(rightPadding);
            }
        }
    }

    // Fix vertical positioning for better appearance
    function fixVerticalPositioning() {
        // Adjust container's vertical padding
        container.style.paddingTop = '0';
        container.style.paddingBottom = '40px';

        // Adjust body layout
        document.body.style.display = 'flex';
        document.body.style.flexDirection = 'column';
        document.body.style.justifyContent = 'center';
        document.body.style.minHeight = '100vh';

        // Center flip cards vertically
        document.querySelectorAll('.flip-card').forEach(card => {
            card.style.alignSelf = 'center';
        });
    }

    // Function to ensure the first card is properly centered initially
    function centerFirstCardOnLoad() {
        // Make sure we have valid measurements before trying to center
        if (container && flipCards && flipCards.length > 0) {
            // Force proper initial state
            CardSystem.activeCardIndex = 0;

            // Calculate exact center position - don't rely on current scrollLeft
            const firstCard = flipCards[0];
            const containerWidth = container.offsetWidth;
            const cardWidth = firstCard.offsetWidth;

            // Calculate the ideal scrollLeft to center the first card
            const targetScrollLeft = firstCard.offsetLeft - (containerWidth - cardWidth) / 2;

            // Apply positioning immediately (no animation)
            container.style.scrollBehavior = 'auto';
            container.style.transition = 'none';
            container.scrollLeft = targetScrollLeft;

            // Force reflow to ensure the position applies immediately
            void container.offsetWidth;

            // Update UI to reflect initial state
            CardSystem.updateUI();

            console.log("First card centered with scrollLeft:", targetScrollLeft);
        }
    }

    // Function to toggle logo visibility with smoother transitions
    function toggleLogoVisibility(show) {
        const logoContainer = document.querySelector('.logo-container');
        if (logoContainer) {
            // Use transition for smoother appearance/disappearance
            logoContainer.style.transition = 'opacity 0.3s ease';

            if (show) {
                // Make visible first, then fade in
                logoContainer.style.visibility = 'visible';
                // Use a small delay to ensure visibility change is applied first
                setTimeout(() => {
                    logoContainer.style.opacity = '1';
                }, 10);
            } else {
                // Fade out first, then hide
                logoContainer.style.opacity = '0';
                // Wait for fade out to complete before hiding
                setTimeout(() => {
                    logoContainer.style.visibility = 'hidden';
                }, 300);
            }
        }
    }

    // Improved function to precisely position the logo between header and active card
    function updateLogoPosition() {
        const logoContainer = document.querySelector('.logo-container');
        const header = document.querySelector('header');
        const activeCard = document.querySelector('.flip-card.active');

        if (!logoContainer || !header || !activeCard) {
            console.log("Missing elements for logo positioning");
            return;
        }

        // Only update position if logo is visible
        if (logoContainer.style.visibility === 'hidden') {
            return;
        }

        // Get precise measurements
        const headerRect = header.getBoundingClientRect();
        const cardRect = activeCard.getBoundingClientRect();

        // Ensure we have valid measurements
        if (headerRect.height === 0 || cardRect.height === 0) {
            console.log("Invalid element dimensions for logo positioning");
            return;
        }

        // Calculate the exact midpoint between header bottom and card top
        const headerBottom = headerRect.bottom;
        const cardTop = cardRect.top;

        // Ensure there's actually space between header and card
        if (cardTop <= headerBottom) {
            console.log("No space between header and card for logo");
            return;
        }

        const availableSpace = cardTop - headerBottom;
        const midPoint = headerBottom + (availableSpace / 2);

        // Center the logo at this midpoint
        const logoHeight = logoContainer.offsetHeight;
        const adjustedPosition = midPoint - (logoHeight / 2);

        // Apply the positioning with fixed position
        logoContainer.style.position = 'fixed';
        logoContainer.style.top = `${Math.max(0, adjustedPosition)}px`; // Prevent negative values
        logoContainer.style.left = '50%';
        logoContainer.style.transform = 'translateX(-50%)';

        // For debugging
        console.log(`Logo positioning: Header bottom: ${headerBottom}, Card top: ${cardTop}, Midpoint: ${midPoint}, Logo position: ${adjustedPosition}`);
    }

    // Make sure we call this function at the right times
    function initLogoVisibility() {
        // Check if any card is already flipped (page refresh case)
        isAnyCardFlipped = CardSystem.currentlyFlippedCard !== null;

        // Show logo initially if no card is flipped
        toggleLogoVisibility(!isAnyCardFlipped);

        // Position the logo after a short delay to ensure all elements are properly rendered
        setTimeout(() => {
            updateLogoPosition();
        }, 200);
    }

    // Add these calls to the initialize function
    function initialize() {
        console.log("Initializing mobile card system...");

        // Add padding and fix positioning first
        addEdgeCardPadding();
        fixVerticalPositioning();

        // Initialize card states (active/inactive styles)
        resetCardHighlights();

        // First ensure proper centering
        centerFirstCardOnLoad();

        // Initialize logo visibility and position
        initLogoVisibility();

        // Center the active card with a slight delay to ensure measurements are complete
        setTimeout(() => {
            // Double-check centering after everything has fully rendered
            centerFirstCardOnLoad();

            // Ensure card states are correctly set
            resetCardHighlights();

            // Update logo position again after cards are positioned
            updateLogoPosition();
        }, 100);

        // Add event listeners for responsive positioning
        window.addEventListener('resize', updateLogoPosition);
        window.addEventListener('orientationchange', updateLogoPosition);
        window.addEventListener('scroll', updateLogoPosition);

        console.log("Mobile card initialization complete");
    }

    // Also call updateLogoPosition whenever the active card changes
    const originalMoveToCard = moveToCard;
    moveToCard = function(index, shouldAnimate = true) {
        originalMoveToCard(index, shouldAnimate);

        // Update logo position after card transition completes
        setTimeout(updateLogoPosition, TRANSITION_DURATION + 50);
    };

    // Run initialization when everything is fully loaded
    if (document.readyState === 'complete') {
        initialize();
    } else {
        // For safety, use both DOMContentLoaded and window.onload
        window.addEventListener('load', initialize);
    }

    // Also run on resize to maintain proper centering
    window.addEventListener('resize', () => {
        // Recenter current card on resize
        moveToCard(CardSystem.activeCardIndex);
    });
})();

// Browser detection for Safari vs Chrome positioning
(function() {
  // More reliable browser detection for mobile
  function detectBrowser() {
    const userAgent = navigator.userAgent.toLowerCase();

    // iOS Safari detection
    if (/iphone|ipad|ipod/.test(userAgent) && /safari/.test(userAgent) && !(/crios/.test(userAgent)) && !(/fxios/.test(userAgent))) {
      return 'safari-mobile';
    }

    // Chrome on iOS detection
    if (/crios/.test(userAgent)) {
      return 'chrome-ios';
    }

    // Android Chrome detection
    if (/android/.test(userAgent) && /chrome/.test(userAgent) && !(/firefox/.test(userAgent))) {
      return 'chrome-android';
    }

    // Desktop Safari
    if (!(/android|iphone|ipad|ipod/.test(userAgent)) && /safari/.test(userAgent) && !(/chrome/.test(userAgent))) {
      return 'safari-desktop';
    }

    // Desktop Chrome
    if (!(/android|iphone|ipad|ipod/.test(userAgent)) && /chrome/.test(userAgent) && !(/edge|edg|firefox/.test(userAgent))) {
      return 'chrome-desktop';
    }

    // Default fallback
    return 'other-browser';
  }

  // Apply the appropriate class to the body element
  function applyBrowserClass() {
    const browserType = detectBrowser();

    // Remove all browser classes first
    document.body.classList.remove(
      'safari-mobile', 'chrome-ios', 'chrome-android',
      'safari-desktop', 'chrome-desktop', 'other-browser',
      'safari-browser', 'chrome-browser'
    );

    // Add detected browser class
    document.body.classList.add(browserType);

    // Also add the general browser family class for backward compatibility
    if (browserType.includes('safari')) {
      document.body.classList.add('safari-browser');
    } else if (browserType.includes('chrome')) {
      document.body.classList.add('chrome-browser');
    }

    // Log for debugging
    console.log('Browser detected:', browserType);
  }

  // Run on page load
  if (document.readyState === 'complete') {
    applyBrowserClass();
  } else {
    window.addEventListener('load', applyBrowserClass);
  }

  // Also add a debug element to verify detection
  function addDebugInfo() {
    const debugDiv = document.createElement('div');
    debugDiv.style.position = 'fixed';
    debugDiv.style.bottom = '5px';
    debugDiv.style.right = '5px';
    debugDiv.style.background = 'rgba(0,0,0,0.7)';
    debugDiv.style.color = 'white';
    debugDiv.style.padding = '5px';
    debugDiv.style.fontSize = '10px';
    debugDiv.style.zIndex = '9999';
    debugDiv.style.borderRadius = '3px';
    debugDiv.textContent = 'Browser: ' + detectBrowser() + ' | UA: ' + navigator.userAgent.substring(0, 50) + '...';
    document.body.appendChild(debugDiv);
  }

  // Uncomment this line to add debug info
  // window.addEventListener('load', addDebugInfo);
})();