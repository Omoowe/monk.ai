// Config plugin: adds MonkWidget WidgetKit extension to the Xcode project.
// Runs during `expo prebuild` or `expo run:ios`.
// Swift sources live in ios-extensions/ (tracked) and are copied into ios/ at prebuild.
const { withXcodeProject, withEntitlementsPlist } = require('@expo/config-plugins');
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
    const dstBridge = path.join(iosRoot, 'Monkai');
    for (const f of fs.readdirSync(srcBridge)) {
      fs.copyFileSync(path.join(srcBridge, f), path.join(dstBridge, f));
    }

    // Idempotency guard
    if (proj.pbxTargetByName(WIDGET_NAME)) return cfg;

    // Add widget extension target
    const widgetTarget = proj.addTarget(WIDGET_NAME, 'app_extension', WIDGET_NAME, WIDGET_BID);
    const widgetUuid   = widgetTarget.uuid;

    // Build settings for widget target
    const allBuildConfigs = proj.pbxXCBuildConfigurationSection();
    const configListUuid  = proj.pbxNativeTargetSection()[widgetUuid].buildConfigurationList;
    const configList      = proj.pbxXCConfigurationListSection()[configListUuid];

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
        MARKETING_VERSION:                     '"1.0"',
        CURRENT_PROJECT_VERSION:               '"1"',
      });
      if (bc.name === 'Debug') {
        bc.buildSettings.SWIFT_OPTIMIZATION_LEVEL = '"-Onone"';
      }
    }

    // Add widget Swift source files
    for (const file of ['MonkWidget.swift', 'MonkWidgetBundle.swift']) {
      proj.addSourceFile(path.join(WIDGET_NAME, file), { target: widgetUuid }, WIDGET_NAME);
    }

    // Add Info.plist as resource
    proj.addResourceFile(path.join(WIDGET_NAME, 'Info.plist'), { target: widgetUuid }, WIDGET_NAME);

    // Add WidgetKit + SwiftUI frameworks to widget target
    proj.addFramework('WidgetKit.framework', { target: widgetUuid });
    proj.addFramework('SwiftUI.framework',   { target: widgetUuid });

    // Add bridge module files to main app target
    const mainTarget = proj.getFirstTarget().firstTarget;
    for (const file of ['MonkWidgetBridge.m', 'MonkWidgetBridge.swift']) {
      proj.addSourceFile(path.join(MAIN_TARGET, file), { target: mainTarget.uuid }, MAIN_TARGET);
    }

    // Wire widget into main app build
    proj.addTargetDependency(mainTarget.uuid, [widgetUuid]);

    // Embed Foundation Extensions build phase (dstSubfolderSpec = app_extension = 13)
    proj.addBuildPhase([], 'PBXCopyFilesBuildPhase', 'Embed Foundation Extensions',
                       mainTarget.uuid, 'app_extension');

    // Add widget product .appex to the embed phase
    const copyFilesSection = proj.pbxCopyFilesBuildPhaseSection();
    const buildFileSection = proj.pbxBuildFileSection();
    const productGroup     = proj.productGroup();
    const widgetProductRef = productGroup?.children?.find(
      (c) => c.comment === `${WIDGET_NAME}.appex`,
    );

    if (widgetProductRef) {
      const embedFileUuid = proj.generateUuid();
      buildFileSection[embedFileUuid] = {
        isa:      'PBXBuildFile',
        fileRef:  widgetProductRef.value,
        settings: { ATTRIBUTES: ['RemoveHeadersOnCopy', 'CodeSignOnCopy'] },
      };
      buildFileSection[`${embedFileUuid}_comment`] =
        `${WIDGET_NAME}.appex in Embed Foundation Extensions`;

      for (const [phaseKey, phase] of Object.entries(copyFilesSection)) {
        if (phaseKey.endsWith('_comment') || typeof phase !== 'object' || !phase.files) continue;
        const comment = copyFilesSection[`${phaseKey}_comment`] ?? '';
        if (comment.includes('Embed Foundation Extensions') ||
            phase.name === '"Embed Foundation Extensions"') {
          phase.files.push({
            value:   embedFileUuid,
            comment: `${WIDGET_NAME}.appex in Embed Foundation Extensions`,
          });
          break;
        }
      }
    }

    return cfg;
  });
}

module.exports = (config) => withAppGroup(withWidgetExtension(config));
