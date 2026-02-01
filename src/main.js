
const generateBtn = document.getElementById('generate-btn');
const toggleAdminBtn = document.getElementById('toggle-admin');
const adminForm = document.getElementById('admin-form');
const loading = document.getElementById('loading');
const outputContainer = document.getElementById('output-container');
const newsletterBody = document.getElementById('newsletter-body');
const controls = document.getElementById('controls');
const copyBtn = document.getElementById('copy-btn');
const downloadPbnBtn = document.getElementById('download-pbn-btn');
const resetBtn = document.getElementById('reset-btn');

const sessionDateInput = document.getElementById('session-date');
const sessionTypeInput = document.getElementById('session-type');

let isAdminOverride = false;
let currentEventId = '';

toggleAdminBtn.addEventListener('click', () => {
    isAdminOverride = !isAdminOverride;
    adminForm.classList.toggle('hide');
    toggleAdminBtn.textContent = isAdminOverride ? 'Cancel Override' : 'Admin Override';
});

generateBtn.addEventListener('click', async () => {
    const date = sessionDateInput.value;
    const type = sessionTypeInput.value;

    // UI Updates
    controls.classList.add('hide');
    loading.classList.remove('hide');
    outputContainer.classList.add('hide');

    try {
        const response = await fetch('http://localhost:3002/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date,
                type,
                override: (isAdminOverride || date !== '') && date !== ''
            })
        });

        const result = await response.json();

        if (result.success) {
            newsletterBody.innerHTML = result.html;
            currentEventId = result.eventId;
            loading.classList.add('hide');
            outputContainer.classList.remove('hide');
        } else {
            alert('Error: ' + result.error);
            reset();
        }
    } catch (err) {
        alert('Failed to connect to the server. Make sure the backend is running.');
        reset();
    }
});

copyBtn.addEventListener('click', () => {
    const text = newsletterBody.innerText;
    navigator.clipboard.writeText(text).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = originalText, 2000);
    });
});

downloadPbnBtn.addEventListener('click', () => {
    if (currentEventId) {
        const CLUB_ID = 'liverpool';
        const url = `https://www.bridgewebs.com/cgi-bin/bwor/bw.cgi?pid=display_hands&msec=1&event=${currentEventId}&wd=1&club=${CLUB_ID}&deal_format=pbn`;
        window.open(url, '_blank');
    }
});

resetBtn.addEventListener('click', reset);

function reset() {
    controls.classList.remove('hide');
    loading.classList.add('hide');
    outputContainer.classList.add('hide');
    currentEventId = '';
}
