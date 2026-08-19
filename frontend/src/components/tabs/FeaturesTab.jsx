import React from 'react';
import { TrendingUp, Activity, Users, Headset, ShieldCheck, BriefcaseBusiness } from 'lucide-react';

const FeatureCard = ({ imgSrc, title, description, icon }) => {
  const IconComponent = icon;
  return (
    <div className="card card-3d feature-card">
      <img src={imgSrc} alt={title} className="feature-card-img" />
      <div className="feature-card-content">
        <div className="feature-card-header">
          <IconComponent size={24} className="feature-card-icon" />
          <h3 className="feature-card-title">{title}</h3>
        </div>
        <p className="feature-card-description">{description}</p>
      </div>
    </div>
  );
};

const ServiceCard = ({ title, description, icon }) => {
  const IconComponent = icon;
  return (
    <div className="card card-3d service-card">
      <div className="service-icon-wrap"><IconComponent size={20} /></div>
      <h3 className="service-title">{title}</h3>
      <p className="service-description">{description}</p>
    </div>
  );
};

const ProofPoint = ({ title, description, icon }) => {
  const IconComponent = icon;
  return (
    <div className="proof-item">
      <div className="proof-icon"><IconComponent size={18} /></div>
      <div>
        <h4>{title}</h4>
        <p>{description}</p>
      </div>
    </div>
  );
};

const FeaturesTab = ({ setActiveTab }) => {
  const features = [
    {
      imgSrc: "/dashboard_preview_1774761879313.png",
      title: "Intelligent Dashboard",
      description: "Get a real-time, comprehensive overview of your total cloud and SaaS expenditure with advanced data visualizations.",
      icon: Activity,
    },
  ];

  const services = [
    {
      title: 'Enterprise Cost Intelligence',
      description: 'Unify cloud, SaaS, and operational spend in one decision-grade platform.',
      icon: BriefcaseBusiness,
    },
    {
      title: 'Autonomous Optimization',
      description: 'Detect and remediate inefficiencies continuously with automated workflows.',
      icon: Activity,
    },
    {
      title: 'Forecasting & Scenario Planning',
      description: 'Model future cost trajectories and stress-test strategies before execution.',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="fade-in features-scroll" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="hero-card">
        <h1 className="hero-title">Grow Your Business with Modern Cost Governance</h1>
        <p className="hero-subtitle">
          CostIntel is your autonomous finance operations partner, built to reduce waste,
          increase predictability, and maximize ROI across every business unit.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary btn-3d hero-button" onClick={() => setActiveTab('dashboard')}>
            Get Started <TrendingUp size={18} style={{ marginLeft: '0.35rem' }} />
          </button>
          <button className="btn btn-secondary" onClick={() => setActiveTab('impact')}>
            Financial Impact
          </button>
        </div>
      </div>

      <h2 className="section-title">Our Services</h2>
      <div className="services-grid">
        {services.map((service) => (
          <ServiceCard key={service.title} {...service} />
        ))}
      </div>

      <div className="split-showcase">
        <div className="showcase-image-wrap card card-3d">
          <img src="/dashboard_preview_1774761879313.png" alt="CostIntel collaboration" className="showcase-image" />
        </div>
        <div className="showcase-content card card-3d">
          <h3>Why Choose Us?</h3>
          <div className="proof-grid">
            <ProofPoint title="Expert Team" description="Built by engineering and finance experts for enterprise scale." icon={Users} />
            <ProofPoint title="Proven Results" description="Consistent measurable savings across cloud and SaaS portfolios." icon={ShieldCheck} />
            <ProofPoint title="Custom Solutions" description="Workflows tailored to your governance model and growth stage." icon={Activity} />
            <ProofPoint title="24/7 Support" description="Always-on visibility and smart assistance for critical decisions." icon={Headset} />
          </div>
        </div>
      </div>

      <h2 className="section-title">Our Recent Projects</h2>
      
      <div className="features-grid">
        {features.map(feature => <FeatureCard key={feature.title} {...feature} />)}
      </div>

      <div className="center-cta">
        <button className="btn btn-primary" onClick={() => setActiveTab('dashboard')}>View All Features</button>
      </div>
    </div>
  );
};

export default FeaturesTab;