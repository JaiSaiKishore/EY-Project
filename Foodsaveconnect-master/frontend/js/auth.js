/**
 * FoodSaver Connect - Auth Pages Scripts
 * Handles role switching, form submission, GPS, password toggle
 */
(function () {
  'use strict';

  // ===== Role Selector Toggle =====
  var roleButtons = document.querySelectorAll('.role-option');
  var orgGroup = document.getElementById('org-group');
  var availGroup = document.getElementById('availability-group');
  var submitBtn = document.getElementById('submit-btn');
  var currentRole = 'donor';

  function setRole(role) {
    currentRole = role;

    roleButtons.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-role') === role);
    });

    // Toggle role-specific fields (only on signup page)
    if (orgGroup) orgGroup.style.display = (role === 'donor') ? '' : 'none';
    if (availGroup) availGroup.style.display = (role === 'volunteer') ? '' : 'none';

    // Toggle button accent color
    if (submitBtn) {
      if (role === 'volunteer') {
        submitBtn.classList.add('volunteer-accent');
      } else {
        submitBtn.classList.remove('volunteer-accent');
      }
    }
  }

  roleButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setRole(btn.getAttribute('data-role'));
    });
  });

  // Init default
  setRole('donor');

  // ===== Password Visibility Toggle =====
  var toggleBtns = document.querySelectorAll('.password-toggle');
  toggleBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = btn.parentElement.querySelector('input');
      var icon = btn.querySelector('i');
      if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fa fa-eye-slash';
      } else {
        input.type = 'password';
        icon.className = 'fa fa-eye';
      }
    });
  });

  // ===== GPS Location =====
  var gpsBtn = document.getElementById('btn-gps');
  var locationInput = document.getElementById('signup-location');

  if (gpsBtn && locationInput) {
    gpsBtn.addEventListener('click', function () {
      gpsBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';

      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        gpsBtn.innerHTML = '<i class="fa fa-crosshairs"></i>';
        return;
      }

      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var lat = pos.coords.latitude.toFixed(4);
          var lng = pos.coords.longitude.toFixed(4);
          locationInput.value = 'Lat: ' + lat + ', Lng: ' + lng + ' (GPS Locked)';
          gpsBtn.innerHTML = '<i class="fa fa-check" style="color:#2d9a7a"></i>';
        },
        function () {
          alert('Location access denied. Please enter your location manually.');
          gpsBtn.innerHTML = '<i class="fa fa-crosshairs"></i>';
        }
      );
    });
  }

  // ===== Form Submission =====
  var form = document.querySelector('.auth-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var btn = form.querySelector('.btn-auth-submit');
      var msgDiv = document.getElementById('auth-msg');
      var originalHTML = btn.innerHTML;
      var isSignIn = form.id.indexOf('signin') !== -1;

      // Loading state
      btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Processing...';
      btn.disabled = true;

      setTimeout(function () {
        btn.innerHTML = originalHTML;
        btn.disabled = false;

        if (msgDiv) {
          msgDiv.textContent = isSignIn
            ? 'Signed in successfully! Redirecting...'
            : 'Account created! Redirecting...';
          msgDiv.className = 'auth-message success';
        }

        // Store session info
        try {
          sessionStorage.setItem('fs_role', currentRole);
          var nameEl = document.getElementById('signup-name');
          sessionStorage.setItem('fs_user', nameEl ? nameEl.value : 'User');
        } catch (ex) { /* no-op */ }

        // Redirect to landing (in production this would go to the Django dashboard)
        setTimeout(function () {
          window.location.href = 'index.html';
        }, 1200);
      }, 1000);
    });
  }
})();
