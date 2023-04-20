import fs from 'fs';

let isV2 = false, isV3 = false, isMiao = false;

let pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
if (pkg && pkg.version) {
  // 2.x 版本
  if (pkg.version.startsWith('2')) {
    isV2 = true;
  } else {
    isV3 = true;
  }
}

// 兼容 miao-yunzai
if (pkg && pkg.name) {
  if (pkg.name === 'miao-yunzai') {
    isMiao = true;
  }
}

/**
 * 动态引入
 * @param v2Path
 * @param v3Path
 * @param miaoPath
 */
export async function dynamicImport(v2Path, v3Path, miaoPath) {
  if (isV2) {
    if (v2Path) {
      return await import(v2Path);
    }
  } else {
    if (isMiao && miaoPath) {
      return await import(miaoPath);
    } else if (v3Path) {
      return await import(v3Path);
    }
  }
  // 默认返回空对象，防止取值报错
  return {};
}

export { isV2, isV3, isMiao };
