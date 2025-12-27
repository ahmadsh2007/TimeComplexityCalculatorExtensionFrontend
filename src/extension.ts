import * as vscode from 'vscode';
import axios from 'axios';

const API_URL = 'https://timecomplexitycalculatorextension.onrender.com/analyze';

export function activate(context: vscode.ExtensionContext) {

    const runAnalysis = async (modelName: string) => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No code editor is open.');
            return;
        }

        const text = editor.document.getText(editor.selection) || editor.document.getText();
        if (!text.trim()) {
            vscode.window.showWarningMessage('Please select some code.');
            return;
        }

        const title = modelName.includes('lite') ? 'Lite Model' : 'Normal Model';

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Analyzing with ${title}...`,
            cancellable: false
        }, async (progress) => {
            try {
                const response = await axios.post(API_URL, { 
                    code: text,
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

    let normalCommand = vscode.commands.registerCommand('timecomplexity.analyzeNormal', () => {
        runAnalysis('gemini-flash-latest');
    });

    let liteCommand = vscode.commands.registerCommand('timecomplexity.analyzeLite', () => {
        runAnalysis('gemini-flash-lite-latest');
    });

    context.subscriptions.push(normalCommand);
    context.subscriptions.push(liteCommand);
}

export function deactivate() {}