 gsap.registerPlugin(TextPlugin);

        const jsonData = [
            {"id": "1", "text": "A silver fox darts through the moonlit forest."},
            {"id": "2", "text": "The lazy cat sleeps on the warm windowsill."},
            {"id": "3", "text": "A playful dog chases a bright red ball in the park."}
        ];

        function findRelatedText(selectedText) {
            const words = selectedText.toLowerCase().split(' ');
            return jsonData.find(item => 
                words.some(word => item.text.toLowerCase().includes(word))
            );
        }

        document.addEventListener('DOMContentLoaded', () => {
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
                            animateTextChange(textElement, relatedItem.text, relatedIdElement, relatedItem.id);
                        } else {
                            animateTextChange(textElement, 'No related text found.', relatedIdElement, 'N/A');
                        }
                    });
                }
            });
        });

        function animateTextChange(element, newText, idElement, newId) {
            const tl = gsap.timeline();

            tl.to(element, {
                duration: 0.5,
                opacity: 0,
                y: -20,
                ease: "power2.inOut"
            })
            .set(element, { y: 20 })
            .to(element, {
                duration: 0.5,
                opacity: 1,
                y: 0,
                ease: "power2.out"
            })
            .to(element, {
                duration: 1,
                text: {
                    value: newText,
                    scrambleText: {
                        chars: "lowerCase",
                        revealDelay: 0.5,
                        speed: 0.3
                    }
                },
                ease: "none"
            });

            // Animate the ID change
            gsap.to(idElement, {
                duration: 0.5,
                opacity: 0,
                y: -10,
                ease: "power2.inOut",
                onComplete: () => {
                    idElement.textContent = newId;
                    gsap.to(idElement, {
                        duration: 0.5,
                        opacity: 1,
                        y: 0,
                        ease: "power2.out"
                    });
                }
            });
        }