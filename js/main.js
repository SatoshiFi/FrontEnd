// satoshifi-landing.js - Main landing page logic for SatoshiFi

class SatoshiFiMain {
    constructor() {
        this.init();
    }

    init() {
        // Setup smooth scrolling
        this.setupSmoothScroll();

        // Setup scroll animations
        this.setupScrollAnimations();

        // Setup header scroll effect
        this.setupHeaderScroll();

        // Initialize animations
        this.initAnimations();

        // Setup wallet connection
        this.setupWalletConnection();
    }

    setupSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', (e) => {
                e.preventDefault();
                const target = document.querySelector(anchor.getAttribute('href'));

                if (target) {
                    const headerOffset = 80;
                    const elementPosition = target.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    setupScrollAnimations() {
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '0';
                    entry.target.style.transform = 'translateY(30px)';

                    setTimeout(() => {
                        entry.target.style.transition = 'all 0.8s ease';
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, 100);

                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Observe all cards and sections
        const animatedElements = document.querySelectorAll(
            '.feature-card, .technical-card, .network-card, .section-title'
        );

        animatedElements.forEach(el => {
            observer.observe(el);
        });
    }

    setupHeaderScroll() {
        const header = document.querySelector('header');
        let lastScroll = 0;

        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;

            if (currentScroll > 100) {
                header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
                header.style.background = 'rgba(255, 255, 255, 0.98)';
            } else {
                header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.05)';
                header.style.background = '#fff';
            }

            lastScroll = currentScroll;
        });
    }

    initAnimations() {
        // Add initial fade-in for hero content
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            heroContent.style.opacity = '0';
            heroContent.style.transform = 'translateY(20px)';

            setTimeout(() => {
                heroContent.style.transition = 'all 1s ease';
                heroContent.style.opacity = '1';
                heroContent.style.transform = 'translateY(0)';
            }, 100);
        }

        // Add hover effects for cards
        const cards = document.querySelectorAll('.feature-card, .technical-card, .network-card');
        cards.forEach(card => {
            card.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-5px)';
            });

            card.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
            });
        });

        // Animate stats when in view
        this.animateStats();
    }

    animateStats() {
        const animateValue = (element, start, end, duration) => {
            const range = end - start;
            const increment = range / (duration / 16);
            let current = start;

            const timer = setInterval(() => {
                current += increment;
                if (current >= end) {
                    current = end;
                    clearInterval(timer);
                }

                if (element.textContent.includes('%')) {
                    element.textContent = Math.round(current) + '%';
                } else {
                    element.textContent = '+' + Math.round(current) + '%';
                }
            }, 16);
        };

        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const stats = entry.target.querySelectorAll('.network-stat span:last-child');
                    stats.forEach(stat => {
                        const text = stat.textContent;
                        if (text.includes('%')) {
                            const value = parseInt(text.replace(/[^\d]/g, ''));
                            const isNegative = text.includes('-');

                            if (isNegative) {
                                stat.textContent = '0%';
                                setTimeout(() => {
                                    animateValue(stat, 0, -value, 1000);
                                }, 200);
                            } else {
                                stat.textContent = '0%';
                                setTimeout(() => {
                                    animateValue(stat, 0, value, 1000);
                                }, 200);
                            }
                        }
                    });

                    statsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        document.querySelectorAll('.network-card').forEach(card => {
            statsObserver.observe(card);
        });
    }

    setupWalletConnection() {
        const connectButton = document.getElementById('connectWallet');
        const walletStatus = document.querySelector('.wallet-status');

        if (!connectButton) return;

        // Check initial wallet connection
        this.checkWalletConnection(walletStatus);

        connectButton.addEventListener('click', async () => {
            try {
                // Проверка мобильного устройства
                const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

                // Если мобильное устройство и нет ethereum провайдера
                if (isMobile && !window.ethereum) {
                    // Перенаправляем в MetaMask браузер
                    const currentUrl = window.location.href;
                    const metamaskAppDeepLink = `https://metamask.app.link/dapp/${currentUrl.replace(/^https?:\/\//, '')}`;

                    // Показываем сообщение пользователю
                    if (confirm('To connect your wallet on mobile, you need to open this site in MetaMask browser. Click OK to continue.')) {
                        window.location.href = metamaskAppDeepLink;
                    }
                    return;
                }

                // Проверка для десктопа
                if (!isMobile && !window.ethereum) {
                    alert('Please install MetaMask to connect your wallet');
                    window.open('https://metamask.io/download/', '_blank');
                    return;
                }

                // Show loading state
                walletStatus.textContent = 'Connecting...';
                connectButton.disabled = true;

                // Initialize and connect through web3Integrator
                await window.web3Integrator.init();
                const account = await window.web3Integrator.connect();

                // Update UI on success
                if (account) {
                    walletStatus.textContent = `${account.slice(0, 6)}...${account.slice(-4)}`;
                    connectButton.classList.add('connected');

                    // Сохраняем состояние подключения в localStorage
                    localStorage.setItem('walletConnected', 'true');
                }

            } catch (error) {
                console.error('Wallet connection failed:', error);
                walletStatus.textContent = 'Connect Wallet';

                if (error.message.includes('Sepolia')) {
                    alert('Please switch to Sepolia testnet in MetaMask');
                } else if (error.message.includes('User rejected')) {
                    // Пользователь отменил подключение
                    console.log('User cancelled wallet connection');
                } else {
                    alert('Failed to connect wallet. Please try again.');
                }
            } finally {
                connectButton.disabled = false;
            }
        });

        // Listen for state changes
        window.web3Integrator.onStateChange((event, data) => {
            if (event === 'connected' && data.account) {
                walletStatus.textContent = `${data.account.slice(0, 6)}...${data.account.slice(-4)}`;
                connectButton.classList.add('connected');
                localStorage.setItem('walletConnected', 'true');
            } else if (event === 'disconnected') {
                walletStatus.textContent = 'Connect Wallet';
                connectButton.classList.remove('connected');
                localStorage.removeItem('walletConnected');
            }
        });
    }

    async checkWalletConnection(walletStatus) {
        if (window.ethereum) {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    walletStatus.textContent = `${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`;
                    document.getElementById('connectWallet').classList.add('connected');
                }
            } catch (error) {
                console.error('Error checking wallet connection:', error);
            }
        } else {
            // Проверяем, было ли ранее подключение
            const wasConnected = localStorage.getItem('walletConnected');
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            if (wasConnected && isMobile) {
                // Показываем подсказку для мобильных пользователей
                walletStatus.textContent = 'Open in MetaMask';
            }
        }
    }
} // <- Добавлена закрывающая скобка класса

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.satoshiFiMain = new SatoshiFiMain();
});

// Export for use in other scripts
window.SatoshiFiMain = SatoshiFiMain;
