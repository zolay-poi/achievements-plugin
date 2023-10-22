import path from 'path'
import {_paths, settings} from './utils/common.js'

// 支持锅巴
export function supportGuoba() {
  return {
    // 插件信息，将会显示在前端页面
    // 如果你的插件没有在插件库里，那么需要填上补充信息
    // 如果存在的话，那么填不填就无所谓了，填了就以你的信息为准
    pluginInfo: {
      name: 'achievements-plugin',
      title: '成就插件',
      author: '@zolay-poi',
      authorLink: 'https://github.com/zolay-poi',
      link: 'https://github.com/zolay-poi/achievements-plugin',
      isV2: true, isV3: true,
      description: '提供成就查漏、成就查询等功能',
      // 显示图标，此为个性化配置
      // 图标可在 https://icon-sets.iconify.design 这里进行搜索
      icon: 'ph:balloon-duotone',
      // 图标颜色，例：#FF0000 或 rgb(255, 0, 0)
      iconColor: '#1769aa',
      // 如果想要显示成图片，也可以填写图标路径（绝对路径）
      iconPath: path.join(_paths.resourcesPath, 'images/icon.png'),
    },
    // 配置项信息
    configInfo: {
      // 配置项 schemas
      schemas: [
        {
          field: 'importMethod.cocoGoat',
          label: '启用椰羊',
          bottomHelpMessage: '是否可以从椰羊导入成就数据（推荐开启）',
          // 组件类型，可参考 https://vvbin.cn/doc-next/components/introduction.html
          component: 'Switch',
        },
        {
          field: 'importMethod.image',
          label: '启用截图',
          bottomHelpMessage: '是否可以通过识别截图导入成就数据（服务器性能不高不建议开）',
          component: 'Switch',
        },
        {
          field: 'importMethod.video',
          label: '启用录屏',
          bottomHelpMessage: '是否可以通过识别录屏导入成就数据（服务器性能不高不建议开）',
          component: 'Switch',
        },
        {
          field: 'importMethod.input',
          label: '启用手动录入',
          bottomHelpMessage: '是否可以通过手动录入成就ID的方法录入成就（推荐开启）',
          component: 'Switch',
        },
        {
          field: 'system.enableProxy',
          label: '启用代理',
          helpMessage:'具体代理地址请去本体的 bot.yaml 中设置 proxyAddress',
          bottomHelpMessage: '当文件访问失败时，可开启代理',
          component: 'Switch',
        },
      ],
      // 获取配置数据方法（用于前端填充显示数据）
      getConfigData() {
        return settings.$source
      },
      // 设置配置的方法（前端点确定后调用的方法）
      setConfigData(data, {Result}) {
        for (let [keyPath, value] of Object.entries(data)) {
          settings.set(keyPath, value)
        }
        settings.save()
        return Result.ok({}, '保存成功~')
      },
    },
  }
}
