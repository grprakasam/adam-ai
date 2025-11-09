import React, { useEffect, useState } from 'react';
import { Tabs, message } from 'antd';
import { FileSearch, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import type { VariableCategory, VariableInfo } from '../types';
import './VariablesAnalysisTab.css';

const { TabPane } = Tabs;

export const VariablesAnalysisTab: React.FC = () => {
  const {
    specificationFile,
    projectConfig,
    categorizedVariables,
    setCategorizedVariables,
    isCategorizingVariables,
    setIsCategorizingVariables,
  } = useProjectStore();

  const [activeCategory, setActiveCategory] = useState<string>('0');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Auto-categorize when spec file is uploaded
    if (specificationFile && !categorizedVariables && !isCategorizingVariables) {
      handleCategorizeVariables();
    }
  }, [specificationFile]);

  const handleCategorizeVariables = async () => {
    if (!specificationFile) {
      setError('No specification file uploaded');
      return;
    }

    if (!projectConfig.adamDataset) {
      setError('Please select an ADAM dataset first');
      return;
    }

    setIsCategorizingVariables(true);
    setError(null);

    try {
      const result = await adamApi.categorizeSpecification(
        specificationFile.path,
        projectConfig.adamDataset
      );

      setCategorizedVariables(result);
      message.success(
        `Successfully categorized ${result.total_variables} variables into ${result.categories.length} categories`
      );
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to categorize variables';
      setError(errorMsg);
      message.error(errorMsg);
      console.error('Categorization error:', err);
    } finally {
      setIsCategorizingVariables(false);
    }
  };

  const getTypeIcon = (type?: string) => {
    if (!type) return null;
    const typeUpper = type.toUpperCase();
    if (typeUpper.includes('CHAR') || typeUpper.includes('TEXT')) {
      return <span className="type-badge type-char">Text</span>;
    }
    if (typeUpper.includes('NUM') || typeUpper.includes('NUMBER')) {
      return <span className="type-badge type-num">Num</span>;
    }
    if (typeUpper.includes('DATE')) {
      return <span className="type-badge type-date">Date</span>;
    }
    return <span className="type-badge type-other">{type}</span>;
  };

  const renderVariableCard = (variable: VariableInfo) => {
    return (
      <div key={variable.name} className="variable-card">
        <div className="variable-header">
          <div className="variable-name-section">
            <span className="variable-name">{variable.name}</span>
            {variable.is_required && (
              <span className="required-badge">Required</span>
            )}
          </div>
          <div className="variable-type-section">
            {getTypeIcon(variable.type)}
            {variable.length && (
              <span className="length-badge">Length: {variable.length}</span>
            )}
          </div>
        </div>

        {variable.label && (
          <div className="variable-label">{variable.label}</div>
        )}

        <div className="variable-details">
          {variable.format && (
            <div className="detail-item">
              <span className="detail-label">Format:</span>
              <span className="detail-value format-value">{variable.format}</span>
            </div>
          )}
          {variable.derivation && (
            <div className="detail-item">
              <span className="detail-label">Derivation:</span>
              <span className="detail-value derivation-value">{variable.derivation}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCategoryContent = (category: VariableCategory) => {
    if (category.count === 0) {
      return (
        <div className="empty-category">
          <FileSearch size={48} />
          <p>No variables in this category</p>
        </div>
      );
    }

    return (
      <div className="variables-grid">
        {category.variables.map((variable) => renderVariableCard(variable))}
      </div>
    );
  };

  // No spec file uploaded
  if (!specificationFile) {
    return (
      <div className="variables-empty-state">
        <AlertCircle size={64} className="empty-icon" />
        <h3>No Specification File Uploaded</h3>
        <p>Please upload an ADAM specification file in the Specification tab to analyze variables.</p>
      </div>
    );
  }

  // Categorizing in progress
  if (isCategorizingVariables) {
    return (
      <div className="variables-loading-state">
        <Loader2 size={64} className="loading-spinner" />
        <h3>Analyzing Variables...</h3>
        <p>Reading specification and categorizing variables using VariablesMapping.xlsx</p>
      </div>
    );
  }

  // Error state
  if (error && !categorizedVariables) {
    return (
      <div className="variables-error-state">
        <AlertCircle size={64} className="error-icon" />
        <h3>Categorization Failed</h3>
        <p>{error}</p>
        <button className="retry-button" onClick={handleCategorizeVariables}>
          Retry Categorization
        </button>
      </div>
    );
  }

  // No categorized variables yet
  if (!categorizedVariables) {
    return (
      <div className="variables-empty-state">
        <FileSearch size={64} className="empty-icon" />
        <h3>Variables Not Categorized</h3>
        <p>Click the button below to categorize variables from the specification.</p>
        <button className="categorize-button" onClick={handleCategorizeVariables}>
          Categorize Variables
        </button>
      </div>
    );
  }

  // Main content with categorized variables
  return (
    <div className="variables-analysis-tab">
      <div className="variables-header">
        <div className="header-left">
          <FileSearch size={24} />
          <div>
            <h2>Variables Analysis</h2>
            <p className="header-subtitle">
              {categorizedVariables.total_variables} variables categorized •{' '}
              {categorizedVariables.categorized_count} mapped •{' '}
              {categorizedVariables.uncategorized_count} in Other Category
            </p>
          </div>
        </div>
        <div className="header-right">
          <button className="recategorize-button" onClick={handleCategorizeVariables}>
            <Loader2 size={16} />
            Re-categorize
          </button>
        </div>
      </div>

      {categorizedVariables.categories.length > 0 ? (
        <Tabs
          activeKey={activeCategory}
          onChange={setActiveCategory}
          type="card"
          className="category-tabs"
        >
          {categorizedVariables.categories.map((category, index) => (
            <TabPane
              tab={
                <div className="tab-label">
                  <span className="tab-name">{category.name}</span>
                  <span className="tab-count">{category.count}</span>
                </div>
              }
              key={index.toString()}
            >
              <div className="category-content">
                {category.description && (
                  <div className="category-description">
                    <CheckCircle2 size={16} />
                    <span>{category.description}</span>
                  </div>
                )}
                {renderCategoryContent(category)}
              </div>
            </TabPane>
          ))}
        </Tabs>
      ) : (
        <div className="empty-category">
          <AlertCircle size={48} />
          <p>No categories found</p>
        </div>
      )}
    </div>
  );
};

export default VariablesAnalysisTab;
