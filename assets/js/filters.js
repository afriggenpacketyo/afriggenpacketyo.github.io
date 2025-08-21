// Add initialization flag to prevent conflicts with mobile.js
let isInitializing = true;

// Listen for scriptsLoaded event to mark initialization complete
document.addEventListener('scriptsLoaded', () => {
  console.log('Filters: Scripts loaded, marking initialization complete');
  isInitializing = false;
  
  // CRITICAL FIX: Ensure filtersCompleteInitialization is available immediately
  // when scriptsLoaded fires, preventing race condition
  if (typeof window.filtersCompleteInitialization !== 'function') {
    console.warn('Filters: filtersCompleteInitialization not yet defined, defining placeholder');
    window.filtersCompleteInitialization = function(callback) {
      console.log('Filters: Using placeholder initialization');
      if (callback) callback();
    };
  }
}, { once: true });

// Helper to escape regex special characters in user terms
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whole-word matcher: matches term as a whole word or hyphenated word in text
function matchWord(term, text) {
  if (!term) return false;
  const safeTerm = escapeRegExp(term);
  // Use \b for word boundary matching. This is more robust as it handles
  // punctuation (e.g., 'car.') and other non-alphanumeric separators correctly.
  const regex = new RegExp(`\\b${safeTerm}\\b`, 'i');
  return regex.test(text);
}


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

// Complete initialization function called by CardSystem
window.filtersCompleteInitialization = function(callback) {
  console.log('Filters: Complete initialization called, callback:', typeof callback);
  isInitializing = false;
  
  // Add safety check to ensure CardSystem is ready
  if (!window.CardSystem || !window.CardSystem.isLayoutReady) {
    console.warn('Filters: CardSystem not ready during initialization - filters will not be applied');
    if (callback) callback();
    return;
  }
  
  autoApplyFiltersOnLoad(callback);
};

// Auto-apply filters on page load if enabled
function autoApplyFiltersOnLoad(callback) {
  // Don't auto-apply during initialization
  if (isInitializing) {
    console.log('Filters: Skipping auto-apply during initialization');
    if (callback) callback();
    return;
  }

  // Also check if CardSystem layout is ready
  if (!window.CardSystem || !window.CardSystem.isLayoutReady) {
    console.log('Filters: CardSystem layout not ready, skipping auto-apply');
    if (callback) callback();
    return;
  }

  const shouldAutoApply = localStorage.getItem('autoApplyFilters') === 'true';
  const hasExcludes = localStorage.getItem('Excludes');
  const hasIncludes = localStorage.getItem('Includes');
  const optimismData = JSON.parse(localStorage.getItem('OptimismScore') || '{"min": 0, "max": 100}');
  const hasOptimismFilter = optimismData.min !== 0 || optimismData.max !== 100;

  console.log('Filters: shouldAutoApply:', shouldAutoApply, 'hasFilters:', hasExcludes || hasIncludes || hasOptimismFilter);
  
  if (shouldAutoApply && (hasExcludes || hasIncludes || hasOptimismFilter)) {
    console.log('Filters: Auto-applying filters on page load...');
    applyFiltersQuietly(callback);
  } else {
    console.log('Filters: No filters to apply, calling callback immediately');
    if (callback) {
      callback();
    } else {
      console.warn('Filters: No callback provided to autoApplyFiltersOnLoad');
    }
  }
}

// Silent version of applyFilters that doesn't block touch events
function applyFiltersQuietly(callback) {
  console.log('Filters: Applying filters quietly...');

  const excludes = (localStorage.getItem('Excludes') || '').toLowerCase();
  const includes = (localStorage.getItem('Includes') || '').toLowerCase();

  // Check for optimism score filter
  const optimismData = JSON.parse(localStorage.getItem('OptimismScore') || '{"min": 0, "max": 100}');
  const hasOptimismFilter = optimismData.min !== 0 || optimismData.max !== 100;

  const hasFilters = !!excludes || !!includes || hasOptimismFilter;

  if (!hasFilters) {
    showAllCardsQuietly();
  } else {
    filterCardsQuietly(excludes, includes);
  }

  console.log("Filters: Quiet filtering complete.");
  
  // Always call callback regardless of filtering results
  if (callback) {
    console.log("Filters: Calling completion callback");
    callback();
  } else {
    console.warn("Filters: No callback provided to applyFiltersQuietly");
  }
}

// Optimized filtering function using cached card data
function filterCardsOptimized(excludeTerms, includeTerms, optimismMin, optimismMax, hasOptimismFilter) {
  let firstVisibleIndex = -1;

  CardSystem.flipCards.forEach((card, index) => {
    const cardData = CardSystem.cardData[index];
    let summary, optimismScore;

    if (cardData) {
      summary = cardData.summary;
      optimismScore = cardData.optimismScore;
    } else {
      // Fallback for missing cached data
      const summaryElement = card.querySelector('.flip-card-back p:first-of-type');
      summary = summaryElement ? summaryElement.textContent.toLowerCase() : '';
      optimismScore = null;
    }

    let shouldHide = false;

    // Step 1: Apply excludes filter (hide if ANY exclude term matches)
    if (excludeTerms.length > 0) {
      shouldHide = excludeTerms.some(term => matchWord(term, summary));
    }

    // Step 2: Apply includes filter (only if not already hidden by excludes)
    if (!shouldHide && includeTerms.length > 0) {
      shouldHide = !includeTerms.some(term => matchWord(term, summary));
    }

    // Step 3: Apply optimism score filter (only if not already hidden)
    if (!shouldHide && hasOptimismFilter) {
      if (optimismScore !== null) {
        shouldHide = optimismScore < optimismMin || optimismScore > optimismMax;
      } else {
        shouldHide = true; // Hide cards without optimism scores when filter is active
      }
    }

    card.classList.toggle('filtered', shouldHide);

    if (!shouldHide && firstVisibleIndex === -1) {
      firstVisibleIndex = index;
    }
  });

  return firstVisibleIndex;
}

// Quiet versions that don't trigger full repositioning
function filterCardsQuietly(excludes, includes) {
  let excludeTerms = excludes ? excludes.split(',').map(term => term.trim()).filter(Boolean) : [];
  let includeTerms = includes ? includes.split(',').map(term => term.trim()).filter(Boolean) : [];

  // Get optimism score filter settings
  const optimismData = JSON.parse(localStorage.getItem('OptimismScore') || '{"min": 0, "max": 100}');
  const optimismMin = optimismData.min;
  const optimismMax = optimismData.max;
  const hasOptimismFilter = optimismMin !== 0 || optimismMax !== 100;

  // Handle terms present in both lists by ignoring them
  const excludeSet = new Set(excludeTerms);
  const includeSet = new Set(includeTerms);
  const commonTerms = new Set([...excludeSet].filter(term => includeSet.has(term)));

  if (commonTerms.size > 0) {
    console.log('Common filter terms found, ignoring:', [...commonTerms]);
    excludeTerms = excludeTerms.filter(term => !commonTerms.has(term));
    includeTerms = includeTerms.filter(term => !commonTerms.has(term));
  }

  // Use optimized filtering function
  const firstVisibleIndex = filterCardsOptimized(excludeTerms, includeTerms, optimismMin, optimismMax, hasOptimismFilter);

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
        <a href="#" class="filter-option" data-filter-type="includes">Includes</a>
        <a href="#" class="filter-option coming-soon" data-filter-type="topic">Topic<span class="coming-soon-text">Coming Soon</span></a>
        <a href="#" class="filter-option" data-filter-type="optimism">Optimism Score</a>
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
      autoApplyCheckbox.addEventListener('change', function () {
        localStorage.setItem('autoApplyFilters', this.checked.toString());
      });
    }
    if (autoApplyLabel && autoApplyCheckbox) {
      autoApplyLabel.addEventListener('click', function (e) {
        autoApplyCheckbox.checked = !autoApplyCheckbox.checked;
        autoApplyCheckbox.dispatchEvent(new Event('change'));
      });
    }

    // Add event listener for info button to prevent checkbox toggle
    const infoBtn = filterContent.querySelector('.info-btn');
    const infoBtnContainer = filterContent.querySelector('.info-btn-container');
    if (infoBtn && infoBtnContainer) {
      infoBtn.addEventListener('click', function (e) {
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
  } else if (filterType === 'includes') {
    showIncludesSubmenu();
  } else if (filterType === 'optimism') {
    showOptimismSubmenu();
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
  const includesContent = document.querySelector('.includes-content');
  const optimismContent = document.querySelector('.optimism-content');

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

  if (includesContent) {
    includesContent.style.display = 'none';

    // Clean up input listeners when hiding includes content
    const includesInput = document.getElementById('includes-input');
    if (includesInput) {
      includesInput.removeEventListener('focus', handleIncludesInputFocus);
      includesInput.removeEventListener('blur', handleIncludesInputBlur);
      includesInput.blur(); // Ensure input loses focus
    }
  }

  if (optimismContent) {
    optimismContent.style.display = 'none';
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

// ===============================================
// INCLUDES FILTERING FUNCTIONS
// ===============================================

function showIncludesSubmenu() {
  const filterContent = document.querySelector('.filter-content');
  if (filterContent) filterContent.style.display = 'none';
  showIncludesContent();
}

function showIncludesContent() {
  const menuContent = document.querySelector('.menu-content');
  const existingIncludes = localStorage.getItem('Includes') || '';

  let includesContent = menuContent.querySelector('.includes-content');
  if (!includesContent) {
    includesContent = document.createElement('div');
    includesContent.className = 'includes-content';
    includesContent.innerHTML = `
      <h3>Include Terms</h3>
      <p style="font-size: 0.9rem; color: #666; margin-bottom: 1rem;">Show only article summaries with<br>these words (comma-separated):</p>
      <textarea id="includes-input" placeholder="e.g., technology, innovation" style="width: 100%; min-height: 100px; padding: 0.75rem; border: 2px solid #e9ecef; border-radius: 8px; font-size: 1rem; resize: vertical; font-family: inherit;">${existingIncludes}</textarea>
      <div class="includes-actions" style="margin-top: 1rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        <a href="#" onclick="goBackToFilters(); return false;" class="includes-btn includes-btn-secondary">Back</a>
        <a href="#" onclick="saveIncludes(event); return false;" class="includes-btn">Save Includes</a>
      </div>
    `;
    menuContent.appendChild(includesContent);

    // Set up input event listeners immediately after creation
    setupIncludesInputListeners();
  } else {
    document.getElementById('includes-input').value = existingIncludes;
  }

  includesContent.style.display = 'block';

  // Reset save button state when showing includes content
  const saveButton = includesContent.querySelector('.includes-btn:not(.includes-btn-secondary)');
  if (saveButton) {
    // Clear any pending timeout and reset state
    if (saveIncludesButtonTimeout) {
      clearTimeout(saveIncludesButtonTimeout);
      saveIncludesButtonTimeout = null;
    }
    isSaveIncludesButtonActive = false;
    saveButton.textContent = 'Save Includes';
    saveButton.style.background = '#28a745';
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
      const input = document.getElementById('includes-input');
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
function setupIncludesInputListeners() {
  const includesInput = document.getElementById('includes-input');
  if (!includesInput) return;

  // Remove any existing listeners to prevent duplicates
  includesInput.removeEventListener('focus', handleIncludesInputFocus);
  includesInput.removeEventListener('blur', handleIncludesInputBlur);

  // Add new listeners
  includesInput.addEventListener('focus', handleIncludesInputFocus);
  includesInput.addEventListener('blur', handleIncludesInputBlur);
}

// Separate handler functions for better control
function handleIncludesInputFocus() {
  const overlay = document.querySelector('.includes-content');
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

function handleIncludesInputBlur() {
  // Don't remove body lock on blur - let the menu close handle it
  // This prevents the page from jumping when the user taps outside the input
}

// Variable to track save button state and timeout for includes
let saveIncludesButtonTimeout = null;
let isSaveIncludesButtonActive = false;

function saveIncludes(event) {
  const textarea = document.getElementById('includes-input');
  if (!textarea) return;

  // Prevent multiple clicks while save is in progress
  if (isSaveIncludesButtonActive) return;

  localStorage.setItem('Includes', textarea.value.trim());

  const saveButton = event.target;
  const originalText = 'Save Includes'; // Always use the known original text

  // Set button state
  isSaveIncludesButtonActive = true;
  saveButton.textContent = 'Saved!';
  saveButton.style.background = '#28a745';

  // Clear any existing timeout
  if (saveIncludesButtonTimeout) {
    clearTimeout(saveIncludesButtonTimeout);
  }

  // Set new timeout
  saveIncludesButtonTimeout = setTimeout(() => {
    saveButton.textContent = originalText;
    saveButton.style.background = '#28a745';
    isSaveIncludesButtonActive = false;
    // Clean up timeout
    if (saveIncludesButtonTimeout) {
      clearTimeout(saveIncludesButtonTimeout);
      saveIncludesButtonTimeout = null;
    }
  }, 1500);
}

// ===============================================
// OPTIMISM SCORE FILTERING FUNCTIONS
// ===============================================

function showOptimismSubmenu() {
  const filterContent = document.querySelector('.filter-content');
  if (filterContent) filterContent.style.display = 'none';
  showOptimismContent();
}

function showOptimismContent() {
  const menuContent = document.querySelector('.menu-content');
  let existingOptimism = JSON.parse(localStorage.getItem('OptimismScore') || '{"min": 0, "max": 100}');

  // Validate and fix any invalid stored values
  existingOptimism = validateOptimismRange(existingOptimism);

  let optimismContent = menuContent.querySelector('.optimism-content');
  if (!optimismContent) {
    optimismContent = document.createElement('div');
    optimismContent.className = 'optimism-content';
    optimismContent.innerHTML = `
      <h3>Optimism Score Range</h3>
      <p style="font-size: 0.9rem; color: #666; margin-bottom: 1.5rem;">Select the optimism score range<br>for article summaries:</p>
      <div class="optimism-slider-container">
        <div class="optimism-values">
          <span class="optimism-min-value">${existingOptimism.min}</span>
          <span class="optimism-range-separator" style="display: ${existingOptimism.min === existingOptimism.max ? 'none' : 'inline'};"> - </span>
          <span class="optimism-max-value" style="display: ${existingOptimism.min === existingOptimism.max ? 'none' : 'inline'};">${existingOptimism.max}</span>
        </div>
        <div class="dual-range-slider">
          <input type="range" id="optimism-min" class="slider-thumb" min="0" max="100" step="5" value="${existingOptimism.min}">
          <input type="range" id="optimism-max" class="slider-thumb" min="0" max="100" step="5" value="${existingOptimism.max}">
          <div class="slider-track">
            <div class="slider-range"></div>
          </div>
        </div>
        <div class="slider-labels">
          <span>0</span>
          <span>25</span>
          <span>50</span>
          <span>75</span>
          <span>100</span>
        </div>
      </div>
      <div class="optimism-actions" style="margin-top: 2rem; display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        <a href="#" onclick="goBackToFilters(); return false;" class="optimism-btn optimism-btn-secondary">Back</a>
        <a href="#" onclick="saveOptimismScore(event); return false;" class="optimism-btn">Save Range</a>
      </div>
    `;
    menuContent.appendChild(optimismContent);

    // Set up slider event listeners immediately after creation
    setupOptimismSliderListeners();
  } else {
    // Update existing values with validation
    const validatedData = validateOptimismRange(existingOptimism);
    document.getElementById('optimism-min').value = validatedData.min;
    document.getElementById('optimism-max').value = validatedData.max;
    updateOptimismDisplay(validatedData.min, validatedData.max);

    // Update constraints after setting values
    updateSliderConstraints();
  }

  optimismContent.style.display = 'block';

  // Reset save button state when showing optimism content
  const saveButton = optimismContent.querySelector('.optimism-btn:not(.optimism-btn-secondary)');
  if (saveButton) {
    saveButton.textContent = 'Save Range';
    saveButton.style.background = '#dc3545';
  }

  // Refresh the button event listeners for the 3D effect
  if (window.hamburgerMenu && typeof window.hamburgerMenu.refreshMenuLinks === 'function') {
    window.hamburgerMenu.refreshMenuLinks();
  }

  // Update slider position and visuals on display
  updateSliderRange();
}

function setupOptimismSliderListeners() {
  const minSlider = document.getElementById('optimism-min');
  const maxSlider = document.getElementById('optimism-max');
  const sliderContainer = document.querySelector('.dual-range-slider');

  if (minSlider && maxSlider) {
    // Initialize constraints
    updateSliderConstraints();

    // Set up unified drag handling for both desktop and mobile
    setupUnifiedDragHandling(minSlider, maxSlider, sliderContainer);
  }
}

function setupUnifiedDragHandling(minSlider, maxSlider, sliderContainer) {
  let isDragging = false;
  let activeSlider = null;
  let startX = 0;
  let startMinVal = 0;
  let startMaxVal = 0;
  let sliderRect = null;

  function getEventX(event) {
    return event.touches ? event.touches[0].clientX : event.clientX;
  }

  function getSliderValueFromPosition(x, rect) {
    const percentage = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
    const value = Math.round(percentage * 20) * 5; // Snap to multiples of 5 (0-100)
    return Math.max(0, Math.min(100, value));
  }

  function handleDragStart(event) {
    event.preventDefault();
    isDragging = true;
    startX = getEventX(event);
    startMinVal = parseInt(minSlider.value);
    startMaxVal = parseInt(maxSlider.value);
    sliderRect = sliderContainer.getBoundingClientRect();

    const clickValue = getSliderValueFromPosition(startX, sliderRect);

    // Determine which slider to activate
    if (startMinVal === startMaxVal) {
      // Intersection case - we'll determine based on drag direction in handleDragMove
      activeSlider = null;
    } else {
      // Normal case - choose closest slider
      const distanceToMin = Math.abs(clickValue - startMinVal);
      const distanceToMax = Math.abs(clickValue - startMaxVal);
      activeSlider = distanceToMin <= distanceToMax ? minSlider : maxSlider;
    }

    // Add visual feedback if we have an active slider
    if (activeSlider) {
      activeSlider.style.zIndex = '4';
    }
  }

  function handleDragMove(event) {
    if (!isDragging) return;

    event.preventDefault();
    const currentX = getEventX(event);
    const newValue = getSliderValueFromPosition(currentX, sliderRect);

    // If we're at intersection and haven't determined active slider yet
    if (!activeSlider && startMinVal === startMaxVal) {
      const dragDistance = currentX - startX;

      // Need minimum drag distance to determine direction
      if (Math.abs(dragDistance) > 5) {
        if (dragDistance > 0) {
          // Dragging right - activate max slider
          activeSlider = maxSlider;
        } else {
          // Dragging left - activate min slider
          activeSlider = minSlider;
        }

        // Add visual feedback
        activeSlider.style.zIndex = '4';
      } else {
        // Not enough movement yet
        return;
      }
    }

    if (!activeSlider) return;

    // Apply collision detection
    let constrainedValue = newValue;
    if (activeSlider === minSlider) {
      constrainedValue = Math.min(newValue, parseInt(maxSlider.value));
    } else if (activeSlider === maxSlider) {
      constrainedValue = Math.max(newValue, parseInt(minSlider.value));
    }

    // Update the active slider
    if (parseInt(activeSlider.value) !== constrainedValue) {
      activeSlider.value = constrainedValue;

      // Update display
      const minVal = parseInt(minSlider.value);
      const maxVal = parseInt(maxSlider.value);
      updateOptimismDisplay(minVal, maxVal);
      updateSliderRange();
    }
  }

  function handleDragEnd(event) {
    if (!isDragging) return;

    event.preventDefault();
    isDragging = false;

    // Reset z-index
    if (activeSlider) {
      activeSlider.style.zIndex = activeSlider === minSlider ? '3' : '2';
    }

    activeSlider = null;
    sliderRect = null;
  }

  // Add event listeners for both mouse and touch
  sliderContainer.addEventListener('mousedown', handleDragStart);
  sliderContainer.addEventListener('touchstart', handleDragStart, { passive: false });

  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('touchmove', handleDragMove, { passive: false });

  document.addEventListener('mouseup', handleDragEnd);
  document.addEventListener('touchend', handleDragEnd, { passive: false });
  document.addEventListener('touchcancel', handleDragEnd, { passive: false });

  // Disable default slider behavior to prevent conflicts
  minSlider.addEventListener('input', function (event) {
    if (isDragging) {
      event.preventDefault();
      return false;
    }
    handleOptimismSliderChange(event);
  });

  maxSlider.addEventListener('input', function (event) {
    if (isDragging) {
      event.preventDefault();
      return false;
    }
    handleOptimismSliderChange(event);
  });
}



function handleOptimismSliderChange(event) {
  const minSlider = document.getElementById('optimism-min');
  const maxSlider = document.getElementById('optimism-max');

  if (!minSlider || !maxSlider) return;

  let minVal = parseInt(minSlider.value);
  let maxVal = parseInt(maxSlider.value);

  // Collision detection: prevent thumbs from crossing
  if (event && event.target === minSlider) {
    // User is moving the min slider - clamp it to not exceed max
    if (minVal > maxVal) {
      minVal = maxVal;
      minSlider.value = minVal;
    }
  } else if (event && event.target === maxSlider) {
    // User is moving the max slider - clamp it to not go below min
    if (maxVal < minVal) {
      maxVal = minVal;
      maxSlider.value = maxVal;
    }
  } else {
    // Programmatic change - fix any crossing
    if (minVal > maxVal) {
      const average = Math.round((minVal + maxVal) / 2);
      minVal = average;
      maxVal = average;
      minSlider.value = minVal;
      maxSlider.value = maxVal;
    }
  }

  updateOptimismDisplay(minVal, maxVal);
  updateSliderRange();

  // Ensure visual state is updated
  updateSliderThumbVisuals(minVal, maxVal);
}

function updateOptimismDisplay(minVal, maxVal) {
  const minValueSpan = document.querySelector('.optimism-min-value');
  const maxValueSpan = document.querySelector('.optimism-max-value');
  const separatorSpan = document.querySelector('.optimism-range-separator');

  if (minValueSpan) minValueSpan.textContent = minVal;
  if (maxValueSpan) maxValueSpan.textContent = maxVal;

  // Show/hide separator and max value based on whether values are the same
  const showRange = minVal !== maxVal;
  if (separatorSpan) separatorSpan.style.display = showRange ? 'inline' : 'none';
  if (maxValueSpan) maxValueSpan.style.display = showRange ? 'inline' : 'none';

  // Update slider thumb visual state for intersection
  updateSliderThumbVisuals(minVal, maxVal);
}

function updateSliderThumbVisuals(minVal, maxVal) {
  const minSlider = document.getElementById('optimism-min');
  const maxSlider = document.getElementById('optimism-max');
  const minValueSpan = document.querySelector('.optimism-min-value');
  const maxValueSpan = document.querySelector('.optimism-max-value');

  if (!minSlider || !maxSlider) return;

  const isIntersection = minVal === maxVal;

  console.log('Updating slider visuals:', { minVal, maxVal, isIntersection });

  if (isIntersection) {
    // Show single black dot - hide max thumb, make min thumb black
    minSlider.classList.add('intersection');
    maxSlider.classList.add('hidden');
    maxSlider.classList.remove('intersection');

    // Make text black for intersection state
    if (minValueSpan) minValueSpan.classList.add('intersection');
    if (maxValueSpan) maxValueSpan.classList.add('intersection');

    console.log('Applied intersection state: min=black, max=hidden, text=black');
  } else {
    // Show both thumbs in their normal colors
    minSlider.classList.remove('intersection');
    maxSlider.classList.remove('hidden', 'intersection');

    // Return text to normal colors
    if (minValueSpan) minValueSpan.classList.remove('intersection');
    if (maxValueSpan) maxValueSpan.classList.remove('intersection');

    console.log('Applied separated state: both thumbs visible, text=normal colors');
  }
}

function updateSliderRange() {
  const minSlider = document.getElementById('optimism-min');
  const maxSlider = document.getElementById('optimism-max');
  const sliderRange = document.querySelector('.slider-range');

  if (!minSlider || !maxSlider || !sliderRange) return;

  const minVal = parseInt(minSlider.value);
  const maxVal = parseInt(maxSlider.value);
  const minPercent = (minVal / 100) * 100;
  const maxPercent = (maxVal / 100) * 100;

  sliderRange.style.left = minPercent + '%';
  sliderRange.style.width = (maxPercent - minPercent) + '%';

  // Update thumb visuals for intersection state
  updateSliderThumbVisuals(minVal, maxVal);
}

function updateSliderConstraints() {
  const minSlider = document.getElementById('optimism-min');
  const maxSlider = document.getElementById('optimism-max');

  if (!minSlider || !maxSlider) return;

  // Reset to full range - collision detection is handled in event listeners
  minSlider.min = '0';
  minSlider.max = '100';
  maxSlider.min = '0';
  maxSlider.max = '100';
}

function validateOptimismRange(optimismData) {
  // Ensure min and max are numbers within valid range
  let min = Math.max(0, Math.min(100, parseInt(optimismData.min) || 0));
  let max = Math.max(0, Math.min(100, parseInt(optimismData.max) || 100));

  // Ensure min never exceeds max
  if (min > max) {
    // If min is greater than max, set both to the average
    const average = Math.round((min + max) / 2);
    min = average;
    max = average;
  }

  return { min, max };
}

// Variable to track save button state and timeout for optimism
let saveOptimismButtonTimeout = null;
let isSaveOptimismButtonActive = false;

function saveOptimismScore(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  // Prevent multiple rapid clicks
  if (isSaveOptimismButtonActive) return;
  isSaveOptimismButtonActive = true;

  const minSlider = document.getElementById('optimism-min');
  const maxSlider = document.getElementById('optimism-max');
  const saveButton = document.querySelector('.optimism-btn:not(.optimism-btn-secondary)');

  if (!minSlider || !maxSlider || !saveButton) return;

  const minVal = parseInt(minSlider.value);
  const maxVal = parseInt(maxSlider.value);

  // Validate before saving
  const validatedData = validateOptimismRange({ min: minVal, max: maxVal });

  // Update sliders if validation changed the values
  if (validatedData.min !== minVal) {
    minSlider.value = validatedData.min;
  }
  if (validatedData.max !== maxVal) {
    maxSlider.value = validatedData.max;
  }

  // Update display and range
  updateOptimismDisplay(validatedData.min, validatedData.max);
  updateSliderRange();

  // Save validated data to localStorage
  localStorage.setItem('OptimismScore', JSON.stringify(validatedData));

  // Update button to show success
  saveButton.textContent = 'Saved!';
  saveButton.style.background = '#28a745';

  // Reset button after delay
  if (saveOptimismButtonTimeout) {
    clearTimeout(saveOptimismButtonTimeout);
  }
  saveOptimismButtonTimeout = setTimeout(() => {
    if (saveButton) {
      saveButton.textContent = 'Save Range';
      saveButton.style.background = '#dc3545';
    }
    isSaveOptimismButtonActive = false;
    saveOptimismButtonTimeout = null;
  }, 2000);
}

// Debug function to test optimism score filtering on mobile
function debugOptimismFiltering() {
  console.log('=== DEBUGGING OPTIMISM FILTERING ===');
  const optimismData = JSON.parse(localStorage.getItem('OptimismScore') || '{"min": 0, "max": 100}');
  console.log('Optimism settings:', optimismData);

  if (!window.CardSystem || !window.CardSystem.flipCards) {
    console.log('CardSystem or flipCards not available');
    return;
  }

  console.log('Total cards:', window.CardSystem.flipCards.length);

  window.CardSystem.flipCards.forEach((card, index) => {
    const optimismScoreElement = card.querySelector('.optimism-score');
    if (optimismScoreElement) {
      const scoreText = optimismScoreElement.textContent;
      const scoreMatch = scoreText.match(/(\d+)\/100/);
      console.log(`Card ${index}: found optimism element, text='${scoreText}', parsed=${scoreMatch ? scoreMatch[1] : 'NO_MATCH'}`);
    } else {
      console.log(`Card ${index}: NO optimism element found`);
    }
  });
}

// Expose debug function globally for testing
window.debugOptimismFiltering = debugOptimismFiltering;

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
  const includes = (localStorage.getItem('Includes') || '').toLowerCase();

  // Check for optimism score filter
  const optimismData = JSON.parse(localStorage.getItem('OptimismScore') || '{"min": 0, "max": 100}');
  const hasOptimismFilter = optimismData.min !== 0 || optimismData.max !== 100;

  const hasFilters = !!excludes || !!includes || hasOptimismFilter;

  // Store original state for proper restoration
  const originalActiveIndex = CardSystem.activeCardIndex;

  try {
    // Decide whether to filter or show all cards.
    if (!hasFilters) {
      showAllCards();
    } else {
      filterCards(excludes, includes);
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

function filterCards(excludes, includes) {
  let excludeTerms = excludes ? excludes.split(',').map(term => term.trim()).filter(Boolean) : [];
  let includeTerms = includes ? includes.split(',').map(term => term.trim()).filter(Boolean) : [];

  // Get optimism score filter settings
  const optimismData = JSON.parse(localStorage.getItem('OptimismScore') || '{"min": 0, "max": 100}');
  const optimismMin = optimismData.min;
  const optimismMax = optimismData.max;
  const hasOptimismFilter = optimismMin !== 0 || optimismMax !== 100;

  // Handle terms present in both lists by ignoring them
  const excludeSet = new Set(excludeTerms);
  const includeSet = new Set(includeTerms);
  const commonTerms = new Set([...excludeSet].filter(term => includeSet.has(term)));

  if (commonTerms.size > 0) {
    console.log('Common filter terms found, ignoring:', [...commonTerms]);
    excludeTerms = excludeTerms.filter(term => !commonTerms.has(term));
    includeTerms = includeTerms.filter(term => !commonTerms.has(term));
  }

  // Use optimized filtering function
  const firstVisibleIndex = filterCardsOptimized(excludeTerms, includeTerms, optimismMin, optimismMax, hasOptimismFilter);

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

// The filtersCompleteInitialization function is defined above at line 125

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
function initializeFilterOverlaysIfVisible() {
  const excludesContent = document.querySelector('.excludes-content');
  const includesContent = document.querySelector('.includes-content');

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

  if (includesContent && includesContent.style.display !== 'none') {
    // Ensure body lock is applied if includes overlay is already visible
    if (!document.body.classList.contains('menu-overlay-active')) {
      applyBodyLock();
    }

    // Set up input listeners if they haven't been set up yet
    const includesInput = document.getElementById('includes-input');
    if (includesInput) {
      setupIncludesInputListeners();
    }
  }
}

// Event-driven initialization instead of timer-based
function initializeFilters() {
  // Only initialize if both DOM and CardSystem are ready
  if (document.readyState === 'loading' || !window.CardSystem) {
    return; // Not ready yet
  }

  initializeFilterOverlaysIfVisible();
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