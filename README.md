# GitHub项目同步工具

这是一个Tampermonkey脚本，用于在作业部落(zybuluo.com)网站中添加悬浮按钮，方便设置GitHub项目地址和API Token，并自动将笔记同步到GitHub仓库。

## 功能

- 在网页中添加悬浮按钮
- 点击设置按钮弹出设置对话框
- 可以设置GitHub项目地址、分支名称和API Token
- 本地保存设置信息
- 自动监听笔记更新，并同步到GitHub
- 支持创建新文件和更新现有文件
- 使用节流技术，在短时间内多次更新时只提交最后一次更改
- 提供下载所有Markdown文件的悬浮按钮

## 安装步骤

1. 首先确保你的浏览器已安装Tampermonkey扩展
   - Chrome: [Tampermonkey](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - Firefox: [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)

2. 安装脚本
   - 打开Tampermonkey扩展
   - 点击"添加新脚本"
   - 将`src/tampermonkey-script.js`中的内容复制粘贴到编辑器中
   - 保存脚本

## 使用方法

1. 访问作业部落(zybuluo.com)网站，右下角会出现"同步设置"和"下载所有MD"按钮
2. 点击"同步设置"按钮，弹出设置对话框
3. 填写GitHub项目地址、分支名称（默认为main）和API Token
4. 点击"保存设置"按钮保存信息
5. 设置完成后，当你在作业部落编辑并保存笔记时，脚本会自动将更改同步到GitHub仓库
   - 如果GitHub仓库中已存在同名文件，会使用差异补丁更新文件
   - 如果文件不存在，会创建新文件
6. 如需下载所有Markdown文件，点击"下载所有MD"按钮，系统会将所有笔记打包成zip文件并下载

## 注意事项

- API Token会以加密形式存储在本地
- 脚本仅在作业部落(zybuluo.com)网站上运行
- GitHub API Token需要有repo权限，以便能够读取和写入仓库内容
- 同步时使用的文件名为笔记标题加.md后缀
- 确保GitHub仓库中的文件编码为UTF-8，以避免编码问题
- 如果不设置分支名称，默认使用main分支
- 确保指定的分支在GitHub仓库中已存在
- 脚本使用2秒的节流时间，如果在2秒内多次保存笔记，只会将最后一次更改同步到GitHub