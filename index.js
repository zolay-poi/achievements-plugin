import fs from 'fs';
import * as statisticsApp from './apps/statistics.js';
import * as importApp from './apps/import.js';
import {_paths, loadAchievements, replyAt} from './utils/common.js';

export const rule = {
  achRouter: {
    reg: '^#成就',
    priority: 100,
    describe: '成就查漏功能',
    hashMark: true
  },
  // 用于检测用户上传的图片、视频
  achImportCheck: {
    reg: '',
    priority: 0,
    describe: '成就查漏功能',
  },
};

const actions = {
  // #成就录入
  // 需要发送图片或者视频
  '录入,识别,扫描,记录': bind(importApp.achImport),
  // #成就查漏
  // 可以根据已经识别的成就生成未完成的成就列表
  '查漏,统计': bind(statisticsApp.actStatistics)
};
const actionsMap = new Map();

// 路由
export function achRouter(e, components) {
  for (const [keywords, func] of actionsMap.entries()) {
    for (const keyword of keywords) {
      if (e.msg.includes(keyword)) {
        return func(e, components, keywords);
      }
    }
  }
}

export const achImportCheck = bind(importApp.achImportCheck);

function bind(fn) {
  return function (e, components) {
    e.replyAt = (...args) => replyAt(e, ...args);
    let render = components.render;
    components.render = (...args) => render('template', ...args);
    return fn(e, components);
  };
}

function init() {
  // 初始化操作
  for (const [keywords, func] of Object.entries(actions)) {
    let keywordList = keywords.split(',').filter(k => !!k);
    if (keywordList.length > 0) {
      actionsMap.set(keywordList, func);
    }
  }
  // 初始化全成就列表
  loadAchievements(true);
  // 初始化目录
  if (!fs.existsSync(_paths.userDataPath)) {
    fs.mkdirSync(_paths.userDataPath);
  }
  console.log(`成就查漏插件初始化完成~`);
}

init();
