// UI Module - Handles all DOM manipulation and UI component creation
import { gsap } from 'gsap';
import { formattedContent, animatePhrasesToBuckets, setGlobalCategoryData, getGlobalCategoryCount, getGlobalCategoryScore, cleanupTextContent } from './effects.mjs';

// Module-scoped variables to store references passed during initialization
let scoreManager;
let categories = {};
let globalCategoryCounts = {};
let globalCategoryScores = {};
let globalCategoryMatches = {};
let globalMetadataCounts = {};
let totalMetadataCounts = {};
let word_scores = {};
let userYoursWords = [];
let METADATA_DISCOVERY_SCORES = {};
let uniqueAuthors, uniqueBooks, uniqueStories;

// Callback functions from main.js
let saveYoursChangesCallback;
let findRelatedTextCallback;
let getPhraseScoreCallback;
let recalculateAllCategoryScoresCallback;
let updateYoursScoreDisplayCallback;
let updateTotalDisplayCallback;
let updateMetadataCountsDisplayCallback;
let reorderCategoryBucketsCallback;
let trackMetadataCallback;
let calculateAndCelebrateMetadataScoreCallback;
let triggerPendingCategoryCelebrationCallback;
let incrementCategoryCountsCallback;

// Initialize the UI module with references from main.js
export function initializeUI(config) {
  scoreManager = config.scoreManager;

  // Store state references (prefer ScoreManager when available)
  categories = scoreManager ? scoreManager.getCategories() : (config.categories || {});
  globalCategoryCounts = scoreManager ? scoreManager.getGlobalCategoryCounts() : (config.globalCategoryCounts || {});
  globalCategoryScores = scoreManager ? scoreManager.getGlobalCategoryScores() : (config.globalCategoryScores || {});
  globalCategoryMatches = scoreManager ? scoreManager.getGlobalCategoryMatches() : (config.globalCategoryMatches || {});
  globalMetadataCounts = scoreManager ? scoreManager.getGlobalMetadataCounts() : (config.globalMetadataCounts || {});
  totalMetadataCounts = scoreManager ? scoreManager.getTotalMetadataCounts() : (config.totalMetadataCounts || {});
  word_scores = scoreManager ? scoreManager.getWordScores() : (config.word_scores || {});
  userYoursWords = scoreManager ? scoreManager.getUserYoursWords() : (config.userYoursWords || []);
  METADATA_DISCOVERY_SCORES = scoreManager ? scoreManager.getMetadataDiscoveryScores() : (config.METADATA_DISCOVERY_SCORES || {});
  uniqueAuthors = scoreManager ? scoreManager.getUniqueAuthors() : config.uniqueAuthors;
  uniqueBooks = scoreManager ? scoreManager.getUniqueBooks() : config.uniqueBooks;
  uniqueStories = scoreManager ? scoreManager.getUniqueStories() : config.uniqueStories;

  // Store callback functions
  findRelatedTextCallback = config.findRelatedText;
  reorderCategoryBucketsCallback = config.reorderCategoryBuckets;
  incrementCategoryCountsCallback = config.incrementCategoryCounts;

  if (scoreManager) {
    saveYoursChangesCallback = () => scoreManager.syncYoursWords(userYoursWords);
    getPhraseScoreCallback = (phrase) => scoreManager.getPhraseScore(phrase);
    recalculateAllCategoryScoresCallback = () => scoreManager.recalculateAllCategoryScores();
    updateYoursScoreDisplayCallback = () => scoreManager.updateYoursScoreDisplay();
    updateTotalDisplayCallback = () => scoreManager.updateTotalDisplay();
    updateMetadataCountsDisplayCallback = () => scoreManager.updateMetadataCountsDisplay();
    trackMetadataCallback = (relatedItemObject) => scoreManager.trackMetadata(relatedItemObject);
    calculateAndCelebrateMetadataScoreCallback = () => scoreManager.calculateAndCelebrateMetadataScore();
    triggerPendingCategoryCelebrationCallback = () => scoreManager.triggerPendingCategoryCelebration();
  } else {
    saveYoursChangesCallback = config.saveYoursChanges;
    getPhraseScoreCallback = config.getPhraseScore;
    recalculateAllCategoryScoresCallback = config.recalculateAllCategoryScores;
    updateYoursScoreDisplayCallback = config.updateYoursScoreDisplay;
    updateTotalDisplayCallback = config.updateTotalDisplay;
    updateMetadataCountsDisplayCallback = config.updateMetadataCountsDisplay;
    trackMetadataCallback = config.trackMetadata;
    calculateAndCelebrateMetadataScoreCallback = config.calculateAndCelebrateMetadataScore;
    triggerPendingCategoryCelebrationCallback = config.triggerPendingCategoryCelebration;
  }

  // Set up global category data for effects module
  setGlobalCategoryData(globalCategoryCounts, globalCategoryScores);

  // Set up UI event listeners
  setupUIEventListeners();
}

function setupUIEventListeners() {
  // Help modal functionality
  const helpButton = document.getElementById('helpButton');
  const helpModal = document.getElementById('helpModal');
  const closeButton = helpModal?.querySelector('.close');

  if (helpButton && helpModal) {
    helpButton.addEventListener('click', () => {
      helpModal.classList.remove('hidden');
    });

    if (closeButton) {
      closeButton.addEventListener('click', () => {
        helpModal.classList.add('hidden');
      });
    }

    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        helpModal.classList.add('hidden');
      }
    });
  }

  // Category modal functionality
  const categoryModal = document.getElementById('categoryModal');
  const categoryCloseButton = document.getElementById('categoryModalClose');

  if (categoryModal && categoryCloseButton) {
    categoryCloseButton.addEventListener('click', () => {
      hideCategoryModal();
    });

    categoryModal.addEventListener('click', (e) => {
      if (e.target === categoryModal) {
        hideCategoryModal();
      }
    });
  }

  // Yours edit modal functionality
  const yoursEditModal = document.getElementById('yoursEditModal');
  const yoursEditModalClose = document.getElementById('yoursEditModalClose');
  const yoursAddWord = document.getElementById('yoursAddWord');
  const yoursNewWord = document.getElementById('yoursNewWord');
  const yoursSaveButton = document.getElementById('yoursSaveButton');
  const yoursCancelButton = document.getElementById('yoursCancelButton');

  if (yoursEditModal && yoursEditModalClose) {
    yoursEditModalClose.addEventListener('click', hideYoursEditModal);

    yoursEditModal.addEventListener('click', (e) => {
      if (e.target === yoursEditModal) {
        hideYoursEditModal();
      }
    });
  }

  if (yoursAddWord && yoursNewWord) {
    yoursAddWord.addEventListener('click', addYoursWord);

    yoursNewWord.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addYoursWord();
      }
    });
  }

  if (yoursSaveButton) {
    yoursSaveButton.addEventListener('click', saveYoursChanges);
  }

  if (yoursCancelButton) {
    yoursCancelButton.addEventListener('click', cancelYoursChanges);
  }

  // Escape key to hide modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (helpModal && !helpModal.classList.contains('hidden')) {
        helpModal.classList.add('hidden');
      }
      if (categoryModal && !categoryModal.classList.contains('hidden')) {
        hideCategoryModal();
      }
      if (yoursEditModal && !yoursEditModal.classList.contains('hidden')) {
        hideYoursEditModal();
      }
    }
  });
}

export function createMetadataBuckets() {
  const metadataContainer = document.getElementById('metadataBuckets');
  if (!metadataContainer) return;
  
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

export function createCategoryBuckets(categoriesData) {
  const bucketContainer = document.getElementById('categoryBuckets');
  if (!bucketContainer) return;
  
  bucketContainer.innerHTML = ''; // Clear existing buckets

  // Get all category names from the loaded categories data
  const categoryNames = Object.keys(categoriesData);

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
export function saveYoursChanges() {
  if (scoreManager) {
    scoreManager.syncYoursWords(userYoursWords);
  } else if (saveYoursChangesCallback) {
    saveYoursChangesCallback();
  }

  updateYoursScoreDisplayCallback?.();
  updateTotalDisplayCallback?.();

  console.log('Saved "Yours" category words:', userYoursWords);
  console.log('User words added to "Yours" category - they will get scores when discovered in text');

  hideYoursEditModal();

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

export function showCategoryModal(categoryName, imageSrc) {
  const modal = document.getElementById('categoryModal');
  const modalImage = document.getElementById('categoryModalImage');
  const modalTitle = document.getElementById('categoryModalTitle');
  const modalCount = document.getElementById('categoryModalCount');
  const modalMatches = document.getElementById('categoryModalMatches');
  
  if (!modal || !modalImage || !modalTitle || !modalCount || !modalMatches) return;
  
  // Set modal content
  modalImage.src = imageSrc;
  modalImage.alt = categoryName;
  modalImage.style.display = 'block';
  
  const matches = globalCategoryMatches[categoryName];

  // Recalculate total score from the ground truth (globalCategoryMatches) to ensure consistency.
  let totalRecalculatedScore = 0;
  if (matches && Object.keys(matches).length > 0) {
      for (const [phrase, count] of Object.entries(matches)) {
          totalRecalculatedScore += count * getPhraseScoreCallback(phrase);
      }
  }

  // Set title with count and RECALCULATED score
  const count = globalCategoryCounts[categoryName] || 0;
  const score = totalRecalculatedScore;
  const capitalizedName = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);
  if (count > 0) {
    modalTitle.textContent = `${capitalizedName}: ${count} Found (${Math.round(score)} Points)`;
    modalCount.style.display = 'none';
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
          const scorePerItem = getPhraseScoreCallback(phrase);
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

export function hideCategoryModal() {
  const modal = document.getElementById('categoryModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// ===== YOURS CATEGORY EDIT MODAL FUNCTIONS =====

export function showYoursEditModal() {
  const modal = document.getElementById('yoursEditModal');
  const wordsList = document.getElementById('yoursWordsList');

  if (!modal || !wordsList) return;

  // Clear the input field
  const newWordInput = document.getElementById('yoursNewWord');
  if (newWordInput) {
    newWordInput.value = '';
  }

  // Display current words
  updateYoursWordsDisplay();

  // Show modal
  modal.classList.remove('hidden');
}

export function hideYoursEditModal() {
  const modal = document.getElementById('yoursEditModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

export function updateYoursWordsDisplay() {
  const wordsList = document.getElementById('yoursWordsList');
  if (!wordsList) return;

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

export function addYoursWord() {
  const input = document.getElementById('yoursNewWord');
  if (!input) return;
  
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

export function removeYoursWord(index) {
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

export function cancelYoursChanges() {
  hideYoursEditModal();
}

export function showMetadataModal(metadataType, imageSrc) {
  const modal = document.getElementById('categoryModal');
  const modalImage = document.getElementById('categoryModalImage');
  const modalTitle = document.getElementById('categoryModalTitle');
  const modalCount = document.getElementById('categoryModalCount');
  const modalMatches = document.getElementById('categoryModalMatches');
  
  if (!modal || !modalImage || !modalTitle || !modalCount || !modalMatches) return;
  
  // Set modal content
  modalImage.src = imageSrc;
  modalImage.alt = metadataType;
  modalImage.style.display = 'block';
  
  // Set title with count and progress
  const discovered = globalMetadataCounts[metadataType] || 0;
  const total = totalMetadataCounts[metadataType] || 0;
  const displayName = metadataType.charAt(0).toUpperCase() + metadataType.slice(1);
  if (discovered > 0) {
    // Show discovered/total format with checkmark if completed
    const isComplete = discovered === total;
    const checkmark = isComplete ? ' ✓' : '';
    modalTitle.textContent = `${displayName}: ${discovered}/${total}${checkmark}`;
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

export function showTotalModal(imageSrc) {
  const modal = document.getElementById('categoryModal');
  const modalImage = document.getElementById('categoryModalImage');
  const modalTitle = document.getElementById('categoryModalTitle');
  const modalCount = document.getElementById('categoryModalCount');
  const modalMatches = document.getElementById('categoryModalMatches');
  
  if (!modal || !modalImage || !modalTitle || !modalCount || !modalMatches) return;
  
  // Set modal content
  modalImage.src = imageSrc;
  modalImage.alt = 'total';
  modalImage.style.display = 'block';
  
  // Calculate totals
  const correctScores = recalculateAllCategoryScoresCallback();
  const categoryPoints = Object.values(correctScores).reduce((sum, score) => sum + score, 0);
  const yoursPoints = correctScores.yours || 0;
  const nonYoursPoints = Math.max(0, categoryPoints - yoursPoints);
  
  // Metadata discoveries no longer award points; total matches category points.
  const totalPoints = categoryPoints;
  const totalItems = Object.values(globalCategoryCounts).reduce((sum, count) => sum + count, 0);
  const metadataTotal = Object.values(globalMetadataCounts).reduce((sum, count) => sum + count, 0);
  const grandTotalItems = totalItems + metadataTotal;

  const authorsDiscovered = globalMetadataCounts.authors || 0;
  const booksDiscovered = globalMetadataCounts.books || 0;
  const storiesDiscovered = globalMetadataCounts.stories || 0;
  const authorsTotal = totalMetadataCounts.authors || 0;
  const booksTotal = totalMetadataCounts.books || 0;
  const storiesTotal = totalMetadataCounts.stories || 0;
  
  // Set title
  modalTitle.textContent = `Total Progress: ${Math.round(totalPoints)} Points`;
  modalCount.style.display = 'none';
  
  // Set content showing breakdown
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
        <div style="display: flex; justify-content: space-between; margin: 5px 0; padding: 6px 8px; background: rgba(255,255,255,0.2); border-radius: 4px;">
          <span style="font-size: 13px; color: #555;">• Story Categories:</span>
          <span style="font-weight: bold; color: #2d1810;">${Math.round(nonYoursPoints)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 5px 0; padding: 6px 8px; background: rgba(255,255,255,0.2); border-radius: 4px;">
          <span style="font-size: 13px; color: #555;">• Yours Items:</span>
          <span style="font-weight: bold; color: #2d1810;">${Math.round(yoursPoints)}</span>
        </div>
      </div>
      
      <div style="background: rgba(144, 238, 144, 0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <h4 style="color: #228B22; margin-bottom: 10px;">📚 Sources Discovered</h4>
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <span style="font-size: 14px; color: #555;">✍️ Authors found:</span>
          <span style="font-weight: bold; color: #228B22;">${authorsDiscovered}/${authorsTotal}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <span style="font-size: 14px; color: #555;">📖 Books found:</span>
          <span style="font-weight: bold; color: #228B22;">${booksDiscovered}/${booksTotal}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
          <span style="font-size: 14px; color: #555;">📜 Stories found:</span>
          <span style="font-weight: bold; color: #228B22;">${storiesDiscovered}/${storiesTotal}</span>
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

export function highlightPhrasesInText(text, categories) {
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

export function updateCategoryCountsDisplay() {
  // Check if the callback is properly defined before using it
  if (!recalculateAllCategoryScoresCallback || typeof recalculateAllCategoryScoresCallback !== 'function') {
    console.warn('recalculateAllCategoryScoresCallback not properly initialized, skipping category display update');
    return;
  }
  
  const correctScores = recalculateAllCategoryScoresCallback();
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
  updateYoursScoreDisplayCallback();

  // Update total display whenever category scores change
  updateTotalDisplayCallback();
}

export function updateMetadataCountsDisplay() {
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
  updateTotalDisplayCallback();
}

export function updateYoursScoreDisplay() {
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

export function updateTotalDisplay() {
  const correctScores = recalculateAllCategoryScoresCallback();
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

export function activateCategoryBuckets(selectedCategories, foundCategories) {
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

export function updateCategoryBuckets(selectedCategories, foundCategories) {
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
        calculateAndCelebrateMetadataScoreCallback();
        
        // Clean up any remaining HTML markup after a delay
        gsap.delayedCall(2, () => {
          cleanupTextContent();
          
          // Reorder buckets based on updated counts
          gsap.delayedCall(0.5, () => {
            reorderCategoryBucketsCallback();
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
      triggerPendingCategoryCelebrationCallback();
      calculateAndCelebrateMetadataScoreCallback();
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

export function animateTextChange(element, selectedText, newText, currentResult) {
  // For now, use a simple, reliable text change to ensure proper rendering
  // We'll add the smooth animations back once the basic functionality works
  
  if (currentResult && currentResult.similarity > 0.8) {
    console.log('high score - using simple text change for now');
    
    // For high scores, we still want to preserve word spans for highlighting
    // Use buildTextWithWords instead of formattedContent to maintain structure
    const wordContent = buildTextWithWords(newText);
    element.innerHTML = wordContent;
    
    // Apply highlights after text change
    applyHighlightsToText(element, newText, currentResult);
    
  } else {
    //console.log('low score - using enhanced word animation');
    
    try {
      // Use enhanced word animation for low scores
      // This would need to be imported from effects.mjs
      console.log('Enhanced word animation not yet implemented in UI module');
      // Fallback: use word structure instead of plain text
      const wordContent = buildTextWithWords(newText);
      element.innerHTML = wordContent;
      // Apply highlights after fallback
      applyHighlightsToText(element, newText, currentResult);
    } catch (error) {
      console.error('Enhanced word animation failed, using fallback:', error);
      // Fallback: use word structure instead of plain text
      const wordContent = buildTextWithWords(newText);
      element.innerHTML = wordContent;
      // Apply highlights after fallback
      applyHighlightsToText(element, newText, currentResult);
    }
  }
}

export function applyHighlightsToText(element, text, currentResult) {
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

export function fadeHighlightsToBackground() {
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

function buildTextWithWords(text) {
  const words = text.split(' ');
  return words.map(word => `<span class="word">${word}</span>`).join(' ');
}

function buildTextWithHighlights(text, highlights = []) {
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
