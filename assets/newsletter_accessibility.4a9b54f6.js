(function ($, Drupal, once) {
  Drupal.behaviors.newsletterAccessibility = {
    attach: function (context, settings) {
      const labels = once(
        "newsletter-keyboard",
        '.form-item-privacy-policy label[tabindex="0"]',
        context
      );

      labels.forEach(function (label) {
        const $label = $(label);
        const $checkbox = $label.prev('input[type="checkbox"]');

        $label.on("keydown", function (e) {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            $checkbox.click();
            $checkbox.focus();
            setTimeout(function () {
              $label.focus();
            }, 50);
          }
        });
      });
    }
  };
})(jQuery, Drupal, once);
