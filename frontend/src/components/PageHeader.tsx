/**
 * PageHeader Component
 * 
 * Reusable blue header component for all feature pages.
 * Provides consistent styling matching the SDTM Test Data Generator pattern.
 */

import React from 'react';
import './PageHeader.css';

interface PageHeaderProps {
    /** Page title (required) */
    title: string;
    /** Optional subtitle/tagline */
    subtitle?: string;
    /** Optional icon (Ant Design icon element) */
    icon?: React.ReactNode;
    /** Optional action buttons for the right side */
    actions?: React.ReactNode;
    /** Optional custom className */
    className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    icon,
    actions,
    className = '',
}) => {
    return (
        <div className={`page-header ${className}`}>
            <div className="page-header-info">
                {icon && <div className="page-header-icon">{icon}</div>}
                <div className="page-header-text">
                    <span className="page-header-title">{title}</span>
                    {subtitle && <span className="page-header-subtitle">{subtitle}</span>}
                </div>
            </div>
            {actions && <div className="page-header-actions">{actions}</div>}
        </div>
    );
};

export default PageHeader;
