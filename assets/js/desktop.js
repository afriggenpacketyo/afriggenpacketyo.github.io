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
                // Set activation source
                lastCardActivationSource = 'arrow';
                
                // Reset any flipped card when using arrows
                if (CardSystem.currentlyFlippedCard) {
                    CardSystem.resetFlippedCard();
                    toggleLogoVisibility(true);
                }
                
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
                // Set activation source
                lastCardActivationSource = 'arrow';
                
                // Reset any flipped card when using arrows
                if (CardSystem.currentlyFlippedCard) {
                    CardSystem.resetFlippedCard();
                    toggleLogoVisibility(true);
                }
                
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
            } else {
                toggleLogoVisibility(true);
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
                // Unflipping
                void this.offsetWidth; // Force reflow
                this.classList.remove('flipped');
                CardSystem.adjustCardHeight(this, false);
                CardSystem.currentlyFlippedCard = null;
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

    // Modified updateActiveCardDuringScroll that uses proper dot transitions
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
                
                // If we have a flipped card, only unflip it when a DIFFERENT card becomes active
                if (CardSystem.currentlyFlippedCard &&
                    CardSystem.currentlyFlippedCard !== flipCards[closestCard] &&
                    Array.from(flipCards).indexOf(CardSystem.currentlyFlippedCard) !== closestCard) {
                    CardSystem.resetFlippedCard();
                }
                
                // Use the updateUI method which will properly update the dots
                CardSystem.updateUI();
            }
        }
    }

    // Create a throttled version for smoother dot updates
    const updateActiveCardDuringScrollThrottled = throttle(() => {
        updateActiveCardDuringScroll();
    }, 120); // 120ms throttle provides a good balance

    // Modify the ensureProperCardStates function to respect activation source
    function ensureProperCardStates() {
        // Only reset flipped cards if they're not the active card AND not visible 
        // AND they weren't explicitly activated by the user
        if (CardSystem.currentlyFlippedCard) {
            const containerRect = container.getBoundingClientRect();
            const cardRect = CardSystem.currentlyFlippedCard.getBoundingClientRect();
            const cardIndex = Array.from(flipCards).indexOf(CardSystem.currentlyFlippedCard);
            
            // Check if the flipped card is visible in the viewport
            const isVisible = cardRect.right > containerRect.left && cardRect.left < containerRect.right;
            
            // Only reset if:
            // 1. The card is not visible AND not the active card
            // 2. The activation source is scroll or arrow (not click/key direct activation)
            const shouldResetBasedOnSource = 
                lastCardActivationSource === 'scroll' || 
                lastCardActivationSource === 'arrow';
                
            if ((!isVisible && cardIndex !== CardSystem.activeCardIndex) || shouldResetBasedOnSource) {
                CardSystem.resetFlippedCard();
                toggleLogoVisibility(true);
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
            // Set activation source for arrow keys
            lastCardActivationSource = 'arrow';
            
            // Reset any flipped card when using arrow keys
            if (CardSystem.currentlyFlippedCard) {
                CardSystem.resetFlippedCard();
                toggleLogoVisibility(true);
            }
            
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
    });

    // Simplified scroll event handler
    container.addEventListener('scroll', () => {
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

    // Modify CardSystem.updateUI to allow bypassing dot updates
    const originalUpdateUI = CardSystem.updateUI;
    CardSystem.updateUI = function(skipDotUpdate = false) {
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

    // Initialize desktop-specific features
    addNavigationArrows();
    initSmoothScrolling();
    initSmoothDotTransitions();
    console.log("iPod-style cover flow initialized");
})();