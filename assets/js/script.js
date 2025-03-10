document.addEventListener('DOMContentLoaded', function() {
  const flipCards = document.querySelectorAll('.flip-card');

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

  // Add navigation arrows
  const navLeft = document.createElement('div');
  navLeft.className = 'nav-arrow nav-left';
  navLeft.innerHTML = '&larr;';

  const navRight = document.createElement('div');
  navRight.className = 'nav-arrow nav-right';
  navRight.innerHTML = '&rarr;';

  document.body.appendChild(navLeft);
  document.body.appendChild(navRight);

  // Handle arrow navigation
  navLeft.addEventListener('click', () => {
    const container = document.querySelector('.container');
    container.scrollBy({ left: -320, behavior: 'smooth' });
  });

  navRight.addEventListener('click', () => {
    const container = document.querySelector('.container');
    container.scrollBy({ left: 320, behavior: 'smooth' });
  });

  // Process each card
  flipCards.forEach(card => {
    const inner = card.querySelector('.flip-card-inner');
    const front = card.querySelector('.flip-card-front');
    const back = card.querySelector('.flip-card-back');

    // Add click event listener to flip the card
    card.addEventListener('click', function(e) {
      // Don't flip if clicking on a link
      if (e.target.tagName === 'A') return;

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
});