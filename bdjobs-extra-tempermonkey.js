// ==UserScript==
// @name         Bdjobs Extra Tools
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  Adds Cancel Application, Quick Apply, and extra job details on bdjobs.com job pages
// @icon         https://bdjobs.com/h/favicon.ico
// @author       You
// @match        *://*.bdjobs.com/*
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

    function getJobIdFromDetailsPage() {
        const urlMatch = window.location.pathname.match(/\/details\/(\d+)/);
        return urlMatch ? urlMatch[1] : null;
    }

    function sanitizeMessage(message) {
        if (!message) return 'Unknown error.';
        return String(message).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    const jobApplyCache = {
        key: null,
        data: null,
        pending: null
    };

    async function fetchJson(url, options = {}) {
        const response = await fetch(url, {
            credentials: 'include',
            ...options,
            headers: {
                Accept: 'application/json',
                ...(options.headers || {})
            }
        });

        const text = await response.text();
        let json = {};
        try {
            json = text ? JSON.parse(text) : {};
        } catch (e) {
            throw new Error('Invalid JSON response from server.');
        }

        if (!response.ok) {
            throw new Error((json && json.message) || `Request failed with status ${response.status}.`);
        }

        return json;
    }

    async function getJobApplyData(jobId, formValue) {
        const key = `${jobId}::${formValue || ''}`;

        if (jobApplyCache.data && jobApplyCache.key === key) {
            return jobApplyCache.data;
        }

        if (jobApplyCache.pending && jobApplyCache.key === key) {
            return jobApplyCache.pending;
        }

        const url = `https://testmongo.bdjobs.com/job-apply/api/JobSubsystem/JobApply?jobID=${jobId}&formValue=${encodeURIComponent(formValue || '')}`;
        jobApplyCache.key = key;
        jobApplyCache.pending = fetchJson(url)
            .then((data) => {
                jobApplyCache.data = data;
                return data;
            })
            .finally(() => {
                jobApplyCache.pending = null;
            });

        return jobApplyCache.pending;
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
            maxWidth: '420px',
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

    function showMatchingScoreModal(matchingScore, onOk) {
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(16, 24, 40, 0.55)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: '100001',
            padding: '16px'
        });

        const modal = document.createElement('div');
        Object.assign(modal.style, {
            backgroundColor: '#FCF3FA',
            border: '1px solid #E4E7EC',
            borderRadius: '14px',
            padding: '28px 26px 24px',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 18px 40px rgba(16, 24, 40, 0.22)',
            fontFamily: 'Arial, sans-serif',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
        });

        const iconWrap = document.createElement('div');
        Object.assign(iconWrap.style, {
            width: '76px',
            height: '76px',
            borderRadius: '50%',
            backgroundColor: '#3468A8',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: '18px',
            boxShadow: '0 6px 18px rgba(52, 104, 168, 0.35)'
        });

        const check = document.createElement('div');
        check.textContent = '✓';
        Object.assign(check.style, {
            color: '#fff',
            fontSize: '44px',
            fontWeight: '800',
            lineHeight: '1'
        });
        iconWrap.appendChild(check);

        const title = document.createElement('h3');
        title.textContent = 'Congratulations!';
        Object.assign(title.style, {
            margin: '0 0 10px 0',
            fontSize: '40px',
            fontWeight: '800',
            color: '#101828',
            lineHeight: '1.15',
            letterSpacing: '-0.02em'
        });

        const subtitle = document.createElement('p');
        subtitle.textContent = 'You have successfully submitted your application.';
        Object.assign(subtitle.style, {
            margin: '0 0 16px 0',
            fontSize: '20px',
            color: '#475467',
            lineHeight: '1.45',
            maxWidth: '430px'
        });

        const scoreText = document.createElement('p');
        scoreText.textContent = `Job Matching Score: ${matchingScore}%`;
        Object.assign(scoreText.style, {
            margin: '2px 0 22px 0',
            fontSize: '20px',
            fontWeight: '800',
            color: '#B32D7D',
            lineHeight: '1.2',
            letterSpacing: '-0.01em'
        });

        const okBtn = document.createElement('button');
        okBtn.textContent = 'OK';
        Object.assign(okBtn.style, {
            border: 'none',
            backgroundColor: '#B32D7D',
            color: '#fff',
            borderRadius: '8px',
            padding: '12px 34px',
            fontSize: '16px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '120px',
            boxShadow: '0 8px 20px rgba(179, 45, 125, 0.35)',
            transition: 'background-color 0.2s ease, transform 0.2s ease'
        });

        okBtn.addEventListener('mouseover', () => {
            okBtn.style.backgroundColor = '#982466';
            okBtn.style.transform = 'translateY(-1px)';
        });

        okBtn.addEventListener('mouseout', () => {
            okBtn.style.backgroundColor = '#B32D7D';
            okBtn.style.transform = 'translateY(0)';
        });

        okBtn.addEventListener('click', () => {
            overlay.remove();
            onOk();
        });

        modal.appendChild(iconWrap);
        modal.appendChild(title);
        modal.appendChild(subtitle);
        modal.appendChild(scoreText);
        modal.appendChild(okBtn);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    async function quickApply(jobId, button) {
        button.textContent = 'Applying...';
        button.disabled = true;
        button.style.opacity = '0.7';

        const formValue = getCookie('MybdjobsUserId');

        if (!jobId) {
            showToast('Error: Could not extract Job ID from URL.');
            button.textContent = 'Quick Apply';
            button.disabled = false;
            button.style.opacity = '1';
            return;
        }

        if (!formValue) {
            showToast('Error: Could not extract MybdjobsUserId cookie.');
            button.textContent = 'Quick Apply';
            button.disabled = false;
            button.style.opacity = '1';
            return;
        }

        try {
            const jobData = await getJobApplyData(jobId, formValue);

            const jobApiData = jobData && jobData.data && jobData.data.JobData ? jobData.data.JobData : null;
            const userApiData = jobData && jobData.data && jobData.data.UserData ? jobData.data.UserData : null;
            if (!(jobData.statuscode === '1' || jobData.statuscode === 1) || !jobApiData) {
                throw new Error(jobData.message || 'Unable to load job details.');
            }

            const applicantName = userApiData && userApiData.Name ? String(userApiData.Name).trim() : 'Applicant Name';

            if (!applicantName) {
                throw new Error('Could not get applicant name from JobApply user data.');
            }

            const payload = {
                expectedSalary: Number(jobApiData.MinimumSalary) || 0,
                jobId: Number(jobId),
                formValue: encodeURIComponent(formValue),
                applicantName,
                adType: 2,
                currentSalary: 0,
                isVideoResumePreferred: false,
                isVideoResumeFound: 0,
                companyName: jobApiData.CompanyName || 'Company Name',
                packageId: 0,
                package_total_limit: Number(userApiData && userApiData.Limit) || 75,
                package_total_limit_used: Number(userApiData && userApiData.Used) || 0,
                excessiveCheck: 0,
                cvStatus: ''
            };

            const applyData = await fetchJson('https://testmongo.bdjobs.com/job-apply/api/JobSubsystem/JobApplyPost', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (applyData.statuscode === '1' || applyData.statuscode === 1) {
                showToast('Job successfully applied.');
                const rawScore = applyData && applyData.data ? applyData.data.matchingScore : null;
                const matchingScore = Number.isFinite(Number(rawScore)) ? Number(rawScore) : 0;
                showMatchingScoreModal(matchingScore, () => {
                    switchToAppliedButtons();
                });
            } else {
                showToast(sanitizeMessage(applyData.message) || 'Apply failed.');
            }
        } catch (error) {
            console.error('Quick apply failed:', error);
            showToast(sanitizeMessage(error && error.message ? error.message : 'Network error occurred.'));
        } finally {
            button.textContent = 'Quick Apply';
            button.disabled = false;
            button.style.opacity = '1';
        }
    }

    function injectQuickApplyButton() {
        if (!window.location.pathname.includes('/h/details/')) return;
        if (document.getElementById('tm-quick-apply-btn')) return;

        const applyNowBtn = document.querySelector('button[data-testid="applyNowBtn"]');
        if (!applyNowBtn || !applyNowBtn.parentNode) return;

        const jobId = getJobIdFromDetailsPage();
        if (!jobId) return;

        const quickApplyBtn = document.createElement('button');
        quickApplyBtn.id = 'tm-quick-apply-btn';
        quickApplyBtn.textContent = 'Quick Apply';
        quickApplyBtn.className = 'bg-[#B32D7D] hover:bg-[#8f2464] max-h-[40px] text-white text-sm font-medium py-[11px] px-3 rounded cursor-pointer';

        quickApplyBtn.addEventListener('click', (e) => {
            e.preventDefault();
            quickApply(jobId, quickApplyBtn);
        });

        applyNowBtn.parentNode.insertBefore(quickApplyBtn, applyNowBtn.nextSibling);
    }

    function switchToAppliedButtons() {
        if (!window.location.pathname.includes('/h/details/')) return;

        const applyNowBtn = document.querySelector('button[data-testid="applyNowBtn"]');
        const quickApplyBtn = document.getElementById('tm-quick-apply-btn');

        if (!applyNowBtn || !applyNowBtn.parentNode) return;

        const alreadyAppliedBtn = document.createElement('button');
        alreadyAppliedBtn.type = 'button';
        alreadyAppliedBtn.className = 'flex items-center gap-[5px] px-4 py-2 font-medium border-2 border-[#f3e5f5] bg-[#fefbfe] text-[#a553b3] rounded sm:text-sm text-xs';
        alreadyAppliedBtn.innerHTML = '<span class="icon-check-sign"></span> Already Applied';

        applyNowBtn.parentNode.replaceChild(alreadyAppliedBtn, applyNowBtn);

        if (quickApplyBtn && quickApplyBtn.parentNode) {
            quickApplyBtn.remove();
        }

        injectCancelButton();
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
    async function cancelApplication(jobId, formValue, button) {
        button.textContent = 'Canceling...';
        button.disabled = true;
        button.style.opacity = '0.7';

        const apiUrl = `https://testmongo.bdjobs.com/job-apply/api/JobSubsystem/UndoJobApply?JobID=${jobId}&FormValue=${encodeURIComponent(formValue)}`;

        try {
            const data = await fetchJson(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            showToast(data.message || 'Action completed.');

            // If successfully canceled, reload the page after a short delay
            if (data.statuscode === '1' || data.statuscode === 1) {
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
        } catch (err) {
            console.error('API Request failed:', err);
            showToast('Network error occurred. Please try again.');
        } finally {
            button.textContent = 'Cancel Application';
            button.disabled = false;
            button.style.opacity = '1';
        }
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
                    showToast('Error: Could not extract Job ID from URL.');
                    return;
                }

                if (!formValue) {
                    showToast('Error: Could not extract MybdjobsUserId cookie.');
                    return;
                }

                // Fetch job details from API to get accurate title and company name
                getJobApplyData(jobId, formValue)
                    .then((data) => {
                        let jobTitle = 'This Job';
                        let companyName = 'This Company';

                        if (data.statuscode === '1' && data.data && data.data.JobData) {
                            jobTitle = data.data.JobData.JobTitle || jobTitle;
                            companyName = data.data.JobData.CompanyName || companyName;
                        }

                        // Show confirmation modal with fetched data
                        showConfirmationModal(jobTitle, companyName, () => {
                            cancelApplication(jobId, formValue, cancelBtn);
                        });
                    })
                    .catch((err) => {
                        console.error('Failed to fetch job details:', err);
                        // Still show modal with default values
                        showConfirmationModal('This Job', 'This Company', () => {
                            cancelApplication(jobId, formValue, cancelBtn);
                        });
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

        const formValue = getCookie('MybdjobsUserId');

        getJobApplyData(jobId, formValue)
            .then((res) => {
                if (res.statuscode === '1' && res.data && res.data.JobData) {
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
                                <span class="font-semibold">Tk. ${formatMinVal(jd.MinimumSalary)} ${jd.MaximumSalary !== -1 ? `- ${formatMaxVal(jd.MaximumSalary)}` : ''}  (Monthly)</span>
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
            })
            .catch(() => {
                box.innerHTML = `
                    <h3 class="mb-2.5 text-[#B32D7D] text-base font-semibold"> Extra Job Details </h3>
                    <p class="text-sm text-red-500">Network error fetching data.</p>
                `;
            });
    }

    // Bdjobs is likely a Single Page Application (SPA), so we use a MutationObserver
    // to detect when the UI updates and the element is rendered.
    const observer = new MutationObserver(() => {
        injectCancelButton();
        injectQuickApplyButton();

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
        injectQuickApplyButton();
        if (window.location.pathname.includes('/h/details/')) {
            const urlMatch = window.location.pathname.match(/\/details\/(\d+)/);
            if (urlMatch && urlMatch[1]) {
                fetchAndInjectExtraData(urlMatch[1]);
            }
        }
    }, 1000);

})();