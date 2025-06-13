// --- START OF FILE mobile.js ---
// Mobile-specific implementation
(function() {
    // --- ENSURE MANUAL SCROLL RESTORATION ON MOBILE BROWSERS ---
    var ua = navigator.userAgent.toLowerCase();
    var isMobile = /iphone|ipad|ipod|android/.test(ua);
    if (isMobile && typeof window !== 'undefined' && 'scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  })();
  (function() {
      // Immediate logo blocking for landscape mode
      const styleBlocker = document.createElement('style');
      styleBlocker.id = 'initial-logo-block';
      styleBlocker.textContent = `
          /* Logo visible by default */
          .logo-container {
              opacity: 1;
              visibility: visible;
              display: block;
          }

          /* Only hide for mobile landscape */
          @media (max-height: 500px) and (min-width: 400px) and (max-width: 1024px) and (orientation: landscape) and (hover: none) and (pointer: coarse) {
              .logo-container {
                  opacity: 0 !important;
                  visibility: hidden !important;
                  display: none !important;
              }
          }
      `;
      document.head.appendChild(styleBlocker);

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

      // Add these variables for overlay functionality
      let isAnyCardFlipped = false;
      let cardOverlay = null;
      let overlayContent = null;
      let currentOverlayCard = null;
      let isOverlayActive = false;
      let preactivatedCard = null;
      let previouslyActiveCard = null;
      let visibilityThreshold = 0.4; // Adjust this value as needed (40% visibility)

      // Add these variables at the top
      let resizeDebounceTimer = null;
      let layoutRecalculationInProgress = false;
      let wasLandscape = window.innerWidth > window.innerHeight;

      // Override CardSystem's updateUI method to include our dot updates
      const originalUpdateUI = CardSystem.updateUI;
      CardSystem.updateUI = function() {
          // Call original method first
          originalUpdateUI.call(this);

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
      }

      /**
       * REVISED: This is the core navigation function for mobile.
       * The key fix is in the `else` block for `shouldAnimate`, where it now
       * correctly resets the state flags for instant moves.
       */
      function moveToCard(index, shouldAnimate = true) {
          // Cancel any ongoing animations to make the carousel interruptible.
          if (isAnimating) {
              clearTimeout(container._animationResetTimer);
              container.style.transition = 'none';
              container.scrollLeft = getCurrentCardScrollPosition();
              void container.offsetWidth; // Force reflow
          }

          // Ensure index is valid and refers to a visible card.
          if (index < 0 || index >= flipCards.length || !flipCards[index]) return;
          if (flipCards[index].classList.contains('filtered')) {
              console.warn(`Attempted to move to a filtered card at index ${index}. Aborting.`);
              return;
          }

          // Store the pending target card index
          pendingCardIndex = index;

          // Update CardSystem state
          CardSystem.activeCardIndex = index;

          // Update UI elements like active classes and highlights
          CardSystem.updateUI();
          resetCardHighlights();

          // Get the target card and calculate its centered position
          const targetCard = flipCards[index];
          if (!targetCard) return;
          const containerWidth = container.offsetWidth;
          const cardWidth = targetCard.offsetWidth;
          const cardLeft = targetCard.offsetLeft;
          let targetScrollLeft = cardLeft - (containerWidth - cardWidth) / 2;

          // Prevent scrolling past the carousel boundaries
          const maxScroll = container.scrollWidth - container.offsetWidth;
          targetScrollLeft = Math.max(0, Math.min(maxScroll, targetScrollLeft));

          // Apply animation or perform an instant move
          if (shouldAnimate) {
              container.style.scrollBehavior = 'smooth';
              container.style.transition = `all ${TRANSITION_DURATION}ms ${RECENTERING_EASING}`;
              isAnimating = true;
              swipeInProgress = true;
          } else {
              container.style.scrollBehavior = 'auto';
              container.style.transition = 'none';

              // *** THE FIX ***
              // Explicitly reset all state flags for instant moves. This prevents the
              // swiping mechanism from getting stuck after a filter is applied.
              isAnimating = false;
              swipeInProgress = false;
              pendingCardIndex = -1;
              if(container._animationResetTimer) {
                  clearTimeout(container._animationResetTimer);
              }
          }

          // Execute the scroll
          container.scrollLeft = targetScrollLeft;

          // Set a timer to clean up flags after an animated move
          if (shouldAnimate) {
              container._animationResetTimer = setTimeout(() => {
                  isAnimating = false;
                  swipeInProgress = false;
                  pendingCardIndex = -1;
                  container.style.scrollBehavior = 'auto';
                  container.style.transition = '';

                  // Ensure final position is pixel-perfect after animation
                  const finalScrollLeft = Math.max(0, Math.min(maxScroll, targetScrollLeft));
                  if (Math.abs(container.scrollLeft - finalScrollLeft) > 1) {
                      container.scrollLeft = finalScrollLeft;
                  }
              }, TRANSITION_DURATION + 50);
          }
      }

      // Move to next card (Instagram-style) - skip filtered cards
      function moveToNextCard() {
          const nextIndex = CardSystem.findNextVisibleIndex(CardSystem.activeCardIndex);
          moveToCard(nextIndex);
      }

      // Move to previous card (Instagram-style) - skip filtered cards
      function moveToPrevCard() {
          const prevIndex = CardSystem.findPrevVisibleIndex(CardSystem.activeCardIndex);
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
        if (CardSystem.isFiltering) return;
          if (!isTouchActive || CardSystem.currentlyFlippedCard) return;

          if (this._touchMoveRAF) {
              cancelAnimationFrame(this._touchMoveRAF);
          }

          this._touchMoveRAF = requestAnimationFrame(() => {
              touchCurrentX = e.touches[0].clientX;
              const touchDistance = touchCurrentX - touchStartX;
              const currentDirection = Math.sign(touchDistance);

              let effectiveDistance = touchDistance;
              if ((CardSystem.activeCardIndex === 0 && touchDistance > 0) || (CardSystem.activeCardIndex === flipCards.length - 1 && touchDistance < 0)) {
                  effectiveDistance = touchDistance * 0.3;
              }

              currentDragOffset = effectiveDistance;
              container.scrollLeft = initialScrollLeft - currentDragOffset;

              if (!this._currentCardWidth) {
                  this._currentCardWidth = flipCards[CardSystem.activeCardIndex].offsetWidth;
              }
              const cardWidth = this._currentCardWidth;
              const progress = Math.abs(effectiveDistance) / (cardWidth * POSITION_THRESHOLD);

              const targetedCard = document.querySelector('.card-targeted');

              if (progress < 0.5) {
                  if (targetedCard) {
                      resetCardHighlights();
                  }
              } else {
                  // *** THIS IS THE CRITICAL FIX FOR SWIPE-PREVIEW ***
                  if (currentDirection < 0) { // Swiping left
                      const nextVisibleIndex = CardSystem.findNextVisibleIndex(CardSystem.activeCardIndex);
                      if (nextVisibleIndex !== CardSystem.activeCardIndex) {
                          highlightTargetCard(flipCards[nextVisibleIndex]);
                      }
                  } else if (currentDirection > 0) { // Swiping right
                      const prevVisibleIndex = CardSystem.findPrevVisibleIndex(CardSystem.activeCardIndex);
                      if (prevVisibleIndex !== CardSystem.activeCardIndex) {
                          highlightTargetCard(flipCards[prevVisibleIndex]);
                      }
                  }
              }
          });
          e.preventDefault();
      };

      container._touchendHandler = function(e) {
        if (CardSystem.isFiltering) return;
          // Clean up RAF to prevent memory leaks
          if (this._touchMoveRAF) {
              cancelAnimationFrame(this._touchMoveRAF);
              this._touchMoveRAF = null;
          }

          this._currentCardWidth = null;

          if (!isTouchActive || CardSystem.currentlyFlippedCard) {
              isTouchActive = false;
              return;
          }

          touchEndX = e.changedTouches[0].clientX;
          const touchDuration = Date.now() - touchStartTime;
          const touchDistance = touchEndX - touchStartX;
          const absTouchDistance = Math.abs(touchDistance);

          const currentCard = flipCards[CardSystem.activeCardIndex];
          if (!currentCard) {
              isTouchActive = false;
              return;
          }

          const cardWidth = currentCard.offsetWidth;
          const thresholdDistance = cardWidth * POSITION_THRESHOLD;

          // If a card was pre-activated during the swipe, finalize that move.
          if (document.querySelector('.card-targeted')) {
              finalizeCardActivation();
              isTouchActive = false;
              return;
          }

          // Otherwise, determine the target based on swipe distance and speed.
          let targetIndex = CardSystem.activeCardIndex;
          const isSwipe = absTouchDistance > thresholdDistance || (touchDuration < SWIPE_TIMEOUT && absTouchDistance > SWIPE_THRESHOLD);

          if (isSwipe) {
              // *** USE FILTER-AWARE HELPERS FOR SWIPE NAVIGATION ***
              if (touchDistance > 0) { // Right swipe
                  targetIndex = CardSystem.findPrevVisibleIndex(CardSystem.activeCardIndex);
              } else { // Left swipe
                  targetIndex = CardSystem.findNextVisibleIndex(CardSystem.activeCardIndex);
              }
          }

          // Always snap back, either to the new card or the original one.
          resetCardHighlights();
          moveToCard(targetIndex, true); // Animate the snap

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
                  transition: opacity 0.25s ease !important;
              `;

              highlightTargetCard.inactiveStyle = `
                  opacity: 0.7 !important;
                  transition: opacity 0.25s ease !important;
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
                  transition: opacity 0.25s ease !important;
              `;

              resetCardHighlights.inactiveStyle = `
                  opacity: 0.7 !important;
                  transition: opacity 0.25s ease !important;
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

      // (Removed: this is not needed with correct CSS-only solution)

      // Function to toggle card flip state
      function toggleCardFlip(card) {
          // Get current state
          const isFlipped = card.classList.contains('flipped');
          const shouldFlip = !isFlipped;

          // Set flags
          CardSystem.isManuallyFlipping = true;

          // Check if we're on mobile/tablet using a more comprehensive check
          const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                                window.matchMedia("(max-width: 1024px)").matches ||
                                ('ontouchstart' in window);

          // If it's a mobile device OR specifically Safari Mobile/Chrome Mobile, use overlay
          if (isMobileDevice ||
              document.body.classList.contains('safari-mobile') ||
              document.body.classList.contains('chrome-android') ||
              document.body.classList.contains('chrome-ios') ||
              document.body.classList.contains('webview') ||
              document.body.classList.contains('wkwebview')) {

              if (shouldFlip) {
                  // Show in overlay instead of flipping
                  openOverlay(card);
              } else if (isOverlayActive) {
                  // Close overlay instead of unflipping
                  closeOverlay();
              }
              return; // Exit early, don't do regular flip
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

      function centerFirstCardAfterPadding() {
          const firstCard = flipCards[0];
          if (!firstCard) return;
          const containerWidth = container.offsetWidth;
          const cardWidth = firstCard.offsetWidth;
          // Center the first card, accounting for the new left padding
          const targetScrollLeft = firstCard.offsetLeft - (containerWidth - cardWidth) / 2;
          container.scrollLeft = targetScrollLeft;
      }

      // Ensure edge card padding is added during initialization
      if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function() {
              addEdgeCardPadding();
              // Use setTimeout to ensure DOM updates before measuring
              setTimeout(centerFirstCardAfterPadding, 0);
          });
      } else {
          addEdgeCardPadding();
          setTimeout(centerFirstCardAfterPadding, 0);
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
          if (!logoContainer) return;
      // Add this function for consistent aspect ratio detectionn    function isPhoneLandscape() {n        const mediaQuery = window.matchMedia("(max-height: 500px) and (min-width: 400px) and (max-width: 1024px) and (orientation: landscape) and (hover: none) and (pointer: coarse)");n        return mediaQuery.matches;n    }n
          // Only hide if it's a phone in landscape or we're explicitly hiding
          if (isPhoneLandscape() || !show) {
              logoContainer.style.opacity = '0';
              logoContainer.style.visibility = 'hidden';
          } else {
              // Show in all other cases
              // Only reset visibility/opacity/display/transition, let CSS handle appearance
  logoContainer.style.opacity = '1';
  logoContainer.style.visibility = 'visible';
  logoContainer.style.display = '';
  logoContainer.style.transition = 'opacity 0.3s ease'; // Reset to default visible state
          }
      }

      // Function to set appropriate logo position class
      function setLogoPositionClass() {
          // Logo positioning logic removed as requested
          // We're keeping the function to maintain any references to it
          // but removing all the actual positioning logic
          return;
      }

      // Update the initLogoVisibility function to check for landscape mode on load
      function initLogoVisibility() {
          const logoContainer = document.querySelector('.logo-container');
          if (!logoContainer) return;

          // Start with default visible state
          // Only reset visibility/opacity/display/transition, let CSS handle appearance
  logoContainer.style.opacity = '1';
  logoContainer.style.visibility = 'visible';
  logoContainer.style.display = '';
  logoContainer.style.transition = 'opacity 0.3s ease';

          // Only hide if card is flipped
          isAnyCardFlipped = CardSystem.currentlyFlippedCard !== null || isOverlayActive;
          if (isAnyCardFlipped) {
              logoContainer.style.opacity = '0';
              logoContainer.style.visibility = 'hidden';
          }
      }

      // Update the toggleLogoVisibility function to use our shared isPhoneLandscape function
      function toggleLogoVisibility(show) {
          const logoContainer = document.querySelector('.logo-container');
          if (!logoContainer) return;

          // Use our shared function for consistent detection
          if (isPhoneLandscape()) {
              // Force immediate hiding with !important styles for phones in landscape
              logoContainer.style.opacity = '0';
  logoContainer.style.visibility = 'hidden';
  logoContainer.style.transition = 'none';
  logoContainer.style.display = 'none';
              console.log("toggleLogoVisibility - hiding logo for landscape");
              return;
          }

          // Normal behavior for portrait or tablets/desktops
          if (show) {
              // Reset any !important styles first
              // Only reset visibility/opacity/display/transition, let CSS handle appearance
  logoContainer.style.opacity = '1';
  logoContainer.style.visibility = 'visible';
  logoContainer.style.display = '';
  logoContainer.style.transition = 'opacity 0.3s ease';
              logoContainer.style.opacity = '1';
              logoContainer.style.visibility = 'visible';
              logoContainer.style.display = '';
              logoContainer.style.transition = 'opacity 0.3s ease';
          } else {
              // Reset any !important styles first
              // Only reset visibility/opacity/display/transition, let CSS handle appearance
  logoContainer.style.opacity = '1';
  logoContainer.style.visibility = 'visible';
  logoContainer.style.display = '';
  logoContainer.style.transition = 'opacity 0.3s ease';
              logoContainer.style.opacity = '0';
              logoContainer.style.visibility = 'hidden';
              logoContainer.style.transition = 'opacity 0.3s ease';
          }
      }

      // Add this function to completely recalculate logo position from scratch
      function calculateAndPositionLogo(forceHideFirst = false) {
          // Logo positioning calculation logic removed as requested
          // We're keeping the function to maintain any references to it
          // but removing all the actual positioning logic
          return false;
      }

      // Update the orientation change handler
      window.addEventListener('orientationchange', function() {
          console.log("Orientation change detected");

          // Delay recalculation to ensure measurements are accurate after rotation
          setTimeout(() => {
              const isCurrentlyLandscape = isPhoneLandscape();
              console.log("Is landscape after orientation change:", isCurrentlyLandscape);

              // Update header visibility based on orientation
              updateHeaderVisibility();

              // Update logo visibility based on orientation
              if (isCurrentlyLandscape) {
                  toggleLogoVisibility(false);
              } else if (!isAnyCardFlipped && !isOverlayActive) {
                  toggleLogoVisibility(true);
              }

              // Force card positioning
              enforceCardPosition(CardSystem.activeCardIndex, isCurrentlyLandscape);

              // Update wasLandscape state for next orientation change
              wasLandscape = isCurrentlyLandscape;
          }, 150);
      });

      // Add this function to ensure logo positioning is correct when coming from landscape
      function forceLogoRepositioning() {
          if (isPhoneLandscape()) return; // Skip if we're still in landscape

          const logoContainer = document.querySelector('.logo-container');
          const header = document.querySelector('header');
          const activeCard = flipCards[CardSystem.activeCardIndex];

          if (!logoContainer || !header || !activeCard) return;

          // First hide the logo
          logoContainer.style.transition = 'none';
          logoContainer.style.opacity = '0';

          // Force reflow
          void document.documentElement.offsetHeight;
          void header.offsetHeight;
          void activeCard.offsetHeight;

          // Calculate the proper position
          const headerRect = header.getBoundingClientRect();
          const cardRect = activeCard.getBoundingClientRect();
          const headerBottom = headerRect.bottom;
          const cardTop = cardRect.top;
          const midPoint = headerBottom + ((cardTop - headerBottom) / 2);

          // Set position while still invisible
          logoContainer.style.position = 'fixed';
          logoContainer.style.top = `${midPoint}px`;
          logoContainer.style.left = '50%';
          logoContainer.style.transform = 'translate(-50%, -50%)';

          // Store position
          finalLogoPosition = midPoint;

          // Force another reflow
          void logoContainer.offsetHeight;

          // Now fade in
          setTimeout(() => {
              if (isAnyCardFlipped || isOverlayActive) return; // Don't show if a card is flipped

              logoContainer.style.transition = 'opacity 0.3s ease';
              logoContainer.style.opacity = '1';
              logoContainer.style.visibility = 'visible';

              console.log("Force repositioned logo at: ", midPoint);
          }, 50);
      }

      // Update the resize handler to use our improved functions
      window.addEventListener('resize', function() {
          clearTimeout(resizeDebounceTimer);
          resizeDebounceTimer = setTimeout(() => {
              // Update header visibility
              updateHeaderVisibility();

              // Detect orientation change
              const currentOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
              const orientationChanged = currentOrientation !== lastScreenOrientation;
              const wasLandscape = lastScreenOrientation === 'landscape';
              const nowPortrait = currentOrientation === 'portrait';

              // Update orientation tracking
              lastScreenOrientation = currentOrientation;

              console.log(`Resize detected: ${window.innerWidth}x${window.innerHeight}`);
              console.log(`Orientation: was ${lastScreenOrientation}, now ${currentOrientation}`);

              // Check for landscape mode status
              const inLandscape = isPhoneLandscape();

              const logoContainer = document.querySelector('.logo-container');
              if (!logoContainer) return;

              if (inLandscape) {
                  // Hide logo in landscape
                  logoContainer.style.cssText = `
                      opacity: 0 !important;
                      visibility: hidden !important;
                      transition: none !important;
                      display: none !important;
                  `;
                  console.log("Resize - hiding logo for landscape");
              } else if (!isAnyCardFlipped && !isOverlayActive) {
                  // Special handling for landscape to portrait rotation through resize

                  // Standard resize in portrait mode - normal logo display
                  // Only reset visibility/opacity/display/transition, let CSS handle appearance
  logoContainer.style.opacity = '1';
  logoContainer.style.visibility = 'visible';
  logoContainer.style.display = '';
  logoContainer.style.transition = 'opacity 0.3s ease';
                  logoContainer.style.opacity = '1';
                  logoContainer.style.visibility = 'visible';
                  logoContainer.style.display = '';
              }

              // Only run layout recalculation if we haven't already done it
              if (!(wasLandscape && nowPortrait)) {
                  if (orientationChanged) {
                      recalculateEntireLayout();
                  } else {
                      // For minor changes, just ensure cards are centered
                      moveToCard(CardSystem.activeCardIndex, false);
                  }
              }
          }, 150);
      });

      // Enhanced initialization function with proper waitForCardMeasurements
      async function initialize() {
          console.log("Initializing mobile card system...");

          // Check landscape mode and update header visibility immediately
          const startInLandscape = isPhoneLandscape();
          updateHeaderVisibility();

          // Even if in landscape, we'll still calculate positions as if the logo is there
          const logoContainer = document.querySelector('.logo-container');
          if (logoContainer) {
              // Just control visibility, not position calculations
              if (startInLandscape) {
                  logoContainer.style.opacity = '0';
                  logoContainer.style.visibility = 'hidden';
              }
          }


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

                  // Before making elements visible in step 8, check landscape mode again
                  // (in case it changed during initialization)
                  const nowInLandscape = isPhoneLandscape();

                  // STEP 8 modification: Handle logo visibility based on screen orientation
                  if (logoContainer) {
                      if (nowInLandscape) {
                          // Keep logo hidden for landscape
                          logoContainer.style.cssText = `
                              opacity: 0 !important;
                              visibility: hidden !important;
                              transition: none !important;
                              display: none !important;
                          `;
                      } else {
                          // Show logo for portrait
                          logoContainer.style.visibility = 'visible';
                          logoContainer.style.opacity = '1';
                      }
                  }

                  // After initial setup, enforce card position
                  const isLandscape = isPhoneLandscape();
                  enforceCardPosition(CardSystem.activeCardIndex, isLandscape);

                  console.log("Core initialization complete - clean fade-in.");
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

              // Append elements
              overlayContent.appendChild(closeButton);
              cardOverlay.appendChild(overlayContent);
              // Create swipe indicator and append as direct child of overlayContent
              const swipeIndicator = document.createElement('div');
              swipeIndicator.className = 'swipe-indicator';
              swipeIndicator.textContent = '';
              overlayContent.appendChild(swipeIndicator);
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

          // CRITICAL: Reset scroll position on all scrollable elements within the clone
          // This ensures Safari mobile doesn't remember previous scroll positions
          const scrollableElements = contentClone.querySelectorAll('*');
          scrollableElements.forEach(element => {
              if (element.scrollTop) {
                  element.scrollTop = 0;
              }
          });

          // Also reset the clone's scroll position
          contentClone.scrollTop = 0;

          contentWrapper.appendChild(contentClone);

          // Add the content wrapper to the overlay
          overlayContent.appendChild(contentWrapper);

          // Reset overlay content scroll position
          overlayContent.scrollTop = 0;

          // Ensure only one swipe indicator as direct child of overlayContent
          let swipeIndicator = overlayContent.querySelector('.swipe-indicator');
          if (!swipeIndicator) {
              swipeIndicator = document.createElement('div');
              swipeIndicator.className = 'swipe-indicator';
              swipeIndicator.textContent = '';
              overlayContent.appendChild(swipeIndicator);
          }

          // Immediately hide the original card and set background to prevent flash
          if (currentOverlayCard) {
              currentOverlayCard.style.visibility = 'hidden';
              currentOverlayCard.style.opacity = '0';
          }

          // Force a reflow before adding the active class
          void cardOverlay.offsetWidth;

          // Show the overlay - the background is handled by CSS
          cardOverlay.classList.add('active');
          isOverlayActive = true;

          // Hide header and logo
          toggleHeaderBanner(false);
          toggleLogoVisibility(false);

          // Hide indicators when overlay is opened
          const cardIndicator = document.querySelector('.card-indicator');
          if (cardIndicator) {
              cardIndicator.style.opacity = '0';
              cardIndicator.style.pointerEvents = 'none';
          }

          // Force scroll reset after a short delay to ensure it takes effect
          setTimeout(() => {
              overlayContent.scrollTop = 0;
              if (contentClone.scrollTop) {
                  contentClone.scrollTop = 0;
              }
          }, 50);

          // Prevent body scrolling
          document.body.style.overflow = 'hidden';

          updateScrollIndicator(overlayContent);
          overlayContent.addEventListener('scroll', () => {
              updateScrollIndicator(overlayContent);
          });
          // Attach swipe handlers to both overlayContent and cardOverlay for Chrome mobile compatibility
          if (cardOverlay && overlayContent) {
              // Remove existing listeners first to avoid duplicates
              cardOverlay.removeEventListener('touchstart', handleOverlayTouchStart);
              cardOverlay.removeEventListener('touchmove', handleOverlayTouchMove);
              cardOverlay.removeEventListener('touchend', handleOverlayTouchEnd);
              overlayContent.removeEventListener('touchstart', handleOverlayTouchStart);
              overlayContent.removeEventListener('touchmove', handleOverlayTouchMove);
              overlayContent.removeEventListener('touchend', handleOverlayTouchEnd);

              // Add listeners
              cardOverlay.addEventListener('touchstart', handleOverlayTouchStart, { passive: false });
              cardOverlay.addEventListener('touchmove', handleOverlayTouchMove, { passive: false });
              cardOverlay.addEventListener('touchend', handleOverlayTouchEnd, { passive: false });
              overlayContent.addEventListener('touchstart', handleOverlayTouchStart, { passive: false });
              overlayContent.addEventListener('touchmove', handleOverlayTouchMove, { passive: false });
              overlayContent.addEventListener('touchend', handleOverlayTouchEnd, { passive: false });
          }
      }

      // Function to close the overlay
      function closeOverlay() {
          if (!cardOverlay || !isOverlayActive) return;

          // Prevent multiple calls
          if (closeOverlay.isClosing) return;
          closeOverlay.isClosing = true;

          // Store a reference to the current overlay card before nulling it
          const overlayCard = currentOverlayCard;

          cardOverlay.classList.remove('active');
          isOverlayActive = false;

          // Reset card states
          CardSystem.currentlyFlippedCard = null;
          isAnyCardFlipped = false;

          // Restore the card's visibility if it exists
          if (overlayCard) {
              overlayCard.style.visibility = '';
              overlayCard.style.opacity = '';
              overlayCard.style.transition = '';
          }

          // Clear the reference after restoring visibility
          currentOverlayCard = null;

          const currentlyInPortrait = !isPhoneLandscape();
          console.log(`Closing overlay. Currently in Portrait: ${currentlyInPortrait}`);

          // Update header visibility first
          updateHeaderVisibility();

          // CRITICAL FIX: Check if indicators are visible
          const cardIndicator = document.querySelector('.card-indicator');
          if (cardIndicator) {
              // Get computed style to check actual visibility
              const computedStyle = window.getComputedStyle(cardIndicator);
              const isVisible = computedStyle.opacity !== '0' &&
                               computedStyle.visibility !== 'hidden' &&
                               computedStyle.display !== 'none';

              if (!isVisible) {
                  // Only update if indicators aren't already visible
                  cardIndicator.style.opacity = '1';
                  cardIndicator.style.visibility = 'visible';
                  cardIndicator.style.pointerEvents = 'auto';

                  // Force a reflow to ensure the visibility update takes effect
                  void cardIndicator.offsetHeight;

              }
          }


          // Ensure body scrolling is re-enabled
          document.body.style.overflow = '';

          // Force a reflow and update layout
          requestAnimationFrame(() => {
              if (currentlyInPortrait) {
                  console.log("closeOverlay: Showing header, indicators, logo because in portrait.");
                  toggleLogoVisibility(true);
                  recalculateEntireLayout(true);
              }
              closeOverlay.isClosing = false;
          });
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
                  CardSystem.findNextVisibleIndex(currentIndex) :
                  CardSystem.findPrevVisibleIndex(currentIndex);

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

      // Add this event handler to specifically address Safari mobile focus issues
      window.addEventListener('focus', function() {
          // Add a small delay to ensure the browser has fully restored the view
          setTimeout(() => {
              // Only recalculate if we're not in a flipped card state
              if (!isAnyCardFlipped && !isOverlayActive) {
                  console.log("Focus event: Fixing logo position");

                  // Hide the logo immediately
                  const logoContainer = document.querySelector('.logo-container');
                  if (logoContainer) {
                      logoContainer.style.transition = 'none';
                      logoContainer.style.opacity = '0';

                      // Short timeout to ensure browser is ready
                      setTimeout(() => {
                          // Apply class-based positioning
                          setLogoPositionClass();

                          // Fade logo back in
                          logoContainer.style.transition = 'opacity 0.3s ease';
                          logoContainer.style.opacity = '1';

                          console.log("Logo position restored after focus");
                      }, 100);
                  }
              }
          }, 100);
      });

      // Also add a resize handler to catch manual resizing on desktop or iPad split-screen changes
      window.addEventListener('resize', function() {
          clearTimeout(resizeDebounceTimer);
          resizeDebounceTimer = setTimeout(() => {
              // Check aspect ratio on resize too
              const viewportWidth = window.innerWidth;
              const viewportHeight = window.innerHeight;
              const aspectRatio = viewportWidth / viewportHeight;
              const isPhoneLandscape = aspectRatio > 1.7 && viewportHeight < 500 && viewportWidth < 1024;

              const logoContainer = document.querySelector('.logo-container');
              if (!logoContainer) return;

              if (isPhoneLandscape) {
                  // Force hiding for phone landscape during resize
                  logoContainer.style.cssText = `
                      opacity: 0 !important;
                      visibility: hidden !important;
                      transition: none !important;
                      display: none !important;
                  `;
              } else if (!isAnyCardFlipped) {
                  // Show logo if not a phone landscape and no card is flipped
                  // Only reset visibility/opacity/display/transition, let CSS handle appearance
  logoContainer.style.opacity = '1';
  logoContainer.style.visibility = 'visible';
  logoContainer.style.display = '';
  logoContainer.style.transition = 'opacity 0.3s ease';
                  logoContainer.style.opacity = '1';
                  logoContainer.style.visibility = 'visible';
                  logoContainer.style.display = '';
              }

              // The existing resize handler calls recalculateEntireLayout for orientation changes
              // and moveToCard for other resize events
          }, 150);
      });

      // Single function to update logo position via CSS variables
      function updateLogoPositionVariables() {
          const header = document.querySelector('header');
          const activeCard = flipCards[CardSystem.activeCardIndex];

          if (!header || !activeCard) return;

          // Force reflow for accurate measurements
          void header.offsetHeight;
          void activeCard.offsetHeight;

          // Get measurements
          const headerRect = header.getBoundingClientRect();
          const cardRect = activeCard.getBoundingClientRect();

          // Update CSS variables
          document.documentElement.style.setProperty('--header-bottom', `${headerRect.bottom}px`);
          document.documentElement.style.setProperty('--card-top', `${cardRect.top}px`);
      }

      // Update orientation change handler
      window.addEventListener('orientationchange', function() {
          const logoContainer = document.querySelector('.logo-container');
          if (!logoContainer) return;

          // Hide logo during transition
          logoContainer.style.opacity = '0';

          setTimeout(() => {
              const isInLandscape = isPhoneLandscape();

              if (!isInLandscape && !isAnyCardFlipped && !isOverlayActive) {
                  // Update position variables
                  updateLogoPositionVariables();

                  // Show logo with transition
                  requestAnimationFrame(() => {
                      logoContainer.style.transition = 'opacity 0.3s ease';
                      logoContainer.style.opacity = '1';
                  });
              }
          }, 150);
      });

      // Add this function to recalculate layout without logo positioning
      function recalculateEntireLayout(showLogoAfterRecalc = true) {
          if (layoutRecalculationInProgress) return;
          layoutRecalculationInProgress = true;

          const isLandscape = isPhoneLandscape();
          enforceCardPosition(CardSystem.activeCardIndex, isLandscape);

          if (!isLandscape && showLogoAfterRecalc) {
              requestAnimationFrame(() => {
                  toggleLogoVisibility(true);
              });
          } else if (isLandscape) {
              toggleLogoVisibility(false);
          }

          layoutRecalculationInProgress = false;
      }

      // Add this function for consistent card positioning
      function enforceCardPosition(index, isLandscape) {
          // Disable all transitions temporarily
          container.style.transition = 'none';
          container.style.scrollBehavior = 'auto';

          // Force reflow
          void container.offsetHeight;

          // Get target card and its dimensions
          const targetCard = flipCards[index];
          const containerWidth = container.offsetWidth;
          const cardWidth = targetCard.offsetWidth;

          // Calculate center position with landscape-specific adjustments
          let targetScrollLeft;
          if (isLandscape) {
              // In landscape, we want to ensure the card is perfectly centered
              targetScrollLeft = targetCard.offsetLeft - (containerWidth - cardWidth) / 2;
          } else {
              // Normal portrait positioning
              targetScrollLeft = targetCard.offsetLeft - (containerWidth - cardWidth) / 2;
          }

          // Apply position immediately without animation
          container.scrollLeft = targetScrollLeft;

          // Force another reflow
          void container.offsetHeight;

          return targetScrollLeft;
      }

      // Update the orientation change handler
      window.addEventListener('orientationchange', function() {
          console.log("Orientation change detected");

          // Delay recalculation to ensure measurements are accurate after rotation
          setTimeout(() => {
              const isCurrentlyLandscape = isPhoneLandscape();
              console.log("Is landscape after orientation change:", isCurrentlyLandscape);

              // Update header visibility based on orientation
              updateHeaderVisibility();

              // Update logo visibility based on orientation
              if (isCurrentlyLandscape) {
                  toggleLogoVisibility(false);
              } else if (!isAnyCardFlipped && !isOverlayActive) {
                  toggleLogoVisibility(true);
              }

              // Force card positioning
              enforceCardPosition(CardSystem.activeCardIndex, isCurrentlyLandscape);

              // Update wasLandscape state for next orientation change
              wasLandscape = isCurrentlyLandscape;
          }, 150);
      });

      // Update the updateScrollIndicator function
      function updateScrollIndicator(overlayContent) {
          const indicator = overlayContent.querySelector('.swipe-indicator');
          if (!indicator) return;

          // Create text element if it doesn't exist
          if (!indicator.querySelector('.scroll-text')) {
              const textEl = document.createElement('span');
              textEl.className = 'scroll-text';
              textEl.textContent = 'scroll for more';
              indicator.appendChild(textEl);
          }

          const textEl = indicator.querySelector('.scroll-text');
          const isOverflowing = overlayContent.scrollHeight > overlayContent.clientHeight;
          const isAtBottom = Math.abs(overlayContent.scrollHeight - overlayContent.scrollTop - overlayContent.clientHeight) < 1;

          // Update text based on conditions
          const isSafari = document.body.classList.contains('safari-mobile') ||
                          document.body.classList.contains('safari-desktop');

          if (!isOverflowing || isAtBottom) {
              textEl.textContent = 'end';
          } else {
              textEl.textContent = 'scroll for more';
          }
      }

      // Function to handle header visibility based on orientation and app state
      function updateHeaderVisibility() {
          const header = document.querySelector('header');
          if (!header) return;

          const isLandscape = isPhoneLandscape();
          const shouldHideHeader = isLandscape || isAnyCardFlipped || isOverlayActive;

          // Always reset all styles first
          header.style.cssText = '';

          // Reset all children elements
          const headerElements = header.querySelectorAll('*');
          headerElements.forEach(el => {
              el.style.pointerEvents = '';
              el.style.touchAction = '';
          });

          if (shouldHideHeader) {
              // In landscape or when card/overlay is active, hide header but make it non-interactive
              header.style.cssText = `
                  opacity: 0 !important;
                  visibility: hidden !important;
                  pointer-events: none !important;
                  touch-action: none !important;
                  position: absolute !important;
                  z-index: -1 !important;
              `;

              // Ensure all children are non-interactive
              headerElements.forEach(el => {
                  el.style.pointerEvents = 'none';
                  el.style.touchAction = 'none';
              });
          } else {
              // In portrait with no active states, show header with full interactivity
              header.style.opacity = '1';
              header.style.visibility = 'visible';
              header.style.pointerEvents = 'auto';
              header.style.touchAction = 'auto';
              header.style.position = '';
              header.style.zIndex = '';
          }

          // Force a reflow to ensure styles are applied
          void header.offsetHeight;
      }

      // Update the orientation change handler
      window.addEventListener('orientationchange', function() {
          console.log("Orientation change detected");

          // Delay recalculation to ensure measurements are accurate after rotation
          setTimeout(() => {
              const isCurrentlyLandscape = isPhoneLandscape();
              console.log("Is landscape after orientation change:", isCurrentlyLandscape);

              // Update header visibility based on orientation
              updateHeaderVisibility();

              // Update logo visibility based on orientation
              if (isCurrentlyLandscape) {
                  toggleLogoVisibility(false);
              } else if (!isAnyCardFlipped && !isOverlayActive) {
                  toggleLogoVisibility(true);
              }

              // Force card positioning
              enforceCardPosition(CardSystem.activeCardIndex, isCurrentlyLandscape);

              // Update wasLandscape state for next orientation change
              wasLandscape = isCurrentlyLandscape;
          }, 150);
      });

      // Update the updateScrollIndicator function
      function updateScrollIndicator(overlayContent) {
          const indicator = overlayContent.querySelector('.swipe-indicator');
          if (!indicator) return;

          // Create text element if it doesn't exist
          if (!indicator.querySelector('.scroll-text')) {
              const textEl = document.createElement('span');
              textEl.className = 'scroll-text';
              textEl.textContent = 'scroll for more';
              indicator.appendChild(textEl);
          }

          const textEl = indicator.querySelector('.scroll-text');
          const isOverflowing = overlayContent.scrollHeight > overlayContent.clientHeight;
          const isAtBottom = Math.abs(overlayContent.scrollHeight - overlayContent.scrollTop - overlayContent.clientHeight) < 1;

          // Update text based on conditions
          const isSafari = document.body.classList.contains('safari-mobile') ||
                          document.body.classList.contains('safari-desktop');

          if (!isOverflowing || isAtBottom) {
              textEl.textContent = 'end';
          } else {
              textEl.textContent = 'scroll for more';
          }
      }

      // Add this function for consistent aspect ratio detection
      function isPhoneLandscape() {
          const mediaQuery = window.matchMedia('(max-height: 500px) and (min-width: 400px) and (max-width: 1024px) and (orientation: landscape) and (hover: none) and (pointer: coarse)');
          return mediaQuery.matches;
      }

      // Prevent touchmove events from scrolling outside the overlay when overlay is open
      window.addEventListener('touchmove', function(e) {
          const overlayActive = document.querySelector('.card-overlay.active');
          if (overlayActive) {
              // If the event target is not inside the overlay-content, prevent scroll
              if (!e.target.closest('.overlay-content')) {
                  e.preventDefault();
              }
          }
      }, { passive: false });

      // --- Overlay Scroll Bleed Prevention ---
      function preventScrollBleed(overlay, overlayContent) {
          overlay.addEventListener('touchmove', function(e) {
              // If overlayContent does not overflow, prevent scroll
              if (overlayContent.scrollHeight <= overlayContent.clientHeight) {
                  e.preventDefault();
              }
          }, { passive: false });
      }

      // Patch into overlay open logic
      const originalOpenOverlay = openOverlay;
      openOverlay = function(card) {
          originalOpenOverlay(card);
          if (typeof cardOverlay !== 'undefined' && typeof overlayContent !== 'undefined') {
              preventScrollBleed(cardOverlay, overlayContent);
          }
      }

      // === PROFESSIONAL MOBILE LAYOUT FIXES ===
      // 1. Viewport Height CSS Variable Patch (100vh bug)
      function setVhVar() {
          document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
      }
      setVhVar();

      // 2. Debounced Layout Recalculation
      function recalcLayout() {
          setVhVar();
          // 3. Card Re-centering on Resume
          if (window.CardSystem && typeof window.CardSystem.updateUI === 'function') {
              window.CardSystem.updateUI();
          }
          // Optionally, force a reflow
          document.body.offsetHeight;
      }
      let resizeDebounceTimerPro = null;
      function recalcLayoutDebounced() {
          clearTimeout(resizeDebounceTimerPro);
          resizeDebounceTimerPro = setTimeout(recalcLayout, 80);
      }
      window.addEventListener('resize', recalcLayoutDebounced);
      window.addEventListener('orientationchange', recalcLayoutDebounced);
      document.addEventListener('visibilitychange', () => {
          if (!document.hidden) recalcLayout();
      });
      // === END PROFESSIONAL MOBILE LAYOUT FIXES ===

      // === DYNAMIC HEADER/LOGO LAYOUT SYNC FIX ===
      function updateContainerPaddingAndCenterCards() {
          const header = document.querySelector('.page-header');
          const logo = document.querySelector('.logo-container');
          const container = document.querySelector('.container');
          if (!header || !logo || !container) return;

          // Get actual heights
          const headerHeight = header.offsetHeight;
          const logoHeight = logo.offsetHeight;
          const totalOffset = headerHeight + logoHeight + 16; // 16px for spacing

          // Set container padding-top dynamically
          container.style.paddingTop = totalOffset + 'px';

          // Now recenter cards
          if (window.CardSystem && typeof window.CardSystem.updateUI === 'function') {
              window.CardSystem.updateUI();
          }
      }

      // Ensure logo image is loaded before measuring
      const logoImg = document.querySelector('.site-logo');
      if (logoImg && !logoImg.complete) {
          logoImg.addEventListener('load', updateContainerPaddingAndCenterCards);
      } else {
          updateContainerPaddingAndCenterCards();
      }

      // Also run on resize/orientationchange
      window.addEventListener('resize', updateContainerPaddingAndCenterCards);
      window.addEventListener('orientationchange', updateContainerPaddingAndCenterCards);
      // === END DYNAMIC HEADER/LOGO LAYOUT SYNC FIX ===

      // --- EXPOSE PUBLIC METHODS ---
      // Make key functions available to other scripts like filters.js
      window.CardSystem.moveToCard = moveToCard;
      window.CardSystem.resetCardHighlights = resetCardHighlights;
      // --- END EXPOSE PUBLIC METHODS ---
  })();

  // Browser detection for Safari vs Chrome positioning
  (function() {
    // More reliable browser detection for mobile
    function detectBrowser() {
      const userAgent = navigator.userAgent.toLowerCase();

      // iOS Detection
      if (/iphone|ipad|ipod/.test(userAgent)) {
          // iOS WKWebView (must check first)
          if ((/wkwebview/.test(userAgent)) ||
              (/^mozilla\/.*applewebkit.*mobile.*$/i.test(userAgent) && !/safari/.test(userAgent))) {
              return 'wkwebview';
          }
          // Chrome iOS
          if (/crios/.test(userAgent)) {
              return 'chrome-ios';
          }
          // iOS Safari
          if (/safari/.test(userAgent) && !(/crios/.test(userAgent)) && !(/fxios/.test(userAgent))) {
              return 'safari-mobile';
          }
      }

      // Android Detection
      if (/android/.test(userAgent)) {
          // Android WebView
          if (/wv/.test(userAgent) ||
              (/version\//.test(userAgent) && /chrome/.test(userAgent))) {
              return 'webview';
          }
          // Regular Chrome Android
          if (/chrome/.test(userAgent) && !(/firefox/.test(userAgent))) {
              return 'chrome-android';
          }
      }

      // Desktop browsers
      if (!(/android|iphone|ipad|ipod/.test(userAgent))) {
          if (/safari/.test(userAgent) && !(/chrome/.test(userAgent))) {
              return 'safari-desktop';
          }
          if (/chrome/.test(userAgent) && !(/edge|edg|firefox/.test(userAgent))) {
              return 'chrome-desktop';
          }
      }

      return 'other-browser';
    }

    // Update applyBrowserClass to handle WebView classes
    function applyBrowserClass() {
      const browserType = detectBrowser();

      // Remove all browser classes first
      document.body.classList.remove(
          'safari-mobile', 'chrome-ios', 'chrome-android',
          'safari-desktop', 'chrome-desktop', 'other-browser',
          'safari-browser', 'chrome-browser', 'webview', 'wkwebview'
      );

      // Add detected browser class
      document.body.classList.add(browserType);

      // Add the general browser family class
      if (browserType.includes('safari') || browserType === 'wkwebview') {
          document.body.classList.add('safari-browser');
      } else if (browserType.includes('chrome') || browserType === 'webview') {
          document.body.classList.add('chrome-browser');
      }

      console.log('Browser detected:', browserType);
    }

    // Run on page load
    if (document.readyState === 'complete') {
      applyBrowserClass();
      // === AUTO SCROLL TO TOP FOR SAFARI/CHROME MOBILE ===
      if (['safari-mobile', 'chrome-ios', 'chrome-android'].includes(detectBrowser())) {
        window.scrollTo(0, 0);
      }
      // === END AUTO SCROLL TO TOP ===
    } else {
      window.addEventListener('load', function() {
        applyBrowserClass();
        // === AUTO SCROLL TO TOP FOR SAFARI/CHROME MOBILE ===
        if (['safari-mobile', 'chrome-ios', 'chrome-android'].includes(detectBrowser())) {
          window.scrollTo(0, 0);
        }
        // === END AUTO SCROLL TO TOP ===
      });
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
    window.CardSystem.moveToCard = moveToCard;
      window.CardSystem.resetCardHighlights = resetCardHighlights;
  })();
// --- END OF FILE mobile.js ---