import {segment} from 'oicq';
import fetch from 'node-fetch';
import lodash from 'lodash';
import fs from 'fs';
import path from 'path';
import {promisify} from 'util';
import {pipeline} from 'stream';
import {browserInit} from '../../../lib/render.js';
import Data from '../../../lib/components/Data.js';

const _path = process.cwd();
// 资源目录
const resourcesPath = path.join(_path, '/resources/genshin/achievements');
// 用户已完成的成就记录保存目录
const userDataPath = path.join(_path, '/data/achievements');

export const rule = {
  achRouter: {
    reg: '^#成就',
    priority: 200,
    describe: '成就查漏功能',
  },
};

// 全成就 map
const achievementsMap = new Map();
const actionsMap = new Map();

const actions = {
  // #成就录入
  // 需要发送图片或者视频
  '录入,识别,扫描,记录': achImport,
  // #成就查漏
  // 可以根据已经识别的成就生成未完成的成就列表
  '查漏,统计': achCheck,
};

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
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath);
  }
}

init();

/**
 * 读取成就列表
 * 数据来源 https://github.com/dvaJi/genshin-data
 * @param force 强制从本地重新读取
 */
function loadAchievements(force) {
  if (force) {
    achievementsMap.clear();
  }
  if (achievementsMap.size > 0) {
    return true;
  }
  // 读取“天地万象”的成就JSON
  let json = Data.readJSON(resourcesPath, 'wonders_of_the_world.json');
  if (json && json.achievements) {
    for (const achievement of json.achievements) {
      achievementsMap.set(achievement.id, achievement);
    }
    // console.log(achievementsMap.values());
    return true;
  } else {
    return false;
  }
}


// 路由
export function achRouter(e) {
  for (const [keywords, func] of actionsMap.entries()) {
    for (const keyword of keywords) {
      if (e.msg.includes(keyword)) {
        return func(e, keywords);
      }
    }
  }
}

async function achImport(e) {
  let MysApi = await getMysApi(e);
  if (!MysApi) return true;
  let uid = MysApi.targetUid;
  if (!uid) {
    e.reply([autoAt(e), '请先绑定uid']);
    return true;
  }
  if (!e.img || e.img.length === 0) {
    e.reply([autoAt(e), '请发送图片或视频 ']);
    return true;
  }
  // if (e.img.length > 10) {
  // }
  e.reply([autoAt(e), '正在处理中，请稍等…']);
  // 保存所有图片
  const {imageList, errorCount} = await downImg(e);
  if (imageList.length === 0) {
    e.reply([autoAt(e), '图片下载失败…']);
    return true;
  }
  // 调用椰羊进行成就扫描
  let {result, dup} = await cocoGoatScanner(imageList, 'image');
  console.log({result, dup});
  // 删除临时图片
  for (let item of imageList) {
    fs.unlink(item, () => null);
  }
  let successCount = 0, failCount = 0, doneList = [];
  for (const item of result) {
    if (item.success) {
      successCount++;
      // 是否完成
      if (item.done) {
        doneList.push(item.achievement.id);
      }
    } else {
      console.log('fail', {item});
      failCount++;
    }
  }
  if (successCount === 0) {
    e.reply([autoAt(e), `没有识别到成就…`]);
    return true;
  }
  let userJsonName = `${uid}.json`;
  let userJsonFile = path.join(userDataPath, userJsonName);
  let saveData = null;
  if (fs.existsSync(userJsonFile)) {
    saveData = Data.readJSON(userDataPath, userJsonName);
  }
  if (!saveData || !Array.isArray(saveData)) {
    saveData = [];
  }
  // 新增个数，重复个数
  let saveCount = 0, dupCount = 0;
  // 去除重复的
  for (const item of doneList) {
    if (saveData.includes(item)) {
      dupCount++;
    } else {
      saveCount++;
      saveData.push(item);
    }
  }
  // Data.writeJson(userDataPath, userJsonName , saveData, '');
  fs.writeFileSync(userJsonFile, JSON.stringify(saveData));
  e.reply([autoAt(e), `本次成功识别了${successCount}个成就，新增记录了${saveCount}个成就。\n你可发送“#成就统计”来查看你尚未完成的成就。`]);
  return true;
}

async function achCheck() {

  let userJsonName = `${e.user_id}.json`;
  let userJsonFile = path.join(userDataPath, userJsonName);
  let saveData = null;
  if (fs.existsSync(userJsonFile)) {
    saveData = Data.readJSON(userDataPath, userJsonName);
  }


  return true;
}

/** 对接椰羊的成就扫描 */
async function cocoGoatScanner(imageList, type) {
  return new Promise(async (resolve, reject) => {
    let browser = await browserInit();
    if (!browser) {
      reject('puppeteer启动失败……');
      return;
    }
    let page = await browser.newPage();
    await page.goto('file:///' + path.join(resourcesPath, 'import.html'));
    // 通过 console 来实现与页面的通讯
    page.on('console', async message => {
      // 约定的协议
      if (message && message.args().length === 2) {
        let [key, data] = message.args();
        if ((await key.jsonValue()) === 'YUNZAI_CONSOLE_EXCHANGE') {
          let json = await data.jsonValue();
          if (json) {
            let {event, data} = json;
            if (event === 'load') {
              // 椰羊加载完成，开始上传图片
              if (data === true) {
                let frame = page.frames()[1];
                // 获取 fileInput
                const inputEl = await frame.waitForSelector('#toki > div > div > div > div.top > div > input');
                // uploadFile 上传图片
                await inputEl.uploadFile(...imageList);
                await frame.waitForTimeout(1000);
                // 获取“识别”按钮并点击
                const btnEl = await frame.waitForSelector('#toki > div > div > div > div.top > button');
                await btnEl.click();
              }
            } else if (event === 'progress') {
              // 扫描进度
            } else if (event === 'result') {
              // 扫描结果
              resolve(data);
              await page.close();
            } else {
              // console.group(`--- 椰羊 ---`);
              // console.log(json);
              // console.groupEnd();
            }
          }
        }
      }
    });
    // 监听椰羊发送的消息
    await page.evaluate(() => {
      window.addEventListener('message', (ev) => {
        if (ev.data.app !== 'cocogoat.scanner.achievement') return;
        console.log('YUNZAI_CONSOLE_EXCHANGE', ev.data);
      });
    });
  });
  return;
  // let type = 'test-ahh', imgType = 'jpeg', base64;
  try {
    //图片渲染
    const page = await browser.newPage();
    await page.goto('file://E:/SyncDirectory/Project/IT/GenshinBot/Yunzai-Bot/data/html/help/help/help.html');
    // page.on("message", function(e) {
    //   console.log(e)
    // });
    // page.mainFrame().
    // console.log(page.frames());

    // let es = await
    //   page.evaluate((x)=>'window.ohh = (e)=>console.log("inner log:", e)',(e)=>{
    //     console.log('eval ---: ',e)
    //   })

    const aHandle = await page.evaluateHandle('window'); // 'document'对象
    // preload.js

// 重写 `languages` 属性，使其用一个新的get方法
    let preload = `Object.defineProperty(navigator, "languages", {
      get: function() {
        return ["en-US", "en", "bn"];
      }
    });`;

// 假设 preload.js 和当前的代码在同一个目录
//     await page.evaluateOnNewDocument(`window.ohh = function (e) { console.log(1111, e) }`);

    let yyInit = '001';
    page.on('console', async msg => {
      console.log(msg.text());
      if (msg.text().includes('椰羊加载完成')) {
        for (let i = 0; i < msg.args().length; ++i) {
          let arg = msg.args()[i];
          console.group(`---- ${i}:`, arg.toString());
          console.log(await arg.jsonValue());
          console.groupEnd();
        }
        yyInit = await msg.args()[2].jsonValue();

        console.log('------ frame', 1);

        let frame = page.frames()[1];
        // uploadFile上传图片
        const inputEl = await frame.waitForSelector('#toki > div > div > div > div.top > div > input');
        //上传图片目录自定义
        // await inputEl.uploadFile([
        //   "E:\\AppData\\System\\Downloads\\2408-1536.png",
        //   "E:\\AppData\\System\\Downloads\\aeqsfsynrm191.png",
        // ]);
        await inputEl.uploadFile(
          // "E:\\AppData\\System\\Downloads\\2408-1536.png",
          'E:\\AppData\\System\\Downloads\\233.png',
        );
        await frame.waitForTimeout(1000);
        const btnEl = await frame.waitForSelector('#toki > div > div > div > div.top > button');
        await btnEl.click();

        console.log('------ frame', 2);
      }
    });

    await page.exposeFunction('ohh', text =>
      console.log(yyInit, 'exposeFunction', text),
    );
    await page.evaluate(async () => {
      let yyInit = false;
      window.addEventListener('message', (ev) => {
        const {app, event, data} = ev.data;
        if (app !== 'cocogoat.scanner.achievement') return;
        if (event === 'load' && data === true) {
          console.log('preload 椰羊加载完成', '007', {a: 1});
          // window.ohh(1);
          yyInit = true;
        }
        // if (yyInit) {
        //   console.log(1, `cocogoat.data: `, JSON.stringify({event, data}));
        //
        // }
      });
    });


    console.log('--- browser', 1);
    // const preloadFile = fs.readFileSync('./preload.js', 'utf8');
    // await page.evaluateOnNewDocument(preloadFile);


    let es = await page.$eval('#container', el => {

      let res = el.ownerDocument.body.className;
      return res;
    });
    console.log('--- browser', 2);
    console.log(1, es);

    // let body =  await page.$("body")
    // console.log(body.asElement());

    //
    //   return;
    //   // let body = await page.$("#container");
    //   let randData = {
    //     type: imgType,
    //     encoding: "base64",
    //   };
    //   if (imgType === "jpeg") {
    //     randData.quality = 100;
    //   }
    //   base64 = await body.screenshot(randData);
    //   if (!global.debugView) {
    //     page.close().catch((err) => Bot.logger.error(err));
    //   }
    // } catch (error) {
    //   Bot.logger.error(`图片生成失败:${type}:${error}`);
    //   //重启浏览器
    //   if (browser) {
    //     await browser.close().catch((err) => Bot.logger.error(err));
    //   }
    //   browser = "";
    //   base64 = "";
    //   return false;
    // }
    //
    // if (!base64) {
    //   Bot.logger.error(`图片生成为空:${type}`);
    //   return false;
    // }
    //
    // // renderNum++;
    //
    // fs.writeFileSync("E:/ahh.txt", "base64://" + base64);
    //


  } catch {
  }
}

/*
* 统一调用 e.getMysApi
* */
async function getMysApi(e) {
  return await e.getMysApi({
    auth: 'all',
    targetType: 'self',
    cookieType: 'all',
  });
}

/**
 * 动态at，只有在群聊里才at人
 */
function autoAt(e, ellipsis = true) {
  if (e.isGroup) {
    let name = e.sender.card;
    if (ellipsis) {
      name = lodash.truncate(name, {length: 8});
    }
    return segment.at(e.user_id, name);
  }
  return '';
}

function getSavePath(tempPath) {
  let savePath = path.join(userDataPath, tempPath.toString());
  if (!fs.existsSync(savePath)) {
    Data.createDir(userDataPath, tempPath.toString());
  }
  return savePath;
}

// 下载所有成就图片
async function downImg(e) {
  let savePath = getSavePath('/.temp/' + e.user_id);
  let imageList = [];
  let errorCount = 0;
  for (let url of e.img) {
    let response = await fetch(url);
    if (!response.ok) {
      errorCount++;
      continue;
    }
    let streamPipeline = promisify(pipeline);
    let imgName = randomString(18) + '.jpg';
    let imgPath = path.join(savePath, imgName);
    await streamPipeline(response.body, fs.createWriteStream(imgPath));
    imageList.push(imgPath);
  }
  return {imageList, errorCount};
}

/**获取任意长度的随机数字字母组合字符串*/
function randomString(length) {
  const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return lodash.sampleSize(charSet, length).join('');
}
