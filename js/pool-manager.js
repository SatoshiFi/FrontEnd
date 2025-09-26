// js/components/pool-manager.js - НОВАЯ ЧИСТАЯ ВЕРСИЯ
class PoolManager {
    constructor() {
        this.pools = [];
        this.initialized = false;
        this.refreshInterval = null;
    }

    async initialize() {
        if (this.initialized) return;

        console.log('Initializing PoolManager...');
        this.buildPoolManagementInterface();
        await this.loadPools();
        this.startAutoRefresh();
        this.initialized = true;
    }

    buildPoolManagementInterface() {
        const container = document.getElementById('poolManagement');
        if (!container) return;

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
        <option value="all">All Pools</option>
        <option value="my">My Pools</option>
        <option value="active">Active Pools</option>
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
    }

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
            const allPools = await factory.getAllPools();

            console.log(`Found ${allPools.length} pools from factory`);

            this.pools = [];

            for (const poolAddress of allPools) {
                if (poolAddress === ethers.constants.AddressZero) continue;

                try {
                    const poolInfo = await this.getPoolInfo(poolAddress);
                    if (poolInfo) {
                        this.pools.push(poolInfo);
                    }
                } catch (error) {
                    console.warn(`Error loading pool ${poolAddress}:`, error.message);
                }
            }

            console.log(`Successfully loaded ${this.pools.length} pools`);

            this.updateStats();
            this.renderPools();

        } catch (error) {
            console.error('Error loading pools:', error);
            this.showEmptyState(`Error loading pools: ${error.message}`);
        }
    }

    async getPoolInfo(poolAddress) {
        try {
            // Проверяем, что контракт существует
            const code = await wallet.provider.getCode(poolAddress);
            if (code === '0x') {
                console.warn(`Pool at ${poolAddress} has no code`);
                return null;
            }

            // Создаем базовый контракт для чтения основной информации
            const poolContract = new ethers.Contract(
                poolAddress,
                [
                    "function poolId() external view returns (string)",
                                                     "function groupPubkeyX() external view returns (uint256)",
                                                     "function groupPubkeyY() external view returns (uint256)"
                ],
                wallet.provider
            );

            let poolId = `pool-${poolAddress.slice(2, 10)}`;
            let pubX = null;
            let pubY = null;

            // Пытаемся получить дополнительную информацию
            try {
                poolId = await poolContract.poolId();
            } catch (error) {
                console.log(`Pool ${poolAddress} - poolId() not available`);
            }

            try {
                pubX = await poolContract.groupPubkeyX();
                pubY = await poolContract.groupPubkeyY();
            } catch (error) {
                console.log(`Pool ${poolAddress} - public keys not available`);
            }

            // Проверяем, является ли пользователь участником
            const userAccess = await this.checkUserAccess(poolAddress);

            return {
                address: poolAddress,
                poolId: poolId,
                pubX: pubX,
                pubY: pubY,
                userAccess: userAccess,
                active: true // По умолчанию считаем активным
            };

        } catch (error) {
            console.error(`Failed to get pool info for ${poolAddress}:`, error);
            return null;
        }
    }

    async checkUserAccess(poolAddress) {
        try {
            // Проверяем через NFT membership
            const membershipSBT = contracts.getContract('membershipSBT');
            if (!membershipSBT) return 'None';

            const tokenId = await membershipSBT.tokenOf(wallet.account);
            if (tokenId.gt(0)) {
                const membership = await membershipSBT.membershipOf(tokenId);
                const poolId = ethers.utils.parseBytes32String(membership.poolId);
                const role = ethers.utils.parseBytes32String(membership.role);

                // Простая проверка - если poolId содержится в адресе или наоборот
                if (poolId && (poolId.includes(poolAddress.slice(-8)) || poolAddress.toLowerCase().includes(poolId.toLowerCase()))) {
                    return role;
                }
            }

            return 'None';
        } catch (error) {
            console.log(`Error checking user access for ${poolAddress}:`, error.message);
            return 'None';
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

        return `
        <div class="pool-card ${accessClass} ${statusClass}">
        <div class="pool-header">
        <div class="pool-title">
        <h4>${pool.poolId}</h4>
        <span class="pool-address">${wallet.formatAddress(pool.address)}</span>
        </div>
        <div class="pool-status">
        <span class="status-badge ${pool.active ? 'active' : 'inactive'}">
        ${pool.active ? 'Active' : 'Inactive'}
        </span>
        </div>
        </div>

        <div class="pool-info">
        <div class="info-item">
        <span class="label">Your Access:</span>
        <span class="value access-${pool.userAccess.toLowerCase()}">${pool.userAccess}</span>
        </div>
        ${pool.pubX ? `
            <div class="info-item">
            <span class="label">Has Keys:</span>
            <span class="value">✅ Yes</span>
            </div>
            ` : `
            <div class="info-item">
            <span class="label">Has Keys:</span>
            <span class="value">❌ No</span>
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

        document.getElementById('totalPoolsCount').textContent = totalPools;
        document.getElementById('myPoolsCount').textContent = myPools;
        document.getElementById('activePoolsCount').textContent = activePools;
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

        // Создаем модальное окно с деталями
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

        app.showNotification('info', `Managing pool: ${pool.poolId}`);
        // Здесь можно добавить дополнительную логику управления
    }

    joinPool(poolAddress) {
        const pool = this.pools.find(p => p.address === poolAddress);
        if (!pool) {
            app.showNotification('error', 'Pool not found');
            return;
        }

        // Простая реализация запроса доступа
        const message = prompt(`Request access to pool "${pool.poolId}". Enter your message:`);
        if (message) {
            app.showNotification('info', `Access request sent for pool: ${pool.poolId}`);
            // Здесь можно интегрировать с системой запросов
        }
    }

    startAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(() => {
            if (wallet.connected && this.initialized) {
                console.log('Auto-refreshing pools...');
                this.loadPools();
            }
        }, 30000); // Обновление каждые 30 секунд
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        this.pools = [];
        this.initialized = false;
    }
}

// Глобальный экземпляр
window.poolManager = new PoolManager();
