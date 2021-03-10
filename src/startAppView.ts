import { homedir } from 'os'
import { join } from 'path'
import { promises as fs } from 'fs'
import * as vscode from 'vscode'
import { spawn } from 'child_process'

class AppItem extends vscode.TreeItem {
    path: string
    url: string
    description: string = ''
    contextValue: string = 'status-default'

    constructor (label: string, path: string, url: string) {
        super(label)
        this.path = path
        this.url = url
    }

    setStatus (status: string) {
        this.description = status
        this.contextValue = 'status-' + status.toLowerCase()
    }
}

export class StartAppViewProvider implements vscode.TreeDataProvider<AppItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AppItem | undefined> = new vscode.EventEmitter<AppItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<AppItem | undefined> = this._onDidChangeTreeData.event;

    apps: AppItem[] = []

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined)
    }

    getChildren(element?: AppItem): vscode.ProviderResult<AppItem[]> {
        if (element === undefined) {
            return this.apps
        }
        return []
    }

    getTreeItem(element: AppItem): vscode.TreeItem   {
        return element
    }

    async getAvailableApplications (): Promise<AppItem[]> {
        const p = process.env['JHUB_APPLICATIONS_PATH'] || join(homedir(), 'juliahub_applications_list.json')
        console.log(`Fetching apps list from ${p}.`)
        let apps = []
        try {
            apps = JSON.parse((await fs.readFile(p)).toString())
            apps = apps.map((app: any) => {
                return new AppItem(
                    app.name,
                    app.path,
                    app.url
                )
            })
        } catch (err) {
            console.error('Failed to fetch applications list.')
        }
        this.apps = apps
        this.refresh()

        return apps
    }

    setStatus(item: any, status: string) {
        const ind = this.apps.map(app => app.label).indexOf(item.label)
        if (ind >= -1) {
            this.apps[ind].setStatus(status)
            this.refresh()
            return true
        }
    }

    async startApp(item?: AppItem) {
        if (item === undefined || item.label === undefined) {
            return
        }
        this.setStatus(item, 'Starting')

        await new Promise(resolve => {
            const cp = spawn(item.path)
            cp.stdout.on('data', data => {
                console.log('stdout', data)
                if (data.toString().trim() === 'done') {
                    resolve(true)
                }
            })
        })

        this.setStatus(item, 'Running')
        console.log(`Starting app at ${item.path}...`)
    }

    async openApp(item?: AppItem) {
        if (item === undefined || item.label === undefined) {
            return
        }
        vscode.env.openExternal(vscode.Uri.parse(item.url))
    }
}

export async function activate(context: vscode.ExtensionContext) {
    const provider = new StartAppViewProvider()

    // assets path
    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('juliahub-welcome.appstarter', provider),
        vscode.commands.registerCommand('juliahub-welcome.startApp', (...args) => provider.startApp(...args)),
        vscode.commands.registerCommand('juliahub-welcome.openApp', (...args) => provider.openApp(...args))
    )
    await provider.getAvailableApplications()
}

export function deactivate() {}