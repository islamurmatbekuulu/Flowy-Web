const WAITLIST_STATE_KEY = 'flowy_waitlist_joined';
const WAITLIST_IFRAME_NAME = 'waitlist-submit-frame';
const WAITLIST_RESPONSE_TIMEOUT_MS = 12000;
const FALLBACK_WAITLIST_COUNT = 16;
const WAITLIST_COUNT_API_URL = 'https://script.google.com/macros/s/AKfycbzuNsePfdKgmaQta0udr6UpLlbTcxNQWh3mnmvkd-nwpyfI3qpjB43ccGKw1KMV0Rin5Q/exec';

document.addEventListener('DOMContentLoaded', () => {
    initImageFallbacks();
    initPhoneCarousel();

    const waitlistCount = initWaitlistCount();
    initStickyNav();
    initWaitlistForms(waitlistCount);
    initPrivacyModal();
});

function initImageFallbacks() {
    document.querySelectorAll('[data-fallback-src]').forEach((img) => {
        img.addEventListener('error', () => {
            if (img.dataset.fallbackApplied === 'true') {
                return;
            }

            img.dataset.fallbackApplied = 'true';
            img.src = img.dataset.fallbackSrc;
        });
    });

    document.querySelectorAll('[data-hide-on-error]').forEach((img) => {
        img.addEventListener('error', () => {
            img.hidden = true;
        });
    });
}

function initPhoneCarousel() {
    const screens = Array.from(document.querySelectorAll('.phone-screen img'));
    if (!screens.length) {
        return;
    }

    const durations = [3000, 1500, 2500, 3500, 2000, 3000, 4000];

    const showScreen = (index) => {
        screens.forEach((screen, screenIndex) => {
            screen.classList.toggle('active', screenIndex === index);
        });
    };

    const cycle = (index) => {
        showScreen(index);

        window.setTimeout(() => {
            cycle((index + 1) % screens.length);
        }, durations[index] ?? 3000);
    };

    showScreen(0);
    window.setTimeout(() => {
        cycle(1 % screens.length);
    }, durations[0]);
}

function initWaitlistCount() {
    let currentCount = FALLBACK_WAITLIST_COUNT;
    const countDisplays = Array.from(document.querySelectorAll('.waitlist-number-display'));

    const updateDisplays = (animate = false) => {
        if (!countDisplays.length) {
            return;
        }

        countDisplays.forEach((display) => {
            display.textContent = String(currentCount);

            if (animate) {
                display.classList.add('just-updated');
                window.setTimeout(() => {
                    display.classList.remove('just-updated');
                }, 1000);
            }
        });
    };

    if (!countDisplays.length) {
        return {
            increment() {
                currentCount += 1;
            },
        };
    }

    updateDisplays();

    if (WAITLIST_COUNT_API_URL) {
        fetch(WAITLIST_COUNT_API_URL)
            .then((response) => response.json())
            .then((data) => {
                if (data && typeof data.count === 'number') {
                    currentCount = data.count;
                    updateDisplays();
                }
            })
            .catch(() => {
                updateDisplays();
            });
    }

    return {
        increment() {
            currentCount += 1;
            updateDisplays(true);
        },
    };
}

function initStickyNav() {
    const nav = document.getElementById('site-nav');
    const sentinel = document.getElementById('nav-sentinel');

    if (!nav || !sentinel || !('IntersectionObserver' in window)) {
        return;
    }

    const navObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        nav.classList.toggle('is-sticky', !entry.isIntersecting);
    }, { threshold: 0 });

    navObserver.observe(sentinel);
}

function initWaitlistForms(waitlistCount) {
    const formGroups = Array.from(document.querySelectorAll('.form-group'));
    const submissionFrame = document.getElementById(WAITLIST_IFRAME_NAME);

    if (!formGroups.length || !submissionFrame) {
        return;
    }

    let hasJoined = localStorage.getItem(WAITLIST_STATE_KEY) === 'true';
    let pendingSubmission = null;

    const syncGroupState = (group, joined) => {
        const form = group.querySelector('.waitlist-form');
        const successMessage = group.querySelector('.success-message');

        if (!form || !successMessage) {
            return;
        }

        form.classList.toggle('is-hidden', joined);
        form.setAttribute('aria-hidden', joined ? 'true' : 'false');
        successMessage.classList.toggle('is-visible', joined);
        successMessage.setAttribute('aria-hidden', joined ? 'false' : 'true');
    };

    const showJoinedState = () => {
        formGroups.forEach((group) => syncGroupState(group, true));
    };

    const resetPendingSubmission = (showValidationMessage = false) => {
        if (!pendingSubmission) {
            return;
        }

        window.clearTimeout(pendingSubmission.timeoutId);
        pendingSubmission.form.dataset.submitting = 'false';
        pendingSubmission.button.disabled = false;
        pendingSubmission.button.textContent = pendingSubmission.originalLabel;

        if (showValidationMessage) {
            pendingSubmission.input.setCustomValidity('We could not confirm your request. Please try again or email team@heyflowy.app.');
            pendingSubmission.input.reportValidity();
            pendingSubmission.input.setCustomValidity('');
        }

        pendingSubmission = null;
    };

    if (hasJoined) {
        showJoinedState();
    } else {
        formGroups.forEach((group) => syncGroupState(group, false));
    }

    formGroups.forEach((group) => {
        const form = group.querySelector('.waitlist-form');
        const input = group.querySelector('.email-input');
        const button = group.querySelector('.cta-button');

        if (!form || !input || !button) {
            return;
        }

        form.setAttribute('target', WAITLIST_IFRAME_NAME);

        form.addEventListener('submit', (event) => {
            if (form.dataset.submitting === 'true' || pendingSubmission) {
                event.preventDefault();
                return;
            }

            if (!form.reportValidity()) {
                event.preventDefault();
                return;
            }

            form.dataset.submitting = 'true';
            button.disabled = true;
            const originalLabel = button.textContent;
            button.textContent = 'Joining...';

            pendingSubmission = {
                form,
                input,
                button,
                originalLabel,
                timeoutId: window.setTimeout(() => {
                    resetPendingSubmission(true);
                }, WAITLIST_RESPONSE_TIMEOUT_MS),
            };
        });
    });

    submissionFrame.addEventListener('load', () => {
        if (!pendingSubmission) {
            return;
        }

        window.clearTimeout(pendingSubmission.timeoutId);
        pendingSubmission = null;

        const isFirstJoin = !hasJoined;
        hasJoined = true;
        localStorage.setItem(WAITLIST_STATE_KEY, 'true');

        if (isFirstJoin) {
            waitlistCount.increment();
        }

        showJoinedState();
    });
}

function initPrivacyModal() {
    const privacyLink = document.getElementById('privacy-link');
    const privacyModal = document.getElementById('privacy-modal');
    const modalClose = document.getElementById('modal-close');
    const modalOverlay = document.getElementById('modal-overlay');
    const pageShell = document.getElementById('page-shell');

    if (!privacyLink || !privacyModal || !modalClose || !modalOverlay) {
        return;
    }

    let lastFocusedElement = null;

    const getFocusableElements = () => {
        const selectors = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
        ].join(',');

        return Array.from(privacyModal.querySelectorAll(selectors)).filter((element) => {
            return !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true';
        });
    };

    const handleKeydown = (event) => {
        if (!privacyModal.classList.contains('is-visible')) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            closeModal();
            return;
        }

        if (event.key !== 'Tab') {
            return;
        }

        const focusableElements = getFocusableElements();
        if (!focusableElements.length) {
            event.preventDefault();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    };

    const openModal = (event) => {
        event.preventDefault();
        lastFocusedElement = document.activeElement;

        privacyModal.classList.add('is-visible');
        privacyModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');

        if (pageShell) {
            pageShell.setAttribute('aria-hidden', 'true');
            if ('inert' in pageShell) {
                pageShell.inert = true;
            }
        }

        document.addEventListener('keydown', handleKeydown);
        window.requestAnimationFrame(() => {
            modalClose.focus();
        });
    };

    const closeModal = () => {
        privacyModal.classList.remove('is-visible');
        privacyModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('modal-open');

        if (pageShell) {
            pageShell.removeAttribute('aria-hidden');
            if ('inert' in pageShell) {
                pageShell.inert = false;
            }
        }

        document.removeEventListener('keydown', handleKeydown);

        if (lastFocusedElement instanceof HTMLElement) {
            lastFocusedElement.focus();
        } else {
            privacyLink.focus();
        }
    };

    privacyLink.addEventListener('click', openModal);
    modalClose.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);
}
