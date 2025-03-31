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
            toggleLogoVisibility(true);
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
        if (absHorizDistance > Math.abs(vertDistance)) {
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
        // If it's primarily a downward swipe
        else if (vertDistance > 30 && absHorizDistance < 30) {
            // We could add visual feedback for "pull down to close"
            e.preventDefault();
        }
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

        // Get thresholds for navigation
        const cardWidth = flipCards[CardSystem.activeCardIndex].offsetWidth;
        const thresholdDistance = cardWidth * POSITION_THRESHOLD;

        // If it's a downward swipe with minimal horizontal movement
        if (yDistance > 100 && absXDistance < 50) {
            // Close the card
            toggleCardFlip(CardSystem.currentlyFlippedCard);
        }
        // If it's a significant horizontal swipe or drag
        else if ((touchDuration < SWIPE_TIMEOUT && absXDistance > SWIPE_THRESHOLD) ||
                 absXDistance > thresholdDistance) {

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
        } else {
            // Below threshold - snap back to current card
            moveToCard(CardSystem.activeCardIndex);
        }
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
            cardBack.style.overflowY = 'auto';
            cardBack.style.maxHeight = 'none';
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
            width: calc(100vw - 30px) !important;
            max-width: calc(100vw - 30px) !important;
            margin: 15px auto !important;
            z-index: 100 !important;
            height: auto !important;
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

    // Add this function in mobile.js
    function toggleLogoVisibility(show) {
        const logoContainer = document.querySelector('.logo-container');
        if (logoContainer) {
            logoContainer.style.opacity = show ? '1' : '0';
            logoContainer.style.visibility = show ? 'visible' : 'hidden';
        }
    }

    // Add initialization to show logo when page loads
    function initLogoVisibility() {
        // Show logo initially
        toggleLogoVisibility(true);

        // Check if any card is already flipped (page refresh case)
        isAnyCardFlipped = CardSystem.currentlyFlippedCard !== null;
        if (isAnyCardFlipped) {
            toggleLogoVisibility(false);
        }
    }

    // Initialize everything properly
    function initialize() {
        console.log("Initializing mobile card system...");

        // Add padding and fix positioning first
        addEdgeCardPadding();
        fixVerticalPositioning();

        // Initialize card states (active/inactive styles)
        resetCardHighlights();

        // First ensure proper centering
        centerFirstCardOnLoad();

        // Center the active card with a slight delay to ensure measurements are complete
        setTimeout(() => {
            // Double-check centering after everything has fully rendered
            centerFirstCardOnLoad();

            // Ensure card states are correctly set
            resetCardHighlights();
        }, 100);

        initLogoVisibility();

        console.log("Mobile card initialization complete");
    }

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