import React from 'react';
import './PageCard.css';

interface PageShowcaseProps {
  roleBadge: string;
  roleBadgeColor: string;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
}

const PageShowcase: React.FC<PageShowcaseProps> = ({
  roleBadge,
  roleBadgeColor,
  title,
  subtitle,
  description,
  features,
}) => {
  return (
    <div className="page-showcase-container">
      <div className="page-showcase-header">
        <div className="page-role-badge-pill" style={{ backgroundColor: roleBadgeColor }}>
          {roleBadge}
        </div>
        <h1 className="page-showcase-title">{title}</h1>
        <p className="page-showcase-subtitle">{subtitle}</p>
      </div>

      <div className="page-showcase-card">
        <div className="page-showcase-card-header">
          <h2>ภาพรวมระบบ & ฟังก์ชันการทำงาน</h2>
        </div>
        <div className="page-showcase-card-body">
          <p className="page-showcase-desc">{description}</p>

          <h3 className="page-features-title">รายการฟังก์ชันในหน้านี้:</h3>
          <ul className="page-features-list">
            {features.map((feature, idx) => (
              <li key={idx} className="page-feature-item">
                <span className="feature-check-icon">✓</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PageShowcase;
