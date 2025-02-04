import { initializeModel, getEmbedding, EmbeddingIndex } from 'client-vector-search';
import { EfficientNetForImageClassification, env } from '@xenova/transformers';
import { gsap } from 'gsap';
import SplitType from 'split-type';
// import gsap text plugin
import { TextPlugin } from 'gsap/TextPlugin';
gsap.registerPlugin(TextPlugin);
import './effects.js';


env.localModelPath = './site-data/cache';

let index;
let data = [];
let metadata = [];
let labelCenters = [];
let umapLabelData = [];
let currentResult = { 
  "id":"PG10089_2",
  "text":"When we re-tell the old tales of our ancestors, we sit beside them over the peat-fire; and, as we glory with them in their strong heroes, and share their elemental joys and fears, we breathe the palpitating air of that old mysterious world of theirs, peopled by spirits beautiful, and strange, and awe-inspiring.",
  "book":"Elves and Heroes by Donald MacKenzie"
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
  const response1 = await fetch('site-data/author_noun_files.json');
  const fileList = await response1.json();
  const response2 = await fetch('site-data/metadata.json');
  const response3 = await fetch('site-data/labelcenters.json');
  const response4 = await fetch('site-data/umap_authortales3.json');  // has the x, y coords, not using now
  metadata = await response2.json();
  labelCenters = await response3.json();
  const umapData = await response4.json();
  umapLabelData = umapData.reduce((acc, item) => {
    acc[item.id] = {
      label: item.label,
      x: item.x,
      y: item.y,
      text: item.text,
      book: item.book,
      id: item.id,
      cluster: item.cluster.toString(),
      ignore: item.ignore
    };
    return acc;
  }, {});

  scores = labelCenters.reduce((acc, item) => {
    item['seen'] = 0;
    acc[item.cluster.toString()] = item;
    return acc;
  }, {});

  for (const file of fileList) {
    try {
      const response = await fetch("site-data/output-noun-author-embeds/" + file);
      const inputData = await response.json();
      for (const item of inputData) {
        if (typeof item.embedding === 'object') {
          data.push(item);
        }
      }
    } catch (error) {
      //console.error('Error reading file:', file, error);
      continue;
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
     // chosen['object']['x'] = umapLabelData[chosen['object']['id']]['x'];
     // chosen['object']['y'] = umapLabelData[chosen['object']['id']]['y'];
      chosen['object']['label'] = umapLabelData[chosen['object']['id']]['label'];
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
  const book_id = chosen['object']['book'];
  const label = chosen['object']['label'];
  const cluster = umapLabelData[chosen['object']['id']]['cluster'].toString();
  const score = chosen['similarity'];
  // update scores in scores -- in case of counting them for any game purposes
  if (cluster && cluster !== 'ignore') {
    console.log(scores[cluster]);
    scores[cluster]['seen'] += 1;
  }

  const author = metadata[book_id]['author'];
  const title = metadata[book_id]['title'];
  const birth = metadata[book_id]['birth'];

  return { text: text, 
    id: book_id, 
    author: author, 
    title: title, 
    birth: birth, 
    label: label,
    cluster: cluster,
    //x: chosen['object']['x'],
    //y: chosen['object']['y'],
    score: score };
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
  // Animate the text change
  if (score > 0.8) {

    console.log('high score', score);
    gsap.to(element, {
      duration: 1,
      text: {
        value: newText,
        delimiter: " "
      },
      ease: "power2.inOut"
      });
  
  } else {
    console.log('in else');
    const words = newText.split(' ');``

    element.innerHTML = '';
    words.forEach(word => {
      const span = document.createElement('span');
      span.textContent = word;
      span.className = 'word';
      element.appendChild(span);
    });

    gsap.fromTo(
      '.word',
      { 
        y: randomY(-20, 20),
        opacity: 0
      },
      {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: 'power4.out',
        onComplete: () => {
          console.log('in onComplete');
          const text = document.getElementById('text');
          text.innerHTML = formattedContent(newText);
        }
      }
    );

  }
}


function replaceRelatedInfo(relatedItemObject) {

  const relatedIdElement = document.getElementById('relatedId');
  const relatedAuthorElement = document.getElementById('relatedAuthor');
  const relatedTitleElement = document.getElementById('relatedTitle');
  //const relatedBirthElement = document.getElementById('relatedBirth');
  const relatedScoreElement = document.getElementById('relatedScore');

  /*
  if (relatedItemObject.birth === "None") {
    relatedBirthElement.textContent = "(No birth date)";
  } else {
    relatedBirthElement.textContent = "(" + relatedItemObject.birth.toString() + ")";
  }
  */

  if (relatedItemObject.author === "None") {
    relatedAuthorElement.textContent = "No author found";
  } else {
    relatedAuthorElement.textContent = relatedItemObject.author;
  }

  relatedIdElement.textContent = relatedItemObject.id;  // book_id
  relatedTitleElement.textContent = relatedItemObject.title;
  relatedScoreElement.textContent = "Score: " + relatedItemObject.score.toFixed(2).toString();
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
            const clusterScore = scores[relatedItemObject['cluster'].toString()];
            console.log('clusterScore here', clusterScore);
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

      await initializeModel("Xenova/gte-small");
      await loadFiles();
      index = await createIndex();

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