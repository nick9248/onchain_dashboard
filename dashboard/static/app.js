document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    // Auto refresh every 60 seconds
    setInterval(fetchData, 60000);
});

async function fetchData() {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();

        const dashboard = document.getElementById('dashboard-grid');
        const loader = document.getElementById('loader');

        if (loader) {
            dashboard.removeChild(loader);
        }

        // Remove existing cards, keep template
        Array.from(dashboard.children).forEach(child => {
            if (child.id !== 'asset-card-template') {
                dashboard.removeChild(child);
            }
        });

        const template = document.getElementById('asset-card-template');
        let latestTimestamp = '';

        // Process each asset
        Object.keys(data).forEach(asset => {
            const assetData = data[asset];
            if (!assetData.timestamp || assetData.error) return;

            const clone = template.content.cloneNode(true);

            // Header
            clone.querySelector('.asset-name').textContent = asset;
            clone.querySelector('.asset-price').textContent = `$${assetData.underlying_price || '--'}`;

            // Synthesis
            setSemanticText(clone.querySelector('.regime-val'), assetData.regime);
            setSemanticText(clone.querySelector('.direction-val'), assetData.direction);
            setSemanticText(clone.querySelector('.vol-val'), assetData.volatility);
            clone.querySelector('.vrp-val').textContent = assetData.vrp || '--';

            const recVal = clone.querySelector('.rec-val');
            recVal.textContent = assetData.primary_recommendation || '--';
            if (assetData.primary_recommendation?.toLowerCase().includes('straddle') ||
                assetData.primary_recommendation?.toLowerCase().includes('strangle')) {
                recVal.classList.add('color-purple');
            } else {
                recVal.classList.add('color-primary');
            }

            // Term bias
            setSemanticText(clone.querySelector('.near-bias-val'), assetData.near_term_bias);
            setSemanticText(clone.querySelector('.far-bias-val'), assetData.far_term_bias);

            // Metrics
            clone.querySelector('.dvol-val').textContent = assetData.dvol || '--';

            const fRateStr = assetData.funding_rate || '';
            const fEl = clone.querySelector('.funding-val');
            fEl.textContent = fRateStr || '--';
            if (fRateStr.includes('-')) fEl.classList.add('color-bearish');
            else if (fRateStr !== '--' && fRateStr !== '0.00%') fEl.classList.add('color-bullish');

            const pcVal = clone.querySelector('.pc-val');
            pcVal.textContent = `${assetData.pc_ratio || '--'} (${assetData.pc_signal || '--'})`;
            setSemanticColorOnly(pcVal, assetData.pc_signal);

            // GEX / DEX Environment
            setSemanticText(clone.querySelector('.gex-val'), assetData.gex_environment);
            setSemanticText(clone.querySelector('.dex-val'), assetData.dex_environment);

            // Support/Resistance
            clone.querySelector('.top-res-val').textContent = assetData.top_resistance ? `$${assetData.top_resistance}` : '--';
            clone.querySelector('.top-sup-val').textContent = assetData.top_support ? `$${assetData.top_support}` : '--';

            // Expiry
            clone.querySelector('.expiry-val').textContent = assetData.nearest_expiration || '--';
            clone.querySelector('.max-pain-val').textContent = assetData.max_pain ? `$${assetData.max_pain}` : '--';

            dashboard.appendChild(clone);

            if (!latestTimestamp || assetData.timestamp > latestTimestamp) {
                latestTimestamp = assetData.timestamp;
            }
        });

        // Update timestamp
        if (latestTimestamp && latestTimestamp.length === 15) {
            // format: 20260228_110751 -> 2026-02-28 11:07:51 UTC
            const formatted = `${latestTimestamp.substring(0, 4)}-${latestTimestamp.substring(4, 6)}-${latestTimestamp.substring(6, 8)} ${latestTimestamp.substring(9, 11)}:${latestTimestamp.substring(11, 13)}:${latestTimestamp.substring(13, 15)}`;
            document.getElementById('last-updated').textContent = `Data Last Refreshed: ${formatted}`;
        }

    } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        const dash = document.getElementById('dashboard-grid');
        dash.innerHTML = `<div class="loader">Error loading dashboard data.</div>`;
    }
}

function setSemanticText(element, value) {
    if (!value) {
        element.textContent = '--';
        return;
    }
    const valUpper = value.toUpperCase();
    element.textContent = valUpper;
    setSemanticColorOnly(element, valUpper);
}

function setSemanticColorOnly(element, value) {
    if (!value) return;
    const valUpper = value.toUpperCase();

    if (valUpper.includes('BULLISH') || valUpper.includes('POSITIVE') || valUpper.includes('BUY')) {
        element.classList.add('color-bullish');
    } else if (valUpper.includes('BEARISH') || valUpper.includes('NEGATIVE') || valUpper.includes('SELL')) {
        element.classList.add('color-bearish');
    } else if (valUpper.includes('NEUTRAL') || valUpper.includes('TRANSITION') || valUpper.includes('EXPLOSIVE')) {
        element.classList.add('color-neutral');
    }
}
