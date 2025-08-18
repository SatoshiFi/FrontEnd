// landing.js - Основная логика лендинга SatoshiFi

class SatoshiFiLanding {
    constructor() {
        this.isInitialized = false;
        this.currentStats = {
            networks: 4,
            pools: 12,
            miners: 1200,
            volume: 2800000
        };

        this.init();
    }

    async init() {
        try {
            // Ждем инициализации i18n
            await this.waitForI18n();

            // Инициализируем компоненты
            this.setupNavigation();
            this.setupScrollEffects();
            this.setupLanguageEvents();

            // Показываем контент после загрузки
            this.showContent();

            this.isInitialized = true;
            console.log('SatoshiFi Landing initialized successfully');

        } catch (error) {
            console.error('Failed to initialize SatoshiFi Landing:', error);
        }
    }

    async waitForI18n() {
        return new Promise((resolve) => {
            if (window.i18n && window.i18n.isInitialized) {
                resolve();
                return;
            }

            // Ждем события инициализации i18n
            document.addEventListener('i18nInitialized', resolve, { once: true });

            // Fallback timeout
            setTimeout(resolve, 3000);
        });
    }

    setupNavigation() {
        // Плавная прокрутка для внутренних ссылок
        document.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);

                if (targetElement) {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });

        // Подсветка активного раздела при скролле
        this.setupScrollSpy();
    }

    setupScrollSpy() {
        const sections = document.querySelectorAll('section[id]');
        const navLinks = document.querySelectorAll('nav a[href^="#"]');

        if (sections.length === 0) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const activeLink = document.querySelector(`nav a[href="#${entry.target.id}"]`);

                    // Убираем активный класс со всех ссылок
                    navLinks.forEach(link => link.classList.remove('active'));

                    // Добавляем активный класс к текущей ссылке
                    if (activeLink) {
                        activeLink.classList.add('active');
                    }
                }
            });
        }, {
            rootMargin: '-50% 0px -50% 0px'
        });

        sections.forEach(section => observer.observe(section));
    }

    setupScrollEffects() {
        // Эффекты появления при скролле
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Наблюдаем за элементами для анимации
        const animatedElements = document.querySelectorAll(
            '.feature-card, .technical-card, .network-card'
        );

        animatedElements.forEach(el => {
            el.classList.add('animate-element');
            observer.observe(el);
        });
    }

    animateStats() {
        const statNumbers = document.querySelectorAll('.stat-number');

        const animateNumber = (element, target, suffix = '') => {
            const duration = 2000;
            const steps = 60;
            const increment = target / steps;
            const stepDuration = duration / steps;
            let current = 0;

            const timer = setInterval(() => {
                current += increment;

                if (current >= target) {
                    current = target;
                    clearInterval(timer);
                }

                // Форматируем числа
                let displayValue;
                if (target >= 1000000) {
                    displayValue = (current / 1000000).toFixed(1) + 'M';
                } else if (target >= 1000) {
                    displayValue = (current / 1000).toFixed(1) + 'K';
                } else {
                    displayValue = Math.floor(current).toString();
                }

                element.textContent = displayValue + suffix;
            }, stepDuration);
        };

        // Запускаем анимацию при появлении статистики в viewport
        const statsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Анимируем статистику
                    animateNumber(statNumbers[0], this.currentStats.networks);
                    animateNumber(statNumbers[1], this.currentStats.pools, '+');
                    animateNumber(statNumbers[2], this.currentStats.miners, '+');
                    animateNumber(statNumbers[3], this.currentStats.volume, '');

                    statsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        const statsSection = document.querySelector('.hero-stats');
        if (statsSection) {
            statsObserver.observe(statsSection);
        }
    }

    setupMobileMenu() {
        const menuToggle = document.getElementById('menu-toggle');
        const navMenu = document.getElementById('nav-menu');
        const mobileOverlay = document.getElementById('mobile-overlay');

        if (!menuToggle || !navMenu || !mobileOverlay) return;

        const toggleMenu = () => {
            const isActive = navMenu.classList.contains('active');

            if (isActive) {
                this.closeMobileMenu();
            } else {
                this.openMobileMenu();
            }
        };

        const closeMobileMenu = () => {
            navMenu.classList.remove('active');
            menuToggle.classList.remove('active');
            mobileOverlay.classList.remove('active');
            document.body.classList.remove('menu-open');
        };

        // Привязываем методы к контексту
        this.closeMobileMenu = closeMobileMenu;
        this.openMobileMenu = () => {
            navMenu.classList.add('active');
            menuToggle.classList.add('active');
            mobileOverlay.classList.add('active');
            document.body.classList.add('menu-open');
        };

        // События
        menuToggle.addEventListener('click', toggleMenu);
        mobileOverlay.addEventListener('click', closeMobileMenu);

        // Закрытие при клике на ссылку
        navMenu.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                closeMobileMenu();
            }
        });

        // Закрытие при изменении размера экрана
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                closeMobileMenu();
            }
        });

        // Закрытие при нажатии Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && navMenu.classList.contains('active')) {
                closeMobileMenu();
            }
        });
    }

    setupLanguageEvents() {
        // Слушаем изменения языка
        document.addEventListener('languageChanged', (e) => {
            const { language, languageInfo } = e.detail;
            console.log(`Language changed to: ${language} (${languageInfo.name})`);

            // Добавляем класс для анимации смены языка
            document.body.classList.add('language-changing');
            setTimeout(() => {
                document.body.classList.remove('language-changing');
            }, 300);
        });
    }

    updateStatsForLanguage(language) {
        const statNumbers = document.querySelectorAll('.stat-number');

        // Используем локализованное форматирование чисел
        if (window.i18n && typeof window.i18n.formatNumber === 'function') {
            const formatter = window.i18n;

            if (statNumbers[0]) statNumbers[0].textContent = this.currentStats.networks.toString();
            if (statNumbers[1]) statNumbers[1].textContent = this.currentStats.pools + '+';
            if (statNumbers[2]) statNumbers[2].textContent = formatter.formatNumber(this.currentStats.miners / 1000, {
                maximumFractionDigits: 1
            }) + 'K+';
            if (statNumbers[3]) {
                const formattedVolume = formatter.formatCurrency(this.currentStats.volume, 'USD');
                if (statNumbers[3]) statNumbers[3].textContent = formattedVolume.replace(/\D*(\d+\.?\d*[MK]?)/g, '$$$1');
            }
        }
    }

    showContent() {
        // Убираем индикатор загрузки
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }

        // Показываем основной контент
        document.body.classList.add('content-loaded');

        // Добавляем начальную анимацию hero секции
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            heroContent.classList.add('animate-in');
        }
    }

    // Утилиты для работы с данными
    async fetchStats() {
        try {
            // В реальном приложении здесь был бы API запрос
            // const response = await fetch('/api/stats');
            // const stats = await response.json();

            // Для демо используем статические данные
            return {
                networks: 4,
                pools: Math.floor(Math.random() * 5) + 10, // 10-15
                miners: Math.floor(Math.random() * 500) + 1000, // 1000-1500
                volume: Math.floor(Math.random() * 1000000) + 2000000 // 2-3M
            };
        } catch (error) {
            console.error('Failed to fetch stats:', error);
            return this.currentStats;
        }
    }

    async updateStats() {
        const newStats = await this.fetchStats();
        this.currentStats = newStats;
        this.animateStats();
    }

    showContent() {
        // Убираем индикатор загрузки
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }

        // Показываем основной контент
        document.body.classList.add('content-loaded');

        // Добавляем начальную анимацию hero секции
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            heroContent.classList.add('animate-in');
        }
    }

    // Публичные методы
    getCurrentLanguage() {
        return window.i18n ? window.i18n.getCurrentLanguage() : 'en';
    }

    isRTL() {
        return window.i18n ? window.i18n.isRTL() : false;
    }

    // Метод для обновления контента (для админки)
    updateContent(section, data) {
        console.log(`Updating ${section} with:`, data);
        // Реализация обновления контента
    }
}

// CSS анимации (добавляем в head если еще не добавлено)
function addAnimationStyles() {
    if (document.querySelector('#landing-animations')) return;

    const style = document.createElement('style');
    style.id = 'landing-animations';
    style.textContent = `
    .animate-element {
        opacity: 0;
        transform: translateY(30px);
        transition: all 0.6s ease;
    }

    .animate-element.animate-in {
        opacity: 1;
        transform: translateY(0);
    }

    .hero-content {
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.8s ease;
    }

    .hero-content.animate-in {
        opacity: 1;
        transform: translateY(0);
    }

    .language-changing {
        opacity: 0.8;
        transition: opacity 0.3s ease;
    }

    body.menu-open {
        overflow: hidden;
    }

    body.content-loaded {
        transition: opacity 0.5s ease;
    }

    .feature-card:nth-child(1) { transition-delay: 0.1s; }
    .feature-card:nth-child(2) { transition-delay: 0.2s; }
    .feature-card:nth-child(3) { transition-delay: 0.3s; }
    .feature-card:nth-child(4) { transition-delay: 0.4s; }

    .technical-card:nth-child(1) { transition-delay: 0.1s; }
    .technical-card:nth-child(2) { transition-delay: 0.2s; }
    .technical-card:nth-child(3) { transition-delay: 0.3s; }

    .network-card:nth-child(1) { transition-delay: 0.1s; }
    .network-card:nth-child(2) { transition-delay: 0.2s; }
    .network-card:nth-child(3) { transition-delay: 0.3s; }
    .network-card:nth-child(4) { transition-delay: 0.4s; }

    @media (prefers-reduced-motion: reduce) {
        .animate-element,
        .hero-content,
        .language-changing {
            transition: none;
        }
    }
    `;

    document.head.appendChild(style);
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    addAnimationStyles();
    window.satoshiFiLanding = new SatoshiFiLanding();
});

// Экспорт для использования в других скриптах
window.SatoshiFiLanding = SatoshiFiLanding;
