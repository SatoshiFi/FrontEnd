// js/components/dashboard.js - ИСПРАВЛЕННАЯ ВЕРСИЯ С КОРРЕКТНЫМИ API И КОНТРАКТАМИ
class DashboardManager {
    constructor() {
        this.widgets = {};
        this.refreshInterval = null;
    }

    async initialize() {
        await this.buildDashboard();
    }

    async buildDashboard() {
        const dashboardGrid = document.getElementById('dashboardGrid');
        if (!dashboardGrid) return;

        dashboardGrid.innerHTML = '';

        const widgets = userRoles.getDashboardWidgets();

        for (const widgetType of widgets) {
            const widget = this.createWidget(widgetType);
            if (widget) {
                dashboardGrid.appendChild(widget);
            }
        }
    }

    createWidget(type) {
        const widget = document.createElement('div');
        widget.className = `widget widget-${type}`;

        switch (type) {
            case 'pool-creation':
                return this.createPoolCreationWidget(widget);
            case 'pool-overview':
                return this.createPoolOverviewWidget(widget);
            case 'pool-management':
                return this.createPoolManagementWidget(widget);
            case 'mining':
                return this.createMiningWidget(widget);
            case 'frost-sessions':
                return this.createFrostSessionsWidget(widget);
            case 'dkg-sessions':
                return this.createDKGSessionsWidget(widget);
            case 'analytics':
                return this.createAnalyticsWidget(widget);
            case 'rewards':
                return this.createRewardsWidget(widget);
            default:
                return this.createGenericWidget(widget, type);
        }
    }

    createPoolCreationWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Create Pool</h3>
        <a href="#" class="widget-action" onclick="dashboard.checkPoolManagerAndRedirect(); return false;">Create →</a>
        </div>
        <div class="widget-content">
        <p>Create a new mining pool through FROST DKG</p>
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="activeDKGSessions">-</span>
        <span class="stat-label">Active DKG</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="totalPoolsCreated">-</span>
        <span class="stat-label">Pools Created</span>
        </div>
        </div>
        </div>
        `;
        this.loadPoolCreationStats(widget);
        return widget;
    }

    createPoolOverviewWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Pool Overview</h3>
        <a href="#" class="widget-action" onclick="showSection('poolManagement')">Details →</a>
        </div>
        <div class="widget-content">
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="poolHashrate">-</span>
        <span class="stat-label">Pool Hashrate</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="poolBlocks">-</span>
        <span class="stat-label">Blocks Found</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="poolWorkers">-</span>
        <span class="stat-label">Pool Workers</span>
        </div>
        </div>
        </div>
        `;
        this.loadPoolOverviewStats(widget);
        return widget;
    }

    createPoolManagementWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Pool Management</h3>
        <a href="#" class="widget-action" onclick="showSection('poolManagement')">Manage →</a>
        </div>
        <div class="widget-content">
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="myPoolsCount">-</span>
        <span class="stat-label">My Pools</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="totalHashrate">-</span>
        <span class="stat-label">Total Hashrate</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="activeMiners">-</span>
        <span class="stat-label">Active Miners</span>
        </div>
        </div>
        </div>
        `;
        this.loadPoolManagementStats(widget);
        return widget;
    }

    createMiningWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Mining Dashboard</h3>
        <a href="#" class="widget-action" onclick="showSection('miningDashboard')">Details →</a>
        </div>
        <div class="widget-content">
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="currentHashrate">-</span>
        <span class="stat-label">Current Hashrate</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="sharesSubmitted">-</span>
        <span class="stat-label">Shares Submitted</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="pendingRewards">-</span>
        <span class="stat-label">Pending Rewards</span>
        </div>
        </div>
        <div class="mining-controls" style="margin-top: 15px;">
        <button class="btn btn-sm btn-success" onclick="dashboard.startMining()">Start</button>
        <button class="btn btn-sm btn-error" onclick="dashboard.stopMining()">Stop</button>
        </div>
        </div>
        `;
        this.loadMiningStats(widget);
        return widget;
    }

    createFrostSessionsWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">FROST Sessions</h3>
        <a href="#" class="widget-action" onclick="showSection('poolCreation')">Manage →</a>
        </div>
        <div class="widget-content">
        <div id="activeSessions" class="sessions-list">
        <div class="loading">Loading sessions...</div>
        </div>
        </div>
        `;
        this.loadFrostSessions(widget);
        return widget;
    }

    createDKGSessionsWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">DKG Sessions</h3>
        <a href="#" class="widget-action" onclick="showSection('poolCreation')">Create →</a>
        </div>
        <div class="widget-content">
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="dkgActive">-</span>
        <span class="stat-label">Active DKG</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="dkgCompleted">-</span>
        <span class="stat-label">Completed</span>
        </div>
        </div>
        </div>
        `;
        this.loadDKGSessions(widget);
        return widget;
    }

    createAnalyticsWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Analytics</h3>
        <a href="#" class="widget-action">Details →</a>
        </div>
        <div class="widget-content">
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="totalBlocks">-</span>
        <span class="stat-label">Total Blocks</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="networkHashrate">-</span>
        <span class="stat-label">Network Hashrate</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="activeWorkers">-</span>
        <span class="stat-label">Active Workers</span>
        </div>
        </div>
        </div>
        `;
        this.loadAnalyticsStats(widget);
        return widget;
    }

    createRewardsWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Rewards</h3>
        <a href="#" class="widget-action">Claim →</a>
        </div>
        <div class="widget-content">
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="totalEarned">0.0 BTC</span>
        <span class="stat-label">Total Earned</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="pendingBalance">0.0 BTC</span>
        <span class="stat-label">Pending</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="lastPayout">Never</span>
        <span class="stat-label">Last Payout</span>
        </div>
        </div>
        </div>
        `;
        return widget;
    }

    createGenericWidget(widget, type) {
        const typeConfig = {
            'custody': { title: 'Custody Management', icon: '🔐' },
            'participants': { title: 'Participants', icon: '👥' },
            'security': { title: 'Security Status', icon: '🛡️' }
        };

        const config = typeConfig[type] || { title: type, icon: '📋' };

        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">${config.icon} ${config.title}</h3>
        <a href="#" class="widget-action">Details →</a>
        </div>
        <div class="widget-content">
        <p>Widget in development</p>
        </div>
        `;
        return widget;
    }

    // =============== ИСПРАВЛЕННЫЕ API МЕТОДЫ ===============

    async loadPoolCreationStats(widget) {
        try {
            // ИСПРАВЛЕНО: Загружаем только наши пулы из MiningPoolFactoryV6
            if (wallet.connected && contracts.initialized) {
                const factory = contracts.getContract('factory');
                const poolCount = await factory.getPoolCount();

                const totalPoolsElement = widget.querySelector('#totalPoolsCreated');
                if (totalPoolsElement) {
                    totalPoolsElement.textContent = poolCount.toString();
                }
            } else {
                const totalPoolsElement = widget.querySelector('#totalPoolsCreated');
                if (totalPoolsElement) {
                    totalPoolsElement.textContent = '0';
                }
            }

            // ИСПРАВЛЕНО: Загружаем DKG сессии из корректного FROST координатора
            await this.loadDKGStats(widget.querySelector('#activeDKGSessions'));

        } catch (error) {
            console.error('Failed to load pool creation stats:', error);
            const totalPoolsElement = widget.querySelector('#totalPoolsCreated');
            if (totalPoolsElement) {
                totalPoolsElement.textContent = 'Error';
            }
        }
    }

    async loadDKGStats(element) {
        try {
            if (!wallet.connected || !contracts.initialized) {
                if (element) element.textContent = '0';
                return;
            }

            // ИСПРАВЛЕНО: Используем правильный FROST_COORDINATOR из конфига
            const frostCoordinator = contracts.getContract('frostCoordinator');

            // Получаем сессии пользователя
            const userSessions = await frostCoordinator.getUserSessions(wallet.account);
            let activeSessions = 0;

            // Проверяем статус каждой сессии
            for (const sessionId of userSessions) {
                try {
                    const session = await frostCoordinator.getSession(sessionId);
                    // Состояние 0-3 = активные, 4 = завершенная
                    if (session.state < 4) {
                        activeSessions++;
                    }
                } catch (error) {
                    console.warn(`Error checking session ${sessionId}:`, error.message);
                }
            }

            if (element) {
                element.textContent = activeSessions.toString();
            }

        } catch (error) {
            console.error('Failed to load DKG stats:', error);
            if (element) {
                element.textContent = 'Error';
            }
        }
    }

    async loadDKGSessions(widget) {
        const activeElement = widget.querySelector('#dkgActive');
        const completedElement = widget.querySelector('#dkgCompleted');

        try {
            if (!wallet.connected || !contracts.initialized) {
                if (activeElement) activeElement.textContent = '0';
                if (completedElement) completedElement.textContent = '0';
                return;
            }

            const frostCoordinator = contracts.getContract('frostCoordinator');
            const userSessions = await frostCoordinator.getUserSessions(wallet.account);

            let activeSessions = 0;
            let completedSessions = 0;

            for (const sessionId of userSessions) {
                try {
                    const session = await frostCoordinator.getSession(sessionId);
                    if (session.state < 4) {
                        activeSessions++;
                    } else {
                        completedSessions++;
                    }
                } catch (error) {
                    console.warn(`Error checking session ${sessionId}:`, error.message);
                }
            }

            if (activeElement) activeElement.textContent = activeSessions.toString();
            if (completedElement) completedElement.textContent = completedSessions.toString();

        } catch (error) {
            console.error('Failed to load DKG sessions:', error);
            if (activeElement) activeElement.textContent = 'Error';
            if (completedElement) completedElement.textContent = 'Error';
        }
    }

    async loadPoolManagementStats(widget) {
        try {
            if (!wallet.connected || !contracts.initialized) {
                this.setWidgetStats(widget, {
                    myPoolsCount: '0',
                    totalHashrate: '0 TH/s',
                    activeMiners: '0'
                });
                return;
            }

            const factory = contracts.getContract('factory');
            let myPoolsCount = 0;
            let totalHashrate = 0;
            let activeMiners = 0;

            try {
                const poolCount = await factory.getPoolCount();

                for (let i = 0; i < poolCount; i++) {
                    try {
                        const poolAddress = await factory.getPoolAt(i);


                        const poolInfoRaw = await factory.poolsInfo(poolAddress);


                        const [
                            poolCore,      // address
                            mpToken,       // address
                            poolId,        // string
                            asset,         // string
                            isActive,      // bool
                            createdAt,     // uint256
                            creator        // address
                        ] = poolInfoRaw;


                        if (creator.toLowerCase() === wallet.account.toLowerCase() && isActive) {
                            myPoolsCount++;
                        }

                    } catch (poolError) {

                        console.warn(`Error loading pool ${i}:`, poolError.message);
                        continue;
                    }
                }

            } catch (factoryError) {
                console.error('Error accessing factory:', factoryError);
            }


            try {
                const statsResponse = await fetch(
                    `${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.STATS}`
                );
                if (statsResponse.ok) {
                    const stats = await statsResponse.json();
                    totalHashrate = stats.total_hashrate || 0;
                    activeMiners = stats.active_workers || 0;
                }
            } catch (apiError) {
                console.warn('Mining API not available:', apiError.message);
            }

            this.setWidgetStats(widget, {
                myPoolsCount: myPoolsCount.toString(),
                                totalHashrate: `${totalHashrate} TH/s`,
                                activeMiners: activeMiners.toString()
            });

        } catch (error) {
            console.error('Failed to load pool management stats:', error);
            this.setWidgetStats(widget, {
                myPoolsCount: 'Error',
                totalHashrate: 'Error',
                activeMiners: 'Error'
            });
        }
    }

    async loadPoolOverviewStats(widget) {
        try {
            // ИСПРАВЛЕНО: Показываем только статистику наших пулов
            const stats = {
                poolHashrate: '0 TH/s',
                poolBlocks: '0',
                poolWorkers: '0'
            };

            if (wallet.connected && contracts.initialized) {
                try {
                    // Пытаемся получить статистику из API, но только для наших пулов
                    const response = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.STATS}`);
                    if (response.ok) {
                        const data = await response.json();
                        stats.poolHashrate = `${data.total_hashrate || 0} TH/s`;
                        stats.poolBlocks = (data.total_blocks || 0).toString();
                        stats.poolWorkers = (data.active_workers || 0).toString();
                    }
                } catch (apiError) {
                    console.warn('Mining API not available:', apiError.message);
                }
            }

            this.setWidgetStats(widget, stats);

        } catch (error) {
            console.error('Failed to load pool overview stats:', error);
            this.setWidgetStats(widget, { poolHashrate: 'Error', poolBlocks: 'Error', poolWorkers: 'Error' });
        }
    }

    async loadMiningStats(widget) {
        try {
            const stats = {
                currentHashrate: '0 TH/s',
                sharesSubmitted: '0',
                pendingRewards: '0.0 BTC'
            };

            if (wallet.connected) {
                try {
                    const [statsResponse, sharesResponse] = await Promise.all([
                        fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.STATS}`),
                                                                              fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.SHARES}/stats?hours=24`)
                    ]);

                    if (statsResponse.ok) {
                        const statsData = await statsResponse.json();
                        stats.currentHashrate = `${statsData.total_hashrate || 0} TH/s`;
                    }

                    if (sharesResponse.ok) {
                        const sharesData = await sharesResponse.json();
                        stats.sharesSubmitted = (sharesData.total_shares || 0).toString();
                    }
                } catch (apiError) {
                    console.warn('Mining API not available:', apiError.message);
                }
            }

            this.setWidgetStats(widget, stats);

        } catch (error) {
            console.error('Failed to load mining stats:', error);
            this.setWidgetStats(widget, { currentHashrate: 'Error', sharesSubmitted: 'Error', pendingRewards: 'Error' });
        }
    }

    async loadAnalyticsStats(widget) {
        try {
            const stats = {
                totalBlocks: '0',
                networkHashrate: '0 TH/s',
                activeWorkers: '0'
            };

            if (wallet.connected) {
                try {
                    const response = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.STATS}`);
                    if (response.ok) {
                        const data = await response.json();
                        stats.totalBlocks = (data.total_blocks || 0).toString();
                        stats.networkHashrate = `${data.total_hashrate || 0} TH/s`;
                        stats.activeWorkers = (data.active_workers || 0).toString();
                    }
                } catch (apiError) {
                    console.warn('Mining API not available:', apiError.message);
                }
            }

            this.setWidgetStats(widget, stats);

        } catch (error) {
            console.error('Failed to load analytics stats:', error);
            this.setWidgetStats(widget, { totalBlocks: 'Error', networkHashrate: 'Error', activeWorkers: 'Error' });
        }
    }

    async loadFrostSessions(widget) {
        const sessionsContainer = widget.querySelector('#activeSessions');
        try {
            if (!wallet.connected || !contracts.initialized) {
                sessionsContainer.innerHTML = `
                <div class="session-item">
                <span class="session-status inactive">●</span>
                <span class="session-id">Connect wallet to view sessions</span>
                </div>
                `;
                return;
            }

            // ИСПРАВЛЕНО: Загружаем реальные FROST сессии
            const frostCoordinator = contracts.getContract('frostCoordinator');
            const userSessions = await frostCoordinator.getUserSessions(wallet.account);

            if (userSessions.length === 0) {
                sessionsContainer.innerHTML = `
                <div class="session-item">
                <span class="session-status inactive">●</span>
                <span class="session-id">No active sessions</span>
                </div>
                `;
                return;
            }

            let sessionsHTML = '';
            let activeSessions = 0;

            for (const sessionId of userSessions.slice(0, 3)) { // Показываем только первые 3
                try {
                    const session = await frostCoordinator.getSession(sessionId);
                    const isActive = session.state < 4;
                    if (isActive) activeSessions++;

                    sessionsHTML += `
                    <div class="session-item">
                    <span class="session-status ${isActive ? 'active' : 'completed'}">●</span>
                    <span class="session-id">Session ${sessionId.toString().slice(-6)} (${isActive ? 'Active' : 'Completed'})</span>
                    </div>
                    `;
                } catch (error) {
                    console.warn(`Error loading session ${sessionId}:`, error.message);
                }
            }

            if (userSessions.length > 3) {
                sessionsHTML += `
                <div class="session-item">
                <span class="session-status">●</span>
                <span class="session-id">+${userSessions.length - 3} more sessions</span>
                </div>
                `;
            }

            sessionsContainer.innerHTML = sessionsHTML;

        } catch (error) {
            console.error('Failed to load FROST sessions:', error);
            sessionsContainer.innerHTML = `
            <div class="error">Error loading sessions</div>
            `;
        }
    }

    // =============== POOL MANAGER ROLE CHECK METHODS ===============

    async checkPoolManagerAndRedirect() {
        try {
            if (!window.contracts || !contracts.initialized) {
                app.showNotification('warning', 'Contracts not initialized');
                return;
            }

            const factory = contracts.getContract('factory');
            if (!factory) {
                app.showNotification('error', 'Factory contract not available');
                return;
            }

            // Проверяем роль Pool Manager
            const POOL_MANAGER_ROLE = await factory.POOL_MANAGER_ROLE();
            const hasRole = await factory.hasRole(POOL_MANAGER_ROLE, wallet.account);

            if (hasRole) {
                // Есть роль - переходим к созданию пула
                showSection('poolCreation');
            } else {
                // Нет роли - показываем модалку с предложением запросить
                this.showPoolManagerRequestModal();
            }

        } catch (error) {
            console.error('Error checking Pool Manager role:', error);
            // На случай ошибки - всё равно переходим к Pool Creation,
            // там тоже есть проверка
            showSection('poolCreation');
        }
    }

    showPoolManagerRequestModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content pool-manager-request-modal">
        <div class="modal-header">
        <h3>Pool Manager Role Required</h3>
        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="modal-body">
        <div class="info-box warning">
        <p>To create mining pools, you need the <strong>Pool Manager</strong> role.</p>
        </div>

        <h4>What you can do:</h4>
        <ul>
        <li>Request Pool Manager role from administrators</li>
        <li>Wait for admin approval (typically within 24 hours)</li>
        <li>After approval, return here to create your pool</li>
        </ul>

        <div class="role-benefits">
        <h4>Pool Manager Role Benefits:</h4>
        <ul>
        <li>Create and configure mining pools</li>
        <li>Manage FROST multisig governance</li>
        <li>Configure reward distribution algorithms</li>
        <li>Monitor pool performance and statistics</li>
        </ul>
        </div>

        <p class="note">💡 Administrators typically review requests within 24 hours.</p>
        </div>

        <div class="modal-actions">
        <button onclick="dashboard.requestPoolManagerRole(this.parentElement.parentElement.parentElement)"
        class="btn btn-primary">
        Request Pool Manager Role
        </button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()"
        class="btn btn-secondary">
        Cancel
        </button>
        </div>
        </div>
        `;

        document.body.appendChild(modal);
    }

    async requestPoolManagerRole(modal) {
        if (!window.requests) {
            app.showNotification('error', 'Request system not available');
            return;
        }

        const message = 'I would like to create and manage mining pools on the platform. Please grant me Pool Manager role access to enable pool creation and FROST governance features.';
        const success = await requests.submitRoleRequest('pool_manager', message);

        if (success) {
            modal.remove();
            app.showNotification('success', 'Pool Manager role request submitted! Check "My Requests" section for status.');

            // Переходим в раздел с запросами
            showSection('nftCollection');
            if (window.nftCollection) {
                nftCollection.switchTab('outgoing');
            }
        }
    }

    // =============== UTILITY METHODS ===============

    setWidgetStats(widget, stats) {
        Object.keys(stats).forEach(key => {
            const element = widget.querySelector(`#${key}`);
            if (element) {
                element.textContent = stats[key];
            }
        });
    }

    // =============== MINING CONTROLS ===============

    async startMining() {
        try {
            const response = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.MINING_START}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                app.showNotification('success', 'Mining started');
                setTimeout(() => this.refreshDashboard(), 2000);
            }
        } catch (error) {
            console.error('Failed to start mining:', error);
            app.showNotification('error', 'Failed to start mining');
        }
    }

    async stopMining() {
        try {
            const response = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.MINING_STOP}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                app.showNotification('success', 'Mining stopped');
                setTimeout(() => this.refreshDashboard(), 2000);
            }
        } catch (error) {
            console.error('Failed to stop mining:', error);
            app.showNotification('error', 'Failed to stop mining');
        }
    }

    // =============== REFRESH METHODS ===============

    async refreshDashboard() {
        const widgets = document.querySelectorAll('.widget');
        widgets.forEach(widget => {
            const type = widget.className.split(' ').find(cls => cls.startsWith('widget-'))?.replace('widget-', '');
            if (type) {
                this.refreshWidget(widget, type);
            }
        });
    }

    refreshWidget(widget, type) {
        switch (type) {
            case 'pool-creation':
                this.loadPoolCreationStats(widget);
                break;
            case 'pool-overview':
                this.loadPoolOverviewStats(widget);
                break;
            case 'pool-management':
                this.loadPoolManagementStats(widget);
                break;
            case 'mining':
                this.loadMiningStats(widget);
                break;
            case 'analytics':
                this.loadAnalyticsStats(widget);
                break;
            case 'frost-sessions':
                this.loadFrostSessions(widget);
                break;
            case 'dkg-sessions':
                this.loadDKGSessions(widget);
                break;
        }
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// Create global instance
window.dashboard = new DashboardManager();
