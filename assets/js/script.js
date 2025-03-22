(function() {
    // Simple auto-refresh after 16 minutes
    setTimeout(() => {
      window.location.reload();
    }, 16 * 60 * 1000); // 16 minutes in milliseconds
  })();

document.addEventListener('DOMContentLoaded', function() {
    const flipCards = document.querySelectorAll('.flip-card');
    const container = document.querySelector('.container');
    let isMobile = window.innerWidth <= 768;
    let activeCardIndex = 0;
    let navArrows = [];
    let isScrolling = false;
    let isManuallyFlipping = false;
    let currentlyFlippedCard = null;
    let isUserClicking = false;
      let lastKeyPressTime = 0;
      let rapidKeyPressThreshold = 300; // ms
      let isRapidScrolling = false;

    // Update the touch handling for mobile to be more forgiving with slow scrolls
    // Add these variables near the top where you define your other variables
    let touchScrollStartTime = 0;
    let lastTouchX = 0;
    let touchVelocity = 0;
    let isSlowTouchScroll = false;
    const slowScrollThreshold = 0.5; // pixels per millisecond

    // Add this variable to your existing variables at the top
    let isRecentering = false;

    // Add these variables to your existing variables at the top
    let touchStartTime = 0;
    let touchEndTime = 0;
    let swipeVelocity = 0;
    const velocityThreshold = 0.3; // pixels per millisecond - lower = more sensitive

    // --- Coverflow Setup, Card Indicator, Navigation Arrows ---
    container.classList.add('with-coverflow');

    const cardIndicator = document.createElement('div');
    cardIndicator.className = 'card-indicator';
    flipCards.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = 'indicator-dot' + (index === 0 ? ' active' : '');
        dot.dataset.index = index;
        dot.textContent = (index + 1).toString();
        dot.addEventListener('click', (e) => {
            e.stopPropagation();

            // Use the same smooth scrolling behavior as touch scrolling
            if (isMobile) {
                // Update active card
                activeCardIndex = index;
                updateUI();

                // Use smooth scrolling for the recentering
                container.style.scrollBehavior = 'smooth';

                // Use our boundary-respecting function to center the card
                centerCardProperly(index);

                // Reset scrolling behavior after animation
                setTimeout(() => {
                    container.style.scrollBehavior = 'auto';
                }, 300);
            } else {
                scrollToCard(index);
            }
        });
        cardIndicator.appendChild(dot);
    });
    document.body.appendChild(cardIndicator);

    if (!isMobile) {
        const navLeft = document.createElement('div');
        navLeft.className = 'nav-arrow nav-left disabled';
        navLeft.innerHTML = '←';
        navLeft.setAttribute('aria-label', 'Previous card');

        const navRight = document.createElement('div');
        navRight.className = 'nav-arrow nav-right';
        navRight.innerHTML = '→';
        navRight.setAttribute('aria-label', 'Next card');

        document.body.appendChild(navLeft);
        document.body.appendChild(navRight);
        navArrows = [navLeft, navRight];

          // Direct arrow click handlers with no debounce or animation delays
          navLeft.addEventListener('click', () => {
              if (activeCardIndex > 0) {
                  // Cancel all animations and scrolling
                  container.style.scrollBehavior = 'auto';
                  isScrolling = false;
                  clearTimeout(scrollEndTimeout);

                  // Immediate index update
                  activeCardIndex--;
                  updateUI();

                  // Direct scrolling to the card
                  const targetCard = flipCards[activeCardIndex];
                  const containerCenter = container.offsetWidth / 2;
                  const cardCenter = targetCard.offsetWidth / 2;
                  container.scrollLeft = targetCard.offsetLeft - containerCenter + cardCenter;
              }
          });

          navRight.addEventListener('click', () => {
              if (activeCardIndex < flipCards.length - 1) {
                  // Cancel all animations and scrolling
                  container.style.scrollBehavior = 'auto';
                  isScrolling = false;
                  clearTimeout(scrollEndTimeout);

                  // Immediate index update
                  activeCardIndex++;
                  updateUI();

                  // Direct scrolling to the card
                  const targetCard = flipCards[activeCardIndex];
                  const containerCenter = container.offsetWidth / 2;
                  const cardCenter = targetCard.offsetWidth / 2;
                  container.scrollLeft = targetCard.offsetLeft - containerCenter + cardCenter;
              }
          });
    }

    // --- CRITICAL FIX: Force stop all animations when a user interaction happens ---
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

    // --- scrollToCard updated ---
    function scrollToCard(index, andFlip = false) {
        if (index < 0 || index >= flipCards.length || (index === activeCardIndex && !andFlip)) return;

        const cardToScrollTo = flipCards[index];

        // Force stop all animations for immediate response
        forceStopAllAnimations();

        // Reset any flipped card if we're not planning to flip this one
        if (currentlyFlippedCard && (!andFlip || currentlyFlippedCard !== cardToScrollTo)) {
            resetFlippedCard();
        }

        // Update active card index
        activeCardIndex = index;
        updateUI();

        // Mobile scrolling
        if (isMobile) {
            // Enable smooth scrolling for this action
            container.style.scrollBehavior = 'smooth';
            container.dataset.isSnappingBack = 'true';

            // Scroll to card using the boundary-respecting function
            centerCardProperly(index);

            // Handle flipping if needed
            if (andFlip) {
                adjustCardHeight(cardToScrollTo, true);
                cardToScrollTo.classList.add('flipped');
                currentlyFlippedCard = cardToScrollTo;
            }

            // Reset scroll behavior after animation
            setTimeout(() => {
                container.style.scrollBehavior = 'auto';
                container.dataset.isSnappingBack = 'false';
                updateUI(); // Update UI after snap-back is complete
            }, 300);
        }
        // Desktop scrolling
        else {
            // Enable smooth scrolling
            container.style.scrollBehavior = 'smooth';
            container.dataset.isSnappingBack = 'true';

            // Use the PC-specific centering function
            centerCardForPC(index);

            // Handle flipping if needed
            if (andFlip) {
                setTimeout(() => {
                    adjustCardHeight(cardToScrollTo, true);
                    cardToScrollTo.classList.add('flipped');
                    currentlyFlippedCard = cardToScrollTo;
                }, 400); // Wait for scroll to complete
            }

            // Mark scrolling as done after animation completes
            setTimeout(() => {
                isScrolling = false;
                container.dataset.isSnappingBack = 'false';
                updateUI(); // Update UI after snap-back is complete
                restoreAnimations();
            }, 500);
        }
    }

    // --- updateActiveCardDuringScroll (Dynamic Activation) ---
    function updateActiveCardDuringScroll() {
        // Don't update if manually flipping
        if (isManuallyFlipping) return;

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
                const currentActiveCard = flipCards[activeCardIndex];
                const currentActiveRect = currentActiveCard.getBoundingClientRect();
                const currentActiveCenter = currentActiveRect.left + currentActiveRect.width / 2;
                const currentActiveDistance = Math.abs(currentActiveCenter - containerCenter);

                if (distanceFromCenter < currentActiveDistance) {
                    // Update active card index
                    activeCardIndex = index;
                    updateUI();

                    // If we have a flipped card that's not the new active card,
                    // keep it flipped but show indicators for the new active card
                    if (currentlyFlippedCard && currentlyFlippedCard !== card) {
                        const cardIndicator = document.querySelector('.card-indicator');
                        cardIndicator.style.opacity = '1';
                        cardIndicator.style.pointerEvents = 'auto';
                    }
                }
            }
        });
    }

    // --- adjustCardHeight ---
    function adjustCardHeight(card, setHeight = false) {
        const inner = card.querySelector('.flip-card-inner');
        const back = card.querySelector('.flip-card-back');
        const front = card.querySelector('.flip-card-front');
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
    }

    // --- updateUI (Visual Updates) ---
    function updateUI() {
        flipCards.forEach((card, i) => {
            card.classList.toggle('active', i === activeCardIndex);
        });

        document.querySelectorAll('.indicator-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === activeCardIndex);
        });

        // Only handle indicator visibility if no card is currently being dragged
        if (!currentlyFlippedCard) {
            const cardIndicator = document.querySelector('.card-indicator');
            cardIndicator.style.opacity = '1';
            cardIndicator.style.pointerEvents = 'auto';
        }

        if (!isMobile && navArrows.length === 2) {
            navArrows[0].classList.toggle('disabled', activeCardIndex === 0);
            navArrows[1].classList.toggle('disabled', activeCardIndex === flipCards.length - 1);
        }
    }

    // --- Card click handler update (find the existing handler and make this change) ---
    flipCards.forEach((card, index) => {
        card.addEventListener('click', function(e) {
            // Skip link clicks
            if (e.target.tagName === 'A') return;

            // Mobile path remains exactly as it is - no changes at all
            if (isMobile) {
                e.preventDefault();
                e.stopPropagation();

                // Set flags
                isManuallyFlipping = true;

                // 1. Center this card with boundary enforcement
                activeCardIndex = index;
                updateUI();

                // Enable smooth centering
                container.style.scrollBehavior = 'smooth';

                // Use our boundary-respecting function
                centerCardProperly(index);

                // 2. Flip the card
                const shouldFlip = !this.classList.contains('flipped');

                // Handle any previously flipped card
                if (currentlyFlippedCard && currentlyFlippedCard !== this) {
                    resetFlippedCard();
                }

                if (shouldFlip) {
                    adjustCardHeight(this, true);
                    this.classList.add('flipped');
                    currentlyFlippedCard = this;
                    // Hide indicators when card is flipped on mobile
                    document.querySelector('.card-indicator').style.opacity = '0';
                    document.querySelector('.card-indicator').style.pointerEvents = 'none';
                } else {
                    this.classList.remove('flipped');
                    adjustCardHeight(this, false);
                    currentlyFlippedCard = null;
                    // Show indicators when card is unflipped on mobile
                    document.querySelector('.card-indicator').style.opacity = '1';
                    document.querySelector('.card-indicator').style.pointerEvents = 'auto';
                }

                // Reset manual flipping flag after a delay
                setTimeout(() => {
                    isManuallyFlipping = false;
                    container.style.scrollBehavior = 'auto';
                }, 300);

                return;
            }

            // Desktop behavior - updated to use our new function
            // Skip if dragging
            if (e.clientX && this.dataset.mouseDownX) {
                const dragDistance = Math.abs(e.clientX - parseInt(this.dataset.mouseDownX));
                if (dragDistance > 5) return;
            }

            // CRITICAL: Set manual flipping flag
            isManuallyFlipping = true;

            // Clear any scroll timeouts
            clearTimeout(scrollEndTimeout);

            const shouldFlip = !this.classList.contains('flipped');

            if (!this.classList.contains('active')) {
                // If not active, center it first, then handle flipping
                activeCardIndex = index;
                updateUI();

                // Use our new PC-specific centering function
                centerCardForPC(index);

                // After scroll animation completes, handle flipping if needed
                setTimeout(() => {
                    if (shouldFlip) {
                        // Handle any previously flipped card
                        if (currentlyFlippedCard && currentlyFlippedCard !== this) {
                            resetFlippedCard();
                        }

                        // Expand and flip
                        adjustCardHeight(this, true);
                        this.classList.add('flipped');
                        currentlyFlippedCard = this;
                    }

                    isManuallyFlipping = false;
                }, 400);
            } else {
                // Already active, just handle flipping
                if (currentlyFlippedCard && currentlyFlippedCard !== this) {
                    resetFlippedCard();
                }

                if (shouldFlip) {
                    // Expand and flip
                    adjustCardHeight(this, true);
                    this.classList.add('flipped');
                    currentlyFlippedCard = this;
                } else {
                    // Unflip
                    this.classList.remove('flipped');
                    adjustCardHeight(this, false);
                    currentlyFlippedCard = null;
                }

                // Reset manual flipping flag after a delay
                setTimeout(() => {
                    isManuallyFlipping = false;
                }, 500);
            }

            // Restore animations with a slight delay
            setTimeout(restoreAnimations, 50);
        });
    });

    // --- Image Preloading ---
    const preloadImages = () => {
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
    };
    preloadImages();

    // --- Scroll handling ---
    let scrollEndTimeout;
    container.addEventListener('scroll', () => {
        // Don't interfere with manual flipping
        if (isManuallyFlipping) return;

        // Clear any previous timeout
        clearTimeout(scrollEndTimeout);

        // Update active card during scroll
        if (!isScrolling) {
            requestAnimationFrame(updateActiveCardDuringScroll);
        }

        // Handle real-time indicator visibility for flipped cards
        if (currentlyFlippedCard) {
            const containerRect = container.getBoundingClientRect();
            const containerCenter = containerRect.left + containerRect.width / 2;
            const cardRect = currentlyFlippedCard.getBoundingClientRect();
            const cardCenter = cardRect.left + cardRect.width / 2;
            const distanceFromCenter = Math.abs(cardCenter - containerCenter);

            // Show/hide indicators based on whether the flipped card is centered
            const cardIndicator = document.querySelector('.card-indicator');
            const isCentered = distanceFromCenter < 10; // Small threshold for "centered"

            cardIndicator.style.opacity = isCentered ? '0' : '1';
            cardIndicator.style.pointerEvents = isCentered ? 'none' : 'auto';
        }

        // Detect when scrolling stops
        scrollEndTimeout = setTimeout(() => {
            isScrolling = false;

            // One final update when scrolling ends
            if (!isManuallyFlipping) {
                updateActiveCardDuringScroll();
                ensureProperCardStates();
            }
        }, 150);
    }, { passive: true });

    // --- Window Resize Handling ---
    window.addEventListener('resize', () => {
        const wasMobile = isMobile;
        isMobile = window.innerWidth <= 768;

        if (isMobile === wasMobile) {
            // Just update the padding without reloading
            addEdgeCardPadding();
        } else {
            location.reload(); // Handle mobile/desktop switch
        }
    });

    // --- Touch Handling (for Mobile) ---
    let touchStartX = 0;
    let touchEndX = 0;
    const minSwipeDistance = 50;

    container.addEventListener('touchstart', (e) => {
        if (!isMobile) return;

        touchStartX = e.changedTouches[0].screenX;
        lastTouchX = touchStartX;
        touchStartTime = Date.now();
        touchScrollStartTime = touchStartTime;

        // Immediately stop any ongoing animations
        container.style.scrollBehavior = 'auto';
        isScrolling = false;
        clearTimeout(scrollEndTimeout);

        // Record starting position
        container.dataset.touchStartActiveCard = activeCardIndex;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (!isMobile) return;

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
        if (!isMobile) return;

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

            let targetIndex;

            // If strong swipe velocity, use momentum to determine target card
            if (Math.abs(swipeVelocity) > velocityThreshold) {
                // Fast swipe - move in direction of swipe
                const closestCardIndex = visibleCards.length > 0 ? visibleCards[0].index : activeCardIndex;

                if (swipeVelocity > 0) {
                    // Rightward swipe - go to previous card (if possible)
                    targetIndex = Math.max(0, closestCardIndex - 1);
                } else {
                    // Leftward swipe - go to next card (if possible)
                    targetIndex = Math.min(flipCards.length - 1, closestCardIndex + 1);
                }
            } else {
                // Slow swipe or drag - snap to closest card
                targetIndex = visibleCards.length > 0 ? visibleCards[0].index : activeCardIndex;
            }

            if (targetIndex !== undefined) {
                // Update active card
                activeCardIndex = targetIndex;
                updateUI();

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

    // --- Keyboard Navigation ---
    document.addEventListener('keydown', (e) => {
        // Skip if on mobile
        if (isMobile) return;

          const now = Date.now();
          const isRapidKeyPress = (now - lastKeyPressTime) < rapidKeyPressThreshold;
          lastKeyPressTime = now;

          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              // Calculate new index based on key pressed
              let newIndex = activeCardIndex;
        if (e.key === 'ArrowLeft' && activeCardIndex > 0) {
                  newIndex = activeCardIndex - 1;
        } else if (e.key === 'ArrowRight' && activeCardIndex < flipCards.length - 1) {
                  newIndex = activeCardIndex + 1;
              } else {
                  return; // No valid movement possible
              }

              // If rapid key press detected, use the immediate scrolling method
              if (isRapidKeyPress || isRapidScrolling) {
                  // We're in rapid scrolling mode now
                  isRapidScrolling = true;

                  // Cancel ongoing animations
                  container.style.scrollBehavior = 'auto';
                  isScrolling = false;
                  clearTimeout(scrollEndTimeout);

                  // Update index immediately
                  activeCardIndex = newIndex;
                  updateUI();

                  // Direct scrolling to target
                  const targetCard = flipCards[activeCardIndex];
                  const containerCenter = container.offsetWidth / 2;
                  const cardCenter = targetCard.offsetWidth / 2;
                  container.scrollLeft = targetCard.offsetLeft - containerCenter + cardCenter;

                  // Reset rapid scrolling mode after a delay
                  clearTimeout(window.rapidScrollResetTimeout);
                  window.rapidScrollResetTimeout = setTimeout(() => {
                      isRapidScrolling = false;
                      container.style.scrollBehavior = 'smooth';
                  }, 500);
              } else {
                  // For casual scrolling, use an enhanced smooth animation approach
                  clearTimeout(scrollEndTimeout);

                  // Set a longer, more pronounced smooth scrolling
                  isScrolling = true;

                  // Update active card index
                  activeCardIndex = newIndex;
                  updateUI();

                  // Apply an enhanced smooth scroll animation using CSS transition
                  // This creates a more visually appealing slow scroll
                  container.style.scrollBehavior = 'smooth';

                  // Get the target position
                  const targetCard = flipCards[activeCardIndex];
                  const containerCenter = container.offsetWidth / 2;
                  const cardCenter = targetCard.offsetWidth / 2;
                  const scrollTarget = targetCard.offsetLeft - containerCenter + cardCenter;

                  // Apply a CSS transition to the container for horizontal scrolling
                  container.style.transition = 'scroll-behavior 0s, scrollLeft 0.8s cubic-bezier(0.25, 0.1, 0.25, 1.25)';

                  // This isn't a standard CSS property, but we can use it to signal our intention
                  // The actual scrolling is done with scrollIntoView
                  centerCardForPC(activeCardIndex);

                  // After animation completes
                  setTimeout(() => {
                      isScrolling = false;
                      container.style.transition = '';
                      ensureProperCardStates();
                  }, 800); // Longer duration for slow, beautiful scrolling
              }
          } else if ((e.key === 'Enter' || e.key === ' ')) {
                // Prevent default space scrolling behavior
                e.preventDefault();

              // 1. Force center the active card (regardless of scrolling mode)
              const targetCard = flipCards[activeCardIndex];

              // Make centering immediate
              container.style.scrollBehavior = 'auto';
              isScrolling = false;
              clearTimeout(scrollEndTimeout);

              // Force correct position
              const containerCenter = container.offsetWidth / 2;
              const cardCenter = targetCard.offsetWidth / 2;
              container.scrollLeft = targetCard.offsetLeft - containerCenter + cardCenter;

              // 2. Flip the card (same as before)
                isManuallyFlipping = true;

              const shouldFlip = !targetCard.classList.contains('flipped');

              // Reset any previously flipped card
              if (currentlyFlippedCard && currentlyFlippedCard !== targetCard) {
                  resetFlippedCard();
              }

                if (shouldFlip) {
                    // Expand and flip
                  adjustCardHeight(targetCard, true);
                  targetCard.classList.add('flipped');
                  currentlyFlippedCard = targetCard;
                } else {
                    // Unflip
                  targetCard.classList.remove('flipped');
                  adjustCardHeight(targetCard, false);
                    currentlyFlippedCard = null;
                }

              // Reset manual flipping flag after animation completes
                setTimeout(() => {
                    isManuallyFlipping = false;
                }, 500);

              // Restore smooth scrolling
              setTimeout(() => {
                  container.style.scrollBehavior = 'smooth';
              }, 50);
          }

          // Add this at the end of the handler
          if (['ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)) {
              // After a short delay (enough for scroll/flip to start)
              setTimeout(() => {
                  ensureProperCardStates();
              }, 50);

              // Also check again after animations should be complete
              setTimeout(() => {
                  ensureProperCardStates();
              }, 800); // Match the longer animation duration
        }
    });

    // --- Initial Setup ---
    setTimeout(() => {
        updateUI();
        if (isMobile) {
            fixEdgeScrolling();
            centerCardProperly(0);
        } else {
            scrollToCard(0);
        }
        addSectionTitles();
    }, 50);

    function resetFlippedCard() {
        if (currentlyFlippedCard) {
            currentlyFlippedCard.classList.remove('flipped');
            adjustCardHeight(currentlyFlippedCard, false);
            currentlyFlippedCard = null;

            // Only show indicators if we're not in the middle of scrolling
            if (!isScrolling) {
                const cardIndicator = document.querySelector('.card-indicator');
                cardIndicator.style.opacity = '1';
                cardIndicator.style.pointerEvents = 'auto';
            }
        }
    }

      // Ensure all inactive cards are unflipped
      function ensureProperCardStates() {
          // Only reset flipped cards if they're not visible in the viewport
          if (currentlyFlippedCard) {
              const containerRect = container.getBoundingClientRect();
              const cardRect = currentlyFlippedCard.getBoundingClientRect();

              // Check if the flipped card is visible in the viewport
              const isVisible = cardRect.right > containerRect.left && cardRect.left < containerRect.right;

              // Only reset if the card is not visible
              if (!isVisible) {
                  resetFlippedCard();
              }
          }
      }

    // Add this NEW FUNCTION to add section titles
    function addSectionTitles() {
        // Loop through all cards
        flipCards.forEach(card => {
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
    }

    // Simplify centerCardProperly to not interfere with natural bouncing
    function centerCardProperly(index) {
        // Don't apply constraints - let the browser handle the bounce naturally
        const card = flipCards[index];
        const containerWidth = container.offsetWidth;
        const containerCenter = containerWidth / 2;
        const cardCenter = card.offsetWidth / 2;

        // Simple position calculation without constraints
        container.scrollLeft = card.offsetLeft - containerCenter + cardCenter;
    }

    // Add this function to ensure first and last cards have proper spacing for bounce
    function addEdgeCardPadding() {
        // First, check if the mobile styles are already applied
        const firstCard = flipCards[0];
        const lastCard = flipCards[flipCards.length - 1];

        // Add explicit padding for the first and last cards
        if (isMobile) {
            // Set explicit left margin for first card to ensure it stays in the center
            firstCard.style.marginLeft = 'calc(50vw - 150px)';

            // Set explicit right margin for last card to ensure it stays in the center
            lastCard.style.marginRight = 'calc(50vw - 150px)';
        }
    }

    // Add this function to handle boundary scrolling
    function fixEdgeScrolling() {
        // We need to modify how the container's scrollable area is defined
        const container = document.querySelector('.container');
        const firstCard = document.querySelector('.flip-card:first-child');
        const lastCard = document.querySelector('.flip-card:last-child');

        if (!container || !firstCard || !lastCard) return;

        // This is critical - we need to create padding elements
        // to prevent scrolling past the first and last cards
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

        // Remove any direct margins on cards that might interfere
        document.querySelectorAll('.flip-card').forEach(card => {
            card.style.marginLeft = '15px';
            card.style.marginRight = '15px';
        });
    }

    // Add this function after one of your existing utility functions (like adjustCardHeight)
    function centerCardForPC(index) {
        // ONLY for desktop - early return ensures mobile is untouched
        if (isMobile) return;

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
});
