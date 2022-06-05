import fs from 'fs';
import path from 'path';
import lodash from 'lodash';
import {segment} from 'oicq';
import fetch from 'node-fetch';
import {promisify} from 'util';
import {pipeline} from 'stream';
import Data from '../../../lib/components/Data.js';
import {browserInit} from '../../../lib/render.js';

const pluginName = 'achievements-plugin';
const _path = process.cwd();
// 插件目录
const pluginsPath = path.join(_path, 'plugins', pluginName);
// 资源目录
const resourcesPath = path.join(pluginsPath, 'resources');
// 模板目录
const templatePath = path.join(resourcesPath, 'template');
// 用户已完成的成就记录保存目录
const userDataPath = path.join(_path, 'data', pluginName);

export const _paths = {
  rootPath: _path,
  pluginsPath,
  resourcesPath,
  templatePath,
  userDataPath,
};

export const _type = {
  IMAGE: 'image',
  VIDEO: 'video',
};

// 全成就 map
export const achievementsMap = new Map();

/**
 * 读取成就列表
 * 数据来源 https://github.com/dvaJi/genshin-data
 * @param force 强制从本地重新读取
 */
export function loadAchievements(force) {
  if (force) {
    achievementsMap.clear();
  }
  if (achievementsMap.size > 0) {
    return true;
  }
  // 读取“天地万象”的成就JSON
  let json = Data.readJSON(resourcesPath, 'achievements/wonders_of_the_world.json');
  if (json && json.achievements) {
    for (const achievement of json.achievements) {
      // 查找是否有系列成就
      findNextStage(achievement, json.achievements);
      achievementsMap.set(achievement.id, achievement);
    }
    // console.log(achievementsMap.values());
    return true;
  } else {
    return false;
  }
}

function findNextStage(achievement, achievements) {
  for (const next of achievements) {
    if (next.preStage === achievement.id) {
      achievement.nextStage = next.id;
      break;
    }
  }
}

/** 自动判断是否需要艾特（只有群聊里才艾特） */
export function replyAt(e, msg, quote) {
  let message = [autoAt(e)];
  if (Array.isArray(msg)) {
    message = message.concat(msg);
  } else {
    message.push(msg);
  }
  return e.reply(message, quote);
}

/**
 * 动态at，只有在群聊里才at人
 */
export function autoAt(e, ellipsis = true) {
  if (e.isGroup) {
    let name = e.sender.card;
    if (ellipsis) {
      name = lodash.truncate(name, {length: 8});
    }
    return segment.at(e.user_id, name);
  }
  return '';
}

/*
* 统一调用 e.getMysApi
* */
export async function getMysApi(e) {
  return await e.getMysApi({
    auth: 'all',
    targetType: 'self',
    cookieType: 'all',
  });
}

export async function downloadFiles(e, urls, suffix) {
  let tempPath = '/.temp/' + e.user_id;
  let savePath = path.join(_paths.userDataPath, tempPath.toString());
  if (!fs.existsSync(savePath)) {
    Data.createDir(_paths.userDataPath, tempPath.toString());
  }
  let filePaths = [];
  let errorCount = 0;
  for (let url of urls) {
    let response = await fetch(url);
    if (!response.ok) {
      errorCount++;
      continue;
    }
    let streamPipeline = promisify(pipeline);
    let fileName = randomString(18) + suffix;
    let filePath = path.join(savePath, fileName);
    await streamPipeline(response.body, fs.createWriteStream(filePath));
    filePaths.push(filePath);
  }
  return {filePaths, errorCount};
}

/**获取任意长度的随机数字字母组合字符串*/
export function randomString(length) {
  const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return lodash.sampleSize(charSet, length).join('');
}

export {
  Data,
  browserInit
};