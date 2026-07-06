/* ========================================
   GA ADMIN — SCORING ENGINE
   Growth-intent scoring (not outdated design)
   ======================================== */
window.Scoring = (function () {
  'use strict';

  var INDUSTRY_ISSUES = {
    'Technology': ['No conversion funnel','Missing analytics','Poor landing pages','No email sequences','Weak CTAs'],
    'Medical': ['No patient portal','Missing appointment booking','No lead capture','Poor mobile UX','No follow-up automation'],
    'Dental': ['No online booking','Missing smile gallery','No lead magnet','Poor Google Business integration','No review requests'],
    'Home Services': ['No quote request flow','Missing click-to-call','No service area pages','Poor local SEO','No estimate automation'],
    'Manufacturing': ['No RFQ form','Missing spec sheets','No lead scoring','Poor B2B funnels','No CRM integration'],
    'Legal': ['No intake forms','Missing case evaluations','No client portal','Poor trust signals','No appointment scheduling'],
    'Financial': ['No lead magnets','Missing calculators','No nurture sequences','Poor compliance UX','No client dashboard'],
    'Automotive': ['No inventory search','Missing financing tools','No service scheduling','Poor lead capture','No follow-up sequences'],
    'Retail': ['No abandoned cart recovery','Missing email flows','Poor product pages','No loyalty program','No upsell system'],
    'Food': ['No online ordering','Missing delivery integration','No loyalty program','Poor mobile ordering','No catering funnel'],
    'Grocery': ['No delivery scheduling','Missing weekly deals flow','No loyalty integration','Poor pickup UX','No recipe funnels'],
    'Insurance': ['No quote engine','Missing comparison tools','No nurture sequences','Poor agent matching','No claims portal'],
    'Telecom': ['No self-service portal','Missing plan comparison','No upgrade funnel','Poor onboarding flow','No retention automation'],
    'Media': ['No subscription funnel','Missing paywall logic','No audience segmentation','Poor content gating','No newsletter automation'],
    'Nonprofit': ['No donation flow','Missing recurring giving','No volunteer signup','Poor impact reporting','No event funnels'],
    'Education': ['No enrollment funnel','Missing course catalog','No student portal','Poor application flow','No alumni automation'],
    'Construction': ['No estimate request','Missing project gallery','No lead qualification','Poor local targeting','No follow-up system'],
    'Hospitality': ['No booking engine','Missing loyalty program','No upsell flow','Poor review management','No package builder'],
    'Real Estate': ['No property search','Missing lead capture','No mortgage calculator','Poor listing alerts','No showing scheduler'],
    'Default': ['No conversion funnel','Missing analytics','Poor landing pages','No email sequences','Weak CTAs']
  };

  var TARGET_INDUSTRIES = [
    'Medical','Dental','Home Services','Manufacturing','Legal','Financial',
    'Automotive','Retail','Technology','Healthcare','Real Estate','Insurance'
  ];

  /**
   * Growth-intent score (0-100)
   * Scores based on opportunity, not outdated design
   */
  function calculateQualScore(lead) {
    var score = 20; // base

    // Running paid ads (high intent signal) — +20
    if (lead.adSpend && lead.adSpend > 0) {
      if (lead.adSpend > 10000) score += 20;
      else if (lead.adSpend > 5000) score += 15;
      else if (lead.adSpend > 1000) score += 10;
      else score += 5;
    }

    // High traffic + low conversion (biggest CRO opportunity) — +25
    if (lead.monthlyTraffic && lead.conversionRate) {
      if (lead.monthlyTraffic > 10000 && lead.conversionRate < 2) score += 25;
      else if (lead.monthlyTraffic > 5000 && lead.conversionRate < 2.5) score += 20;
      else if (lead.monthlyTraffic > 1000 && lead.conversionRate < 3) score += 15;
      else if (lead.conversionRate < 3.5) score += 10;
    }

    // No automation (upsell opportunity) — +15
    if (!lead.hasAutomation) score += 15;

    // Revenue factor (budget available) — +10
    var val = lead.value || 0;
    if (val >= 100) score += 10;
    else if (val >= 10) score += 8;
    else if (val >= 2) score += 5;
    else if (val >= 0.5) score += 3;

    // Target industry — +10
    if (TARGET_INDUSTRIES.indexOf(lead.industry) !== -1) score += 10;

    // Has email list (engaged audience) — +5
    if (lead.emailListSize && lead.emailListSize > 1000) score += 5;

    // Priority alignment
    if (lead.priority === 'High') score += 5;
    else if (lead.priority === 'Low') score -= 3;

    // Red flags penalty
    score -= (lead.redFlags || 0) * 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Detect red flags (wrong buyer signals)
   */
  function detectRedFlags(lead) {
    var flags = [];

    // Very low traffic (can't run meaningful tests)
    if (lead.monthlyTraffic && lead.monthlyTraffic < 5000) {
      flags.push('Low traffic — insufficient for A/B testing');
    }

    // No ad spend + no automation (may not be growth-focused)
    if ((!lead.adSpend || lead.adSpend === 0) && lead.hasAutomation) {
      flags.push('No paid acquisition — may lack growth budget');
    }

    // Outside target vertical
    if (TARGET_INDUSTRIES.indexOf(lead.industry) === -1) {
      flags.push('Outside core industry vertical');
    }

    // Very small company
    if (lead.value && lead.value < 0.5) {
      flags.push('Revenue under $500K — limited budget');
    }

    // High conversion already (less opportunity)
    if (lead.conversionRate && lead.conversionRate > 4) {
      flags.push('Already high conversion rate — limited upside');
    }

    return flags;
  }

  /**
   * Get industry-specific issues
   */
  function getIssues(industry, score) {
    var issues = INDUSTRY_ISSUES[industry] || INDUSTRY_ISSUES['Default'];
    var count = score > 70 ? 2 : score > 40 ? 3 : 4;
    var start = Math.abs(score) % issues.length;
    var result = [];
    for (var i = 0; i < count; i++) {
      result.push(issues[(start + i) % issues.length]);
    }
    return result;
  }

  /**
   * Analyze website — REAL analysis via Netlify Function
   * Falls back to client-side CORS proxy if function unavailable.
   */
  function analyzeWebsite(url) {
    return new Promise(function (resolve) {
      if (!url || url.indexOf('.') === -1) {
        resolve({ design: 0, mobile: 0, performance: 0, total: 0, issues: ['Invalid URL'], offline: true });
        return;
      }

      if (!/^https?:\/\//.test(url)) url = 'https://' + url;

      // Try Netlify Function first (production)
      fetch('/.netlify/functions/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
      })
        .then(function (r) {
          if (!r.ok) throw new Error('Function unavailable');
          return r.json();
        })
        .then(function (result) { resolve(result); })
        .catch(function () {
          // Fallback: CORS proxy (dev/staging)
          var proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);
          fetch(proxyUrl, { mode: 'cors' })
            .then(function (r) {
              if (!r.ok) throw new Error('HTTP ' + r.status);
              return r.text();
            })
            .then(function (html) { resolve(analyzeHTML(html, url)); })
            .catch(function () { resolve(analyzeFromURL(url)); });
        });
    });
  }

  /**
   * Analyze fetched HTML for real conversion signals
   */
  function analyzeHTML(html, url) {
    var lower = html.toLowerCase();
    var issues = [];
    var wins = [];
    var scoreDesign = 70;
    var scoreMobile = 60;
    var scorePerf = 65;

    // === DESIGN SCORE CHECKS ===

    // 1. Title tag
    var titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (!titleMatch || !titleMatch[1].trim()) {
      issues.push('Missing or empty <title> tag');
      scoreDesign -= 8;
    } else if (titleMatch[1].trim().length < 10) {
      issues.push('Title tag too short — poor SEO signal');
      scoreDesign -= 4;
    } else {
      wins.push('Title tag present');
    }

    // 2. Meta description
    if (lower.indexOf('meta name="description"') === -1 && lower.indexOf('meta name=\'description\'') === -1) {
      issues.push('Missing meta description — hurts CTR from search');
      scoreDesign -= 5;
    } else {
      wins.push('Meta description present');
    }

    // 3. Open Graph tags
    if (lower.indexOf('og:title') === -1) {
      issues.push('Missing Open Graph tags — poor social sharing preview');
      scoreDesign -= 3;
    } else {
      wins.push('Open Graph tags present');
    }

    // 4. Favicon
    if (lower.indexOf('rel="icon"') === -1 && lower.indexOf('rel="shortcut icon"') === -1 && lower.indexOf('.ico') === -1) {
      issues.push('Missing favicon');
      scoreDesign -= 2;
    }

    // 5. HTTPS
    if (url.indexOf('https://') === 0) {
      wins.push('HTTPS enabled');
      scoreDesign += 5;
    } else {
      issues.push('Not using HTTPS — browsers show "Not Secure" warning');
      scoreDesign -= 10;
      scorePerf -= 5;
    }

    // 6. Heading structure
    var h1Count = (html.match(/<h1[\s>]/gi) || []).length;
    if (h1Count === 0) {
      issues.push('No <h1> tag — poor SEO and accessibility');
      scoreDesign -= 5;
    } else if (h1Count > 1) {
      issues.push('Multiple <h1> tags — confusing page hierarchy');
      scoreDesign -= 3;
    } else {
      wins.push('Single <h1> tag present');
    }

    // === MOBILE SCORE CHECKS ===

    // 7. Viewport meta tag
    if (lower.indexOf('viewport') === -1 || lower.indexOf('width=device-width') === -1) {
      issues.push('Missing mobile viewport meta tag — site not mobile-optimized');
      scoreMobile -= 25;
    } else {
      wins.push('Mobile viewport tag present');
      scoreMobile += 15;
    }

    // 8. Responsive CSS indicators
    var hasMediaQueries = lower.indexOf('@media') !== -1;
    var hasFlexbox = lower.indexOf('display:flex') !== -1 || lower.indexOf('display: flex') !== -1;
    var hasGrid = lower.indexOf('display:grid') !== -1 || lower.indexOf('display: grid') !== -1;
    if (hasMediaQueries || hasFlexbox || hasGrid) {
      wins.push('Responsive CSS detected');
      scoreMobile += 10;
    } else {
      issues.push('No responsive CSS detected — likely not mobile-friendly');
      scoreMobile -= 15;
    }

    // 9. Mobile-specific: tap targets, font-size
    if (lower.indexOf('font-size') !== -1) {
      var smallFont = lower.match(/font-size\s*:\s*(\d+)px/g) || [];
      var hasSmallFonts = smallFont.some(function (f) {
        var size = parseInt(f.match(/(\d+)/)[1]);
        return size < 12;
      });
      if (hasSmallFonts) {
        issues.push('Tiny font sizes detected — hard to read on mobile');
        scoreMobile -= 5;
      }
    }

    // === PERFORMANCE SCORE CHECKS ===

    // 10. Image optimization
    var imgCount = (html.match(/<img[\s>]/gi) || []).length;
    var lazyImages = (lower.match(/loading="lazy"/g) || []).length;
    if (imgCount > 0) {
      if (lazyImages === 0) {
        issues.push(imgCount + ' images without lazy loading — slow initial load');
        scorePerf -= 10;
      } else {
        wins.push(lazyImages + ' images with lazy loading');
        scorePerf += 5;
      }
    }

    // 11. Large images without dimensions
    var imgNoDimensions = (html.match(/<img(?![^>]*(width|height))[^>]*>/gi) || []).length;
    if (imgNoDimensions > 3) {
      issues.push(imgNoDimensions + ' images missing width/height — causes layout shift (CLS)');
      scorePerf -= 5;
    }

    // 12. Inline CSS/JS bloat
    var inlineStyleCount = (lower.match(/<style[\s>]/g) || []).length;
    var inlineScriptCount = (lower.match(/<script[\s>]/g) || []).length;
    if (inlineStyleCount > 5 || inlineScriptCount > 8) {
      issues.push('Excessive inline CSS/JS — consider bundling');
      scorePerf -= 5;
    }

    // 13. External scripts (analytics, etc.)
    var hasGA = lower.indexOf('google-analytics') !== -1 || lower.indexOf('gtag') !== -1 || lower.indexOf('googletagmanager') !== -1;
    var hasFBPixel = lower.indexOf('fbq(') !== -1 || lower.indexOf('facebook') !== -1;
    var hasHotjar = lower.indexOf('hotjar') !== -1;
    if (hasGA || hasFBPixel || hasHotjar) {
      wins.push('Analytics/tracking detected');
    } else {
      issues.push('No analytics or conversion tracking detected');
      scorePerf -= 5;
    }

    // === CONVERSION SCORE CHECKS ===

    // 14. Forms
    var formCount = (html.match(/<form[\s>]/gi) || []).length;
    var hasEmailInput = lower.indexOf('type="email"') !== -1 || lower.indexOf("type='email'") !== -1;
    var hasPhoneInput = lower.indexOf('type="tel"') !== -1 || lower.indexOf("type='tel'") !== -1;
    if (formCount === 0) {
      issues.push('No contact forms found — no way for visitors to convert');
      scoreDesign -= 12;
    } else {
      wins.push(formCount + ' form(s) found');
      if (hasEmailInput) wins.push('Email input detected');
      if (hasPhoneInput) wins.push('Phone input detected');
    }

    // 15. CTA buttons
    var ctaKeywords = ['get started', 'sign up', 'contact us', 'get a quote', 'request', 'book', 'schedule', 'buy', 'order', 'subscribe', 'download', 'free', 'audit', 'consultation'];
    var hasCTA = ctaKeywords.some(function (kw) { return lower.indexOf(kw) !== -1; });
    if (hasCTA) {
      wins.push('Call-to-action text detected');
      scoreDesign += 5;
    } else {
      issues.push('No clear call-to-action text found');
      scoreDesign -= 8;
    }

    // 16. Social proof
    var proofKeywords = ['testimonial', 'review', 'client', 'customer', 'trust', 'rating', 'star', 'feedback', 'case study', 'portfolio'];
    var hasProof = proofKeywords.some(function (kw) { return lower.indexOf(kw) !== -1; });
    if (hasProof) {
      wins.push('Social proof elements detected');
      scoreDesign += 5;
    } else {
      issues.push('No social proof elements — testimonials, reviews, or case studies');
      scoreDesign -= 5;
    }

    // 17. Contact info
    var hasPhone = /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/.test(html) || lower.indexOf('tel:') !== -1;
    var hasEmail = lower.indexOf('mailto:') !== -1;
    if (hasPhone || hasEmail) {
      wins.push('Contact information present');
    } else {
      issues.push('No visible phone number or email — trust and conversion barrier');
      scoreDesign -= 5;
    }

    // 18. Copyright freshness
    var copyrightMatch = lower.match(/©|&copy;|copyright.*?(\d{4})/);
    if (copyrightMatch) {
      var year = parseInt(copyrightMatch[1]);
      var currentYear = new Date().getFullYear();
      if (year < currentYear - 1) {
        issues.push('Copyright year outdated (' + year + ') — signals neglected site');
        scoreDesign -= 5;
      } else {
        wins.push('Copyright year current');
      }
    }

    // 19. Flash / outdated tech
    if (lower.indexOf('.swf') !== -1 || lower.indexOf('flash') !== -1) {
      issues.push('Uses Adobe Flash — obsolete technology');
      scoreDesign -= 15;
      scoreMobile -= 20;
    }

    // 20. jQuery (potential performance issue)
    if (lower.indexOf('jquery') !== -1) {
      issues.push('Uses jQuery — consider modern lightweight alternatives');
      scorePerf -= 3;
    }

    // 21. Inline styles bloat
    var inlineStyleLen = 0;
    var styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
    styleMatches.forEach(function (s) { inlineStyleLen += s.length; });
    if (inlineStyleLen > 50000) {
      issues.push('Excessive inline styles (' + Math.round(inlineStyleLen / 1024) + 'KB) — slow rendering');
      scorePerf -= 8;
    }

    // 22. Schema markup
    if (lower.indexOf('application/ld+json') !== -1 || lower.indexOf('itemtype') !== -1) {
      wins.push('Structured data (Schema.org) detected');
      scoreDesign += 3;
    } else {
      issues.push('No structured data — missed rich snippet opportunity');
      scoreDesign -= 2;
    }

    // Clamp scores
    scoreDesign = Math.max(10, Math.min(95, scoreDesign));
    scoreMobile = Math.max(10, Math.min(95, scoreMobile));
    scorePerf = Math.max(10, Math.min(95, scorePerf));

    var total = Math.round((scoreDesign + scoreMobile + scorePerf) / 3);

    return {
      design: scoreDesign,
      mobile: scoreMobile,
      performance: scorePerf,
      total: total,
      issues: issues,
      wins: wins,
      htmlSize: Math.round(html.length / 1024),
      imageCount: imgCount,
      formCount: formCount,
      hasAnalytics: hasGA || hasFBPixel,
      https: url.indexOf('https://') === 0
    };
  }

  /**
   * Fallback: score from URL structure alone (when fetch fails)
   */
  function analyzeFromURL(url) {
    var issues = [];
    var score = 50;

    if (url.indexOf('https://') === 0) { score += 10; }
    else { issues.push('Not using HTTPS'); score -= 10; }

    if (url.indexOf('www.') !== -1) { score += 3; }

    var domain = url.replace(/https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
    if (domain.length > 20) { issues.push('Very long domain name'); score -= 3; }

    issues.push('Could not fetch website — analysis based on URL structure only');
    issues.push('Try again later or check if the site is accessible');

    return {
      design: Math.max(10, score),
      mobile: Math.max(10, score - 5),
      performance: Math.max(10, score - 3),
      total: Math.max(10, score),
      issues: issues,
      wins: [],
      offline: true
    };
  }

  /**
   * Pre-qualification checklist
   */
  var QUAL_CHECKLIST = [
    { id: 'ads', label: 'Running paid ads ($1K+/mo)', weight: 25 },
    { id: 'traffic', label: '5,000+ monthly visitors', weight: 20 },
    { id: 'conversion', label: 'Conversion rate below 3%', weight: 20 },
    { id: 'automation', label: 'No email automation', weight: 15 },
    { id: 'revenue', label: '$2M+ annual revenue', weight: 20 }
  ];

  function evaluateChecklist(answers) {
    var total = 0;
    QUAL_CHECKLIST.forEach(function (item) {
      if (answers[item.id]) total += item.weight;
    });
    return total;
  }

  /**
   * Calculate lost revenue opportunity
   */
  function calculateOpportunity(lead) {
    if (!lead.monthlyTraffic || !lead.conversionRate) return null;
    var currentLeads = Math.round(lead.monthlyTraffic * (lead.conversionRate / 100));
    var benchmarkCVR = 3.5;
    var potentialLeads = Math.round(lead.monthlyTraffic * (benchmarkCVR / 100));
    var additionalLeads = potentialLeads - currentLeads;
    var avgDealValue = (lead.value || 1) * 1000000 / 12; // rough monthly revenue / deals
    var monthlyOpportunity = additionalLeads * avgDealValue * 0.1; // 10% close rate
    return {
      currentLeads: currentLeads,
      potentialLeads: potentialLeads,
      additionalLeads: additionalLeads,
      monthlyOpportunity: Math.round(monthlyOpportunity),
      annualOpportunity: Math.round(monthlyOpportunity * 12)
    };
  }

  return {
    calculateQualScore: calculateQualScore,
    detectRedFlags: detectRedFlags,
    getIssues: getIssues,
    analyzeWebsite: analyzeWebsite,
    QUAL_CHECKLIST: QUAL_CHECKLIST,
    evaluateChecklist: evaluateChecklist,
    calculateOpportunity: calculateOpportunity,
    INDUSTRY_ISSUES: INDUSTRY_ISSUES,
    TARGET_INDUSTRIES: TARGET_INDUSTRIES
  };
})();
