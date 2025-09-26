// js/user-roles.js - ОПТИМИЗИРОВАННАЯ ВЕРСИЯ БЕЗ ЦИКЛОВ
class UserRoleManager {
    constructor() {
        this.currentRoles = [];
        this.permissions = [];
        this.userProfile = {};
        this.nftData = [];
        this.isAuthorized = false;
        this.authorizationStatus = 'checking';
        this.pendingRequests = [];

        // Предотвращение циклов
        this.isDetecting = false;
        this.lastDetectionTime = 0;
        this.detectionCooldown = 5000; // 5 секунд между проверками
    }

    async detectUserRoles(address) {
        // Предотвращаем повторные вызовы
        const now = Date.now();
        if (this.isDetecting || (now - this.lastDetectionTime) < this.detectionCooldown) {
            return this.currentRoles;
        }

        this.isDetecting = true;
        this.lastDetectionTime = now;

        try {
            this.authorizationStatus = 'checking';

            // Проверяем NFT пользователя через контракты (БЕЗ RPC вызовов)
            if (window.contracts && contracts.getUserNFTs) {
                const nfts = await contracts.getUserNFTs(address);
                this.nftData = nfts;

                // Определяем роли на основе NFT
                const roles = this.extractRolesFromNFTs(nfts);

                // Проверяем авторизацию
                this.checkAuthorizationStatus(nfts);

                // Устанавливаем роли
                if (this.isAuthorized) {
                    this.currentRoles = roles.length > 0 ? roles : ['MINER'];
                    this.authorizationStatus = 'authorized';
                } else {
                    this.currentRoles = ['MINER'];
                    this.authorizationStatus = 'unauthorized';
                }
            } else {
                // Fallback если контракты недоступны
                this.currentRoles = ['MINER'];
                this.isAuthorized = false;
                this.authorizationStatus = 'unauthorized';
            }

            this.updatePermissions();
            this.buildUserProfile(address);

            return this.currentRoles;
        } catch (error) {
            console.error('Failed to detect user roles:', error);
            this.currentRoles = ['MINER'];
            this.isAuthorized = false;
            this.authorizationStatus = 'unauthorized';
            return ['MINER'];
        } finally {
            this.isDetecting = false;
        }
    }

    extractRolesFromNFTs(nfts) {
        const roles = new Set();

        nfts.forEach(nft => {
            if (nft.type === 'membership' && nft.active) {
                try {
                    // Извлекаем роль из membership NFT
                    const roleFromNFT = nft.role ? ethers.utils.parseBytes32String(nft.role) : null;

                    if (roleFromNFT) {
                        switch (roleFromNFT.toLowerCase()) {
                            case 'owner':
                                roles.add('POOL_OWNER');
                                break;
                            case 'custodial':
                                roles.add('CUSTODIAL');
                                break;
                            case 'miner':
                                roles.add('MINER');
                                break;
                            case 'initiator':
                                roles.add('INITIATOR');
                                break;
                            default:
                                roles.add('MINER');
                        }
                    }
                } catch (error) {
                    roles.add('MINER');
                }
            }

            // Role badges
            if (nft.type === 'roleBadge' && nft.balance > 0) {
                const additionalRole = this.getRoleFromTemplate(nft.templateId);
                if (additionalRole) {
                    roles.add(additionalRole);
                }
            }
        });

        return Array.from(roles);
    }

    checkAuthorizationStatus(nfts) {
        this.isAuthorized = nfts.some(nft => {
            if (nft.type === 'membership') {
                return nft.active === true;
            }
            if (nft.type === 'roleBadge') {
                return nft.balance > 0;
            }
            return false;
        });
    }

    getRoleFromTemplate(templateId) {
        const templateToRole = {
            '1': 'INITIATOR',
            '2': 'CUSTODIAL',
            '3': 'POOL_OWNER'
        };
        return templateToRole[templateId.toString()] || null;
    }

    updatePermissions() {
        this.permissions = [];

        this.currentRoles.forEach(roleId => {
            const role = CONFIG.USER_ROLES[roleId];
            if (role && role.permissions) {
                this.permissions.push(...role.permissions);
            }
        });

        // Убираем дубликаты
        this.permissions = [...new Set(this.permissions)];

        // Если пользователь не авторизован, ограничиваем права
        if (!this.isAuthorized) {
            this.permissions = this.permissions.filter(perm =>
            ['view_public_info', 'request_access'].includes(perm)
            );
        }
    }

    buildUserProfile(address) {
        const primaryRole = this.currentRoles[0] || 'MINER';
        const roleConfig = CONFIG.USER_ROLES[primaryRole];

        this.userProfile = {
            address: address,
            roles: this.currentRoles,
            primaryRole: primaryRole,
            roleConfig: roleConfig,
            permissions: this.permissions,
            nfts: this.nftData,
            avatar: this.generateAvatar(address),
            displayName: this.formatAddress(address),
            joinedPools: this.getJoinedPools(),
            stats: this.getUserStats(),
            isAuthorized: this.isAuthorized,
            authorizationStatus: this.authorizationStatus,
            pendingRequests: this.pendingRequests
        };
    }

    getJoinedPools() {
        return this.nftData
        .filter(nft => nft.type === 'membership' && nft.active)
        .map(nft => {
            try {
                return {
                    poolId: nft.poolId ? ethers.utils.parseBytes32String(nft.poolId) : 'Unknown',
             role: nft.role ? ethers.utils.parseBytes32String(nft.role) : 'member',
             joinTimestamp: nft.joinTimestamp,
             active: nft.active,
             tokenId: nft.tokenId
                };
            } catch (error) {
                return {
                    poolId: 'Unknown',
                    role: 'member',
                    joinTimestamp: 0,
                    active: false,
                    tokenId: nft.tokenId
                };
            }
        });
    }

    getUserStats() {
        return {
            poolsJoined: this.getJoinedPools().length,
            nftsOwned: this.nftData.length,
            activeRole: this.userProfile.primaryRole,
            authorizationStatus: this.authorizationStatus,
            pendingRequestsCount: this.pendingRequests.length
        };
    }

    // Методы проверки без RPC вызовов
    isUserAuthorized() {
        return this.isAuthorized;
    }

    needsAuthorization() {
        return this.authorizationStatus === 'unauthorized';
    }

    hasPendingRequests() {
        return this.authorizationStatus === 'pending';
    }

    canAccessFeature(feature) {
        if (!this.isAuthorized) {
            return ['view_public', 'request_access', 'connect_wallet'].includes(feature);
        }
        return this.hasPermission(feature);
    }

    hasPermission(permission) {
        return this.permissions.includes(permission);
    }

    hasRole(roleId) {
        return this.currentRoles.includes(roleId);
    }

    getPrimaryRoleColor() {
        const primaryRole = this.currentRoles[0] || 'MINER';
        const roleConfig = CONFIG.USER_ROLES[primaryRole];
        return roleConfig ? roleConfig.primaryColor : '#64748b';
    }

    getDashboardWidgets() {
        if (!this.isAuthorized) {
            return ['authorization-request', 'public-info'];
        }

        const widgets = [];
        this.currentRoles.forEach(roleId => {
            const role = CONFIG.USER_ROLES[roleId];
            if (role && role.dashboardWidgets) {
                widgets.push(...role.dashboardWidgets);
            }
        });

        return [...new Set(widgets)];
    }

    getSidebarSections() {
        if (!this.isAuthorized) {
            return ['dashboard', 'authorization'];
        }

        const sections = [];
        this.currentRoles.forEach(roleId => {
            const role = CONFIG.USER_ROLES[roleId];
            if (role && role.sidebarSections) {
                sections.push(...role.sidebarSections);
            }
        });

        return [...new Set(sections)];
    }

    applyRoleBasedUI() {
        // Добавляем CSS классы для ролей и статуса авторизации
        document.body.className = document.body.className
        .replace(/role-\w+/g, '')
        .replace(/auth-\w+/g, '')
        .trim();

        // Добавляем классы для ролей
        this.currentRoles.forEach(roleId => {
            document.body.classList.add(`role-${roleId.toLowerCase().replace('_', '-')}`);
        });

        // Добавляем класс для статуса авторизации
        document.body.classList.add(`auth-${this.authorizationStatus}`);

        // Управляем видимостью элементов интерфейса
        this.updateUIVisibility();
    }

    updateUIVisibility() {
        const restrictedElements = document.querySelectorAll('[data-auth-required="true"]');
        const authRequestElements = document.querySelectorAll('[data-auth-request="true"]');

        restrictedElements.forEach(el => {
            el.style.display = this.isAuthorized ? '' : 'none';
        });

        authRequestElements.forEach(el => {
            el.style.display = !this.isAuthorized ? '' : 'none';
        });
    }

    // Методы для обновления ролей после получения NFT
    async onNFTReceived(nft) {
        this.nftData.push(nft);

        const newRoles = this.extractRolesFromNFTs(this.nftData);
        this.currentRoles = newRoles.length > 0 ? newRoles : ['MINER'];

        this.checkAuthorizationStatus(this.nftData);

        if (this.isAuthorized) {
            this.authorizationStatus = 'authorized';
        }

        this.updatePermissions();
        this.buildUserProfile(wallet.account);
        this.applyRoleBasedUI();

        if (window.app && app.showNotification) {
            app.showNotification('success', 'Authorization granted! You now have access to all features.');
        }

        if (window.dashboard && dashboard.initialize) {
            await dashboard.initialize();
        }
    }

    // УБРАН МЕТОД refreshUserData - источник циклов

    // Utility methods
    formatAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    generateAvatar(address) {
        if (!address) return '';
        return address.slice(2, 4).toUpperCase();
    }

    getAuthorizationMessage() {
        switch (this.authorizationStatus) {
            case 'checking':
                return 'Checking authorization status...';
            case 'authorized':
                return 'You are authorized to use all features';
            case 'unauthorized':
                return 'Access required. Please request authorization to use platform features.';
            case 'pending':
                return `You have ${this.pendingRequests.length} pending authorization request(s)`;
            default:
                return 'Unknown authorization status';
        }
    }

    getRequiredActionsForUser() {
        const actions = [];

        if (!this.isAuthorized) {
            actions.push({
                action: 'request_access',
                title: 'Request Platform Access',
                description: 'Submit a request to gain access to platform features',
                priority: 'high'
            });
        }

        if (this.isAuthorized && !this.hasRole('POOL_OWNER')) {
            actions.push({
                action: 'create_pool',
                title: 'Create Your First Pool',
                description: 'Create a mining pool to become a pool owner',
                priority: 'medium'
            });
        }

        return actions;
    }
}

// Создаем глобальный экземпляр
window.userRoles = new UserRoleManager();
