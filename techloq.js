// --- Self-contained Techloq setup guide ---

(() => {
    'use strict';

    // This function runs once the main page content is loaded.
    document.addEventListener('DOMContentLoaded', () => {
        const setupStatus = localStorage.getItem('techloqSetupStatus');

        // If the user has already completed the setup flow, do nothing.
        if (setupStatus === 'no' || setupStatus === 'yes_configured') {
            return;
        }

        // --- STYLES ---
        // Inject the CSS for the modal directly into the page's <head>.
        // This keeps everything in one file.
        const modalStyles = `
            .techloq-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(5px);
                z-index: 2000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                animation: fadeIn 0.3s forwards;
            }

            .techloq-modal-content {
                background-color: #161616; /* --surface-1 */
                color: #f1f1f1; /* --text-primary */
                padding: 30px 40px;
                border-radius: 8px; /* --border-radius */
                border: 1px solid #303030; /* --border-color */
                width: 90%;
                max-width: 500px;
                text-align: center;
                box-shadow: 0 5px 30px rgba(0, 0, 0, 0.5);
                transform: scale(0.95);
                animation: scaleUp 0.3s 0.1s forwards;
            }

            .techloq-modal-content h2 {
                font-size: 1.6rem;
                margin-bottom: 15px;
            }

            .techloq-modal-content p {
                color: #aaa; /* --text-secondary */
                line-height: 1.6;
                margin-bottom: 25px;
            }

            .techloq-modal-buttons {
                display: flex;
                gap: 15px;
                justify-content: center;
            }

            .techloq-modal-buttons button {
                padding: 10px 20px;
                font-size: 1rem;
                font-weight: 500;
                border: none;
                border-radius: 8px; /* --border-radius */
                cursor: pointer;
                transition: filter 0.2s, transform 0.2s;
            }
             .techloq-modal-buttons button:hover {
                filter: brightness(1.1);
                transform: translateY(-2px);
            }

            .techloq-btn-primary {
                background-color: #3ea6ff; /* --accent-color */
                color: white;
            }

            .techloq-btn-secondary {
                background-color: #272727; /* --surface-2 */
                color: #f1f1f1; /* --text-primary */
            }
            
            @keyframes fadeIn {
                to { opacity: 1; }
            }
            @keyframes scaleUp {
                to { transform: scale(1); }
            }
        `;

        // --- HTML TEMPLATES ---
        const initialPromptHTML = `
            <div class="techloq-modal-overlay" id="techloq-modal">
                <div class="techloq-modal-content">
                    <h2>Do you use a Techloq filter?</h2>
                    <p>To improve your experience, this site can use a script to automatically bypass Techloq's block page for YouTube videos.</p>
                    <div class="techloq-modal-buttons">
                        <button id="techloq-no-btn" class="techloq-btn-secondary">No, I don't</button>
                        <button id="techloq-yes-btn" class="techloq-btn-primary">Yes, help me set it up</button>
                    </div>
                </div>
            </div>
        `;

        const followupPromptHTML = `
            <div class="techloq-modal-overlay" id="techloq-modal">
                <div class="techloq-modal-content">
                    <h2>Redirector Script Setup</h2>
                    <p>Did you successfully complete the installation and setup steps for the redirector script?</p>
                    <div class="techloq-modal-buttons">
                        <button id="techloq-goback-btn" class="techloq-btn-secondary">No, take me back</button>
                        <button id="techloq-finished-btn" class="techloq-btn-primary">Yes, I'm finished</button>
                    </div>
                </div>
            </div>
        `;

        // --- LOGIC ---
        // Function to inject the styles into the document head
        const injectStyles = () => {
            const styleElement = document.createElement('style');
            styleElement.id = 'techloq-modal-styles';
            styleElement.textContent = modalStyles;
            document.head.appendChild(styleElement);
        };

        // Function to create and show the modal
        const showModal = (html) => {
            // Ensure styles are present
            if (!document.getElementById('techloq-modal-styles')) {
                injectStyles();
            }
            // Add the modal HTML to the body
            document.body.insertAdjacentHTML('beforeend', html);
        };

        // Function to remove the modal from the DOM
        const closeModal = () => {
            const modal = document.getElementById('techloq-modal');
            if (modal) {
                modal.remove();
            }
        };

        // Determine which modal to show based on the user's status
        if (setupStatus === null) {
            // --- First-time user ---
            showModal(initialPromptHTML);

            document.getElementById('techloq-no-btn').addEventListener('click', () => {
                localStorage.setItem('techloqSetupStatus', 'no');
                closeModal();
            });

            document.getElementById('techloq-yes-btn').addEventListener('click', () => {
                localStorage.setItem('techloqSetupStatus', 'yes_unconfigured');
                // Redirect to the setup page
                window.location.href = 'watch.html';
            });

        } else if (setupStatus === 'yes_unconfigured') {
            // --- User has opted-in but not confirmed setup ---
            showModal(followupPromptHTML);

            document.getElementById('techloq-goback-btn').addEventListener('click', () => {
                // Take them back to the setup page
                window.location.href = 'watch.html';
            });

            document.getElementById('techloq-finished-btn').addEventListener('click', () => {
                localStorage.setItem('techloqSetupStatus', 'yes_configured');
                closeModal();
            });
        }
    });
})();
