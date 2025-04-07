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
    const TRANSITION_DURATION = 270; // Increased for smoother recentering
    const RECENTERING_EASING = 'cubic-bezier(0.25, 0.1, 0.25, 1)'; // More elegant easing

    // Variables for flipped card handling
    let flippedCardTouchStartX = 0;
    let flippedCardTouchStartY = 0;

    // Instagram style dot indicator
    let previousActiveIndex = CardSystem.activeCardIndex || 0;
    let visibleStartIndex = 0;
    let visibleRange = 9; // Show 9 dots at a time

    // Add this near the top where other variables are defined
    let isAnyCardFlipped = false;

    // Add these variables for overlay functionality
    let cardOverlay = null;
    let overlayContent = null;
    let currentOverlayCard = null;
    let isOverlayActive = false;

    // Add a global variable to store the final logo position
    let finalLogoPosition = null;

    // Add these variables at an appropriate scope level
    let preactivatedCard = null;
    let previouslyActiveCard = null;
    let visibilityThreshold = 0.4; // Adjust this value as needed (40% visibility)

    // Function to update dot sizes based on active index
    function updateInstagramStyleDots(activeIndex) {
        // Cache dots selector - don't query DOM every time
        if (!updateInstagramStyleDots.dots) {
            updateInstagramStyleDots.dots = document.querySelectorAll('.indicator-dot');
        }
        const dots = updateInstagramStyleDots.dots;
        const totalDots = dots.length;

        // Skip the entire function if no dots exist
        if (totalDots === 0) return;

        // Determine swipe direction
        const currentDirection = (activeIndex > previousActiveIndex) ? 1 : -1;

        // Skip animation if we're clicking the same dot we're already on
        const isSameDot = activeIndex === previousActiveIndex;
        if (isSameDot) return; // Early exit for performance

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

        // OPTIMIZATION: Only reset scroll on cards that need it
        // Don't loop through ALL cards - just the currently flipped one
        if (CardSystem.currentlyFlippedCard) {
            const cardBack = CardSystem.currentlyFlippedCard.querySelector('.flip-card-back');
            if (cardBack) {
                // Force scroll reset with !important style
                cardBack.style.cssText += '; overflow-y: hidden !important;';
                cardBack.scrollTop = 0;

                // Reset only visible content containers
                const contentContainers = cardBack.querySelectorAll('.flip-card-back-content, div, section');
                contentContainers.forEach(container => {
                    if (container.scrollTop) container.scrollTop = 0;
                });

                // Re-enable scrolling after reset
                setTimeout(() => {
                    cardBack.style.cssText = cardBack.style.cssText.replace('overflow-y: hidden !important;', 'overflow-y: auto !important;');
                }, 50);
            }
        }

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

            // Use a more refined, smoother transition for recentering
            container.style.transition = `all ${TRANSITION_DURATION}ms ${RECENTERING_EASING}`;
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

        // OPTIMIZATION: Use requestAnimationFrame for smoother dragging
        if (this._touchMoveRAF) {
            cancelAnimationFrame(this._touchMoveRAF);
        }

        this._touchMoveRAF = requestAnimationFrame(() => {
            // Update current touch position
            touchCurrentX = e.touches[0].clientX;

            // Calculate velocity less frequently - only every 60ms
            const now = Date.now();
            if (now - lastDragTimestamp > 60) {
                const timeDelta = now - lastDragTimestamp;
                if (timeDelta > 0) {
                    dragVelocity = (touchCurrentX - lastDragX) / timeDelta;
                }
                lastDragX = touchCurrentX;
                lastDragTimestamp = now;
            }

            // Calculate drag distance with 1:1 mapping
            const touchDistance = touchCurrentX - touchStartX;

            // Determine current swipe direction - use simple math operation
            const currentDirection = Math.sign(touchDistance); // -1, 0, or 1

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

            // OPTIMIZATION: Only calculate card width once per drag
            if (!this._currentCardWidth) {
                this._currentCardWidth = flipCards[CardSystem.activeCardIndex].offsetWidth;
            }
            const cardWidth = this._currentCardWidth;

            // Calculate progress towards activating next/prev card
            const progress = Math.abs(effectiveDistance) / (cardWidth * POSITION_THRESHOLD);

            // OPTIMIZATION: Cache DOM queries
            const targetedCard = document.querySelector('.card-targeted');

            // IMPORTANT: If we've moved below the threshold, reset card highlights
            if (progress < 0.5) {
                // We've moved back enough to reset to the original card
                if (targetedCard) {
                    resetCardHighlights();
                }
            } else {
                // We're above the threshold - show preview of next/prev card
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
        });

        // Prevent default to disable native scrolling
        e.preventDefault();
    };

    container._touchendHandler = function(e) {
        // BUGFIX: Clean up requestAnimationFrame to prevent memory leaks
        if (this._touchMoveRAF) {
            cancelAnimationFrame(this._touchMoveRAF);
            this._touchMoveRAF = null;
        }

        // Reset cached card width
        this._currentCardWidth = null;

        // Only proceed if touch is active and not on a flipped card
        if (!isTouchActive || CardSystem.currentlyFlippedCard) return;

        // Get final touch position
        touchEndX = e.changedTouches[0].clientX;
        const touchDuration = Date.now() - touchStartTime;
        const touchDistance = touchEndX - touchStartX;
        const absTouchDistance = Math.abs(touchDistance);

        // Get card width for threshold calculations
        const cardWidth = flipCards[CardSystem.activeCardIndex].offsetWidth;
        const thresholdDistance = cardWidth * POSITION_THRESHOLD;

        // Check if there's a preactivated/targeted card
        if (document.querySelector('.card-targeted')) {
            // Handle the preactivated card with our improved function
            console.log("Touch end with targeted card - finalizing activation");
            finalizeCardActivation();
            isTouchActive = false;
            return;
        }

        // If no card is highlighted but we have a swipe, handle it with normal navigation
        let targetIndex = CardSystem.activeCardIndex;

        if (absTouchDistance > thresholdDistance ||
            (touchDuration < SWIPE_TIMEOUT && absTouchDistance > SWIPE_THRESHOLD)) {

            // Determine swipe direction and target
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

        // Apply improved transition for smoother recentering
        container.style.scrollBehavior = 'smooth';

        // Use a more natural easing curve for recentering
        container.style.transition = `all ${TRANSITION_DURATION}ms ${RECENTERING_EASING}`;
        moveToCard(targetIndex);

        isTouchActive = false;
    };

    // Function to highlight the target card
    function highlightTargetCard(card) {
        if (!card || card.classList.contains('active')) return;

        // Store the previously active card before changing
        previouslyActiveCard = document.querySelector('.card.active');

        // Track this card as preactivated
        preactivatedCard = card;

        // Reset all cards but preserve proper active index
        resetCardHighlights();

        // Add highlight effect to target card
        card.classList.add('card-targeted');

        // Get current active card and card we're moving to
        const currentCard = flipCards[CardSystem.activeCardIndex];

        // Prepare cached styles with beautiful scaling
        if (!highlightTargetCard.activeStyle) {
            highlightTargetCard.activeStyle = `
                opacity: 1 !important;
                background-color: var(--primary-color, #0078e7) !important;
                border-color: var(--primary-color-dark, #005bb1) !important;
                padding-bottom: 20px !important;
                transform: scale(1) !important;
                transition: opacity 0.25s ease, background-color 0.25s ease, transform 0.28s ease !important;
            `;

            highlightTargetCard.inactiveStyle = `
                opacity: 0.7 !important;
                background-color: var(--secondary-color, #76b5e7) !important;
                border-color: var(--secondary-color-dark, #5090c9) !important;
                padding-bottom: 20px !important;
                transform: scale(0.95) !important;
                transition: opacity 0.25s ease, background-color 0.25s ease, transform 0.28s ease !important;
            `;
        }

        // Apply cached styles to card front
        if (card.querySelector('.flip-card-front')) {
            card.querySelector('.flip-card-front').style.cssText = highlightTargetCard.activeStyle;
        }

        // Make the current card visually inactive
        if (currentCard !== card && currentCard.querySelector('.flip-card-front')) {
            currentCard.querySelector('.flip-card-front').style.cssText = highlightTargetCard.inactiveStyle;
        }
    }

    // Function to reset all card highlights
    function resetCardHighlights() {
        // Cache the style strings if not already cached
        if (!resetCardHighlights.activeStyle) {
            resetCardHighlights.activeStyle = `
                opacity: 1 !important;
                background-color: var(--primary-color, #0078e7) !important;
                border-color: var(--primary-color-dark, #005bb1) !important;
                padding-bottom: 20px !important;
                transform: scale(1) !important;
                transition: opacity 0.25s ease, background-color 0.25s ease, transform 0.28s ease !important;
            `;

            resetCardHighlights.inactiveStyle = `
                opacity: 0.7 !important;
                background-color: var(--secondary-color, #76b5e7) !important;
                border-color: var(--secondary-color-dark, #5090c9) !important;
                padding-bottom: 20px !important;
                transform: scale(0.95) !important;
                transition: opacity 0.25s ease, background-color 0.25s ease, transform 0.28s ease !important;
            `;
        }

        // Reset temporary visual styles
        flipCards.forEach(card => {
            card.classList.remove('card-targeted');
        });

        // Calculate range of visible cards (active +/- 2)
        const activeIndex = CardSystem.activeCardIndex;
        const startIdx = Math.max(0, activeIndex - 2);
        const endIdx = Math.min(flipCards.length - 1, activeIndex + 2);

        // Only apply styles to cards in the visible range
        for (let i = startIdx; i <= endIdx; i++) {
            const card = flipCards[i];
            if (card.querySelector('.flip-card-front')) {
                card.querySelector('.flip-card-front').style.cssText =
                    (i === activeIndex) ?
                    resetCardHighlights.activeStyle :
                    resetCardHighlights.inactiveStyle;
            }
        }

        // Clear preactivation when all highlights are reset
        preactivatedCard = null;
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
        // Get current state
        const isFlipped = card.classList.contains('flipped');
        const shouldFlip = !isFlipped;

        // Set flags
        CardSystem.isManuallyFlipping = true;

        // Check for both Safari Mobile AND Chrome on mobile browsers
        if (document.body.classList.contains('safari-mobile') ||
            document.body.classList.contains('chrome-android') ||
            document.body.classList.contains('chrome-ios')) {
            if (shouldFlip) {
                // Show in overlay instead of flipping
                openOverlay(card);
                return; // Exit early, don't do regular flip
            } else if (isOverlayActive) {
                // Close overlay instead of unflipping
                closeOverlay();
                return; // Exit early, don't do regular flip
            }
            return; // Important: Exit here to prevent any default flip behavior
        }

        // Regular flip behavior for desktop browsers only
        if (shouldFlip) {
            // Force a reflow before adding the flipped class
            CardSystem.adjustCardHeight(card, true);
            void card.offsetWidth; // Force reflow
            card.classList.add('flipped');
            CardSystem.currentlyFlippedCard = card;

            // Hide indicators when card is flipped
            document.querySelector('.card-indicator').style.opacity = '0';
            document.querySelector('.card-indicator').style.pointerEvents = 'none';

            // Make card larger and hide header banner
            expandCardForMobile(card);
            toggleHeaderBanner(false);

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

            // When a card is unflipped:
            isAnyCardFlipped = false;

            // Wait for the header to become visible before showing the logo
            setTimeout(() => {
                toggleLogoVisibility(true);
            }, 100);
        }

        // Reset manual flipping flag after a delay
        setTimeout(() => {
            CardSystem.isManuallyFlipped = false;
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

        finalizeCardActivation();
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
            transition: transform 0.28s ease, box-shadow 0.25s ease !important;
            z-index: 10 !important;
        }

        /* CRITICAL FIX: Override the :not(.active) selector with higher specificity */
        .flip-card.card-targeted:not(.active) {
            opacity: 1 !important;
            transform: scale(1.05) !important;
        }

        /* Apply smooth transitions to card front styles */
        .flip-card-front {
            transition: opacity 0.25s ease, background-color 0.25s ease, transform 0.28s ease !important;
            transform-origin: center center !important;
        }

        /* Inactive card scale effect */
        .flip-card:not(.active):not(.card-targeted) .flip-card-front {
            transform: scale(0.95) !important;
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
        // Make cards initially invisible
        flipCards.forEach(card => {
            card.style.opacity = '0';
            card.style.transition = 'none';
        });

        // Calculate and set position immediately without any animation
        const firstCardPosition = getCardScrollPosition(0);
        container.style.scrollBehavior = 'auto';
        container.style.transition = 'none';
        container.scrollLeft = firstCardPosition;

        // Force reflow to ensure position is applied
        void container.offsetWidth;

        // After positioning is complete, make cards visible with a transition
        setTimeout(() => {
            flipCards.forEach(card => {
                card.style.transition = 'opacity 0.3s ease';
                card.style.opacity = '';
            });
            container.style.transition = '';
            container.style.scrollBehavior = '';
        }, 50);
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

    // Modify updateLogoPosition to use the stored position if available
    function updateLogoPosition() {
        // Only use the stored position
        const logoContainer = document.querySelector('.logo-container');
        if (logoContainer && finalLogoPosition !== null) {
            logoContainer.style.position = 'fixed';
            logoContainer.style.top = `${finalLogoPosition}px`;
            logoContainer.style.left = '50%';
            logoContainer.style.transform = 'translateX(-50%)';
        }
    }

    // Update the initLogoVisibility function
    function initLogoVisibility() {
        // Initially hide the logo to prevent the "flying" effect
        const logoContainer = document.querySelector('.logo-container');
        if (logoContainer) {
            // Start with logo invisible
            logoContainer.style.opacity = '0';
            logoContainer.style.visibility = 'hidden';
        }

        // Check if any card is already flipped (page refresh case)
        isAnyCardFlipped = CardSystem.currentlyFlippedCard !== null;

        if (!isAnyCardFlipped) {
            // Position the logo first while it's invisible
            updateLogoPosition();

            // Then make it visible with a fade in
            setTimeout(() => {
                if (logoContainer) {
                    logoContainer.style.transition = 'opacity 0.3s ease';
                    logoContainer.style.visibility = 'visible';
                    logoContainer.style.opacity = '1';
                }
            }, 100); // Small delay to ensure position is set
        }
    }

    // Enhanced initialization function with proper waitForCardMeasurements
    async function initialize() {
        console.log("Initializing mobile card system...");

        // Define waitForCardMeasurements function with timeout and faster polling
        function waitForCardMeasurements() {
            return new Promise((resolve, reject) => {
                // OPTIMIZATION: Check immediately first
                if (container?.offsetWidth > 0 && flipCards[0]?.offsetWidth > 0) {
                    resolve();
                    return;
                }

                let attempts = 0;
                const checkCards = setInterval(() => {
                    if (container?.offsetWidth > 0 && flipCards[0]?.offsetWidth > 0) {
                        clearInterval(checkCards);
                        resolve();
                    } else if (attempts >= 25) { // Reduced timeout to 2.5 seconds
                        clearInterval(checkCards);
                        // Fallback to basic initialization if measurement fails
                        console.warn('Card measurement timed out, using fallback initialization');
                        resolve();
                    }
                    attempts++;
                }, 100);
            });
        }

        // Add initial CSS to hide cards until positioned
        const style = document.createElement('style');
        style.textContent = `
            .card-container {
                visibility: hidden;
                opacity: 0;
                transition: opacity 0.5s ease;
            }
            .initialized .card-container {
                visibility: visible;
                opacity: 1;
            }
        `;
        document.head.appendChild(style);

        // Completely revised initializeSequence
        async function initializeSequence() {
            try {
                // STEP 1: Add a CSS blocker to prevent ANY rendering of cards until we're ready
                const styleBlocker = document.createElement('style');
                styleBlocker.id = 'init-blocker';
                styleBlocker.textContent = `
                    .flip-cards-container {
                        opacity: 0 !important;
                        visibility: hidden !important;
                    }
                    .logo-container {
                        opacity: 0 !important;
                        visibility: hidden !important;
                    }
                    .card-indicator {
                        opacity: 0 !important;
                    }
                `;
                document.head.appendChild(styleBlocker);

                // Set inline styles to reinforce our CSS blocking
                container.style.visibility = 'hidden';
                container.style.opacity = '0';

                // Handle logo and indicators
                const logoContainer = document.querySelector('.logo-container');
                if (logoContainer) {
                    logoContainer.style.visibility = 'hidden';
                    logoContainer.style.opacity = '0';
                }

                const cardIndicator = document.querySelector('.card-indicator');
                if (cardIndicator) {
                    cardIndicator.style.opacity = '0';
                }

                // STEP 2: Wait for cards to be measurable
                await waitForCardMeasurements();

                // STEP 3: Configure card container with transitions disabled
                // Absolutely prevent transitions during setup
                container.style.transition = 'none !important';
                container.style.webkitTransition = 'none !important';
                container.style.scrollBehavior = 'auto';

                // Add left/right padding
                addEdgeCardPadding();

                // Fix vertical positioning
                fixVerticalPositioning();

                // Set initial card state
                CardSystem.activeCardIndex = 0;
                CardSystem.updateUI();

                // Position the first card in center - CRITICAL STEP
                const firstCard = flipCards[0];
                const containerWidth = container.offsetWidth;
                const cardWidth = firstCard.offsetWidth;
                const targetScrollLeft = firstCard.offsetLeft - (containerWidth - cardWidth) / 2;

                // Explicitly position without animation
                container.scrollLeft = targetScrollLeft;

                // Apply highlight states
                resetCardHighlights();

                // STEP 4: Force reflows to ensure all layout calculations are complete
                void document.body.offsetHeight;
                void container.offsetHeight;

                // CRITICAL FIX: Add an absolute position container that covers everything
                // while we finalize positioning
                const positionBlocker = document.createElement('div');
                positionBlocker.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: white;
                    z-index: 9999;
                    opacity: 1;
                    transition: opacity 0.5s ease;
                `;
                document.body.appendChild(positionBlocker);

                // Show header
                toggleHeaderBanner(true);

                // Force another layout calculation
                await new Promise(resolve => setTimeout(resolve, 50));
                void document.documentElement.offsetHeight;

                // STEP 5: Calculate logo position
                const header = document.querySelector('header');
                const activeCard = flipCards[CardSystem.activeCardIndex];

                if (header && activeCard && logoContainer) {
                    // Force reflow for accurate measurements
                    void header.offsetHeight;
                    void activeCard.offsetHeight;

                    // Get precise measurements
                    const headerRect = header.getBoundingClientRect();
                    const cardRect = activeCard.getBoundingClientRect();

                    // Calculate available space
                    const headerBottom = headerRect.bottom;
                    const cardTop = cardRect.top;

                    // Set CSS variables for logo positioning
                    document.documentElement.style.setProperty('--header-bottom', `${headerBottom}px`);
                    document.documentElement.style.setProperty('--card-top', `${cardTop}px`);

                    // Update or create style element for logo positioning
                    let styleEl = document.getElementById('logo-position-style');
                    if (!styleEl) {
                        styleEl = document.createElement('style');
                        styleEl.id = 'logo-position-style';
                        document.head.appendChild(styleEl);
                    }

                    styleEl.textContent = `
                        .logo-container {
                            position: fixed !important;
                            top: calc((var(--header-bottom) + var(--card-top)) / 2) !important;
                            left: 50% !important;
                            transform: translate(-50%, -50%) !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                    `;

                    // Store the position for later reference
                    finalLogoPosition = headerBottom + ((cardTop - headerBottom) / 2);

                    // Log for debugging
                    console.log(`LAYOUT READY - measurements complete:`);
                    console.log(`Header bottom: ${headerBottom}px`);
                    console.log(`Card top: ${cardTop}px`);
                    console.log(`Available space: ${cardTop - headerBottom}px`);
                    console.log(`Vertical midpoint: ${headerBottom + ((cardTop - headerBottom) / 2)}px`);
                }

                // STEP 6: Set up fade-in transitions BEFORE making elements visible
                // We set these while elements are still hidden
                if (logoContainer) {
                    logoContainer.style.transition = 'opacity 0.5s ease';
                }

                if (cardIndicator) {
                    cardIndicator.style.transition = 'opacity 0.5s ease';
                }

                container.style.transition = 'opacity 0.5s ease';

                // STEP 7: Remove the style blocker but keep the position blocker
                if (styleBlocker && styleBlocker.parentNode) {
                    styleBlocker.parentNode.removeChild(styleBlocker);
                }

                // STEP 8: NOW make everything visible underneath the position blocker
                container.style.visibility = 'visible';
                container.style.opacity = '1';

                if (logoContainer) {
                    logoContainer.style.visibility = 'visible';
                    logoContainer.style.opacity = '1';
                }

                if (cardIndicator) {
                    cardIndicator.style.opacity = '1';
                }

                // STEP 9: Once everything is completely positioned AND visible underneath,
                // fade out the position blocker to reveal the perfectly positioned content
                await new Promise(resolve => setTimeout(resolve, 50));
                positionBlocker.style.opacity = '0';

                // Remove the position blocker after the fade
                setTimeout(() => {
                    if (positionBlocker.parentNode) {
                        positionBlocker.parentNode.removeChild(positionBlocker);
                    }
                }, 500);

                console.log("Initialization complete - clean fade-in with no sliding effect");

            } catch (error) {
                console.error('Initialization failed:', error);
                console.error('Error details:', error.message);

                // If initialization fails, at least make everything visible
                // Remove the blocker style in case of error
                const styleBlocker = document.getElementById('init-blocker');
                if (styleBlocker && styleBlocker.parentNode) {
                    styleBlocker.parentNode.removeChild(styleBlocker);
                }

                container.style.visibility = 'visible';
                container.style.opacity = '1';

                const logoContainer = document.querySelector('.logo-container');
                if (logoContainer) {
                    logoContainer.style.visibility = 'visible';
                    logoContainer.style.opacity = '1';
                }

                const cardIndicator = document.querySelector('.card-indicator');
                if (cardIndicator) {
                    cardIndicator.style.opacity = '1';
                }
            }
        }

        // Start initialization
        initializeSequence();
    }

    // Replace the current initialization code with this enhanced version
    if (document.readyState === 'complete') {
        initialize();
    } else {
        window.addEventListener('load', initialize);
    }

    // Also run on resize to maintain proper centering
    window.addEventListener('resize', () => {
        // Recenter current card on resize
        moveToCard(CardSystem.activeCardIndex);
    });

    // Function to create the overlay
    function createOverlay() {
        // Create overlay elements if they don't exist
        if (!cardOverlay) {
            // Create main overlay
            cardOverlay = document.createElement('div');
            cardOverlay.className = 'card-overlay';

            // Create content container
            overlayContent = document.createElement('div');
            overlayContent.className = 'overlay-content';

            // Create close button
            const closeButton = document.createElement('div');
            closeButton.className = 'overlay-close';
            closeButton.addEventListener('click', closeOverlay);

            // Create swipe indicator
            const swipeIndicator = document.createElement('div');
            swipeIndicator.className = 'swipe-indicator';
            swipeIndicator.textContent = 'Scroll down for more';

            // Append elements
            overlayContent.appendChild(closeButton);
            overlayContent.appendChild(swipeIndicator);
            cardOverlay.appendChild(overlayContent);
            document.body.appendChild(cardOverlay);

            // Add touch event listeners for the overlay
            overlayContent.addEventListener('touchstart', handleOverlayTouchStart, { passive: true });
            overlayContent.addEventListener('touchmove', handleOverlayTouchMove, { passive: true });
            overlayContent.addEventListener('touchend', handleOverlayTouchEnd);

            // Add click event to close overlay when clicking outside content
            cardOverlay.addEventListener('click', function(e) {
                if (e.target === cardOverlay) {
                    closeOverlay();
                }
            });
        }
    }

    // Function to open the overlay with card content and animation
    function openOverlay(card) {
        if (!cardOverlay) {
            createOverlay();
        }

        // Store reference to current card
        currentOverlayCard = card;
        CardSystem.currentlyFlippedCard = card;

        // Get the card back content
        const cardBack = card.querySelector('.flip-card-back');

        // Clear the overlay content
        overlayContent.innerHTML = '';

        // Add close button
        const closeButton = document.createElement('div');
        closeButton.className = 'overlay-close';
        closeButton.addEventListener('click', closeOverlay);
        overlayContent.appendChild(closeButton);

        // Create a content wrapper to hold the card content
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'overlay-content-wrapper';
        contentWrapper.style.width = '100%';
        contentWrapper.style.height = 'auto';
        contentWrapper.style.position = 'relative';

        // Clone and append the content
        const contentClone = cardBack.cloneNode(true);
        contentClone.style.transform = 'none'; // Remove rotation
        contentClone.style.position = 'relative';
        contentClone.style.top = '0';
        contentClone.style.left = '0';
        contentClone.style.width = '100%';
        contentClone.style.height = 'auto';
        contentWrapper.appendChild(contentClone);

        // Add the content wrapper to the overlay
        overlayContent.appendChild(contentWrapper);

        // Add swipe indicator after all content
        const swipeIndicator = document.createElement('div');
        swipeIndicator.className = 'swipe-indicator';
        swipeIndicator.textContent = 'scroll for more';
        overlayContent.appendChild(swipeIndicator);

        // Show the overlay
        cardOverlay.classList.add('active');
        isOverlayActive = true;

        // Hide header and indicators
        toggleHeaderBanner(false);
        document.querySelector('.card-indicator').style.opacity = '0';
        document.querySelector('.card-indicator').style.pointerEvents = 'none';
        toggleLogoVisibility(false);

        // Prevent body scrolling
        document.body.style.overflow = 'hidden';
    }

    // Function to close the overlay
    function closeOverlay() {
        if (cardOverlay) {
            cardOverlay.classList.remove('active');
            isOverlayActive = false;

            // Reset the current card reference
            CardSystem.currentlyFlippedCard = null;
            currentOverlayCard = null;

            // Show header and indicators
            toggleHeaderBanner(true);
            document.querySelector('.card-indicator').style.opacity = '1';
            document.querySelector('.card-indicator').style.pointerEvents = 'auto';

            // Show logo after a delay
            setTimeout(() => {
                toggleLogoVisibility(true);
            }, 100);

            // Re-enable body scrolling
            document.body.style.overflow = '';
        }
    }

    // Touch handlers for overlay swipe navigation
    let overlayTouchStartX = 0;
    let overlayTouchStartY = 0;

    function handleOverlayTouchStart(e) {
        overlayTouchStartX = e.touches[0].clientX;
        overlayTouchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
    }

    function handleOverlayTouchMove(e) {
        // Just track movement, don't prevent default to allow scrolling
    }

    function handleOverlayTouchEnd(e) {
        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;
        const touchDuration = Date.now() - touchStartTime;

        // Calculate distances
        const xDistance = touchEndX - overlayTouchStartX;
        const absXDistance = Math.abs(xDistance);
        const yDistance = touchEndY - overlayTouchStartY;
        const absYDistance = Math.abs(yDistance);

        // Only handle horizontal swipes - ignore vertical swipes
        if (absXDistance > absYDistance &&
            absXDistance > SWIPE_THRESHOLD &&
            touchDuration < SWIPE_TIMEOUT) {

            // Get current and target indices
            const currentIndex = CardSystem.activeCardIndex;
            const targetIndex = xDistance < 0 ?
                Math.min(flipCards.length - 1, currentIndex + 1) :
                Math.max(0, currentIndex - 1);

            if (targetIndex !== currentIndex) {
                // Close current overlay first
                closeOverlay();

                // Move to the new card after a short delay
                setTimeout(() => {
                    moveToCard(targetIndex);
                    // Don't automatically open the new card's overlay
                }, 50);
            }
        }
    }

    // Add this debugging function to help identify the issue
    function debugCardActivation(message, data = {}) {
        const debug = true; // Set to false to disable debugging
        if (!debug) return;

        console.group(`Card Activation Debug: ${message}`);
        console.log(data);
        console.groupEnd();
    }

    // Update the finalizeCardActivation function to properly check visibility
    function finalizeCardActivation() {
        // Find the preactivated card
        const targetedCard = document.querySelector('.card-targeted');

        console.log("ACTIVATION DEBUG:");
        console.log("- Targeted card found:", !!targetedCard);

        if (!targetedCard) {
            console.log("- No targeted card found");
            return;
        }

        // Get the index of the targeted card
        const targetedIndex = Array.from(flipCards).indexOf(targetedCard);

        // BUGFIX: Only move if the index is valid
        if (targetedIndex >= 0) {
            // Use a slightly longer animation for smoother card transitions
            container.style.transition = `all ${TRANSITION_DURATION}ms ${RECENTERING_EASING}`;
            moveToCard(targetedIndex, true);

            // Reset highlights after the transition is complete
            setTimeout(() => {
                resetCardHighlights();
            }, TRANSITION_DURATION);
        }
    }
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

// Let's add a debugging version of updateLogoPosition that logs all relevant values
function debugLogoPosition(caller) {
    const logoContainer = document.querySelector('.logo-container');
    const header = document.querySelector('header');
    const activeCard = document.querySelector('.flip-card.active') || flipCards[CardSystem.activeCardIndex];

    if (!logoContainer || !header || !activeCard) {
        console.log(`[${caller}] Missing elements for logo positioning`);
        return null;
    }

    // Force a reflow on both header and card to ensure measurements are accurate
    void header.offsetHeight;
    void activeCard.offsetHeight;

    // Get precise measurements after forcing reflow
    const headerRect = header.getBoundingClientRect();
    const cardRect = activeCard.getBoundingClientRect();
    const logoRect = logoContainer.getBoundingClientRect();

    // Calculate the exact midpoint between header bottom and card top
    const headerBottom = headerRect.bottom;
    const cardTop = cardRect.top;
    const availableSpace = cardTop - headerBottom;
    const midPoint = headerBottom + (availableSpace / 2);
    const logoHeight = logoContainer.offsetHeight;
    const adjustedPosition = midPoint - (logoHeight / 2);

    // Debug info
    console.log(`[${caller}] LOGO POSITION DEBUG:`);
    console.log(`  Header: top=${headerRect.top.toFixed(2)}, bottom=${headerBottom.toFixed(2)}, height=${headerRect.height.toFixed(2)}`);
    console.log(`  Active Card: top=${cardTop.toFixed(2)}, height=${cardRect.height.toFixed(2)}`);
    console.log(`  Logo: height=${logoHeight}, current top=${logoRect.top.toFixed(2)}`);
    console.log(`  Space: available=${availableSpace.toFixed(2)}, midPoint=${midPoint.toFixed(2)}, adjustedPos=${adjustedPosition.toFixed(2)}`);
    console.log(`  Card computed styles:`, window.getComputedStyle(activeCard));
    console.log(`  Header computed styles:`, window.getComputedStyle(header));

    return {
        headerBottom,
        cardTop,
        midPoint,
        adjustedPosition
    };
}
