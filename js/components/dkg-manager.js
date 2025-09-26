// js/components/dkg-manager.js - DKG Manager with phase control logic
class DKGManager {
    constructor() {
        this.currentSessions = [];
        this.activeSession = null;
        this.initialized = false;
        this.sessionsCache = new Map();
        this.participantsAuthStatus = new Map();
    }

    async initialize() {
        if (this.initialized) return;
        await this.buildDKGInterface();
        await this.loadUserSessions();
        this.initialized = true;
    }

    buildDKGInterface() {
        const container = document.getElementById('dkgManagementContent');
        if (!container) return;

        container.innerHTML = `
        <div class="dkg-management-header">
        <h2>DKG Session Management</h2>
        <p>Create and manage FROST Distributed Key Generation sessions</p>
        </div>

        <div class="dkg-actions">
        <button id="createNewDKG" class="btn btn-primary">Create New DKG Session</button>
        <button id="loadDKGSession" class="btn btn-secondary">Load Existing Session</button>
        <button id="refreshSessions" class="btn btn-outline">Refresh</button>
        </div>

        <div class="dkg-sessions-list" id="dkgSessionsList">
        <div class="loading">Loading your DKG sessions...</div>
        </div>

        <div class="dkg-session-details" id="dkgSessionDetails">
        <!-- Active session details will be shown here -->
        </div>
        `;

        this.bindDKGEvents();
    }

    bindDKGEvents() {
        document.getElementById('createNewDKG')?.addEventListener('click', () => {
            this.showCreateDKGModal();
        });

        document.getElementById('loadDKGSession')?.addEventListener('click', () => {
            this.showLoadDKGModal();
        });

        document.getElementById('refreshSessions')?.addEventListener('click', () => {
            this.refreshSessions();
        });
    }

    // ========== MAIN DKG PROTOCOL FUNCTIONS ==========

    async createDKGSession(participants) {
        try {
            const threshold = parseInt(document.getElementById('dkgThreshold')?.value) || 2;
            const deadlineHours = parseInt(document.getElementById('dkgDeadline')?.value) || 24;
            const sessionName = document.getElementById('dkgSessionName')?.value || 'Unnamed Session';

            if (participants.length < 2) {
                app.showNotification('error', 'At least 2 participants required for DKG');
                return;
            }

            if (threshold > participants.length) {
                app.showNotification('error', 'Threshold cannot exceed number of participants');
                return;
            }

            app.showLoading('Creating DKG session...');

            const deadline = Math.floor(Date.now() / 1000) + (deadlineHours * 3600);
            const frost = contracts.getContract('frostCoordinator');
            if (!frost) {
                throw new Error('FrostCoordinator contract not available');
            }

            const groupPubkey = '0x0000000000000000000000000000000000000000000000000000000000000000';
            const enforceSharesCheck = true;
            const verifierOverride = ethers.constants.AddressZero;
            const purpose = CONFIG.FROST_PURPOSES.DKG;

            const origin = {
                originContract: ethers.constants.AddressZero,
                originId: 0,
                networkId: 1155,
                poolId: ethers.constants.HashZero
            };

            const tx = await frost.createSession(
                groupPubkey,
                participants,
                threshold,
                deadline,
                enforceSharesCheck,
                verifierOverride,
                purpose,
                origin
            );

            const receipt = await tx.wait();
            const sessionId = this.extractSessionIdFromReceipt(receipt);

            if (sessionId) {
                const sessionData = {
                    id: sessionId,
                    name: sessionName,
                    participants,
                    threshold,
                    deadline,
                    creator: wallet.account,
                    state: 1, // OPENED
                    created: Date.now(),
                    authorizationChecked: false,
                    allParticipantsAuthorized: false
                };

                this.sessionsCache.set(sessionId, sessionData);
                document.querySelector('.modal-overlay')?.remove();
                app.hideLoading();
                app.showNotification('success', `DKG session created: ${sessionId}`);

                await this.loadUserSessions();
                this.selectSession(sessionId);
            } else {
                throw new Error('Failed to get session ID from transaction');
            }

        } catch (error) {
            app.hideLoading();
            console.error('DKG creation error:', error);
            app.showNotification('error', `Failed to create DKG: ${error.message}`);
        }
    }

    // ========== PHASE LOGIC CONTROL ==========

    async canSubmitShare(sessionId) {
        try {
            const frost = contracts.getContract('frostCoordinator');
            const hasCommitted = await frost.hasCommitted(sessionId, wallet.account);
            const hasSubmittedShare = await frost.hasSubmittedShare(sessionId, wallet.account);
            const isParticipant = await frost.isParticipant(sessionId, wallet.account);
            const session = await frost.getSession(sessionId);

            // FIXED: using .toNumber() for BigNumber
            return isParticipant && hasCommitted && !hasSubmittedShare && session.state.toNumber() === 1; // OPENED
        } catch (error) {
            console.error('Error checking share status:', error);
            return false;
        }
    }

    async canSubmitCommitment(sessionId) {
        try {
            const frost = contracts.getContract('frostCoordinator');
            const hasCommitted = await frost.hasCommitted(sessionId, wallet.account);
            const isParticipant = await frost.isParticipant(sessionId, wallet.account);
            const session = await frost.getSession(sessionId);

            // FIXED: using .toNumber() for BigNumber
            return isParticipant && !hasCommitted && session.state.toNumber() === 1; // OPENED
        } catch (error) {
            console.error('Error checking commitment status:', error);
            return false;
        }
    }

    async canCreatePool(sessionId) {
        try {
            const frost = contracts.getContract('frostCoordinator');
            const session = await frost.getSession(sessionId);
            const isParticipant = await frost.isParticipant(sessionId, wallet.account);

            // FIXED: using .toNumber() for BigNumber
            return session.state.toNumber() === 2 && isParticipant; // FINALIZED + participant
        } catch (error) {
            console.error('Error checking pool creation status:', error);
            return false;
        }
    }

    // ========== DKG PROTOCOL ACTIONS ==========

    async submitCommitment() {
        try {
            if (!this.activeSession) {
                throw new Error('No active session');
            }

            const canSubmit = await this.canSubmitCommitment(this.activeSession.id);
            if (!canSubmit) {
                app.showNotification('error', 'Cannot submit commitment at this time');
                return;
            }

            app.showLoading('Submitting commitment...');

            const frost = contracts.getContract('frostCoordinator');
            const commitment = ethers.utils.randomBytes(32);
            const commitmentHash = ethers.utils.keccak256(commitment);

            const tx = await frost.submitNonceCommit(this.activeSession.id, commitmentHash);
            await tx.wait();

            app.hideLoading();
            app.showNotification('success', 'Commitment submitted successfully');
            await this.refreshActiveSession();

        } catch (error) {
            app.hideLoading();
            console.error('Commitment submission failed:', error);
            app.showNotification('error', `Failed to submit commitment: ${error.message}`);
        }
    }

    async submitShare() {
        try {
            if (!this.activeSession) {
                throw new Error('No active session');
            }

            const canSubmit = await this.canSubmitShare(this.activeSession.id);
            if (!canSubmit) {
                app.showNotification('error', 'Must submit commitment first');
                return;
            }

            app.showLoading('Submitting shares...');

            const frost = contracts.getContract('frostCoordinator');

            for (const participant of this.activeSession.participants) {
                if (participant.toLowerCase() !== wallet.account.toLowerCase()) {
                    const mockShare = ethers.utils.randomBytes(64);
                    const tx = await frost.submitDKGShare(
                        this.activeSession.id,
                        participant,
                        mockShare
                    );
                    await tx.wait();
                }
            }

            app.hideLoading();
            app.showNotification('success', 'Shares submitted successfully');
            await this.refreshActiveSession();

        } catch (error) {
            app.hideLoading();
            console.error('Share submission failed:', error);
            app.showNotification('error', `Failed to submit share: ${error.message}`);
        }
    }

    async finalizeDKG() {
        try {
            app.showLoading('Finalizing DKG...');

            const frost = contracts.getContract('frostCoordinator');
            const groupPubKey = await this.computeGroupPublicKey();

            if (!groupPubKey) {
                throw new Error('Failed to compute group public key');
            }

            const tx = await frost.finalizeDKG(this.activeSession.id, groupPubKey);
            await tx.wait();

            this.activeSession.state = 2; // FINALIZED
            this.activeSession.groupPubkey = groupPubKey;
            this.activeSession.finalizedAt = Date.now();

            app.hideLoading();
            app.showNotification('success', 'DKG finalized successfully!');
            this.renderSessionDetails();

        } catch (error) {
            app.hideLoading();
            console.error('Finalize DKG error:', error);
            app.showNotification('error', `Failed to finalize DKG: ${error.message}`);
        }
    }

    // ========== LOADING AND SESSION MANAGEMENT ==========

    async loadUserSessions() {
        console.log('Loading user sessions for:', wallet.account);

        try {
            const frostContract = contracts.getContract('frostCoordinator');
            if (!frostContract) {
                console.error('FrostCoordinator contract not available');
                this.renderEmptySessionsList();
                return;
            }

            const contractWithSigner = frostContract.connect(wallet.provider.getSigner());
            let userSessionIds = [];

            try {
                const count = await contractWithSigner.getUserSessionCount(wallet.account);
                const sessionCount = count.toNumber();

                if (sessionCount > 0) {
                    const sessions = await contractWithSigner.getUserSessions(wallet.account);
                    userSessionIds = sessions.map(id => id.toString());
                }
            } catch (countError) {
                console.log('getUserSessionCount failed, trying alternative approach');
            }

            this.userSessions = userSessionIds;

            if (this.userSessions.length > 0) {
                await this.loadSessionDetails();
            }

            this.renderSessionsList();

        } catch (error) {
            console.error('Error in loadUserSessions:', error);
            this.renderEmptySessionsList();
        }
    }

    async loadSessionDetails() {
        try {
            const frostContract = contracts.getContract('frostCoordinator');
            if (!frostContract) return;

            const contractWithSigner = frostContract.connect(wallet.provider.getSigner());

            for (const sessionId of this.userSessions) {
                try {
                    const sessionInfo = await contractWithSigner.getSession(sessionId);
                    const participants = await contractWithSigner.getSessionParticipants(sessionId);

                    const sessionData = {
                        id: sessionId,
                        name: `Session ${sessionId}`,
                        participants: participants,
                        threshold: sessionInfo.threshold.toNumber(),
                        creator: sessionInfo.creator,
                        state: sessionInfo.state.toNumber(),
                        deadline: sessionInfo.deadline.toNumber(),
                        groupPubkey: sessionInfo.groupPubkey && sessionInfo.groupPubkey !== '0x' ?
                        sessionInfo.groupPubkey : null,
                        authorizationChecked: false,
                        allParticipantsAuthorized: false
                    };

                    this.sessionsCache.set(sessionId, sessionData);

                } catch (sessionError) {
                    console.log(`Failed to load session ${sessionId}:`, sessionError.message);
                }
            }

        } catch (error) {
            console.error('Error loading session details:', error);
        }
    }

    async selectSession(sessionId) {
        try {
            app.showLoading('Loading session details...');

            let sessionData = this.sessionsCache.get(sessionId);

            if (!sessionData) {
                const frost = contracts.getContract('frostCoordinator');
                const sessionInfo = await frost.getSession(sessionId);
                const participants = await frost.getSessionParticipants(sessionId);

                sessionData = {
                    id: sessionId,
                    name: `Session ${sessionId.slice(0, 8)}...`,
                    participants,
                    threshold: sessionInfo.threshold.toNumber(),
                    creator: sessionInfo.creator,
                    state: sessionInfo.state.toNumber(),
                    deadline: sessionInfo.deadline.toNumber(),
                    groupPubkey: sessionInfo.groupPubkey && sessionInfo.groupPubkey.length > 2 ?
                    sessionInfo.groupPubkey : null,
                    authorizationChecked: false,
                    allParticipantsAuthorized: false
                };

                this.sessionsCache.set(sessionId, sessionData);
            }

            this.activeSession = sessionData;
            this.renderSessionDetails();
            app.hideLoading();

        } catch (error) {
            app.hideLoading();
            console.error('Error loading session:', error);
            app.showNotification('error', 'Failed to load session details');
        }
    }

    async refreshActiveSession() {
        if (!this.activeSession) return;

        try {
            const frost = contracts.getContract('frostCoordinator');
            const sessionInfo = await frost.getSession(this.activeSession.id);

            this.activeSession.state = sessionInfo.state.toNumber();
            this.activeSession.commitsCount = sessionInfo.commitsCount.toNumber();
            this.activeSession.sharesCount = sessionInfo.sharesCount.toNumber();

            this.sessionsCache.set(this.activeSession.id, this.activeSession);
            this.renderSessionDetails();
            this.renderSessionsList();

        } catch (error) {
            console.error('Failed to refresh session:', error);
        }
    }

    // ========== GROUP ROLE REQUESTS ==========

    async requestGroupPoolManagerRole(sessionId) {
        try {
            const session = this.sessionsCache.get(sessionId);
            if (!session || session.state !== 2) {
                throw new Error('Session must be finalized');
            }

            // ИСПРАВЛЕНО: проверяем существующие запросы для этой сессии
            if (session.requestPending || session.authorizationChecked) {
                app.showNotification('info', 'Group request already submitted for this DKG session');
                return;
            }

            // Проверяем есть ли уже запросы для этой сессии в API
            try {
                const checkResponse = await fetch(`${CONFIG.API.REQUESTS}${CONFIG.API.ENDPOINTS.DKG_REQUESTS}?sessionId=${sessionId}`);
                if (checkResponse.ok) {
                    const existingRequests = await checkResponse.json();
                    if (existingRequests.length > 0) {
                        app.showNotification('info', 'Group request already exists for this DKG session');

                        // Обновляем статус сессии
                        session.authorizationChecked = true;
                        session.requestPending = true;
                        session.requestId = existingRequests[0].request_id;
                        this.sessionsCache.set(sessionId, session);
                        this.renderSessionDetails();
                        return;
                    }
                }
            } catch (checkError) {
                console.warn('Failed to check existing requests:', checkError);
            }

            app.showLoading('Checking participant statuses...');

            const participantStatuses = await this.checkParticipantStatuses(session.participants);
            const needRoles = participantStatuses.filter(p => !p.hasPoolManagerRole);

            if (needRoles.length === 0) {
                app.hideLoading();
                app.showNotification('success', 'All participants already have Pool Manager roles');
                session.allParticipantsAuthorized = true;
                this.sessionsCache.set(sessionId, session);
                this.renderSessionDetails();
                return;
            }

            const requestData = {
                sessionId: sessionId,
                userAddress: wallet.account,
                participants: session.participants,
                threshold: session.threshold,
                message: `DKG Session ${sessionId} completed. Request Pool Manager roles for all ${session.participants.length} participants.`
            };

            app.showLoading('Submitting DKG group request...');

            const response = await fetch(`${CONFIG.API.REQUESTS}${CONFIG.API.ENDPOINTS.DKG_REQUESTS}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            app.hideLoading();

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));

                // Проверяем если это ошибка дубликата (409)
                if (response.status === 409) {
                    app.showNotification('info', errorData.message || 'Request already exists for this session');

                    // Обновляем статус сессии
                    session.authorizationChecked = true;
                    session.requestPending = true;
                    if (errorData.existingRequestId) {
                        session.requestId = errorData.existingRequestId;
                    }
                    this.sessionsCache.set(sessionId, session);
                    this.renderSessionDetails();
                    return;
                }

                throw new Error(`Request failed: ${response.status} - ${errorData.error}`);
            }

            const result = await response.json();
            console.log('DKG request result:', result);

            app.showNotification('success', `DKG group request submitted successfully (ID: ${result.requestId})`);

            // Обновляем сессию
            session.authorizationChecked = true;
            session.requestPending = true;
            session.requestId = result.requestId;
            this.sessionsCache.set(sessionId, session);
            this.renderSessionDetails();

        } catch (error) {
            app.hideLoading();
            console.error('DKG group request failed:', error);
            app.showNotification('error', `Failed to submit DKG request: ${error.message}`);
        }
    }

    async checkParticipantStatuses(participants) {
        const results = [];

        for (const participant of participants) {
            try {
                const hasRole = await this.checkPoolManagerRole(participant);
                results.push({
                    address: participant,
                    hasPoolManagerRole: hasRole
                });
            } catch (error) {
                results.push({
                    address: participant,
                    hasPoolManagerRole: false
                });
            }
        }

        return results;
    }

    async checkPoolManagerRole(address) {
        try {
            const factory = contracts.getContract('factory');
            const POOL_MANAGER_ROLE = await factory.POOL_MANAGER_ROLE();
            return await factory.hasRole(POOL_MANAGER_ROLE, address);
        } catch (error) {
            return false;
        }
    }

    // ========== HELPER FUNCTIONS ==========

    extractSessionIdFromReceipt(receipt) {
        try {
            const frost = contracts.getContract('frostCoordinator');
            const sessionCreatedTopic = frost.interface.getEventTopic('SessionCreated');

            for (const log of receipt.logs) {
                if (log.topics[0] === sessionCreatedTopic) {
                    const decoded = frost.interface.parseLog(log);
                    return decoded.args.sessionId.toString();
                }
            }
            return null;
        } catch (error) {
            console.error('Error extracting session ID:', error);
            return null;
        }
    }

    async computeGroupPublicKey() {
        try {
            const keyMaterial = ethers.utils.defaultAbiCoder.encode(
                ['uint256', 'address[]', 'uint256'],
                [
                    this.activeSession.id,
                    this.activeSession.participants,
                    this.activeSession.threshold
                ]
            );

            const keyHash = ethers.utils.keccak256(keyMaterial);
            const deterministicWallet = new ethers.Wallet(keyHash);
            const uncompressedKey = deterministicWallet.publicKey;

            const xCoord = uncompressedKey.slice(4, 68);
            const yCoord = uncompressedKey.slice(68, 132);
            const yBigInt = BigInt('0x' + yCoord);
            const prefix = (yBigInt % 2n === 0n) ? '02' : '03';

            return '0x' + prefix + xCoord;

        } catch (error) {
            console.error('Failed to compute group public key:', error);
            return null;
        }
    }

    // ========== UI RENDERING ==========

    renderSessionsList() {
        const container = document.getElementById('dkgSessionsList');
        if (!container) return;

        const sessions = Array.from(this.sessionsCache.values());

        if (sessions.length === 0) {
            this.showEmptyState('No DKG sessions found. Create your first session!');
            return;
        }

        const activeSessions = sessions.filter(s => s.state < 2);
        const completedSessions = sessions.filter(s => s.state >= 2);

        container.innerHTML = `
        ${activeSessions.length > 0 ? `
            <h3>Active DKG Sessions (${activeSessions.length})</h3>
            <div class="sessions-grid active">
            ${activeSessions.map(session => this.renderSessionCard(session)).join('')}
            </div>
            ` : ''}

            ${completedSessions.length > 0 ? `
                <h3>Completed DKG Sessions (${completedSessions.length})</h3>
                <div class="sessions-grid completed">
                ${completedSessions.map(session => this.renderSessionCard(session)).join('')}
                </div>
                ` : ''}
                `;

                this.bindSessionCardEvents();
    }

    renderSessionCard(session) {
        const state = parseInt(session.state) || 0;
        const stateText = this.getDKGStateText(state);
        const stateClass = this.getDKGStateClass(state);
        const isFinalized = state >= 2;

        return `
        <div class="session-card ${stateClass}" data-session-id="${session.id}">
        <div class="session-header">
        <h4>${session.name}</h4>
        <span class="session-state ${stateClass}">${stateText}</span>
        </div>
        <div class="session-info">
        <div class="session-detail">
        <span class="label">Session ID:</span>
        <span class="value session-id">${session.id.slice(0, 20)}...</span>
        </div>
        <div class="session-detail">
        <span class="label">Participants:</span>
        <span class="value">${session.participants.length}</span>
        </div>
        <div class="session-detail">
        <span class="label">Threshold:</span>
        <span class="value">${session.threshold}</span>
        </div>
        <div class="session-detail">
        <span class="label">Creator:</span>
        <span class="value">${wallet.formatAddress(session.creator)}</span>
        </div>
        </div>

        ${isFinalized && session.allParticipantsAuthorized ? `
            <div class="session-ready">
            <span class="icon">✅</span>
            Ready for Pool Creation
            </div>
            ` : ''}

            <div class="session-actions">
            <button class="manage-session-btn btn btn-sm btn-primary" data-session-id="${session.id}">
            ${isFinalized ? 'View Details' : 'Manage DKG'}
            </button>
            </div>
            </div>
            `;
    }

    async renderSessionDetails() {
        const container = document.getElementById('dkgSessionDetails');
        if (!container || !this.activeSession) return;

        container.className = 'dkg-session-details active';
        const session = this.activeSession;

        container.innerHTML = `
        <div class="session-details-header">
        <h3>DKG Session: ${session.name}</h3>
        <div class="session-status">
        Current State: ${this.getDKGStateText(session.state)}
        </div>
        </div>

        <div class="session-details-content">
        <div class="session-info-grid">
        <div class="info-item">
        <label>Session ID:</label>
        <input type="text" readonly value="${session.id}" class="form-input" onclick="this.select(); navigator.clipboard.writeText(this.value);">
        </div>
        <div class="info-item">
        <label>Participants:</label>
        <span>${session.participants.length}</span>
        </div>
        <div class="info-item">
        <label>Threshold:</label>
        <span>${session.threshold}</span>
        </div>
        <div class="info-item">
        <label>Creator:</label>
        <span>${wallet.formatAddress(session.creator)}</span>
        </div>
        </div>

        ${await this.renderDKGActionsOrStatus()}
        ${this.renderParticipantsList()}
        </div>
        `;

        setTimeout(() => this.bindDKGActionEvents(), 100);
    }

    async renderDKGActionsOrStatus() {
        const session = this.activeSession;
        const isFinalized = session.state >= 2;

        if (isFinalized) {
            return await this.renderFinalizedSessionStatus();
        } else {
            return await this.renderDKGActions();
        }
    }

    async renderFinalizedSessionStatus() {
        const session = this.activeSession;

        if (session.allParticipantsAuthorized) {
            return `
            <div class="dkg-finalized-section ready">
            <h4>✅ DKG Complete & Ready for Pool Creation</h4>
            <p>This session is finalized and all participants are authorized for pool creation.</p>

            ${session.groupPubkey ? `
                <div class="finalized-info">
                <div class="pubkey-display">
                <label>Group Public Key:</label>
                <input type="text" readonly value="${session.groupPubkey}"
                class="form-input" onclick="this.select(); navigator.clipboard.writeText(this.value);">
                </div>
                </div>
                ` : ''}

                <div class="action-buttons">
                <button onclick="showSection('poolCreation')" class="btn btn-primary">
                Create Pool with this DKG
                </button>
                <button onclick="navigator.clipboard.writeText('${session.id}')" class="btn btn-secondary">
                Copy Session ID
                </button>
                </div>
                </div>
                `;
        } else if (session.requestPending) {
            return `
            <div class="dkg-finalized-section pending">
            <h4>⏳ Waiting for Authorization</h4>
            <p>DKG is complete, waiting for admin to approve participant roles.</p>

            <div class="action-buttons">
            <button onclick="dkgManager.checkGroupRequestStatus('${session.id}')" class="btn btn-primary">
            Check Status
            </button>
            </div>
            </div>
            `;
        } else {
            return `
            <div class="dkg-finalized-section">
            <h4>✅ DKG Session Complete</h4>
            <p>Ready to request Pool Manager roles for all participants.</p>

            <div class="action-buttons">
            <button onclick="dkgManager.requestGroupPoolManagerRole('${session.id}')" class="btn btn-primary">
            Request Pool Manager Roles
            </button>
            </div>
            </div>
            `;
        }
    }

    async renderDKGActions() {
        const session = this.activeSession;
        const canCommit = await this.canSubmitCommitment(session.id);
        const canShare = await this.canSubmitShare(session.id);

        // FIXED: getting actual data from contract
        const frost = contracts.getContract('frostCoordinator');
        const sessionInfo = await frost.getSession(session.id);
        const commitsCount = sessionInfo.commitsCount.toNumber();
        const sharesCount = sessionInfo.sharesCount.toNumber();
        const dkgSharesCount = sessionInfo.dkgSharesCount.toNumber();

        return `
        <div class="dkg-actions-section">
        <h4>DKG Protocol Actions</h4>
        <p>Complete the DKG protocol by submitting commitment, then shares.</p>

        <div class="action-buttons">
        <button class="dkg-action-btn btn btn-primary" data-action="commitment" ${!canCommit ? 'disabled' : ''}>
        ${canCommit ? 'Submit Commitment' : '✓ Commitment Sent'}
        </button>
        <button class="dkg-action-btn btn btn-primary" data-action="share" ${!canShare ? 'disabled' : ''}>
        ${canShare ? 'Submit Share' : (commitsCount > 0 ? '✓ Share Sent' : 'Submit Commitment First')}
        </button>
        <button class="dkg-action-btn btn btn-success" data-action="finalize-session">
        Finalize DKG Session
        </button>
        </div>

        <div class="session-progress">
        <p>Commits: ${commitsCount} | DKG Shares: ${dkgSharesCount} | Required: ${session.participants.length * (session.participants.length - 1)}</p>
        </div>
        </div>
        `;
    }

    renderParticipantsList() {
        return `
        <div class="participants-section">
        <h4>Participants</h4>
        <div class="participants-list">
        ${this.activeSession.participants.map((participant, index) => `
            <div class="participant-item ${participant === wallet.account ? 'current-user' : ''}">
            <span>${wallet.formatAddress(participant)} ${participant === this.activeSession.creator ? '(Creator)' : '(Member)'} ${participant === wallet.account ? '(You)' : ''}</span>
            </div>
            `).join('')}
            </div>
            </div>
            `;
    }

    bindDKGActionEvents() {
        document.querySelectorAll('.dkg-action-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                const action = e.target.getAttribute('data-action');

                switch (action) {
                    case 'commitment':
                        await this.submitCommitment();
                        break;
                    case 'share':
                        await this.submitShare();
                        break;
                    case 'finalize-session':
                        await this.finalizeDKG();
                        break;
                    default:
                        console.log('Unknown DKG action:', action);
                }
            });
        });
    }

    bindSessionCardEvents() {
        document.querySelectorAll('.manage-session-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const sessionId = e.target.getAttribute('data-session-id');
                this.selectSession(sessionId);
            });
        });

        document.querySelectorAll('.session-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('manage-session-btn')) {
                    const sessionId = card.getAttribute('data-session-id');
                    this.selectSession(sessionId);
                }
            });
        });
    }

    // ========== MODAL WINDOWS AND UTILITIES ==========

    showCreateDKGModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content dkg-create-modal">
        <div class="modal-header">
        <h3>Create New DKG Session</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
        <div class="form-group">
        <label>Session Name:</label>
        <input type="text" id="dkgSessionName" class="form-input" placeholder="Enter session name" value="DKG Session ${Date.now()}">
        </div>

        <div class="form-group">
        <label>Participants (one address per line):</label>
        <textarea id="dkgParticipants" class="form-textarea" rows="5" placeholder="0x1234...&#10;0x5678...&#10;0x9abc...">${wallet.account}&#10;</textarea>
        <small>Include your own address and at least one other participant</small>
        </div>

        <div class="form-row">
        <div class="form-group">
        <label>Threshold:</label>
        <input type="number" id="dkgThreshold" class="form-input" min="1" value="2">
        </div>
        <div class="form-group">
        <label>Deadline (hours):</label>
        <input type="number" id="dkgDeadline" class="form-input" min="1" max="168" value="24">
        </div>
        </div>
        </div>
        <div class="modal-actions">
        <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Cancel</button>
        <button onclick="dkgManager.submitCreateDKG()" class="btn btn-primary">Create DKG Session</button>
        </div>
        </div>
        `;

        document.body.appendChild(modal);
    }

    async submitCreateDKG() {
        try {
            const sessionName = document.getElementById('dkgSessionName').value.trim();
            const participantsText = document.getElementById('dkgParticipants').value.trim();
            const threshold = parseInt(document.getElementById('dkgThreshold').value);

            const participants = participantsText
            .split('\n')
            .map(addr => addr.trim())
            .filter(addr => addr.length > 0 && ethers.utils.isAddress(addr));

            if (!sessionName) {
                app.showNotification('error', 'Please enter a session name');
                return;
            }

            if (participants.length < 2) {
                app.showNotification('error', 'At least 2 valid participants required');
                return;
            }

            if (threshold > participants.length) {
                app.showNotification('error', 'Threshold cannot exceed number of participants');
                return;
            }

            document.querySelector('.modal-overlay').remove();
            await this.createDKGSession(participants);

        } catch (error) {
            console.error('Error submitting DKG creation:', error);
            app.showNotification('error', `Failed to create DKG: ${error.message}`);
        }
    }

    showLoadDKGModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
        <div class="modal-content">
        <div class="modal-header">
        <h3>Load Existing DKG Session</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
        <div class="form-group">
        <label>Session ID:</label>
        <input type="text" id="loadSessionId" class="form-input" placeholder="Enter session ID">
        </div>
        </div>
        <div class="modal-actions">
        <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">Cancel</button>
        <button onclick="dkgManager.loadExistingSession()" class="btn btn-primary">Load Session</button>
        </div>
        </div>
        `;

        document.body.appendChild(modal);
    }

    async loadExistingSession() {
        try {
            const sessionId = document.getElementById('loadSessionId').value.trim();
            if (!sessionId) {
                app.showNotification('error', 'Please enter a session ID');
                return;
            }

            document.querySelector('.modal-overlay').remove();
            await this.selectSession(sessionId);

        } catch (error) {
            console.error('Error loading session:', error);
            app.showNotification('error', `Failed to load session: ${error.message}`);
        }
    }

    showEmptyState(message) {
        const container = document.getElementById('dkgSessionsList');
        if (container) {
            container.innerHTML = `
            <div class="empty-state">
            <h3>No DKG Sessions Found</h3>
            <p>${message}</p>
            <div class="empty-actions">
            <button onclick="dkgManager.showCreateDKGModal()" class="btn btn-primary">Create New DKG Session</button>
            <button onclick="dkgManager.refreshSessions()" class="btn btn-outline">Refresh</button>
            </div>
            </div>
            `;
        }
    }

    renderEmptySessionsList() {
        this.showEmptyState('No DKG sessions found. Create your first session!');
    }

    async refreshSessions() {
        console.log('Refreshing DKG sessions...');
        await this.loadUserSessions();
        app.showNotification('success', 'Sessions refreshed');
    }

    getDKGStateText(state) {
        const numState = parseInt(state) || 0;
        const states = ['None', 'Opened', 'Finalized', 'Aborted'];
        return states[numState] || 'Unknown';
    }

    getDKGStateClass(state) {
        const numState = parseInt(state) || 0;
        switch (numState) {
            case 1: return 'state-opened';
            case 2: return 'state-finalized';
            case 3: return 'state-aborted';
            default: return 'state-unknown';
        }
    }

    async checkGroupRequestStatus(sessionId) {
        try {
            // Check status through new API
            const response = await fetch(`${CONFIG.API.REQUESTS}${CONFIG.API.ENDPOINTS.DKG_REQUESTS}?sessionId=${sessionId}`);

            if (response.ok) {
                const requests = await response.json();
                const sessionRequest = requests.find(req => req.session_id === sessionId);

                if (sessionRequest) {
                    if (sessionRequest.status === 'approved') {
                        // Re-check participant roles
                        const session = this.sessionsCache.get(sessionId);
                        const participantStatuses = await this.checkParticipantStatuses(session.participants);
                        const allAuthorized = participantStatuses.every(p => p.hasPoolManagerRole);

                        if (allAuthorized) {
                            session.allParticipantsAuthorized = true;
                            session.requestPending = false;
                            this.sessionsCache.set(sessionId, session);

                            app.showNotification('success', 'All participants now have Pool Manager roles!');
                            this.renderSessionDetails();
                            return;
                        }
                    } else if (sessionRequest.status === 'rejected') {
                        app.showNotification('error', 'DKG group request was rejected by admin');
                        return;
                    }
                }
            }

            app.showNotification('info', 'Request still pending admin review');

        } catch (error) {
            console.error('Error checking group request status:', error);
            app.showNotification('error', 'Failed to check authorization status');
        }
    }
}

// Global instance
window.dkgManager = new DKGManager();
