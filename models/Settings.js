import fs from "fs";
import lodash from "lodash";
import { _paths } from "../utils/common.js";

/** 配置类 */
export default class Settings {

  constructor() {
    this.$source = this.read();
  }

  get importMethod() {
    let value = this.get("importMethod");
    let enabled = [];
    for (const [method, isEnable] of Object.entries(value)) {
      if (isEnable) {
        enabled.push({
          method,
          text: this.getText(`importMethod.${method}`),
          humanText: this.getText(`importMethod.${method}`, true),
        });
      }
    }
    return {
      value,
      enabled,
      check: (method) => enabled.findIndex(e => e.method === method) !== -1,
    }
  }

  get(path) {
    return lodash.get(this.$source, path);
  }

  set(path, value) {
    return lodash.set(this.$source, path, value);
  }

  setAndSave(path, value) {
    this.set(path, value);
    this.save();
  }

  /**
   * 通过path获取text
   * @param path 配置路径
   * @param humanize 是否显示人性化文本
   */
  getText(path, humanize = false) {
    let preset = SETTINGS_PRESET.find(item => item.path === path);
    if (preset) {
      return preset[humanize ? "humanText" : "text"];
    }
    return path;
  }

  // 通过 text 获取 path
  getPathByText(text) {
    let preset = SETTINGS_PRESET.find(item => item.text === text);
    if (preset) {
      return preset.path;
    }
    return text;
  }

  /** 读取配置 */
  read() {
    if (!fs.existsSync(_paths.settingsPath)) {
      initSettingsJson();
    }
    let text = fs.readFileSync(_paths.settingsPath, "utf8");
    let json = JSON.parse(text);
    return lodash.merge({}, DEFAULT_SETTINGS, json);
  }

  save() {
    saveSettings(this.$source);
  }

}

export const _method = {
  COCO_GOAT: 'cocoGoat',
  IMAGE: 'image',
  VIDEO: 'video',
  INPUT: 'input',
};

/** 配置文件预设 */
const SETTINGS_PRESET = [
  { path: `importMethod.${_method.COCO_GOAT}`, def: true, text: "椰羊", humanText: "椰羊JSON", desc: "椰羊JSON文件" },
  { path: `importMethod.${_method.IMAGE}`, def: true, text: "截图", humanText: "成就截图", desc: "截图文件" },
  { path: `importMethod.${_method.VIDEO}`, def: false, text: "录屏", humanText: "录屏文件", desc: "录屏文件" },
  { path: `importMethod.${_method.INPUT}`, def: true, text: "手动", humanText: "手动输入成就ID", desc: "手动输入成就ID" },
];

/** 默认配置 */
const DEFAULT_SETTINGS = (() => {
  let res = {};
  for (const item of SETTINGS_PRESET) {
    lodash.set(res, item.path, item.def);
  }
  return res;
})();

function initSettingsJson() {
  saveSettings(DEFAULT_SETTINGS);
}

function saveSettings(settings) {
  if (!fs.existsSync(_paths.userDataPath)) {
    fs.mkdirSync(_paths.userDataPath);
  }
  fs.writeFileSync(_paths.settingsPath, JSON.stringify(settings, null, 2));
}
