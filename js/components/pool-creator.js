// js/components/pool-creator.js - ОБНОВЛЕННАЯ ВЕРСИЯ С ПРОВЕРКОЙ ГОТОВНОСТИ СЕССИЙ

class PoolCreator {
    constructor() {
        this.availableDKGSessions = [];
        this.selectedSession = null;
        this.poolParams = {
            asset: 'BTC',
            poolId: '',
            mpName: '',
            mpSymbol: '',
            restrictedMp: false,
            payoutScript: '',
            calculatorId: 0
        };
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            await this.loadCalculators();
            await this.loadAvailableDKGSessions();
            this.setupEventListeners();
            this.initialized = true;

            console.log('PoolCreator initialized');
        } catch (error) {
            console.error('Failed to initialize PoolCreator:', error);
            app.showNotification('error', `Failed to initialize pool creator: ${error.message}`);
        }
    }

    // =============== ЗАГРУЗКА ГОТОВЫХ DKG СЕССИЙ ===============

    async loadAvailableDKGSessions() {
        try {
            if (!wallet.isConnected()) {
                this.availableDKGSessions = [];
                this.renderDKGSessionsList();
                return;
            }

            const frost = contracts.getContract('FROST_COORDINATOR');
            const userAddress = wallet.account;

            console.log('Loading DKG sessions for user:', userAddress);

            // Получаем все сессии пользователя из контракта
            const sessionIds = await frost.getUserSessions(userAddress);
            console.log('Found user sessions:', sessionIds);

            const sessions = [];

            for (const sessionId of sessionIds) {
                try {
                    const sessionData = await frost.getSession(sessionId);
                    const participants = await frost.getSessionParticipants(sessionId);

                    // Проверяем, готова ли сессия для создания пула
                    const readinessCheck = await this.checkSessionReadiness(sessionData, participants);

                    const session = {
                        id: sessionId.toString(),
                        creator: sessionData.creator,
                        groupPubkey: sessionData.groupPubkey,
                        state: sessionData.state.toNumber(),
                        threshold: sessionData.threshold.toNumber(),
                        participants: participants,
                        totalParticipants: participants.length,
                        purpose: sessionData.purpose.toNumber(),
                        deadline: new Date(sessionData.deadline.toNumber() * 1000),

                        // Информация о готовности
                        readiness: readinessCheck
                    };

                    // Добавляем только финализированные сессии
                    if (session.state >= 4 && session.groupPubkey && session.groupPubkey !== '0x') {
                        sessions.push(session);
                    }
                } catch (error) {
                    console.error(`Failed to load session ${sessionId}:`, error);
                }
            }

            // Сортируем по готовности: сначала полностью готовые, потом ожидающие авторизации
            sessions.sort((a, b) => {
                if (a.readiness.isReady !== b.readiness.isReady) {
                    return b.readiness.isReady ? 1 : -1; // Готовые сверху
                }
                return new Date(b.deadline) - new Date(a.deadline); // По дате
            });

            this.availableDKGSessions = sessions;
            this.renderDKGSessionsList();

            console.log(`Loaded ${sessions.length} finalized DKG sessions`);

        } catch (error) {
            console.error('Failed to load DKG sessions:', error);
            app.showNotification('error', `Failed to load DKG sessions: ${error.message}`);
            this.availableDKGSessions = [];
            this.renderDKGSessionsList();
        }
    }

    // =============== ПРОВЕРКА ГОТОВНОСТИ СЕССИИ ===============

    async checkSessionReadiness(sessionData, participants) {
        try {
            const readiness = {
                isReady: false,
                status: '',
                issues: [],
                authorizedCount: 0,
                unauthorizedParticipants: [],
                hasPendingRequest: false
            };

            // 1. Базовые проверки
            if (sessionData.state.toNumber() < 4) {
                readiness.status = 'not_finalized';
                readiness.issues.push('DKG session not finalized');
                return readiness;
            }

            if (!sessionData.groupPubkey || sessionData.groupPubkey === '0x') {
                readiness.status = 'no_group_key';
                readiness.issues.push('No group public key generated');
                return readiness;
            }

            // 2. Проверка авторизации всех участников
            const authorizationResults = await this.checkAllParticipantsAuthorization(participants);

            readiness.authorizedCount = authorizationResults.authorizedCount;
            readiness.unauthorizedParticipants = authorizationResults.unauthorizedParticipants;

            // 3. Проверка наличия pending запросов
            if (authorizationResults.unauthorizedParticipants.length > 0) {
                readiness.hasPendingRequest = await this.checkForPendingDKGRequest(sessionData.id.toString());
            }

            // 4. Определение финального статуса
            if (authorizationResults.unauthorizedParticipants.length === 0) {
                readiness.isReady = true;
                readiness.status = 'ready';
            } else if (readiness.hasPendingRequest) {
                readiness.status = 'pending_authorization';
                readiness.issues.push(`Waiting for admin approval (${authorizationResults.unauthorizedParticipants.length} participants need roles)`);
            } else {
                readiness.status = 'needs_authorization';
                readiness.issues.push(`${authorizationResults.unauthorizedParticipants.length} participants need POOL_MANAGER role`);
            }

            return readiness;

        } catch (error) {
            console.error('Error checking session readiness:', error);
            return {
                isReady: false,
                status: 'check_error',
                issues: [`Error checking readiness: ${error.message}`],
                authorizedCount: 0,
                unauthorizedParticipants: [],
                hasPendingRequest: false
            };
        }
    }

    async checkAllParticipantsAuthorization(participants) {
        try {
            const results = {
                authorizedCount: 0,
                unauthorizedParticipants: []
            };

            for (const participant of participants) {
                const hasRole = await contracts.checkPoolManagerRole(participant);
                if (hasRole) {
                    results.authorizedCount++;
                } else {
                    results.unauthorizedParticipants.push(participant);
                }
            }

            return results;
        } catch (error) {
            console.error('Error checking participants authorization:', error);
            return {
                authorizedCount: 0,
                unauthorizedParticipants: participants
            };
        }
    }

    async checkForPendingDKGRequest(sessionId) {
        try {
            // Проверяем через API наличие pending запроса для данной сессии
            const response = await fetch(`${CONFIG.API_BASE_URL}/requests/dkg-pending/${sessionId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const result = await response.json();
                return result.hasPendingRequest || false;
            }

            return false;
        } catch (error) {
            console.error('Error checking for pending DKG request:', error);
            return false;
        }
    }

    // =============== UI ОТРИСОВКА ===============

    renderDKGSessionsList() {
        const container = document.getElementById('dkg-sessions-list');
        if (!container) return;

        if (this.availableDKGSessions.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
            <div class="empty-icon">🔐</div>
            <h3>No DKG Sessions Available</h3>
            <p>Create a DKG session first to enable pool creation with FROST multisig.</p>
            <button onclick="app.showComponent('dkg-manager')" class="btn btn-primary">
            Create DKG Session
            </button>
            </div>
            `;
            return;
        }

        const sessionsHtml = this.availableDKGSessions.map(session => {
            const statusIcon = this.getSessionStatusIcon(session.readiness);
            const statusClass = this.getSessionStatusClass(session.readiness);

            return `
            <div class="session-card ${statusClass}" onclick="poolCreator.selectDKGSession('${session.id}')">
            <div class="session-header">
            <div class="session-title">
            ${statusIcon}
            <span>Session ${session.id.slice(0, 8)}...</span>
            </div>
            <div class="session-status">${this.getStatusText(session.readiness)}</div>
            </div>

            <div class="session-details">
            <div class="detail-row">
            <span class="label">Threshold:</span>
            <span class="value">${session.threshold}/${session.totalParticipants}</span>
            </div>
            <div class="detail-row">
            <span class="label">Creator:</span>
            <span class="value">${wallet.formatAddress(session.creator)}</span>
            </div>
            <div class="detail-row">
            <span class="label">Authorized:</span>
            <span class="value">${session.readiness.authorizedCount}/${session.totalParticipants}</span>
            </div>
            </div>

            ${session.readiness.issues.length > 0 ? `
                <div class="session-issues">
                ${session.readiness.issues.map(issue => `
                    <div class="issue-item">${issue}</div>
                    `).join('')}
                    </div>
                    ` : ''}

                    ${session.readiness.isReady ? `
                        <div class="session-actions">
                        <button class="btn btn-success btn-sm" onclick="event.stopPropagation(); poolCreator.selectDKGSession('${session.id}')">
                        Use This Session
                        </button>
                        </div>
                        ` : session.readiness.status === 'needs_authorization' ? `
                        <div class="session-actions">
                        <button class="btn btn-warning btn-sm" onclick="event.stopPropagation(); poolCreator.requestAuthorizationForSession('${session.id}')">
                        Request Authorization
                        </button>
                        </div>
                        ` : ''}
                        </div>
                        `;
        }).join('');

        container.innerHTML = `
        <div class="sessions-grid">
        ${sessionsHtml}
        </div>
        <div class="sessions-footer">
        <button onclick="poolCreator.loadAvailableDKGSessions()" class="btn btn-secondary">
        🔄 Refresh Sessions
        </button>
        </div>
        `;
    }

    getSessionStatusIcon(readiness) {
        switch (readiness.status) {
            case 'ready': return '✅';
            case 'pending_authorization': return '⏳';
            case 'needs_authorization': return '🔐';
            case 'not_finalized': return '🔄';
            case 'no_group_key': return '❌';
            case 'check_error': return '⚠️';
            default: return '❓';
        }
    }

    getSessionStatusClass(readiness) {
        switch (readiness.status) {
            case 'ready': return 'session-ready';
            case 'pending_authorization': return 'session-pending';
            case 'needs_authorization': return 'session-blocked';
            default: return 'session-error';
        }
    }

    getStatusText(readiness) {
        switch (readiness.status) {
            case 'ready': return 'Ready for Pool Creation';
            case 'pending_authorization': return 'Awaiting Admin Approval';
            case 'needs_authorization': return 'Needs Authorization';
            case 'not_finalized': return 'DKG Not Finalized';
            case 'no_group_key': return 'No Group Key';
            case 'check_error': return 'Check Failed';
            default: return 'Unknown Status';
        }
    }

    // =============== ВЫБОР И ДЕЙСТВИЯ С СЕССИЯМИ ===============

    selectDKGSession(sessionId) {
        const session = this.availableDKGSessions.find(s => s.id === sessionId);
        if (!session) {
            app.showNotification('error', 'Session not found');
            return;
        }

        if (!session.readiness.isReady) {
            app.showNotification('warning', 'This session is not ready for pool creation yet');
            return;
        }

        this.selectedSession = session;
        this.showPoolCreationForm();

        app.showNotification('success', `Selected DKG Session ${sessionId.slice(0, 8)}...`);
    }

    async requestAuthorizationForSession(sessionId) {
        const session = this.availableDKGSessions.find(s => s.id === sessionId);
        if (!session) {
            app.showNotification('error', 'Session not found');
            return;
        }

        try {
            // Используем метод из dkg-manager для создания группового запроса
            const success = await dkgManager.createGroupRoleRequest(session);

            if (success) {
                app.showNotification('success', 'Authorization request created successfully');
                // Обновляем список сессий
                setTimeout(() => this.loadAvailableDKGSessions(), 1000);
            }
        } catch (error) {
            console.error('Failed to request authorization:', error);
            app.showNotification('error', `Failed to create authorization request: ${error.message}`);
        }
    }

    // =============== СОЗДАНИЕ ПУЛА ===============

    showPoolCreationForm() {
        if (!this.selectedSession) {
            app.showNotification('error', 'No DKG session selected');
            return;
        }

        const container = document.getElementById('pool-creation-form');
        if (!container) return;

        container.innerHTML = `
        <div class="form-section">
        <h3>Create Pool from FROST Session</h3>

        <div class="selected-session-info">
        <h4>Selected DKG Session</h4>
        <div class="info-grid">
        <div class="info-item">
        <label>Session ID:</label>
        <span>${this.selectedSession.id}</span>
        </div>
        <div class="info-item">
        <label>Threshold:</label>
        <span>${this.selectedSession.threshold}/${this.selectedSession.totalParticipants}</span>
        </div>
        <div class="info-item">
        <label>Authorized:</label>
        <span>${this.selectedSession.readiness.authorizedCount}/${this.selectedSession.totalParticipants}</span>
        </div>
        </div>
        </div>

        <div class="form-fields">
        <div class="field-group">
        <label for="pool-id">Pool ID *</label>
        <input type="text" id="pool-id" placeholder="unique-pool-identifier" required>
        <small>Unique identifier for the pool</small>
        </div>

        <div class="field-group">
        <label for="mp-name">MP Token Name *</label>
        <input type="text" id="mp-name" placeholder="My Mining Pool Token" required>
        </div>

        <div class="field-group">
        <label for="mp-symbol">MP Token Symbol *</label>
        <input type="text" id="mp-symbol" placeholder="MMP" required>
        <small>3-5 characters</small>
        </div>

        <div class="field-group">
        <label for="payout-script">Bitcoin Payout Script *</label>
        <textarea id="payout-script" placeholder="Enter Bitcoin script in hex format" required></textarea>
        <small>Script for receiving mining rewards on Bitcoin network</small>
        </div>

        <div class="field-group">
        <label for="calculator-select">Reward Calculator *</label>
        <select id="calculator-select" required>
        <option value="">Select calculator...</option>
        </select>
        </div>

        <div class="field-group">
        <label class="checkbox-label">
        <input type="checkbox" id="restricted-mp">
        <span class="checkmark"></span>
        Restricted MP Token (requires whitelist)
        </label>
        </div>
        </div>

        <div class="form-actions">
        <button onclick="poolCreator.createPoolFromFrost()" class="btn btn-primary btn-large">
        Create Mining Pool
        </button>
        <button onclick="poolCreator.clearSelection()" class="btn btn-secondary">
        Cancel
        </button>
        </div>
        </div>
        `;

        // Заполняем селектор калькуляторов
        this.populateCalculatorSelect();
    }

    async createPoolFromFrost() {
        if (!this.selectedSession || !this.selectedSession.readiness.isReady) {
            app.showNotification('error', 'No ready DKG session selected');
            return;
        }

        try {
            // Собираем параметры из формы
            const poolParams = this.collectPoolParams();
            if (!poolParams) return; // Ошибки валидации уже показаны

            app.showNotification('info', 'Creating mining pool from FROST session...');

            const factory = contracts.getContract('FACTORY');

            console.log('Creating pool with params:', poolParams);
            console.log('From FROST session:', this.selectedSession.id);

            // Вызываем метод createPoolFromFrost
            const tx = await factory.createPoolFromFrost(
                this.selectedSession.id, // sessionId
                poolParams.asset,        // asset
                poolParams.poolId,       // poolId
                poolParams.mpName,       // mpName
                poolParams.mpSymbol,     // mpSymbol
                poolParams.restrictedMp, // restrictedMp
                ethers.constants.HashZero, // create2Salt
                poolParams.payoutScript,   // payoutScript
                poolParams.calculatorId    // calculatorId
            );

            app.showNotification('info', 'Transaction submitted, waiting for confirmation...');

            const receipt = await tx.wait();
            console.log('Pool created successfully:', receipt);

            // Парсим событие PoolCreated
            const poolCreatedEvent = receipt.events?.find(e => e.event === 'PoolCreated');
            if (poolCreatedEvent) {
                const [poolCore, mpToken, asset, poolId, creator] = poolCreatedEvent.args;

                app.showNotification('success', `Pool created successfully!`);

                // Показываем результат
                this.showPoolCreationResult({
                    poolCore,
                    mpToken,
                    asset,
                    poolId,
                    creator,
                    txHash: receipt.transactionHash,
                    sessionId: this.selectedSession.id
                });
            } else {
                app.showNotification('success', 'Pool created successfully!');
                this.clearSelection();
            }

        } catch (error) {
            console.error('Failed to create pool from FROST:', error);
            app.showNotification('error', `Failed to create pool: ${error.message}`);
        }
    }

    collectPoolParams() {
        const poolId = document.getElementById('pool-id')?.value.trim();
        const mpName = document.getElementById('mp-name')?.value.trim();
        const mpSymbol = document.getElementById('mp-symbol')?.value.trim();
        const payoutScript = document.getElementById('payout-script')?.value.trim();
        const calculatorId = parseInt(document.getElementById('calculator-select')?.value) || 0;
        const restrictedMp = document.getElementById('restricted-mp')?.checked || false;

        // Валидация
        if (!poolId) {
            app.showNotification('error', 'Pool ID is required');
            return null;
        }
        if (!mpName) {
            app.showNotification('error', 'MP Token name is required');
            return null;
        }
        if (!mpSymbol || mpSymbol.length < 3) {
            app.showNotification('error', 'MP Token symbol must be at least 3 characters');
            return null;
        }
        if (!payoutScript) {
            app.showNotification('error', 'Bitcoin payout script is required');
            return null;
        }

        return {
            asset: 'BTC',
            poolId,
            mpName,
            mpSymbol,
            restrictedMp,
            payoutScript: ethers.utils.hexlify(ethers.utils.toUtf8Bytes(payoutScript)),
            calculatorId
        };
    }

    showPoolCreationResult(result) {
        const container = document.getElementById('pool-creation-form');
        if (!container) return;

        container.innerHTML = `
        <div class="creation-result success">
        <div class="result-header">
        <div class="result-icon">✅</div>
        <h3>Pool Created Successfully!</h3>
        </div>

        <div class="result-details">
        <div class="detail-item">
        <label>Pool ID:</label>
        <span>${result.poolId}</span>
        </div>
        <div class="detail-item">
        <label>Pool Core Contract:</label>
        <span class="address">${result.poolCore}</span>
        </div>
        <div class="detail-item">
        <label>MP Token Contract:</label>
        <span class="address">${result.mpToken}</span>
        </div>
        <div class="detail-item">
        <label>FROST Session:</label>
        <span>${result.sessionId}</span>
        </div>
        <div class="detail-item">
        <label>Transaction:</label>
        <a href="${CONFIG.EXPLORER_URL}/tx/${result.txHash}" target="_blank" class="tx-link">
        View on Explorer
        </a>
        </div>
        </div>

        <div class="result-actions">
        <button onclick="app.showComponent('pool-management')" class="btn btn-primary">
        Manage Pool
        </button>
        <button onclick="poolCreator.clearSelection()" class="btn btn-secondary">
        Create Another Pool
        </button>
        </div>
        </div>
        `;
    }

    // =============== КАЛЬКУЛЯТОРЫ ===============

    async loadCalculators() {
        // Реализация загрузки доступных калькуляторов
        this.calculators = [
            { id: 0, name: 'PPLNS', description: 'Pay Per Last N Shares' },
            { id: 1, name: 'PPS', description: 'Pay Per Share' },
            { id: 2, name: 'FPPS', description: 'Full Pay Per Share' },
            { id: 3, name: 'Score', description: 'Score-based Distribution' }
        ];
    }

    populateCalculatorSelect() {
        const select = document.getElementById('calculator-select');
        if (!select) return;

        select.innerHTML = '<option value="">Select calculator...</option>' +
        this.calculators.map(calc =>
        `<option value="${calc.id}">${calc.name} - ${calc.description}</option>`
        ).join('');
    }

    // =============== УТИЛИТЫ ===============

    clearSelection() {
        this.selectedSession = null;
        const container = document.getElementById('pool-creation-form');
        if (container) {
            container.innerHTML = '<div class="empty-message">Select a DKG session to create a pool</div>';
        }
        this.loadAvailableDKGSessions(); // Обновляем список
    }

    setupEventListeners() {
        // Слушаем события обновления DKG сессий
        if (typeof dkgManager !== 'undefined') {
            // Обновляем список когда меняется статус сессий
            window.addEventListener('dkg-session-updated', () => {
                setTimeout(() => this.loadAvailableDKGSessions(), 1000);
            });
        }
    }

    // =============== ПУБЛИЧНЫЕ МЕТОДЫ ===============

    async refreshSessions() {
        await this.loadAvailableDKGSessions();
    }

    getSelectedSession() {
        return this.selectedSession;
    }

    getAvailableSessions() {
        return this.availableDKGSessions.filter(s => s.readiness.isReady);
    }
}

// Создаем глобальный экземпляр
const poolCreator = new PoolCreator();
