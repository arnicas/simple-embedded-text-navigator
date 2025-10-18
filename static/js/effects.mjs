
import { gsap } from 'gsap';

// ===== GLOBAL CATEGORY DATA MANAGEMENT (moved to top to ensure clear module scope) =====
let globalCategoryCounts = {};
let globalCategoryScores = {};

export function setGlobalCategoryData(counts, scores) {
  globalCategoryCounts = counts || {};
  globalCategoryScores = scores || {};
}

function getGlobalCategoryCount(category) {
  return globalCategoryCounts[category] || 0;
}

function getGlobalCategoryScore(category) {
  return globalCategoryScores[category] || 0;
}

export function randomY(x, y) {
    return Math.floor(Math.random() * (y - x + 1)) + x;
  }

  
  
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function showAnimationHideText(newText) {
    const animation = document.getElementById('animation');
    animation.style.display = 'flex';
    // Check if text contains ANY HTML markup - if so, don't sanitize
    if (/<[^>]+>/.test(newText)) {
      animation.innerHTML = newText;
    } else {
      animation.innerHTML = formattedContent(newText);
    }
    const text = document.getElementById('text');
    text.style.display = 'none';
    text.innerHTML = '';
  }
  
  function showTextHideAnimation(newText) {
    const animation = document.getElementById('animation');
    animation.style.display = 'none';
    animation.innerHTML = '';
    const text = document.getElementById('text');
    text.style.display = 'flex';
    // Check if text contains ANY HTML markup - if so, don't sanitize
    if (/<[^>]+>/.test(newText)) {
      text.innerHTML = newText;
    } else {
      text.innerHTML = formattedContent(newText);
    }
  }

function sanitize(string) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;',
    };
    const reg = /[&<>"'/]/ig;
    string = string.replace(/_/g,'');  // remove underscores
    string = string.replace(/,,/g,',');  // remove double commas
    string = string.replace(reg, (match)=>(map[match]));
    string = string.replace(/--/g,'&mdash;');
    return string;
  }
  
export function formattedContent(newText) {
    // If HTML tags are present, assume trusted markup and return as-is
    if (/<[^>]*>/.test(newText)) {
      return newText;
    }
    // Sanitize the input
    let safeText = sanitize(newText);
    
    // Replace straight quotes with curly quotes
    safeText = safeText.replace(/(^|[-\u2014\s(\["])'/g, "$1\u2018");  // opening singles
    safeText = safeText.replace(/'/g, "\u2019");  // closing singles & apostrophes
    safeText = safeText.replace(/(^|[-\u2014\/\[(\u2018\s])"/g, "$1\u201c");  // opening doubles
    safeText = safeText.replace(/"/g, "\u201d");  // closing doubles
    
    // Replace double hyphens with em-dashes
    safeText = safeText.replace(/--/g, "\u2014");
    
    return safeText;
  }

function bounceIn(element, newText) {
    console.log('in bounceIn', element, newText);
    let e = null;
    showAnimationHideText(newText);
   // something weird with the dom text
    gsap.delayedCall(1, async () => {
      const animation = document.getElementById('animation');
      console.log("inner html animation", animation.innerHTML);
      e = new SplitType("#animation", {type:"words"});  // adds new div underneath text though
      console.log(e.words.map(word => word.textContent));    // add the translateY to all the words with .word
      e.words.forEach(word => {
        word.style.transform = 'translateY(' + randomY(-20, 20) + 'px)';
      });
  
      gsap.to('.word', {
        opacity: 1,
        y: 0,
        duration: 0.05,
        ease: "power2.inOut",
        stagger: 0.1,
        onComplete:()=>{
          console.log('in onComplete');
          // delete the children in the div
          showTextHideAnimation(newText);
          }
        });
      });
  }
  
  
  // from https://codepen.io/webdevpuneet/pen/BabRBQa 
  function burnIn(element, newText) {
    console.log('in burnIn', element, newText);
    const animation = document.getElementById('animation');
    showAnimationHideText(newText);
    let e = new SplitType(animation, {type:"words"});  // adds new div underneath text though
    let tl = gsap.timeline({onComplete:()=>{
      console.log('in onComplete');
      // delete the children in the div
      showTextHideAnimation(newText);
      }});
    e = shuffle(e.words); // mix up
    tl.addLabel("frame1")
      .to(e, {duration:0.005, stagger:0.1, autoAlpha:1, y:5, textShadow:"0px 0px 10px rgb(0,0,0)", color:"black"})
      .addLabel("frame2")
      .to(e, {duration:0.005, stagger:0.1, autoAlpha:1, y:0, textShadow:"0px 0px 0px rgb(255, 255, 255)", color:"black"});
    }

// ===== SCORE CELEBRATION ANIMATIONS =====

export function showScoreCelebration(score, startX = null, startY = null) {
  console.log(`Creating score celebration for ${score} points`);

  // Create score celebration element
  const scoreElement = document.createElement('div');
  scoreElement.className = 'score-celebration';
  scoreElement.textContent = `+${score}!`;

  // Set starting position - default to center if not specified
  if (startX !== null && startY !== null) {
    scoreElement.style.left = startX + 'px';
    scoreElement.style.top = startY + 'px';
    scoreElement.style.transform = 'translate(-50%, -50%) scale(0.2)'; // Center on the point
  }

  // Add to document
  document.body.appendChild(scoreElement);

  // Generate random fly-off direction
  const directions = [
    { x: -window.innerWidth, y: -window.innerHeight },  // Top-left
    { x: window.innerWidth, y: -window.innerHeight },   // Top-right
    { x: -window.innerWidth, y: window.innerHeight },   // Bottom-left
    { x: window.innerWidth, y: window.innerHeight },    // Bottom-right
    { x: 0, y: -window.innerHeight * 1.5 },             // Straight up
    { x: -window.innerWidth * 1.5, y: 0 },              // Straight left
    { x: window.innerWidth * 1.5, y: 0 }                // Straight right
  ];

  const randomDirection = directions[Math.floor(Math.random() * directions.length)];

  // GSAP animation sequence
  const tl = gsap.timeline({
    onComplete: () => {
      if (scoreElement && scoreElement.parentNode) {
        scoreElement.parentNode.removeChild(scoreElement);
      }
    }
  });

  tl.to(scoreElement, {
    opacity: 1,
    scale: 2.2,
    duration: 0.3,
    ease: "back.out(1.7)"
  })
  .to(scoreElement, {
    scale: 1.8,
    duration: 0.2,
    ease: "power2.out"
  })
  .to(scoreElement, {
    scale: 1.0,
    duration: 0.3,
    ease: "power1.out"
  })
  .to(scoreElement, {
    x: randomDirection.x,
    y: randomDirection.y,
    opacity: 0,
    scale: 0.5,
    duration: 1.2,
    ease: "power2.in"
  });

  console.log(`Score celebration: +${score}pts flying to ${randomDirection.x}, ${randomDirection.y}`);
}

export function showCategoryScoreCelebration(score) {
  // Start celebration from the text box area
  const textElement = document.getElementById('text');
  if (textElement) {
    const rect = textElement.getBoundingClientRect();
    const startX = rect.left + (rect.width / 2);
    const startY = rect.top + (rect.height / 2);
    showScoreCelebration(score, startX, startY);
    console.log(`Category score celebration started from text area (${Math.round(startX)}, ${Math.round(startY)})`);
  } else {
    // Fallback to default center position
    showScoreCelebration(score);
  }
}

export function showMetadataScoreCelebration(score) {
  // Start celebration from the metadata buckets area
  const metadataBuckets = document.getElementById('metadataBuckets');
  if (metadataBuckets) {
    const rect = metadataBuckets.getBoundingClientRect();
    const startX = rect.left + (rect.width / 2);
    const startY = rect.top + (rect.height / 2);
    showMetadataScoreCelebrationWithPink(score, startX, startY);
   // console.log(`Metadata score celebration started from metadata area (${Math.round(startX)}, ${Math.round(startY)})`);
  } else {
    // Fallback to default center position
    showMetadataScoreCelebrationWithPink(score);
  }
}

export function showMetadataScoreCelebrationWithPink(score, startX = null, startY = null) {
  console.log(`Creating pink metadata score celebration for ${score} points`);

  // Create score celebration element with pink styling
  const scoreElement = document.createElement('div');
  scoreElement.className = 'score-celebration-metadata';
  scoreElement.textContent = `+${score}!`;

  // Set starting position - default to center if not specified
  if (startX !== null && startY !== null) {
    scoreElement.style.left = startX + 'px';
    scoreElement.style.top = startY + 'px';
    scoreElement.style.transform = 'translate(-50%, -50%) scale(0.2)'; // Center on the point
  }

  // Add to document
  document.body.appendChild(scoreElement);

  // Generate random fly-off direction
  const directions = [
    { x: -window.innerWidth, y: -window.innerHeight },  // Top-left
    { x: window.innerWidth, y: -window.innerHeight },   // Top-right
    { x: -window.innerWidth, y: window.innerHeight },   // Bottom-left
    { x: window.innerWidth, y: window.innerHeight },    // Bottom-right
    { x: 0, y: -window.innerHeight * 1.5 },             // Straight up
    { x: -window.innerWidth * 1.5, y: 0 },              // Straight left
    { x: window.innerWidth * 1.5, y: 0 }                // Straight right
  ];

  const randomDirection = directions[Math.floor(Math.random() * directions.length)];

  // GSAP animation sequence (same as regular celebrations)
  const tl = gsap.timeline({
    onComplete: () => {
      if (scoreElement && scoreElement.parentNode) {
        scoreElement.parentNode.removeChild(scoreElement);
      }
    }
  });

  tl.to(scoreElement, {
    duration: 0.3,
    scale: 2.2,
    opacity: 1,
    ease: "back.out(1.7)"
  })
  .to(scoreElement, {
    duration: 0.4,
    scale: 1.8,
    ease: "power2.out"
  })
  .to(scoreElement, {
    duration: 1.2,
    x: randomDirection.x,
    y: randomDirection.y,
    opacity: 0,
    scale: 0.5,
    ease: "power2.in"
  });
}

// ===== TEXT AND BUCKET ANIMATIONS =====

export function animatePhrasesToBuckets(highlights, onComplete) {
  //console.log('animatePhrasesToBuckets called with highlights:', highlights);

  if (highlights.length === 0) {
    if (onComplete) onComplete();
    return;
  }

  let completedAnimations = 0;
  const totalAnimations = highlights.length;

  highlights.forEach((highlight, index) => {
    // Small delay for staggered effect
    gsap.delayedCall(index * 0.2, () => {
      const phraseElement = document.getElementById(highlight.id);
      const bucket = document.getElementById(`bucket-${highlight.category}`);

      /*console.log(`Animating highlight ${highlight.id}:`, {
        phraseElement: !!phraseElement,
        bucket: !!bucket,
        category: highlight.category
    });*/


      if (!phraseElement || !bucket) {
        console.log('Missing elements for animation:', {
          phraseElement: !!phraseElement,
          bucket: !!bucket,
          highlightId: highlight.id,
          bucketId: `bucket-${highlight.category}`
        });

        // Count this as completed even if failed
        completedAnimations++;
        if (completedAnimations === totalAnimations && onComplete) {
          onComplete();
        }
        return;
      }

      // Get positions
      const phraseRect = phraseElement.getBoundingClientRect();
      const bucketRect = bucket.getBoundingClientRect();

      // Create clone for animation
      const clone = phraseElement.cloneNode(true);
      clone.id = `${highlight.id}-clone`;
      clone.style.position = 'fixed';
      clone.style.left = phraseRect.left + 'px';
      clone.style.top = phraseRect.top + 'px';
      clone.style.width = phraseRect.width + 'px';
      clone.style.height = phraseRect.height + 'px';
      clone.style.zIndex = '1000';
      clone.style.pointerEvents = 'none';
      clone.style.background = 'radial-gradient(ellipse at 30% 40%, rgba(218, 165, 32, 0.4) 0%, transparent 60%), linear-gradient(135deg, rgba(240, 230, 140, 0.3) 0%, rgba(218, 165, 32, 0.25) 100%)';
      clone.style.borderRadius = '3px';
      clone.style.padding = '2px';

      document.body.appendChild(clone);

      // Light up the target bucket
      bucket.classList.add('receiving');

      // Animate clone to bucket
      gsap.to(clone, {
        x: bucketRect.left + bucketRect.width/2 - phraseRect.left - phraseRect.width/2,
        y: bucketRect.top + bucketRect.height/2 - phraseRect.top - phraseRect.height/2,
        scale: 0.3,
        opacity: 0,
        duration: 1.2,
        ease: "power2.out",
        onComplete: () => {
          // Clean up clone
          document.body.removeChild(clone);
          bucket.classList.remove('receiving');

          // Track completion
          completedAnimations++;
          if (completedAnimations === totalAnimations && onComplete) {
            console.log('All animations completed, calling onComplete callback');
            onComplete();
          }
        }
      });

      // Fade original phrase highlight styling but keep text visible
      gsap.to(phraseElement, {
        backgroundColor: 'transparent',
        duration: 1.0,
        delay: 0.5,
        onComplete: () => {
          // Remove all highlight styling but keep text visible
          phraseElement.style.background = 'transparent';
          phraseElement.style.border = 'none';
          phraseElement.style.boxShadow = 'none';
          phraseElement.style.borderRadius = '0';
          phraseElement.style.padding = '0';
          phraseElement.style.opacity = '1'; // Keep text fully visible
          console.log('Removed all highlight styling but kept text visible');
        }
      });
    });
  });
}

export function updateBackgroundForScore(score) {
  // Map the actual score range (0.6 to 0.99) to the full color spectrum (0 to 1)
  const minScore = 0.66;
  const maxScore = 0.9;

  // Clamp score to the expected range
  const clampedScore = Math.max(minScore, Math.min(maxScore, score));

  // Normalize to 0-1 range based on actual score distribution
  const normalizedScore = (clampedScore - minScore) / (maxScore - minScore);

  // Create a color that transitions from blue (low score ~0.6) to rose/pink (high score ~0.99)
  // Low scores (0.6): darker blue (#c8d8e8 - medium blue)
  // High scores (0.99): brighter pink (#ffc8dc - bright pink)

  const redComponent = Math.floor(200 + (255 - 200) * normalizedScore);   // 200 -> 255 (brighter red for higher scores)
  const greenComponent = Math.floor(216 - (216 - 200) * normalizedScore); // 216 -> 200 (less green for higher scores)
  const blueComponent = Math.floor(232 - (232 - 220) * normalizedScore);  // 232 -> 220 (less blue for higher scores)

  const edgeColor = `rgb(${redComponent}, ${greenComponent}, ${blueComponent})`;

  // Manuscript color for center (same as textContainer:after background)
  const manuscriptColor = '#fefced';

  // Create radial gradient with manuscript color in center, transitioning to score color at edges
  const backgroundGradient = `radial-gradient(ellipse at center 30%, ${manuscriptColor} 0%, ${manuscriptColor} 15%, ${edgeColor} 50%)`;

  //console.log(`Score: ${score.toFixed(3)}, Normalized: ${normalizedScore.toFixed(3)}, Edge Color: ${edgeColor}`);

  // Update both CSS variables for backward compatibility
  document.documentElement.style.setProperty('--score-bg-color', edgeColor);
  document.documentElement.style.setProperty('--score-bg-gradient', backgroundGradient);
}

export function cleanupTextContent() {
  // Safety function to completely remove HTML spans and restore clean text
  // BUT preserve phrase-highlight spans AND word spans since both are needed
  const textElement = document.getElementById('text');
  const animationElement = document.getElementById('animation');

  [textElement, animationElement].forEach(element => {
    if (element) {
      // Check if there are any highlight spans
      const highlights = element.querySelectorAll('.phrase-highlight');
      if (highlights.length > 0) {
        console.log(`Preserving ${highlights.length} highlight spans - they are now permanent`);
        // Don't remove highlights - they should stay for visual history
      }
      
      // Check for word spans that should also be preserved
      const wordSpans = element.querySelectorAll('.word');
      if (wordSpans.length > 0) {
        console.log(`Preserving ${wordSpans.length} word spans - needed for highlighting system`);
        // Don't remove word spans - they are needed for the highlighting system
      }
      
      // Check for other types of spans that should be cleaned up
      // Only clean up spans that are NOT phrase-highlight AND NOT word spans
      const otherSpans = element.querySelectorAll('span:not(.phrase-highlight):not(.word)');
      if (otherSpans.length > 0) {
        console.log(`Cleaning up ${otherSpans.length} other spans (not highlights or words)`);
        // Only clean up spans that are not highlights or words
        // Don't call formattedContent() as it would destroy the word structure
        // Just log what we found for debugging
      }
    }
  });
}

// Loading state variables
let isLoading = false;
let imageAnimationInterval;
let categoryImageUrls = [];

// Initialize category images for loading animation
export async function initializeCategoryImages() {
    try {
        const response = await fetch('./site-data/category-words.json');
        const data = await response.json();
        // Correctly map paths, assuming they are relative to the project root
        categoryImageUrls = Object.keys(data).map(key => `images/${key}.jpg`);
        preloadImages(categoryImageUrls);
        return true; // Indicate success
    } catch (error) {
        console.error('Failed to load category icons:', error);
        return false; // Indicate failure
    }
}

function preloadImages(urls) {
    const imageContainer = document.getElementById('loaderImageContainer');
    urls.forEach(url => {
        const img = new Image();
        img.src = url;
        imageContainer.appendChild(img);
    });
}

function startImageAnimation() {
    const imageContainer = document.getElementById('loaderImageContainer');
    if (!imageContainer || categoryImageUrls.length === 0) return;

    const images = imageContainer.getElementsByTagName('img');
    let currentIndex = 0;

    // Show the first image immediately
    if (images.length > 0) {
        images[0].classList.add('active');
    }

    imageAnimationInterval = setInterval(() => {
        // Hide current image
        images[currentIndex].classList.remove('active');

        // Move to the next image
        currentIndex = (currentIndex + 1) % images.length;

        // Show next image
        images[currentIndex].classList.add('active');
    }, 2000); // Change image every 2 seconds
}

function stopImageAnimation() {
    clearInterval(imageAnimationInterval);
    const imageContainer = document.getElementById('loaderImageContainer');
    if (imageContainer) {
        const images = imageContainer.getElementsByTagName('img');
        for (let img of images) {
            img.classList.remove('active');
        }
    }
}

export function showLoading(message) {
    const loadingEl = document.getElementById('loading');
    const loaderText = document.getElementById('loaderText');
    if (loadingEl) {
        loaderText.textContent = message || 'Loading...';
        loadingEl.classList.remove('hidden');
        loadingEl.style.display = 'flex';
        isLoading = true;
        startImageAnimation();
    }
}

export function hideLoading() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.classList.add('hidden');
        loadingEl.style.display = 'none';
        isLoading = false;
        stopImageAnimation();
    }
}

export function clearTextSelection() {
  // Clear any existing text selection
  if (window.getSelection) {
    const selection = window.getSelection();
    selection.removeAllRanges();
  }
}

export function performBucketReorder() {
  const bucketContainer = document.getElementById('categoryBuckets');
  if (!bucketContainer) return;

  // Get all bucket elements
  const buckets = Array.from(bucketContainer.querySelectorAll('.categoryBucket'));

 // console.log('All buckets found:', buckets.map(b => b.id));

  // Find the "Yours" bucket
  const yoursBucket = buckets.find(bucket => bucket.id === 'bucket-yours');
 // console.log('Yours bucket found:', yoursBucket ? yoursBucket.id : 'NOT FOUND');

  // If "Yours" bucket exists and is not already first, move it to the front
  if (yoursBucket && buckets[0] !== yoursBucket) {
  //  console.log('Moving Yours bucket to front position');
    bucketContainer.insertBefore(yoursBucket, bucketContainer.firstChild);
  }

  // Now get the updated order after moving "Yours" to front
  const updatedBuckets = Array.from(bucketContainer.querySelectorAll('.categoryBucket'));

  // Separate "Yours" bucket from others (should be first now)
  const otherBuckets = updatedBuckets.slice(1); // Skip the first bucket (Yours)
  //console.log('Other buckets after moving Yours:', otherBuckets.map(b => b.id));

  // Sort other buckets by score (highest first), then count (highest first), then alphabetically
  otherBuckets.sort((a, b) => {
    const categoryA = a.id.replace('bucket-', '');
    const categoryB = b.id.replace('bucket-', '');

    const scoreA = getGlobalCategoryScore(categoryA) || 0;
    const scoreB = getGlobalCategoryScore(categoryB) || 0;
    const countA = getGlobalCategoryCount(categoryA) || 0;
    const countB = getGlobalCategoryCount(categoryB) || 0;

    // Primary sort: by score (descending)
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    // Secondary sort: by count (descending) for score ties
    if (countB !== countA) {
      return countB - countA;
    }

    // Tertiary sort: alphabetically (ascending) for ties
    return categoryA.localeCompare(categoryB);
  });

  // Create new order with "Yours" always first, then sorted others
  const newOrder = yoursBucket ? [yoursBucket, ...otherBuckets] : otherBuckets;
  //console.log('Final new order:', newOrder.map(b => b.id));

  // Check if reordering is actually needed
  const currentOrder = Array.from(bucketContainer.querySelectorAll('.categoryBucket'));
  const needsReorder = newOrder.some((bucket, index) => bucket !== currentOrder[index]);

  if (!needsReorder) {
   // console.log('Buckets already in correct order, skipping animation');
    return;
  }

  // Use a fade-based reordering animation
  // First, fade out all buckets
  gsap.to(newOrder, {
    opacity: 0.3,
    duration: 0.2,
    ease: "power1.out"
  });

  // Clear the container and append in the new order
  bucketContainer.innerHTML = '';
  newOrder.forEach((bucket) => {
    bucketContainer.appendChild(bucket);
  });

  // Fade back in with a slight stagger
  gsap.to(newOrder, {
    opacity: 1,
    duration: 0.3,
    ease: "power1.out",
    delay: 0.2,
    stagger: 0.02
  });

}
// ===== GLOBAL CATEGORY DATA MANAGEMENT =====
// moved to top; duplicate removed

// ===== NEW ANIMATION UTILITIES FOR SMOOTH TEXT TRANSITIONS =====

/**
 * Creates a smooth text transition using FLIP technique to avoid layout shifts
 * @param {HTMLElement} element - The text element to animate
 * @param {string} oldText - The current text content
 * @param {string} newText - The new text content
 * @param {Object} options - Animation options
 * @returns {Promise} Promise that resolves when animation completes
 */
export async function smoothTextTransition(element, oldText, newText, options = {}) {
  const {
    duration = 0.8,
    ease = "power2.out",
    onStart = null,
    onComplete = null
  } = options;

  return new Promise((resolve) => {
    try {
      // Step 1: Record the current state (First)
      const oldState = {
        text: element.textContent,
        height: element.offsetHeight,
        width: element.offsetWidth,
        position: element.getBoundingClientRect()
      };

      // Step 2: Build the new content structure
      const newContent = buildTextWithHighlights(newText);
      
      // Step 3: Create a temporary container for the new content
      const tempContainer = document.createElement('div');
      tempContainer.innerHTML = newContent;
      tempContainer.style.position = 'absolute';
      tempContainer.style.top = '0';
      tempContainer.style.left = '0';
      tempContainer.style.width = '100%';
      tempContainer.style.opacity = '0';
      tempContainer.style.pointerEvents = 'none';
      
      // Insert temp container
      element.parentNode.insertBefore(tempContainer, element);
      
      // Step 4: Let browser render the new layout (Last)
      element.innerHTML = newContent;
      const newState = {
        height: element.offsetHeight,
        width: element.offsetWidth,
        position: element.getBoundingClientRect()
      };

      // Step 5: Invert - Position new content to match old position
      const deltaX = oldState.position.left - newState.position.left;
      const deltaY = oldState.position.top - newState.position.top;
      const scaleX = oldState.width / newState.width;
      const scaleY = oldState.height / newState.height;

      element.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
      element.style.transformOrigin = 'top left';

      // Step 6: Play - Animate to final position
      if (onStart) onStart();

      gsap.to(element, {
        duration: duration,
        ease: ease,
        transform: 'translate(0px, 0px) scale(1, 1)',
        opacity: 1,
        onComplete: () => {
          // Clean up
          element.style.transform = '';
          element.style.transformOrigin = '';
          if (tempContainer.parentNode) {
            tempContainer.parentNode.removeChild(tempContainer);
          }
          if (onComplete) onComplete();
          resolve();
        }
      });
    } catch (error) {
      console.error('Error in smoothTextTransition:', error);
      // Fallback: just set the text directly
      element.innerHTML = newText;
      if (onComplete) onComplete();
      resolve();
    }
  });
}

/**
 * Enhanced word-by-word animation with pre-built structure and FLIP
 * @param {HTMLElement} element - The text element to animate
 * @param {string} oldText - The current text content
 * @param {string} newText - The new text content
 * @param {Object} options - Animation options
 * @returns {Promise} Promise that resolves when animation completes
 */
export async function enhancedWordAnimation(element, oldText, newText, options = {}) {
  const {
    duration = 1.0,
    stagger = 0.1,
    ease = "power4.out",
    onStart = null,
    onComplete = null
  } = options;

  return new Promise((resolve) => {
    try {
      // Step 1: Record current state
      const oldState = {
        height: element.offsetHeight,
        width: element.offsetWidth,
        position: element.getBoundingClientRect()
      };

      // Step 2: Build new content with hidden word spans
      const newContent = buildTextWithWords(newText);
      element.innerHTML = newContent;

      // Step 3: Get all word elements and set initial state
      const words = element.querySelectorAll('.word');
      words.forEach(word => {
        word.style.opacity = '0';
        word.style.transform = `translateY(${randomY(-20, 20)}px)`;
      });

      // Step 4: Let browser render new layout
      const newState = {
        height: element.offsetHeight,
        width: element.offsetWidth,
        position: element.getBoundingClientRect()
      };

      // Step 5: Apply FLIP transform to match old position
      const deltaX = oldState.position.left - newState.position.left;
      const deltaY = oldState.position.top - newState.position.top;
      const scaleX = oldState.width / newState.width;
      const scaleY = oldState.height / newState.height;

      element.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
      element.style.transformOrigin = 'top left';

      // Step 6: Animate to final position with staggered word reveal
      if (onStart) onStart();

      const tl = gsap.timeline({
        onComplete: () => {
          // Clean up transforms
          element.style.transform = '';
          element.style.transformOrigin = '';
          
          // Clean up individual word transforms to ensure they're on baseline
          words.forEach(word => {
            word.style.transform = '';
            word.style.opacity = '';
          });
          
          console.log('Animation complete - word transforms cleared, preserving word spans for highlighting');
          
          if (onComplete) onComplete();
          resolve();
        }
      });

      // Animate container to final position
      tl.to(element, {
        duration: duration * 0.3,
        ease: "power2.out",
        transform: 'translate(0px, 0px) scale(1, 1)'
      });

      // Animate words in with stagger
      tl.to(words, {
        opacity: 1,
        y: 0,
        duration: duration * 0.7,
        ease: ease,
        stagger: stagger
      }, "-=0.2");
    } catch (error) {
      console.error('Error in enhancedWordAnimation:', error);
      // Fallback: just set the text directly
      element.innerHTML = formattedContent(newText);
      if (onComplete) onComplete();
      resolve();
    }
  });
}

/**
 * Builds HTML structure with hidden highlight spans for smooth transitions
 * @param {string} text - The text content
 * @param {Array} highlights - Array of highlight objects with {text, category, id}
 * @returns {string} HTML string with hidden highlight spans
 */
export function buildTextWithHighlights(text, highlights = []) {
  // For now, just return the text as-is to avoid dependency issues
  let html = text;
  
  // If no highlights, return text
  if (!highlights || highlights.length === 0) {
    return html;
  }

  // Create highlight spans (initially hidden)
  highlights.forEach(highlight => {
    const regex = new RegExp(`(${highlight.text})`, 'gi');
    html = html.replace(regex, `<span class="phrase-highlight hidden" data-category="${highlight.category}" data-id="${highlight.id}">$1</span>`);
  });

  return html;
}

/**
 * Builds HTML structure with word spans for enhanced animations
 * @param {string} text - The text content
 * @returns {string} HTML string with word spans
 */
export function buildTextWithWords(text) {
  const words = text.split(' ');
  return words.map(word => `<span class="word">${word}</span>`).join(' ');
}

/**
 * Animates highlights into view with staggered timing
 * @param {HTMLElement} container - Container with highlight spans
 * @param {Object} options - Animation options
 * @returns {Promise} Promise that resolves when animation completes
 */
export async function animateHighlightsIn(container, options = {}) {
  const {
    duration = 0.5,
    stagger = 0.05,
    ease = "power2.out",
    onStart = null,
    onComplete = null
  } = options;

  return new Promise((resolve) => {
    const highlights = container.querySelectorAll('.phrase-highlight.hidden');
    
    if (highlights.length === 0) {
      resolve();
      return;
    }

    // Remove hidden class and set initial state
    highlights.forEach(highlight => {
      highlight.classList.remove('hidden');
      highlight.style.opacity = '0';
      highlight.style.transform = 'translateY(10px)';
    });

    if (onStart) onStart();

    gsap.to(highlights, {
      opacity: 1,
      y: 0,
      duration: duration,
      ease: ease,
      stagger: stagger,
      onComplete: () => {
        if (onComplete) onComplete();
        resolve();
      }
    });
  });
}

/**
 * Coordinates text transition with score celebration timing
 * @param {Function} textAnimation - Text animation function to call
 * @param {Function} scoreAnimation - Score celebration function to call
 * @param {Object} options - Coordination options
 */
export async function integrateWithScoreCelebration(textAnimation, scoreAnimation, options = {}) {
  const {
    scoreDelay = 0.3,
    scoreDuration = 1.5
  } = options;

  // Start text animation
  const textPromise = textAnimation();
  
  // Schedule score celebration
  const scorePromise = new Promise((resolve) => {
    gsap.delayedCall(scoreDelay, () => {
      scoreAnimation();
      gsap.delayedCall(scoreDuration, resolve);
    });
  });

  // Wait for both to complete
  await Promise.all([textPromise, scorePromise]);
}

/**
 * Creates a complete animation timeline for text transitions
 * @param {Object} options - Timeline options
 * @returns {gsap.core.Timeline} GSAP timeline
 */
export function createTextTransitionTimeline(options = {}) {
  const {
    duration = 1.0,
    ease = "power2.out",
    onComplete = null
  } = options;

  return gsap.timeline({
    duration: duration,
    ease: ease,
    onComplete: onComplete
  });
}
