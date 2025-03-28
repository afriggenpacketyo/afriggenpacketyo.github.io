// Global variables and utility functions shared between implementations
window.CardSystem = {
    // DOM elements
    flipCards: document.querySelectorAll('.flip-card'),
    container: document.querySelector('.container'),

    // State variables
    activeCardIndex: 0,
    currentlyFlippedCard: null,
    isManuallyFlipping: false,
    isUserClicking: false,

    // Dot indicator properties
    visibleStartIndex: 0,
    visibleRange: 9, // Show 9 dots at a time
    previousDirection: 0, // 0 = initial, 1 = right, -1 = left
    previousActiveIndex: 0,

    // Utility functions
    updateUI: function() {
        this.flipCards.forEach((card, i) => {
            card.classList.toggle('active', i === this.activeCardIndex);
        });

        document.querySelectorAll('.indicator-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === this.activeCardIndex);
        });

        // Only handle indicator visibility if no card is currently being dragged
        if (!this.currentlyFlippedCard) {
            const cardIndicator = document.querySelector('.card-indicator');
            if (cardIndicator) {
                cardIndicator.style.opacity = '1';
                cardIndicator.style.pointerEvents = 'auto';
            }
        }

        // Add dot updates
        this.updateInstagramStyleDots(this.activeCardIndex);
    },

    resetFlippedCard: function() {
        if (this.currentlyFlippedCard) {
            const flippedCardIndex = Array.from(this.flipCards).indexOf(this.currentlyFlippedCard);

            if (flippedCardIndex !== this.activeCardIndex) {
                this.currentlyFlippedCard.classList.remove('flipped');
                this.adjustCardHeight(this.currentlyFlippedCard, false);
                this.currentlyFlippedCard = null;

                const cardIndicator = document.querySelector('.card-indicator');
                if (cardIndicator) {
                    cardIndicator.style.opacity = '1';
                    cardIndicator.style.pointerEvents = 'auto';
                }
            }
        }
    },

    adjustCardHeight: function(card, setHeight = false) {
        const inner = card.querySelector('.flip-card-inner');
        const back = card.querySelector('.flip-card-back');
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
    },

    addSectionTitles: function() {
        this.flipCards.forEach(card => {
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
    },

    preloadImages: function() {
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
    },

    // Setup card indicator
    setupCardIndicator: function() {
        const cardIndicator = document.createElement('div');
        cardIndicator.className = 'card-indicator';

        this.flipCards.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.className = 'indicator-dot' + (index === 0 ? ' active' : '');
            dot.dataset.index = index;
            dot.textContent = (index + 1).toString();
            cardIndicator.appendChild(dot);
        });

        document.body.appendChild(cardIndicator);
        return cardIndicator;
    },

    // Initialize common elements
    init: function() {
        // Add coverflow class
        this.container.classList.add('with-coverflow');

        // Setup card indicator
        this.setupCardIndicator();

        // Preload images
        this.preloadImages();

        // Add section titles
        this.addSectionTitles();

        // Initial UI update
        this.updateUI();

        console.log("CardSystem initialized");
    },

    // Add these methods to CardSystem
    updateInstagramStyleDots: function(activeIndex) {
        const dots = document.querySelectorAll('.indicator-dot');
        const totalDots = dots.length;

        // Determine swipe direction (-1 for left, 1 for right)
        const currentDirection = (activeIndex > this.previousActiveIndex) ? 1 : -1;

        // Track if this is a direct dot click vs. a scroll
        const isDotClick = Math.abs(activeIndex - this.previousActiveIndex) > 1;

        // Handle window sliding
        if (activeIndex < this.visibleStartIndex + 2) {
            this.visibleStartIndex = Math.max(0, activeIndex - 2);
        } else if (activeIndex > this.visibleStartIndex + this.visibleRange - 3) {
            this.visibleStartIndex = Math.min(totalDots - this.visibleRange, activeIndex - (this.visibleRange - 3));
        }

        // Update all dots
        dots.forEach((dot, index) => {
            // For dot clicks, use a single smooth transition
            if (isDotClick) {
                dot.style.transition = 'all 0.3s ease';
            } else {
                // For scrolling/swiping, use normal transition
                dot.style.transition = activeIndex === this.previousActiveIndex ? 'none' : 'all 0.3s ease';
            }
            this.updateDotState(dot, index, activeIndex);
        });

        // Save values for next update
        this.previousActiveIndex = activeIndex;
        this.previousDirection = currentDirection;
    },

    updateDotState: function(dot, index, activeIndex) {
        // Remove existing classes
        dot.classList.remove('size-small', 'size-mid', 'size-large', 'size-active', 'visible');

        // Check if dot should be visible
        const isVisible = (index >= this.visibleStartIndex &&
                         index < this.visibleStartIndex + this.visibleRange);

        if (isVisible) {
            dot.classList.add('visible');

            if (index === activeIndex) {
                dot.classList.add('size-active');
            } else if (index === this.visibleStartIndex || index === (this.visibleStartIndex + this.visibleRange - 1)) {
                if ((activeIndex === this.visibleStartIndex + 1 && index === this.visibleStartIndex) ||
                    (activeIndex === this.visibleStartIndex + this.visibleRange - 2 && index === this.visibleStartIndex + this.visibleRange - 1)) {
                    dot.classList.add('size-mid');
                } else {
                    dot.classList.add('size-small');
                }
            } else if (index === this.visibleStartIndex + 1) {
                if (activeIndex === this.visibleStartIndex || activeIndex === this.visibleStartIndex + 1) {
                    dot.classList.add('size-large');
                } else {
                    dot.classList.add('size-mid');
                }
            } else if (index === this.visibleStartIndex + this.visibleRange - 2) {
                if (activeIndex === this.visibleStartIndex + this.visibleRange - 1 ||
                    activeIndex === this.visibleStartIndex + this.visibleRange - 2) {
                    dot.classList.add('size-large');
                } else {
                    dot.classList.add('size-mid');
                }
            } else {
                dot.classList.add('size-large');
            }
        }
    },

    // Add initialization for dots
    initializeDots: function() {
        // Setup card indicator click handlers
        const cardIndicator = document.querySelector('.card-indicator');
        if (cardIndicator) {
            cardIndicator.querySelectorAll('.indicator-dot').forEach((dot) => {
                dot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(dot.dataset.index);
                    this.activeCardIndex = index;
                    this.updateUI();
                });
            });
        }

        // Initialize dots
        this.updateInstagramStyleDots(this.activeCardIndex);
    }
};

// Initialize common functionality
window.CardSystem.init();

// Initialize dots when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    CardSystem.initializeDots();
});