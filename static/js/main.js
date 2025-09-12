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
  enhancedWordAnimation,
  buildTextWithWords,
  integrateWithScoreCelebration,
  initializeCategoryImages
} from './effects.mjs';


env.localModelPath = './site-data/cache';

let index;
let data = [];
let allData = [];
let categories = [];
let word_scores = {};
let currentResult = null; // Will be set to random quote on initialization

let alreadySeen = [];
let scores = {};

// ===== METADATA DISCOVERY SCORES CONFIGURATION =====
// These values can be easily modified to adjust scoring for new discoveries
// Points are awarded when users find new content through text selection
const METADATA_DISCOVERY_SCORES = {
  NEW_AUTHOR: 7,    // Points for discovering a new author (after initial screen)
  NEW_BOOK: 5,      // Points for discovering a new book
  NEW_STORY: 3      // Points for discovering a new story
};

// How it works:
// - Initial screen loading doesn't count for scoring (isInitialLoad = true)
// - After first load, each unique author/book/story discovery triggers score celebration
// - Scoring happens in trackMetadata() function when relatedItemObject contains new metadata
// - Multiple discoveries in one selection stack (e.g., new book + new author = 5+7 = 12 pts)

// Track if this is the initial load to avoid scoring the starting quote
let isInitialLoad = true;

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

function getMetadataProgress() {
  // Helper function to get progress percentages
  const discovered = getDiscoveredMetadataCounts();
  const total = getDatasetMetadataCounts();
  
  return {
    authors: total.authors > 0 ? Math.round((discovered.authors / total.authors) * 100) : 0,
    books: total.books > 0 ? Math.round((discovered.books / total.books) * 100) : 0,
    stories: total.stories > 0 ? Math.round((discovered.stories / total.stories) * 100) : 0,
    overall: total.total > 0 ? Math.round((discovered.total / total.total) * 100) : 0
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


// if we want a separate function for search
function searchJs(textLine, searchString) {
  if (!searchString) return false;
  const escapedSearchString = searchString.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexPattern = new RegExp('\\b' + escapedSearchString + '\\b', 'i'); // 'i' for case-insensitive
  return regexPattern.test(textLine);
}
// Example: searchJs("The quick brown fox.", "fox") -> true

function getCategory(text) {
  const matches = [];
  const textLower = text.toLowerCase();
  
  for (const [categoryName, phrases] of Object.entries(categories)) {
    // Step 1: Find all unique phrases that are present in the text.
    const matchedPhrases = [];
    for (const phrase of phrases) {
      const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      if (regex.test(textLower)) {
        matchedPhrases.push(phrase);
      }
    }
    
    if (matchedPhrases.length > 0) {
      // Step 2: Filter the found phrases to resolve overlaps (e.g., prefer "large stone" over "stone").
      const filteredPhrases = filterOverlappingPhrases(matchedPhrases, textLower);
      
      if (filteredPhrases.length > 0) {
        // Step 3: Count the occurrences of only the filtered, valid phrases.
        const phraseCounts = {};
        let totalScoreForCategory = 0;
        
        filteredPhrases.forEach(phrase => {
          const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
          const occurrences = (textLower.match(regex) || []).length;
          if (occurrences > 0) {
            phraseCounts[phrase] = occurrences;
            totalScoreForCategory += occurrences * getPhraseScore(phrase);
          }
        });

        // Step 4: Add the results for this category to our final list.
        if (Object.keys(phraseCounts).length > 0) {
            matches.push({
              category: categoryName,
              phrases: phraseCounts, // Return object with phrases and their counts
              score: totalScoreForCategory // Return the accurately calculated total score
            });
        }
      }
    }
  }
  
  return matches;
}

function getWordScoreDisplay(phrase) {
  // Only show scores for phrases that have actually been discovered
  let phraseScore = word_scores[phrase] || 0;
  
  // No automatic base scores - phrases only get points when discovered
  return { display: `${phrase} (${phraseScore} pts)`, totalScore: phraseScore };
}

function getPhraseScore(phrase) {
  const normalizedPhrase = (phrase || '').trim().toLowerCase();
  if (!normalizedPhrase) {
    return 0;
  }

  // Prefer exact phrase score when available
  const phraseLevelScore = word_scores[normalizedPhrase];
  if (typeof phraseLevelScore === 'number' && phraseLevelScore > 0) {
    return phraseLevelScore;
  }

  // Fallback: sum token scores; ensure "Yours" tokens are at least 1
  let score = 0;
  const words = normalizedPhrase.split(/\s+/);
  for (const word of words) {
    let wordScore = word_scores[word] || 0;
    if (wordScore === 0 && categories.yours && categories.yours.includes(word)) {
      wordScore = 1;
    }
    score += wordScore;
  }
  return score;
}

function recalculateAllCategoryScores() {
  const recalculatedScores = {};
  for (const category in globalCategoryMatches) {
    let categoryScore = 0;
    const matches = globalCategoryMatches[category];
    if (matches && Object.keys(matches).length > 0) {
      for (const [phrase, count] of Object.entries(matches)) {
        categoryScore += count * getPhraseScore(phrase);
      }
    }
    recalculatedScores[category] = categoryScore;
  }
  return recalculatedScores;
}

function createMetadataBuckets() {
  const metadataContainer = document.getElementById('metadataBuckets');
  metadataContainer.innerHTML = ''; // Clear existing buckets
  
  const metadataTypes = ['authors', 'books', 'stories', 'total'];
  
  metadataTypes.forEach(metadataType => {
    const bucketDiv = document.createElement('div');
    bucketDiv.className = 'metadataBucket';
    bucketDiv.id = `metadata-${metadataType}`;
    
    const img = document.createElement('img');
    img.src = `images/${metadataType}.jpg`;
    img.alt = metadataType;
    
    // Add error handler to fallback to generic bucket image
    img.onerror = function() {
      this.src = 'images/bucket.jpeg';
    };
    
    const label = document.createElement('div');
    label.className = 'metadataLabel';
    const displayName = metadataType.charAt(0).toUpperCase() + metadataType.slice(1);
    
    if (metadataType === 'total') {
      label.innerHTML = `${displayName}<br><span class="total-score-display" id="metadata-count-${metadataType}">0 pts</span>`;
    } else {
      label.innerHTML = `${displayName}<br><span class="metadata-count" id="metadata-count-${metadataType}" style="display: none;">0</span>`;
    }
    
    // Add click event listener for modal
    bucketDiv.addEventListener('click', () => {
      if (metadataType === 'total') {
        showTotalModal(img.src);
      } else {
        showMetadataModal(metadataType, img.src);
      }
    });
    
    bucketDiv.appendChild(img);
    bucketDiv.appendChild(label);
    metadataContainer.appendChild(bucketDiv);
  });
}

function createCategoryBuckets() {
  const bucketContainer = document.getElementById('categoryBuckets');
  bucketContainer.innerHTML = ''; // Clear existing buckets

  // Get all category names from the loaded categories data
  const categoryNames = Object.keys(categories);

  // Ensure "Yours" bucket is always created first
  const yoursIndex = categoryNames.indexOf('yours');
  let orderedCategoryNames = [...categoryNames];

  if (yoursIndex > -1) {
    // Move "yours" to the front
    orderedCategoryNames.splice(yoursIndex, 1);
    orderedCategoryNames.unshift('yours');
  }

  orderedCategoryNames.forEach(categoryName => {
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
    label.innerHTML = `${categoryName}<br><span class="category-count" id="count-${categoryName}" style="display: none;">0</span>`;

    // Add click event listener for modal
    bucketDiv.addEventListener('click', () => {
      showCategoryModal(categoryName, img.src);
    });

    bucketDiv.appendChild(img);
    bucketDiv.appendChild(label);



    bucketContainer.appendChild(bucketDiv);
  });
}

function showCategoryModal(categoryName, imageSrc) {
  const modal = document.getElementById('categoryModal');
  const modalImage = document.getElementById('categoryModalImage');
  const modalTitle = document.getElementById('categoryModalTitle');
  const modalCount = document.getElementById('categoryModalCount');
  const modalMatches = document.getElementById('categoryModalMatches');
  
  // Set modal content
  modalImage.src = imageSrc;
  modalImage.alt = categoryName;
  modalImage.style.display = 'block'; // Show the image
  
  const matches = globalCategoryMatches[categoryName];

  // Recalculate total score from the ground truth (globalCategoryMatches) to ensure consistency.
  let totalRecalculatedScore = 0;
  if (matches && Object.keys(matches).length > 0) {
      for (const [phrase, count] of Object.entries(matches)) {
          totalRecalculatedScore += count * getPhraseScore(phrase);
      }
  }

  // Set title with count and RECALCULATED score
  const count = globalCategoryCounts[categoryName] || 0;
  const score = totalRecalculatedScore; // Use the recalculated score for consistency.
  const capitalizedName = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
  if (count > 0) {
    modalTitle.textContent = `${capitalizedName}: ${count} Found (${Math.round(score)} Points)`;
    modalCount.style.display = 'none'; // Hide the separate count element
  } else {
    modalTitle.textContent = capitalizedName;
    // Special message for "Yours" category when no words added
    const defaultMessage = categoryName === 'yours' 
      ? 'You can add your own text to search for, with score of 1 each.'
      : `Keep exploring to discover ${categoryName} elements and earn points!`;
    modalCount.textContent = defaultMessage;
    modalCount.style.display = 'block';
  }
  
  // Set matched phrases with individual word scores and counts
  if (matches && Object.keys(matches).length > 0) {
    const matchesArray = Object.entries(matches).sort(([phraseA], [phraseB]) => phraseA.localeCompare(phraseB));
    
    // Special message for "Yours" category
    const scoringExplanation = categoryName === 'yours' 
      ? '<p class="scoring-explanation">You can add your own text to search for, with score of 1 each.</p>'
      : '<p class="scoring-explanation">Common items have fewer points associated with them.</p>';
    
    modalMatches.innerHTML = `
      ${scoringExplanation}
      <div class="category-matches-list">
        ${matchesArray.map(([phrase, count]) => {
          const scorePerItem = getPhraseScore(phrase);
          const display = `${phrase} (${count} &times; ${scorePerItem}pts)`;
          return `<span class="match-phrase">${display}</span>`;
        }).join('')}
      </div>
    `;
    modalMatches.style.display = 'block';
  } else {
    modalMatches.style.display = 'none';
  }
  
  // Add edit button for "Yours" category
  const existingEditButton = modal.querySelector('.yours-edit-button');
  if (existingEditButton) {
    existingEditButton.remove();
  }
  
  if (categoryName === 'yours') {
    const editButton = document.createElement('button');
    editButton.className = 'yours-edit-button';
    editButton.textContent = 'Edit Yours Category';
    editButton.title = 'Edit Yours category words';
    editButton.addEventListener('click', () => {
      hideCategoryModal();
      showYoursEditModal();
    });
    
    // Insert the edit button within the modal body content
    const modalBody = document.getElementById('categoryModalBody');
    if (modalBody) {
      modalBody.appendChild(editButton);
    } else {
      // Fallback: insert after modal matches
      modal.appendChild(editButton);
    }
  }
  
  // Show modal
  modal.classList.remove('hidden');
}

function hideCategoryModal() {
  const modal = document.getElementById('categoryModal');
  modal.classList.add('hidden');
}

// ===== YOURS CATEGORY EDIT MODAL FUNCTIONS =====

function showYoursEditModal() {
  const modal = document.getElementById('yoursEditModal');
  const wordsList = document.getElementById('yoursWordsList');

  // Clear the input field
  document.getElementById('yoursNewWord').value = '';

  // Display current words
  updateYoursWordsDisplay();

  // Show modal
  modal.classList.remove('hidden');
}

function hideYoursEditModal() {
  const modal = document.getElementById('yoursEditModal');
  modal.classList.add('hidden');
}

function updateYoursWordsDisplay() {
  const wordsList = document.getElementById('yoursWordsList');

  if (userYoursWords.length === 0) {
    wordsList.innerHTML = '<p class="empty-list">No words added yet. Add some words above!</p>';
    return;
  }

  wordsList.innerHTML = userYoursWords.map((word, index) => {
    // Check if this word exists in any preset categories
    const presetCategories = [];
    Object.keys(categories).forEach(categoryName => {
      if (categoryName !== 'yours' && categories[categoryName] && categories[categoryName].includes(word.toLowerCase())) {
        presetCategories.push(categoryName);
      }
    });
    
    // Create the notation if word exists in preset categories
    const categoryNotation = presetCategories.length > 0 
      ? ` <span class="yours-word-category-note">(also in ${presetCategories.join(', ')})</span>`
      : '';
    
    return `
      <div class="yours-word-item">
        <span class="yours-word-text">${word}${categoryNotation}</span>
        <button class="yours-remove-word" data-index="${index}" title="Remove word">×</button>
      </div>
    `;
  }).join('');

  // Add event listeners to remove buttons
  wordsList.querySelectorAll('.yours-remove-word').forEach(button => {
    button.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      removeYoursWord(index);
    });
  });
}

function addYoursWord() {
  const input = document.getElementById('yoursNewWord');
  const word = input.value.trim().toLowerCase();

  if (!word) {
    alert('Please enter a word or phrase.');
    return;
  }

  if (userYoursWords.includes(word)) {
    alert('This word is already in your list.');
    return;
  }

  // Check if this word already exists in the scoring system with a higher score
  const existingScore = word_scores[word];
  if (existingScore && existingScore > 1) {
    alert('This word already exists in the system with a higher score. You cannot add it to your personal category.');
    return;
  }

  userYoursWords.push(word);
  input.value = '';
  updateYoursWordsDisplay();
}

function removeYoursWord(index) {
  const wordToRemove = userYoursWords[index];
  const normalizedWord = wordToRemove.toLowerCase();

  // Remove from user list
  userYoursWords.splice(index, 1);

  // Remove from word_scores only if it has score 1 (user-added)
  // Don't remove words with higher scores as they might be from the original dataset
  if (word_scores[normalizedWord] === 1) {
    delete word_scores[normalizedWord];
  }

  updateYoursWordsDisplay();
}

function saveYoursChanges() {
  // Store the previous words to check what was removed
  const previousWords = new Set(categories.yours || []);
  const newWords = new Set(userYoursWords);
  
  // Remove words that were deleted from word_scores (but keep their scores if they were found)
  previousWords.forEach(word => {
    if (!newWords.has(word)) {
      const normalizedWord = word.toLowerCase();
      // Only remove from word_scores if it was a user-added word (score = 1)
      // Don't remove if it has a higher score from being found
      if (word_scores[normalizedWord] === 1) {
        delete word_scores[normalizedWord];
      }
    }
  });
  
  // Add new words to word_scores (but don't give them scores until discovered)
  userYoursWords.forEach(word => {
    const normalizedWord = word.toLowerCase();
    // Don't add to word_scores until the phrase is actually discovered in text
    // This ensures the modal only shows actually discovered items
  });

  // Update the categories data structure
  categories.yours = [...userYoursWords];

  // DON'T clear the global matches - preserve existing discoveries
  // Only update the counts and scores based on current state
  updateYoursScoreDisplay();
  
  // Recalculate "Yours" category scores and matches
  recalculateYoursCategory();
  
  console.log('Saved "Yours" category words:', userYoursWords);
  console.log('User words added to "Yours" category - they will get scores when discovered in text');

  hideYoursEditModal();

  // Optional: Show a success message
  const messageElement = document.getElementById('message');
  if (messageElement) {
    messageElement.textContent = '"Yours" category updated successfully!';
    messageElement.style.display = 'flex';
    gsap.to(messageElement, {
      duration: 3,
      opacity: 1,
      onComplete: () => {
        messageElement.textContent = "";
        messageElement.style.display = 'none';
      }
    });
  }
}

function cancelYoursChanges() {
  hideYoursEditModal();
}

function recalculateYoursCategory() {
  // Initialize global matches for "yours" if it doesn't exist
  if (!globalCategoryMatches.yours) {
    globalCategoryMatches.yours = {};
  }
  
  // Initialize global counts and scores for "yours" if they don't exist
  if (!globalCategoryCounts.yours) {
    globalCategoryCounts.yours = 0;
  }
  if (!globalCategoryScores.yours) {
    globalCategoryScores.yours = 0;
  }
  
  // Clear existing matches - we'll rebuild based on actual discoveries
  // globalCategoryMatches.yours.clear();
  
  // Recalculate based on actual discoveries in word_scores
  let totalScore = 0;
  let totalCount = 0;
  
  userYoursWords.forEach(word => {
    const normalizedWord = word.toLowerCase();
    let wordScore = word_scores[normalizedWord] || 0;
    
    // Only include items that have been actually discovered in text (score > 0)
    // Items added by user but not yet discovered will have score 0 and won't appear
    if (wordScore > 0) {
      // Correctly increment the count for the word in our frequency map (object)
      globalCategoryMatches.yours[word] = (globalCategoryMatches.yours[word] || 0) + 1;
      totalScore += wordScore;
      totalCount++;
    }
  });
  
  // Update global counts and scores
  globalCategoryCounts.yours = totalCount;
  globalCategoryScores.yours = totalScore;
  
  console.log(`Recalculated "Yours" category: ${totalCount} words, ${totalScore} points`);
  console.log('Updated global counts and scores for "yours":', globalCategoryCounts.yours, globalCategoryScores.yours);
  
  // Update the display
  updateYoursScoreDisplay();
  updateTotalDisplay();
}

function showMetadataModal(metadataType, imageSrc) {
  const modal = document.getElementById('categoryModal');
  const modalImage = document.getElementById('categoryModalImage');
  const modalTitle = document.getElementById('categoryModalTitle');
  const modalCount = document.getElementById('categoryModalCount');
  const modalMatches = document.getElementById('categoryModalMatches');
  
  // Set modal content
  modalImage.src = imageSrc;
  modalImage.alt = metadataType;
  modalImage.style.display = 'block';
  
  // Set title with count and progress
  const discovered = globalMetadataCounts[metadataType] || 0;
  const total = totalMetadataCounts[metadataType] || 0;
  const displayName = metadataType.charAt(0).toUpperCase() + metadataType.slice(1);
  if (discovered > 0) {
    const percentage = total > 0 ? Math.round((discovered / total) * 100) : 0;
    modalTitle.textContent = `${displayName}: ${discovered}/${total} Found (${percentage}%)`;
    modalCount.style.display = 'none';
  } else {
    modalTitle.textContent = displayName;
    modalCount.textContent = `Keep exploring to discover different ${metadataType}! (${total} available)`;
    modalCount.style.display = 'block';
  }
  
  // Set matched items
  let uniqueItems = [];
  if (metadataType === 'authors') {
    uniqueItems = Array.from(uniqueAuthors);
  } else if (metadataType === 'books') {
    uniqueItems = Array.from(uniqueBooks);
  } else if (metadataType === 'stories') {
    uniqueItems = Array.from(uniqueStories);
  }
  
  if (uniqueItems.length > 0) {
    const sortedItems = uniqueItems.sort();
    modalMatches.innerHTML = `
      <div class="category-matches-list">
        ${sortedItems.map(item => `<span class="match-phrase">${item}</span>`).join('')}
      </div>
    `;
    modalMatches.style.display = 'block';
  } else {
    modalMatches.style.display = 'none';
  }
  
  // Show modal
  modal.classList.remove('hidden');
}

function showTotalModal(imageSrc) {
  const modal = document.getElementById('categoryModal');
  const modalImage = document.getElementById('categoryModalImage');
  const modalTitle = document.getElementById('categoryModalTitle');
  const modalCount = document.getElementById('categoryModalCount');
  const modalMatches = document.getElementById('categoryModalMatches');
  
  // Set modal content
  modalImage.src = imageSrc;
  modalImage.alt = 'total';
  modalImage.style.display = 'block';
  
  // Calculate totals
  const categoryPoints = Object.values(globalCategoryScores).reduce((sum, score) => sum + score, 0);
  const metadataPoints = (globalMetadataCounts.authors * METADATA_DISCOVERY_SCORES.NEW_AUTHOR) + 
                        (globalMetadataCounts.books * METADATA_DISCOVERY_SCORES.NEW_BOOK) + 
                        (globalMetadataCounts.stories * METADATA_DISCOVERY_SCORES.NEW_STORY);
  const totalPoints = categoryPoints + metadataPoints;
  const totalItems = Object.values(globalCategoryCounts).reduce((sum, count) => sum + count, 0);
  const metadataTotal = Object.values(globalMetadataCounts).reduce((sum, count) => sum + count, 0);
  const grandTotalItems = totalItems + metadataTotal;
  
  // Set title
  modalTitle.textContent = `Total Progress: ${Math.round(totalPoints)} Points`;
  modalCount.style.display = 'none';
  
  // Set content showing breakdown
  // Lynn: I don't love how claude did this inline.
  modalMatches.innerHTML = `
    <div style="text-align: center; font-family: 'Patrick Hand', cursive;">
      <h3 style="color: #8B4513; margin-bottom: 15px;">Your Exploration Summary</h3>
      
      <div style="background: rgba(218, 165, 32, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <p style="font-size: 16px; font-weight: bold; color: #2d1810; margin: 5px 0;">
          🏆 Total Score: ${Math.round(totalPoints)} Points
        </p>
        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px; background: rgba(255,255,255,0.3); border-radius: 4px;">
          <span style="font-size: 14px; color: #555;">📊 Category Points:</span>
          <span style="font-weight: bold; color: #2d1810;">${Math.round(categoryPoints)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 10px 0; padding: 8px; background: rgba(255,255,255,0.3); border-radius: 4px;">
          <span style="font-size: 14px; color: #555;">📚 Source Points:</span>
          <span style="font-weight: bold; color: #2d1810;">${Math.round(metadataPoints)}</span>
        </div>
      </div>
      
      <div style="background: rgba(144, 238, 144, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <h4 style="color: #228B22; margin-bottom: 10px;">📚 The Sources</h4>
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <span style="font-size: 14px; color: #555;">✍️ Authors (${METADATA_DISCOVERY_SCORES.NEW_AUTHOR}pts each):</span>
          <span style="font-weight: bold; color: #228B22;">${globalMetadataCounts.authors}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <span style="font-size: 14px; color: #555;">📖 Books (${METADATA_DISCOVERY_SCORES.NEW_BOOK}pts each):</span>
          <span style="font-weight: bold; color: #228B22;">${globalMetadataCounts.books}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <span style="font-size: 14px; color: #555;">📜 Stories (${METADATA_DISCOVERY_SCORES.NEW_STORY}pts each):</span>
          <span style="font-weight: bold; color: #228B22;">${globalMetadataCounts.stories}</span>
        </div>
      </div>
      
      <div style="background: rgba(135, 206, 235, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <p style="font-size: 14px; color: #555; margin: 5px 0;">
          📊 Category Items Found: ${totalItems}
        </p>
        <p style="font-size: 14px; color: #555; margin: 5px 0;">
          🎯 Total Items Found: ${grandTotalItems}
        </p>
      </div>
      
      <p style="font-size: 12px; color: #666; font-style: italic;">
        Keep exploring to discover more quotes and sources and raise your score of unusual texts!
      </p>
    </div>
  `;
  modalMatches.style.display = 'block';
  
  // Show modal
  modal.classList.remove('hidden');
}

function highlightPhrasesInText(text, categories) {
  console.log('highlightPhrasesInText called with text:', text.substring(0, 100) + '...');
  console.log('Categories to process:', categories);
  
  // Collect all potential matches with their positions first
  const potentialMatches = [];
  
  categories.forEach(match => {
    console.log(`Processing category: ${match.category} with phrases:`, match.phrases);
    // The `phrases` property is now an object of counts, e.g., { "sun": 2 }. We need to iterate over its keys.
    Object.keys(match.phrases).forEach(phrase => {
      const escapedWord = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // This regex uses a word boundary to find the start of the word,
      // captures the word itself, and then matches any trailing non-alphabetic characters.
      // This ensures we highlight "sun," or "water." correctly.
      const regex = new RegExp(`\\b(${escapedWord})[^a-zA-Z]*`, 'gi');
      
      let regexMatch;
      while ((regexMatch = regex.exec(text)) !== null) {
        // The full match (e.g., "sun,") is in regexMatch[0].
        const fullMatch = regexMatch[0];
        const startPos = regexMatch.index;
        const endPos = startPos + fullMatch.length;
        
        potentialMatches.push({
          start: startPos,
          end: endPos,
          phrase: fullMatch, // Highlight the full match, including punctuation
          category: match.category
        });
        console.log(`Found potential match: "${fullMatch}" at ${startPos}-${endPos} for category ${match.category}`);
      }
    });
  });
  
  // Sort matches by start position and resolve conflicts (longest match wins)
  potentialMatches.sort((a, b) => a.start - b.start);
  const finalMatches = [];
  
  potentialMatches.forEach(current => {
    // Check if this match conflicts with any already accepted match
    const hasConflict = finalMatches.some(accepted => 
      (current.start < accepted.end && current.end > accepted.start)
    );
    
    if (!hasConflict) {
      finalMatches.push(current);
    } else {
      console.log(`Skipping conflicting match: "${current.phrase}" (${current.start}-${current.end})`);
    }
  });
  
  console.log(`Resolved ${potentialMatches.length} potential matches to ${finalMatches.length} final matches`);
  
  // Build the final HTML string properly by working with original positions
  let highlightedText = '';
  let lastEnd = 0;
  const highlights = [];
  
  // Sort matches in forward order for building
  finalMatches.sort((a, b) => a.start - b.start);
  
  finalMatches.forEach((match, index) => {
    const highlightId = `highlight-${match.category}-${index}`;
    highlights.push({
      id: highlightId,
      phrase: match.phrase,
      category: match.category
    });
    
    // Add text before this match
    highlightedText += text.substring(lastEnd, match.start);
    
    // Add the highlighted phrase
    highlightedText += `<span class="phrase-highlight active" id="${highlightId}" data-category="${match.category}">${match.phrase}</span>`;
    
    lastEnd = match.end;
  });
  
  // Add remaining text after last match
  highlightedText += text.substring(lastEnd);
  
  console.log(`Total highlights applied: ${highlights.length}`);
  console.log('Final highlighted text:', highlightedText);
  return { highlightedText, highlights };
}

// animatePhrasesToBuckets function is now imported from effects.js

function initializeGlobalCounts() {
  // Initialize global counters, scores and matches for all categories
  if (categories && Object.keys(categories).length > 0) {
    Object.keys(categories).forEach(categoryName => {
      if (!(categoryName in globalCategoryCounts)) {
        globalCategoryCounts[categoryName] = 0;
      }
      if (!(categoryName in globalCategoryScores)) {
        globalCategoryScores[categoryName] = 0;
      }
      if (!(categoryName in globalCategoryMatches)) {
        // Use an object to store phrase counts instead of a Set
        globalCategoryMatches[categoryName] = {}; 
      }
    });
  }
}

function incrementCategoryCounts(selectedCategories, foundCategories) {
  // Increment global counters and scores, track matched phrases
  const newCounts = {};
  const newScores = {};
  
  const processMatches = (matches) => {
    matches.forEach(match => {
      const phraseCounts = match.phrases; // e.g., { "sun": 3, "moon": 1 }
      const totalItemsInCategory = Object.values(phraseCounts).reduce((sum, count) => sum + count, 0);

      newCounts[match.category] = (newCounts[match.category] || 0) + totalItemsInCategory;
      newScores[match.category] = (newScores[match.category] || 0) + (match.score || 0);
      
      if (!globalCategoryMatches[match.category]) {
        globalCategoryMatches[match.category] = {};
      }
      
      // Increment the global frequency map for each phrase
      for (const [phrase, count] of Object.entries(phraseCounts)) {
        const p = phrase.toLowerCase();
        globalCategoryMatches[match.category][p] = (globalCategoryMatches[match.category][p] || 0) + count;
      }
    });
  };

  processMatches(selectedCategories);
  processMatches(foundCategories);
  
  // Add to global counters and scores
  Object.entries(newCounts).forEach(([category, count]) => {
    globalCategoryCounts[category] = (globalCategoryCounts[category] || 0) + count;
  });
  Object.entries(newScores).forEach(([category, score]) => {
    globalCategoryScores[category] = (globalCategoryScores[category] || 0) + score;
  });
  
  console.log('Updated global category counts:', globalCategoryCounts);
  console.log('Updated global category scores:', globalCategoryScores);
  console.log('Updated global category matches:', globalCategoryMatches);

  // Update effects.js with latest category data for bucket reordering
  setGlobalCategoryData(globalCategoryCounts, globalCategoryScores);
  
  // Trigger single score celebration for total score from this selection
  const totalNewScore = Object.values(newScores).reduce((sum, score) => sum + score, 0);
  console.log(`Total score for this selection: ${totalNewScore}`);
  
  // Store the current selection's score to be celebrated later
  // Don't accumulate - just use the score from this selection
  window.pendingCategoryScore = totalNewScore;
  
  // Update total display after category scoring is processed
  updateTotalDisplay();
}

function triggerPendingCategoryCelebration() {
  // Guard against duplicate celebrations from the same score
  if (window.lastCelebratedScore === window.pendingCategoryScore) {
    console.log('Score already celebrated, skipping duplicate celebration');
    return;
  }
  
  // Trigger celebration for accumulated category scores
  if (window.pendingCategoryScore && window.pendingCategoryScore > 1) {
    console.log(`Triggering accumulated category celebration: ${window.pendingCategoryScore}pts`);
    showCategoryScoreCelebration(Math.round(window.pendingCategoryScore));
    
    // Track this score as celebrated to prevent duplicates
    window.lastCelebratedScore = window.pendingCategoryScore;
    window.pendingCategoryScore = 0; // Reset after celebrating
    
    // Update total display after celebration is triggered
    updateTotalDisplay();
  }
}

// Score celebration functions are now imported from effects.js

// cleanupTextContent function is now imported from effects.js

function updateCategoryCountsDisplay() {
  const correctScores = recalculateAllCategoryScores();
  console.log('Updating category display - counts:', globalCategoryCounts, 'scores:', correctScores);
  Object.keys(globalCategoryCounts).forEach(category => {
    const count = globalCategoryCounts[category] || 0;
    const score = correctScores[category] || 0;
    const countElement = document.getElementById(`count-${category}`);
    if (countElement) {
      if (count > 0 || score > 0) {
        const displayText = `${Math.round(score)} (${count})`;
        countElement.textContent = displayText;
        countElement.style.display = 'inline';
        console.log(`Set ${category} display to: ${displayText}`);
      } else {
        countElement.style.display = 'none';
      }
    }
  });
  
  // Update "Yours" score display
  updateYoursScoreDisplay();

  // Update total display whenever category scores change
  updateTotalDisplay();
}

function updateMetadataCountsDisplay() {
  // Update the UI to show metadata counts with progress
  console.log('Updating metadata display:', globalMetadataCounts);
  Object.keys(globalMetadataCounts).forEach(metadataType => {
    const discovered = globalMetadataCounts[metadataType] || 0;
    const total = totalMetadataCounts[metadataType] || 0;
    const countElement = document.getElementById(`metadata-count-${metadataType}`);
    console.log(`Updating ${metadataType}: discovered=${discovered}, total=${total}, element exists=${!!countElement}`);
    if (countElement) {
      if (discovered > 0) {
        // Show discovered/total format with checkmark if completed
        const isComplete = discovered === total;
        const checkmark = isComplete ? ' ✓' : '';
        countElement.textContent = `${discovered}/${total}${checkmark}`;
        countElement.style.display = 'inline';
        console.log(`Set ${metadataType} display to: ${discovered}/${total}${checkmark} (complete: ${isComplete})`);
      } else {
        countElement.style.display = 'none';
      }
    }
  });
  
  // Update total bucket display
  updateTotalDisplay();
}

function updateYoursScoreDisplay() {
  const count = globalCategoryCounts.yours || 0;
  const score = globalCategoryScores.yours || 0;
  const countElement = document.getElementById('count-yours');

  if (countElement) {
    // Update the standard category count display
    countElement.textContent = `${Math.round(score)} (${count})`;
    countElement.style.display = 'inline';
    console.log(`Set Yours count display to: ${Math.round(score)} (${count})`);
  } else {
    console.warn('count-yours element not found');
  }
}

function updateTotalDisplay() {
  const correctScores = recalculateAllCategoryScores();
  // Calculate total category points
  const categoryPoints = Object.values(correctScores).reduce((sum, score) => sum + score, 0);
  
  // Calculate total metadata points
  const metadataPoints = (globalMetadataCounts.authors * METADATA_DISCOVERY_SCORES.NEW_AUTHOR) +
                        (globalMetadataCounts.books * METADATA_DISCOVERY_SCORES.NEW_BOOK) +
                        (globalMetadataCounts.stories * METADATA_DISCOVERY_SCORES.NEW_STORY);
  
  // Total points is sum of both
  const totalPoints = categoryPoints + metadataPoints;
  
  const totalPointsElement = document.getElementById('metadata-count-total');

  if (totalPointsElement) {
    totalPointsElement.textContent = `${Math.round(totalPoints)} pts`;
    totalPointsElement.style.display = 'inline';
    console.log(`Set total points display to: ${Math.round(totalPoints)} pts (Categories: ${Math.round(categoryPoints)}, Metadata: ${Math.round(metadataPoints)})`);
  }
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

function animateTextChange(element, selectedText, newText) {
  // Remove the highlight from the selected text
  resetHighlight(element, selectedText);

  const score = currentResult['similarity'];

  //console.log('similarity score', score, currentResult);
  
  // For now, use a simple, reliable text change to ensure proper rendering
  // We'll add the smooth animations back once the basic functionality works
  
  if (score > 0.8) {
    console.log('high score - using simple text change for now');
    
    // For high scores, we still want to preserve word spans for highlighting
    // Use buildTextWithWords instead of formattedContent to maintain structure
    const wordContent = buildTextWithWords(newText);
    element.innerHTML = wordContent;
    
    // Apply highlights after text change
    applyHighlightsToText(element, newText);
    
    // No score celebration for similarity scores - only for category discoveries
    
  } else {
    //console.log('low score - using enhanced word animation');
    
    try {
      // Use enhanced word animation for low scores
      enhancedWordAnimation(element, selectedText, newText, {
        duration: 0.5, // Reduced from 1.0 to 0.5 seconds
        stagger: 0.05, // Reduced from 0.1 to 0.05 seconds
        ease: "power4.out",
        onStart: () => {
          console.log('Starting enhanced word animation');
        },
        onComplete: () => {
          console.log('Enhanced word animation completed');
          
          // Add a small delay to ensure animation is completely finished
          // This prevents race conditions with highlighting
          gsap.delayedCall(0.05, () => {
            console.log('Starting highlights after animation completion delay');
            // Apply highlights after animation completes
            applyHighlightsToText(element, newText);
            // No score celebration for similarity scores - only for category discoveries
          });
        }
      }).catch(error => {
        console.error('Enhanced word animation failed, using fallback:', error);
        // Fallback: use word structure instead of plain text
        const wordContent = buildTextWithWords(newText);
        element.innerHTML = wordContent;
        // Apply highlights after fallback
        applyHighlightsToText(element, newText);
      });
    } catch (error) {
      console.error('Enhanced word animation error, using fallback:', error);
      // Fallback: use word structure instead of plain text
      const wordContent = buildTextWithWords(newText);
      element.innerHTML = wordContent;
      // Apply highlights after fallback
      applyHighlightsToText(element, newText);
    }
  }
}

// Helper function to apply highlights to text
function applyHighlightsToText(element, text) {
  // Guard against multiple calls - if highlights are already being processed, skip
  if (element.dataset.highlightsProcessing === 'true') {
    console.log('Highlights already being processed, skipping duplicate call');
    return;
  }
  
  // Check if we have found categories to highlight
  if (currentResult && currentResult.foundCategories && currentResult.foundCategories.length > 0) {
    console.log('Applying highlights with new, robust method for categories:', currentResult.foundCategories);
    
    // Mark that we're processing highlights
    element.dataset.highlightsProcessing = 'true';
    
    // The animation system may have already split text into word/char spans.
    // For robust highlighting, we work on a clean HTML string first, then set it.
    const originalText = element.textContent || element.innerText;
    
    const { highlightedText, highlights } = highlightPhrasesInText(originalText, currentResult.foundCategories);
    
    // Replace the element's content with the newly highlighted HTML.
    // This is much more reliable than trying to manipulate the live DOM tree.
    element.innerHTML = highlightedText;

    console.log('Highlights applied to text using pre-built HTML.');
    
    // Schedule the highlights to fade to background-only after a delay
    gsap.delayedCall(2.0, () => {
      fadeHighlightsToBackground();
      // Clear the processing flag after fade completes
      element.dataset.highlightsProcessing = 'false';
    });
    
  } else {
    console.log('No found categories to highlight');
    // Clear the processing flag if no highlights
    element.dataset.highlightsProcessing = 'false';
  }
}


// Function to fade highlights to background-only styling (no layout shift)
function fadeHighlightsToBackground() {
  const activeHighlights = document.querySelectorAll('.phrase-highlight.active');
  
  console.log(`Found ${activeHighlights.length} active highlights to fade`);
  
  if (activeHighlights.length > 0) {
    console.log(`Fading ${activeHighlights.length} highlights to subtle background`);
    
    // Simple approach: change the class and let CSS handle the transition
    // This avoids conflicts between GSAP and CSS
    activeHighlights.forEach(highlight => {
      highlight.classList.remove('active');
      highlight.classList.add('faded');
    });
    
    console.log('Highlights faded to subtle background - using CSS transitions');
  } else {
    console.log('No active highlights found to fade');
  }
}


// updateBackgroundForScore function is now imported from effects.js

function replaceRelatedInfo(relatedItemObject) {

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
  
  relatedScoreElement.textContent = "Similarity: " + relatedItemObject.score.toFixed(2).toString();
  
  // Track metadata
  trackMetadata(relatedItemObject);

  // Update background color based on score
  updateBackgroundForScore(relatedItemObject.score);
} 

function trackMetadata(relatedItemObject) {
  // Track unique authors, books, and stories AND store discoveries for later celebration
  let metadataUpdated = false;
  
  // Check for new author discovery
  if (relatedItemObject.author && relatedItemObject.author !== "None" && !uniqueAuthors.has(relatedItemObject.author)) {
    uniqueAuthors.add(relatedItemObject.author);
    globalMetadataCounts.authors = uniqueAuthors.size;
    metadataUpdated = true;
    
    if (!isInitialLoad) {
      pendingMetadataDiscoveries.newAuthor = relatedItemObject.author;
      pendingMetadataDiscoveries.totalPoints += METADATA_DISCOVERY_SCORES.NEW_AUTHOR;
     // console.log(`NEW AUTHOR DISCOVERED: ${relatedItemObject.author} (scoring deferred)`);
    }
  }
  
  // Check for new book discovery  
  if (relatedItemObject.title && !uniqueBooks.has(relatedItemObject.title)) {
    uniqueBooks.add(relatedItemObject.title);
    globalMetadataCounts.books = uniqueBooks.size;
    metadataUpdated = true;
    
    if (!isInitialLoad) {
      pendingMetadataDiscoveries.newBook = relatedItemObject.title;
      pendingMetadataDiscoveries.totalPoints += METADATA_DISCOVERY_SCORES.NEW_BOOK;
     // console.log(`NEW BOOK DISCOVERED: ${relatedItemObject.title} (scoring deferred)`);
    }
  }
  
  // Check for new story discovery
  if (relatedItemObject.story_title && relatedItemObject.story_title !== "None" && relatedItemObject.story_title !== "" && !uniqueStories.has(relatedItemObject.story_title)) {
    uniqueStories.add(relatedItemObject.story_title);
    globalMetadataCounts.stories = uniqueStories.size;
    metadataUpdated = true;
    
    if (!isInitialLoad) {
      pendingMetadataDiscoveries.newStory = relatedItemObject.story_title;
      pendingMetadataDiscoveries.totalPoints += METADATA_DISCOVERY_SCORES.NEW_STORY;
     // console.log(`NEW STORY DISCOVERED: ${relatedItemObject.story_title} (scoring deferred)`);
    }
  }
  
  if (metadataUpdated) {
    updateMetadataCountsDisplay();
  }
}

// Store the newly discovered metadata for later celebration
let pendingMetadataDiscoveries = {
  newAuthor: null,
  newBook: null, 
  newStory: null,
  totalPoints: 0
};

function calculateAndCelebrateMetadataScore() {
  // Celebrate the pending metadata discoveries
  if (pendingMetadataDiscoveries.totalPoints > 0 && !isInitialLoad) {
    console.log(`Celebrating deferred metadata discoveries: +${pendingMetadataDiscoveries.totalPoints} pts`);
    showMetadataScoreCelebration(pendingMetadataDiscoveries.totalPoints);
  }
  
  // Reset pending discoveries
  pendingMetadataDiscoveries = {
    newAuthor: null,
    newBook: null,
    newStory: null,
    totalPoints: 0
  };
  
  // Update total display after metadata discoveries are processed
  updateTotalDisplay();
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

      await initializeModel("TaylorAI/bge-micro");
      await loadFiles();
      index = await createIndex();

      // Create category buckets after data is loaded
      createCategoryBuckets();
      createMetadataBuckets();

      // Initialize global category counters
      initializeGlobalCounts();
      // Share global category data with effects.js for bucket reordering
      setGlobalCategoryData(globalCategoryCounts, globalCategoryScores);
      updateCategoryCountsDisplay();
      updateMetadataCountsDisplay();

      // Set random starting quote
      setRandomStartingQuote();

      // Mark initial load as complete to enable scoring for subsequent discoveries
      isInitialLoad = false;

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

        // Category modal functionality
        const categoryModal = document.getElementById('categoryModal');
        const categoryCloseButton = document.getElementById('categoryModalClose');

        // Hide category modal when clicking close button
        categoryCloseButton.addEventListener('click', () => {
            hideCategoryModal();
        });

        // Hide category modal when clicking outside the modal content
        categoryModal.addEventListener('click', (e) => {
            if (e.target === categoryModal) {
                hideCategoryModal();
            }
        });

        // ===== YOURS EDIT MODAL EVENT LISTENERS =====

        // Yours edit modal elements
        const yoursEditModal = document.getElementById('yoursEditModal');
        const yoursEditModalClose = document.getElementById('yoursEditModalClose');
        const yoursAddWord = document.getElementById('yoursAddWord');
        const yoursNewWord = document.getElementById('yoursNewWord');
        const yoursSaveButton = document.getElementById('yoursSaveButton');
        const yoursCancelButton = document.getElementById('yoursCancelButton');

        // Close modal when clicking X
        yoursEditModalClose.addEventListener('click', hideYoursEditModal);

        // Close modal when clicking outside
        yoursEditModal.addEventListener('click', (e) => {
            if (e.target === yoursEditModal) {
                hideYoursEditModal();
            }
        });

        // Add word button
        yoursAddWord.addEventListener('click', addYoursWord);

        // Add word on Enter key
        yoursNewWord.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addYoursWord();
            }
        });

        // Save button
        yoursSaveButton.addEventListener('click', saveYoursChanges);

        // Cancel button
        yoursCancelButton.addEventListener('click', cancelYoursChanges);

        // Hide modals with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!helpModal.classList.contains('hidden')) {
                    helpModal.classList.add('hidden');
                }
                if (!categoryModal.classList.contains('hidden')) {
                    hideCategoryModal();
                }
                if (!yoursEditModal.classList.contains('hidden')) {
                    hideYoursEditModal();
                }
            }
        });

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

