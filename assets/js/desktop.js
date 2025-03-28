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

    // Constants
    const rapidKeyPressThreshold = 300; // ms
    const SCROLL_STABILITY_THRESHOLD = 3; // Number of stable position checks needed

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

            // Immediate index update
            CardSystem.activeCardIndex = index;
            CardSystem.updateUI();

            // Direct scrolling to the card
            const targetCard = flipCards[index];
            const containerCenter = container.offsetWidth / 2;
            const cardCenter = targetCard.offsetWidth / 2;
            container.scrollLeft = targetCard.offsetLeft - containerCenter + cardCenter;
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
            if (CardSystem.activeCardIndex > 0) {
                // Cancel all animations and scrolling
                container.style.scrollBehavior = 'auto';
                isScrolling = false;
                clearTimeout(scrollEndTimeout);
                clearTimeout(longSwipeTimeout);

                // Immediate index update
                CardSystem.activeCardIndex--;
                CardSystem.updateUI();

                // Direct scrolling to the card
                const targetCard = flipCards[CardSystem.activeCardIndex];
                const containerCenter = container.offsetWidth / 2;
                const cardCenter = targetCard.offsetWidth / 2;
                container.scrollLeft = targetCard.offsetLeft - containerCenter + cardCenter;
            }
        });

        navRight.addEventListener('click', () => {
            if (CardSystem.activeCardIndex < flipCards.length - 1) {
                // Cancel all animations and scrolling
                container.style.scrollBehavior = 'auto';
                isScrolling = false;
                clearTimeout(scrollEndTimeout);
                clearTimeout(longSwipeTimeout);

                // Immediate index update
                CardSystem.activeCardIndex++;
                CardSystem.updateUI();

                // Direct scrolling to the card
                const targetCard = flipCards[CardSystem.activeCardIndex];
                const containerCenter = container.offsetWidth / 2;
                const cardCenter = targetCard.offsetWidth / 2;
                container.scrollLeft = targetCard.offsetLeft - containerCenter + cardCenter;
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

    // Scroll to card function for desktop
    function scrollToCard(index, andFlip = false) {
        if (index < 0 || index >= flipCards.length || (index === CardSystem.activeCardIndex && !andFlip)) return;

        const cardToScrollTo = flipCards[index];

        // Force stop all animations for immediate response
        forceStopAllAnimations();

        // Reset any flipped card if we're not planning to flip this one
        if (CardSystem.currentlyFlippedCard && (!andFlip || CardSystem.currentlyFlippedCard !== cardToScrollTo)) {
            CardSystem.resetFlippedCard();
        }

        // Update active card index
        CardSystem.activeCardIndex = index;
        CardSystem.updateUI();

        // Enable smooth scrolling
        container.style.scrollBehavior = 'smooth';
        container.dataset.isSnappingBack = 'true';

        // Use the PC-specific centering function
        centerCardForPC(index);

        // Handle flipping if needed
        if (andFlip) {
            longSwipeTimeout = setTimeout(() => {
                CardSystem.adjustCardHeight(cardToScrollTo, true);
                cardToScrollTo.classList.add('flipped');
                CardSystem.currentlyFlippedCard = cardToScrollTo;
            }, 400); // Wait for scroll to complete
        }

        // Mark scrolling as done after animation completes
        setTimeout(() => {
            isScrolling = false;
            container.dataset.isSnappingBack = 'false';
            CardSystem.updateUI(); // Update UI after snap-back is complete
            restoreAnimations();
        }, 500);
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
    }

    // Update active card during scroll
    function updateActiveCardDuringScroll() {
        // Don't update if manually flipping
        if (CardSystem.isManuallyFlipping) return;

        const containerRect = container.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;

        // For each card, calculate how much is visible and its distance from center
        flipCards.forEach((card, index) => {
            const cardRect = card.getBoundingClientRect();
            const cardCenter = cardRect.left + cardRect.width / 2;
            const distanceFromCenter = Math.abs(cardCenter - containerCenter);

            // Calculate intersection/overlap with container
            const overlapLeft = Math.max(containerRect.left, cardRect.left);
            const overlapRight = Math.min(containerRect.right, cardRect.right);
            const visibleWidth = Math.max(0, overlapRight - overlapLeft);

            // If 30% or more is visible AND it's closer to center than current active card
            if (visibleWidth / cardRect.width >= 0.3) {
                const currentActiveCard = flipCards[CardSystem.activeCardIndex];
                const currentActiveRect = currentActiveCard.getBoundingClientRect();
                const currentActiveCenter = currentActiveRect.left + currentActiveRect.width / 2;
                const currentActiveDistance = Math.abs(currentActiveCenter - containerCenter);

                if (distanceFromCenter < currentActiveDistance) {
                    // Update active card index
                    const previousActiveIndex = CardSystem.activeCardIndex;
                    CardSystem.activeCardIndex = index;

                    // If we have a flipped card, only unflip it when a DIFFERENT card becomes active
                    if (CardSystem.currentlyFlippedCard &&
                        CardSystem.currentlyFlippedCard !== card &&
                        Array.from(flipCards).indexOf(CardSystem.currentlyFlippedCard) !== index) {
                        CardSystem.resetFlippedCard();
                    }

                    CardSystem.updateUI();
                }
            }
        });
    }

    // Ensure all inactive cards are unflipped
    function ensureProperCardStates() {
        // Only reset flipped cards if they're not the active card AND not visible in the viewport
        if (CardSystem.currentlyFlippedCard) {
            const containerRect = container.getBoundingClientRect();
            const cardRect = CardSystem.currentlyFlippedCard.getBoundingClientRect();
            const cardIndex = Array.from(flipCards).indexOf(CardSystem.currentlyFlippedCard);

            // Check if the flipped card is visible in the viewport
            const isVisible = cardRect.right > containerRect.left && cardRect.left < containerRect.right;

            // Only reset if the card is not visible AND not the active card
            if (!isVisible && cardIndex !== CardSystem.activeCardIndex) {
                CardSystem.resetFlippedCard();
            }
        }
    }

    // Desktop card click handler
    flipCards.forEach((card, index) => {
        card.addEventListener('click', function(e) {
            // Skip link clicks
            if (e.target.tagName === 'A') return;

            // Skip if dragging
            if (e.clientX && this.dataset.mouseDownX) {
                const dragDistance = Math.abs(e.clientX - parseInt(this.dataset.mouseDownX));
                if (dragDistance > 5) return;
            }

            // Clear any pending long swipe timeout
            clearTimeout(longSwipeTimeout);

            // Set manual flipping flag
            CardSystem.isManuallyFlipping = true;

            // Clear any scroll timeouts
            clearTimeout(scrollEndTimeout);

            // Force stop all animations for immediate response
            forceStopAllAnimations();

            const shouldFlip = !this.classList.contains('flipped');

            if (!this.classList.contains('active')) {
                // If not active, center it first, then handle flipping
                CardSystem.activeCardIndex = index;
                CardSystem.updateUI();

                // Use our PC-specific centering function
                centerCardForPC(index);

                // After scroll animation completes, handle flipping if needed
                longSwipeTimeout = setTimeout(() => {
                    if (shouldFlip) {
                        // Handle any previously flipped card
                        if (CardSystem.currentlyFlippedCard && CardSystem.currentlyFlippedCard !== this) {
                            CardSystem.resetFlippedCard();
                        }

                        // First restore animations to ensure transitions work
                        restoreAnimations();

                        // Wait a tiny bit for animations to be restored
                        setTimeout(() => {
                            // Expand and flip with forced reflow
                            CardSystem.adjustCardHeight(this, true);
                            void this.offsetWidth; // Force reflow
                            this.classList.add('flipped');
                            CardSystem.currentlyFlippedCard = this;
                        }, 10);
                    }

                    CardSystem.isManuallyFlipping = false;
                }, 400);
            } else {
                // Already active, just handle flipping
                if (CardSystem.currentlyFlippedCard && CardSystem.currentlyFlippedCard !== this) {
                    CardSystem.resetFlippedCard();
                }

                // Restore animations first
                restoreAnimations();

                if (shouldFlip) {
                    // Force a reflow between operations
                    CardSystem.adjustCardHeight(this, true);
                    void this.offsetWidth; // Force reflow
                    this.classList.add('flipped');
                    CardSystem.currentlyFlippedCard = this;
                } else {
                    // Force a reflow between operations
                    void this.offsetWidth; // Force reflow
                    this.classList.remove('flipped');
                    CardSystem.adjustCardHeight(this, false);
                    CardSystem.currentlyFlippedCard = null;
                }

                // Reset manual flipping flag after a delay
                longSwipeTimeout = setTimeout(() => {
                    CardSystem.isManuallyFlipping = false;
                }, 500);
            }
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

    // Detect scroll animation end
    function detectScrollAnimationEnd() {
        // Clear any existing detection
        clearTimeout(scrollAnimationTimeout);
        clearInterval(scrollPositionCheckInterval);

        // Don't start new detection if manually flipping or recentering
        if (CardSystem.isManuallyFlipping || isRecentering) return;

        // Mark that we're in an animation
        isScrollAnimationActive = true;
        lastScrollPosition = container.scrollLeft;

        // Check scroll position frequently
        scrollPositionCheckInterval = setInterval(() => {
            const currentScrollPosition = container.scrollLeft;

            // If scroll position hasn't changed significantly
            if (Math.abs(currentScrollPosition - lastScrollPosition) < 0.5) {
                finishScrollAnimation();
            }

            lastScrollPosition = currentScrollPosition;
        }, 50); // Check every 50ms

        // Backup timeout - don't wait too long
        scrollAnimationTimeout = setTimeout(() => {
            finishScrollAnimation();
        }, 300); // Maximum wait time of 300ms
    }

    // Finish scroll animation
    function finishScrollAnimation() {
        // Prevent multiple calls
        if (!isScrollAnimationActive || isRecentering) return;

        // Clean up timers
        clearInterval(scrollPositionCheckInterval);
        clearTimeout(scrollAnimationTimeout);
        clearTimeout(wheelMomentumTimeout);

        // Mark animation as complete
        isScrollAnimationActive = false;
        isScrollMomentumActive = false;

        // Don't recenter if user is still actively scrolling
        if (isUserActivelyScrolling) return;

        // Find the card closest to center
        const containerRect = container.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;
        let closestCardIndex = CardSystem.activeCardIndex;
        let closestDistance = Infinity;

        flipCards.forEach((card, index) => {
            const cardRect = card.getBoundingClientRect();
            const cardCenter = cardRect.left + cardRect.width / 2;
            const distance = Math.abs(cardCenter - containerCenter);

            if (distance < closestDistance) {
                closestDistance = distance;
                closestCardIndex = index;
            }
        });

        // Only recenter if needed
        if (closestCardIndex !== CardSystem.activeCardIndex || closestDistance > 30) {
            isRecentering = true;

            // Update active card
            CardSystem.activeCardIndex = closestCardIndex;
            CardSystem.updateUI();

            // Quick smooth scroll to center
            container.style.scrollBehavior = 'smooth';
            const targetCard = flipCards[closestCardIndex];
            const containerWidth = container.offsetWidth;
            const containerCenter = containerWidth / 2;
            const cardCenter = targetCard.offsetWidth / 2;
            const scrollPosition = targetCard.offsetLeft - containerCenter + cardCenter;

            requestAnimationFrame(() => {
                container.scrollLeft = scrollPosition;
            });

            // Reset recentering flag quickly
            setTimeout(() => {
                isRecentering = false;
                container.style.scrollBehavior = 'smooth';
                ensureProperCardStates();
            }, 200);
        } else {
            ensureProperCardStates();
        }
    }

    // Handle key during scroll momentum
    function handleKeyDuringScrollMomentum(e) {
        // Only handle spacebar and enter during scroll momentum
        if ((e.key === 'Enter' || e.key === ' ') && isScrollMomentumActive) {
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

            // If we found a visible card, remember it
            if (bestVisibleCard !== null) {
                // Store the card we want to flip
                const targetCardIndex = bestVisibleCard;

                // Let momentum finish naturally
                setTimeout(() => {
                    // Use scrollToCard which properly centers and activates the card
                    scrollToCard(targetCardIndex, false);

                    // After scrollToCard completes, flip it
                    setTimeout(() => {
                        // Get the target card
                        const targetCard = flipCards[targetCardIndex];

                        // Verify this is the active card before flipping
                        if (CardSystem.activeCardIndex === targetCardIndex) {
                            // Set manual flipping flag
                            CardSystem.isManuallyFlipping = true;

                            // Reset any previously flipped card
                            if (CardSystem.currentlyFlippedCard && CardSystem.currentlyFlippedCard !== targetCard) {
                                CardSystem.resetFlippedCard();
                            }

                            // Flip the card
                            const shouldFlip = !targetCard.classList.contains('flipped');

                            if (shouldFlip) {
                                // Expand and flip
                                CardSystem.adjustCardHeight(targetCard, true);
                                targetCard.classList.add('flipped');
                                CardSystem.currentlyFlippedCard = targetCard;
                            } else {
                                // Unflip
                                targetCard.classList.remove('flipped');
                                CardSystem.adjustCardHeight(targetCard, false);
                                CardSystem.currentlyFlippedCard = null;
                            }

                            // Reset manual flipping flag
                            setTimeout(() => {
                                CardSystem.isManuallyFlipping = false;
                            }, 500);
                        }
                    }, 600); // Wait for scrollToCard to complete
                }, 500); // Wait for momentum to finish
            }

            return true; // Signal that we handled this event
        }

        return false; // We didn't handle this event
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        // First check if we're handling a key during scroll momentum
        if (handleKeyDuringScrollMomentum(e)) {
            return;
        }

        const now = Date.now();
        const isRapidKeyPress = (now - lastKeyPressTime) < rapidKeyPressThreshold;
        lastKeyPressTime = now;

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            // Prevent multiple rapid keypresses during arrow animation
            if (isScrollAnimationActive) return;

            // Calculate new index based on key pressed
            let newIndex = CardSystem.activeCardIndex;
            if (e.key === 'ArrowLeft' && CardSystem.activeCardIndex > 0) {
                newIndex = CardSystem.activeCardIndex - 1;
            } else if (e.key === 'ArrowRight' && CardSystem.activeCardIndex < flipCards.length - 1) {
                newIndex = CardSystem.activeCardIndex + 1;
            } else {
                return;
            }

            // Mark that we're doing an arrow key animation
            isScrollAnimationActive = true;

            // Update index immediately
            CardSystem.activeCardIndex = newIndex;
            CardSystem.updateUI();

            // Quick sliding animation just for arrow keys
            const targetCard = flipCards[newIndex];
            const containerCenter = container.offsetWidth / 2;
            const cardCenter = targetCard.offsetWidth / 2;
            const targetScroll = targetCard.offsetLeft - containerCenter + cardCenter;

            // Use requestAnimationFrame for smooth animation
            const startScroll = container.scrollLeft;
            const distance = targetScroll - startScroll;
            const duration = 1; // Reduced from 150ms to 100ms
            const startTime = performance.now();

            function animate(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Linear animation for faster response
                container.scrollLeft = startScroll + (distance * progress);

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    // Animation complete - allow next arrow key immediately
                    isScrollAnimationActive = false;
                }
            }

            requestAnimationFrame(animate);
        } else if ((e.key === 'Enter' || e.key === ' ')) {
            // Prevent default space scrolling behavior
            e.preventDefault();

            // If we're in momentum scrolling, let handleKeyDuringScrollMomentum handle it
            if (isScrollMomentumActive) {
                return;
            }

            // Force center the active card
            const targetCard = flipCards[CardSystem.activeCardIndex];

            // Make centering immediate
            container.style.scrollBehavior = 'auto';
            isScrolling = false;
            clearTimeout(scrollEndTimeout);

            // Force correct position
            const containerCenter = container.offsetWidth / 2;
            const cardCenter = targetCard.offsetWidth / 2;
            container.scrollLeft = targetCard.offsetLeft - containerCenter + cardCenter;

            // Flip the card
            CardSystem.isManuallyFlipping = true;

            const shouldFlip = !targetCard.classList.contains('flipped');

            // Reset any previously flipped card
            if (CardSystem.currentlyFlippedCard && CardSystem.currentlyFlippedCard !== targetCard) {
                CardSystem.resetFlippedCard();
            }

            if (shouldFlip) {
                // Expand and flip
                CardSystem.adjustCardHeight(targetCard, true);
                targetCard.classList.add('flipped');
                CardSystem.currentlyFlippedCard = targetCard;
            } else {
                // Unflip
                targetCard.classList.remove('flipped');
                CardSystem.adjustCardHeight(targetCard, false);
                CardSystem.currentlyFlippedCard = null;
            }

            // Reset manual flipping flag after animation completes
            setTimeout(() => {
                CardSystem.isManuallyFlipping = false;
            }, 500);

            // Restore smooth scrolling
            setTimeout(() => {
                container.style.scrollBehavior = 'smooth';
            }, 50);
        }

        // Check card states after key actions
        if (['ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) {
            // After a short delay (enough for scroll/flip to start)
            setTimeout(() => {
                ensureProperCardStates();
            }, 50);

            // Also check again after animations should be complete
            setTimeout(() => {
                ensureProperCardStates();
            }, 800);
        }
    });

    // Scroll event handler
    container.addEventListener('scroll', () => {
        // Don't interfere with manual flipping or recentering
        if (CardSystem.isManuallyFlipping || isRecentering) return;

        // Clear any previous timeout
        clearTimeout(scrollEndTimeout);

        // Update active card during scroll
        if (!isScrolling) {
            requestAnimationFrame(updateActiveCardDuringScroll);
        }

        // If we're not in a detected animation, start detecting
        if (!isScrollAnimationActive) {
            detectScrollAnimationEnd();
        }

        // Detect when scrolling stops
        scrollEndTimeout = setTimeout(() => {
            isScrolling = false;
            if (!CardSystem.isManuallyFlipping && !isRecentering) {
                updateActiveCardDuringScroll();
                ensureProperCardStates();
            }
        }, 150);
    }, { passive: true });

    // Wheel event handler
    container.addEventListener('wheel', (e) => {
        isUserActivelyScrolling = true;
        isScrollMomentumActive = true;
        lastWheelEventTime = Date.now();

        clearTimeout(wheelMomentumTimeout);
        clearTimeout(userScrollTimeout);

        userScrollTimeout = setTimeout(() => {
            isUserActivelyScrolling = false;
        }, 150); // Reduced to 150ms

        wheelMomentumTimeout = setTimeout(() => {
            if (Date.now() - lastWheelEventTime >= 150) {
                isScrollMomentumActive = false;
                if (!isScrollAnimationActive && !isRecentering) {
                    detectScrollAnimationEnd();
                }
            }
        }, 200); // Reduced to 200ms
    }, { passive: true });

    // Initialize desktop-specific features
    addNavigationArrows();
    scrollToCard(0);
    CardSystem.updateUI();

    console.log("Desktop implementation initialized");
})();