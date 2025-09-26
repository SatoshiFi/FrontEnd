// js/ui-controller.js
class UIController {
    constructor() {
        this.currentTab = 'pools';
        this.statusTimeout = null;
    }

    init() {
        this.setupEventListeners();
        this.setupWeb3Listeners();
    }

    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = e.target.textContent.toLowerCase()
                .replace(' setup', '')
                .replace('frost', 'frost');
                this.showTab(tabName);
            });
        });
    }

    setupWeb3Listeners() {
        web3Integrator.onStateChange((event, data) => {
            switch(event) {
                case 'connected':
                    this.updateConnectionStatus(true, data.account);
                    this.showStatus('Connected to MetaMask successfully', 'success');
                    // Auto-fill custodians field with current account for solo mining
                    if (document.getElementById('custodians')) {
                        document.getElementById('custodians').value = data.account;
                        document.getElementById('threshold').value = '1';
                    }
                    // Update miner info
                    if (document.getElementById('miner-address')) {
                        document.getElementById('miner-address').textContent = data.account;
                    }
                    break;
                case 'disconnected':
                    this.updateConnectionStatus(false);
                    this.showStatus('Wallet disconnected', 'info');
                    break;
                case 'error':
                    this.showStatus(`Error: ${data.message}`, 'error');
                    break;
            }
        });
    }

    showTab(tabName) {
        // Fix for statistics -> stats mismatch
        if (tabName === 'statistics') {
            tabName = 'stats';
        }

        // Hide all tabs
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // Remove active from all buttons
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tab
        const tabElement = document.getElementById(`${tabName}-tab`);
        if (tabElement) {
            tabElement.classList.add('active');
        }

        // Activate button - need to search for correct button text
        const button = Array.from(document.querySelectorAll('.tab-button'))
        .find(btn => {
            const btnText = btn.textContent.toLowerCase();
            if (tabName === 'stats') {
                return btnText === 'statistics';
            }
            return btnText.includes(tabName);
        });

        if (button) {
            button.classList.add('active');
        }

        this.currentTab = tabName;

        // Load tab-specific data
        if (tabName === 'miners') {
            this.loadMinersTab();
        }
    }

    async loadMinersTab() {
        // Load unassigned workers
        try {
            const unassigned = await workerManager.loadUnassignedWorkers();
            this.displayUnassignedWorkers(unassigned);

            // Load miner's workers
            if (web3Integrator.currentAccount) {
                const myWorkers = await workerManager.getMinersWorkers(web3Integrator.currentAccount);
                document.getElementById('miner-worker-count').textContent = myWorkers.length;
            }
        } catch (error) {
            console.error('Error loading miners tab:', error);
        }
    }

    displayUnassignedWorkers(workers) {
        const container = document.getElementById('unassigned-workers');

        if (!workers || workers.length === 0) {
            container.innerHTML = '<p style="text-align: center; opacity: 0.7;">No unassigned workers available</p>';
            return;
        }

        container.innerHTML = workers.map(worker => `
        <div style="padding: 10px; margin: 10px 0; background: rgba(255,255,255,0.05); border-radius: 5px;">
        <input type="checkbox" id="worker-${worker.id}" value="${worker.id}">
        <label for="worker-${worker.id}" style="margin-left: 10px;">
        <strong>${worker.name || worker.id}</strong>
        <span style="margin-left: 15px;">Hashrate: ${worker.hashrate || 0} TH/s</span>
        <span style="margin-left: 15px;">Pool: ${worker.pool_id}</span>
        </label>
        </div>
        `).join('');
    }

    updateConnectionStatus(connected, account = null) {
        const indicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const connectBtn = document.getElementById('connectBtn');

        if (connected && account) {
            indicator.className = 'status-indicator status-connected';
            statusText.textContent = `Connected: ${account.substring(0, 6)}...${account.substring(-4)}`;
            connectBtn.style.display = 'none';
        } else {
            indicator.className = 'status-indicator status-disconnected';
            statusText.textContent = 'Not connected to wallet';
            connectBtn.style.display = 'inline-block';
        }
    }

    showStatus(message, type) {
        const statusElement = document.getElementById('statusMessage');
        statusElement.textContent = message;
        statusElement.className = `status-message status-${type}`;
        statusElement.style.display = 'block';

        // Clear previous timeout
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }

        // Hide after 5 seconds
        this.statusTimeout = setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }

    async refreshPoolsList() {
        try {
            const pools = await poolManager.loadPools();
            const poolsList = document.getElementById('pools-list');

            if (pools.length === 0) {
                poolsList.innerHTML = '<p style="text-align: center; opacity: 0.7;">No pools found.</p>';
                return;
            }

            poolsList.innerHTML = pools.map(pool => `
            <div class="pool-item">
            <h4>${pool.name || pool.pool_id}</h4>
            <p>Address: ${pool.bitcoin_address}</p>
            <p>Fee: ${(pool.fee_percentage * 100).toFixed(2)}%</p>
            <button class="btn btn-secondary" onclick="uiController.selectPool('${pool.pool_id}')">Select</button>
            </div>
            `).join('');

            // Update selectors
            this.updatePoolSelectors(pools);

        } catch (error) {
            this.showStatus(`Error loading pools: ${error.message}`, 'error');
        }
    }

    updatePoolSelectors(pools) {
        const selectors = ['selected-pool', 'reward-pool'];
        selectors.forEach(id => {
            const select = document.getElementById(id);
            if (select) {
                select.innerHTML = '<option value="">Select a pool...</option>';
                pools.forEach(pool => {
                    select.innerHTML += `<option value="${pool.pool_id}">${pool.name || pool.pool_id}</option>`;
                });
            }
        });
    }

    selectPool(poolId) {
        document.getElementById('selected-pool').value = poolId;
        document.getElementById('reward-pool').value = poolId;
        this.showStatus(`Selected pool: ${poolId}`, 'success');
        this.showTab('workers');
    }

    async refreshWorkersList() {
        try {
            const workers = await workerManager.loadWorkers();
            const workersList = document.getElementById('workers-list');

            if (workers.length === 0) {
                workersList.innerHTML = '<p style="text-align: center; opacity: 0.7;">No workers found.</p>';
                return;
            }

            workersList.innerHTML = workers.map(worker => `
            <div class="worker-item">
            <h4>${worker.name || worker.id || 'Unknown'}</h4>
            <p>Pool: ${worker.pool_id || 'N/A'}</p>
            <p>Hash Rate: ${worker.hashrate || 0} TH/s</p>
            <p>Status: ${worker.status || 'Unknown'}</p>
            ${worker.miner_address ? `<p>Miner: ${worker.miner_address.substring(0, 6)}...${worker.miner_address.substring(-4)}</p>` : ''}
            </div>
            `).join('');

        } catch (error) {
            this.showStatus(`Error loading workers: ${error.message}`, 'error');
        }
    }

    displayGeneratedKeys() {
        if (!poolManager.currentDKGSession || !poolManager.currentDKGSession.groupPubkey) return;

        const session = poolManager.currentDKGSession;
        const keysDiv = document.getElementById('group-keys');

        keysDiv.innerHTML = `
        <div class="card" style="background: rgba(16,185,129,0.1); border: 1px solid #10b981;">
        <h4 style="color: #34d399;">Generated Group Key (Session ${session.id})</h4>
        <div style="font-family: monospace; font-size: 0.9rem; margin: 15px 0;">
        <p><strong>Pubkey X:</strong> ${session.groupPubkey.x}</p>
        <p><strong>Pubkey Y:</strong> ${session.groupPubkey.y}</p>
        <p><strong>Threshold:</strong> ${session.threshold}/${session.custodians.length}</p>
        </div>
        <button class="btn btn-success" onclick="uiController.useForPool()">Use for Pool Creation</button>
        </div>
        `;
    }

    useForPool() {
        const session = poolManager.currentDKGSession;
        if (!session || !session.groupPubkey) return;

        document.getElementById('pubkey-x').value = session.groupPubkey.x;
        document.getElementById('pubkey-y').value = session.groupPubkey.y;

        const payoutScript = poolManager.generatePayoutScript(session.groupPubkey.x);
        document.getElementById('payout-script').value = payoutScript;

        this.showStatus('FROST keys applied to pool creation form', 'success');
        this.showTab('pools');
    }
}

window.uiController = new UIController();
