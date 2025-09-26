// js/mining-app.js
class MiningPoolApp {
    constructor() {
        this.statsInterval = null;
    }

    async init() {
        try {
            // Initialize UI
            uiController.init();

            // Initialize Web3
            await web3Integrator.init();

            // Load initial data
            if (web3Integrator.connected) {
                await this.loadInitialData();
            }

            // Setup auto-refresh
            this.startAutoRefresh();

            // Bind global functions for onclick handlers
            this.bindGlobalFunctions();

        } catch (error) {
            console.error('App initialization error:', error);
            uiController.showStatus('Failed to initialize app: ' + error.message, 'error');
        }
    }

    async loadInitialData() {
        await uiController.refreshPoolsList();
        await this.refreshMiningStats();
    }

    bindGlobalFunctions() {
        // Wallet connection
        window.connectWallet = async () => {
            try {
                await web3Integrator.connect();
                await this.loadInitialData();
            } catch (error) {
                uiController.showStatus('Connection failed: ' + error.message, 'error');
            }
        };

        // Pool functions
        window.createPool = async () => {
            try {
                const poolData = {
                    poolId: document.getElementById('pool-id').value,
                    pubX: document.getElementById('pubkey-x').value,
                    pubY: document.getElementById('pubkey-y').value,
                    mpName: document.getElementById('mp-name').value,
                    mpSymbol: document.getElementById('mp-symbol').value,
                    payoutScript: document.getElementById('payout-script').value,
                    calculatorId: parseInt(document.getElementById('calculator').value)
                };

                if (!poolData.poolId || !poolData.mpName || !poolData.mpSymbol) {
                    throw new Error('Please fill in all required fields');
                }

                if (!poolData.pubX || !poolData.pubY) {
                    throw new Error('Please generate FROST group keys first');
                }

                uiController.showStatus('Creating pool...', 'info');
                const poolAddress = await poolManager.createPool(poolData);
                uiController.showStatus(`Pool created: ${poolAddress}`, 'success');
                await uiController.refreshPoolsList();

            } catch (error) {
                uiController.showStatus('Error: ' + error.message, 'error');
            }
        };

        window.refreshPoolsList = () => uiController.refreshPoolsList();

        // FROST functions
        window.startDKG = async () => {
            try {
                const custodiansText = document.getElementById('custodians').value.trim();
                const threshold = parseInt(document.getElementById('threshold').value);
                const deadlineHours = parseInt(document.getElementById('deadline').value);

                if (!custodiansText || !threshold || !deadlineHours) {
                    throw new Error('Please fill in all fields');
                }

                const custodians = custodiansText.split('\n')
                .map(addr => addr.trim())
                .filter(addr => addr.length > 0);

                if (custodians.length < threshold) {
                    throw new Error('Threshold cannot be greater than number of custodians');
                }

                uiController.showStatus('Starting DKG session...', 'info');
                const sessionId = await poolManager.startDKG(custodians, threshold, deadlineHours);
                uiController.showStatus(`DKG session ${sessionId} created`, 'success');
                uiController.displayGeneratedKeys();

            } catch (error) {
                uiController.showStatus('Error: ' + error.message, 'error');
            }
        };

        window.finalizeDKG = async () => {
            try {
                uiController.showStatus('Finalizing DKG...', 'info');
                const groupPubkey = await poolManager.finalizeDKG();
                uiController.showStatus('DKG finalized successfully', 'success');
                uiController.useForPool();
            } catch (error) {
                uiController.showStatus('Error: ' + error.message, 'error');
            }
        };

        // Worker functions
        window.registerWorker = async () => {
            try {
                const poolAddress = document.getElementById('selected-pool').value;
                const workerId = document.getElementById('worker-id').value;
                const hashRate = document.getElementById('hashrate').value;

                if (!poolAddress || !workerId || !hashRate) {
                    throw new Error('Please fill in all fields');
                }

                uiController.showStatus('Registering worker...', 'info');
                await workerManager.registerWorker(poolAddress, workerId, hashRate);
                uiController.showStatus('Worker registered successfully', 'success');
                await uiController.refreshWorkersList();

            } catch (error) {
                uiController.showStatus('Error: ' + error.message, 'error');
            }
        };

        window.refreshWorkersList = () => uiController.refreshWorkersList();

        // Miner functions
        window.claimSelectedWorkers = async () => {
            try {
                const checkboxes = document.querySelectorAll('#unassigned-workers input[type="checkbox"]:checked');

                if (checkboxes.length === 0) {
                    uiController.showStatus('Please select workers to claim', 'warning');
                    return;
                }

                uiController.showStatus(`Claiming ${checkboxes.length} workers...`, 'info');

                for (const checkbox of checkboxes) {
                    const workerId = checkbox.value;
                    await workerManager.claimWorker(workerId);
                }

                uiController.showStatus(`Successfully claimed ${checkboxes.length} workers`, 'success');
                await uiController.loadMinersTab();

            } catch (error) {
                uiController.showStatus('Error claiming workers: ' + error.message, 'error');
            }
        };

        // Mining control functions
        window.startMining = async () => {
            try {
                const response = await fetch(`${CONFIG.API.BITCOIN}/mining/start`, {
                    method: 'POST'
                });
                const result = await response.json();
                uiController.showStatus('Mining started', 'success');
            } catch (error) {
                uiController.showStatus('Failed to start mining: ' + error.message, 'error');
            }
        };

        window.stopMining = async () => {
            try {
                const response = await fetch(`${CONFIG.API.BITCOIN}/mining/stop`, {
                    method: 'POST'
                });
                const result = await response.json();
                uiController.showStatus('Mining stopped', 'info');
            } catch (error) {
                uiController.showStatus('Failed to stop mining: ' + error.message, 'error');
            }
        };

        window.startShares = async () => {
            try {
                const response = await fetch(`${CONFIG.API.BITCOIN}/shares/start`, {
                    method: 'POST'
                });
                const result = await response.json();
                uiController.showStatus('Share generation started', 'success');
            } catch (error) {
                uiController.showStatus('Failed to start shares: ' + error.message, 'error');
            }
        };

        window.stopShares = async () => {
            try {
                const response = await fetch(`${CONFIG.API.BITCOIN}/shares/stop`, {
                    method: 'POST'
                });
                const result = await response.json();
                uiController.showStatus('Share generation stopped', 'info');
            } catch (error) {
                uiController.showStatus('Failed to stop shares: ' + error.message, 'error');
            }
        };

        // Stats functions
        window.refreshMiningStats = () => this.refreshMiningStats();
        window.testAPI = () => this.testAPI();

        // Tab switching
        window.showTab = (tabName) => uiController.showTab(tabName);

        // FROST functions
        window.refreshFROSTSessions = async () => {
            try {
                console.log('Refreshing FROST sessions...');
                uiController.showStatus('Loading FROST sessions...', 'info');

                if (!window.frostSessionsManager) {
                    uiController.showStatus('FROST manager not initialized', 'error');
                    return;
                }

                await frostSessionsManager.refreshSessionsList();
                uiController.showStatus('FROST sessions loaded', 'success');
            } catch (error) {
                console.error('Error refreshing FROST sessions:', error);
                uiController.showStatus('Error loading FROST sessions: ' + error.message, 'error');
                }
            }
        };

    async refreshMiningStats() {
        try {
            const [sharesResponse, blocksResponse, workersResponse, statsResponse] = await Promise.all([
                fetch(`${CONFIG.API.BITCOIN}${CONFIG.API.ENDPOINTS.SHARES}?hours=24`),
                                                                                                       fetch(`${CONFIG.API.BITCOIN}${CONFIG.API.ENDPOINTS.BLOCKS}`),
                                                                                                       fetch(`${CONFIG.API.BITCOIN}${CONFIG.API.ENDPOINTS.WORKERS}`),
                                                                                                       fetch(`${CONFIG.API.BITCOIN}/stats`)
            ]);

            const sharesData = await sharesResponse.json();
            const blocksData = await blocksResponse.json();
            const workersData = await workersResponse.json();
            const statsData = await statsResponse.json();

            // Update stats numbers
            document.getElementById('total-shares').textContent = sharesData.total_shares || 0;
            document.getElementById('valid-shares').textContent = sharesData.valid_shares || 0;
            document.getElementById('total-blocks').textContent = statsData.total_blocks || 0;
            document.getElementById('active-workers').textContent = statsData.active_workers || 0;

            // Update detailed stats with control buttons
            const statsDiv = document.getElementById('mining-stats');
            const latestBlock = blocksData.blocks?.[0];
            const validShareRate = sharesData.total_shares > 0
            ? ((sharesData.valid_shares / sharesData.total_shares) * 100).toFixed(2)
            : 0;

            statsDiv.innerHTML = `
            <div class="grid">
            <div class="card">
            <h4>Block Statistics</h4>
            <p>Latest Block: ${latestBlock ? latestBlock.height : 'N/A'}</p>
            <p>Pool Winner: ${latestBlock ? latestBlock.pool_id : 'N/A'}</p>
            <p>Total Hashrate: ${statsData.total_hashrate || 0} TH/s</p>
            </div>
            <div class="card">
            <h4>Share Statistics</h4>
            <p>Valid Share Rate: ${validShareRate}%</p>
            <p>Shares per Hour: ${sharesData.shares_per_hour || 0}</p>
            <p>Active Workers: ${sharesData.active_workers || 0}</p>
            </div>
            </div>

            `;

        } catch (error) {
            console.error('Stats refresh error:', error);
            document.getElementById('mining-stats').innerHTML = `
            <p style="text-align: center; color: #f87171;">Error loading statistics: ${error.message}</p>
            <div style="margin-top: 20px; text-align: center;">
            <button class="btn btn-secondary" onclick="testAPI()">Test API Connection</button>
            </div>
            `;
        }
    }

    async testAPI() {
        console.log('Testing API endpoints...');
        uiController.showStatus('Testing API connection...', 'info');

        const endpoints = Object.values(CONFIG.API.ENDPOINTS);
        let successCount = 0;

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`${CONFIG.API.BITCOIN}${endpoint}`);
                if (response.ok) successCount++;
                console.log(`${endpoint}: ${response.status}`);
            } catch (error) {
                console.error(`${endpoint}: Failed`);
            }
        }

        if (successCount === endpoints.length) {
            uiController.showStatus('All API endpoints working', 'success');
        } else {
            uiController.showStatus(`${successCount}/${endpoints.length} endpoints working`, 'warning');
        }
    }

    startAutoRefresh() {
        // Refresh stats every 30 seconds
        this.statsInterval = setInterval(() => {
            this.refreshMiningStats();
        }, 30000);
    }

    destroy() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    window.miningApp = new MiningPoolApp();
    await miningApp.init();
});
