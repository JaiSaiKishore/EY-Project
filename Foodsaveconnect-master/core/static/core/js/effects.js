/**
 * FoodSaver Connect - Bottom Navbar tab switching
 */
(function () {
  'use strict';

  var navItems = document.querySelectorAll('.bottom-nav-item[data-target]');
  var sections = document.querySelectorAll('.content-sections .section');
  var sidebarItems = document.querySelectorAll('.nav-links li[data-target]');

  navItems.forEach(function (item) {
    item.addEventListener('click', function () {
      var target = item.getAttribute('data-target');

      navItems.forEach(function (el) { el.classList.remove('active'); });
      item.classList.add('active');

      sidebarItems.forEach(function (el) {
        el.classList.toggle('active', el.getAttribute('data-target') === target);
      });

      sections.forEach(function (sec) { sec.classList.remove('active'); });
      var targetSection = document.getElementById(target);
      if (targetSection) targetSection.classList.add('active');
    });
  });
})();
