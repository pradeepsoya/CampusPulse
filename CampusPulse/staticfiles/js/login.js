document.addEventListener('DOMContentLoaded', function () {
    const passwordField = document.getElementById('passwordField');
    const toggleEyeBtn = document.getElementById('toggleEyeBtn');
    const eyeShow = toggleEyeBtn.querySelector('.eye-show');
    const eyeHide = toggleEyeBtn.querySelector('.eye-hide');

    // Show / hide password
    toggleEyeBtn.addEventListener('click', function () {
        const isPassword = passwordField.type === 'password';
        passwordField.type = isPassword ? 'text' : 'password';

        eyeShow.classList.toggle('d-none');
        eyeHide.classList.toggle('d-none');

        toggleEyeBtn.setAttribute(
            'aria-label',
            isPassword ? 'Hide password' : 'Show password'
        );
    });

    // Custom validation
    const form = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnSpinner = loginBtn.querySelector('.btn-spinner');

    const usernameField = document.getElementById('usernameField');
    const usernameGroup = document.getElementById('usernameGroup');
    const usernameError = document.getElementById('usernameError');

    const passwordGroup = document.getElementById('passwordGroup');
    const passwordError = document.getElementById('passwordError');

    function showError(group, errorEl, message) {
        group.classList.add('invalid');
        errorEl.textContent = message;
        errorEl.classList.add('visible');
    }

    function clearError(group, errorEl) {
        group.classList.remove('invalid');
        errorEl.textContent = '';
        errorEl.classList.remove('visible');
    }

    usernameField.addEventListener('input', () => clearError(usernameGroup, usernameError));
    passwordField.addEventListener('input', () => clearError(passwordGroup, passwordError));

    form.addEventListener('submit', function (e) {
        let valid = true;

        if (!usernameField.value.trim()) {
            showError(usernameGroup, usernameError, 'Username is required.');
            valid = false;
        } else {
            clearError(usernameGroup, usernameError);
        }

        if (!passwordField.value) {
            showError(passwordGroup, passwordError, 'Password is required.');
            valid = false;
        } else {
            clearError(passwordGroup, passwordError);
        }

        if (!valid) {
            e.preventDefault();
            return;
        }

        loginBtn.disabled = true;
        btnText.textContent = 'Logging in...';
        btnSpinner.classList.remove('d-none');
    });

    // Subtle click ripple on the login button (visual only)
    loginBtn.addEventListener('click', function (e) {
        const rect = loginBtn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 1.4;
        const ripple = document.createElement('span');

        ripple.className = 'btn-ripple';
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';

        loginBtn.appendChild(ripple);
        ripple.addEventListener('animationend', () => ripple.remove());
    });

    // Every ~10s, give the live telemetry values a soft pulse so the
    // widget feels alive. Values themselves are never changed.
    const telemetryValues = document.querySelectorAll('.telemetry-item strong');

    if (telemetryValues.length) {
        setInterval(function () {
            telemetryValues.forEach((el) => {
                el.classList.remove('pulse');
                // force reflow so the animation can re-trigger
                void el.offsetWidth;
                el.classList.add('pulse');
            });
        }, 10000);
    }
});