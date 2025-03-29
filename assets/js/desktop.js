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

    // Add this function near the other utility functions
    function toggleLogoVisibility(show) {
        const logoContainer = document.querySelector('.logo-container');
        if (logoContainer) {
            logoContainer.style.opacity = show ? '1' : '0';
            logoContainer.style.visibility = show ? 'visible' : 'hidden';
        }
    }

    // Modify the card click handler to toggle logo visibility
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

            // Add logo visibility toggle
            if (shouldFlip) {
                // Hide logo when flipping a card
                toggleLogoVisibility(false);
            } else {
                // Show logo when unflipping
                toggleLogoVisibility(true);
            }

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

    // Scroll to card function for desktop (simplified to remove unnecessary snapping)
    function scrollToCard(index, andFlip = false) {
        if (index < 0 || index >= flipCards.length) return;

        const cardToScrollTo = flipCards[index];

        // Update active card index
        CardSystem.activeCardIndex = index;
        CardSystem.updateUI();

        // Enable smooth scrolling
        container.style.scrollBehavior = 'smooth';

        // Center the card
        const containerWidth = container.offsetWidth;
        const containerCenter = containerWidth / 2;
        const cardCenter = cardToScrollTo.offsetWidth / 2;
        const scrollPosition = cardToScrollTo.offsetLeft - containerCenter + cardCenter;

        // Apply smooth scrolling animation
        container.scrollLeft = scrollPosition;

        // Handle flipping if needed
        if (andFlip) {
            longSwipeTimeout = setTimeout(() => {
                // Reset any previously flipped card
                if (CardSystem.currentlyFlippedCard && CardSystem.currentlyFlippedCard !== cardToScrollTo) {
                    CardSystem.resetFlippedCard();
                }
                
                CardSystem.adjustCardHeight(cardToScrollTo, true);
                cardToScrollTo.classList.add('flipped');
                CardSystem.currentlyFlippedCard = cardToScrollTo;
                toggleLogoVisibility(false);
            }, 400); // Wait for scroll to complete
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
    }

    // Update active card during scroll
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
                const previousActiveIndex = CardSystem.activeCardIndex;
                CardSystem.activeCardIndex = closestCard;
                
                // If we have a flipped card, only unflip it when a DIFFERENT card becomes active
                if (CardSystem.currentlyFlippedCard &&
                    CardSystem.currentlyFlippedCard !== flipCards[closestCard] &&
                    Array.from(flipCards).indexOf(CardSystem.currentlyFlippedCard) !== closestCard) {
                    CardSystem.resetFlippedCard();
                }
                
                CardSystem.updateUI();
            }
        }
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

    // Keyboard navigation - simplified for consistent behavior
    document.addEventListener('keydown', (e) => {
        // First check if we're handling a key during scroll momentum
        if (handleKeyDuringScrollMomentum(e)) {
            return;
        }

        const now = Date.now();
        const isRapidKeyPress = (now - lastKeyPressTime) < rapidKeyPressThreshold;
        lastKeyPressTime = now;

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            // Calculate new index based on key pressed
            let newIndex = CardSystem.activeCardIndex;
            if (e.key === 'ArrowLeft' && CardSystem.activeCardIndex > 0) {
                newIndex = CardSystem.activeCardIndex - 1;
            } else if (e.key === 'ArrowRight' && CardSystem.activeCardIndex < flipCards.length - 1) {
                newIndex = CardSystem.activeCardIndex + 1;
            } else {
                return;
            }

            // Use smooth scrolling for arrow keys
            container.style.scrollBehavior = 'smooth';
            scrollToCard(newIndex, false);
        } else if ((e.key === 'Enter' || e.key === ' ')) {
            // Prevent default space scrolling behavior
            e.preventDefault();
            
            // Find the most visible card (similar to click handling)
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
            const containerRect2 = container.getBoundingClientRect();
            const overlapLeft = Math.max(containerRect2.left, cardRect.left);
            const overlapRight = Math.min(containerRect2.right, cardRect.right);
            const visibleWidth = Math.max(0, overlapRight - overlapLeft);
            
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
                // Hide logo when flipping a card
                toggleLogoVisibility(false);
            } else {
                // Show logo when unflipping
                toggleLogoVisibility(true);
            }
            
            if (!targetCard.classList.contains('active')) {
                // If not active, update UI and center it
                CardSystem.activeCardIndex = bestVisibleCard;
                CardSystem.updateUI();
                
                // Use our PC-specific centering function
                centerCardForPC(bestVisibleCard);
                
                // After scroll animation completes, handle flipping if needed
                longSwipeTimeout = setTimeout(() => {
                    if (shouldFlip) {
                        // Handle any previously flipped card
                        if (CardSystem.currentlyFlippedCard && CardSystem.currentlyFlippedCard !== targetCard) {
                            CardSystem.resetFlippedCard();
                        }
                        
                        // First restore animations to ensure transitions work
                        restoreAnimations();
                        
                        // Wait a tiny bit for animations to be restored
                        setTimeout(() => {
                            // Expand and flip with forced reflow
                            CardSystem.adjustCardHeight(targetCard, true);
                            void targetCard.offsetWidth; // Force reflow
                            targetCard.classList.add('flipped');
                            CardSystem.currentlyFlippedCard = targetCard;
                        }, 10);
                    }
                    
                    CardSystem.isManuallyFlipping = false;
                }, 400);
            } else {
                // Already active, just handle flipping
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
                } else {
                    // Force a reflow between operations
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
    });

    // Simplified scroll event handler
    container.addEventListener('scroll', () => {
        // Don't interfere with manual flipping
        if (CardSystem.isManuallyFlipping) return;

        // Clear any previous timeout
        clearTimeout(scrollEndTimeout);
        
        // Track that we're scrolling
        isScrolling = true;

        // Update active card during scroll
            requestAnimationFrame(updateActiveCardDuringScroll);
        
        // Mark scrolling as complete after brief delay
        scrollEndTimeout = setTimeout(() => {
            isScrolling = false;
            
            // Final update
            if (!CardSystem.isManuallyFlipping) {
                updateActiveCardDuringScroll();
                ensureProperCardStates();
            }
        }, 150);

        // Update logo visibility if needed
        if (CardSystem.currentlyFlippedCard) {
            // Check if we need to update visibility
            const containerRect = container.getBoundingClientRect();
            const cardRect = CardSystem.currentlyFlippedCard.getBoundingClientRect();
            const isVisible = cardRect.right > containerRect.left && cardRect.left < containerRect.right;
            
            if (!isVisible) {
                // Card scrolled out of view, handle logo visibility
                toggleLogoVisibility(true);
            }
        }
    }, { passive: true });

    // Simplified wheel event handler
    container.addEventListener('wheel', (e) => {
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

    // Missing handleKeyDuringScrollMomentum function
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

    // Initialize desktop-specific features
    addNavigationArrows();
    initSmoothScrolling();
    console.log("iPod-style cover flow initialized");
})();