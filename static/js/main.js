import { initializeModel, getEmbedding, EmbeddingIndex } from 'client-vector-search';
import { env } from '@xenova/transformers';
import { gsap } from 'gsap';
import SplitType from 'split-type';
// import gsap text plugin
import { TextPlugin } from 'gsap/TextPlugin';
gsap.registerPlugin(TextPlugin);
import {
  randomY,
  formattedContent,
  showScoreCelebration,
  showCategoryScoreCelebration,
  showMetadataScoreCelebration,
  showMetadataScoreCelebrationWithPink,
  animatePhrasesToBuckets,
  updateBackgroundForScore,
  cleanupTextContent,
  showLoading,
  hideLoading,
  performBucketReorder,
  setGlobalCategoryData,
  clearTextSelection,
  smoothTextTransition,
  integrateWithScoreCelebration,
  initializeCategoryImages
} from './effects.mjs';

// Import UI functions from the new UI module
import {
  initializeUI,
  createMetadataBuckets,
  createCategoryBuckets,
  showCategoryModal,
  hideCategoryModal,
  showYoursEditModal,
  hideYoursEditModal,
  updateYoursWordsDisplay,
  showMetadataModal,
  showTotalModal,
  saveYoursChanges,
  activateCategoryBuckets,
  updateCategoryBuckets,
  animateTextChange,
  applyHighlightsToText
} from './ui.mjs';
import { ScoreManager } from './score-manager.mjs';

// Configure transformers.js for remote model loading from Hugging Face CDN
// The key issue: prevent trying to load from relative paths that resolve to dev server

// CRITICAL: Set localModelPath to empty string to avoid relative path resolution
env.localModelPath = '';  // Empty string prevents "/models/..." paths
env.allowLocalModels = false;  // Disable local models entirely
env.allowRemoteModels = true;  // Enable remote from Hugging Face CDN
env.useBrowserCache = true;    // Cache downloaded models in browser

let index;
let data = [];
let allData = [];
let categories = [];
let word_scores = {};
let currentResult = null; // Will be set to random quote on initialization

let alreadySeen = [];
let scores = {};
let scoreManager;

// ===== METADATA DISCOVERY SCORES CONFIGURATION =====
// These values can be easily modified to adjust scoring for new discoveries
// Points are awarded when users find new content through text selection
const METADATA_DISCOVERY_SCORES = {
  NEW_AUTHOR: 7,    // Points for discovering a new author (after initial screen)
  NEW_BOOK: 5,      // Points for discovering a new book
  NEW_STORY: 3      // Points for discovering a new story
};

// How it works:
// - Initial screen loading doesn't count for scoring (handled inside ScoreManager)
// - After first load, each unique author/book/story discovery triggers score celebration
// - Scoring happens in trackMetadata() function when relatedItemObject contains new metadata
// - Multiple discoveries in one selection stack (e.g., new book + new author = 5+7 = 12 pts)

// Global category counters that persist across sessions
let globalCategoryCounts = {};
let globalCategoryScores = {};

// Global category matched phrases that persist across sessions
let globalCategoryMatches = {};

// User's custom "Yours" category words
let userYoursWords = [];

// Metadata tracking (authors, books, stories) - count only
let globalMetadataCounts = {
  'authors': 0,
  'books': 0, 
  'stories': 0
};

// Total tracking across all categories
let totalScore = 0;
let totalItemsFound = 0;

// Track unique metadata items
let uniqueAuthors = new Set();
let uniqueBooks = new Set();
let uniqueStories = new Set();

// Total counts available in dataset
let totalMetadataCounts = {
  'authors': 0,
  'books': 0,
  'stories': 0
};




// showLoading and hideLoading functions are now imported from effects.js


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
  word_scores = await fetch('site-data/scores_lookup.json');
  allData = await response.json();
  categories = await categories.json();
  word_scores = await word_scores.json();
  
  console.log('Loaded word_scores:', Object.keys(word_scores).length, 'words');
  console.log('Sample word scores:', Object.entries(word_scores).slice(0, 5));
  
  for (const item of allData) {
    if (item.embedding) {
      data.push(item); // all the data goes into it as the 'object'
    }
  }
  
  // Count unique metadata in the dataset
  countDatasetMetadata();
  
  // Initialize "Yours" category with user words if they exist
  if (userYoursWords && userYoursWords.length > 0) {
    categories.yours = [...userYoursWords];
    console.log('Initialized "Yours" category with user words:', userYoursWords);
    
    // Add new words to word_scores (but don't give them scores until discovered)
    userYoursWords.forEach(word => {
      const normalizedWord = word.toLowerCase();
      // Don't add to word_scores until the phrase is actually discovered in text
      // This ensures the modal only shows actually discovered items
    });
    
    // Initialize global data for "Yours" category
    recalculateYoursCategory();
  }
}

function countDatasetMetadata() {
  const datasetAuthors = new Set();
  const datasetBooks = new Set();
  const datasetStories = new Set();
  
  console.log('Analyzing dataset metadata from', allData.length, 'items...');
  
  allData.forEach(item => {
    // Count unique authors
    if (item.author && item.author !== "None" && item.author.trim() !== "") {
      datasetAuthors.add(item.author.trim());
    }
    
    // Count unique books (using title field)
    if (item.title && item.title.trim() !== "") {
      datasetBooks.add(item.title.trim());
    }
    
    // Count unique stories
    if (item.storytitle && item.storytitle !== "None" && item.storytitle.trim() !== "") {
      datasetStories.add(item.storytitle.trim());
    }
  });
  
  // Update total counts
  totalMetadataCounts.authors = datasetAuthors.size;
  totalMetadataCounts.books = datasetBooks.size;
  totalMetadataCounts.stories = datasetStories.size;

  return totalMetadataCounts;
}

function setRandomStartingQuote() {
  // Select a random quote from the loaded data
  if (data.length === 0) {
    console.error('No data available for random quote selection');
    return;
  }
  
  const randomIndex = Math.floor(Math.random() * data.length);
  const randomItem = data[randomIndex];
  
   
  // Analyze the starting text for categories and scores
  const foundCategories = getCategory(randomItem.text);
  
  // Set as current result
  currentResult = {
    id: randomItem.book,
    text: randomItem.text,
    author: randomItem.author,
    title: randomItem.title,
    story_title: randomItem.storytitle || "",
    score: 1.0, // Default score for starting quote
    selectedCategories: [], // No selected text for starting quote
    foundCategories: foundCategories
  };
  
  // Update the display with the random quote (no highlights on initial load)
  const textElement = document.getElementById('text');
  if (textElement) {
    textElement.innerHTML = formattedContent(randomItem.text);
  }
  
  // Update the source information
  replaceRelatedInfo(currentResult);
  
  // Process the initial categories and update scores
  if (foundCategories.length > 0) {
    //console.log('Processing initial categories for scoring');

    // Count these discoveries immediately so the UI reflects the opening text.
    incrementCategoryCounts([], foundCategories);
    updateCategoryCountsDisplay();

    // Reorder buckets based on initial scores
    gsap.delayedCall(0.5, () => {
      reorderCategoryBuckets();
    });
  }

}

function getDatasetMetadataCounts() {
  // Helper function to get total counts available in dataset
  return {
    authors: totalMetadataCounts.authors,
    books: totalMetadataCounts.books,
    stories: totalMetadataCounts.stories,
    total: totalMetadataCounts.authors + totalMetadataCounts.books + totalMetadataCounts.stories
  };
}

function getDiscoveredMetadataCounts() {
  // Helper function to get discovered counts
  return {
    authors: globalMetadataCounts.authors,
    books: globalMetadataCounts.books,
    stories: globalMetadataCounts.stories,
    total: globalMetadataCounts.authors + globalMetadataCounts.books + globalMetadataCounts.stories
  };
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
  
  // Add categories to currentResult so they're available during animation
  const text = chosen['object']['text'];
  const selectedCategories = getCategory(selectedText);
  const foundCategories = getCategory(text);
  currentResult['selectedCategories'] = selectedCategories;
  currentResult['foundCategories'] = foundCategories;
  alreadySeen.push(chosen['object']);

  const book_id = chosen['object']['book'];
  const score = chosen['similarity'];

  const author = chosen['object']['author'];
  const title = chosen['object']['title'];
  const story_title = chosen['object']['storytitle'];
  const birth = chosen['object']['birth'];

  console.log('Selected text categories:', selectedCategories);
  console.log('Found text categories:', foundCategories);

  return { text: text, 
    id: book_id, 
    author: author, 
    title: title, 
    birth: birth, 
    story_title: story_title,
    score: score,
    selectedCategories: currentResult['selectedCategories'],
    foundCategories: currentResult['foundCategories'] };
}


function getCategory(text) {
  const textLower = text.toLowerCase();
  const candidateMatches = [];

  const escapePhrase = (phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  Object.entries(categories).forEach(([categoryName, phrases]) => {
    if (!Array.isArray(phrases)) {
      return;
    }

    phrases.forEach((phrase) => {
      const trimmedPhrase = (phrase || '').trim();
      if (!trimmedPhrase) {
        return;
      }

      const regex = new RegExp(`\\b${escapePhrase(trimmedPhrase)}\\b`, 'gi');
      let match;
      while ((match = regex.exec(textLower)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        candidateMatches.push({
          category: categoryName,
          phrase: trimmedPhrase,
          start,
          end,
          length: end - start
        });

        regex.lastIndex = match.index + 1;
      }
    });
  });

  candidateMatches.sort((a, b) => {
    if (b.length !== a.length) {
      return b.length - a.length;
    }
    return a.start - b.start;
  });

  const usedRanges = [];
  const acceptedMatches = [];

  const overlaps = (start, end) => {
    return usedRanges.some((range) => start < range.end && end > range.start);
  };

  candidateMatches.forEach((candidate) => {
    if (!overlaps(candidate.start, candidate.end)) {
      acceptedMatches.push(candidate);
      usedRanges.push({ start: candidate.start, end: candidate.end });
    }
  });

  const categoryAggregates = new Map();

  acceptedMatches.forEach(({ category, phrase }) => {
    if (!categoryAggregates.has(category)) {
      categoryAggregates.set(category, { category, phrases: {}, score: 0 });
    }

    const aggregate = categoryAggregates.get(category);
    aggregate.phrases[phrase] = (aggregate.phrases[phrase] || 0) + 1;
    aggregate.score += getPhraseScore(phrase);
  });

  return Array.from(categoryAggregates.values());
}


function getPhraseScore(phrase) {
  if (!scoreManager) {
    return 0;
  }
  return scoreManager.getPhraseScore(phrase);
}

function recalculateAllCategoryScores() {
  if (!scoreManager) {
    return {};
  }
  return scoreManager.recalculateAllCategoryScores();
}



// ===== YOURS CATEGORY EDIT MODAL FUNCTIONS =====


function recalculateYoursCategory() {
  if (!scoreManager) {
    return;
  }
  scoreManager.recalculateYoursCategory();
}

// Note: highlightPhrasesInText is imported from ui.mjs and used in the highlighting system

function initializeGlobalCounts() {
  if (!scoreManager) {
    return;
  }
  scoreManager.initializeGlobalCounts(categories);
}

function incrementCategoryCounts(selectedCategories, foundCategories) {
  if (!scoreManager) {
    return;
  }
  scoreManager.incrementCategoryCounts(selectedCategories, foundCategories);
}

function triggerPendingCategoryCelebration() {
  if (!scoreManager) {
    return;
  }
  scoreManager.triggerPendingCategoryCelebration();
}

// Score celebration functions are now imported from effects.js

// cleanupTextContent function is now imported from effects.js

function updateCategoryCountsDisplay() {
  if (!scoreManager) {
    return;
  }
  scoreManager.updateCategoryCountsDisplay();
}

function updateMetadataCountsDisplay() {
  if (!scoreManager) {
    return;
  }
  scoreManager.updateMetadataCountsDisplay();
}

function updateYoursScoreDisplay() {
  if (!scoreManager) {
    return;
  }
  scoreManager.updateYoursScoreDisplay();
}

function updateTotalDisplay() {
  if (!scoreManager) {
    return;
  }
  scoreManager.updateTotalDisplay();
}

// Throttle reordering to prevent excessive animations
let reorderTimeout = null;

function reorderCategoryBuckets() {
  // Clear any pending reorder
  if (reorderTimeout) {
    clearTimeout(reorderTimeout);
  }
  
  // Throttle reordering - only execute after 1 second of no new requests
  reorderTimeout = setTimeout(() => {
    performBucketReorder();
  }, 1000);
}

// performBucketReorder function is now imported from effects.js

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
  
  // Don't increment counters yet - wait until animations complete
  
  // Set tooltips but don't activate buckets yet (wait for animation to complete)
  selectedCategories.forEach(match => {
    const bucket = document.getElementById(`bucket-${match.category}`);
    if (bucket) {
      bucket.title = `Selected: ${Object.keys(match.phrases).join(', ')}`;
    }
  });
  
  // Set tooltips for found text categories but don't activate yet
  foundCategories.forEach(match => {
    const bucket = document.getElementById(`bucket-${match.category}`);
    if (bucket) {
      // Add to existing tooltip or create new one
      const phraseString = Object.keys(match.phrases).join(', ');
      const existingTitle = bucket.title;
      if (existingTitle) {
        bucket.title = `${existingTitle} | Found: ${phraseString}`;
      } else {
        bucket.title = `Found: ${phraseString}`;
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
    
    // Process scoring and celebrations immediately based on found categories
    if (foundCategories.length > 0) {
      gsap.delayedCall(2.5, () => {  // Wait for text animation to mostly complete
        //console.log('Processing category scoring for:', foundCategories);
        
        // Process any pending metadata celebrations after word celebrations complete
        calculateAndCelebrateMetadataScore();
        
        // Clean up any remaining HTML markup after a delay
        gsap.delayedCall(2, () => {
          cleanupTextContent();
          
          // Reorder buckets based on updated counts
          gsap.delayedCall(0.5, () => {
            reorderCategoryBuckets();
          });
        });
      });
    }
    
    gsap.delayedCall(2, () => {  // Wait for main text animation to complete, then start phrase animations
      // Debug: Check what's actually in the DOM
      console.log('All spans in DOM:', Array.from(document.querySelectorAll('span')).map(s => ({
        id: s.id,
        classes: s.className,
        text: s.textContent,
        category: s.getAttribute('data-category')
      })));
      console.log('Phrase highlights in DOM:', document.querySelectorAll('.phrase-highlight').length);
      
      // Find existing highlights that were added during initial text setup
      const highlights = [];
      const processedGroups = new Set();
      
      document.querySelectorAll('.phrase-highlight').forEach((element, index) => {
        const phraseGroup = element.getAttribute('data-phrase-group') || element.id;
        
        // Skip if we've already processed this phrase group
        if (processedGroups.has(phraseGroup)) return;
        
        // Find all elements in this phrase group
        const groupElements = Array.from(document.querySelectorAll(`[data-phrase-group="${phraseGroup}"]`));
        if (groupElements.length === 0) {
          // Single word highlight (no phrase group)
          groupElements.push(element);
        }
        
        // Combine text content for the phrase
        const phraseText = groupElements.map(el => el.textContent).join(' ');
        
        highlights.push({
          id: groupElements[0].id, // Use the first element's ID for animation
          phrase: phraseText,
          category: element.getAttribute('data-category')
        });
        
        processedGroups.add(phraseGroup);
      });
      
      console.log('Found existing highlights for animation:', highlights);
      console.log('DOM elements for highlights:', highlights.map(h => ({
        id: h.id,
        element: document.getElementById(h.id),
        exists: !!document.getElementById(h.id)
      })));
      
      if (highlights.length > 0) {
        // Start phrase animations directly since highlights are already in place
        gsap.delayedCall(0.3, () => {
          console.log('Starting phrase animation');
          animatePhrasesToBuckets(highlights, () => {
            // This callback now only handles things that MUST happen after the animation.
            console.log('Animation complete, activating buckets and cleaning up');
            activateCategoryBuckets(categoriesForCallback.selectedCategories, categoriesForCallback.foundCategories);
            cleanupTextContent();
          }); // animatePhrasesToBuckets callback
        }); // gsap.delayedCall callback
      } else {
        // No highlights found, but we still need to run post-animation logic
        console.log('No highlights found to animate, but running cleanup and celebrations.');
        // Fallback to ensure text is visible and celebrations happen
        cleanupTextContent();
        activateCategoryBuckets(categoriesForCallback.selectedCategories, categoriesForCallback.foundCategories);
      }
    });

    // Score celebrations should be triggered regardless of whether the animation runs.
    gsap.delayedCall(2.5, () => {
      triggerPendingCategoryCelebration();
      calculateAndCelebrateMetadataScore();
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

// Note: animateTextChange, applyHighlightsToText, and fadeHighlightsToBackground
// are all imported from ui.mjs and used below

function replaceRelatedInfo(relatedItemObject) {
  console.log('[Debug] replaceRelatedInfo invoked', {
    id: relatedItemObject?.id,
    score: relatedItemObject?.score,
    foundCategories: relatedItemObject?.foundCategories || []
  });

  const relatedAuthorElement = document.getElementById('relatedAuthor');
  const relatedTitleElement = document.getElementById('relatedTitle');
  const relatedStoryTitleElement = document.getElementById('relatedStoryTitle');
  //const relatedBirthElement = document.getElementById('relatedBirth');
  const relatedScoreElement = document.getElementById('relatedScore');
  const relatedIdElement = document.getElementById('relatedId');


  if (relatedItemObject.author === "None") {
    relatedAuthorElement.textContent = "No author found";
  } else {
    relatedAuthorElement.textContent = relatedItemObject.author;
  }

  // Create title with linked ID in parentheses
  // Extract numeric part from ID (handles PG12345, 12345, PG12345_2, etc.)
  const numericId = relatedItemObject.id.replace(/^PG/, '').replace(/_.*$/, '');
  const gutenbergUrl = `https://www.gutenberg.org/ebooks/${numericId}`;
  relatedTitleElement.innerHTML = `${relatedItemObject.title} (<a href="${gutenbergUrl}" target="_blank" class="gutenberg-link">${relatedItemObject.id}</a>)`;
  
  if (relatedItemObject.story_title === "None" || !relatedItemObject.story_title) {
    relatedStoryTitleElement.textContent = "";
  } else {
    relatedStoryTitleElement.textContent = '"' + relatedItemObject.story_title + '"';
  }
  
  const sentencePoints = (relatedItemObject.foundCategories || []).reduce((sum, entry) => {
    const categoryScore = typeof entry.score === 'number' ? entry.score : 0;
    return sum + categoryScore;
  }, 0);

  const similarityText = `Similarity: ${relatedItemObject.score.toFixed(2)}`;
  const sentencePointsText = `Sentence pts: ${Math.round(sentencePoints)}`;
  relatedScoreElement.textContent = `${similarityText} | ${sentencePointsText}`;

  console.log('[Sentence Score]', {
    sentencePoints,
    rounded: Math.round(sentencePoints),
    foundCategories: relatedItemObject.foundCategories || []
  });

  // Track metadata
  trackMetadata(relatedItemObject);

  // Update background color based on score
  updateBackgroundForScore(relatedItemObject.score);
} 


function trackMetadata(relatedItemObject) {
  if (!scoreManager) {
    return;
  }
  scoreManager.trackMetadata(relatedItemObject);
}

function calculateAndCelebrateMetadataScore() {
  if (!scoreManager) {
    return;
  }
  scoreManager.calculateAndCelebrateMetadataScore();
}


async function processSelection(textElement, selectedText, range) {
  console.log('Processing text selection:', selectedText.substring(0, 30) + '...');

  const isWithinTextElement = range && textElement.contains(range.commonAncestorContainer);

  if (!selectedText || !isWithinTextElement) {
    // Show invalid selection message
    console.log('Invalid selection - text length:', selectedText.length, 'within element:', isWithinTextElement);
    const messageElement = document.getElementById('message');
    if (messageElement) {
      messageElement.textContent = "Please select a longer word or phrase.";
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
    return;
  }

 // console.log('Valid selection, creating highlight...');

  // Create highlight span
  const span = document.createElement('span');
  span.className = 'highlight';

  try {
    range.surroundContents(span);
  } catch (e) {
    // If surroundContents fails, use alternative approach
    span.appendChild(range.extractContents());
    range.insertNode(span);
  }

  // Check if the highlight span was created successfully
  if (!span || !span.parentNode) {
    console.error('Failed to create highlight span');
    const messageElement = document.getElementById('message');
    if (messageElement) {
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
    return;
  }

  console.log('Highlight created successfully, finding related text...');

  // Wait longer for user to see the highlight before transitioning
  await new Promise(resolve => setTimeout(resolve, 800));

  try {
    const relatedItemObject = await findRelatedText(selectedText);
    console.log('Found related item with score:', relatedItemObject ? relatedItemObject.score : 'none');

    if (relatedItemObject) {
      // 1. DATA: Update scores and counts immediately and reliably.
      incrementCategoryCounts(relatedItemObject.selectedCategories, relatedItemObject.foundCategories);
      
      // 2. UI DATA: Update the bucket displays with new scores and reorder them.
      updateCategoryCountsDisplay();
      reorderCategoryBuckets();

      // 3. VISUALS: Animate text change, update info panel, and trigger bucket animations.
      animateTextChange(textElement, selectedText, relatedItemObject.text, currentResult);
      replaceRelatedInfo(relatedItemObject);
      updateCategoryBuckets(relatedItemObject.selectedCategories, relatedItemObject.foundCategories);
    } else {
      animateTextChange(textElement, selectedText, "Error, No text found.", currentResult);
    }
  } catch (error) {
    console.error('Error finding related text:', error);
    animateTextChange(textElement, selectedText, "Error occurred while finding related text.", currentResult);
  }
}

// Your main initialization function
async function initialize() {
  try {
      showLoading(); // Show loading before starting initialization

      // Clear any existing text selection on initialization
      clearTextSelection();

      console.log('Starting model initialization...');
      console.log('Transformers.js env config:', {
        allowRemoteModels: env.allowRemoteModels,
        allowLocalModels: env.allowLocalModels,
        useBrowserCache: env.useBrowserCache,
        remoteHost: env.remoteHost,
        remotePathTemplate: env.remotePathTemplate,
        localModelPath: env.localModelPath
      });

      // Intercept fetch to see what URLs are being requested
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        console.log('Fetch request:', args[0]);
        return originalFetch.apply(this, args);
      };

      try {
        await initializeModel("TaylorAI/bge-micro");
        console.log('Model initialized successfully');
      } catch (modelError) {
        console.error('Model initialization error:', modelError);
        console.error('Error details:', {
          message: modelError.message,
          stack: modelError.stack
        });
        throw modelError; // Re-throw to be caught by outer try-catch
      }
      await loadFiles();
      index = await createIndex();

      scoreManager = new ScoreManager({
        categories,
        wordScores: word_scores,
        userYoursWords,
        metadataDiscoveryScores: METADATA_DISCOVERY_SCORES,
        globalCategoryCounts,
        globalCategoryScores,
        globalCategoryMatches,
        globalMetadataCounts,
        totalMetadataCounts,
        uniqueAuthors,
        uniqueBooks,
        uniqueStories,
        setGlobalCategoryData,
        showCategoryScoreCelebration,
        showMetadataScoreCelebration
      });

      // Create category buckets after data is loaded
      createCategoryBuckets(categories);
      createMetadataBuckets();

      // Initialize global category counters
      initializeGlobalCounts();
      recalculateYoursCategory();
      // Share global category data with effects.js for bucket reordering
      setGlobalCategoryData(globalCategoryCounts, globalCategoryScores);

      // Initialize the UI module with all necessary state and callbacks
      initializeUI({
          scoreManager: scoreManager,
          // State references
          categories: categories,
          globalCategoryCounts: globalCategoryCounts,
          globalCategoryScores: globalCategoryScores,
          globalCategoryMatches: globalCategoryMatches,
          globalMetadataCounts: globalMetadataCounts,
          totalMetadataCounts: totalMetadataCounts,
          word_scores: word_scores,
          userYoursWords: userYoursWords,
          METADATA_DISCOVERY_SCORES: METADATA_DISCOVERY_SCORES,
          uniqueAuthors: uniqueAuthors,
          uniqueBooks: uniqueBooks,
          uniqueStories: uniqueStories,
          
          // Callback functions
          saveYoursChanges: saveYoursChanges,
          findRelatedText: findRelatedText,
          getPhraseScore: getPhraseScore,
          recalculateAllCategoryScores: recalculateAllCategoryScores,
          updateYoursScoreDisplay: updateYoursScoreDisplay,
          updateTotalDisplay: updateTotalDisplay,
          updateMetadataCountsDisplay: updateMetadataCountsDisplay,
          reorderCategoryBuckets: reorderCategoryBuckets,
          trackMetadata: trackMetadata,
          calculateAndCelebrateMetadataScore: calculateAndCelebrateMetadataScore,
          triggerPendingCategoryCelebration: triggerPendingCategoryCelebration,
          incrementCategoryCounts: incrementCategoryCounts
      });

      updateCategoryCountsDisplay();
      updateMetadataCountsDisplay();

      // Set random starting quote
      setRandomStartingQuote();

      // Mark initial load as complete to enable scoring for subsequent discoveries
      if (scoreManager) {
        scoreManager.markInitialLoadComplete();
      }

      hideLoading(); // Hide loading after initialization is complete

  } catch (error) {
      console.error('Initialization failed:', error);
      //hideLoading(); // Make sure to hide loading even if there's an error
      // Optionally, show an error message to the user
  }
}


// main loop

document.addEventListener('DOMContentLoaded', async () => {
    // First, fetch and prepare the icons for the loader
    const iconsReady = await initializeCategoryImages();

    // Now, show the loading indicator with the icons
    if (iconsReady) {
        showLoading('Loading assets...');
    } else {
        showLoading('Loading...'); // Fallback if icons fail
    }

    try {
        // Create the index when the page loads
        await initialize();

        const textElement = document.getElementById('text');

        // Simplified selection handler - only use mouseup for reliability
        let isProcessingSelection = false;
        let lastProcessedSelection = '';

        async function handleSelection() {
            // Prevent processing if already busy
            if (isProcessingSelection) {
                console.log('Already processing selection, skipping...');
                return;
            }

            // Check if we're in the middle of a text animation
            // Look for active GSAP animations rather than just word spans
            // Word spans are now permanent parts of the highlighting system
            const activeAnimations = gsap.globalTimeline.getChildren().filter(tween =>
                tween.isActive() &&
                (tween.targets().some(target => target === textElement) ||
                    tween.targets().some(target => target.classList && target.classList.contains('word')))
            );

            if (activeAnimations.length > 0) {
                console.log('Text animation in progress, skipping selection...');
                return;
            }

            // Get the current selection
            const selection = window.getSelection();
            const selectedText = selection.toString().trim();

            // Basic validation
            if (selectedText.length < 4) {
                return; // Too short
            }

            // Check for duplicate
            if (selectedText === lastProcessedSelection) {
                console.log('Duplicate selection, skipping...');
                return;
            }

            console.log('Processing selection:', selectedText.substring(0, 30) + '...');

            // Set processing flag
            isProcessingSelection = true;
            lastProcessedSelection = selectedText;

            try {
                // Capture the range BEFORE clearing the selection
                const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

                // Clear the selection after a longer delay to allow users to see their selection
                setTimeout(() => {
                    clearTextSelection();
                }, 300); // Increased delay to give users time to see their selection

                // Process the selection with the captured range
                await processSelection(textElement, selectedText, range);

            } catch (error) {
                console.error('Error processing selection:', error);
                // Show error message to user
                const messageElement = document.getElementById('message');
                if (messageElement) {
                    messageElement.textContent = "An error occurred. Please try again.";
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
            } finally {
                // Always reset the processing flag
                isProcessingSelection = false;
                console.log('Selection processing unlocked');
            }
        }

        // Cross-platform selection handling
        function isMobile() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                (window.innerWidth <= 768 && window.innerHeight <= 1024);
        }

        if (isMobile()) {
            // Mobile: Use touch events
            console.log('Using mobile selection handling');

            textElement.addEventListener('touchend', () => {
                // Delay to allow touch selection menu to appear/disappear
                setTimeout(async () => {
                    const selection = window.getSelection();
                    const selectedText = selection.toString().trim();

                    if (selectedText.length >= 4) {
                        console.log('Mobile touch selection detected:', selectedText.substring(0, 30) + '...');
                        await handleSelection();
                    }
                }, 400); // Increased delay for mobile touch selection
            });

            // Also listen for selection changes on mobile
            let mobileSelectionTimeout = null;

            document.addEventListener('selectionchange', () => {
                // Clear any pending timeout
                if (mobileSelectionTimeout) {
                    clearTimeout(mobileSelectionTimeout);
                }

                // Set a new timeout to process the selection
                mobileSelectionTimeout = setTimeout(async () => {
                    const selection = window.getSelection();
                    const selectedText = selection.toString().trim();

                    if (selectedText.length >= 4 && !isProcessingSelection) {
                        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
                        if (range && textElement.contains(range.commonAncestorContainer)) {
                            console.log('Mobile selection change detected:', selectedText.substring(0, 30) + '...');
                            await handleSelection();
                        }
                    }
                }, 400); // Increased delay for mobile selection
            });

        } else {
            // Desktop: Use selectionchange event for reliable detection
            console.log('Using desktop selection handling');

            let selectionTimeout = null;

            document.addEventListener('selectionchange', () => {
                // Clear any pending timeout
                if (selectionTimeout) {
                    clearTimeout(selectionTimeout);
                }

                // Set a new timeout to process the selection
                selectionTimeout = setTimeout(async () => {
                    const selection = window.getSelection();
                    const selectedText = selection.toString().trim();

                    if (selectedText.length >= 4 && !isProcessingSelection) {
                        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
                        if (range && textElement.contains(range.commonAncestorContainer)) {
                            console.log('Desktop selection detected:', selectedText.substring(0, 30) + '...');
                            await handleSelection();
                        }
                    }
                }, 500); // Increased delay to ensure selection is complete
            });
        }

    } catch (error) {
        console.error('Failed to initialize document:', error);
    }
});
