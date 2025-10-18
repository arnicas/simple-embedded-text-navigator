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

// Note: All global state variables are now managed by ScoreManager
// - globalCategoryCounts, globalCategoryScores, globalCategoryMatches
// - globalMetadataCounts, totalMetadataCounts
// - uniqueAuthors, uniqueBooks, uniqueStories
// - userYoursWords




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
  // This will be handled by ScoreManager after it's initialized
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
  
  // Update total counts - will be set in ScoreManager
  const counts = {
    authors: datasetAuthors.size,
    books: datasetBooks.size,
    stories: datasetStories.size
  };

  return counts;
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
    score: 0.78, // Midrange score for starting quote (gives neutral background color)
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
    if (scoreManager) {
      scoreManager.incrementCategoryCounts([], foundCategories);
      scoreManager.updateCategoryCountsDisplay();
    }

    // Reorder buckets based on initial scores
    gsap.delayedCall(0.5, () => {
      reorderCategoryBuckets();
    });
  }

}

function getDatasetMetadataCounts() {
  // Helper function to get total counts available in dataset
  if (!scoreManager) return { authors: 0, books: 0, stories: 0, total: 0 };
  const totalCounts = scoreManager.getTotalMetadataCounts();
  return {
    authors: totalCounts.authors,
    books: totalCounts.books,
    stories: totalCounts.stories,
    total: totalCounts.authors + totalCounts.books + totalCounts.stories
  };
}

function getDiscoveredMetadataCounts() {
  // Helper function to get discovered counts
  if (!scoreManager) return { authors: 0, books: 0, stories: 0, total: 0 };
  const metadataCounts = scoreManager.getGlobalMetadataCounts();
  return {
    authors: metadataCounts.authors,
    books: metadataCounts.books,
    stories: metadataCounts.stories,
    total: metadataCounts.authors + metadataCounts.books + metadataCounts.stories
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
    aggregate.score += scoreManager ? scoreManager.getPhraseScore(phrase) : 0;
  });

  return Array.from(categoryAggregates.values());
}


// ScoreManager methods are now called directly - wrapper functions removed

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

// activateCategoryBuckets and updateCategoryBuckets are imported from ui.mjs - removed duplicate definitions

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

  // Update highest sentence score tracker
  if (scoreManager && sentencePoints > 0) {
    scoreManager.updateHighestSentenceScore(sentencePoints, relatedItemObject.text);
  }

  // Track metadata
  if (scoreManager) {
    scoreManager.trackMetadata(relatedItemObject);
  }

  // Update background color based on score
  updateBackgroundForScore(relatedItemObject.score);
} 


// trackMetadata and calculateAndCelebrateMetadataScore are now called directly on scoreManager


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
      if (scoreManager) {
        scoreManager.incrementCategoryCounts(relatedItemObject.selectedCategories, relatedItemObject.foundCategories);
        
        // 2. UI DATA: Update the bucket displays with new scores and reorder them.
        scoreManager.updateCategoryCountsDisplay();
      }
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

      // Get metadata counts from dataset analysis
      const metadataCounts = countDatasetMetadata();
      
      scoreManager = new ScoreManager({
        categories,
        wordScores: word_scores,
        userYoursWords: [], // Will be loaded from localStorage if available
        metadataDiscoveryScores: METADATA_DISCOVERY_SCORES,
        globalCategoryCounts: {},
        globalCategoryScores: {},
        globalCategoryMatches: {},
        globalMetadataCounts: {
          'authors': 0,
          'books': 0, 
          'stories': 0
        },
        totalMetadataCounts: metadataCounts,
        uniqueAuthors: new Set(),
        uniqueBooks: new Set(),
        uniqueStories: new Set(),
        setGlobalCategoryData,
        showCategoryScoreCelebration,
        showMetadataScoreCelebration
      });

      // Create category buckets after data is loaded
      createCategoryBuckets(categories);
      createMetadataBuckets();

  // Initialize global category counters
  if (scoreManager) {
    scoreManager.initializeGlobalCounts(categories);
    scoreManager.recalculateYoursCategory();
  }
      // Share global category data with effects.js for bucket reordering
      setGlobalCategoryData(scoreManager.getGlobalCategoryCounts(), scoreManager.getGlobalCategoryScores());

      // Initialize the UI module with ScoreManager reference
      initializeUI({
          scoreManager: scoreManager,
          // Callback functions - now using ScoreManager methods directly
          saveYoursChanges: saveYoursChanges,
          findRelatedText: findRelatedText,
          reorderCategoryBuckets: reorderCategoryBuckets
      });

      if (scoreManager) {
        scoreManager.updateCategoryCountsDisplay();
        scoreManager.updateMetadataCountsDisplay();
      }

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
        let successfulSelections = 0; // Track successful selections
        let capturedRange = null; // Store range immediately when selection changes
        let capturedText = '';

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

            // Use the captured text and range instead of getting fresh selection
            const selectedText = capturedText;
            const range = capturedRange;

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
                // Clear the selection after a longer delay to allow users to see their selection
                setTimeout(() => {
                    clearTextSelection();
                }, 300); // Increased delay to give users time to see their selection

                // Process the selection with the captured range
                await processSelection(textElement, selectedText, range);

                // Increment successful selections counter and hide instructions after 2 successes
                successfulSelections++;
                if (successfulSelections === 2) {
                    const instructionsElement = document.getElementById('instructions');
                    if (instructionsElement) {
                        gsap.to(instructionsElement, {
                            duration: 1,
                            opacity: 0,
                            height: 0,
                            marginBottom: 0,
                            ease: 'power2.inOut',
                            onComplete: () => {
                                instructionsElement.style.display = 'none';
                            }
                        });
                    }
                }

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
                // Clear captured data
                capturedRange = null;
                capturedText = '';
                console.log('Selection processing unlocked');
            }
        }

        // Cross-platform selection handling
        function isMobile() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                (window.innerWidth <= 768 && window.innerHeight <= 1024);
        }

        // Helper function to check if a range overlaps with the text element
        function isRangeInTextElement(range) {
            if (!range) return false;

            const startNode = range.startContainer;
            const endNode = range.endContainer;

            // Check if either the start or end is within the text element
            // This handles edge cases where selection extends slightly beyond boundaries
            const startInElement = textElement.contains(startNode) || textElement === startNode;
            const endInElement = textElement.contains(endNode) || textElement === endNode;
            const ancestorInElement = textElement.contains(range.commonAncestorContainer);

            return startInElement || endInElement || ancestorInElement;
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
                        // Capture range and text immediately
                        capturedText = selectedText;
                        capturedRange = selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
                        await handleSelection();
                    }
                }, 400); // Increased delay for mobile touch selection
            });

            // Also listen for selection changes on mobile
            let mobileSelectionTimeout = null;

            document.addEventListener('selectionchange', () => {
                // Capture selection data immediately, synchronously
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

                // Clear any pending timeout
                if (mobileSelectionTimeout) {
                    clearTimeout(mobileSelectionTimeout);
                }

                // Set a new timeout to process the selection
                mobileSelectionTimeout = setTimeout(async () => {
                    if (selectedText.length >= 4 && !isProcessingSelection) {
                        if (range && isRangeInTextElement(range)) {
                            console.log('Mobile selection change detected:', selectedText.substring(0, 30) + '...');
                            // Capture the selection data
                            capturedText = selectedText;
                            capturedRange = range.cloneRange();
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
                // Capture selection data immediately, synchronously, before any timeout
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

                console.log('[Selection Debug] selectionchange event:', {
                    textLength: selectedText.length,
                    hasRange: !!range,
                    isProcessing: isProcessingSelection,
                    text: selectedText.substring(0, 50)
                });

                // Clear any pending timeout
                if (selectionTimeout) {
                    clearTimeout(selectionTimeout);
                }

                // Early validation - skip if too short or no range
                if (selectedText.length < 4 || !range) {
                    console.log('[Selection Debug] Skipping - too short or no range');
                    return;
                }

                // Check if range is in text element
                const inTextElement = isRangeInTextElement(range);
                console.log('[Selection Debug] Range in text element:', inTextElement);

                if (!inTextElement) {
                    console.log('[Selection Debug] Skipping - range not in text element');
                    return;
                }

                // Capture the selection data NOW, before the timeout
                const clonedRange = range.cloneRange();
                const capturedSelectionText = selectedText;

                console.log('[Selection Debug] Capturing selection and setting timeout');

                // Set a new timeout to process the selection
                selectionTimeout = setTimeout(async () => {
                    if (!isProcessingSelection) {
                        console.log('[Selection Debug] Timeout fired - processing selection:', capturedSelectionText.substring(0, 30) + '...');
                        // Use the captured data from when the event fired
                        capturedText = capturedSelectionText;
                        capturedRange = clonedRange;
                        await handleSelection();
                    } else {
                        console.log('[Selection Debug] Timeout fired but already processing - skipping');
                    }
                }, 300); // Reduced delay for better responsiveness
            });

            // Add mouseup as a backup trigger for edge cases
            textElement.addEventListener('mouseup', () => {
                setTimeout(() => {
                    const selection = window.getSelection();
                    const selectedText = selection.toString().trim();
                    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

                    console.log('[Mouseup Debug] Mouseup event:', {
                        textLength: selectedText.length,
                        hasRange: !!range,
                        isProcessing: isProcessingSelection
                    });

                    if (selectedText.length >= 4 && !isProcessingSelection && range && isRangeInTextElement(range)) {
                        console.log('[Mouseup Debug] Mouseup backup trigger - selection detected:', selectedText.substring(0, 30) + '...');
                        // Only process if we don't have a recent captured selection
                        if (capturedText !== selectedText) {
                            capturedText = selectedText;
                            capturedRange = range.cloneRange();
                            handleSelection();
                        } else {
                            console.log('[Mouseup Debug] Skipping - same text already captured');
                        }
                    }
                }, 150); // Slightly increased delay to allow selectionchange to fire first
            });
        }

    } catch (error) {
        console.error('Failed to initialize document:', error);
    }
});
