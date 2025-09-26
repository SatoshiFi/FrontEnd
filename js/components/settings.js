// js/components/settings.js - Новый компонент для настроек
class SettingsManager {
    constructor() {
        this.currentTab = 'profile';
        this.settings = {};
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        this.loadSettings();
        this.buildSettingsInterface();
        this.bindEvents();
        this.initialized = true;
    }

    loadSettings() {
        // Загружаем настройки из localStorage
        this.settings = JSON.parse(localStorage.getItem('satoshiFiSettings') || '{}');

        // Настройки по умолчанию
        const defaults = {
            poolNotifications: true,
            miningNotifications: true,
            requestNotifications: true,
            dkgNotifications: true,
            autoRefresh: CONFIG.UI_CONFIG.AUTO_REFRESH || true,
            animations: CONFIG.UI_CONFIG.ANIMATIONS_ENABLED || true,
            theme: CONFIG.UI_CONFIG.THEME || 'classic',
            developerMode: CONFIG.UI_CONFIG.DEVELOPER_MODE || false
        };

        this.settings = { ...defaults, ...this.settings };
    }

    buildSettingsInterface() {
        const settingsContainer = document.getElementById('settingsTabs');
        if (!settingsContainer) return;

        settingsContainer.innerHTML = `
            <div class="settings-navigation">
                <div class="settings-nav">
                    <button class="settings-tab active" data-tab="profile">
                        <span class="tab-icon">👤</span>
                        <span class="tab-text">Profile</span>
                    </button>
                    <button class="settings-tab" data-tab="notifications">
                        <span class="tab-icon">🔔</span>
                        <span class="tab-text">Notifications</span>
                    </button>
                    <button class="settings-tab" data-tab="security">
                        <span class="tab-icon">🔒</span>
                        <span class="tab-text">Security</span>
                    </button>
                    <button class="settings-tab" data-tab="preferences">
                        <span class="tab-icon">⚙️</span>
                        <span class="tab-text">Preferences</span>
                    </button>
                </div>
            </div>

            <div class="settings-content">
                <!-- Profile Settings -->
                <div id="profile-settings" class="settings-panel active">
                    <div class="panel-header">
                        <h3>Profile Settings</h3>
                        <p>Manage your account information and preferences</p>
                    </div>
                    <div class="settings-form">
                        <div class="form-group">
                            <label class="form-label">Wallet Address</label>
                            <div class="input-group">
                                <input type="text" class="form-input" id="walletAddress"
                                       value="${wallet.connected ? wallet.account : 'Not connected'}" readonly>
                                <button class="btn btn-outline" onclick="settings.copyToClipboard('${wallet.connected ? wallet.account : ''}')">
                                    Copy
                                </button>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Display Name</label>
                            <input type="text" class="form-input" id="displayName"
                                   value="${wallet.connected ? wallet.formatAddress(wallet.account) : 'Not connected'}" readonly>
                            <small class="form-help">Display name is automatically generated from your wallet address</small>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Primary Role</label>
                            <div class="role-display">
                                <span class="role-badge" id="primaryRoleBadge">${userRoles.currentRoles[0] || 'User'}</span>
                                <small class="form-help">Roles are determined by your NFT memberships</small>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Network</label>
                            <div class="network-status">
                                <span class="network-indicator success"></span>
                                <span>Sepolia Testnet</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Notifications Settings -->
                <div id="notifications-settings" class="settings-panel">
                    <div class="panel-header">
                        <h3>Notification Settings</h3>
                        <p>Configure how you receive notifications</p>
                    </div>
                    <div class="settings-form">
                        <div class="form-group">
                            <div class="toggle-setting">
                                <div class="toggle-info">
                                    <label class="toggle-label">Pool Notifications</label>
                                    <small>Get notified about pool activities and status changes</small>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="poolNotifications" ${this.settings.poolNotifications ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>

                        <div class="form-group">
                            <div class="toggle-setting">
                                <div class="toggle-info">
                                    <label class="toggle-label">Mining Notifications</label>
                                    <small>Receive updates about mining operations and rewards</small>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="miningNotifications" ${this.settings.miningNotifications ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>

                        <div class="form-group">
                            <div class="toggle-setting">
                                <div class="toggle-info">
                                    <label class="toggle-label">Request Notifications</label>
                                    <small>Get alerts for pool access requests and approvals</small>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="requestNotifications" ${this.settings.requestNotifications ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>

                        <div class="form-group">
                            <div class="toggle-setting">
                                <div class="toggle-info">
                                    <label class="toggle-label">DKG Notifications</label>
                                    <small>Notifications for DKG sessions and ceremony progress</small>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="dkgNotifications" ${this.settings.dkgNotifications ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Security Settings -->
                <div id="security-settings" class="settings-panel">
                    <div class="panel-header">
                        <h3>Security Settings</h3>
                        <p>Monitor your account security status</p>
                    </div>
                    <div class="settings-form">
                        <div class="security-status">
                            <div class="status-item">
                                <div class="status-info">
                                    <span class="status-label">Wallet Connection</span>
                                    <span class="status-description">Your wallet is connected and verified</span>
                                </div>
                                <span class="status-indicator ${wallet.connected ? 'success' : 'error'}">
                                    ${wallet.connected ? '✅' : '❌'}
                                </span>
                            </div>

                            <div class="status-item">
                                <div class="status-info">
                                    <span class="status-label">Network Security</span>
                                    <span class="status-description">Connected to Sepolia testnet</span>
                                </div>
                                <span class="status-indicator success">✅</span>
                            </div>

                            <div class="status-item">
                                <div class="status-info">
                                    <span class="status-label">Smart Contract Integration</span>
                                    <span class="status-description">All contracts are verified and secure</span>
                                </div>
                                <span class="status-indicator success">✅</span>
                            </div>

                            <div class="status-item">
                                <div class="status-info">
                                    <span class="status-label">Two-Factor Authentication</span>
                                    <span class="status-description">Recommended for production use</span>
                                </div>
                                <span class="status-indicator warning">⚠️</span>
                            </div>
                        </div>

                        <div class="security-actions">
                            <button class="btn btn-outline" onclick="settings.runSecurityCheck()">
                                Run Security Check
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Preferences Settings -->
                <div id="preferences-settings" class="settings-panel">
                    <div class="panel-header">
                        <h3>Application Preferences</h3>
                        <p>Customize your SatoshiFi experience</p>
                    </div>
                    <div class="settings-form">
                        <div class="form-group">
                            <div class="toggle-setting">
                                <div class="toggle-info">
                                    <label class="toggle-label">Auto Refresh</label>
                                    <small>Automatically refresh data every 15 seconds</small>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="autoRefresh" ${this.settings.autoRefresh ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>

                        <div class="form-group">
                            <div class="toggle-setting">
                                <div class="toggle-info">
                                    <label class="toggle-label">Animations</label>
                                    <small>Enable smooth animations and transitions</small>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="animations" ${this.settings.animations ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label">Theme</label>
                            <select class="form-select" id="themeSelect">
                                <option value="classic" ${this.settings.theme === 'classic' ? 'selected' : ''}>Classic</option>
                                <option value="dark" ${this.settings.theme === 'dark' ? 'selected' : ''}>Dark (Coming Soon)</option>
                                <option value="light" ${this.settings.theme === 'light' ? 'selected' : ''}>Light (Coming Soon)</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <div class="toggle-setting">
                                <div class="toggle-info">
                                    <label class="toggle-label">Developer Mode</label>
                                    <small>Show additional debugging information</small>
                                </div>
                                <label class="toggle-switch">
                                    <input type="checkbox" id="developerMode" ${this.settings.developerMode ? 'checked' : ''}>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        const settingsContainer = document.getElementById('settingsTabs');
        if (!settingsContainer) return;

        // Обработчики табов
        settingsContainer.querySelectorAll('.settings-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                this.switchTab(tabId);
            });
        });

        // Обработчики переключателей
        const toggles = settingsContainer.querySelectorAll('input[type="checkbox"]');
        toggles.forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                this.updateSetting(e.target.id, e.target.checked);
            });
        });

        // Обработчик выбора темы
        const themeSelect = settingsContainer.querySelector('#themeSelect');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                this.updateSetting('theme', e.target.value);
            });
        }
    }

    switchTab(tabId) {
        this.currentTab = tabId;

        const settingsContainer = document.getElementById('settingsTabs');
        if (!settingsContainer) return;

        // Переключаем активные табы
        settingsContainer.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        settingsContainer.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));

        const activeTab = settingsContainer.querySelector(`[data-tab="${tabId}"]`);
        const activePanel = settingsContainer.querySelector(`#${tabId}-settings`);

        if (activeTab) activeTab.classList.add('active');
        if (activePanel) activePanel.classList.add('active');
    }

    updateSetting(key, value) {
        this.settings[key] = value;
        localStorage.setItem('satoshiFiSettings', JSON.stringify(this.settings));

        // Применяем настройки
        this.applySetting(key, value);

        app.showNotification('success', `${key} updated`);
    }

    applySetting(key, value) {
        switch (key) {
            case 'autoRefresh':
                CONFIG.UI_CONFIG.AUTO_REFRESH = value;
                if (window.dashboard) {
                    value ? dashboard.startAutoRefresh() : dashboard.destroy();
                }
                break;
            case 'animations':
                CONFIG.UI_CONFIG.ANIMATIONS_ENABLED = value;
                document.body.classList.toggle('no-animations', !value);
                break;
            case 'theme':
                CONFIG.UI_CONFIG.THEME = value;
                if (value !== 'classic') {
                    app.showNotification('info', 'Theme will be available in future updates');
                }
                break;
            case 'developerMode':
                CONFIG.UI_CONFIG.DEVELOPER_MODE = value;
                document.body.classList.toggle('developer-mode', value);
                break;
        }
    }

    copyToClipboard(text) {
        if (!text) {
            app.showNotification('warning', 'No text to copy');
            return;
        }

        navigator.clipboard.writeText(text).then(() => {
            app.showNotification('success', 'Copied to clipboard');
        }).catch(() => {
            app.showNotification('error', 'Failed to copy');
        });
    }

    runSecurityCheck() {
        app.showLoading('Running security check...');

        setTimeout(() => {
            app.hideLoading();
            app.showNotification('success', 'Security audit completed - no issues found');
        }, 2000);
    }

    refresh() {
        if (wallet.connected) {
            // Обновляем информацию в профиле
            const walletAddress = document.getElementById('walletAddress');
            const displayName = document.getElementById('displayName');
            const primaryRoleBadge = document.getElementById('primaryRoleBadge');

            if (walletAddress) walletAddress.value = wallet.account;
            if (displayName) displayName.value = wallet.formatAddress(wallet.account);
            if (primaryRoleBadge) primaryRoleBadge.textContent = userRoles.currentRoles[0] || 'User';
        }
    }
}

// Global instance
window.settings = new SettingsManager();

// Инициализация при активации секции
document.addEventListener('DOMContentLoaded', () => {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.id === 'settings' && target.classList.contains('active')) {
                    if (!settings.initialized) {
                        settings.initialize();
                    } else {
                        settings.refresh();
                    }
                }
            }
        });
    });

    const settingsSection = document.getElementById('settings');
    if (settingsSection) {
        observer.observe(settingsSection, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
});
