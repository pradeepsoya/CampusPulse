document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('loginForm');
    const usernameField = document.getElementById('usernameField');
    const passwordField = document.getElementById('passwordField');
    const toggleEyeBtn = document.getElementById('toggleEyeBtn');
    const loginBtn = document.getElementById('loginBtn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnSpinner = loginBtn.querySelector('.btn-spinner');
    const btnArrow = loginBtn.querySelector('.btn-arrow');
    const eyeShow = toggleEyeBtn.querySelector('.eye-show');
    const eyeHide = toggleEyeBtn.querySelector('.eye-hide');

    // Show / hide password
    toggleEyeBtn.addEventListener('click', function () {
        const hidden = passwordField.type === 'password';
        passwordField.type = hidden ? 'text' : 'password';
        eyeShow.classList.toggle('d-none', hidden);
        eyeHide.classList.toggle('d-none', !hidden);
        toggleEyeBtn.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
    });

    // Client-side checks (the server still does the real validation)
    function groupOf(id) { return [document.getElementById(id + 'Group'), document.getElementById(id + 'Error')]; }
    function showError(id, msg) {
        const [g, e] = groupOf(id);
        g.classList.add('invalid'); e.textContent = msg; e.classList.add('visible');
    }
    function clearError(id) {
        const [g, e] = groupOf(id);
        g.classList.remove('invalid'); e.textContent = ''; e.classList.remove('visible');
    }
    usernameField.addEventListener('input', () => clearError('username'));
    passwordField.addEventListener('input', () => clearError('password'));

    function resetButton() {
        loginBtn.disabled = false;
        btnText.textContent = 'Sign in';
        btnSpinner.classList.add('d-none');
        btnArrow.classList.remove('d-none');
    }

    form.addEventListener('submit', function (e) {
        let valid = true;
        if (!usernameField.value.trim()) { showError('username', 'Enter your username.'); valid = false; } else { clearError('username'); }
        if (!passwordField.value) { showError('password', 'Enter your password.'); valid = false; } else { clearError('password'); }
        if (!valid) { e.preventDefault(); return; }

        // Disabling the button after submit starts avoids double posts
        // without blocking the normal Django form submission.
        setTimeout(function () {
            loginBtn.disabled = true;
            btnText.textContent = 'Signing in...';
            btnSpinner.classList.remove('d-none');
            btnArrow.classList.add('d-none');
        }, 0);
    });

    // Browser back button can restore the page with the button still disabled
    window.addEventListener('pageshow', function (ev) { if (ev.persisted) resetButton(); });

    // Caps Lock warning
    const caps = document.getElementById('capsWarning');
    function checkCaps(ev) {
        caps.hidden = !(typeof ev.getModifierState === 'function' && ev.getModifierState('CapsLock'));
    }
    passwordField.addEventListener('keydown', checkCaps);
    passwordField.addEventListener('keyup', checkCaps);
    passwordField.addEventListener('blur', () => { caps.hidden = true; });
});