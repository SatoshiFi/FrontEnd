// js/components/reward-manager.js

class RewardManager {
    constructor() {
        this.initialized = false;
        this.currentPool = null;
        this.poolBitcoinAddress = null;
        this.availableCalculators = [];
        this.selectedCalculator = null;
        this.rewardHandlerAddress = null;
    }

    async initialize(poolAddress) {
        if (!wallet.connected) {
            console.error('Wallet not connected');
            return;
        }

        this.currentPool = poolAddress;

        await this.loadRewardHandlerFromPool();
        await this.loadPoolBitcoinAddress();
        await this.loadPoolCalculator();

        this.initialized = true;

        await this.buildRewardManagementUI();
    }

    async loadRewardHandlerFromPool() {
        try {
            const poolContract = new ethers.Contract(
                this.currentPool,
                CONFIG.ABI.POOL_CONTRACT,
                wallet.provider
            );

            this.rewardHandlerAddress = await poolContract.rewardHandler();
            console.log('Pool RewardHandler address:', this.rewardHandlerAddress);

        } catch (error) {
            console.error('Error loading RewardHandler from pool:', error);
            this.rewardHandlerAddress = null;
        }
    }

    async loadPoolCalculator() {
        try {
            this.selectedCalculator = CONFIG.CONTRACTS.PPLNS_CALCULATOR;
            this.availableCalculators = [{
                address: CONFIG.CONTRACTS.PPLNS_CALCULATOR,
                name: 'PPLNS',
                type: 'PPLNS'
            }];

            console.log('Using default PPLNS calculator:', this.selectedCalculator);

        } catch (error) {
            console.error('Error loading calculator:', error);
            this.selectedCalculator = CONFIG.CONTRACTS.PPLNS_CALCULATOR;
            this.availableCalculators = [{
                address: CONFIG.CONTRACTS.PPLNS_CALCULATOR,
                name: 'PPLNS',
                type: 'PPLNS'
            }];
        }
    }

    async loadPoolBitcoinAddress() {
        try {
            const poolContract = new ethers.Contract(
                this.currentPool,
                CONFIG.ABI.POOL_CONTRACT,
                wallet.provider
            );

            const payoutScript = await poolContract.payoutScript();

            if (!payoutScript || payoutScript === '0x') {
                console.warn('Pool has no Bitcoin payout script configured');
                this.poolBitcoinAddress = null;
                return;
            }

            this.poolBitcoinAddress = this.decodeBitcoinAddress(payoutScript);

            if (!this.poolBitcoinAddress) {
                console.error('Failed to decode pool Bitcoin address from script:', payoutScript);
                return;
            }

            console.log('Pool Bitcoin address loaded:', {
                pool: this.currentPool,
                address: this.poolBitcoinAddress,
                script: payoutScript
            });

        } catch (error) {
            console.error('Error loading pool Bitcoin address:', error);
            this.poolBitcoinAddress = null;
        }
    }

    decodeBitcoinAddress(payoutScript) {
        try {
            if (!window.bitcoinAddressCodec) {
                console.error('BitcoinAddressCodec not available');
                return null;
            }

            const address = bitcoinAddressCodec.decode(
                payoutScript,
                CONFIG.BITCOIN.NETWORK
            );

            if (!address) {
                console.warn('Could not decode payoutScript:', payoutScript);
                return null;
            }

            console.log('Decoded Bitcoin address from payoutScript:', {
                script: payoutScript,
                address: address,
                network: CONFIG.BITCOIN.NETWORK
            });

            return address;

        } catch (error) {
            console.error('Error decoding Bitcoin address:', error);
            return null;
        }
    }

    async buildRewardManagementUI() {
        const container = document.getElementById('rewardManagementContainer')
        || document.getElementById('rewardManagement');

        if (!container) {
            console.error('Reward management container not found');
            return;
        }

        if (!this.poolBitcoinAddress) {
            container.innerHTML = `
            <div class="reward-management-container">
            <div class="section-header">
            <h2>Reward Distribution</h2>
            <p>Pool ${wallet.formatAddress(this.currentPool)}</p>
            </div>
            <div class="error-state">
            <div class="error-icon">⚠️</div>
            <h3>Bitcoin Address Not Configured</h3>
            <p>This pool does not have a Bitcoin payout address configured.</p>
            <p>Please configure the payout script in pool settings first.</p>
            <button onclick="poolManager.managePool('${this.currentPool}')" class="btn btn-primary">
            Configure Pool Settings
            </button>
            </div>
            </div>
            `;
            return;
        }

        container.innerHTML = `
        <div class="reward-management-container">
        <div class="section-header">
        <h2>Reward Distribution</h2>
        <p>Pool ${wallet.formatAddress(this.currentPool)}</p>
        <div class="pool-bitcoin-address">
        <strong>Bitcoin Address:</strong> <code>${this.poolBitcoinAddress}</code>
        </div>
        </div>

        <div class="section-card">
        <h3>Distribution Algorithm</h3>
        ${this.selectedCalculator ? `
            <div class="calculator-info">
            <div class="info-item">
            <span class="label">Current Calculator:</span>
            <span class="value">
            ${this.availableCalculators[0]?.name || 'Unknown'}
            </span>
            </div>
            <div class="info-item">
            <span class="label">Address:</span>
            <span class="value"><code>${wallet.formatAddress(this.selectedCalculator)}</code></span>
            </div>
            </div>
            ` : `
            <div class="warning-box">
            <p>⚠️ No calculator configured for this pool</p>
            <p>Please configure a reward calculator in pool settings</p>
            </div>
            `}
            </div>

            <div class="section-card">
            <h3>Available Blocks (Mining Simulator)</h3>
            <div class="blocks-actions">
            <button onclick="rewardManager.registerAllUnclaimedBlocks()"
            class="btn btn-primary"
            id="registerAllBtn">
            Register All Unclaimed Blocks
            </button>
            </div>
            <div id="availableBlocks">Loading...</div>
            </div>

            <div class="section-card">
            <h3>Registered UTXOs</h3>
            <div id="registeredUTXOs">Loading...</div>
            </div>

            <div class="section-card">
            <h3>Pending Distributions</h3>
            <div id="pendingDistributions">Loading...</div>
            </div>
            </div>
            `;

            await this.loadAllData();
    }

    async loadAllData() {
        await Promise.all([
            this.loadAvailableBlocks(),
                          this.loadRegisteredUTXOs(),
                          this.loadPendingDistributions()
        ]);
    }

    async loadAvailableBlocks() {
        try {
            if (!this.poolBitcoinAddress) {
                document.getElementById('availableBlocks').innerHTML =
                '<p>Bitcoin address not configured</p>';
                return;
            }

            const response = await fetch(CONFIG.API.getMiningUrl('BLOCKS'));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            // Фильтруем блоки: только для нашего пула и >= GENESIS_HEIGHT
            const poolBlocks = data.blocks.filter(b =>
            b.coinbase_address === this.poolBitcoinAddress &&
            b.height >= CONFIG.BITCOIN.GENESIS_HEIGHT
            );

            console.log(`Found ${poolBlocks.length} blocks for pool (height >= ${CONFIG.BITCOIN.GENESIS_HEIGHT})`);

            if (!this.rewardHandlerAddress) {
                console.warn('RewardHandler address not loaded');
                this.renderAvailableBlocks([]);
                return;
            }

            const rewardHandler = new ethers.Contract(
                this.rewardHandlerAddress,
                CONFIG.ABI.REWARD_HANDLER,
                wallet.provider
            );

            const unregisteredBlocks = [];

            for (const block of poolBlocks) {
                const txData = JSON.stringify(block.coinbase_tx);
                const txid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txData));
                const vout = 0;
                const utxoKey = ethers.utils.solidityKeccak256(
                    ['bytes32', 'uint32'],
                    [txid, vout]
                );

                try {
                    const info = await rewardHandler.getRewardInfo(this.currentPool, utxoKey);

                    if (!info.isRegistered) {
                        unregisteredBlocks.push(block);
                    }
                } catch (error) {
                    console.warn(`Error checking UTXO for block ${block.height}:`, error);
                    // Если ошибка при проверке - считаем незарегистрированным
                    unregisteredBlocks.push(block);
                }
            }

            console.log(`Found ${unregisteredBlocks.length} unregistered blocks`);
            this.renderAvailableBlocks(unregisteredBlocks);

        } catch (error) {
            console.error('Error loading blocks:', error);
            document.getElementById('availableBlocks').innerHTML =
            `<p class="error">Error: ${error.message}</p>`;
        }
    }

    renderAvailableBlocks(blocks) {
        const container = document.getElementById('availableBlocks');

        if (blocks.length === 0) {
            container.innerHTML = '<p>✅ All blocks are registered!</p>';

            // Отключаем кнопку "Register All"
            const registerAllBtn = document.getElementById('registerAllBtn');
            if (registerAllBtn) {
                registerAllBtn.disabled = true;
                registerAllBtn.textContent = 'All Blocks Registered';
            }
            return;
        }

        // Включаем кнопку "Register All"
        const registerAllBtn = document.getElementById('registerAllBtn');
        if (registerAllBtn) {
            registerAllBtn.disabled = false;
            registerAllBtn.textContent = `Register All Unclaimed Blocks (${blocks.length})`;
        }

        container.innerHTML = `
        <div class="blocks-summary">
        <p>Found <strong>${blocks.length}</strong> unregistered blocks</p>
        </div>
        ${blocks.map(block => `
            <div class="block-card">
            <div class="block-info">
            <strong>Block ${block.height}</strong>
            <span>Reward: ${block.block_reward} BTC (${Math.floor(block.block_reward * 100_000_000)} sat)</span>
            <span>Hash: ${block.hash.substring(0, 16)}...</span>
            <span>Time: ${new Date(block.timestamp * 1000).toLocaleString()}</span>
            </div>
            <button onclick="rewardManager.registerUTXO(${JSON.stringify(block).replace(/"/g, '&quot;')})"
            class="btn btn-secondary">
            Register
            </button>
            </div>
            `).join('')}
            `;
    }

    async registerUTXO(block) {
        try {
            if (!this.rewardHandlerAddress) {
                app.showNotification('error', 'RewardHandler not initialized');
                return;
            }

            const rewardHandler = new ethers.Contract(
                this.rewardHandlerAddress,
                CONFIG.ABI.REWARD_HANDLER,
                wallet.signer
            );

            const txData = JSON.stringify(block.coinbase_tx);
            const txid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txData));
            const vout = 0;
            const amountSat = Math.floor(block.block_reward * 100_000_000);

            // ИСПРАВЛЕНО: Используем hash напрямую из API
            const blockHash = '0x' + block.hash;

            console.log('Registering UTXO:', {
                txid,
                vout,
                amountSat,
                blockHash,
                blockHeight: block.height
            });

            app.showLoading(`Registering block ${block.height}...`);

            const tx = await rewardHandler.registerReward(
                txid,
                vout,
                amountSat,
                blockHash,
                this.currentPool
            );

            const receipt = await tx.wait();

            app.hideLoading();
            app.showNotification('success',
                                 `Block ${block.height} registered successfully`
            );

            console.log('Registration receipt:', receipt);

            // Обновляем только список блоков, не перезагружаем всё
            await this.loadAvailableBlocks();

        } catch (error) {
            app.hideLoading();
            console.error('Registration error:', error);

            let errorMessage = 'Failed to register UTXO';
            if (error.message.includes('already registered')) {
                errorMessage = `Block ${block.height} is already registered`;
                // Обновляем список если блок уже зарегистрирован
                await this.loadAvailableBlocks();
            } else if (error.message.includes('user rejected')) {
                errorMessage = 'Transaction rejected by user';
            }

            app.showNotification('error', errorMessage);
        }
    }

    // НОВЫЙ МЕТОД: Регистрация всех незаявленных блоков
    async registerAllUnclaimedBlocks() {
        try {
            if (!this.poolBitcoinAddress) {
                app.showNotification('error', 'Bitcoin address not configured');
                return;
            }

            if (!this.rewardHandlerAddress) {
                app.showNotification('error', 'RewardHandler not initialized');
                return;
            }

            app.showLoading('Finding unclaimed blocks...');

            const response = await fetch(CONFIG.API.getMiningUrl('BLOCKS'));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            // Фильтруем блоки: только для нашего пула и >= GENESIS_HEIGHT
            const poolBlocks = data.blocks.filter(b =>
            b.coinbase_address === this.poolBitcoinAddress &&
            b.height >= CONFIG.BITCOIN.GENESIS_HEIGHT
            );

            console.log(`Checking ${poolBlocks.length} pool blocks (height >= ${CONFIG.BITCOIN.GENESIS_HEIGHT})`);

            const rewardHandler = new ethers.Contract(
                this.rewardHandlerAddress,
                CONFIG.ABI.REWARD_HANDLER,
                wallet.signer
            );

            const unregisteredBlocks = [];

            // Найдём все незарегистрированные блоки
            for (const block of poolBlocks) {
                const txData = JSON.stringify(block.coinbase_tx);
                const txid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txData));
                const vout = 0;
                const utxoKey = ethers.utils.solidityKeccak256(
                    ['bytes32', 'uint32'],
                    [txid, vout]
                );

                try {
                    const info = await rewardHandler.getRewardInfo(this.currentPool, utxoKey);

                    if (!info.isRegistered) {
                        unregisteredBlocks.push(block);
                    }
                } catch (error) {
                    console.warn(`Error checking block ${block.height}:`, error);
                    unregisteredBlocks.push(block);
                }
            }

            app.hideLoading();

            if (unregisteredBlocks.length === 0) {
                app.showNotification('info', 'All blocks are already registered!');
                await this.loadAvailableBlocks();
                return;
            }

            const confirmed = confirm(
                `Found ${unregisteredBlocks.length} unregistered blocks.\n\n` +
                `Height range: ${unregisteredBlocks[unregisteredBlocks.length - 1].height} - ${unregisteredBlocks[0].height}\n` +
                `Total rewards: ${(unregisteredBlocks.reduce((sum, b) => sum + b.block_reward, 0)).toFixed(4)} BTC\n\n` +
                `This will require ${unregisteredBlocks.length} transactions.\n` +
                `Do you want to proceed?`
            );

            if (!confirmed) {
                return;
            }

            // Регистрируем блоки один за другим
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < unregisteredBlocks.length; i++) {
                const block = unregisteredBlocks[i];

                try {
                    app.showLoading(`Registering block ${block.height} (${i + 1}/${unregisteredBlocks.length})...`);

                    const txData = JSON.stringify(block.coinbase_tx);
                    const txid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txData));
                    const vout = 0;
                    const amountSat = Math.floor(block.block_reward * 100_000_000);
                    const blockHash = '0x' + block.hash;

                    console.log(`[${i + 1}/${unregisteredBlocks.length}] Registering block ${block.height}`);

                    const tx = await rewardHandler.registerReward(
                        txid,
                        vout,
                        amountSat,
                        blockHash,
                        this.currentPool
                    );

                    const receipt = await tx.wait();

                    console.log(`✅ Block ${block.height} registered (gas: ${receipt.gasUsed.toString()})`);
                    successCount++;

                    // Небольшая задержка между транзакциями
                    if (i < unregisteredBlocks.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                } catch (error) {
                    console.error(`❌ Failed to register block ${block.height}:`, error);
                    failCount++;

                    if (error.message.includes('user rejected')) {
                        app.hideLoading();
                        app.showNotification('warning',
                                             `Registration cancelled by user. Registered ${successCount} blocks.`
                        );
                        await this.loadAllData();
                        return;
                    }

                    // Продолжаем со следующим блоком даже если этот упал
                    continue;
                }
            }

            app.hideLoading();

            // Показываем итоговый результат
            if (successCount > 0) {
                app.showNotification('success',
                                     `Successfully registered ${successCount} blocks!` +
                                     (failCount > 0 ? ` (${failCount} failed)` : '')
                );
            } else {
                app.showNotification('error', 'Failed to register any blocks');
            }

            console.log(`Registration complete: ${successCount} success, ${failCount} failed`);

            // Обновляем данные
            await this.loadAllData();

        } catch (error) {
            app.hideLoading();
            console.error('Batch registration error:', error);
            app.showNotification('error', 'Failed to register blocks: ' + error.message);
        }
    }

    async loadRegisteredUTXOs() {
        try {
            const response = await fetch(CONFIG.API.getMiningUrl('BLOCKS'));
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            // Фильтруем блоки: только для нашего пула и >= GENESIS_HEIGHT
            const poolBlocks = data.blocks.filter(b =>
            b.coinbase_address === this.poolBitcoinAddress &&
            b.height >= CONFIG.BITCOIN.GENESIS_HEIGHT
            );

            if (!this.rewardHandlerAddress) {
                console.warn('RewardHandler address not loaded');
                document.getElementById('registeredUTXOs').innerHTML =
                '<p>RewardHandler not initialized</p>';
                return;
            }

            const rewardHandler = new ethers.Contract(
                this.rewardHandlerAddress,
                CONFIG.ABI.REWARD_HANDLER,
                wallet.provider
            );

            const utxos = [];

            for (const block of poolBlocks) {
                const txData = JSON.stringify(block.coinbase_tx);
                const txid = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(txData));
                const vout = 0;
                const utxoKey = ethers.utils.solidityKeccak256(
                    ['bytes32', 'uint32'],
                    [txid, vout]
                );

                try {
                    const info = await rewardHandler.getRewardInfo(this.currentPool, utxoKey);

                    if (info.isRegistered) {
                        // Правильный blockHash из API
                        const apiBlockHash = '0x' + block.hash;

                        let confirmations = 0;
                        let isReady = false;
                        let blockExistsInSPV = false;

                        try {
                            const spv = new ethers.Contract(
                                CONFIG.CONTRACTS.SPV_CONTRACT,
                                [
                                    'function blockExists(bytes32) view returns (bool)',
                                                            'function getMainchainHeight() view returns (uint64)'
                                ],
                                wallet.provider
                            );

                            // Проверяем существование блока в SPV
                            blockExistsInSPV = await spv.blockExists(apiBlockHash);

                            if (blockExistsInSPV) {
                                // Считаем confirmations с учетом GENESIS_HEIGHT
                                const currentHeight = await spv.getMainchainHeight();
                                const blockHeightInSPV = block.height - CONFIG.BITCOIN.GENESIS_HEIGHT;
                                confirmations = Math.max(0, currentHeight.toNumber() - blockHeightInSPV + 1);

                                // Проверяем готовность к распределению
                                try {
                                    isReady = await rewardHandler.isReadyToDistribute(
                                        this.currentPool,
                                        utxoKey
                                    );
                                } catch (readyError) {
                                    console.warn('isReady check failed:', readyError);
                                    // Fallback: считаем готовым если 100+ confirmations
                                    isReady = confirmations >= 100 && !info.isDistributed;
                                }
                            }
                        } catch (confError) {
                            console.warn('Could not check confirmations:', confError);
                        }

                        // Проверяем корректность blockHash
                        const isCorrectHash = info.blockHash.toLowerCase() === apiBlockHash.toLowerCase();

                        utxos.push({
                            utxoKey,
                            txid: info.txid,
                            vout: info.vout.toString(),
                                   amount: info.amountSat.toString(),
                                   blockHash: info.blockHash,
                                   blockHeight: block.height,
                                   isDistributed: info.isDistributed,
                                   isReady,
                                   confirmations,
                                   blockExistsInSPV,
                                   isCorrectHash
                        });
                    }
                } catch (infoError) {
                    console.warn(`Error getting info for UTXO ${utxoKey}:`, infoError);
                }
            }

            console.log(`Found ${utxos.length} registered UTXOs for pool (height >= ${CONFIG.BITCOIN.GENESIS_HEIGHT})`);
            this.renderRegisteredUTXOs(utxos);

        } catch (error) {
            console.error('Error loading UTXOs:', error);
            document.getElementById('registeredUTXOs').innerHTML =
            `<p class="error">Error loading UTXOs. Try refreshing.</p>`;
        }
    }

    renderRegisteredUTXOs(utxos) {
        const container = document.getElementById('registeredUTXOs');

        if (utxos.length === 0) {
            container.innerHTML = '<p>No registered UTXOs</p>';
            return;
        }

        // Группируем по статусам
        const readyToDistribute = utxos.filter(u => !u.isDistributed && u.isReady && u.isCorrectHash);
        const pending = utxos.filter(u => !u.isDistributed && !u.isReady && u.isCorrectHash);
        const distributed = utxos.filter(u => u.isDistributed);
        const invalid = utxos.filter(u => !u.isCorrectHash);

        container.innerHTML = `
        ${readyToDistribute.length > 0 ? `
            <div class="utxo-section">
            <h4 class="section-title ready">✅ Ready to Distribute (${readyToDistribute.length})</h4>
            ${readyToDistribute.map(utxo => this.renderUTXOCard(utxo)).join('')}
            </div>
            ` : ''}

            ${pending.length > 0 ? `
                <div class="utxo-section">
                <h4 class="section-title pending">⏳ Pending Confirmations (${pending.length})</h4>
                ${pending.map(utxo => this.renderUTXOCard(utxo)).join('')}
                </div>
                ` : ''}

                ${distributed.length > 0 ? `
                    <div class="utxo-section">
                    <h4 class="section-title distributed">✔️ Distributed (${distributed.length})</h4>
                    ${distributed.map(utxo => this.renderUTXOCard(utxo)).join('')}
                    </div>
                    ` : ''}

                    ${invalid.length > 0 ? `
                        <div class="utxo-section">
                        <h4 class="section-title invalid">⚠️ Invalid Hash (${invalid.length})</h4>
                        <p class="info-text">These UTXOs were registered with wrong blockHash and cannot be distributed.</p>
                        ${invalid.map(utxo => this.renderUTXOCard(utxo)).join('')}
                        </div>
                        ` : ''}
                        `;
    }

    renderUTXOCard(utxo) {
        const amountBTC = (parseFloat(utxo.amount) / 100_000_000).toFixed(8);

        let statusClass, statusText;

        if (utxo.isDistributed) {
            statusClass = 'distributed';
            statusText = 'Distributed';
        } else if (!utxo.isCorrectHash) {
            statusClass = 'invalid';
            statusText = 'Invalid Hash';
        } else if (!utxo.blockExistsInSPV) {
            statusClass = 'not-in-spv';
            statusText = 'Not in SPV';
        } else if (utxo.isReady) {
            statusClass = 'ready';
            statusText = `Ready (${utxo.confirmations}+ confirmations)`;
        } else {
            statusClass = 'pending';
            statusText = `Pending (${utxo.confirmations}/100)`;
        }

        return `
        <div class="utxo-card ${statusClass}">
        <div class="utxo-info">
        <strong>${amountBTC} BTC</strong>
        <span>Block: ${utxo.blockHeight}</span>
        <span>Confirmations: ${utxo.confirmations}</span>
        <span class="status-badge ${statusClass}">${statusText}</span>
        </div>

        ${!utxo.isDistributed && utxo.isReady && utxo.isCorrectHash ? `
            <button onclick="rewardManager.calculateDistribution('${utxo.utxoKey}')"
            class="btn btn-success"
            ${!this.selectedCalculator ? 'disabled' : ''}>
            Calculate Distribution
            </button>
            ` : ''}
            </div>
            `;
    }

    async calculateDistribution(utxoKey) {
        try {
            if (!this.selectedCalculator) {
                app.showNotification('error', 'No calculator configured for this pool');
                return;
            }

            if (!this.rewardHandlerAddress) {
                app.showNotification('error', 'RewardHandler not initialized');
                return;
            }

            const rewardHandler = new ethers.Contract(
                this.rewardHandlerAddress,
                CONFIG.ABI.REWARD_HANDLER,
                wallet.signer
            );

            console.log('Calculating distribution:', {
                utxoKey,
                calculator: this.selectedCalculator,
                pool: this.currentPool,
                aggregator: CONFIG.CONTRACTS.STRATUM_AGGREGATOR
            });

            app.showLoading('Calculating distribution...');

            const tx = await rewardHandler.distributeRewards(
                utxoKey,
                this.currentPool,
                this.selectedCalculator,
                CONFIG.CONTRACTS.STRATUM_AGGREGATOR
            );

            const receipt = await tx.wait();

            app.hideLoading();
            app.showNotification('success', 'Distribution calculated successfully');

            console.log('Distribution receipt:', receipt);

            await this.loadAllData();

        } catch (error) {
            app.hideLoading();
            console.error('Calculate error:', error);

            let errorMessage = 'Failed to calculate distribution';
            if (error.message.includes('No workers')) {
                errorMessage = 'No active workers in pool';
            } else if (error.message.includes('Already distributed')) {
                errorMessage = 'This UTXO has already been distributed';
            } else if (error.message.includes('not mature')) {
                errorMessage = 'Block needs 100 confirmations';
            }

            app.showNotification('error', errorMessage);
        }
    }

    async loadPendingDistributions() {
        try {
            if (!this.rewardHandlerAddress) {
                console.warn('RewardHandler address not loaded');
                document.getElementById('pendingDistributions').innerHTML =
                '<p>RewardHandler not initialized</p>';
                return;
            }

            const rewardHandler = new ethers.Contract(
                this.rewardHandlerAddress,
                CONFIG.ABI.REWARD_HANDLER,
                wallet.provider
            );

            const count = await rewardHandler.getPendingDistributionsCount(this.currentPool);
            const countNum = count.toNumber();

            console.log(`Found ${countNum} total distributions for pool`);

            const pending = [];

            for (let i = 0; i < countNum; i++) {
                try {
                    const dist = await rewardHandler.getPendingDistribution(this.currentPool, i);

                    const isApproved = dist.isApproved || dist[3];
                    const isExecuted = dist.isExecuted || dist[4];

                    if (!isApproved && !isExecuted) {
                        pending.push({
                            distributionId: i,
                            utxoKey: dist.utxoKey || dist[0],
                            totalAmount: (dist.totalAmount || dist[1]).toString(),
                                     recipientsCount: (dist.recipientsCount || dist[2]).toString(),
                                     createdAt: new Date((dist.createdAt || dist[5]).toNumber() * 1000)
                        });
                    }
                } catch (distError) {
                    console.warn(`Error loading distribution ${i}:`, distError);
                }
            }

            console.log(`Found ${pending.length} pending distributions`);
            this.renderPendingDistributions(pending);

        } catch (error) {
            console.error('Error loading pending distributions:', error);
            document.getElementById('pendingDistributions').innerHTML =
            '<p>No pending distributions</p>';
        }
    }

    renderPendingDistributions(distributions) {
        const container = document.getElementById('pendingDistributions');

        if (distributions.length === 0) {
            container.innerHTML = '<p>No pending distributions</p>';
            return;
        }

        container.innerHTML = distributions.map(dist => {
            const amountBTC = (parseFloat(dist.totalAmount) / 100_000_000).toFixed(8);

            return `
            <div class="distribution-card">
            <div class="distribution-info">
            <strong>Distribution #${dist.distributionId}</strong>
            <span>${amountBTC} BTC (${dist.totalAmount} sat)</span>
            <span>${dist.recipientsCount} recipients</span>
            <span>Created: ${dist.createdAt.toLocaleString()}</span>
            </div>
            <div class="distribution-actions">
            <button onclick="rewardManager.showDetails(${dist.distributionId})"
            class="btn btn-secondary">
            View Details
            </button>
            <button onclick="rewardManager.approveDistribution(${dist.distributionId})"
            class="btn btn-primary">
            Approve & Execute
            </button>
            </div>
            </div>
            `;
        }).join('');
    }

    async showDetails(distributionId) {
        try {
            app.showLoading('Loading distribution details...');

            if (!this.rewardHandlerAddress) {
                app.hideLoading();
                app.showNotification('error', 'RewardHandler not initialized');
                return;
            }

            const rewardHandler = new ethers.Contract(
                this.rewardHandlerAddress,
                CONFIG.ABI.REWARD_HANDLER,
                wallet.provider
            );

            const recipients = await rewardHandler.getDistributionRecipients(
                this.currentPool,
                distributionId
            );

            app.hideLoading();

            this.renderDetailsModal(distributionId, recipients);

        } catch (error) {
            app.hideLoading();
            console.error('Error loading details:', error);
            app.showNotification('error', 'Failed to load distribution details');
        }
    }

    renderDetailsModal(distributionId, recipients) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        let totalAmount = 0;
        const recipientsHTML = recipients.map((r, i) => {
            const amountBTC = (parseFloat(r.amount.toString()) / 100_000_000).toFixed(8);
            const percentage = (parseFloat(r.percentage.toString()) / 100).toFixed(2);
            totalAmount += parseFloat(r.amount.toString());

            return `
            <div class="recipient-row">
            <span class="recipient-index">#${i + 1}</span>
            <span class="recipient-address">${wallet.formatAddress(r.recipient)}</span>
            <span class="recipient-amount">${amountBTC} BTC</span>
            <span class="recipient-percentage">${percentage}%</span>
            </div>
            `;
        }).join('');

        const totalBTC = (totalAmount / 100_000_000).toFixed(8);

        modal.innerHTML = `
        <div class="modal-content distribution-details-modal">
        <div class="modal-header">
        <h3>Distribution #${distributionId} Details</h3>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
        <div class="distribution-summary">
        <div class="summary-item">
        <span class="label">Total Amount:</span>
        <span class="value">${totalBTC} BTC</span>
        </div>
        <div class="summary-item">
        <span class="label">Recipients:</span>
        <span class="value">${recipients.length}</span>
        </div>
        </div>
        <div class="recipients-list">
        <h4>Recipients:</h4>
        ${recipientsHTML}
        </div>
        </div>
        <div class="modal-actions">
        <button onclick="this.closest('.modal-overlay').remove()" class="btn btn-secondary">
        Close
        </button>
        <button onclick="rewardManager.approveDistribution(${distributionId}); this.closest('.modal-overlay').remove();"
        class="btn btn-primary">
        Approve & Execute
        </button>
        </div>
        </div>
        `;

        document.body.appendChild(modal);
    }

    async approveDistribution(distributionId) {
        try {
            const pool = new ethers.Contract(
                this.currentPool,
                CONFIG.ABI.POOL_CONTRACT,
                wallet.signer
            );

            console.log('Approving distribution:', {
                pool: this.currentPool,
                distributionId
            });

            app.showLoading('Approving distribution...');

            const tx = await pool.approveDistribution(distributionId);
            const receipt = await tx.wait();

            app.hideLoading();
            app.showNotification('success',
                                 'Distribution approved and executed successfully!'
            );

            console.log('Approval receipt:', receipt);

            await this.loadAllData();

        } catch (error) {
            app.hideLoading();
            console.error('Approve error:', error);

            let errorMessage = 'Failed to approve distribution';
            if (error.message.includes('Already approved')) {
                errorMessage = 'This distribution has already been approved';
            } else if (error.message.includes('user rejected')) {
                errorMessage = 'Transaction rejected by user';
            }

            app.showNotification('error', errorMessage);
        }
    }

    destroy() {
        this.initialized = false;
        this.currentPool = null;
        this.poolBitcoinAddress = null;
        this.availableCalculators = [];
        this.selectedCalculator = null;
        this.rewardHandlerAddress = null;
    }
}

window.rewardManager = new RewardManager();
