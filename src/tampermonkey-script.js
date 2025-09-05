// ==UserScript==
// @name         作业部落
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @require      https://unpkg.com/ajax-hook@2.1.3/dist/ajaxhook.min.js
// @require      https://unpkg.com/qs@6.14.0/dist/qs.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jsdiff/8.0.2/diff.min.js
// @require      https://fastly.jsdelivr.net/gh/WoHal/zybuluo_syncing@0.0.1/libs/octokit.js
// @match        https://www.zybuluo.com/*
// @icon         https://www.zybuluo.com/static/img/favicon.png
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    const {com, JSZip, ah, Qs, octokit} = window
    const {Octokit} = octokit
    const btoa = com.zybuluo.common.encodeBase64
    
    function GM_setValue(key, value) {
        localStorage.setItem(key, value)
    }
    function GM_getValue(key, defaultValue) {
        return localStorage.getItem(key) || defaultValue
    }

    // 节流函数：在指定时间内只执行最后一次调用
    function throttle(func, delay) {
        let timer = null;
        let lastArgs = null;

        return function(...args) {
            lastArgs = args;

            if (!timer) {
                timer = setTimeout(() => {
                    func.apply(this, lastArgs);
                    timer = null;
                    lastArgs = null;
                }, delay);
            }
        };
    }

    // 使用节流包装syncToGithub函数，2秒内只执行最后一次
    const throttledSyncToGithub = throttle(syncToGithub, 2000);

    function autoSync() {
        ah.proxy({
            //请求发起前进入
            onRequest: (config, handler) => {
                const apiToken = GM_getValue('apiToken', '');
                if (apiToken && /note\/update/i.test(config.url)) {
                    const {title, diff_details} = Qs.parse(config.body, { depth: 5 })
                    if (diff_details) {
                        // 使用节流后的函数
                        const newContent = com.zybuluo.mdeditor.unifiedEditor.getValue()
                        throttledSyncToGithub(title, newContent);
                    }
                }
                handler.next(config);
            }
        })
    }

    async function syncToGithub(title, newContent) {
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

    function downloadAllMarkdowns() {
        var q = com.zybuluo.mdeditor.common.saveAs;
        function download(userInfo) {
            var jszip = new JSZip;
            com.zybuluo.mdeditor.syncUserNotes.exportAllLocalNotes(userInfo, function(a) {
                for (var b in a.tags) {
                    var c = jszip.folder(a.tags[b]);
                    c.file(a.title + ".md", a.details)
                }
            }, function() {
                var a = jszip.generate({
                    type: "blob"
                });
                q(a, "Cmd-Markdowns-" + (new Date).format("Y-m-d-H:i") + ".zip")
            }, function() {
                window.alert("导出本地文稿时出错，请关闭客户端/浏览器后重启程序，或者联系我们。")
            })
        }
        com.zybuluo.common.loginUser.get(userInfo => {
            download(userInfo)
        });
    }

    function createUIs() {
        // 创建同步设置悬浮按钮
        const floatingButton = document.createElement('div');
        floatingButton.innerHTML = '同步设置';
        floatingButton.style.position = 'fixed';
        floatingButton.style.bottom = '30%';
        floatingButton.style.right = '20px';
        floatingButton.style.padding = '10px 15px';
        floatingButton.style.backgroundColor = '#4CAF50';
        floatingButton.style.color = 'white';
        floatingButton.style.borderRadius = '5px';
        floatingButton.style.cursor = 'pointer';
        floatingButton.style.zIndex = '9999';
        floatingButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
        document.body.appendChild(floatingButton);

        // 创建下载所有Markdown文件的悬浮按钮
        const downloadButton = document.createElement('div');
        downloadButton.innerHTML = '下载所有MD';
        downloadButton.style.position = 'fixed';
        downloadButton.style.bottom = '14%';
        downloadButton.style.right = '20px';
        downloadButton.style.padding = '10px 15px';
        downloadButton.style.backgroundColor = '#2196F3';
        downloadButton.style.color = 'white';
        downloadButton.style.borderRadius = '5px';
        downloadButton.style.cursor = 'pointer';
        downloadButton.style.zIndex = '9999';
        downloadButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
        document.body.appendChild(downloadButton);

        // 点击下载按钮调用downloadAllMarkdowns函数
        downloadButton.addEventListener('click', () => {
            downloadAllMarkdowns();
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

    autoSync()
})();