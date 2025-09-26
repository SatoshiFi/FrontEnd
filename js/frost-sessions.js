// js/frost-sessions.js
class FROSTSessionsManager {
    constructor() {
        this.sessions = [];
        this.nextSessionId = 0;
    }

    async loadSessions() {
        try {
            console.log('Loading FROST sessions...');

            if (!web3Integrator || !web3Integrator.connected) {
                throw new Error('Web3 not connected');
            }

            const frost = web3Integrator.getContract('FROST_COORDINATOR', 'FROST');

            // 1. Сначала пробуем загрузить через события (правильный способ)
            try {
                return await this.loadSessionsViaEvents(frost);
            } catch (eventError) {
                console.warn('Events loading failed, trying range scan:', eventError);
            }

            // 2. Fallback: умный range scan
            try {
                return await this.loadSessionsViaRangeScan(frost);
            } catch (rangeError) {
                console.error('Range scan failed:', rangeError);
                return [];
            }

        } catch (error) {
            console.error('Error loading FROST sessions:', error);
            return [];
        }
    }

    async loadSessionsViaEvents(frost) {
        const filter = frost.filters.SessionCreated();
        const currentBlock = await web3Integrator.provider.getBlockNumber();

        // Загружаем события с разумного диапазона
        const fromBlock = Math.max(0, currentBlock - 2000);

        console.log(`Loading SessionCreated events from block ${fromBlock}`);

        const events = await frost.queryFilter(filter, fromBlock, currentBlock);

        const sessions = [];
        for (const event of events) {
            try {
                const sessionId = Number(event.args.sessionId);
                const session = await frost.getSession(sessionId);

                if (session.state.toString() !== '0') {
                    sessions.push(this.parseSessionData(sessionId, session));
                }

                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (e) {
                console.warn(`Failed to load session from event:`, e);
            }
        }

        this.sessions = sessions.sort((a, b) => b.id - a.id);
        console.log(`Loaded ${this.sessions.length} sessions via events`);
        return this.sessions;
    }

    async loadSessionsViaRangeScan(frost) {
        // Получаем nextSessionId для определения диапазона
        const nextId = Number(await frost.nextSessionId());
        console.log('NextSessionId from contract:', nextId);

        // Сканируем разумный диапазон вокруг nextSessionId
        const rangeSize = 50; // Проверяем последние 50 сессий
        const startId = Math.max(1, nextId - rangeSize);

        console.log(`Scanning sessions from ${startId} to ${nextId}`);

        const sessions = [];
        const batchSize = 10;

        // Батчевая загрузка с паузами
        for (let i = startId; i <= nextId; i += batchSize) {
            const batch = [];

            for (let j = i; j < Math.min(i + batchSize, nextId + 1); j++) {
                batch.push(this.checkSession(frost, j));
            }

            const results = await Promise.allSettled(batch);

            for (const result of results) {
                if (result.status === 'fulfilled' && result.value) {
                    sessions.push(result.value);
                }
            }

            // Пауза между батчами
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        this.sessions = sessions.sort((a, b) => b.id - a.id);
        console.log(`Loaded ${this.sessions.length} sessions via range scan`);
        return this.sessions;
    }

    async checkSession(frost, id) {
        try {
            const session = await frost.getSession(id);

            if (session.state.toString() !== '0' &&
                session.creator !== '0x0000000000000000000000000000000000000000') {
                return this.parseSessionData(id, session);
                }
                return null;
        } catch (e) {
            return null;
        }
    }

    parseSessionData(id, session) {
        const states = ['NONE', 'OPENED', 'FINALIZED', 'ABORTED'];
        const purposes = ['UNKNOWN', 'WITHDRAWAL', 'SLASH', 'REDEMPTION', 'BRIDGE_OUT', 'BRIDGE_IN', 'DKG'];

        // Извлекаем pubkey если он есть и не пустой
        let pubkeyX = '', pubkeyY = '';
        if (session.groupPubkey && session.groupPubkey.length >= 64) {
            const pubkeyHex = session.groupPubkey.slice(2); // Убираем 0x

            // Проверяем что ключ не пустой (не все нули)
            const isNotEmpty = pubkeyHex.split('').some(char => char !== '0');

            if (isNotEmpty) {
                if (pubkeyHex.length === 64) {
                    // Только X координата (Schnorr)
                    pubkeyX = '0x' + pubkeyHex;
                } else if (pubkeyHex.length === 128) {
                    // X и Y координаты (ECDSA)
                    pubkeyX = '0x' + pubkeyHex.slice(0, 64);
                    pubkeyY = '0x' + pubkeyHex.slice(64);
                }
            }
        }

        return {
            id: id,
            creator: session.creator,
            state: states[session.state] || 'UNKNOWN',
            stateIndex: Number(session.state),
            threshold: Number(session.threshold),
            total: Number(session.total),
            deadline: new Date(Number(session.deadline) * 1000),
            purpose: purposes[session.purpose] || 'UNKNOWN',
            commitsCount: Number(session.commitsCount),
            sharesCount: Number(session.sharesCount),
            refusalCount: Number(session.refusalCount),
            dkgSharesCount: Number(session.dkgSharesCount),
            pubkeyX: pubkeyX,
            pubkeyY: pubkeyY,
            messageBound: session.messageBound,
            messageHash: session.messageHash
        };
    }

    async refreshSessionsList() {
        const sessions = await this.loadSessions();
        const container = document.getElementById('frost-sessions');

        if (!container) {
            console.error('FROST sessions container not found');
            return;
        }

        if (sessions.length === 0) {
            container.innerHTML = `
            <div class="card">
            <p style="text-align: center; opacity: 0.7;">No FROST sessions found</p>
            <p style="text-align: center; font-size: 0.9em; opacity: 0.5;">
            Sessions will appear here after creation
            </p>
            </div>
            `;
            return;
        }

        let html = '<div class="sessions-grid">';

        for (const session of sessions) {
            const isExpired = session.deadline < new Date();
            const isDKG = session.purpose === 'DKG';
            const isFinalized = session.state === 'FINALIZED';
            const isOpen = session.state === 'OPENED';

            let statusClass = 'status-unknown';
            if (isFinalized) statusClass = 'status-success';
            else if (session.state === 'ABORTED') statusClass = 'status-error';
            else if (isExpired) statusClass = 'status-warning';
            else if (isOpen) statusClass = 'status-info';

            html += `
            <div class="card session-card ${statusClass}">
            <div class="session-header">
            <h4>Session #${session.id}</h4>
            <span class="badge ${statusClass}">${session.state}</span>
            </div>

            <div class="session-details">
            <p><strong>Type:</strong> ${session.purpose}</p>
            <p><strong>Creator:</strong> ${this.formatAddress(session.creator)}</p>
            <p><strong>Threshold:</strong> ${session.threshold}/${session.total}</p>
            <p><strong>Deadline:</strong> ${session.deadline.toLocaleString()}</p>

            ${isDKG ? `
                <div class="dkg-progress">
                <p><strong>DKG Progress:</strong></p>
                <ul>
                <li>Commits: ${session.commitsCount}/${session.total}</li>
                <li>Shares: ${session.sharesCount}/${session.total}</li>
                <li>DKG Shares: ${session.dkgSharesCount}/${session.total * (session.total - 1)}</li>
                ${session.refusalCount > 0 ? `<li class="error">Refusals: ${session.refusalCount}</li>` : ''}
                </ul>
                </div>
                ` : ''}

                ${session.pubkeyX ? `
                    <div class="pubkey-info">
                    <p><strong>Group Pubkey:</strong></p>
                    <input type="text" readonly value="${session.pubkeyX}" class="pubkey-field"
                    onclick="this.select(); document.execCommand('copy'); uiController.showStatus('Pubkey X copied!', 'success');">
                    ${session.pubkeyY ? `
                        <input type="text" readonly value="${session.pubkeyY}" class="pubkey-field"
                        onclick="this.select(); document.execCommand('copy'); uiController.showStatus('Pubkey Y copied!', 'success');">
                        ` : ''}
                        ${isFinalized && isDKG ? `
                            <button class="btn btn-sm btn-primary" onclick="useFROSTKeysForPool(${session.id})">
                            Use for New Pool
                            </button>
                            ` : ''}
                            </div>
                            ` : ''}
                            </div>
                            </div>
                            `;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    formatAddress(address) {
        if (!address) return 'Unknown';
        return address.slice(0, 6) + '...' + address.slice(-4);
    }
}

// Создаем глобальный экземпляр
window.frostSessionsManager = new FROSTSessionsManager();

// Функция для использования ключей в создании пула
window.useFROSTKeysForPool = function(sessionId) {
    try {
        console.log(`Using keys from session ${sessionId}`);

        // Найти сессию в массиве
        const session = frostSessionsManager.sessions.find(s => s.id === sessionId);

        if (!session || !session.pubkeyX) {
            uiController.showStatus('Session not found or no keys available', 'error');
            return;
        }

        // Заполнить форму создания пула
        document.getElementById('pubkey-x').value = session.pubkeyX;
        document.getElementById('pubkey-y').value = session.pubkeyY || '0x0000000000000000000000000000000000000000000000000000000000000000';

        // Генерируем payout script из pubkey X
        const pubkeyHex = session.pubkeyX.startsWith('0x') ? session.pubkeyX.slice(2) : session.pubkeyX;
        const payoutScript = '0x5120' + pubkeyHex; // P2TR script
        document.getElementById('payout-script').value = payoutScript;

        // Переключаемся на вкладку пулов
        uiController.showTab('pools');
        uiController.showStatus(`Keys from session #${sessionId} loaded into pool form`, 'success');

    } catch (error) {
        console.error('Error using FROST keys:', error);
        uiController.showStatus('Error loading keys: ' + error.message, 'error');
    }
};

// Функция для отображения сгенерированных ключей
window.displayGeneratedKeys = function() {
    const container = document.getElementById('group-keys');

    if (!poolManager.currentDKGSession || !poolManager.currentDKGSession.groupPubkey) {
        container.innerHTML = '<p style="text-align: center; opacity: 0.7;">No group keys generated yet.</p>';
        return;
    }

    const session = poolManager.currentDKGSession;
    const pubkey = session.groupPubkey;

    container.innerHTML = `
    <div class="generated-keys-display">
    <h4>Session #${session.id} - Group Keys</h4>
    <div class="key-info">
    <label>Pubkey X (32 bytes):</label>
    <input type="text" readonly value="${pubkey.x}"
    onclick="this.select(); document.execCommand('copy'); uiController.showStatus('Copied!', 'success');">

    <label>Pubkey Y (32 bytes):</label>
    <input type="text" readonly value="${pubkey.y}"
    onclick="this.select(); document.execCommand('copy'); uiController.showStatus('Copied!', 'success');">

    <label>Payout Script (P2TR):</label>
    <input type="text" readonly value="${poolManager.generatePayoutScript(pubkey.x)}"
    onclick="this.select(); document.execCommand('copy'); uiController.showStatus('Copied!', 'success');">

    <div class="key-actions">
    <button class="btn btn-primary" onclick="useForPool()">Use for New Pool</button>
    <button class="btn btn-secondary" onclick="finalizeDKG()">Finalize DKG</button>
    </div>
    </div>
    </div>
    `;
};

// Функция для использования ключей в создании пула
window.useForPool = function() {
    if (!poolManager.currentDKGSession || !poolManager.currentDKGSession.groupPubkey) {
        uiController.showStatus('No generated keys available', 'error');
        return;
    }

    const pubkey = poolManager.currentDKGSession.groupPubkey;

    document.getElementById('pubkey-x').value = pubkey.x;
    document.getElementById('pubkey-y').value = pubkey.y;
    document.getElementById('payout-script').value = poolManager.generatePayoutScript(pubkey.x);

    // Переключаемся на вкладку пулов
    uiController.showTab('pools');
    uiController.showStatus('Keys loaded into pool creation form', 'success');
};

// Обновляем uiController для правильной работы
if (typeof uiController !== 'undefined') {
    uiController.displayGeneratedKeys = displayGeneratedKeys;
    uiController.useForPool = useForPool;
}
