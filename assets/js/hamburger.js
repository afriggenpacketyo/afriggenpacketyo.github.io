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