
import React, { useState, useRef } from 'react';
import { Button, Space, Tag, Tooltip, Modal, Card, message, Select, Typography, Spin, Progress } from 'antd';
import {
    BgColorsOutlined, ZoomOutOutlined, ZoomInOutlined,
    FormatPainterOutlined, FileTextOutlined,
    DownloadOutlined, PlayCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
    UploadOutlined
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';

const { Text } = Typography;

interface AdamRCodeEditorProps {
    code: string;
    setCode: (code: string) => void;
    rVersion: string;
    setRVersion: (version: string) => void;
    onRun: () => void;
    isExecuting: boolean;
    progress: number;
    currentStep: string;
    lastResult: any | null;
    lastError: string | null;
    onLoadTemplate: (template: string) => void;
}

export const AdamRCodeEditor: React.FC<AdamRCodeEditorProps> = ({
    code,
    setCode,
    rVersion,
    setRVersion,
    onRun,
    isExecuting,
    progress,
    currentStep,
    lastResult,
    lastError,
    onLoadTemplate
}) => {
    // Editor State
    const [editorTheme, setEditorTheme] = useState<'vs' | 'vs-dark' | 'hc-black'>('vs-dark');
    const [fontSize, setFontSize] = useState(14);
    const [showMinimap, setShowMinimap] = useState(true);
    const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');
    const [showSnippets, setShowSnippets] = useState(false);
    const editorRef = useRef<any>(null);

    // Stats
    const codeStats = {
        lines: code.trim() ? code.split('\n').length : 0,
        chars: code.length
    };

    const handleEditorDidMount = (editor: any) => {
        editorRef.current = editor;
    };

    const handleFormatCode = () => {
        if (editorRef.current) {
            editorRef.current.getAction('editor.action.formatDocument').run();
        }
    };

    const handleDownloadCode = () => {
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `adam_program_${new Date().toISOString().slice(0, 10)}.R`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleUploadProgram = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate file type
        const validExtensions = ['.r', '.R', '.sas', '.txt'];
        const fileName = file.name.toLowerCase();
        const isValid = validExtensions.some(ext => fileName.endsWith(ext));

        if (!isValid) {
            message.error('Please upload a valid program file (.r, .R, .sas, or .txt)');
            return;
        }

        // Read file content
        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target?.result as string;
            if (content) {
                setCode(content);
                message.success(`Program loaded from ${file.name}`);
            }
        };
        reader.onerror = () => {
            message.error('Failed to read file');
        };
        reader.readAsText(file);

        // Reset input so same file can be uploaded again
        event.target.value = '';
    };

    // Standard Snippets
    const codeSnippets: Record<string, string> = {
        'Load Data': `# Load libraries
library(haven)
library(dplyr)
library(admiral)

# Load SDTM datasets
dm <- read_sas("input/dm.sas7bdat")
ae <- read_sas("input/ae.sas7bdat")
`,
        'ADSL Basic': `# ADSL Template
adsl <- dm %>%
  mutate(
    TRTSDT = try(as.Date(RFSTDTC)),
    TRTEDT = try(as.Date(RFENDTC))
  )
`,
    };

    return (
        <div className="adam-r-editor" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* Execution Toolbar */}
            <Card size="small" style={{ marginBottom: 12 }} bodyStyle={{ padding: '8px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                        <Button
                            type="primary"
                            icon={isExecuting ? <Spin size="small" /> : <PlayCircleOutlined />}
                            onClick={onRun}
                            loading={isExecuting}
                            disabled={!code.trim()}
                            style={{
                                background: code.trim() && !isExecuting ? 'linear-gradient(135deg, #52c41a 0%, #389e0d 100%)' : undefined,
                                border: 'none',
                                minWidth: '140px'
                            }}
                        >
                            {isExecuting ? 'Running...' : 'Run Program'}
                        </Button>

                        <Select
                            value={rVersion}
                            onChange={setRVersion}
                            style={{ width: 120 }}
                            size="small"
                            options={[
                                { value: '4.3.2', label: 'R 4.3.2' },
                                { value: '4.2.3', label: 'R 4.2.3' }
                            ]}
                        />

                        {isExecuting && (
                            <div style={{ width: 200, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <Progress percent={progress} size="small" showInfo={false} strokeColor="#52c41a" />
                                <span style={{ fontSize: 10, color: '#888' }}>{currentStep}</span>
                            </div>
                        )}
                    </Space>

                    <Space>
                        {lastResult && <Tag color="success" icon={<CheckCircleOutlined />}>Last Run: Success</Tag>}
                        {lastError && <Tag color="error" icon={<CloseCircleOutlined />}>Last Run: Failed</Tag>}
                    </Space>
                </div>
            </Card>

            {/* Editor Controls */}
            <div style={{ padding: '4px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space size="small">
                    <Tag>{codeStats.lines} lines</Tag>
                    <Tooltip title="Themes">
                        <Button type="text" size="small" icon={<BgColorsOutlined />} onClick={() => setEditorTheme(prev => prev === 'vs' ? 'vs-dark' : 'vs')} />
                    </Tooltip>
                    <Space size={2}>
                        <Button type="text" size="small" icon={<ZoomOutOutlined />} onClick={() => setFontSize(s => Math.max(10, s - 1))} />
                        <span style={{ fontSize: 11 }}>{fontSize}</span>
                        <Button type="text" size="small" icon={<ZoomInOutlined />} onClick={() => setFontSize(s => Math.min(24, s + 1))} />
                    </Space>
                </Space>

                <Space size="small">
                    <Tooltip title="Upload Program">
                        <Button
                            type="text"
                            size="small"
                            icon={<UploadOutlined />}
                            onClick={() => document.getElementById('program-file-input')?.click()}
                        />
                    </Tooltip>
                    <input
                        id="program-file-input"
                        type="file"
                        accept=".r,.R,.sas,.txt"
                        style={{ display: 'none' }}
                        onChange={handleUploadProgram}
                    />
                    <Tooltip title="Format"><Button type="text" size="small" icon={<FormatPainterOutlined />} onClick={handleFormatCode} /></Tooltip>
                    <Tooltip title="Snippets"><Button type="text" size="small" icon={<FileTextOutlined />} onClick={() => setShowSnippets(true)} /></Tooltip>
                    <Tooltip title="Download"><Button type="text" size="small" icon={<DownloadOutlined />} onClick={handleDownloadCode} /></Tooltip>
                </Space>
            </div>

            {/* Editor */}
            <div style={{ flex: 1, border: '1px solid #d9d9d9', minHeight: 500 }}>
                <Editor
                    height="100%"
                    defaultLanguage="r"
                    language="r"
                    theme={editorTheme}
                    value={code}
                    onChange={(val) => setCode(val || '')}
                    onMount={handleEditorDidMount}
                    options={{
                        minimap: { enabled: showMinimap },
                        fontSize: fontSize,
                        wordWrap: wordWrap,
                        automaticLayout: true,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
                    }}
                />
            </div>

            {/* Snippets Modal */}
            <Modal
                title="R Code Templates"
                open={showSnippets}
                onCancel={() => setShowSnippets(false)}
                footer={null}
            >
                {Object.entries(codeSnippets).map(([name, snippet]) => (
                    <Card
                        key={name} size="small" hoverable style={{ marginBottom: 8 }}
                        onClick={() => {
                            setCode(prev => prev + '\n\n' + snippet);
                            setShowSnippets(false);
                        }}
                    >
                        <Text strong>{name}</Text>
                        <pre style={{ fontSize: 10, background: '#f5f5f5', padding: 4, marginTop: 4 }}>{snippet.substring(0, 100)}...</pre>
                    </Card>
                ))}
            </Modal>

        </div>
    );
};
