// Add initialization flag to prevent conflicts with mobile.js
let isInitializing = true;

// Comprehensive body locking utilities for all browsers
function applyBodyLock() {
  // Only store scroll position if body is not already locked
  // This prevents overwriting the original scroll position
  if (!document.body.classList.contains('menu-overlay-active')) {
    const currentScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
    document.documentElement.style.setProperty('--body-scroll-top', `-${currentScrollY}px`);
  }

  // Apply main body locking class
  document.body.classList.add('menu-overlay-active');

  // Add browser-specific classes for enhanced scroll prevention
  const isSafariMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) &&
                         /Safari/.test(navigator.userAgent) &&
                         !/Chrome|CriOS|FxiOS/.test(navigator.userAgent);
  const isChromeMobile = /Android/.test(navigator.userAgent) && /Chrome/.test(navigator.userAgent) ||
                         /iPhone|iPad|iPod/.test(navigator.userAgent) && /CriOS/.test(navigator.userAgent);

  if (isSafariMobile) {
    document.body.classList.add('safari-mobile-overlay-active');
    document.documentElement.classList.add('safari-mobile-overlay-active');
  }

  if (isChromeMobile) {
    document.body.classList.add('chrome-mobile-overlay-active');
    document.documentElement.classList.add('chrome-mobile-overlay-active');

    // Only apply additional Chrome mobile fixes if not already applied
    if (!document.body.style.position || document.body.style.position !== 'fixed') {
      const currentScrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;

      // Additional Chrome mobile fixes for keyboard handling
      document.body.style.position = 'fixed';
      document.body.style.top = `-${currentScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.height = '100vh';
      document.body.style.overflow = 'hidden';

      // Prevent viewport scaling on input focus
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport && !viewport.getAttribute('data-original-content')) {
        viewport.setAttribute('data-original-content', viewport.content);
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
      }
    }
  }
}

function removeBodyLock() {
  if (document.body.classList.contains('menu-overlay-active')) {
    const bodyScrollTop = document.documentElement.style.getPropertyValue('--body-scroll-top');
    const scrollY = bodyScrollTop ? parseInt(bodyScrollTop.replace('px', '').replace('-', '')) : 0;

    // Check if Chrome mobile fixes were applied
    const isChromeMobile = document.body.classList.contains('chrome-mobile-overlay-active');

    // Remove all body locking classes
    document.body.classList.remove('menu-overlay-active');
    document.body.classList.remove('safari-mobile-overlay-active');
    document.body.classList.remove('chrome-mobile-overlay-active');
    document.documentElement.classList.remove('safari-mobile-overlay-active');
    document.documentElement.classList.remove('chrome-mobile-overlay-active');

    // Clean up Chrome mobile specific styles
    if (isChromeMobile) {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.overflow = '';

      // Restore original viewport settings
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport && viewport.getAttribute('data-original-content')) {
        viewport.content = viewport.getAttribute('data-original-content');
        viewport.removeAttribute('data-original-content');
      }
    }

    // Restore scroll position synchronously with the next event loop
    document.documentElement.style.removeProperty('--body-scroll-top');
    // Use requestAnimationFrame instead of setTimeout(0) for better timing
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  }
}

// (This utility function remains the same but now uses removeBodyLock)
function unfreezeBody() {
  removeBodyLock();
}

// Auto-apply filters on page load if enabled
function autoApplyFiltersOnLoad() {
  // Don't auto-apply during initialization
  if (isInitializing) {
    console.log('Filters: Skipping auto-apply during initialization');
    return;
  }

  // Also check if CardSystem layout is ready
  if (!window.CardSystem.isLayoutReady) {
    console.log('Filters: CardSystem layout not ready, skipping auto-apply');
    return;
  }

  const shouldAutoApply = localStorage.getItem('autoApplyFilters') === 'true';
  const hasExcludes = localStorage.getItem('Excludes');

  if (shouldAutoApply && hasExcludes) {
    console.log('Filters: Auto-applying filters on page load...');
    applyFiltersQuietly();
  }
}

// Silent version of applyFilters that doesn't block touch events
function applyFiltersQuietly() {
  console.log('Filters: Applying filters quietly...');

  const excludes = (localStorage.getItem('Excludes') || '').toLowerCase();
  const hasFilters = !!excludes;

  if (!hasFilters) {
    showAllCardsQuietly();
  } else {
    filterCardsQuietly(excludes);
  }

  console.log("Filters: Quiet filtering complete.");
}

// Quiet versions that don't trigger full repositioning
function filterCardsQuietly(excludes) {
  const excludeTerms = excludes.split(',').map(term => term.trim()).filter(Boolean);
  let firstVisibleIndex = -1;

  // Apply the .filtered class to hide cards and find the first visible one
  CardSystem.flipCards.forEach((card, index) => {
    const summaryElement = card.querySelector('.flip-card-back p:first-of-type');
    const summary = summaryElement ? summaryElement.textContent.toLowerCase() : '';

    const shouldHide = excludeTerms.some(term => summary.includes(term));

    card.classList.toggle('filtered', shouldHide);

    if (!shouldHide && firstVisibleIndex === -1) {
      firstVisibleIndex = index;
    }
  });

  // Update the active index and center the first visible card
  if (firstVisibleIndex !== -1) {
    CardSystem.activeCardIndex = firstVisibleIndex;
    if (typeof CardSystem.updateUI === 'function') {
      CardSystem.updateUI();
    }

    // Let the platform-specific scripts handle positioning with error handling
    if (typeof CardSystem.moveToCard === 'function') {
      try {
        CardSystem.moveToCard(firstVisibleIndex, false); // false for instant move
      } catch (error) {
        console.warn('Filters: moveToCard failed during quiet filtering:', error);
      }
    } else if (typeof CardSystem.scrollToCard === 'function') {
      try {
        CardSystem.scrollToCard(firstVisibleIndex, false); // false for instant move
      } catch (error) {
        console.warn('Filters: scrollToCard failed during quiet filtering:', error);
      }
    }
  }
}

function showAllCardsQuietly() {
  console.log('Filters: No filters active, showing all cards quietly.');

  // Remove .filtered class from all cards
  CardSystem.flipCards.forEach(card => card.classList.remove('filtered'));

  // Update UI and center the first card
  CardSystem.activeCardIndex = 0;
  if (typeof CardSystem.updateUI === 'function') {
    CardSystem.updateUI();
  }

  // Let the platform-specific scripts handle positioning with error handling
  if (typeof CardSystem.moveToCard === 'function') {
    try {
      CardSystem.moveToCard(0, false); // false for instant move
    } catch (error) {
      console.warn('Filters: moveToCard failed during quiet show all:', error);
    }
  } else if (typeof CardSystem.scrollToCard === 'function') {
    try {
      CardSystem.scrollToCard(0, false); // false for instant move
    } catch (error) {
      console.warn('Filters: scrollToCard failed during quiet show all:', error);
    }
  }
}

// (The menu UI functions like showFilters, selectFilter, etc., can remain the same)
function showFilters() {
  const menuContent = document.querySelector('.menu-content');
  const overlay = document.getElementById('menu-overlay');

  if (!menuContent || !overlay) return;

  const menuLinks = menuContent.querySelectorAll('.original-menu a');
  const animationPromises = [];

  menuLinks.forEach((link, index) => {
    const promise = new Promise((resolve) => {
      link.classList.add('text-fade-blur');
      link.style.animationDelay = '0s'; // Remove extra delay for faster overlay
      link.style.animationDuration = '0.3s'; // Shorter fade for faster transition
      link.addEventListener('animationend', resolve, { once: true });
    });
    animationPromises.push(promise);
  });

  Promise.all(animationPromises).then(() => {
    const originalMenu = menuContent.querySelector('.original-menu');
    if (originalMenu) originalMenu.style.display = 'none';

    if (window.hamburgerMenu) window.hamburgerMenu.enterFilterMode();

    showFilterContent();
  });
}

function showFilterContent() {
  const menuContent = document.querySelector('.menu-content');
  let filterContent = menuContent.querySelector('.filter-content');

  if (!filterContent) {
    filterContent = document.createElement('div');
    filterContent.className = 'filter-content';
    filterContent.innerHTML = `
      <h3>Filter Options</h3>
      <div class="filter-options">
        <a href="#" class="filter-option" data-filter-type="excludes">Excludes</a>
        <a href="#" class="filter-option coming-soon" data-filter-type="includes">Includes<span class="coming-soon-text">Coming Soon</span></a>
        <a href="#" class="filter-option coming-soon" data-filter-type="topic">Topic<span class="coming-soon-text">Coming Soon</span></a>
        <a href="#" class="filter-option coming-soon" data-filter-type="optimism">Optimism Score<span class="coming-soon-text">Coming Soon</span></a>
      </div>
      <div class="filter-actions">
        <a href="#" onclick="goBackToMenu(); return false;" class="main-btn main-btn-secondary">Back</a>
        <a href="#" onclick="applyFilters(); return false;" class="main-btn">Apply</a>
      </div>
      <div class="auto-apply-option" style="margin: 1.5rem 0 0 0; padding: 1rem; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef; text-align: center;">
        <input type="checkbox" id="auto-apply-filters" style="margin-right: 0.5rem; transform: scale(1.2); vertical-align: middle;">
        <span id="auto-apply-label" style="cursor: pointer; display: inline-block; font-size: 1rem; color: #495057; vertical-align: middle;">Apply on refresh</span>
        <div class="info-btn-container" style="display: inline-block; position: relative; margin-left: 0.5rem; vertical-align: middle;">
          <button type="button" class="info-btn">i</button>
          <div class="info-tooltip">When enabled, your filter preferences will be automatically applied each time you visit the page</div>
        </div>
      </div>
    `;
    menuContent.appendChild(filterContent);

    filterContent.querySelectorAll('.filter-option').forEach(option => {
      option.addEventListener('click', (e) => {
        e.preventDefault();
        const filterType = e.currentTarget.dataset.filterType;
        if (!e.currentTarget.classList.contains('coming-soon')) {
          selectFilter(filterType);
        }
      });
    });

    // Add event listener for auto-apply checkbox and label
    const autoApplyCheckbox = filterContent.querySelector('#auto-apply-filters');
    const autoApplyLabel = filterContent.querySelector('#auto-apply-label');
    if (autoApplyCheckbox) {
      autoApplyCheckbox.checked = localStorage.getItem('autoApplyFilters') === 'true';
      autoApplyCheckbox.addEventListener('change', function() {
        localStorage.setItem('autoApplyFilters', this.checked.toString());
      });
    }
    if (autoApplyLabel && autoApplyCheckbox) {
      autoApplyLabel.addEventListener('click', function(e) {
        autoApplyCheckbox.checked = !autoApplyCheckbox.checked;
        autoApplyCheckbox.dispatchEvent(new Event('change'));
      });
    }

    // Add event listener for info button to prevent checkbox toggle
    const infoBtn = filterContent.querySelector('.info-btn');
    const infoBtnContainer = filterContent.querySelector('.info-btn-container');
    if (infoBtn && infoBtnContainer) {
      infoBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();

        // Handle mobile touch toggle
        if ('ontouchstart' in window) {
          infoBtnContainer.classList.toggle('show-tooltip');

          // Hide tooltip after 3 seconds on mobile
          setTimeout(() => {
            infoBtnContainer.classList.remove('show-tooltip');
          }, 3000);
        }
      });
    }
  }

  filterContent.style.display = 'block';

  // Handle the forward transition with JavaScript (like the back transition)
  // Set initial state
  filterContent.style.opacity = '0';
  filterContent.style.transform = 'scale(0.85)';
  filterContent.style.transition = 'transform 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s cubic-bezier(0.4,0,0.2,1)';

  // Force a reflow to ensure initial state is applied
  filterContent.offsetHeight;

  // Apply the final state
  setTimeout(() => {
    filterContent.style.opacity = '1';
    filterContent.style.transform = 'scale(1)';
  }, 0);

  // Clean up transition after animation completes
  setTimeout(() => {
    filterContent.style.transition = '';
  }, 400);

  // Refresh the button event listeners for the 3D effect
  if (window.hamburgerMenu && typeof window.hamburgerMenu.refreshMenuLinks === 'function') {
    window.hamburgerMenu.refreshMenuLinks();
  }
}

function selectFilter(filterType) {
  if (filterType === 'excludes') {
    showExcludesSubmenu();
  }
}

function showExcludesSubmenu() {
  const filterContent = document.querySelector('.filter-content');
  if (filterContent) filterContent.style.display = 'none';
  showExcludesContent();
}

function showExcludesContent() {
  const menuContent = document.querySelector('.menu-content');
  const existingExcludes = localStorage.getItem('Excludes') || '';

  let excludesContent = menuContent.querySelector('.excludes-content');
  if (!excludesContent) {
    excludesContent = document.createElement('div');
    excludesContent.className = 'excludes-content';
    excludesContent.innerHTML = `
      <h3>Exclude Terms</h3>
      <p style="font-size: 0.9rem; color: #666; margin-bottom: 1rem;">Skip article summaries with<br>these words (comma-separated):</p>
      <textarea id="excludes-input" placeholder="e.g., tariffs, drought" style="width: 100%; min-height: 100px; padding: 0.75rem; border: 2px solid #e9ecef; border-radius: 8px; font-size: 1rem; resize: vertical; font-family: inherit;">${existingExcludes}</textarea>
      <div class="excludes-actions" style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        <a href="#" onclick="goBackToFilters(); return false;" class="excludes-btn excludes-btn-secondary">Back</a>
        <a href="#" onclick="saveExcludes(event); return false;" class="excludes-btn">Save Excludes</a>
      </div>
    `;
    menuContent.appendChild(excludesContent);

    // Set up input event listeners immediately after creation
    setupExcludesInputListeners();
  } else {
    document.getElementById('excludes-input').value = existingExcludes;
  }

  excludesContent.style.display = 'block';

  // Reset save button state when showing excludes content
  const saveButton = excludesContent.querySelector('.excludes-btn:not(.excludes-btn-secondary)');
  if (saveButton) {
    // Clear any pending timeout and reset state
    if (saveButtonTimeout) {
      clearTimeout(saveButtonTimeout);
      saveButtonTimeout = null;
    }
    isSaveButtonActive = false;
    saveButton.textContent = 'Save Excludes';
    saveButton.style.background = '#dc3545';
  }

  // Refresh the button event listeners for the 3D effect
  if (window.hamburgerMenu && typeof window.hamburgerMenu.refreshMenuLinks === 'function') {
    window.hamburgerMenu.refreshMenuLinks();
  }

  // Apply body lock BEFORE focusing the input to prevent Chrome mobile keyboard issues
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobile) {
    // Body is already locked from hamburger menu, focus the input on next frame
    requestAnimationFrame(() => {
      const input = document.getElementById('excludes-input');
      if (input) {
        input.focus();
      }
    });
  } else {
    // Desktop - no auto-focus to preserve placeholder text until user clicks
    // User can manually click the textarea when ready to type
  }
}

// Separate function to set up input event listeners
function setupExcludesInputListeners() {
  const excludesInput = document.getElementById('excludes-input');
  if (!excludesInput) return;

  // Remove any existing listeners to prevent duplicates
  excludesInput.removeEventListener('focus', handleExcludesInputFocus);
  excludesInput.removeEventListener('blur', handleExcludesInputBlur);

  // Add new listeners
  excludesInput.addEventListener('focus', handleExcludesInputFocus);
  excludesInput.addEventListener('blur', handleExcludesInputBlur);
}

// Separate handler functions for better control
function handleExcludesInputFocus() {
  const overlay = document.querySelector('.excludes-content');
  if (overlay && overlay.style.display !== 'none') {
    // Ensure body lock is applied when input is focused on mobile devices
    // This is crucial for preventing keyboard-induced scrolling glitches
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      // Always reinforce body lock when textarea gets focus on mobile
      applyBodyLock();
    }
  }
}

function handleExcludesInputBlur() {
  // Don't remove body lock on blur - let the menu close handle it
  // This prevents the page from jumping when the user taps outside the input
}

function goBackToFilters() {
  const excludesContent = document.querySelector('.excludes-content');
  if (excludesContent) {
    excludesContent.style.display = 'none';

    // Clean up input listeners when hiding excludes content
    const excludesInput = document.getElementById('excludes-input');
    if (excludesInput) {
      excludesInput.removeEventListener('focus', handleExcludesInputFocus);
      excludesInput.removeEventListener('blur', handleExcludesInputBlur);
      excludesInput.blur(); // Ensure input loses focus
    }
  }

  showFilterContent();
}

// Variable to track save button state and timeout
let saveButtonTimeout = null;
let isSaveButtonActive = false;

function saveExcludes(event) {
  const textarea = document.getElementById('excludes-input');
  if (!textarea) return;

  // Prevent multiple clicks while save is in progress
  if (isSaveButtonActive) return;

  localStorage.setItem('Excludes', textarea.value.trim());

  const saveButton = event.target;
  const originalText = 'Save Excludes'; // Always use the known original text

  // Set button state
  isSaveButtonActive = true;
  saveButton.textContent = 'Saved!';
  saveButton.style.background = '#28a745';

  // Clear any existing timeout
  if (saveButtonTimeout) {
    clearTimeout(saveButtonTimeout);
  }

  // Set new timeout
  saveButtonTimeout = setTimeout(() => {
    saveButton.textContent = originalText;
    saveButton.style.background = '#dc3545';
    isSaveButtonActive = false;
    // Clean up timeout
    if (saveButtonTimeout) {
      clearTimeout(saveButtonTimeout);
      saveButtonTimeout = null;
    }
    isSaveButtonActive = false;
    saveButton.textContent = originalText;
    saveButton.style.background = '#dc3545';
  }, 1500);
}

function goBackToMenu() {
  // Don't remove body lock - the hamburger menu is still open
  // unfreezeBody(); // REMOVED - this was causing the body to unlock
  const menuContent = document.querySelector('.menu-content');
  const filterContent = document.querySelector('.filter-content');
  if (filterContent && filterContent.classList.contains('active')) {
    // Coming back from Filter Options: blur/fade in all at once
    filterContent.style.display = 'none';
    if (window.hamburgerMenu) window.hamburgerMenu.exitFilterMode();
    const originalMenu = menuContent ? menuContent.querySelector('.original-menu') : null;
    if (originalMenu) {
      const menuLinks = originalMenu.querySelectorAll('a');
      menuLinks.forEach(link => {
        link.style.opacity = '0';
        link.style.filter = 'blur(8px)';
        link.style.transition = 'opacity 0.4s cubic-bezier(0.4,0,0.2,1), filter 0.4s cubic-bezier(0.4,0,0.2,1)';
      });
      originalMenu.style.display = '';
      setTimeout(() => {
        menuLinks.forEach(link => {
          link.style.opacity = '1';
          link.style.filter = 'blur(0)';
        });
      }, 0);
      setTimeout(() => {
        menuLinks.forEach(link => {
          link.style.transition = '';
          link.style.filter = '';
        });
      }, 400);
      originalMenu.classList.add('menu-items-bounce-in');
      originalMenu.addEventListener('animationend', function handler() {
        originalMenu.classList.remove('menu-items-bounce-in');
        originalMenu.removeEventListener('animationend', handler);
      });
    }
  } else {
    // ...existing code for other transitions (staggered or default)...
    if (filterContent) filterContent.style.display = 'none';
    if (window.hamburgerMenu) window.hamburgerMenu.exitFilterMode();
    const originalMenu = menuContent ? menuContent.querySelector('.original-menu') : null;
    if (originalMenu) {
      const menuLinks = originalMenu.querySelectorAll('a');
      menuLinks.forEach(link => {
        link.style.opacity = '0';
        link.style.filter = 'blur(8px)';
        link.style.transition = 'opacity 0.4s cubic-bezier(0.4,0,0.2,1), filter 0.4s cubic-bezier(0.4,0,0.2,1)';
      });
      originalMenu.style.display = '';
      menuLinks.forEach((link, idx) => {
        setTimeout(() => {
          link.style.opacity = '1';
          link.style.filter = 'blur(0)';
        }, idx * 60);
      });
      setTimeout(() => {
        menuLinks.forEach(link => {
          link.style.transition = '';
          link.style.filter = '';
        });
      }, 400 + menuLinks.length * 60);
      originalMenu.classList.add('menu-items-bounce-in');
      originalMenu.addEventListener('animationend', function handler() {
        originalMenu.classList.remove('menu-items-bounce-in');
        originalMenu.removeEventListener('animationend', handler);
      });
    }
  }
}

// ===============================================
// REWRITTEN & NEW FUNCTIONS START HERE
// ===============================================

function applyFilters() {
  console.log('Filters: Applying filters...');

  // Safely exit if CardSystem is not defined (e.g., on 'about' page)
  if (typeof CardSystem === 'undefined' || !CardSystem) {
    console.warn('Filters: CardSystem not found. Aborting filter application.');
    if (window.hamburgerMenu && typeof window.hamburgerMenu.close === 'function') {
      window.hamburgerMenu.close(); // Close the entire overlay
    }
    return;
  }

  // --- STEP 1: Set filtering state synchronously ---
  CardSystem.setFilteringState(true, 'filtering');

  const excludes = (localStorage.getItem('Excludes') || '').toLowerCase();
  const hasFilters = !!excludes;

  // Store original state for proper restoration
  const originalActiveIndex = CardSystem.activeCardIndex;

  try {
    // Decide whether to filter or show all cards.
    if (!hasFilters) {
      showAllCards();
    } else {
      filterCards(excludes);
    }
  } catch (error) {
    console.error('Filters: Error during filtering:', error);
    // Restore original state on error
    CardSystem.activeCardIndex = originalActiveIndex;
  }

  // --- STEP 2: Re-enable event listeners immediately after DOM updates ---
  // Use setTimeout(0) to ensure DOM changes are processed, but maintain synchronous behavior
  setTimeout(() => {
    CardSystem.setFilteringState(false, 'idle');
    console.log("Filters: Filtering complete. Event listeners re-enabled.");
  }, 0);

  // Only close hamburger menu after state is properly set
  if (window.hamburgerMenu) {
    window.hamburgerMenu.close();
  }
}

function filterCards(excludes) {
  const excludeTerms = excludes.split(',').map(term => term.trim()).filter(Boolean);
  let firstVisibleIndex = -1;

  // Apply the .filtered class to hide cards and find the first visible one
  CardSystem.flipCards.forEach((card, index) => {
    const summaryElement = card.querySelector('.flip-card-back p:first-of-type');
    const summary = summaryElement ? summaryElement.textContent.toLowerCase() : '';

    const shouldHide = excludeTerms.some(term => summary.includes(term));

    card.classList.toggle('filtered', shouldHide);

    if (!shouldHide && firstVisibleIndex === -1) {
      firstVisibleIndex = index;
    }
  });

  // Now, trigger the repositioning logic with the index of the first available card.
  repositionViewAfterFilter(firstVisibleIndex);
}

function showAllCards() {
  console.log('Filters: No filters active, showing all cards.');

  // Remove .filtered class from all cards
  CardSystem.flipCards.forEach(card => card.classList.remove('filtered'));

  // Reposition the view back to the very first card.
  repositionViewAfterFilter(0);
}

// Function to mark initialization as complete and trigger auto-apply if needed
function completeInitialization() {
  isInitializing = false;
  console.log('Filters: Initialization complete, checking for auto-apply...');

  // Event-driven approach: only auto-apply when CardSystem is confirmed ready
  if (window.CardSystem && window.CardSystem.isLayoutReady) {
    autoApplyFiltersOnLoad();
  } else {
    // Listen for the layout ready event instead of using a timer
    document.addEventListener('layoutFinalized', () => {
      autoApplyFiltersOnLoad();
    }, { once: true });
  }
}

// Expose the function globally so other scripts can call it
window.filtersCompleteInitialization = completeInitialization;

/**
 * REWRITTEN: This function now correctly sequences the state update, UI update,
 * and physical repositioning using requestAnimationFrame to prevent race conditions.
 * @param {number} newActiveIndex The master index of the first card to be displayed.
 */
function repositionViewAfterFilter(newActiveIndex) {
    const isMobile = window.innerWidth <= 932 && 'ontouchstart' in window;

    // Set filtering phase for better state tracking
    CardSystem.filteringPhase = 'repositioning';
    CardSystem.pendingStateChange = true;

    // Step 1: Handle the "all cards filtered" edge case.
    if (newActiveIndex === -1) {
        console.warn("Filters: All cards have been filtered out.");
        CardSystem.activeCardIndex = -1;
        CardSystem.pendingStateChange = false;
        CardSystem.filteringPhase = 'idle';

        if (typeof CardSystem.updateUI === 'function') {
            CardSystem.updateUI(); // This will clear the dots.
        }
        return;
    }

    // Step 2: Set the new state synchronously
    CardSystem.activeCardIndex = newActiveIndex;
    CardSystem.previousVisibleActiveIndex = -1; // Forces the dot logic to do a full reset.

    // Step 3: Perform platform-specific repositioning with proper synchronization
    if (isMobile) {
        if (typeof CardSystem.moveToCard === 'function') {
            // Mobile: Let moveToCard handle both updateUI and scroll
            CardSystem.moveToCard(newActiveIndex, false); // false for INSTANT move
        }
    } else {
        // Desktop: Update UI first, then scroll
        if (typeof CardSystem.updateUI === 'function') {
            CardSystem.updateUI();

            // Force dot container repaint with proper timing
            const dotContainer = document.querySelector('.card-indicator');
            if (dotContainer) {
                // Use synchronous reflow instead of async requestAnimationFrame
                void dotContainer.offsetHeight; // Force immediate reflow
                dotContainer.classList.add('force-dot-repaint');
                // Remove class synchronously to avoid async timing issues
                setTimeout(() => {
                    dotContainer.classList.remove('force-dot-repaint');
                }, 0);
                console.debug('Filters: Dot container repaint completed.');
            } else {
                console.warn('Filters: Dot container not found after filtering!');
            }
        }

        if (typeof CardSystem.scrollToCard === 'function') {
            CardSystem.scrollToCard(newActiveIndex, false); // false for INSTANT move
        }
    }

    // Step 4: Reset state flags synchronously
    CardSystem.pendingStateChange = false;
    CardSystem.filteringPhase = 'idle';

    console.log('Filters: Repositioning completed, state synchronized.');
}

// Initialize when DOM and CardSystem are both ready
function initializeExcludesOverlayIfVisible() {
  const excludesContent = document.querySelector('.excludes-content');
  if (excludesContent && excludesContent.style.display !== 'none') {
    // Ensure body lock is applied if excludes overlay is already visible
    if (!document.body.classList.contains('menu-overlay-active')) {
      applyBodyLock();
    }

    // Set up input listeners if they haven't been set up yet
    const excludesInput = document.getElementById('excludes-input');
    if (excludesInput) {
      setupExcludesInputListeners();
    }
  }
}

// Event-driven initialization instead of timer-based
function initializeFilters() {
  // Only initialize if both DOM and CardSystem are ready
  if (document.readyState === 'loading' || !window.CardSystem) {
    return; // Not ready yet
  }

  initializeExcludesOverlayIfVisible();
  console.log('Filters: Initialized successfully');
}

// Listen for multiple readiness signals
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFilters);
} else {
  initializeFilters();
}

// Also listen for CardSystem readiness
document.addEventListener('scriptsLoaded', initializeFilters);