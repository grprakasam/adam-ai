import { Input, Checkbox, Collapse } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useState } from 'react';

interface VariablesTabProps {
  selectedVariables: string[];
  onVariablesChange: (variables: string[]) => void;
}

const variableCategories = [
  {
    name: 'Identifier Variables',
    variables: [
      { name: 'STUDYID', label: 'Study Identifier', required: true },
      { name: 'USUBJID', label: 'Unique Subject Identifier', required: true },
      { name: 'SUBJID', label: 'Subject Identifier', required: false },
      { name: 'SITEID', label: 'Site Identifier', required: false },
      { name: 'INVID', label: 'Investigator Identifier', required: false },
    ]
  },
  {
    name: 'Treatment Variables',
    variables: [
      { name: 'TRT01P', label: 'Planned Treatment Arm', required: false },
      { name: 'TRT01A', label: 'Actual Treatment Arm', required: false },
      { name: 'TRT01PN', label: 'Planned Treatment (N)', required: false, dependencies: ['TRT01P'] },
      { name: 'TRT01AN', label: 'Actual Treatment (N)', required: false, dependencies: ['TRT01A'] },
    ]
  },
  {
    name: 'Population Flags',
    variables: [
      { name: 'SAFFL', label: 'Safety Population Flag', required: false },
      { name: 'ITTFL', label: 'Intent-to-Treat Population', required: false },
      { name: 'EFFFL', label: 'Efficacy Population Flag', required: false },
    ]
  },
];

const VariablesTab = ({ selectedVariables, onVariablesChange }: VariablesTabProps) => {
  const [searchText, setSearchText] = useState('');

  const handleToggle = (varName: string) => {
    if (selectedVariables.includes(varName)) {
      onVariablesChange(selectedVariables.filter(v => v !== varName));
    } else {
      onVariablesChange([...selectedVariables, varName]);
    }
  };

  const filteredCategories = variableCategories.map(cat => ({
    ...cat,
    variables: cat.variables.filter(v => 
      v.name.toLowerCase().includes(searchText.toLowerCase()) ||
      v.label.toLowerCase().includes(searchText.toLowerCase())
    )
  })).filter(cat => cat.variables.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Input
        placeholder="🔍 Search variables..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        prefix={<SearchOutlined />}
        style={{ marginBottom: '8px' }}
      />

      {filteredCategories.map((category) => {
        const selectedCount = category.variables.filter(v => selectedVariables.includes(v.name)).length;
        return (
          <Collapse
            key={category.name}
            defaultActiveKey={[category.name]}
            items={[
              {
                key: category.name,
                label: (
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                    <span>{category.name}</span>
                    <span style={{ color: '#6b7280', fontSize: '12px' }}>
                      {selectedCount}/{category.variables.length} selected
                    </span>
                  </div>
                ),
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {category.variables.map((variable) => (
                      <div
                        key={variable.name}
                        onClick={() => handleToggle(variable.name)}
                        style={{
                          padding: '8px',
                          background: selectedVariables.includes(variable.name) ? '#f3f4f6' : '#fafafa',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'start',
                          transition: 'background 0.2s',
                        }}
                      >
                        <Checkbox
                          checked={selectedVariables.includes(variable.name)}
                          onChange={() => handleToggle(variable.name)}
                          style={{ marginRight: '8px' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: '#111827', marginBottom: '2px', fontSize: '12px' }}>
                            {variable.name}
                            {variable.required && (
                              <span style={{
                                background: '#fee2e2',
                                color: '#991b1b',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '9px',
                                marginLeft: '6px',
                                fontWeight: 600,
                              }}>
                                REQUIRED
                              </span>
                            )}
                            {variable.dependencies && (
                              <span style={{
                                background: '#fef3c7',
                                color: '#92400e',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '9px',
                                marginLeft: '6px',
                                fontWeight: 600,
                              }}>
                                DEPENDS ON {variable.dependencies.join(', ')}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            {variable.label}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              },
            ]}
          />
        );
      })}
    </div>
  );
};

export default VariablesTab;
