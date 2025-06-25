// Desktop-specific implementation
(function() {
    // Get the CardSystem from common.js
    const CardSystem = window.CardSystem;
    const container = CardSystem.container;
    const flipCards = CardSystem.flipCards;

    // Desktop-specific variables
    let navArrows = [];
    let isScrolling = false;
    let scrollEndTimeout;
    let longSwipeTimeout = null;
    let lastKeyPressTime = 0;
    let isRapidScrolling = false;
    let isScrollAnimationActive = false;
    let scrollAnimationStartTime = 0;
    let scrollAnimationTimeout = null;
    let lastScrollPosition = 0;
    let scrollPositionCheckInterval = null;
    let scrollStabilityCounter = 0;
    let isUserActivelyScrolling = false;
    let userScrollTimeout = null;
    let isScrollMomentumActive = false;
    let lastWheelEventTime = 0;
    let wheelMomentumTimeout = null;
    let isRecentering = false;
    let pendingCardFlip = null;
    let unflipGraceTimer = null;
    let isAnyCardFlipped = false;

    // Constants
    const rapidKeyPressThreshold = 300; // ms
    const SCROLL_STABILITY_THRESHOLD = 3; // Number of stable position checks needed

    // Add a flag to track the source of the last card activation
    let lastCardActivationSource = 'none'; // Can be 'click', 'key', 'arrow', 'scroll'

    // Setup card indicator click handlers for desktop
    const cardIndicator = document.querySelector('.card-indicator');
    cardIndicator.querySelectorAll('.indicator-dot').forEach((dot) => {
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(dot.dataset.index);

            // Cancel all animations and scrolling
            container.style.scrollBehavior = 'auto';
            isScrolling = false;
            clearTimeout(scrollEndTimeout);
            clearTimeout(longSwipeTimeout);

            // Set activation source
            lastCardActivationSource = 'click';

            // Reset any flipped card
            if (CardSystem.currentlyFlippedCard) {
                CardSystem.resetFlippedCard();
                toggleLogoVisibility(true);
            }

            // Update UI immediately
            CardSystem.activeCardIndex = index;
            CardSystem.updateUI();

            // Calculate the start and end positions
            const startPosition = container.scrollLeft;
            const targetCard = flipCards[index];
            const containerCenter = container.offsetWidth / 2;
            const cardCenter = targetCard.offsetWidth / 2;
            const endPosition = targetCard.offsetLeft - containerCenter + cardCenter;

            // Calculate distance and index difference
            const scrollDistance = Math.abs(endPosition - startPosition);
            const indexDifference = Math.abs(index - CardSystem.activeCardIndex);

            // Dynamic duration based on distance:
            // - Nearly instant for adjacent cards (100ms)
            // - Very fast for 2 cards away (150ms)
            // - Fast but noticeable for farther jumps (up to 300ms)
            let duration;
            if (indexDifference <= 1) {
                duration = 200; // Slower for adjacent (was 100)
            } else if (indexDifference <= 2) {
                duration = 300; // Slower for 2 away (was 150)
            } else {
                // Scale between 300-450ms based on distance (was 200-300)
                const baseDuration = Math.min(600, 450 + indexDifference * 30);
                duration = Math.min(baseDuration, 450); // Cap at 450ms (was 300)
            }

            // Animation start time
            const startTime = performance.now();

            // Flag that we're in an animated scroll
            isScrolling = true;

            // Animation function using cubic easing
            function animateScroll() {
                const currentTime = performance.now();
                const elapsed = currentTime - startTime;

                if (elapsed < duration) {
                    // Use a faster easing curve with less deceleration
                    const progress = elapsed / duration;
                    // Quadratic easing gives less pronounced deceleration
                    const easedProgress = 1 - Math.pow(1 - progress, 2);

                    // Calculate new position
                    const newPosition = startPosition + (endPosition - startPosition) * easedProgress;

                    // Apply new scroll position
                    container.scrollLeft = newPosition;

                    // Update active card during scroll for visual feedback
                    updateActiveCardDuringScroll();

                    // Continue animation
                    requestAnimationFrame(animateScroll);
                } else {
                    // Animation complete - ensure we're at exact final position
                    container.scrollLeft = endPosition;
                    isScrolling = false;

                    // Final update
                    CardSystem.activeCardIndex = index;
                    CardSystem.updateUI();
                }
            }

            // Start animation
            requestAnimationFrame(animateScroll);
        });
    });

    // Add navigation arrows for desktop
    function addNavigationArrows() {
        const navLeft = document.createElement('div');
        navLeft.className = 'nav-arrow nav-left';
        navLeft.innerHTML = '←';
        navLeft.setAttribute('aria-label', 'Previous card');

        const navRight = document.createElement('div');
        navRight.className = 'nav-arrow nav-right';
        navRight.innerHTML = '→';
        navRight.setAttribute('aria-label', 'Next card');

        document.body.appendChild(navLeft);
        document.body.appendChild(navRight);
        navArrows = [navLeft, navRight];

        // Direct arrow click handlers
        navLeft.addEventListener('click', () => {
            const newIndex = CardSystem.findPrevVisibleIndex(CardSystem.activeCardIndex);
            if (newIndex !== CardSystem.activeCardIndex) {
                // Clear the long swipe timeout to prevent race condition
                clearTimeout(longSwipeTimeout);

                // Reset manual flipping flag immediately
                CardSystem.isManuallyFlipping = false;

                // Reset any flipped card
                if (CardSystem.currentlyFlippedCard) {
                    CardSystem.resetFlippedCard();
                    isAnyCardFlipped = false;
                    toggleLogoVisibility(true);
                }

                CardSystem.activeCardIndex = newIndex;

                flipCards.forEach((card, index) => {
                    card.classList.toggle('active', index === newIndex);
                    card.style.opacity = index === newIndex ? '1' : '0.65';
                });

                updateDotIndicatorsDirectly(newIndex);

                container.style.scrollBehavior = 'auto';

                const targetCard = flipCards[newIndex];
                const containerCenter = container.offsetWidth / 2;
                const cardCenter = targetCard.offsetWidth / 2;
                const scrollPosition = targetCard.offsetLeft - containerCenter + cardCenter;

                container.scrollLeft = scrollPosition;
            }
        });

        navRight.addEventListener('click', () => {
            const newIndex = CardSystem.findNextVisibleIndex(CardSystem.activeCardIndex);
            if (newIndex !== CardSystem.activeCardIndex) {
                // Clear the long swipe timeout to prevent race condition
                clearTimeout(longSwipeTimeout);

                // Reset manual flipping flag immediately
                CardSystem.isManuallyFlipping = false;

                // Reset any flipped card
                if (CardSystem.currentlyFlippedCard) {
                    CardSystem.resetFlippedCard();
                    isAnyCardFlipped = false;
                    toggleLogoVisibility(true);
                }

                CardSystem.activeCardIndex = newIndex;

                flipCards.forEach((card, index) => {
                    card.classList.toggle('active', index === newIndex);
                    card.style.opacity = index === newIndex ? '1' : '0.65';
                });

                updateDotIndicatorsDirectly(newIndex);

                container.style.scrollBehavior = 'auto';

                const targetCard = flipCards[newIndex];
                const containerCenter = container.offsetWidth / 2;
                const cardCenter = targetCard.offsetWidth / 2;
                const scrollPosition = targetCard.offsetLeft - containerCenter + cardCenter;

                container.scrollLeft = scrollPosition;
            }
        });
    }

    // Force stop all animations
    function forceStopAllAnimations() {
        // Force reflow/repaint to immediately apply all pending CSS changes
        container.style.animation = 'none';
        container.offsetHeight; // Trigger reflow
        container.style.animation = null;

        // Stop container scrolling immediately
        container.style.scrollBehavior = 'auto';

        // Reset all card transitions
        flipCards.forEach(card => {
            // Temporarily remove all transitions to force immediate state
            card.style.transition = 'none';
            card.querySelector('.flip-card-inner').style.transition = 'none';

            // Trigger reflow to apply changes
            card.offsetHeight;
        });

        // Clear any pending timeouts
        clearTimeout(scrollEndTimeout);
        clearTimeout(longSwipeTimeout);
        isScrolling = false;
    }

    // Restore transitions after force stop
    function restoreAnimations() {
        // Restore scroll behavior
        container.style.scrollBehavior = 'smooth';

        // Restore all card transitions
        flipCards.forEach(card => {
            card.style.transition = '';
            card.querySelector('.flip-card-inner').style.transition = '';
        });
    }

    // Update the existing toggleLogoVisibility function
    function toggleLogoVisibility(show) {
        const logoContainer = document.querySelector('.logo-container');
        if (logoContainer) {
            logoContainer.style.opacity = show ? '1' : '0';
            logoContainer.style.visibility = show ? 'visible' : 'hidden';
        }
    }

    // Add a new function to dynamically position the logo
    function updateLogoPosition() {
        const logoContainer = document.querySelector('.logo-container');
        const header = document.querySelector('header');
        const activeCard = document.querySelector('.flip-card.active');

        if (logoContainer && header && activeCard) {
            // Get header bottom position relative to viewport
            const headerBottom = header.getBoundingClientRect().bottom;

            // Get the active card's top position
            const cardTop = activeCard.getBoundingClientRect().top;

            // Calculate the midpoint between header and card
            const midPoint = headerBottom + (cardTop - headerBottom) / 2;

            // Adjust for logo height to truly center it
            const logoHeight = logoContainer.offsetHeight;
            const adjustedPosition = midPoint - (logoHeight / 2);

            // Set the position
            logoContainer.style.position = 'fixed';
            logoContainer.style.top = `${adjustedPosition}px`;
            logoContainer.style.transform = 'translateX(-50%)';
        }
    }

    // Modify the card click handler to handle momentum and centering better
    flipCards.forEach((card, index) => {
        card.addEventListener('click', function(e) {
            // Skip link clicks
            if (e.target.tagName === 'A') return;

            // Skip if dragging
            if (e.clientX && this.dataset.mouseDownX) {
                const dragDistance = Math.abs(e.clientX - parseInt(this.dataset.mouseDownX));
                if (dragDistance > 5) return;
            }

            // Set activation source
            lastCardActivationSource = 'click';

            // Find which card is most visible at this moment
            const containerRect = container.getBoundingClientRect();
            const containerCenter = containerRect.left + containerRect.width / 2;

            // Get this card's visibility and center positioning
            const cardRect = this.getBoundingClientRect();
            const cardCenter = cardRect.left + cardRect.width / 2;
            const overlapLeft = Math.max(containerRect.left, cardRect.left);
            const overlapRight = Math.min(containerRect.right, cardRect.right);
            const visibleWidth = Math.max(0, overlapRight - overlapLeft);
            const isCardCentered = Math.abs(cardCenter - containerCenter) < 20; // Within 20px of center

            // If card is not significantly visible, just center it without flipping
            if (visibleWidth / cardRect.width < 0.7) {
                // Clear any pending timeouts
                clearTimeout(longSwipeTimeout);
                clearTimeout(scrollEndTimeout);

                // Just center the card without flipping
                CardSystem.activeCardIndex = index;
                CardSystem.updateUI();
                centerCardForPC(index);
                return;
            }

            // Proceed with flipping logic
            clearTimeout(longSwipeTimeout);
            CardSystem.isManuallyFlipping = true;
            clearTimeout(scrollEndTimeout);

            // Force stop all animations for immediate response
            forceStopAllAnimations();

            const shouldFlip = !this.classList.contains('flipped');

            // Toggle logo visibility
            if (shouldFlip) {
                toggleLogoVisibility(false);
                isAnyCardFlipped = true;
            } else {
                toggleLogoVisibility(true);
                isAnyCardFlipped = false;
            }

            // Update active card index if needed
            if (CardSystem.activeCardIndex !== index) {
                CardSystem.activeCardIndex = index;
                CardSystem.updateUI();
            }

            // Handle any previously flipped card
            if (CardSystem.currentlyFlippedCard && CardSystem.currentlyFlippedCard !== this) {
                CardSystem.resetFlippedCard();
            }

            // Restore animations
            restoreAnimations();

            if (shouldFlip) {
                // Force a reflow between operations
                CardSystem.adjustCardHeight(this, true);
                void this.offsetWidth; // Force reflow
                this.classList.add('flipped');
                CardSystem.currentlyFlippedCard = this;

                // === Add swipe-indicator overlay for desktop flipped cards ONLY if there is vertical overflow ===
                if (window.innerWidth >= 769) {
                    const cardBack = this.querySelector('.flip-card-back');
                    if (cardBack && !cardBack.querySelector('.swipe-indicator')) {
                        // Check for vertical overflow
                        if (cardBack.scrollHeight > cardBack.clientHeight + 2) { // +2 for rounding tolerance
    const swipeIndicator = document.createElement('div');
    swipeIndicator.className = 'swipe-indicator';
    swipeIndicator.innerHTML = '<span class="scroll-text">Scroll for more</span>';
    cardBack.appendChild(swipeIndicator);

    // --- Add scroll detection for "end" indicator ---
    const updateSwipeIndicatorText = () => {
        const scrollText = swipeIndicator.querySelector('.scroll-text');
        if (!scrollText) return;
        const isAtBottom = Math.abs(cardBack.scrollHeight - cardBack.scrollTop - cardBack.clientHeight) < 2;
        if (!cardBack || cardBack.scrollHeight <= cardBack.clientHeight + 2) {
            scrollText.textContent = "Scroll for more";
        } else if (isAtBottom) {
            scrollText.textContent = "End";
        } else {
            scrollText.textContent = "Scroll For More";
        }
    };
    cardBack.addEventListener('scroll', updateSwipeIndicatorText);
    // Also update on creation in case already at bottom
    setTimeout(updateSwipeIndicatorText, 0);
}

                    }
                }
                // === END swipe-indicator overlay ===

                // IMPROVEMENT: If card is not centered, wait for momentum to settle then center it
                if (!isCardCentered && isScrollMomentumActive) {
                    // Set a flag that we want to center this card after momentum ends
                    let momentumSettleTimeout;

                    // Function to check if scroll momentum has settled
                    const checkForMomentumEnd = () => {
                        // If we're no longer in momentum state or if it's been a while, center the card
                        if (!isScrollMomentumActive || Date.now() - lastWheelEventTime > 300) {
                            // Momentum has ended, center the card
                            centerCardForPC(index);
                            clearInterval(momentumCheckInterval);
                        }
                    };

                    // Check every 100ms if momentum has settled
                    const momentumCheckInterval = setInterval(checkForMomentumEnd, 100);

                    // Set a backup timeout to ensure we don't wait forever (max 1 second)
                    momentumSettleTimeout = setTimeout(() => {
                        clearInterval(momentumCheckInterval);
                        centerCardForPC(index);
                    }, 1000);
                } else if (!isCardCentered) {
                    // No active momentum, so center after a slight delay
                    setTimeout(() => {
                        centerCardForPC(index);
                    }, 200);
                }
            } else {
                // Unflipping - use a different approach to prevent scrollbar

                // 1. Create full-viewport overlay to block scrollbar appearance
                const overlay = document.createElement('div');
                overlay.id = 'scrollbar-blocker';
                overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:1000; pointer-events:none;';
                document.body.appendChild(overlay);

                // 2. Force a specific height on the body and viewport
                const viewportHeight = window.innerHeight;
                document.body.style.height = `${viewportHeight}px`;
                document.documentElement.style.height = `${viewportHeight}px`;
                document.body.style.overflow = 'hidden';
                document.documentElement.style.overflow = 'hidden';

                // 3. Store current scroll position
                const scrollY = window.scrollY;

                // 4. Execute card deflipping with text scaling
                // Add was-flipped class to trigger text scaling during deflip
                this.classList.add('was-flipped');
                void this.offsetWidth; // Force reflow
                this.classList.remove('flipped');

                // === Remove swipe-indicator overlay for desktop flipped cards ===
                if (window.innerWidth >= 769) {
                    const cardBack = this.querySelector('.flip-card-back');
                    if (cardBack) {
                        const swipeIndicator = cardBack.querySelector('.swipe-indicator');
                        if (swipeIndicator) {
                            cardBack.removeChild(swipeIndicator);
                        }
                    }
                }
                // === END swipe-indicator removal ===

                // 5. Directly handle height change with inline styles for instant transition
                const originalHeight = 400; // Match the height in adjustCardHeight
                this.style.height = `${originalHeight}px`;
                this.querySelector('.flip-card-inner').style.height = '100%';
                this.querySelector('.flip-card-back').style.minHeight = '100%';
                CardSystem.currentlyFlippedCard = null;

                // 6. Wait for transition to complete, then restore everything
                setTimeout(() => {
                    // Remove overlay
                    if (document.getElementById('scrollbar-blocker')) {
                        document.getElementById('scrollbar-blocker').remove();
                    }

                    // Restore scroll position and overflow handling
                    document.body.style.height = '';
                    document.documentElement.style.height = '';
                    document.body.style.overflow = '';
                    document.documentElement.style.overflow = '';
                    window.scrollTo(0, scrollY);

                    // Remove the was-flipped class when the transition is complete
                    this.classList.remove('was-flipped');
                }, 400); // Match transition duration
            }

            // Reset manual flipping flag after a delay
            longSwipeTimeout = setTimeout(() => {
                CardSystem.isManuallyFlipping = false;
            }, 500);
        });

        // Track mouse down for drag detection
        card.addEventListener('mousedown', function(e) {
            this.dataset.mouseDownX = e.clientX;
        });

        // Clear mouse down data on mouse up
        card.addEventListener('mouseup', function() {
            delete this.dataset.mouseDownX;
        });
    });

    // Scroll to card function for desktop (simplified to remove unnecessary snapping)
    function scrollToCard(index, instantly = false) {
        const targetCard = flipCards[index];
        const containerCenter = container.offsetWidth / 2;
        const cardCenter = targetCard.offsetWidth / 2;

        // Set scroll behavior based on parameter
        container.style.scrollBehavior = instantly ? 'auto' : 'smooth';

        // Use a shorter duration for arrow navigation
        if (!instantly) {
            container.style.scrollBehavior = 'smooth';
            // Add a CSS variable to control animation speed (300ms is snappy but not instant)
            document.documentElement.style.setProperty('--scroll-duration', '300ms');
        }

        // Scroll to the card
        container.scrollLeft = targetCard.offsetLeft - containerCenter + cardCenter;

        // Reset scroll behavior after a short delay
        if (!instantly) {
            setTimeout(() => {
                document.documentElement.style.removeProperty('--scroll-duration');
            }, 350); // slightly longer than the animation
        }
    }

    // Center card for PC
    function centerCardForPC(index) {
        const card = flipCards[index];
        const containerWidth = container.offsetWidth;
        const containerCenter = containerWidth / 2;
        const cardCenter = card.offsetWidth / 2;

        // Enable smooth scrolling for desktop
        container.style.scrollBehavior = 'smooth';

        // Calculate position to perfectly center the card
        const scrollPosition = card.offsetLeft - containerCenter + cardCenter;

        // Apply smooth scrolling animation
        container.scrollLeft = scrollPosition;

        // Clear any existing grace timer when we explicitly center a card
        if (unflipGraceTimer && CardSystem.currentlyFlippedCard === card) {
            clearTimeout(unflipGraceTimer);
            unflipGraceTimer = null;
        }

        // After scrolling completes, check if card is centered and manage grace period
        setTimeout(() => {
            if (CardSystem.currentlyFlippedCard) {
                const containerRect = container.getBoundingClientRect();
                const containerCenter = containerRect.left + containerRect.width / 2;
                const cardRect = CardSystem.currentlyFlippedCard.getBoundingClientRect();
                const cardCenter = cardRect.left + cardRect.width / 2;
                const isCardCentered = Math.abs(cardCenter - containerCenter) < 20;

                if (!isCardCentered && CardSystem.currentlyFlippedCard === card) {
                    // Card still not centered after scrolling - start grace period
                    manageFlippedCardGracePeriod(index);
                }
            }
        }, 300); // Check after scroll animation completes
    }

    // Debounce function (utility function)
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    // Throttle function (utility function)
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Modify updateActiveCardDuringScroll to not automatically unflip cards
    function updateActiveCardDuringScroll() {
        // Don't update if manually flipping
        if (CardSystem.isManuallyFlipping) return;

        const containerRect = container.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;

        // Find the card closest to center
        let closestCard = null;
        let closestDistance = Infinity;

        flipCards.forEach((card, index) => {
            const cardRect = card.getBoundingClientRect();
            const cardCenter = cardRect.left + cardRect.width / 2;
            const distanceFromCenter = Math.abs(cardCenter - containerCenter);

            // Check if this card is at least 50% visible
            const overlapLeft = Math.max(containerRect.left, cardRect.left);
            const overlapRight = Math.min(containerRect.right, cardRect.right);
            const visibleWidth = Math.max(0, overlapRight - overlapLeft);

            // Only consider cards that are at least 50% visible and closer than current closest
            if (visibleWidth / cardRect.width >= 0.5 && distanceFromCenter < closestDistance) {
                closestCard = index;
                closestDistance = distanceFromCenter;
            }
        });

        // Only update if we found a card and it's significantly closer to center (at least 20px)
        // or if it's very close to center (within 50px)
        if (closestCard !== null) {
            const currentActiveCard = flipCards[CardSystem.activeCardIndex];
            const currentActiveRect = currentActiveCard.getBoundingClientRect();
            const currentActiveCenter = currentActiveRect.left + currentActiveRect.width / 2;
            const currentActiveDistance = Math.abs(currentActiveCenter - containerCenter);

            if (closestDistance < 50 || (currentActiveDistance - closestDistance) > 20) {
                // Update active card index
                CardSystem.activeCardIndex = closestCard;

                // Use the updateUI method which will properly update the dots
                CardSystem.updateUI();
            }
        }
    }

    // Create a throttled version for smoother dot updates
    const updateActiveCardDuringScrollThrottled = throttle(() => {
        updateActiveCardDuringScroll();
    }, 120); // 120ms throttle provides a good balance

    // Add this function to handle grace period timing for off-center flipped cards
    function manageFlippedCardGracePeriod(cardIndex) {
        // Clear any existing timer
        if (unflipGraceTimer) {
            clearTimeout(unflipGraceTimer);
            unflipGraceTimer = null;
        }

        // If we have a flipped card and it's not centered, start the grace timer
        if (CardSystem.currentlyFlippedCard) {
            const containerRect = container.getBoundingClientRect();
            const containerCenter = containerRect.left + containerRect.width / 2;
            const cardRect = CardSystem.currentlyFlippedCard.getBoundingClientRect();
            const cardCenter = cardRect.left + cardRect.width / 2;
            const isCardCentered = Math.abs(cardCenter - containerCenter) < 20; // Within 20px of center

            if (!isCardCentered) {
                // Card is flipped but not centered - start grace period
                unflipGraceTimer = setTimeout(() => {
                    // After grace period, check if the card is still not centered
                    if (CardSystem.currentlyFlippedCard) {
                        const newContainerRect = container.getBoundingClientRect();
                        const newContainerCenter = newContainerRect.left + newContainerRect.width / 2;
                        const newCardRect = CardSystem.currentlyFlippedCard.getBoundingClientRect();
                        const newCardCenter = newCardRect.left + newCardRect.width / 2;
                        const isCardCenteredNow = Math.abs(newCardCenter - newContainerCenter) < 20;

                        // Only unflip if the card is still not centered after grace period
                        if (!isCardCenteredNow) {
                            CardSystem.resetFlippedCard();
                            toggleLogoVisibility(true);
                        }
                    }
                    unflipGraceTimer = null;
                }, 500); // 500ms grace period
            }
        }
    }

    // Modify ensureProperCardStates to use our grace period manager
    function ensureProperCardStates() {
        // We'll use our new grace period manager instead
        // Only check for specific conditions like visibility
        if (CardSystem.currentlyFlippedCard) {
            const containerRect = container.getBoundingClientRect();
            const cardRect = CardSystem.currentlyFlippedCard.getBoundingClientRect();
            const cardIndex = Array.from(flipCards).indexOf(CardSystem.currentlyFlippedCard);

            // Check if the flipped card is visible in the viewport
            const isVisible = cardRect.right > containerRect.left && cardRect.left < containerRect.right;

            // If card is completely invisible, reset it immediately without grace period
            if (!isVisible && cardIndex !== CardSystem.activeCardIndex) {
                CardSystem.resetFlippedCard();
                toggleLogoVisibility(true);

                // Clear any grace timer
                if (unflipGraceTimer) {
                    clearTimeout(unflipGraceTimer);
                    unflipGraceTimer = null;
                }
            } else {
                // Card is visible but might not be centered - manage grace period
                manageFlippedCardGracePeriod(cardIndex);
            }
        }
    }

    // Simplified scroll detection function that just updates active card without recentering
    function detectScrollAnimationEnd() {
        // Clear any existing detection
        clearTimeout(scrollAnimationTimeout);
        clearInterval(scrollPositionCheckInterval);

        // Don't start new detection if manually flipping
        if (CardSystem.isManuallyFlipping) return;

        // Mark that we're in an animation
        isScrollAnimationActive = true;

        // Just update the active card immediately
        updateActiveCardDuringScroll();

        // Backup timeout to mark animation as complete
        scrollAnimationTimeout = setTimeout(() => {
        isScrollAnimationActive = false;
        isScrollMomentumActive = false;
        }, 300);
    }

    // Helper function to ensure visual updates complete before scrolling
    function updateCardVisualsThenScroll(newIndex) {
        // 1. Update the active index
        CardSystem.activeCardIndex = newIndex;

        // 2. Immediately update visual appearance of all cards
        flipCards.forEach((card, index) => {
            card.style.opacity = (index === newIndex) ? '1' : '0.7';
        });

        // 3. Update dot indicators
        updateDotIndicatorsDirectly(newIndex);

        // 4. Force a reflow to ensure visual changes are applied before scroll starts
        // This is crucial - it forces the browser to apply the visual changes immediately
        void document.body.offsetHeight;

        // 5. Now start the scroll animation, after visual updates are guaranteed to be rendered
        scrollToCard(newIndex, false);
    }

    // Keyboard navigation function
    function handleKeyboardNavigation(e) {
        // Check if overlay is open - if so, don't handle keyboard navigation
        const overlay = document.querySelector('.hamburger-overlay');
        if (overlay && overlay.style.display !== 'none') {
            return; // Let the overlay handle keyboard events
        }

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            // Calculate new index based on key pressed - skip filtered cards
            let newIndex = CardSystem.activeCardIndex;
            if (e.key === 'ArrowLeft') {
                newIndex = CardSystem.findPrevVisibleIndex(CardSystem.activeCardIndex);
            } else if (e.key === 'ArrowRight') {
                newIndex = CardSystem.findNextVisibleIndex(CardSystem.activeCardIndex);
            }

            // Only proceed if we found a valid visible card
            if (newIndex === CardSystem.activeCardIndex) {
                return; // No next/prev visible card found
            }

            // Clear the long swipe timeout to prevent the race condition
            clearTimeout(longSwipeTimeout);

            // Also reset the manual flipping flag immediately
            CardSystem.isManuallyFlipping = false;

            // Reset any flipped card
            if (CardSystem.currentlyFlippedCard) {
                CardSystem.resetFlippedCard();
                toggleLogoVisibility(true);
            }

            // IMMEDIATELY update the active card index
            CardSystem.activeCardIndex = newIndex;

            // Rest of the code remains the same...
            flipCards.forEach((card, index) => {
                card.classList.toggle('active', index === newIndex);
                card.style.opacity = index === newIndex ? '1' : '0.65';
            });

            updateDotIndicatorsDirectly(newIndex);

            container.style.scrollBehavior = 'auto';

            const targetCard = flipCards[newIndex];
            const containerCenter = container.offsetWidth / 2;
            const cardCenter = targetCard.offsetWidth / 2;
            const scrollPosition = targetCard.offsetLeft - containerCenter + cardCenter;

            container.scrollLeft = scrollPosition;

            e.preventDefault();
            return;
        }

        // First check if we're handling a key during scroll momentum
        if (handleKeyDuringScrollMomentum(e)) {
            return;
        }

        const now = Date.now();
        const isRapidKeyPress = (now - lastKeyPressTime) < rapidKeyPressThreshold;
        lastKeyPressTime = now;

        if ((e.key === 'Enter' || e.key === ' ')) {
            // Set activation source for spacebar/enter
            lastCardActivationSource = 'key';

            // Prevent default space scrolling behavior
            e.preventDefault();

            // Find the most visible card
            const containerRect = container.getBoundingClientRect();
            const containerCenter = containerRect.left + containerRect.width / 2;

            let bestVisibleCard = CardSystem.activeCardIndex;
            let bestVisibleDistance = Infinity;

            flipCards.forEach((card, index) => {
                const cardRect = card.getBoundingClientRect();
                const cardCenter = cardRect.left + cardRect.width / 2;
                const distance = Math.abs(cardCenter - containerCenter);

                if (distance < bestVisibleDistance) {
                    bestVisibleCard = index;
                    bestVisibleDistance = distance;
                }
            });

            const targetCard = flipCards[bestVisibleCard];

            // Skip if not significantly visible
            const cardRect = targetCard.getBoundingClientRect();
            const cardCenter = cardRect.left + cardRect.width / 2;
            const overlapLeft = Math.max(containerRect.left, cardRect.left);
            const overlapRight = Math.min(containerRect.right, cardRect.right);
            const visibleWidth = Math.max(0, overlapRight - overlapLeft);
            const isCardCentered = Math.abs(cardCenter - containerCenter) < 20; // Within 20px of center

            if (visibleWidth / cardRect.width < 0.3) {
                return; // Not visible enough to act on
            }

            // Clear any pending long swipe timeout
            clearTimeout(longSwipeTimeout);

            // Set manual flipping flag
            CardSystem.isManuallyFlipping = true;

            // Clear any scroll timeouts
            clearTimeout(scrollEndTimeout);

            // Force stop all animations for immediate response
            forceStopAllAnimations();

            const shouldFlip = !targetCard.classList.contains('flipped');

            // Add logo visibility toggle
            if (shouldFlip) {
                toggleLogoVisibility(false);
            } else {
                toggleLogoVisibility(true);
            }

            // Update active card index if needed
            CardSystem.activeCardIndex = bestVisibleCard;
            CardSystem.updateUI();

            // Handle any previously flipped card
            if (CardSystem.currentlyFlippedCard && CardSystem.currentlyFlippedCard !== targetCard) {
                CardSystem.resetFlippedCard();
            }

            // Restore animations first
            restoreAnimations();

            if (shouldFlip) {
                // Force a reflow between operations
                CardSystem.adjustCardHeight(targetCard, true);
                void targetCard.offsetWidth; // Force reflow
                targetCard.classList.add('flipped');
                CardSystem.currentlyFlippedCard = targetCard;

                // IMPROVEMENT: If card is not centered, wait for momentum to settle then center it
                if (!isCardCentered && isScrollMomentumActive) {
                    // Function to check if scroll momentum has settled
                    const checkForMomentumEnd = () => {
                        // If we're no longer in momentum state or if it's been a while, center the card
                        if (!isScrollMomentumActive || Date.now() - lastWheelEventTime > 300) {
                            // Momentum has ended, center the card
                            centerCardForPC(bestVisibleCard);
                            clearInterval(momentumCheckInterval);
                        }
                    };

                    // Check every 100ms if momentum has settled
                    const momentumCheckInterval = setInterval(checkForMomentumEnd, 100);

                    // Set a backup timeout to ensure we don't wait forever (max 1 second)
                    setTimeout(() => {
                        clearInterval(momentumCheckInterval);
                        centerCardForPC(bestVisibleCard);
                    }, 1000);
                } else if (!isCardCentered) {
                    // No active momentum, so center after a slight delay
                    setTimeout(() => {
                        centerCardForPC(bestVisibleCard);
                    }, 200);
                }
            } else {
                // Unflipping
                void targetCard.offsetWidth; // Force reflow
                targetCard.classList.remove('flipped');
                CardSystem.adjustCardHeight(targetCard, false);
                CardSystem.currentlyFlippedCard = null;
            }

            // Reset manual flipping flag after a delay
            longSwipeTimeout = setTimeout(() => {
                CardSystem.isManuallyFlipping = false;
            }, 500);
        }
    }

    // Functions to manage keyboard event handlers for overlay compatibility
    function detachKeyboardHandlers() {
        document.removeEventListener('keydown', handleKeyboardNavigation);
        console.log("Keyboard navigation handlers detached for overlay");
    }

    function attachKeyboardHandlers() {
        // Only attach if not already attached
        document.removeEventListener('keydown', handleKeyboardNavigation);
        document.addEventListener('keydown', handleKeyboardNavigation);
        console.log("Keyboard navigation handlers reattached after overlay closed");
    }

    // Expose these functions for hamburger overlay to use
    window.CardSystem.detachKeyboardHandlers = detachKeyboardHandlers;
    window.CardSystem.attachKeyboardHandlers = attachKeyboardHandlers;

    // Modify the scroll event handler to use grace period instead of immediate unflipping
    container.addEventListener('scroll', () => {
        if (CardSystem.isFiltering) return;
        // Don't interfere with manual flipping
        if (CardSystem.isManuallyFlipping) return;

        // Set activation source for scroll
        lastCardActivationSource = 'scroll';

        // Clear any previous timeout
        clearTimeout(scrollEndTimeout);

        // Track that we're scrolling
        isScrolling = true;

        // Update active card during scroll using throttled function
        updateActiveCardDuringScrollThrottled();

        // Mark scrolling as complete after brief delay
        scrollEndTimeout = setTimeout(() => {
            isScrolling = false;

            // Final update
            if (!CardSystem.isManuallyFlipping) {
                updateActiveCardDuringScroll();

                // Instead of immediately ensuring proper card states,
                // just manage the grace period for any flipped card
                if (CardSystem.currentlyFlippedCard) {
                    const cardIndex = Array.from(flipCards).indexOf(CardSystem.currentlyFlippedCard);
                    manageFlippedCardGracePeriod(cardIndex);
                }
            }
        }, 150);

        // Update logo visibility if needed
        if (CardSystem.currentlyFlippedCard) {
            // Check if we need to update visibility
            const containerRect = container.getBoundingClientRect();
            const cardRect = CardSystem.currentlyFlippedCard.getBoundingClientRect();
            const isVisible = cardRect.right > containerRect.left && cardRect.left < containerRect.right;

            if (!isVisible) {
                // Card scrolled completely out of view, reset it immediately
                CardSystem.resetFlippedCard();
                toggleLogoVisibility(true);

                // Clear any grace timer
                if (unflipGraceTimer) {
                    clearTimeout(unflipGraceTimer);
                    unflipGraceTimer = null;
                }
            }
        }
    }, { passive: true });

    // Simplified wheel event handler
    container.addEventListener('wheel', (e) => {
        if (CardSystem.isFiltering) return;
        // This is definitely a manual user scroll
        lastCardActivationSource = 'scroll';

        isUserActivelyScrolling = true;
        isScrollMomentumActive = true;
        lastWheelEventTime = Date.now();

        clearTimeout(wheelMomentumTimeout);
        clearTimeout(userScrollTimeout);

        userScrollTimeout = setTimeout(() => {
            isUserActivelyScrolling = false;
        }, 150);

        wheelMomentumTimeout = setTimeout(() => {
            if (Date.now() - lastWheelEventTime >= 150) {
                isScrollMomentumActive = false;
            }
        }, 200);
    }, { passive: true });

    // Initialize with smooth scrolling
    function initSmoothScrolling() {
        // Set smooth scrolling style
        container.style.scrollBehavior = 'smooth';

        // Make sure cards have proper transitions
        flipCards.forEach(card => {
            card.style.transition = 'transform 0.3s ease-out';
        });

        // Initialize scrolling to first card
        scrollToCard(0);
        CardSystem.updateUI();
    }

    // Modify handleKeyDuringScrollMomentum to set proper source
    function handleKeyDuringScrollMomentum(e) {
        // Only handle spacebar and enter during scroll momentum
        if ((e.key === 'Enter' || e.key === ' ') && isScrollMomentumActive) {
            // Mark this as a key activation, not a scroll activation
            lastCardActivationSource = 'key';

            e.preventDefault();

            // Find which card is most visible at this moment
            const containerRect = container.getBoundingClientRect();
            const containerCenter = containerRect.left + containerRect.width / 2;

            let bestVisibleCard = null;
            let bestVisibleDistance = Infinity;

            flipCards.forEach((card, index) => {
                const cardRect = card.getBoundingClientRect();
                const cardCenter = cardRect.left + cardRect.width / 2;
                const distance = Math.abs(cardCenter - containerCenter);

                // If this card is more centered than our current best
                if (distance < bestVisibleDistance) {
                    bestVisibleCard = index;
                    bestVisibleDistance = distance;
                }
            });

            // If we found a visible card, flip it immediately without interrupting momentum
            if (bestVisibleCard !== null) {
                const targetCard = flipCards[bestVisibleCard];

                // Update active card index without recentering
                CardSystem.activeCardIndex = bestVisibleCard;
                CardSystem.updateUI();

                // Force stop all animations for immediate response
                forceStopAllAnimations();

                // Set manual flipping flag
                CardSystem.isManuallyFlipping = true;

                // Reset any previously flipped card
                if (CardSystem.currentlyFlippedCard && CardSystem.currentlyFlippedCard !== targetCard) {
                    CardSystem.resetFlippedCard();
                }

                // Flip the card
                const shouldFlip = !targetCard.classList.contains('flipped');

                // Restore animations for smooth flipping
                restoreAnimations();

                if (shouldFlip) {
                    // Expand and flip
                    CardSystem.adjustCardHeight(targetCard, true);
                    targetCard.classList.add('flipped');
                    CardSystem.currentlyFlippedCard = targetCard;
                    toggleLogoVisibility(false);
                } else {
                    // Unflip
                    targetCard.classList.remove('flipped');
                    CardSystem.adjustCardHeight(targetCard, false);
                    CardSystem.currentlyFlippedCard = null;
                    toggleLogoVisibility(true);
                }

                // Reset manual flipping flag
                setTimeout(() => {
                    CardSystem.isManuallyFlipping = false;
                }, 500);
            }

            return true; // Signal that we handled this event
        }

        return false; // We didn't handle this event
    }

    // Add these new functions at an appropriate location
    function smoothTransitionDotIndicators() {
        const dots = document.querySelectorAll('.indicator-dot');
        dots.forEach(dot => {
            dot.style.transition = 'transform 0.2s ease-out, background-color 0.3s ease-out';
        });
    }

    function updateDotIndicatorsDirectly(activeIndex) {
        const dots = document.querySelectorAll('.indicator-dot');

        dots.forEach((dot, index) => {
            if (index === activeIndex) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    // Add this function near the other utility functions
    function addCardOpacityTransitions() {
        // Add transition for opacity to all cards
        flipCards.forEach(card => {
            card.style.transition = `${card.style.transition || ''}, opacity 0.4s cubic-bezier(0.25, 0.1, 0.25, 1.0)`;
            // Initialize opacity (non-active cards will be slightly faded)
            card.style.opacity = (Array.from(flipCards).indexOf(card) === CardSystem.activeCardIndex) ? '1' : '0.7';
        });
    }

    // Modify the CardSystem.updateUI override to include opacity transitions
    const originalUpdateUI = CardSystem.updateUI;
    CardSystem.updateUI = function(skipDotUpdate = false) {
        // Update opacity for all cards
        flipCards.forEach((card, index) => {
            // Use a consistent transition time for both activating and deactivating
            card.style.opacity = (index === this.activeCardIndex) ? '1' : '0.7';
        });

        // Call original updateUI but don't update dots if we're handling it separately
        if (skipDotUpdate) {
            // Temporarily store the real update dots function
            const originalUpdateDots = this.updateDotIndicators;

            // Replace with empty function
            this.updateDotIndicators = function() {};

            // Call original update UI
            originalUpdateUI.call(this);

            // Restore original dot update function
            this.updateDotIndicators = originalUpdateDots;
        } else {
            originalUpdateUI.call(this);
        }
    };

    // Smooth scrolling dot indicator update with animation frame control
    let lastScrollDotUpdateTime = 0;
    let pendingDotUpdate = null;
    const DOT_UPDATE_INTERVAL = 100; // Minimum milliseconds between dot updates

    function updateDotIndicatorsSmoothly() {
        // Don't update if manually flipping
        if (CardSystem.isManuallyFlipping) return;

        const now = Date.now();

        // If we have a pending update and it's too soon for another, just return
        if (pendingDotUpdate && now - lastScrollDotUpdateTime < DOT_UPDATE_INTERVAL) {
            return;
        }

        // Clear any pending update
        if (pendingDotUpdate) {
            cancelAnimationFrame(pendingDotUpdate);
            pendingDotUpdate = null;
        }

        // Schedule update for next frame
        pendingDotUpdate = requestAnimationFrame(() => {
            const containerRect = container.getBoundingClientRect();
            const containerCenter = containerRect.left + containerRect.width / 2;

            // Find the card closest to center
            let closestCard = null;
            let closestDistance = Infinity;

            flipCards.forEach((card, index) => {
                const cardRect = card.getBoundingClientRect();
                const cardCenter = cardRect.left + cardRect.width / 2;
                const distanceFromCenter = Math.abs(cardCenter - containerCenter);

                // Check if this card is sufficiently visible
                const overlapLeft = Math.max(containerRect.left, cardRect.left);
                const overlapRight = Math.min(containerRect.right, cardRect.right);
                const visibleWidth = Math.max(0, overlapRight - overlapLeft);

                if (visibleWidth / cardRect.width >= 0.4 && distanceFromCenter < closestDistance) {
                    closestCard = index;
                    closestDistance = distanceFromCenter;
                }
            });

            if (closestCard !== null && closestCard !== CardSystem.activeCardIndex) {
                // Update internal state
                CardSystem.activeCardIndex = closestCard;

                // Only update the dot indicators, not the cards
                updateDotIndicatorsDirectly(closestCard);
            }

            pendingDotUpdate = null;
            lastScrollDotUpdateTime = Date.now();
        });
    }

    // Initialize smooth dot transitions
    function initSmoothDotTransitions() {
        smoothTransitionDotIndicators();
        console.log("Smooth dot indicator transitions initialized");
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

    // Call during initialization
    document.addEventListener('DOMContentLoaded', initLogoVisibility);

    // Override the card height adjustment method to prevent scrollbars when deflipping
    const originalAdjustCardHeight = CardSystem.adjustCardHeight;
    CardSystem.adjustCardHeight = function(card, setHeight = false) {
        // Only apply special handling when deflipping (when height goes from high to low)
        if (!setHeight) {
            // Store current document state
            const htmlStyle = document.documentElement.style.overflow;
            const bodyStyle = document.body.style.overflow;

            // Apply overflow:hidden to prevent scrollbar
            document.documentElement.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';

            // Call original method to perform height adjustment
            originalAdjustCardHeight.call(this, card, setHeight);

            // Restore the original overflow settings after a slight delay
            setTimeout(() => {
                document.documentElement.style.overflow = htmlStyle;
                document.body.style.overflow = bodyStyle;
            }, 400); // Match transition time
        } else {
            // For expanding cards, just use the original method
            originalAdjustCardHeight.call(this, card, setHeight);
        }
    };

    // Initialize desktop-specific features
    addNavigationArrows();
    initSmoothScrolling();
    initSmoothDotTransitions();
    addCardOpacityTransitions();

    // Attach keyboard handlers
    attachKeyboardHandlers();

    console.log("iPod-style cover flow initialized");

    // Initial positioning
    updateLogoPosition();

    // Add event listeners for responsive positioning
    // window.addEventListener('resize', updateLogoPosition);
    // window.addEventListener('orientationchange', updateLogoPosition);
    window.CardSystem.scrollToCard = scrollToCard;
})();