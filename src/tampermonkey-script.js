// ==UserScript==
// @name         作业部落
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @require      https://fastly.jsdelivr.net/gh/WoHal/zybuluo_syncing@0.0.1/libs/octokit.js
// @match        https://www.zybuluo.com/*
// @icon         https://www.zybuluo.com/static/img/favicon.png
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';
    const {com, JSZip} = unsafeWindow
    const btoa = com.zybuluo.common.encodeBase64
    const saveAs = com.zybuluo.mdeditor.common.saveAs
    const {octokit: {Octokit}} = window

    Date.prototype.format = function (fmt) {
        var o = {
            "M+": this.getMonth() + 1, //月份
            "d+": this.getDate(), //日
            "h+": this.getHours(), //小时
            "m+": this.getMinutes(), //分
            "s+": this.getSeconds(), //秒
            "q+": Math.floor((this.getMonth() + 3) / 3), //季度
            "S": this.getMilliseconds() //毫秒
        };
        if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
        for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
        return fmt;
    }

    function getCurrentNoteTitle() {
        return document.title.split('-').slice(0, -1).join('').trim()
    }
    function getCurrentNoteContent() {
        return com.zybuluo.mdeditor.unifiedEditor.getValue()
    }
    async function syncToGithub() {
        const title = getCurrentNoteTitle()
        const newContent = getCurrentNoteContent()
        try {
            // 获取GitHub设置
            const githubRepo = GM_getValue('githubRepo', '');
            const githubBranch = GM_getValue('githubBranch', 'main');
            const apiToken = GM_getValue('apiToken', '');

            if (!githubRepo || !apiToken) {
                console.error('GitHub设置未完成，请先设置GitHub项目地址和API Token');
                return;
            }

            // 解析GitHub仓库信息
            const repoRegex = /github\.com\/([^\/]+)\/([^\/]+)/;
            const repoMatch = githubRepo.match(repoRegex);

            if (!repoMatch) {
                console.error('GitHub项目地址格式不正确');
                return;
            }

            const owner = repoMatch[1];
            const repo = repoMatch[2].replace(/\.git$/, '');

            // 创建Octokit实例
            const octokit = new Octokit({
                auth: apiToken
            });

            // 文件路径（使用标题作为文件名）
            const filePath = `${title}.md`;

            try {
                // 获取文件内容
                const fileResponse = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                    owner,
                    repo,
                    path: filePath,
                    ref: githubBranch,
                    headers: {
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                });

                // 解码文件内容
                const sha = fileResponse.data.sha;

                // 提交更改
                await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
                    owner,
                    repo,
                    path: filePath,
                    message: `更新 ${title}`,
                    content: btoa(newContent),
                    sha: sha,
                    branch: githubBranch,
                    headers: {
                        'X-GitHub-Api-Version': '2022-11-28'
                    }
                });

                console.log(`成功同步 ${title} 到GitHub`);
            } catch (error) {
                if (error.status === 404) {
                    // 文件不存在，创建新文件
                    await octokit.request('PUT /repos/{owner}/{repo}/contents/{path}', {
                        owner,
                        repo,
                        path: filePath,
                        message: `创建 ${title}`,
                        content: btoa(unescape(encodeURIComponent(newContent))),
                        branch: githubBranch,
                        headers: {
                            'X-GitHub-Api-Version': '2022-11-28'
                        }
                    });

                    console.log(`成功创建 ${title} 到GitHub`);
                } else {
                    throw error;
                }
            }
        } catch (error) {
            console.error('同步到GitHub失败:', error);
        }
    }

    function getUserInfo() {
        return new Promise((resolve, reject) => {
            com.zybuluo.common.loginUser.get(userInfo => {
                resolve(userInfo)
            })
        })
    }

    function getAllLocalNotesZip(userInfo) {
        const jszip = new JSZip;
        return new Promise((resolve, reject) => {
            com.zybuluo.mdeditor.syncUserNotes.exportAllLocalNotes(userInfo, function(a) {
                for (var b in a.tags) {
                    var c = jszip.folder(a.tags[b]);
                    c.file(a.title + ".md", a.details)
                }
            }, function() {
                const zip = jszip.generate({
                    type: "blob"
                });
                resolve(zip)
            }, function() {
                reject("导出本地文稿时出错，请关闭客户端/浏览器后重启程序，或者联系我们。")
            })
        })
    }

    async function downloadAllMarkdowns() {
        const userInfo = await getUserInfo()
        const zip = await getAllLocalNotesZip(userInfo)
        saveAs(zip, "Cmd-Markdowns-" + (new Date).format("yyyy-MM-dd-hh:mm") + ".zip")
    }

    function createUIs() {
        // 创建按钮组容器
        const buttonGroup = document.createElement('div');
        buttonGroup.style.position = 'fixed';
        buttonGroup.style.bottom = '20%';
        buttonGroup.style.right = '20px';
        buttonGroup.style.display = 'flex';
        buttonGroup.style.flexDirection = 'column';
        buttonGroup.style.gap = '10px';
        buttonGroup.style.zIndex = '9999';
        document.body.appendChild(buttonGroup);
        
        // 创建开始同步按钮
        const syncButton = document.createElement('div');
        syncButton.innerHTML = '开始同步';
        syncButton.style.padding = '10px 15px';
        syncButton.style.backgroundColor = '#FF5722';
        syncButton.style.color = 'white';
        syncButton.style.borderRadius = '5px';
        syncButton.style.cursor = 'pointer';
        syncButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
        syncButton.style.textAlign = 'center';
        buttonGroup.appendChild(syncButton);
        
        // 创建同步设置按钮
        const floatingButton = document.createElement('div');
        floatingButton.innerHTML = '同步设置';
        floatingButton.style.padding = '10px 15px';
        floatingButton.style.backgroundColor = '#4CAF50';
        floatingButton.style.color = 'white';
        floatingButton.style.borderRadius = '5px';
        floatingButton.style.cursor = 'pointer';
        floatingButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
        floatingButton.style.textAlign = 'center';
        buttonGroup.appendChild(floatingButton);

        // 创建下载所有Markdown文件的按钮
        const downloadButton = document.createElement('div');
        downloadButton.innerHTML = '全部导出';
        downloadButton.style.padding = '10px 15px';
        downloadButton.style.backgroundColor = '#2196F3';
        downloadButton.style.color = 'white';
        downloadButton.style.borderRadius = '5px';
        downloadButton.style.cursor = 'pointer';
        downloadButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
        downloadButton.style.textAlign = 'center';
        buttonGroup.appendChild(downloadButton);

        // 标记按钮是否处于操作中的状态
        let isSyncing = false;
        let isDownloading = false;
        
        // 点击开始同步按钮调用syncToGithub函数
        syncButton.addEventListener('click', async () => {
            // 如果正在同步中，则不执行操作
            if (isSyncing) return;
            
            // 更改按钮状态
            isSyncing = true;
            const originalColor = syncButton.style.backgroundColor;
            syncButton.style.backgroundColor = '#999999';
            syncButton.innerHTML = '同步中...';
            
            try {
                // 执行同步操作
                await syncToGithub();
                // 操作成功提示
                syncButton.style.backgroundColor = '#4CAF50';
                syncButton.innerHTML = '同步成功';
                
                // 2秒后恢复按钮状态
                setTimeout(() => {
                    syncButton.style.backgroundColor = originalColor;
                    syncButton.innerHTML = '开始同步';
                    isSyncing = false;
                }, 2000);
            } catch (error) {
                // 操作失败提示
                syncButton.style.backgroundColor = '#f44336';
                syncButton.innerHTML = '同步失败';
                
                // 2秒后恢复按钮状态
                setTimeout(() => {
                    syncButton.style.backgroundColor = originalColor;
                    syncButton.innerHTML = '开始同步';
                    isSyncing = false;
                }, 2000);
                
                console.error('同步失败:', error);
            }
        });
        
        // 点击下载按钮调用downloadAllMarkdowns函数
        downloadButton.addEventListener('click', async () => {
            // 如果正在下载中，则不执行操作
            if (isDownloading) return;
            
            // 更改按钮状态
            isDownloading = true;
            const originalColor = downloadButton.style.backgroundColor;
            downloadButton.style.backgroundColor = '#999999';
            downloadButton.innerHTML = '导出中...';
            
            try {
                // 执行下载操作并等待完成
                await downloadAllMarkdowns();
                
                // 操作成功提示
                downloadButton.style.backgroundColor = '#4CAF50';
                downloadButton.innerHTML = '导出成功';
                
                // 2秒后恢复按钮状态
                setTimeout(() => {
                    downloadButton.style.backgroundColor = originalColor;
                    downloadButton.innerHTML = '全部导出';
                    isDownloading = false;
                }, 2000);
            } catch (error) {
                // 操作失败提示
                downloadButton.style.backgroundColor = '#f44336';
                downloadButton.innerHTML = '导出失败';
                
                // 2秒后恢复按钮状态
                setTimeout(() => {
                    downloadButton.style.backgroundColor = originalColor;
                    downloadButton.innerHTML = '全部导出';
                    isDownloading = false;
                }, 2000);
                
                console.error('导出失败:', error);
            }
        });

        // 创建对话框
        const dialog = document.createElement('div');
        dialog.style.display = 'none';
        dialog.style.position = 'fixed';
        dialog.style.top = '50%';
        dialog.style.left = '50%';
        dialog.style.transform = 'translate(-50%, -50%)';
        dialog.style.backgroundColor = 'white';
        dialog.style.padding = '20px';
        dialog.style.borderRadius = '5px';
        dialog.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
        dialog.style.zIndex = '10000';
        dialog.style.minWidth = '300px';

        // 对话框内容
        dialog.innerHTML = `
            <h2 style="margin-top: 0; color: #333;">GitHub同步设置</h2>
            <div style="margin-bottom: 15px;">
                <label for="github-repo" style="display: block; margin-bottom: 5px; font-weight: bold;">GitHub项目地址:</label>
                <input type="text" id="github-repo" style="width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px;" placeholder="例如: https://github.com/username/repo">
            </div>
            <div style="margin-bottom: 15px;">
                <label for="github-branch" style="display: block; margin-bottom: 5px; font-weight: bold;">分支名称:</label>
                <input type="text" id="github-branch" style="width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px;" placeholder="例如: main 或 master">
            </div>
            <div style="margin-bottom: 15px;">
                <label for="api-token" style="display: block; margin-bottom: 5px; font-weight: bold;">API Token:</label>
                <input type="password" id="api-token" style="width: 100%; padding: 8px; box-sizing: border-box; border: 1px solid #ddd; border-radius: 4px;" placeholder="输入您的GitHub API Token">
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 20px;">
                <button id="close-dialog" style="padding: 8px 15px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">关闭</button>
                <button id="save-settings" style="padding: 8px 15px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">保存设置</button>
            </div>
        `;
        document.body.appendChild(dialog);

        // 获取保存的值并填充表单
        const savedRepo = GM_getValue('githubRepo', '');
        const savedBranch = GM_getValue('githubBranch', 'main');
        const savedToken = GM_getValue('apiToken', '');

        // 点击悬浮按钮显示对话框
        floatingButton.addEventListener('click', function() {
            dialog.style.display = 'block';
            document.getElementById('github-repo').value = savedRepo;
            document.getElementById('github-branch').value = savedBranch;
            document.getElementById('api-token').value = savedToken;
        });

        // 点击关闭按钮
        document.getElementById('close-dialog').addEventListener('click', function() {
            dialog.style.display = 'none';
        });

        // 点击保存按钮
        document.getElementById('save-settings').addEventListener('click', function() {
            const githubRepo = document.getElementById('github-repo').value;
            const githubBranch = document.getElementById('github-branch').value || 'main';
            const apiToken = document.getElementById('api-token').value;

            // 保存值到Tampermonkey存储
            GM_setValue('githubRepo', githubRepo);
            GM_setValue('githubBranch', githubBranch);
            GM_setValue('apiToken', apiToken);

            // 显示保存成功消息
            alert('设置已保存！');
            dialog.style.display = 'none';
        });

        // 点击对话框外部关闭对话框
        window.addEventListener('click', function(event) {
            if (event.target !== dialog && !dialog.contains(event.target) && event.target !== floatingButton) {
                dialog.style.display = 'none';
            }
        });
    }

    createUIs()
})();