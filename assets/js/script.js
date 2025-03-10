// script.js
document.addEventListener('DOMContentLoaded', function() {
  const flipCards = document.querySelectorAll('.flip-card');
  const container = document.querySelector('.container');
  let isMobile = window.innerWidth <= 768;
  let activeCardIndex = 0;
  let navArrows = [];
  let isScrolling = false;
  let scrollTimeout; // Declare scrollTimeout here

  // Add iPod classic coverflow style
  container.classList.add('with-coverflow');

  // --- Card Indicator Setup ---
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

  // --- Navigation Arrows (Desktop Only) ---
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

      // Debounced arrow click handlers
      let lastClickTime = 0;
      const handleClick = (direction) => {
          const now = Date.now();
          if (now - lastClickTime < 500) return;
          lastClickTime = now;

          let newIndex = activeCardIndex + direction;
          if (newIndex >= 0 && newIndex < flipCards.length) {
              scrollToCard(newIndex);
          }
      };
      navLeft.addEventListener('click', () => handleClick(-1));
      navRight.addEventListener('click', () => handleClick(1));
  }

  // --- Scroll Handling ---
  container.addEventListener('scroll', () => {
      if (isScrolling) return;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (!isScrolling) { // Double-check isScrolling within the timeout
          updateActiveCard();
        }
      }, 50); // Reduced timeout for faster response
  }, { passive: true });

  // --- scrollToCard (Improved) ---
  function scrollToCard(index) {
      if (index < 0 || index >= flipCards.length || index === activeCardIndex || isScrolling) return;

      isScrolling = true;
      activeCardIndex = index;

      // Update UI elements
      updateUI();
      flipCards[index].scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
      });

      // IMPORTANT: Adjust timeout to match the scrollIntoView animation duration.
      // This prevents rapid clicks/taps from queuing up multiple scrolls.
      // A shorter timeout is generally better, as long as it's slightly *longer*
      // than the scroll animation.
      setTimeout(() => {
          isScrolling = false;
        }, 350);
  }

  // --- updateActiveCard (Less Aggressive) ---
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
         scrollToCard(newActiveIndex);
      }
  }


  // --- updateUI (Centralized UI Updates) ---
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

  // --- Touch Handling (for Mobile) ---
  let touchStartX = 0;
  let touchEndX = 0;
  const minSwipeDistance = 50;

  container.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const distance = touchEndX - touchStartX;

      if (Math.abs(distance) > minSwipeDistance) {
          if (distance > 0 && activeCardIndex > 0) {
              scrollToCard(activeCardIndex - 1);
          } else if (distance < 0 && activeCardIndex < flipCards.length - 1) {
              scrollToCard(activeCardIndex + 1);
          }
      } else {
          // If it wasn't a swipe, treat it like a tap to center the nearest card
          updateActiveCard();
      }
  }, { passive: true });

  // --- Keyboard Navigation ---
  document.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' && activeCardIndex > 0) {
          scrollToCard(activeCardIndex - 1);
      } else if (e.key === 'ArrowRight' && activeCardIndex < flipCards.length - 1) {
          scrollToCard(activeCardIndex + 1);
      }
  });

  // --- Window Resize Handling ---
  window.addEventListener('resize', () => {
      const wasMobile = isMobile;
      isMobile = window.innerWidth <= 768;
      if (wasMobile !== isMobile) {
          location.reload(); // Simple solution for mobile/desktop switch
      }
  });

  // --- Card Flip and Content Handling ---
  flipCards.forEach((card, index) => {
      const inner = card.querySelector('.flip-card-inner');
      const front = card.querySelector('.flip-card-front');
      const back = card.querySelector('.flip-card-back');

      // --- Click to Focus Card ---
      card.addEventListener('click', function(e) {
          // Prevent flipping if clicking a link or if already scrolling
          if (e.target.tagName === 'A' || isScrolling) return;

          // Check for drag (prevent flip on accidental drag)
            if (e.clientX && this.dataset.mouseDownX) {
                const dragDistance = Math.abs(e.clientX - parseInt(this.dataset.mouseDownX));
                if (dragDistance > 5) return; // User was trying to scroll
            }

          // --- Focus the card if it's not already active ---
            if (!this.classList.contains('active')) {
                scrollToCard(index);
          } else {
                // Toggle flipped class ONLY if already active
                this.classList.toggle('flipped');
            }

          //Adjust Height
          if (this.classList.contains('flipped')) {
            const contentHeight = back.scrollHeight;
              if (contentHeight > 400) {
                this.style.height = contentHeight + 'px';
                inner.style.height = contentHeight + 'px';
              }
          } else {
            // Reset height. Use a timeout that matches your CSS transition
            setTimeout(() => {
                this.style.height = '400px';
                inner.style.height = '100%';
              }, 600); // Match the CSS .flip-card.flipped .flip-card-inner transition
          }
      });

       // Track mouse/touch start position to differentiate clicks and drags
      card.addEventListener('mousedown', function(e) { this.dataset.mouseDownX = e.clientX; });
      card.addEventListener('touchstart', function(e) {
          if (e.touches && e.touches[0]) { this.dataset.mouseDownX = e.touches[0].clientX; }
      }, {passive: true});

      // Style optimism scores
      const scoreText = back.querySelector('p:nth-of-type(2)');
      if (scoreText) {
        const scoreMatch = scoreText.textContent.match(/(\d+)\/100/);
          if (scoreMatch) {
            const score = parseInt(scoreMatch[1]);
            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'optimism-score';
            scoreSpan.textContent = score + '/100'; // Keep the /100

            if (score >= 70) {
              scoreSpan.classList.add('score-high');
            } else if (score >= 40) {
              scoreSpan.classList.add('score-medium');
            } else {
              scoreSpan.classList.add('score-low');
            }

            scoreText.innerHTML = 'Optimism Score: '; // Clear original text
            scoreText.appendChild(scoreSpan);
          }
      }

      // Add section titles
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
                  img.src = img.dataset.src; // Set src after loading
              };
          }
      });
  };
  preloadImages();

  // --- Initial Setup ---
  setTimeout(() => {
      updateUI();
      scrollToCard(0);
  }, 50);
});