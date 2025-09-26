// js/pool-manager.js
class PoolManager {
    constructor() {
        this.currentDKGSession = null;
        this.pools = [];
    }

    // FROST DKG Functions
    async startDKG(custodians, threshold, deadlineHours) {
        const frost = web3Integrator.getContract('FROST_COORDINATOR', 'FROST');

        const deadline = Math.floor(Date.now() / 1000) + (deadlineHours * 3600);
        const sessionId = Math.floor(Date.now() / 1000); // Используем timestamp как ID
        const emptyGroupPubkey = '0x' + '0'.repeat(64);

        const tx = await frost.createSession(
            sessionId,
            emptyGroupPubkey,
            custodians,
            threshold,
            deadline
        );

        await tx.wait();

        this.currentDKGSession = {
            id: sessionId,
            custodians,
            threshold,
            deadline,
            creator: web3Integrator.currentAccount
        };

        // Simulate DKG process
        await this.simulateDKGProcess(sessionId, custodians, threshold);

        return sessionId;
    }

    async simulateDKGProcess(sessionId, custodians, threshold) {
        // Generate random keys for testing
        const randomBytes = ethers.utils.randomBytes(32);
        const pubX = ethers.BigNumber.from(randomBytes).mod('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');
        const pubY = ethers.BigNumber.from(ethers.utils.keccak256(randomBytes)).mod('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');

        // Ensure Y is even (BIP340 requirement)
        const pubYEven = pubY.mod(2).eq(0) ? pubY : pubY.add(1);

        const groupPubkey = ethers.utils.defaultAbiCoder.encode(
            ['uint256', 'uint256'],
            [pubX, pubYEven]
        );

        this.currentDKGSession.groupPubkey = {
            x: pubX.toHexString(),
            y: pubYEven.toHexString(),
            encoded: groupPubkey
        };

        return this.currentDKGSession.groupPubkey;
    }

    async finalizeDKG() {
        if (!this.currentDKGSession || !this.currentDKGSession.groupPubkey) {
            throw new Error('No DKG session ready for finalization');
        }

        const frost = web3Integrator.getContract('FROST_COORDINATOR', 'FROST');
        const tx = await frost.finalizeDKG(
            this.currentDKGSession.id,
            this.currentDKGSession.groupPubkey.encoded
        );

        await tx.wait();
        return this.currentDKGSession.groupPubkey;
    }

    generatePayoutScript(pubkeyX) {
        const xOnlyPubkey = pubkeyX.startsWith('0x') ? pubkeyX.slice(2) : pubkeyX;
        return '0x5120' + xOnlyPubkey;
    }

    // Pool Creation with Enhanced Error Handling
    async createPool(poolData) {
        try {
            console.log('Creating pool with data:', poolData);

            const factory = web3Integrator.getContract('FACTORY');

            // Валидация данных
            if (!poolData.pubX || poolData.pubX === '0x0000000000000000000000000000000000000000000000000000000000000000') {
                throw new Error('Invalid pubkey X - please generate FROST keys first');
            }

            if (!poolData.payoutScript || poolData.payoutScript.length < 10) {
                throw new Error('Invalid payout script');
            }

            // Преобразуем pubkey в правильный формат
            let pubX, pubY;
            try {
                pubX = ethers.BigNumber.from(poolData.pubX);
                pubY = poolData.pubY ? ethers.BigNumber.from(poolData.pubY) : ethers.BigNumber.from(0);
            } catch (e) {
                throw new Error('Invalid pubkey format: ' + e.message);
            }

            const poolParams = {
                asset: "BTC",
                poolId: poolData.poolId,
                pubX: pubX,
                pubY: pubY,
                mpName: poolData.mpName,
                mpSymbol: poolData.mpSymbol,
                restrictedMp: false,
                create2Salt: ethers.utils.randomBytes(32),
                payoutScript: poolData.payoutScript,
                calculatorId: poolData.calculatorId || 0
            };

            console.log('Formatted pool params:', poolParams);

            // Проверяем газ перед отправкой
            try {
                const gasEstimate = await factory.estimateGas.createPool(poolParams);
                console.log('Estimated gas:', gasEstimate.toString());
            } catch (gasError) {
                console.error('Gas estimation failed:', gasError);
                throw new Error('Transaction will fail - check parameters: ' + gasError.message);
            }

            // Отправляем транзакцию
            console.log('Sending createPool transaction...');
            const tx = await factory.createPool(poolParams, {
                gasLimit: 2000000 // Фиксированный лимит газа для избежания estimation проблем
            });

            console.log('Transaction sent:', tx.hash);
            const receipt = await tx.wait();
            console.log('Transaction confirmed:', receipt);

            // Извлекаем адрес пула из событий
            const poolCreatedEvent = receipt.logs.find(log => {
                try {
                    const parsed = factory.interface.parseLog(log);
                    return parsed.name === 'PoolCreated';
                } catch (e) {
                    return false;
                }
            });

            let poolAddress = null;
            if (poolCreatedEvent) {
                const parsed = factory.interface.parseLog(poolCreatedEvent);
                poolAddress = parsed.args.poolAddress;
                console.log('Pool created at address:', poolAddress);
            }

            // Регистрируем в симуляторе (если доступен)
            try {
                await this.registerPoolInSimulator(poolData, poolAddress);
            } catch (simError) {
                console.warn('Simulator registration failed:', simError);
                // Не бросаем ошибку - пул создан в блокчейне
            }

            this.pools.push({
                address: poolAddress,
                ...poolData
            });

            return poolAddress;

        } catch (error) {
            console.error('Pool creation failed:', error);
            throw error;
        }
    }

    async registerPoolInSimulator(poolData, poolAddress) {
        try {
            const simResponse = await fetch(`${CONFIG.API.BITCOIN}/pools`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    name: poolData.mpName,
                    fee_percentage: 0.025,
                    algorithm: 'PPLNS',
                    ethereum_contract: poolAddress,
                    pubkey_x: poolData.pubX,
                    pubkey_y: poolData.pubY
                })
            });

            if (!simResponse.ok) {
                throw new Error(`Simulator API error: ${simResponse.status}`);
            }

            const simPool = await simResponse.json();
            console.log('Pool registered in simulator:', simPool);
            return simPool;
        } catch (error) {
            console.warn('Simulator registration failed:', error);
            return null;
        }
    }

    async loadPools() {
        try {
            // Load from simulator
            const response = await fetch(`${CONFIG.API.BITCOIN}/pools`);
            const data = await response.json();

            this.pools = data.pools || [];
            return this.pools;
        } catch (error) {
            console.warn('Failed to load pools from simulator:', error);
            return this.pools;
        }
    }
}

window.poolManager = new PoolManager();
