import * as vscode from 'vscode';
import axios from 'axios';
import * as crypto from 'crypto';

const API_URL = 'https://timecomplexitycalculatorextension.onrender.com/analyze';

class ComplexityCodeLensProvider implements vscode.CodeLensProvider {
    
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    private resultCache: Map<string, string> = new Map();

    constructor() {
        vscode.workspace.onDidChangeConfiguration(() => {
            this._onDidChangeCodeLenses.fire();
        });
    }

    public refresh() {
        this._onDidChangeCodeLenses.fire();
    }

    public setComplexity(cacheKey: string, result: string) {
        this.resultCache.set(cacheKey, result);
        this.refresh();
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
        if (document.languageId !== 'cpp' && document.languageId !== 'c') {
            return [];
        }

        const codeLenses: vscode.CodeLens[] = [];
        const regex = /\b\w+\s+\w+\s*\(.*?\)\s*\{/g; 
        const text = document.getText();
        let matches;

        while ((matches = regex.exec(text)) !== null) {
            const line = document.lineAt(document.positionAt(matches.index).line);
            const range = new vscode.Range(line.range.start, line.range.end);

            const endPos = range.start.translate(20, 0); 
            const safeEnd = endPos.line < document.lineCount ? endPos : document.lineAt(document.lineCount - 1).range.end;
            const functionFingerprint = document.getText(new vscode.Range(range.start, safeEnd));
            
            const cacheKey = crypto.createHash('md5').update(functionFingerprint).digest('hex');

            const savedResult = this.resultCache.get(cacheKey);

            if (savedResult) {
                const command: vscode.Command = {
                    title: `$(check) ${savedResult}`, 
                    tooltip: "Analysis complete. Edit code to reset.",
                    command: "" 
                };
                codeLenses.push(new vscode.CodeLens(range, command));
            } else {
                const command: vscode.Command = {
                    title: "$(beaker) Analyze Complexity", 
                    tooltip: "Click to calculate time complexity",
                    command: "timecomplexity.codelensAction", 
                    arguments: [range, cacheKey]
                };
                codeLenses.push(new vscode.CodeLens(range, command));
            }
        }
        return codeLenses;
    }
}

export function activate(context: vscode.ExtensionContext) {

    const codeLensProvider = new ComplexityCodeLensProvider();
    const docSelector = [{ language: 'cpp', scheme: 'file' }, { language: 'c', scheme: 'file' }];
    context.subscriptions.push(vscode.languages.registerCodeLensProvider(docSelector, codeLensProvider));

    const runAnalysis = async (code: string, modelName: string): Promise<any> => {
        try {
            const response = await axios.post(API_URL, { 
                code: code,
                model: modelName 
            });
            return JSON.parse(response.data.raw_output);
        } catch (error) {
            throw error;
        }
    };

    const getConfidenceEmoji = (level: string) => {
        switch (level?.toLowerCase()) {
            case 'high': return '🟢';   
            case 'medium': return '🟡'; 
            case 'low': return '🔴';    
            default: return '⚪';       
        }
    };

    let lensAction = vscode.commands.registerCommand('timecomplexity.codelensAction', async (range: vscode.Range, cacheKey: string) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const document = editor.document;
        const endPos = range.start.translate(50, 0); 
        const safeEnd = endPos.line < document.lineCount ? endPos : document.lineAt(document.lineCount - 1).range.end;
        const functionCode = document.getText(new vscode.Range(range.start, safeEnd)); 

        const choice = await vscode.window.showQuickPick(
            [{ label: 'Normal', description: 'Best for complex logic' }, { label: 'Lite', description: 'Fast' }],
            { placeHolder: 'Select AI Model' }
        );
        if (!choice) return;
        const modelName = choice.label === 'Lite' ? 'gemini-flash-lite-latest' : 'gemini-flash-latest';

        const statusBarMsg = vscode.window.setStatusBarMessage("$(sync~spin) Analyzing Complexity...", 10000);

        try {
            const data = await runAnalysis(functionCode, modelName);
            
            if (data.time_complexity) {
                const tEmoji = getConfidenceEmoji(data.time_confidence);
                const sEmoji = getConfidenceEmoji(data.space_confidence);

                const resultString = `${tEmoji} Time: ${data.time_complexity} | ${sEmoji} Space: ${data.space_complexity}`;
                
                codeLensProvider.setComplexity(cacheKey, resultString);
                
                vscode.window.showInformationMessage("Analysis Complete. Read explanation?", "Yes").then(sel => {
                    if (sel === "Yes") vscode.window.showInformationMessage(data.explanation);
                });
            }

        } catch (error) {
            vscode.window.showErrorMessage("Analysis failed. Please try again.");
        } finally {
            statusBarMsg.dispose();
        }
    });

    let normalCommand = vscode.commands.registerCommand('timecomplexity.analyzeNormal', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const text = editor.document.getText(editor.selection) || editor.document.getText();
            try {
                const data = await runAnalysis(text, 'gemini-flash-latest');
                vscode.window.showInformationMessage(`Time: ${data.time_complexity} | Space: ${data.space_complexity} \n\n ${data.explanation}`);
            } catch(e) { vscode.window.showErrorMessage("Failed"); }
        }
    });

    let liteCommand = vscode.commands.registerCommand('timecomplexity.analyzeLite', async () => {
         const editor = vscode.window.activeTextEditor;
        if (editor) {
            const text = editor.document.getText(editor.selection) || editor.document.getText();
            try {
                const data = await runAnalysis(text, 'gemini-flash-lite-latest');
                vscode.window.showInformationMessage(`Time: ${data.time_complexity} | Space: ${data.space_complexity} \n\n ${data.explanation}`);
            } catch(e) { vscode.window.showErrorMessage("Failed"); }
        }
    });

    context.subscriptions.push(lensAction);
    context.subscriptions.push(normalCommand);
    context.subscriptions.push(liteCommand);
}

export function deactivate() {}