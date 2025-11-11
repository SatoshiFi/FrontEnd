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

            const frost = contracts.getContract('frostCoordinator');
            if (!frost) {
                throw new Error('FrostCoordinator contract not available');
            }

            const frostWithSigner = frost.connect(wallet.provider.getSigner());

            console.log('Creating DKG session with parameters:', {
                threshold,
                participants,
                participantsCount: participants.length
            });

            const tx = await frostWithSigner.createDKGSession(
                threshold,
                participants,
                {
                    gasLimit: CONFIG.GAS_LIMITS.DKG_SESSION_CREATE
                }
            );

            console.log('Transaction sent:', tx.hash);
            app.showLoading('Waiting for confirmation...');

            const receipt = await tx.wait();
            console.log('Transaction confirmed:', receipt);

            if (receipt.status === 0) {
                throw new Error('Transaction reverted. Please check parameters and try again.');
            }

            const sessionId = this.extractSessionIdFromReceipt(receipt);

            if (sessionId) {
                const sessionData = {
                    id: sessionId,
                    name: sessionName,
                    participants,
                    threshold,
                    deadline: Math.floor(Date.now() / 1000) + (deadlineHours * 3600),
                    creator: wallet.account,
                    state: 1,
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

            let errorMessage = 'Failed to create DKG session';

            if (error.message.includes('Transaction reverted')) {
                errorMessage = 'Transaction reverted. Check that all participants are valid addresses.';
            } else if (error.message.includes('user rejected')) {
                errorMessage = 'Transaction rejected by user';
            } else if (error.code === 'CALL_EXCEPTION') {
                errorMessage = 'Smart contract execution failed. Verify all parameters are correct.';
            }

            app.showNotification('error', errorMessage);
        }
    }

    // ========== PHASE LOGIC CONTROL ==========

    async canSubmitCommitment(sessionId) {
        try {
            const frost = contracts.getContract('frostCoordinator');

            // ИСПРАВЛЕНО: используем getSessionDetails для получения правильного state
            const details = await frost.getSessionDetails(sessionId);
            const session = {
                state: details.state // SessionState.PENDING_COMMIT = 1
            };

            const participants = await frost.getSessionParticipants(sessionId);
            const isParticipant = participants.some(p =>
            p.toLowerCase() === wallet.account.toLowerCase()
            );

            const commitment = await frost.getNonceCommitment(sessionId, wallet.account);
            const hasCommitted = commitment !== ethers.constants.HashZero;

            // Проверяем: участник, не отправил коммитмент, сессия в фазе PENDING_COMMIT (1)
            return isParticipant && !hasCommitted && session.state === 1;
        } catch (error) {
            console.error('Error checking commitment status:', error);
            return false;
        }
    }

    async canSubmitShare(sessionId) {
        try {
            const frost = contracts.getContract('frostCoordinator');

            const details = await frost.getSessionDetails(sessionId);
            const stateNum = details.state; // SessionState enum value

            const commitment = await frost.getNonceCommitment(sessionId, wallet.account);
            const hasCommitted = commitment !== ethers.constants.HashZero;

            if (!hasCommitted || stateNum < 2) {
                return false;
            }

            const participants = await frost.getSessionParticipants(sessionId);
            const isParticipant = participants.some(p =>
            p.toLowerCase() === wallet.account.toLowerCase()
            );

            if (!isParticipant) {
                return false;
            }

            let allSharesSent = true;
            for (const participant of participants) {
                if (participant.toLowerCase() !== wallet.account.toLowerCase()) {
                    const share = await frost.getDKGShare(sessionId, wallet.account, participant);
                    if (!share || share === '0x' || share.length === 0) {
                        allSharesSent = false;
                        break;
                    }
                }
            }

            return !allSharesSent;
        } catch (error) {
            console.error('Error checking share status:', error);
            return false;
        }
    }

    async canCreatePool(sessionId) {
        try {
            const frost = contracts.getContract('frostCoordinator');
            const session = await frost.getSession(sessionId);

            // ИСПРАВЛЕНО: проверяем что state === 4 (FINALIZED)
            const isFinalized = session.state.toNumber() === 4;

            const participants = await frost.getSessionParticipants(sessionId);
            const isParticipant = participants.some(p =>
            p.toLowerCase() === wallet.account.toLowerCase()
            );

            return isFinalized && isParticipant;
        } catch (error) {
            console.error('Error checking pool creation status:', error);
            return false;
        }
    }

    // ========== DKG PROTOCOL ACTIONS ==========

    async renderSessionDetails() {
        const container = document.getElementById('dkgSessionDetails');
        if (!container || !this.activeSession) return;

        container.className = 'dkg-session-details active';
        const session = this.activeSession;

        const actionsHTML = await this.renderDKGActionsOrStatus();

        const creatorAddress = session.creator || wallet.account;

        container.innerHTML = `
        <div class="session-details-header">
        <h3>DKG Session: ${session.name || `Session ${session.id}`}</h3>
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
        <span>${wallet.formatAddress(creatorAddress)}</span>
        </div>
        </div>

        ${actionsHTML}
        ${this.renderParticipantsList()}
        </div>
        `;

        this.bindDKGActionEvents();
    }

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
            const frostWithSigner = frost.connect(wallet.provider.getSigner());

            const commitment = ethers.utils.randomBytes(32);
            const commitmentHash = ethers.utils.keccak256(commitment);

            console.log('Submitting commitment:', commitmentHash);

            const tx = await frostWithSigner.publishNonceCommitment(
                this.activeSession.id,
                commitmentHash
            );

            console.log('Transaction sent:', tx.hash);
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
                app.showNotification('error', 'Must submit commitment first or wait for shares phase');
                return;
            }

            app.showLoading('Submitting shares...');

            const frost = contracts.getContract('frostCoordinator');
            const frostWithSigner = frost.connect(wallet.provider.getSigner());

            let successCount = 0;

            for (const participant of this.activeSession.participants) {
                if (participant.toLowerCase() !== wallet.account.toLowerCase()) {
                    try {
                        const existingShare = await frost.getDKGShare(
                            this.activeSession.id,
                            wallet.account,
                            participant
                        );

                        if (existingShare && existingShare !== '0x' && existingShare.length > 0) {
                            console.log(`Share already sent to ${participant}`);
                            successCount++;
                            continue;
                        }

                        const mockShare = ethers.utils.randomBytes(64);

                        console.log(`Submitting share to ${participant}`);

                        const tx = await frostWithSigner.publishEncryptedShare(
                            this.activeSession.id,
                            participant,
                            mockShare
                        );

                        await tx.wait();
                        successCount++;
                        console.log(`Share sent to ${participant}`);

                    } catch (shareError) {
                        console.error(`Failed to send share to ${participant}:`, shareError);
                    }
                }
            }

            app.hideLoading();

            if (successCount === this.activeSession.participants.length - 1) {
                app.showNotification('success', 'All shares submitted successfully');
            } else {
                app.showNotification('warning', `Submitted ${successCount} out of ${this.activeSession.participants.length - 1} shares`);
            }

            await this.refreshActiveSession();

        } catch (error) {
            app.hideLoading();
            console.error('Share submission failed:', error);
            app.showNotification('error', `Failed to submit shares: ${error.message}`);
        }
    }

    async finalizeDKG() {
        try {
            if (!this.activeSession) {
                throw new Error('No active session');
            }

            app.showLoading('Finalizing DKG...');

            const frost = contracts.getContract('frostCoordinator');
            const frostWithSigner = frost.connect(wallet.provider.getSigner());

            if (this.activeSession.creator.toLowerCase() !== wallet.account.toLowerCase()) {
                throw new Error('Only the session creator can finalize DKG');
            }

            console.log('Finalizing DKG session:', this.activeSession.id);

            // Используем точную сигнатуру функции
            const tx = await frostWithSigner['finalizeDKG(uint256)'](this.activeSession.id);

            console.log('Finalization transaction sent:', tx.hash);
            await tx.wait();

            app.hideLoading();
            app.showNotification('success', 'DKG finalized successfully!');

            await this.refreshActiveSession();

        } catch (error) {
            app.hideLoading();
            console.error('Finalize DKG error:', error);
            app.showNotification('error', `Failed to finalize DKG: ${error.message}`);
        }
    }

    async refreshActiveSession() {
        if (!this.activeSession) return;

        try {
            const frost = contracts.getContract('frostCoordinator');
            const sessionInfo = await frost.getSession(this.activeSession.id);
            const details = await frost.getSessionDetails(this.activeSession.id);

            this.activeSession.state = details.state;
            this.activeSession.commitsCount = sessionInfo.commitsCount.toNumber();
            this.activeSession.sharesCount = sessionInfo.sharesCount ? sessionInfo.sharesCount.toNumber() : 0;

            this.sessionsCache.set(this.activeSession.id, this.activeSession);

            await this.renderSessionDetails();
            await this.loadUserSessions();

        } catch (error) {
            console.error('Failed to refresh session:', error);
        }
    }

    getDKGStateText(state) {
        const numState = parseInt(state) || 0;
        const states = ['None', 'Pending Commit', 'Pending Shares', 'Ready', 'Finalized', 'Aborted'];
        return states[numState] || 'Unknown';
    }

    // ========== LOADING AND SESSION MANAGEMENT ==========

    async loadUserSessions() {
        try {
            const container = document.getElementById('dkgSessionsList');
            if (!container) {
                console.error('Sessions container not found');
                return;
            }

            container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
            <div style="width: 40px; height: 40px; margin: 0 auto 20px; border: 4px solid rgba(0,0,0,0.1); border-top-color: #2196F3; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <p>Loading sessions...</p>
            </div>
            `;

            const userAddress = wallet.account;
            console.log('Loading user sessions for:', userAddress);

            const frost = contracts.getContract('frostCoordinator');
            if (!frost) {
                throw new Error('FrostCoordinator contract not available');
            }

            const nextId = await frost.nextSessionId();
            const nextIdNum = nextId.toNumber();
            console.log('Total sessions created:', nextIdNum - 1);

            const userSessions = [];
            const checkCount = Math.min(50, nextIdNum - 1);
            const startId = Math.max(1, nextIdNum - checkCount);

            for (let sessionId = startId; sessionId < nextIdNum; sessionId++) {
                try {
                    const participants = await frost.getSessionParticipants(sessionId);
                    const isParticipant = participants.some(p =>
                    p.toLowerCase() === userAddress.toLowerCase()
                    );

                    if (isParticipant) {
                        const session = await frost.getSession(sessionId);

                        const details = await frost.getSessionDetails(sessionId);
                        const actualState = details.state;

                        userSessions.push({
                            id: sessionId,
                            name: `DKG Session ${sessionId}`,
                            state: actualState,
                            threshold: session.threshold.toNumber(),
                                          totalParticipants: session.total.toNumber(),
                                          creator: details.creator,
                                          participants: participants,
                                          deadline: session.deadline.toNumber(),
                                          commitsCount: session.commitsCount.toNumber(),
                                          sharesCount: session.sharesCount ? session.sharesCount.toNumber() : 0,
                                          dkgSharesCount: session.dkgSharesCount ? session.dkgSharesCount.toNumber() : 0
                        });
                    }
                } catch (error) {
                    console.log(`Skipping session ${sessionId}:`, error.message);
                }
            }

            console.log(`Found ${userSessions.length} sessions for user`);

            if (userSessions.length === 0) {
                container.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: #666;">
                <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">🔐</div>
                <h3 style="color: #333; margin-bottom: 10px;">No DKG Sessions</h3>
                <p style="margin: 5px 0; font-size: 14px;">You haven't participated in any DKG sessions yet.</p>
                <p style="margin: 5px 0; font-size: 14px;">Create a new session to get started.</p>
                </div>
                `;
            } else {
                this.displaySessions(userSessions);
            }

        } catch (error) {
            console.error('Failed to load user sessions:', error);
            const container = document.getElementById('dkgSessionsList');
            if (container) {
                container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #d32f2f;">
                <p>⚠️ Failed to load sessions</p>
                <p style="font-size: 12px; margin-top: 10px;">${error.message}</p>
                </div>
                `;
            }
        }
    }

    displaySessions(sessions) {
        const container = document.getElementById('dkgSessionsList');
        if (!container) return;

        const stateLabels = ['None', 'Pending Commit', 'Pending Shares', 'Ready', 'Finalized', 'Aborted'];

        container.innerHTML = sessions.map(session => `
        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 15px; cursor: pointer; transition: all 0.2s;"
        onmouseover="this.style.borderColor='#2196F3'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'"
        onmouseout="this.style.borderColor='#e0e0e0'; this.style.boxShadow='none'"
        onclick="dkgManager.selectSession(${session.id})">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <div style="font-weight: 600; font-size: 16px;">Session #${session.id}</div>
        <div style="padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; background: ${session.state === 1 ? '#e3f2fd' : session.state === 4 ? '#e8f5e9' : '#f5f5f5'}; color: ${session.state === 1 ? '#1976d2' : session.state === 4 ? '#388e3c' : '#757575'};">
        ${stateLabels[session.state] || 'Unknown'}
        </div>
        </div>
        <div style="margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
        <span style="color: #666; font-size: 14px;">Threshold:</span>
        <span style="color: #333; font-size: 14px; font-weight: 500;">${session.threshold} of ${session.totalParticipants}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
        <span style="color: #666; font-size: 14px;">Creator:</span>
        <span style="color: #333; font-size: 14px; font-weight: 500; font-family: monospace;">${session.creator.slice(0, 6)}...${session.creator.slice(-4)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0;">
        <span style="color: #666; font-size: 14px;">Participants:</span>
        <span style="color: #333; font-size: 14px; font-weight: 500;">${session.totalParticipants} members</span>
        </div>
        </div>
        <button style="width: 100%; padding: 10px; background: #2196F3; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer;"
        onmouseover="this.style.background='#1976d2'"
        onmouseout="this.style.background='#2196F3'">
        View Details
        </button>
        </div>
        `).join('');
    }

    async loadSessionData(sessionId) {
        try {
            const frost = contracts.getContract('frostCoordinator');

            // Используем getSessionDetails вместо getSession
            const details = await frost.getSessionDetails(sessionId);

            // details = [state, threshold, totalParticipants, creator, groupPubKeyX, participants]
            const [state, threshold, totalParticipants, creator, groupPubKeyX, participants] = details;

            return {
                id: sessionId,
                name: `DKG Session ${sessionId}`,
                state: state,
                threshold: threshold.toNumber(),
                totalParticipants: totalParticipants.toNumber(),
                creator: creator,
                groupPubKeyX: groupPubKeyX,
                participants: participants,
                created: Date.now(), // Placeholder
                deadline: Math.floor(Date.now() / 1000) + (24 * 3600), // Placeholder
                authorizationChecked: false,
                allParticipantsAuthorized: false
            };

        } catch (error) {
            console.error(`Failed to load session ${sessionId}:`, error);
            return null;
        }
    }

    displayEmptySessions() {
        const container = document.getElementById('sessionsList');
        if (!container) return;

        container.innerHTML = `
        <div class="empty-state">
        <div class="empty-state-icon">🔐</div>
        <h3>No DKG Sessions</h3>
        <p>You haven't participated in any DKG sessions yet.</p>
        <p>Create a new session to get started.</p>
        </div>
        `;
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
                const details = await frost.getSessionDetails(sessionId);

                sessionData = {
                    id: sessionId,
                    name: `Session ${sessionId}`,
                    participants,
                    threshold: sessionInfo.threshold.toNumber(),
                    creator: details.creator, // ИСПРАВЛЕНО: берем creator из getSessionDetails
                    state: details.state,
                    deadline: sessionInfo.deadline.toNumber(),
                    commitsCount: sessionInfo.commitsCount ? sessionInfo.commitsCount.toNumber() : 0,
                    sharesCount: sessionInfo.sharesCount ? sessionInfo.sharesCount.toNumber() : 0,
                    dkgSharesCount: sessionInfo.dkgSharesCount ? sessionInfo.dkgSharesCount.toNumber() : 0,
                    groupPubkey: sessionInfo.groupPubkey && sessionInfo.groupPubkey.length > 2 ?
                    sessionInfo.groupPubkey : null,
                    authorizationChecked: false,
                    allParticipantsAuthorized: false
                };

                this.sessionsCache.set(sessionId, sessionData);
            }

            this.activeSession = sessionData;
            await this.renderSessionDetails();
            app.hideLoading();

        } catch (error) {
            app.hideLoading();
            console.error('Error loading session:', error);
            app.showNotification('error', 'Failed to load session details');
        }
    }

    // ========== GROUP ROLE REQUESTS ==========

    async requestGroupPoolManagerRole(sessionId) {
        try {
            const numericSessionId = parseInt(sessionId);

            const frost = contracts.getContract('frostCoordinator');
            const details = await frost.getSessionDetails(numericSessionId);
            const participants = await frost.getSessionParticipants(numericSessionId);

            const session = {
                id: numericSessionId,
                state: details.state,
                participants: participants,
                threshold: details.threshold.toNumber(),
                creator: details.creator
            };

            if (session.state !== 4) {
                throw new Error('Session must be finalized');
            }

            if (session.requestPending || session.authorizationChecked) {
                app.showNotification('info', 'Group request already submitted for this DKG session');
                return;
            }

            try {
                const checkResponse = await fetch(`${CONFIG.API.REQUESTS}${CONFIG.API.ENDPOINTS.DKG_REQUESTS}`);
                if (checkResponse.ok) {
                    const allDkgRequests = await checkResponse.json();

                    // Check if request exists for THIS set of participants (not just sessionId)
                    const participantsSet = new Set(session.participants.map(p => p.toLowerCase()));

                    const matchingRequest = allDkgRequests.find(req => {
                        // Only check pending requests
                        if (req.status !== 'pending') return false;

                        const reqParticipants = new Set(req.participants.map(p => p.toLowerCase()));

                        // Check if sets are equal
                        if (reqParticipants.size !== participantsSet.size) return false;

                        for (const participant of participantsSet) {
                            if (!reqParticipants.has(participant)) return false;
                        }

                        return true;
                    });

                    if (matchingRequest) {
                        app.showNotification('info', 'Group request already exists for these participants');

                        session.authorizationChecked = true;
                        session.requestPending = true;
                        session.requestId = matchingRequest.request_id;
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

                if (response.status === 409) {
                    app.showNotification('info', errorData.message || 'Request already exists for this session');

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
            if (!receipt || !receipt.logs) {
                console.error('Invalid receipt:', receipt);
                return null;
            }

            const frost = contracts.getContract('frostCoordinator');
            if (!frost) {
                console.error('FrostCoordinator contract not available');
                return null;
            }

            for (const log of receipt.logs) {
                try {
                    const parsed = frost.interface.parseLog(log);

                    // Проверяем имя события
                    if (parsed.name === 'SessionCreated') {
                        console.log('Found SessionCreated event:', parsed);

                        // SessionCreated(uint256 indexed sessionId, address indexed creator, uint256 threshold, uint256 totalParticipants, uint8 purpose, uint64 deadline)
                        const sessionId = parsed.args.sessionId || parsed.args[0];

                        if (sessionId) {
                            console.log('Extracted session ID:', sessionId.toString());
                            return sessionId.toString();
                        }
                    }
                } catch (e) {
                    // Пропускаем логи от других контрактов
                    continue;
                }
            }

            console.error('SessionCreated event not found in receipt logs');
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

    async renderDKGActionsOrStatus() {
        const session = this.activeSession;
        const isFinalized = session.state === 4;

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

        const frost = contracts.getContract('frostCoordinator');

        const details = await frost.getSessionDetails(session.id);
        const sessionInfo = await frost.getSession(session.id);

        const commitsCount = sessionInfo.commitsCount.toNumber();

        // ИСПРАВЛЕНО: считаем шары вручную, так как контракт не хранит правильный счетчик
        const participants = session.participants;
        let dkgSharesCount = 0;
        for (let i = 0; i < participants.length; i++) {
            for (let j = 0; j < participants.length; j++) {
                if (i !== j) {
                    const share = await frost.getDKGShare(session.id, participants[i], participants[j]);
                    if (share && share !== '0x' && share.length > 0) {
                        dkgSharesCount++;
                    }
                }
            }
        }

        const totalSharesNeeded = participants.length * (participants.length - 1);

        const myCommitment = await frost.getNonceCommitment(session.id, wallet.account);
        const hasMyCommitment = myCommitment !== ethers.constants.HashZero;

        // Проверяем мои шары
        let mySharesCount = 0;
        for (const participant of participants) {
            if (participant.toLowerCase() !== wallet.account.toLowerCase()) {
                const share = await frost.getDKGShare(session.id, wallet.account, participant);
                if (share && share !== '0x' && share.length > 0) {
                    mySharesCount++;
                }
            }
        }
        const hasMyShares = mySharesCount === (participants.length - 1);

        const isCreator = session.creator.toLowerCase() === wallet.account.toLowerCase();
        const allCommitsDone = commitsCount === participants.length;
        const allSharesDone = dkgSharesCount === totalSharesNeeded;

        // Можно финализировать если все готово И state >= READY (3)
        const canFinalize = isCreator && allCommitsDone && allSharesDone && details.state >= 3;

        return `
        <div class="dkg-actions-section">
        <h4>DKG Protocol Actions</h4>
        <p>Complete the DKG protocol by submitting commitment, then shares.</p>

        <div class="action-buttons">
        <button class="dkg-action-btn btn ${canCommit ? 'btn-primary' : 'btn-secondary'}"
        data-action="commitment" data-enabled="${canCommit}">
        ${hasMyCommitment ? '✓ Commitment Sent' : 'Submit Commitment'}
        </button>
        <button class="dkg-action-btn btn ${canShare ? 'btn-primary' : 'btn-secondary'}"
        data-action="share" data-enabled="${canShare}">
        ${hasMyShares ? '✓ Shares Sent' : canShare ? 'Submit Shares' : hasMyCommitment ? 'Waiting for Share Phase' : 'Submit Commitment First'}
        </button>
        <button class="dkg-action-btn btn ${canFinalize ? 'btn-success' : 'btn-secondary'}"
        data-action="finalize-session" data-enabled="${canFinalize}">
        Finalize DKG Session ${!isCreator ? '(Creator Only)' : ''}
        </button>
        </div>

        <div class="session-progress">
        <p><strong>Progress:</strong></p>
        <p>State: ${this.getDKGStateText(details.state)}</p>
        <p>Commitments: ${commitsCount} / ${participants.length}</p>
        <p>DKG Shares: ${dkgSharesCount} / ${totalSharesNeeded}</p>
        </div>
        </div>
        `;
    }

    bindDKGActionEvents() {
        const commitButton = document.querySelector('[data-action="commitment"]');
        if (commitButton) {
            commitButton.onclick = async (e) => {
                e.preventDefault();
                const enabled = commitButton.getAttribute('data-enabled') === 'true';
                if (!enabled) {
                    app.showNotification('info', 'Cannot submit commitment at this time');
                    return;
                }
                await this.submitCommitment();
            };
        }

        const shareButton = document.querySelector('[data-action="share"]');
        if (shareButton) {
            shareButton.onclick = async (e) => {
                e.preventDefault();
                const enabled = shareButton.getAttribute('data-enabled') === 'true';
                if (!enabled) {
                    app.showNotification('info', 'Must submit commitment first or wait for shares phase');
                    return;
                }
                await this.submitShare();
            };
        }

        const finalizeButton = document.querySelector('[data-action="finalize-session"]');
        if (finalizeButton) {
            finalizeButton.onclick = async (e) => {
                e.preventDefault();
                const enabled = finalizeButton.getAttribute('data-enabled') === 'true';
                if (!enabled) {
                    app.showNotification('info', 'Cannot finalize: waiting for all commitments and shares, or you are not the creator');
                    return;
                }
                await this.finalizeDKG();
            };
        }

        console.log('DKG action events bound');
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
            const deadlineHours = parseInt(document.getElementById('dkgDeadline').value);

            const participants = participantsText
            .split('\n')
            .map(addr => addr.trim())
            .filter(addr => addr.length > 0);

            const invalidAddresses = participants.filter(addr => !ethers.utils.isAddress(addr));
            if (invalidAddresses.length > 0) {
                app.showNotification('error', `Invalid addresses: ${invalidAddresses.join(', ')}`);
                return;
            }

            const uniqueParticipants = [...new Set(participants.map(addr => ethers.utils.getAddress(addr)))];

            if (!sessionName) {
                app.showNotification('error', 'Please enter a session name');
                return;
            }

            if (uniqueParticipants.length < 2) {
                app.showNotification('error', 'At least 2 unique valid participants required');
                return;
            }

            if (threshold < 1 || threshold > uniqueParticipants.length) {
                app.showNotification('error', `Threshold must be between 1 and ${uniqueParticipants.length}`);
                return;
            }

            if (deadlineHours < 1 || deadlineHours > 168) {
                app.showNotification('error', 'Deadline must be between 1 and 168 hours');
                return;
            }

            console.log('Creating DKG with validated parameters:', {
                sessionName,
                participants: uniqueParticipants,
                threshold,
                deadlineHours
            });

            document.querySelector('.modal-overlay').remove();
            await this.createDKGSession(uniqueParticipants);

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
            const numericSessionId = parseInt(sessionId);

            const frost = contracts.getContract('frostCoordinator');
            const details = await frost.getSessionDetails(numericSessionId);
            const participants = await frost.getSessionParticipants(numericSessionId);

            const response = await fetch(`${CONFIG.API.REQUESTS}${CONFIG.API.ENDPOINTS.DKG_REQUESTS}?sessionId=${numericSessionId}`);

            if (response.ok) {
                const requests = await response.json();
                const sessionRequest = requests.find(req => req.session_id === numericSessionId);

                if (sessionRequest) {
                    if (sessionRequest.status === 'approved') {
                        const participantStatuses = await this.checkParticipantStatuses(participants);
                        const allAuthorized = participantStatuses.every(p => p.hasPoolManagerRole);

                        if (allAuthorized) {
                            app.showNotification('success', 'All participants now have Pool Manager roles!');
                            await this.refreshActiveSession();
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
