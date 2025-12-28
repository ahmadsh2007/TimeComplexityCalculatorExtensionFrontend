import * as vscode from 'vscode';
import axios from 'axios';

const API_URL = 'https://timecomplexitycalculatorextension.onrender.com/analyze';

class ComplexityCodeLensProvider implements vscode.CodeLensProvider {
    
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    constructor() {
        vscode.workspace.onDidChangeConfiguration(() => {
            this._onDidChangeCodeLenses.fire();
        });
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
            
            const command: vscode.Command = {
                title: "$(beaker) Analyze Complexity", 
                tooltip: "Click to calculate time complexity",
                command: "timecomplexity.codelensAction", 
                arguments: [range] 
            };
            
            codeLenses.push(new vscode.CodeLens(range, command));
        }
        return codeLenses;
    }
}

export function activate(context: vscode.ExtensionContext) {

    const runAnalysis = async (code: string, modelName: string) => {
        const title = modelName.includes('lite') ? 'Lite Model' : 'Normal Model';

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Analyzing with ${title}...`,
            cancellable: false
        }, async (progress) => {
            try {
                const response = await axios.post(API_URL, { 
                    code: code,
                    model: modelName 
                });
                
                const data = JSON.parse(response.data.raw_output);
                
                vscode.window.showInformationMessage(
                    `Time: ${data.time_complexity} | Space: ${data.space_complexity}`,
                    "Read Explanation"
                ).then(selection => {
                    if (selection === "Read Explanation") {
                        vscode.window.showInformationMessage(data.explanation);
                    }
                });

            } catch (error) {
                vscode.window.showErrorMessage(`Failed to analyze. Error: ${error}`);
            }
        });
    };

    const docSelector = [{ language: 'cpp', scheme: 'file' }, { language: 'c', scheme: 'file' }];
    const codeLensProvider = new ComplexityCodeLensProvider();
    context.subscriptions.push(vscode.languages.registerCodeLensProvider(docSelector, codeLensProvider));

    let lensAction = vscode.commands.registerCommand('timecomplexity.codelensAction', async (range: vscode.Range) => {
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
        runAnalysis(functionCode, modelName);
    });

    let normalCommand = vscode.commands.registerCommand('timecomplexity.analyzeNormal', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const text = editor.document.getText(editor.selection) || editor.document.getText();
            runAnalysis(text, 'gemini-flash-latest');
        }
    });

    let liteCommand = vscode.commands.registerCommand('timecomplexity.analyzeLite', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const text = editor.document.getText(editor.selection) || editor.document.getText();
            runAnalysis(text, 'gemini-flash-lite-latest');
        }
    });

    context.subscriptions.push(lensAction);
    context.subscriptions.push(normalCommand);
    context.subscriptions.push(liteCommand);
}

export function deactivate() {}