// ==UserScript==
// @name         Bdjobs Cancel Application
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Adds a "Cancel Application" button next to the "Already Applied" button on bdjobs.com and apply_position_next page
// @author       You
// @match        *://*.bdjobs.com/h/details/*
// @match        *://mybdjobs.bdjobs.com/mybdjobs/apply_position_next.asp*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // Helper function to extract a specific cookie by name
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // Helper function to show a temporary toast message
    function showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#333',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            zIndex: '99999',
            fontFamily: 'sans-serif',
            fontSize: '14px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            opacity: '0',
            transition: 'opacity 0.3s ease-in-out'
        });

        document.body.appendChild(toast);

        // Trigger reflow for fade-in
        setTimeout(() => { toast.style.opacity = '1'; }, 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // API Call to cancel the application
    function cancelApplication(jobId, formValue, button) {
        button.textContent = "Canceling...";
        button.disabled = true;
        button.style.opacity = '0.7';

        const apiUrl = `https://testmongo.bdjobs.com/job-apply/api/JobSubsystem/UndoJobApply?JobID=${jobId}&FormValue=${encodeURIComponent(formValue)}`;

        // Using GM_xmlhttpRequest to avoid any potential Cross-Origin (CORS) issues
        GM_xmlhttpRequest({
            method: "POST",
            url: apiUrl,
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json"
            },
            onload: function(response) {
                button.textContent = "Cancel Application";
                button.disabled = false;
                button.style.opacity = '1';

                try {
                    const data = JSON.parse(response.responseText);
                    showToast(data.message || "Action completed.");

                    // If successfully canceled, reload the page after a short delay
                    if (data.statuscode === "1" || data.statuscode === 1) {
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    }
                } catch (e) {
                    console.error("Error parsing JSON response:", e);
                    showToast("Unexpected response from server.");
                }
            },
            onerror: function(err) {
                console.error("API Request failed:", err);
                button.textContent = "Cancel Application";
                button.disabled = false;
                button.style.opacity = '1';
                showToast("Network error occurred. Please try again.");
            }
        });
    }

    // Function to find the original button and inject ours
    function injectCancelButton() {
        // Prevent adding multiple buttons
        if (document.getElementById('tm-cancel-app-btn')) return;

        const isDetailsPage = window.location.pathname.includes('/h/details/');
        const isApplyNextPage = window.location.pathname.includes('/apply_position_next.asp');

        let targetElement = null;
        let jobId = null;

        // Common danger button styles
        let stylingOptions = {
            color: '#ef4444',            // Red text
            backgroundColor: '#fef2f2',  // Light red background
            borderColor: '#fca5a5',      // Red border
            borderWidth: '2px',
            borderStyle: 'solid',
            borderRadius: '4px',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
        };

        if (isDetailsPage) {
            // Logic for the /h/details/ page
            const buttons = Array.from(document.querySelectorAll('button'));
            targetElement = buttons.find(btn =>
                btn.textContent.trim().toLowerCase() === 'already applied' ||
                btn.className.includes('text-[#a553b3]')
            );
            const urlMatch = window.location.pathname.match(/\/details\/(\d+)/);
            jobId = urlMatch ? urlMatch[1] : null;

        } else if (isApplyNextPage) {
            // Logic for the /apply_position_next.asp page
            targetElement = document.querySelector('div.adeadline');
            const urlParams = new URLSearchParams(window.location.search);
            jobId = urlParams.get('jpId');
            stylingOptions.marginTop = '15px';
            stylingOptions.display = 'inline-block';
        }

        if (targetElement) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'tm-cancel-app-btn';
            cancelBtn.textContent = 'Cancel Application';

            // Try copying native classes if on details page
            if (isDetailsPage && targetElement.className) {
                cancelBtn.className = targetElement.className;
            }

            // Apply our custom styles
            Object.assign(cancelBtn.style, stylingOptions);

            // Handle the click event
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();

                // Extract FormValue from cookies
                const formValue = getCookie('MybdjobsUserId');

                if (!jobId) {
                    showToast("Error: Could not extract Job ID from URL.");
                    return;
                }

                if (!formValue) {
                    showToast("Error: Could not extract MybdjobsUserId cookie.");
                    return;
                }

                cancelApplication(jobId, formValue, cancelBtn);
            });

            // Insert exactly after the targeted element
            targetElement.parentNode.insertBefore(cancelBtn, targetElement.nextSibling);
        }
    }

    // Bdjobs is likely a Single Page Application (SPA), so we use a MutationObserver
    // to detect when the UI updates and the element is rendered.
    const observer = new MutationObserver(() => {
        injectCancelButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Also try running it once on initial load just in case
    setTimeout(injectCancelButton, 1000);

})();
