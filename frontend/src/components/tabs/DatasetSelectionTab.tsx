import React from 'react';
import { FormBlock } from '../FormBlock';
import { useProjectStore } from '../../store/projectStore';
import './DatasetSelectionTab.css';

const DatasetSelectionTab: React.FC = () => {
  const projectConfig = useProjectStore((state) => state.projectConfig);
  const setProjectConfig = useProjectStore((state) => state.setProjectConfig);

  const adamDatasets = [
    { value: 'ADSL', label: 'ADSL', description: 'Subject Level Analysis Dataset' },
    { value: 'ADAE', label: 'ADAE', description: 'Adverse Events Analysis Dataset' },
    { value: 'ADLB', label: 'ADLB', description: 'Laboratory Analysis Dataset' },
  ];

  return (
    <div className="tab-container">
      <FormBlock
        title="ADAM Dataset to be Generated"
        description="Select the ADAM dataset you want to generate"
      >
        <div className="radio-group">
          <div className="radio-options">
            {adamDatasets.map((dataset) => (
              <label key={dataset.value} className="radio-option">
                <input
                  type="radio"
                  name="adamDataset"
                  value={dataset.value}
                  checked={projectConfig.adamDataset === dataset.value}
                  onChange={(e) => setProjectConfig({ adamDataset: e.target.value })}
                  className="radio-input"
                />
                <div className="radio-content">
                  <span className="radio-label">{dataset.label}</span>
                  <span className="radio-description">{dataset.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </FormBlock>
    </div>
  );
};

export default DatasetSelectionTab;
