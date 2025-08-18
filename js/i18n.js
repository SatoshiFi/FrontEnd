// i18n.js - Система интернационализации для SatoshiFi

class SatoshiFiI18n {
    constructor() {
        this.currentLanguage = 'en';
        this.translations = {};
        this.supportedLanguages = {
            // Tier 1 - Critical
            'en': { name: 'English', flag: '🇺🇸', rtl: false, priority: 1 },
            'zh': { name: '中文', flag: '🇨🇳', rtl: false, priority: 1 },
            'ru': { name: 'Русский', flag: '🇷🇺', rtl: false, priority: 1 },

            // Tier 2 - Mandatory European + Arabic
            'de': { name: 'Deutsch', flag: '🇩🇪', rtl: false, priority: 2 },
            'fr': { name: 'Français', flag: '🇫🇷', rtl: false, priority: 2 },
            'pt': { name: 'Português', flag: '🇧🇷', rtl: false, priority: 2 },
            'ar': { name: 'العربية', flag: '🇸🇦', rtl: true, priority: 2 },

            // Tier 3 - Additional
            'es': { name: 'Español', flag: '🇪🇸', rtl: false, priority: 3 },
            'ja': { name: '日本語', flag: '🇯🇵', rtl: false, priority: 3 },
            'ko': { name: '한국어', flag: '🇰🇷', rtl: false, priority: 3 }
        };

        this.init();
    }

    async init() {
        // Определяем язык по приоритету
        this.currentLanguage = this.detectLanguage();

        // Загружаем переводы
        await this.loadTranslations(this.currentLanguage);

        // Применяем переводы
        this.applyTranslations();

        // Настраиваем интерфейс
        this.setupLanguageSelector();

        // Устанавливаем направление текста
        this.setTextDirection();
    }

    detectLanguage() {
        // 1. Проверяем URL параметр
        const urlLang = this.getUrlLanguage();
        if (urlLang && this.supportedLanguages[urlLang]) {
            return urlLang;
        }

        // 2. Проверяем localStorage
        const savedLang = localStorage.getItem('satoshifi-language');
        if (savedLang && this.supportedLanguages[savedLang]) {
            return savedLang;
        }

        // 3. Проверяем язык браузера
        const browserLang = navigator.language.substring(0, 2);
        if (this.supportedLanguages[browserLang]) {
            return browserLang;
        }

        // 4. Fallback на английский
        return 'en';
    }

    getUrlLanguage() {
        const path = window.location.pathname;
        const langMatch = path.match(/^\/([a-z]{2})\//);
        return langMatch ? langMatch[1] : null;
    }

    async loadTranslations(language) {
        try {
            // Загружаем JSON файл с переводами
            const response = await fetch(`/lang/${language}.json`);
            if (response.ok) {
                this.translations = await response.json();
            } else {
                console.warn(`Translations for ${language} not found, using English`);
                if (language !== 'en') {
                    const enResponse = await fetch('/lang/en.json');
                    this.translations = await enResponse.json();
                }
            }
        } catch (error) {
            console.error('Failed to load translations:', error);
            this.translations = {}; // Fallback to empty object
        }
    }

    translate(key, params = {}) {
        const keys = key.split('.');
        let translation = this.translations;

        for (const k of keys) {
            translation = translation?.[k];
        }

        if (typeof translation !== 'string') {
            console.warn(`Translation missing for key: ${key}`);
            return key; // Return key as fallback
        }

        // Замещаем параметры
        return translation.replace(/\{\{(\w+)\}\}/g, (match, param) => {
            return params[param] || match;
        });
    }

    applyTranslations() {
        // Находим все элементы с data-i18n атрибутом
        const elements = document.querySelectorAll('[data-i18n]');

        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.translate(key);

            // Проверяем, нужно ли обновить HTML или текст
            if (element.hasAttribute('data-i18n-html')) {
                element.innerHTML = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Обновляем атрибуты (placeholder, title, alt)
        const attributeElements = document.querySelectorAll('[data-i18n-attr]');
        attributeElements.forEach(element => {
            const attrConfig = element.getAttribute('data-i18n-attr');
            const [attribute, key] = attrConfig.split(':');
            const translation = this.translate(key);
            element.setAttribute(attribute, translation);
        });

        // Обновляем title страницы
        const titleKey = document.documentElement.getAttribute('data-i18n-title');
        if (titleKey) {
            document.title = this.translate(titleKey);
        }
    }

    async changeLanguage(language) {
        if (!this.supportedLanguages[language]) {
            console.error(`Unsupported language: ${language}`);
            return;
        }

        this.currentLanguage = language;

        // Сохраняем выбор
        localStorage.setItem('satoshifi-language', language);

        // Загружаем новые переводы
        await this.loadTranslations(language);

        // Применяем переводы
        this.applyTranslations();

        // Обновляем направление текста
        this.setTextDirection();

        // Обновляем URL (опционально)
        this.updateUrl(language);

        // Уведомляем о смене языка
        this.dispatchLanguageChange(language);
    }

    setTextDirection() {
        const isRTL = this.supportedLanguages[this.currentLanguage].rtl;
        document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
        document.documentElement.setAttribute('lang', this.currentLanguage);
    }

    updateUrl(language) {
        const currentPath = window.location.pathname;
        const currentSearch = window.location.search;

        // Удаляем существующий язык из URL
        const cleanPath = currentPath.replace(/^\/[a-z]{2}\//, '/');

        // Добавляем новый язык (кроме английского)
        const newPath = language === 'en' ? cleanPath : `/${language}${cleanPath}`;

        // Обновляем URL без перезагрузки
        window.history.replaceState({}, '', newPath + currentSearch);
    }

    setupLanguageSelector() {
        const selector = document.getElementById('language-selector');
        if (!selector) return;

        // Создаем HTML для селектора языков
        const selectorHTML = `
        <div class="language-selector">
        <button class="current-language" id="current-language-btn">
        <span class="lang-flag">${this.supportedLanguages[this.currentLanguage].flag}</span>
        <span class="lang-name">${this.supportedLanguages[this.currentLanguage].name}</span>
        <span class="lang-arrow">▼</span>
        </button>
        <div class="language-dropdown" id="language-dropdown">
        ${Object.entries(this.supportedLanguages).map(([code, lang]) => `
            <button class="language-option ${code === this.currentLanguage ? 'active' : ''}"
            data-lang="${code}">
            <span class="lang-flag">${lang.flag}</span>
            <span class="lang-name">${lang.name}</span>
            </button>
            `).join('')}
            </div>
            </div>
            `;

            selector.innerHTML = selectorHTML;

            // Добавляем обработчики событий
            const currentBtn = selector.querySelector('#current-language-btn');
            const dropdown = selector.querySelector('#language-dropdown');

            currentBtn.addEventListener('click', () => {
                dropdown.classList.toggle('show');
            });

            // Закрытие при клике вне селектора
            document.addEventListener('click', (e) => {
                if (!selector.contains(e.target)) {
                    dropdown.classList.remove('show');
                }
            });

            // Обработчики для опций языка
            selector.querySelectorAll('.language-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    const lang = e.currentTarget.getAttribute('data-lang');
                    this.changeLanguage(lang);
                    dropdown.classList.remove('show');
                });
            });
    }

    dispatchLanguageChange(language) {
        const event = new CustomEvent('languageChanged', {
            detail: { language, languageInfo: this.supportedLanguages[language] }
        });
        document.dispatchEvent(event);
    }

    // Утилиты для форматирования чисел и дат
    formatNumber(number, options = {}) {
        return new Intl.NumberFormat(this.currentLanguage, options).format(number);
    }

    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat(this.currentLanguage, {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    formatDate(date, options = {}) {
        return new Intl.DateTimeFormat(this.currentLanguage, options).format(date);
    }

    // Получение текущего языка
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    // Проверка поддержки RTL
    isRTL() {
        return this.supportedLanguages[this.currentLanguage].rtl;
    }
}

// Экспорт для использования
window.SatoshiFiI18n = SatoshiFiI18n;

// Автоматическая инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    window.i18n = new SatoshiFiI18n();
});
