
export function randomY(x, y) {
    return Math.floor(Math.random() * (y - x + 1)) + x;
  }
  
  
  
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function showAnimationHideText(newText) {
    const animation = document.getElementById('animation');
    animation.style.display = 'flex';
    // Check if text contains ANY HTML markup - if so, don't sanitize
    if (/<[^>]+>/.test(newText)) {
      animation.innerHTML = newText;
    } else {
      animation.innerHTML = formattedContent(newText);
    }
    const text = document.getElementById('text');
    text.style.display = 'none';
    text.innerHTML = '';
  }
  
  function showTextHideAnimation(newText) {
    const animation = document.getElementById('animation');
    animation.style.display = 'none';
    animation.innerHTML = '';
    const text = document.getElementById('text');
    text.style.display = 'flex';
    // Check if text contains ANY HTML markup - if so, don't sanitize
    if (/<[^>]+>/.test(newText)) {
      text.innerHTML = newText;
    } else {
      text.innerHTML = formattedContent(newText);
    }
  }

function sanitize(string) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;',
    };
    const reg = /[&<>"'/]/ig;
    string = string.replace(/_/g,'');  // remove underscores
    string = string.replace(/,,/g,',');  // remove double commas
    string = string.replace(reg, (match)=>(map[match]));
    string = string.replace(/--/g,'&mdash;');
    return string;
  }
  
export function formattedContent(newText) {
    // If HTML tags are present, assume trusted markup and return as-is
    if (/<[^>]*>/.test(newText)) {
      return newText;
    }
    // Sanitize the input
    let safeText = sanitize(newText);
    
    // Replace straight quotes with curly quotes
    safeText = safeText.replace(/(^|[-\u2014\s(\["])'/g, "$1\u2018");  // opening singles
    safeText = safeText.replace(/'/g, "\u2019");  // closing singles & apostrophes
    safeText = safeText.replace(/(^|[-\u2014\/\[(\u2018\s])"/g, "$1\u201c");  // opening doubles
    safeText = safeText.replace(/"/g, "\u201d");  // closing doubles
    
    // Replace double hyphens with em-dashes
    safeText = safeText.replace(/--/g, "\u2014");
    
    return safeText;
  }

function bounceIn(element, newText) {
    console.log('in bounceIn', element, newText);
    let e = null;
    showAnimationHideText(newText);
   // something weird with the dom text
    gsap.delayedCall(1, async () => {
      const animation = document.getElementById('animation');
      console.log("inner html animation", animation.innerHTML);
      e = new SplitType("#animation", {type:"words"});  // adds new div underneath text though
      console.log(e.words.map(word => word.textContent));    // add the translateY to all the words with .word
      e.words.forEach(word => {
        word.style.transform = 'translateY(' + randomY(-20, 20) + 'px)';
      });
  
      gsap.to('.word', {
        opacity: 1,
        y: 0,
        duration: 0.05,
        ease: "power2.inOut",
        stagger: 0.1,
        onComplete:()=>{
          console.log('in onComplete');
          // delete the children in the div
          showTextHideAnimation(newText);
          }
        });
      });
  }
  
  
  // from https://codepen.io/webdevpuneet/pen/BabRBQa 
  function burnIn(element, newText) {
    console.log('in burnIn', element, newText);
    const animation = document.getElementById('animation');
    showAnimationHideText(newText);
    let e = new SplitType(animation, {type:"words"});  // adds new div underneath text though
    let tl = gsap.timeline({onComplete:()=>{
      console.log('in onComplete');
      // delete the children in the div
      showTextHideAnimation(newText);
      }});
    e = shuffle(e.words); // mix up
    tl.addLabel("frame1")
      .to(e, {duration:0.005, stagger:0.1, autoAlpha:1, y:5, textShadow:"0px 0px 10px rgb(0,0,0)", color:"black"})
      .addLabel("frame2")
      .to(e, {duration:0.005, stagger:0.1, autoAlpha:1, y:0, textShadow:"0px 0px 0px rgb(255, 255, 255)", color:"black"});
    }