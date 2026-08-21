(function() {
  "use strict";

  var themes = {
    financial: {
      palette: ["#0a1628","#1a3a5c","#c9a84c","#fff","#f5f5f0"],
      heroGradient: "linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #0d2137 100%)",
      services: ["Wealth Management","Investment Advisory","Retirement Planning","Risk Management"],
      icon: "\uD83D\uDCB0",
      headline: "Financial Excellence, Redefined",
      subheadline: "Strategic wealth solutions built on decades of expertise and unwavering trust.",
      about: "For over two decades, we have guided individuals and institutions through complex financial landscapes. Our advisors combine quantitative rigor with personalized attention to deliver strategies that endure market cycles and build lasting prosperity.",
      stats: [{n:"$2.4B+",l:"Assets Under Management"},{n:"15K+",l:"Clients Served"},{n:"98%",l:"Client Retention"}],
      testimonials: [
        {name:"Sarah Mitchell",role:"CEO, Mitchell Holdings",quote:"Their team transformed our approach to capital allocation. Our portfolio has outperformed benchmarks consistently for three years running."},
        {name:"David Chen",role:"Founder, Chen Ventures",quote:"Exceptional insight and integrity. They don't just manage money\u2014they build financial futures with a level of care that's rare in this industry."}
      ]
    },
    medical: {
      palette: ["#0055a4","#0077cc","#00a878","#fff","#f0f7ff"],
      heroGradient: "linear-gradient(135deg, #0055a4 0%, #0077cc 50%, #00a878 100%)",
      services: ["Primary Care","Specialist Consultations","Preventive Medicine","Patient Portal"],
      icon: "\u2695\uFE0F",
      headline: "Modern Healthcare, Better Outcomes",
      subheadline: "Compassionate, technology-driven medicine that puts patients first.",
      about: "Our practice combines board-certified physicians with cutting-edge diagnostic tools to deliver healthcare that is both personal and precise. From routine wellness to complex conditions, we treat the whole person with dignity and clinical excellence.",
      stats: [{n:"50K+",l:"Patients Treated"},{n:"40+",l:"Specialist Physicians"},{n:"4.9\u2605",l:"Patient Rating"}],
      testimonials: [
        {name:"Dr. Angela Torres",role:"Cardiology Patient",quote:"The level of attention and thoroughness I received was unlike anything I've experienced. They truly listen and follow through."},
        {name:"Michael Brown",role:"Family Patient",quote:"Our family has been with this practice for eight years. The online portal and same-day appointments make healthcare effortless."}
      ]
    },
    dental: {
      palette: ["#0066cc","#4da6ff","#00c9a7","#fff","#f0f8ff"],
      heroGradient: "linear-gradient(135deg, #0066cc 0%, #4da6ff 60%, #00c9a7 100%)",
      services: ["General Dentistry","Cosmetic Dentistry","Orthodontics","Oral Surgery"],
      icon: "\uD83E\uDDB7",
      headline: "Your Smile, Reimagined",
      subheadline: "Advanced dental care in a comfortable, modern environment.",
      about: "We believe everyone deserves a confident, healthy smile. Our practice features the latest in digital imaging, laser dentistry, and aesthetic techniques. From routine cleanings to full-mouth rehabilitation, our team delivers results that look as good as they feel.",
      stats: [{n:"25K+",l:"Smiles Transformed"},{n:"15+",l:"Years of Excellence"},{n:"99%",l:"Satisfaction Rate"}],
      testimonials: [
        {name:"Jessica Lane",role:"Cosmetic Patient",quote:"I was terrified of the dentist until I came here. The staff made me feel completely at ease, and the results exceeded every expectation."},
        {name:"Robert Kim",role:"Orthodontics Patient",quote:"My invisalign treatment was seamless. The digital preview let me see my smile before starting. Truly impressive technology and care."}
      ]
    },
    "home-services": {
      palette: ["#1a5276","#2980b9","#27ae60","#fff","#f0f5ff"],
      heroGradient: "linear-gradient(135deg, #1a5276 0%, #2980b9 50%, #27ae60 100%)",
      services: ["Plumbing","HVAC","Electrical","Emergency Repairs"],
      icon: "\uD83D\uDD27",
      headline: "Trusted Home Experts",
      subheadline: "Fast, reliable service from licensed professionals who respect your home.",
      about: "We are the team your neighbors call when things break down. Fully licensed, insured, and available 24/7 for emergencies. Our technicians arrive on time, diagnose issues accurately, and fix them right the first time\u2014guaranteed.",
      stats: [{n:"30K+",l:"Homes Serviced"},{n:"24/7",l:"Emergency Service"},{n:"4.9\u2605",l:"Google Rating"}],
      testimonials: [
        {name:"Karen Owens",role:"Homeowner",quote:"A burst pipe at 2 AM and they were at my door in 30 minutes. Professional, clean, and fair pricing. I recommend them to everyone."},
        {name:"James Rivera",role:"Property Manager",quote:"We manage 200+ units and this is our go-to vendor. Reliable, responsive, and their work is always top-notch."}
      ]
    },
    manufacturing: {
      palette: ["#1a1a2e","#16213e","#e94560","#fff","#f5f5f5"],
      heroGradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #e94560 100%)",
      services: ["Precision Manufacturing","Quality Control","Custom Solutions","Logistics"],
      icon: "\u2699\uFE0F",
      headline: "Engineering Excellence",
      subheadline: "Precision-crafted components and solutions for the most demanding industries.",
      about: "From aerospace to medical devices, our ISO-certified facilities produce components with tolerances measured in microns. We combine advanced CNC capabilities with rigorous quality systems to deliver parts that perform flawlessly in mission-critical applications.",
      stats: [{n:"99.7%",l:"Quality Rate"},{n:"200+",l:"CNC Machines"},{n:"35+",l:"Countries Served"}],
      testimonials: [
        {name:"Tom Bradley",role:"VP Engineering, AeroCorp",quote:"Their precision and consistency are unmatched. We've reduced defect rates by 40% since switching to their manufacturing line."},
        {name:"Lin Wei",role:"Supply Chain Director",quote:"On-time delivery, impeccable quality, and proactive communication. They're not a vendor\u2014they're a strategic partner."}
      ]
    },
    legal: {
      palette: ["#1a1a2e","#2c3e50","#c9a84c","#fff","#f8f7f4"],
      heroGradient: "linear-gradient(135deg, #1a1a2e 0%, #2c3e50 50%, #1a2a3a 100%)",
      services: ["Corporate Law","Litigation","Intellectual Property","Compliance"],
      icon: "\u2696\uFE0F",
      headline: "Justice. Precision. Results.",
      subheadline: "Strategic legal counsel for complex matters demanding expertise and discretion.",
      about: "Our attorneys bring decades of combined experience across corporate transactions, high-stakes litigation, and regulatory compliance. We combine deep legal knowledge with business acumen to protect our clients' interests and advance their objectives with unwavering dedication.",
      stats: [{n:"500+",l:"Cases Won"},{n:"$3B+",l:"Verdicts Secured"},{n:"98%",l:"Success Rate"}],
      testimonials: [
        {name:"Patricia Morgan",role:"General Counsel, TechVista",quote:"Their litigation team defended a $200M patent dispute with extraordinary skill. The outcome exceeded our most optimistic projections."},
        {name:"William Hale",role:"CEO, Hale Industries",quote:"Counsel you can trust implicitly. They anticipate issues before they arise and structure deals that protect us completely."}
      ]
    },
    automotive: {
      palette: ["#1a1a1a","#2d2d2d","#e63946","#fff","#f5f5f5"],
      heroGradient: "linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #e63946 100%)",
      services: ["Sales","Service & Repair","Parts","Finance"],
      icon: "\uD83D\uDE97",
      headline: "Drive the Difference",
      subheadline: "Premium vehicles, expert service, and a buying experience designed around you.",
      about: "We're not just a dealership\u2014we're automotive enthusiasts committed to matching every customer with the perfect vehicle. Our state-of-the-art service center, extensive inventory, and transparent financing make us the destination for drivers who expect more.",
      stats: [{n:"5K+",l:"Vehicles Sold"},{n:"100%",l:"Certified Techs"},{n:"4.8\u2605",l:"Customer Rating"}],
      testimonials: [
        {name:"Marcus Johnson",role:"First-Time Buyer",quote:"Zero pressure, total transparency. They walked me through every option and got me into exactly the car I wanted at a great price."},
        {name:"Elena Vargas",role:"Returning Customer",quote:"On my third purchase here. The service department is just as good as the sales floor\u2014honest, efficient, and always fair."}
      ]
    },
    retail: {
      palette: ["#2c3e50","#34495e","#e67e22","#fff","#fafafa"],
      heroGradient: "linear-gradient(135deg, #2c3e50 0%, #34495e 50%, #e67e22 100%)",
      services: ["Product Showcase","E-Commerce","Loyalty Programs","In-Store Experience"],
      icon: "\uD83D\uDECD\uFE0F",
      headline: "Retail, Reimagined",
      subheadline: "Omnichannel retail solutions that drive engagement and maximize lifetime value.",
      about: "We help brands create seamless shopping experiences across every touchpoint. From immersive in-store environments to frictionless e-commerce platforms, our solutions blend data-driven strategy with creative execution to turn browsers into loyal advocates.",
      stats: [{n:"1.2M+",l:"Transactions Processed"},{n:"35%",l:"Revenue Increase"},{n:"850+",l:"Brands Served"}],
      testimonials: [
        {name:"Amanda Foster",role:"VP Digital, UrbanStyle",quote:"Their e-commerce redesign increased our conversion rate by 42%. The integration with our physical stores created a truly unified experience."},
        {name:"Derek Simmons",role:"Owner, Simmons Boutique",quote:"The loyalty program they built drives 60% of our repeat business. Customer data insights have transformed how we stock and market."}
      ]
    },
    technology: {
      palette: ["#0f0f23","#1a1a3e","#00d4ff","#fff","#f0f4ff"],
      heroGradient: "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #00d4ff 100%)",
      services: ["Cloud Solutions","Cybersecurity","AI & Analytics","Digital Transformation"],
      icon: "\uD83D\uDCBB",
      headline: "Innovation at Scale",
      subheadline: "Enterprise technology solutions that accelerate growth and protect your digital assets.",
      about: "From cloud architecture to AI implementation, we engineer solutions that give organizations a decisive competitive advantage. Our team of certified architects and engineers partners with Fortune 500 companies and ambitious startups alike to solve their most complex technical challenges.",
      stats: [{n:"99.99%",l:"Uptime SLA"},{n:"200+",l:"Enterprise Clients"},{n:"50+",l:"Patents Held"}],
      testimonials: [
        {name:"Priya Sharma",role:"CTO, DataStream",quote:"They migrated our entire infrastructure to a multi-cloud architecture in 90 days with zero downtime. The performance gains were immediate and dramatic."},
        {name:"Alex Kowalski",role:"CISO, SecureBank",quote:"Their security team identified vulnerabilities our internal team missed. After their audit and remediation, we achieved SOC 2 compliance in record time."}
      ]
    },
    energy: {
      palette: ["#1a1a2e","#0d3b66","#f4a261","#fff","#f5f0eb"],
      heroGradient: "linear-gradient(135deg, #1a1a2e 0%, #0d3b66 60%, #f4a261 100%)",
      services: ["Exploration","Renewable Energy","Grid Solutions","Energy Trading"],
      icon: "\u26A1",
      headline: "Powering Tomorrow",
      subheadline: "Integrated energy solutions for a world that never stops demanding more.",
      about: "We operate across the full energy value chain\u2014from upstream exploration and production to renewable generation and smart grid management. Our commitment to sustainable innovation ensures we deliver reliable power while reducing environmental impact for generations to come.",
      stats: [{n:"15GW+",l:"Generation Capacity"},{n:"12",l:"Countries Active"},{n:"30%",l:"Carbon Reduction"}],
      testimonials: [
        {name:"Henrik Larsen",role:"Director, NordicPower",quote:"Their grid optimization solution reduced our transmission losses by 18%. The ROI materialized within the first quarter of deployment."},
        {name:"Maria Santos",role:"VP Sustainability, GreenCo",quote:"They helped us transition 40% of our portfolio to renewables in two years. Technical excellence paired with genuine environmental commitment."}
      ]
    },
    media: {
      palette: ["#0f0f0f","#1a1a1a","#ff6b35","#fff","#f5f5f5"],
      heroGradient: "linear-gradient(135deg, #0f0f0f 0%, #1a1a1a 50%, #ff6b35 100%)",
      services: ["Content Production","Digital Distribution","Audience Analytics","Brand Partnerships"],
      icon: "\uD83C\uDFAC",
      headline: "Stories That Move",
      subheadline: "Content creation and distribution strategies that captivate audiences and drive results.",
      about: "From concept to distribution, we produce compelling content and build the infrastructure to deliver it to the right audiences at the right time. Our data-driven approach ensures every piece of content performs, whether it's a brand film, social campaign, or full-scale production.",
      stats: [{n:"1B+",l:"Content Impressions"},{n:"200+",l:"Productions Completed"},{n:"12M+",l:"Audience Reach"}],
      testimonials: [
        {name:"Jordan Blake",role:"Creative Director, Pulse Media",quote:"Their production quality rivals major studios, but with the agility and creative hunger of a boutique shop. The results speak for themselves."},
        {name:"Nina Patel",role:"Marketing VP, BrandX",quote:"They transformed our content strategy from sporadic posts to a systematic engine that generates measurable engagement and brand awareness."}
      ]
    },
    telecom: {
      palette: ["#0a0a2e","#1a1a4e","#00c853","#fff","#f0f0ff"],
      heroGradient: "linear-gradient(135deg, #0a0a2e 0%, #1a1a4e 50%, #00c853 100%)",
      services: ["Network Solutions","Cloud Communications","IoT","Enterprise Solutions"],
      icon: "\uD83D\uDCF6",
      headline: "Connected Future",
      subheadline: "Intelligent network infrastructure powering seamless global communication.",
      about: "We design, deploy, and manage communications infrastructure that keeps the world connected. From 5G rollouts to enterprise cloud PBX systems, our solutions deliver the reliability and scale that modern businesses and communities depend on every second of every day.",
      stats: [{n:"99.99%",l:"Network Uptime"},{n:"50M+",l:"Endpoints Managed"},{n:"200+",l:"Carrier Partners"}],
      testimonials: [
        {name:"Raj Mehta",role:"Network Engineer, TelcoOne",quote:"Their 5G deployment solution cut our rollout timeline by 35%. The automated monitoring platform they built catches issues before customers even notice."},
        {name:"Sandra Kline",role:"CTO, ConnectPro",quote:"Enterprise-grade reliability with startup-level innovation. They've become our go-to partner for every major infrastructure initiative."}
      ]
    },
    food: {
      palette: ["#5c1a1a","#8b2500","#f4a460","#fff","#fdf5e6"],
      heroGradient: "linear-gradient(135deg, #5c1a1a 0%, #8b2500 50%, #f4a460 100%)",
      services: ["Catering","Menu Development","Quality Assurance","Supply Chain"],
      icon: "\uD83C\uDF7D\uFE0F",
      headline: "Taste the Difference",
      subheadline: "Exceptional culinary experiences crafted with passion, precision, and the finest ingredients.",
      about: "From intimate gatherings to large-scale corporate events, our culinary team creates menus that surprise and delight. We source locally, prepare with care, and deliver with the professionalism that discerning clients expect. Every dish tells a story of quality and creativity.",
      stats: [{n:"10K+",l:"Events Catered"},{n:"95%",l:"Repeat Clients"},{n:"4.9\u2605",l:"Client Rating"}],
      testimonials: [
        {name:"Laura Mendez",role:"Event Coordinator",quote:"They catered our 500-person gala and every plate was restaurant quality. The dietary accommodations and presentation were flawless."},
        {name:"Carlos Ruiz",role:"Restaurant Owner",quote:"Their supply chain management reduced our food costs by 22% while improving ingredient quality. The menu consultation was a game-changer."}
      ]
    },
    grocery: {
      palette: ["#1a5c1a","#2d8b2d","#f4c430","#fff","#f5fdf0"],
      heroGradient: "linear-gradient(135deg, #1a5c1a 0%, #2d8b2d 50%, #f4c430 100%)",
      services: ["Fresh Produce","Online Ordering","Delivery","Meal Kits"],
      icon: "\uD83E\uDD66",
      headline: "Fresh. Local. Yours.",
      subheadline: "Farm-fresh groceries delivered with convenience and care to your doorstep.",
      about: "We connect families with the freshest produce, artisan goods, and pantry essentials from local farms and trusted producers. Our seamless online platform and swift delivery network make healthy, delicious eating effortless\u2014because fresh food should be accessible to everyone.",
      stats: [{n:"500+",l:"Local Suppliers"},{n:"50K+",l:"Weekly Orders"},{n:"2hr",l:"Average Delivery"}],
      testimonials: [
        {name:"Amy Nguyen",role:"Busy Parent",quote:"The meal kits are a lifesaver. Fresh ingredients, clear recipes, and my kids actually eat the vegetables. We've saved so much time and food waste."},
        {name:"Frank DeLuca",role:"Food Enthusiast",quote:"The quality of their produce rivals any farmer's market. The delivery is always on time and the packaging keeps everything perfectly fresh."}
      ]
    },
    insurance: {
      palette: ["#1a2a3a","#2c5282","#38a169","#fff","#f0f5fa"],
      heroGradient: "linear-gradient(135deg, #1a2a3a 0%, #2c5282 50%, #38a169 100%)",
      services: ["Life Insurance","Property & Casualty","Business Insurance","Claims"],
      icon: "\uD83D\uDEE1\uFE0F",
      headline: "Protect What Matters",
      subheadline: "Comprehensive insurance solutions tailored to safeguard your most valuable assets.",
      about: "We believe insurance should provide clarity, not confusion. Our advisors cut through complexity to build coverage plans that truly protect what matters most\u2014your family, your business, and your peace of mind. With fast claims processing and responsive support, we're there when you need us most.",
      stats: [{n:"100K+",l:"Policies Active"},{n:"$500M+",l:"Claims Paid"},{n:"48hr",l:"Claims Resolution"}],
      testimonials: [
        {name:"Helen Graham",role:"Homeowner",quote:"When storm damage hit our home, they processed our claim in 48 hours. No hassle, no runaround. The check arrived before we even finished repairs."},
        {name:"Brian Calloway",role:"Business Owner",quote:"They found coverage gaps three other agents missed. Their business insurance package gave us complete protection at a competitive price."}
      ]
    },
    nonprofit: {
      palette: ["#1a3a5c","#2c5282","#e63946","#fff","#f0f4ff"],
      heroGradient: "linear-gradient(135deg, #1a3a5c 0%, #2c5282 50%, #e63946 100%)",
      services: ["Community Programs","Fundraising","Advocacy","Volunteer Management"],
      icon: "\u2764\uFE0F",
      headline: "Making a Difference",
      subheadline: "Empowering communities through strategic programs and sustainable impact.",
      about: "We partner with mission-driven organizations to amplify their impact. From grassroots community programs to large-scale advocacy campaigns, our team provides the strategic expertise, operational support, and creative resources that help nonprofits turn compassion into measurable change.",
      stats: [{n:"2M+",l:"Lives Impacted"},{n:"500+",l:"Partner Organizations"},{n:"$100M+",l:"Funds Raised"}],
      testimonials: [
        {name:"Grace Okafor",role:"Executive Director, Hope Foundation",quote:"Their fundraising strategy doubled our annual donations in 18 months. The volunteer management system they built saves us 20 hours a week."},
        {name:"Daniel Park",role:"Community Director",quote:"They helped us scale our after-school program from 200 to 2,000 students. Their expertise in nonprofit operations is genuinely transformative."}
      ]
    },
    education: {
      palette: ["#1a1a3e","#3a3a6e","#c9a84c","#fff","#f5f5ff"],
      heroGradient: "linear-gradient(135deg, #1a1a3e 0%, #3a3a6e 50%, #c9a84c 100%)",
      services: ["Academic Programs","Research","Online Learning","Student Services"],
      icon: "\uD83C\uDF93",
      headline: "Knowledge Without Limits",
      subheadline: "Transformative education that prepares students for the challenges of tomorrow.",
      about: "Our institution blends rigorous academics with innovative pedagogy to develop critical thinkers and creative problem-solvers. From state-of-the-art laboratories to immersive online platforms, we provide the tools and mentorship that empower students to reach their fullest potential.",
      stats: [{n:"25K+",l:"Students Enrolled"},{n:"200+",l:"Programs Offered"},{n:"95%",l:"Graduation Rate"}],
      testimonials: [
        {name:"Dr. Fiona Hart",role:"Dean of Sciences",quote:"Our research output has tripled in five years. The online learning platform they developed set a new standard for virtual education in our field."},
        {name:"Jason Osei",role:"Alumni, Class of 2023",quote:"The mentorship program connected me with industry leaders before I even graduated. I had three job offers the day I received my diploma."}
      ]
    },
    construction: {
      palette: ["#2d2d2d","#4a4a4a","#f4a261","#fff","#f5f0eb"],
      heroGradient: "linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 50%, #f4a261 100%)",
      services: ["Commercial Construction","Residential","Renovation","Project Management"],
      icon: "\uD83C\uDFD7\uFE0F",
      headline: "Built Right",
      subheadline: "Precision construction and renovation services delivered on time and on budget.",
      about: "From groundbreaking to ribbon-cutting, we manage every phase of construction with meticulous attention to detail. Our team of licensed contractors and project managers delivers commercial and residential projects that stand the test of time\u2014built with quality materials, skilled craftsmanship, and uncompromising safety standards.",
      stats: [{n:"1K+",l:"Projects Completed"},{n:"$2B+",l:"Total Project Value"},{n:"Zero",l:"Lost-Time Incidents"}],
      testimonials: [
        {name:"Richard Tan",role:"Developer, Skyline Properties",quote:"They delivered our 200-unit complex three weeks ahead of schedule and under budget. That kind of performance is virtually unheard of in this industry."},
        {name:"Olivia Sanders",role:"Homeowner",quote:"Our kitchen and bathroom renovation was stressful to plan but effortless in execution. The craftsmanship is beautiful and they treated our home with respect."}
      ]
    },
    hospitality: {
      palette: ["#1a1a2e","#2c3e50","#c9a84c","#fff","#f8f7f4"],
      heroGradient: "linear-gradient(135deg, #1a1a2e 0%, #2c3e50 60%, #c9a84c 100%)",
      services: ["Hotel Management","Restaurant","Event Planning","Tourism"],
      icon: "\uD83C\uDFE8",
      headline: "Welcome to Excellence",
      subheadline: "Unforgettable experiences crafted with warmth, sophistication, and meticulous attention.",
      about: "We create hospitality experiences that guests remember long after checkout. From boutique hotel management to destination event planning, our team combines operational excellence with genuine warmth to deliver stays, meals, and celebrations that exceed every expectation.",
      stats: [{n:"30+",l:"Properties Managed"},{n:"500K+",l:"Guests Hosted"},{n:"4.9\u2605",l:"Average Rating"}],
      testimonials: [
        {name:"Isabelle Fontaine",role:"Guest, Grand Palace Hotel",quote:"The attention to detail was extraordinary\u2014from the personalized welcome note to the curated local experiences. This is what true hospitality feels like."},
        {name:"Mark Henderson",role:"Event Planner",quote:"They hosted our 300-person corporate retreat flawlessly. The venue, catering, and coordination were all world-class. Our CEO called it the best event we've ever held."}
      ]
    },
    "default": {
      palette: ["#1a1a2e","#2c3e50","#e63946","#fff","#f5f5f5"],
      heroGradient: "linear-gradient(135deg, #1a1a2e 0%, #2c3e50 50%, #e63946 100%)",
      services: ["About Us","Our Services","Portfolio","Contact"],
      icon: "\u2728",
      headline: "Innovation Meets Excellence",
      subheadline: "Forward-thinking solutions tailored to your unique business challenges.",
      about: "We are a team of dedicated professionals passionate about delivering exceptional results. Our approach combines creative strategy with technical expertise to build solutions that drive growth, efficiency, and lasting competitive advantage for our clients.",
      stats: [{n:"10+",l:"Years Experience"},{n:"200+",l:"Projects Delivered"},{n:"98%",l:"Client Satisfaction"}],
      testimonials: [
        {name:"Alex Morgan",role:"CEO, TechStart",quote:"They understood our vision from day one and executed it flawlessly. The results exceeded our most ambitious projections."},
        {name:"Jordan Lee",role:"Director, InnovateCo",quote:"A true partner in every sense. Their strategic insight and operational excellence have been instrumental to our growth."}
      ]
    }
  };

  function getTheme(industry) {
    var key = (industry || "").toLowerCase().replace(/[\s-_]/g, "-");
    if (themes[key]) return themes[key];
    for (var k in themes) {
      if (Object.prototype.hasOwnProperty.call(themes, k) && key.indexOf(k) !== -1) return themes[k];
    }
    return themes["default"];
  }

  function getDisplayFont(industry) {
    var i = (industry || "").toLowerCase();
    if (i === "financial" || i === "legal" || i === "hospitality" || i === "education") return "Playfair Display";
    if (i === "technology" || i === "medical" || i === "telecom" || i === "energy") return "Montserrat";
    return "Poppins";
  }

  function accentWord(name) {
    var words = name.split(/\s+/);
    if (words.length <= 1) return name;
    return words[0] + ' <span class="accent">' + words.slice(1).join(" ") + '</span>';
  }

  function generateHTML(companyName, industry, state, city) {
    var theme = getTheme(industry);
    var p = theme.palette;
    var display = getDisplayFont(industry);
    var loc = [city, state].filter(Boolean).join(", ");
    var services = theme.services;
    var stats = theme.stats;
    var testimonials = theme.testimonials;
    var safeName = (companyName || "Your Company").replace(/</g, "&lt;");

    return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>' + safeName + ' - Redesign Preview</title>\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=' + display.replace(/ /g, "+") + ':wght@400;500;600;700&display=swap" rel="stylesheet">\n<style>\n:root {\n  --c1: ' + p[0] + ';\n  --c2: ' + p[1] + ';\n  --c3: ' + p[2] + ';\n  --c4: ' + p[3] + ';\n  --c5: ' + p[4] + ';\n}\n*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }\nbody { font-family:"Inter",sans-serif; color:var(--c1); background:var(--c4); line-height:1.6; overflow-x:hidden; }\n.display { font-family:"' + display + '",serif; }\n\n.preview-bar {\n  background:var(--c1);\n  color:var(--c4);\n  padding:8px 24px;\n  font-size:13px;\n  display:flex;\n  justify-content:space-between;\n  align-items:center;\n  position:sticky;\n  top:0;\n  z-index:100;\n}\n.preview-bar a { color:var(--c3); text-decoration:none; font-weight:500; }\n.preview-bar a:hover { text-decoration:underline; }\n\nnav {\n  display:flex;\n  justify-content:space-between;\n  align-items:center;\n  padding:16px 48px;\n  background:rgba(255,255,255,0.95);\n  backdrop-filter:blur(12px);\n  border-bottom:1px solid rgba(0,0,0,0.06);\n  position:sticky;\n  top:36px;\n  z-index:99;\n}\n.nav-logo { font-size:20px; font-weight:700; color:var(--c1); }\n.nav-logo .accent { color:var(--c3); }\n.nav-links { display:flex; gap:32px; list-style:none; }\n.nav-links a {\n  text-decoration:none;\n  color:var(--c2);\n  font-size:14px;\n  font-weight:500;\n  transition:color .2s;\n}\n.nav-links a:hover { color:var(--c3); }\n\n.hero {\n  background:' + theme.heroGradient + ';\n  color:var(--c4);\n  padding:120px 48px 100px;\n  text-align:center;\n  position:relative;\n  overflow:hidden;\n}\n.hero::before {\n  content:"";\n  position:absolute;\n  top:-50%;\n  left:-50%;\n  width:200%;\n  height:200%;\n  background:radial-gradient(circle at 30% 50%, rgba(255,255,255,0.05) 0%, transparent 50%);\n}\n.hero h1 {\n  font-size:clamp(36px,5vw,64px);\n  font-weight:700;\n  line-height:1.1;\n  margin-bottom:20px;\n  position:relative;\n}\n.hero p {\n  font-size:clamp(16px,2vw,20px);\n  max-width:600px;\n  margin:0 auto 36px;\n  opacity:0.9;\n  position:relative;\n}\n.hero-cta {\n  display:inline-block;\n  background:var(--c3);\n  color:var(--c1);\n  padding:16px 40px;\n  border-radius:8px;\n  font-weight:600;\n  font-size:16px;\n  text-decoration:none;\n  transition:transform .2s, box-shadow .2s;\n  position:relative;\n}\n.hero-cta:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.2); }\n.hero-loc {\n  margin-top:24px;\n  font-size:14px;\n  opacity:0.7;\n  position:relative;\n}\n\n.stats {\n  display:grid;\n  grid-template-columns:repeat(4,1fr);\n  gap:0;\n  max-width:1000px;\n  margin:-48px auto 0;\n  position:relative;\n  z-index:10;\n  background:var(--c4);\n  border-radius:12px;\n  box-shadow:0 4px 24px rgba(0,0,0,0.08);\n  overflow:hidden;\n}\n.stat {\n  padding:32px 24px;\n  text-align:center;\n  border-right:1px solid rgba(0,0,0,0.06);\n}\n.stat:last-child { border-right:none; }\n.stat-num { font-size:28px; font-weight:700; color:var(--c3); margin-bottom:4px; }\n.stat-label { font-size:13px; color:var(--c2); font-weight:500; }\n\n.section { padding:100px 48px; }\n.section-title {\n  font-size:14px;\n  font-weight:600;\n  text-transform:uppercase;\n  letter-spacing:2px;\n  color:var(--c3);\n  margin-bottom:12px;\n}\n.section-heading {\n  font-size:clamp(28px,3.5vw,44px);\n  font-weight:700;\n  line-height:1.2;\n  margin-bottom:20px;\n}\n.section-desc {\n  font-size:17px;\n  color:var(--c2);\n  max-width:560px;\n  line-height:1.7;\n}\n\n.services-grid {\n  display:grid;\n  grid-template-columns:repeat(3,1fr);\n  gap:28px;\n  margin-top:56px;\n}\n.service-card {\n  background:var(--c4);\n  border:1px solid rgba(0,0,0,0.06);\n  border-radius:12px;\n  padding:40px 32px;\n  transition:transform .25s, box-shadow .25s;\n}\n.service-card:hover {\n  transform:translateY(-4px);\n  box-shadow:0 12px 32px rgba(0,0,0,0.08);\n}\n.service-icon {\n  width:52px;\n  height:52px;\n  background:' + theme.heroGradient + ';\n  border-radius:12px;\n  display:flex;\n  align-items:center;\n  justify-content:center;\n  font-size:24px;\n  margin-bottom:20px;\n}\n.service-card h3 {\n  font-size:18px;\n  font-weight:600;\n  margin-bottom:10px;\n}\n.service-card p { font-size:14px; color:var(--c2); line-height:1.6; }\n\n.about {\n  display:grid;\n  grid-template-columns:1fr 1fr;\n  gap:64px;\n  align-items:center;\n  max-width:1100px;\n  margin:0 auto;\n}\n.about-visual {\n  background:' + theme.heroGradient + ';\n  border-radius:16px;\n  height:400px;\n  display:flex;\n  align-items:center;\n  justify-content:center;\n  font-size:80px;\n  color:rgba(255,255,255,0.15);\n}\n.about-text p { font-size:16px; color:var(--c2); line-height:1.8; margin-bottom:24px; }\n.about-text .signature {\n  font-weight:600;\n  color:var(--c1);\n  font-size:15px;\n}\n\n.testimonials {\n  background:var(--c5);\n}\n.testimonials-grid {\n  display:grid;\n  grid-template-columns:1fr 1fr;\n  gap:32px;\n  margin-top:48px;\n  max-width:1000px;\n}\n.testimonial-card {\n  background:var(--c4);\n  border-radius:12px;\n  padding:40px;\n  box-shadow:0 2px 12px rgba(0,0,0,0.04);\n  position:relative;\n}\n.testimonial-card::before {\n  content:"\\201C";\n  position:absolute;\n  top:20px;\n  left:28px;\n  font-size:64px;\n  color:var(--c3);\n  opacity:0.2;\n  font-family:serif;\n  line-height:1;\n}\n.testimonial-card blockquote {\n  font-size:15px;\n  line-height:1.7;\n  color:var(--c1);\n  margin-bottom:20px;\n  position:relative;\n  z-index:1;\n}\n.testimonial-author { font-weight:600; font-size:14px; }\n.testimonial-role { font-size:13px; color:var(--c2); }\n\n.cta-section {\n  background:' + theme.heroGradient + ';\n  color:var(--c4);\n  text-align:center;\n  padding:80px 48px;\n}\n.cta-section h2 { font-size:clamp(28px,3.5vw,40px); font-weight:700; margin-bottom:16px; }\n.cta-section p { font-size:17px; opacity:0.9; margin-bottom:32px; max-width:500px; margin-left:auto; margin-right:auto; }\n.cta-btn {\n  display:inline-block;\n  background:var(--c4);\n  color:var(--c1);\n  padding:14px 36px;\n  border-radius:8px;\n  font-weight:600;\n  text-decoration:none;\n  transition:transform .2s, box-shadow .2s;\n}\n.cta-btn:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.25); }\n\nfooter {\n  background:var(--c1);\n  color:var(--c4);\n  padding:60px 48px 32px;\n}\n.footer-grid {\n  display:grid;\n  grid-template-columns:2fr 1fr 1fr 1fr;\n  gap:40px;\n  margin-bottom:40px;\n}\n.footer-brand .nav-logo { margin-bottom:12px; }\n.footer-brand p { font-size:14px; opacity:0.7; line-height:1.6; }\n.footer-col h4 { font-size:14px; font-weight:600; margin-bottom:16px; }\n.footer-col a {\n  display:block;\n  color:var(--c4);\n  text-decoration:none;\n  font-size:13px;\n  opacity:0.7;\n  margin-bottom:8px;\n  transition:opacity .2s;\n}\n.footer-col a:hover { opacity:1; }\n.footer-bottom {\n  border-top:1px solid rgba(255,255,255,0.1);\n  padding-top:24px;\n  font-size:13px;\n  opacity:0.5;\n  text-align:center;\n}\n\n@media (max-width:900px) {\n  nav { padding:12px 24px; }\n  .nav-links { display:none; }\n  .hero { padding:80px 24px 72px; }\n  .stats { grid-template-columns:repeat(2,1fr); margin:-32px 16px 0; }\n  .stat { border-bottom:1px solid rgba(0,0,0,0.06); }\n  .stat:nth-child(2) { border-right:none; }\n  .section { padding:64px 24px; }\n  .services-grid { grid-template-columns:1fr; }\n  .about { grid-template-columns:1fr; gap:40px; }\n  .about-visual { height:260px; }\n  .testimonials-grid { grid-template-columns:1fr; }\n  .footer-grid { grid-template-columns:1fr 1fr; }\n}\n@media (max-width:480px) {\n  .stats { grid-template-columns:1fr; }\n  .stat { border-right:none; }\n  .footer-grid { grid-template-columns:1fr; }\n}\n</style>\n</head>\n<body>\n\n<div class="preview-bar">\n  <span>Redesign Preview for <strong>' + safeName + '</strong>' + (loc ? ' \u00B7 ' + loc : '') + '</span>\n  <a href="javascript:window.print()">Print / Save PDF</a>\n</div>\n\n<nav>\n  <div class="nav-logo display">' + accentWord(safeName) + '</div>\n  <ul class="nav-links">\n    <li><a href="#services">Services</a></li>\n    <li><a href="#about">About</a></li>\n    <li><a href="#testimonials">Testimonials</a></li>\n    <li><a href="#contact">Contact</a></li>\n    <li><a href="#contact" class="hero-cta" style="padding:10px 24px; font-size:13px; border-radius:6px;">Get Started</a></li>\n  </ul>\n</nav>\n\n<section class="hero">\n  <h1 class="display">' + theme.headline + '</h1>\n  <p>' + theme.subheadline + '</p>\n  <a href="#contact" class="hero-cta">Schedule a Consultation</a>\n  ' + (loc ? '<div class="hero-loc">\uD83D\uDCCD Serving ' + loc + '</div>' : '') + '\n</section>\n\n<section class="stats">\n  <div class="stat"><div class="stat-num">' + stats[0].n + '</div><div class="stat-label">' + stats[0].l + '</div></div>\n  <div class="stat"><div class="stat-num">' + stats[1].n + '</div><div class="stat-label">' + stats[1].l + '</div></div>\n  <div class="stat"><div class="stat-num">' + stats[2].n + '</div><div class="stat-label">' + stats[2].l + '</div></div>\n  <div class="stat"><div class="stat-num" style="color:var(--c2);">' + theme.icon + '</div><div class="stat-label">' + safeName + '</div></div>\n</section>\n\n<section class="section" id="services">\n  <div class="section-title">What We Do</div>\n  <div class="section-heading display">Our Services</div>\n  <div class="section-desc">Tailored solutions designed to drive your business forward.</div>\n  <div class="services-grid">\n    <div class="service-card">\n      <div class="service-icon">' + theme.icon + '</div>\n      <h3>' + services[0] + '</h3>\n      <p>Expert solutions in ' + services[0].toLowerCase() + ' tailored to meet your specific business needs and objectives.</p>\n    </div>\n    <div class="service-card">\n      <div class="service-icon">' + theme.icon + '</div>\n      <h3>' + services[1] + '</h3>\n      <p>Comprehensive ' + services[1].toLowerCase() + ' services backed by years of industry experience and proven results.</p>\n    </div>\n    <div class="service-card">\n      <div class="service-icon">' + theme.icon + '</div>\n      <h3>' + services[2] + '</h3>\n      <p>Innovative ' + services[2].toLowerCase() + ' strategies that deliver measurable outcomes and lasting value.</p>\n    </div>\n  </div>\n</section>\n\n<section class="section testimonials" id="about">\n  <div style="max-width:1100px; margin:0 auto;">\n    <div class="section-title">About Us</div>\n    <div class="about">\n      <div class="about-visual">' + theme.icon + '</div>\n      <div class="about-text">\n        <div class="section-heading display">Who We Are</div>\n        <p>' + theme.about + '</p>\n        <div class="signature">\u2014 The ' + safeName + ' Team</div>\n      </div>\n    </div>\n  </div>\n</section>\n\n<section class="section" id="testimonials">\n  <div style="max-width:1000px; margin:0 auto;">\n    <div class="section-title">Testimonials</div>\n    <div class="section-heading display">What Our Clients Say</div>\n    <div class="testimonials-grid">\n      <div class="testimonial-card">\n        <blockquote>' + testimonials[0].quote + '</blockquote>\n        <div class="testimonial-author">' + testimonials[0].name + '</div>\n        <div class="testimonial-role">' + testimonials[0].role + '</div>\n      </div>\n      <div class="testimonial-card">\n        <blockquote>' + testimonials[1].quote + '</blockquote>\n        <div class="testimonial-author">' + testimonials[1].name + '</div>\n        <div class="testimonial-role">' + testimonials[1].role + '</div>\n      </div>\n    </div>\n  </div>\n</section>\n\n<section class="cta-section" id="contact">\n  <h2 class="display">Ready to Get Started?</h2>\n  <p>Let\'s discuss how we can help transform your business.</p>\n  <a href="#" class="cta-btn">Contact Us Today</a>\n</section>\n\n<footer>\n  <div class="footer-grid">\n    <div class="footer-brand">\n      <div class="nav-logo display">' + accentWord(safeName) + '</div>\n      <p>Delivering exceptional results through innovation, expertise, and unwavering commitment to our clients.</p>\n    </div>\n    <div class="footer-col">\n      <h4>Services</h4>\n      <a href="#">' + services[0] + '</a>\n      <a href="#">' + services[1] + '</a>\n      <a href="#">' + services[2] + '</a>\n      <a href="#">' + services[3] + '</a>\n    </div>\n    <div class="footer-col">\n      <h4>Company</h4>\n      <a href="#">About Us</a>\n      <a href="#">Careers</a>\n      <a href="#">Blog</a>\n      <a href="#">Press</a>\n    </div>\n    <div class="footer-col">\n      <h4>Support</h4>\n      <a href="#">Contact</a>\n      <a href="#">FAQ</a>\n      <a href="#">Privacy Policy</a>\n      <a href="#">Terms of Service</a>\n    </div>\n  </div>\n  <div class="footer-bottom">&copy; ' + new Date().getFullYear() + ' ' + safeName + '. All rights reserved.</div>\n</footer>\n\n</body>\n</html>';
  }

  function openPreview(companyName, industry, state, city) {
    var html = this.generateHTML(companyName, industry, state, city);
    var win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      alert("Please allow popups to view the preview.");
    }
  }

  window.PreviewEngine = {
    generateHTML: generateHTML,
    openPreview: openPreview,
    getTheme: getTheme
  };
})();
