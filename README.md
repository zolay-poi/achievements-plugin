# 成就查漏功能说明

`achievements-plugin`是`Yunzai-Bot`的扩展插件，提供成就查漏功能。

具体功能可在安装插件后，通过发送`#成就帮助`来进行查看。

## 已实现的功能

1. 成就录入
    - [x] 图片集成就扫描
    - [x] 录屏成就扫描
        - 功能已实现，但默认不支持，需要安装完整chrome才能使用。
    - [x] 从椰羊导入JSON
2. 成就查漏
    - 仅支持天地万象，根据已录入的成就，对比数据库给出未完成的成就列表）

## 安装与更新

直接将`achievements-plugin`放置在`Yunzai-Bot`的`plugins`目录下，重启`Yunzai-Bot`后即可使用。

推荐使用git进行安装，以方便后续升级。在BOT根目录下的plugins下打开终端，运行

```
git clone https://gitee.com/zolay-poi/achievements-plugin.git ./plugins/achievements-plugin/
```

进行安装。如需更新，在BOT文件夹打开终端，运行

```
git -C ./plugins/achievements-plugin/ pull
```

# 免责声明

1. 功能仅限内部交流与小范围使用，严禁将Yunzai-Bot及Achievements-Plugin用于任何商业用途或盈利
2. 图片与其他素材均来自于网络，仅供交流学习使用，如有侵权请联系，会立即删除

# 其他

* Yunzai-Bot
   - [gitee](https://gitee.com/Le-niao/Yunzai-Bot)
   - [github](https://github.com/Le-niao/Yunzai-Bot)
* Miao-Plugin
   - [gitee](https://github.com/yoimiya-kokomi/miao-plugin)
   - [github](https://github.com/yoimiya-kokomi/miao-plugin)

## 功能依赖

该插件的运行离不开以下开源软件

1. 椰羊（cocogoat）
    - 用于实现成就扫描功能
    - 项目地址：<https://github.com/YuehaiTeam/cocogoat>
2. GenshinData
    - 全成就列表的数据来源
    - 项目地址：<https://github.com/dvaJi/genshin-data>
