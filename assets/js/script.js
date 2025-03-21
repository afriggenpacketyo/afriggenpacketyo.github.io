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

    // --- Coverflow Setup, Card Indicator, Navigation Arrows ---
    container.classList.add('with-coverflow');

    const cardIndicator = document.createElement('div');
    cardIndicator.className = 'card-indicator';
    flipCards.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.className = 'indicator-dot' + (index === 0 ? ' active' : '');
        dot.dataset.index = index;
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            scrollToCard(index);
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

        isScrolling = true;
        const cardToScrollTo = flipCards[index];

        // Reset any flipped card if we're not planning to flip this one
        if (currentlyFlippedCard && (!andFlip || currentlyFlippedCard !== cardToScrollTo)) {
            resetFlippedCard();
        }

        // Update active card
        activeCardIndex = index;
        updateUI();

        // If we're going to flip, prepare card height
        if (andFlip) {
            isManuallyFlipping = true;
            adjustCardHeight(cardToScrollTo, true);
        }
  
          // If not in rapid scrolling mode, use a nicer easing
          if (!isRapidScrolling) {
              // Set smooth behavior for nice animation
              container.style.scrollBehavior = 'smooth';

        // Scroll to center the card
        cardToScrollTo.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
        });
          } else {
              // In rapid mode, immediate scroll
              container.style.scrollBehavior = 'auto';
              const containerCenter = container.offsetWidth / 2;
              const cardCenter = cardToScrollTo.offsetWidth / 2;
              container.scrollLeft = cardToScrollTo.offsetLeft - containerCenter + cardCenter;
          }

        // After scroll animation completes
        setTimeout(() => {
            isScrolling = false;

            // If we need to flip, do it now
            if (andFlip) {
                cardToScrollTo.classList.add('flipped');
                currentlyFlippedCard = cardToScrollTo;

                // Reset manual flipping flag after a delay
                setTimeout(() => {
                    isManuallyFlipping = false;
                }, 100);
            }
              
              // Make sure all cards are in proper state
              ensureProperCardStates();
          }, isRapidScrolling ? 50 : 400); // Shorter duration for rapid scrolling
    }

    // --- updateActiveCardDuringScroll (Dynamic Activation) ---
    function updateActiveCardDuringScroll() {
        // Don't update if manually flipping
        if (isManuallyFlipping) return;

        // Simple, practical approach: Find which cards are at least 30% visible
        const containerRect = container.getBoundingClientRect();
        
        // For each card, calculate how much is visible
        flipCards.forEach((card, index) => {
            const cardRect = card.getBoundingClientRect();
            
            // Calculate intersection/overlap with container
            const overlapLeft = Math.max(containerRect.left, cardRect.left);
            const overlapRight = Math.min(containerRect.right, cardRect.right);
            const visibleWidth = Math.max(0, overlapRight - overlapLeft);
            
            // If 30% or more is visible AND it's closer to center than current active card
            if (visibleWidth / cardRect.width >= 0.3) {
                const cardCenter = cardRect.left + cardRect.width / 2;
                const containerCenter = containerRect.left + containerRect.width / 2;
                const currentActiveCenter = flipCards[activeCardIndex].getBoundingClientRect().left + 
                                          flipCards[activeCardIndex].getBoundingClientRect().width / 2;
                
                if (Math.abs(cardCenter - containerCenter) < Math.abs(currentActiveCenter - containerCenter)) {
                    activeCardIndex = index;
                    updateUI();
                }
            }
        });
    }

    // --- adjustCardHeight ---
    function adjustCardHeight(card, setHeight = false) {
        const inner = card.querySelector('.flip-card-inner');
        const back = card.querySelector('.flip-card-back');
        const originalHeight = 400; // Original card height

        if (setHeight) {
            // Get content height
            const contentHeight = back.scrollHeight;

            if (contentHeight > originalHeight) {
                // Calculate the height difference
                const heightDifference = contentHeight - originalHeight;

                // Set half the difference as negative margin-top to shift up
                const shiftAmount = Math.floor(heightDifference / 2);

                // Apply the transformations
                card.style.height = contentHeight + 'px';
                card.style.marginTop = `-${shiftAmount}px`;

                // Store the shift amount for reverting later
                card.dataset.shiftAmount = shiftAmount;

                // Ensure inner element fills the card
                inner.style.height = '100%';
            }
        } else {
            // Get the stored shift amount
            const shiftAmount = card.dataset.shiftAmount || 0;

            // Reset height and margin
            card.style.height = `${originalHeight}px`;
            card.style.marginTop = '0px';

            // Reset inner element
            inner.style.height = '100%';

            // Clear stored data
            delete card.dataset.shiftAmount;
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

        if (!isMobile && navArrows.length === 2) {
            navArrows[0].classList.toggle('disabled', activeCardIndex === 0);
            navArrows[1].classList.toggle('disabled', activeCardIndex === flipCards.length - 1);
        }
    }

    // --- Card click handler updated ---
    flipCards.forEach((card, index) => {
        const inner = card.querySelector('.flip-card-inner');
        const back = card.querySelector('.flip-card-back');

        card.addEventListener('click', function(e) {
            // Skip link clicks
            if (e.target.tagName === 'A') return;

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
                // If not active, scroll to it AND flip
                scrollToCard(index, shouldFlip);
            } else {
                // Already active, just handle flipping

                // Reset any previously flipped card
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

        // Improved mouse/touch handlers to be more reliable
        card.addEventListener('mousedown', function(e) {
            this.dataset.mouseDownX = e.clientX;
        });

        card.addEventListener('touchstart', function(e) {
            if (e.touches && e.touches[0]) {
                this.dataset.mouseDownX = e.touches[0].clientX;
            }
        }, { passive: true });

        // Clear dragging data on mouse/touch end
        card.addEventListener('mouseup mouseleave', function() {
            delete this.dataset.mouseDownX;
        });

        card.addEventListener('touchend touchcancel', function() {
            delete this.dataset.mouseDownX;
        }, { passive: true });

        // Style optimism scores (same as before)
        const scoreText = back.querySelector('p:nth-of-type(2)');
        if (scoreText) {
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

                scoreText.innerHTML = 'Optimism Score: ';
                scoreText.appendChild(scoreSpan);
            }
        }

        // Add section titles (same as before)
        const summaryTitle = document.createElement('div');
        summaryTitle.className = 'section-title';
        summaryTitle.textContent = 'Summary';

        const linkTitle = document.createElement('div');
        linkTitle.className = 'section-title';
        linkTitle.textContent = 'Source';

        const summaryText = back.querySelector('p:first-of-type');
        if (summaryText) {
            summaryText.parentNode.insertBefore(summaryTitle, summaryText);
        }

        const linkElement = back.querySelector('a');
        if (linkElement) {
            linkElement.parentNode.insertBefore(linkTitle, linkElement);
        }
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
        if (wasMobile !== isMobile) {
            location.reload(); // Handle mobile/desktop switch
        }
    });

    // --- Touch Handling (for Mobile) ---
    let touchStartX = 0;
    let touchEndX = 0;
    const minSwipeDistance = 50;

    container.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        lastTouchX = touchStartX;
        touchScrollStartTime = Date.now();
        
        // Important: Record which card is active when touch starts
        // This will be the card we'll prioritize keeping active for small movements
        container.dataset.touchStartActiveCard = activeCardIndex;
        
        isSlowTouchScroll = false; // Reset slow scroll flag
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
        
        // Use your existing scrollToCard function which already has smooth scrolling 
        // and is well-tested with the rest of your code
        container.style.scrollBehavior = 'smooth';
        scrollToCard(activeCardIndex);
        
        // Reset touch variables
        isSlowTouchScroll = false;
        touchVelocity = 0;
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
                  targetCard.scrollIntoView({
                      behavior: 'smooth',
                      block: 'nearest',
                      inline: 'center'
                  });
                  
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
        scrollToCard(0);
    }, 50);

    function resetFlippedCard() {
        if (currentlyFlippedCard) {
            currentlyFlippedCard.classList.remove('flipped');
            adjustCardHeight(currentlyFlippedCard, false);
            currentlyFlippedCard = null;
        }
    }
  
      // Ensure all inactive cards are unflipped
      function ensureProperCardStates() {
          // First, check if we have a flipped card that's not the active card
          if (currentlyFlippedCard && 
              flipCards[activeCardIndex] !== currentlyFlippedCard) {
            
            // Reset the incorrectly flipped card
            resetFlippedCard();
            
            // If we're currently looking at a card that should be flipped,
            // make sure it's properly flipped
            const activeCard = flipCards[activeCardIndex];
            if (activeCard.classList.contains('flipped')) {
              currentlyFlippedCard = activeCard;
              adjustCardHeight(activeCard, true);
            }
          }
      }
  });