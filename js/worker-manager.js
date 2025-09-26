// js/worker-manager.js
class WorkerManager {
    constructor() {
        this.workers = [];
        this.unassignedWorkers = [];
    }

    async registerWorker(poolAddress, workerId, hashRate) {
        // Register on Ethereum
        const poolCore = web3Integrator.getContract('CORE');
        const tx = await poolCore.registerParticipant();
        await tx.wait();

        // Register on Bitcoin API
        const workerData = {
            workerId: workerId,
            poolId: poolAddress,
            hashRate: parseInt(hashRate)
        };

        const response = await fetch(`${CONFIG.API.BITCOIN}${CONFIG.API.ENDPOINTS.WORKERS}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(workerData)
        });

        if (!response.ok) {
            throw new Error('Failed to create Bitcoin worker');
        }

        return await response.json();
    }

    async loadWorkers() {
        const response = await fetch(`${CONFIG.API.BITCOIN}${CONFIG.API.ENDPOINTS.WORKERS}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        // Handle different response formats
        if (Array.isArray(data)) {
            this.workers = data;
        } else if (data && Array.isArray(data.workers)) {
            this.workers = data.workers;
        } else if (data && Array.isArray(data.data)) {
            this.workers = data.data;
        } else {
            this.workers = [];
        }

        return this.workers;
    }

    async loadUnassignedWorkers() {
        try {
            // Просто загружаем всех воркеров - НЕ пытаемся обратиться к /workers/unassigned
            await this.loadWorkers();

            // Показываем всех воркеров как неназначенных для тестирования
            this.unassignedWorkers = this.workers;

        } catch (error) {
            console.log('Error loading workers:', error);
            this.unassignedWorkers = [];
        }

        return this.unassignedWorkers;
    }

    async claimWorker(workerId) {
        const response = await fetch(`${CONFIG.API.BITCOIN}/workers/${workerId}/link-miner`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                miner_address: web3Integrator.currentAccount
            })
        });

        if (!response.ok) {
            throw new Error('Failed to claim worker');
        }

        return await response.json();
    }

    async getMinersWorkers(minerAddress) {
        const response = await fetch(`${CONFIG.API.BITCOIN}/miners/${minerAddress}/workers`);

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        return data.workers || [];
    }
}

window.workerManager = new WorkerManager();
