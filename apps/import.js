import fs from 'fs';
import path from 'path';
import moment from 'moment';
import { segment } from 'oicq';
import { browserInit } from '../../../lib/render.js';
import Data from '../../../lib/components/Data.js';
import { _paths, settings, readUserJson, getMysApi, downloadFiles, achievementsMap, _method } from '../utils/common.js';
import { waitInputAt } from '../utils/waitInput.js';

export function install(app) {
  // #成就录入
  app.register(/^#成就(录入|识别|扫描|记录)/, achImport);
}

export async function achImport(e) {
  let enabled = settings.importMethod.enabled
  if (enabled.length === 0) {
    e.replyAt('成就录入功能已被完全禁用……');
    return true;
  }
  let MysApi = await getMysApi(e);
  if (!MysApi) return true;
  let uid = MysApi.targetUid;
  if (!uid) {
    e.replyAt('请先绑定uid');
    return true;
  }
  // 消息中携带图片
  if (e.img && e.img.length > 0) {
    return downloadAndScanner(e, e.img, _method.IMAGE, MysApi);
  }
  // 消息中携带成就ID
  let ids = getAchIds(e);
  if (ids.length > 0) {
    return importOfIds(e, ids, uid);
  }
  let texts = enabled.map(e => e.humanText)
  // 什么都不携带，发送指南
  waitInputAt(e, {
    key: `ach-import-${e.user_id}`,
    message: `请发送“${texts.splice(0, texts.length - 1).join('”、“')}”或“${texts.pop()}”`,
    timeout: 60000,
    checkFn: achImportCheck,
    timeoutCb: () => e.replyAt('成就录入已取消'),
  })
  return true;
}

/** 递归 push 系列成就 */
function pushSeries({ id, preStage }, doneList) {
  if (preStage != null) {
    doneList.push({
      id: preStage,
      nextStage: id,
      isPush: true,
    });
    let achItem = achievementsMap.get(preStage);
    pushSeries(achItem, doneList);
  }
}

export async function achImportCheck(e) {
  let MysApi = await getMysApi(e);
  if (!MysApi) return true;
  let uid = MysApi.targetUid;
  if (!uid) {
    e.replyAt('请先绑定uid');
    return true;
  }
  // 消息中携带成就ID
  let ids = getAchIds(e);
  if (ids.length > 0) {
    return importOfIds(e, ids, uid);
  }
  let file, video;
  for (let msg of e.message) {
    if (msg.type === 'video') {
      video = msg;
      break;
    }
    if (msg.type === 'file') {
      file = msg;
      break;
    }
  }
  if (!e.img && !file && !video && !ids.length) {
    let texts = settings.importMethod.enabled.map(e => e.humanText)
    let need = `请发送“${texts.splice(0, texts.length - 1).join('”、“')}”或“${texts.pop()}”`;
    e.replyAt(`成就录入已取消：发送的内容不合法！\n${need}\n也可发送“#成就帮助”来查看功能帮助。`);
    return true;
  }
  if (file) {
    let isImage = /\.(jpg|png|jpeg)$/.test(file.name);
    let isVideo = /\.(mp4)$/.test(file.name);
    let isJson = /\.(json)$/.test(file.name);
    if (!isImage && !isVideo && !isJson) {
      e.replyAt('发送的文件不是静态图片或mp4格式的视频或椰羊JSON，成就录入已取消');
      return true;
    }
    let url;
    if (e.isGroup) {
      url = await e.group.getFileUrl(file.fid);
    } else {
      url = await e.friend.getFileUrl(file.fid);
    }
    // 从JSON导入成就
    if (isJson) {
      return importOfJson(e, url, MysApi);
    }
    let type = isImage ? _method.IMAGE : _method.VIDEO;
    return downloadAndScanner(e, [url], type, MysApi);
  } else if (video) {
    if (!/\.(mp4)$/.test(video.name)) {
      e.replyAt('发送的不是mp4格式的视频，成就录入已取消');
      return true;
    }
    let url;
    if (e.isGroup) {
      url = await e.group.getVideoUrl(video.fid, video.md5);
    } else {
      url = await e.friend.getVideoUrl(video.fid, video.md5);
    }
    return downloadAndScanner(e, [url], _method.VIDEO, MysApi);
  } else {
    return downloadAndScanner(e, e.img, _method.IMAGE, MysApi);
  }
}

/** 获取消息中的成就ID */
function getAchIds(e) {
  let match = (e.msg || '').match(/(\d{5}([,，、 ]\d{5})*)/);
  if (match && match.length >= 1) {
    let ids = match[1];
    if (ids) {
      return ids.split(/[,，、 ]/).map(id => parseInt(id));
    }
  }
  return [];
}

/** 下载文件并识别 */
async function downloadAndScanner(e, urls, type, MysApi) {
  let uid = MysApi.targetUid;
  if (type === _method.VIDEO) {
    if (!settings.importMethod.check(_method.VIDEO)) {
      e.replyAt('录屏成就录入已被禁用');
      return true;
    }
    e.replyAt('正在处理中，请稍等…\n录屏识别为未经完全验证的测试功能，识别错误率可能较高，请仔细核对确认或等待完善。');
  } else {
    if (!settings.importMethod.check(_method.IMAGE)) {
      e.replyAt('截图成就录入已被禁用');
      return true;
    }
    if (urls.length > 12) {
      e.replyAt('一次性最多发送12张图片…');
      return true;
    }
    e.replyAt('正在处理中，请稍等…');
  }
  let suffix = type === _method.IMAGE ? '.jpg' : '.mp4';
  // 保存所有文件
  const { filePaths, errorCount } = await downloadFiles(e, urls, suffix);
  if (filePaths.length === 0) {
    e.replyAt(`${type === _method.IMAGE ? '图片' : '视频'}下载失败…`);
    return true;
  }
  // 调用椰羊进行成就扫描
  let result;
  try {
    // {result, dup}
    let results = await cocoGoatScanner(filePaths, type, e);
    result = results.result;
  } catch (err) {
    console.error(err)
    e.replyAt(`${err.message || err}`);
    return true;
  } finally {
    // 删除临时文件
    filePaths.forEach((file) => fs.unlink(file, () => 0));
  }
  let successCount = 0, failCount = 0, doneList = [];
  for (const item of result) {
    if (item.success) {
      successCount++;
      // 是否完成
      if (item.done) {
        let achItem = {
          id: item.achievement.id,
          date: item.date,
          status: item.status,
        };
        // 是否是系列成就
        if (item.achievement.preStage) {
          achItem.preStage = item.achievement.preStage;
          pushSeries(achItem, doneList);
        }
        doneList.push(achItem);
      }
    } else {
      // console.log('fail', {item});
      failCount++;
    }
  }
  if (successCount === 0) {
    e.replyAt('没有识别到成就…');
    return true;
  }
  let userJsonName = `${uid}.json`;
  let { saveData, writeUserJson } = readUserJson(userJsonName);
  // 目前仅支持【天地万象】
  let saveDoneList = saveData.wonders_of_the_world;
  // 新增个数，重复个数
  let saveCount = 0, dupCount = 0;
  // 去除重复的
  for (const achItem of doneList) {
    if (saveDoneList.findIndex(i => i.id === achItem.id) !== -1) {
      dupCount++;
    } else {
      saveCount++;
      saveDoneList.push(achItem);
    }
  }
  writeUserJson();
  e.replyAt(`本次成功识别了${successCount}个成就，新增记录了${saveCount}个成就。\n你可发送“#成就查漏”来查看你尚未完成的成就。`);
  return true;
}

/** 手动录入成就ids */
async function importOfIds(e, ids, uid) {
  if (!settings.importMethod.check(_method.INPUT)) {
    e.replyAt('手动录入成就已被禁用');
    return true;
  }
  let userJsonName = `${uid}.json`;
  let { saveData, writeUserJson } = readUserJson(userJsonName);
  let saveDoneList = saveData.wonders_of_the_world;

  // achievementsMap
  let inputAchList = ids.map(id => achievementsMap.get(id)).filter(i => i != null);
  if (inputAchList.length === 0) {
    e.replyAt('录入失败：输入的成就id不存在…\n你可发送“#成就帮助”来查看功能说明。');
    return true;
  }
  // 新增个数，重复个数
  let saveCount = [], dupCount = 0;
  let date = moment().format('YYYY/MM/DD');
  for (const achItem of inputAchList) {
    if (saveDoneList.findIndex(i => i.id === achItem.id) !== -1) {
      dupCount++;
    } else {
      saveCount.push(achItem);
      saveDoneList.push({
        id: achItem.id,
        date: date,
        status: '手动勾选',
      });
    }
  }
  writeUserJson();
  let message = [`成功识别了${inputAchList.length}个成就，新增记录了${saveCount.length}个成就。`];
  for (let i = 0; i < saveCount.length; i++) {
    const achItem = saveCount[i];
    message.push(`· ${achItem.name}（${achItem.id}）`);
  }
  message.push(`你可发送“#成就查漏”来查看你尚未完成的成就。`);
  e.replyAt(message.join('\n'));
  return true;
}

/** 从JSON导入成就 */
async function importOfJson(e, url, MysApi) {
  let uid = MysApi.targetUid;
  // 下载JSON文件
  const { filePaths } = await downloadFiles(e, [url], '.json');
  if (filePaths.length === 0) {
    e.replyAt(`文件下载失败…`);
    return true;
  }
  let json = Data.readJSON(path.dirname(filePaths[0]), path.basename(filePaths[0]));
  // 判断JSON类型
  if (!json) {
    e.replyAt(`发送的JSON文件为空…`);
    return true;
  }
  let isCocoGoat = json.source === '椰羊成就';
  // 待支持
  let isUIAF = json.info && json.list;
  if (isCocoGoat) {
    return await importOfCocoGoatJson(e, json, uid);
  } else if (isUIAF) {
    e.replyAt(`UIAF格式的JSON文件尚未支持…`);
    return true;
  } else {
    e.replyAt(`发送的不是椰羊JSON文件…`);
    return true;
  }
}

/** 从椰羊JSON导入 */
async function importOfCocoGoatJson(e, json, uid) {
  if (!settings.importMethod.check(_method.COCO_GOAT)) {
    e.replyAt('从椰羊导入成就已被禁用');
    return true;
  }
  let userJsonName = `${uid}.json`;
  let { saveData, writeUserJson } = readUserJson(userJsonName);
  let saveDoneList = saveData.wonders_of_the_world;
  // 新增个数，重复个数
  let saveCount = 0, dupCount = 0;
  // 去除重复的
  let doneList = (json.value || {}).achievements || [];
  for (const achItem of doneList) {
    // 0 = 天地万象
    if (achItem.categoryId !== 0) continue;
    // status为空也视为未完成的成就
    if (!achItem.status) continue;
    if (saveDoneList.findIndex(i => i.id === achItem.id) !== -1) {
      dupCount++;
    } else {
      saveCount++;
      saveDoneList.push({
        id: achItem.id,
        date: achItem.date,
        status: achItem.status,
      });
    }
  }
  writeUserJson();
  e.replyAt(`成功从椰羊识别到${doneList.length}个成就。\n「天地万象」中新增记录了${saveCount}个成就。\n你可发送“#成就查漏”来查看你尚未完成的成就。`);
  return true;
}

/** 对接椰羊的成就扫描 */
async function cocoGoatScanner(fileList, type, e) {
  return new Promise(async (resolve, reject) => {
    let browser = await browserInit();
    if (!browser) {
      reject('puppeteer启动失败……');
      return;
    }
    let page = await browser.newPage();
    await page.goto('file:///' + path.join(_paths.templatePath, `import_${type}.html`));
    // 监听椰羊发送的消息
    await page.evaluate(() => {
      window.addEventListener('message', (ev) => {
        if (ev && ev.data && ev.data.app === 'cocogoat.scanner.achievement') {
          console.log('YUNZAI_CONSOLE_EXCHANGE', ev.data);
        }
      });
    });
    let progressTimer
    let timeout = setTimeout(() => {
      reject('椰羊启动超时，请稍后重试……');
      page.close();
    }, 15000);
    // 监听页面的console，实现与页面的通讯
    page.on('console', async message => {
      // 约定的协议：
      // 1、console传的参数必须为2个
      // 2、第一个参数为标识，目前固定为 YUNZAI_CONSOLE_EXCHANGE
      // 3、第二个参数为携带的数据
      if (message && message.args().length === 2) {
        let [key, payload] = message.args();
        key = await key.jsonValue();
        if (key === 'YUNZAI_CONSOLE_EXCHANGE') {
          let json = await payload.jsonValue();
          if (json) {
            let { event, data } = json;
            if (event === 'load') {
              // 椰羊加载完成，开始上传文件
              if (data === true) {
                clearInterval(timeout);
                let frame = page.frames()[1];

                // // --- debug ---
                // let body = await frame.$('body');
                // await frame.waitForTimeout(3000);
                // base64 = await body.screenshot({type: 'jpeg', encoding: 'base64',});
                // if (base64) {
                //   e.reply(['001', segment.image(`base64://${base64}`)]);
                // }

                // 获取 fileInput
                const inputEl = await frame.waitForSelector('#toki div.top input');
                // uploadFile 上传图片
                await inputEl.uploadFile(...fileList);
                await frame.waitForTimeout(1000);

                // // --- debug ---
                // await frame.waitForTimeout(3000);
                // base64 = await body.screenshot({type: 'jpeg', encoding: 'base64',});
                // if (base64) {
                //   e.reply(['002', segment.image(`base64://${base64}`)]);
                // }

                // 获取“识别”按钮并点击
                const btnEl = await frame.waitForSelector('#toki div.top button');
                await btnEl.click();

                // // --- debug ---
                // await frame.waitForTimeout(3000);
                // base64 = await body.screenshot({type: 'jpeg', encoding: 'base64',});
                // if (base64) {
                //   e.reply(['003', segment.image(`base64://${base64}`)]);
                // }

                // 进度超时
                progressTimer = setTimeout(() => {
                  if (type === _method.VIDEO) {
                    reject('扫描超时，你可能使用了不完整的chrome，导致录屏扫描功能不可用，请发送“#成就帮助”来获取帮助。');
                  } else {
                    reject('扫描超时，请稍后重试……');
                  }
                  page.close();
                }, 12000);
              } else if (data === false) {
                clearInterval(timeout);
                page.close();
                reject('椰羊加载失败，请稍后重试……');
              }
            } else if (event === 'progress') {
              // 扫描进度
              clearTimeout(progressTimer);
            } else if (event === 'result') {
              page.close();
              // 扫描结果
              resolve(data);
            } else {
              // console.group(`--- 椰羊 ---`);
              // console.log(json);
              // console.groupEnd();
            }
          }
        }
      }
    });

  });
}
