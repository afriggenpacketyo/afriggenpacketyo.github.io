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

        // Scroll to center the card
        cardToScrollTo.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center'
        });

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
        }, 400); // Match scroll animation duration
    }

    // --- updateActiveCardDuringScroll (Dynamic Activation) ---
    function updateActiveCardDuringScroll() {
        // Don't update if manually flipping
        if (isManuallyFlipping) return;

        const containerRect = container.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;
        let closestDistance = Infinity;
        let newActiveIndex = -1;

        flipCards.forEach((card, index) => {
            const cardRect = card.getBoundingClientRect();
            const cardCenter = cardRect.left + cardRect.width / 2;
            const distance = Math.abs(containerCenter - cardCenter);

            if (distance < closestDistance) {
                closestDistance = distance;
                newActiveIndex = index;
            }
        });

        if (newActiveIndex !== -1 && newActiveIndex !== activeCardIndex) {
            activeCardIndex = newActiveIndex;
            updateUI();
        }
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
            // Snap to nearest card
            updateActiveCardDuringScroll();
        }
    }, { passive: true });

    // --- Keyboard Navigation ---
    document.addEventListener('keydown', (e) => {
        // Skip if on mobile
        if (isMobile) return;

        if (e.key === 'ArrowLeft' && activeCardIndex > 0) {
            scrollToCard(activeCardIndex - 1);
        } else if (e.key === 'ArrowRight' && activeCardIndex < flipCards.length - 1) {
            scrollToCard(activeCardIndex + 1);
        } else if ((e.key === 'Enter' || e.key === ' ') && !isScrolling) {
            // Simulate a click on the active card when Enter or Space is pressed
            const activeCard = flipCards[activeCardIndex];
            if (activeCard) {
                // Prevent default space scrolling behavior
                e.preventDefault();

                // CRITICAL: Set manual flipping flag
                isManuallyFlipping = true;

                // Clear any scroll timeouts
                clearTimeout(scrollEndTimeout);

                const shouldFlip = !activeCard.classList.contains('flipped');

                if (shouldFlip) {
                    // Expand and flip
                    adjustCardHeight(activeCard, true);
                    activeCard.classList.add('flipped');
                    currentlyFlippedCard = activeCard;
                } else {
                    // Unflip
                    activeCard.classList.remove('flipped');
                    adjustCardHeight(activeCard, false);
                    currentlyFlippedCard = null;
                }

                // Reset manual flipping flag after a delay
                setTimeout(() => {
                    isManuallyFlipping = false;
                }, 500);

                // Restore animations with a slight delay
                setTimeout(restoreAnimations, 50);
            }
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
  });