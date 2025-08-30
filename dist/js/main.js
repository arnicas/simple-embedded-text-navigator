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
  hideLoading
} from './effects.js';


env.localModelPath = './site-data/cache';

let index;
let data = [];
let allData = [];
let categories = [];
let word_scores = {};
let currentResult = null; // Will be set to random quote on initialization

let alreadySeen = [];
let scores = {};

// ===== METADATA DISCOVERY SCORING CONFIGURATION =====
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
    incrementCategoryCounts([], foundCategories); // No selected categories, only found
    updateCategoryCountsDisplay();
    activateCategoryBuckets([], foundCategories);
    
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
        // Calculate total score for this category
        const categoryScore = calculateCategoryScore(filteredPhrases);
        
        matches.push({
          category: categoryName,
          phrases: filteredPhrases,
          score: categoryScore
        });
      }
    }
  }
  
  return matches;
}

function calculateCategoryScore(phrases) {
  let totalScore = 0;
  
  phrases.forEach(phrase => {
    // Split phrase into individual words and sum their scores
    const words = phrase.toLowerCase().split(/\s+/);
    words.forEach(word => {
      // Look up word score, default to 0 if not found
      const wordScore = word_scores[word] || 0;
      totalScore += wordScore;
    });
  });
  
  console.log(`Calculated score for phrases [${phrases.join(', ')}]: ${totalScore}`);
  return totalScore;
}

function getWordScoreDisplay(phrase) {
  // Split phrase into words and calculate total score
  const words = phrase.toLowerCase().split(/\s+/);
  let totalScore = 0;
  
  words.forEach(word => {
    const score = word_scores[word] || 0;
    totalScore += score;
  });
  
  // Show phrase with total score instead of individual word scores
  return { display: `${phrase} (${totalScore} pts)`, totalScore };
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
  
  // Set title with count and score
  const count = globalCategoryCounts[categoryName] || 0;
  const score = globalCategoryScores[categoryName] || 0;
  const capitalizedName = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
  if (count > 0) {
    modalTitle.textContent = `${capitalizedName}: ${count} Found (${Math.round(score)} Points)`;
    modalCount.style.display = 'none'; // Hide the separate count element
  } else {
    modalTitle.textContent = capitalizedName;
    modalCount.textContent = `Keep exploring to discover ${categoryName} elements and earn points!`;
    modalCount.style.display = 'block';
  }
  
  // Set matched phrases with individual word scores
  const matches = globalCategoryMatches[categoryName];
  if (matches && matches.size > 0) {
    const matchesArray = Array.from(matches).sort();
        modalMatches.innerHTML = `
        <p class="scoring-explanation">Common items have fewer points associated with them.</p>
        <div class="category-matches-list">
          ${matchesArray.map(phrase => {
            const scoreInfo = getWordScoreDisplay(phrase);
            return `<span class="match-phrase">${scoreInfo.display}</span>`;
          }).join('')}
        </div>
      `;
    modalMatches.style.display = 'block';
  } else {
    modalMatches.style.display = 'none';
  }
  
  // Show modal
  modal.classList.remove('hidden');
}

function hideCategoryModal() {
  const modal = document.getElementById('categoryModal');
  modal.classList.add('hidden');
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
    match.phrases.forEach(phrase => {
      const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      let regexMatch;
      while ((regexMatch = regex.exec(text)) !== null) {
        potentialMatches.push({
          start: regexMatch.index,
          end: regexMatch.index + regexMatch[0].length,
          phrase: regexMatch[0],
          category: match.category
        });
        console.log(`Found potential match: "${regexMatch[0]}" at ${regexMatch.index}-${regexMatch.index + regexMatch[0].length} for category ${match.category}`);
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
  
  // Apply highlights in reverse order to maintain text positions
  let highlightedText = text;
  const highlights = [];
  
  finalMatches.reverse().forEach((match, index) => {
    const highlightId = `highlight-${match.category}-${highlights.length}`;
    highlights.push({
      id: highlightId,
      phrase: match.phrase,
      category: match.category
    });
    
    const before = highlightedText.substring(0, match.start);
    const after = highlightedText.substring(match.end);
    const spanHtml = `<span class="phrase-highlight" id="${highlightId}" data-category="${match.category}">${match.phrase}</span>`;
    
    highlightedText = before + spanHtml + after;
    console.log(`Applied highlight: ${highlightId} for phrase: ${match.phrase}`);
  });
  
  console.log(`Total highlights applied: ${highlights.length}`);
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
        globalCategoryMatches[categoryName] = new Set(); // Use Set to avoid duplicates
      }
    });
  }
}

function incrementCategoryCounts(selectedCategories, foundCategories) {
  // Increment global counters and scores, track matched phrases
  const newCounts = {};
  const newScores = {};
  
  // Add selected categories counts and scores, track phrases
  selectedCategories.forEach(match => {
    newCounts[match.category] = (newCounts[match.category] || 0) + match.phrases.length;
    newScores[match.category] = (newScores[match.category] || 0) + (match.score || 0);
    // Add phrases to global matches set
    if (!globalCategoryMatches[match.category]) {
      globalCategoryMatches[match.category] = new Set();
    }
    match.phrases.forEach(phrase => {
      globalCategoryMatches[match.category].add(phrase.toLowerCase());
    });
  });
  
  // Add found categories counts and scores, track phrases
  foundCategories.forEach(match => {
    newCounts[match.category] = (newCounts[match.category] || 0) + match.phrases.length;
    newScores[match.category] = (newScores[match.category] || 0) + (match.score || 0);
    // Add phrases to global matches set
    if (!globalCategoryMatches[match.category]) {
      globalCategoryMatches[match.category] = new Set();
    }
    match.phrases.forEach(phrase => {
      globalCategoryMatches[match.category].add(phrase.toLowerCase());
    });
  });
  
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
  
  // Trigger single score celebration for total score from this selection
  const totalNewScore = Object.values(newScores).reduce((sum, score) => sum + score, 0);
  console.log(`Total score for this selection: ${totalNewScore}`);
  
  // Store the total score to be celebrated later, don't celebrate immediately
  // This prevents multiple celebrations if this function is called multiple times
  window.pendingCategoryScore = (window.pendingCategoryScore || 0) + totalNewScore;
}

function triggerPendingCategoryCelebration() {
  // Trigger celebration for accumulated category scores
  if (window.pendingCategoryScore && window.pendingCategoryScore > 1) {
    console.log(`Triggering accumulated category celebration: ${window.pendingCategoryScore}pts`);
    showCategoryScoreCelebration(Math.round(window.pendingCategoryScore));
    window.pendingCategoryScore = 0; // Reset after celebrating
  }
}

// Score celebration functions are now imported from effects.js

// cleanupTextContent function is now imported from effects.js

function updateCategoryCountsDisplay() {
  // Update the UI to show both count and score
  console.log('Updating category display - counts:', globalCategoryCounts, 'scores:', globalCategoryScores);
  Object.keys(globalCategoryCounts).forEach(category => {
    const count = globalCategoryCounts[category] || 0;
    const score = globalCategoryScores[category] || 0;
    const countElement = document.getElementById(`count-${category}`);
   // console.log(`Updating ${category}: count=${count}, score=${score}, element exists=${!!countElement}`);
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

function updateTotalDisplay() {
  const totalPoints = Object.values(globalCategoryScores).reduce((sum, score) => sum + score, 0);
  const totalPointsElement = document.getElementById('metadata-count-total');
  
  if (totalPointsElement) {
    totalPointsElement.textContent = `${Math.round(totalPoints)} pts`;
    totalPointsElement.style.display = 'inline';
    console.log(`Set total points display to: ${Math.round(totalPoints)} pts`);
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

function performBucketReorder() {
  const bucketContainer = document.getElementById('categoryBuckets');
  if (!bucketContainer) return;
  
  // Get all bucket elements
  const buckets = Array.from(bucketContainer.querySelectorAll('.categoryBucket'));
  
  // Sort buckets by score (highest first), then count (highest first), then alphabetically
  buckets.sort((a, b) => {
    const categoryA = a.id.replace('bucket-', '');
    const categoryB = b.id.replace('bucket-', '');
    
    const scoreA = globalCategoryScores[categoryA] || 0;
    const scoreB = globalCategoryScores[categoryB] || 0;
    const countA = globalCategoryCounts[categoryA] || 0;
    const countB = globalCategoryCounts[categoryB] || 0;
    
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
  
  // Use a simpler fade-based reordering instead of position-based
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
      const count = globalCategoryCounts[category] || 0;
      const score = Math.round(globalCategoryScores[category] || 0);
      return `${category}: ${count} items (${score}pts)`;
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
  
  // Don't increment counters yet - wait until animations complete
  
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
    
    // Process scoring and celebrations immediately based on found categories
    if (foundCategories.length > 0) {
      gsap.delayedCall(2.5, () => {  // Wait for text animation to mostly complete
        console.log('Processing category scoring for:', foundCategories);
        
        // Increment counters and trigger score celebrations
        incrementCategoryCounts(selectedCategories, foundCategories);
        updateCategoryCountsDisplay();
        activateCategoryBuckets(selectedCategories, foundCategories);
        
        // Trigger any accumulated category score celebration
        triggerPendingCategoryCelebration();
        
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
            // NOW increment counters and trigger score celebrations after animations complete
            console.log('Animation complete, incrementing counters and updating display');
            incrementCategoryCounts(categoriesForCallback.selectedCategories, categoriesForCallback.foundCategories);
            updateCategoryCountsDisplay();
            activateCategoryBuckets(categoriesForCallback.selectedCategories, categoriesForCallback.foundCategories);
            
            // Trigger any accumulated category score celebration
            triggerPendingCategoryCelebration();
            
            // Process any pending metadata celebrations after word celebrations complete
            calculateAndCelebrateMetadataScore();
            
            // Clean up any remaining HTML markup
            cleanupTextContent();
            
            // Reorder buckets based on updated counts after a short delay
            gsap.delayedCall(0.5, () => {
              reorderCategoryBuckets();
            });
          }); // animatePhrasesToBuckets callback
        }); // gsap.delayedCall callback
      } else {
        // No highlights found, ensure text is visible
        console.log('No highlights found, text remains visible without changes');
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
      // Create word spans for animation first
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
      
      // Apply highlights to individual word spans instead of replacing all HTML
      const foundCategories = currentResult.foundCategories || [];
      if (foundCategories.length > 0) {
        // Check each word span to see if it should be highlighted
        const wordSpans = element.querySelectorAll('.word');
        foundCategories.forEach(match => {
          match.phrases.forEach(phrase => {
            const regex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            
            // For multi-word phrases, we need to find consecutive word spans
            const words = phrase.split(' ');
            if (words.length === 1) {
              // Single word - find matching span
              wordSpans.forEach((span, index) => {
                if (regex.test(span.textContent)) {
                  span.classList.add('phrase-highlight');
                  span.id = `highlight-${match.category}-${index}`;
                  span.setAttribute('data-category', match.category);
                }
              });
            } else {
              // Multi-word phrase - find consecutive matching spans
              for (let i = 0; i <= wordSpans.length - words.length; i++) {
                let matches = true;
                for (let j = 0; j < words.length; j++) {
                  const wordRegex = new RegExp(`\\b${words[j].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
                  if (!wordRegex.test(wordSpans[i + j].textContent)) {
                    matches = false;
                    break;
                  }
                }
                if (matches) {
                  // Apply highlight to all words in the phrase, use same base ID
                  const baseId = `highlight-${match.category}-${i}`;
                  for (let j = 0; j < words.length; j++) {
                    wordSpans[i + j].classList.add('phrase-highlight');
                    wordSpans[i + j].id = j === 0 ? baseId : `${baseId}-${j}`;
                    wordSpans[i + j].setAttribute('data-category', match.category);
                    wordSpans[i + j].setAttribute('data-phrase-group', baseId);
                  }
                  break; // Only highlight the first occurrence
                }
              }
            }
          });
        });
      }

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
              // Check if text contains HTML markup (highlights) - if so, don't sanitize
              if (newText.includes('<span class="phrase-highlight"')) {
                element.innerHTML = newText;
              } else {
                element.innerHTML = formattedContent(newText);
              }
            }
          });
        }
      });
    }
  });
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
      console.log(`NEW AUTHOR DISCOVERED: ${relatedItemObject.author} (scoring deferred)`);
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
      console.log(`NEW BOOK DISCOVERED: ${relatedItemObject.title} (scoring deferred)`);
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
      console.log(`NEW STORY DISCOVERED: ${relatedItemObject.story_title} (scoring deferred)`);
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
}


function highlightText(textElement) {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    const words = selectedText.split(' ');
    console.log('selected words', words);

    if (words.length > 1 || selectedText.length >= 4) {  // selection rules
      // More robust check for selection within text element
      const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

      // Check if selection is within text element using multiple validation methods
      let isWithinTextElement = false;

      if (range) {
        // Method 1: Check if any part of the range intersects with the text element
        const rect = range.getBoundingClientRect();
        const textRect = textElement.getBoundingClientRect();

        // Check if the selection bounding rect overlaps with text element
        isWithinTextElement = !(rect.right < textRect.left ||
                               rect.left > textRect.right ||
                               rect.bottom < textRect.top ||
                               rect.top > textRect.bottom);

        // Method 2: Also check if start or end containers are within text element
        if (!isWithinTextElement) {
          isWithinTextElement = textElement.contains(range.startContainer) ||
                               textElement.contains(range.endContainer) ||
                               textElement.contains(range.commonAncestorContainer);
        }

        console.log('Selection validation:', {
          selectedText: selectedText.substring(0, 20) + (selectedText.length > 20 ? '...' : ''),
          boundingBoxOverlap: !(rect.right < textRect.left || rect.left > textRect.right || rect.bottom < textRect.top || rect.top > textRect.bottom),
          containsStart: textElement.contains(range.startContainer),
          containsEnd: textElement.contains(range.endContainer),
          containsCommon: textElement.contains(range.commonAncestorContainer),
          isWithinTextElement
        });
      }

      if (selectedText && isWithinTextElement) {
        console.log('in valid selection');

        // Create highlight span
        const span = document.createElement('span');
        span.className = 'highlight';
        
        // Use the range we already got from the validation check
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
            // Reset selection tracking after text change
            lastSelectionText = '';
          } else {
            animateTextChange(textElement, selectedText, "Error, No text found.");
            // Reset selection tracking after text change
            lastSelectionText = '';
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
      createMetadataBuckets();
      
      // Initialize global category counters
      initializeGlobalCounts();
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
  
  // Hide modals with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!helpModal.classList.contains('hidden')) {
        helpModal.classList.add('hidden');
      }
      if (!categoryModal.classList.contains('hidden')) {
        hideCategoryModal();
      }
    }
  });

  // Unified selection handler for both desktop and mobile
  let selectionTimeout = null;
  let isProcessingSelection = false;
  let lastSelectionText = '';

  function handleSelection() {
    // Prevent multiple simultaneous processing
    if (isProcessingSelection) {
      console.log('Selection already being processed, skipping...');
      return;
    }

    // Clear any existing timeout to prevent multiple calls
    if (selectionTimeout) {
      clearTimeout(selectionTimeout);
    }

    console.log('Selection event triggered, processing in 200ms...');

    // Delay to allow selection to stabilize
    selectionTimeout = setTimeout(() => {
      const currentSelection = window.getSelection().toString().trim();

      // Check if this is the same selection we just processed
      if (currentSelection === lastSelectionText && lastSelectionText !== '') {
        console.log('Duplicate selection detected, skipping...');
        return;
      }

      // Check if selection is still valid
      if (currentSelection.length > 0) {
        console.log('Processing selection:', currentSelection.substring(0, 30) + '...');
        isProcessingSelection = true;
        lastSelectionText = currentSelection;
        highlightText(textElement);

        // Reset processing flag after a delay
        setTimeout(() => {
          isProcessingSelection = false;
        }, 1000);
      }
    }, 200);
  }

  // Desktop selection
  textElement.addEventListener('mouseup', handleSelection);

  // Mobile selection support
  textElement.addEventListener('touchend', handleSelection);

  // Handle selection changes (useful for keyboard selection or programmatic changes)
  // Only listen for selectionchange on document, not textElement specifically
  let lastSelectionChangeTime = 0;
  document.addEventListener('selectionchange', () => {
    const now = Date.now();
    // Throttle selectionchange events to once per 300ms
    if (now - lastSelectionChangeTime < 300) {
      return;
    }
    lastSelectionChangeTime = now;

    const selection = window.getSelection();
    if (selection.rangeCount > 0 && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      // Check if selection intersects with our text element
      if (textElement.contains(range.startContainer) ||
          textElement.contains(range.endContainer) ||
          textElement.contains(range.commonAncestorContainer)) {
        console.log('Selection change detected within text element');
        handleSelection();
      }
    }
  });

} catch (error) {
  console.error('Failed to initialize document:', error);
}
});