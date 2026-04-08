// ==UserScript==
// @name         Bdjobs Extra Tools
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Adds a UI-matched Cancel Application button and extra job details on bdjobs.com job pages
// @author       You
// @match        *://*.bdjobs.com/h/details/*
// @match        *://mybdjobs.bdjobs.com/mybdjobs/apply_position_next.asp*
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
                cancelBtn.style.marginTop = '15px';
                cancelBtn.style.display = 'inline-flex';
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

                cancelApplication(jobId, formValue, cancelBtn);
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

                        // Helper to format values
                        const formatVal = (val) => val === -1 ? 'Not Defined' : val;

                        box.innerHTML = `
                            <h3 class="mb-2.5 text-[#B32D7D] text-base font-semibold"> Extra Job Details </h3>
                            <ul class="ml-6 list-none grid grid-cols-1 sm:grid sm:grid-cols-2 md:grid md:grid-cols-2 sm:gap-1 md:gap-2 gap-2 summary-des text-sm font-normal text-[#333]">
                                <li class="flex gap-1 items-center">
                                    <span class="min-w-fit">Salary Range:</span>
                                    <span class="font-semibold">Tk. ${formatVal(jd.MinimumSalary)} - ${formatVal(jd.MaximumSalary)} (Monthly)</span>
                                </li>
                                <li class="flex gap-1 items-center">
                                    <span class="min-w-fit">Age Range:</span>
                                    <span class="font-semibold">${formatVal(jd.RequiredMinimumAge)} to ${formatVal(jd.RequiredMaximumAge)} years</span>
                                </li>
                                <li class="flex gap-1 items-center">
                                    <span class="min-w-fit">Experience Range:</span>
                                    <span class="font-semibold">${formatVal(jd.RequiredMinimumExperience)} to ${formatVal(jd.RequiredMaximumExperience)} years</span>
                                </li>
                                <li class="flex gap-1 items-center">
                                    <span class="min-w-fit">Required Gender:</span>
                                    <span class="font-semibold">${jd.RequiredGender ? jd.RequiredGender : 'Not Defined'}</span>
                                </li>
                                <li class="flex gap-1 items-center">
                                    <span class="min-w-fit">Restricted Age:</span>
                                    <span class="font-semibold">${jd.DidCompanyRestrictedAge}</span>
                                </li>
                                <li class="flex gap-1 items-center">
                                    <span class="min-w-fit">Restricted Experience:</span>
                                    <span class="font-semibold">${jd.DidCompanyRestrictedExperience}</span>
                                </li>
                                <li class="flex gap-1 items-center">
                                    <span class="min-w-fit">Restricted Gender:</span>
                                    <span class="font-semibold">${jd.DidCompanyRestrictedGender}</span>
                                </li>
                            </ul>
                        `;
                    } else {
                        box.innerHTML += `<p class="text-sm text-red-500">Failed to load extra data.</p>`;
                    }
                } catch (e) {
                    box.innerHTML += `<p class="text-sm text-red-500">Error parsing extra data.</p>`;
                }
            },
            onerror: function (err) {
                box.innerHTML += `<p class="text-sm text-red-500">Network error fetching data.</p>`;
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