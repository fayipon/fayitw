(function($){

	$(document).ready(function() {

		/* ---------------------------------------------- /*
		 * Contact form ajax
		/* ---------------------------------------------- */

		$('#contact-form').find('input,textarea').jqBootstrapValidation({
			preventSubmit: true,
			submitError: function($form, event, errors) {
				// additional error messages or events
			},
			submitSuccess: function($form, event) {
				event.preventDefault();

				var submit          = $('#contact-form submit');
				var ajaxResponse    = $('#contact-response');

				var name            = $("input#name").val();
				var email           = $("input#email").val();
				var subject         = $("input#subject").val();
				var message         = $("textarea#message").val();

				$.ajax({
					type: 'POST',
					url: 'assets/php/contact.php',
					dataType: 'json',
					data: {
						name: name,
						email: email,
						subject: subject,
						message: message
					},
					cache: false,
					beforeSend: function(result) {
						submit.empty();
						submit.append('<i class="fa fa-cog fa-spin"></i> Wait...');
					},
					success: function(result) {
						if(result.sendstatus == 1) {
							ajaxResponse.html('<p>' + result.message + '</p>');
							$form.fadeOut(500);
						} else {
							ajaxResponse.html('<p>' + result.message + '</p>');
						}
					}
				});
			}
		});

		/* ---------------------------------------------- /*
		 * Subscribe form ajax
		/* ---------------------------------------------- */

		$('#subscription-form').submit(function(e) {

			e.preventDefault();
			var $form           = $('#subscription-form');
			var submit          = $('#subscription-form submit');
			var ajaxResponse    = $('#subscription-message');
			var email           = $('input#sub-email').val();

			$.ajax({
				type: 'POST',
				url: 'assets/php/subscribe.php',
				dataType: 'json',
				data: {
					email: email
				},
				cache: false,
				beforeSend: function(result) {
					submit.empty();
					submit.append('<i class="fa fa-cog fa-spin"></i> Wait...');
				},
				success: function(result) {
					if(result.sendstatus == 1) {
						ajaxResponse.html('<p>' + result.message + '</p>');
						$form.fadeOut(500);
					} else {
						ajaxResponse.html('<p>' + result.message + '</p>');
					}
				}
			});

		});

	});

})(jQuery);