// js/components/stratum-worker-manager.js
class StratumWorkerManager {
    constructor() {
        this.workers = new Map();
        this.connections = new Map();
        this.aggregator = null;
        this.initialized = false;
        this.refreshInterval = null;
    }

    async initialize() {
        if (this.initialized) return;

        console.log('Initializing StratumWorkerManager...');

        if (!CONFIG.CONTRACTS.STRATUM_AGGREGATOR) {
            throw new Error('StratumDataAggregator address not configured in CONFIG');
        }

        if (!wallet.connected) {
            throw new Error('Wallet not connected');
        }

        this.aggregator = new ethers.Contract(
            CONFIG.CONTRACTS.STRATUM_AGGREGATOR,
            CONFIG.ABI.STRATUM_AGGREGATOR,
            wallet.provider
        );

        this.initialized = true;
        console.log('StratumWorkerManager initialized with aggregator:', CONFIG.CONTRACTS.STRATUM_AGGREGATOR);
    }

    calculateWorkerAddress(bitcoinAddress, workerName) {
        const username = `${bitcoinAddress}.${workerName}`;

        // Полный keccak256 hash (32 байта)
        const fullHash = ethers.utils.keccak256(
            ethers.utils.toUtf8Bytes(username)
        );

        // ИСПРАВЛЕНО: Берём последние 20 байт для совместимости с контрактом
        const workerAddress = '0x' + fullHash.slice(-40);

        console.log('Calculated worker address:', {
            bitcoinAddress,
            workerName,
            username,
            fullHash,      // bytes32 (66 символов)
        workerAddress  // address (42 символа)
        });

        return workerAddress;  // ← ВОЗВРАЩАЕМ ADDRESS, НЕ BYTES32
    }

    async getWorkerOwner(workerAddress) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const owner = await this.aggregator.workerOwner(workerAddress);
            console.log('Worker owner:', { workerAddress, owner });
            return owner;
        } catch (error) {
            console.error('Error getting worker owner:', error);
            return ethers.constants.AddressZero;
        }
    }

    async isWorkerClaimed(workerAddress) {
        const owner = await this.getWorkerOwner(workerAddress);
        return owner !== ethers.constants.AddressZero;
    }

    async loadWorkersFromAPI() {
        try {
            const response = await fetch(`${CONFIG.API.MINING}/api/workers`);
            if (!response.ok) throw new Error('Failed to load workers');

            const data = await response.json();
            const workers = data.workers || [];

            console.log(`Loaded ${workers.length} workers from Mining Simulator`);

            for (const worker of workers) {
                this.workers.set(worker.id, {
                    id: worker.id,
                    name: worker.name,
                    hashrate: worker.hashrate,
                    status: worker.status,
                    poolId: worker.pool_id,
                    totalShares: worker.total_shares,
                    validShares: worker.valid_shares
                });
            }

            return workers;
        } catch (error) {
            console.error('Error loading workers from API:', error);
            return [];
        }
    }

    async loadMyWorkers() {
        if (!wallet.connected) {
            console.warn('Cannot load workers: wallet not connected');
            return [];
        }

        try {
            await this.initialize();

            const allWorkers = await this.loadWorkersFromAPI();
            const myWorkers = [];

            console.log(`Checking ownership for ${allWorkers.length} workers...`);

            for (const worker of allWorkers) {
                try {
                    // ИСПРАВЛЕНИЕ: Используем contract метод напрямую
                    const { registered, minerAddress } = await this.getWorkerOwnerByWorkerId(worker.id);

                    if (registered && minerAddress.toLowerCase() === wallet.account.toLowerCase()) {
                        console.log(`✓ Worker ${worker.id} (${worker.name}) belongs to current user`);
                        myWorkers.push({
                            id: worker.id,
                            name: worker.name,
                            hashrate: worker.hashrate,
                            status: worker.status,
                            poolId: worker.pool_id,
                            totalShares: worker.total_shares,
                            validShares: worker.valid_shares,
                            minerAddress
                        });
                    }
                } catch (error) {
                    console.warn(`Error checking ownership for worker ${worker.id}:`, error.message);
                    continue;
                }
            }

            console.log(`Found ${myWorkers.length} workers owned by ${wallet.account}`);
            return myWorkers;

        } catch (error) {
            console.error('Error loading my workers:', error);
            return [];
        }
    }

    getWorkerStatus(workerId) {
        const worker = this.workers.get(workerId);
        return worker ? worker.status : 'unknown';
    }

    getWorkerHashrate(workerId) {
        const worker = this.workers.get(workerId);
        return worker ? worker.hashrate : 0;
    }

    getWorkerShares(workerId) {
        const worker = this.workers.get(workerId);
        if (!worker) return { valid: 0, total: 0 };

        return {
            valid: worker.validShares,
            total: worker.totalShares
        };
    }

    async getWorkerOwnerByWorkerId(workerId) {
        try {
            if (!this.initialized) {
                await this.initialize();
            }

            const [registered, workerAddress, minerAddress] =
            await this.aggregator.getWorkerOwnerByWorkerId(workerId);

            return {
                registered,
                workerAddress,
                minerAddress
            };
        } catch (error) {
            console.error('Error getting worker owner by workerId:', error);
            throw error;
        }
    }

    async connectToPool(poolAddress, bitcoinAddress, workerName) {
        try {
            const workerAddress = this.calculateWorkerAddress(bitcoinAddress, workerName);

            const owner = await this.getWorkerOwner(workerAddress);
            if (owner === ethers.constants.AddressZero) {
                throw new Error('Worker not claimed. Please claim the worker first.');
            }

            if (owner.toLowerCase() !== wallet.account.toLowerCase()) {
                throw new Error('You do not own this worker');
            }

            console.log('Connecting worker to pool:', {
                poolAddress,
                workerAddress,
                owner
            });

            const connection = {
                poolAddress,
                workerAddress,
                bitcoinAddress,
                workerName,
                connectedAt: Date.now(),
                status: 'connected'
            };

            this.connections.set(workerAddress, connection);

            return connection;

        } catch (error) {
            console.error('Failed to connect to pool:', error);
            throw error;
        }
    }

    disconnectFromPool(workerAddress) {
        if (this.connections.has(workerAddress)) {
            this.connections.delete(workerAddress);
            console.log('Worker disconnected:', workerAddress);
        }
    }

    getConnection(workerAddress) {
        return this.connections.get(workerAddress);
    }

    getAllConnections() {
        return Array.from(this.connections.values());
    }

    isConnected(workerAddress) {
        return this.connections.has(workerAddress);
    }

    async submitShare(workerAddress, shareData) {
        const connection = this.connections.get(workerAddress);
        if (!connection) {
            throw new Error('Worker not connected to any pool');
        }

        console.log('Submitting share:', {
            workerAddress,
            poolAddress: connection.poolAddress,
            shareData
        });

        return true;
    }

    async getWorkerStats(workerAddress) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const owner = await this.getWorkerOwner(workerAddress);

            const stats = {
                workerAddress,
                owner,
                isClaimed: owner !== ethers.constants.AddressZero,
                isConnected: this.connections.has(workerAddress)
            };

            const connection = this.connections.get(workerAddress);
            if (connection) {
                stats.poolAddress = connection.poolAddress;
                stats.connectedAt = connection.connectedAt;
            }

            return stats;

        } catch (error) {
            console.error('Error getting worker stats:', error);
            throw error;
        }
    }

    startAutoRefresh(intervalMs = 30000) {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        this.refreshInterval = setInterval(async () => {
            console.log('Auto-refreshing workers...');
            await this.loadWorkersFromAPI();
        }, intervalMs);

        console.log(`Auto-refresh started (interval: ${intervalMs}ms)`);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
            console.log('Auto-refresh stopped');
        }
    }

    destroy() {
        this.stopAutoRefresh();
        this.connections.clear();
        this.workers.clear();
        this.aggregator = null;
        this.initialized = false;
        console.log('StratumWorkerManager destroyed');
    }
}

window.stratumWorkerManager = new StratumWorkerManager();
