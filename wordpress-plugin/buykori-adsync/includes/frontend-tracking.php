<?php
/**
 * Buykori AdSync — Frontend Tracking
 *
 * ওয়েবসাইটের ফ্রন্টএন্ডে অটোমেটিক ইভেন্ট ট্র্যাকিং:
 * - PageView (প্রতিটি পেজে)
 * - ViewContent (WooCommerce প্রোডাক্ট পেজে)
 * - AddToCart (কার্টে যোগ করলে — AJAX দিয়ে)
 * - InitiateCheckout (চেকআউট পেজে)
 * - Purchase (Thank You / Order Received পেজে)
 *
 * Cache plugin bypass: সব ট্র্যাকিং AJAX/REST API দিয়ে চলে,
 * তাই LiteSpeed/WP Rocket ক্যাশ করলেও ডাটা ফ্রেশ থাকে।
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// ─── Inject Tracker Script ────────────────────────────────────────────────────
/**
 * Resolve the configured tracking mode.
 *
 * One-page landing stores often place product and checkout UI on the same
 * screen. In that case checkout events should wait for user intent instead of
 * firing immediately on page load.
 */
function buykorigw_resolve_tracking_mode( $settings ) {
    $mode = isset( $settings['tracking_mode'] ) ? $settings['tracking_mode'] : 'standard';
    if ( ! in_array( $mode, array( 'standard', 'one_page' ), true ) ) {
        $mode = 'standard';
    }

    if ( $mode === 'one_page' ) {
        return 'one_page';
    }

    $is_landing = false;
    if ( function_exists( 'is_front_page' ) && is_front_page() ) {
        $is_landing = true;
    } elseif ( function_exists( 'is_home' ) && is_home() ) {
        $is_landing = true;
    } elseif ( function_exists( 'is_product' ) && is_product() ) {
        $is_landing = true;
    }

    if (
        $is_landing
        && function_exists( 'is_checkout' )
        && is_checkout()
        && ( ! function_exists( 'is_order_received_page' ) || ! is_order_received_page() )
    ) {
        return 'one_page';
    }

    return 'standard';
}

add_action( 'wp_footer', 'buykorigw_inject_tracker', 99 );

function buykorigw_inject_tracker() {
    $settings = buykorigw_get_settings();

    // Don't load if no API key
    if ( empty( $settings['api_key'] ) ) {
        return;
    }

    // Pass config to JS
    $tracker_data = array(
        'ajax_url'    => admin_url( 'admin-ajax.php' ),
        'rest_url'    => rest_url( 'buykori/v1/track' ),
        'nonce'       => wp_create_nonce( 'buykorigw_track_nonce' ),
        'rest_nonce'  => wp_create_nonce( 'wp_rest' ),
        'tracking_mode' => buykorigw_resolve_tracking_mode( $settings ),
        'content_id_format' => isset( $settings['content_id_format'] ) ? $settings['content_id_format'] : 'id',
        'enable_hybrid' => isset( $settings['enable_hybrid'] ) ? (bool) $settings['enable_hybrid'] : false,
        'enable_variations' => isset( $settings['enable_variations'] ) ? (bool) $settings['enable_variations'] : false,
        'fb_pixel_id'  => isset( $settings['fb_pixel_id'] ) ? trim( $settings['fb_pixel_id'] ) : '',
        'tt_pixel_id'  => isset( $settings['tt_pixel_id'] ) ? trim( $settings['tt_pixel_id'] ) : '',
        'events'      => array(
            'pageview'       => (bool) $settings['enable_pageview'],
            'lead'           => (bool) $settings['enable_lead'],
            'search'         => (bool) $settings['enable_search'],
            'viewcontent'    => (bool) $settings['enable_viewcontent'],
            'addtocart'      => (bool) $settings['enable_addtocart'],
            'viewcart'       => (bool) $settings['enable_viewcart'],
            'removefromcart' => (bool) $settings['enable_removefromcart'],
            'checkout'       => (bool) $settings['enable_checkout'],
            'addpaymentinfo' => (bool) $settings['enable_addpaymentinfo'],
            'purchase'       => (bool) $settings['enable_purchase'],
        ),
    );

    // Add product data if on a WooCommerce product page
    if ( function_exists( 'is_product' ) && is_product() && $settings['enable_viewcontent'] ) {
        global $product;
        if ( $product && is_a( $product, 'WC_Product' ) ) {
            $tracker_data['product'] = array(
                'id'       => $product->get_id(),
                'sku'      => $product->get_sku() ?: (string) $product->get_id(),
                'name'     => $product->get_name(),
                'price'    => (float) $product->get_price(),
                'currency' => get_woocommerce_currency(),
                'category' => implode( ', ', wp_list_pluck( wc_get_product_terms( $product->get_id(), 'product_cat' ), 'name' ) ),
            );
        }
    }

    // Detect page type
    $tracker_data['page_type'] = 'other';
    if ( function_exists( 'is_product' ) && is_product() ) {
        $tracker_data['page_type'] = 'product';
    } elseif ( function_exists( 'is_checkout' ) && is_checkout() && ( ! function_exists( 'is_order_received_page' ) || ! is_order_received_page() ) ) {
        $tracker_data['page_type'] = 'checkout';
    } elseif ( function_exists( 'is_cart' ) && is_cart() ) {
        $tracker_data['page_type'] = 'cart';
    } elseif ( function_exists( 'is_order_received_page' ) && is_order_received_page() ) {
        $tracker_data['page_type'] = 'thankyou';
    } elseif ( is_search() ) {
        $tracker_data['page_type'] = 'search';
        $tracker_data['search_string'] = get_search_query();
    }

    // Add cart data for ViewCart and InitiateCheckout matching/optimization.
    if (
        function_exists( 'buykorigw_get_cart_event_data' ) &&
        ( ( function_exists( 'is_cart' ) && is_cart() ) || ( function_exists( 'is_checkout' ) && is_checkout() && ( ! function_exists( 'is_order_received_page' ) || ! is_order_received_page() ) ) )
    ) {
        $cart_data = buykorigw_get_cart_event_data();
        if ( ! empty( $cart_data ) ) {
            $tracker_data['cart'] = $cart_data;
        }
    }

    echo "<script id='buykorigw-tracker-config'>\n";
    echo "window.buykorigw_config = " . wp_json_encode( $tracker_data ) . ";\n";
    echo "</script>\n";

    echo "<script id='buykorigw-tracker-js'>\n";
    echo buykorigw_get_tracker_js() . "\n";
    echo "</script>\n";
}

// ─── Tracker JavaScript ────────────────────────────────────────────────────────
function buykorigw_get_tracker_js() {
    return <<<'JS'
(function() {
    'use strict';

    var cfg = window.buykorigw_config || {};
    if (!cfg.ajax_url && !cfg.rest_url) return;
    var trackingMode = cfg.tracking_mode || 'standard';
    persistMarketingParams();
    persistTikTokClickId();
    ensureFirstPartyCookies();
    initializeHybridPixels();

    function initializeHybridPixels() {
        if (!cfg.enable_hybrid) return;

        // Gather cached customer data for advanced matching
        var fbUserData = {};
        var ttUserData = {};
        var cookieFields = {
            em: '_buykorigw_id_em',
            ph: '_buykorigw_id_ph',
            fn: '_buykorigw_id_fn',
            ln: '_buykorigw_id_ln',
            ct: '_buykorigw_id_ct',
            st: '_buykorigw_id_st',
            zp: '_buykorigw_id_zp',
            country: '_buykorigw_id_country'
        };
        Object.keys(cookieFields).forEach(function(key) {
            var val = getCookie(cookieFields[key]);
            if (val) {
                fbUserData[key] = val;
                if (key === 'em') ttUserData.email = val;
                if (key === 'ph') ttUserData.phone_number = val;
            }
        });
        var externalId = getCookie('_buykorigw_vid');
        if (externalId) {
            fbUserData.external_id = externalId;
            ttUserData.external_id = externalId;
        }

        if (cfg.fb_pixel_id && !window.fbq) {
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            if (Object.keys(fbUserData).length) {
                fbq('init', cfg.fb_pixel_id, fbUserData);
            } else {
                fbq('init', cfg.fb_pixel_id);
            }
        }

        if (cfg.tt_pixel_id && !window.ttq) {
            !function (w, d, t) {
              w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
              ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
              ttq.instance=function(t){var e=ttq._i[t]||[];return e};ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=r;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
            }(window, document, 'ttq');
            ttq.load(cfg.tt_pixel_id);
            if (Object.keys(ttUserData).length) {
                ttq.identify(ttUserData);
            }
        }
    }

    function isOnePageMode() {
        return trackingMode === 'one_page';
    }

    function getSelectedVariationInfo() {
        if (!cfg.enable_variations) return null;
        var form = document.querySelector('form.cart.variations_form');
        if (!form) return null;
        var varIdInput = form.querySelector('[name="variation_id"], .variation_id');
        if (!varIdInput) return null;
        var variationId = varIdInput.value;
        if (!variationId || variationId === '0') return null;

        var attributes = {};
        var selects = form.querySelectorAll('select[name^="attribute_"]');
        selects.forEach(function(select) {
            var name = select.name.replace('attribute_', '');
            if (select.value) {
                attributes[name] = select.value;
            }
        });
        var radios = form.querySelectorAll('input[type="radio"][name^="attribute_"]:checked');
        radios.forEach(function(radio) {
            var name = radio.name.replace('attribute_', '');
            if (radio.value) {
                attributes[name] = radio.value;
            }
        });
        var hiddens = form.querySelectorAll('input[type="hidden"][name^="attribute_"]');
        hiddens.forEach(function(hidden) {
            var name = hidden.name.replace('attribute_', '');
            if (hidden.value) {
                attributes[name] = hidden.value;
            }
        });

        var price = null;
        var sku = null;
        try {
            var variationsDataAttr = form.getAttribute('data-product_variations');
            if (variationsDataAttr) {
                var variations = JSON.parse(variationsDataAttr);
                if (Array.isArray(variations)) {
                    var found = variations.find(function(v) {
                        return String(v.variation_id) === String(variationId);
                    });
                    if (found) {
                        if (found.display_price !== undefined) {
                            price = parseFloat(found.display_price);
                        }
                        if (found.sku) {
                            sku = found.sku;
                        }
                    }
                }
            }
        } catch(e) {}

        return {
            id: variationId,
            sku: sku,
            price: price,
            attributes: attributes
        };
    }

    function eventOnce(key, ttlSeconds) {
        var storageKey = 'buykorigw_evt_' + key;
        var now = Date.now();
        var ttl = (ttlSeconds || 1800) * 1000;
        try {
            var last = parseInt(sessionStorage.getItem(storageKey) || '0', 10);
            if (last && (now - last) < ttl) return false;
            sessionStorage.setItem(storageKey, String(now));
        } catch(e) {
            if (eventOnce.memory[storageKey]) return false;
            eventOnce.memory[storageKey] = now;
        }
        return true;
    }
    eventOnce.memory = {};

    function currentPathKey() {
        return (window.location.pathname || '/').replace(/[^a-zA-Z0-9_-]+/g, '_');
    }

    // ─── First-Party Cookie Helpers ──────────────────────────────────────
    function ensureFirstPartyCookies() {
        if (!getCookie('_fbp')) {
            var fbp = 'fb.1.' + Date.now() + '.' + Math.floor(Math.random() * 9000000000 + 1000000000);
            setCookieLocal('_fbp', fbp, 90);
        }
        var fbclid = getQueryParam('fbclid');
        if (fbclid) {
            var fbc = 'fb.1.' + Date.now() + '.' + fbclid;
            setCookieLocal('_fbc', fbc, 90);
        }
        if (!getCookie('_ttp')) {
            var ttp = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
            setCookieLocal('_ttp', ttp, 90);
        }
        if (!getCookie('_buykorigw_vid')) {
            setCookieLocal('_buykorigw_vid', createVisitorId(), 180);
        }
    }

    function createVisitorId() {
        if (window.crypto && window.crypto.getRandomValues) {
            var bytes = new Uint32Array(4);
            window.crypto.getRandomValues(bytes);
            return 'bk.' + Date.now() + '.' + Array.prototype.map.call(bytes, function(n) {
                return n.toString(16);
            }).join('');
        }
        return 'bk.' + Date.now() + '.' + Math.floor(Math.random() * 9000000000 + 1000000000);
    }

    function getExternalId() {
        var vid = getCookie('_buykorigw_vid');
        if (!vid) {
            vid = createVisitorId();
            setCookieLocal('_buykorigw_vid', vid, 180);
        }
        return vid;
    }

    function setCookieLocal(name, value, days) {
        var d = new Date();
        d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
        var expires = "; expires=" + d.toUTCString();
        var domain = getCookieDomain();
        document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/' + domain + '; SameSite=Lax';
    }

    function getCookieDomain() {
        var domain = "";
        try {
            var host = window.location.hostname;
            if (host.indexOf('.') !== -1 && !/^[0-9.]+$/.test(host) && host !== 'localhost') {
                var parts = host.split('.');
                var commonSecondLevelTlds = {
                    ac: true,
                    co: true,
                    com: true,
                    edu: true,
                    gov: true,
                    net: true,
                    org: true
                };
                if (
                    parts.length > 2 &&
                    parts[parts.length - 1].length === 2 &&
                    commonSecondLevelTlds[parts[parts.length - 2]]
                ) {
                    domain = "; domain=." + parts.slice(-3).join('.');
                } else if (parts.length > 2) {
                    domain = "; domain=." + parts.slice(-2).join('.');
                } else {
                    domain = "; domain=." + host;
                }
            }
        } catch(e) {}
        return domain;
    }

    function markInitiateCheckoutSent(eventId) {
        setCookieLocal('_buykorigw_ic_sent', String(Math.floor(Date.now() / 1000)), 1);
        if (eventId) {
            setCookieLocal('_buykorigw_ic_event_id', eventId, 1);
        }
    }

    // ─── GA4 Cookie Capture ──────────────────────────────────────────────
    function getGA4ClientId() {
        var ga = getCookie('_ga');
        if (ga) {
            var parts = ga.split('.');
            if (parts.length >= 4) return parts[parts.length - 2] + '.' + parts[parts.length - 1];
        }
        return '';
    }

    function getGA4SessionId() {
        var cookies = document.cookie.split(';');
        for (var i = 0; i < cookies.length; i++) {
            var c = cookies[i].trim();
            if (c.indexOf('_ga_') === 0) {
                var val = c.split('=')[1] || '';
                var parts = val.split('.');
                if (parts.length >= 3) return parts[2];
            }
        }
        return '';
    }

    // ─── Helper: Send event via REST API (primary) or AJAX (fallback) ────
    function sendEvent(eventName, eventData, synchronous) {
        eventData = normalizeEventData(eventData || {});

        var ga4ClientId = getGA4ClientId();
        var ga4SessionId = getGA4SessionId();
        if (ga4ClientId) eventData['_ga'] = ga4ClientId;
        if (ga4SessionId) eventData['ga_session_id'] = ga4SessionId;
        if (!eventData.page_location) eventData.page_location = window.location.href;
        if (!eventData.page_path) eventData.page_path = window.location.pathname + window.location.search;

        var eventId = '';
        if (eventName === 'InitiateCheckout') {
            var ic_marker_id = getCookie('_buykorigw_ic_event_id');
            eventId = ic_marker_id || ('wp_' + eventName + '_' + Math.floor(Date.now() / 1000) + '_' + Math.floor(Math.random() * 9000 + 1000));
            markInitiateCheckoutSent(eventId);
        } else {
            eventId = 'wp_' + eventName + '_' + Math.floor(Date.now() / 1000) + '_' + Math.floor(Math.random() * 9000 + 1000);
        }

        var payload = {
            event_name: eventName,
            event_data: eventData,
            event_id: eventId,
            page_url: window.location.href,
            page_title: document.title,
            fbp: getCookie('_fbp') || '',
            fbc: getCookie('_fbc') || '',
            ttp: getCookie('_ttp') || '',
            ttclid: getTikTokClickId(),
            fbclid: getQueryParam('fbclid') || '',
            external_id: getExternalId(),
            _ga: getCookie('_ga') || '',
            ga_session_id: ga4SessionId
        };

        // Parallel Client-side Pixel Trigger (with identical eventId for perfect deduplication)
        if (cfg.enable_hybrid && eventName !== 'Identify') {
            var browserParams = {};
            if (eventData.value !== undefined) browserParams.value = parseFloat(eventData.value);
            if (eventData.currency !== undefined) browserParams.currency = eventData.currency;
            if (eventData.content_name !== undefined) browserParams.content_name = eventData.content_name;
            if (eventData.content_type !== undefined) browserParams.content_type = eventData.content_type;
            if (eventData.content_ids !== undefined) browserParams.content_ids = eventData.content_ids;
            if (eventData.contents !== undefined) browserParams.contents = eventData.contents;

            // 1. Meta Pixel
            if (window.fbq && cfg.fb_pixel_id) {
                fbq('track', eventName, browserParams, { eventID: eventId });
            }
            // 2. TikTok Pixel
            if (window.ttq && cfg.tt_pixel_id) {
                ttq.track(eventName, browserParams, { event_id: eventId });
            }
        }

        var piiSelectors = {
            em: ['#billing_email', 'input[name="billing_email"]', 'input[type="email"]', 'input[id^="email"]', 'input[autocomplete="email"]', '#email'],
            ph: ['#billing_phone', 'input[name="billing_phone"]', 'input[type="tel"]', 'input[id^="tel"]', 'input[autocomplete="tel"]', '#phone'],
            fn: ['#billing_first_name', 'input[name="billing_first_name"]', 'input[autocomplete="given-name"]', '#first-name'],
            ln: ['#billing_last_name', 'input[name="billing_last_name"]', 'input[autocomplete="family-name"]', '#last-name'],
            ct: ['#billing_city', 'input[name="billing_city"]'],
            st: ['#billing_state', 'select[name="billing_state"], input[name="billing_state"]'],
            zp: ['#billing_postcode', 'input[name="billing_postcode"]'],
            country: ['#billing_country', 'select[name="billing_country"], input[name="billing_country"]']
        };
        Object.keys(piiSelectors).forEach(function(key) {
            var value = getFieldValue(piiSelectors[key]);
            if (value) payload[key] = value;
        });

        var jsonBody = JSON.stringify(payload);

        if (synchronous) {
            var url = cfg.rest_url || cfg.ajax_url;
            try {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', url, false);
                if (cfg.rest_url) {
                    xhr.setRequestHeader('Content-Type', 'application/json');
                    xhr.send(jsonBody);
                } else {
                    xhr.send(buildAjaxFormData(eventName, eventData));
                }
            } catch(e) {}
            return;
        }

        if (cfg.rest_url && window.fetch) {
            var headers = {'Content-Type': 'application/json'};
            if (cfg.rest_nonce) {
                headers['X-WP-Nonce'] = cfg.rest_nonce;
            }
            fetch(cfg.rest_url, {
                method: 'POST',
                headers: headers,
                body: jsonBody,
                keepalive: true
            }).then(function(response) {
                if (!response || !response.ok) {
                    sendViaAjax(eventName, eventData);
                }
            }).catch(function() {
                sendViaAjax(eventName, eventData);
            });
        } else if (cfg.rest_url && navigator.sendBeacon) {
            var blob = new Blob([jsonBody], {type: 'application/json'});
            if (!navigator.sendBeacon(cfg.rest_url, blob)) {
                sendViaAjax(eventName, eventData);
            }
        } else {
            sendViaAjax(eventName, eventData);
        }
    }

    function buildAjaxFormData(eventName, eventData) {
        var fd = new FormData();
        fd.append('action', 'buykorigw_track_event');
        fd.append('nonce', cfg.nonce);
        fd.append('event_name', eventName);
        fd.append('event_data', JSON.stringify(eventData));
        fd.append('page_url', window.location.href);
        fd.append('page_title', document.title);
        fd.append('fbp', getCookie('_fbp') || '');
        fd.append('fbc', getCookie('_fbc') || '');
        fd.append('ttp', getCookie('_ttp') || '');
        fd.append('ttclid', getTikTokClickId());
        fd.append('external_id', getExternalId());
        appendCustomerData(fd);
        return fd;
    }

    function sendViaAjax(eventName, eventData) {
        var fd = buildAjaxFormData(eventName, eventData);
        if (navigator.sendBeacon) {
            navigator.sendBeacon(cfg.ajax_url, fd);
        } else {
            fetch(cfg.ajax_url, { method: 'POST', body: fd, keepalive: true });
        }
    }

    function getCookie(name) {
        var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[2]) : '';
    }

    function normalizeEventData(data) {
        var out = {};
        Object.keys(data || {}).forEach(function(key) {
            if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
                out[key] = data[key];
            }
        });

        if (out.content_ids) {
            out.content_ids = (Array.isArray(out.content_ids) ? out.content_ids : [out.content_ids])
                .map(function(id) { return String(id || '').trim(); })
                .filter(Boolean);
            if (!out.content_ids.length) delete out.content_ids;
        }

        if (out.contents && Array.isArray(out.contents)) {
            out.contents = out.contents.filter(function(item) {
                return item && (item.content_id || item.id);
            });
            if (!out.contents.length) delete out.contents;
        }

        var marketing = getMarketingParams();
        Object.keys(marketing).forEach(function(key) {
            if (!out[key] && marketing[key]) out[key] = marketing[key];
        });

        return out;
    }

    function getFieldValue(selectors) {
        for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            if (el && el.value && String(el.value).trim()) {
                return String(el.value).trim();
            }
        }
        return '';
    }

    function getCustomerData() {
        var fields = {
            em: ['#billing_email', 'input[name="billing_email"]', 'input[type="email"]'],
            ph: ['#billing_phone', 'input[name="billing_phone"]', 'input[type="tel"]'],
            fn: ['#billing_first_name', 'input[name="billing_first_name"]'],
            ln: ['#billing_last_name', 'input[name="billing_last_name"]'],
            ct: ['#billing_city', 'input[name="billing_city"]'],
            st: ['#billing_state', 'select[name="billing_state"], input[name="billing_state"]'],
            zp: ['#billing_postcode', 'input[name="billing_postcode"]'],
            country: ['#billing_country', 'select[name="billing_country"], input[name="billing_country"]']
        };
        var out = {};
        Object.keys(fields).forEach(function(key) {
            var value = getFieldValue(fields[key]);
            if (value) out[key] = value;
        });
        return out;
    }

    function hasStrongCustomerData() {
        var data = getCustomerData();
        return !!(data.em && data.ph);
    }

    function appendCustomerData(formData) {
        var fields = getCustomerData();
        Object.keys(fields).forEach(function(key) {
            formData.append(key, fields[key]);
        });
    }

    function getQueryParam(name) {

        try {

            return new URLSearchParams(window.location.search).get(name) || '';

        } catch(e) {

            return '';

        }

    }


    function persistMarketingParams() {

        var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'campaign_source'];

        keys.forEach(function(key) {

            var value = normalizeCampaignValue(key, getQueryParam(key));

            if (value) {

                document.cookie = '_buykorigw_' + key + '=' + encodeURIComponent(value) + '; path=/; max-age=' + (30 * 24 * 60 * 60) + '; SameSite=Lax';

            }

        });

    }


    function getMarketingParams() {

        var out = {};

        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'campaign_source'].forEach(function(key) {

            out[key] = normalizeCampaignValue(key, getQueryParam(key) || getCookie('_buykorigw_' + key) || '');

        });

        if (!out.campaign_source && out.utm_source) out.campaign_source = out.utm_source;

        if (!out.utm_source && getTikTokClickId()) out.utm_source = 'tiktok';

        if (!out.campaign_source && out.utm_source) out.campaign_source = out.utm_source;

        if (!out.utm_source && getCookie('_fbc')) {

            out.utm_source = 'facebook';

            out.campaign_source = 'facebook';

        }

        return out;

    }


    function normalizeCampaignValue(key, value) {
        value = String(value || '').trim();
        if (!value || /^__.*__$/.test(value)) return '';

        if (key === 'utm_source' || key === 'campaign_source') {
            return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        }

        return value;
    }

    function persistTikTokClickId() {
        var ttclid = getQueryParam('ttclid');
        if (ttclid) {
            setCookieLocal('_ttclid', ttclid, 90);
        }
    }

    function getTikTokClickId() {
        return getQueryParam('ttclid') || getCookie('_ttclid') || '';
    }

    // ─── 1. PageView ───────────────────────────────────────────────────
    if (cfg.events && cfg.events.pageview && eventOnce('PageView:' + currentPathKey(), 30)) {
        sendEvent('PageView', {});
    }

    // ─── 2. ViewContent (Product Page) ─────────────────────────────────
    function sendViewContentOnce() {
        if (!cfg.events || !cfg.events.viewcontent || cfg.page_type !== 'product' || !cfg.product) return;
        if (!eventOnce('ViewContent:' + String(cfg.product.id || '') + ':' + currentPathKey(), 1800)) return;

        var contentIdFormat = cfg.content_id_format || 'id';
        var productId = (contentIdFormat === 'sku' && cfg.product.sku) ? cfg.product.sku : String(cfg.product.id);
        var productPrice = cfg.product.price;
        var attributes = null;

        var variationInfo = getSelectedVariationInfo();
        if (variationInfo) {
            productId = (contentIdFormat === 'sku' && variationInfo.sku) ? variationInfo.sku : String(variationInfo.id);
            if (variationInfo.price !== null) {
                productPrice = variationInfo.price;
            }
            attributes = variationInfo.attributes;
        }

        var item = {
            id: productId,
            content_id: productId,
            content_type: 'product',
            content_name: cfg.product.name,
            content_category: cfg.product.category || '',
            quantity: 1,
            item_price: productPrice,
            price: productPrice
        };
        if (attributes) {
            item.attributes = attributes;
        }

        sendEvent('ViewContent', {
            content_ids: [productId],
            contents: [item],
            content_name: cfg.product.name,
            content_type: 'product',
            content_category: cfg.product.category || '',
            value: productPrice,
            currency: cfg.product.currency
        });
    }

    if (cfg.events && cfg.events.viewcontent && cfg.page_type === 'product' && cfg.product) {
        if (isOnePageMode() && typeof IntersectionObserver !== 'undefined') {
            var productSurface = document.querySelector('.product, .summary, form.cart, [data-product_id]');
            if (productSurface) {
                var viewObserver = new IntersectionObserver(function(entries) {
                    entries.forEach(function(entry) {
                        if (entry.isIntersecting) {
                            sendViewContentOnce();
                            viewObserver.disconnect();
                        }
                    });
                }, { threshold: 0.35 });
                viewObserver.observe(productSurface);
            } else {
                setTimeout(sendViewContentOnce, 1200);
            }
        } else {
            sendViewContentOnce();
        }

        // Variation change dynamic trigger
        if (typeof jQuery !== 'undefined' && cfg.enable_variations) {
            jQuery(document.body).on('found_variation', function(e, variation) {
                if (variation && variation.variation_id) {
                    var varId = String(variation.variation_id);
                    if (eventOnce('ViewContentVar:' + varId + ':' + currentPathKey(), 300)) {
                        var contentIdFormat = cfg.content_id_format || 'id';
                        var productId = (contentIdFormat === 'sku' && variation.sku) ? variation.sku : varId;
                        var productPrice = parseFloat(variation.display_price || cfg.product.price);

                        var attributes = {};
                        if (variation.attributes) {
                            Object.keys(variation.attributes).forEach(function(k) {
                                attributes[k.replace('attribute_', '')] = variation.attributes[k];
                            });
                        }

                        var item = {
                            id: productId,
                            content_id: productId,
                            content_type: 'product',
                            content_name: cfg.product.name,
                            content_category: cfg.product.category || '',
                            quantity: 1,
                            item_price: productPrice,
                            price: productPrice
                        };
                        if (Object.keys(attributes).length) {
                            item.attributes = attributes;
                        }

                        sendEvent('ViewContent', {
                            content_ids: [productId],
                            contents: [item],
                            content_name: cfg.product.name,
                            content_type: 'product',
                            content_category: cfg.product.category || '',
                            value: productPrice,
                            currency: cfg.product.currency
                        });
                    }
                }
            });
        }
    }

    // ─── 3. AddToCart ──────────────────────────────────────────────────
    if (cfg.events && cfg.events.addtocart) {
        var addToCartFiredViaAjax = false;

        // jQuery AJAX event — most reliable (fires AFTER WooCommerce confirms add)
        if (typeof jQuery !== 'undefined') {
            jQuery(document.body).on('added_to_cart', function(e, fragments, hash, $btn) {
                addToCartFiredViaAjax = true;
                var pid = $btn ? $btn.attr('data-product_id') : '';
                var pname = $btn ? $btn.attr('data-product_name') : '';
                var pprice = $btn ? parseFloat($btn.attr('data-product_price') || 0) : 0;

                var variationInfo = getSelectedVariationInfo();
                var attributes = null;
                if (variationInfo) {
                    pid = variationInfo.id;
                    if (variationInfo.sku && cfg.content_id_format === 'sku') {
                        pid = variationInfo.sku;
                    }
                    if (variationInfo.price !== null) {
                        pprice = variationInfo.price;
                    }
                    attributes = variationInfo.attributes;
                } else if (pid) {
                    if (cfg.product && String(cfg.product.id) === String(pid)) {
                        pname = cfg.product.name;
                        if (cfg.content_id_format === 'sku' && cfg.product.sku) {
                            pid = cfg.product.sku;
                        }
                        pprice = cfg.product.price;
                    } else if (cfg.content_id_format === 'sku' && $btn && $btn.attr('data-product_sku')) {
                        pid = $btn.attr('data-product_sku');
                    }
                }

                var item = {
                    id: String(pid),
                    content_id: String(pid),
                    content_type: 'product',
                    content_name: pname || (cfg.product ? cfg.product.name : ''),
                    quantity: 1,
                    item_price: pprice,
                    price: pprice
                };
                if (attributes) {
                    item.attributes = attributes;
                }

                sendEvent('AddToCart', {
                    content_ids: pid ? [String(pid)] : [],
                    contents: pid ? [item] : [],
                    content_name: pname || (cfg.product ? cfg.product.name : ''),
                    content_type: 'product',
                    value: pprice,
                    currency: (cfg.product ? cfg.product.currency : 'BDT')
                });
            });
        }

        // Click fallback — শুধু তখনই চলবে যখন jQuery AJAX event চলেনি
        // (single product page with form submit, or non-AJAX themes)
        document.addEventListener('click', function(e) {
            var btn = e.target.closest('.add_to_cart_button, .single_add_to_cart_button');
            if (!btn) return;

            // AJAX-enabled বাটনে click listener দরকার নেই — jQuery event handle করবে
            if (btn.classList.contains('ajax_add_to_cart')) return;

            var hasVariationsForm = !!document.querySelector('form.cart.variations_form');
            var variationInfo = getSelectedVariationInfo();
            var productId = '';
            var productPrice = 0;
            var productName = '';
            var attributes = null;

            if (variationInfo) {
                productId = (cfg.content_id_format === 'sku' && variationInfo.sku) ? variationInfo.sku : String(variationInfo.id);
                if (variationInfo.price !== null) {
                    productPrice = variationInfo.price;
                } else {
                    productPrice = cfg.product ? cfg.product.price : 0;
                }
                productName = cfg.product ? cfg.product.name : '';
                attributes = variationInfo.attributes;
            } else if (hasVariationsForm) {
                // If it is a variable product but no variation is selected, do not trigger AddToCart fallback
                return;
            } else if (cfg.product) {
                productId = (cfg.content_id_format === 'sku' && cfg.product.sku) ? cfg.product.sku : String(cfg.product.id);
                productPrice = cfg.product.price;
                productName = cfg.product.name;
            } else {
                var pid = btn.getAttribute('data-product_id') || '';
                productId = pid;
                if (cfg.content_id_format === 'sku' && btn.getAttribute('data-product_sku')) {
                    productId = btn.getAttribute('data-product_sku');
                }
                productPrice = parseFloat(btn.getAttribute('data-product_price') || 0);
                productName = btn.getAttribute('data-product_name') || '';
            }

            if (!productId) return;

            var item = {
                id: String(productId),
                content_id: String(productId),
                content_type: 'product',
                content_name: productName,
                content_category: (cfg.product ? cfg.product.category : '') || '',
                quantity: 1,
                item_price: productPrice,
                price: productPrice
            };
            if (attributes) {
                item.attributes = attributes;
            }

            sendEvent('AddToCart', {
                content_ids: [String(productId)],
                contents: [item],
                content_name: productName,
                content_type: 'product',
                content_category: (cfg.product ? cfg.product.category : '') || '',
                value: productPrice,
                currency: cfg.product ? cfg.product.currency : 'BDT'
            });
        });
    }

    // ─── 4. InitiateCheckout ───────────────────────────────────────────
    function checkoutPayload(reason) {
        var checkoutData = cfg.cart || {};
        return {
            content_ids: checkoutData.content_ids || [],
            contents: checkoutData.contents || [],
            content_type: 'product',
            value: checkoutData.value || 0,
            currency: checkoutData.currency || 'BDT',
            num_items: checkoutData.num_items || 0,
            trigger_reason: reason || ''
        };
    }

    var initiateCheckoutSent = false;
    function sendInitiateCheckoutOnce(reason, synchronous) {
        if (!cfg.events || !cfg.events.checkout) return;
        if (initiateCheckoutSent) return;
        initiateCheckoutSent = true;
        sendEvent('InitiateCheckout', checkoutPayload(reason), !!synchronous);
    }

    function sendInitiateCheckoutWhenReady(reason, force, synchronous) {
        if (force || hasStrongCustomerData()) {
            sendInitiateCheckoutOnce(reason, synchronous);
        }
    }

    function hasCheckoutCartData() {
        var checkoutData = cfg.cart || {};
        if (parseFloat(checkoutData.value || 0) > 0) return true;
        if (parseInt(checkoutData.num_items || 0, 10) > 0) return true;
        if (checkoutData.content_ids && checkoutData.content_ids.length) return true;
        if (checkoutData.contents && checkoutData.contents.length) return true;
        return isCheckoutFlowPage();
    }

    function sendInitiateCheckoutOnSurface(reason) {
        if (!hasCheckoutSurface()) return;
        sendInitiateCheckoutWhenReady(reason || 'checkout_surface_ready', hasCheckoutCartData());
    }

    function scheduleCheckoutSurfaceChecks(prefix) {
        if (!isCheckoutFlowPage()) return;
        setTimeout(function() {
            sendInitiateCheckoutOnSurface((prefix || 'checkout') + '_page_load');
        }, 1200);
        setTimeout(function() {
            sendInitiateCheckoutOnSurface((prefix || 'checkout') + '_delayed_page_load');
        }, 4000);
    }

    function hasCheckoutSurface() {
        return !!(
            document.querySelector('form.checkout, form.woocommerce-checkout, .woocommerce-checkout, .wc-block-checkout, #customer_details, #order_review, #place_order')
            || document.querySelector('#billing_email, #billing_phone, input[name="billing_email"], input[name="billing_phone"]')
        );
    }

    var checkoutIntentBound = false;
    function bindCheckoutIntentTracking() {
        if (checkoutIntentBound) return;
        checkoutIntentBound = true;
        var intentSelector = [
            '#billing_email',
            '#billing_phone',
            '#billing_first_name',
            'input[name^="billing_"]',
            'select[name^="billing_"]',
            'textarea[name^="order_"]',
            'input[autocomplete="email"]',
            'input[autocomplete="tel"]',
            'input[autocomplete="given-name"]',
            'input[autocomplete="family-name"]',
            '.woocommerce-checkout input',
            '.woocommerce-checkout select',
            '.wc-block-checkout input',
            '.wc-block-checkout select'
        ].join(', ');

        function maybeFireFromField(e) {
            var target = e.target;
            if (!target || !target.matches || !target.matches(intentSelector)) return;
            if (target.type === 'hidden' || target.type === 'checkbox' || target.type === 'radio') return;
            sendInitiateCheckoutWhenReady('checkout_field_input', hasCheckoutCartData());
        }

        document.addEventListener('input', maybeFireFromField, true);
        document.addEventListener('change', maybeFireFromField, true);
        document.addEventListener('click', function(e) {
            if (e.target.closest('#place_order, .wc-block-components-checkout-place-order-button, [name="woocommerce_checkout_place_order"]')) {
                sendInitiateCheckoutWhenReady('place_order_click', true, true);
            }
        }, true);
        document.addEventListener('submit', function(e) {
            if (e.target.matches('form.checkout, form.woocommerce-checkout, .woocommerce-checkout form')) {
                sendInitiateCheckoutWhenReady('checkout_submit', true, true);
            }
        }, true);

        if (window.jQuery && window.jQuery(document.body).on) {
            window.jQuery(document.body).on('init_checkout updated_checkout checkout_place_order', function(e) {
                sendInitiateCheckoutWhenReady(e && e.type ? e.type : 'woocommerce_checkout_event', true);
            });
        }

        function validateEmail(email) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        }
        function validatePhone(phone) {
            var clean = String(phone).replace(/[^0-9]/g, '');
            return clean.length >= 8;
        }

        document.addEventListener('blur', function(e) {
            var target = e.target;
            if (!target || !target.matches) return;
            var isEmail = target.matches('#billing_email, input[name="billing_email"], input[type="email"]');
            var isPhone = target.matches('#billing_phone, input[name="billing_phone"], input[type="tel"]');
            if (isEmail || isPhone) {
                var val = String(target.value).trim();
                if (isEmail && validateEmail(val)) {
                    sendEvent('Identify', { em: val });
                } else if (isPhone && validatePhone(val)) {
                    sendEvent('Identify', { ph: val });
                }
            }
        }, true);
    }

    function isCheckoutFlowPage() {
        if (cfg.page_type === 'checkout') return true;
        var path = (window.location && window.location.pathname ? window.location.pathname : '').toLowerCase();
        if (path.indexOf('checkout') !== -1 && !path.match(/order-received|order-pay/)) return true;
        return hasCheckoutSurface();
    }

    if (cfg.events && cfg.events.checkout) {
        bindCheckoutIntentTracking();
        scheduleCheckoutSurfaceChecks('checkout');

        document.addEventListener('DOMContentLoaded', function() {
            bindCheckoutIntentTracking();
            scheduleCheckoutSurfaceChecks('checkout');
        });

        setTimeout(function() {
            bindCheckoutIntentTracking();
            scheduleCheckoutSurfaceChecks('checkout');
        }, 1200);

        if (typeof MutationObserver !== 'undefined') {
            var checkoutObserverTimeout;
            var checkoutObserver = new MutationObserver(function() {
                if (initiateCheckoutSent && checkoutIntentBound) {
                    checkoutObserver.disconnect();
                    return;
                }
                clearTimeout(checkoutObserverTimeout);
                checkoutObserverTimeout = setTimeout(function() {
                    if (isCheckoutFlowPage()) {
                        bindCheckoutIntentTracking();
                        sendInitiateCheckoutOnSurface('checkout_surface_ready');
                        if (initiateCheckoutSent && checkoutIntentBound) {
                            checkoutObserver.disconnect();
                        }
                    }
                }, 150);
            });
            checkoutObserver.observe(document.body, { childList: true, subtree: true });
        }
    }

    // ─── 5. ViewCart (WooCommerce Cart Page) ───────────────────────────
    if (cfg.events && cfg.events.viewcart && cfg.page_type === 'cart') {
        var cartData = cfg.cart || {};
        sendEvent('ViewCart', {
            content_ids: cartData.content_ids || [],
            contents: cartData.contents || [],
            content_type: 'product',
            value: cartData.value || 0,
            currency: cartData.currency || 'BDT',
            num_items: cartData.num_items || 0
        });
    }

    // ─── 6. RemoveFromCart ─────────────────────────────────────────────
    if (cfg.events && cfg.events.removefromcart) {
        var removeFiredViaJQ = false;

        // jQuery AJAX removal event (AJAX-enabled cart/Blocks)
        if (typeof jQuery !== 'undefined') {
            jQuery(document.body).on('removed_from_cart', function(e, fragments, hash, $btn) {
                removeFiredViaJQ = true;
                var pid = $btn ? $btn.attr('data-product_id') : '';
                sendEvent('RemoveFromCart', {
                    content_ids: [pid || ''],
                    content_type: 'product'
                });
            });

            // WooCommerce Blocks fires wc-blocks_removed_from_cart
            jQuery(document.body).on('wc-blocks_removed_from_cart', function() {
                removeFiredViaJQ = true;
                sendEvent('RemoveFromCart', { content_type: 'product' });
            });
        }

        // Click listener — Classic cart (non-AJAX) ব্যাকআপ
        document.addEventListener('click', function(e) {
            var btn = e.target.closest('a.remove[data-product_id], .remove_from_cart_button');

            if (!btn) {
                btn = e.target.closest('button.wc-block-cart-item__remove-link, [aria-label*="Remove"]');
            }

            if (!btn) return;

            setTimeout(function() {
                if (removeFiredViaJQ) { removeFiredViaJQ = false; return; }
                var pid = btn.getAttribute('data-product_id') || '';

                var isClassicRemove = btn.tagName === 'A' && btn.getAttribute('href');
                sendEvent('RemoveFromCart', {
                    content_ids: [pid],
                    content_type: 'product'
                }, isClassicRemove);
            }, 0);
        });
    }

    // ─── 7. AddPaymentInfo ─────────────────────────────────────────────
    if (cfg.events && cfg.events.addpaymentinfo && cfg.page_type === 'checkout') {
        var paymentFired = false;

        function fireAddPaymentInfo(method) {
            if (paymentFired) return;
            paymentFired = true;
            var paymentData = cfg.cart || {};
            sendEvent('AddPaymentInfo', {
                payment_method: method || '',
                content_ids: paymentData.content_ids || [],
                contents: paymentData.contents || [],
                content_type: 'product',
                value: paymentData.value || 0,
                currency: paymentData.currency || 'BDT',
                num_items: paymentData.num_items || 0
            });
        }

        // Classic WooCommerce checkout — radio button change
        document.addEventListener('change', function(e) {
            if (e.target.name === 'payment_method') {
                fireAddPaymentInfo(e.target.value);
            }
        });

        // WooCommerce Blocks checkout — custom jQuery event
        if (typeof jQuery !== 'undefined') {
            jQuery(document.body).on('payment_method_selected', function() {
                var sel = document.querySelector('.wc-block-components-radio-control__input:checked');
                fireAddPaymentInfo(sel ? sel.value : '');
            });
        }

        // Blocks: observe DOM for payment method radio changes
        if (typeof MutationObserver !== 'undefined') {
            var payObserver = new MutationObserver(function() {
                var checked = document.querySelector(
                    '.wc-block-components-radio-control__input:checked, ' +
                    'input[name="radio-control-wc-payment-method-options"]:checked'
                );
                if (checked) fireAddPaymentInfo(checked.value);
            });
            var payContainer = document.querySelector('.wc-block-checkout, #payment');
            if (payContainer) {
                payObserver.observe(payContainer, { subtree: true, attributes: true, childList: true });
            }
        }
    }

    // ─── 8. Lead (Form Submissions) ────────────────────────────────────
    if (cfg.events && cfg.events.lead) {
        document.addEventListener('submit', function(e) {
            var form = e.target;
            if (form.classList.contains('woocommerce-checkout') ||
                form.classList.contains('woocommerce-cart-form') ||
                form.getAttribute('role') === 'search') return;
            if (form.id === 'loginform' || form.id === 'registerform') return;
            sendEvent('Lead', {});
        });
    }

    // ─── 9. Search ─────────────────────────────────────────────────────
    if (cfg.events && cfg.events.search && cfg.page_type === 'search' && cfg.search_string) {
        sendEvent('Search', { search_string: cfg.search_string });
    }

})();
JS;
}


// ─── AJAX Handler: Track Event (Server-Side — bypasses cache) ──────────────────
add_action( 'wp_ajax_buykorigw_track_event', 'buykorigw_ajax_track_event' );
add_action( 'wp_ajax_nopriv_buykorigw_track_event', 'buykorigw_ajax_track_event' );

function buykorigw_ajax_track_event() {
    $nonce = isset( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '';

    // ─── Origin Validation (replaces nonce for cache-safe security) ─────
    $allowed_host = parse_url( home_url(), PHP_URL_HOST );
    if ( ! $allowed_host ) {
        $allowed_host = $_SERVER['HTTP_HOST'] ?? '';
    }

    $request_origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? $_SERVER['HTTP_ORIGIN'] : '';
    $request_referer = isset( $_SERVER['HTTP_REFERER'] ) ? $_SERVER['HTTP_REFERER'] : '';

    $origin_valid = false;

    // Check Origin
    if ( ! empty( $request_origin ) ) {
        $origin_host = parse_url( $request_origin, PHP_URL_HOST );
        if ( buykorigw_host_allowed( $origin_host, $allowed_host ) ) {
            $origin_valid = true;
        }
    }

    // Check Referer if Origin is missing or invalid
    if ( ! $origin_valid && ! empty( $request_referer ) ) {
        $referer_host = parse_url( $request_referer, PHP_URL_HOST );
        if ( buykorigw_host_allowed( $referer_host, $allowed_host ) ) {
            $origin_valid = true;
        }
    }

    if ( ! $origin_valid ) {
        wp_send_json_error( 'Invalid origin' );
    }

    if ( buykorigw_ajax_rate_limited() ) {
        wp_send_json_error( 'Rate limit exceeded', 429 );
    }

    // ─── Whitelist allowed event names ──────────────────────────────────
    $allowed_events = array( 'PageView', 'ViewContent', 'AddToCart', 'ViewCart', 'RemoveFromCart', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase', 'Lead', 'Search', 'Identify', 'Refund' );

    // Also allow user-defined custom events from the Custom Event Builder
    if ( defined( 'BUYKORIGW_CUSTOM_EVENTS_KEY' ) ) {
        $custom_events = get_option( BUYKORIGW_CUSTOM_EVENTS_KEY, array() );
        foreach ( $custom_events as $ce ) {
            if ( ! empty( $ce['name'] ) && ! empty( $ce['enabled'] ) ) {
                $allowed_events[] = $ce['name'];
            }
        }
    }

    $settings   = buykorigw_get_settings();
    $event_name = isset( $_POST['event_name'] ) ? sanitize_text_field( wp_unslash( $_POST['event_name'] ) ) : '';
    $event_json = isset( $_POST['event_data'] ) ? wp_unslash( $_POST['event_data'] ) : '{}';
    $page_url   = isset( $_POST['page_url'] ) ? esc_url_raw( wp_unslash( $_POST['page_url'] ) ) : '';
    $fbp        = isset( $_POST['fbp'] ) ? sanitize_text_field( wp_unslash( $_POST['fbp'] ) ) : '';
    $fbc        = isset( $_POST['fbc'] ) ? sanitize_text_field( wp_unslash( $_POST['fbc'] ) ) : '';
    $ttp        = isset( $_POST['ttp'] ) ? sanitize_text_field( wp_unslash( $_POST['ttp'] ) ) : '';
    $ttclid     = isset( $_POST['ttclid'] ) ? sanitize_text_field( wp_unslash( $_POST['ttclid'] ) ) : '';
    $external_id = isset( $_POST['external_id'] ) ? sanitize_text_field( wp_unslash( $_POST['external_id'] ) ) : '';
    if ( empty( $event_name ) || ! in_array( $event_name, $allowed_events, true ) ) {
        wp_send_json_error( 'Invalid event name' );
    }

    $custom_data = json_decode( $event_json, true );
    if ( ! is_array( $custom_data ) ) {
        $custom_data = array();
    }

    $custom_data = buykorigw_add_marketing_params( $custom_data );

    // Translate product IDs to SKUs if configured
    $content_format = isset( $settings['content_id_format'] ) ? $settings['content_id_format'] : 'id';
    if ( function_exists( 'buykorigw_normalize_content_identifiers' ) ) {
        buykorigw_normalize_content_identifiers( $custom_data, $content_format );
    }

    // Build user_data with PII hashing
    $user_data = array(
        'client_ip_address' => buykorigw_get_real_ip(),
        'client_user_agent' => sanitize_text_field( $_SERVER['HTTP_USER_AGENT'] ?? '' ),
    );

    // Add fbp/fbc cookies for Facebook matching
    if ( ! empty( $fbp ) ) {
        $user_data['fbp'] = $fbp;
    }
    if ( ! empty( $fbc ) ) {
        $user_data['fbc'] = $fbc;
    }
    if ( ! empty( $ttp ) ) {
        $user_data['ttp'] = $ttp;
    }
    if ( ! empty( $ttclid ) ) {
        $user_data['ttclid'] = $ttclid;
    }
    if ( ! empty( $external_id ) ) {
        $user_data['external_id'] = array( buykorigw_hash( $external_id ) );
    }

    buykorigw_apply_identity_data( $user_data, wp_unslash( $_POST ) );

    if ( $event_name === 'Identify' ) {
        wp_send_json_success( 'Identity updated' );
    }

    // If user is logged in, hash their email and name
    if ( is_user_logged_in() ) {
        $user = wp_get_current_user();
        buykorigw_apply_identity_data( $user_data, array(
            'em' => $user->user_email,
            'fn' => $user->first_name,
            'ln' => $user->last_name,
        ), false );
    }

    // Build event payload
    $event_payload = array(
        'event_name'  => $event_name,
        'event_time'  => time(),
        'event_source_url' => $page_url,
        'action_source'    => 'website',
        'user_data'   => $user_data,
    );

    // Add custom_data if present
    if ( ! empty( $custom_data ) ) {
        $event_payload['custom_data'] = $custom_data;
    }

    // Generate unique event_id for deduplication
    $event_payload['event_id'] = 'wp_' . $event_name . '_' . time() . '_' . wp_rand( 1000, 9999 );

    // Send to gateway
    buykorigw_send_event( $event_payload, false );
    if ( $event_name === 'InitiateCheckout' && function_exists( 'buykorigw_mark_initiate_checkout_sent' ) ) {
        buykorigw_mark_initiate_checkout_sent( $event_payload['event_id'] );
    }

    wp_send_json_success( 'Event tracked' );
}


function buykorigw_add_marketing_params( $custom_data ) {
    $keys = array( 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'campaign_source' );
    foreach ( $keys as $key ) {
        if ( empty( $custom_data[ $key ] ) && ! empty( $_COOKIE[ '_buykorigw_' . $key ] ) ) {
            $custom_data[ $key ] = buykorigw_normalize_campaign_value( $key, sanitize_text_field( wp_unslash( $_COOKIE[ '_buykorigw_' . $key ] ) ) );
        } elseif ( ! empty( $custom_data[ $key ] ) ) {
            $custom_data[ $key ] = buykorigw_normalize_campaign_value( $key, $custom_data[ $key ] );
        }
    }
    if ( empty( $custom_data['campaign_source'] ) && ! empty( $custom_data['utm_source'] ) ) {
        $custom_data['campaign_source'] = $custom_data['utm_source'];
    }
    if ( empty( $custom_data['utm_source'] ) && ! empty( $_COOKIE['_ttclid'] ) ) {
        $custom_data['utm_source'] = 'tiktok';
        $custom_data['campaign_source'] = 'tiktok';
    } elseif ( empty( $custom_data['utm_source'] ) && ! empty( $_COOKIE['_fbc'] ) ) {
        $custom_data['utm_source'] = 'facebook';
        $custom_data['campaign_source'] = 'facebook';
    }
    return $custom_data;
}


// ─── Helper: Lightweight AJAX Rate Limit ───────────────────────────────────
function buykorigw_normalize_campaign_value( $key, $value ) {
    $value = trim( (string) $value );
    if ( $value === '' || preg_match( '/^__.*__$/', $value ) ) {
        return '';
    }

    if ( in_array( $key, array( 'utm_source', 'campaign_source' ), true ) ) {
        $value = strtolower( $value );
        $value = preg_replace( '/[^a-z0-9]+/', '_', $value );
        $value = trim( $value, '_' );
    } else {
        $value = sanitize_text_field( $value );
    }

    return $value;
}

function buykorigw_ajax_rate_limited() {
    $ip = buykorigw_get_real_ip();
    if ( empty( $ip ) ) {
        return false;
    }

    $limit      = 120;
    $window     = 60;
    $cache_key  = 'buykorigw_ajax_rate_' . md5( $ip );
    $hit_count  = (int) get_transient( $cache_key );

    if ( $hit_count >= $limit ) {
        return true;
    }

    set_transient( $cache_key, $hit_count + 1, $window );
    return false;
}


// ─── WooCommerce: Purchase Event on Thank You Page (Server-Side) ───────────────
add_action( 'woocommerce_thankyou', 'buykorigw_track_purchase', 10, 1 );

function buykorigw_track_purchase( $order_id ) {
    $settings = buykorigw_get_settings();

    if ( ! $settings['enable_purchase'] || empty( $settings['api_key'] ) ) {
        return;
    }

    // Prevent duplicate tracking (mark order as tracked)
    $already_tracked = buykorigw_get_order_meta( $order_id, '_buykorigw_tracked' );
    if ( $already_tracked ) {
        return;
    }

    $order = wc_get_order( $order_id );
    if ( ! $order ) {
        return;
    }

    // Build product IDs and content data
    $content_ids = array();
    $contents    = array();
    $num_items   = 0;
    $content_format = isset( $settings['content_id_format'] ) ? $settings['content_id_format'] : 'id';

    foreach ( $order->get_items() as $item ) {
        $product_id = $item->get_product_id();
        $product    = $item->get_product();

        $final_id = (string) $product_id;
        if ( $content_format === 'sku' && $product ) {
            $sku = $product->get_sku();
            if ( ! empty( $sku ) ) {
                $final_id = $sku;
            }
        }

        $content_ids[] = $final_id;
        $contents[] = array(
            'id'       => $final_id,
            'quantity' => $item->get_quantity(),
            'item_price' => (float) ( $item->get_total() / max( $item->get_quantity(), 1 ) ),
        );
        $num_items += $item->get_quantity();
    }

    // Build user_data with real customer info (hashed)
    // Prefer saved attribution snapshot (from checkout) over current $_COOKIE
    // because payment gateway redirects (bKash/Nagad/SSLCommerz) destroy cookies
    $snapshot_ip = $order->get_meta( '_buykorigw_snapshot_ip' );
    $snapshot_ua = $order->get_meta( '_buykorigw_snapshot_ua' );

    $user_data = array(
        'client_ip_address' => $order->get_customer_ip_address() ?: ( $snapshot_ip ?: buykorigw_get_real_ip() ),
        'client_user_agent' => $order->get_customer_user_agent() ?: ( $snapshot_ua ?: ( $_SERVER['HTTP_USER_AGENT'] ?? '' ) ),
    );

    if ( $order->get_billing_email() ) {
        $user_data['em'] = array( buykorigw_hash( $order->get_billing_email() ) );
    }
    if ( $order->get_billing_first_name() ) {
        $user_data['fn'] = array( buykorigw_hash( $order->get_billing_first_name() ) );
    }
    if ( $order->get_billing_last_name() ) {
        $user_data['ln'] = array( buykorigw_hash( $order->get_billing_last_name() ) );
    }
    if ( $order->get_billing_phone() ) {
        $user_data['ph'] = array( buykorigw_hash_phone( $order->get_billing_phone() ) );
    }
    if ( $order->get_billing_city() ) {
        $user_data['ct'] = array( buykorigw_hash( $order->get_billing_city() ) );
    }
    if ( $order->get_billing_state() ) {
        $user_data['st'] = array( buykorigw_hash( $order->get_billing_state() ) );
    }
    if ( $order->get_billing_country() ) {
        $user_data['country'] = array( buykorigw_hash( $order->get_billing_country() ) );
    }
    if ( $order->get_billing_postcode() ) {
        $user_data['zp'] = array( buykorigw_hash( $order->get_billing_postcode() ) );
    }
    buykorigw_apply_identity_data( $user_data, array(
        'em'      => $order->get_billing_email(),
        'ph'      => $order->get_billing_phone(),
        'fn'      => $order->get_billing_first_name(),
        'ln'      => $order->get_billing_last_name(),
        'ct'      => $order->get_billing_city(),
        'st'      => $order->get_billing_state(),
        'zp'      => $order->get_billing_postcode(),
        'country' => $order->get_billing_country(),
    ), false );

    // Attribution cookies: prefer saved snapshot over $_COOKIE
    $cookie_map = array(
        'fbp'    => '_fbp',
        'fbc'    => '_fbc',
        'ttp'    => '_ttp',
        'ttclid' => '_ttclid',
    );
    foreach ( $cookie_map as $ud_key => $cookie_name ) {
        $snapshot_val = $order->get_meta( '_buykorigw_snapshot' . $cookie_name );
        $cookie_val   = isset( $_COOKIE[ $cookie_name ] ) ? sanitize_text_field( wp_unslash( $_COOKIE[ $cookie_name ] ) ) : '';
        $final_val    = ! empty( $snapshot_val ) ? $snapshot_val : $cookie_val;
        if ( ! empty( $final_val ) ) {
            $user_data[ $ud_key ] = $final_val;
        }
    }

    $snapshot_external_id = $order->get_meta( '_buykorigw_snapshot_buykorigw_vid' );
    $cookie_external_id   = isset( $_COOKIE['_buykorigw_vid'] ) ? sanitize_text_field( wp_unslash( $_COOKIE['_buykorigw_vid'] ) ) : '';
    $external_id          = ! empty( $snapshot_external_id ) ? $snapshot_external_id : $cookie_external_id;
    if ( ! empty( $external_id ) ) {
        $user_data['external_id'] = array( buykorigw_hash( $external_id ) );
    } elseif ( $order->get_customer_id() ) {
        $user_data['external_id'] = array( buykorigw_hash( 'wp_user_' . $order->get_customer_id() ) );
    }

    // Build event payload
    $event_payload = array(
        'event_name'       => 'Purchase',
        'event_time'       => time(),
        'event_id'         => 'wc_purchase_' . $order_id,
        'event_source_url' => $order->get_checkout_order_received_url(),
        'action_source'    => 'website',
        'user_data'        => $user_data,
        'custom_data'      => array(
            'value'        => (float) $order->get_total(),
            'currency'     => $order->get_currency(),
            'content_ids'  => $content_ids,
            'contents'     => $contents,
            'content_type' => 'product',
            'num_items'    => $num_items,
            'order_id'     => (string) $order_id,
        ),
    );

    $event_payload['custom_data'] = buykorigw_add_marketing_params( $event_payload['custom_data'] );

    // Inject GA4 client_id and session_id from snapshot for Measurement Protocol
    $ga4_client_id  = $order->get_meta( '_buykorigw_snapshot_ga_client_id' );
    $ga4_session_id = $order->get_meta( '_buykorigw_snapshot_ga_session_id' );
    if ( $ga4_client_id ) {
        $event_payload['custom_data']['client_id'] = $ga4_client_id;
    }
    if ( $ga4_session_id ) {
        $event_payload['custom_data']['session_id'] = $ga4_session_id;
    }

    // Add UTM params from snapshot
    $utm_keys = array( 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term' );
    foreach ( $utm_keys as $key ) {
        $val = $order->get_meta( '_buykorigw_snapshot_' . $key );
        if ( $val ) {
            $event_payload['custom_data'][ $key ] = $val;
        }
    }

    $sent = false;

    // If deferred_purchase is ON, send with hold=true query param
    if ( $settings['deferred_purchase'] ) {
        $url = rtrim( $settings['gateway_url'], '/' ) . '/events?hold=true';
        $body = wp_json_encode( array( 'data' => array( $event_payload ) ) );
        $headers = array_merge( array(
            'Content-Type' => 'application/json',
            'X-API-Key'    => $settings['api_key'],
        ), buykorigw_signed_headers( $settings['api_key'], $body ) );

        $response = wp_remote_post( $url, array(
            'timeout'   => 10,
            'sslverify' => true,
            'headers'   => $headers,
            'body'      => $body,
        ) );

        if ( is_wp_error( $response ) ) {
            // Critical failure — always log regardless of debug_mode
            error_log( '[Buykori AdSync] Deferred purchase send failed for order #' . $order_id . ': ' . $response->get_error_message() );
        }

        if ( ! is_wp_error( $response ) ) {
            $code = wp_remote_retrieve_response_code( $response );
            $sent = ( $code >= 200 && $code < 300 );
            if ( ! $sent && $settings['debug_mode'] ) {
                error_log( '[Buykori AdSync] Deferred purchase HTTP ' . $code . ': ' . wp_remote_retrieve_body( $response ) );
            }
        }
    } else {
        // Immediate send
        $sent = buykorigw_send_event( $event_payload, true );
    }

    // Mark as tracked to prevent duplicates
    if ( ! $sent ) {
        buykorigw_update_order_meta( $order_id, '_buykorigw_confirm_status', 'send_failed' );
        return;
    }

    buykorigw_update_order_meta( $order_id, '_buykorigw_tracked', 1 );

    if ( $settings['debug_mode'] ) {
        error_log( '[Buykori AdSync] Purchase tracked for order #' . $order_id );
    }
}


// ─── Helper: Get Real Client IP ────────────────────────────────────────────────
function buykorigw_get_real_ip() {
    $headers = array(
        'HTTP_CF_CONNECTING_IP',   // Cloudflare
        'HTTP_X_FORWARDED_FOR',    // Proxies
        'HTTP_X_REAL_IP',          // Nginx
        'REMOTE_ADDR',             // Default
    );

    foreach ( $headers as $header ) {
        if ( ! empty( $_SERVER[ $header ] ) ) {
            $ip = $_SERVER[ $header ];
            // X-Forwarded-For can have multiple IPs, take the first
            if ( strpos( $ip, ',' ) !== false ) {
                $ip = trim( explode( ',', $ip )[0] );
            }
            if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE ) ) {
                return $ip;
            }
        }
    }

    return $_SERVER['REMOTE_ADDR'] ?? '';
}
