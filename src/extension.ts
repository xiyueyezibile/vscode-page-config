
import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import prettier from 'prettier';


const regex = /defineAppConfig\s*\(\s*(\{.*\})\s*\)/s;
const defaultRegex = /{([\s\S]*?)}/;

export function activate(context: vscode.ExtensionContext) {
	
	// 注册插件
	const disposable = vscode.commands.registerCommand('page-config.openConfigView', () => {
		// 获取文件内容
		const { defaultConfig, filePath } = getDefaultConfig()
		const nameArr = filePath.split(path.sep)
		nameArr.pop()
		nameArr.push('app.config.ts')
		let appPath = nameArr.join(path.sep)
		if(!fs.existsSync(appPath)) {
			nameArr.pop()
			nameArr.push('app.config.js')
			appPath = nameArr.join(path.sep)
		}
		const appConfig = getAppConfig(appPath)
		const pageInfo = getPageInfo(defaultConfig, appConfig)
		
		
		// 创建 webview
		const panel = vscode.window.createWebviewPanel('page-config', 'Page Config', vscode.ViewColumn.One, {
			enableScripts: true
		})
		panel.webview.html = getWebviewContent(pageInfo)
		// 监听消息
		panel.webview.onDidReceiveMessage(
			message => {
				if (message.command === 'submit') {
					const config = JSON.parse(message.text)
					defaultConfig.pages = config.pages;
					const str = `export default ${JSON.stringify(defaultConfig, null, 2)}`
					prettier.format(str, { parser: 'babel' }).then((formatted) => {
						fs.writeFileSync(filePath, formatted)
						// 弹消息
						vscode.window.showInformationMessage('提交成功');
						panel.dispose()
					})
				}
			},
			undefined,
			context.subscriptions
		);

	});
	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }


function getWebviewContent(pageInfo: any) {
	const activePagesArr = `[${pageInfo.activePages.map((item: any) => {
		return `"${item}"`
	}).join(',')}]`
	const positivePagesArr = `[${pageInfo.positivePages.map((item: any) => {
		return `"${item}"`
	})}]`
	

    return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>SVG Preview</title>
      </head>
      <body>
    	<div id="app">
		<ul>
		</ul>
		<button onclick="submit()">更改</button>
		</div>
		<script>
			let checkeds = ${activePagesArr}
			let uncheckeds = ${positivePagesArr}
			const vscode = acquireVsCodeApi()
			const ul = document.querySelector('ul')
			function btnClick(e) {
				if(e.target.isChecked === 'true') {
					e.target.isChecked = 'false'
					e.target.style = ''
				} else {
				 	e.target.isChecked = 'true'
					e.target.style = 'background-color: green'
				}
			}
			checkeds.forEach((item) => {
			    const li = document.createElement('li')
				const btn = document.createElement('button')
				btn.innerText = item
				btn.style = 'background-color: green'
				btn.isChecked = 'true'
				btn.onclick = btnClick
			    li.appendChild(btn)
				ul.appendChild(li)
			})
			uncheckeds.forEach((item) => {
			    const li = document.createElement('li')
			    const btn = document.createElement('button')
				btn.isChecked = 'false'
				btn.innerText = item
				btn.onclick = btnClick
			    li.appendChild(btn)
				ul.appendChild(li)
			})
			
			const submit = () => {
				const btns = ul.querySelectorAll('button')
				const checkedPaths = Array.from(btns).filter((item) => item.isChecked === 'true').map((item) => item.innerText)
				const result = {
					pages: checkedPaths
				}
				vscode.postMessage({
					command: 'submit',
					text: JSON.stringify(result)
				})
			}
		</script>
      </body>
    </html>
    `
}

function getDefaultConfig() {
	// 获取当前活动编辑器
	const activeEditor = vscode.window.activeTextEditor;
	if(activeEditor) {
		const doc = activeEditor.document;
		const fileContent = doc.getText();
		const defaultString = fileContent.match(defaultRegex)?.length ? (fileContent.match(defaultRegex) as any)[1] : ''
		const defaultFunc = new Function(`return {${defaultString}}`);
  		const defaultConfig = defaultFunc();

		const filePath = doc.uri.fsPath;
		return {
			defaultConfig: defaultConfig,
			filePath: filePath || ''
		}
	}
	return {
		defaultConfig: {},
		filePath: ''
	}
}

function getAppConfig(path: string) {
	const data = fs.readFileSync(path);
	const objString = (data.toString().match(regex) as any)[1];
  const func = new Function(`return ${objString}`);
  // 获取原对象
  const originConfig = func();
  return originConfig;
}

function getPageInfo(defaultConfig: any, appConfig: any) {
	return {
		activePages: defaultConfig.pages,
		server: defaultConfig.server,
		buildWithTab: defaultConfig.buildWithTab,
		positivePages: appConfig.pages.filter((item: any) => !defaultConfig.pages.includes(item)),
	}
}