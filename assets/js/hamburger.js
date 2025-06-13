// Create a global hamburger menu object
window.hamburgerMenu = {
  overlay: null,
  menuContent: null,
  hamburger: null,
  isOpen: false,

  init() {
    this.overlay = document.getElementById('menu-overlay');
    this.menuContent = document.querySelector('.menu-content');
    this.hamburger = document.querySelector('.header-hamburger');

    if (this.hamburger) {
      this.hamburger.addEventListener('click', () => {
        if (this.isOpen) {
          this.close();
        } else {
          this.open();
        }
      });
    }

    // Add click-outside-to-close functionality
    if (this.overlay) {
      this.overlay.addEventListener('click', (e) => {
        // Only close if clicking on the overlay background, not the menu content
        if (e.target === this.overlay && this.isOpen) {
          this.close();
        }
      });
    }

    // Add Safari mobile specific touch event prevention
    this.addSafariScrollPrevention();
  },

  addSafariScrollPrevention() {
    // Detect Safari mobile and Chrome mobile
    const isSafariMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) &&
                           /Safari/.test(navigator.userAgent) &&
                           !/Chrome|CriOS|FxiOS/.test(navigator.userAgent);

    const isChromeMobile = /Android/.test(navigator.userAgent) && /Chrome/.test(navigator.userAgent) ||
                           /iPhone|iPad|iPod/.test(navigator.userAgent) && /CriOS/.test(navigator.userAgent);

    if (isSafariMobile) {
      // Add Safari-specific class for stronger scroll prevention
      document.body.classList.add('safari-mobile-overlay-active');
      document.documentElement.classList.add('safari-mobile-overlay-active');
    }

    if (isChromeMobile) {
      // Add Chrome-specific class for scroll prevention
      document.body.classList.add('chrome-mobile-overlay-active');
      document.documentElement.classList.add('chrome-mobile-overlay-active');
    }

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

    // If touching menu content or excludes container but not the textarea, prevent scrolling
    if ((isMenuContent || isExcludesContainer) && !isTextarea) {
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

    // Store current scroll position and freeze body
    const currentScrollY = window.scrollY;
    document.documentElement.style.setProperty('--body-scroll-top', `-${currentScrollY}px`);
    document.body.classList.add('menu-overlay-active');

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

      document.body.classList.remove('menu-overlay-active');
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