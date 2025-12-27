import * as vscode from 'vscode';
import axios from 'axios';

const API_URL = 'https://timecomplexitycalculatorextension.onrender.com/';

export function activate(context: vscode.ExtensionContext) {

    let disposable = vscode.commands.registerCommand('TimeComplexity.analyze', async () => {
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

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Asking AI for Complexity...",
            cancellable: false
        }, async (progress) => {
            try {
                const response = await axios.post(API_URL, { code: text });
                
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
                vscode.window.showErrorMessage("Failed to analyze. Server might be waking up (wait 1 min).");
            }
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}