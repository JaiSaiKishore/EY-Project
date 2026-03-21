/**
 * FoodSaver Connect - Landing Page Scripts
 * Fetches live stats from the API and handles contact form
 */
(function () {
  'use strict';

  // Fetch live impact stats from the Django API
  function fetchLiveStats() {
    fetch('/api/stats/')
      .then(function (response) {
        if (!response.ok) throw new Error('API not available');
        return response.json();
      })
      .then(function (data) {
        var foodEl = document.getElementById('stat-food');
        var peopleEl = document.getElementById('stat-people');
        var volEl = document.getElementById('stat-volunteers');
        var locEl = document.getElementById('stat-locations');

        if (foodEl) foodEl.textContent = data.food_saved || 2540;
        if (peopleEl) peopleEl.textContent = data.people_fed || 1820;
        if (volEl) volEl.textContent = data.active_volunteers || 340;
        if (locEl) locEl.textContent = data.active_needy_locations || 47;
      })
      .catch(function () {
        // Silently use default counter values already in HTML
      });
  }

  // Try to load live stats if the API is available
  if (window.location.port || window.location.hostname === 'localhost') {
    fetchLiveStats();
  }

  // Contact form handler
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = document.getElementById('name').value.trim();
      var email = document.getElementById('email').value.trim();
      var message = document.getElementById('message').value.trim();
      var msgSubmit = document.getElementById('msgSubmit');

      if (!name || !email || !message) {
        if (msgSubmit) {
          msgSubmit.textContent = 'Please fill in all fields.';
          msgSubmit.className = 'h3 text-center text-danger';
        }
        return;
      }

      // Show success message (no backend form handler in this template)
      if (msgSubmit) {
        msgSubmit.textContent = 'Thank you! We\'ll be in touch soon.';
        msgSubmit.className = 'h3 text-center text-success';
      }

      contactForm.reset();

      // Clear message after 5 seconds
      setTimeout(function () {
        if (msgSubmit) {
          msgSubmit.textContent = '';
          msgSubmit.className = 'h3 text-center hidden';
        }
      }, 5000);
    });
  }
})();
