// js/pool-manager.js
class PoolManager {
    constructor() {
        this.pools = [];
        this.workers = [];
        this.miningPools = [];
        this.initialized = false;
        this.refreshInterval = null;
        this.switchPoolsCache = []; // Временное хранилище пулов для Switch Pool
    }

    async initialize() {
        if (this.initialized) return;

        console.log('Initializing PoolManager...');

        // Load pools FIRST
        await this.loadPools();

        // Build interface AFTER pools are loaded
        await this.buildPoolManagementInterface();

        this.startAutoRefresh();
        this.initialized = true;
    }

    async buildPoolManagementInterface() {
        const container = document.getElementById('poolManagement');
        if (!container) return;

        let hasGlobalAdminRights = false;
        let hasPoolAccess = false;

        if (wallet.connected && window.contracts && contracts.initialized) {
            const adminRights = await contracts.checkAdminRights(wallet.account);
            hasGlobalAdminRights = adminRights.isAdmin || adminRights.hasAdminRights || adminRights.isPoolManager;
            hasPoolAccess = this.pools.some(p => p.userAccess !== 'None');
        }

        const showPoolInterface = hasGlobalAdminRights || hasPoolAccess;

        console.log('Building interface:', {
            account: wallet.account,
            hasGlobalAdminRights,
            hasPoolAccess,
            poolsCount: this.pools.length,
            showPoolInterface
        });

        // ✅ ИСПРАВЛЕНО: Показываем только если есть доступ к пулам
        if (showPoolInterface) {
            container.innerHTML = `
            <div class="pool-management-container">
            <div class="section-header">
            <h2>Pool Management</h2>
            <div class="header-actions">
            <button id="refreshPoolsBtn" class="btn btn-secondary">Refresh Pools</button>
            <button onclick="showSection('poolCreation')" class="btn btn-primary">Create New Pool</button>
            </div>
            </div>

            <div class="pools-stats">
            <div class="stat-card">
            <div class="stat-value" id="totalPoolsCount">0</div>
            <div class="stat-label">Total Pools</div>
            </div>
            <div class="stat-card">
            <div class="stat-value" id="myPoolsCount">0</div>
            <div class="stat-label">My Pools</div>
            </div>
            <div class="stat-card">
            <div class="stat-value" id="activePoolsCount">0</div>
            <div class="stat-label">Active Pools</div>
            </div>
            </div>

            <div class="pools-container">
            <div class="pools-header">
            <h3>Mining Pools</h3>
            <div class="pools-controls">
            <select id="poolFilter" class="form-select">
            <option value="active" selected>Active Pools</option>
            <option value="my">My Pools</option>
            <option value="inactive">Inactive Pools</option>
            <option value="all">All Pools</option>
            </select>
            </div>
            </div>

            <div class="pools-list" id="poolsList">
            <div class="loading-indicator">Loading pools...</div>
            </div>
            </div>
            </div>
            `;

            this.bindEvents();

            if (this.pools.length > 0) {
                this.updateStats();
                this.filterPools('active');
            } else {
                this.showEmptyState('No accessible pools found');
            }
        } else {
            container.innerHTML = '';
        }
    }

    // ==================== MY WORKERS SECTION ====================

    async initializeMyWorkersSection() {
        const container = document.getElementById('myWorkersContainer');
        if (!container) {
            console.warn('myWorkersContainer not found');
            return;
        }

        if (!wallet.connected) {
            container.innerHTML = `
            <div class="empty-state">
            <div class="empty-icon">🔗</div>
            <h3>Wallet Required</h3>
            <p>Please connect your wallet to view your workers</p>
            </div>
            `;
            return;
        }

        container.innerHTML = `
        <div class="workers-section">
        <div class="section-header">
        <h2>My Mining Workers</h2>
        <div class="header-actions">
        <button id="refreshMyWorkersBtn" class="btn btn-secondary">Refresh</button>
        <button onclick="showSection('miningDashboard')" class="btn btn-primary">Browse All Workers</button>
        </div>
        </div>
        <div id="myWorkersContent">
        <div class="loading-indicator">Loading your workers...</div>
        </div>
        </div>
        `;

        document.getElementById('refreshMyWorkersBtn')?.addEventListener('click', () => {
            this.loadAndDisplayMyWorkers();
        });

        await this.loadAndDisplayMyWorkers();
    }

    async loadAndDisplayMyWorkers() {
        try {
            const container = document.getElementById('myWorkersContent');
            if (!container) return;

            container.innerHTML = '<div class="loading-indicator">Loading...</div>';

            if (!stratumWorkerManager.initialized) {
                await stratumWorkerManager.initialize();
            }

            const myWorkers = await stratumWorkerManager.loadMyWorkers();
            console.log(`Loaded ${myWorkers.length} workers for ${wallet.account}`);

            // ИСПРАВЛЕНИЕ: Сохраняем воркеров в this.workers для использования в switchWorkerPool
            this.workers = myWorkers;

            if (myWorkers.length === 0) {
                container.innerHTML = `
                <div class="empty-state">
                <div class="empty-icon">⚙️</div>
                <h3>No Workers Found</h3>
                <p>You don't have any registered mining workers yet</p>
                <button onclick="showSection('miningDashboard')" class="btn btn-primary">
                Browse Available Workers
                </button>
                </div>
                `;
                return;
            }

            this.displayMyWorkers(myWorkers, container);

        } catch (error) {
            console.error('Error loading my workers:', error);
            const container = document.getElementById('myWorkersContent');
            if (container) {
                container.innerHTML = `
                <div class="error-state">
                <p>Error: ${error.message}</p>
                <button onclick="poolManager.loadAndDisplayMyWorkers()" class="btn btn-primary">Retry</button>
                </div>
                `;
            }
        }
    }

    displayMyWorkers(workers, container) {
        // Группируем по пулам
        const workersByPool = workers.reduce((acc, w) => {
            const poolId = w.poolId || 'unassigned';
            if (!acc[poolId]) acc[poolId] = [];
            acc[poolId].push(w);
            return acc;
        }, {});

        container.innerHTML = `
        <div class="workers-grid">
        ${Object.entries(workersByPool).map(([poolId, poolWorkers]) => `
            <div class="pool-workers-group">
            <h4 class="pool-name">${poolId}</h4>
            <div class="workers-list">
            ${poolWorkers.map(w => this.renderMyWorkerCard(w)).join('')}
            </div>
            </div>
            `).join('')}
            </div>
            `;
    }

    renderMyWorkerCard(worker) {
        const validityRate = worker.totalShares > 0
        ? ((worker.validShares / worker.totalShares) * 100).toFixed(1)
        : '0.0';

        return `
        <div class="worker-card">
        <div class="worker-header">
        <strong>${worker.name}</strong>
        <span class="status-badge ${worker.status}">${worker.status}</span>
        </div>
        <div class="worker-stats">
        <div class="stat">
        <span class="label">Hashrate:</span>
        <span class="value">${worker.hashrate} TH/s</span>
        </div>
        <div class="stat">
        <span class="label">Valid Shares:</span>
        <span class="value">${worker.validShares.toLocaleString()}</span>
        </div>
        <div class="stat">
        <span class="label">Validity:</span>
        <span class="value">${validityRate}%</span>
        </div>
        </div>
        <div class="worker-actions">
        <button class="btn btn-sm btn-primary"
        onclick="poolManager.switchWorkerPool('${worker.id}', '${worker.poolId}')">
        Switch Pool
        </button>
        </div>
        </div>
        `;
    }

    // ==================== REST OF POOL MANAGER CODE ====================

    bindEvents() {
        document.getElementById('refreshPoolsBtn')?.addEventListener('click', () => {
            this.loadPools();
        });

        document.getElementById('poolFilter')?.addEventListener('change', (e) => {
            this.filterPools(e.target.value);
        });
    }

    async loadPools() {
        try {
            if (!wallet.connected) {
                this.showEmptyState('Please connect your wallet to view pools');
                return;
            }

            const poolsList = document.getElementById('poolsList');
            if (poolsList) {
                poolsList.innerHTML = '<div class="loading-indicator">Loading pools...</div>';
            }

            console.log('Loading pools from factory...');

            const factory = contracts.getContract('factory');
            const poolCount = await factory.getPoolCount();
            console.log(`Total pools in factory: ${poolCount}`);

            this.pools = [];
            const loadedPoolAddresses = new Set();

            let hasGlobalAdminRights = false;

            if (window.contracts && contracts.initialized) {
                const adminRights = await contracts.checkAdminRights(wallet.account);
                hasGlobalAdminRights = adminRights.isAdmin || adminRights.hasAdminRights;

                console.log('Global admin rights check:', {
                    account: wallet.account,
                    hasGlobalAdminRights
                });
            }

            for (let i = 0; i < poolCount; i++) {
                try {
                    const poolAddress = await factory.getPoolAt(i);

                    if (poolAddress === ethers.constants.AddressZero) continue;

                    const addressLower = poolAddress.toLowerCase();
                    if (loadedPoolAddresses.has(addressLower)) {
                        console.log(`Skipping duplicate pool address: ${poolAddress}`);
                        continue;
                    }

                    const poolData = await this.getPoolInfo(poolAddress);

                    if (!poolData) continue;

                    const shouldShow =
                    hasGlobalAdminRights ||
                    poolData.userAccess !== 'None' ||
                    poolData.creator.toLowerCase() === wallet.account.toLowerCase();

                    if (shouldShow) {
                        this.pools.push(poolData);
                        loadedPoolAddresses.add(addressLower);
                        console.log(`✓ Including pool ${poolData.poolId} (access: ${poolData.userAccess})`);
                    } else {
                        console.log(`✗ Skipping pool ${poolData.poolId} (no access)`);
                    }

                } catch (error) {
                    console.warn(`Error loading pool at index ${i}:`, error.message);
                }
            }

            console.log(`Successfully loaded ${this.pools.length} accessible pools`);

            this.updateStats();
            this.renderPools();

        } catch (error) {
            console.error('Error loading pools:', error);
            this.showEmptyState(`Error loading pools: ${error.message}`);
        }
    }

    async getPoolInfo(poolAddress) {
        try {
            const code = await wallet.provider.getCode(poolAddress);
            if (code === '0x') {
                console.warn(`Pool at ${poolAddress} has no code`);
                return null;
            }

            const poolContract = new ethers.Contract(
                poolAddress,
                CONFIG.ABI.POOL_CONTRACT,
                wallet.provider
            );

            let poolId = `pool-${poolAddress.slice(2, 10)}`;
            let pubX = null;
            let pubY = null;
            let userRole = 'None';
            let isActive = false;
            let creator = ethers.constants.AddressZero;

            try {
                poolId = await poolContract.poolId();
            } catch (error) {
                console.log(`Pool ${poolAddress} - poolId() failed:`, error.message);
            }

            try {
                pubX = await poolContract.publicKeyX();
                pubY = await poolContract.publicKeyY();
            } catch (error) {
                console.log(`Pool ${poolAddress} - public keys failed:`, error.message);
            }

            try {
                const factory = contracts.getContract('factory');
                const poolInfo = await factory.poolsInfo(poolAddress);

                isActive = poolInfo.isActive;
                creator = poolInfo.creator;

                console.log(`Pool ${poolId} activity status from Factory:`, isActive);

                if (isActive && pubX && pubY) {
                    const pubXHex = pubX.toString();
                    const pubYHex = pubY.toString();

                    const hasValidKeys =
                    pubXHex !== '0x' &&
                    pubYHex !== '0x' &&
                    pubXHex !== '0x0000000000000000000000000000000000000000000000000000000000000000' &&
                    pubYHex !== '0x0000000000000000000000000000000000000000000000000000000000000000';

                    if (!hasValidKeys) {
                        console.log(`Pool ${poolId} marked as active but has invalid DKG keys, setting to inactive`);
                        isActive = false;
                    }
                }

            } catch (error) {
                console.warn(`Could not get pool activity status from Factory for ${poolAddress}:`, error.message);
                isActive = false;
            }

            try {
                const ADMIN_ROLE = await poolContract.ADMIN_ROLE();
                const POOL_MANAGER_ROLE = await poolContract.POOL_MANAGER_ROLE();

                const isAdmin = await poolContract.hasRole(ADMIN_ROLE, wallet.account);
                const isPoolManager = await poolContract.hasRole(POOL_MANAGER_ROLE, wallet.account);

                if (isAdmin) {
                    userRole = 'Admin';
                } else if (isPoolManager) {
                    userRole = 'Pool Manager';
                }
            } catch (error) {
                console.log(`Pool ${poolAddress} - role check failed:`, error.message);
            }

            if (userRole === 'None' && creator.toLowerCase() === wallet.account.toLowerCase()) {
                userRole = 'Creator';
                console.log(`Pool ${poolId} - user is creator but has no roles in contract`);
            }

            return {
                address: poolAddress,
                poolId: poolId,
                pubX: pubX,
                pubY: pubY,
                userAccess: userRole,
                active: isActive,
                creator: creator
            };

        } catch (error) {
            console.error(`Failed to get pool info for ${poolAddress}:`, error);
            return null;
        }
    }

    renderPools() {
        const poolsList = document.getElementById('poolsList');
        if (!poolsList) return;

        if (this.pools.length === 0) {
            this.showEmptyState('No pools found. Create your first pool!');
            return;
        }

        poolsList.innerHTML = this.pools.map(pool => this.renderPoolCard(pool)).join('');
    }

    renderPoolCard(pool) {
        const accessClass = pool.userAccess !== 'None' ? 'has-access' : 'no-access';
        const statusClass = pool.active ? 'pool-active' : 'pool-inactive';

        let statusText = 'Active';
        let statusDetail = '';

        if (!pool.active) {
            if (!pool.pubX || !pool.pubY) {
                statusText = 'Awaiting DKG';
                statusDetail = 'DKG session required';
            } else if (pool.pubX === '0x' || pool.pubY === '0x') {
                statusText = 'Invalid Keys';
                statusDetail = 'DKG failed or incomplete';
            } else {
                statusText = 'Inactive';
                statusDetail = 'Deactivated by admin';
            }
        }

        return `
        <div class="pool-card ${accessClass} ${statusClass}">
        <div class="pool-header">
        <div class="pool-title">
        <h4>${pool.poolId}</h4>
        <span class="pool-address">${wallet.formatAddress(pool.address)}</span>
        </div>
        <div class="pool-status">
        <span class="status-badge ${pool.active ? 'active' : 'inactive'}">
        ${statusText}
        </span>
        ${statusDetail ? `<small class="status-detail">${statusDetail}</small>` : ''}
        </div>
        </div>

        <div class="pool-info">
        <div class="info-item">
        <span class="label">Your Access:</span>
        <span class="value access-${pool.userAccess.toLowerCase()}">${pool.userAccess}</span>
        </div>
        ${pool.pubX && pool.pubX !== '0x' ? `
            <div class="info-item">
            <span class="label">DKG Status:</span>
            <span class="value">✓ Complete</span>
            </div>
            ` : `
            <div class="info-item">
            <span class="label">DKG Status:</span>
            <span class="value">✗ Pending</span>
            </div>
            `}
            </div>

            <div class="pool-actions">
            <button onclick="poolManager.viewPoolDetails('${pool.address}')"
            class="btn btn-primary">
            View Details
            </button>
            ${pool.userAccess !== 'None' ? `
                <button onclick="poolManager.managePool('${pool.address}')"
                class="btn btn-success">
                Manage
                </button>
                <button onclick="poolManager.openRewardManagement('${pool.address}')"
                class="btn btn-warning">
                Manage Rewards
                </button>
                ` : `
                <button onclick="poolManager.joinPool('${pool.address}')"
                class="btn btn-outline">
                Request Access
                </button>
                `}
                </div>
                </div>
                `;
    }

    filterPools(filterType) {
        const filteredPools = this.pools.filter(pool => {
            switch (filterType) {
                case 'my':
                    return pool.userAccess !== 'None';
                case 'active':
                    return pool.active;
                case 'inactive':
                    return !pool.active;
                default:
                    return true;
            }
        });

        const poolsList = document.getElementById('poolsList');
        if (poolsList) {
            if (filteredPools.length === 0) {
                this.showEmptyState(`No pools match the "${filterType}" filter`);
            } else {
                poolsList.innerHTML = filteredPools.map(pool => this.renderPoolCard(pool)).join('');
            }
        }
    }

    updateStats() {
        const totalPools = this.pools.length;
        const myPools = this.pools.filter(pool => pool.userAccess !== 'None').length;
        const activePools = this.pools.filter(pool => pool.active).length;

        const totalPoolsEl = document.getElementById('totalPoolsCount');
        const myPoolsEl = document.getElementById('myPoolsCount');
        const activePoolsEl = document.getElementById('activePoolsCount');

        if (totalPoolsEl) totalPoolsEl.textContent = totalPools;
        if (myPoolsEl) myPoolsEl.textContent = myPools;
        if (activePoolsEl) activePoolsEl.textContent = activePools;
    }

    showEmptyState(message) {
        const poolsList = document.getElementById('poolsList');
        if (poolsList) {
            poolsList.innerHTML = `
            <div class="empty-state">
            <div class="empty-icon">🏊</div>
            <h3>No Pools</h3>
            <p>${message}</p>
            <button onclick="showSection('poolCreation')" class="btn btn-primary">
            Create New Pool
            </button>
            </div>
            `;
        }
    }

    viewPoolDetails(poolAddress) {
        const pool = this.pools.find(p => p.address === poolAddress);
        if (!pool) {
            app.showNotification('error', 'Pool not found');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content pool-details-modal">
        <div class="modal-header">
        <h3>Pool Details: ${pool.poolId}</h3>
        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="modal-body">
        <div class="detail-section">
        <h4>Basic Information</h4>
        <div class="detail-row">
        <span class="label">Pool ID:</span>
        <span class="value">${pool.poolId}</span>
        </div>
        <div class="detail-row">
        <span class="label">Contract Address:</span>
        <span class="value address">${pool.address}</span>
        </div>
        <div class="detail-row">
        <span class="label">Your Access:</span>
        <span class="value">${pool.userAccess}</span>
        </div>
        <div class="detail-row">
        <span class="label">Status:</span>
        <span class="value">${pool.active ? 'Active' : 'Inactive'}</span>
        </div>
        </div>

        ${pool.pubX ? `
            <div class="detail-section">
            <h4>Cryptographic Keys</h4>
            <div class="detail-row">
            <span class="label">Public Key X:</span>
            <span class="value address">${pool.pubX}</span>
            </div>
            <div class="detail-row">
            <span class="label">Public Key Y:</span>
            <span class="value address">${pool.pubY}</span>
            </div>
            </div>
            ` : ''}
            </div>
            <div class="modal-actions">
            <button onclick="this.parentElement.parentElement.parentElement.remove()"
            class="btn btn-secondary">
            Close
            </button>
            ${pool.userAccess !== 'None' ? `
                <button onclick="poolManager.managePool('${pool.address}'); this.parentElement.parentElement.parentElement.remove();"
                class="btn btn-primary">
                Manage Pool
                </button>
                ` : ''}
                </div>
                </div>
                `;

                document.body.appendChild(modal);
    }

    managePool(poolAddress) {
        const pool = this.pools.find(p => p.address === poolAddress);
        if (!pool) {
            app.showNotification('error', 'Pool not found');
            return;
        }

        if (pool.userAccess === 'None') {
            app.showNotification('error', 'You do not have access to manage this pool');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content pool-management-modal">
        <div class="modal-header">
        <h3>Manage Pool: ${pool.poolId}</h3>
        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="modal-body">
        <div class="management-section">
        <h4>Pool Information</h4>
        <div class="info-grid">
        <div class="info-item">
        <span class="label">Contract:</span>
        <span class="value">${pool.address}</span>
        </div>
        <div class="info-item">
        <span class="label">Your Role:</span>
        <span class="value">${pool.userAccess}</span>
        </div>
        </div>
        </div>

        <div class="management-section">
        <h4>Update Payout Script</h4>
        <div class="form-group">
        <label>Bitcoin Payout Script (hex):</label>
        <input type="text" id="newPayoutScript" class="form-control"
        placeholder="0x001482ca2a2c7e8e..." />
        <button onclick="poolManager.updatePayoutScript('${pool.address}')"
        class="btn btn-primary">Update Script</button>
        </div>
        </div>

        <div class="management-section">
        <h4>Handlers Management</h4>
        <div class="form-group">
        <label>Reward Handler Address:</label>
        <input type="text" id="newRewardHandler" class="form-control" />
        </div>
        <div class="form-group">
        <label>Redemption Handler Address:</label>
        <input type="text" id="newRedemptionHandler" class="form-control" />
        <button onclick="poolManager.updateHandlers('${pool.address}')"
        class="btn btn-primary">Update Handlers</button>
        </div>
        </div>

        <div class="management-section">
        <h4>Role Management</h4>
        <div class="form-group">
        <label>Grant Admin Role To:</label>
        <input type="text" id="newAdminAddress" class="form-control"
        placeholder="0x..." />
        <button onclick="poolManager.grantAdminRole('${pool.address}')"
        class="btn btn-success">Grant Admin</button>
        </div>
        <div class="form-group">
        <label>Grant Pool Manager Role To:</label>
        <input type="text" id="newManagerAddress" class="form-control"
        placeholder="0x..." />
        <button onclick="poolManager.grantManagerRole('${pool.address}')"
        class="btn btn-success">Grant Manager</button>
        </div>
        </div>
        </div>
        <div class="modal-actions">
        <button onclick="this.parentElement.parentElement.parentElement.remove()"
        class="btn btn-secondary">Close</button>
        </div>
        </div>
        `;

        document.body.appendChild(modal);
    }

    async updatePayoutScript(poolAddress) {
        const newScript = document.getElementById('newPayoutScript').value.trim();
        if (!newScript || !newScript.startsWith('0x')) {
            app.showNotification('error', 'Invalid payout script format');
            return;
        }

        try {
            app.showLoading('Updating payout script...');

            const poolContract = new ethers.Contract(
                poolAddress,
                CONFIG.ABI.POOL_CONTRACT,
                wallet.signer
            );

            const tx = await poolContract.setPayoutScript(newScript);
            await tx.wait();

            app.hideLoading();
            app.showNotification('success', 'Payout script updated successfully');
            this.loadPools();
        } catch (error) {
            app.hideLoading();
            console.error('Failed to update payout script:', error);
            app.showNotification('error', `Failed to update: ${error.message}`);
        }
    }

    async updateHandlers(poolAddress) {
        const rewardHandler = document.getElementById('newRewardHandler').value.trim();
        const redemptionHandler = document.getElementById('newRedemptionHandler').value.trim();

        if (!ethers.utils.isAddress(rewardHandler) || !ethers.utils.isAddress(redemptionHandler)) {
            app.showNotification('error', 'Invalid handler addresses');
            return;
        }

        try {
            app.showLoading('Updating handlers...');

            const poolContract = new ethers.Contract(
                poolAddress,
                CONFIG.ABI.POOL_CONTRACT,
                wallet.signer
            );

            const tx = await poolContract.setHandlers(rewardHandler, redemptionHandler);
            await tx.wait();

            app.hideLoading();
            app.showNotification('success', 'Handlers updated successfully');
        } catch (error) {
            app.hideLoading();
            console.error('Failed to update handlers:', error);
            app.showNotification('error', `Failed to update: ${error.message}`);
        }
    }

    async grantAdminRole(poolAddress) {
        const newAdmin = document.getElementById('newAdminAddress').value.trim();
        if (!ethers.utils.isAddress(newAdmin)) {
            app.showNotification('error', 'Invalid address');
            return;
        }

        try {
            app.showLoading('Granting admin role...');

            const poolContract = new ethers.Contract(
                poolAddress,
                CONFIG.ABI.POOL_CONTRACT,
                wallet.signer
            );

            const ADMIN_ROLE = await poolContract.ADMIN_ROLE();
            const tx = await poolContract.grantRole(ADMIN_ROLE, newAdmin);
            await tx.wait();

            app.hideLoading();
            app.showNotification('success', 'Admin role granted');
        } catch (error) {
            app.hideLoading();
            console.error('Failed to grant role:', error);
            app.showNotification('error', `Failed: ${error.message}`);
        }
    }

    async grantManagerRole(poolAddress) {
        const newManager = document.getElementById('newManagerAddress').value.trim();
        if (!ethers.utils.isAddress(newManager)) {
            app.showNotification('error', 'Invalid address');
            return;
        }

        try {
            app.showLoading('Granting manager role...');

            const poolContract = new ethers.Contract(
                poolAddress,
                CONFIG.ABI.POOL_CONTRACT,
                wallet.signer
            );

            const POOL_MANAGER_ROLE = await poolContract.POOL_MANAGER_ROLE();
            const tx = await poolContract.grantRole(POOL_MANAGER_ROLE, newManager);
            await tx.wait();

            app.hideLoading();
            app.showNotification('success', 'Pool Manager role granted');
        } catch (error) {
            app.hideLoading();
            console.error('Failed to grant role:', error);
            app.showNotification('error', `Failed: ${error.message}`);
        }
    }

    joinPool(poolAddress) {
        const pool = this.pools.find(p => p.address === poolAddress);
        if (!pool) {
            app.showNotification('error', 'Pool not found');
            return;
        }

        const message = prompt(`Request access to pool "${pool.poolId}". Enter your message:`);
        if (message) {
            app.showNotification('info', `Access request sent for pool: ${pool.poolId}`);
        }
    }

    async openRewardManagement(poolAddress) {
        try {
            if (!window.rewardManager) {
                app.showNotification('error', 'Reward Manager not loaded');
                return;
            }

            app.showLoading('Loading reward management...');

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
            <div class="modal-content reward-modal">
            <div class="modal-header">
            <h3>Reward Management</h3>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
            <div id="rewardManagementContainer">
            <div class="loading-indicator">Initializing...</div>
            </div>
            </div>
            </div>
            `;

            document.body.appendChild(modal);

            await rewardManager.initialize(poolAddress);

            app.hideLoading();

        } catch (error) {
            app.hideLoading();
            console.error('Error opening reward management:', error);
            app.showNotification('error', error.message);
        }
    }

    // ==================== WORKER SWITCHING ====================

    /**
     * Загрузить ВСЕ активные пулы без проверки прав доступа
     * Используется для Switch Pool, где майнер может выбрать любой активный пул
     */
    async loadAllActivePools() {
        try {
            console.log('Loading all active pools for worker switching...');

            const factory = contracts.getContract('factory');
            const poolCount = await factory.getPoolCount();

            const allPools = [];

            for (let i = 0; i < poolCount; i++) {
                try {
                    const poolAddress = await factory.getPoolAt(i);
                    if (poolAddress === ethers.constants.AddressZero) continue;

                    const poolData = await this.getPoolInfo(poolAddress);

                    // Включаем ТОЛЬКО активные пулы, без проверки прав доступа
                    if (poolData && poolData.active) {
                        allPools.push(poolData);
                        console.log(`✓ Including active pool ${poolData.poolId}`);
                    }

                } catch (error) {
                    console.warn(`Error loading pool at index ${i}:`, error.message);
                }
            }

            console.log(`Loaded ${allPools.length} active pools for switching`);
            return allPools;

        } catch (error) {
            console.error('Error loading all active pools:', error);
            return [];
        }
    }

    async switchWorkerPool(workerId, currentPoolId) {
        try {
            const worker = this.workers.find(w => w.id === workerId);
            if (!worker) {
                app.showNotification('error', 'Worker not found');
                return;
            }

            // ИСПРАВЛЕНИЕ: Загружаем ВСЕ активные пулы, а не только те, к которым есть доступ
            console.log('Loading pools for worker switching...');
            const availablePools = await this.loadAllActivePools();

            if (availablePools.length === 0) {
                app.showNotification('warning', 'No active pools available for switching.');
                return;
            }

            console.log(`Found ${availablePools.length} active pools available for switching`);

            // ИСПРАВЛЕНИЕ: Сохраняем пулы для использования в executePoolSwitch
            this.switchPoolsCache = availablePools;

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
            <div class="modal-content pool-switch-modal">
            <div class="modal-header">
            <h3>Switch Worker Pool</h3>
            <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
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
            <span class="label">Worker Name:</span>
            <span class="value"><strong>${worker.name}</strong></span>
            </div>
            <div class="info-item">
            <span class="label">Hashrate:</span>
            <span class="value">${worker.hashrate} TH/s</span>
            </div>
            <div class="info-item">
            <span class="label">Current Pool:</span>
            <span class="value">${currentPoolId || 'Not assigned'}</span>
            </div>
            </div>
            </div>

            <div class="pool-selection-section">
            <h4>Select Target Pool</h4>
            <div class="pool-selector">
            ${availablePools.map(pool => {
                const isCurrent = pool.poolId === currentPoolId;
                return `
                <div class="pool-option ${isCurrent ? 'current disabled' : ''}"
                onclick="${isCurrent ? '' : `poolManager.executePoolSwitch('${workerId}', '${pool.address}', '${pool.poolId}')`}">
                <div class="pool-option-header">
                <h5>${pool.poolId}</h5>
                ${isCurrent ? '<span class="current-badge">Current</span>' : ''}
                </div>
                <div class="pool-option-body">
                <div class="pool-detail">
                <span class="detail-label">Contract:</span>
                <span class="detail-value"><code>${wallet.formatAddress(pool.address)}</code></span>
                </div>
                <div class="pool-detail">
                <span class="detail-label">Status:</span>
                <span class="detail-value">
                <span class="status-badge ${pool.active ? 'active' : 'inactive'}">
                ${pool.active ? '✓ Active' : '✗ Inactive'}
                </span>
                </span>
                </div>
                </div>
                ${!isCurrent ? `
                    <div class="pool-option-footer">
                    <button class="btn btn-primary btn-sm">
                    Switch to this pool
                    </button>
                    </div>
                    ` : ''}
                    </div>
                    `;
            }).join('')}
            </div>
            </div>
            </div>

            <div class="modal-footer">
            <button onclick="this.parentElement.parentElement.parentElement.remove()"
            class="btn btn-secondary">
            Cancel
            </button>
            </div>
            </div>
            `;

            document.body.appendChild(modal);

        } catch (error) {
            console.error('Error showing pool switch dialog:', error);
            app.showNotification('error', `Failed to load pools: ${error.message}`);
        }
    }

    async executePoolSwitch(workerId, poolAddress, poolId) {
        try {
            const worker = this.workers.find(w => w.id === workerId);
            if (!worker) {
                app.showNotification('error', 'Worker not found');
                return;
            }

            // ИСПРАВЛЕНИЕ: Ищем пул в switchPoolsCache, а не в this.pools
            const targetPool = this.switchPoolsCache.find(p => p.address === poolAddress);
            if (!targetPool) {
                app.showNotification('error', 'Target pool not found');
                return;
            }

            if (!targetPool.active) {
                const confirm = window.confirm('Target pool is inactive. Continue anyway?');
                if (!confirm) return;
            }

            app.showLoading(`Switching worker to pool ${poolId}...`);

            const response = await fetch(
                `${CONFIG.API.MINING}/api/workers/${workerId}/switch`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        pool_id: poolId,
                        pool_address: poolAddress,
                        miner_address: wallet.account
                    })
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: Switch failed`);
            }

            const result = await response.json();

            console.log('Pool switch successful:', result);

            app.hideLoading();
            app.showNotification('success', `Worker "${worker.name}" successfully switched to pool: ${poolId}`);

            document.querySelectorAll('.modal-overlay').forEach(m => m.remove());

            await this.loadAndDisplayMyWorkers();

        } catch (error) {
            app.hideLoading();
            console.error('Pool switch error:', error);
            app.showNotification('error', `Failed to switch pool: ${error.message}`);
        }
    }

    // ==================== CLEANUP ====================

    startAutoRefresh() {
        console.log('Auto-refresh disabled');
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        this.pools = [];
        this.workers = [];
        this.miningPools = [];
        this.switchPoolsCache = [];
        this.initialized = false;
    }
}

window.poolManager = new PoolManager();
