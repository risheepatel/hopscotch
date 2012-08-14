/**
 *
 * Thoughts:
 * =========
 *
 * support > 1 bubble at a time? gahhhhhhhhh
 * "center" option (for block-level elements that span width of document)
 *
 * TODO:
 * =====
 * test css conflicts on different sites
 * improve auto-scrolling?
 * create hopscotch-jquery.js and hopscotch-yui.js?? blaarlkghiidsfffzp\09u93}%^*(!!
 *
 * position screws up when you align it with a position:fixed element
 * delay for displaying a step
 *
 * onShow, onHide callbacks?
 * support horizontal smooth scroll????????
 *
 * in addition to targetId, do we want to support specifying targetEl directly?
 *
 * flag to see if user has already taken a tour?
 *
 * http://daneden.me/animate/ for bounce animation
 *
 * multiple start/end callbacks
 *
 */

(function() {
  var Hopscotch,
      HopscotchBubble,
      HopscotchI18N,
      utils,
      winLoadHandler,
      undefinedStr      = 'undefined',
      docLoaded         = false, // is the document done loading?
      waitingToStart    = false, // is a tour waiting for the document to finish
                                 // loading so that it can start?
      hasJquery         = (typeof window.jQuery !== undefinedStr),
      hasLocalStorage   = (typeof window.localStorage !== undefinedStr),
      docStyle          = document.body.style,
      hasCssTransitions = (typeof docStyle.MozTransition    !== undefinedStr ||
                           typeof docStyle.MsTransition     !== undefinedStr ||
                           typeof docStyle.webkitTransition !== undefinedStr ||
                           typeof docStyle.OTransition      !== undefinedStr ||
                           typeof docStyle.transition       !== undefinedStr);

  if (window.hopscotch) {
    // Hopscotch already exists.
    return;
  }

  winLoadHandler = function() {
    docLoaded = true;
    if (waitingToStart) {
      window.hopscotch.startTour();
    }
  };

  if (window.addEventListener) {
    window.addEventListener('load', winLoadHandler);
  }
  else if (window.attachEvent) {
    window.attachEvent('onload', winLoadHandler);
  }

  /**
   * utils
   * =====
   * A set of utility functions, mostly for standardizing to manipulate
   * and extract information from the DOM. Basically these are things I
   * would normally use jQuery for, but I don't want to require it for
   * this framework.
   */
  utils = {
    /**
     * addClass
     * ========
     * Adds a class to a DOM element.
     * Note: does not support adding multiple classes at once yet, unless
     * you're using jQuery.
     */
    addClass: function(domEl, classToAdd) {
      var domClasses,
          i, len;

      if (hasJquery) {
        $(domEl).addClass(classToAdd);
      }

      else if (domEl.className.length === 0) {
        domEl.className = classToAdd;
      }
      else {
        domClasses = domEl.className.split(' ');
        for (i = 0, len = domClasses.length; i < len; ++i) {
          if (domClasses[i] === classToAdd) {
            return;
          }
        }
        domClasses.splice(0, 0, classToAdd); // add new class to list
        domEl.className = domClasses.join(' ');
      }
    },

    /**
     * removeClass
     * ===========
     * Remove a class from a DOM element.
     * Note: this one DOES support removing multiple classes.
     */
    removeClass: function(domEl, classToRemove) {
      var domClasses,
          classesToRemove,
          currClass,
          i,
          j,
          toRemoveLen,
          domClassLen;

      if (hasJquery) {
        $(domEl).removeClass(classToRemove);
      }
      else {
        classesToRemove = classToRemove.split(' ');
        domClasses = domEl.className.split(' ');
        for (i = 0, toRemoveLen = classesToRemove.length; i < toRemoveLen; ++i) {
          currClass = classesToRemove[i];
          for (j = 0, domClassLen = domClasses.length; j < domClassLen; ++j) {
            if (domClasses[j] === currClass) {
              break;
            }
          }
          if (j < domClassLen) {
            domClasses.splice(j, 1); // remove class from list
          }
        }
        domEl.className = domClasses.join(' ');
      }
    },

    getPixelValue: function(val) {
      var valType = typeof val;
      if (valType === 'number') { return val; }
      if (valType === 'string') { return parseInt(val, 10); }
      return 0;
    },

    // Inspired by Python...
    valOrDefault: function(val, valDefault) {
      return typeof val !== undefinedStr ? val : valDefault;
    },

    getScrollTop: function() {
      if (typeof window.pageYOffset !== undefinedStr) {
        return window.pageYOffset;
      }
      else {
        // Most likely IE <=8, which doesn't support pageYOffset
        return document.documentElement.scrollTop;
      }
    },

    getScrollLeft: function() {
      if (typeof window.pageXOffset !== undefinedStr) {
        return window.pageXOffset;
      }
      else {
        // Most likely IE <=8, which doesn't support pageXOffset
        return document.documentElement.scrollLeft;
      }
    },

    getWindowHeight: function() {
      return window.innerHeight ? window.innerHeight : document.documentElement.clientHeight;
    },

    getWindowWidth: function() {
      return window.innerWidth ? window.innerWidth : document.documentElement.clientWidth;
    },

    addClickListener: function(el, fn) {
      return el.addEventListener ? el.addEventListener('click', fn) : el.attachEvent('onclick', fn);
    },

    evtPreventDefault: function(evt) {
      if (evt.preventDefault) {
        evt.preventDefault();
      }
      else if (event) {
        event.returnValue = false;
      }
    },

    extend: function(obj1, obj2) {
      var prop;
      for (prop in obj2) {
        if (obj2.hasOwnProperty(prop)) {
          obj1[prop] = obj2[prop];
        }
      }
    },

    // Tour session persistence for multi-page tours. Uses HTML5 localStorage if available, then
    // falls back to using cookies.
    //
    // The following cookie-related logic is borrowed from:
    // http://www.quirksmode.org/js/cookies.html

    setState: function(name,value,days) {
      var expires = '',
          userDataName,
          date;

      if (hasLocalStorage) {
        localStorage.setItem(name, value);
      }
      else {
        if (days) {
          date = new Date();
          date.setTime(date.getTime()+(days*24*60*60*1000));
          expires = "; expires="+date.toGMTString();
        }
        document.cookie = name+"="+value+expires+"; path=/";
      }
    },

    getState: function(name) {
      var nameEQ = name + "=",
          ca = document.cookie.split(';'),
          i,
          c;

      if (hasLocalStorage) {
        return localStorage.getItem(name);
      }
      else {
        for(var i=0;i < ca.length;i++) {
          c = ca[i];
          while (c.charAt(0)===' ') c = c.substring(1,c.length);
          if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
      }
    },

    clearState: function(name) {
      if (hasLocalStorage) {
        localStorage.removeItem(name);
      }
      else {
        this.setState(name,"",-1);
      }
    }
  };

  HopscotchI18N = {
    stepNums: null,
    nextBtn: 'Next',
    prevBtn: 'Back',
    doneBtn: 'Done',
    closeTooltip: 'Close'
  };

  HopscotchBubble = function(opt) {
    var isShowing = false,
        currStep,

    createButton = function(id, text) {
      var btnEl = document.createElement('input');
      btnEl.setAttribute('id', id);
      btnEl.setAttribute('type', 'button');
      btnEl.setAttribute('value', text);
      utils.addClass(btnEl, 'hopscotch-nav-button');

      if (id.indexOf('prev') >= 0) {
        utils.addClass(btnEl, 'prev');
      }
      else {
        utils.addClass(btnEl, 'next');
      }
      return btnEl;
    },

    showButton = function(btnEl, show, permanent) {
      var classname = 'hide';

      if (permanent) {
        // permanent is a flag that indicates we should never show the button
        classname = 'hide-all';
      }
      if (typeof show === undefinedStr) {
        show = true;
      }

      if (show) { utils.removeClass(btnEl, classname); }
      else { utils.addClass(btnEl, classname); }
    },

    /**
     * setPosition
     * ===========
     * Sets the position of the bubble using the bounding rectangle of the
     * target element and the orientation and offset information specified by
     * the step JSON.
     */
    setPosition = function(bubble, step, bounce) {
      var bubbleWidth,
          bubbleHeight,
          bubblePadding,
          boundingRect,
          bounceDelay,
          bounceDirection,
          top,
          left,
          targetEl    = document.getElementById(step.targetId),
          el          = bubble.element,
          arrowEl     = bubble.arrowEl,
          arrowOffset = utils.getPixelValue(step.arrowOffset);

      bounce        = utils.valOrDefault(bounce, true);
      bubbleWidth   = utils.getPixelValue(step.width) || opt.bubbleWidth;
      bubblePadding = utils.valOrDefault(step.padding, opt.bubblePadding);
      bubbleBorder = utils.valOrDefault(step.padding, opt.bubbleBorder);

      utils.removeClass(el, 'bounce-down bounce-up bounce-left bounce-right');

      // SET POSITION
      boundingRect = targetEl.getBoundingClientRect();
      if (step.orientation === 'top') {
        bubbleHeight = el.offsetHeight;
        top = (boundingRect.top - bubbleHeight) - opt.arrowWidth;
        left = boundingRect.left;
        bounceDirection = 'bounce-down';
      }
      else if (step.orientation === 'bottom') {
        top = boundingRect.bottom + opt.arrowWidth;
        left = boundingRect.left;
        bounceDirection = 'bounce-up';
      }
      else if (step.orientation === 'left') {
        top = boundingRect.top;
        left = boundingRect.left - bubbleWidth - 2*bubblePadding - 2*bubbleBorder - opt.arrowWidth;
        bounceDirection = 'bounce-right';
      }
      else if (step.orientation === 'right') {
        top = boundingRect.top;
        left = boundingRect.right + opt.arrowWidth;
        bounceDirection = 'bounce-left';
      }

      // SET (OR RESET) ARROW OFFSETS
      if (!arrowOffset) {
        arrowEl.style.top = '';
        arrowEl.style.left = '';
      }
      else if (step.orientation === 'top' || step.orientation === 'bottom') {
        arrowEl.style.left = arrowOffset + 'px';
      }
      else if (step.orientation === 'left' || step.orientation === 'right') {
        arrowEl.style.top = arrowOffset + 'px';
      }

      // SET OFFSETS
      left += utils.getPixelValue(step.xOffset);
      top += utils.getPixelValue(step.yOffset);

      // ADJUST TOP FOR SCROLL POSITION
      top += utils.getScrollTop();
      left += utils.getScrollLeft();

      if (opt.animate) {
        if (!hasCssTransitions && hasJquery && opt.animate) {
          $(el).animate({
            top: top + 'px',
            left: left + 'px'
          });
        }
        else { // hasCssTransitions || !hasJquery || !opt.animate
          el.style.top = top + 'px';
          el.style.left = left + 'px';
        }
      }
      else {
        el.style.top = top + 'px';
        el.style.left = left + 'px';

        // Do the bouncing effect
        if (bounce) {
          bounceDelay = opt.smoothScroll ? opt.scrollDuration : 0;

          setTimeout(function() {
            utils.addClass(el, bounceDirection);
          }, bounceDelay);
          // Then remove it
          setTimeout(function() {
            utils.removeClass(el, bounceDirection);
          }, bounceDelay + 2000); // bounce lasts 2 seconds
        }
      }
    };

    this.init = function() {
      var el             = document.createElement('div'),
          containerEl    = document.createElement('div'),
          self           = this,
          resizeCooldown = false, // for updating after window resize
          winResizeTimeout;

      this.element     = el;
      this.containerEl = containerEl;
      this.titleEl     = document.createElement('h3');
      this.numberEl    = document.createElement('span');
      this.contentEl   = document.createElement('p');

      el.setAttribute('id', 'hopscotch-bubble');
      utils.addClass(el, 'animated');
      containerEl.setAttribute('id', 'hopscotch-bubble-container');
      this.numberEl.setAttribute('id', 'hopscotch-bubble-number');
      containerEl.appendChild(this.numberEl);
      containerEl.appendChild(this.titleEl);
      containerEl.appendChild(this.contentEl);
      el.appendChild(containerEl);

      this.initNavButtons();

      if (opt && opt.showCloseButton) {
        this.initCloseButton();
      }

      this.initArrow();

      // Not pretty, but IE doesn't support Function.bind(), so I'm
      // relying on closures to keep a handle of "this".
      // Reset position of bubble when window is resized
      window.onresize = function() {
        if (resizeCooldown || !isShowing) {
          return;
        }
        resizeCooldown = true;
        winResizeTimeout = setTimeout(function() {
          setPosition(self, currStep, false);
          resizeCooldown = false;
        }, 200);
      };

      document.body.appendChild(el);
      return this;
    };

    this.initNavButtons = function() {
      var buttonsEl  = document.createElement('div');

      this.prevBtnEl = createButton('hopscotch-prev', HopscotchI18N.prevBtn);
      this.nextBtnEl = createButton('hopscotch-next', HopscotchI18N.nextBtn);
      this.doneBtnEl = createButton('hopscotch-done', HopscotchI18N.doneBtn);
      utils.addClass(this.doneBtnEl, 'hide');

      buttonsEl.appendChild(this.prevBtnEl);
      buttonsEl.appendChild(this.nextBtnEl);
      buttonsEl.appendChild(this.doneBtnEl);

      // Attach click listeners
      utils.addClickListener(this.prevBtnEl, function(evt) {
        window.hopscotch.prevStep();
      });
      utils.addClickListener(this.nextBtnEl, function(evt) {
        window.hopscotch.nextStep();
      });
      utils.addClickListener(this.doneBtnEl, window.hopscotch.endTour);

      buttonsEl.setAttribute('id', 'hopscotch-actions');
      this.buttonsEl = buttonsEl;

      this.containerEl.appendChild(buttonsEl);
      return this;
    };

    this.initCloseButton = function() {
      var closeBtnEl = document.createElement('a');

      closeBtnEl.setAttribute('id', 'hopscotch-bubble-close');
      closeBtnEl.setAttribute('href', '#');
      closeBtnEl.setAttribute('title', HopscotchI18N.closeTooltip);
      closeBtnEl.innerHTML = 'x';

      utils.addClickListener(closeBtnEl, function(evt) {
        window.hopscotch.endTour();
        utils.evtPreventDefault(evt);
      });

      this.closeBtnEl = closeBtnEl;
      this.containerEl.appendChild(closeBtnEl);
      return this;
    };

    this.initArrow = function() {
      var arrowBorderEl;

      this.arrowEl = document.createElement('div');
      this.arrowEl.setAttribute('id', 'hopscotch-bubble-arrow-container');

      arrowBorderEl = document.createElement('div');
      arrowBorderEl.className = 'hopscotch-bubble-arrow-border';

      arrowEl = document.createElement('div');
      arrowEl.className = 'hopscotch-bubble-arrow';

      this.arrowEl.appendChild(arrowBorderEl);
      this.arrowEl.appendChild(arrowEl);

      this.element.appendChild(this.arrowEl);
    };

    this.renderStep = function(step, idx, subIdx, isLast, callback) {
      var self     = this,
          showNext = utils.valOrDefault(step.showNextButton, opt.showNextButton),
          showPrev = utils.valOrDefault(step.showPrevButton, opt.showPrevButton),
          bubbleWidth,
          bubblePadding;

      currStep = step;
      this.setTitle(step.title ? step.title : '');
      this.setContent(step.content ? step.content : '');
      this.setNum(idx);

      this.showPrevButton(this.prevBtnEl && showPrev && (idx > 0 || subIdx > 0));
      this.showNextButton(this.nextBtnEl && showNext && !isLast);
      if (isLast) {
        utils.removeClass(this.doneBtnEl, 'hide');
      }
      else {
        utils.addClass(this.doneBtnEl, 'hide');
      }

      this.setArrow(step.orientation);

      // Set dimensions
      bubbleWidth   = utils.getPixelValue(step.width) || opt.bubbleWidth;
      bubblePadding = utils.valOrDefault(step.padding, opt.bubblePadding);
      this.containerEl.style.width = bubbleWidth + 'px';
      this.containerEl.style.padding = bubblePadding + 'px';

      if (step.orientation === 'top') {
        // Timeout to get correct height of bubble for positioning.
        setTimeout(function() {
          setPosition(self, step);
          if (callback) { callback(); }
        }, 5);
      }
      else {
        // Don't care about height for the other orientations.
        setPosition(this, step);
        if (callback) { callback(); }
      }

      return this;
    };

    this.setTitle = function(titleStr) {
      if (titleStr) {
        this.titleEl.innerHTML = titleStr;
        utils.removeClass(this.titleEl, 'hide');
      }
      else {
        utils.addClass(this.titleEl, 'hide');
      }
      return this;
    };

    this.setContent = function(contentStr) {
      // CAREFUL!! Using innerHTML, so don't use any user-generated
      // content here. (or if you must, escape it first)
      if (contentStr) {
        this.contentEl.innerHTML = contentStr;
        utils.removeClass(this.contentEl, 'hide');
      }
      else {
        utils.addClass(this.contentEl, 'hide');
      }
      return this;
    };

    this.setNum = function(idx) {
      if (HopscotchI18N.stepNums && idx < HopscotchI18N.stepNums.length) {
        idx = HopscotchI18N.stepNums[idx];
      }
      else {
        idx = idx + 1;
      }
      this.numberEl.innerHTML = idx;
    };

    this.setArrow = function(orientation) {
      // Whatever the orientation is, we want to arrow to appear
      // "opposite" of the orientation. E.g., a top orientation
      // requires a bottom arrow.
      if (orientation === 'top') {
        this.arrowEl.className = 'down';
      }
      else if (orientation === 'bottom') {
        this.arrowEl.className = 'up';
      }
      else if (orientation === 'left') {
        this.arrowEl.className = 'right';
      }
      else if (orientation === 'right') {
        this.arrowEl.className = 'left';
      }
    };

    this.show = function() {
      var self = this;
      if (opt.animate) {
        setTimeout(function() {
          utils.addClass(self.element, 'animate');
        }, 50);
      }
      utils.removeClass(this.element, 'hide');
      isShowing = true;
      return this;
    };

    this.hide = function() {
      utils.addClass(this.element, 'hide');
      utils.removeClass(this.element, 'animate');
      isShowing = false;
      return this;
    };

    this.showPrevButton = function(show, permanent) {
      showButton(this.prevBtnEl, show, permanent);
    };

    this.showNextButton = function(show, permanent) {
      showButton(this.nextBtnEl, show, permanent);
    };

    this.showCloseButton = function(show, permanent) {
      showButton(this.closeBtnEl, show, permanent);
    };


    /**
     * initAnimate
     * ===========
     * This function exists due to how Chrome handles initial CSS transitions.
     * Most other browsers will not animate a transition until the element
     * exists on the page. Chrome treats DOM elements as starting from the
     * (0, 0) position, and will animate from the upper left corner on creation
     * of the DOM element. (e.g., if you create a new DOM element using
     * Javascript and specify CSS top: 100px, left: 50px, then append the
     * DOM element to the document.body, it will create it at 0, 0 and then
     * animate it to 50, 100)
     *
     * Solution is to add the animate class (which defines our transition)
     * only after the element is created.
     */
    this.initAnimate = function() {
      var self = this;
      setTimeout(function() {
        utils.addClass(self.element, 'animate');
      }, 50);
    };

    this.removeAnimate = function() {
      utils.removeClass(this.element, 'animate');
    };

    this.init();
  };

  Hopscotch = function(initOptions) {
    var bubble,
        opt,
        currTour,
        currStepNum,
        currSubstepNum,
        cookieTourId,
        cookieTourStep,
        cookieTourSubstep,

    /**
     * getBubble
     * ==========
     * Retrieves the "singleton" bubble div or creates it if it doesn't
     * exist yet.
     */
    getBubble = function() {
      if (!bubble) {
        bubble = new HopscotchBubble(opt);
      }
      return bubble;
    },

    getCurrStep = function() {
      var step = currTour.steps[currStepNum];

      return (step.length > 0) ? step[currSubstepNum] : step;
    },

    /**
     * incrementStep
     * =============
     * Sets current step num and substep num to the next step in the tour.
     * Returns true if successful, false if not.
     */
    incrementStep = function() {
      var numSubsteps = currTour.steps[currStepNum].length;
      if (currSubstepNum < numSubsteps-1) {
        ++currSubstepNum;
        return true;
      }
      else if (currStepNum < currTour.steps.length-1) {
        ++currStepNum;
        currSubstepNum = isInMultiPartStep() ? 0 : undefined;
        return true;
      }
      return false;
    },

    /**
     * decrementStep
     * =============
     * Sets current step num and substep num to the previous step in the tour.
     * Returns true if successful, false if not.
     */
    decrementStep = function() {
      var numPrevSubsteps;
      if (currSubstepNum > 0) {
        --currSubstepNum;
        return true;
      }
      else if (currStepNum > 0) {
        numPrevSubsteps = currTour.steps[--currStepNum].length;
        if (numPrevSubsteps) {
          currSubstepNum = numPrevSubsteps-1;
        }
        else {
          currSubstepNum = undefined;
        }
        return true;
      }
      return false;
    },

    isInMultiPartStep = function() {
      return currTour.steps[currStepNum].length > 0;
    },

    /**
     * adjustWindowScroll
     * ==================
     * Checks if the bubble or target element is partially or completely
     * outside of the viewport. If it is, adjust the window scroll position
     * to bring it back into the viewport.
     */
    adjustWindowScroll = function() {
      var bubbleEl       = getBubble().element,
          bubbleTop      = utils.getPixelValue(bubbleEl.style.top),
          bubbleBottom   = bubbleTop + utils.getPixelValue(bubbleEl.offsetHeight),
          targetEl       = document.getElementById(getCurrStep().targetId),
          targetBounds   = targetEl.getBoundingClientRect(),
          targetElTop    = targetBounds.top + utils.getScrollTop(),
          targetElBottom = targetBounds.bottom + utils.getScrollTop(),
          targetTop      = (bubbleTop < targetElTop) ? bubbleTop : targetElTop, // target whichever is higher
          targetBottom   = (bubbleBottom > targetElBottom) ? bubbleBottom : targetElBottom, // whichever is lower
          windowTop      = utils.getScrollTop(),
          windowBottom   = windowTop + utils.getWindowHeight(),
          scrollToVal    = targetTop - opt.scrollTopMargin, // This is our final target scroll value.
          scrollEl,
          yuiAnim,
          yuiEase,
          direction,
          scrollIncr,
          scrollInt;

      // Leverage jQuery if it's present for scrolling
      if (hasJquery) {
        $('body, html').animate({ scrollTop: scrollToVal }, opt.scrollDuration);
        return;
      }
      else if (typeof YAHOO             !== undefinedStr &&
               typeof YAHOO.env         !== undefinedStr &&
               typeof YAHOO.env.ua      !== undefinedStr &&
               typeof YAHOO.util        !== undefinedStr &&
               typeof YAHOO.util.Scroll !== undefinedStr) {
        scrollEl = YAHOO.env.ua.webkit ? document.body : document.documentElement;
        yuiEase = YAHOO.util.Easing ? YAHOO.util.Easing.easeOut : undefined;
        yuiAnim = new YAHOO.util.Scroll(scrollEl, {
          scroll: { to: [0, scrollToVal] }
        }, opt.scrollDuration/1000, yuiEase);
        yuiAnim.animate();
        return;
      }

      if (scrollToVal < 0) {
        scrollToVal = 0;
      }

      if (targetTop >= windowTop && targetTop <= windowTop + opt.scrollTopMargin) {
        return;
      }

      if (targetTop < windowTop || targetBottom > windowBottom) {
        if (opt.smoothScroll) {
          // 48 * 10 == 480ms scroll duration
          // make it slightly less than CSS transition duration because of
          // setInterval overhead.
          // To increase or decrease duration, change the divisor of scrollIncr.
          direction = (windowTop > targetTop) ? -1 : 1; // -1 means scrolling up, 1 means down
          scrollIncr = Math.abs(windowTop - scrollToVal) / (opt.scrollDuration/10);
          scrollInt = setInterval(function() {
            var scrollTop = utils.getScrollTop(),
                scrollTarget = scrollTop + (direction * scrollIncr);

            if ((direction > 0 && scrollTarget >= scrollToVal) ||
                direction < 0 && scrollTarget <= scrollToVal) {
              // Overshot our target. Just manually set to equal the target
              // and clear the interval
              scrollTarget = scrollToVal;
              clearInterval(scrollInt);
            }

            window.scrollTo(0, scrollTarget);

            if (utils.getScrollTop() === scrollTop) {
              // Couldn't scroll any further. Clear interval.
              clearInterval(scrollInt);
            }
          }, 10);
        }
        else {
          window.scrollTo(0, scrollToVal);
        }
      }
    };

    this.init = function() {
      var tourState,
          tourPair;

      if (initOptions) {
        this.configure(initOptions);
      }
      return this;
    };

    /**
     * loadTour
     * ========
     * Loads, but does not display, tour. (Give the developer a chance to
     * override tour-specified configuration options before displaying)
     */
    this.loadTour = function(tour) {
      var tmpOpt = {},
          bubble,
          prop,
          stepPair;
      currTour = tour;

      // Set tour-specific configurations
      for (prop in tour) {
        if (tour.hasOwnProperty(prop) &&
            prop !== 'id' &&
            prop !== 'steps') {
          tmpOpt[prop] = tour[prop];
        }
      }
      opt = {}; // reset all options so there are no surprises
      this.configure(tmpOpt);

      // Get existing tour state, if it exists.
      tourState = utils.getState(opt.cookieName);
      if (tourState) {
        tourPair            = tourState.split(':');
        cookieTourId        = tourPair[0]; // selecting tour is not supported by this framework.
        cookieTourStep      = tourPair[1];
        cookieTourSubstep   = undefined;
        stepPair            = cookieTourStep.split('-');

        if (stepPair.length > 1) {
          cookieTourStep    = parseInt(stepPair[0], 10);
          cookieTourSubstep = parseInt(stepPair[1], 10);
        }
        else {
          cookieTourStep    = parseInt(cookieTourStep, 10);
        }

        // Check for multipage flag
        if (tourPair.length > 2 && tourPair[2] === 'mp') {
          // Increment cookie step
          if (cookieTourSubstep && cookieTourSubstep < currTour.steps[cookieTourStep].length-1) {
            ++cookieTourSubstep;
          }
          else if (cookieTourStep < currTour.steps.length-1) {
            ++cookieTourStep;
            if (currTour.steps[cookieTourStep].length > 0) {
              cookieTourSubstep = 0;
            }
            else {
              cookieTourSubstep = undefined;
            }
          }
        }
      }

      // Initialize whether to show or hide nav buttons
      bubble = getBubble();
      bubble.showPrevButton(opt.showPrevButton, true);
      bubble.showNextButton(opt.showNextButton, true);
      return this;
    };

    this.startTour = function(stepNum, substepNum) {
      var bubble,
          step;

      if (!currTour) {
        throw "Need to load a tour before you start it!";
      }

      if (document.readyState !== 'complete') {
        waitingToStart = true;
        return;
      }

      if (typeof stepNum !== undefinedStr) {
        currStepNum    = stepNum;
        currSubstepNum = substepNum;
      }

      // Check if we are resuming state.
      else if (currTour.id === cookieTourId && typeof cookieTourStep !== undefinedStr) {
        currStepNum    = cookieTourStep;
        currSubstepNum = cookieTourSubstep;
        step           = getCurrStep();
        if (!document.getElementById(step.targetId)) {
          decrementStep();
          step = getCurrStep();
          // May have just refreshed the page. Previous step should work. (but don't change cookie)
          if (!document.getElementById(step.targetId)) {
            // Previous target doesn't exist either. The user may have just
            // clicked on a link that wasn't part of the tour. Let's just "end"
            // the tour and depend on the cookie to pick the user back up where
            // she left off.
            this.endTour(false);
            return;
          }
        }
      }
      else {
        currStepNum = 0;
      }

      if (!currSubstepNum && isInMultiPartStep()) {
        // Multi-part step
        currSubstepNum = 0;
      }

      if (opt.onStart && currStepNum === 0 && !currSubstepNum) {
        opt.onStart(currTour.id);
      }

      this.showStep(currStepNum, currSubstepNum);
      bubble = getBubble().show();

      if (opt.animate) {
        bubble.initAnimate();
      }
      this.isActive = true;
      return this;
    };

    this.showStep = function(stepIdx, substepIdx) {
      var tourSteps    = currTour.steps,
          step         = tourSteps[stepIdx],
          numTourSteps = tourSteps.length,
          cookieVal    = currTour.id + ':' + stepIdx,
          bubble       = getBubble(),
          isLast;

      // Update bubble for current step
      currStepNum    = stepIdx;
      currSubstepNum = substepIdx;

      if (typeof substepIdx !== undefinedStr && isInMultiPartStep()) {
        step = step[substepIdx];
        cookieVal += '-' + substepIdx;
      }

      isLast = (stepIdx === numTourSteps - 1) || (substepIdx >= step.length - 1);
      bubble.renderStep(step, stepIdx, substepIdx, isLast, adjustWindowScroll);

      if (step.multiPage) {
        cookieVal += ':mp';
      }

      utils.setState(opt.cookieName, cookieVal, 1);
      return this;
    };

    this.prevStep = function() {
      var step = getCurrStep();

      if (step.onPrev) {
        step.onPrev();
      }

      if (decrementStep()) {
        this.showStep(currStepNum, currSubstepNum);
      }
      return this;
    };

    this.nextStep = function() {
      var step = getCurrStep();

      // invoke Next button callbacks
      if (opt.onNext) {
        opt.onNext(step, currStepNum);
      }
      if (step.onNext) {
        step.onNext();
      }

      if (incrementStep()) {
        this.showStep(currStepNum, currSubstepNum);
      }

      return this;
    };

    /**
     * endTour
     * ==========
     * Cancels out of an active tour. No state is preserved.
     */
    this.endTour = function(clearCookie) {
      var bubble     = getBubble();
      clearCookie    = utils.valOrDefault(clearCookie, true);
      currStepNum    = 0;
      currSubstepNum = undefined;
      cookieTourStep = undefined;

      bubble.hide();
      if (clearCookie) {
        utils.clearState(opt.cookieName);
      }
      this.isActive = false;

      if (opt.onEnd) {
        opt.onEnd(currTour.id);
      }
      return this;
    };

    this.getCurrStepNum = function() {
      return currStepNum;
    };

    this.getCurrSubstepNum = function() {
      return currSubstepNum;
    };

    /**
     * configure
     * =========
     * VALID OPTIONS INCLUDE...
     * bubbleWidth:     Number   - Default bubble width. Defaults to 280.
     * bubblePadding:   Number   - Default bubble padding. Defaults to 15.
     * bubbleBorder:    Number   - Default bubble border width. Defaults to 6.
     * animate:         Boolean  - should the tour bubble animate between steps?
     *                             Defaults to FALSE.
     * smoothScroll:    Boolean  - should the page scroll smoothly to the next
     *                             step? Defaults to TRUE.
     * scrollDuration:  Number   - Duration of page scroll. Only relevant when
     *                             smoothScroll is set to true. Defaults to
     *                             1000ms.
     * scrollTopMargin: NUMBER   - When the page scrolls, how much space should there
     *                             be between the bubble/targetElement and the top
     *                             of the viewport? Defaults to 200.
     * showCloseButton: Boolean  - should the tour bubble show a close (X) button?
     *                             Defaults to TRUE.
     * showPrevButton:  Boolean  - should the bubble have the Previous button?
     *                             Defaults to FALSE.
     * showNextButton:  Boolean  - should the bubble have the Next button?
     *                             Defaults to TRUE.
     * arrowWidth:      Number   - Default arrow width. (space between the bubble
     *                             and the targetEl) Need to provide the option
     *                             to set this here in case developer wants to
     *                             use own CSS. Defaults to 28.
     * cookieName:      String   - Name for the cookie key. Defaults to
     *                             'hopscotch.tour.state'.
     * onNext:          Function - A callback to be invoked after every click on
     *                             a "Next" button.
     *
     * i18n:            Object   - For i18n purposes. Allows you to change the
     *                             text of button labels and step numbers.
     * i18n.stepNums:   Array<String> - Provide a list of strings to be shown as
     *                             the step number, based on index of array. Unicode
     *                             characters are supported. (e.g., ['&#x4e00;',
     *                             '&#x4e8c;', '&#x4e09;']) If there are more steps
     *                             than provided numbers, Arabic numerals
     *                             ('4', '5', '6', etc.) will be used as default.
     */
    this.configure = function(options) {
      var bubble;

      if (!opt) {
        opt = {};
      }

      utils.extend(opt, options);
      opt.animate         = utils.valOrDefault(opt.animate, false);
      opt.smoothScroll    = utils.valOrDefault(opt.smoothScroll, true);
      opt.scrollDuration  = utils.valOrDefault(opt.scrollDuration, 1000);
      opt.scrollTopMargin = utils.valOrDefault(opt.scrollTopMargin, 200);
      opt.showCloseButton = utils.valOrDefault(opt.showCloseButton, true);
      opt.showPrevButton  = utils.valOrDefault(opt.showPrevButton, false);
      opt.showNextButton  = utils.valOrDefault(opt.showNextButton, true);
      opt.bubbleWidth     = utils.valOrDefault(opt.bubbleWidth, 280);
      opt.bubblePadding   = utils.valOrDefault(opt.bubblePadding, 15);
      opt.bubbleBorder    = utils.valOrDefault(opt.bubbleBorder, 6);
      opt.arrowWidth      = utils.valOrDefault(opt.arrowWidth, 20);
      opt.onNext          = utils.valOrDefault(opt.onNext, null);
      opt.onStart         = utils.valOrDefault(opt.onStart, null);
      opt.onEnd           = utils.valOrDefault(opt.onEnd, null);
      opt.cookieName      = utils.valOrDefault(opt.cookieName, 'hopscotch.tour.state');

      if (options) {
        utils.extend(HopscotchI18N, options.i18n);
      }

      bubble = getBubble();

      if (opt.animate) {
        bubble.initAnimate();
      }
      else {
        bubble.removeAnimate();
      }

      bubble.showPrevButton(opt.showPrevButton, true);
      bubble.showNextButton(opt.showNextButton, true);
      bubble.showCloseButton(opt.showCloseButton, true);
      return this;
    };

    this.init(initOptions);
  };

  window.hopscotch = new Hopscotch();
}());
