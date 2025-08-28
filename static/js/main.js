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


function getCategory(text) {
  const matches = [];
  const textLower = text.toLowerCase();
  
  // Search through each category
  for (const [categoryName, phrases] of Object.entries(categories)) {
    const matchedPhrases = [];
    
    // Check each phrase in the category
    for (const phrase of phrases) {
      if (textLower.includes(phrase.toLowerCase())) {
        matchedPhrases.push(phrase);
      }
    }
    
    // If we found matches in this category, add them to results
    if (matchedPhrases.length > 0) {
      matches.push({
        category: categoryName,
        phrases: matchedPhrases
      });
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
    img.src = 'images/bucket.jpeg';
    img.alt = categoryName;
    
    const label = document.createElement('div');
    label.className = 'categoryLabel';
    label.textContent = categoryName;
    
    bucketDiv.appendChild(img);
    bucketDiv.appendChild(label);
    bucketContainer.appendChild(bucketDiv);
  });
}

function updateCategoryBuckets(selectedCategories, foundCategories) {
  // Reset all buckets to inactive
  const allBuckets = document.querySelectorAll('.categoryBucket');
  allBuckets.forEach(bucket => {
    bucket.classList.remove('active');
    bucket.title = ''; // Clear tooltip
  });
  
  // Activate buckets for selected text categories
  selectedCategories.forEach(match => {
    const bucket = document.getElementById(`bucket-${match.category}`);
    if (bucket) {
      bucket.classList.add('active');
      bucket.title = `Selected: ${match.phrases.join(', ')}`;
    }
  });
  
  // Also activate buckets for found text categories (with different styling if desired)
  foundCategories.forEach(match => {
    const bucket = document.getElementById(`bucket-${match.category}`);
    if (bucket) {
      bucket.classList.add('active');
      // Add to existing tooltip or create new one
      const existingTitle = bucket.title;
      if (existingTitle) {
        bucket.title = `${existingTitle} | Found: ${match.phrases.join(', ')}`;
      } else {
        bucket.title = `Found: ${match.phrases.join(', ')}`;
      }
    }
  });
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

  textElement.addEventListener('mouseup', () => highlightText(textElement));

} catch (error) {
  console.error('Failed to initialize document:', error);
}
});