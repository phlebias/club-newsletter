
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

const API_BASE_URL = 'http://127.0.0.1:3010';

generateBtn.addEventListener('click', async () => {
    const date = sessionDateInput.value;
    const type = sessionTypeInput.value;

    // UI Updates
    controls.classList.add('hide');
    loading.classList.remove('hide');
    outputContainer.classList.add('hide');

    try {
        const response = await fetch(`${API_BASE_URL}/api/generate`, {
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
            
            // Initialize Personal Pair Lookup
            initPairLookup(result.data);
            
            loading.classList.add('hide');
            outputContainer.classList.remove('hide');
        } else {
            alert('Error: ' + result.error);
            reset();
        }
    } catch (err) {
        console.error(err);
        alert('Failed to connect to the server. Make sure the backend is running.');
        reset();
    }
});

function initPairLookup(data) {
    const select = document.getElementById('pair-lookup-select');
    const resultsArea = document.getElementById('lookup-results-area');
    
    if (!select || !resultsArea) return;

    select.addEventListener('change', () => {
        const pairNo = select.value;
        if (!pairNo) {
            resultsArea.innerHTML = `
                <div style="text-align: center; color: #64748b; font-style: italic; padding: 20px;">
                    Select a pair above to view performance details...
                </div>
            `;
            return;
        }

        renderPairStats(pairNo, data, resultsArea);
    });
}

function renderPairStats(pairNo, data, container) {
    const { rankings, boards } = data;
    const pair = rankings.find(r => r.no === pairNo);
    if (!pair) return;

    // 1. Boards Played & Basic Stats
    const pairBoards = boards.filter(b => b.results.some(r => r.ns === pairNo || r.ew === pairNo));
    const totalBoards = pairBoards.length;
    
    let totalScoreDiff = 0;
    let totalEffDiff = 0;
    let effCount = 0;
    const tops = [];
    const bottoms = [];

    pairBoards.forEach(b => {
        const res = b.results.find(r => r.ns === pairNo || r.ew === pairNo);
        const isNS = res.ns === pairNo;
        
        // Matchpoint / Score Performance
        const pairScore = isNS ? (parseInt(res.nsScore) || -parseInt(res.ewScore) || 0) : (-parseInt(res.nsScore) || parseInt(res.ewScore) || 0);
        const fieldScores = b.results.map(r => isNS ? (parseInt(r.nsScore) || -parseInt(r.ewScore) || 0) : (-parseInt(r.nsScore) || parseInt(r.ewScore) || 0));
        const fieldAvg = fieldScores.reduce((a, b) => a + b, 0) / fieldScores.length;
        totalScoreDiff += (pairScore - fieldAvg);

        // Efficiency (Tricks vs Par)
        if (b.ddTricks && res.contract && res.contract !== 'PASS') {
            const suit = res.contract.substring(1, 2) === 'N' ? 'NT' : res.contract.substring(1, 2);
            const declarer = res.declarer;
            const parTricks = parseDD(b.ddTricks, declarer, suit);
            if (parTricks !== null) {
                totalEffDiff += (parseInt(res.tricks) - parTricks);
                effCount++;
            }
        }

        // Tops & Bottoms
        const maxField = Math.max(...fieldScores);
        const minField = Math.min(...fieldScores);
        if (pairScore === maxField && fieldScores.length > 1) tops.push(b.boardNum);
        if (pairScore === minField && fieldScores.length > 1) bottoms.push(b.boardNum);
    });

    const avgScoreDiff = (totalScoreDiff / totalBoards).toFixed(0);
    const avgEff = effCount > 0 ? (totalEffDiff / effCount).toFixed(2) : "n/a";
    const effColor = parseFloat(avgEff) > 0 ? '#4ade80' : parseFloat(avgEff) < 0 ? '#f87171' : '#cbd5e1';

    container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 10px;">
            <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                <div style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">Boards Played</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #fff;">${totalBoards}</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                <div style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">Rank</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: #fff;">${pair.rank || '—'} <span style="font-size: 0.9rem; color: #94a3b8;">(${pair.score}%)</span></div>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                <div style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">Avg vs Field</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: ${parseInt(avgScoreDiff) >= 0 ? '#4ade80' : '#f87171'};">${parseInt(avgScoreDiff) > 0 ? '+' : ''}${avgScoreDiff}</div>
            </div>
            <div style="background: rgba(255,255,255,0.03); padding: 12px; border-radius: 8px;">
                <div style="color: #94a3b8; font-size: 0.8rem; text-transform: uppercase;">HCP Efficiency</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: ${effColor};">${parseFloat(avgEff) > 0 ? '+' : ''}${avgEff}</div>
            </div>
        </div>

        <div style="margin-top: 20px;">
            <div style="margin-bottom: 8px;">
                <span style="color: #4ade80; font-weight: 700;">Tops:</span> 
                <span style="color: #cbd5e1;">${tops.length > 0 ? tops.join(', ') : 'None this session'}</span>
            </div>
            <div>
                <span style="color: #f87171; font-weight: 700;">Bottoms:</span> 
                <span style="color: #cbd5e1;">${bottoms.length > 0 ? bottoms.join(', ') : 'None this session'}</span>
            </div>
        </div>
    `;
}

function parseDD(ddStr, pos, suit) {
    if (!ddStr || ddStr.length !== 20) return null;
    const strains = ['NT', 'S', 'H', 'D', 'C'];
    const positions = ['N', 'E', 'S', 'W'];
    
    const pIdx = positions.indexOf(pos);
    const sIdx = strains.indexOf(suit);
    
    if (pIdx === -1 || sIdx === -1) return null;
    
    const hex = ddStr[pIdx * 5 + sIdx];
    return hex ? parseInt(hex, 16) : 0;
}

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
