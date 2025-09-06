
# Simple Embedded Text Navigator (for Fairy Tales)


## Overview

This is now an overloaded fairy tale hunter app with scoring etc. Mea culpa. The key elements are these:

* The [client-vector-search](https://github.com/yusufhilmi/client-vector-search#readme) node package.
* [Transformers.js](https://huggingface.co/docs/transformers.js/en/index) from HuggingFace.
* A very small embedding model that runs in the browser, [bge-micro](https://huggingface.co/TaylorAI/bge-micro). You need the onnx directory and the config files.  Check my folder in static/site-data/cache for the files.
* Data embedded with the model, stored in json, for instance. In this case I used fairy tale texts that I previously cleaned, sentence-tokenized, classified (to get descriptive not dialogue etc.), and enriched with some metadata.  This was the bulk of the work -- the rest is endless fiddling with UI stuff and arguing with Claude over that.

## The key tech points for a student etc.

### Your imports

```
import { initializeModel, getEmbedding, EmbeddingIndex } from 'client-vector-search';
import { env } from '@xenova/transformers';
```

### Crucial Path Setting for Model

```
env.localModelPath = './site-data/cache';
```

### Your init:

```
// Your main initialization function
async function initialize() {
  try {
      showLoading(); // Show loading before starting initialization

      await initializeModel("TaylorAI/bge-micro");
      await loadFiles();
      index = await createIndex();

```

### Load files and create Index (abbreviated versions)

```
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
  allData = await response.json();
    
  for (const item of allData) {
    if (item.embedding) {
      data.push(item); // all the data goes into it as the 'object'
    }
  }
  
}
```

### Doing a Search

```
  const queryEmbedding = await getEmbedding(selectedText.toLowerCase()); // Query embedding
  const results = await index.search(queryEmbedding, { topK: 10 });
  console.log('results of search', results);
```

If there is interest, I could add a skeleton version that doesn't have all the UI cruft Claude kept talking me into (and then being meh at).


## Running During dev

node install first. It uses parcel.

`npm install`

`npm run build` (makes dist folder)

`npm run start` (to launch the dev server)
 

## Updating the Words that Match

You can edit the file in static/site-data/category-words.json.  Then run the python script `python/word-scores-standalone.py` in the python folder to update the scores.json files. It has paths set to the static/site-data folder.

During play, you can also add words or phrases to the Yours category. They will all be default 1 point, though.

## Deployment on GH Pages If You Want

It's only a browser app, so you can just run index with the dist folder.  For doing this as a github page, you need a .github/worflows/static.yaml file with the instruction to copy dist (along with other things):

```
jobs:
  # Single deploy job since we're just deploying
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          # Upload entire repository
          path: './dist'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```


## Sources and AI Use

I used [this codepen from Chris Smith](https://codepen.io/BlogFire/pen/LYoRWLe)to get the torn edge effect.

I used a <a href="https://glif.app/@appelsiensam/glifs/cm6y4w20b0000931xnf5p8yto">glif.ai app</a> to make the medieval-cartoon style icons.

The UI code was done with extensive AI help from mostly Claude and Gemini Pro 2.5. So it's a mess and needs some cleanup (working on it).  This was a bit of a process. They still have a ways to go with understanding DOM animation and CSS, imo.

The fairy tales came from [Project Gutenberg](https://www.gutenberg.org/).


## License

CC BY.  Give me attribution for using either the data or the approach, thanks!



