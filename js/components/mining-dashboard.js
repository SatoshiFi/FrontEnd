// js/components/mining-dashboard.js - УПРОЩЁННАЯ ВЕРСИЯ БЕЗ ОШИБОК
class MiningDashboard {
    constructor() {
        this.stats = {};
        this.allWorkers = [];
        this.refreshInterval = null;
    }

    async initialize() {
        if (!wallet.connected) {
            this.showWalletRequired();
            return;
        }

        await this.buildMiningInterface();
        await this.loadAllWorkers();
    }

    showWalletRequired() {
        const container = document.getElementById('miningStats');
        if (!container) return;

        container.innerHTML = `
        <div class="empty-state">
        <div class="empty-icon">🔗</div>
        <h3>Wallet Required</h3>
        <p>Please connect your wallet to access mining features</p>
        <button onclick="wallet.connect()" class="btn btn-primary">
        Connect Wallet
        </button>
        </div>
        `;
    }

    async buildMiningInterface() {
        const container = document.getElementById('miningStats');
        const controls = document.getElementById('miningControls');

        if (controls) {
            controls.innerHTML = `
            <div class="mining-controls-container">
            <div class="mining-actions">
            <button id="browseWorkers" class="btn btn-primary">
            ⛏️ Browse Workers
            </button>
            <button id="refreshWorkers" class="btn btn-secondary">
            🔄 Refresh
            </button>
            </div>
            </div>
            `;

            this.bindControlEvents();
        }

        if (container) {
            container.innerHTML = `
            <div class="mining-overview">
            <div class="overview-cards">
            <div class="stat-card">
            <h4>Available Workers</h4>
            <div class="stat-value" id="totalWorkersCount">0</div>
            </div>
            <div class="stat-card">
            <h4>Total Hashrate</h4>
            <div class="stat-value" id="totalHashrate">0 TH/s</div>
            </div>
            <div class="stat-card">
            <h4>Active Workers</h4>
            <div class="stat-value" id="activeWorkers">0</div>
            </div>
            </div>

            <div class="info-section">
            <h3>Worker Management</h3>
            <p>Click "Browse Workers" to view all available mining workers and claim ownership.</p>
            <p>You can claim any worker by verifying your access with the worker name.</p>
            </div>
            </div>
            `;
        }
    }

    bindControlEvents() {
        document.getElementById('browseWorkers')?.addEventListener('click', () => {
            this.showBrowseWorkersInterface();
        });

        document.getElementById('refreshWorkers')?.addEventListener('click', () => {
            this.loadAllWorkers();
        });
    }

    async loadAllWorkers() {
        try {
            app.showLoading('Loading workers...');

            // ИСПРАВЛЕНО: убираем Cache-Control заголовок
            const response = await fetch(`${CONFIG.API.MINING}/api/workers`);

            if (!response.ok) throw new Error('Failed to load workers');

            const data = await response.json();
            this.allWorkers = data.workers || [];

            console.log(`Loaded ${this.allWorkers.length} workers from Mining Simulator`);

            this.updateStats();
            app.hideLoading();

        } catch (error) {
            app.hideLoading();
            console.error('Error loading workers:', error);
            app.showNotification('error', 'Failed to load workers');
        }
    }

    async showBrowseWorkersInterface() {
        try {
            if (!wallet.connected) {
                app.showNotification('warning', 'Please connect wallet first');
                return;
            }

            app.showLoading('Loading workers...');

            const response = await fetch(`${CONFIG.API.MINING}/api/workers`);
            if (!response.ok) throw new Error('Failed to load workers');

            const data = await response.json();
            this.allWorkers = data.workers || [];

            console.log(`Loaded ${this.allWorkers.length} workers for browsing`);

            const controls = document.getElementById('miningControls');
            if (controls) {
                controls.style.display = 'none';
            }

            const container = document.getElementById('miningStats');
            container.innerHTML = `
            <div class="browse-workers-container">
            <!-- СТРОКА 1: Поиск и кнопки (без статистики) -->
            <div class="browse-header">
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
            <div class="header-actions">
            <button onclick="miningDashboard.refreshBrowseWorkers()" class="btn btn-secondary">
            Refresh
            </button>
            <button onclick="miningDashboard.closeBrowseWorkers()" class="btn btn-secondary">
            Close
            </button>
            </div>
            </div>

            <!-- СТРОКА 2: Таблица -->
            <div class="workers-table-container">
            <table class="workers-table">
            <thead>
            <tr>
            <th>Worker ID</th>
            <th class="mobile-hide">Owned</th>
            <th class="mobile-hide">Hashrate</th>
            <th>Status</th>
            <th class="mobile-hide">Valid Shares</th>
            <th class="mobile-hide">Validity Rate</th>
            <th>Action</th>
            </tr>
            </thead>
            <tbody id="workersTableBody">
            <tr><td colspan="7" style="text-align: center; padding: 20px;">Loading workers...</td></tr>
            </tbody>
            </table>
            </div>
            </div>
            `;

            await this.renderWorkerRows();
            app.hideLoading();

        } catch (error) {
            app.hideLoading();
            console.error('Error loading workers:', error);
            app.showNotification('error', 'Failed to load workers');
        }
    }

    async renderWorkerRows() {
        const tbody = document.getElementById('workersTableBody');
        if (!tbody) return;

        // Рендерим строки БЕЗ проверки владения (быстро)
        const rows = this.allWorkers.map(w => this.renderWorkerRowFast(w));
        tbody.innerHTML = rows.join('');
    }

    renderWorkerRowFast(worker) {
        const validityRate = worker.total_shares > 0
        ? ((worker.valid_shares / worker.total_shares) * 100).toFixed(2)
        : '0.00';

        return `
        <tr data-worker-id="${worker.id}">
        <td><code>${worker.id}</code></td>
        <td class="mobile-hide">
        <span class="owned-badge owned-unknown" id="owned-${worker.id}">
        Unknown
        </span>
        <button
        class="btn-check-ownership"
        onclick="miningDashboard.checkWorkerOwnership('${worker.id}', '${worker.name}')"
        title="Check ownership">
        🔍
        </button>
        </td>
        <td class="mobile-hide">${worker.hashrate} TH/s</td>
        <td>
        <span class="status-badge ${worker.status}">
        ${worker.status}
        </span>
        </td>
        <td class="mobile-hide">${worker.valid_shares.toLocaleString()} / ${worker.total_shares.toLocaleString()}</td>
        <td class="mobile-hide">${validityRate}%</td>
        <td>
        <button
        onclick="miningDashboard.initiateWorkerClaim('${worker.id}')"
        class="btn btn-primary btn-sm"
        id="claim-btn-${worker.id}">
        Claim
        </button>
        </td>
        </tr>
        `;
    }

    updateStats() {
        const totalWorkers = this.allWorkers.length;
        const activeWorkers = this.allWorkers.filter(w => w.status === 'active').length;
        const totalHashrate = this.allWorkers.reduce((sum, w) => sum + (w.hashrate || 0), 0);

        document.getElementById('totalWorkersCount').textContent = totalWorkers;
        document.getElementById('activeWorkers').textContent = activeWorkers;
        document.getElementById('totalHashrate').textContent = `${totalHashrate.toFixed(2)} TH/s`;
    }

    // ========== WORKER CLAIM SYSTEM ==========

    filterWorkersBySearch() {
        const searchInput = document.getElementById('workerSearchInput');
        if (!searchInput) return;

        const searchValue = searchInput.value.toLowerCase();
        const rows = document.querySelectorAll('#workersTableBody tr');

        rows.forEach(row => {
            const workerId = row.dataset.workerId.toLowerCase();
            const workerName = row.dataset.workerName.toLowerCase();

            if (workerId.includes(searchValue) || workerName.includes(searchValue)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    async checkWorkerOwnership(workerId, workerName) {
        try {
            const badge = document.getElementById(`owned-${workerId}`);
            const claimBtn = document.getElementById(`claim-btn-${workerId}`);

            if (badge) {
                badge.className = 'owned-badge owned-checking';
                badge.textContent = 'Checking...';
            }

            if (!stratumWorkerManager.initialized) {
                await stratumWorkerManager.initialize();
            }

            const { registered, minerAddress } = await stratumWorkerManager.getWorkerOwnerByWorkerId(workerId);

            if (badge) {
                badge.className = `owned-badge ${registered ? 'owned-yes' : 'owned-no'}`;
                badge.textContent = registered ? 'Yes' : 'No';
            }

            if (claimBtn) {
                if (registered) {
                    if (minerAddress.toLowerCase() === wallet.account.toLowerCase()) {
                        // Свой воркер - блокируем
                        claimBtn.textContent = 'My Worker';
                        claimBtn.disabled = true;
                        claimBtn.classList.remove('btn-primary');
                        claimBtn.classList.add('btn-success');
                    } else {
                        // Чужой воркер - разрешаем Re-Claim
                        claimBtn.textContent = 'Re-Claim';
                        claimBtn.disabled = false;
                        claimBtn.classList.remove('btn-success');
                        claimBtn.classList.add('btn-warning');
                    }
                }
            }

        } catch (error) {
            console.error('Error checking ownership:', error);
            const badge = document.getElementById(`owned-${workerId}`);
            if (badge) {
                badge.className = 'owned-badge owned-error';
                badge.textContent = 'Error';
            }
        }
    }

    closeBrowseWorkers() {
        const controls = document.getElementById('miningControls');
        if (controls) {
            controls.style.display = '';
        }

        this.initialize();
    }

    async refreshBrowseWorkers() {
        await this.showBrowseWorkersInterface();
    }

    initiateWorkerClaim(workerId) {
        if (!wallet.connected) {
            app.showNotification('warning', 'Please connect wallet first');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content worker-claim-modal">
        <div class="modal-header">
        <div class="modal-header-content">
        <div class="modal-icon">⛏️</div>
        <div class="modal-title-section">
        <h3>Claim Worker Ownership</h3>
        <p class="modal-subtitle">Link your mining equipment to your Ethereum address</p>
        </div>
        </div>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>

        <div class="modal-body">
        <div class="info-card primary-info">
        <div class="info-header">
        <span class="info-icon">ℹ️</span>
        <h4>Worker Information</h4>
        </div>
        <div class="info-grid">
        <div class="info-item">
        <span class="label">Worker ID</span>
        <span class="value"><code>${workerId}</code></span>
        </div>
        <div class="info-item">
        <span class="label">Your Address</span>
        <span class="value"><code>${wallet.formatAddress(wallet.account)}</code></span>
        </div>
        </div>
        </div>

        <div class="form-section">
        <div class="form-group">
        <label class="form-label required">
        <span class="label-icon">₿</span>
        Bitcoin Payout Address
        </label>
        <input
        type="text"
        id="bitcoinPayoutAddress"
        class="form-input"
        placeholder="tb1q... or bc1q..."
        pattern="^(tb1|bc1)[a-z0-9]{39,87}$"
        />
        <small class="form-help">
        Bech32 format required. This address will receive your mining rewards.
        </small>
        </div>

        <div class="form-group">
        <label class="form-label required">
        <span class="label-icon">🔐</span>
        Worker Name (Verification Secret)
        </label>
        <input
        type="password"
        id="workerSecret"
        class="form-input"
        placeholder="Enter worker name from mining config"
        maxlength="20"
        />
        <small class="form-help">
        This is the worker name configured on your mining hardware. It proves you own this equipment.
        </small>
        </div>
        </div>

        <div class="alert-box warning">
        <div class="alert-icon">⚠️</div>
        <div class="alert-content">
        <h5>Important Security Information</h5>
        <ul>
        <li>Worker name must exactly match your hardware configuration</li>
        <li>Never share your worker name publicly</li>
        <li>Admin will review and approve your claim request</li>
        <li>Once approved, worker is permanently linked to your address</li>
        </ul>
        </div>
        </div>
        </div>

        <div class="modal-footer">
        <button
        onclick="this.closest('.modal-overlay').remove()"
        class="btn btn-secondary">
        <span class="btn-icon">❌</span>
        Cancel
        </button>
        <button
        onclick="miningDashboard.submitWorkerClaim('${workerId}')"
        class="btn btn-primary"
        id="submitClaimBtn">
        <span class="btn-icon">✅</span>
        Submit Claim Request
        </button>
        </div>
        </div>
        `;

        document.body.appendChild(modal);
    }

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

            // Загрузить данные воркера из API
            const response = await fetch(`${CONFIG.API.MINING}/api/workers`);
            if (!response.ok) throw new Error('Failed to load workers from API');

            const data = await response.json();
            const worker = data.workers.find(w => w.id === workerId);

            if (!worker) {
                throw new Error('Worker not found in system');
            }

            // Проверить секрет (сравнение с worker.name)
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

            // Инициализировать stratum worker manager
            if (!stratumWorkerManager.initialized) {
                await stratumWorkerManager.initialize();
            }

            // ИСПРАВЛЕНО: Вычислить workerAddress (address, не bytes32)
            const workerAddress = stratumWorkerManager.calculateWorkerAddress(
                bitcoinAddress,
                worker.name
            );

            console.log('Calculated workerAddress for contract:', workerAddress);
            console.log('Length check:', workerAddress.length, '(должно быть 42)');

            // КРИТИЧНО: Проверка длины
            if (workerAddress.length !== 42) {
                throw new Error(`Invalid workerAddress length: ${workerAddress.length} (expected 42)`);
            }

            // ИСПРАВЛЕНО: Отправляем через submitWorkerClaimRequest с полным metadata
            const success = await requests.submitWorkerClaimRequest(
                workerId,
                workerAddress,  // address (42 символа)
            worker,         // полные данные воркера
            bitcoinAddress  // Bitcoin payout address
            );

            if (success) {
                app.hideLoading();
                document.querySelector('.modal-overlay')?.remove();
                app.showNotification('success', 'Worker claim request submitted successfully!');
                this.showClaimSubmittedInfo(worker, bitcoinAddress, workerAddress);
            }

        } catch (error) {
            app.hideLoading();
            console.error('Worker claim submission error:', error);
            app.showNotification('error', `Failed to submit claim: ${error.message}`);
        }
    }

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

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        this.allWorkers = [];
    }
}

// Global instance
window.miningDashboard = new MiningDashboard();
