import { Checkbox, Card } from 'antd';
import { useState } from 'react';

interface DatasetsTabProps {
  selectedDatasets: string[];
  onDatasetsChange: (datasets: string[]) => void;
}

const datasets = [
  { name: 'DM', description: 'Demographics', required: true },
  { name: 'AE', description: 'Adverse Events', required: false },
  { name: 'LB', description: 'Laboratory', required: false },
  { name: 'VS', description: 'Vital Signs', required: false },
  { name: 'EX', description: 'Exposure', required: false },
  { name: 'DS', description: 'Disposition', required: false },
  { name: 'MH', description: 'Medical History', required: false },
  { name: 'CM', description: 'Concomitant Meds', required: false },
];

const DatasetsTab = ({ selectedDatasets, onDatasetsChange }: DatasetsTabProps) => {
  const handleToggle = (datasetName: string) => {
    if (selectedDatasets.includes(datasetName)) {
      onDatasetsChange(selectedDatasets.filter(d => d !== datasetName));
    } else {
      onDatasetsChange([...selectedDatasets, datasetName]);
    }
  };

  return (
    <Card 
      title={<div style={{ fontSize: '14px', fontWeight: 600 }}>SDTM Datasets</div>}
      size="small"
      styles={{ body: { padding: '16px' } }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
        {datasets.map((dataset) => (
          <div
            key={dataset.name}
            onClick={() => !dataset.required && handleToggle(dataset.name)}
            style={{
              padding: '10px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: dataset.required ? 'default' : 'pointer',
              background: selectedDatasets.includes(dataset.name) ? '#eef2ff' : '#fafafa',
              borderColor: selectedDatasets.includes(dataset.name) ? '#4f46e5' : '#e5e7eb',
              borderWidth: selectedDatasets.includes(dataset.name) ? '2px' : '1px',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Checkbox
                checked={selectedDatasets.includes(dataset.name)}
                disabled={dataset.required}
                onChange={() => handleToggle(dataset.name)}
                style={{ marginRight: '8px' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>
                  {dataset.name}
                  {dataset.required && (
                    <span style={{
                      background: '#ef4444',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '9px',
                      marginLeft: '4px',
                      fontWeight: 600,
                    }}>
                      REQUIRED
                    </span>
                  )}
                </div>
                <div style={{ color: '#6b7280', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dataset.description}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default DatasetsTab;
