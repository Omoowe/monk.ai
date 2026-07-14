// Config plugin: adds MonkWidget WidgetKit extension to the Xcode project.
// Runs during `expo prebuild` or `expo run:ios`.
// Swift sources live in ios-extensions/ (tracked) and are copied into ios/ at prebuild.
const { withXcodeProject, withEntitlementsPlist, withDangerousMod } = require('@expo/config-plugins');
const {
  addBuildSourceFileToGroup,
  ensureGroupRecursively,
} = require('@expo/config-plugins/build/ios/utils/Xcodeproj');
const path = require('path');
const fs   = require('fs');

const WIDGET_NAME   = 'MonkWidget';
const WIDGET_BID    = 'com.monk.ai.widget';
const APP_GROUP     = 'group.com.monk.ai';
const MAIN_TARGET   = 'Monkai';

// ── 1. App Group entitlement on main app ─────────────────────
function withAppGroup(config) {
  return withEntitlementsPlist(config, (cfg) => {
    const key = 'com.apple.security.application-groups';
    const groups = cfg.modResults[key] ?? [];
    if (!groups.includes(APP_GROUP)) {
      cfg.modResults[key] = [...groups, APP_GROUP];
    }
    return cfg;
  });
}

// ── 2. Xcode project modifications ───────────────────────────
function withWidgetExtension(config) {
  return withXcodeProject(config, (cfg) => {
    const proj    = cfg.modResults;
    const root    = cfg.modRequest.projectRoot;
    const iosRoot = path.join(root, 'ios');

    // Copy tracked Swift sources into ios/ at prebuild time
    const srcWidget = path.join(root, 'ios-extensions', 'MonkWidget');
    const dstWidget = path.join(iosRoot, 'MonkWidget');
    fs.mkdirSync(dstWidget, { recursive: true });
    for (const f of fs.readdirSync(srcWidget)) {
      fs.copyFileSync(path.join(srcWidget, f), path.join(dstWidget, f));
    }
    const srcBridge = path.join(root, 'ios-extensions', 'MonkaiTarget');
    const dstBridge = path.join(iosRoot, MAIN_TARGET);
    for (const f of fs.readdirSync(srcBridge)) {
      fs.copyFileSync(path.join(srcBridge, f), path.join(dstBridge, f));
    }

    // Idempotency guard
    if (proj.pbxTargetByName(WIDGET_NAME)) return cfg;

    // Add widget extension target
    const widgetTarget = proj.addTarget(WIDGET_NAME, 'app_extension', WIDGET_NAME, WIDGET_BID);
    const widgetUuid   = widgetTarget.uuid;

    // Build settings for Debug + Release configs of the widget target
    const allBuildConfigs = proj.pbxXCBuildConfigurationSection();
    const configListUuid  = proj.pbxNativeTargetSection()[widgetUuid].buildConfigurationList;
    const configList      = proj.pbxXCConfigurationList()[configListUuid];

    for (const { value: cfgUuid } of (configList?.buildConfigurations ?? [])) {
      const bc = allBuildConfigs[cfgUuid];
      if (!bc?.buildSettings) continue;
      Object.assign(bc.buildSettings, {
        PRODUCT_NAME:                          `"${WIDGET_NAME}"`,
        PRODUCT_BUNDLE_IDENTIFIER:             `"${WIDGET_BID}"`,
        SWIFT_VERSION:                         '"5.0"',
        IPHONEOS_DEPLOYMENT_TARGET:            '"16.0"',
        TARGETED_DEVICE_FAMILY:                '"1,2"',
        INFOPLIST_FILE:                        `"${WIDGET_NAME}/Info.plist"`,
        CODE_SIGN_ENTITLEMENTS:                `"${WIDGET_NAME}/${WIDGET_NAME}.entitlements"`,
        SKIP_INSTALL:                          'YES',
        ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES: 'NO',
        CODE_SIGN_STYLE:                       'Automatic',
        MARKETING_VERSION:                     '"1.0.0"',
        CURRENT_PROJECT_VERSION:               '"1"',
      });
      if (bc.name === 'Debug') {
        bc.buildSettings.SWIFT_OPTIMIZATION_LEVEL = '"-Onone"';
      }
    }

    // addTarget('app_extension') creates NO build phases — create Sources + Frameworks manually.
    const pbxObjects    = proj.hash.project.objects;
    const fileSection   = proj.pbxFileReferenceSection();
    const bfSection     = proj.pbxBuildFileSection();
    const widgetNativeTarget = proj.pbxNativeTargetSection()[widgetUuid];

    // -- Sources phase --
    const srcPhaseUuid = proj.generateUuid();
    pbxObjects.PBXSourcesBuildPhase = pbxObjects.PBXSourcesBuildPhase || {};
    pbxObjects.PBXSourcesBuildPhase[srcPhaseUuid] = {
      isa: 'PBXSourcesBuildPhase', buildActionMask: 2147483647,
      files: [], runOnlyForDeploymentPostprocessing: 0,
    };
    pbxObjects.PBXSourcesBuildPhase[`${srcPhaseUuid}_comment`] = 'Sources';
    widgetNativeTarget.buildPhases.push({ value: srcPhaseUuid, comment: 'Sources' });

    // -- Frameworks phase --
    const fwkPhaseUuid = proj.generateUuid();
    pbxObjects.PBXFrameworksBuildPhase = pbxObjects.PBXFrameworksBuildPhase || {};
    pbxObjects.PBXFrameworksBuildPhase[fwkPhaseUuid] = {
      isa: 'PBXFrameworksBuildPhase', buildActionMask: 2147483647,
      files: [], runOnlyForDeploymentPostprocessing: 0,
    };
    pbxObjects.PBXFrameworksBuildPhase[`${fwkPhaseUuid}_comment`] = 'Frameworks';
    widgetNativeTarget.buildPhases.push({ value: fwkPhaseUuid, comment: 'Frameworks' });

    // Add Swift source files + file refs to group and widget Sources phase
    ensureGroupRecursively(proj, WIDGET_NAME);
    const widgetGroup = proj.pbxGroupByName(WIDGET_NAME);
    widgetGroup.children = widgetGroup.children || [];
    const srcPhase = pbxObjects.PBXSourcesBuildPhase[srcPhaseUuid];

    for (const file of ['MonkWidget.swift', 'MonkWidgetBundle.swift']) {
      const frUuid = proj.generateUuid();
      fileSection[frUuid] = {
        isa: 'PBXFileReference', lastKnownFileType: 'sourcecode.swift',
        name: `"${file}"`, path: `"${WIDGET_NAME}/${file}"`, sourceTree: '"<group>"',
      };
      fileSection[`${frUuid}_comment`] = file;
      widgetGroup.children.push({ value: frUuid, comment: file });

      const bfUuid = proj.generateUuid();
      bfSection[bfUuid] = { isa: 'PBXBuildFile', fileRef: frUuid };
      bfSection[`${bfUuid}_comment`] = `${file} in Sources`;
      srcPhase.files.push({ value: bfUuid, comment: `${file} in Sources` });
    }

    // Add WidgetKit + SwiftUI to widget Frameworks phase
    const fwkPhase = pbxObjects.PBXFrameworksBuildPhase[fwkPhaseUuid];
    for (const [fwkName, sdk] of [['WidgetKit', 'WidgetKit.framework'], ['SwiftUI', 'SwiftUI.framework']]) {
      const frUuid = proj.generateUuid();
      fileSection[frUuid] = {
        isa: 'PBXFileReference', lastKnownFileType: 'wrapper.framework',
        name: `"${sdk}"`, path: `"System/Library/Frameworks/${sdk}"`, sourceTree: 'SDKROOT',
      };
      fileSection[`${frUuid}_comment`] = sdk;
      const bfUuid = proj.generateUuid();
      bfSection[bfUuid] = { isa: 'PBXBuildFile', fileRef: frUuid };
      bfSection[`${bfUuid}_comment`] = `${sdk} in Frameworks`;
      fwkPhase.files.push({ value: bfUuid, comment: `${sdk} in Frameworks` });
    }

    // Add bridge module source files to main app target
    const mainTargetUuid = proj.getFirstTarget().uuid;
    ensureGroupRecursively(proj, MAIN_TARGET);
    for (const file of ['MonkWidgetBridge.m', 'MonkWidgetBridge.swift']) {
      addBuildSourceFileToGroup({
        filepath:   `${MAIN_TARGET}/${file}`,
        groupName:  MAIN_TARGET,
        project:    proj,
        targetUuid: mainTargetUuid,
      });
    }

    // Wire widget into main app build
    proj.addTargetDependency(mainTargetUuid, [widgetUuid]);

    // addTarget already created a "Copy Files" phase + .appex entry in the main target.
    // Add code-signing attributes to that auto-created build file entry.
    const buildFileSection = proj.pbxBuildFileSection();
    const appexBuildFileKey = Object.keys(buildFileSection)
      .filter(k => !k.endsWith('_comment'))
      .find(k => {
        const comment = buildFileSection[`${k}_comment`] ?? '';
        return comment.includes(`${WIDGET_NAME}.appex`);
      });
    if (appexBuildFileKey) {
      buildFileSection[appexBuildFileKey].settings = {
        ATTRIBUTES: ['RemoveHeadersOnCopy', 'CodeSignOnCopy'],
      };
    }

    return cfg;
  });
}

// ── 3. Podfile: fix fmt consteval errors on Xcode 16+ ────────
function withFmtFix(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');
      if (!podfile.includes('disable consteval on all Apple Clang')) {
        const fix = [
          '    # Fix: fmt consteval incompatibility with Xcode 16 — patch fmt/base.h',
          '    fmt_base = "#{installer.sandbox.root}/fmt/include/fmt/base.h"',
          '    if File.exist?(fmt_base)',
          '      File.chmod(0644, fmt_base)',
          '      content = File.read(fmt_base)',
          '      patched = content.gsub(',
          "        '__apple_build_version__ < 14000029L',",
          "        '__apple_build_version__ || 1  /* disable consteval on all Apple Clang */'",
          '      )',
          '      File.write(fmt_base, patched) if patched != content',
          '    end',
        ].join('\n');
        podfile = podfile.replace(
          /(\s+react_native_post_install\([\s\S]*?\)\n)(\s+end\nend)/,
          `$1${fix}\n$2`,
        );
        fs.writeFileSync(podfilePath, podfile);
      }
      return cfg;
    },
  ]);
}

module.exports = (config) => withFmtFix(withAppGroup(withWidgetExtension(config)));
