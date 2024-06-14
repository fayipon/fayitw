(function($){

	"use strict";

	/* ---------------------------------------------- /*
	 * Preloader
	/* ---------------------------------------------- */

	$(window).load(function() {
		$('.page-loader').delay(350).fadeOut('slow');
	});

	$(document).ready(function() {

		var moduleHero      = $('.module-hero'),
			modules         = $('.module-hero, .module, .module-sm'),
			moduleSlideshow = $('.backstretch'),
			cdDate          = $('#countdown').attr('data-countdown'),
			mobileTest;

		/* ---------------------------------------------- /*
		 * Typed JS for Title tag
		/* ---------------------------------------------- */

		$("#title").typed({
			strings: ["Hello!", "You are Welcome!", "Coming Soon!"],
			typeSpeed: 300,
			backDelay: 900,
			loop: true,
			cursorChar: "|",
			contentType: 'html',
			loopCount: false
		});

		/* ---------------------------------------------- /*
		 * Mobile detect
		/* ---------------------------------------------- */

		if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
			mobileTest = true;
		} else {
			mobileTest = false;
		}

		/* ---------------------------------------------- /*
		 * Setting background of modules
		/* ---------------------------------------------- */

		modules.each(function() {
			if ($(this).attr('data-background')) {
				$(this).css('background-image', 'url(' + $(this).attr('data-background') + ')');
			}
		});

		/* ---------------------------------------------- /*
		 * Parallax
		/* ---------------------------------------------- */

		if (mobileTest === true) {
			modules.css({'background-attachment': 'scroll'});
		}

		/* ---------------------------------------------- /*
		 * Slideshow background
		/* ---------------------------------------------- */

		if (moduleSlideshow.length > 0) {
			moduleSlideshow.backstretch([
				  "assets/images/module-3.jpg"
				, "assets/images/module-4.jpg"
				, "assets/images/module-5.jpg"
			], {duration: 3000, fade: 750});
		}

		/* ---------------------------------------------- /*
		 * Youtube video background
		/* ---------------------------------------------- */

		$(function(){
			$('.video-player').mb_YTPlayer();
		});

		/* ---------------------------------------------- /*
		 * Countdown
		/* ---------------------------------------------- */

		$('#countdown').countdown(cdDate, function(event) {
			$(this).html(event.strftime(''
				+ '<div><div>%D</div><i>days</i></div>'
				+ '<div><div>%H</div><i>hours</i></div>'
				+ '<div><div>%M</div><i>minutes</i></div>'
				+ '<div><div>%S</div><i>seconds</i></div>'
			));
		});

		/* ---------------------------------------------- /*
		 * Team Slider
		/* ---------------------------------------------- */

		$('.team-carousel').owlCarousel({
			items: 4,
			stopOnHover:     true,
			singleItem:      false,
			autoHeight:      true,
			navigation:      false,
			pagination:      false,
			slideSpeed:      400,
			paginationSpeed: 1000,
			goToFirstSpeed:  2000,
			autoPlay:        3000,
			navigationText: [
				'<span class="arrow_left"></span>',
				'<span class="arrow_right"></span>'
			],
		});

		/* ---------------------------------------------- /*
		 * WOW Animation
		/* ---------------------------------------------- */

		var wow = new WOW({
			mobile: false
		});

		wow.init();

		/* ---------------------------------------------- /*
		 * Aminate social links
		/* ---------------------------------------------- */

		$('.social-icons-animated a').each(function(i) {
			$(this).attr('data-wow-delay', i * 0.15 + 's');
		});

		/* ---------------------------------------------- /*
		 *
		/* ---------------------------------------------- */

		var heroDivider = $('#hero-divider i');

		$(window).scroll(function() {
			if ( $(window).scrollTop() > 10 ) {
				heroDivider.css( 'line-height', '70px');
			} else {
				heroDivider.css( 'line-height', '50px');
			}
		}).scroll();

		/* ---------------------------------------------- /*
		 * A jQuery plugin for fluid width video embeds
		/* ---------------------------------------------- */

		$('body').fitVids();

		/* ---------------------------------------------- /*
		 * Google Map
		/* ---------------------------------------------- */

		var mapID = $('#map');
		var isDraggable = Math.max($(window).width(), window.innerWidth) > 480 ? true : false;

		mapID.each(function() {

			var GMaddress = mapID.attr('data-address');
			var GMcontact = mapID.attr('data-contact');

			mapID.gmap3({
				action: "init",
				marker: {
					address: GMaddress,
					data:    GMcontact,
					options: {
						icon: 'assets/images/map-icon.png'
					},
					events:{
						mouseover: function(marker, event, context){
							var map = $(this).gmap3("get"),
							infowindow = $(this).gmap3({get:{name:"infowindow"}});

							if (infowindow){
								infowindow.open(map, marker);
								infowindow.setContent(context.data);
							} else {
								$(this).gmap3({
									infowindow:{
										anchor:marker,
										options:{content: context.data}
									}
								});
							}
						},
						mouseout: function(){
							var infowindow = $(this).gmap3({get:{name:"infowindow"}});
							if (infowindow){
								infowindow.close();
							}
						}
					}
				},
				map: {
					options: {
						zoom: 16,
						zoomControl: true,
						zoomControlOptions: {
							style: google.maps.ZoomControlStyle.SMALL
						},
						mapTypeControl: true,
						scaleControl: false,
						scrollwheel: false,
						streetViewControl: false,
						draggable: isDraggable,
						styles: [{"featureType":"all","elementType":"labels.text.fill","stylers":[{"saturation":36},{"color":"#000000"},{"lightness":40}]},{"featureType":"all","elementType":"labels.text.stroke","stylers":[{"visibility":"on"},{"color":"#000000"},{"lightness":16}]},{"featureType":"all","elementType":"labels.icon","stylers":[{"visibility":"off"}]},{"featureType":"administrative","elementType":"geometry.fill","stylers":[{"color":"#000000"},{"lightness":20}]},{"featureType":"administrative","elementType":"geometry.stroke","stylers":[{"color":"#000000"},{"lightness":17},{"weight":1.2}]},{"featureType":"landscape","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":20}]},{"featureType":"poi","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":21}]},{"featureType":"road.highway","elementType":"geometry.fill","stylers":[{"color":"#000000"},{"lightness":17}]},{"featureType":"road.highway","elementType":"geometry.stroke","stylers":[{"color":"#000000"},{"lightness":29},{"weight":0.2}]},{"featureType":"road.arterial","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":18}]},{"featureType":"road.local","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":16}]},{"featureType":"transit","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":19}]},{"featureType":"water","elementType":"geometry","stylers":[{"color":"#000000"},{"lightness":17}]}]
					}
				}
			});

		});

		/* ---------------------------------------------- /*
		 * Scroll Animation
		/* ---------------------------------------------- */

		$('.inner-scroll').on('click', function(e) {
			var target = this.hash;
			var $target = $(target);
			$('html, body').stop().animate({
				'scrollTop': $target.offset().top
			}, 900, 'swing');
			e.preventDefault();
		});

	});

})(jQuery);
