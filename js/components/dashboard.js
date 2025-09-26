// js/components/dashboard.js - ПОЛНАЯ ОБНОВЛЕННАЯ ВЕРСИЯ С ИСПРАВЛЕННЫМИ API
class DashboardManager {
    constructor() {
        this.widgets = {};
        this.refreshInterval = null;
    }

    async initialize() {
        await this.buildDashboard();
        // Автообновления отключены
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
            case 'custody':
                return this.createCustodyWidget(widget);
            case 'dkg-sessions':
                return this.createDKGSessionsWidget(widget);
            case 'analytics':
                return this.createAnalyticsWidget(widget);
            case 'rewards':
                return this.createRewardsWidget(widget);
            case 'participants':
                return this.createParticipantsWidget(widget);
            case 'security':
                return this.createSecurityWidget(widget);
            case 'mining-stats':
                return this.createMiningStatsWidget(widget);
            case 'payouts':
                return this.createPayoutsWidget(widget);
            case 'pool-stats':
                return this.createPoolStatsWidget(widget);
            case 'hardware':
                return this.createHardwareWidget(widget);
            case 'frost-signatures':
                return this.createFrostSignaturesWidget(widget);
            case 'keys':
                return this.createKeysWidget(widget);
            case 'invitations':
                return this.createInvitationsWidget(widget);
            case 'sessions':
                return this.createSessionsWidget(widget);
            default:
                return this.createGenericWidget(widget, type);
        }
    }

    createPoolCreationWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Create Pool</h3>
        <a href="#" class="widget-action" onclick="showSection('poolCreation')">Create →</a>
        </div>
        <div class="widget-content">
        <p>Create a new mining pool through FROST DKG</p>
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="activeDKGSessions">0</span>
        <span class="stat-label">Active DKG</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="totalPoolsCreated">0</span>
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

    createCustodyWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Custody Management</h3>
        <a href="#" class="widget-action">Signatures →</a>
        </div>
        <div class="widget-content">
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="pendingSignatures">0</span>
        <span class="stat-label">Pending Signatures</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="totalKeys">0</span>
        <span class="stat-label">Managed Keys</span>
        </div>
        </div>
        </div>
        `;
        return widget;
    }

    createParticipantsWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Participants</h3>
        <a href="#" class="widget-action">Manage →</a>
        </div>
        <div class="widget-content">
        <div id="participantsList">
        <div class="loading">Loading participants...</div>
        </div>
        </div>
        `;
        this.loadParticipants(widget);
        return widget;
    }

    createSecurityWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Security Status</h3>
        <a href="#" class="widget-action">Settings →</a>
        </div>
        <div class="widget-content">
        <div class="security-status">
        <div class="status-item">
        <span class="status-indicator status-success"></span>
        <span>Wallet Connected</span>
        </div>
        <div class="status-item">
        <span class="status-indicator status-success"></span>
        <span>FROST Active</span>
        </div>
        <div class="status-item">
        <span class="status-indicator status-warning"></span>
        <span>2FA Recommended</span>
        </div>
        </div>
        </div>
        `;
        return widget;
    }

    createMiningStatsWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Mining Statistics</h3>
        <a href="#" class="widget-action">Details →</a>
        </div>
        <div class="widget-content">
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="miningUptime">-</span>
        <span class="stat-label">Uptime</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="averageHashrate">-</span>
        <span class="stat-label">Avg Hashrate</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="validityRate">-</span>
        <span class="stat-label">Share Validity</span>
        </div>
        </div>
        </div>
        `;
        this.loadMiningStatsData(widget);
        return widget;
    }

    createPayoutsWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Payouts</h3>
        <a href="#" class="widget-action">History →</a>
        </div>
        <div class="widget-content">
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="totalPaid">0.0 BTC</span>
        <span class="stat-label">Total Paid</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="lastPayoutAmount">0.0 BTC</span>
        <span class="stat-label">Last Payout</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="nextPayout">24h</span>
        <span class="stat-label">Next Payout</span>
        </div>
        </div>
        </div>
        `;
        return widget;
    }

    createPoolStatsWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Pool Statistics</h3>
        <a href="#" class="widget-action">Details →</a>
        </div>
        <div class="widget-content">
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="poolEfficiency">-</span>
        <span class="stat-label">Pool Efficiency</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="poolLuck">-</span>
        <span class="stat-label">Pool Luck</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="poolFee">-</span>
        <span class="stat-label">Pool Fee</span>
        </div>
        </div>
        </div>
        `;
        this.loadPoolStatsData(widget);
        return widget;
    }

    createHardwareWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Hardware Status</h3>
        <a href="#" class="widget-action">Monitor →</a>
        </div>
        <div class="widget-content">
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="deviceTemp">-</span>
        <span class="stat-label">Temperature</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="powerDraw">-</span>
        <span class="stat-label">Power Draw</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="fanSpeed">-</span>
        <span class="stat-label">Fan Speed</span>
        </div>
        </div>
        </div>
        `;
        return widget;
    }

    createFrostSignaturesWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">FROST Signatures</h3>
        <a href="#" class="widget-action">Sign →</a>
        </div>
        <div class="widget-content">
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="pendingSigs">0</span>
        <span class="stat-label">Pending</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="completedSigs">0</span>
        <span class="stat-label">Completed</span>
        </div>
        </div>
        </div>
        `;
        return widget;
    }

    createKeysWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Key Management</h3>
        <a href="#" class="widget-action">Manage →</a>
        </div>
        <div class="widget-content">
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="activeKeys">0</span>
        <span class="stat-label">Active Keys</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="keyShares">0</span>
        <span class="stat-label">Key Shares</span>
        </div>
        </div>
        </div>
        `;
        return widget;
    }

    createInvitationsWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">Invitations</h3>
        <a href="#" class="widget-action">Send →</a>
        </div>
        <div class="widget-content">
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="sentInvites">0</span>
        <span class="stat-label">Sent</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="pendingInvites">0</span>
        <span class="stat-label">Pending</span>
        </div>
        </div>
        </div>
        `;
        return widget;
    }

    createSessionsWidget(widget) {
        widget.innerHTML = `
        <div class="widget-header">
        <h3 class="widget-title">DKG Sessions</h3>
        <a href="#" class="widget-action">Create →</a>
        </div>
        <div class="widget-content">
        <div class="widget-stats">
        <div class="stat">
        <span class="stat-value" id="activeSessions">0</span>
        <span class="stat-label">Active</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="completedSessions">0</span>
        <span class="stat-label">Completed</span>
        </div>
        </div>
        </div>
        `;
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
        <span class="stat-value" id="dkgActive">0</span>
        <span class="stat-label">Active DKG</span>
        </div>
        <div class="stat">
        <span class="stat-value" id="dkgCompleted">0</span>
        <span class="stat-label">Completed</span>
        </div>
        </div>
        </div>
        `;
        return widget;
    }

    createGenericWidget(widget, type) {
        const typeConfig = {
            'dkg-sessions': { title: 'DKG Sessions', icon: '🔐' },
            'pool-overview': { title: 'Pool Overview', icon: '📊' }
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
            // ИСПРАВЛЕНО: правильное формирование URL
            const response = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.POOLS}`);
            if (response.ok) {
                const data = await response.json();
                const pools = data.pools || [];

                const totalPoolsElement = widget.querySelector('#totalPoolsCreated');
                if (totalPoolsElement) {
                    totalPoolsElement.textContent = pools.length;
                }
            }
        } catch (error) {
            console.error('Failed to load pool creation stats:', error);
        }
    }

    async loadPoolOverviewStats(widget) {
        try {
            // ИСПРАВЛЕНО: используем правильный endpoint
            const response = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.STATS}`);
            if (response.ok) {
                const stats = await response.json();

                const hashrateElement = widget.querySelector('#poolHashrate');
                const blocksElement = widget.querySelector('#poolBlocks');
                const workersElement = widget.querySelector('#poolWorkers');

                if (hashrateElement) hashrateElement.textContent = `${stats.total_hashrate || 0} TH/s`;
                if (blocksElement) blocksElement.textContent = stats.total_blocks || 0;
                if (workersElement) workersElement.textContent = stats.active_workers || 0;
            }
        } catch (error) {
            console.error('Failed to load pool overview stats:', error);
        }
    }

    async loadPoolManagementStats(widget) {
        try {
            // ИСПРАВЛЕНО: правильные endpoints
            const response = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.POOLS}`);
            if (response.ok) {
                const data = await response.json();
                const pools = data.pools || [];

                const myPoolsElement = widget.querySelector('#myPoolsCount');
                if (myPoolsElement) {
                    myPoolsElement.textContent = pools.length;
                }
            }

            const statsResponse = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.STATS}`);
            if (statsResponse.ok) {
                const stats = await statsResponse.json();

                const hashrateElement = widget.querySelector('#totalHashrate');
                const minersElement = widget.querySelector('#activeMiners');

                if (hashrateElement) hashrateElement.textContent = `${stats.total_hashrate || 0} TH/s`;
                if (minersElement) minersElement.textContent = stats.active_workers || 0;
            }
        } catch (error) {
            console.error('Failed to load pool management stats:', error);
        }
    }

    async loadMiningStats(widget) {
        try {
            const [statsResponse, sharesResponse] = await Promise.all([
                fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.STATS}`),
                                                                      fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.SHARES}/stats?hours=24`)
            ]);

            if (statsResponse.ok) {
                const stats = await statsResponse.json();
                const hashrateElement = widget.querySelector('#currentHashrate');
                if (hashrateElement) {
                    hashrateElement.textContent = `${stats.total_hashrate || 0} TH/s`;
                }
            }

            if (sharesResponse.ok) {
                const shares = await sharesResponse.json();
                const sharesElement = widget.querySelector('#sharesSubmitted');
                if (sharesElement) {
                    sharesElement.textContent = shares.total_shares || 0;
                }
            }
        } catch (error) {
            console.error('Failed to load mining stats:', error);
        }
    }

    async loadAnalyticsStats(widget) {
        try {
            const response = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.STATS}`);
            if (response.ok) {
                const data = await response.json();

                const blocksElement = widget.querySelector('#totalBlocks');
                const hashrateElement = widget.querySelector('#networkHashrate');
                const workersElement = widget.querySelector('#activeWorkers');

                if (blocksElement) blocksElement.textContent = data.total_blocks || 0;
                if (hashrateElement) hashrateElement.textContent = `${data.total_hashrate || 0} TH/s`;
                if (workersElement) workersElement.textContent = data.active_workers || 0;
            }
        } catch (error) {
            console.error('Failed to load analytics stats:', error);
        }
    }

    async loadMiningStatsData(widget) {
        try {
            const response = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.SHARES}/stats?hours=24`);
            if (response.ok) {
                const stats = await response.json();

                const uptimeElement = widget.querySelector('#miningUptime');
                const avgHashrateElement = widget.querySelector('#averageHashrate');
                const validityElement = widget.querySelector('#validityRate');

                if (uptimeElement) uptimeElement.textContent = '24h';
                if (avgHashrateElement) avgHashrateElement.textContent = `${stats.shares_per_hour || 0}/h`;
                if (validityElement) validityElement.textContent = `${stats.validity_rate || 0}%`;
            }
        } catch (error) {
            console.error('Failed to load mining stats data:', error);
        }
    }

    async loadPoolStatsData(widget) {
        try {
            const response = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.POOLS}`);
            if (response.ok) {
                const data = await response.json();
                const pools = data.pools || [];

                const efficiencyElement = widget.querySelector('#poolEfficiency');
                const luckElement = widget.querySelector('#poolLuck');
                const feeElement = widget.querySelector('#poolFee');

                if (pools.length > 0) {
                    const pool = pools[0];
                    if (efficiencyElement) efficiencyElement.textContent = '99.5%';
                    if (luckElement) luckElement.textContent = '101.2%';
                    if (feeElement) feeElement.textContent = `${(pool.fee_percentage * 100).toFixed(1)}%`;
                }
            }
        } catch (error) {
            console.error('Failed to load pool stats data:', error);
        }
    }

    async loadFrostSessions(widget) {
        const sessionsContainer = widget.querySelector('#activeSessions');
        try {
            if (wallet.connected) {
                sessionsContainer.innerHTML = `
                <div class="session-item">
                <span class="session-status active">●</span>
                <span class="session-id">No active sessions</span>
                </div>
                `;
            } else {
                sessionsContainer.innerHTML = `
                <div class="session-item">
                <span class="session-status inactive">●</span>
                <span class="session-id">Connect wallet to view sessions</span>
                </div>
                `;
            }
        } catch (error) {
            sessionsContainer.innerHTML = `
            <div class="error">Error loading sessions</div>
            `;
        }
    }

    async loadParticipants(widget) {
        const participantsContainer = widget.querySelector('#participantsList');
        try {
            const response = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.WORKERS}`);
            if (response.ok) {
                const data = await response.json();
                const workers = data.workers || [];

                if (workers.length > 0) {
                    participantsContainer.innerHTML = workers.slice(0, 3).map(worker => `
                    <div class="participant-item">
                    <span class="participant-name">${worker.name}</span>
                    <span class="participant-status ${worker.status}">${worker.status}</span>
                    </div>
                    `).join('');
                } else {
                    participantsContainer.innerHTML = '<p>No participants yet</p>';
                }
            }
        } catch (error) {
            console.error('Failed to load participants:', error);
            participantsContainer.innerHTML = '<div class="error">Error loading participants</div>';
        }
    }

    // =============== MINING CONTROLS - ИСПРАВЛЕНО ===============

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

    // =============== УБРАНЫ АВТООБНОВЛЕНИЯ ===============

    startAutoRefresh() {
        // ОТКЛЮЧЕНО - автообновления не используются
        console.log('Auto-refresh is disabled per configuration');
    }

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
            case 'participants':
                this.loadParticipants(widget);
                break;
            case 'frost-sessions':
                this.loadFrostSessions(widget);
                break;
            case 'mining-stats':
                this.loadMiningStatsData(widget);
                break;
            case 'pool-stats':
                this.loadPoolStatsData(widget);
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
