// Detect screen size changes and adjust layout
function adjustLayout() {
  var screenWidth = window.innerWidth;
  var radius = 250; // Default radius

  if (screenWidth <= 400) {
    radius = 100; // Smaller radius for very small screens
  } else if (screenWidth <= 600) {
    radius = 175; // Reduced radius for small screens
  }

  // Position the items in a circle based on the new radius
  var fields = $('.item'),
    container = $('#container2'),
    width = container.width(),
    height = container.height();
  var angle = 0,
    step = (2 * Math.PI) / fields.length;

  fields.each(function() {
    var x = Math.round(width / 2 + radius * Math.cos(angle) - $(this).width() / 2);
    var y = Math.round(height / 2 + radius * Math.sin(angle) - $(this).height() / 2);
    $(this).css({
      left: x + 'px',
      top: y + 'px'
    });
    angle += step;
  });
}

// Initialize and adjust on resize
document.addEventListener("DOMContentLoaded", function() {
  adjustLayout(); // Adjust layout on page load

  // Change language of center text upon loading
  var userLang = navigator.language || navigator.userLanguage;
  var centerText = document.getElementById("center-text");


  if (userLang.startsWith("it")) {
    centerText.textContent = centerText.getAttribute("data-text-it");
  } else {
    centerText.textContent = centerText.getAttribute("data-text-en");
  }
});

$(window).resize(adjustLayout); // Adjust layout on window resize

$(document).ready(function() {
  $('.item').click(function() {
    var url = $(this).data('link');
    window.open(url, '_blank'); // Open link in a new tab
  });

  $('.item').hover(
    function() {
      $('#info-box').stop().fadeIn().text($(this).data('info'));
    },
    function() {
      $('#info-box').fadeOut();
    }
  );
});
