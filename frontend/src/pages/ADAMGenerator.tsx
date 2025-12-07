/**
 * ADAM Generator Page
 * 
 * Core Features:
 * 1. File uploaders for R code and SDTM datasets
 * 2. Monaco Editor for code editing
 * 3. R execution trigger and output display
 */

import React, { useState } from 'react';
import { Card, Upload, Button, Space, message, Row, Col, Spin } from 'antd';
import {
    PlayCircleOutlined,
    FileTextOutlined,
    DatabaseOutlined,
    CodeOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import type { UploadFile } from 'antd/es/upload/interface';
import { adamApi } from '../services/api';
import RExecutionOutputComponent from '../components/RExecutionOutput';
import type { RExecutionResult } from '../types/rExecution';

const { Dragger } = Upload;

const ADAMGenerator: React.FC = () => {
    const [codeFile, setCodeFile] = useState<UploadFile | null>(null);
    const [dataFiles, setDataFiles] = useState<UploadFile[]>([]);
    const [editorCode, setEditorCode] = useState<string>('# Upload an R script or write code here\n');
    const [isExecuting, setIsExecuting] = useState(false);
    const [executionResult, setExecutionResult] = useState<RExecutionResult | null>(null);
    const [consoleLines, setConsoleLines] = useState<string[]>([]);

    // Handle R Code Upload
    const handleCodeUpload = (file: UploadFile) => {
        setCodeFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                setEditorCode(e.target.result as string);
                message.success('R script loaded into editor');
            }
        };
        reader.readAsText(file as unknown as Blob);
        return false;
    };

    // Handle SDTM Data Upload
    const handleDataUpload = (file: UploadFile) => {
        setDataFiles(prev => [...prev, file]);
        message.success(`Added: ${file.name}`);
        return false;
    };

    // Run Execution
    const handleRun = async () => {
        if (!editorCode.trim()) {
            message.error('Please provide R code to execute.');
            return;
        }

        setIsExecuting(true);
        setExecutionResult(null);
        setConsoleLines([]);

        try {
            const finalCodeFile = new File(
                [editorCode],
                codeFile?.name || 'program.R',
                { type: 'text/plain' }
            );

            const response = await adamApi.runADAMGeneration(
                finalCodeFile,
                dataFiles.map(f => f as unknown as File)
            );

            const runId = response.run_id;
            message.info(`Execution started (ID: ${runId})`);

            // Stream progress via SSE
            const eventSource = new EventSource(`/api/v1/r-execution/run/${runId}/stream`);

            eventSource.addEventListener('progress', (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.stdout) {
                        setConsoleLines(prev => [...prev, data.stdout]);
                    }
                } catch (e) {
                    console.error('SSE parse error', e);
                }
            });

            eventSource.addEventListener('complete', async () => {
                eventSource.close();
                setIsExecuting(false);
                try {
                    const resultResponse = await adamApi.get(`/api/v1/r-execution/run/${runId}/result`);
                    setExecutionResult(resultResponse.data);
                    message.success('Execution completed!');
                } catch {
                    message.error('Failed to fetch results');
                }
            });

            eventSource.addEventListener('error', () => {
                if (eventSource.readyState === 2) {
                    setIsExecuting(false);
                    message.error('Execution stream ended unexpectedly');
                }
            });

            eventSource.onerror = () => {
                if (eventSource.readyState === 2) {
                    eventSource.close();
                    setIsExecuting(false);
                }
            };

        } catch (error: any) {
            console.error(error);
            message.error('Execution failed: ' + (error.message || 'Unknown error'));
            setIsExecuting(false);
        }
    };

    return (
        <div style={{ padding: '16px', height: '100%', overflow: 'auto' }}>
            {/* Header with Run Button */}
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0 }}>
                    <CodeOutlined style={{ marginRight: 8 }} />
                    ADAM Generator
                </h2>
                <Button
                    type="primary"
                    size="large"
                    icon={<PlayCircleOutlined />}
                    onClick={handleRun}
                    loading={isExecuting}
                    disabled={!editorCode.trim()}
                >
                    Run
                </Button>
            </div>

            <Row gutter={16}>
                {/* Left: File Uploads */}
                <Col xs={24} md={8}>
                    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        {/* R Script Upload */}
                        <Card title={<><FileTextOutlined /> R Script</>} size="small">
                            <Dragger
                                accept=".r,.R"
                                beforeUpload={handleCodeUpload}
                                fileList={codeFile ? [codeFile] : []}
                                maxCount={1}
                                onRemove={() => { setCodeFile(null); setEditorCode(''); }}
                            >
                                <p><FileTextOutlined style={{ fontSize: 24 }} /></p>
                                <p>Drop R script here</p>
                            </Dragger>
                        </Card>

                        {/* SDTM Data Upload */}
                        <Card title={<><DatabaseOutlined /> SDTM Data</>} size="small">
                            <Dragger
                                multiple
                                accept=".csv,.sas7bdat,.xpt"
                                beforeUpload={handleDataUpload}
                                fileList={dataFiles}
                                onRemove={(file) => setDataFiles(prev => prev.filter(f => f.uid !== file.uid))}
                            >
                                <p><DatabaseOutlined style={{ fontSize: 24 }} /></p>
                                <p>Drop SDTM datasets here</p>
                            </Dragger>
                            {dataFiles.length > 0 && (
                                <p style={{ marginTop: 8, fontSize: 12, color: '#888' }}>
                                    Files accessible at <code>input/filename</code> in R
                                </p>
                            )}
                        </Card>
                    </Space>
                </Col>

                {/* Right: Editor and Output */}
                <Col xs={24} md={16}>
                    <Card
                        title={<><CodeOutlined /> Code Editor</>}
                        size="small"
                        style={{ marginBottom: 16 }}
                    >
                        <div style={{ height: '300px', border: '1px solid #d9d9d9' }}>
                            <Editor
                                height="100%"
                                defaultLanguage="r"
                                value={editorCode}
                                onChange={(value) => setEditorCode(value || '')}
                                theme="vs-dark"
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 13,
                                    scrollBeyondLastLine: false,
                                }}
                            />
                        </div>
                    </Card>

                    <Card title="Output" size="small">
                        <div style={{ minHeight: '250px' }}>
                            {isExecuting ? (
                                <div style={{ textAlign: 'center', padding: 40 }}>
                                    <Spin size="large" />
                                    <p style={{ marginTop: 16 }}>Executing R code...</p>
                                </div>
                            ) : executionResult ? (
                                <RExecutionOutputComponent
                                    result={executionResult}
                                    isExecuting={false}
                                    consoleLines={consoleLines}
                                />
                            ) : (
                                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                                    Click "Run" to execute your R code
                                </div>
                            )}
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default ADAMGenerator;
