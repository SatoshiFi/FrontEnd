// js/components/requests.js - User authorization request management system
class RequestManager {
    constructor() {
        this.requests = [];
        this.userRequests = [];
        this.initialized = false;
        this.apiBaseUrl = CONFIG.API.REQUESTS;
        this.adminMode = false;
    }

    async initialize() {
        if (this.initialized) return;

        console.log('Initializing RequestManager with API:', this.apiBaseUrl);

        // Test API connection
        const connectionOk = await this.testAPIConnection();
        if (!connectionOk) {
            console.warn('API connection test failed, but continuing with initialization');
        }

        // FIXED: proper admin rights check
        await this.checkAdminRights();

        this.initialized = true;

        // Load data if wallet is connected
        if (wallet.connected) {
            await this.loadUserRequests();

            if (this.adminMode) {
                await this.loadAllRequests();
            }
        }

        console.log('RequestManager initialized successfully, adminMode:', this.adminMode);
    }

    // FIXED: proper admin rights check through MEMBERSHIP_SBT
    async checkAdminRights() {
        try {
            if (!wallet.connected || !window.contracts || !contracts.initialized) {
                this.adminMode = false;
                console.log('Admin rights check: not connected or contracts not initialized');
                return;
            }

            // FIXED: using proper admin rights verification method
            const adminRights = await contracts.checkAdminRights(wallet.account);
            this.adminMode = adminRights.hasAdminRights || adminRights.isAdmin || adminRights.isPoolManager;

            console.log('Admin rights check result:', {
                hasAdminRights: adminRights.hasAdminRights,
                isAdmin: adminRights.isAdmin,
                isPoolManager: adminRights.isPoolManager,
                finalResult: this.adminMode,
                userAddress: wallet.account
            });

        } catch (error) {
            console.error('Failed to check admin rights in requests:', error);
            this.adminMode = false;
        }
    }

    // =============== API TESTING AND DIAGNOSTICS ===============

    async testAPIConnection() {
        try {
            console.log('=== API CONNECTION TEST ===');
            console.log('API Base URL:', this.apiBaseUrl);
            console.log('Wallet connected:', wallet.connected);
            console.log('Wallet account:', wallet.account);

            const testResponse = await fetch(`${this.apiBaseUrl}/requests`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            console.log('Test response status:', testResponse.status);
            console.log('Test response headers:', Array.from(testResponse.headers.entries()));

            if (testResponse.ok) {
                const testData = await testResponse.json();
                console.log('Test response data:', testData);
                console.log('✅ API connection successful');
                return true;
            } else {
                console.error('❌ API connection failed:', testResponse.statusText);
                return false;
            }

        } catch (error) {
            console.error('❌ API connection test failed:', error);
            return false;
        }
    }

    // =============== API METHODS FOR USER REQUESTS ===============

    async submitMembershipRequest(poolId, poolOwner, requestedRole, message) {
        try {
            console.log('Submitting membership request:', {
                poolId,
                poolOwner,
                requestedRole,
                message,
                userAddress: wallet.account
            });

            // ИСПРАВЛЕНО: определяем requestType ПЕРЕД использованием metadata
            let requestType;
            if (poolId.startsWith('0x') && poolId.length === 66) {
                requestType = 'worker_claim';
            } else if (poolId === 'platform_access' || poolId === '0x0000000000000000000000000000000000000000') {
                requestType = 'platform_registration';
            } else {
                requestType = 'pool_role';
            }

            const requestData = {
                requestType: requestType,
                userAddress: wallet.account,
                targetPoolId: poolId,
                requestedRole: requestedRole,
                message: message,
                metadata: {  // ИСПРАВЛЕНО: создаём metadata прямо здесь
                    poolOwner: poolOwner,
                    submittedAt: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    timestamp: Date.now()
                }
            };

            console.log('Sending request data:', requestData);

            const response = await fetch(`${this.apiBaseUrl}/requests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Origin': window.location.origin
                },
                body: JSON.stringify(requestData)
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                let errorData;

                if (contentType && contentType.includes('application/json')) {
                    errorData = await response.json();
                } else {
                    errorData = { error: await response.text() };
                }

                console.error('API Error Response:', errorData);
                throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Request submitted successfully:', result);

            app.showNotification('success', 'Request submitted successfully!');

            await this.loadUserRequests();

            if (userRoles) {
                userRoles.authorizationStatus = 'pending';
                userRoles.applyRoleBasedUI();
                app.updateAuthorizationUI();
            }

            return result;

        } catch (error) {
            console.error('Failed to submit membership request:', error);

            let userMessage = 'Failed to submit request. ';

            if (error.message.includes('fetch')) {
                userMessage += 'Network error - please check your connection.';
            } else if (error.message.includes('400')) {
                userMessage += 'Invalid request data.';
            } else if (error.message.includes('500')) {
                userMessage += 'Server error - please try again later.';
            } else {
                userMessage += error.message;
            }

            app.showNotification('error', userMessage);
            return false;
        }
    }

    /**
     * Submit role request - user can request miner, pool_manager, or custodial role
     */
    async submitRoleRequest(requestedRole, message) {
        try {
            if (!['miner', 'pool_manager', 'custodial'].includes(requestedRole)) {
                throw new Error('Invalid role type. Must be: miner, pool_manager, or custodial');
            }

            console.log('Submitting role request:', {
                requestedRole,
                message,
                userAddress: wallet.account
            });

            // ИСПРАВЛЕНО: копируем структуру из submitMembershipRequest
            const requestData = {
                requestType: 'platform_registration',  // ИЛИ 'pool_role'
                userAddress: wallet.account,
                targetPoolId: 'platform_access',
                requestedRole: requestedRole,
                message: message || `Request for ${requestedRole} role`,
                metadata: {
                    poolOwner: null,  // не привязано к пулу
                    submittedAt: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    timestamp: Date.now(),
                    isAdditionalRoleRequest: true
                }
            };

            console.log('Sending request data:', requestData);

            const response = await fetch(`${this.apiBaseUrl}/requests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Origin': window.location.origin  // ДОБАВЛЕНО из submitMembershipRequest
                },
                body: JSON.stringify(requestData)
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', Array.from(response.headers.entries()));

            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                let errorData;

                if (contentType && contentType.includes('application/json')) {
                    errorData = await response.json();
                } else {
                    errorData = { error: await response.text() };
                }

                console.error('API Error Response:', errorData);
                throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Role request submitted successfully:', result);

            app.showNotification('success', `${requestedRole.toUpperCase()} role request submitted!`);

            await this.loadUserRequests();

            return result;

        } catch (error) {
            console.error('Failed to submit role request:', error);

            let userMessage = 'Failed to submit request. ';
            if (error.message.includes('fetch')) {
                userMessage += 'Network error - please check your connection.';
            } else if (error.message.includes('400')) {
                userMessage += 'Invalid request data.';
            } else if (error.message.includes('500')) {
                userMessage += 'Server error - please try again later.';
            } else {
                userMessage += error.message;
            }

            app.showNotification('error', userMessage);
            return false;
        }
    }

    /**
     * Show role request modal
     */
    showRoleRequestModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content role-request-modal">
        <div class="modal-header">
        <h3>Request Platform Role</h3>
        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="modal-body">
        <p class="modal-description">Select the role you want to request and explain why you need it.</p>

        <div class="form-group">
        <label class="form-label required">Select Role</label>
        <div class="role-options">
        <label class="role-option">
        <input type="radio" name="roleType" value="miner" checked>
        <div class="role-content">
        <h4>Miner</h4>
        <p>Access to mining operations, claim rewards, participate in DKG sessions</p>
        </div>
        </label>

        <label class="role-option">
        <input type="radio" name="roleType" value="pool_manager">
        <div class="role-content">
        <h4>Pool Manager</h4>
        <p>Create and manage mining pools, configure pool settings, manage FROST governance</p>
        </div>
        </label>

        <label class="role-option">
        <input type="radio" name="roleType" value="custodial">
        <div class="role-content">
        <h4>Custodial</h4>
        <p>Sign transactions, manage custody operations, participate in threshold signatures</p>
        </div>
        </label>
        </div>
        </div>

        <div class="form-group">
        <label class="form-label required">Why do you need this role?</label>
        <textarea id="roleRequestMessage" class="form-input" rows="4"
        placeholder="Explain your use case and why you need this role..." required></textarea>
        <small class="form-help">Provide details about your intended use to help admin review your request</small>
        </div>
        </div>

        <div class="modal-actions">
        <button onclick="requests.submitRoleRequestFromModal(this.parentElement.parentElement)"
        class="btn btn-primary">
        Submit Request
        </button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()"
        class="btn btn-secondary">
        Cancel
        </button>
        </div>
        </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Submit role request from modal
     */
    async submitRoleRequestFromModal(modalContent) {
        const selectedRole = modalContent.querySelector('input[name="roleType"]:checked')?.value;
        const message = modalContent.querySelector('#roleRequestMessage')?.value;

        if (!selectedRole) {
            app.showNotification('warning', 'Please select a role');
            return;
        }

        if (!message || message.trim().length < 10) {
            app.showNotification('warning', 'Please provide a detailed explanation (at least 10 characters)');
            return;
        }

        const success = await this.submitRoleRequest(selectedRole, message.trim());

        if (success) {
            modalContent.parentElement.remove();

            // Refresh outgoing requests if on that tab
            if (window.nftCollection) {
                nftCollection.loadTabContent('outgoing');
            }
        }
    }

    /**
     * Submit Worker Claim Request
     * Специальный метод для worker claim requests
     */
    async submitWorkerClaimRequest(workerId, workerAddress, workerData, bitcoinAddress) {
        try {
            console.log('Submitting worker claim request:', {
                workerId,
                workerAddress,
                workerData,
                bitcoinAddress,
                userAddress: wallet.account
            });

            const requestData = {
                requestType: 'worker_claim',
                userAddress: wallet.account,
                targetPoolId: workerAddress,  // Используем workerAddress как targetPoolId
                requestedRole: 'worker_owner',
                message: `
                Worker Claim Request

                Worker ID: ${workerId}
                Worker Name: ${workerData.name}
                Worker Address (Contract): ${workerAddress}
                Bitcoin Payout Address: ${bitcoinAddress}
                Miner Ethereum Address: ${wallet.account}

                Performance Data:
                - Hashrate: ${workerData.hashrate} TH/s
                - Valid Shares: ${workerData.valid_shares.toLocaleString()}
                - Total Shares: ${workerData.total_shares.toLocaleString()}
                - Validity Rate: ${((workerData.valid_shares / workerData.total_shares) * 100).toFixed(2)}%
                - Status: ${workerData.status}

                Verification: Worker name verified successfully.
                `.trim(),
                metadata: {
                    workerId: workerId,
                    workerName: workerData.name,
                    workerAddress: workerAddress,
                    bitcoinPayoutAddress: bitcoinAddress,
                    hashrate: workerData.hashrate,
                    validShares: workerData.valid_shares,
                    totalShares: workerData.total_shares,
                    submittedAt: new Date().toISOString(),
                    timestamp: Date.now()
                }
            };

            console.log('Sending worker claim request:', requestData);

            const response = await fetch(`${this.apiBaseUrl}/requests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Origin': window.location.origin
                },
                body: JSON.stringify(requestData)
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                let errorData;

                if (contentType && contentType.includes('application/json')) {
                    errorData = await response.json();
                } else {
                    errorData = { error: await response.text() };
                }

                console.error('API Error Response:', errorData);
                throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
            }

            const result = await response.json();
            console.log('Worker claim request submitted successfully:', result);

            app.showNotification('success', 'Worker claim request submitted!');

            await this.loadUserRequests();

            return result;

        } catch (error) {
            console.error('Failed to submit worker claim request:', error);

            let userMessage = 'Failed to submit request. ';
            if (error.message.includes('fetch')) {
                userMessage += 'Network error - please check your connection.';
            } else if (error.message.includes('400')) {
                userMessage += 'Invalid request data.';
            } else if (error.message.includes('500')) {
                userMessage += 'Server error - please try again later.';
            } else {
                userMessage += error.message;
            }

            app.showNotification('error', userMessage);
            return false;
        }
    }

    /**
     * Render Worker Claim Request Card
     */
    renderWorkerClaimRequest(request) {
        // Парсим metadata если строка
        let metadata = request.metadata || {};
        if (typeof metadata === 'string') {
            try {
                metadata = JSON.parse(metadata);
            } catch (e) {
                console.warn('Failed to parse metadata:', e);
                metadata = {};
            }
        }

        console.log('Rendering worker claim with metadata:', metadata);

        return `
        <div class="request-card worker-claim-request">
        <div class="request-header">
        <div class="request-info">
        <h4>⛏️ Worker Claim Request</h4>
        <p><strong>From:</strong> ${wallet.formatAddress(request.user_address)}</p>
        <p><strong>Worker:</strong> ${metadata.workerName || 'N/A'} (${metadata.hashrate || 'N/A'} TH/s)</p>
        </div>
        <div class="request-status">
        <span class="status-badge ${request.status}">${request.status}</span>
        </div>
        </div>

        <div class="request-details">
        <div class="worker-claim-details">
        <div class="detail-row">
        <span class="label">Worker ID:</span>
        <span class="value"><code>${metadata.workerId || 'N/A'}</code></span>
        </div>
        <div class="detail-row">
        <span class="label">Worker Name:</span>
        <span class="value"><strong>${metadata.workerName || 'N/A'}</strong></span>
        </div>
        <div class="detail-row">
        <span class="label">Worker Address:</span>
        <span class="value monospace">${metadata.workerAddress ?
            wallet.formatAddress(metadata.workerAddress) :
            'N/A'}</span>
            </div>
            <div class="detail-row">
            <span class="label">Bitcoin Payout:</span>
            <span class="value monospace">${metadata.bitcoinPayoutAddress || 'N/A'}</span>
            </div>
            <div class="detail-row">
            <span class="label">Hashrate:</span>
            <span class="value">${metadata.hashrate || 'N/A'} TH/s</span>
            </div>
            <div class="detail-row">
            <span class="label">Valid Shares:</span>
            <span class="value">${metadata.validShares ? metadata.validShares.toLocaleString() : 'N/A'} / ${metadata.totalShares ? metadata.totalShares.toLocaleString() : 'N/A'}</span>
            </div>
            </div>

            <p><strong>Message:</strong></p>
            <pre class="request-message">${request.message}</pre>

            <p><strong>Submitted:</strong> ${new Date(request.created_at).toLocaleString()}</p>
            </div>

            <div class="admin-actions">
            <button onclick="requests.approveWorkerClaimWithModal('${request.request_id}')"
            class="btn btn-success btn-sm">
            ✅ Approve & Register Worker
            </button>
            <button onclick="requests.rejectRequestWithModal('${request.request_id}')"
            class="btn btn-error btn-sm">
            ❌ Reject
            </button>
            </div>

            <div class="admin-notes-section">
            <textarea id="admin-notes-${request.request_id}"
            placeholder="Optional admin notes..."
            class="admin-notes-input"></textarea>
            </div>
            </div>
            `;
    }

    /**
     * Approve Worker Claim with Modal
     */
    approveWorkerClaimWithModal(requestId) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content approve-worker-modal">
        <div class="modal-header">
        <h3>Approve Worker Claim</h3>
        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="modal-body">
        <p>This will register the worker in StratumDataAggregator contract and link it to the miner's Ethereum address.</p>

        <div class="info-box warning">
        <strong>Action:</strong>
        <ul>
        <li>Call <code>setWorkerOwner(workerAddress, minerAddress)</code></li>
        <li>Transaction will be sent from your wallet</li>
        <li>Gas cost: ~0.003-0.005 ETH</li>
        </ul>
        </div>

        <div class="form-group">
        <label class="form-label">Admin Notes (Optional)</label>
        <textarea id="workerApprovalNotes" class="form-input" rows="3"
        placeholder="Add notes about this approval..."></textarea>
        </div>
        </div>
        <div class="modal-actions">
        <button onclick="requests.confirmWorkerClaimApproval('${requestId}', this.parentElement.parentElement.parentElement)"
        class="btn btn-success">
        Approve & Register
        </button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()"
        class="btn btn-secondary">
        Cancel
        </button>
        </div>
        </div>
        `;

        document.body.appendChild(modal);
    }

    /**
     * Confirm Worker Claim Approval
     */
    async confirmWorkerClaimApproval(requestId, modal) {
        try {
            const notes = modal.querySelector('#workerApprovalNotes')?.value || '';

            app.showLoading('Approving worker claim and registering on-chain...');

            const request = this.requests.find(r => r.request_id === requestId);
            if (!request) throw new Error('Request not found');

            // Parse metadata
            let metadata = request.metadata || {};
            if (typeof metadata === 'string') {
                try {
                    metadata = JSON.parse(metadata);
                } catch (e) {
                    console.warn('Failed to parse metadata:', e);
                    metadata = {};
                }
            }

            console.log('Parsed metadata:', metadata);

            // Get data from metadata
            let workerAddress = metadata.workerAddress || request.target_pool_id;
            const minerAddress = request.user_address;
            const bitcoinAddress = metadata.bitcoinPayoutAddress;
            const workerId = metadata.workerId;

            console.log('Before conversion:', {
                workerAddress,
                length: workerAddress?.length,
                type: typeof workerAddress
            });

            // CRITICAL: Convert bytes32 (66 chars) → address (42 chars) if needed
            if (workerAddress && workerAddress.length === 66) {
                console.log('⚠️ Detected bytes32, converting to address...');
                workerAddress = '0x' + workerAddress.slice(-40);
                console.log('✅ Converted to address:', workerAddress);
            }

            console.log('After conversion:', {
                workerAddress,
                length: workerAddress?.length,
                minerAddress
            });

            // Validation
            if (!workerAddress || !minerAddress || !bitcoinAddress || !workerId) {
                throw new Error('Missing required data in request metadata');
            }

            if (workerAddress.length !== 42) {
                throw new Error(`Invalid workerAddress length: ${workerAddress.length} (expected 42)`);
            }

            if (!ethers.utils.isAddress(workerAddress)) {
                throw new Error('workerAddress is not a valid Ethereum address');
            }

            if (!ethers.utils.isAddress(minerAddress)) {
                throw new Error('minerAddress is not a valid Ethereum address');
            }

            console.log('Approving worker claim:', {
                requestId,
                workerAddress,
                minerAddress,
                bitcoinAddress,
                workerId,
                metadata
            });

            // Initialize stratumWorkerManager
            if (!stratumWorkerManager.initialized) {
                await stratumWorkerManager.initialize();
            }

            // Get contract with correct ABI
            const aggregator = new ethers.Contract(
                CONFIG.CONTRACTS.STRATUM_AGGREGATOR,
                [
                    "function registerWorkerFull(address workerAddress, address minerAddress, string bitcoinAddress, string workerId)",
                                                   "function workerOwner(address worker) external view returns (address)",
                                                   "function workerIdToAddress(string workerId) external view returns (address)"
                ],
                wallet.signer
            );

            console.log('Calling registerWorkerFull with:', {
                workerAddress: workerAddress,
                minerAddress: minerAddress,
                bitcoinAddress: bitcoinAddress,
                workerId: workerId
            });

            // Test estimateGas before sending
            try {
                const gasEstimate = await aggregator.estimateGas.registerWorkerFull(
                    workerAddress,
                    minerAddress,
                    bitcoinAddress,
                    workerId
                );
                console.log('Gas estimate successful:', gasEstimate.toString());
            } catch (gasError) {
                console.error('Gas estimation failed:', gasError);
                throw new Error(`Transaction will fail: ${gasError.reason || gasError.message}`);
            }

            // Send transaction
            const tx = await aggregator.registerWorkerFull(
                workerAddress,
                minerAddress,
                bitcoinAddress,
                workerId
            );
            console.log('Transaction sent:', tx.hash);

            const receipt = await tx.wait();
            console.log('Transaction confirmed:', receipt.blockNumber);

            // Update request status
            const updateResponse = await fetch(`${this.apiBaseUrl}/requests/${requestId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    status: 'approved',
                    adminNotes: notes || `Worker claim approved. Transaction: ${tx.hash}`,
                    updatedBy: wallet.account,
                    metadata: {
                        ...metadata,
                        approvalTxHash: tx.hash,
                        approvalBlockNumber: receipt.blockNumber,
                        approvedAt: new Date().toISOString(),
                                     workerAddressUsed: workerAddress,
                                     registrationMethod: 'registerWorkerFull'
                    }
                })
            });

            if (!updateResponse.ok) {
                throw new Error('Failed to update request status');
            }

            // Update local cache
            const requestIndex = this.requests.findIndex(r => r.request_id === requestId);
            if (requestIndex !== -1) {
                this.requests[requestIndex].status = 'approved';
                this.requests[requestIndex].admin_notes = notes;
            }

            app.hideLoading();
            modal.remove();

            app.showNotification('success', 'Worker registered on-chain successfully!');

            // Refresh admin panel
            if (window.nftCollection) {
                await nftCollection.loadRequests();
            }

        } catch (error) {
            app.hideLoading();
            console.error('Failed to approve worker claim:', error);

            let errorMessage = 'Failed to approve worker claim. ';
            if (error.message.includes('user rejected')) {
                errorMessage += 'Transaction was rejected.';
            } else if (error.message.includes('insufficient funds')) {
                errorMessage += 'Insufficient ETH for gas.';
            } else if (error.message.includes('Invalid workerAddress')) {
                errorMessage += 'Invalid worker address format.';
            } else if (error.message.includes('Worker already registered')) {
                errorMessage += 'This worker is already registered.';
            } else if (error.message.includes('Worker ID already exists')) {
                errorMessage += 'This worker ID is already in use.';
            } else {
                errorMessage += error.message;
            }

            app.showNotification('error', errorMessage);
        }
    }

    async loadUserRequests() {
        try {
            if (!wallet.connected) {
                console.log('Wallet not connected, skipping user requests load');
                this.userRequests = [];
                return [];
            }

            console.log(`Loading user requests for: ${wallet.account}`);

            const url = `${this.apiBaseUrl}/requests?userAddress=${encodeURIComponent(wallet.account)}`;
            console.log('Loading requests from URL:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            console.log('Load requests response status:', response.status);

            if (!response.ok) {
                throw new Error(`Failed to load user requests: HTTP ${response.status}`);
            }

            const data = await response.json();
            this.userRequests = data.requests || [];

            console.log(`Successfully loaded ${this.userRequests.length} user requests`);

            return this.userRequests;

        } catch (error) {
            console.error('Failed to load user requests:', error);
            this.userRequests = [];
            return [];
        }
    }

    async loadAllRequests() {
        try {
            if (!this.adminMode) {
                console.log('Not in admin mode, skipping all requests load');
                return [];
            }

            console.log('Loading all requests for admin');

            // Load regular requests
            const response = await fetch(`${this.apiBaseUrl}/requests`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            console.log('Load all requests response status:', response.status);

            if (!response.ok) {
                throw new Error(`Failed to load all requests: HTTP ${response.status}`);
            }

            const data = await response.json();
            let allRequests = data.requests || [];

            // Load DKG requests
            try {
                const dkgResponse = await fetch(`${this.apiBaseUrl}/dkg-requests`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });

                if (dkgResponse.ok) {
                    const dkgData = await dkgResponse.json();
                    console.log(`Loaded ${dkgData.length} DKG requests`);

                    // Add DKG requests to the main array
                    allRequests = allRequests.concat(dkgData);
                }
            } catch (dkgError) {
                console.warn('Failed to load DKG requests:', dkgError);
            }

            this.requests = allRequests;

            console.log(`Successfully loaded ${this.requests.length} total requests for admin`);

            return this.requests;

        } catch (error) {
            console.error('Failed to load all requests:', error);
            this.requests = [];
            return [];
        }
    }

    // =============== NEW METHODS FOR REQUEST HANDLING ===============

    async approveRequest(requestId, adminNotes = '') {
        try {
            console.log('Approving request:', requestId, 'with notes:', adminNotes);

            const request = this.requests.find(r => r.request_id === requestId);
            if (!request) {
                throw new Error('Request not found');
            }

            console.log('Request to approve:', request);

            if (!window.contracts || !contracts.initialized) {
                throw new Error('Contracts not initialized');
            }

            const poolId = request.target_pool_id || 'platform_access';
            const requestedRole = request.requested_role || 'miner';

            // ИСПРАВЛЕНО: Проверяем есть ли у пользователя NFT
            const userNFTs = await contracts.getUserNFTs(request.user_address);
            const hasNFT = userNFTs.length > 0;

            console.log('User has NFT:', hasNFT);

            let mintResult = null;

            if (hasNFT) {
                // У пользователя уже есть NFT - просто выдаём роль в Factory
                console.log('User already has NFT, granting role directly in Factory...');

                const factory = contracts.getContract('factory');
                if (!factory) {
                    throw new Error('Factory contract not available');
                }

                // Определяем какую роль выдать
                let roleToGrant;
                switch (requestedRole.toLowerCase()) {
                    case 'pool_manager':
                        roleToGrant = await factory.POOL_MANAGER_ROLE();
                        break;
                    case 'custodial':
                        // Если есть отдельная роль для custodial
                        roleToGrant = await factory.CUSTODIAL_ROLE?.() || await factory.POOL_MANAGER_ROLE();
                        break;
                    case 'miner':
                    default:
                        // Для miner роль не нужна в Factory
                        console.log('Miner role does not require Factory role');
                        roleToGrant = null;
                }

                if (roleToGrant) {
                    // Проверяем есть ли уже роль
                    const hasRole = await factory.hasRole(roleToGrant, request.user_address);

                    if (!hasRole) {
                        console.log(`Granting ${requestedRole} role to ${request.user_address}`);
                        const tx = await factory.grantRole(roleToGrant, request.user_address);
                        const receipt = await tx.wait();

                        mintResult = {
                            transactionHash: receipt.transactionHash,
                            blockNumber: receipt.blockNumber,
                            roleGranted: requestedRole,
                            method: 'factory_role_grant'
                        };
                    } else {
                        console.log(`User already has ${requestedRole} role`);
                        mintResult = {
                            roleGranted: requestedRole,
                            method: 'already_has_role',
                            message: 'User already has this role'
                        };
                    }
                } else {
                    mintResult = {
                        roleGranted: requestedRole,
                        method: 'no_factory_role_needed',
                        message: 'Miner role does not require Factory permissions'
                    };
                }

            } else {
                // У пользователя нет NFT - минтим новый
                console.log('User does not have NFT, minting new one...');

                mintResult = await contracts.mintMembershipNFTForUser(
                    request.user_address,
                    poolId,
                    requestedRole,
                    `Admin approved: ${adminNotes}`
                );
            }

            console.log('NFT/Role operation result:', mintResult);

            // Step 2: Update request status via API
            console.log('Updating request status via API');

            const updateResponse = await fetch(`${CONFIG.API.REQUESTS}${CONFIG.API.ENDPOINTS.REQUESTS}/${requestId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 'approved',
                    adminNotes: adminNotes || `Request approved - ${hasNFT ? 'role granted' : 'NFT minted'}`,
                    updatedBy: wallet.account,
                    nftMinted: !hasNFT,
                    roleGranted: hasNFT,
                    operationDetails: mintResult
                })
            });

            if (!updateResponse.ok) {
                throw new Error(`API update failed: ${updateResponse.status} ${updateResponse.statusText}`);
            }

            const updateData = await updateResponse.json();
            console.log('API update result:', updateData);

            // Update local cache
            const requestIndex = this.requests.findIndex(r => r.request_id === requestId);
            if (requestIndex !== -1) {
                this.requests[requestIndex].status = 'approved';
                this.requests[requestIndex].admin_notes = adminNotes;
                this.requests[requestIndex].updated_at = new Date().toISOString();
            }

            if (window.app && app.showNotification) {
                app.showNotification('success', hasNFT ?
                `Role ${requestedRole} granted successfully!` :
                `NFT minted and role ${requestedRole} granted!`
                );
            }

            return true;

        } catch (error) {
            console.error('Failed to approve request:', error);

            if (window.app && app.showNotification) {
                if (error.message.includes('mint')) {
                    app.showNotification('error', `NFT minting failed: ${error.message}`);
                } else if (error.message.includes('role')) {
                    app.showNotification('error', `Role granting failed: ${error.message}`);
                } else if (error.message.includes('API')) {
                    app.showNotification('error', `API update failed: ${error.message}`);
                } else {
                    app.showNotification('error', `Approval failed: ${error.message}`);
                }
            }

            return false;
        }
    }

    async rejectRequest(requestId, adminNotes = '') {
        try {
            console.log('Rejecting request:', requestId, 'with notes:', adminNotes);

            const updateResponse = await fetch(`${CONFIG.API.REQUESTS}${CONFIG.API.ENDPOINTS.REQUESTS}/${requestId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 'rejected',
                    adminNotes: adminNotes || 'Request rejected by admin',
                    updatedBy: wallet.account
                })
            });

            if (!updateResponse.ok) {
                throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}`);
            }

            const updateData = await updateResponse.json();
            console.log('Rejection result:', updateData);

            // Update local cache
            const requestIndex = this.requests.findIndex(r => r.request_id === requestId);
            if (requestIndex !== -1) {
                this.requests[requestIndex].status = 'rejected';
                this.requests[requestIndex].admin_notes = adminNotes;
                this.requests[requestIndex].updated_at = new Date().toISOString();
            }

            return true;

        } catch (error) {
            console.error('Failed to reject request:', error);
            if (window.app && app.showNotification) {
                app.showNotification('error', `Rejection failed: ${error.message}`);
            }
            return false;
        }
    }

    async cancelRequest(requestId) {
        try {
            console.log('Canceling membership request:', requestId);

            const response = await fetch(`${this.apiBaseUrl}/requests/${requestId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: 'cancelled',
                    updatedBy: wallet.account
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to cancel request');
            }

            app.showNotification('info', 'Request cancelled');

            await this.loadUserRequests();

            return true;

        } catch (error) {
            console.error('Failed to cancel request:', error);
            app.showNotification('error', `Failed to cancel request: ${error.message}`);
            return false;
        }
    }

    // =============== DATA GETTER METHODS ===============

    getIncomingRequests() {
        if (!this.adminMode) return [];

        return this.requests.filter(req =>
        req.status === 'pending' &&
        req.user_address !== wallet.account
        );
    }

    getOutgoingRequests() {
        return this.userRequests.filter(req =>
        req.user_address === wallet.account
        );
    }

    getPendingRequestsCount() {
        return this.userRequests.filter(req => req.status === 'pending').length;
    }

    getRequestCounts() {
        const counts = {
            incoming: 0,
            outgoing: 0,
            history: 0
        };

        if (this.adminMode) {
            counts.incoming = this.getIncomingRequests().length;
        }

        const outgoing = this.getOutgoingRequests();
        counts.outgoing = outgoing.filter(req => req.status === 'pending').length;
        counts.history = outgoing.filter(req => req.status !== 'pending').length;

        return counts;
    }

    getRecentActivity() {
        const activities = [];

        this.userRequests.slice(0, 3).forEach(req => {
            activities.push({
                icon: '📋',
                text: `${this.getStatusText(req.status)} request for ${req.requested_role} role`,
                            time: new Date(req.created_at || req.updated_at)
            });
        });

        return activities;
    }

    getStatusText(status) {
        const statusMap = {
            'pending': 'Submitted',
            'approved': 'Approved',
            'rejected': 'Rejected',
            'cancelled': 'Cancelled'
        };
        return statusMap[status] || status;
    }

    async getRequestById(requestId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/requests/${requestId}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch request');
            }

            const data = await response.json();
            return data.request;

        } catch (error) {
            console.error('Failed to get request by ID:', error);
            throw error;
        }
    }

    // =============== UI RENDERING METHODS ===============

    renderIncomingRequests(container) {
        if (!this.adminMode) {
            container.innerHTML = `
            <div class="auth-required">
            <p>Admin rights required to view incoming requests</p>
            </div>
            `;
            return;
        }

        const incomingRequests = this.getIncomingRequests();

        if (incomingRequests.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
            <div class="empty-icon">📥</div>
            <h3>No Incoming Requests</h3>
            <p>User access requests will appear here</p>
            </div>
            `;
            return;
        }

        container.innerHTML = incomingRequests.map(request => {
            return this.renderStandardRequest(request);
        }).join('');
    }

    renderStandardRequest(request) {
        // Check if this is a DKG request
        if (request.request_type === 'dkg_group_pool_manager' || request.is_group_request) {
            return this.renderDKGRequest(request);
        }

        // Check if this is a worker claim request
        if (request.request_type === 'worker_claim') {
            return this.renderWorkerClaimRequest(request);
        }

        // Regular request rendering
        return `
        <div class="request-card admin-request">
        <div class="request-header">
        <div class="request-info">
        <h4>${this.getRequestTypeTitle(request.request_type)}</h4>
        <p><strong>From:</strong> ${wallet.formatAddress(request.user_address)}</p>
        <p><strong>Requested Role:</strong> ${request.requested_role || 'N/A'}</p>
        </div>
        <div class="request-status">
        <span class="status-badge ${request.status}">${request.status}</span>
        </div>
        </div>
        <div class="request-details">
        <p><strong>Message:</strong> ${request.message}</p>
        <p><strong>Submitted:</strong> ${new Date(request.created_at).toLocaleString()}</p>
        ${request.target_pool_id && request.target_pool_id !== 'platform_access' ?
            `<p><strong>Pool:</strong> ${request.target_pool_id}</p>` : ''}
            </div>
            <div class="request-actions admin-actions">
            <button onclick="requests.approveRequestWithModal('${request.request_id}')"
            class="btn btn-success btn-sm">
            ✅ Approve & Mint NFT
            </button>
            <button onclick="requests.rejectRequestWithModal('${request.request_id}')"
            class="btn btn-error btn-sm">
            ❌ Reject
            </button>
            <button onclick="requests.showRequestDetails(${JSON.stringify(request).replace(/"/g, '&quot;')})"
            class="btn btn-outline btn-sm">
            👁️ Details
            </button>
            </div>
            </div>
            `;
    }

    renderOutgoingRequests(container) {
        const outgoingRequests = this.getOutgoingRequests();

        if (outgoingRequests.length === 0) {
            container.innerHTML = `
            <div class="empty-state">
            <div class="empty-icon">📤</div>
            <h3>No Outgoing Requests</h3>
            <p>Your access requests will appear here</p>
            <div class="empty-actions">
            ${!userRoles.isUserAuthorized() ? `
                <button class="btn btn-primary" onclick="app.showAccessRequestModal()">
                Request Platform Access
                </button>
                ` : `
                <button class="btn btn-primary" onclick="requests.showRoleRequestModal()">
                Request Additional Role
                </button>
                `}
                </div>
                </div>
                `;
                return;
        }

        // Показываем кнопку запроса роли даже если есть запросы
        const headerActions = userRoles.isUserAuthorized() ? `
        <div class="tab-header-actions">
        <button class="btn btn-primary btn-sm" onclick="requests.showRoleRequestModal()">
        Request Additional Role
        </button>
        </div>
        ` : '';

        container.innerHTML = headerActions + outgoingRequests.map(request => `
        <div class="request-card user-request">
        <div class="request-header">
        <div class="request-info">
        <h4>Your Request</h4>
        <p><strong>Type:</strong> ${this.getRequestTypeTitle(request.request_type)}</p>
        <p><strong>Role:</strong> ${request.requested_role}</p>
        </div>
        <div class="request-status">
        <span class="status-badge ${request.status}">${request.status}</span>
        </div>
        </div>
        <div class="request-details">
        <p><strong>Message:</strong> ${request.message}</p>
        <p><strong>Submitted:</strong> ${new Date(request.created_at).toLocaleDateString()}</p>
        ${request.updated_at !== request.created_at ?
            `<p><strong>Updated:</strong> ${new Date(request.updated_at).toLocaleDateString()}</p>` : ''}
            ${request.admin_notes ?
                `<p><strong>Admin Notes:</strong> ${request.admin_notes}</p>` : ''}
                </div>
                <div class="request-actions">
                <button onclick="requests.showRequestDetails(${JSON.stringify(request).replace(/"/g, '&quot;')})"
                class="btn btn-primary btn-sm">
                View Details
                </button>
                ${request.status === 'pending' ? `
                    <button onclick="requests.cancelRequest('${request.request_id}')"
                    class="btn btn-error btn-sm">
                    Cancel
                    </button>
                    ` : ''}
                    </div>
                    </div>
                    `).join('');
    }

    // =============== MODAL METHODS ===============

    approveRequestWithModal(requestId) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content approve-request-modal">
        <div class="modal-header">
        <h3>Approve Request & Mint NFT</h3>
        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="modal-body">
        <p>This will approve the request and automatically mint an NFT for the user.</p>
        <div class="form-group">
        <label class="form-label">Admin Notes (Optional)</label>
        <textarea id="approvalNotes" class="form-input" rows="3"
        placeholder="Add any notes for the user..."></textarea>
        </div>
        </div>
        <div class="modal-actions">
        <button onclick="requests.confirmApproval('${requestId}', this.parentElement.parentElement.parentElement)"
        class="btn btn-success">
        Approve & Mint NFT
        </button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()"
        class="btn btn-secondary">
        Cancel
        </button>
        </div>
        </div>
        `;

        document.body.appendChild(modal);
    }

    async confirmApproval(requestId, modal) {
        const notes = modal.querySelector('#approvalNotes').value;
        const success = await this.approveRequest(requestId, notes);

        if (success) {
            modal.remove();

            if (window.nftCollection) {
                nftCollection.loadTabContent('admin');
            }
        }
    }

    rejectRequestWithModal(requestId) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content reject-request-modal">
        <div class="modal-header">
        <h3>Reject Request</h3>
        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="modal-body">
        <div class="form-group">
        <label class="form-label">Reason for Rejection</label>
        <textarea id="rejectionReason" class="form-input" rows="3"
        placeholder="Provide feedback to the applicant..." required></textarea>
        </div>
        </div>
        <div class="modal-actions">
        <button onclick="requests.confirmRejection('${requestId}', this.parentElement.parentElement.parentElement)"
        class="btn btn-error">
        Confirm Rejection
        </button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()"
        class="btn btn-secondary">
        Cancel
        </button>
        </div>
        </div>
        `;

        document.body.appendChild(modal);
    }

    async confirmRejection(requestId, modal) {
        const reason = modal.querySelector('#rejectionReason').value;

        if (!reason.trim()) {
            app.showNotification('warning', 'Please provide a reason for rejection');
            return;
        }

        const success = await this.rejectRequest(requestId, reason);

        if (success) {
            modal.remove();

            if (window.nftCollection) {
                nftCollection.loadTabContent('admin');
            }
        }
    }

    showRequestDetails(request) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content request-details-modal">
        <div class="modal-header">
        <h3>Request Details</h3>
        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="modal-body">
        <div class="request-details-grid">
        <div class="detail-item">
        <label>Request ID:</label>
        <span>${request.request_id}</span>
        </div>
        <div class="detail-item">
        <label>Type:</label>
        <span>${this.getRequestTypeTitle(request.request_type)}</span>
        </div>
        <div class="detail-item">
        <label>Requested Role:</label>
        <span>${request.requested_role}</span>
        </div>
        <div class="detail-item">
        <label>From:</label>
        <span>${wallet.formatAddress(request.user_address)}</span>
        </div>
        <div class="detail-item">
        <label>Status:</label>
        <span class="status-badge ${request.status}">${request.status}</span>
        </div>
        <div class="detail-item">
        <label>Submitted:</label>
        <span>${new Date(request.created_at).toLocaleString()}</span>
        </div>
        ${request.updated_at !== request.created_at ? `
            <div class="detail-item">
            <label>Updated:</label>
            <span>${new Date(request.updated_at).toLocaleString()}</span>
            </div>
            ` : ''}
            </div>

            <div class="request-message">
            <h4>User Message:</h4>
            <p>${request.message}</p>
            </div>

            ${request.admin_notes ? `
                <div class="admin-notes">
                <h4>Admin Notes:</h4>
                <p>${request.admin_notes}</p>
                </div>
                ` : ''}
                </div>
                <div class="modal-actions">
                <button onclick="this.parentElement.parentElement.parentElement.remove()"
                class="btn btn-secondary">
                Close
                </button>
                </div>
                </div>
                `;

                document.body.appendChild(modal);
    }

    // Add to RequestManager class after loadAllRequests() method:

    async loadDKGRequests() {
        try {
            if (!this.adminMode) {
                console.log('Not in admin mode, skipping DKG requests load');
                return [];
            }

            const response = await fetch(`${CONFIG.API.REQUESTS}${CONFIG.API.ENDPOINTS.DKG_REQUESTS}`);

            if (!response.ok) {
                throw new Error(`Failed to load DKG requests: HTTP ${response.status}`);
            }

            const dkgRequests = await response.json();
            console.log(`Successfully loaded ${dkgRequests.length} DKG requests`);

            return dkgRequests;

        } catch (error) {
            console.error('Failed to load DKG requests:', error);
            return [];
        }
    }

    async approveDKGRequest(requestId, adminNotes = '') {
        try {
            console.log('Approving DKG request:', requestId);

            // Get request data
            const response = await fetch(`${CONFIG.API.REQUESTS}${CONFIG.API.ENDPOINTS.DKG_REQUESTS}?requestId=${requestId}`);
            if (!response.ok) throw new Error('Failed to get DKG request');

            const requests = await response.json();
            const request = requests.find(r => r.request_id === requestId);
            if (!request) throw new Error('DKG request not found');

            app.showLoading('Granting POOL_MANAGER roles...');

            // Grant POOL_MANAGER roles to all participants
            const factory = contracts.getContract('factory');
            const factoryWithSigner = factory.connect(wallet.provider.getSigner());
            const POOL_MANAGER_ROLE = await factory.POOL_MANAGER_ROLE();

            for (const participant of request.participants) {
                const hasRole = await factory.hasRole(POOL_MANAGER_ROLE, participant);
                if (!hasRole) {
                    console.log(`Granting POOL_MANAGER role to ${participant}`);
                    const tx = await factoryWithSigner.grantRole(POOL_MANAGER_ROLE, participant);
                    await tx.wait();
                    console.log(`✅ Role granted to ${participant}`);
                } else {
                    console.log(`${participant} already has role, skipping`);
                }
            }

            // Update request status
            const updateResponse = await fetch(`${CONFIG.API.REQUESTS}${CONFIG.API.ENDPOINTS.DKG_REQUESTS}/${requestId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'approved',
                    adminNotes: adminNotes || 'DKG group request approved - Pool Manager roles granted',
                    updatedBy: wallet.account
                })
            });

            if (!updateResponse.ok) {
                throw new Error('Failed to update DKG request status');
            }

            app.hideLoading();
            app.showNotification('success', `DKG request approved - Pool Manager roles granted to ${request.participants.length} participants`);

            await this.loadAllRequests();

            return true;

        } catch (error) {
            app.hideLoading();
            console.error('Failed to approve DKG request:', error);
            app.showNotification('error', `Failed to approve DKG request: ${error.message}`);
            return false;
        }
    }

    // Add method for rendering DKG requests
    renderDKGRequest(request) {
        return `
        <div class="request-card dkg-request">
        <div class="request-header">
        <div class="request-info">
        <h4>DKG Group Authorization</h4>
        <p><strong>Session ID:</strong> ${request.session_id}</p>
        <p><strong>From:</strong> ${wallet.formatAddress(request.requester_address)}</p>
        <p><strong>Requested Role:</strong> Pool Manager (Group)</p>
        </div>
        <div class="request-status">
        <span class="status-badge ${request.status}">${request.status}</span>
        </div>
        </div>
        <div class="request-details">
        <p><strong>Message:</strong> ${request.message}</p>
        <p><strong>Participants:</strong> ${request.participants.length} addresses</p>
        <p><strong>Threshold:</strong> ${request.threshold}</p>
        <p><strong>Submitted:</strong> ${new Date(request.created_at).toLocaleString()}</p>
        <div class="participants-list">
        <strong>Participants:</strong>
        ${request.participants.map(addr => `<span class="participant-addr">${wallet.formatAddress(addr)}</span>`).join(' ')}
        </div>
        </div>
        <div class="request-actions admin-actions">
        <button onclick="requests.approveDKGRequestWithModal('${request.request_id}')"
        class="btn btn-success btn-sm">
        Approve All Participants
        </button>
        <button onclick="requests.rejectDKGRequest('${request.request_id}', 'DKG group request rejected')"
        class="btn btn-error btn-sm">
        Reject
        </button>
        <button onclick="requests.showDKGRequestDetails(${JSON.stringify(request).replace(/"/g, '&quot;')})"
        class="btn btn-outline btn-sm">
        👁️ Details
        </button>
        </div>
        </div>
        `;
    }

    async rejectDKGRequest(requestId, reason) {
        try {
            const updateResponse = await fetch(`${CONFIG.API.REQUESTS}${CONFIG.API.ENDPOINTS.DKG_REQUESTS}/${requestId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: 'rejected',
                    adminNotes: reason || 'DKG group request rejected by admin',
                    updatedBy: wallet.account
                })
            });

            if (!updateResponse.ok) {
                throw new Error('Failed to reject DKG request');
            }

            app.showNotification('info', 'DKG group request rejected');

            // Refresh requests
            await this.loadAllRequests();

            // Refresh admin panel if it's loaded
            if (window.nftCollection) {
                nftCollection.loadTabContent('admin');
            }

            return true;

        } catch (error) {
            console.error('Failed to reject DKG request:', error);
            app.showNotification('error', `Failed to reject DKG request: ${error.message}`);
            return false;
        }
    }

    showDKGRequestDetails(request) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content request-details-modal">
        <div class="modal-header">
        <h3>DKG Group Request Details</h3>
        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="modal-body">
        <div class="request-details-grid">
        <div class="detail-item">
        <label>Request ID:</label>
        <span>${request.request_id}</span>
        </div>
        <div class="detail-item">
        <label>Type:</label>
        <span>DKG Group Authorization</span>
        </div>
        <div class="detail-item">
        <label>Session ID:</label>
        <span>${request.session_id}</span>
        </div>
        <div class="detail-item">
        <label>From:</label>
        <span>${wallet.formatAddress(request.requester_address)}</span>
        </div>
        <div class="detail-item">
        <label>Status:</label>
        <span class="status-badge ${request.status}">${request.status}</span>
        </div>
        <div class="detail-item">
        <label>Participants:</label>
        <span>${request.participants.length}</span>
        </div>
        <div class="detail-item">
        <label>Threshold:</label>
        <span>${request.threshold}</span>
        </div>
        <div class="detail-item">
        <label>Submitted:</label>
        <span>${new Date(request.created_at).toLocaleString()}</span>
        </div>
        </div>

        <div class="request-message">
        <h4>Message:</h4>
        <p>${request.message}</p>
        </div>

        <div class="participants-details">
        <h4>All Participants:</h4>
        <div class="participants-grid">
        ${request.participants.map((addr, index) => `
            <div class="participant-detail">
            <span class="participant-index">${index + 1}.</span>
            <span class="participant-address">${addr}</span>
            </div>
            `).join('')}
            </div>
            </div>

            ${request.admin_notes ? `
                <div class="admin-notes">
                <h4>Admin Notes:</h4>
                <p>${request.admin_notes}</p>
                </div>
                ` : ''}
                </div>
                <div class="modal-actions">
                <button onclick="this.parentElement.parentElement.parentElement.remove()"
                class="btn btn-secondary">
                Close
                </button>
                </div>
                </div>
                `;

                document.body.appendChild(modal);
    }

    approveDKGRequestWithModal(requestId) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content approve-dkg-modal">
        <div class="modal-header">
        <h3>Approve DKG Group Request</h3>
        <button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="modal-body">
        <p>This will grant POOL_MANAGER roles to ALL participants in this DKG session.</p>
        <div class="form-group">
        <label>Admin Notes (Optional)</label>
        <textarea id="dkgApprovalNotes" class="form-input" rows="3"
        placeholder="Notes about this group approval..."></textarea>
        </div>
        </div>
        <div class="modal-actions">
        <button onclick="requests.confirmDKGApproval('${requestId}', this.parentElement.parentElement.parentElement)"
        class="btn btn-success">
        Approve Group Request
        </button>
        <button onclick="this.parentElement.parentElement.parentElement.remove()"
        class="btn btn-secondary">
        Cancel
        </button>
        </div>
        </div>
        `;
        document.body.appendChild(modal);
    }

    async confirmDKGApproval(requestId, modal) {
        const notes = modal.querySelector('#dkgApprovalNotes').value;
        const success = await this.approveDKGRequest(requestId, notes);

        if (success) {
            modal.remove();
        }
    }

    // =============== UTILITY METHODS ===============

    getRequestTypeTitle(type) {
        const typeMap = {
            'platform_registration': 'Platform Access',
            'pool_role': 'Pool Access',
            'custodial_access': 'Custodial Access',
            'role_request': 'Role Request',
            'dkg_pool_manager_group': 'DKG Group Authorization',
            'dkg_group_pool_manager': 'DKG Group Authorization'
        };
        return typeMap[type] || type;
    }
}

// Create global instance
window.requests = new RequestManager();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (wallet && wallet.connected) {
        requests.initialize();
    }
});

// Initialize on wallet connection
if (wallet) {
    wallet.on('connected', () => {
        requests.initialize();
    });

    wallet.on('accountChanged', () => {
        requests.checkAdminRights();
        requests.loadUserRequests();
        if (requests.adminMode) {
            requests.loadAllRequests();
        }
    });
}
