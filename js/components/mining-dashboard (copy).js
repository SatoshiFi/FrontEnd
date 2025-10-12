// js/components/mining-dashboard.js - ÐžÐ‘ÐÐžÐ’Ð›Ð•ÐÐÐÐ¯ Ð’Ð•Ð Ð¡Ð˜Ð¯ Ð¡ ÐŸÐ ÐžÐ’Ð•Ð ÐšÐžÐ™ Ð Ð•Ð“Ð˜Ð¡Ð¢Ð ÐÐ¦Ð˜Ð˜ ÐŸÐ£Ð›ÐžÐ’
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
            <button id="browseWorkers" class="btn btn-primary">Browse Workers</button>
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

        document.getElementById('browseWorkers')?.addEventListener('click', () => {
            this.showBrowseWorkersInterface();
        });
    }

    // ÐžÐ‘ÐÐžÐ’Ð›Ð•ÐÐž: Ð”Ð¾Ð±Ð°Ð²Ð»ÐµÐ½Ð° Ð¿Ñ€Ð¾Ð²ÐµÑ€ÐºÐ° Ñ€ÐµÐ³Ð¸ÑÑ‚Ñ€Ð°Ñ†Ð¸Ð¸ Ð¿ÑƒÐ»Ð¾Ð² Ð² CalculatorRegistry
    async loadUserPools() {
        if (!wallet.connected) {
            app.showNotification('warning', 'Please connect wallet first');
            return;
        }

        try {
            app.showLoading('Loading your pools...');

            // ÐŸÐ¾Ð»ÑƒÑ‡Ð°ÐµÐ¼ Ð¿ÑƒÐ»Ñ‹ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ Ð¸Ð· ÑÐ¼Ð°Ñ€Ñ‚-ÐºÐ¾Ð½Ñ‚Ñ€Ð°ÐºÑ‚Ð¾Ð²
            const userNFTs = await contracts.getUserNFTs(wallet.account);
            const membershipNFTs = userNFTs.filter(nft => nft.type === 'membership');

            // ÐžÐ‘ÐÐžÐ’Ð›Ð•ÐÐž: Ð¡Ð¾Ð·Ð´Ð°ÐµÐ¼ Map Ð´Ð»Ñ ÑƒÑÑ‚Ñ€Ð°Ð½ÐµÐ½Ð¸Ñ Ð´ÑƒÐ±Ð»Ð¸ÐºÐ°Ñ‚Ð¾Ð² Ð¿Ð¾ poolId
            const uniquePoolsMap = new Map();

            for (const nft of membershipNFTs) {
                const poolId = ethers.utils.parseBytes32String(nft.poolId);

                // Ð•ÑÐ»Ð¸ Ð¿ÑƒÐ» ÑƒÐ¶Ðµ ÐµÑÑ‚ÑŒ, Ð¿Ñ€Ð¾Ð¿ÑƒÑÐºÐ°ÐµÐ¼
                if (uniquePoolsMap.has(poolId)) {
                    console.log(`Skipping duplicate pool: ${poolId}`);
                    continue;
                }

                // ÐÐžÐ’ÐžÐ•: ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼ Ñ€ÐµÐ³Ð¸ÑÑ‚Ñ€Ð°Ñ†Ð¸ÑŽ Ð¿ÑƒÐ»Ð° Ð² CalculatorRegistry
                let poolRegistrationStatus = false;
                try {
                    if (window.contracts && contracts.checkPoolRegistration) {
                        // ÐŸÑ€Ð¾Ð²ÐµÑ€ÑÐµÐ¼ Ð¿Ð¾ Ð°Ð´Ñ€ÐµÑÑƒ Ð¿ÑƒÐ»Ð° (ÐµÑÐ»Ð¸ Ð¼Ð¾Ð¶ÐµÐ¼ ÐµÐ³Ð¾ Ð¿Ð¾Ð»ÑƒÑ‡Ð¸Ñ‚ÑŒ Ð¸Ð· NFT)
                        poolRegistrationStatus = await contracts.checkPoolRegistration(poolId);
                    }
                } catch (registrationError) {
                    console.warn(`Failed to check registration for pool ${poolId}:`, registrationError);
                    // ÐŸÑ€Ð¾Ð´Ð¾Ð»Ð¶Ð°ÐµÐ¼, Ð½Ð¾ Ð¿Ð¾Ð¼ÐµÑ‡Ð°ÐµÐ¼ ÐºÐ°Ðº Ð½ÐµÑ€ÐµÐ³Ð¸ÑÑ‚Ñ€Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð½Ñ‹Ð¹
                    poolRegistrationStatus = false;
                }

                // Ð•ÑÐ»Ð¸ Ð¿ÑƒÐ» Ð½Ðµ Ð·Ð°Ñ€ÐµÐ³Ð¸ÑÑ‚Ñ€Ð¸Ñ€Ð¾Ð²Ð°Ð½, Ð¿Ð¾ÐºÐ°Ð·Ñ‹Ð²Ð°ÐµÐ¼ Ð¿Ñ€ÐµÐ´ÑƒÐ¿Ñ€ÐµÐ¶Ð´ÐµÐ½Ð¸Ðµ Ð½Ð¾ Ð²ÐºÐ»ÑŽÑ‡Ð°ÐµÐ¼ Ð² ÑÐ¿Ð¸ÑÐ¾Ðº
                if (!poolRegistrationStatus) {
                    console.warn(`Pool ${poolId} is not registered in CalculatorRegistry - may have limited functionality`);
                }

                try {
                    // Ð—Ð°Ð³Ñ€ÑƒÐ¶Ð°ÐµÐ¼ Ð¸Ð½Ñ„Ð¾Ñ€Ð¼Ð°Ñ†Ð¸ÑŽ Ð¾ Ð¿ÑƒÐ»Ðµ Ð¸Ð· API
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
                        isRegistered: poolRegistrationStatus, // ÐÐžÐ’ÐžÐ•: Ñ„Ð»Ð°Ð³ Ñ€ÐµÐ³Ð¸ÑÑ‚Ñ€Ð°Ñ†Ð¸Ð¸
                        registrationWarning: !poolRegistrationStatus // ÐÐžÐ’ÐžÐ•: Ñ„Ð»Ð°Ð³ Ð¿Ñ€ÐµÐ´ÑƒÐ¿Ñ€ÐµÐ¶Ð´ÐµÐ½Ð¸Ñ
                    };

                    uniquePoolsMap.set(poolId, poolInfo);

                } catch (error) {
                    console.error(`Error loading pool ${poolId}:`, error);
                    // Ð”Ð¾Ð±Ð°Ð²Ð»ÑÐµÐ¼ Ð¿ÑƒÐ» Ð±ÐµÐ· API Ð´Ð°Ð½Ð½Ñ‹Ñ…
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

            // ÐŸÑ€ÐµÐ¾Ð±Ñ€Ð°Ð·ÑƒÐµÐ¼ Map Ð¾Ð±Ñ€Ð°Ñ‚Ð½Ð¾ Ð² Ð¼Ð°ÑÑÐ¸Ð²
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

            // Ð“Ñ€ÑƒÐ¿Ð¿Ð¸Ñ€ÑƒÐµÐ¼ Ð²Ð¾Ñ€ÐºÐµÑ€Ð¾Ð² Ð¿Ð¾ Ð¿ÑƒÐ»Ð°Ð¼
            this.poolWorkers = {};

            for (const pool of this.userPools) {
                const poolWorkers = allWorkers.filter(worker => {
                    // Ð˜Ñ‰ÐµÐ¼ Ð²Ð¾Ñ€ÐºÐµÑ€Ð¾Ð², ÐºÐ¾Ñ‚Ð¾Ñ€Ñ‹Ðµ Ð¿Ð¾Ð´ÐºÐ»ÑŽÑ‡ÐµÐ½Ñ‹ Ðº ÑÑ‚Ð¾Ð¼Ñƒ Ð¿ÑƒÐ»Ñƒ
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

            // ÐÐžÐ’ÐžÐ•: ÐŸÐ¾ÐºÐ°Ð·Ñ‹Ð²Ð°ÐµÐ¼ ÑÑ‚Ð°Ñ‚ÑƒÑ Ñ€ÐµÐ³Ð¸ÑÑ‚Ñ€Ð°Ñ†Ð¸Ð¸ Ð² ÑÐµÐ»ÐµÐºÑ‚Ð¾Ñ€Ðµ
            const statusIndicator = pool.isRegistered ? 'checkmark' : 'warning';
            option.textContent = `${pool.isRegistered ? 'âœ“' : 'âš '} ${pool.poolId} (${pool.role})`;

            // ÐŸÐ¾Ð¼ÐµÑ‡Ð°ÐµÐ¼ Ð½ÐµÑ€ÐµÐ³Ð¸ÑÑ‚Ñ€Ð¸Ñ€Ð¾Ð²Ð°Ð½Ð½Ñ‹Ðµ Ð¿ÑƒÐ»Ñ‹ ÐºÐ°Ðº Ð¾Ð³Ñ€Ð°Ð½Ð¸Ñ‡ÐµÐ½Ð½Ñ‹Ðµ
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
        ${pool.isRegistered ? 'âœ…' : 'âš ï¸'} ${pool.poolId}
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
            <span>âš ï¸ Pool not registered in Calculator Registry</span>
            </div>
            ` : `
            <div class="pool-warning">
            <span>âš ï¸ Pool not found in mining simulator</span>
            </div>
            `}
            </div>

            <div class="pool-actions">
            <button class="btn btn-sm btn-primary" onclick="miningDashboard.selectPool('${pool.poolId}')">
            Select
            </button>

            <button class="btn btn-sm btn-success"
            onclick="miningDashboard.showStratumWorkerRegistrationModal(${JSON.stringify(pool).replace(/"/g, '&quot;')})">
            ➕ Register Stratum Worker
            </button>

            ${pool.apiData && pool.isRegistered ? `
                <button class="btn btn-sm btn-outline" onclick="miningDashboard.startPoolMining('${pool.poolId}')">
                Start Mining
                </button>
                ` : ''}
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

        // ÐžÐ±Ð½Ð¾Ð²Ð»ÑÐµÐ¼ Ð¾Ñ‚Ð¾Ð±Ñ€Ð°Ð¶ÐµÐ½Ð¸Ðµ Ð´Ð»Ñ Ð²Ñ‹Ð±Ñ€Ð°Ð½Ð½Ð¾Ð³Ð¾ Ð¿ÑƒÐ»Ð°
        this.highlightSelectedPool(poolId);
    }

    highlightSelectedPool(poolId) {
        // Ð£Ð±Ð¸Ñ€Ð°ÐµÐ¼ Ð²Ñ‹Ð´ÐµÐ»ÐµÐ½Ð¸Ðµ ÑÐ¾ Ð²ÑÐµÑ… Ð¿ÑƒÐ»Ð¾Ð²
        document.querySelectorAll('.pool-card').forEach(card => {
            card.classList.remove('selected');
        });

        // Ð’Ñ‹Ð´ÐµÐ»ÑÐµÐ¼ Ð²Ñ‹Ð±Ñ€Ð°Ð½Ð½Ñ‹Ð¹ Ð¿ÑƒÐ»
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
            // ÐžÐ±Ð½Ð¾Ð²Ð»ÑÐµÐ¼ Ð´Ð°Ð½Ð½Ñ‹Ðµ Ð¿ÑƒÐ»Ð¾Ð² Ð¸ Ð²Ð¾Ñ€ÐºÐµÑ€Ð¾Ð²
            await this.loadPoolWorkers();
            this.updateOverviewStats();
            this.renderWorkersGrid();

            // ÐžÐ±Ð½Ð¾Ð²Ð»ÑÐµÐ¼ ÐºÐ°Ñ€Ñ‚Ð¾Ñ‡ÐºÐ¸ Ð¿ÑƒÐ»Ð¾Ð²
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

    showStratumWorkerRegistrationModal(poolInfo) {
        if (!poolInfo.bitcoinAddress) {
            app.showNotification('error', 'Pool Bitcoin address not available');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content worker-registration-modal">
        <div class="modal-header">
        <h3>Register Stratum Worker</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>

        <div class="modal-body">
        <div class="pool-info-section">
        <h4>Pool Information</h4>
        <div class="info-grid">
        <div class="info-item">
        <span class="label">Pool ID:</span>
        <span class="value">${poolInfo.poolId}</span>
        </div>
        <div class="info-item">
        <span class="label">Bitcoin Address:</span>
        <span class="value">${poolInfo.bitcoinAddress}</span>
        </div>
        <div class="info-item">
        <span class="label">Your Ethereum Address:</span>
        <span class="value">${wallet.account}</span>
        </div>
        </div>
        </div>

        <div class="form-section">
        <div class="form-group">
        <label class="form-label required">Worker Name</label>
        <input
        type="text"
        id="stratumWorkerName"
        class="form-input"
        placeholder="e.g., ANTIS19001"
        maxlength="20"
        pattern="[a-zA-Z0-9_-]+"
        >
        <small class="form-help">
        Unique identifier for your mining hardware (A-Z, 0-9, _, - only)
        </small>
        </div>

        <div class="info-box">
        <h5>How it works:</h5>
        <ol>
        <li>Worker registered in StratumDataAggregator contract</li>
        <li>Link created: Worker Address ↔ Your Ethereum Address</li>
        <li>Configure your miner: <code>${poolInfo.bitcoinAddress}.WORKER_NAME</code></li>
        <li>Oracle updates share statistics automatically</li>
        <li>MP token rewards distributed to your Ethereum address</li>
        </ol>
        </div>

        <div class="info-box info">
        <strong>Stratum Connection String:</strong>
        <code id="stratumConnectionPreview">
        ${poolInfo.bitcoinAddress}.<span style="color: #10b981;">WORKER_NAME</span>
        </code>
        </div>

        <div class="info-box warning">
        <strong>Transaction Required</strong>
        <p>Registration requires an Ethereum transaction.</p>
        <p>Estimated gas cost: ~0.003-0.005 ETH</p>
        </div>
        </div>
        </div>

        <div class="modal-actions">
        <button
        class="btn btn-secondary"
        onclick="this.closest('.modal-overlay').remove()"
        >
        Cancel
        </button>
        <button
        class="btn btn-primary"
        onclick="miningDashboard.submitStratumWorkerRegistration('${poolInfo.address}', '${poolInfo.bitcoinAddress}')"
        id="registerStratumWorkerBtn"
        >
        Register Worker
        </button>
        </div>
        </div>
        `;

        document.body.appendChild(modal);
        this.setupStratumWorkerFormValidation(modal, poolInfo.bitcoinAddress);
    }

    setupStratumWorkerFormValidation(modal, bitcoinAddress) {
        const nameInput = modal.querySelector('#stratumWorkerName');
        const submitBtn = modal.querySelector('#registerStratumWorkerBtn');
        const connectionPreview = modal.querySelector('#stratumConnectionPreview');

        const validateForm = () => {
            const name = nameInput.value.trim();
            const isNameValid = name.length > 0 && /^[a-zA-Z0-9_-]+$/.test(name);

            submitBtn.disabled = !isNameValid;
            nameInput.classList.toggle('invalid', name.length > 0 && !isNameValid);

            if (connectionPreview && name) {
                connectionPreview.innerHTML = `${bitcoinAddress}.<span style="color: #10b981;">${name}</span>`;
            }
        };

        nameInput.addEventListener('input', validateForm);
        validateForm();
    }

    async submitStratumWorkerRegistration(poolAddress, bitcoinAddress) {
        const workerName = document.getElementById('stratumWorkerName').value.trim();

        if (!workerName) {
            app.showNotification('error', 'Please enter worker name');
            return;
        }

        if (!/^[a-zA-Z0-9_-]+$/.test(workerName)) {
            app.showNotification('error', 'Invalid worker name format');
            return;
        }

        try {
            if (!stratumWorkerManager.initialized) {
                await stratumWorkerManager.initialize();
            }

            app.showLoading('Registering worker in StratumDataAggregator...');

            const result = await stratumWorkerManager.registerWorker(
                poolAddress,
                workerName,
                bitcoinAddress
            );

            app.hideLoading();
            document.querySelector('.modal-overlay').remove();

            this.showStratumWorkerRegistrationSuccess(result, bitcoinAddress);

            await this.loadPoolWorkers();
            this.renderWorkersGrid();

        } catch (error) {
            app.hideLoading();
            console.error('Stratum worker registration error:', error);

            let errorMessage = 'Registration failed';

            if (error.message.includes('user rejected')) {
                errorMessage = 'Transaction was rejected by user';
            } else if (error.message.includes('insufficient funds')) {
                errorMessage = 'Insufficient ETH balance for gas fees';
            } else if (error.message.includes('Only admin')) {
                errorMessage = 'Only pool admin can register workers. Please contact administrator.';
            } else {
                errorMessage = error.message;
            }

            app.showNotification('error', errorMessage);
        }
    }

    /**
     * Success
     */
    showStratumWorkerRegistrationSuccess(result, bitcoinAddress) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content success-modal">
        <div class="modal-header success">
        <div class="success-icon">✓</div>
        <h3>Worker Registered Successfully!</h3>
        </div>

        <div class="modal-body">
        <div class="success-details">
        <div class="detail-item">
        <span class="label">Worker Name:</span>
        <span class="value">${result.workerName}</span>
        </div>
        <div class="detail-item">
        <span class="label">Stratum Username:</span>
        <code class="value">${result.username}</code>
        </div>
        <div class="detail-item">
        <span class="label">Worker Address:</span>
        <span class="value monospace">${result.workerAddress.slice(0, 10)}...${result.workerAddress.slice(-8)}</span>
        </div>
        <div class="detail-item">
        <span class="label">Linked to Ethereum:</span>
        <span class="value monospace">${wallet.account}</span>
        </div>
        <div class="detail-item">
        <span class="label">Transaction:</span>
        <a href="${CONFIG.EXPLORER_URL}/tx/${result.txHash}"
        target="_blank"
        class="tx-link">
        View on Explorer
        </a>
        </div>
        </div>

        <div class="next-steps">
        <h4>Configure Your Miner:</h4>
        <div class="miner-config">
        <div class="config-item">
        <strong>Stratum URL:</strong>
        <code>stratum+tcp://pool.example.com:3333</code>
        </div>
        <div class="config-item">
        <strong>Username:</strong>
        <code>${result.username}</code>
        <button class="btn-copy" onclick="navigator.clipboard.writeText('${result.username}')">Copy</button>
        </div>
        <div class="config-item">
        <strong>Password:</strong>
        <code>x</code>
        </div>
        </div>

        <h5>What happens next:</h5>
        <ol>
        <li>Start your mining hardware with the config above</li>
        <li>Oracle automatically tracks your shares</li>
        <li>Rewards distributed to your Ethereum address</li>
        <li>Monitor performance in Mining Dashboard</li>
        </ol>
        </div>
        </div>

        <div class="modal-actions">
        <button
        class="btn btn-primary"
        onclick="this.closest('.modal-overlay').remove()"
        >
        Done
        </button>
        </div>
        </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     *StratumDataAggregator
     */
    async loadStratumWorkers() {
        if (!stratumWorkerManager.initialized) {
            await stratumWorkerManager.initialize();
        }

        try {
            const userWorkers = await stratumWorkerManager.getUserWorkers();

            this.poolWorkers = userWorkers.reduce((acc, worker) => {
                const poolId = this.selectedPool || 'default';
                if (!acc[poolId]) acc[poolId] = [];
                acc[poolId].push({
                    address: worker.workerAddress,
                    name: 'Worker', // Имя из off-chain данных
                    hashrate: 0,
                    validShares: worker.validShares,
                    totalShares: worker.totalShares,
                    lastActivity: worker.lastSubmission,
                    isActive: worker.isActive,
                    status: worker.isActive ? 'active' : 'inactive'
                });
                return acc;
            }, {});

            console.log('Loaded Stratum workers:', this.poolWorkers);

        } catch (error) {
            console.error('Failed to load Stratum workers:', error);
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

    // ========== WORKER CLAIM SYSTEM ==========

    /**
     * Show Browse Workers Interface
     */
    async showBrowseWorkersInterface() {
        try {
            if (!wallet.connected) {
                app.showNotification('warning', 'Please connect wallet first');
                return;
            }

            app.showLoading('Loading workers...');

            // Загрузить всех воркеров из Mining Simulator
            const response = await fetch(`${CONFIG.API.MINING}/api/workers`);
            if (!response.ok) throw new Error('Failed to load workers');

            const data = await response.json();
            const workers = data.workers || [];

            console.log(`Loaded ${workers.length} workers from Mining Simulator`);

            // Отрисовать интерфейс
            this.renderBrowseWorkersUI(workers);

            app.hideLoading();

        } catch (error) {
            app.hideLoading();
            console.error('Error loading workers:', error);
            app.showNotification('error', 'Failed to load workers');
        }
    }

    /**
     * Render Browse Workers UI
     */
    renderBrowseWorkersUI(workers) {
        const container = document.getElementById('miningStats');
        if (!container) return;

        container.innerHTML = `
        <div class="browse-workers-container">
        <div class="browse-header">
        <h3>Browse All Workers</h3>
        <button onclick="miningDashboard.closeBrowseWorkers()" class="btn btn-secondary">
        Close
        </button>
        </div>

        <div class="workers-filters">
        <label class="filter-label">Search by Worker ID:</label>
        <input
        type="text"
        id="workerSearchInput"
        class="form-input"
        placeholder="Enter worker ID..."
        onkeyup="miningDashboard.filterWorkersBySearch()"
        />
        </div>

        <div class="workers-stats">
        <div class="stat-item">
        <span class="stat-label">Total Workers:</span>
        <span class="stat-value">${workers.length}</span>
        </div>
        <div class="stat-item">
        <span class="stat-label">Active:</span>
        <span class="stat-value">${workers.filter(w => w.status === 'active').length}</span>
        </div>
        <div class="stat-item">
        <span class="stat-label">Total Hashrate:</span>
        <span class="stat-value">${workers.reduce((sum, w) => sum + w.hashrate, 0).toFixed(2)} TH/s</span>
        </div>
        </div>

        <div class="workers-table-container">
        <table class="workers-table">
        <thead>
        <tr>
        <th>Worker ID</th>
        <th>Name</th>
        <th>Hashrate</th>
        <th>Status</th>
        <th>Valid Shares</th>
        <th>Validity Rate</th>
        <th>Action</th>
        </tr>
        </thead>
        <tbody id="workersTableBody">
        ${workers.map(w => this.renderWorkerRow(w)).join('')}
        </tbody>
        </table>
        </div>

        <div class="browse-footer">
        <p class="help-text">
        Select a worker to claim ownership. You will need to verify your access by providing the worker name.
        </p>
        </div>
        </div>
        `;
    }

    /**
     * Render Worker Row
     */
    renderWorkerRow(worker) {
        const validityRate = worker.total_shares > 0
        ? ((worker.valid_shares / worker.total_shares) * 100).toFixed(2)
        : '0.00';

        return `
        <tr data-worker-id="${worker.id}">
        <td><code>${worker.id}</code></td>
        <td><strong>${worker.name}</strong></td>
        <td>${worker.hashrate} TH/s</td>
        <td>
        <span class="status-badge ${worker.status}">
        ${worker.status}
        </span>
        </td>
        <td>${worker.valid_shares.toLocaleString()} / ${worker.total_shares.toLocaleString()}</td>
        <td>${validityRate}%</td>
        <td>
        <button
        onclick="miningDashboard.initiateWorkerClaim('${worker.id}', '${worker.name}')"
        class="btn btn-primary btn-sm">
        Claim Worker
        </button>
        </td>
        </tr>
        `;
    }

    /**
     * Filter Workers by Search
     */
    filterWorkersBySearch() {
        const searchInput = document.getElementById('workerSearchInput');
        if (!searchInput) return;

        const searchValue = searchInput.value.toLowerCase();
        const rows = document.querySelectorAll('#workersTableBody tr');

        rows.forEach(row => {
            const workerId = row.dataset.workerId.toLowerCase();
            const workerName = row.querySelector('strong').textContent.toLowerCase();

            if (workerId.includes(searchValue) || workerName.includes(searchValue)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    /**
     * Close Browse Workers and return to dashboard
     */
    closeBrowseWorkers() {
        this.initialize();
    }

    /**
     * Initiate Worker Claim - show modal
     */
    initiateWorkerClaim(workerId, workerName) {
        if (!wallet.connected) {
            app.showNotification('warning', 'Please connect wallet first');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content worker-claim-modal">
        <div class="modal-header">
        <h3>Claim Worker Ownership</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>

        <div class="modal-body">
        <div class="worker-info-section">
        <h4>Worker Information</h4>
        <div class="info-grid">
        <div class="info-item">
        <span class="label">Worker ID:</span>
        <span class="value"><code>${workerId}</code></span>
        </div>
        <div class="info-item">
        <span class="label">Your Ethereum Address:</span>
        <span class="value"><code>${wallet.formatAddress(wallet.account)}</code></span>
        </div>
        </div>
        </div>

        <div class="form-section">
        <div class="form-group">
        <label class="form-label required">Your Bitcoin Payout Address</label>
        <input
        type="text"
        id="bitcoinPayoutAddress"
        class="form-input"
        placeholder="tb1q... or bc1q..."
        pattern="^(tb1|bc1)[a-z0-9]{39,87}$"
        />
        <small class="form-help">
        Bech32 address where you want to receive mining rewards
        </small>
        </div>

        <div class="form-group">
        <label class="form-label required">Worker Name (Verification)</label>
        <input
        type="text"
        id="workerSecret"
        class="form-input"
        placeholder="Enter worker name from your mining hardware config"
        maxlength="20"
        />
        <small class="form-help">
        This must match the exact worker name configured on your mining equipment
        </small>
        </div>
        </div>

        <div class="info-box warning">
        <strong>Important:</strong>
        <ul>
        <li>Worker name must exactly match your hardware configuration</li>
        <li>Bitcoin address will be used for mining reward payouts</li>
        <li>Admin will review and approve your claim request</li>
        <li>Once approved, the worker will be linked to your Ethereum address</li>
        </ul>
        </div>
        </div>

        <div class="modal-actions">
        <button
        onclick="this.closest('.modal-overlay').remove()"
        class="btn btn-secondary">
        Cancel
        </button>
        <button
        onclick="miningDashboard.submitWorkerClaim('${workerId}')"
        class="btn btn-primary"
        id="submitClaimBtn">
        Submit Claim Request
        </button>
        </div>
        </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Submit Worker Claim
     */
    async submitWorkerClaim(workerId) {
        try {
            const bitcoinAddress = document.getElementById('bitcoinPayoutAddress')?.value.trim();
            const inputSecret = document.getElementById('workerSecret')?.value.trim();

            // Валидация Bitcoin адреса
            if (!bitcoinAddress || !bitcoinAddress.match(/^(tb1|bc1)[a-z0-9]{39,87}$/)) {
                app.showNotification('error', 'Invalid Bitcoin address format. Use Bech32 (tb1... or bc1...)');
                return;
            }

            if (!inputSecret) {
                app.showNotification('error', 'Please enter worker name');
                return;
            }

            app.showLoading('Verifying worker ownership...');

            // 1. Загрузить данные воркера из API
            const response = await fetch(`${CONFIG.API.MINING}/api/workers`);
            if (!response.ok) throw new Error('Failed to load workers from API');

            const data = await response.json();
            const worker = data.workers.find(w => w.id === workerId);

            if (!worker) {
                throw new Error('Worker not found in system');
            }

            // 2. Проверить секрет (сравнение с worker.name)
            if (worker.name !== inputSecret) {
                app.hideLoading();
                app.showNotification('error', 'Invalid worker name. Access denied.');
                return;
            }

            console.log('Worker verification successful:', {
                workerId: worker.id,
                workerName: worker.name,
                bitcoinAddress,
                minerAddress: wallet.account
            });

            // 3. Инициализировать stratum worker manager если нужно
            if (!stratumWorkerManager.initialized) {
                await stratumWorkerManager.initialize();
            }

            // 4. Вычислить workerAddress для контракта
            const workerAddress = stratumWorkerManager.calculateWorkerAddress(
                bitcoinAddress,
                worker.name
            );

            console.log('Calculated workerAddress for contract:', workerAddress);

            // 5. Создать request через Request System
            const message = `
            Worker Claim Request

            Worker ID: ${workerId}
            Worker Name: ${worker.name}
            Worker Address (Contract): ${workerAddress}
            Bitcoin Payout Address: ${bitcoinAddress}
            Miner Ethereum Address: ${wallet.account}

            Performance Data:
            - Hashrate: ${worker.hashrate} TH/s
            - Valid Shares: ${worker.valid_shares.toLocaleString()}
            - Total Shares: ${worker.total_shares.toLocaleString()}
            - Validity Rate: ${((worker.valid_shares / worker.total_shares) * 100).toFixed(2)}%
            - Status: ${worker.status}

            Verification: Worker name verified successfully.
            `.trim();

            // 6. Отправить через requests system
            const success = await requests.submitMembershipRequest(
                workerAddress,  // targetPoolId используем как workerAddress
                ethers.constants.AddressZero,  // poolOwner не используется
                'worker_owner',  // requestedRole
                message
            );

            if (success) {
                app.hideLoading();
                document.querySelector('.modal-overlay').remove();

                app.showNotification('success', 'Worker claim request submitted successfully! Admin will review it shortly.');

                // Показать информацию о следующих шагах
                this.showClaimSubmittedInfo(worker, bitcoinAddress, workerAddress);
            }

        } catch (error) {
            app.hideLoading();
            console.error('Worker claim submission error:', error);
            app.showNotification('error', `Failed to submit claim: ${error.message}`);
        }
    }

    /**
     * Show Claim Submitted Info Modal
     */
    showClaimSubmittedInfo(worker, bitcoinAddress, workerAddress) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content success-modal">
        <div class="modal-header success">
        <div class="success-icon">✓</div>
        <h3>Claim Request Submitted</h3>
        </div>

        <div class="modal-body">
        <div class="success-details">
        <p>Your worker claim request has been submitted and is pending admin approval.</p>

        <div class="detail-section">
        <h4>Worker Details:</h4>
        <div class="detail-item">
        <span class="label">Worker Name:</span>
        <span class="value">${worker.name}</span>
        </div>
        <div class="detail-item">
        <span class="label">Worker ID:</span>
        <span class="value"><code>${worker.id}</code></span>
        </div>
        <div class="detail-item">
        <span class="label">Hashrate:</span>
        <span class="value">${worker.hashrate} TH/s</span>
        </div>
        </div>

        <div class="detail-section">
        <h4>Addresses:</h4>
        <div class="detail-item">
        <span class="label">Worker Address (Contract):</span>
        <span class="value monospace">${workerAddress.slice(0, 10)}...${workerAddress.slice(-8)}</span>
        </div>
        <div class="detail-item">
        <span class="label">Bitcoin Payout:</span>
        <span class="value monospace">${bitcoinAddress}</span>
        </div>
        <div class="detail-item">
        <span class="label">Your Ethereum:</span>
        <span class="value monospace">${wallet.account}</span>
        </div>
        </div>

        <div class="next-steps">
        <h4>What happens next:</h4>
        <ol>
        <li>Admin reviews your claim request</li>
        <li>Upon approval, worker is linked to your Ethereum address</li>
        <li>Mining rewards will be distributed to your Bitcoin address</li>
        <li>You can track your worker performance in Mining Dashboard</li>
        </ol>
        </div>
        </div>
        </div>

        <div class="modal-actions">
        <button
        onclick="this.closest('.modal-overlay').remove(); miningDashboard.closeBrowseWorkers();"
        class="btn btn-primary">
        Return to Dashboard
        </button>
        <button
        onclick="this.closest('.modal-overlay').remove(); showSection('nftCollection');"
        class="btn btn-secondary">
        View My Requests
        </button>
        </div>
        </div>
        `;

        document.body.appendChild(modal);
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
