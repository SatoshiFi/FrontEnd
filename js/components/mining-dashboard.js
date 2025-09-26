// js/components/mining-dashboard.js - ОБНОВЛЕННАЯ ВЕРСИЯ С ПРОВЕРКОЙ РЕГИСТРАЦИИ ПУЛОВ
class MiningDashboard {
    constructor() {
        this.stats = {};
        this.userPools = [];
        this.poolWorkers = {};
        this.refreshInterval = null;
    }

    async initialize() {
        await this.buildMiningInterface();
        await this.loadUserPools();
        this.startAutoRefresh();
    }

    buildMiningInterface() {
        const miningStats = document.getElementById('miningStats');
        const miningControls = document.getElementById('miningControls');

        if (miningControls) {
            miningControls.innerHTML = `
            <div class="mining-controls-container">
            <div class="pool-selector">
            <select id="selectedPool" class="form-select">
            <option value="">Select Pool...</option>
            </select>
            </div>
            <div class="mining-actions">
            <button id="startMining" class="btn btn-success">Start Mining</button>
            <button id="stopMining" class="btn btn-error">Stop Mining</button>
            <button id="refreshStats" class="btn btn-secondary">Refresh</button>
            <button id="syncPools" class="btn btn-primary">Sync Pools</button>
            </div>
            </div>
            `;

            this.bindControlEvents();
        }

        if (miningStats) {
            miningStats.innerHTML = `
            <div class="mining-overview">
            <div class="overview-cards">
            <div class="stat-card">
            <h4>My Pools</h4>
            <div class="stat-value" id="totalPools">0</div>
            </div>
            <div class="stat-card">
            <h4>Active Workers</h4>
            <div class="stat-value" id="activeWorkers">0</div>
            </div>
            <div class="stat-card">
            <h4>Total Hashrate</h4>
            <div class="stat-value" id="totalHashrate">0 GH/s</div>
            </div>
            <div class="stat-card">
            <h4>Pending Rewards</h4>
            <div class="stat-value" id="pendingRewards">0 BTC</div>
            </div>
            </div>
            </div>

            <div class="pools-grid" id="poolsGrid">
            <!-- Pool details will be populated here -->
            </div>

            <div class="workers-section" id="workersSection">
            <h3>Workers</h3>
            <div class="workers-grid" id="workersGrid">
            <!-- Workers will be populated here -->
            </div>
            </div>

            <div class="mining-chart-container">
            <h3>Hashrate Chart</h3>
            <canvas id="hashrateChart" width="800" height="400"></canvas>
            </div>
            `;
        }

        this.refreshStats();
    }

    bindControlEvents() {
        document.getElementById('startMining')?.addEventListener('click', () => {
            this.startMining();
        });

        document.getElementById('stopMining')?.addEventListener('click', () => {
            this.stopMining();
        });

        document.getElementById('refreshStats')?.addEventListener('click', () => {
            this.refreshStats();
        });

        document.getElementById('syncPools')?.addEventListener('click', () => {
            this.loadUserPools();
        });

        document.getElementById('selectedPool')?.addEventListener('change', (e) => {
            this.onPoolSelected(e.target.value);
        });
    }

    // ОБНОВЛЕНО: Добавлена проверка регистрации пулов в CalculatorRegistry
    async loadUserPools() {
        if (!wallet.connected) {
            app.showNotification('warning', 'Please connect wallet first');
            return;
        }

        try {
            app.showLoading('Loading your pools...');

            // Получаем пулы пользователя из смарт-контрактов
            const userNFTs = await contracts.getUserNFTs(wallet.account);
            const membershipNFTs = userNFTs.filter(nft => nft.type === 'membership');

            // ОБНОВЛЕНО: Создаем Map для устранения дубликатов по poolId
            const uniquePoolsMap = new Map();

            for (const nft of membershipNFTs) {
                const poolId = ethers.utils.parseBytes32String(nft.poolId);

                // Если пул уже есть, пропускаем
                if (uniquePoolsMap.has(poolId)) {
                    console.log(`Skipping duplicate pool: ${poolId}`);
                    continue;
                }

                // НОВОЕ: Проверяем регистрацию пула в CalculatorRegistry
                let poolRegistrationStatus = false;
                try {
                    if (window.contracts && contracts.checkPoolRegistration) {
                        // Проверяем по адресу пула (если можем его получить из NFT)
                        poolRegistrationStatus = await contracts.checkPoolRegistration(poolId);
                    }
                } catch (registrationError) {
                    console.warn(`Failed to check registration for pool ${poolId}:`, registrationError);
                    // Продолжаем, но помечаем как нерегистрированный
                    poolRegistrationStatus = false;
                }

                // Если пул не зарегистрирован, показываем предупреждение но включаем в список
                if (!poolRegistrationStatus) {
                    console.warn(`Pool ${poolId} is not registered in CalculatorRegistry - may have limited functionality`);
                }

                try {
                    // Загружаем информацию о пуле из API
                    const poolResponse = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.POOLS}`);
                    let apiPool = null;

                    if (poolResponse.ok) {
                        const poolData = await poolResponse.json();
                        apiPool = poolData.pools?.find(p => p.id === poolId || p.name === poolId);
                    }

                    const poolInfo = {
                        smartContract: nft,
                        apiData: apiPool,
                        poolId: poolId,
                        role: ethers.utils.parseBytes32String(nft.role),
                        active: nft.active,
                        isRegistered: poolRegistrationStatus, // НОВОЕ: флаг регистрации
                        registrationWarning: !poolRegistrationStatus // НОВОЕ: флаг предупреждения
                    };

                    uniquePoolsMap.set(poolId, poolInfo);

                } catch (error) {
                    console.error(`Error loading pool ${poolId}:`, error);
                    // Добавляем пул без API данных
                    uniquePoolsMap.set(poolId, {
                        smartContract: nft,
                        apiData: null,
                        poolId: poolId,
                        role: ethers.utils.parseBytes32String(nft.role),
                                       active: nft.active,
                                       isRegistered: poolRegistrationStatus,
                                       registrationWarning: !poolRegistrationStatus
                    });
                }
            }

            // Преобразуем Map обратно в массив
            this.userPools = Array.from(uniquePoolsMap.values());

            const registeredCount = this.userPools.filter(p => p.isRegistered).length;
            const unregisteredCount = this.userPools.length - registeredCount;

            console.log(`Loaded ${this.userPools.length} unique user pools (${registeredCount} registered, ${unregisteredCount} unregistered)`);

            await this.loadPoolWorkers();
            this.updatePoolSelector();
            this.renderPoolsGrid();
            this.renderWorkersGrid();
            this.updateOverviewStats();

            app.hideLoading();

            if (this.userPools.length === 0) {
                app.showNotification('info', 'No pools found. Create a pool first.');
            } else {
                let message = `Found ${this.userPools.length} unique pool(s)`;
                if (unregisteredCount > 0) {
                    message += ` (${unregisteredCount} with limited functionality)`;
                }
                app.showNotification('success', message);
            }

        } catch (error) {
            app.hideLoading();
            console.error('Error loading user pools:', error);
            app.showNotification('error', 'Failed to load pools');
        }
    }

    async loadPoolWorkers() {
        try {
            const workersResponse = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.WORKERS}`);
            if (!workersResponse.ok) throw new Error('Failed to fetch workers');

            const workersData = await workersResponse.json();
            const allWorkers = workersData.workers || [];

            // Группируем воркеров по пулам
            this.poolWorkers = {};

            for (const pool of this.userPools) {
                const poolWorkers = allWorkers.filter(worker => {
                    // Ищем воркеров, которые подключены к этому пулу
                    return worker.pool_id === pool.poolId ||
                    worker.pool_name === pool.poolId ||
                    (pool.apiData && worker.pool_id === pool.apiData.id);
                });

                this.poolWorkers[pool.poolId] = poolWorkers;
            }

        } catch (error) {
            console.error('Error loading pool workers:', error);
            this.poolWorkers = {};
        }
    }

    updatePoolSelector() {
        const selector = document.getElementById('selectedPool');
        if (!selector) return;

        selector.innerHTML = '<option value="">Select Pool...</option>';

        this.userPools.forEach(pool => {
            const option = document.createElement('option');
            option.value = pool.poolId;

            // НОВОЕ: Показываем статус регистрации в селекторе
            const statusIndicator = pool.isRegistered ? 'checkmark' : 'warning';
            option.textContent = `${pool.isRegistered ? '✓' : '⚠'} ${pool.poolId} (${pool.role})`;

            // Помечаем нерегистрированные пулы как ограниченные
            if (!pool.isRegistered) {
                option.style.color = '#f59e0b';
                option.title = 'Pool not registered - limited functionality';
            }

            selector.appendChild(option);
        });
    }

    renderPoolsGrid() {
        const poolsGrid = document.getElementById('poolsGrid');
        if (!poolsGrid) return;

        if (this.userPools.length === 0) {
            poolsGrid.innerHTML = `
            <div class="empty-state">
            <h3>No Mining Pools</h3>
            <p>You haven't joined any mining pools yet.</p>
            <button class="btn btn-primary" onclick="showSection('poolCreation')">
            Create Pool
            </button>
            </div>
            `;
            return;
        }

        poolsGrid.innerHTML = this.userPools.map(pool => this.renderPoolCard(pool)).join('');
    }

    renderPoolCard(pool) {
        const workers = this.poolWorkers[pool.poolId] || [];
        const activeWorkers = workers.filter(w => w.status === 'active').length;
        const totalHashrate = workers.reduce((sum, w) => sum + (w.hashrate || 0), 0);

        return `
        <div class="pool-card ${pool.active ? 'active' : 'inactive'} ${pool.registrationWarning ? 'unregistered' : ''}">
        <div class="pool-header">
        <h4>
        ${pool.isRegistered ? '✅' : '⚠️'} ${pool.poolId}
        ${pool.registrationWarning ? '<small class="registration-warning">Limited functionality</small>' : ''}
        </h4>
        <span class="pool-status ${pool.active ? 'active' : 'inactive'}">
        ${pool.active ? 'Active' : 'Inactive'}
        </span>
        </div>
        <div class="pool-info">
        <div class="info-row">
        <span class="label">Role:</span>
        <span class="value">${pool.role}</span>
        </div>
        <div class="info-row">
        <span class="label">Workers:</span>
        <span class="value">${activeWorkers}/${workers.length}</span>
        </div>
        <div class="info-row">
        <span class="label">Hashrate:</span>
        <span class="value">${(totalHashrate / 1e9).toFixed(2)} GH/s</span>
        </div>
        <div class="info-row">
        <span class="label">Registration:</span>
        <span class="value ${pool.isRegistered ? 'registered' : 'unregistered'}">
        ${pool.isRegistered ? 'Registered' : 'Not Registered'}
        </span>
        </div>
        ${pool.apiData ? `
            <div class="info-row">
            <span class="label">Fee:</span>
            <span class="value">${(pool.apiData.fee_percentage * 100).toFixed(2)}%</span>
            </div>
            <div class="info-row">
            <span class="label">Blocks Found:</span>
            <span class="value">${pool.apiData.blocks_found || 0}</span>
            </div>
            ` : pool.registrationWarning ? `
            <div class="pool-warning">
            <span>⚠️ Pool not registered in Calculator Registry</span>
            </div>
            ` : `
            <div class="pool-warning">
            <span>⚠️ Pool not found in mining simulator</span>
            </div>
            `}
            </div>
            <div class="pool-actions">
            <button class="btn btn-sm btn-primary" onclick="miningDashboard.selectPool('${pool.poolId}')">
            Select
            </button>
            ${pool.apiData && pool.isRegistered ? `
                <button class="btn btn-sm btn-success" onclick="miningDashboard.startPoolMining('${pool.poolId}')">
                Start Mining
                </button>
                ` : `
                <button class="btn btn-sm btn-secondary" disabled
                title="${!pool.isRegistered ? 'Pool not registered' : 'Pool not available in simulator'}">
                ${!pool.isRegistered ? 'Not Registered' : 'Not Available'}
                </button>
                `}
                </div>
                </div>
                `;
    }

    renderWorkersGrid() {
        const workersGrid = document.getElementById('workersGrid');
        if (!workersGrid) return;

        let allWorkers = [];
        Object.values(this.poolWorkers).forEach(workers => {
            allWorkers = allWorkers.concat(workers);
        });

        if (allWorkers.length === 0) {
            workersGrid.innerHTML = `
            <div class="empty-state">
            <p>No workers found for your pools</p>
            </div>
            `;
            return;
        }

        workersGrid.innerHTML = allWorkers.map(worker => this.renderWorkerCard(worker)).join('');
    }

    renderWorkerCard(worker) {
        const statusClass = worker.status === 'active' ? 'success' :
        worker.status === 'inactive' ? 'warning' : 'error';

        return `
        <div class="worker-card">
        <div class="worker-header">
        <h5>${worker.name}</h5>
        <span class="worker-status ${statusClass}">
        ${worker.status}
        </span>
        </div>
        <div class="worker-stats">
        <div class="worker-stat">
        <span class="label">Hashrate:</span>
        <span class="value">${(worker.hashrate / 1e6).toFixed(2)} MH/s</span>
        </div>
        <div class="worker-stat">
        <span class="label">Shares:</span>
        <span class="value">${worker.shares_submitted || 0}</span>
        </div>
        <div class="worker-stat">
        <span class="label">Last Seen:</span>
        <span class="value">${new Date(worker.last_seen).toLocaleTimeString()}</span>
        </div>
        </div>
        </div>
        `;
    }

    updateOverviewStats() {
        const totalPools = this.userPools.length;
        const registeredPools = this.userPools.filter(p => p.isRegistered).length;
        let activeWorkers = 0;
        let totalHashrate = 0;

        Object.values(this.poolWorkers).forEach(workers => {
            activeWorkers += workers.filter(w => w.status === 'active').length;
            totalHashrate += workers.reduce((sum, w) => sum + (w.hashrate || 0), 0);
        });

        document.getElementById('totalPools').textContent = `${totalPools} (${registeredPools} reg.)`;
        document.getElementById('activeWorkers').textContent = activeWorkers;
        document.getElementById('totalHashrate').textContent = `${(totalHashrate / 1e9).toFixed(2)} GH/s`;
        document.getElementById('pendingRewards').textContent = '0.0 BTC'; // TODO: Calculate from API
    }

    selectPool(poolId) {
        const selector = document.getElementById('selectedPool');
        if (selector) {
            selector.value = poolId;
            this.onPoolSelected(poolId);
        }
    }

    onPoolSelected(poolId) {
        if (!poolId) return;

        const pool = this.userPools.find(p => p.poolId === poolId);
        const workers = this.poolWorkers[poolId] || [];

        if (pool && !pool.isRegistered) {
            app.showNotification('warning', `Pool ${poolId} is not registered - mining functionality may be limited`);
        } else {
            app.showNotification('info', `Selected pool: ${poolId} (${workers.length} workers)`);
        }

        // Обновляем отображение для выбранного пула
        this.highlightSelectedPool(poolId);
    }

    highlightSelectedPool(poolId) {
        // Убираем выделение со всех пулов
        document.querySelectorAll('.pool-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Выделяем выбранный пул
        const poolCards = document.querySelectorAll('.pool-card');
        poolCards.forEach(card => {
            const title = card.querySelector('h4').textContent;
            if (title.includes(poolId)) {
                card.classList.add('selected');
            }
        });
    }

    async startPoolMining(poolId) {
        try {
            const pool = this.userPools.find(p => p.poolId === poolId);

            if (!pool) {
                app.showNotification('error', 'Pool not found');
                return;
            }

            if (!pool.isRegistered) {
                app.showNotification('error', 'Cannot start mining - pool not registered in Calculator Registry');
                return;
            }

            if (!pool.apiData) {
                app.showNotification('error', 'Pool not available in mining simulator');
                return;
            }

            app.showLoading('Starting mining for pool...');

            const response = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.MINING_START}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pool_id: poolId,
                    user_address: wallet.account
                })
            });

            if (response.ok) {
                app.showNotification('success', `Mining started for pool: ${poolId}`);
                setTimeout(() => this.refreshStats(), 2000);
            } else {
                throw new Error('Failed to start mining');
            }

            app.hideLoading();

        } catch (error) {
            app.hideLoading();
            console.error('Failed to start pool mining:', error);
            app.showNotification('error', `Failed to start mining: ${error.message}`);
        }
    }

    async refreshStats() {
        try {
            // Обновляем данные пулов и воркеров
            await this.loadPoolWorkers();
            this.updateOverviewStats();
            this.renderWorkersGrid();

            // Обновляем карточки пулов
            this.renderPoolsGrid();

        } catch (error) {
            console.error('Failed to refresh mining stats:', error);
        }
    }

    async startMining() {
        const selectedPool = document.getElementById('selectedPool')?.value;

        if (!selectedPool) {
            app.showNotification('warning', 'Please select a pool first');
            return;
        }

        await this.startPoolMining(selectedPool);
    }

    async stopMining() {
        try {
            app.showLoading('Stopping mining...');

            const response = await fetch(`${CONFIG.API.MINING}${CONFIG.API.ENDPOINTS.MINING_STOP}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_address: wallet.account
                })
            });

            if (response.ok) {
                app.showNotification('success', 'Mining stopped');
                setTimeout(() => this.refreshStats(), 2000);
            } else {
                throw new Error('Failed to stop mining');
            }

            app.hideLoading();

        } catch (error) {
            app.hideLoading();
            console.error('Failed to stop mining:', error);
            app.showNotification('error', `Failed to stop mining: ${error.message}`);
        }
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            if (CONFIG.UI_CONFIG.AUTO_REFRESH && wallet.connected) {
                this.refreshStats();
            }
        }, CONFIG.APP_SETTINGS.POLLING_INTERVAL);
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.userPools = [];
        this.poolWorkers = {};
    }
}

// Initialize when mining dashboard section becomes active
document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.id === 'miningDashboard' && target.classList.contains('active')) {
                    if (window.miningDashboard && wallet.connected) {
                        miningDashboard.initialize();
                    }
                }
            }
        });
    });

    const miningDashboardSection = document.getElementById('miningDashboard');
    if (miningDashboardSection) {
        observer.observe(miningDashboardSection, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
});

// Global instance
window.miningDashboard = new MiningDashboard();
