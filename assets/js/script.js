document.addEventListener('DOMContentLoaded', function() {
  const flipCards = document.querySelectorAll('.flip-card');
  const container = document.querySelector('.container');
  let isScrolling = false;
  let isMobile = window.innerWidth <= 768;
  let activeCardIndex = 0;
  let navArrows = [];

  // Add iPod classic coverflow style
  container.classList.add('with-coverflow');

  // Create card indicators
  const cardIndicator = document.createElement('div');
  cardIndicator.className = 'card-indicator';

  flipCards.forEach((_, index) => {
      const dot = document.createElement('div');
      dot.className = 'indicator-dot' + (index === 0 ? ' active' : '');
      dot.dataset.index = index;
      dot.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent card flipping when clicking dots
          scrollToCard(index);
      });
      cardIndicator.appendChild(dot);
  });

  document.body.appendChild(cardIndicator);

  // Add instructions overlay
  const instructionsOverlay = document.createElement('div');
  instructionsOverlay.className = 'instructions-overlay';
  instructionsOverlay.innerHTML = '<p>Swipe horizontally to browse articles<br>Tap a card to flip it</p>';
  document.body.appendChild(instructionsOverlay);

  // Hide instructions after 3 seconds
  setTimeout(() => {
    instructionsOverlay.style.opacity = '0';
    setTimeout(() => {
      instructionsOverlay.style.display = 'none';
    }, 500);
  }, 3000);

  // Only add navigation arrows on desktop
  if (!isMobile) {
  // Add navigation arrows
  const navLeft = document.createElement('div');
      navLeft.className = 'nav-arrow nav-left' + (activeCardIndex === 0 ? ' disabled' : '');
  navLeft.innerHTML = '&larr;';
      navLeft.setAttribute('aria-label', 'Previous card');

  const navRight = document.createElement('div');
      navRight.className = 'nav-arrow nav-right' + (activeCardIndex === flipCards.length - 1 ? ' disabled' : '');
  navRight.innerHTML = '&rarr;';
      navRight.setAttribute('aria-label', 'Next card');

  document.body.appendChild(navLeft);
  document.body.appendChild(navRight);

      navArrows = [navLeft, navRight];

      // Handle arrow navigation with debounce to prevent multiple rapid clicks
      let lastClickTime = 0;

      navLeft.addEventListener('click', (e) => {
          e.stopPropagation();
          const now = Date.now();
          if (now - lastClickTime < 500) return; // Debounce
          lastClickTime = now;

          if (activeCardIndex > 0) {
              scrollToCard(activeCardIndex - 1);
          }
      });

      navRight.addEventListener('click', (e) => {
          e.stopPropagation();
          const now = Date.now();
          if (now - lastClickTime < 500) return; // Debounce
          lastClickTime = now;

          if (activeCardIndex < flipCards.length - 1) {
              scrollToCard(activeCardIndex + 1);
          }
      });
  }

  // Use requestAnimationFrame for smoother scrolling
  let ticking = false;
  container.addEventListener('scroll', () => {
      if (!ticking && !isScrolling) {
          requestAnimationFrame(() => {
              updateActiveCard();
              ticking = false;
          });
          ticking = true;
      }
  });

  // Replace the existing scrollToCard function with this improved version
  function scrollToCard(index) {
      if (isScrolling || index < 0 || index >= flipCards.length) return;

      isScrolling = true;
      activeCardIndex = index;

      // Update indicator dots
      document.querySelectorAll('.indicator-dot').forEach((dot, i) => {
          dot.classList.toggle('active', i === index);
      });

      // Update arrow states
      if (!isMobile && navArrows.length === 2) {
          navArrows[0].classList.toggle('disabled', index === 0);
          navArrows[1].classList.toggle('disabled', index === flipCards.length - 1);
      }

      // Apply coverflow classes immediately for instant visual feedback
      flipCards.forEach((card, idx) => {
          // Remove all position classes
          card.classList.remove('active', 'left-1', 'left-2', 'right-1', 'right-2');

          // Add appropriate position class
          const distance = idx - index;
          if (distance === 0) {
              card.classList.add('active');
          } else if (distance === -1) {
              card.classList.add('left-1');
          } else if (distance === -2) {
              card.classList.add('left-2');
          } else if (distance === 1) {
              card.classList.add('right-1');
          } else if (distance === 2) {
              card.classList.add('right-2');
          }
      });

      // Get the target card and ensure perfect centering
      const targetCard = flipCards[index];

      // Calculate the exact center position
      const containerWidth = container.offsetWidth;
      const cardWidth = targetCard.offsetWidth;
      const cardMargin = parseInt(window.getComputedStyle(targetCard).marginRight) * 2;

      // Calculate the exact scroll position to center the card
      // This formula ensures perfect centering regardless of card width or container size
      const scrollPosition = targetCard.offsetLeft - (containerWidth / 2) + (cardWidth / 2);

      // Use scrollTo with smooth behavior for a controlled animation
      container.scrollTo({
          left: scrollPosition,
          behavior: 'smooth'
      });

      // Reset scrolling flag after animation completes
      setTimeout(() => {
          isScrolling = false;

          // Force a final position check to ensure perfect centering
          const finalAdjustment = targetCard.offsetLeft - (containerWidth / 2) + (cardWidth / 2);
          if (Math.abs(container.scrollLeft - finalAdjustment) > 2) {
              container.scrollTo({
                  left: finalAdjustment,
                  behavior: 'auto' // Instant correction if needed
              });
          }
      }, 400); // Match the transition duration
  }

  // Add a debounced scroll handler to make scrolling less sensitive
  let scrollTimeout;
  let lastScrollPosition = 0;
  const scrollThreshold = 50; // Minimum scroll distance to trigger a card change

  container.addEventListener('scroll', () => {
      if (isScrolling) return;

      // Clear any existing timeout
      if (scrollTimeout) {
          clearTimeout(scrollTimeout);
      }

      // Set a new timeout
      scrollTimeout = setTimeout(() => {
          // Only process if we've scrolled a significant amount
          const currentScrollPosition = container.scrollLeft;
          const scrollDifference = Math.abs(currentScrollPosition - lastScrollPosition);

          if (scrollDifference > scrollThreshold) {
              updateActiveCard();
              lastScrollPosition = currentScrollPosition;
          }
      }, 150); // Longer delay makes it less sensitive
  });

  // Update the updateActiveCard function to ensure perfect centering
  function updateActiveCard() {
      if (isScrolling) return;

      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;

      let closestDistance = Infinity;
      let newActiveIndex = activeCardIndex;

      // Find the card closest to center
      flipCards.forEach((card, index) => {
          const cardRect = card.getBoundingClientRect();
          const cardCenter = cardRect.left + cardRect.width / 2;
          const distance = Math.abs(containerCenter - cardCenter);

          if (distance < closestDistance) {
              closestDistance = distance;
              newActiveIndex = index;
          }
      });

      // If we found a new active card and it's significantly different from current position
      if (newActiveIndex !== activeCardIndex && closestDistance < 100) {
          // Scroll to the new card to ensure perfect centering
          scrollToCard(newActiveIndex);
      }
  }

  // Add touch handling to make mobile experience more deliberate
  let touchStartX = 0;
  let touchEndX = 0;
  const minSwipeDistance = 50; // Minimum distance for a swipe

  container.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
      if (isScrolling) return;

      touchEndX = e.changedTouches[0].screenX;
      const distance = touchEndX - touchStartX;

      // Only respond to deliberate swipes
      if (Math.abs(distance) > minSwipeDistance) {
          if (distance > 0 && activeCardIndex > 0) {
              // Swipe right -> go to previous card
              scrollToCard(activeCardIndex - 1);
          } else if (distance < 0 && activeCardIndex < flipCards.length - 1) {
              // Swipe left -> go to next card
              scrollToCard(activeCardIndex + 1);
          }
      }
  }, { passive: true });

  // Add keyboard navigation
  document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' && activeCardIndex > 0) {
          scrollToCard(activeCardIndex - 1);
      } else if (e.key === 'ArrowRight' && activeCardIndex < flipCards.length - 1) {
          scrollToCard(activeCardIndex + 1);
      }
  });

  // Handle window resize for mobile/desktop detection
  window.addEventListener('resize', () => {
      const wasMobile = isMobile;
      isMobile = window.innerWidth <= 768;

      // If switching between mobile and desktop, refresh the page
      // This is a simple solution to handle the arrows appearance/disappearance
      if (wasMobile !== isMobile) {
          location.reload();
      }
  });

  // Process each card with improved click handling
  flipCards.forEach((card, index) => {
    const inner = card.querySelector('.flip-card-inner');
    const front = card.querySelector('.flip-card-front');
    const back = card.querySelector('.flip-card-back');

      // Add click event listener to flip the card with improved handling
    card.addEventListener('click', function(e) {
          // Don't flip if clicking on a link or during scroll
          if (e.target.tagName === 'A' || isScrolling) return;

          // Don't flip if this was a scroll attempt (detect small drag)
          if (e.clientX && this.dataset.mouseDownX) {
              const dragDistance = Math.abs(e.clientX - parseInt(this.dataset.mouseDownX));
              if (dragDistance > 5) return; // User was trying to scroll
          }

          // Toggle flipped class on the card itself to match CSS selector
          this.classList.toggle('flipped');

      // Adjust height for content if needed
      if (this.classList.contains('flipped')) {
        // If content is taller than card, adjust height
        const contentHeight = back.scrollHeight;
        if (contentHeight > 400) {
          this.style.height = contentHeight + 'px';
          inner.style.height = contentHeight + 'px';
        }
      } else {
        // Reset height when flipping back
        setTimeout(() => {
          this.style.height = '400px';
          inner.style.height = '100%';
        }, 150);
      }
    });

      // Track mouse down position to differentiate between clicks and drags
      card.addEventListener('mousedown', function(e) {
          this.dataset.mouseDownX = e.clientX;
      });

      card.addEventListener('touchstart', function(e) {
          if (e.touches && e.touches[0]) {
              this.dataset.mouseDownX = e.touches[0].clientX;
          }
      });

    // Style optimism scores
    const scoreText = back.querySelector('p:nth-of-type(2)');
    if (scoreText && scoreText.textContent.includes('/100')) {
      const score = parseInt(scoreText.textContent);
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

    // Add section titles to other elements
    const summaryTitle = document.createElement('div');
    summaryTitle.className = 'section-title';
    summaryTitle.textContent = 'Summary';

    const linkTitle = document.createElement('div');
    linkTitle.className = 'section-title';
    linkTitle.textContent = 'Source';

    // Insert titles before content
    const summaryText = back.querySelector('p:first-of-type');
    if (summaryText) {
      summaryText.parentNode.insertBefore(summaryTitle, summaryText);
    }

    const linkElement = back.querySelector('a');
    if (linkElement) {
      linkElement.parentNode.insertBefore(linkTitle, linkElement);
    }
  });

  // Add this to preload and optimize images
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

  // Initial setup with reduced timeout
  setTimeout(() => {
      // Apply initial coverflow classes
      flipCards.forEach((card, index) => {
          if (index === 0) {
              card.classList.add('active');
          } else if (index === 1) {
              card.classList.add('right-1');
          } else if (index === 2) {
              card.classList.add('right-2');
          }
      });

      // Initial scroll to first card
      scrollToCard(0);
  }, 50); // Reduced from 100ms to 50ms
});