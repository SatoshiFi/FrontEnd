// satoshifi-landing.js - Main landing page logic for SatoshiFi

class SatoshiFiLanding {
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
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.satoshiFi = new SatoshiFiLanding();
});

// Export for use in other scripts
window.SatoshiFiLanding = SatoshiFiLanding;
