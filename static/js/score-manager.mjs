export class ScoreManager {
  constructor({
    categories = {},
    wordScores = {},
    userYoursWords = [],
    metadataDiscoveryScores = {},
    globalCategoryCounts = {},
    globalCategoryScores = {},
    globalCategoryMatches = {},
    globalMetadataCounts = {},
    totalMetadataCounts = {},
    uniqueAuthors = new Set(),
    uniqueBooks = new Set(),
    uniqueStories = new Set(),
    setGlobalCategoryData = () => {},
    showCategoryScoreCelebration = () => {},
    showMetadataScoreCelebration = () => {}
  } = {}) {
    this.categories = categories;
    this.wordScores = wordScores;
    this.userYoursWords = userYoursWords;
    this.metadataDiscoveryScores = metadataDiscoveryScores;
    this.globalCategoryCounts = globalCategoryCounts;
    this.globalCategoryScores = globalCategoryScores;
    this.globalCategoryMatches = globalCategoryMatches;
    this.globalMetadataCounts = globalMetadataCounts;
    this.totalMetadataCounts = totalMetadataCounts;
    this.uniqueAuthors = uniqueAuthors;
    this.uniqueBooks = uniqueBooks;
    this.uniqueStories = uniqueStories;
    this.setGlobalCategoryDataFn = setGlobalCategoryData;
    this.categoryCelebrationFn = showCategoryScoreCelebration;
    this.metadataCelebrationFn = showMetadataScoreCelebration;

    this.pendingCategoryScore = 0;
    this.lastCelebratedScore = null;
    this.pendingMetadataDiscoveries = this.#createPendingMetadataState();
    this.isInitialLoad = true;
  }

  setCategories(categories) {
    this.categories = categories || {};
  }

  setWordScores(wordScores) {
    this.wordScores = wordScores || {};
  }

  setUserWordsReference(words) {
    this.userYoursWords = words || [];
  }

  setTotalMetadataCounts(totalCounts) {
    this.totalMetadataCounts = totalCounts || {};
  }

  setGlobalMetadataCounts(metadataCounts) {
    this.globalMetadataCounts = metadataCounts || {};
  }

  setInitialLoadState(isInitialLoad) {
    this.isInitialLoad = Boolean(isInitialLoad);
  }

  markInitialLoadComplete() {
    this.isInitialLoad = false;
  }

  initializeGlobalCounts(categoriesOverride) {
    const source = categoriesOverride || this.categories;
    if (!source) {
      return;
    }

    Object.keys(source).forEach((categoryName) => {
      if (!(categoryName in this.globalCategoryCounts)) {
        this.globalCategoryCounts[categoryName] = 0;
      }
      if (!(categoryName in this.globalCategoryScores)) {
        this.globalCategoryScores[categoryName] = 0;
      }
      if (!(categoryName in this.globalCategoryMatches)) {
        this.globalCategoryMatches[categoryName] = {};
      }
    });

    this.setGlobalCategoryDataFn(this.globalCategoryCounts, this.globalCategoryScores);
  }

  getCategories() {
    return this.categories;
  }

  getWordScores() {
    return this.wordScores;
  }

  getUserYoursWords() {
    return this.userYoursWords;
  }

  getMetadataDiscoveryScores() {
    return this.metadataDiscoveryScores;
  }

  getGlobalCategoryCounts() {
    return this.globalCategoryCounts;
  }

  getGlobalCategoryScores() {
    return this.globalCategoryScores;
  }

  getGlobalCategoryMatches() {
    return this.globalCategoryMatches;
  }

  getGlobalMetadataCounts() {
    return this.globalMetadataCounts;
  }

  getTotalMetadataCounts() {
    return this.totalMetadataCounts;
  }

  getUniqueAuthors() {
    return this.uniqueAuthors;
  }

  getUniqueBooks() {
    return this.uniqueBooks;
  }

  getUniqueStories() {
    return this.uniqueStories;
  }

  getPhraseScore(phrase) {
    const normalizedPhrase = (phrase || '').trim().toLowerCase();
    if (!normalizedPhrase) {
      return 0;
    }

    const phraseLevelScore = this.wordScores[normalizedPhrase];
    if (typeof phraseLevelScore === 'number' && phraseLevelScore > 0) {
      return phraseLevelScore;
    }

    if (this.categories.yours && this.categories.yours.some((entry) => (entry || '').toLowerCase() === normalizedPhrase)) {
      return 1;
    }

    let score = 0;
    const words = normalizedPhrase.split(/\s+/);
    for (const word of words) {
      let wordScore = this.wordScores[word] || 0;
      if (wordScore === 0 && this.categories.yours && this.categories.yours.includes(word)) {
        wordScore = 1;
      }
      score += wordScore;
    }
    return score;
  }

  recalculateAllCategoryScores() {
    const recalculatedScores = {};
    for (const category in this.globalCategoryMatches) {
      let categoryScore = 0;
      const matches = this.globalCategoryMatches[category];
      if (matches && Object.keys(matches).length > 0) {
        for (const [phrase, count] of Object.entries(matches)) {
          categoryScore += count * this.getPhraseScore(phrase);
        }
      }
      recalculatedScores[category] = categoryScore;
    }
    return recalculatedScores;
  }

  recalculateYoursCategory() {
    if (!this.globalCategoryMatches.yours) {
      this.globalCategoryMatches.yours = {};
    }

    const activeUserWords = new Set(this.userYoursWords.map((word) => word.toLowerCase()));

    Object.keys(this.globalCategoryMatches.yours).forEach((phrase) => {
      if (!activeUserWords.has(phrase.toLowerCase())) {
        delete this.globalCategoryMatches.yours[phrase];
      }
    });

    let totalScore = 0;
    let totalCount = 0;

    Object.entries(this.globalCategoryMatches.yours).forEach(([phrase, count]) => {
      const normalizedPhrase = phrase.toLowerCase();
      if (!activeUserWords.has(normalizedPhrase) || count <= 0) {
        delete this.globalCategoryMatches.yours[phrase];
        return;
      }

      const phraseScore = this.getPhraseScore(phrase);
      if (phraseScore <= 0) {
        delete this.globalCategoryMatches.yours[phrase];
        return;
      }

      totalCount += count;
      totalScore += phraseScore * count;
    });

    this.globalCategoryCounts.yours = totalCount;
    this.globalCategoryScores.yours = totalScore;

    this.updateYoursScoreDisplay();
    this.updateTotalDisplay();
  }

  incrementCategoryCounts(selectedCategories = [], foundCategories = []) {
    const newCounts = {};
    const newScores = {};

    const processMatches = (matches) => {
      matches.forEach((match) => {
        const phraseCounts = match.phrases || {};
        const totalItemsInCategory = Object.values(phraseCounts).reduce((sum, count) => sum + count, 0);

        newCounts[match.category] = (newCounts[match.category] || 0) + totalItemsInCategory;
        newScores[match.category] = (newScores[match.category] || 0) + (match.score || 0);

        if (!this.globalCategoryMatches[match.category]) {
          this.globalCategoryMatches[match.category] = {};
        }

        for (const [phrase, count] of Object.entries(phraseCounts)) {
          const normalizedPhrase = phrase.toLowerCase();
          this.globalCategoryMatches[match.category][normalizedPhrase] = (this.globalCategoryMatches[match.category][normalizedPhrase] || 0) + count;
        }
      });
    };

    // Only award points for newly discovered matches (found categories).
    processMatches(foundCategories);

    Object.entries(newCounts).forEach(([category, count]) => {
      this.globalCategoryCounts[category] = (this.globalCategoryCounts[category] || 0) + count;
    });
    Object.entries(newScores).forEach(([category, score]) => {
      this.globalCategoryScores[category] = (this.globalCategoryScores[category] || 0) + score;
    });

    this.setGlobalCategoryDataFn(this.globalCategoryCounts, this.globalCategoryScores);

    this.pendingCategoryScore = Object.values(newScores).reduce((sum, score) => sum + score, 0);

    this.updateTotalDisplay();
  }

  triggerPendingCategoryCelebration() {
    if (this.lastCelebratedScore === this.pendingCategoryScore) {
      return;
    }

    if (this.pendingCategoryScore && this.pendingCategoryScore > 1) {
      this.categoryCelebrationFn(Math.round(this.pendingCategoryScore));
      this.lastCelebratedScore = this.pendingCategoryScore;
      this.pendingCategoryScore = 0;
      this.updateTotalDisplay();
    }
  }

  updateCategoryCountsDisplay() {
    const correctScores = this.recalculateAllCategoryScores();
    Object.keys(this.globalCategoryCounts).forEach((category) => {
      const count = this.globalCategoryCounts[category] || 0;
      const score = correctScores[category] || 0;
      const countElement = document.getElementById(`count-${category}`);
      if (!countElement) {
        return;
      }

      if (count > 0 || score > 0) {
        const displayText = `${Math.round(score)} pts (${count})`;
        countElement.textContent = displayText;
        countElement.style.display = 'inline';
      } else {
        countElement.style.display = 'none';
      }
    });

    this.updateYoursScoreDisplay();
    this.updateTotalDisplay();
  }

  updateMetadataCountsDisplay() {
    Object.keys(this.globalMetadataCounts).forEach((metadataType) => {
      const discovered = this.globalMetadataCounts[metadataType] || 0;
      const total = this.totalMetadataCounts[metadataType] || 0;
      const countElement = document.getElementById(`metadata-count-${metadataType}`);
      if (!countElement) {
        return;
      }

      if (discovered > 0) {
        const isComplete = discovered === total;
        const checkmark = isComplete ? ' ✓' : '';
        countElement.textContent = `${discovered}/${total}${checkmark}`;
        countElement.style.display = 'inline';
      } else {
        countElement.style.display = 'none';
      }
    });

    this.updateTotalDisplay();
  }

  updateYoursScoreDisplay() {
    const count = this.globalCategoryCounts.yours || 0;
    const score = this.globalCategoryScores.yours || 0;
    const countElement = document.getElementById('count-yours');
    if (!countElement) {
      return;
    }

    countElement.textContent = `${Math.round(score)} (${count})`;
    countElement.style.display = 'inline';
  }

  updateTotalDisplay() {
    const correctScores = this.recalculateAllCategoryScores();
    const categoryPoints = Object.values(correctScores).reduce((sum, score) => sum + score, 0);

    // Metadata discovery scoring is paused; keep counts but don't award points.
    const metadataPoints = 0;
    // const metadataPoints = (this.globalMetadataCounts.authors || 0) * (this.metadataDiscoveryScores.NEW_AUTHOR || 0)
    //   + (this.globalMetadataCounts.books || 0) * (this.metadataDiscoveryScores.NEW_BOOK || 0)
    //   + (this.globalMetadataCounts.stories || 0) * (this.metadataDiscoveryScores.NEW_STORY || 0);

    const totalPoints = categoryPoints;
    const totalPointsElement = document.getElementById('metadata-count-total');
    if (totalPointsElement) {
      totalPointsElement.textContent = `${Math.round(totalPoints)} pts`;
      totalPointsElement.style.display = 'inline';
    }

    return {
      totalPoints,
      categoryPoints,
      metadataPoints
    };
  }

  trackMetadata(relatedItemObject = {}) {
    let metadataUpdated = false;

    if (relatedItemObject.author && relatedItemObject.author !== 'None' && !this.uniqueAuthors.has(relatedItemObject.author)) {
      this.uniqueAuthors.add(relatedItemObject.author);
      this.globalMetadataCounts.authors = this.uniqueAuthors.size;
      metadataUpdated = true;
      if (!this.isInitialLoad) {
        this.pendingMetadataDiscoveries.newAuthor = relatedItemObject.author;
        // this.pendingMetadataDiscoveries.totalPoints += this.metadataDiscoveryScores.NEW_AUTHOR || 0;
      }
    }

    if (relatedItemObject.title && !this.uniqueBooks.has(relatedItemObject.title)) {
      this.uniqueBooks.add(relatedItemObject.title);
      this.globalMetadataCounts.books = this.uniqueBooks.size;
      metadataUpdated = true;
      if (!this.isInitialLoad) {
        this.pendingMetadataDiscoveries.newBook = relatedItemObject.title;
        // this.pendingMetadataDiscoveries.totalPoints += this.metadataDiscoveryScores.NEW_BOOK || 0;
      }
    }

    if (relatedItemObject.story_title && relatedItemObject.story_title !== 'None' && relatedItemObject.story_title !== '' && !this.uniqueStories.has(relatedItemObject.story_title)) {
      this.uniqueStories.add(relatedItemObject.story_title);
      this.globalMetadataCounts.stories = this.uniqueStories.size;
      metadataUpdated = true;
      if (!this.isInitialLoad) {
        this.pendingMetadataDiscoveries.newStory = relatedItemObject.story_title;
        // this.pendingMetadataDiscoveries.totalPoints += this.metadataDiscoveryScores.NEW_STORY || 0;
      }
    }

    if (metadataUpdated) {
      this.updateMetadataCountsDisplay();
    }
  }

  calculateAndCelebrateMetadataScore() {
    this.pendingMetadataDiscoveries = this.#createPendingMetadataState();
    this.updateTotalDisplay();
  }

  syncYoursWords(words) {
    const newWords = Array.isArray(words) ? words : [];
    const previousWords = new Set(this.categories.yours || []);
    const newWordSet = new Set(newWords);

    previousWords.forEach((word) => {
      if (!newWordSet.has(word)) {
        const normalizedWord = word.toLowerCase();
        if (this.wordScores[normalizedWord] === 1) {
          delete this.wordScores[normalizedWord];
        }
      }
    });

    this.userYoursWords.splice(0, this.userYoursWords.length, ...newWords);
    this.categories.yours = [...newWords];

    this.recalculateYoursCategory();
  }

  getUniqueMetadataItems(metadataType) {
    if (metadataType === 'authors') {
      return Array.from(this.uniqueAuthors);
    }
    if (metadataType === 'books') {
      return Array.from(this.uniqueBooks);
    }
    if (metadataType === 'stories') {
      return Array.from(this.uniqueStories);
    }
    return [];
  }

  #createPendingMetadataState() {
    return {
      newAuthor: null,
      newBook: null,
      newStory: null,
      totalPoints: 0
    };
  }
}
