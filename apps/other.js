import { exec } from 'child_process';
import { _paths } from '../utils/common.js';
import { getMapKey, waitMap } from '../utils/waitInput.js';

const _path = process.cwd();

export function install(app) {
  // #成就帮助
  app.register(/^#成就(帮助|help)/, help);
  // #成就插件更新
  // #成就插件强制更新
  // 主人命令
  app.register(/^#成就插件更新$/, updateWithGit, { isMaster: true });
}

// 成就帮助
export async function help(e) {
  let msg = ['成就查漏帮助：https://docs.qq.com/doc/DWmVRSnRwRldzcm13'];
  if (e.isMaster) {
    msg.push('\n主人帮助：https://docs.qq.com/doc/DWktCdVJsWmFybUpi');
  }
  e.reply(msg);
  return true;
}

let timer;

// 更新
// 代码借鉴：miao-plugin
export async function updateWithGit(e) {
  let isForce = e.msg.includes('强制');
  let command = 'git pull';
  if (isForce) {
    command = 'git checkout . && git pull';
    e.reply('正在执行强制更新操作，请稍等');
  } else {
    e.reply('正在执行更新操作，请稍等');
  }
  exec(command, { cwd: _paths.pluginsPath }, function (error, stdout, stderr) {
    //console.log(stdout);
    if (/Already up[ -]to[ -]date/.test(stdout)) {
      e.reply('目前已经是最新版了~');
      return true;
    }
    if (error) {
      e.reply('更新失败！\nError code: ' + error.code + '\n' + error.stack + '\n 请稍后重试。');
      return true;
    }
    e.reply('更新成功，尝试重新启动Yunzai以应用更新...');
    timer && clearTimeout(timer);
    redis.set('zolay:restart-msg', JSON.stringify({
      msg: '重启成功，新版成就查漏Plugin已经生效~',
      qq: e.user_id,
    }), { EX: 30 });
    timer = setTimeout(function () {
      let command = 'npm run restart';
      exec(command, function (error, stdout, stderr) {
        if (error) {
          if (/Yunzai not found/.test(error)) {
            e.reply('自动重启失败，请手动重启以应用插件。请使用 npm run start 命令启动Yunzai-Bot');
          } else {
            e.reply('重启失败！\nError code: ' + error.code + '\n' + error.stack + '\n 请稍后重试。');
          }
          return true;
        }
      });
    }, 1000);

  });
  return true;
}

export async function waitInputCheck(e, ...args) {
  for (let [mapKey, wait] of waitMap.entries()) {
    let originKey = wait.originKey;
    if (mapKey !== getMapKey(e, originKey)) {
      continue;
    }
    if (typeof wait.checkFn === 'function') {
      let flag = await wait.checkFn(e, ...args);
      if (flag) {
        clearWait(mapKey, wait);
        return true;
      }
    } else if (typeof wait.checkFn.test === 'function') {
      let flag = wait.checkFn.test(e.msg);
      if (flag) {
        clearWait(mapKey, wait);
        let res = await wait.successCb(e);
        if (res) {
          return true;
        }
      }
    }
  }
}

function clearWait(key, wait) {
  waitMap.delete(key);
  clearTimeout(wait.timer);
}
