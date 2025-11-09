import React from 'react';
import { Play, FileCode, CheckCircle2, AlertCircle } from 'lucide-react';
import { FormBlock } from '../FormBlock';
import { SelectField } from '../SelectField';
import { useProjectStore } from '../../store/projectStore';
import './GenerateTab.css';

interface GenerateTabProps {
  onGenerate: () => Promise<void>;
}

const GenerateTab: React.FC<GenerateTabProps> = ({ onGenerate }) => {
  // Fixed: Use separate selectors to avoid infinite re-render
  const generationOptions = useProjectStore((state) => state.generationOptions);
  const setGenerationOptions = useProjectStore((state) => state.setGenerationOptions);
  const getCompletionPercentage = useProjectStore((state) => state.getCompletionPercentage);
  const isGenerating = useProjectStore((state) => state.isGenerating);

  const [error, setError] = React.useState<string | null>(null);

  const completionPercentage = getCompletionPercentage();
  const isReadyToGenerate = completionPercentage >= 80;

  const handleGenerate = async () => {
    if (!isReadyToGenerate || isGenerating) return;

    try {
      setError(null);
      await onGenerate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate code. Please try again.');
    }
  };

  const commentOptions = [
    { value: 'comprehensive', label: 'Comprehensive - Detailed inline documentation' },
    { value: 'minimal', label: 'Minimal - Essential comments only' },
    { value: 'none', label: 'None - No comments' },
  ];

  const codeStyleOptions = [
    { value: 'standard', label: 'Standard - Balanced readability' },
    { value: 'compact', label: 'Compact - Concise code' },
    { value: 'verbose', label: 'Verbose - Explicit and detailed' },
  ];

  const optimizationOptions = [
    { value: 'balanced', label: 'Balanced - Good mix of performance and readability' },
    { value: 'performance', label: 'Performance - Optimized for speed' },
    { value: 'readability', label: 'Readability - Prioritize code clarity' },
  ];

  return (
    <div className="generate-tab">
      <div className="completion-banner">
        <div className="completion-header">
          <h3>Configuration Progress</h3>
          <span className={`completion-percentage ${isReadyToGenerate ? 'ready' : ''}`}>
            {completionPercentage}%
          </span>
        </div>
        <div className="progress">
          <div
            className="progress-bar"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
        {!isReadyToGenerate && (
          <p className="completion-message">
            Complete at least 80% of the configuration to enable code generation
          </p>
        )}
        {isReadyToGenerate && (
          <p className="completion-message success">
            <CheckCircle2 size={16} />
            Configuration complete! Ready to generate code.
          </p>
        )}
      </div>

      <FormBlock
        title="Code Generation Options"
        description="Customize the output code style and format"
      >
        <SelectField
          label="Comment Level"
          value={generationOptions.includeComments}
          options={commentOptions}
          onChange={(value) =>
            setGenerationOptions({
              includeComments: value as 'comprehensive' | 'minimal' | 'none',
            })
          }
          helpText="Amount of inline documentation in generated code"
        />
        <SelectField
          label="Code Style"
          value={generationOptions.codeStyle}
          options={codeStyleOptions}
          onChange={(value) =>
            setGenerationOptions({
              codeStyle: value as 'standard' | 'compact' | 'verbose',
            })
          }
          helpText="Overall code formatting style"
        />
        <SelectField
          label="Optimization Level"
          value={generationOptions.optimizationLevel}
          options={optimizationOptions}
          onChange={(value) =>
            setGenerationOptions({
              optimizationLevel: value as 'balanced' | 'performance' | 'readability',
            })
          }
          helpText="Trade-off between performance and maintainability"
        />
      </FormBlock>

      {error && (
        <div className="error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="generate-actions">
        <button
          type="button"
          className="btn btn-secondary btn-lg"
          disabled={!isReadyToGenerate || isGenerating}
        >
          <FileCode size={20} />
          Validate Configuration
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-lg"
          disabled={!isReadyToGenerate || isGenerating}
        >
          <Play size={20} />
          Dry Run
        </button>
        <button
          type="button"
          className="btn btn-primary btn-lg generate-button-primary"
          disabled={!isReadyToGenerate || isGenerating}
          onClick={handleGenerate}
        >
          <Play size={20} />
          {isGenerating ? 'Generating...' : 'Generate ADSL Code'}
        </button>
      </div>

      <div className="generate-info">
        <div className="info-card">
          <h4>🚀 Generation Process</h4>
          <ol className="process-list">
            <li>Configuration validation against ADaM IG standards</li>
            <li>SDTM dataset structure analysis</li>
            <li>Derivation logic optimization</li>
            <li>Code generation with selected options</li>
            <li>Quality checks and documentation</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default GenerateTab;
