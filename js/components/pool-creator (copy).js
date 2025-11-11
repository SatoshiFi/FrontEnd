
class PoolCreator {
    constructor() {
        this.currentStep = 1;
        this.maxSteps = 4;
        this.poolData = {};
        this.selectedFrostSession = null;
        this.availableFrostSessions = [];
        this.initialized = false;

        // Pool creation state
        this.poolCreationInProgress = false;

        // Validation flags
        this.stepValidation = {
            1: false, // Governance type selected
            2: false, // Pool parameters valid
            3: false, // Bitcoin settings configured
            4: false  // Ready to create
        };
    }


    validateConfiguration() {
        const requiredEndpoints = ['HEALTH', 'POOLS', 'STATS', 'BLOCKS'];
        const missingEndpoints = [];

        for (const endpoint of requiredEndpoints) {
            if (!CONFIG.API.ENDPOINTS[endpoint]) {
                missingEndpoints.push(endpoint);
            }
        }

        if (missingEndpoints.length > 0) {
            console.error('Missing API endpoints in configuration:', missingEndpoints);
            throw new Error(`Configuration error: missing endpoints ${missingEndpoints.join(', ')}`);
        }


        if (!CONFIG.API.MINING) {
            throw new Error('Mining API base URL not configured');
        }

        console.log('API configuration validated successfully');
        return true;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            console.log('Initializing PoolCreator...');

            this.validateConfiguration();

            // Check wallet connection
            if (!window.wallet || !wallet.connected) {
                throw new Error('Wallet not connected. Please connect your wallet first.');
            }

            // Check authorization
            if (!window.userRoles || !userRoles.isUserAuthorized()) {
                throw new Error('Authorization required. Please request access from administrators.');
            }

            // Check Pool Manager role
            const hasPoolManagerRole = await this.checkPoolManagerRole();
            if (!hasPoolManagerRole) {
                throw new Error('POOL_MANAGER_ROLE required. Please contact admin for permission.');
            }

            // Initialize contracts
            if (!window.contracts || !contracts.initialized) {
                throw new Error('Contract system not initialized');
            }

            // Load available FROST sessions
            await this.loadAvailableFrostSessions();

            if (!this.poolData.payoutScript) {
                this.poolData.payoutScript = '0x76a914000000000000000000000000000000000000000088ac';
            }

            await this.testMiningConnection();

            // Build interface
            this.buildPoolCreatorInterface();

            this.initialized = true;
            console.log('PoolCreator initialized successfully');

            if (window.app && app.showNotification) {
                app.showNotification('success', 'Pool Creator ready');
            }

        } catch (error) {
            console.error('PoolCreator initialization error:', error);
            this.showInitializationError(error);
        }
    }

    async checkPoolManagerRole() {
        try {
            if (!window.contracts) return false;

            const factory = contracts.getContract('factory');
            if (!factory) return false;

            // Check through user roles system first
            if (window.userRoles) {
                const roles = userRoles.currentRoles;
                if (roles.includes('POOL_MANAGER') || roles.includes('ADMIN')) {
                    return true;
                }
            }

            // Fallback: check contract directly
            try {
                const POOL_MANAGER_ROLE = await factory.POOL_MANAGER_ROLE();
                return await factory.hasRole(POOL_MANAGER_ROLE, wallet.account);
            } catch (error) {
                console.log('Direct role check not available, using authorization system');
                return window.userRoles && userRoles.isUserAuthorized();
            }

        } catch (error) {
            console.error('Error checking Pool Manager role:', error);
            return false;
        }
    }

    async loadAvailableFrostSessions() {
        console.log('Loading available FROST sessions...');

        try {
            this.availableFrostSessions = [];

            const frost = contracts.getContract('frost');
            if (!frost) {
                console.error('FROST contract not available');
                return;
            }

            const factory = contracts.getContract('factory');
            if (!factory) {
                console.warn('Factory contract not available for role checking');
            }

            console.log('Reading sessions directly from FROST contract...');

            const nextSessionId = await frost.nextSessionId();
            const totalSessions = nextSessionId.toNumber();

            console.log(`Total sessions in contract: ${totalSessions}`);

            if (totalSessions === 0) {
                console.log('No sessions created yet');
                return;
            }

            const validSessions = [];

            for (let i = 0; i < totalSessions; i++) {
                try {
                    const details = await frost.getSessionDetails(i);

                    const state = details.state;
                    const threshold = details.threshold;
                    const totalParticipants = details.totalParticipants;
                    const creator = details.creator;
                    const groupPubKeyX = details.groupPubKeyX;
                    const participants = details.participants;

                    console.log(`Checking session ${i}:`, {
                        id: i,
                        state: state,
                        stateNumber: state.toNumber ? state.toNumber() : state,
                                threshold: threshold.toString(),
                                totalParticipants: totalParticipants.toString(),
                                participantsCount: participants.length
                    });

                    const stateNum = typeof state === 'object' && state.toNumber
                    ? state.toNumber()
                    : Number(state);

                    const thresholdNum = typeof threshold === 'object' && threshold.toNumber
                    ? threshold.toNumber()
                    : Number(threshold);

                    // SessionState { NONE=0, PENDING_COMMIT=1, PENDING_SHARES=2, READY=3, FINALIZED=4, ABORTED=5 }
                    const isFinalized = stateNum === 4;
                    const hasThreshold = thresholdNum > 0;

                    console.log(`  Checks: isFinalized=${isFinalized} (state=${stateNum}), hasThreshold=${hasThreshold} (threshold=${thresholdNum})`);

                    if (!isFinalized || !hasThreshold) {
                        console.log(`  ❌ Skipping: state=${stateNum} (need 4), threshold=${thresholdNum}`);
                        continue;
                    }

                    const isParticipant = participants.some(p =>
                    p.toLowerCase() === wallet.account.toLowerCase()
                    );

                    if (!isParticipant) {
                        console.log(`  ❌ Skipping: user not a participant`);
                        continue;
                    }

                    console.log(`  ✅ User is participant, checking roles...`);

                    let groupPubkey = groupPubKeyX || '0x';
                    console.log(`  GroupPubKey X: ${groupPubkey}`);

                    let allParticipantsAuthorized = true;
                    const participantRoleChecks = [];

                    if (factory) {
                        try {
                            const POOL_MANAGER_ROLE = await factory.POOL_MANAGER_ROLE();

                            for (const participant of participants) {
                                try {
                                    const hasRole = await factory.hasRole(POOL_MANAGER_ROLE, participant);
                                    participantRoleChecks.push({
                                        address: participant,
                                        hasPoolManagerRole: hasRole
                                    });

                                    if (!hasRole) {
                                        allParticipantsAuthorized = false;
                                        console.log(`    ❌ ${participant} - no POOL_MANAGER_ROLE`);
                                    } else {
                                        console.log(`    ✅ ${participant} - has POOL_MANAGER_ROLE`);
                                    }
                                } catch (error) {
                                    console.warn(`    Error checking role for ${participant}:`, error.message);
                                    allParticipantsAuthorized = false;
                                }
                            }
                        } catch (error) {
                            console.warn(`  Cannot check roles:`, error.message);
                            allParticipantsAuthorized = true;
                        }
                    } else {
                        console.log(`  ⚠️ Skipping role checks - factory not available`);
                    }

                    if (!allParticipantsAuthorized) {
                        console.log(`  ❌ Skipping: not all participants authorized`);
                        continue;
                    }

                    const sessionData = {
                        id: i,
                        state: stateNum,
                        threshold: thresholdNum,
                        participants: participants,
                        groupPubkey: groupPubkey,
                        creator: creator,
                        total: participants.length,
                        allParticipantsAuthorized: allParticipantsAuthorized,
                        participantRoleChecks: participantRoleChecks
                    };

                    validSessions.push(sessionData);
                    console.log(`  ✅ Session ${i} is valid for pool creation`);

                } catch (error) {
                    console.error(`Error processing session ${i}:`, error.message);
                    continue;
                }
            }

            this.availableFrostSessions = validSessions;

            console.log(`\n✅ Found ${this.availableFrostSessions.length} available FROST sessions for pool creation`);

            if (this.availableFrostSessions.length > 0) {
                this.availableFrostSessions.forEach((session, index) => {
                    console.log(`  ${index + 1}. Session ${session.id}:`, {
                        participants: session.participants.length,
                        threshold: session.threshold,
                        state: this.getStateText(session.state)
                    });
                });
            }

        } catch (error) {
            console.error('Error loading FROST sessions:', error);
            this.availableFrostSessions = [];
        }
    }

    async refreshFrostSessions() {
        try {
            if (window.app && app.showNotification) {
                app.showNotification('info', 'Refreshing FROST sessions...');
            }

            if (window.dkgManager) {
                dkgManager.sessionsCache.clear();
                await dkgManager.loadUserSessions(wallet.account);
            }

            await this.loadAvailableFrostSessions();

            this.updateCurrentStep();

            if (window.app && app.showNotification) {
                app.showNotification('success', `Found ${this.availableFrostSessions.length} FROST sessions`);
            }

        } catch (error) {
            console.error('Error refreshing FROST sessions:', error);
            if (window.app && app.showNotification) {
                app.showNotification('error', 'Failed to refresh FROST sessions');
            }
        }
    }

    getStateText(state) {
        const states = {
            0: 'NONE',
            1: 'PENDING_COMMIT',
            2: 'PENDING_SHARES',
            3: 'READY',
            4: 'FINALIZED',
            5: 'ABORTED'
        };
        return states[state] || `UNKNOWN(${state})`;
    }

    buildPoolCreatorInterface() {
        const container = document.getElementById('poolCreationContent');
        if (!container) {
            console.error('Pool creation container not found');
            return;
        }

        container.innerHTML = `
        <div class="pool-creation-wizard">
        <div class="wizard-content">
        <div id="step-1" class="wizard-step ${this.currentStep === 1 ? 'active' : ''}">
        ${this.renderGovernanceTypeStep()}
        </div>
        <div id="step-2" class="wizard-step ${this.currentStep === 2 ? 'active' : ''}">
        ${this.renderPoolParametersStep()}
        </div>
        <div id="step-3" class="wizard-step ${this.currentStep === 3 ? 'active' : ''}">
        ${this.renderBitcoinSettingsStep()}
        </div>
        <div id="step-4" class="wizard-step ${this.currentStep === 4 ? 'active' : ''}">
        ${this.renderConfirmationStep()}
        </div>
        </div>

        <div class="wizard-actions">
        <button id="prevStepBtn" class="btn btn-secondary" onclick="poolCreator.previousStep()"
        style="${this.currentStep === 1 ? 'display: none;' : ''}">
        Previous
        </button>
        <button id="nextStepBtn" class="btn btn-primary" onclick="poolCreator.nextStep()"
        style="${this.currentStep === this.maxSteps ? 'display: none;' : ''}">
        Next
        </button>
        <button id="createPoolBtn" class="btn btn-success" onclick="poolCreator.createPool()"
        style="${this.currentStep === this.maxSteps ? '' : 'display: none;'}"
        ${this.poolCreationInProgress ? 'disabled' : ''}>
        Create Mining Pool
        </button>
        </div>
        </div>
        `;

        this.bindWizardEvents();
    }

    renderProgressSteps() {
        const steps = [
            { num: 1, label: 'Governance' },
            { num: 2, label: 'Parameters' },
            { num: 3, label: 'Bitcoin Setup' },
            { num: 4, label: 'Create Pool' }
        ];

        return steps.map(step => `
        <div class="step ${this.currentStep >= step.num ? 'active' : ''} ${this.stepValidation[step.num] ? 'completed' : ''}">
        <div class="step-number">${step.num}</div>
        <div class="step-label">${step.label}</div>
        </div>
        `).join('');
    }

    renderGovernanceTypeStep() {
        return `
        <div class="step-content">
        <h3>Choose Pool Governance Type</h3>
        <p class="step-description">
        Select how your mining pool will be governed and who can make management decisions.
        </p>

        <div class="governance-options">
        <div class="governance-option ${this.poolData.governanceType === 'single' ? 'selected' : ''}"
        data-type="single" onclick="poolCreator.selectGovernanceType('single')">
        <div class="option-header">
        <h4>Single Owner</h4>
        <div class="option-badge">Simple</div>
        </div>
        <div class="option-description">
        <div class="pros-cons">
        <div class="pros">
        <h5>Advantages:</h5>
        <ul>
        <li>Quick decision making</li>
        <li>Simple setup process</li>
        <li>Full control over pool operations</li>
        <li>Lower transaction costs</li>
        <li>Immediate deployment</li>
        </ul>
        </div>
        <div class="best-for">
        <h5>Best for:</h5>
        <p>Personal pools, testing environments, small operations</p>
        </div>
        </div>
        </div>
        </div>

        <div class="governance-option ${this.poolData.governanceType === 'frost' ? 'selected' : ''}"
        data-type="frost" onclick="poolCreator.selectGovernanceType('frost')">
        <div class="option-header">
        <h4>FROST Multisig</h4>
        <div class="option-badge ${this.availableFrostSessions.length > 0 ? 'available' : 'unavailable'}">
        ${this.availableFrostSessions.length > 0 ? 'Available' : 'No Sessions'}
        </div>
        </div>
        <div class="option-description">
        <div class="pros-cons">
        <div class="pros">
        <h5>Advantages:</h5>
        <ul>
        <li>Distributed security model</li>
        <li>No single point of failure</li>
        <li>Requires consensus for decisions</li>
        <li>Transparent governance</li>
        <li>Trustless operations</li>
        </ul>
        </div>
        <div class="requirements">
        <h5>Requirements:</h5>
        <p>Completed DKG session with authorized participants</p>
        </div>
        </div>

        <div class="frost-sessions-preview">
        ${this.renderFrostSessionsPreview()}
        </div>
        </div>
        </div>
        </div>

        ${this.poolData.governanceType ? `
            <div class="selected-governance">
            <h4>Selected: ${this.poolData.governanceType === 'frost' ? 'FROST Multisig' : 'Single Owner'} Governance</h4>
            ${this.selectedFrostSession ? `
                <div class="selected-session">
                <strong>FROST Session:</strong> ${this.selectedFrostSession.id}<br>
                <strong>Participants:</strong> ${this.selectedFrostSession.participants.length}<br>
                <strong>Threshold:</strong> ${this.selectedFrostSession.threshold}
                </div>
                ` : ''}
                </div>
                ` : ''}
                </div>
                `;
    }

    renderFrostSessionsPreview() {
        if (this.availableFrostSessions.length === 0) {
            return `
            <div class="no-sessions">
            <div class="empty-state">
            <h5>No FROST Sessions Available</h5>
            <p>To create a FROST-governed pool, you need to:</p>
            <ol>
            <li>Go to DKG Management section</li>
            <li>Create a new DKG session</li>
            <li>Invite participants with Pool Manager roles</li>
            <li>Complete the DKG process</li>
            <li>Return here to create your pool</li>
            </ol>

            <div class="action-buttons">
            <button class="btn btn-outline btn-sm" onclick="showSection('dkgManagement')">
            Go to DKG Management
            </button>
            <button class="btn btn-secondary btn-sm" onclick="poolCreator.refreshFrostSessions()">
            Refresh Sessions
            </button>
            </div>
            </div>
            </div>
            `;
        }

        const previewSessions = this.availableFrostSessions.slice(0, 3);

        return `
        <div class="sessions-summary">
        <div class="summary-header">
        <span class="session-count">${this.availableFrostSessions.length} sessions available</span>
        <span class="status-indicator">Ready for pool creation</span>
        <button class="btn btn-sm btn-outline" onclick="poolCreator.refreshFrostSessions()" style="margin-left: auto;">
        Refresh
        </button>
        </div>

        <div class="sessions-list">
        ${previewSessions.map(session => `
            <div class="session-preview ${this.selectedFrostSession?.id === session.id ? 'selected' : ''}"
            onclick="poolCreator.selectFrostSession('${session.id}')">
            <div class="session-id">ID: ${session.id.toString().slice(0, 8)}...</div>
            <div class="session-details">
            <span class="participants">${session.participants.length} participants</span>
            <span class="threshold">threshold: ${session.threshold}</span>
            </div>
            </div>
            `).join('')}

            ${this.availableFrostSessions.length > 3 ? `
                <div class="more-sessions">
                +${this.availableFrostSessions.length - 3} more sessions available
                </div>
                ` : ''}
                </div>
                </div>
                `;
    }

    renderPoolParametersStep() {
        return `
        <div class="step-content">
        <h3>Configure Pool Parameters</h3>
        <p class="step-description">
        Set up the basic parameters for your Bitcoin mining pool.
        </p>

        <div class="form-grid">
        <div class="form-group">
        <label class="form-label required">Pool Name</label>
        <input type="text" id="poolName" class="form-input"
        placeholder="e.g., SatoshiFi BTC Pool #1"
        maxlength="50"
        value="${this.poolData.name || ''}"
        oninput="poolCreator.updatePoolData('name', this.value)">
        <small class="form-help">Display name for miners and interfaces</small>
        </div>

        <div class="form-group">
        <label class="form-label required">MP Token Symbol</label>
        <input type="text" id="poolSymbol" class="form-input"
        placeholder="e.g., SBTC1"
        maxlength="10"
        value="${this.poolData.symbol || ''}"
        oninput="poolCreator.updatePoolData('symbol', this.value.toUpperCase())">
        <small class="form-help">Symbol for Mining Pool token</small>
        </div>
        </div>

        <div class="form-group">
        <label class="form-label">Pool Description</label>
        <textarea id="poolDescription" class="form-input" rows="3"
        placeholder="Optional description for miners and stakeholders"
        maxlength="300"
        oninput="poolCreator.updatePoolData('description', this.value)">${this.poolData.description || ''}</textarea>
        <small class="form-help">Optional description visible to miners</small>
        </div>

        <div class="form-grid">
        <div class="form-group">
        <label class="form-label">Pool Fee (%)</label>
        <input type="number" id="poolFee" class="form-input"
        min="0" max="10" step="0.1"
        value="${this.poolData.fee || '1.0'}"
        oninput="poolCreator.updatePoolData('fee', this.value)">
        <small class="form-help">Fee percentage from found blocks (0-10%)</small>
        </div>

        <div class="form-group">
        <label class="form-label">Minimum Payout (BTC)</label>
        <input type="number" id="minPayout" class="form-input"
        min="0.001" max="1" step="0.001"
        value="${this.poolData.minPayout || '0.01'}"
        oninput="poolCreator.updatePoolData('minPayout', this.value)">
        <small class="form-help">Minimum amount for miner payouts</small>
        </div>
        </div>

        <div class="form-group">
        <label class="form-label">MP Token Access</label>
        <div class="radio-group">
        <label class="radio-option">
        <input type="radio" name="tokenType" value="public"
        ${!this.poolData.tokenType || this.poolData.tokenType === 'public' ? 'checked' : ''}
        onchange="poolCreator.updatePoolData('tokenType', this.value)">
        <span class="radio-content">
        <strong>Public Trading</strong>
        <small>MP tokens can be freely traded</small>
        </span>
        </label>
        <label class="radio-option">
        <input type="radio" name="tokenType" value="restricted"
        ${this.poolData.tokenType === 'restricted' ? 'checked' : ''}
        onchange="poolCreator.updatePoolData('tokenType', this.value)">
        <span class="radio-content">
        <strong>Restricted Access</strong>
        <small>MP tokens only for pool participants</small>
        </span>
        </label>
        </div>
        </div>

        <div class="calculator-section">
        <h4>Reward Distribution Algorithm</h4>
        <p class="section-description">
        Choose the method for calculating miner rewards.
        </p>

        <div class="calculator-options">
        ${this.renderCalculatorOptions()}
        </div>
        </div>
        </div>
        `;
    }

    renderCalculatorOptions() {
        const calculators = [
            {
                id: 0,
                name: 'PPLNS',
                title: 'Pay Per Last N Shares',
                description: 'Fair distribution with protection against pool hopping.',
                recommended: true
            },
            {
                id: 1,
                name: 'PPS',
                title: 'Pay Per Share',
                description: 'Fixed payment for each share. Stable income for miners.'
            },
            {
                id: 2,
                name: 'FPPS',
                title: 'Full Pay Per Share',
                description: 'PPS including transaction fees. Maximum profitability.'
            },
            {
                id: 3,
                name: 'Score',
                title: 'Score-based System',
                description: 'Time-decay scoring. Rewards long-term commitment.'
            }
        ];

        return calculators.map(calc => `
        <div class="calculator-option ${(this.poolData.calculatorId || 0) === calc.id ? 'selected' : ''}"
        data-calculator-id="${calc.id}"
        onclick="poolCreator.selectCalculator(${calc.id})">
        <div class="calc-header">
        <h5>${calc.name} ${calc.recommended ? '<span class="recommended-badge">Recommended</span>' : ''}</h5>
        <div class="calc-title">${calc.title}</div>
        </div>
        <p class="calc-description">${calc.description}</p>
        </div>
        `).join('');
    }



    renderConfirmationStep() {
        return `
        <div class="step-content">
        <h3>Review & Create Pool</h3>
        <p class="step-description">
        Review all settings before creating your mining pool.
        </p>

        <div class="confirmation-summary" id="confirmationSummary">
        ${this.renderPoolSummary()}
        </div>

        <div class="gas-estimation" id="gasEstimation">
        <h4>Transaction Cost Estimation</h4>
        <div class="gas-info">
        <div class="gas-item">
        <span class="label">Estimated Gas:</span>
        <span class="value" id="estimatedGas">Calculating...</span>
        </div>
        <div class="gas-item">
        <span class="label">Cost (ETH):</span>
        <span class="value" id="estimatedCost">Calculating...</span>
        </div>
        </div>
        </div>

        <div class="creation-progress" id="creationProgress" style="${this.poolCreationInProgress ? '' : 'display: none;'}">
        <h4>Pool Creation Progress</h4>
        <div class="progress-steps">
        <div class="progress-step" id="step-validate">
        <span class="step-icon">Loading...</span>
        <span class="step-text">Validating parameters</span>
        </div>
        <div class="progress-step" id="step-transaction">
        <span class="step-icon">Loading...</span>
        <span class="step-text">Creating pool contracts</span>
        </div>
        <div class="progress-step" id="step-mining-setup">
        <span class="step-icon">Loading...</span>
        <span class="step-text">Setting up mining simulator</span>
        </div>
        <div class="progress-step" id="step-complete">
        <span class="step-icon">Loading...</span>
        <span class="step-text">Finalizing configuration</span>
        </div>
        </div>
        </div>

        <div class="creation-result" id="creationResult" style="display: none;">
        <!-- Pool creation results will appear here -->
        </div>
        </div>
        `;
    }

    renderPoolSummary() {
        const governanceType = this.poolData.governanceType;

        return `
        <div class="summary-section">
        <h4>Pool Configuration Summary</h4>

        <div class="summary-grid">
        <div class="summary-item">
        <span class="label">Pool Name:</span>
        <span class="value">${this.poolData.name || 'Not set'}</span>
        </div>
        <div class="summary-item">
        <span class="label">MP Token Symbol:</span>
        <span class="value">MP-${this.poolData.symbol || 'Not set'}</span>
        </div>
        <div class="summary-item">
        <span class="label">Governance Type:</span>
        <span class="value ${governanceType === 'frost' ? 'frost' : 'single'}">
        ${governanceType === 'frost' ? 'FROST Multisig' : 'Single Owner'}
        </span>
        </div>
        ${governanceType === 'frost' && this.selectedFrostSession ? `
            <div class="summary-item">
            <span class="label">FROST Session:</span>
            <span class="value">${this.selectedFrostSession.id}</span>
            </div>
            <div class="summary-item">
            <span class="label">Participants:</span>
            <span class="value">${this.selectedFrostSession.participants.length}</span>
            </div>
            <div class="summary-item">
            <span class="label">Signature Threshold:</span>
            <span class="value">${this.selectedFrostSession.threshold}</span>
            </div>
            ` : ''}
            <div class="summary-item">
            <span class="label">Pool Fee:</span>
            <span class="value">${this.poolData.fee || '1.0'}%</span>
            </div>
            <div class="summary-item">
            <span class="label">MP Token Type:</span>
            <span class="value">${this.poolData.tokenType === 'restricted' ? 'Restricted' : 'Public Trading'}</span>
            </div>
            <div class="summary-item">
            <span class="label">Reward Algorithm:</span>
            <span class="value">${this.getCalculatorName(this.poolData.calculatorId || 0)}</span>
            </div>
            <div class="summary-item">
            <span class="label">Min Confirmations:</span>
            <span class="value">${this.poolData.minConfirmations || '100'}</span>
            </div>
            </div>
            </div>
            `;
    }

    // Event handling methods
    bindWizardEvents() {
        // Auto-test mining connection when step 3 loads
        if (this.currentStep === 3) {
            setTimeout(() => this.testMiningConnection(), 1000);
        }

        // Calculate gas estimate when step 4 loads
        if (this.currentStep === 4) {
            setTimeout(() => this.calculateGasEstimate(), 1000);
        }
    }

    selectGovernanceType(type) {
        console.log('Selecting governance type:', type);

        if (type === 'frost' && this.availableFrostSessions.length === 0) {
            if (window.app && app.showNotification) {
                app.showNotification('warning', 'No FROST sessions available. Please create a DKG session first.');
            }
            return;
        }

        this.poolData.governanceType = type;
        this.stepValidation[1] = true;

        if (type === 'single') {
            this.selectedFrostSession = null;
        }

        this.updateCurrentStep();
    }

    selectFrostSession(sessionId) {
        console.log('Selecting FROST session:', sessionId);

        this.selectedFrostSession = this.availableFrostSessions.find(s => s.id == sessionId);

        if (this.selectedFrostSession) {
            console.log('Selected FROST session details:', this.selectedFrostSession);
            this.updateCurrentStep();
        }
    }

    selectCalculator(calculatorId) {
        console.log('Selecting calculator:', calculatorId);
        this.poolData.calculatorId = calculatorId;
        this.updateCurrentStep();
    }

    updatePoolData(field, value) {
        this.poolData[field] = value;
        console.log(`Updated ${field}:`, value);
        this.validateCurrentStep();
    }

    nextStep() {
        if (!this.validateCurrentStep()) {
            return;
        }

        if (this.currentStep < this.maxSteps) {
            this.currentStep++;
            this.updateWizardInterface();
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateWizardInterface();
        }
    }

    updateWizardInterface() {
        this.buildPoolCreatorInterface();
    }

    updateCurrentStep() {
        const currentStepElement = document.getElementById(`step-${this.currentStep}`);
        if (currentStepElement) {
            switch (this.currentStep) {
                case 1:
                    currentStepElement.innerHTML = this.renderGovernanceTypeStep();
                    break;
                case 2:
                    currentStepElement.innerHTML = this.renderPoolParametersStep();
                    break;
                case 3:
                    currentStepElement.innerHTML = this.renderBitcoinSettingsStep();
                    this.testMiningConnection();
                    break;
                case 4:
                    currentStepElement.innerHTML = this.renderConfirmationStep();
                    this.calculateGasEstimate();
                    break;
            }
        }

        // Update progress steps
        const progressContainer = document.querySelector('.progress-steps');
        if (progressContainer) {
            progressContainer.innerHTML = this.renderProgressSteps();
        }
    }

    validateCurrentStep() {
        let isValid = false;

        switch (this.currentStep) {
            case 1:
                isValid = !!this.poolData.governanceType &&
                (this.poolData.governanceType !== 'frost' || !!this.selectedFrostSession);
                break;

            case 2:
                isValid = !!(this.poolData.name && this.poolData.symbol);
                break;

            case 3:
                isValid = true; // Basic validation
                break;

            case 4:
                isValid = this.validateAllSteps();
                break;
        }

        this.stepValidation[this.currentStep] = isValid;

        if (!isValid && this.currentStep < this.maxSteps) {
            const missingFields = this.getMissingFields();
            if (missingFields.length > 0 && window.app && app.showNotification) {
                app.showNotification('warning', `Please fill required fields: ${missingFields.join(', ')}`);
            }
        }

        return isValid;
    }

    getMissingFields() {
        const missing = [];

        switch (this.currentStep) {
            case 1:
                if (!this.poolData.governanceType) missing.push('Governance Type');
                if (this.poolData.governanceType === 'frost' && !this.selectedFrostSession) {
                    missing.push('FROST Session');
                }
                break;

            case 2:
                if (!this.poolData.name) missing.push('Pool Name');
                if (!this.poolData.symbol) missing.push('MP Token Symbol');
                break;
        }

        return missing;
    }

    validateAllSteps() {
        return !!(
            this.poolData.governanceType &&
            this.poolData.name &&
            this.poolData.symbol &&
            (this.poolData.governanceType !== 'frost' || this.selectedFrostSession)
        );
    }

    // ИСПРАВЛЕННЫЙ метод тестирования соединения с API
    async testMiningConnection() {
        const statusElement = document.getElementById('simulatorStatus');
        const blockHeightElement = document.getElementById('currentBlockHeight');

        if (statusElement) {
            statusElement.innerHTML = `
            <div class="status-indicator">Testing...</div>
            <div class="status-text">Testing connection...</div>
            `;
        }

        try {
            // ИСПРАВЛЕНО: используем централизованную конфигурацию
            const healthUrl = CONFIG.API.getMiningUrl('HEALTH');
            console.log('Testing mining connection to:', healthUrl);

            const response = await fetch(healthUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const healthData = await response.json();
            console.log('Health check response:', healthData);

            if (statusElement) {
                statusElement.innerHTML = `
                <div class="status-indicator online">Connected</div>
                <div class="status-text">Mining API v${healthData.version || 'unknown'}</div>
                `;
            }

            if (blockHeightElement) {
                blockHeightElement.textContent = healthData.current_block || 'Unknown';
            }

            if (window.app && app.showNotification) {
                app.showNotification('success', 'Mining simulator connection successful');
            }

        } catch (error) {
            console.error('Mining connection test failed:', error);

            if (statusElement) {
                statusElement.innerHTML = `
                <div class="status-indicator offline">Failed</div>
                <div class="status-text">Connection failed: ${error.message}</div>
                `;
            }

            if (blockHeightElement) {
                blockHeightElement.textContent = 'N/A';
            }

            if (window.app && app.showNotification) {
                app.showNotification('error', `Mining simulator connection failed: ${error.message}`);
            }
        }
    }

    // Utility methods
    async calculateGasEstimate() {
        const gasElement = document.getElementById('estimatedGas');
        const costElement = document.getElementById('estimatedCost');

        try {
            if (gasElement) gasElement.textContent = 'Calculating...';
            if (costElement) costElement.textContent = 'Calculating...';

            const factory = contracts.getContract('factory');
            if (!factory) {
                throw new Error('Factory contract not available');
            }

            let gasEstimate;

            try {

                if (this.poolData.governanceType === 'frost') {
                    const { pubX, pubY } = this.extractPubkeyFromFrostSession(this.selectedFrostSession);
                    const params = {
                        asset: 'BTC',
                        poolId: `frost_pool_${Date.now()}`,
                        pubX: pubX,
                        pubY: pubY,
                        mpName: this.poolData.name || 'Test Pool',
                        mpSymbol: this.poolData.symbol || 'MP',
                        restrictedMp: this.poolData.tokenType === 'restricted',
                        payoutScript: this.poolData.payoutScript || '0x76a914000000000000000000000000000000000000000088ac',
                        calculatorId: parseInt(this.poolData.calculatorId || 0)
                    };
                    gasEstimate = await factory.estimateGas.createPool(params);
                } else {
                    const params = this.buildPoolParams();
                    gasEstimate = await factory.estimateGas.createPool(params);
                }


                gasEstimate = gasEstimate.mul(120).div(100);

                console.log('Gas estimate successful:', gasEstimate.toString());

            } catch (estimateError) {
                console.log('estimateGas failed, using safe fallback:', estimateError.message);

                gasEstimate = ethers.BigNumber.from('5000000');
            }

            const gasPrice = await window.ethereum.request({
                method: 'eth_gasPrice'
            });

            const estimatedCost = gasEstimate.mul(ethers.BigNumber.from(gasPrice)).div(ethers.BigNumber.from(10).pow(18));

            if (gasElement) gasElement.textContent = gasEstimate.toString();
            if (costElement) costElement.textContent = `~${ethers.utils.formatEther(estimatedCost)} ETH`;

        } catch (error) {
            console.error('Gas estimation error:', error);

            if (gasElement) gasElement.textContent = 'Estimation failed';
            if (costElement) costElement.textContent = 'Unknown';

            // Show fallback estimates
            setTimeout(() => {
                if (gasElement) gasElement.textContent = '~5,000,000';
                if (costElement) costElement.textContent = '~0.01 ETH';
            }, 1000);
        }
    }

    extractPubkeyFromFrostSession(session) {
        if (!session || !session.groupPubkey || session.groupPubkey === '0x' || session.groupPubkey === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            console.warn('FROST session has no valid groupPubkey, using placeholder values');
            return { pubX: 1, pubY: 1 };
        }

        try {
            const pubkeyHex = session.groupPubkey.slice(2); // убираем 0x

            console.log('Processing groupPubkey:', {
                original: session.groupPubkey,
                hex: pubkeyHex,
                length: pubkeyHex.length
            });

            if (pubkeyHex.length === 64) {
                console.log('Single bytes32 detected (X coordinate only)');

                const pubX = '0x' + pubkeyHex;
                const x = BigInt(pubX);
                const p = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F'); // secp256k1 prime
                const b = BigInt(7);

                // y^2 = x^3 + 7 (mod p)
                const y_squared = (x * x * x + b) % p;

                const exp = (p + BigInt(1)) / BigInt(4);
                let y = this.modPow(y_squared, exp, p);

                if (y % BigInt(2) !== BigInt(0)) {
                    y = p - y;
                }

                const pubY = '0x' + y.toString(16).padStart(64, '0');

                console.log('Calculated pubkey from X:', { pubX, pubY });

                return {
                    pubX: BigInt(pubX),
                    pubY: y
                };
            }

            if (pubkeyHex.length === 128) {
                const pubX = '0x' + pubkeyHex.slice(0, 64);
                const pubY = '0x' + pubkeyHex.slice(64, 128);

                console.log('Extracted X||Y pubkey:', { pubX, pubY });

                return {
                    pubX: BigInt(pubX),
                    pubY: BigInt(pubY)
                };
            }

            if (pubkeyHex.length === 66) {
                console.log('Compressed public key detected');

                const prefix = parseInt(pubkeyHex.slice(0, 2), 16);
                const xHex = pubkeyHex.slice(2);
                const pubX = '0x' + xHex;

                const x = BigInt(pubX);
                const p = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
                const b = BigInt(7);

                const y_squared = (x * x * x + b) % p;
                const exp = (p + BigInt(1)) / BigInt(4);
                let y = this.modPow(y_squared, exp, p);

                const isYEven = (y % BigInt(2)) === BigInt(0);
                const shouldBeEven = (prefix === 0x02);

                if (isYEven !== shouldBeEven) {
                    y = p - y;
                }

                const pubY = '0x' + y.toString(16).padStart(64, '0');

                console.log('Decompressed pubkey:', { pubX, pubY, prefix });

                return {
                    pubX: BigInt(pubX),
                    pubY: y
                };
            }

            if (pubkeyHex.length === 130) {
                const prefix = pubkeyHex.slice(0, 2);
                if (prefix === '04') {
                    const pubX = '0x' + pubkeyHex.slice(2, 66);
                    const pubY = '0x' + pubkeyHex.slice(66, 130);

                    console.log('Extracted uncompressed pubkey:', { pubX, pubY });

                    return {
                        pubX: BigInt(pubX),
                        pubY: BigInt(pubY)
                    };
                }
            }

            throw new Error(`Unsupported groupPubkey length: ${pubkeyHex.length}`);

        } catch (error) {
            console.error('Error extracting pubkey from FROST session:', error);
            return { pubX: 1, pubY: 1 };
        }
    }

    modPow(base, exponent, modulus) {
        if (modulus === BigInt(1)) return BigInt(0);
        let result = BigInt(1);
        base = base % modulus;
        while (exponent > BigInt(0)) {
            if (exponent % BigInt(2) === BigInt(1)) {
                result = (result * base) % modulus;
            }
            exponent = exponent / BigInt(2);
            base = (base * base) % modulus;
        }
        return result;
    }

    async generatePayoutScript() {
        try {
            if (!window.bitcoinAddressCodec) {
                throw new Error('Bitcoin Address Codec not loaded');
            }

            const address = prompt(
                `Enter Bitcoin ${CONFIG.BITCOIN.NETWORK} address for pool payouts:`,
                CONFIG.BITCOIN.NETWORK === 'testnet' ? 'tb1q...' : 'bc1q...'
            );

            if (!address) {
                if (window.app && app.showNotification) {
                    app.showNotification('info', 'Payout script generation cancelled');
                }
                return;
            }

            // ИСПРАВЛЕНО: Валидация через codec
            const validation = bitcoinAddressCodec.validate(address);

            if (!validation.valid) {
                if (window.app && app.showNotification) {
                    app.showNotification('error', `Invalid address: ${validation.error}`);
                }
                return;
            }

            // Предупреждение если не рекомендованный тип
            if (validation.type !== 'p2wpkh') {
                const confirmed = confirm(
                    `⚠️ You entered ${validation.type.toUpperCase()} address.\n\n` +
                    `Recommended: P2WPKH (bech32) for lowest fees.\n\n` +
                    `Continue with ${validation.type.toUpperCase()}?`
                );

                if (!confirmed) {
                    return;
                }
            }

            const script = bitcoinAddressCodec.encode(address, CONFIG.BITCOIN.NETWORK);

            console.log('Generated payout script:', {
                address: address,
                type: validation.type,
                script: script,
                network: CONFIG.BITCOIN.NETWORK
            });

            const payoutScriptField = document.getElementById('payoutScript');
            if (payoutScriptField) {
                payoutScriptField.value = script;
            }
            this.poolData.payoutScript = script;

            if (window.app && app.showNotification) {
                app.showNotification(
                    'success',
                    `Payout script generated for ${address} (${validation.type.toUpperCase()})`
                );
            }

        } catch (error) {
            console.error('Error generating payout script:', error);
            if (window.app && app.showNotification) {
                app.showNotification('error', `Failed to generate payout script: ${error.message}`);
            }
        }
    }

    async generatePayoutScriptFromFrost() {
        try {
            if (!this.selectedFrostSession) {
                throw new Error('No FROST session selected');
            }

            if (!window.bitcoinAddressCodec) {
                throw new Error('Bitcoin Address Codec not loaded');
            }

            const { pubX, pubY } = this.extractPubkeyFromFrostSession(this.selectedFrostSession);

            if (pubX === 1n || pubY === 1n) {
                throw new Error('Invalid FROST public key');
            }

            console.log('FROST public key extracted:', {
                pubX: pubX.toString(16),
                        pubY: pubY.toString(16)
            });

            const isYEven = (pubY % 2n) === 0n;
            const prefix = isYEven ? '02' : '03';
            const compressedHex = prefix + pubX.toString(16).padStart(64, '0');

            console.log('Compressed pubkey:', {
                prefix,
                isYEven,
                hex: compressedHex,
                length: compressedHex.length
            });

            const pubkeyBuffer = Buffer.from(compressedHex, 'hex');

            console.log('Pubkey buffer length:', pubkeyBuffer.length);

            const btcNetwork = bitcoinAddressCodec.getNetwork();
            console.log('Bitcoin network:', btcNetwork.bech32);

            const payment = bitcoin.payments.p2wpkh({
                pubkey: pubkeyBuffer,
                network: btcNetwork
            });

            const script = '0x' + payment.output.toString('hex');

            console.log('Generated FROST payout script:', {
                address: payment.address,
                script: script,
                scriptLength: payment.output.length,
                type: 'p2wpkh'
            });

            const payoutScriptField = document.getElementById('payoutScript');
            if (payoutScriptField) {
                payoutScriptField.value = script;
            }
            this.poolData.payoutScript = script;

            if (window.app && app.showNotification) {
                app.showNotification(
                    'success',
                    `FROST payout script generated: ${payment.address}`
                );
            }

        } catch (error) {
            console.error('Error generating FROST payout script:', error);
            if (window.app && app.showNotification) {
                app.showNotification('error', `Failed to generate FROST payout script: ${error.message}`);
            }
        }
    }

    validateScript() {
        const script = this.poolData.payoutScript || document.getElementById('payoutScript')?.value;

        if (!script) {
            if (window.app && app.showNotification) {
                app.showNotification('warning', 'Please enter a payout script first');
            }
            return false;
        }

        try {
            if (!window.bitcoinAddressCodec) {
                throw new Error('Bitcoin Address Codec not loaded');
            }

            const decoded = bitcoinAddressCodec.decode(script, CONFIG.BITCOIN.NETWORK);

            if (!decoded) {
                if (window.app && app.showNotification) {
                    app.showNotification('error', 'Could not decode payout script to valid address');
                }
                return false;
            }

            if (window.app && app.showNotification) {
                app.showNotification(
                    'success',
                    `✓ Valid script decodes to: ${bitcoinAddressCodec.formatForDisplay(decoded, 10)}`
                );
            }

            return true;

        } catch (error) {
            if (window.app && app.showNotification) {
                app.showNotification('error', `Validation error: ${error.message}`);
            }
            return false;
        }
    }

    renderBitcoinSettingsStep() {
        return `
        <div class="step-content">
        <h3>Bitcoin Integration Setup</h3>
        <p class="step-description">
        Configure Bitcoin-specific settings for your mining pool.
        </p>

        <div class="form-group">
        <label class="form-label required">Bitcoin Payout Script (hex format)</label>
        <textarea id="payoutScript" class="form-input code-input" rows="3"
        placeholder="0x76a914000000000000000000000000000000000000000088ac"
        oninput="poolCreator.updatePoolData('payoutScript', this.value)">${this.poolData.payoutScript || ''}</textarea>
        <div class="form-actions">
        <button type="button" class="btn btn-outline btn-sm" onclick="poolCreator.generatePayoutScript()">
        Generate from Address
        </button>
        ${this.poolData.governanceType === 'frost' ? `
            <button type="button" class="btn btn-outline btn-sm" onclick="poolCreator.generatePayoutScriptFromFrost()">
            Generate from FROST Key
            </button>
            ` : ''}
            <button type="button" class="btn btn-outline btn-sm" onclick="poolCreator.validateScript()">
            Validate Script
            </button>
            </div>
            <small class="form-help">Bitcoin script in hex format (e.g., 0x76a914...88ac)</small>
            </div>

            <div class="form-grid">
            <div class="form-group">
            <label class="form-label">Minimum Confirmations</label>
            <input type="number" id="minConfirmations" class="form-input"
            min="1" max="200"
            value="${this.poolData.minConfirmations || '100'}"
            oninput="poolCreator.updatePoolData('minConfirmations', this.value)">
            <small class="form-help">Block confirmations before rewards mature</small>
            </div>

            <div class="form-group">
            <label class="form-label">Share Difficulty</label>
            <input type="number" id="shareDifficulty" class="form-input"
            min="1" max="1000000"
            value="${this.poolData.shareDifficulty || '1000'}"
            oninput="poolCreator.updatePoolData('shareDifficulty', this.value)">
            <small class="form-help">Initial difficulty for miner shares</small>
            </div>
            </div>

            <div class="integration-section">
            <h4>Mining Simulator Integration</h4>
            <div class="integration-info">
            <div class="connection-status" id="simulatorStatus">
            <div class="status-indicator">Loading...</div>
            <div class="status-text">Checking connection...</div>
            </div>

            <div class="integration-details">
            <div class="detail-item">
            <span class="label">Mining API:</span>
            <span class="value">api-mining.unilayer.solutions</span>
            </div>
            <div class="detail-item">
            <span class="label">Network:</span>
            <span class="value">Bitcoin Testnet Simulator</span>
            </div>
            <div class="detail-item">
            <span class="label">Current Block:</span>
            <span class="value" id="currentBlockHeight">Loading...</span>
            </div>
            </div>

            <button type="button" class="btn btn-outline" onclick="poolCreator.testMiningConnection()">
            Test Connection
            </button>
            </div>
            </div>

            <div class="advanced-settings">
            <details>
            <summary>Advanced Settings</summary>
            <div class="advanced-content">
            <div class="form-group">
            <label class="checkbox-option">
            <input type="checkbox" id="autoDistribution"
            ${this.poolData.autoDistribution !== false ? 'checked' : ''}
            onchange="poolCreator.updatePoolData('autoDistribution', this.checked)">
            <span class="checkbox-content">
            <strong>Automatic Reward Distribution</strong>
            <small>Automatically distribute rewards when blocks are found</small>
            </span>
            </label>
            </div>

            <div class="form-group">
            <label class="checkbox-option">
            <input type="checkbox" id="oracleUpdates"
            ${this.poolData.oracleUpdates !== false ? 'checked' : ''}
            onchange="poolCreator.updatePoolData('oracleUpdates', this.checked)">
            <span class="checkbox-content">
            <strong>Oracle Data Updates</strong>
            <small>Send mining data to Ethereum Oracle system</small>
            </span>
            </label>
            </div>
            </div>
            </details>
            </div>
            </div>
            `;
    }

    buildPoolParams() {
        if (!this.poolData.poolId) {
            this.poolData.poolId = `pool_${Date.now()}`;
        }

        const params = {
            asset: 'BTC',
            poolId: this.poolData.poolId,
            pubX: 0,
            pubY: 0,
            mpName: this.poolData.name || 'Unnamed Pool',
            mpSymbol: this.poolData.symbol || 'MP',
            restrictedMp: this.poolData.tokenType === 'restricted',
            payoutScript: this.poolData.payoutScript || '0x76a914000000000000000000000000000000000000000088ac',
            calculatorId: parseInt(this.poolData.calculatorId || 0)
        };

        return params;
    }

    getCalculatorName(calculatorId) {
        const names = {
            0: 'PPLNS',
            1: 'PPS',
            2: 'FPPS',
            3: 'Score'
        };
        return names[calculatorId] || 'PPLNS';
    }

    // Main pool creation logic
    async createPool() {
        console.log('=== POOL CREATION START ===');
        console.log('Pool data:', this.poolData);
        console.log('Selected FROST session:', this.selectedFrostSession);

        if (!this.validateAllSteps()) {
            if (window.app && app.showNotification) {
                app.showNotification('error', 'Please complete all required fields');
            }
            return;
        }

        try {
            this.poolCreationInProgress = true;
            this.showCreationProgress();

            // Step 1: Validate parameters
            this.updateProgressStep('step-validate', 'progress', 'Validating pool parameters...');
            await this.validatePoolParameters();
            this.updateProgressStep('step-validate', 'success', 'Parameters validated');

            // Step 2: Create pool in Ethereum
            this.updateProgressStep('step-transaction', 'progress', 'Creating pool contracts...');
            let poolResult;

            if (this.poolData.governanceType === 'frost') {
                poolResult = await this.createFrostPool();
            } else {
                poolResult = await this.createSingleOwnerPool();
            }

            this.updateProgressStep('step-transaction', 'success', 'Pool contracts created');

            // Step 3: Set up mining simulator
            this.updateProgressStep('step-mining-setup', 'progress', 'Configuring mining simulator...');
            const miningResult = await this.createMiningSimulatorPool(poolResult);
            this.updateProgressStep('step-mining-setup', 'success', 'Mining simulator configured');

            // Step 4: Finalize setup
            this.updateProgressStep('step-complete', 'progress', 'Finalizing configuration...');
            await this.finalizePoolSetup(poolResult, miningResult);
            this.updateProgressStep('step-complete', 'success', 'Pool ready for miners!');

            // Show success result
            this.showPoolCreationResult(poolResult, miningResult);

            console.log('=== POOL CREATION SUCCESS ===');

        } catch (error) {
            console.error('=== POOL CREATION ERROR ===');
            console.error('Error details:', error);
            this.handlePoolCreationError(error);
        } finally {
            this.poolCreationInProgress = false;
        }
    }

    async validatePoolParameters() {
        if (!this.poolData.name) {
            throw new Error('Pool name is required');
        }

        if (!this.poolData.symbol) {
            throw new Error('MP token symbol is required');
        }

        if (!this.poolData.governanceType) {
            throw new Error('Governance type must be selected');
        }

        if (this.poolData.governanceType === 'frost' && !this.selectedFrostSession) {
            throw new Error('FROST session must be selected for FROST governance');
        }

        // Validate FROST session state
        if (this.poolData.governanceType === 'frost') {
            const session = this.selectedFrostSession;
            if (session.state !== 4) {
                throw new Error('FROST session is not finalized');
            }

            if (!session.allParticipantsAuthorized) {
                throw new Error('Not all FROST session participants are authorized');
            }
        }

        console.log('Pool parameters validation passed');
    }

    async createFrostPool() {
        if (!this.selectedFrostSession) {
            throw new Error('FROST session missed');
        }

        console.log('Creating FROST pool from session:', this.selectedFrostSession.id);

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();

        const factory = contracts.getContract('factory');
        if (!factory) {
            throw new Error('Factory contract not available');
        }

        const factoryWithSigner = factory.connect(signer);

        const { pubX, pubY } = this.extractPubkeyFromFrostSession(this.selectedFrostSession);

        if (!this.poolData.poolId) {
            this.poolData.poolId = `frost_pool_${Date.now()}`;
        }

        const poolParams = {
            asset: 'BTC',
            poolId: this.poolData.poolId,
            pubX: pubX,
            pubY: pubY,
            mpName: this.poolData.name,
            mpSymbol: this.poolData.symbol,
            restrictedMp: this.poolData.tokenType === 'restricted',
            payoutScript: this.poolData.payoutScript || '0x76a914000000000000000000000000000000000000000088ac',
            calculatorId: parseInt(this.poolData.calculatorId || 0)
        };

        console.log('FROST pool parameters:', poolParams);

        const gasLimit = 5000000;
        console.log('Using safe gas limit:', gasLimit);

        const tx = await factoryWithSigner.createPool(poolParams, { gasLimit });
        const receipt = await tx.wait();

        console.log('FROST pool created, receipt:', receipt);

        const poolCreatedEvent = receipt.events?.find(e => e.event === 'PoolCreated');
        if (!poolCreatedEvent) {
            throw new Error('PoolCreated event not found in transaction receipt');
        }

        const result = {
            type: 'frost',
            sessionId: this.selectedFrostSession.id,
            poolId: this.poolData.poolId,
            txHash: receipt.transactionHash,
            addresses: {
                core: poolCreatedEvent.args.poolCore || poolCreatedEvent.args[0],
                mpToken: poolCreatedEvent.args.mpToken || poolCreatedEvent.args[1]
            },
            participants: this.selectedFrostSession.participants,
            threshold: this.selectedFrostSession.threshold
        };

        console.log('FROST pool creation result:', result);
        return result;
    }

    async createMiningSimulatorPool(ethereumResult) {
        console.log('Creating pool in mining simulator');

        const miningPoolData = {
            pool_id: ethereumResult.poolId,
            name: this.poolData.name,
            fee_percentage: parseFloat(this.poolData.fee || 1.0) / 100,
            algorithm: this.getCalculatorName(this.poolData.calculatorId || 0),
            ethereum_contract: ethereumResult.addresses.core,
            governance_type: ethereumResult.type,
            min_payout: parseFloat(this.poolData.minPayout || 0.01),
            share_difficulty: parseInt(this.poolData.shareDifficulty || 1000)
        };

        // Add FROST-specific data
        if (ethereumResult.type === 'frost') {
            miningPoolData.frost_session_id = ethereumResult.sessionId;
            miningPoolData.participants = ethereumResult.participants;
            miningPoolData.threshold = ethereumResult.threshold;
        }

        console.log('Mining simulator pool data:', miningPoolData);

        try {
            // ИСПРАВЛЕНО: используем централизованную конфигурацию
            const poolsUrl = CONFIG.API.getMiningUrl('POOLS');
            console.log('Creating mining pool at:', poolsUrl);

            const response = await fetch(poolsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await this.getMiningApiKey()}`
                },
                body: JSON.stringify(miningPoolData)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Mining simulator error:', errorText);
                throw new Error(`Mining simulator setup failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Mining simulator pool created:', result);

            return result;

        } catch (error) {
            console.error('Error creating mining simulator pool:', error);
            throw new Error(`Mining simulator integration failed: ${error.message}`);
        }
    }

    // ДОБАВЛЕННЫЙ метод для получения API ключа
    async getMiningApiKey() {
        // В продакшене это должно быть получено через безопасный механизм
        // Для тестнета используем статический ключ
        return 'test_api_key_for_simulator';
    }

    async finalizePoolSetup(poolResult, miningResult) {
        console.log('Finalizing pool setup');
        // Additional setup tasks could go here
        console.log('Pool setup finalized successfully');
    }

    // Progress and result display methods
    showCreationProgress() {
        const progressElement = document.getElementById('creationProgress');
        if (progressElement) {
            progressElement.style.display = 'block';
        }

        const createBtn = document.getElementById('createPoolBtn');
        if (createBtn) {
            createBtn.disabled = true;
            createBtn.innerHTML = 'Creating Pool...';
        }
    }

    hideCreationProgress() {
        const progressElement = document.getElementById('creationProgress');
        if (progressElement) {
            progressElement.style.display = 'none';
        }

        const createBtn = document.getElementById('createPoolBtn');
        if (createBtn) {
            createBtn.disabled = false;
            createBtn.innerHTML = 'Create Mining Pool';
        }
    }

    updateProgressStep(stepId, status, message) {
        const step = document.getElementById(stepId);
        if (!step) return;

        const icon = step.querySelector('.step-icon');
        const text = step.querySelector('.step-text');

        step.classList.remove('progress', 'success', 'error');
        step.classList.add(status);

        switch (status) {
            case 'progress':
                icon.textContent = 'Working...';
                break;
            case 'success':
                icon.textContent = 'Done';
                break;
            case 'error':
                icon.textContent = 'Error';
                break;
        }

        if (message && text) {
            text.textContent = message;
        }
    }

    showPoolCreationResult(ethereumResult, miningResult) {
        const resultContainer = document.getElementById('creationResult');
        if (!resultContainer) return;

        resultContainer.style.display = 'block';
        resultContainer.innerHTML = `
        <div class="creation-success">
        <div class="success-header">
        <div class="success-icon">Success</div>
        <h3>Mining Pool Created Successfully!</h3>
        <p class="success-subtitle">Your Bitcoin mining pool is ready for miners</p>
        </div>

        <div class="pool-addresses">
        <h4>Smart Contract Addresses</h4>
        <div class="address-list">
        <div class="address-item">
        <span class="label">Pool Core:</span>
        <span class="address" onclick="poolCreator.copyToClipboard('${ethereumResult.addresses.core}')">${ethereumResult.addresses.core}</span>
        <button class="copy-btn" onclick="poolCreator.copyToClipboard('${ethereumResult.addresses.core}')">Copy</button>
        </div>
        <div class="address-item">
        <span class="label">MP Token:</span>
        <span class="address" onclick="poolCreator.copyToClipboard('${ethereumResult.addresses.mpToken}')">${ethereumResult.addresses.mpToken}</span>
        <button class="copy-btn" onclick="poolCreator.copyToClipboard('${ethereumResult.addresses.mpToken}')">Copy</button>
        </div>
        <div class="address-item">
        <span class="label">Transaction:</span>
        <a href="${CONFIG.EXPLORER_URL}/tx/${ethereumResult.txHash}" target="_blank" class="tx-link">
        ${ethereumResult.txHash.slice(0, 10)}...${ethereumResult.txHash.slice(-8)}
        </a>
        </div>
        </div>
        </div>

        <div class="next-steps">
        <h4>Next Steps</h4>
        <div class="steps-grid">
        <div class="step-card">
        <div class="step-icon">Settings</div>
        <h5>Configure Pool Settings</h5>
        <p>Adjust reward distribution, fees, and mining parameters</p>
        <button class="btn btn-outline btn-sm" onclick="showSection('poolManagement')">
        Pool Management
        </button>
        </div>

        <div class="step-card">
        <div class="step-icon">Mining</div>
        <h5>Connect Miners</h5>
        <p>Share the Stratum URL with miners to start mining</p>
        <button class="btn btn-outline btn-sm" onclick="window.open('https://api-mining.unilayer.solutions/mining-simulator.html', '_blank')">
        Open Simulator
        </button>
        </div>

        <div class="step-card">
        <div class="step-icon">Stats</div>
        <h5>Monitor Performance</h5>
        <p>Track hashrate, shares, and block findings</p>
        <button class="btn btn-outline btn-sm" onclick="showSection('nftCollection')">
        View Status
        </button>
        </div>

        ${ethereumResult.type === 'frost' ? `
            <div class="step-card">
            <div class="step-icon">Keys</div>
            <h5>Manage FROST Keys</h5>
            <p>Coordinate with other participants for pool operations</p>
            <button class="btn btn-outline btn-sm" onclick="showSection('dkgManagement')">
            DKG Management
            </button>
            </div>
            ` : ''}
            </div>
            </div>

            <div class="result-actions">
            <button class="btn btn-primary" onclick="showSection('poolManagement')">
            Manage Pool
            </button>
            <button class="btn btn-secondary" onclick="poolCreator.createAnotherPool()">
            Create Another Pool
            </button>
            <button class="btn btn-outline" onclick="poolCreator.downloadPoolInfo()">
            Download Pool Info
            </button>
            </div>
            </div>
            `;

            const wizardActions = document.querySelector('.wizard-actions');
            if (wizardActions) {
                wizardActions.style.display = 'none';
            }

            if (window.app && app.showNotification) {
                app.showNotification('success', `Mining pool "${this.poolData.name}" created successfully!`);
            }
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            if (window.app && app.showNotification) {
                app.showNotification('info', 'Copied to clipboard');
            }
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);

            // Fallback method
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);

            if (window.app && app.showNotification) {
                app.showNotification('info', 'Copied to clipboard');
            }
        }
    }

    handlePoolCreationError(error) {
        console.error('=== POOL CREATION ERROR ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);

        // Determine user-friendly error message
        let userMessage = 'Pool creation failed. Please try again.';

        if (error.message.includes('insufficient funds')) {
            userMessage = 'Insufficient ETH balance for gas fees';
        } else if (error.message.includes('user rejected') || error.message.includes('denied')) {
            userMessage = 'Transaction was rejected by user';
        } else if (error.message.includes('FROST')) {
            userMessage = `FROST integration error: ${error.message}`;
        } else if (error.message.includes('simulator') || error.message.includes('mining')) {
            userMessage = `Mining simulator error: ${error.message}`;
        } else if (error.message.includes('role') || error.message.includes('permission')) {
            userMessage = 'Insufficient permissions. Please contact administrator.';
        } else if (error.message.includes('revert')) {
            userMessage = `Smart contract error: ${error.message}`;
        } else {
            userMessage = error.message;
        }

        // Update progress steps to show error
        this.updateProgressStep('step-validate', 'error', 'Validation failed');
        this.updateProgressStep('step-transaction', 'error', 'Transaction failed');
        this.updateProgressStep('step-mining-setup', 'error', 'Setup failed');
        this.updateProgressStep('step-complete', 'error', 'Creation failed');

        if (window.app && app.showNotification) {
            app.showNotification('error', userMessage);
        }

        this.hideCreationProgress();
        setTimeout(() => this.showRetryOption(), 1000);
    }

    showRetryOption() {
        const actionsContainer = document.querySelector('.wizard-actions');
        if (!actionsContainer) return;

        const existingRetry = actionsContainer.querySelector('.retry-btn');
        if (existingRetry) {
            existingRetry.remove();
        }

        const retryBtn = document.createElement('button');
        retryBtn.className = 'btn btn-warning retry-btn';
        retryBtn.innerHTML = 'Try Again';
        retryBtn.onclick = () => {
            retryBtn.remove();
            this.createPool();
        };

        actionsContainer.appendChild(retryBtn);
    }

    showInitializationError(error) {
        const container = document.getElementById('poolCreationContent');
        if (!container) return;


        const isRoleError = error.message.includes('POOL_MANAGER_ROLE') ||
        error.message.includes('required') ||
        error.message.includes('permission');

        if (isRoleError) {
            container.innerHTML = `
            <div class="initialization-error role-required-error">
            <div class="error-icon">🔒</div>
            <h3>Pool Manager Role Required</h3>
            <p class="error-message">You need Pool Manager permissions to create mining pools.</p>

            <div class="error-details">
            <h4>How to get access:</h4>
            <ol>
            <li>Request Pool Manager role from administrators</li>
            <li>Wait for admin approval (typically within 24 hours)</li>
            <li>Return here after approval to create your pool</li>
            </ol>

            <div class="info-box">
            <strong>Pool Manager Role Benefits:</strong>
            <ul>
            <li>Create and configure mining pools</li>
            <li>Manage FROST multisig governance</li>
            <li>Configure reward distribution</li>
            <li>Monitor pool performance</li>
            </ul>
            </div>
            </div>

            <div class="error-actions">
            <button class="btn btn-primary" onclick="poolCreator.requestPoolManagerRole()">
            Request Pool Manager Role
            </button>
            <button class="btn btn-outline" onclick="showSection('dashboard')">
            Back to Dashboard
            </button>
            </div>
            </div>
            `;
        } else {
            container.innerHTML = `
            <div class="initialization-error">
            <div class="error-icon">⚠️</div>
            <h3>Pool Creator Initialization Failed</h3>
            <p class="error-message">${error.message}</p>

            <div class="error-details">
            <h4>Possible Solutions:</h4>
            <ul>
            <li>Ensure your wallet is connected</li>
            <li>Verify you have the required authorization</li>
            <li>Check that all smart contracts are deployed</li>
            <li>Refresh the page and try again</li>
            </ul>
            </div>

            <div class="error-actions">
            <button class="btn btn-primary" onclick="poolCreator.initialize()">
            Retry Initialization
            </button>
            <button class="btn btn-outline" onclick="showSection('dashboard')">
            Back to Dashboard
            </button>
            </div>
            </div>
            `;
        }
    }

    async createSingleOwnerPool() {
        console.log('Creating single-owner pool');

        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();

        const factory = contracts.getContract('factory');
        if (!factory) {
            throw new Error('Factory contract not available');
        }

        const factoryWithSigner = factory.connect(signer);

        // Build pool parameters struct
        const params = this.buildPoolParams();

        console.log('Single-owner pool parameters:', params);

        const gasLimit = 5000000;
        console.log('Using safe gas limit:', gasLimit);

        const tx = await factoryWithSigner.createPool(params, { gasLimit });

        console.log('Transaction sent:', tx.hash);
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt);

        // Extract pool addresses from events
        const poolCreatedEvent = receipt.events?.find(e => e.event === 'PoolCreated');
        if (!poolCreatedEvent) {
            throw new Error('PoolCreated event not found in transaction receipt');
        }

        const result = {
            type: 'single',
            poolId: this.poolData.poolId,
            txHash: receipt.transactionHash,
            addresses: {
                core: poolCreatedEvent.args.poolCore || poolCreatedEvent.args[0],
                mpToken: poolCreatedEvent.args.mpToken || poolCreatedEvent.args[1]
            },
            owner: wallet.account
        };

        console.log('Single-owner pool creation result:', result);
        return result;
    }

    async requestPoolManagerRole() {
        try {
            if (!window.requests) {
                throw new Error('Request system not available');
            }

            const message = 'I need Pool Manager role to create and manage mining pools. I understand the responsibilities and would like to request access.';
            const success = await requests.submitRoleRequest('pool_manager', message);

            if (success) {
                if (window.app && app.showNotification) {
                    app.showNotification('success', 'Pool Manager role request submitted!');
                }

                // ИСПРАВЛЕНО: сначала переходим в секцию, потом переключаем таб
                showSection('nftCollection');

                // Даём время на инициализацию секции
                setTimeout(() => {
                    if (window.nftCollection && window.nftCollection.switchTab) {
                        nftCollection.switchTab('outgoing');
                    }
                }, 500);
            }

        } catch (error) {
            console.error('Failed to request Pool Manager role:', error);
            if (window.app && app.showNotification) {
                app.showNotification('error', `Failed to submit request: ${error.message}`);
            }
        }
    }

    // Utility and reset methods
    createAnotherPool() {
        this.reset();
        if (window.app && app.showNotification) {
            app.showNotification('info', 'Ready to create another pool');
        }
    }

    downloadPoolInfo() {
        const poolInfo = {
            name: this.poolData.name,
            symbol: this.poolData.symbol,
            governanceType: this.poolData.governanceType,
            frostSession: this.selectedFrostSession?.id,
            createdAt: new Date().toISOString()
        };

        const dataStr = JSON.stringify(poolInfo, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${this.poolData.name.replace(/\s+/g, '_')}_pool_info.json`;
        link.click();

        if (window.app && app.showNotification) {
            app.showNotification('success', 'Pool information downloaded');
        }
    }

    reset() {
        this.currentStep = 1;
        this.poolData = {};
        this.selectedFrostSession = null;
        this.poolCreationInProgress = false;

        // Reset step validation
        this.stepValidation = {
            1: false,
            2: false,
            3: false,
            4: false
        };

        // Rebuild interface
        this.buildPoolCreatorInterface();

        console.log('PoolCreator reset to initial state');
    }

    destroy() {
        this.initialized = false;
        this.availableFrostSessions = [];

        // Clear container
        const container = document.getElementById('poolCreationContent');
        if (container) {
            container.innerHTML = '';
        }

        console.log('PoolCreator destroyed');
    }
}

window.PoolCreatorAPI = {
    async checkApiHealth() {
        try {
            const healthUrl = CONFIG.API.getMiningUrl('HEALTH');
            const response = await fetch(healthUrl, {
                method: 'GET',
                timeout: 5000
            });
            return response.ok;
        } catch (error) {
            console.error('API health check failed:', error);
            return false;
        }
    },

    getSafeUrl(endpoint) {
        if (!CONFIG.API.ENDPOINTS[endpoint]) {
            console.error(`Unknown endpoint: ${endpoint}`);
            return null;
        }
        return CONFIG.API.getMiningUrl(endpoint);
    },

    logApiCall(method, url, success, error = null) {
        console.log(`API Call: ${method} ${url} - ${success ? 'SUCCESS' : 'FAILED'}`, error);
    }
};

// Global instance
window.poolCreator = new PoolCreator();
