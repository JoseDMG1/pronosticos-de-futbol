let currentPredictions = null;

document.addEventListener("DOMContentLoaded", () => {
    fetchData('today');
    window.setInterval(() => fetchData('today'), 60_000);
    setupMusicPlayer();
    setupTabsAndView();
    setupStatusFilter();
});

function setupStatusFilter() {
    const updateFilters = () => {
        document.getElementById('reset-filters').disabled =
            document.querySelector('input[name="match-status"]:checked').value === 'all' &&
            document.querySelector('input[name="match-league"]:checked').value === 'all';
        if (currentPredictions) renderPredictions(currentPredictions);
    };
    document.querySelectorAll('.match-filters input').forEach(input => {
        input.addEventListener('change', updateFilters);
    });
    document.getElementById('reset-filters').addEventListener('click', () => {
        document.querySelector('input[name="match-status"][value="all"]').checked = true;
        document.querySelector('input[name="match-league"][value="all"]').checked = true;
        document.querySelector('input[name="match-status"][value="all"]').focus();
        updateFilters();
    });
}

function setupTabsAndView() {
    const gridBtn = document.getElementById('toggle-grid');
    const tableBtn = document.getElementById('toggle-table');
    const container = document.getElementById('predictions-container');

    if(gridBtn && tableBtn) {
        gridBtn.addEventListener('click', () => {
            gridBtn.classList.add('active');
            tableBtn.classList.remove('active');
            container.classList.remove('table-view');
            container.classList.add('grid-view');
        });

        tableBtn.addEventListener('click', () => {
            tableBtn.classList.add('active');
            gridBtn.classList.remove('active');
            container.classList.remove('grid-view');
            container.classList.add('table-view');
        });
    }
}

function setupMusicPlayer() {
    const music = document.getElementById('bg-music');
    const musicBtn = document.getElementById('music-toggle');
    
    // Auto-play attempt on first user interaction anywhere on the document
    document.body.addEventListener('click', () => {
        if (music.paused && !musicBtn.classList.contains('user-paused')) {
            music.volume = 0.3; // Low volume for background
            music.play().then(() => {
                musicBtn.textContent = '🎵';
            }).catch(e => console.log("Audio play blocked by browser"));
        }
    }, { once: true });

    musicBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (music.paused) {
            music.volume = 0.3;
            music.play();
            musicBtn.textContent = '🎵';
            musicBtn.classList.remove('user-paused');
        } else {
            music.pause();
            musicBtn.textContent = '🔇';
            musicBtn.classList.add('user-paused');
        }
    });
}

async function fetchData(dayStr = 'today') {
    const container = document.getElementById('predictions-container');
    if(container) container.innerHTML = '<div class="prediction-card glass-card skeleton" style="height: 250px;"></div>';

    try {
        const timestamp = new Date().getTime();
        let predData = null;
        
        const predRes = await fetch(`data/predictions_${dayStr}.json?t=${timestamp}`);
        if (predRes.ok) {
            predData = await predRes.json();
        } else if (dayStr === 'today') {
            const fbRes = await fetch(`data/predictions.json?t=${timestamp}`);
            if (fbRes.ok) predData = await fbRes.json();
        }

        if (predData && predData.matches) {
            predData.matches = predData.matches.filter(match =>
                match.status_short ? ['NS', '1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'FT', 'AET', 'PEN'].includes(match.status_short) :
                ['Pending', 'In Play', 'Finished'].includes(match.status)
            );
            currentPredictions = predData;
            document.getElementById('current-date').textContent = predData.date || dayStr;
            renderPredictions(predData);
        } else {
            renderError('predictions-container', `Todavía no hay pronósticos disponibles para ${dayStr}.`);
            document.getElementById('botd-container').innerHTML = '';
            document.getElementById('bet-of-the-day').style.display = 'none';
        }

    } catch (error) {
        if (window.OFFLINE_PREDICTIONS?.matches) {
            currentPredictions = window.OFFLINE_PREDICTIONS;
            currentPredictions.matches = currentPredictions.matches.filter(match =>
                match.status_short ? ['NS', '1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'FT', 'AET', 'PEN'].includes(match.status_short) :
                ['Pending', 'In Play', 'Finished'].includes(match.status)
            );
            document.getElementById('current-date').textContent = currentPredictions.date || dayStr;
            renderPredictions(currentPredictions);
        } else {
            console.error("Error loading saved predictions:", error);
            renderError('predictions-container', 'No se pudieron cargar los pronósticos guardados.');
        }
    }
}

function calculateValue(match) {
    if (!match.odds || match.odds.home === 'N/A') return 0;
    
    // Convert e.g. "45%" to 0.45
    const pHome = parseFloat(match.percent_home) / 100 || 0;
    const pDraw = parseFloat(match.percent_draw) / 100 || 0;
    const pAway = parseFloat(match.percent_away) / 100 || 0;
    
    const oHome = parseFloat(match.odds.home) || 0;
    const oDraw = parseFloat(match.odds.draw) || 0;
    const oAway = parseFloat(match.odds.away) || 0;
    
    const valHome = pHome * oHome;
    const valDraw = pDraw * oDraw;
    const valAway = pAway * oAway;
    
    // Find highest value > 1.0 (expected value > 1)
    return Math.max(valHome, valDraw, valAway);
}

function renderPredictions(data) {
    const container = document.getElementById('predictions-container');
    const botdContainer = document.getElementById('botd-container');
    const botdSection = document.getElementById('bet-of-the-day');
    const dateBadge = document.getElementById('current-date');

    const selectedStatus = document.querySelector('input[name="match-status"]:checked')?.value || 'all';
    const selectedLeague = document.querySelector('input[name="match-league"]:checked')?.value || 'all';
    const totalMatches = data.matches.length;
    const liveStatuses = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'];
    const finishedStatuses = ['FT', 'AET', 'PEN'];
    data = {
        ...data,
        matches: data.matches.filter(match => {
            const isLive = match.status_short ? liveStatuses.includes(match.status_short) : match.status === 'In Play';
            const isFinished = match.status_short ? finishedStatuses.includes(match.status_short) : match.status === 'Finished';
            const leagueMatches = selectedLeague === 'all' || String(match.league).trim().toLowerCase() === selectedLeague;
            const statusMatches = selectedStatus === 'all' ||
                (selectedStatus === 'live' && isLive) ||
                (selectedStatus === 'finished' && isFinished) ||
                (selectedStatus === 'pending' && !isLive && !isFinished);
            return leagueMatches && statusMatches;
        })
    };
    
    container.innerHTML = '';
    botdContainer.innerHTML = '';
    botdSection.style.display = 'none';
    document.getElementById('filter-results').textContent = `${data.matches.length} de ${totalMatches} partidos coinciden con tus filtros`;
    
    if (data.date) {
        const [year, month, day] = data.date.split('-').map(Number);
        const localDate = new Date(year, month - 1, day);
        dateBadge.textContent = localDate.toLocaleDateString('es-PE', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }

    if (!data.matches || data.matches.length === 0) {
        const message = totalMatches ? 'No hay partidos con esta combinación. Prueba otra opción o restablece los filtros.' : 'Todavía no hay partidos disponibles para hoy.';
        const empty = document.createElement('p');
        empty.className = 'filter-empty';
        empty.textContent = message;
        container.appendChild(empty);
        return;
    }

    // Find Bet of the Day (highest value bet, or highest confidence)
    let bestMatch = null;
    let bestValue = 0;
    
    data.matches.forEach(match => {
        const val = calculateValue(match);
        if (val > bestValue) {
            bestValue = val;
            bestMatch = match;
        }
    });

    // If no good value bet, just take highest home/away probability
    if (!bestMatch) {
        let maxProb = 0;
        data.matches.forEach(match => {
            const prob = Math.max(parseFloat(match.percent_home)||0, parseFloat(match.percent_away)||0);
            if (prob > maxProb) { maxProb = prob; bestMatch = match; }
        });
    }

    if (bestMatch) {
        botdSection.style.display = 'block';
        botdContainer.appendChild(createMatchCard(bestMatch, true));
    }

    data.matches.forEach(match => {
        if (match !== bestMatch) {
            container.appendChild(createMatchCard(match, false));
        }
    });
}

function createMatchCard(match, isVIP) {
    const isFinished = match.status_short ? ['FT', 'AET', 'PEN'].includes(match.status_short) : match.status === 'Finished';
    const statusClass = match.status === 'In Play' ? 'live' : 'pending';
    
    let actualResultsHtml = '';
    if (isFinished) {
        let resultIcon = '';
        if (match.prediction_available !== false && ['1', 'X', '2', '1X', 'X2', '12'].includes(match.short_tip)
            && Number.isFinite(match.home_goals) && Number.isFinite(match.away_goals)
            && match.status_short === 'FT') {
            const result = match.home_goals > match.away_goals ? '1' : match.home_goals < match.away_goals ? '2' : 'X';
            const matched = match.short_tip.includes(result);
            resultIcon = `<p>Pronóstico guardado: <strong>${match.short_tip}</strong> · Resultado: <strong>${result}</strong><br>${matched ? '✓ Coincide con el resultado' : '✕ No coincide con el resultado'}</p>`;
        } else if (match.short_tip && ['AET', 'PEN'].includes(match.status_short)) {
            resultIcon = '<p>Comparación automática no disponible: partido con prórroga o penaltis.</p>';
        }
        actualResultsHtml = `
            <div style="margin-top: 1rem; text-align: center; font-size: 0.9rem; color: var(--text-secondary);">
                Marcador final: <span style="color:var(--text-primary); font-weight: bold;">${match.home_goals ?? '—'} - ${match.away_goals ?? '—'}</span> ${resultIcon}
            </div>
        `;
    }

    let oddsHtml = '';
    if (match.odds && match.odds.home !== 'N/A') {
        const pHome = parseFloat(match.percent_home)/100;
        const pDraw = parseFloat(match.percent_draw)/100;
        const pAway = parseFloat(match.percent_away)/100;
        
        const isValHome = (pHome * match.odds.home) > 1.1;
        const isValDraw = (pDraw * match.odds.draw) > 1.1;
        const isValAway = (pAway * match.odds.away) > 1.1;

        oddsHtml = `
            <div class="odds-container">
                <div class="odds-box">
                    <span class="odds-label">1 (Home)</span>
                    <span class="odds-value ${isValHome ? 'value-bet' : ''}">${match.odds.home} ${isValHome ? '🌟' : ''}</span>
                </div>
                <div class="odds-box">
                    <span class="odds-label">X (Draw)</span>
                    <span class="odds-value ${isValDraw ? 'value-bet' : ''}">${match.odds.draw} ${isValDraw ? '🌟' : ''}</span>
                </div>
                <div class="odds-box">
                    <span class="odds-label">2 (Away)</span>
                    <span class="odds-value ${isValAway ? 'value-bet' : ''}">${match.odds.away} ${isValAway ? '🌟' : ''}</span>
                </div>
            </div>
        `;
    }

    const probHtml = match.prediction_available === false ? '<p>Probabilidades no disponibles.</p>' : `
        <div class="prob-container" style="margin-top: 1.5rem; font-size: 0.85rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                <span style="color:var(--text-secondary)">Local (${match.percent_home})</span>
                <span style="color:var(--text-secondary)">Empate (${match.percent_draw})</span>
                <span style="color:var(--text-secondary)">Visitante (${match.percent_away})</span>
            </div>
            <div style="display: flex; height: 6px; border-radius: 3px; overflow: hidden; background: rgba(255,255,255,0.1);">
                <div style="width: ${match.percent_home}; background: var(--accent-1);"></div>
                <div style="width: ${match.percent_draw}; background: var(--text-secondary);"></div>
                <div style="width: ${match.percent_away}; background: var(--accent-3);"></div>
            </div>
        </div>
    `;
    
    // Short tip logic
    const shortTip = match.short_tip || (isFinished ? 'Histórico no recuperado' : 'Sin pronóstico');
    const tipBadge = isFinished ? '' : `<div class="short-tip-wrapper"><div class="short-tip-badge">${shortTip}</div></div>`;

    const card = document.createElement('div');
    card.className = `prediction-card glass-card ${isVIP ? 'vip-card' : ''}`;
    card.innerHTML = `
        ${tipBadge}
        <div class="status-badge ${isFinished ? 'finished' : statusClass}">${isFinished ? 'Finalizado' : match.status === 'In Play' ? 'En juego' : 'Pendiente'}</div>
        <div class="match-header league-badge">
            ${match.league}
        </div>
        <div class="match-teams" style="display:flex; justify-content:space-between; align-items:center;">
            <div class="team" style="text-align:center;">
                <img src="${match.home_logo}" alt="${match.home_team}" style="width:40px; height:40px;" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjMzMzIi8+PC9zdmc+'">
                <span class="team-name" style="display:block; margin-top:0.5rem; font-weight:bold;">${match.home_team}</span>
            </div>
            <div class="vs" style="font-weight:900; color:var(--text-secondary);">VS</div>
            <div class="team" style="text-align:center;">
                <img src="${match.away_logo}" alt="${match.away_team}" style="width:40px; height:40px;" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjMzMzIi8+PC9zdmc+'">
                <span class="team-name" style="display:block; margin-top:0.5rem; font-weight:bold;">${match.away_team}</span>
            </div>
        </div>
        ${probHtml}
        ${oddsHtml}
        <div class="ai-advice" style="margin-top: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.05); border-radius: 8px; text-align: center;">
            <strong style="color: var(--accent-2); font-size: 0.8rem; text-transform: uppercase;">${isFinished ? 'Pronóstico original guardado' : 'Consejo de API-Football'}</strong><br>
            <span style="font-size: 0.95rem; font-weight: 600;">${isFinished && !match.short_tip ? 'El pronóstico anterior no pudo recuperarse. No se generará otro después del resultado.' : translateAdvice(match.advice)}</span>
            ${match.fetched_at ? `<p>Consultado: ${new Date(match.fetched_at).toLocaleString('es-PE', {timeZone: 'America/Lima'})} (Perú)</p>` : ''}
        </div>
        ${actualResultsHtml}
    `;
    return card;
}

function translateAdvice(advice = '') {
    return String(advice)
        .replace(/Double chance\s*:/gi, 'Doble oportunidad:')
        .replace(/Win or draw/gi, 'Victoria o empate')
        .replace(/Draw or win/gi, 'Empate o victoria')
        .replace(/Over\s+(\d+(?:\.\d+)?)/gi, 'Más de $1')
        .replace(/Under\s+(\d+(?:\.\d+)?)/gi, 'Menos de $1');
}

function renderHistory(data) {
    const container = document.getElementById('stats-container');
    container.innerHTML = '';

    const calcAcc = (correct, total) => total > 0 ? Math.round((correct / total) * 100) : 0;
    const acc1x2 = calcAcc(data.correct_1x2, data.total_1x2);

    const getColorClass = (val) => {
        if(val >= 65) return 'high';
        if(val >= 50) return 'med';
        return 'low';
    };

    const stats = [
        { label: "Winner Prediction Accuracy", value: acc1x2, total: data.total_1x2 }
    ];

    stats.forEach(stat => {
        const card = document.createElement('div');
        card.className = 'stat-card glass-card';
        card.innerHTML = `
            <div class="stat-label">${stat.label}</div>
            <div class="stat-value ${getColorClass(stat.value)}">${stat.value}%</div>
            <div class="stat-sub">Accuracy over ${stat.total} matches</div>
        `;
        container.appendChild(card);
    });
}

function renderError(containerId, message) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<p style="grid-column: 1/-1; text-align:center; color: var(--text-secondary);">${message}</p>`;
}
