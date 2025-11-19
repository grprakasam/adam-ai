import React from 'react';

interface VisuallyHiddenProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
}

export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({ children, className = '', ...rest }) => (
  <span className={`sr-only ${className}`.trim()} {...rest}>
    {children}
  </span>
);

export default VisuallyHidden;
