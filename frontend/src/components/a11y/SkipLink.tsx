import React from 'react';

interface SkipLinkProps {
  targetId: string;
  label?: string;
}

export const SkipLink: React.FC<SkipLinkProps> = ({ targetId, label = 'Skip to main content' }) => (
  <a className="skip-link" href={`#${targetId}`}>
    {label}
  </a>
);

export default SkipLink;
