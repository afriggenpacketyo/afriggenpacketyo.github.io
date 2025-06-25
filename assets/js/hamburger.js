// Create a global hamburger menu object
window.hamburgerMenu = {
  overlay: null,
  menuContent: null,
  hamburger: null,
  isOpen: false,
  // Add variables to track textarea resize operations
  isResizing: false,
  resizeStartX: null,
  resizeStartY: null,
  resizeTarget: null,

  init() {
    this.overlay = document.getElementById('menu-overlay');
    this.menuContent = document.querySelector('.menu-content');
    this.hamburger = document.querySelector('.header-hamburger');

    // Ensure hamburger has the three lines structure
    this.ensureHamburgerStructure();

    if (this.hamburger) {
      // Toggle menu on click
      this.hamburger.addEventListener('click', () => {
        if (this.isOpen) {
          this.close();
        } else {
          this.open();
        }
      });
    }

    // Add 3D button effect for menu links
    this.add3DButtonEffect();

    // Add click-outside-to-close functionality with textarea resize handling
    if (this.overlay) {
      this.overlay.addEventListener('mousedown', this.handleOverlayMouseDown.bind(this));
      this.overlay.addEventListener('mousemove', this.handleOverlayMouseMove.bind(this));
      this.overlay.addEventListener('mouseup', this.handleOverlayMouseUp.bind(this));
      this.overlay.addEventListener('click', this.handleOverlayClick.bind(this));

      // Add document-level mouseup to catch events outside overlay
      document.addEventListener('mouseup', this.handleDocumentMouseUp.bind(this));
    }

    // Add Safari mobile specific touch event prevention
    this.addSafariScrollPrevention();
  },

  // New method to handle mousedown on overlay
  handleOverlayMouseDown(e) {
    // Only handle on desktop (check for touch capability)
    if ('ontouchstart' in window) return;

    // Check if we're in the excludes submenu
    const excludesContent = document.querySelector('.excludes-content');
    if (!excludesContent || excludesContent.style.display === 'none') return;

    const textarea = document.getElementById('excludes-input');
    if (!textarea) return;

    // Get textarea boundaries
    const textareaRect = textarea.getBoundingClientRect();
    const resizeHandleSize = 15; // Approximate size of resize handle area

    // Check if click is in the resize handle area (bottom-right corner)
    const isInResizeHandle = (
      e.clientX >= textareaRect.right - resizeHandleSize &&
      e.clientY >= textareaRect.bottom - resizeHandleSize &&
      e.clientX <= textareaRect.right &&
      e.clientY <= textareaRect.bottom
    );

    // Check if click started inside textarea bounds
    const isInsideTextarea = (
      e.clientX >= textareaRect.left &&
      e.clientX <= textareaRect.right &&
      e.clientY >= textareaRect.top &&
      e.clientY <= textareaRect.bottom
    );

    // Check if click is in the excludes content area (but not necessarily textarea)
    const excludesRect = excludesContent.getBoundingClientRect();
    const isInExcludesArea = (
      e.clientX >= excludesRect.left &&
      e.clientX <= excludesRect.right &&
      e.clientY >= excludesRect.top &&
      e.clientY <= excludesRect.bottom
    );

    // We consider it a potential resize operation if:
    // 1. Click is in the resize handle, OR
    // 2. Click is inside the textarea (could be selecting text or starting resize), OR
    // 3. Click is in the excludes area (buttons, etc. - don't close menu)
    if (isInResizeHandle || isInsideTextarea || isInExcludesArea) {
      this.isResizing = true;
      this.resizeStartX = e.clientX;
      this.resizeStartY = e.clientY;
      this.resizeTarget = textarea;

      console.debug('Resize tracking started:', {
        isInResizeHandle,
        isInsideTextarea,
        isInExcludesArea,
        x: e.clientX,
        y: e.clientY
      });
    }
  },

  // New method to handle mousemove on overlay
  handleOverlayMouseMove(e) {
    if (!this.isResizing) return;

    // Calculate movement distance from start position
    const deltaX = Math.abs(e.clientX - this.resizeStartX);
    const deltaY = Math.abs(e.clientY - this.resizeStartY);

    // If significant movement occurred, especially vertical movement which indicates resizing
    if (deltaY > 3 || deltaX > 10) {
      // Confirm we're in resize mode - this prevents accidental menu closure
      this.isResizing = true;
    }
  },

  // New method to handle mouseup on overlay
  handleOverlayMouseUp(e) {
    // Reset resize tracking after a short delay to allow for the click event
    setTimeout(() => {
      this.isResizing = false;
      this.resizeStartX = null;
      this.resizeStartY = null;
      this.resizeTarget = null;
    }, 50);
  },

  // New method to handle document mouseup (catches mouseup outside overlay)
  handleDocumentMouseUp(e) {
    // Only process if we were tracking a potential resize
    if (this.isResizing) {
      // Reset resize tracking after a short delay to allow for the click event
      setTimeout(() => {
        this.isResizing = false;
        this.resizeStartX = null;
        this.resizeStartY = null;
        this.resizeTarget = null;
      }, 50);
    }
  },

  // Modified click handler
  handleOverlayClick(e) {
    // Don't close if we were resizing
    if (this.isResizing) {
      console.debug('Menu close prevented: textarea resize operation detected');
      return;
    }

    // Don't close if clicking within the excludes content area
    const excludesContent = document.querySelector('.excludes-content');
    if (excludesContent && excludesContent.style.display !== 'none') {
      const excludesRect = excludesContent.getBoundingClientRect();
      const isInExcludesArea = (
        e.clientX >= excludesRect.left &&
        e.clientX <= excludesRect.right &&
        e.clientY >= excludesRect.top &&
        e.clientY <= excludesRect.bottom
      );

      if (isInExcludesArea) {
        console.debug('Menu close prevented: click within excludes area');
        return;
      }
    }

    // Only close if clicking on the overlay background, not the menu content
    if (e.target === this.overlay && this.isOpen) {
      console.debug('Closing menu: click on overlay background');
      this.close();
    }
  },

  ensureHamburgerStructure() {
    if (!this.hamburger) return;

    // Check if hamburger already has the three span elements
    if (this.hamburger.querySelectorAll('span').length !== 3) {
      // Clear existing elements
      while (this.hamburger.firstChild) {
        this.hamburger.removeChild(this.hamburger.firstChild);
      }

      // Add the three lines
      for (let i = 0; i < 3; i++) {
        const span = document.createElement('span');
        this.hamburger.appendChild(span);
      }
    }
  },

  add3DButtonEffect() {
    // Apply to all devices but with different behavior
    const menuLinks = Array.from(document.querySelectorAll('.menu-content a:not(.info-btn)'));
    let currentPressedButton = null;
    let startButton = null; // Track which button the touch started on
    let isDragging = false;

    // Helper function to reset all button states
    const resetAllButtons = () => {
      menuLinks.forEach(link => {
        link.classList.remove('pressed');
      });
    };

    // Helper function to press a button
    const pressButton = (button) => {
      resetAllButtons();
      if (button && menuLinks.includes(button)) {
        button.classList.add('pressed');
        currentPressedButton = button;
      }
    };

    // Function to refresh menu links (called when submenus are shown/hidden)
    const refreshMenuLinks = () => {
      // Update the menuLinks array to include any new buttons
      const newMenuLinks = Array.from(document.querySelectorAll('.menu-content a:not(.info-btn)'));
      // Remove old event listeners by replacing the array
      menuLinks.length = 0;
      menuLinks.push(...newMenuLinks);

      // Add event listeners to new buttons
      addEventListenersToButtons();
    };

    // Function to add event listeners to all current menu buttons
    const addEventListenersToButtons = () => {
      menuLinks.forEach(link => {
        // Remove existing listeners to prevent duplicates
        link.removeEventListener('touchstart', link._touchStartHandler);
        link.removeEventListener('touchend', link._touchEndHandler);
        link.removeEventListener('touchcancel', link._touchCancelHandler);

        // Create bound handlers and store them
        link._touchStartHandler = function(e) {
          e.preventDefault(); // Prevent text selection and other touch behaviors
          isDragging = true;
          startButton = this; // Remember which button we started on
          pressButton(this);
        };

        link._touchEndHandler = function(e) {
          e.preventDefault(); // Prevent ghost clicks and other issues

          if (isDragging && startButton) {
            const touch = e.changedTouches[0];

            // Find which button (if any) is under the final touch position
            const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
            const endButton = elementUnderTouch?.closest('.menu-content a:not(.info-btn)');

            // Reset all states first
            resetAllButtons();
            isDragging = false;

            // Trigger action if we ended on any valid menu button
            if (endButton && menuLinks.includes(endButton)) {
              setTimeout(() => {
                // Check if it's a filter option that's disabled
                if (endButton.classList.contains('coming-soon')) {
                  return; // Don't trigger action for coming soon items
                }

                // For buttons with onclick handlers, trigger them
                const onclickAttr = endButton.getAttribute('onclick');
                if (onclickAttr) {
                  // Execute the onclick function
                  try {
                    // Create a safer way to execute the onclick - just execute the statement directly
                    const func = new Function('event', onclickAttr);
                    func.call(endButton, e);
                  } catch (err) {
                    console.warn('Error executing onclick:', err);
                    // Fallback: try to execute as direct function call
                    try {
                      if (onclickAttr.includes('()')) {
                        // It's a function call, evaluate it in global scope
                        eval(onclickAttr);
                      }
                    } catch (evalErr) {
                      console.warn('Fallback onclick execution also failed:', evalErr);
                    }
                  }
                } else {
                  // For regular links, navigate
                  const url = endButton.getAttribute('href');
                  if (url && url !== '#') {
                    window.location.href = url;
                  } else {
                    // For hash links or buttons, trigger click event
                    endButton.click();
                  }
                }
              }, 50);
            }

            // Clear references
            currentPressedButton = null;
            startButton = null;
          }
        };

        link._touchCancelHandler = function(e) {
          e.preventDefault();
          resetAllButtons();
          isDragging = false;
          currentPressedButton = null;
          startButton = null;
        };

        // Add the event listeners
        link.addEventListener('touchstart', link._touchStartHandler, { passive: false });
        link.addEventListener('touchend', link._touchEndHandler, { passive: false });
        link.addEventListener('touchcancel', link._touchCancelHandler, { passive: false });
      });
    };

    // Initial setup
    addEventListenersToButtons();

    // Expose the refresh function so it can be called when submenus change
    this.refreshMenuLinks = refreshMenuLinks;

    // Global touch move handler for seamless button switching
    const menuContent = document.querySelector('.menu-content');
    if (menuContent) {
      menuContent.addEventListener('touchmove', function(e) {
        if (isDragging) {
          const touch = e.touches[0];

          // Find which button (if any) is under the current touch
          const elementUnderTouch = document.elementFromPoint(touch.clientX, touch.clientY);
          const buttonUnderTouch = elementUnderTouch?.closest('.menu-content a:not(.info-btn)');

          // Only update if we're on a different button
          if (buttonUnderTouch !== currentPressedButton) {
            if (buttonUnderTouch && menuLinks.includes(buttonUnderTouch)) {
              pressButton(buttonUnderTouch);
            } else {
              // Not over any button, clear pressed state
              resetAllButtons();
              currentPressedButton = null;
            }
          }
        }
      }, { passive: true }); // Changed to passive: true since we're not preventing default

      // Global touch end handler to catch any missed touch ends
      menuContent.addEventListener('touchend', function(e) {
        if (isDragging) {
          resetAllButtons();
          isDragging = false;
          currentPressedButton = null;
          startButton = null;
        }
      }, { passive: false });
    }
  },

  addSafariScrollPrevention() {
    // Add touch event listeners to prevent scroll chaining
    if (this.overlay) {
      this.overlay.addEventListener('touchstart', this.preventScrollChaining.bind(this), { passive: false });
      this.overlay.addEventListener('touchmove', this.preventScrollChaining.bind(this), { passive: false });
    }

    // Add specific scroll boundary handling for textareas
    document.addEventListener('touchmove', this.handleTextareaScrollBounds.bind(this), { passive: false });
  },  handleTextareaScrollBounds(e) {
    if (!this.isOpen) return;

    // Check if this is a mobile browser that needs scroll prevention
    const isMobileBrowser = /Android/.test(navigator.userAgent) && /Chrome/.test(navigator.userAgent) ||
                            /iPhone|iPad|iPod/.test(navigator.userAgent);

    if (!isMobileBrowser) return;

    const target = e.target;
    const isTextarea = target.tagName === 'TEXTAREA' || target.id === 'excludes-input';
    const isMenuContent = target.closest('.menu-content');
    const isExcludesContainer = target.closest('.excludes-content');

    // Handle menu content scrolling with boundary detection
    if (isMenuContent && !isTextarea && !isExcludesContainer) {
      const menuContent = target.closest('.menu-content');
      if (menuContent) {
        const scrollTop = menuContent.scrollTop;
        const scrollHeight = menuContent.scrollHeight;
        const clientHeight = menuContent.clientHeight;

        // Calculate scroll direction
        const currentTouchY = e.touches[0].clientY;
        const deltaY = currentTouchY - (this.lastMenuTouchY || currentTouchY);
        this.lastMenuTouchY = currentTouchY;

        // Check boundaries
        const atTop = scrollTop <= 0;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 1;
        const cannotScroll = scrollHeight <= clientHeight;
        const scrollingUp = deltaY > 0;
        const scrollingDown = deltaY < 0;

        // Prevent scroll chaining when at bounds or no scrollable content
        if (cannotScroll || (atTop && scrollingUp) || (atBottom && scrollingDown)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
      return;
    }

    // If touching excludes container but not the textarea, prevent scrolling
    if (isExcludesContainer && !isTextarea) {
      e.preventDefault();
      return;
    }

    if (!isTextarea) return;

    const scrollTop = target.scrollTop;
    const scrollHeight = target.scrollHeight;
    const clientHeight = target.clientHeight;

    // Calculate scroll direction from touch movement
    const currentTouchY = e.touches[0].clientY;
    const deltaY = currentTouchY - (this.lastTouchY || currentTouchY);
    this.lastTouchY = currentTouchY;

    // Check if at boundaries
    const atTop = scrollTop <= 0;
    const atBottom = scrollTop + clientHeight >= scrollHeight - 1; // Small buffer for precision

    // Always prevent scroll chaining when at bounds OR when not enough content to scroll
    const cannotScroll = scrollHeight <= clientHeight;
    const scrollingUp = deltaY > 0;
    const scrollingDown = deltaY < 0;

    if (cannotScroll || (atTop && scrollingUp) || (atBottom && scrollingDown)) {
      e.preventDefault();
      e.stopPropagation();
    }
  },

  preventScrollChaining(e) {
    // Only prevent if the target is not the excludes input or menu content
    const target = e.target;
    const isExcludesInput = target.id === 'excludes-input' || target.tagName === 'TEXTAREA';
    const isMenuContent = target.closest('.menu-content');
    const isOverlayBackground = target === this.overlay;

    // Always allow touches on excludes input
    if (isExcludesInput) {
      return;
    }

    // Allow touches on menu content for navigation/closing
    if (isMenuContent && !isOverlayBackground) {
      return;
    }

    // For overlay background clicks (to close), allow but prevent scrolling
    if (isOverlayBackground) {
      if (e.type === 'touchmove') {
        e.preventDefault();
      }
      return;
    }

    // Prevent everything else
    e.preventDefault();
  },

  open() {
    if (!this.overlay) return;

    // Apply comprehensive body locking for all browsers
    const currentScrollY = window.scrollY;
    document.documentElement.style.setProperty('--body-scroll-top', `-${currentScrollY}px`);
    document.body.classList.add('menu-overlay-active');

    // Detect browser and apply specific classes
    const userAgent = navigator.userAgent;
    const isSafariMobile = /iPhone|iPad|iPod/.test(userAgent) && /Safari/.test(userAgent) && !/Chrome|CriOS|FxiOS/.test(userAgent);
    const isChromeMobile = (/Android/.test(userAgent) && /Chrome/.test(userAgent)) || (/iPhone|iPad|iPod/.test(userAgent) && /CriOS/.test(userAgent));

    if (isSafariMobile) {
      document.body.classList.add('safari-mobile-overlay-active');
      document.documentElement.classList.add('safari-mobile-overlay-active');
    }
    if (isChromeMobile) {
      document.body.classList.add('chrome-mobile-overlay-active');
      document.documentElement.classList.add('chrome-mobile-overlay-active');
    }

    this.overlay.classList.add('show');
    this.hamburger?.classList.add('active');
    this.isOpen = true;

    // Disable keyboard navigation while overlay is open
    // Use the function exposed by CardSystem in desktop.js
    if (window.CardSystem && typeof window.CardSystem.detachKeyboardHandlers === 'function') {
      window.CardSystem.detachKeyboardHandlers();
    }
  },

  close() {
    if (!this.overlay) return;

    // Unfreeze body and restore scroll position
    if (document.body.classList.contains('menu-overlay-active')) {
      const bodyScrollTop = document.documentElement.style.getPropertyValue('--body-scroll-top');
      const scrollY = bodyScrollTop ? parseInt(bodyScrollTop.replace('px', '').replace('-', '')) : 0;

      // Remove all body locking classes
      document.body.classList.remove('menu-overlay-active');
      document.body.classList.remove('safari-mobile-overlay-active');
      document.body.classList.remove('chrome-mobile-overlay-active');
      document.documentElement.classList.remove('safari-mobile-overlay-active');
      document.documentElement.classList.remove('chrome-mobile-overlay-active');

      document.documentElement.style.removeProperty('--body-scroll-top');

      setTimeout(() => {
        window.scrollTo(0, scrollY);
      }, 0);
    }

    this.overlay.classList.remove('show', 'filter-mode');
    this.hamburger?.classList.remove('active');
    this.isOpen = false;

    // Reset menu content to original state
    this.resetToOriginalMenu();

    // Re-enable keyboard navigation after overlay is closed
    // Use the function exposed by CardSystem in desktop.js
    if (window.CardSystem && typeof window.CardSystem.attachKeyboardHandlers === 'function') {
      window.CardSystem.attachKeyboardHandlers();
    }
  },

  enterFilterMode() {
    if (this.overlay) {
      this.overlay.classList.add('filter-mode');
    }
  },

  exitFilterMode() {
    if (this.overlay) {
      this.overlay.classList.remove('filter-mode');
    }
    this.resetToOriginalMenu();
  },

  resetToOriginalMenu() {
    if (!this.menuContent) return;

    // Hide filter/excludes content
    const filterContent = this.menuContent.querySelector('.filter-content');
    const excludesContent = this.menuContent.querySelector('.excludes-content');

    if (filterContent) {
      filterContent.classList.remove('active');
      filterContent.style.display = 'none';

      // Reset filter options to clean state
      const filterOptions = filterContent.querySelectorAll('.filter-option');
      filterOptions.forEach(option => {
        option.classList.remove('text-fade-blur');
        option.style.animationDelay = '';
        option.style.animationDuration = '';
        option.style.background = '';
        option.style.borderColor = '';
        option.style.opacity = '1';
        option.style.filter = 'none';
      });
    }

    if (excludesContent) {
      excludesContent.classList.remove('active');
      excludesContent.style.display = 'none';
    }

    // Show original menu
    const originalMenu = this.menuContent.querySelector('.original-menu');
    if (originalMenu) {
      originalMenu.style.display = 'block';

      const menuLinks = originalMenu.querySelectorAll('a');
      menuLinks.forEach(link => {
        link.style.display = 'block';
        link.style.opacity = '0';
        link.style.transition = 'opacity 0.33s cubic-bezier(0.42,0,0.58,1)';
        link.style.filter = 'none';
        link.classList.remove('text-fade-blur', 'text-wave');
        link.style.animationDuration = '';
        link.style.transform = '';

        // Restore original text if it was split into letters
        if (link.querySelector('.letter')) {
          const letters = link.querySelectorAll('.letter');
          let originalText = '';
          letters.forEach(letter => {
            originalText += letter.textContent === '\u00A0' ? ' ' : letter.textContent;
          });
          link.innerHTML = originalText;
        }
      });
      // Fade in all menu links after the container shrink transition
      setTimeout(() => {
        menuLinks.forEach(link => {
          link.style.opacity = '1';
        });
      }, 300);
    }
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.hamburgerMenu.init());
} else {
  window.hamburgerMenu.init();
}