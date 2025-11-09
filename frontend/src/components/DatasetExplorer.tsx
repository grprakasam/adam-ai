import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Database, FileText } from 'lucide-react';
import './DatasetExplorer.css';

interface Dataset {
  id: string;
  name: string;
  label: string;
  required: boolean;
  variables: Variable[];
}

interface Variable {
  name: string;
  label: string;
  type: string;
}

interface DatasetExplorerProps {
  datasets: Dataset[];
  selectedDatasets: string[];
  onDatasetToggle: (datasetId: string) => void;
  onDatasetSelect: (datasetId: string) => void;
}

export const DatasetExplorer: React.FC<DatasetExplorerProps> = ({
  datasets,
  selectedDatasets,
  onDatasetToggle,
  onDatasetSelect,
}) => {
  const [expandedDatasets, setExpandedDatasets] = useState<Set<string>>(new Set());

  const toggleExpanded = (datasetId: string) => {
    const newExpanded = new Set(expandedDatasets);
    if (newExpanded.has(datasetId)) {
      newExpanded.delete(datasetId);
    } else {
      newExpanded.add(datasetId);
    }
    setExpandedDatasets(newExpanded);
  };

  return (
    <div className="dataset-explorer">
      {datasets.map((dataset) => {
        const isExpanded = expandedDatasets.has(dataset.id);
        const isSelected = selectedDatasets.includes(dataset.id);

        return (
          <div key={dataset.id} className="dataset-item">
            <div className={`dataset-header ${isSelected ? 'selected' : ''}`}>
              <button
                type="button"
                className="expand-button"
                onClick={() => toggleExpanded(dataset.id)}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              <input
                type="checkbox"
                className="checkbox"
                checked={isSelected}
                onChange={() => onDatasetToggle(dataset.id)}
                id={`dataset-${dataset.id}`}
              />
              <label
                htmlFor={`dataset-${dataset.id}`}
                className="dataset-label"
                onClick={() => onDatasetSelect(dataset.id)}
              >
                <Database size={16} className="dataset-icon" />
                <div className="dataset-info">
                  <span className="dataset-name">{dataset.name}</span>
                  <span className="dataset-description">{dataset.label}</span>
                </div>
              </label>
              {dataset.required && <span className="badge badge-info">Required</span>}
            </div>

            {isExpanded && (
              <div className="variables-list">
                {dataset.variables.map((variable) => (
                  <div key={variable.name} className="variable-item">
                    <FileText size={14} className="variable-icon" />
                    <div className="variable-info">
                      <span className="variable-name">{variable.name}</span>
                      <span className="variable-label">{variable.label}</span>
                      <span className="variable-type">{variable.type}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
