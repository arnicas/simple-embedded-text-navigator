
import { gsap } from 'gsap';

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
    console.log(`Metadata score celebration started from metadata area (${Math.round(startX)}, ${Math.round(startY)})`);
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
  console.log('animatePhrasesToBuckets called with highlights:', highlights);

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

      console.log(`Animating highlight ${highlight.id}:`, {
        phraseElement: !!phraseElement,
        bucket: !!bucket,
        category: highlight.category
      });

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
  const minScore = 0.65;
  const maxScore = 0.9;

  // Clamp score to the expected range
  const clampedScore = Math.max(minScore, Math.min(maxScore, score));

  // Normalize to 0-1 range based on actual score distribution
  const normalizedScore = (clampedScore - minScore) / (maxScore - minScore);

  // Create a color that transitions from blue (low score ~0.6) to rose (high score ~0.99)
  // Low scores (0.6): more blue-ish (#e8f0f8 - light blue)
  // High scores (0.99): more rose-ish (#f8e8f0 - light rose)

  const redComponent = Math.floor(232 + (248 - 232) * normalizedScore);   // 232 -> 248 (more red for higher scores)
  const greenComponent = Math.floor(240 - (240 - 232) * normalizedScore); // 240 -> 232 (less green for higher scores)
  const blueComponent = Math.floor(248 - (248 - 240) * normalizedScore);  // 248 -> 240 (less blue for higher scores)

  const backgroundColor = `rgb(${redComponent}, ${greenComponent}, ${blueComponent})`;

  //console.log(`Score: ${score.toFixed(3)}, Normalized: ${normalizedScore.toFixed(3)}, Color: ${backgroundColor}`);

  // Update the CSS variable
  document.documentElement.style.setProperty('--score-bg-color', backgroundColor);
}

export function cleanupTextContent() {
  // Safety function to completely remove HTML spans and restore clean text
  const textElement = document.getElementById('text');
  const animationElement = document.getElementById('animation');

  [textElement, animationElement].forEach(element => {
    if (element) {
      // Check if there are any highlight spans
      const highlights = element.querySelectorAll('.phrase-highlight');
      if (highlights.length > 0) {
        console.log(`Cleaning up ${highlights.length} highlight spans by restoring plain text`);
        // Get clean text content without HTML markup and restore it
        const cleanText = element.textContent || element.innerText;
        element.innerHTML = formattedContent(cleanText);
      }
    }
  });
}

export function showLoading() {
  document.getElementById('loading').style.display = 'flex';
}

export function hideLoading() {
  document.getElementById('loading').style.display = 'none';
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

  // Sort buckets by score (highest first), then count (highest first), then alphabetically
  buckets.sort((a, b) => {
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

  // Check if reordering is actually needed
  const currentOrder = Array.from(bucketContainer.querySelectorAll('.categoryBucket'));
  const needsReorder = buckets.some((bucket, index) => bucket !== currentOrder[index]);

  if (!needsReorder) {
    console.log('Buckets already in correct order, skipping animation');
    return;
  }

  // Use a fade-based reordering animation
  // First, fade out all buckets
  gsap.to(buckets, {
    opacity: 0.3,
    duration: 0.2,
    ease: "power1.out"
  });

  // Reorder DOM elements while faded
  buckets.forEach((bucket) => {
    bucketContainer.appendChild(bucket);
  });

  // Fade back in with a slight stagger
  gsap.to(buckets, {
    opacity: 1,
    duration: 0.3,
    ease: "power1.out",
    delay: 0.2,
    stagger: 0.02
  });

  console.log('Category buckets reordered by score then count:',
    buckets.map(b => {
      const category = b.id.replace('bucket-', '');
      const count = getGlobalCategoryCount(category) || 0;
      const score = Math.round(getGlobalCategoryScore(category) || 0);
      return `${category}: ${count} items (${score}pts)`;
    })
  );
}

// ===== GLOBAL CATEGORY DATA MANAGEMENT =====

// These will need to be set by main.js when initializing
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