
//require('./node_modules/lru-cache/dist/commonjs/index');
import { EmbeddingIndex } from 'client-vector-search';

let index;

async function createIndex(jsonFilePath) {
  try {
    const response = await fetch(jsonFilePath);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    index = new EmbeddingIndex(data);
    console.log('Index loaded');
    return index;
  } catch (error) {
    console.error('Error loading index:', error);
    throw error;
  }
}

function findRelatedText(selectedText) {
  if (!index) {
    console.error('Index not initialized');
    return null;
  }
  const results = index.search(selectedText.toLowerCase());
  console.log('results', results);
  return { text: results[0]['text'], id: results[0]['id'] };
}

function animateTextChange(element, selectedText, newText, idElement, newId) {
  // Remove the highlight from the selected text
  const highlightSpan = element.querySelector('.highlight');
  if (highlightSpan) {
    const parent = highlightSpan.parentNode;
    parent.replaceChild(document.createTextNode(selectedText), highlightSpan);
  }

  // Animate the text change
  gsap.to(element, {
    duration: 1,
    text: {
      value: newText,
      delimiter: " "
    },
    ease: "power2.inOut"
  });

  // Update the ID element
  if (idElement && newId !== undefined) {
    gsap.to(idElement, {
      duration: 1,
      text: newId,
      ease: "power2.inOut"
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
try {
  // Create the index when the page loads
  await createIndex('./output-test10089.json');

  const textElement = document.getElementById('text');
  const relatedIdElement = document.getElementById('relatedId');

  textElement.addEventListener('mouseup', () => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText && selection.anchorNode.parentElement === textElement) {
      console.log('Selected text:', selectedText);

      // Highlight the selected text
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.className = 'highlight';
      range.surroundContents(span);

      // Wait for 1 second, then proceed with text change
      gsap.delayedCall(1, () => {
        const relatedItem = findRelatedText(selectedText);
        if (relatedItem) {
          console.log('relatedItem', relatedItem);
          animateTextChange(textElement, selectedText, relatedItem.text, relatedIdElement, relatedItem.id);
        } else {
          animateTextChange(textElement, selectedText, 'No related text found.', relatedIdElement, 'N/A');
        }
      });
    }
  });
} catch (error) {
  console.error('Failed to initialize:', error);
}
});