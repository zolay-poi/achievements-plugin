import {segment} from 'oicq';
import fs from 'fs';
import path from 'path';
import {browserInit} from '../../../lib/render.js';
import Data from '../../../lib/components/Data.js';
import {_paths, getMysApi, downloadFiles, achievementsMap, _type} from '../utils/common.js';

let userTimer = {};

export async function achImport(e) {
  let MysApi = await getMysApi(e);
  if (!MysApi) return true;
  let uid = MysApi.targetUid;
  if (!uid) {
    e.replyAt('请先绑定uid');
    return true;
  }
  if (!e.img || e.img.length === 0) {
    e.replyAt('请发送成就截图或录屏文件');
    if (userTimer[e.user_id]) {
      clearTimeout(userTimer[e.user_id]);
    }
    userTimer[e.user_id] = setTimeout(() => {
      if (userTimer[e.user_id]) {
        delete userTimer[e.user_id];
        e.replyAt('成就录入已取消');
      }
    }, 60000);
    return true;
  }
  if (e.img.length > 12) {
    e.replyAt('一次性最多发送12张图片…');
    return true;
  }
  return downloadAndScanner(e, e.img, _type.IMAGE, MysApi);
}

/** 递归 push 系列成就 */
function pushSeries({id, preStage}, doneList) {
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
  if (!userTimer[e.user_id]) return;
  clearTimeout(userTimer[e.user_id]);
  delete userTimer[e.user_id];
  let MysApi = await getMysApi(e);
  if (!MysApi) return true;
  let uid = MysApi.targetUid;
  if (!uid) {
    e.replyAt('请先绑定uid');
    return true;
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
  if (!e.img && !file && !video) {
    e.replyAt('发送的内容不是图片或视频，成就录入已取消');
    return true;
  }
  if (file) {
    let isImage = /\.(jpg|png|jpeg)$/.test(file.name);
    let isVideo = /\.(mp4)$/.test(file.name);
    if (!isImage && !isVideo) {
      e.replyAt('发送的文件不是静态图片或mp4格式的视频，成就录入已取消');
      return true;
    }
    let url;
    if (e.isGroup) {
      url = await e.group.getFileUrl(file.fid);
    } else {
      url = await e.friend.getFileUrl(file.fid);
    }
    let type = isImage ? _type.IMAGE : _type.VIDEO;
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
    return downloadAndScanner(e, [url], _type.VIDEO, MysApi);
  } else {
    if (e.img.length > 12) {
      e.replyAt('一次性最多发送12张图片…');
      return true;
    }
    return downloadAndScanner(e, e.img, _type.IMAGE, MysApi);
  }
}

/** 下载文件并识别 */
async function downloadAndScanner(e, urls, type, MysApi) {
  let uid = MysApi.targetUid;
  if (type === _type.VIDEO) {
    e.replyAt('正在处理中，请稍等…\n录屏识别为未经完全验证的测试功能，识别错误率可能较高，请仔细核对确认或等待完善。');
  } else {
    e.replyAt('正在处理中，请稍等…');
  }
  let suffix = type === _type.IMAGE ? '.jpg' : '.mp4';
  // 保存所有文件
  const {filePaths, errorCount} = await downloadFiles(e, urls, suffix);
  if (filePaths.length === 0) {
    e.replyAt(`${type === _type.IMAGE ? '图片' : '视频'}下载失败…`);
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
  }
  // console.log({result, dup});
  // 删除临时文件
  filePaths.forEach((file) => fs.unlink(file, () => 0));
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
  let userJsonFile = path.join(_paths.userDataPath, userJsonName);
  let saveData = null;
  if (fs.existsSync(userJsonFile)) {
    saveData = Data.readJSON(_paths.userDataPath, userJsonName);
  }
  if (!saveData || !saveData.wonders_of_the_world) {
    saveData = {wonders_of_the_world: []};
  }
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
  // Data.writeJson(userDataPath, userJsonName , saveData, '');
  fs.writeFileSync(userJsonFile, JSON.stringify(saveData));
  e.replyAt(`本次成功识别了${successCount}个成就，新增记录了${saveCount}个成就。\n你可发送“#成就统计”来查看你尚未完成的成就。`);
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
        } else {
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
            let {event, data} = json;
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
                  if (type === _type.VIDEO) {
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
