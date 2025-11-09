import React from 'react';
import { FileSpreadsheet, Info, CheckCircle2 } from 'lucide-react';
import { FormBlock } from '../FormBlock';
import './DataTab.css';

const DataTab: React.FC = () => {
  return (
    <div className="data-tab">
      <div className="info-banner">
        <Info size={20} />
        <div>
          <h3>SDTM Data Input Not Required</h3>
          <p>
            The ADAM code generator works independently without requiring SDTM dataset inputs.
            The AI will generate standard-compliant ADAM code based on your project configuration,
            selected standards, and derivation rules.
          </p>
        </div>
      </div>

      <FormBlock
        title="How ADAM Code Generation Works"
        description="Understanding the AI-powered workflow"
      >
        <div className="workflow-steps">
          <div className="workflow-step">
            <div className="step-icon">
              <CheckCircle2 size={20} />
            </div>
            <div className="step-content">
              <h4>1. Project Configuration</h4>
              <p>Study metadata provides context for the ADAM dataset structure</p>
            </div>
          </div>

          <div className="workflow-step">
            <div className="step-icon">
              <CheckCircle2 size={20} />
            </div>
            <div className="step-content">
              <h4>2. CDISC Standards</h4>
              <p>Selected SDTM and ADAM versions ensure compliance with industry guidelines</p>
            </div>
          </div>

          <div className="workflow-step">
            <div className="step-icon">
              <CheckCircle2 size={20} />
            </div>
            <div className="step-content">
              <h4>3. Derivation Rules</h4>
              <p>ADAM IG rules and custom logic guide variable creation and transformations</p>
            </div>
          </div>

          <div className="workflow-step">
            <div className="step-icon">
              <FileSpreadsheet size={20} />
            </div>
            <div className="step-content">
              <h4>4. AI Code Generation</h4>
              <p>LLM generates complete R/SAS code with proper ADAM structure, derivations, and documentation</p>
            </div>
          </div>
        </div>
      </FormBlock>

      <FormBlock
        title="Generated Code Includes"
        description="Standard components in every ADAM code output"
      >
        <div className="features-grid">
          <div className="feature-card">
            <h4>📋 Dataset Structure</h4>
            <p>Proper ADAM dataset initialization with required metadata</p>
          </div>
          <div className="feature-card">
            <h4>🔄 Variable Derivations</h4>
            <p>Standard variables (AGE, AGEGR1, SAFFL, etc.) with correct logic</p>
          </div>
          <div className="feature-card">
            <h4>📅 Date Handling</h4>
            <p>Treatment dates, durations, and date imputations</p>
          </div>
          <div className="feature-card">
            <h4>🏷️ Population Flags</h4>
            <p>Safety, ITT, and analysis population indicators</p>
          </div>
          <div className="feature-card">
            <h4>📊 Data Quality</h4>
            <p>Missing data handling and validation checks</p>
          </div>
          <div className="feature-card">
            <h4>📝 Documentation</h4>
            <p>Inline comments explaining derivation logic</p>
          </div>
        </div>
      </FormBlock>

      <div className="success-message">
        <CheckCircle2 size={24} />
        <div>
          <h4>Ready for Code Generation</h4>
          <p>
            No SDTM data upload required. Complete the remaining configuration tabs and click
            "Generate ADSL Code" to create your analysis dataset program.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DataTab;
