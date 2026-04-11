// ==UserScript==
// @name         Bdjobs Extra Tools
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Adds a UI-matched Cancel Application button and extra job details on bdjobs.com job pages
// @icon         https://bdjobs.com/h/favicon.ico
// @author       You
// @match        *://*.bdjobs.com/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
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

    // Show confirmation modal before canceling application
    function showConfirmationModal(jobTitle, companyName, onConfirm) {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'tm-modal-overlay';
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: '100000'
        });

        // Create modal box
        const modal = document.createElement('div');
        Object.assign(modal.style, {
            position: 'relative',
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '400px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
            fontFamily: 'Arial, sans-serif'
        });

        // Modal title
        const title = document.createElement('h2');
        title.textContent = 'Confirm Cancellation';
        Object.assign(title.style, {
            margin: '0 0 16px 0',
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#333'
        });
        modal.appendChild(title);

        // Modal message
        const message = document.createElement('p');
        message.innerHTML = `Do you really want to undo the job application?<br><br><strong>${jobTitle}</strong><br>${companyName}`;
        Object.assign(message.style, {
            margin: '0 0 20px 0',
            fontSize: '14px',
            color: '#555',
            lineHeight: '1.5'
        });
        modal.appendChild(message);

        // Button container
        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex',
            gap: '10px',
            justifyContent: 'flex-end'
        });

        // No button
        const noBtn = document.createElement('button');
        noBtn.textContent = 'No';
        Object.assign(noBtn.style, {
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: '#f5f5f5',
            color: '#333',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
        });
        noBtn.addEventListener('click', () => overlay.remove());
        noBtn.addEventListener('mouseover', () => noBtn.style.backgroundColor = '#eee');
        noBtn.addEventListener('mouseout', () => noBtn.style.backgroundColor = '#f5f5f5');
        buttonContainer.appendChild(noBtn);

        // Yes button
        const yesBtn = document.createElement('button');
        yesBtn.textContent = 'Yes';
        Object.assign(yesBtn.style, {
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '500',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: '#B32D7D',
            color: '#fff',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
        });
        yesBtn.addEventListener('click', () => {
            overlay.remove();
            onConfirm();
        });
        yesBtn.addEventListener('mouseover', () => yesBtn.style.backgroundColor = '#8f2464');
        yesBtn.addEventListener('mouseout', () => yesBtn.style.backgroundColor = '#B32D7D');
        buttonContainer.appendChild(yesBtn);

        modal.appendChild(buttonContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
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
            onload: function (response) {
                button.textContent = 'Cancel Application';
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
            onerror: function (err) {
                console.error("API Request failed:", err);
                button.textContent = 'Cancel Application';
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

        const filledUiClass = 'flex items-center gap-[5px] px-4 py-2 font-medium border border-[#B32D7D] bg-[#B32D7D] text-white rounded sm:text-sm text-xs hover:bg-[#8f2464]';

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
        }

        if (targetElement) {
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'tm-cancel-app-btn';
            cancelBtn.textContent = 'Cancel Application';

            // Use a filled style so the action looks like a regular button instead of outlined.
            cancelBtn.className = filledUiClass;

            if (isApplyNextPage) {
                cancelBtn.style.backgroundColor = '#B32D7D';
                cancelBtn.style.border = '1px solid #B32D7D';
                cancelBtn.style.color = '#fff';
                cancelBtn.style.padding = '8px 16px';
                cancelBtn.style.borderRadius = '6px';
                cancelBtn.style.fontSize = '14px';
                cancelBtn.style.fontWeight = '500';
                cancelBtn.style.lineHeight = '1.2';
                cancelBtn.style.marginTop = '15px';
                cancelBtn.style.display = 'inline-flex';
                cancelBtn.style.alignItems = 'center';
                cancelBtn.style.gap = '5px';
            }

            cancelBtn.style.cursor = 'pointer';

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

                // Fetch job details from API to get accurate title and company name
                const apiUrl = `https://testmongo.bdjobs.com/job-apply/api/JobSubsystem/JobApply?jobID=${jobId}`;
                GM_xmlhttpRequest({
                    method: "GET",
                    url: apiUrl,
                    headers: {
                        "Accept": "application/json"
                    },
                    onload: function (response) {
                        let jobTitle = 'This Job';
                        let companyName = 'This Company';

                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.statuscode === "1" && data.data && data.data.JobData) {
                                jobTitle = data.data.JobData.JobTitle || jobTitle;
                                companyName = data.data.JobData.CompanyName || companyName;
                            }
                        } catch (e) {
                            console.error("Error parsing job data:", e);
                        }

                        // Show confirmation modal with fetched data
                        showConfirmationModal(jobTitle, companyName, () => {
                            cancelApplication(jobId, formValue, cancelBtn);
                        });
                    },
                    onerror: function (err) {
                        console.error("Failed to fetch job details:", err);
                        // Still show modal with default values
                        showConfirmationModal('This Job', 'This Company', () => {
                            cancelApplication(jobId, formValue, cancelBtn);
                        });
                    }
                });
            });

            // Insert exactly after the targeted element
            targetElement.parentNode.insertBefore(cancelBtn, targetElement.nextSibling);
        }
    }

    // Function to fetch and inject extra job data
    function fetchAndInjectExtraData(jobId) {
        // Prevent duplicate injections
        if (document.getElementById('tm-extra-data-box')) return;

        const allSection = document.getElementById('allSection');
        if (!allSection) return;

        // Create a placeholder box to prevent multiple API calls while waiting
        const box = document.createElement('div');
        box.id = 'tm-extra-data-box';
        box.className = 'mb-2.5 text-sm font-normal text-[#333] rounded border-[0.5px] border-[#DDDDDD] bg-[#F4F4F4] flex flex-col px-5 py-4 mt-4';
        box.innerHTML = `
            <h3 class="mb-2.5 text-[#B32D7D] text-base font-semibold"> Extra Job Details </h3>
            <p class="text-sm">Loading...</p>
        `;

        // Insert right after the allSection element
        allSection.parentNode.insertBefore(box, allSection.nextSibling);

        const apiUrl = `https://testmongo.bdjobs.com/job-apply/api/JobSubsystem/JobApply?jobID=${jobId}`;

        GM_xmlhttpRequest({
            method: "GET",
            url: apiUrl,
            headers: {
                "Accept": "application/json"
            },
            onload: function (response) {
                try {
                    const res = JSON.parse(response.responseText);
                    if (res.statuscode === "1" && res.data && res.data.JobData) {
                        const jd = res.data.JobData;

                        const infinitySpan = '<span style="font-size: 18px;">&infin;</span>';

                        // Helper to format values (returns HTML with infinity symbol in larger font)
                        const formatMaxVal = (val) => val === -1 ? infinitySpan : val;
                        const formatMinVal = (val) => val === -1 ? '0' : val;

                        // Helper to format gender abbreviations to full names
                        const formatGender = (gender) => {
                            if (!gender || !String(gender).trim()) return 'Not specified';
                            return gender
                                .split(',')
                                .map(g => {
                                    const trimmed = g.trim();
                                    if (trimmed === 'M') return 'Male';
                                    if (trimmed === 'F') return 'Female';
                                    return trimmed;
                                })
                                .join(' and ');
                        };

                        box.innerHTML = `
                            <h3 class="mb-2.5 text-[#B32D7D] text-base font-semibold"> Extra Job Details </h3>
                            <ul class="ml-6 list-none grid grid-cols-1 sm:grid sm:grid-cols-2 md:grid md:grid-cols-2 sm:gap-1 md:gap-2 gap-2 summary-des text-sm font-normal text-[#333]">
                                <li class="flex gap-1 items-center">
                                    <span class="min-w-fit">Salary Range:</span>
                                    <span class="font-semibold">Tk. ${formatMinVal(jd.MinimumSalary)} - ${formatMaxVal(jd.MaximumSalary)} (Monthly)</span>
                                </li>
                                <li class="flex gap-1 items-center">
                                    <span class="min-w-fit">Required Gender:</span>
                                    <span class="font-semibold">${formatGender(jd.RequiredGender)}</span>
                                </li>
                                <li class="flex gap-1 items-center">
                                    <span class="min-w-fit">Experience Range:</span>
                                    <span class="font-semibold">${formatMinVal(jd.RequiredMinimumExperience)} to ${formatMaxVal(jd.RequiredMaximumExperience)} years</span>
                                </li>
                                <li class="flex gap-1 items-center">
                                    <span class="min-w-fit">Age Range:</span>
                                    <span class="font-semibold">${formatMinVal(jd.RequiredMinimumAge)} to ${formatMaxVal(jd.RequiredMaximumAge)} years</span>
                                </li>
                            </ul>
                        `;
                    } else {
                        box.innerHTML = `
                            <h3 class="mb-2.5 text-[#B32D7D] text-base font-semibold"> Extra Job Details </h3>
                            <p class="text-sm text-red-500">Failed to load extra data.</p>
                        `;
                    }
                } catch (e) {
                    box.innerHTML = `
                        <h3 class="mb-2.5 text-[#B32D7D] text-base font-semibold"> Extra Job Details </h3>
                        <p class="text-sm text-red-500">Error parsing extra data.</p>
                    `;
                }
            },
            onerror: function (err) {
                box.innerHTML = `
                    <h3 class="mb-2.5 text-[#B32D7D] text-base font-semibold"> Extra Job Details </h3>
                    <p class="text-sm text-red-500">Network error fetching data.</p>
                `;
            }
        });
    }

    // Bdjobs is likely a Single Page Application (SPA), so we use a MutationObserver
    // to detect when the UI updates and the element is rendered.
    const observer = new MutationObserver(() => {
        injectCancelButton();

        // Also try to inject the extra data box if on the details page
        if (window.location.pathname.includes('/h/details/')) {
            const urlMatch = window.location.pathname.match(/\/details\/(\d+)/);
            if (urlMatch && urlMatch[1]) {
                fetchAndInjectExtraData(urlMatch[1]);
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Also try running it once on initial load just in case
    setTimeout(() => {
        injectCancelButton();
        if (window.location.pathname.includes('/h/details/')) {
            const urlMatch = window.location.pathname.match(/\/details\/(\d+)/);
            if (urlMatch && urlMatch[1]) {
                fetchAndInjectExtraData(urlMatch[1]);
            }
        }
    }, 1000);

})();