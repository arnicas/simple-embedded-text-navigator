import { initializeModel, getEmbedding, EmbeddingIndex } from 'client-vector-search';
import { env } from '@xenova/transformers';
import { gsap } from 'gsap';
import SplitType from 'split-type';
// import gsap text plugin
import { TextPlugin } from 'gsap/TextPlugin';
gsap.registerPlugin(TextPlugin);
import { randomY, showAnimationHideText, formattedContent, showTextHideAnimation } from './effects.js';


env.localModelPath = './site-data/cache';

let index;
let data = [];
let allData = [];
let categories = [];
let currentResult = { 
  "id":"PG10089_2",
  "text":"When we re-tell the old tales of our ancestors, we sit beside them over the peat-fire; and, as we glory with them in their strong heroes, and share their elemental joys and fears, we breathe the palpitating air of that old mysterious world of theirs, peopled by spirits beautiful, and strange, and awe-inspiring.",
  "book":"Elves and Heroes",
  "author":"Donald MacKenzie",
  "story_title": "",
  "score": .99
};

let alreadySeen = [];
let scores = {};

// Global category counters that persist across sessions
let globalCategoryCounts = {};


function showLoading() {
  document.getElementById('loading').style.display = 'flex';
}

// Function to hide the loading div
function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}


async function createIndex() {
  try {
    index = new EmbeddingIndex(data);
    console.log('Index loaded');
    return index; // in order to test if done
  } catch (error) {
    console.error('Error loading index:', error);
    throw error;
  }
}

async function loadFiles() {
  const response = await fetch('site-data/small_merged_data_embeds_metadata.json');
  categories = await fetch('site-data/category-words.json');
  allData = await response.json();
  categories = await categories.json();
  for (const item of allData) {
    if (item.embedding) {
      data.push(item); // all the data goes into it as the 'object'
    }
  }
  
}


function filterResults(results, selectedText) {
  // should we also filter for substring mention being same?
  let chosen = null;
  for (const result of results) {
    // go down and filter out same text and same book to reduce redundancy
    if (result['object']['text'] !== selectedText 
      && result['object']['book'] !== currentResult['book']
      && !alreadySeen.includes(result['object'])
      && result['object']['text'] !== currentResult['text']
    ) {
      chosen = result;
      console.log("chosen", chosen);
      break;
    }
  }
  return chosen;
}

async function findRelatedText(selectedText) {

  if (!index) {
    console.error('Index not initialized');
    return null;
  }
  const queryEmbedding = await getEmbedding(selectedText.toLowerCase()); // Query embedding
  const results = await index.search(queryEmbedding, { topK: 10 });
  console.log('results of search', results);

  const chosen = filterResults(results, selectedText);
  currentResult = chosen['object'];
  currentResult['similarity'] = chosen['similarity'];
  alreadySeen.push(chosen['object']);

  const text = chosen['object']['text'];
  const book_id = chosen['object']['book_id'];
  const score = chosen['similarity'];

  const author = chosen['object']['author'];
  const title = chosen['object']['title'];
  const story_title = chosen['object']['storytitle'];
  const birth = chosen['object']['birth'];

  // Get categories for both selected text and found text
  const selectedCategories = getCategory(selectedText);
  const foundCategories = getCategory(text);

  console.log('Selected text categories:', selectedCategories);
  console.log('Found text categories:', foundCategories);

  return { text: text, 
    id: book_id, 
    author: author, 
    title: title, 
    birth: birth, 
    story_title: story_title,
    score: score,
    selectedCategories: selectedCategories,
    foundCategories: foundCategories };
}


function filterOverlappingPhrases(phrases, text) {
  // Sort phrases by length (longest first) to prioritize longer matches
  const sortedPhrases = [...phrases].sort((a, b) => b.length - a.length);
  const filteredPhrases = [];
  const usedPositions = new Set();
  
  for (const phrase of sortedPhrases) {
    const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    let match;
    let foundMatch = false;
    
    // Find all matches of this phrase
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = match.index + match[0].length;
      
      // Check if this position overlaps with any already used position
      let overlaps = false;
      for (let i = start; i < end; i++) {
        if (usedPositions.has(i)) {
          overlaps = true;
          break;
        }
      }
      
      // If no overlap, use this match
      if (!overlaps) {
        // Mark all positions as used
        for (let i = start; i < end; i++) {
          usedPositions.add(i);
        }
        foundMatch = true;
      }
      
      // Reset regex lastIndex to continue searching
      regex.lastIndex = match.index + 1;
    }
    
    if (foundMatch) {
      filteredPhrases.push(phrase);
    }
  }
  
  return filteredPhrases;
}

function getCategory(text) {
  const matches = [];
  const textLower = text.toLowerCase();
  
  // Search through each category
  for (const [categoryName, phrases] of Object.entries(categories)) {
    const matchedPhrases = [];
    
    // Check each phrase in the category (using word boundaries)
    for (const phrase of phrases) {
      const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (regex.test(textLower)) {
        matchedPhrases.push(phrase);
      }
    }
    
    // Filter out overlapping phrases (prioritize longer ones)
    if (matchedPhrases.length > 0) {
      const filteredPhrases = filterOverlappingPhrases(matchedPhrases, textLower);
      
      if (filteredPhrases.length > 0) {
        matches.push({
          category: categoryName,
          phrases: filteredPhrases
        });
      }
    }
  }
  
  return matches;
}

function createCategoryBuckets() {
  const bucketContainer = document.getElementById('categoryBuckets');
  bucketContainer.innerHTML = ''; // Clear existing buckets
  
  // Get all category names from the loaded categories data
  const categoryNames = Object.keys(categories);
  
  categoryNames.forEach(categoryName => {
    const bucketDiv = document.createElement('div');
    bucketDiv.className = 'categoryBucket';
    bucketDiv.id = `bucket-${categoryName}`;
    
    const img = document.createElement('img');
    // Try to use category-specific image, fallback to generic bucket
    img.src = `images/${categoryName}.jpg`;
    img.alt = categoryName;
    
    // Add error handler to fallback to generic bucket image
    img.onerror = function() {
      this.src = 'images/bucket.jpeg';
    };
    
    const label = document.createElement('div');
    label.className = 'categoryLabel';
    label.innerHTML = `${categoryName}<br><span class="category-count" id="count-${categoryName}">0</span>`;
    
    bucketDiv.appendChild(img);
    bucketDiv.appendChild(label);
    bucketContainer.appendChild(bucketDiv);
  });
}

function highlightPhrasesInText(text, categories) {
  console.log('highlightPhrasesInText called with text:', text.substring(0, 100) + '...');
  console.log('Categories to process:', categories);
  
  let highlightedText = text;
  const highlights = [];
  
  // Process each category's phrases
  categories.forEach(match => {
    console.log(`Processing category: ${match.category} with phrases:`, match.phrases);
    match.phrases.forEach(phrase => {
      const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        console.log(`Found matches for "${phrase}":`, matches);
      }
      
      highlightedText = highlightedText.replace(regex, (matchedPhrase, offset) => {
        const highlightId = `highlight-${match.category}-${highlights.length}`;
        highlights.push({
          id: highlightId,
          phrase: matchedPhrase,
          category: match.category
        });
        console.log(`Created highlight: ${highlightId} for phrase: ${matchedPhrase}`);
        return `<span class="phrase-highlight" id="${highlightId}" data-category="${match.category}">${matchedPhrase}</span>`;
      });
    });
  });
  
  console.log(`Total highlights created: ${highlights.length}`);
  return { highlightedText, highlights };
}

function animatePhrasesToBuckets(highlights, onComplete) {
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
      
      // Fade original phrase highlight gradually
      gsap.to(phraseElement, {
        opacity: 0.7,
        duration: 0.5,
        delay: 0.3,
        onComplete: () => {
          // Remove highlight completely after a delay
          gsap.delayedCall(1.5, () => {
            if (phraseElement && phraseElement.parentNode) {
              // Replace highlighted span with plain text
              const textContent = phraseElement.textContent;
              const textNode = document.createTextNode(textContent);
              phraseElement.parentNode.replaceChild(textNode, phraseElement);
            }
          });
        }
      });
    });
  });
}

function initializeGlobalCounts() {
  // Initialize global counters for all categories
  if (categories && Object.keys(categories).length > 0) {
    Object.keys(categories).forEach(categoryName => {
      if (!(categoryName in globalCategoryCounts)) {
        globalCategoryCounts[categoryName] = 0;
      }
    });
  }
}

function incrementCategoryCounts(selectedCategories, foundCategories) {
  // Increment global counters based on new matches
  const newCounts = {};
  
  // Count selected categories
  selectedCategories.forEach(match => {
    newCounts[match.category] = (newCounts[match.category] || 0) + match.phrases.length;
  });
  
  // Add found categories
  foundCategories.forEach(match => {
    newCounts[match.category] = (newCounts[match.category] || 0) + match.phrases.length;
  });
  
  // Add to global counters
  Object.entries(newCounts).forEach(([category, count]) => {
    globalCategoryCounts[category] = (globalCategoryCounts[category] || 0) + count;
  });
  
  console.log('Updated global category counts:', globalCategoryCounts);
}

function updateCategoryCountsDisplay() {
  // Update the UI to show current global counters
  Object.entries(globalCategoryCounts).forEach(([category, count]) => {
    const countElement = document.getElementById(`count-${category}`);
    if (countElement) {
      countElement.textContent = count.toString();
    }
  });
}

function reorderCategoryBuckets() {
  const bucketContainer = document.getElementById('categoryBuckets');
  if (!bucketContainer) return;
  
  // Get all bucket elements
  const buckets = Array.from(bucketContainer.querySelectorAll('.categoryBucket'));
  
  // Sort buckets by their count (highest first), then alphabetically by name for ties
  buckets.sort((a, b) => {
    const categoryA = a.id.replace('bucket-', '');
    const categoryB = b.id.replace('bucket-', '');
    
    const countA = globalCategoryCounts[categoryA] || 0;
    const countB = globalCategoryCounts[categoryB] || 0;
    
    // Primary sort: by count (descending)
    if (countB !== countA) {
      return countB - countA;
    }
    
    // Secondary sort: alphabetically (ascending) for ties
    return categoryA.localeCompare(categoryB);
  });
  
  // Animate the reordering
  buckets.forEach((bucket, newIndex) => {
    // Get current position
    const currentRect = bucket.getBoundingClientRect();
    
    // Move bucket to new position in DOM
    bucketContainer.appendChild(bucket);
    
    // Get new position after DOM reorder
    const newRect = bucket.getBoundingClientRect();
    
    // Calculate the difference
    const deltaX = currentRect.left - newRect.left;
    const deltaY = currentRect.top - newRect.top;
    
    // Apply initial transform to make it appear in the old position
    gsap.set(bucket, {
      x: deltaX,
      y: deltaY
    });
    
    // Animate to the new position
    gsap.to(bucket, {
      x: 0,
      y: 0,
      duration: 0.6,
      ease: "power2.out",
      delay: newIndex * 0.05 // Small stagger for visual appeal
    });
  });
  
  console.log('Category buckets reordered by count:', 
    buckets.map(b => {
      const category = b.id.replace('bucket-', '');
      return `${category}: ${globalCategoryCounts[category] || 0}`;
    })
  );
}

function activateCategoryBuckets(selectedCategories, foundCategories) {
  // Activate buckets for selected text categories
  selectedCategories.forEach(match => {
    const bucket = document.getElementById(`bucket-${match.category}`);
    if (bucket) {
      bucket.classList.add('active');
    }
  });
  
  // Activate buckets for found text categories
  foundCategories.forEach(match => {
    const bucket = document.getElementById(`bucket-${match.category}`);
    if (bucket) {
      bucket.classList.add('active');
    }
  });
}

function updateCategoryBuckets(selectedCategories, foundCategories) {
  // Reset all buckets to inactive
  const allBuckets = document.querySelectorAll('.categoryBucket');
  allBuckets.forEach(bucket => {
    bucket.classList.remove('active', 'receiving');
    bucket.title = ''; // Clear tooltip
  });
  
  // Increment global counters but don't update display yet
  incrementCategoryCounts(selectedCategories, foundCategories);
  
  // Set tooltips but don't activate buckets yet (wait for animation to complete)
  selectedCategories.forEach(match => {
    const bucket = document.getElementById(`bucket-${match.category}`);
    if (bucket) {
      bucket.title = `Selected: ${match.phrases.join(', ')}`;
    }
  });
  
  // Set tooltips for found text categories but don't activate yet
  foundCategories.forEach(match => {
    const bucket = document.getElementById(`bucket-${match.category}`);
    if (bucket) {
      // Add to existing tooltip or create new one
      const existingTitle = bucket.title;
      if (existingTitle) {
        bucket.title = `${existingTitle} | Found: ${match.phrases.join(', ')}`;
      } else {
        bucket.title = `Found: ${match.phrases.join(', ')}`;
      }
    }
  });
  
  // Debug logging
  console.log('updateCategoryBuckets called with selectedCategories:', selectedCategories, 'foundCategories:', foundCategories);
  
  // Check if we have any matches at all
  const hasAnyMatches = selectedCategories.length > 0 || foundCategories.length > 0;
  
  // Trigger word-to-bucket animation for found categories after main text animation completes
  if (foundCategories.length > 0) {
    console.log('Found categories exist, setting up animation');
    
    // Store categories for use in animation callback
    const categoriesForCallback = { selectedCategories, foundCategories };
    
    gsap.delayedCall(2, () => {  // Wait longer for main text animation to complete
      const textElement = document.getElementById('text');
      const currentText = textElement.textContent || textElement.innerText;
      console.log('Current text for animation:', currentText);
      
      const { highlightedText, highlights } = highlightPhrasesInText(currentText, foundCategories);
      console.log('Highlights found:', highlights);
      
      if (highlights.length > 0) {
        // Temporarily update text with highlights
        textElement.innerHTML = highlightedText;
        
        // Start animation after highlights are in place
        gsap.delayedCall(0.3, () => {
          console.log('Starting phrase animation');
          animatePhrasesToBuckets(highlights, () => {
            // Update counters and activate buckets after all animations complete
            console.log('Animation complete, updating counter display and activating buckets');
            updateCategoryCountsDisplay();
            activateCategoryBuckets(categoriesForCallback.selectedCategories, categoriesForCallback.foundCategories);
            
            // Reorder buckets based on updated counts after a short delay
            gsap.delayedCall(0.5, () => {
              reorderCategoryBuckets();
            });
          });
        });
      }
    });
  } 
  
  // Ensure buckets are properly reset if no matches at all
  if (!hasAnyMatches) {
    console.log('No matches found at all, ensuring all buckets remain inactive');
    gsap.delayedCall(2, () => {
      const allBuckets = document.querySelectorAll('.categoryBucket');
      allBuckets.forEach(bucket => {
        bucket.classList.remove('active', 'receiving');
        bucket.title = ''; // Clear any lingering tooltips
      });
    });
  }
}

function resetHighlight(element, selectedText) {
  const highlightSpan = element.querySelector('.highlight');
  if (highlightSpan) {
    const parent = highlightSpan.parentNode;
    parent.replaceChild(document.createTextNode(selectedText), highlightSpan);
  }
}

function animateTextChange(element, selectedText, newText) {
  // Remove the highlight from the selected text
  resetHighlight(element, selectedText);

  const score = currentResult['similarity'];
  console.log('similarity score', score, currentResult);

  // First fade out the current text
    gsap.to(element, {
    opacity: 0,
    duration: 0.3,
    ease: "power2.out",
    onComplete: () => {
      // Split the new text into words and create spans with spaces
      const words = newText.split(' ');
      element.innerHTML = '';
      
      words.forEach((word, index) => {
      const span = document.createElement('span');
      span.textContent = word;
      span.className = 'word';
        span.style.display = 'inline-block';
        span.style.opacity = '0';
        span.style.transform = `translateY(${randomY(-30, 30)}px)`;
      element.appendChild(span);
        
        // Add space after each word except the last one
        if (index < words.length - 1) {
          element.appendChild(document.createTextNode(' '));
        }
      });

      // Fade the container back in
      gsap.to(element, {
        opacity: 1,
        duration: 0.2,
        onComplete: () => {
          // Animate each word into place
          gsap.to('.word', {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'back.out(1.7)',
            stagger: {
              amount: 0.6,
              from: 'random'
            },
            onComplete: () => {
              // Replace with formatted content after animation
              element.innerHTML = formattedContent(newText);
            }
          });
        }
      });
    }
  });
}


function updateBackgroundForScore(score) {
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
  
  console.log(`Score: ${score.toFixed(3)}, Normalized: ${normalizedScore.toFixed(3)}, Color: ${backgroundColor}`);
  
  // Update the CSS variable
  document.documentElement.style.setProperty('--score-bg-color', backgroundColor);
}

function replaceRelatedInfo(relatedItemObject) {

  const relatedIdElement = document.getElementById('relatedId');
  const relatedAuthorElement = document.getElementById('relatedAuthor');
  const relatedTitleElement = document.getElementById('relatedTitle');
  const relatedStoryTitleElement = document.getElementById('relatedStoryTitle');
  //const relatedBirthElement = document.getElementById('relatedBirth');
  const relatedScoreElement = document.getElementById('relatedScore');


  if (relatedItemObject.author === "None") {
    relatedAuthorElement.textContent = "No author found";
  } else {
    relatedAuthorElement.textContent = relatedItemObject.author;
  }

  relatedIdElement.textContent = relatedItemObject.id;  // book_id
  relatedTitleElement.textContent = relatedItemObject.title;
  
  if (relatedItemObject.story_title === "None" || !relatedItemObject.story_title) {
    relatedStoryTitleElement.textContent = "";
  } else {
    relatedStoryTitleElement.textContent = '"' + relatedItemObject.story_title + '"';
  }
  
  relatedScoreElement.textContent = "Score: " + relatedItemObject.score.toFixed(2).toString();
  
  // Update background color based on score
  updateBackgroundForScore(relatedItemObject.score);
} 


function highlightText(textElement) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    const words = selectedText.split(' ');
    console.log('selected words', words);

    if (words.length > 1 || selectedText.length >= 4) {  // selection rules
      if (selectedText && selection.anchorNode.parentElement === textElement) {
        console.log('in valid selection');

        // Create highlight span
        const span = document.createElement('span');
        span.className = 'highlight';
        
        // Get the range and handle multiple nodes
        const range = selection.getRangeAt(0);
        try {
          range.surroundContents(span);
        } catch (e) {
          // If surroundContents fails, use this alternative approach
          span.appendChild(range.extractContents());
          range.insertNode(span);
        // Check if the selection is valid
        if (span && span.parentNode) {
          console.log('Highlight span created successfully');
        } else {
          console.error('Failed to create highlight span');
        // If the highlight span creation fails, show a message to the user
        const messageElement = document.getElementById('message');
        messageElement.textContent = "Failed to highlight the text. Please try again.";
        messageElement.style.display = 'flex';

        gsap.to(messageElement, {
          duration: 4,
          opacity: 1,
          onComplete: () => {
            messageElement.textContent = "";
            messageElement.style.display = 'none';
          }
        });
        }
        }

        // Wait for 1 second, then proceed with text change
        gsap.delayedCall(1, async () => {
          const relatedItemObject = await findRelatedText(selectedText);
          console.log('got relatedItem', relatedItemObject);
          if (relatedItemObject) {
            animateTextChange(textElement, selectedText, relatedItemObject.text);
            replaceRelatedInfo(relatedItemObject);
            updateCategoryBuckets(relatedItemObject.selectedCategories, relatedItemObject.foundCategories);
          } else {
            animateTextChange(textElement, selectedText, "Error, No text found.");
          }
        });
        }
      }
      else {
        // show a message to the user that fades out 
        console.log('in invalid selection');
        const messageElement = document.getElementById('message');
        messageElement.textContent = "Please select a longer word or phrase.";
        messageElement.style.display = 'flex';

        // TODO: reset the selection color
        
        gsap.to(messageElement, {
          duration: 4,
          opacity: 1,
          onComplete: () => {
            messageElement.textContent = "";
            messageElement.style.display = 'none';
          }
        });
        
      }
}

// Your main initialization function
async function initialize() {
  try {
      showLoading(); // Show loading before starting initialization

      await initializeModel("TaylorAI/bge-micro");
      await loadFiles();
      index = await createIndex();
      
      // Create category buckets after data is loaded
      createCategoryBuckets();
      
      // Initialize global category counters
      initializeGlobalCounts();
      updateCategoryCountsDisplay();

      hideLoading(); // Hide loading after initialization is complete

  } catch (error) {
      console.error('Initialization failed:', error);
      //hideLoading(); // Make sure to hide loading even if there's an error
      // Optionally, show an error message to the user
  }
}


// main loop

document.addEventListener('DOMContentLoaded', async () => {

try {
  // Create the index when the page loads
  await initialize();
  const textElement = document.getElementById('text');
  
  // Help modal functionality
  const helpButton = document.getElementById('helpButton');
  const helpModal = document.getElementById('helpModal');
  const closeButton = helpModal.querySelector('.close');
  
  // Show help modal
  helpButton.addEventListener('click', () => {
    helpModal.classList.remove('hidden');
  });
  
  // Hide help modal when clicking close button
  closeButton.addEventListener('click', () => {
    helpModal.classList.add('hidden');
  });
  
  // Hide help modal when clicking outside the modal content
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      helpModal.classList.add('hidden');
    }
  });
  
  // Hide help modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !helpModal.classList.contains('hidden')) {
      helpModal.classList.add('hidden');
    }
  });

  // Desktop selection
  textElement.addEventListener('mouseup', () => highlightText(textElement));
  
  // Mobile selection support
  textElement.addEventListener('touchend', () => {
    // Small delay to allow selection to complete on mobile
    setTimeout(() => highlightText(textElement), 100);
  });
  
  // Additional mobile selection event
  textElement.addEventListener('selectionchange', () => {
    // Only trigger if this element is the target
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (textElement.contains(range.commonAncestorContainer)) {
        setTimeout(() => highlightText(textElement), 50);
      }
    }
  });

} catch (error) {
  console.error('Failed to initialize document:', error);
}
});