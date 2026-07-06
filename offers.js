/* ========================================
   GA OFFERS — Irresistible Offer Creator
   Industry-specific, segment-tailored,
   scarcity-driven offers with A/B testing
   ======================================== */
window.Offers = (function () {
  'use strict';

  var OFFERS = {
    medical: {
      label: 'Medical & Healthcare',
      icon: '🏥',
      offers: [
        { id: 'med_telemed', name: 'Free Telemedicine Integration', desc: 'We add a HIPAA-compliant telemedicine portal to your existing site — $2,500 value, free with any package', value: 2500, cost: 0, effort: 'low', cta: 'Claim Free Telemedicine Add-on' },
        { id: 'med_booking', name: 'Free Patient Booking System', desc: 'Online appointment scheduling with automated reminders — $1,800 value, included free', value: 1800, cost: 0, effort: 'low', cta: 'Add Free Booking' },
        { id: 'med_portal', name: 'Free Patient Portal', desc: 'Secure login for patients to access records, lab results, and messaging — $3,000 value', value: 3000, cost: 0, effort: 'medium', cta: 'Get Free Patient Portal' }
      ]
    },
    dental: {
      label: 'Dental',
      icon: '🦷',
      offers: [
        { id: 'dent_booking', name: 'Free Online Booking System', desc: '24/7 appointment scheduling with SMS reminders — $1,800 value, free with any package', value: 1800, cost: 0, effort: 'low', cta: 'Add Free Booking' },
        { id: 'dent_reviews', name: 'Free Review Management', desc: 'Automated Google review collection + reputation widget — $1,200 value, included free', value: 1200, cost: 0, effort: 'low', cta: 'Get Free Review System' },
        { id: 'dent_smile', name: 'Free Smile Gallery', desc: 'Before/after photo gallery with case filtering — $1,500 value, free with Growth+', value: 1500, cost: 0, effort: 'medium', cta: 'Claim Smile Gallery' }
      ]
    },
    legal: {
      label: 'Legal & Law Firms',
      icon: '⚖️',
      offers: [
        { id: 'legal_intake', name: 'Free Client Intake Automation', desc: 'Automated intake forms + document collection + e-signature — $2,000 value, free with any package', value: 2000, cost: 0, effort: 'low', cta: 'Add Free Intake System' },
        { id: 'legal_consult', name: 'Free Consultation Scheduler', desc: 'Calendar booking with practice area routing and payment collection — $1,500 value', value: 1500, cost: 0, effort: 'low', cta: 'Get Free Scheduler' },
        { id: 'legal_portal', name: 'Free Client Portal', desc: 'Secure document sharing + case status tracking for clients — $2,500 value', value: 2500, cost: 0, effort: 'medium', cta: 'Claim Client Portal' }
      ]
    },
    financial: {
      label: 'Financial Services',
      icon: '💰',
      offers: [
        { id: 'fin_portal', name: 'Free Secure Client Portal', desc: 'Encrypted document exchange + financial dashboard access — $3,000 value, free with any package', value: 3000, cost: 0, effort: 'medium', cta: 'Add Free Portal' },
        { id: 'fin_calc', name: 'Free Financial Calculator', desc: 'Custom ROI, mortgage, or retirement calculator for your site — $2,000 value', value: 2000, cost: 0, effort: 'low', cta: 'Get Free Calculator' },
        { id: 'fin_scheduler', name: 'Free Appointment System', desc: 'Client booking with calendar sync + automated reminders — $1,500 value', value: 1500, cost: 0, effort: 'low', cta: 'Add Free Booking' }
      ]
    },
    'home services': {
      label: 'Home Services',
      icon: '🔧',
      offers: [
        { id: 'home_quote', name: 'Free Instant Quote Calculator', desc: 'Interactive quote estimator for your services — $1,500 value, free with any package', value: 1500, cost: 0, effort: 'low', cta: 'Add Free Quote Tool' },
        { id: 'home_booking', name: 'Free Service Booking', desc: 'Online scheduling with route optimization integration — $1,800 value', value: 1800, cost: 0, effort: 'low', cta: 'Get Free Booking' },
        { id: 'home_gallery', name: 'Free Project Gallery', desc: 'Photo portfolio with before/after sliders and filtering — $1,200 value', value: 1200, cost: 0, effort: 'low', cta: 'Claim Free Gallery' }
      ]
    },
    manufacturing: {
      label: 'Manufacturing',
      icon: '🏭',
      offers: [
        { id: 'mfg_catalog', name: 'Free Product Catalog System', desc: 'Searchable product catalog with specs, CAD downloads, and RFQ forms — $2,500 value, free with any package', value: 2500, cost: 0, effort: 'medium', cta: 'Add Free Catalog' },
        { id: 'mfg_portal', name: 'Free Supplier Portal', desc: 'B2B login portal for distributors with order history and库存 tracking — $3,500 value', value: 3500, cost: 0, effort: 'medium', cta: 'Get Free Portal' },
        { id: 'mfg_cert', name: 'Free Certifications Display', desc: 'Interactive certifications and compliance badge section — $1,000 value', value: 1000, cost: 0, effort: 'low', cta: 'Add Certifications' }
      ]
    },
    automotive: {
      label: 'Automotive',
      icon: '🚗',
      offers: [
        { id: 'auto_inventory', name: 'Free Inventory Management', desc: 'Real-time vehicle inventory with VIN decoding, photos, and lead forms — $2,000 value, free with any package', value: 2000, cost: 0, effort: 'medium', cta: 'Add Free Inventory' },
        { id: 'auto_service', name: 'Free Service Scheduler', desc: 'Online repair booking with bay scheduling integration — $1,800 value', value: 1800, cost: 0, effort: 'low', cta: 'Get Free Scheduler' },
        { id: 'auto_trade', name: 'Free Trade-In Tool', desc: 'Vehicle trade-in valuation form that captures leads — $1,500 value', value: 1500, cost: 0, effort: 'low', cta: 'Add Trade-In Tool' }
      ]
    },
    retail: {
      label: 'Retail & E-commerce',
      icon: '🛍️',
      offers: [
        { id: 'retail_cart', name: 'Free Shopping Cart Setup', desc: 'Full e-commerce cart integration with abandoned cart recovery — $2,500 value, free with any package', value: 2500, cost: 0, effort: 'medium', cta: 'Add Free Cart' },
        { id: 'retail_reviews', name: 'Free Product Reviews', desc: 'Customer review system with photo uploads and rich snippets — $1,500 value', value: 1500, cost: 0, effort: 'low', cta: 'Get Free Reviews' },
        { id: 'retail_rewards', name: 'Free Loyalty Program', desc: 'Points-based loyalty system with email integration — $2,000 value', value: 2000, cost: 0, effort: 'medium', cta: 'Add Loyalty Program' }
      ]
    },
    technology: {
      label: 'Technology',
      icon: '💻',
      offers: [
        { id: 'tech_api', name: 'Free API Integration', desc: 'Connect your existing tools (CRM, ERP, Marketing) to your new site — $3,000 value, free with any package', value: 3000, cost: 0, effort: 'medium', cta: 'Add Free Integration' },
        { id: 'tech_docs', name: 'Free Documentation Portal', desc: 'Searchable knowledge base or API docs for your users — $2,500 value', value: 2500, cost: 0, effort: 'medium', cta: 'Get Free Docs' },
        { id: 'tech_changelog', name: 'Free Changelog & Roadmap', desc: 'Public changelog feature request board for your product — $1,500 value', value: 1500, cost: 0, effort: 'low', cta: 'Add Changelog' }
      ]
    },
    'real estate': {
      label: 'Real Estate',
      icon: '🏠',
      offers: [
        { id: 're_mls', name: 'Free MLS Property Feed', desc: 'Auto-syncing property listings from MLS directly to your site — $2,500 value, free with any package', value: 2500, cost: 0, effort: 'medium', cta: 'Add Free MLS Feed' },
        { id: 're_tours', name: 'Free Virtual Tours', desc: 'Embed 3D virtual tours and video walkthroughs for listings — $2,000 value', value: 2000, cost: 0, effort: 'low', cta: 'Get Free Virtual Tours' },
        { id: 're_valuation', name: 'Free Property Valuation Tool', desc: 'Instant home value estimator that captures seller leads — $1,800 value', value: 1800, cost: 0, effort: 'low', cta: 'Add Valuation Tool' }
      ]
    },
    construction: {
      label: 'Construction & Trades',
      icon: '🏗️',
      offers: [
        { id: 'con_gallery', name: 'Free Project Gallery System', desc: 'Portfolio with before/after, filtering, and project detail pages — $1,800 value, free with any package', value: 1800, cost: 0, effort: 'low', cta: 'Add Free Gallery' },
        { id: 'con_estimator', name: 'Free Project Estimator', desc: 'Interactive quote builder for different project types — $2,000 value', value: 2000, cost: 0, effort: 'low', cta: 'Get Free Estimator' },
        { id: 'con_scheduler', name: 'Free Crew Scheduling', desc: 'Project timeline display with milestone tracking — $1,500 value', value: 1500, cost: 0, effort: 'medium', cta: 'Add Scheduler' }
      ]
    },
    hospitality: {
      label: 'Hospitality & Tourism',
      icon: '🏨',
      offers: [
        { id: 'hotel_booking', name: 'Free Booking Engine', desc: 'Direct booking system with room/table selection and payment — $2,500 value, free with any package', value: 2500, cost: 0, effort: 'medium', cta: 'Add Free Booking' },
        { id: 'hotel_reviews', name: 'Free Review Widget', desc: 'TripAdvisor + Google review aggregator with rich snippets — $1,200 value', value: 1200, cost: 0, effort: 'low', cta: 'Get Free Reviews' },
        { id: 'hotel_gallery', name: 'Free Virtual Tour', desc: '360° room/venue virtual tour with hotspots — $2,000 value', value: 2000, cost: 0, effort: 'medium', cta: 'Add Virtual Tour' }
      ]
    }
  };

  /* Scarcity hooks by segment */
  var SCARCITY = {
    hot: [
      { id: 'scarcity_3spots', text: 'Only 3 spots left this month at this rate', urgency: 'high' },
      { id: 'scarcity_7days', text: 'Offer expires in 7 days', urgency: 'high' },
      { id: 'scarcity_double', text: 'Double the offer if you sign this week', urgency: 'medium' }
    ],
    warm: [
      { id: 'scarcity_5spots', text: '5 clients on this offer this quarter', urgency: 'medium' },
      { id: 'scarcity_14days', text: 'Available for the next 14 days', urgency: 'medium' },
      { id: 'scarcity_first3', text: 'First 3 to respond get bonus add-on', urgency: 'medium' }
    ],
    cold: [
      { id: 'scarcity_limited', text: 'Limited-time introductory offer', urgency: 'low' },
      { id: 'scarcity_free', text: 'Free audit — no obligation, limited daily', urgency: 'low' }
    ]
  };

  /* -------------------------
     PUBLIC API
     ------------------------- */

  function getOffersForLead(lead) {
    if (!lead) return [];
    var industry = (lead.industry || '').toLowerCase().trim();
    var industryOffers = OFFERS[industry] || null;

    // Try partial match
    if (!industryOffers) {
      var keys = Object.keys(OFFERS);
      for (var i = 0; i < keys.length; i++) {
        if (industry.indexOf(keys[i]) !== -1 || keys[i].indexOf(industry) !== -1) {
          industryOffers = OFFERS[keys[i]];
          break;
        }
      }
    }

    // Fallback to generic
    if (!industryOffers) {
      return getGenericOffers(lead);
    }

    var segment = lead.segment || 'warm';
    var results = industryOffers.offers.map(function (o) {
      var scarcity = pickScarcity(segment);
      var priority = getOfferPriority(o, segment);
      return {
        offer: o,
        industry: industryOffers.label,
        icon: industryOffers.icon,
        headline: o.name,
        description: o.desc,
        value: o.value,
        scarcity: scarcity,
        priority: priority,
        cta: o.cta,
        displayValue: '$' + o.value.toLocaleString(),
        fullText: o.name + ' — ' + o.desc + '. ' + scarcity.text
      };
    });

    // Sort by priority
    results.sort(function (a, b) { return b.priority - a.priority; });
    return results;
  }

  function getGenericOffers(lead) {
    var segment = lead.segment || 'warm';
    var generic = [
      { id: 'gen_audit', name: 'Free Comprehensive Website Audit', desc: 'Full 41-point audit covering design, performance, SEO, mobile, security, and conversions — $500 value, free with any package', value: 500, cost: 0, effort: 'low', cta: 'Get Free Audit' },
      { id: 'gen_strategy', name: 'Free Growth Strategy Session', desc: '60-minute strategy session with conversion roadmap and revenue projection — $1,000 value', value: 1000, cost: 0, effort: 'low', cta: 'Book Free Strategy Session' },
      { id: 'gen_landing', name: 'Free Landing Page Build', desc: 'We design and build one high-converting landing page for your best offer — $2,000 value', value: 2000, cost: 0, effort: 'medium', cta: 'Claim Free Landing Page' },
      { id: 'gen_seo', name: 'Free SEO Quick-Win Report', desc: 'Actionable SEO fixes that can boost traffic by 30%+ in 30 days — $750 value', value: 750, cost: 0, effort: 'low', cta: 'Get Free SEO Report' }
    ];
    var scarcity = pickScarcity(segment);
    return generic.map(function (o) {
      return {
        offer: o,
        industry: 'General',
        icon: '🎯',
        headline: o.name,
        description: o.desc,
        value: o.value,
        scarcity: scarcity,
        priority: segment === 'hot' ? 90 : segment === 'warm' ? 70 : 50,
        cta: o.cta,
        displayValue: '$' + o.value.toLocaleString(),
        fullText: o.name + ' — ' + o.desc + '. ' + scarcity.text
      };
    });
  }

  function pickScarcity(segment) {
    var hooks = SCARCITY[segment] || SCARCITY.cold;
    return hooks[Math.floor(Math.random() * hooks.length)];
  }

  function getOfferPriority(offer, segment) {
    var base = segment === 'hot' ? 80 : segment === 'warm' ? 60 : 40;
    // Higher value offers get priority boost
    base += Math.min(20, Math.round(offer.value / 200));
    // Lower effort gets slight boost
    if (offer.effort === 'low') base += 10;
    return base;
  }

  function generateLeadOffer(lead) {
    var offers = getOffersForLead(lead);
    if (!offers || !offers.length) return null;
    return offers[0]; // Best offer
  }

  function injectOfferIntoMessage(messageBody, offer) {
    if (!messageBody || !offer) return messageBody || '';
    var lines = messageBody.split('\n');
    // Find a good insertion point — before the sign-off or at the end
    var signOffIdx = -1;
    for (var i = lines.length - 1; i >= 0; i--) {
      if (/^(best|regards|cheers|thanks|sincerely)/i.test(lines[i].trim())) {
        signOffIdx = i;
        break;
      }
    }
    var offerBlock = '\n\n🎁 *Exclusive Offer:* ' + offer.headline + '\n' +
      offer.description + '\n' +
      '💰 Value: ' + offer.displayValue + ' — ' + offer.scarcity.text + '\n' +
      '👉 ' + offer.cta + ': reply to this email or book a call.';
    if (signOffIdx >= 0) {
      lines.splice(signOffIdx, 0, offerBlock);
    } else {
      lines.push(offerBlock);
    }
    return lines.join('\n');
  }

  function getOfferAnalytics() {
    try {
      return JSON.parse(localStorage.getItem('ga_offer_analytics') || '{}');
    } catch (e) { return {}; }
  }

  function trackOfferAction(offerId, leadId, action) {
    var analytics = getOfferAnalytics();
    if (!analytics[offerId]) {
      analytics[offerId] = { sent: 0, opened: 0, clicked: 0, converted: 0, leads: [] };
    }
    analytics[offerId][action] = (analytics[offerId][action] || 0) + 1;
    if (action === 'sent' && leadId) analytics[offerId].leads.push(leadId);
    try { localStorage.setItem('ga_offer_analytics', JSON.stringify(analytics)); } catch (e) {}
  }

  function getAllIndustries() {
    return Object.keys(OFFERS).map(function (k) {
      return { id: k, label: OFFERS[k].label, icon: OFFERS[k].icon, count: OFFERS[k].offers.length };
    });
  }

  function getOfferById(id) {
    for (var key in OFFERS) {
      for (var i = 0; i < OFFERS[key].offers.length; i++) {
        if (OFFERS[key].offers[i].id === id) return OFFERS[key].offers[i];
      }
    }
    return null;
  }

  function getAllOffers() {
    var all = [];
    for (var key in OFFERS) {
      OFFERS[key].offers.forEach(function (o) {
        all.push({ industry: key, industryLabel: OFFERS[key].label, icon: OFFERS[key].icon, offer: o });
      });
    }
    return all;
  }

  return {
    getOffersForLead: getOffersForLead,
    getGenericOffers: getGenericOffers,
    generateLeadOffer: generateLeadOffer,
    injectOfferIntoMessage: injectOfferIntoMessage,
    getOfferAnalytics: getOfferAnalytics,
    trackOfferAction: trackOfferAction,
    getAllIndustries: getAllIndustries,
    getOfferById: getOfferById,
    getAllOffers: getAllOffers,
    OFFERS: OFFERS,
    SCARCITY: SCARCITY
  };
})();
