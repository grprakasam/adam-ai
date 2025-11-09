import React, { useState } from 'react';
import { Plus, FileCode, Trash2, Check, X } from 'lucide-react';
import { FormBlock } from '../FormBlock';
import { useProjectStore, Rule } from '../../store/projectStore';
import './RulesTab.css';

const RulesTab: React.FC = () => {
  const rules = useProjectStore((state) => state.rules);
  const addRule = useProjectStore((state) => state.addRule);
  const updateRule = useProjectStore((state) => state.updateRule);
  const deleteRule = useProjectStore((state) => state.deleteRule);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleDescription, setNewRuleDescription] = useState('');

  // Predefined ADAM rules loaded from Context/ADAMRules
  const predefinedRules: Rule[] = [
    {
      id: 'adsl-app-behaviour',
      name: 'ADSL Application Behaviour Rules',
      description: 'Rules for ADSL dataset structure, mandatory variables, and standard derivations as per CDISC ADAM IG.',
      enabled: true,
      predefined: true,
    },
    {
      id: 'adsl-ig-specific',
      name: 'ADSL IG-Specific Rules',
      description: 'Implementation Guide specific requirements for ADSL including naming conventions, formats, and metadata.',
      enabled: true,
      predefined: true,
    },
    {
      id: 'adsl-macro-logic',
      name: 'ADSL Macro Logic',
      description: 'Reusable logic patterns for common ADSL derivations including treatment assignment, population flags, and date imputations.',
      enabled: true,
      predefined: true,
    },
  ];

  // Load predefined rules if not already in store
  React.useEffect(() => {
    if (rules.length === 0) {
      predefinedRules.forEach((rule) => addRule(rule));
    }
  }, []);

  const handleAddCustomRule = () => {
    if (newRuleName.trim() && newRuleDescription.trim()) {
      const newRule: Rule = {
        id: `custom-${Date.now()}`,
        name: newRuleName,
        description: newRuleDescription,
        enabled: true,
        predefined: false,
      };
      addRule(newRule);
      setNewRuleName('');
      setNewRuleDescription('');
      setShowAddForm(false);
    }
  };

  const customRules = rules.filter((r) => !r.predefined);
  const activeRules = rules.filter((r) => r.predefined);

  return (
    <div className="rules-tab">
      <FormBlock
        title="CDISC ADAM Derivation Rules"
        description="Predefined rules loaded from ADAM Implementation Guide"
      >
        <div className="rules-list">
          {activeRules.map((rule) => (
            <div key={rule.id} className="rule-item predefined">
              <div className="rule-header">
                <FileCode size={16} className="rule-icon" />
                <div className="rule-content">
                  <div className="rule-name">{rule.name}</div>
                  <div className="rule-description">{rule.description}</div>
                </div>
                <div className="rule-badge">Active</div>
              </div>
            </div>
          ))}
        </div>
      </FormBlock>

      <FormBlock
        title="Custom Derivation Rules"
        description="Add your own project-specific derivation logic"
      >
        {customRules.length > 0 && (
          <div className="rules-list">
            {customRules.map((rule) => (
              <div key={rule.id} className="rule-item custom">
                <div className="rule-header">
                  <FileCode size={16} className="rule-icon" />
                  <div className="rule-content">
                    <div className="rule-name">{rule.name}</div>
                    <div className="rule-description">{rule.description}</div>
                  </div>
                  <button
                    className="btn-icon-danger"
                    onClick={() => deleteRule(rule.id)}
                    title="Delete custom rule"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!showAddForm && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowAddForm(true)}
          >
            <Plus size={16} />
            Add Custom Rule
          </button>
        )}

        {showAddForm && (
          <div className="add-rule-form">
            <div className="form-field">
              <label className="form-label">Rule Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Custom AGE Derivation"
                value={newRuleName}
                onChange={(e) => setNewRuleName(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                placeholder="Describe the derivation logic..."
                rows={3}
                value={newRuleDescription}
                onChange={(e) => setNewRuleDescription(e.target.value)}
              />
            </div>
            <div className="form-actions">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowAddForm(false);
                  setNewRuleName('');
                  setNewRuleDescription('');
                }}
              >
                <X size={16} />
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleAddCustomRule}
                disabled={!newRuleName.trim() || !newRuleDescription.trim()}
              >
                <Check size={16} />
                Add Rule
              </button>
            </div>
          </div>
        )}
      </FormBlock>

      <div className="rules-summary">
        <div className="summary-card">
          <h4>📋 Rules Summary</h4>
          <p>
            <strong>{activeRules.length}</strong> predefined ADAM rules active
          </p>
          <p>
            <strong>{customRules.length}</strong> custom rule{customRules.length !== 1 ? 's' : ''} defined
          </p>
        </div>
      </div>
    </div>
  );
};

export default RulesTab;
