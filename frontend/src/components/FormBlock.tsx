import React, { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import './FormBlock.css';

interface FormBlockProps {
  title: string;
  description?: string;
  helpText?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children: ReactNode;
}

export const FormBlock: React.FC<FormBlockProps> = ({
  title,
  description,
  helpText,
  collapsible = false,
  defaultExpanded = true,
  children,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  return (
    <div className="form-block card">
      <div className="form-block-header card-header">
        <div className="form-block-title-group">
          <h3 className="form-block-title">{title}</h3>
          {helpText && (
            <button
              type="button"
              className="help-icon-button"
              aria-label="Help"
              title={helpText}
            >
              <HelpCircle size={16} />
            </button>
          )}
        </div>
        {description && (
          <p className="form-block-description">{description}</p>
        )}
        {collapsible && (
          <button
            type="button"
            className="collapse-toggle"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
          >
            {isExpanded ? '-' : '+'}
          </button>
        )}
      </div>
      {isExpanded && (
        <div className="form-block-content card-body">
          {children}
        </div>
      )}
    </div>
  );
};

