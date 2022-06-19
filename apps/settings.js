import {_version, settings} from "../utils/common.js";

const regexp1 = /^#成就配置$/;
const regexp2 = /^#成就配置录入(启用|禁用)(.+)$/;

export async function settingsRouter(e) {
  if (regexp1.test(e.msg)) {
    return getSettings(e);
  }
  if (regexp2.test(e.msg)) {
    return updateImportMethod(e);
  }
}

function getSettings(e) {
  let msg = [];
  msg.push(`欢迎使用成绩查漏插件${_version}\n`);
  msg.push("当前配置如下：");
  msg.push("- 成就录入方式：");
  for (const [key, value] of Object.entries(settings.importMethod)) {
    let text = settings.getText(`importMethod.${key}`);
    msg.push(`  - ${text}：${value ? "已启用" : "已禁用"}`);
  }
  msg.push(`\n你可以使用“#成就配置录入[启用|禁用][方式]”来开关成就录入方式。\n例：#成就配置录入启用录屏`);
  e.reply(msg.join("\n"));
  return true;
}

function updateImportMethod(e) {
  let [, action, method] = e.msg.match(regexp2);
  let key = settings.getKeyByText(method);
  if (!key) {
    e.reply(`未知的成就录入方式：${method}`);
    return true;
  }
  settings.setAndSave(key, action === "启用");
  e.reply(`成就录入方式“${method}”已${action}`);
  return true;
}
