/* ========================================
   GA ADMIN — DATA MODULE
   161 leads + state/industry config
   ======================================== */
window.Data = (function () {
  'use strict';

  var STATE_NAMES = {
    AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
    CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',
    IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',
    ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
    MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',
    NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',
    NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',
    PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',
    TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',
    WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia',
    ON:'Ontario',QC:'Quebec',BC:'British Columbia',AB:'Alberta'
  };

  var ALL_STATES = Object.keys(STATE_NAMES);

  var REGIONS = {
    'Northeast': ['CT','ME','MA','NH','NJ','NY','PA','RI','VT'],
    'South': ['AL','AR','DE','DC','FL','GA','KY','LA','MD','MS','NC','OK','SC','TN','TX','VA','WV'],
    'Midwest': ['IL','IN','IA','KS','MI','MN','MO','NE','ND','OH','SD','WI'],
    'West': ['AK','AZ','CA','CO','HI','ID','MT','NV','NM','OR','UT','WA','WY'],
    'Canada': ['ON','QC','BC','AB']
  };

  function getRegion(state) {
    var keys = Object.keys(REGIONS);
    for (var i = 0; i < keys.length; i++) {
      if (REGIONS[keys[i]].indexOf(state) !== -1) return keys[i];
    }
    return 'Other';
  }

  var INDUSTRIES = [
    'Medical','Dental','Home Services','Manufacturing','Legal','Financial',
    'Automotive','Retail','Technology','Energy','Media','Telecom','Food',
    'Grocery','Insurance','Apparel','Transportation','Education','Nonprofit',
    'Construction','Hospitality','Travel','Utility','Agribusiness','Consumer Goods',
    'Engineering','Entertainment','Auto Retail','Defense','Pharma','Luxury','Logistics',
    'Real Estate','Healthcare'
  ];

  var REDESIGN_FILES = {
    35:'berkshire',36:'koch',37:'koch',38:'cargill',39:'fidelity',
    40:'hearst',41:'scjohnson',43:'heb',44:'publix',47:'comcast',
    66:'verizon',93:'mcdonalds'
  };

  var STATUSES = ['New','Contacted','Meeting','Proposal','Closed'];
  var PRIORITIES = ['High','Medium','Low'];

  function r(a) { return a[Math.floor(Math.random() * a.length)]; }
  function randomScore() { return Math.floor(Math.random() * 50) + 30; }
  function randomFlags() {
    var roll = Math.random();
    if (roll < 0.45) return 0;
    if (roll < 0.7) return 1;
    if (roll < 0.85) return 2;
    return 3;
  }

  // === ENTERPRISE LEADS (116) ===
  var rawEnterprise = [
    // Maryland (6)
    {name:'T. Rowe Price',state:'MD',industry:'Financial',value:1.5,url:'https://troweprice.com',city:'Baltimore'},
    {name:'Black & Decker',state:'MD',industry:'Manufacturing',value:0.8,url:'https://blackanddecker.com',city:'Towson'},
    {name:'McCormick',state:'MD',industry:'Food',value:0.6,url:'https://mccormick.com',city:'Hunt Valley'},
    {name:'Under Armour',state:'MD',industry:'Apparel',value:0.5,url:'https://underarmour.com',city:'Baltimore'},
    {name:'Sinclair',state:'MD',industry:'Media',value:0.3,url:'https://sbgi.net',city:'Hunt Valley'},
    {name:'Genuine Parts',state:'MD',industry:'Automotive',value:0.4,url:'https://genpt.com',city:'Cockeysville'},
    // Texas (8)
    {name:'ConocoPhillips',state:'TX',industry:'Energy',value:3.5,url:'https://conocophillips.com',city:'Houston'},
    {name:'Energy Transfer',state:'TX',industry:'Energy',value:2.1,url:'https://energytransfer.com',city:'Dallas'},
    {name:'Texas Flange',state:'TX',industry:'Manufacturing',value:0.1,url:'https://texasflange.com',city:'Houston'},
    {name:'Midtex Oil',state:'TX',industry:'Energy',value:0.3,url:'https://midtexoil.com',city:'Midland'},
    {name:'Bowtex',state:'TX',industry:'Manufacturing',value:0.05,url:'https://bowtex.com',city:'Houston'},
    {name:'JC Co',state:'TX',industry:'Manufacturing',value:0.02,url:'https://jccompany.com',city:'Dallas'},
    {name:'W.M. Dewey',state:'TX',industry:'Manufacturing',value:0.01,url:'https://wmdewey.com',city:'San Antonio'},
    {name:'Seybro Door',state:'TX',industry:'Manufacturing',value:0.01,url:'https://seybrodoor.com',city:'Fort Worth'},
    // Other NA (20)
    {name:'Craigslist',state:'CA',industry:'Technology',value:0.5,url:'https://craigslist.org',city:'San Francisco'},
    {name:'Goodreads',state:'CA',industry:'Technology',value:0.1,url:'https://goodreads.com',city:'San Francisco'},
    {name:'CVS',state:'RI',industry:'Retail',value:3.2,url:'https://cvshealth.com',city:'Woonsocket'},
    {name:'Yahoo',state:'CA',industry:'Technology',value:0.8,url:'https://yahoo.com',city:'Sunnyvale'},
    {name:'Pacific NW X-Ray',state:'OR',industry:'Medical',value:0.02,url:'https://pnwx.com',city:'Gresham'},
    {name:'Suzanne Collins',state:'CT',industry:'Media',value:0.01,url:'https://suzannecollinsbooks.com',city:'Newtown'},
    {name:'Penny Juice',state:'IA',industry:'Food',value:0.01,url:'https://pennyjuice.com',city:'Milton'},
    {name:'Toronto Cupcake',state:'ON',industry:'Food',value:0.01,url:'https://torontocupcake.com',city:'Toronto'},
    {name:'Lipton',state:'NJ',industry:'Food',value:0.5,url:'https://lipton.com',city:'Englewood Cliffs'},
    {name:'Bank of America',state:'NC',industry:'Financial',value:4.5,url:'https://bankofamerica.com',city:'Charlotte'},
    {name:'Life Action Revival',state:'AR',industry:'Nonprofit',value:0.01,url:'https://liferevival.com',city:'Rogers'},
    {name:'RockAuto',state:'WI',industry:'Automotive',value:0.1,url:'https://rockauto.com',city:'Madison'},
    {name:'BikesDirect',state:'IL',industry:'Retail',value:0.05,url:'https://bikesdirect.com',city:'Chicago'},
    {name:'Gerber Life',state:'NY',industry:'Insurance',value:0.2,url:'https://gerberlife.com',city:'New York'},
    {name:'Yale School of Art',state:'CT',industry:'Education',value:0.01,url:'https://art.yale.edu',city:'New Haven'},
    {name:'Workday',state:'CA',industry:'Technology',value:0.6,url:'https://workday.com',city:'Pleasanton'},
    {name:'Kroger',state:'OH',industry:'Retail',value:2.5,url:'https://kroger.com',city:'Cincinnati'},
    {name:'Pep Boys',state:'PA',industry:'Automotive',value:0.3,url:'https://pepboys.com',city:'Philadelphia'},
    {name:'Blinkee',state:'FL',industry:'Retail',value:0.02,url:'https://blinkee.com',city:'Miami'},
    {name:'L.L.Bean',state:'ME',industry:'Retail',value:0.2,url:'https://llbean.com',city:'Freeport'},
    // Elite HNW (18)
    {name:'Berkshire Hathaway',state:'NE',industry:'Financial',value:750,url:'https://berkshirehathaway.com',city:'Omaha',handcrafted:true},
    {name:'Koch Industries',state:'KS',industry:'Energy',value:110,url:'https://kochind.com',city:'Wichita',handcrafted:true},
    {name:'Koch Foods',state:'KS',industry:'Food',value:110,url:'https://kochfoods.com',city:'Wichita'},
    {name:'Cargill',state:'MN',industry:'Food',value:115,url:'https://cargill.com',city:'Wayzata',handcrafted:true},
    {name:'Fidelity',state:'MA',industry:'Financial',value:35,url:'https://fidelity.com',city:'Boston',handcrafted:true},
    {name:'Hearst',state:'NY',industry:'Media',value:12,url:'https://hearst.com',city:'New York',handcrafted:true},
    {name:'SC Johnson',state:'WI',industry:'Consumer Goods',value:8,url:'https://scjohnson.com',city:'Racine',handcrafted:true},
    {name:'Bechtel',state:'VA',industry:'Engineering',value:17,url:'https://bechtel.com',city:'Reston'},
    {name:'HEB',state:'TX',industry:'Retail',value:35,url:'https://heb.com',city:'San Antonio',handcrafted:true},
    {name:'Publix',state:'FL',industry:'Retail',value:48,url:'https://publix.com',city:'Lakeland',handcrafted:true},
    {name:'Sheetz',state:'PA',industry:'Retail',value:10,url:'https://sheetz.com',city:'Altoona'},
    {name:'Wegmans',state:'NY',industry:'Retail',value:11,url:'https://wegmans.com',city:'Rochester'},
    {name:'Comcast',state:'PA',industry:'Telecom',value:120,url:'https://comcast.com',city:'Philadelphia',handcrafted:true},
    {name:'Penske',state:'MI',industry:'Transportation',value:35,url:'https://penske.com',city:'Bloomfield Hills'},
    {name:'Menards',state:'WI',industry:'Retail',value:12,url:'https://menards.com',city:'Eau Claire'},
    {name:'Hobby Lobby',state:'OK',industry:'Retail',value:7,url:'https://hobbylobby.com',city:'Oklahoma City'},
    {name:'Drudge Report',state:'FL',industry:'Media',value:0.05,url:'https://drudgereport.com',city:'Miami'},
    {name:'Deloitte',state:'NY',industry:'Financial',value:30,url:'https://deloitte.com',city:'New York'},
    // African American (13)
    {name:'Cushcity',state:'TX',industry:'Retail',value:0.02,url:'https://cushcity.com',city:'Houston'},
    {name:'J. Strickland',state:'TX',industry:'Consumer Goods',value:0.01,url:'https://jstrickland.com',city:'Dallas'},
    {name:'Medu Bookstore',state:'IL',industry:'Retail',value:0.005,url:'https://medubookstore.com',city:'Chicago'},
    {name:'Shades of Color',state:'CA',industry:'Retail',value:0.005,url:'https://shadesofcolor.com',city:'Los Angeles'},
    {name:'African Bookstore',state:'IL',industry:'Retail',value:0.003,url:'https://africanbookstore.com',city:'Chicago'},
    {name:'Wilsdom',state:'GA',industry:'Technology',value:0.01,url:'https://wilsdom.com',city:'Atlanta'},
    {name:'Taliah Waajid',state:'GA',industry:'Consumer Goods',value:0.01,url:'https://taliahwaajid.com',city:'Atlanta'},
    {name:'MahoganyBooks',state:'DC',industry:'Retail',value:0.003,url:'https://mahoganybooks.com',city:'Washington'},
    {name:'NAN',state:'NY',industry:'Nonprofit',value:0.01,url:'https://nationalactionnetwork.net',city:'New York'},
    {name:'Rainbow PUSH',state:'IL',industry:'Nonprofit',value:0.01,url:'https://rainbowpush.org',city:'Chicago'},
    {name:'Wall Street Project',state:'NY',industry:'Financial',value:0.01,url:'https://wallstreetproject.org',city:'New York'},
    {name:'Black Enterprise',state:'NY',industry:'Media',value:0.02,url:'https://blackenterprise.com',city:'New York'},
    {name:'Afro Elite Designs',state:'MD',industry:'Retail',value:0.003,url:'https://afroelitedesigns.com',city:'Baltimore'},
    // New York (7)
    {name:'Verizon',state:'NY',industry:'Telecom',value:135,url:'https://verizon.com',city:'New York',handcrafted:true},
    {name:'Con Edison',state:'NY',industry:'Utility',value:0.5,url:'https://coned.com',city:'New York'},
    {name:'JetBlue',state:'NY',industry:'Transportation',value:0.8,url:'https://jetblue.com',city:'Queens'},
    {name:'MSG',state:'NY',industry:'Entertainment',value:0.4,url:'https://msg.com',city:'New York'},
    {name:"Sotheby's",state:'NY',industry:'Luxury',value:0.6,url:'https://sothebys.com',city:'New York'},
    {name:'Loews Corp',state:'NY',industry:'Financial',value:0.7,url:'https://loews.com',city:'New York'},
    {name:'L3Harris',state:'NY',industry:'Defense',value:0.9,url:'https://l3harris.com',city:'Rochester'},
    // Connecticut (4)
    {name:'Charter',state:'CT',industry:'Telecom',value:1.2,url:'https://charter.com',city:'Stamford'},
    {name:'Synchrony',state:'CT',industry:'Financial',value:0.8,url:'https://synchrony.com',city:'Stamford'},
    {name:'Pitney Bowes',state:'CT',industry:'Logistics',value:0.5,url:'https://pitneybowes.com',city:'Stamford'},
    {name:'Webster Bank',state:'CT',industry:'Financial',value:0.3,url:'https://websterbank.com',city:'Waterbury'},
    // Massachusetts (5)
    {name:'State Street',state:'MA',industry:'Financial',value:1.5,url:'https://statestreet.com',city:'Boston'},
    {name:'Liberty Mutual',state:'MA',industry:'Insurance',value:1.2,url:'https://libertymutual.com',city:'Boston'},
    {name:'Boston Scientific',state:'MA',industry:'Medical',value:1.0,url:'https://bostonscientific.com',city:'Marlborough'},
    {name:'Biogen',state:'MA',industry:'Pharma',value:0.9,url:'https://biogen.com',city:'Cambridge'},
    {name:'Eversource',state:'MA',industry:'Utility',value:0.6,url:'https://eversource.com',city:'Springfield'},
    // California (10)
    {name:'Wells Fargo',state:'CA',industry:'Financial',value:3.0,url:'https://wellsfargo.com',city:'San Francisco'},
    {name:'Chevron',state:'CA',industry:'Energy',value:2.8,url:'https://chevron.com',city:'San Ramon'},
    {name:'PG&E',state:'CA',industry:'Utility',value:1.5,url:'https://pge.com',city:'Oakland'},
    {name:'eBay',state:'CA',industry:'Technology',value:1.2,url:'https://ebay.com',city:'San Jose'},
    {name:'Gap Inc',state:'CA',industry:'Apparel',value:0.8,url:'https://gap.com',city:'San Francisco'},
    {name:'LA Times',state:'CA',industry:'Media',value:0.3,url:'https://latimes.com',city:'Los Angeles'},
    {name:'SF Chronicle',state:'CA',industry:'Media',value:0.2,url:'https://sfchronicle.com',city:'San Francisco'},
    {name:'Charles Schwab',state:'CA',industry:'Financial',value:1.8,url:'https://schwab.com',city:'San Francisco'},
    {name:'Clorox',state:'CA',industry:'Consumer Goods',value:0.7,url:'https://clorox.com',city:'Oakland'},
    {name:'Levi Strauss',state:'CA',industry:'Apparel',value:0.6,url:'https://levi.com',city:'San Francisco'},
    // Illinois (8)
    {name:"McDonald's",state:'IL',industry:'Food',value:3.5,url:'https://mcdonalds.com',city:'Chicago',handcrafted:true},
    {name:'Walgreens',state:'IL',industry:'Retail',value:2.0,url:'https://walgreens.com',city:'Deerfield'},
    {name:'United Airlines',state:'IL',industry:'Transportation',value:1.5,url:'https://united.com',city:'Chicago'},
    {name:'Abbott',state:'IL',industry:'Medical',value:2.0,url:'https://abbott.com',city:'Abbott Park'},
    {name:'State Farm',state:'IL',industry:'Insurance',value:2.5,url:'https://statefarm.com',city:'Bloomington'},
    {name:'Caterpillar',state:'IL',industry:'Manufacturing',value:1.8,url:'https://caterpillar.com',city:'Deerfield'},
    {name:'John Deere',state:'IL',industry:'Manufacturing',value:1.2,url:'https://deere.com',city:'Moline'},
    {name:'Mondelez',state:'IL',industry:'Food',value:1.0,url:'https://mondelez.com',city:'Chicago'},
    // Florida (5)
    {name:'Hertz',state:'FL',industry:'Transportation',value:0.8,url:'https://hertz.com',city:'Bonita Springs'},
    {name:'Carnival',state:'FL',industry:'Hospitality',value:1.2,url:'https://carnival.com',city:'Miami'},
    {name:'Royal Caribbean',state:'FL',industry:'Hospitality',value:1.0,url:'https://royalcaribbean.com',city:'Miami'},
    {name:'AutoNation',state:'FL',industry:'Auto Retail',value:0.6,url:'https://autonation.com',city:'Fort Lauderdale'},
    {name:'Office Depot',state:'FL',industry:'Retail',value:0.5,url:'https://officedepot.com',city:'Boca Raton'},
    // DC/MD/VA (6)
    {name:'Marriott',state:'MD',industry:'Hospitality',value:2.5,url:'https://marriott.com',city:'Bethesda'},
    {name:'USPS',state:'DC',industry:'Logistics',value:1.2,url:'https://usps.com',city:'Washington'},
    {name:'Fannie Mae',state:'DC',industry:'Financial',value:1.5,url:'https://fanniemae.com',city:'Washington'},
    {name:'Freddie Mac',state:'VA',industry:'Financial',value:1.3,url:'https://freddiemac.com',city:'McLean'},
    {name:'Amtrak',state:'DC',industry:'Transportation',value:0.6,url:'https://amtrak.com',city:'Washington'},
    {name:'AARP',state:'DC',industry:'Nonprofit',value:0.4,url:'https://aarp.org',city:'Washington'},
    // Canada (6)
    {name:'Rogers',state:'ON',industry:'Telecom',value:1.2,url:'https://rogers.com',city:'Toronto'},
    {name:'Canadian Tire',state:'ON',industry:'Retail',value:1.0,url:'https://canadiantire.ca',city:'Toronto'},
    {name:'Air Canada',state:'QC',industry:'Transportation',value:0.8,url:'https://aircanada.com',city:'Montreal'},
    {name:'BMO',state:'ON',industry:'Financial',value:1.5,url:'https://bmo.com',city:'Toronto'},
    {name:'Telus',state:'BC',industry:'Telecom',value:0.9,url:'https://telus.com',city:'Vancouver'},
    {name:'Loblaw',state:'ON',industry:'Retail',value:0.6,url:'https://loblaw.ca',city:'Brampton'}
  ];

  // === MAIN STREET LEADS (45) ===
  var rawMainStreet = [
    {name:'Green Valley Dental',state:'AZ',industry:'Dental',value:0.6,city:'Phoenix'},
    {name:'Oak Street Dentistry',state:'OH',industry:'Dental',value:0.9,city:'Columbus'},
    {name:'Bright Smiles Dental',state:'FL',industry:'Dental',value:0.4,city:'Orlando'},
    {name:'Precision Dental Care',state:'TX',industry:'Dental',value:1.1,city:'Austin'},
    {name:'Lakeside Family Medicine',state:'MI',industry:'Medical',value:0.7,city:'Grand Rapids'},
    {name:'Main Street Cafe',state:'PA',industry:'Food',value:0.3,city:'Lancaster'},
    {name:'Riverside Grill',state:'OR',industry:'Food',value:0.5,city:'Portland'},
    {name:"Bella's Italian Kitchen",state:'NY',industry:'Food',value:0.8,city:'Buffalo'},
    {name:'Fresh Harvest Market',state:'CA',industry:'Grocery',value:1.5,city:'Sacramento'},
    {name:'Corner Grocery & Deli',state:'NC',industry:'Retail',value:0.4,city:'Raleigh'},
    {name:'Apex Plumbing & HVAC',state:'TX',industry:'Home Services',value:0.9,city:'Dallas'},
    {name:'Clean Sweep Chimney',state:'MA',industry:'Home Services',value:0.3,city:'Boston'},
    {name:'Premium Roofing Solutions',state:'FL',industry:'Home Services',value:1.2,city:'Tampa'},
    {name:'Elite Electric',state:'IL',industry:'Home Services',value:0.6,city:'Chicago'},
    {name:'Pristine Landscaping',state:'GA',industry:'Home Services',value:0.5,city:'Atlanta'},
    {name:'Metro Auto Repair',state:'NY',industry:'Automotive',value:0.7,city:'Brooklyn'},
    {name:'German Auto Specialists',state:'CA',industry:'Automotive',value:1.3,city:'Los Angeles'},
    {name:'Tire Kingdom Plus',state:'TX',industry:'Automotive',value:0.5,city:'Houston'},
    {name:'Precision Collision Center',state:'FL',industry:'Automotive',value:0.8,city:'Miami'},
    {name:'Summit Manufacturing Co.',state:'OH',industry:'Manufacturing',value:3.2,city:'Cleveland'},
    {name:'Precision Parts Inc.',state:'IN',industry:'Manufacturing',value:2.1,city:'Indianapolis'},
    {name:'Atlas Fabrication',state:'TX',industry:'Manufacturing',value:4.5,city:'San Antonio'},
    {name:'Smith & Associates Law',state:'NY',industry:'Legal',value:2.8,city:'New York'},
    {name:'Johnson Legal Group',state:'CA',industry:'Legal',value:3.5,city:'San Diego'},
    {name:'Miller & Miller Attorneys',state:'FL',industry:'Legal',value:1.5,city:'Jacksonville'},
    {name:'First Community Financial',state:'PA',industry:'Financial',value:2.2,city:'Pittsburgh'},
    {name:'Liberty Insurance Brokers',state:'TX',industry:'Insurance',value:1.8,city:'Austin'},
    {name:'Secure Future Insurance',state:'OH',industry:'Insurance',value:1.2,city:'Columbus'},
    {name:'Metro West Insurance',state:'CA',industry:'Insurance',value:2.5,city:'San Francisco'},
    {name:'Heartland Insurance Group',state:'IL',industry:'Insurance',value:1.6,city:'Chicago'},
    {name:'GreenTech Solutions',state:'WA',industry:'Technology',value:2.8,city:'Seattle'},
    {name:'Digital Frontier LLC',state:'OR',industry:'Technology',value:1.5,city:'Portland'},
    {name:'Cloud Nine Consulting',state:'CO',industry:'Technology',value:3.2,city:'Denver'},
    {name:'North Star Construction',state:'MN',industry:'Construction',value:4.2,city:'Minneapolis'},
    {name:'Heritage Builders',state:'VA',industry:'Construction',value:2.5,city:'Richmond'},
    {name:'Cornerstone Contractors',state:'NC',industry:'Construction',value:1.8,city:'Charlotte'},
    {name:'Elite Property Group',state:'FL',industry:'Real Estate',value:3.1,city:'Miami'},
    {name:'Lakeside Realty',state:'MI',industry:'Real Estate',value:0.9,city:'Detroit'},
    {name:'Mountain View Real Estate',state:'CO',industry:'Real Estate',value:1.2,city:'Boulder'},
    {name:"Dr. Sarah's Pediatric Care",state:'MA',industry:'Medical',value:0.8,city:'Boston'},
    {name:'Great Smiles Orthodontics',state:'NJ',industry:'Dental',value:1.1,city:'Newark'},
    {name:'Advanced Spine & Joint',state:'AZ',industry:'Medical',value:1.4,city:'Tucson'},
    {name:'Paws & Claws Veterinary',state:'OR',industry:'Medical',value:0.6,city:'Portland'},
    {name:'Capital City Animal Hospital',state:'TX',industry:'Medical',value:0.9,city:'Dallas'},
    {name:'Peak Performance PT',state:'CO',industry:'Medical',value:0.7,city:'Denver'}
  ];

  function randomAdSpend() { return Math.round((Math.random() * 49500 + 500) / 100) * 100; }
  function randomTraffic() { return Math.round((Math.random() * 499000 + 1000) / 1000) * 1000; }
  function randomCVR() { return Math.round((Math.random() * 4 + 0.5) * 10) / 10; }
  function randomEmailList() { return Math.round((Math.random() * 50000) / 100) * 100; }
  function randomAutomation() { return Math.random() > 0.55; }

  var enterpriseLeads = rawEnterprise.map(function (d, i) {
    return {
      id: i + 1, type: 'enterprise', name: d.name, state: d.state,
      industry: d.industry, value: d.value, status: r(STATUSES),
      priority: r(PRIORITIES), qualScore: randomScore(), redFlags: randomFlags(),
      tags: [], url: d.url || '#', city: d.city || '', region: getRegion(d.state),
      notes: '', handcrafted: !!d.handcrafted,
      adSpend: randomAdSpend(), monthlyTraffic: randomTraffic(),
      conversionRate: randomCVR(), emailListSize: randomEmailList(),
      hasAutomation: randomAutomation()
    };
  });

  var mainstreetLeads = rawMainStreet.map(function (d, i) {
    return {
      id: i + 200, type: 'mainstreet', name: d.name, state: d.state,
      industry: d.industry, value: d.value, status: r(STATUSES),
      priority: r(PRIORITIES), qualScore: randomScore(), redFlags: randomFlags(),
      tags: [], url: d.url || '#', city: d.city || '', region: getRegion(d.state),
      notes: '', handcrafted: false,
      adSpend: randomAdSpend(), monthlyTraffic: randomTraffic(),
      conversionRate: randomCVR(), emailListSize: randomEmailList(),
      hasAutomation: randomAutomation()
    };
  });

  return {
    STATE_NAMES: STATE_NAMES,
    ALL_STATES: ALL_STATES,
    REGIONS: REGIONS,
    INDUSTRIES: INDUSTRIES,
    REDESIGN_FILES: REDESIGN_FILES,
    STATUSES: STATUSES,
    PRIORITIES: PRIORITIES,
    ENTERPRISE_LEADS: enterpriseLeads,
    MAIN_STREET_LEADS: mainstreetLeads,
    getRegion: getRegion
  };
})();
