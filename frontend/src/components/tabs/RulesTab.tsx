import React, { useState } from 'react';
import { Plus, FileCode, Trash2, Check, X } from 'lucide-react';
import { FormBlock } from '../FormBlock';
import { useProjectStore, Rule } from '../../store/projectStore';
import './RulesTab.css';

const RulesTab: React.FC = () => {
  const rules = useProjectStore((state) => state.rules);
  const addRule = useProjectStore((state) => state.addRule);
  const deleteRule = useProjectStore((state) => state.deleteRule);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleDescription, setNewRuleDescription] = useState('');

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

  return (
    <div className="rules-tab">
      <FormBlock
        title="Custom Derivation Rules"
        description="Add project-specific or derived logic that complements the CDISC baseline"
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
          <h4>Rules Summary</h4>
          <p>
            <strong>{customRules.length}</strong> custom rule{customRules.length !== 1 ? 's' : ''} defined
          </p>
          <p>Custom rules complement CDISC guidance and can be added or removed per project needs.</p>
        </div>
      </div>
    </div>
  );
};

export default RulesTab;
