// --- START OF FILE filters.js ---

// Add initialization flag to prevent conflicts with mobile.js
let isInitializing = true;

// (This utility function remains the same)
function unfreezeBody() {
  if (document.body.classList.contains('menu-overlay-active')) {
    const bodyScrollTop = document.documentElement.style.getPropertyValue('--body-scroll-top');
    const scrollY = bodyScrollTop ? parseInt(bodyScrollTop.replace('px', '').replace('-', '')) : 0;
    document.body.classList.remove('menu-overlay-active');
    document.documentElement.style.removeProperty('--body-scroll-top');
    setTimeout(() => { window.scrollTo(0, scrollY); }, 0);
  }
}

// Auto-apply filters on page load if enabled
function autoApplyFiltersOnLoad() {
  // Don't auto-apply during initialization
  if (isInitializing) {
    console.log('Skipping auto-apply during initialization');
    return;
  }

  const shouldAutoApply = localStorage.getItem('autoApplyFilters') === 'true';
  const hasExcludes = localStorage.getItem('Excludes');

  if (shouldAutoApply && hasExcludes) {
    console.log('Auto-applying filters on page load...');
    // Wait a bit longer to ensure mobile layout is completely stable
    setTimeout(() => {
      applyFiltersQuietly();
    }, 200); // Increased from 100ms to 200ms
  }
}

// Silent version of applyFilters that doesn't block touch events
function applyFiltersQuietly() {
  console.log('Applying filters quietly...');

  // Don't block touch events during quiet filtering
  // window.CardSystem.isFiltering = true; // REMOVED - this was causing the issue

  const excludes = (localStorage.getItem('Excludes') || '').toLowerCase();
  const hasFilters = !!excludes;

  if (!hasFilters) {
    showAllCardsQuietly();
  } else {
    filterCardsQuietly(excludes);
  }

  console.log("Quiet filtering complete.");
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

    // Actually center the first visible card
    const isMobile = window.innerWidth <= 932 && 'ontouchstart' in window;
    if (isMobile && typeof CardSystem.moveToCard === 'function') {
      CardSystem.moveToCard(firstVisibleIndex, false); // false for instant move
    } else if (!isMobile && typeof CardSystem.scrollToCard === 'function') {
      CardSystem.scrollToCard(firstVisibleIndex, false); // false for instant move
    }
  }
}

function showAllCardsQuietly() {
  console.log('No filters active, showing all cards quietly.');

  // Remove .filtered class from all cards
  CardSystem.flipCards.forEach(card => card.classList.remove('filtered'));

  // Update UI and center the first card
  CardSystem.activeCardIndex = 0;
  if (typeof CardSystem.updateUI === 'function') {
    CardSystem.updateUI();
  }

  // Actually center the first card
  const isMobile = window.innerWidth <= 932 && 'ontouchstart' in window;
  if (isMobile && typeof CardSystem.moveToCard === 'function') {
    CardSystem.moveToCard(0, false); // false for instant move
  } else if (!isMobile && typeof CardSystem.scrollToCard === 'function') {
    CardSystem.scrollToCard(0, false); // false for instant move
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
        <div class="filter-option" data-filter-type="excludes"><h4>Excludes</h4></div>
        <div class="filter-option coming-soon" data-filter-type="includes"><h4>Includes</h4><span class="coming-soon-text">Coming Soon</span></div>
        <div class="filter-option coming-soon" data-filter-type="topic"><h4>Topic</h4><span class="coming-soon-text">Coming Soon</span></div>
        <div class="filter-option coming-soon" data-filter-type="optimism"><h4>Optimism Score</h4><span class="coming-soon-text">Coming Soon</span></div>
      </div>
      <div class="filter-actions" style="margin-top: 2rem;">
        <button onclick="goBackToMenu()" class="main-btn main-btn-secondary" style="padding: 0.85rem 2rem; background: #f8f9fa; color: #007bff; border: 2px solid #007bff; border-radius: 10px; font-weight: 600; font-size: 1.1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); cursor: pointer; transition: background 0.2s, color 0.2s; margin-right: 1rem;">Back</button>
        <button onclick="applyFilters()" class="main-btn" style="padding: 0.85rem 2rem; background: #007bff; color: white; border: none; border-radius: 10px; font-weight: 600; font-size: 1.1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.08); cursor: pointer; transition: background 0.2s, color 0.2s;">Apply</button>
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
      option.addEventListener('click', (e) => selectFilter(e.currentTarget.dataset.filterType));
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
  filterContent.classList.add('active');
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
      <div class="excludes-actions" style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center;">
        <button onclick="goBackToFilters()" style="padding: 0.75rem 1.5rem; background: #6c757d; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem;">Back</button>
        <button onclick="saveExcludes(event)" style="padding: 0.75rem 1.5rem; background: #dc3545; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem;">Save Excludes</button>
      </div>
    `;
    menuContent.appendChild(excludesContent);
  } else {
    document.getElementById('excludes-input').value = existingExcludes;
  }

  excludesContent.style.display = 'block';
  setTimeout(() => document.getElementById('excludes-input').focus(), 100);
}

function goBackToFilters() {
  const excludesContent = document.querySelector('.excludes-content');
  if (excludesContent) excludesContent.style.display = 'none';
  showFilterContent();
}

function saveExcludes(event) {
  const textarea = document.getElementById('excludes-input');
  if (!textarea) return;
  localStorage.setItem('Excludes', textarea.value.trim());

  const saveButton = event.target;
  const originalText = saveButton.textContent;
  saveButton.textContent = 'Saved!';
  saveButton.style.background = '#28a745';

  setTimeout(() => {
    saveButton.textContent = originalText;
    saveButton.style.background = '#dc3545';
  }, 1500);
}

function goBackToMenu() {
  unfreezeBody();
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
  console.log('Applying filters...');

  // --- STEP 1: Disable conflicting event listeners ---
  window.CardSystem.isFiltering = true;

  const excludes = (localStorage.getItem('Excludes') || '').toLowerCase();
  const hasFilters = !!excludes;

  // Decide whether to filter or show all cards.
  if (!hasFilters) {
    showAllCards();
  } else {
    filterCards(excludes);
  }

  // --- FINAL STEP: Re-enable event listeners after everything is done. ---
  setTimeout(() => {
    window.CardSystem.isFiltering = false;
    console.log("Filtering complete. Event listeners re-enabled.");
  }, 500);

  unfreezeBody();
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
  console.log('No filters active, showing all cards.');

  // Remove .filtered class from all cards
  CardSystem.flipCards.forEach(card => card.classList.remove('filtered'));

  // Reposition the view back to the very first card.
  repositionViewAfterFilter(0);
}

// Function to mark initialization as complete and trigger auto-apply if needed
function completeInitialization() {
  isInitializing = false;
  console.log('Filters initialization complete, checking for auto-apply...');
  autoApplyFiltersOnLoad();
}

// Expose the function globally so mobile.js can call it
window.filtersCompleteInitialization = completeInitialization;

/**
 * REWRITTEN: This function now correctly sequences the state update, UI update,
 * and physical repositioning using requestAnimationFrame to prevent race conditions.
 * @param {number} newActiveIndex The master index of the first card to be displayed.
 */
function repositionViewAfterFilter(newActiveIndex) {
    const isMobile = window.innerWidth <= 932 && 'ontouchstart' in window;

    // Step 1: Handle the "all cards filtered" edge case.
    if (newActiveIndex === -1) {
        console.warn("All cards have been filtered out.");
        CardSystem.activeCardIndex = -1;
        if (typeof CardSystem.updateUI === 'function') {
            CardSystem.updateUI(); // This will clear the dots.
        }
        return;
    }

    // Step 2: Set the new state. This is just updating variables.
    CardSystem.activeCardIndex = newActiveIndex;
    CardSystem.previousVisibleActiveIndex = -1; // Forces the dot logic to do a full reset.

    // Step 3: Delegate the entire visual update and repositioning to the
    // platform-specific functions, which are the "source of truth" for UI changes.
    // This solves the race condition.
    if (isMobile) {
        if (typeof CardSystem.moveToCard === 'function') {
            // Let moveToCard handle the updateUI() call and the scroll.
            // It knows how to do this correctly for mobile.
            CardSystem.moveToCard(newActiveIndex, false); // false for INSTANT move
        }
    } else {
        if (typeof CardSystem.scrollToCard === 'function') {
            // For desktop, we do need to update the UI first, then scroll.
            if (typeof CardSystem.updateUI === 'function') {
                CardSystem.updateUI();
                // --- FORCE DOT REPAINT ON DESKTOP AFTER FILTERING ---
                const dotContainer = document.querySelector('.card-indicator');
                if (dotContainer) {
                    // Force reflow
                    void dotContainer.offsetHeight;
                    // Toggle a dummy class to trigger repaint
                    dotContainer.classList.add('force-dot-repaint');
                    requestAnimationFrame(() => {
                        dotContainer.classList.remove('force-dot-repaint');
                    });
                    console.debug('Dot container present, forced repaint triggered.');
                } else {
                    console.warn('Dot container not found after filtering!');
                }
            }
            CardSystem.scrollToCard(newActiveIndex, true); // true for INSTANT move
        }
    }
}
// --- END OF FILE filters.js ---