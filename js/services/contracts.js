// js/contracts.js - ИСПРАВЛЕННАЯ ВЕРСИЯ С ПРАВИЛЬНОЙ ПРОВЕРКОЙ АДМИНСКИХ ПРАВ
class ContractsManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.contracts = new Map();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        console.log('Initializing contracts with addresses:', {
            FACTORY: CONFIG.CONTRACTS.FACTORY,
            FROST_COORDINATOR: CONFIG.CONTRACTS.FROST_COORDINATOR,
            MEMBERSHIP_SBT: CONFIG.CONTRACTS.MEMBERSHIP_SBT
        });

        this.provider = wallet.provider;

        this.contracts.set('factory', new ethers.Contract(
            CONFIG.CONTRACTS.FACTORY,
            CONFIG.ABI.FACTORY,
            this.provider
        ));

        this.contracts.set('frostCoordinator', new ethers.Contract(
            CONFIG.CONTRACTS.FROST_COORDINATOR,
            CONFIG.ABI.FROST_COORDINATOR,
            this.provider
        ));

        this.contracts.set('membershipSBT', new ethers.Contract(
            CONFIG.CONTRACTS.MEMBERSHIP_SBT,
            CONFIG.ABI.MEMBERSHIP_SBT,
            this.provider
        ));

        // ДОБАВИТЬ:
        if (CONFIG.CONTRACTS.CALCULATOR_REGISTRY) {
            this.contracts.set('calculatorRegistry', new ethers.Contract(
                CONFIG.CONTRACTS.CALCULATOR_REGISTRY,
                CONFIG.ABI.CALCULATOR_REGISTRY || [
                    'function getRegisteredCalculators() external view returns (address[])',
                                                                         'function calculatorInfo(address) external view returns (string memory name, bool isActive)'
                ],
                this.provider
            ));
        }

        if (CONFIG.CONTRACTS.REWARD_HANDLER) {
            this.contracts.set('rewardHandler', new ethers.Contract(
                CONFIG.CONTRACTS.REWARD_HANDLER,
                CONFIG.ABI.REWARD_HANDLER || [
                    'function getRewardInfo(address pool, bytes32 utxoKey) external view returns (tuple(bytes32 txid, uint32 vout, uint64 amountSat, bytes32 blockHash, bool isRegistered, bool isDistributed))',
                                                                    'function getPendingDistributionsCount(address pool) external view returns (uint256)',
                                                                    'function getPendingDistribution(address pool, uint256 index) external view returns (tuple(bytes32 utxoKey, uint256 totalAmount, uint256 recipientsCount, uint256 createdAt, bool isApproved, bool isExecuted))',
                                                                    'function getDistributionRecipients(address pool, uint256 distributionId) external view returns (tuple(address recipient, uint256 amount, uint256 percentage)[])',
                                                                    'event RewardRegistered(address indexed pool, bytes32 indexed utxoKey)'
                ],
                this.provider
            ));
        }

        this.initialized = true;
        console.log('Contracts initialized successfully');
    }

    // =============== ИСПРАВЛЕННЫЕ МЕТОДЫ ДЛЯ ПРОВЕРКИ АДМИНСКИХ ПРАВ ===============

    async checkAdminRights(address = wallet.account) {
        try {
            if (!this.initialized) {
                console.log('Contracts not initialized for admin check');
                return { hasAdminRights: false, isAdmin: false, isPoolManager: false };
            }

            console.log('Checking admin rights for address:', address);

            // ИСПРАВЛЕНО: используем MEMBERSHIP_SBT контракт, а не Factory
            const membershipSBT = this.getContract('membershipSBT');

            if (!membershipSBT) {
                console.error('MEMBERSHIP_SBT contract not found');
                return { hasAdminRights: false, isAdmin: false, isPoolManager: false };
            }

            try {
                // Проверяем есть ли NFT у пользователя
                const balance = await membershipSBT.balanceOf(address);
                console.log('User NFT balance:', balance.toString());

                if (balance.eq(0)) {
                    console.log('User has no NFTs, no admin rights');
                    return { hasAdminRights: false, isAdmin: false, isPoolManager: false };
                }

                // Получаем токен ID пользователя
                const tokenId = await membershipSBT.tokenOf(address);
                console.log('User token ID:', tokenId.toString());

                // Получаем данные membership NFT
                const membershipData = await membershipSBT.membershipOf(tokenId);
                console.log('Membership data:', membershipData);

                // Извлекаем роль из NFT
                let role = 'unknown';
                try {
                    role = ethers.utils.parseBytes32String(membershipData.role);
                } catch (roleError) {
                    console.warn('Failed to parse role from NFT:', roleError);
                    // Пытаемся получить роль как строку
                    role = membershipData.role || 'unknown';
                }

                console.log('User role from NFT:', role);

                // Определяем админские права на основе роли
                const roleText = role.toLowerCase();
                const isAdmin = ['admin', 'owner'].includes(roleText);
                const isPoolManager = ['pool_manager', 'custodial', 'admin', 'owner'].includes(roleText);

                const result = {
                    hasAdminRights: isAdmin || isPoolManager,
                    isAdmin: isAdmin,
                    isPoolManager: isPoolManager,
                    role: role,
                    tokenId: tokenId.toString(),
                    balance: balance.toString()
                };

                console.log('Admin rights check result:', result);

                return result;

            } catch (nftError) {
                console.warn('NFT-based admin check failed, trying fallback methods:', nftError);

                // Fallback 1: Проверка через owner контракта
                try {
                    const owner = await membershipSBT.owner();
                    if (owner.toLowerCase() === address.toLowerCase()) {
                        console.log('User is contract owner');
                        return {
                            hasAdminRights: true,
                            isAdmin: true,
                            isPoolManager: true,
                            role: 'owner',
                            source: 'contract_owner'
                        };
                    }
                } catch (ownerError) {
                    console.warn('Owner check failed:', ownerError);
                }

                // Fallback 2: Проверка через Factory контракт (для совместимости)
                try {
                    const factory = this.getContract('factory');
                    if (factory) {
                        // Пытаемся найти админские роли в Factory
                        const DEFAULT_ADMIN_ROLE = ethers.utils.id("DEFAULT_ADMIN_ROLE");
                        const hasDefaultAdmin = await factory.hasRole(DEFAULT_ADMIN_ROLE, address);

                        if (hasDefaultAdmin) {
                            console.log('User has DEFAULT_ADMIN_ROLE in Factory');
                            return {
                                hasAdminRights: true,
                                isAdmin: true,
                                isPoolManager: true,
                                role: 'admin',
                                source: 'factory_role'
                            };
                        }

                        // Проверяем POOL_MANAGER_ROLE
                        const POOL_MANAGER_ROLE = ethers.utils.id("POOL_MANAGER_ROLE");
                        const hasPoolManager = await factory.hasRole(POOL_MANAGER_ROLE, address);

                        if (hasPoolManager) {
                            console.log('User has POOL_MANAGER_ROLE in Factory');
                            return {
                                hasAdminRights: true,
                                isAdmin: false,
                                isPoolManager: true,
                                role: 'pool_manager',
                                source: 'factory_role'
                            };
                        }
                    }
                } catch (factoryError) {
                    console.warn('Factory fallback check failed:', factoryError);
                }

                // Если все проверки не удались
                console.log('All admin checks failed, user has no admin rights');
                return { hasAdminRights: false, isAdmin: false, isPoolManager: false, error: nftError.message };
            }

        } catch (error) {
            console.error('Critical error in admin rights check:', error);
            return {
                hasAdminRights: false,
                isAdmin: false,
                isPoolManager: false,
                error: error.message
            };
        }
    }

    async checkPoolManagerRole(address = wallet.account) {
        try {
            const adminRights = await this.checkAdminRights(address);
            return adminRights.isPoolManager || adminRights.hasAdminRights;
        } catch (error) {
            console.error('Error checking pool manager role:', error);
            return false;
        }
    }

    // =============== ДОПОЛНИТЕЛЬНЫЕ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ===============

    async getUserNFTs(address = wallet.account) {
        try {
            if (!this.initialized) {
                console.warn('Contracts not initialized for getUserNFTs');
                return [];
            }

            const membershipSBT = this.getContract('membershipSBT');
            if (!membershipSBT) {
                console.warn('MEMBERSHIP_SBT contract not available');
                return [];
            }

            const balance = await membershipSBT.balanceOf(address);

            if (balance.eq(0)) {
                return [];
            }

            const nfts = [];

            try {
                // Получаем основной токен пользователя
                const tokenId = await membershipSBT.tokenOf(address);
                const membershipData = await membershipSBT.membershipOf(tokenId);

                let role = 'unknown';
                let poolId = 'unknown';

                try {
                    role = ethers.utils.parseBytes32String(membershipData.role);
                    poolId = ethers.utils.parseBytes32String(membershipData.poolId);
                } catch (parseError) {
                    console.warn('Error parsing NFT data:', parseError);
                    role = membershipData.role || 'unknown';
                    poolId = membershipData.poolId || 'unknown';
                }

                nfts.push({
                    tokenId: tokenId.toString(),
                          type: 'membership',
                          role: membershipData.role,
                          poolId: membershipData.poolId,
                          joinTimestamp: membershipData.joinTimestamp,
                          active: membershipData.active || true,
                          roleText: role,
                          poolIdText: poolId
                });

            } catch (tokenError) {
                console.warn('Error getting token data:', tokenError);
            }

            console.log(`Found ${nfts.length} NFTs for user ${address}`);
            return nfts;

        } catch (error) {
            console.error('Error getting user NFTs:', error);
            return [];
        }
    }

    // =============== МЕТОД ДЛЯ МИНТИНГА NFT ПРИ ОДОБРЕНИИ ЗАПРОСОВ ===============

    async mintMembershipNFTForUser(userAddress, poolId, role, reason = '') {
        try {
            if (!this.initialized) {
                throw new Error('Contracts not initialized');
            }

            console.log('Minting NFT for user:', { userAddress, poolId, role, reason });

            // Проверяем админские права текущего пользователя
            const adminRights = await this.checkAdminRights(wallet.account);
            if (!adminRights.hasAdminRights) {
                throw new Error('Admin rights required to mint NFT');
            }

            const membershipSBT = this.getContract('membershipSBT');
            if (!membershipSBT) {
                throw new Error('MEMBERSHIP_SBT contract not available');
            }

            // Проверяем, есть ли уже NFT у пользователя
            const existingBalance = await membershipSBT.balanceOf(userAddress);
            if (existingBalance.gt(0)) {
                console.log('User already has NFT, checking if we can update role...');

                // Если у пользователя уже есть NFT, можно попробовать обновить роль
                // Это зависит от конкретной реализации контракта
                const tokenId = await membershipSBT.tokenOf(userAddress);

                // Попытка обновления роли (если контракт поддерживает)
                try {
                    const roleBytes32 = ethers.utils.formatBytes32String(role);
                    const poolIdBytes32 = ethers.utils.formatBytes32String(poolId);

                    // Вызываем функцию обновления, если она есть
                    const tx = await membershipSBT.updateMembership(tokenId, roleBytes32, poolIdBytes32);
                    const receipt = await tx.wait();

                    console.log('NFT role updated successfully:', receipt);
                    return receipt;

                } catch (updateError) {
                    console.warn('Cannot update existing NFT, user already has one:', updateError);
                    throw new Error('User already has membership NFT and role cannot be updated');
                }
            }

            // Минтим новый NFT
            const roleBytes32 = ethers.utils.formatBytes32String(role);
            const poolIdBytes32 = ethers.utils.formatBytes32String(poolId);

            // Параметры для минтинга (зависят от реализации контракта)
            const mintParams = {
                to: userAddress,
                role: roleBytes32,
                poolId: poolIdBytes32,
                // Дополнительные параметры в зависимости от контракта
            };

            console.log('Minting NFT with params:', mintParams);

            // ИСПРАВЛЕНО: добавляем tokenURI (4-й параметр)
            const tokenURI = `https://satoshifi.io/nft/${poolId}/${role}`;

            // Вызываем функцию минтинга с правильными параметрами: (to, poolId, role, tokenURI)
            const tx = await membershipSBT.mint(userAddress, poolIdBytes32, roleBytes32, tokenURI);
            const receipt = await tx.wait();

            console.log('NFT minted successfully:', receipt);

            // Проверяем что NFT действительно создался
            const newBalance = await membershipSBT.balanceOf(userAddress);
            if (newBalance.eq(0)) {
                throw new Error('NFT minting failed - balance still zero');
            }

            return receipt;

        } catch (error) {
            console.error('Failed to mint membership NFT:', error);
            throw error;
        }
    }

    // =============== МНОЖЕСТВЕННЫЙ МИНТИНГ ДЛЯ DKG ГРУПП ===============

    async mintNFTsForDKGParticipants(participants, sessionId, reason = '') {
        try {
            console.log('Minting NFTs for DKG participants:', participants.length);

            const results = {
                successes: [],
                failures: [],
                allSucceeded: false
            };

            for (const participantAddress of participants) {
                try {
                    const receipt = await this.mintMembershipNFTForUser(
                        participantAddress,
                        'dkg_session_' + sessionId.slice(0, 8),
                                                                        'pool_manager',
                                                                        `DKG Session: ${reason}`
                    );

                    results.successes.push({
                        address: participantAddress,
                        receipt: receipt
                    });

                    console.log(`NFT minted for ${participantAddress}`);

                } catch (error) {
                    console.error(`Failed to mint NFT for ${participantAddress}:`, error);
                    results.failures.push({
                        address: participantAddress,
                        error: error.message
                    });
                }
            }

            results.allSucceeded = results.failures.length === 0;

            console.log('DKG NFT minting results:', {
                total: participants.length,
                successes: results.successes.length,
                failures: results.failures.length,
                allSucceeded: results.allSucceeded
            });

            return results;

        } catch (error) {
            console.error('Error in bulk NFT minting for DKG:', error);
            throw error;
        }
    }

    // =============== ДИАГНОСТИЧЕСКИЕ МЕТОДЫ ===============

    async diagnoseAdminRights(address = wallet.account) {
        console.log('=== ADMIN RIGHTS DIAGNOSTIC ===');
        console.log('Checking address:', address);
        console.log('Contracts initialized:', this.initialized);

        if (!this.initialized) {
            console.log('❌ Cannot check - contracts not initialized');
            return;
        }

        try {
            const membershipSBT = this.getContract('membershipSBT');
            console.log('MEMBERSHIP_SBT contract available:', !!membershipSBT);

            if (membershipSBT) {
                const balance = await membershipSBT.balanceOf(address);
                console.log('User NFT balance:', balance.toString());

                if (balance.gt(0)) {
                    const tokenId = await membershipSBT.tokenOf(address);
                    console.log('Token ID:', tokenId.toString());

                    const membershipData = await membershipSBT.membershipOf(tokenId);
                    console.log('Membership data:', membershipData);

                    try {
                        const role = ethers.utils.parseBytes32String(membershipData.role);
                        console.log('Parsed role:', role);
                    } catch (e) {
                        console.log('Raw role (parsing failed):', membershipData.role);
                    }
                }
            }

            // Проверяем Factory как fallback
            const factory = this.getContract('factory');
            console.log('Factory contract available:', !!factory);

            if (factory) {
                try {
                    const DEFAULT_ADMIN_ROLE = ethers.utils.id("DEFAULT_ADMIN_ROLE");
                    const hasDefaultAdmin = await factory.hasRole(DEFAULT_ADMIN_ROLE, address);
                    console.log('Has DEFAULT_ADMIN_ROLE in Factory:', hasDefaultAdmin);
                } catch (e) {
                    console.log('Factory role check failed:', e.message);
                }
            }

            // Финальная проверка
            const result = await this.checkAdminRights(address);
            console.log('Final admin rights result:', result);

        } catch (error) {
            console.error('Diagnostic error:', error);
        }
    }

    // =============== РАБОТА С ПУЛАМИ ===============

    async getPoolComponents(poolCore) {
        try {
            // Используем V2 версии контрактов
            const coreContract = await ethers.getContractAt("MiningPoolCoreV2", poolCore);
            const rewardsAddress = await coreContract.poolRewards();
            const rewardsContract = await ethers.getContractAt("MiningPoolRewardsV2", rewardsAddress);

            return {
                core: coreContract,
                rewards: rewardsContract,
                coreAddress: poolCore,
                rewardsAddress: rewardsAddress
            };
        } catch (error) {
            console.error('Failed to get pool components:', error);
            throw error;
        }
    }

    async checkPoolRegistration(poolAddress) {
        try {
            const factory = this.getContract('factory');
            return await factory.isValidPool(poolAddress);
        } catch (error) {
            console.error('Error checking pool registration:', error);
            return false;
        }
    }

    // =============== СЛУШАТЕЛИ СОБЫТИЙ (ОБНОВЛЕННЫЕ) ===============

    setupEventListeners() {
        try {
            // Слушаем события создания пулов
            this.onPoolCreated(async (event) => {
                console.log('Pool created event detected:', event);
                if (event.args && wallet.connected && event.transactionHash) {
                    const tx = await this.provider.getTransaction(event.transactionHash);
                    if (tx.from.toLowerCase() === wallet.account.toLowerCase()) {
                        console.log('Pool created by current user');
                    }
                }
            });

            // НОВОЕ: Слушаем события завершения DKG
            this.onDKGCompleted(async (event) => {
                console.log('DKG completed event detected:', event);

                if (window.dkgManager && event.args) {
                    const sessionId = event.args.sessionId.toString();
                    const groupPubkey = event.args.groupPubkey;

                    // Обновляем кеш сессии
                    const session = dkgManager.sessionsCache.get(sessionId);
                    if (session) {
                        session.state = 4;
                        session.groupPubkey = groupPubkey;
                        session.authorizationChecked = false; // Нужно проверить роли

                        // Автоматически проверяем роли участников
                        await dkgManager.checkAndRequestRoles(sessionId);
                    }
                }
            });

            // ИСПРАВЛЕНО: Слушаем события минтинга NFT с правильным событием
            this.onMembershipMinted(async (event) => {
                console.log('Membership NFT minted:', event);

                if (event.args && wallet.connected) {
                    // Проверяем разные возможные структуры события
                    const to = event.args.to || event.args.owner || event.args[1]; // Transfer событие: from, to, tokenId
                    if (to && to.toLowerCase() === wallet.account.toLowerCase()) {
                        console.log('NFT minted to current user, refreshing authorization data');
                        setTimeout(async () => {
                            if (window.userRoles && userRoles.detectUserRoles) {
                                await userRoles.detectUserRoles(wallet.account);
                                userRoles.applyRoleBasedUI();

                                if (window.app) {
                                    app.updateAuthorizationUI();
                                }
                            }
                        }, 2000);
                    }
                }
            });

        } catch (error) {
            console.error('Failed to setup event listeners:', error);
        }
    }

    // =============== EVENT LISTENERS ===============

    onPoolCreated(callback) {
        try {
            const factory = this.getContract('factory');
            factory.on('PoolCreated', (...args) => {
                const event = args[args.length - 1];
                callback(event);
            });
        } catch (error) {
            console.error('Failed to set PoolCreated listener:', error);
        }
    }

    onDKGCompleted(callback) {
        try {
            const frost = this.getContract('frostCoordinator');
            frost.on('DKGCompleted', (...args) => {
                const event = args[args.length - 1];
                callback(event);
            });
        } catch (error) {
            console.error('Failed to set DKGCompleted listener:', error);
        }
    }

    onMembershipMinted(callback) {
        try {
            const membership = this.getContract('membershipSBT');

            // ИСПРАВЛЕНО: Слушаем Transfer событие вместо несуществующего
            // NFT контракты используют стандартное Transfer событие
            membership.on('Transfer', (...args) => {
                const event = args[args.length - 1];
                // Только новые минты (from = 0x0)
                if (event.args && event.args.from === ethers.constants.AddressZero) {
                    callback(event);
                }
            });

            // Также пробуем слушать специальное событие если оно существует
            try {
                membership.on('MembershipMinted', (...args) => {
                    const event = args[args.length - 1];
                    callback(event);
                });
            } catch (specialEventError) {
                console.log('MembershipMinted event not available, using Transfer only');
            }

        } catch (error) {
            console.error('Failed to set MembershipMinted listener:', error);
        }
    }

    // ===============  ===============

    getContract(name) {
        if (!this.initialized) {
            throw new Error('Contracts not initialized');
        }

        // Алиасы для совместимости
        const aliases = {
            'FROST_COORDINATOR': 'frostCoordinator',
            'frost': 'frostCoordinator',
            'membership': 'membershipSBT',
            'MEMBERSHIP_SBT': 'membershipSBT'
        };

        const contractName = aliases[name] || name;

        if (!this.contracts.has(contractName)) {
            console.log('Available contracts:', Array.from(this.contracts.keys()));
            throw new Error(`Contract ${name} (${contractName}) not found`);
        }

        return this.contracts.get(contractName);
    }

    async initializeWithSigner(signer) {
        this.signer = signer;
        this.provider = signer.provider;

        await this.initialize();

        console.log('Contracts reinitialized with signer for events');
    }

    // Remove all event listeners
    removeAllListeners() {
        try {
            Object.values(this.contracts).forEach(contract => {
                if (contract && contract.removeAllListeners) {
                    contract.removeAllListeners();
                }
            });
            console.log('All contract event listeners removed');
        } catch (error) {
            console.error('Error removing event listeners:', error);
        }
    }

    hasRole(roleId) {
        return window.userRoles && userRoles.hasRole && userRoles.hasRole(roleId);
    }
}

// Создаем глобальный экземпляр
window.contracts = new ContractsManager();
