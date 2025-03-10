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

  // Function to scroll to specific card with improved positioning
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

      // Calculate exact scroll position
      const card = flipCards[index];
      const containerRect = container.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();

      // Center the card in the container
      const scrollLeft = container.scrollLeft + (cardRect.left - containerRect.left) -
                        (containerRect.width / 2 - cardRect.width / 2);

      // Smooth scroll to the card
      container.scrollTo({
          left: scrollLeft,
          behavior: 'smooth'
      });

      // Reset scrolling flag after animation completes
      setTimeout(() => {
          isScrolling = false;
      }, 500);
  }

  // Function to determine the current active card based on scroll position
  function updateActiveCard() {
      if (isScrolling) return;

      const containerRect = container.getBoundingClientRect();
      const containerCenter = containerRect.left + containerRect.width / 2;

      let closestDistance = Infinity;
      let newActiveIndex = activeCardIndex;

      flipCards.forEach((card, index) => {
          const cardRect = card.getBoundingClientRect();
          const cardCenter = cardRect.left + cardRect.width / 2;
          const distance = Math.abs(containerCenter - cardCenter);

          if (distance < closestDistance) {
              closestDistance = distance;
              newActiveIndex = index;
          }
      });

      if (newActiveIndex !== activeCardIndex) {
          activeCardIndex = newActiveIndex;

          // Update indicator dots
          document.querySelectorAll('.indicator-dot').forEach((dot, i) => {
              dot.classList.toggle('active', i === activeCardIndex);
          });

          // Update arrow states
          if (!isMobile && navArrows.length === 2) {
              navArrows[0].classList.toggle('disabled', activeCardIndex === 0);
              navArrows[1].classList.toggle('disabled', activeCardIndex === flipCards.length - 1);
          }
      }
  }

  // Use a throttled scroll handler to improve performance
  let scrollTimeout;
  container.addEventListener('scroll', () => {
      if (scrollTimeout) {
          clearTimeout(scrollTimeout);
      }

      scrollTimeout = setTimeout(() => {
          if (!isScrolling) {
              updateActiveCard();
          }
      }, 100);
  });

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

  // Initial scroll to first card to ensure proper positioning
  setTimeout(() => {
      scrollToCard(0);
  }, 100);
});